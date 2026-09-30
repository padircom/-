/** جداول پشتیبان گزارش روزانه (dprt-v1) — dprTablesApi
 * ------------------------------------------------------------------
 * شش جدول پشتیبان DPR (وضعیت کارگاه، شرح تشریحی، نیروی انسانی،
 * ماشین‌آلات، تغییرات، فعالیت‌های اصلی) با کلید (پروژه، تاریخ شمسی).
 *
 * ماندگاری: فایل JSON به‌ازای هر پروژه زیر `<DATA_DIR>/dpr-tables/` با
 * نوشتن اتمی (فایل موقت + rename) و حافظهٔ میانی — همان الگوی dprDocApi،
 * تا هم در پیش‌نمایش JSON و هم در آزمون‌های REST (دایرکتوری موقت) کار
 * کند و به SQL Server وابسته نباشد.
 *
 * قفل تأیید: گزارش `submitted`/`approved` با PUT قابل ویرایش نیست (۴۰۹)؛
 * فقط گذار `return` آن را به پیش‌نویس برمی‌گرداند.
 *
 * مسیرها:
 *   GET /api/dpr/tables/health
 *   GET /api/dpr/projects/:projectCode/reports
 *   GET /api/dpr/projects/:projectCode/reports/:date
 *   PUT /api/dpr/projects/:projectCode/reports/:date
 *   POST /api/dpr/projects/:projectCode/reports/:date/actions
 */
import fs from "node:fs";
import path from "node:path";
import {
  DPR_TABLES_VERSION,
  DPR_LIMITS,
  emptyReport,
  historyFromReports,
  incrementTrailingNumber,
  nextReportStatus,
  splitReportDate,
  validateReport,
} from "./dprTablesLogic.js";

const PROJECT_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,60}$/;
const ACTION_RE = /^(submit|approve|return)$/;

function fail(res, req, status, code, message) {
  return res.status(status).json({ ok: false, error: { code, message, traceId: req.requestId } });
}

/** گزارش‌های یک پروژه: تاریخ شمسی ← گزارش. */
function blankProject() {
  return { version: 1, updatedAt: null, reports: {} };
}

export function registerDprTablesRoutes(app, opts = {}) {
  if (!app) throw new Error("registerDprTablesRoutes: app is required");
  const root = path.resolve(opts.dataDir || path.resolve(process.cwd(), "server/data"));
  const dir = path.join(root, "dpr-tables");
  fs.mkdirSync(dir, { recursive: true });

  /** projectCode → project file content */
  const cache = new Map();

  const fileFor = (projectCode) => path.join(dir, `${projectCode}.json`);

  function loadProject(projectCode) {
    if (cache.has(projectCode)) return cache.get(projectCode);
    let data = blankProject();
    try {
      if (fs.existsSync(fileFor(projectCode))) {
        const parsed = JSON.parse(fs.readFileSync(fileFor(projectCode), "utf8"));
        if (parsed && typeof parsed === "object" && parsed.reports && typeof parsed.reports === "object") {
          data = { version: 1, updatedAt: parsed.updatedAt ?? null, reports: parsed.reports };
        }
      }
    } catch {
      try {
        fs.copyFileSync(fileFor(projectCode), `${fileFor(projectCode)}.corrupt-${Date.now()}`);
      } catch { /* ignore */ }
      data = blankProject();
    }
    cache.set(projectCode, data);
    return data;
  }

  function saveProject(projectCode, data) {
    data.updatedAt = new Date().toISOString();
    cache.set(projectCode, data);
    const tmp = `${fileFor(projectCode)}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, fileFor(projectCode));
  }

  const checkScope = (req, res, next) => {
    const { projectCode, date } = req.params;
    if (!PROJECT_RE.test(String(projectCode || ""))) {
      return fail(res, req, 400, "E-DPRT-PROJECT", "کد پروژه نامعتبر است");
    }
    if (date !== undefined && !splitReportDate(String(date || ""))) {
      return fail(res, req, 400, "E-DPRT-DATE", "تاریخ گزارش باید شمسی YYYY/MM/DD باشد");
    }
    next();
  };

  function historyFor(data, date) {
    const reports = Object.values(data.reports || {});
    return historyFromReports(reports, date);
  }

  function suggestedNo(data) {
    const dates = Object.keys(data.reports || {}).sort();
    if (!dates.length) return "";
    const latest = data.reports[dates[dates.length - 1]];
    return incrementTrailingNumber(latest?.reportNo || "");
  }

  app.get("/api/dpr/tables/health", (req, res) => {
    let reports = 0;
    try {
      for (const f of fs.readdirSync(dir)) {
        if (!f.endsWith(".json")) continue;
        const data = loadProject(f.slice(0, -".json".length));
        reports += Object.keys(data.reports || {}).length;
      }
    } catch { /* ignore */ }
    res.json({
      ok: true,
      data: { mounted: true, version: DPR_TABLES_VERSION, projects: cache.size, reports },
      meta: { traceId: req.requestId },
    });
  });

  app.get("/api/dpr/projects/:projectCode/reports", checkScope, (req, res) => {
    const data = loadProject(req.params.projectCode);
    const list = Object.entries(data.reports || {})
      .map(([date, r]) => ({ date, reportNo: r.reportNo || "", status: r.status || "draft", updatedAt: r.updatedAt || null }))
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    res.json({ ok: true, data: list, meta: { traceId: req.requestId } });
  });

  app.get("/api/dpr/projects/:projectCode/reports/:date", checkScope, (req, res) => {
    const { projectCode, date } = req.params;
    const data = loadProject(projectCode);
    const stored = data.reports[date];
    const report = stored || emptyReport(projectCode, date, suggestedNo(data));
    res.json({
      ok: true,
      data: { exists: Boolean(stored), report, history: historyFor(data, date), suggestedNo: suggestedNo(data) },
      meta: { traceId: req.requestId },
    });
  });

  app.put("/api/dpr/projects/:projectCode/reports/:date", checkScope, (req, res) => {
    const { projectCode, date } = req.params;
    const data = loadProject(projectCode);
    const stored = data.reports[date];
    if (stored && (stored.status === "submitted" || stored.status === "approved")) {
      return fail(res, req, 409, "E-DPRT-LOCKED", "گزارش ارسال/تأییدشده قفل است؛ ابتدا آن را برگردانید");
    }
    const body = (req.body && typeof req.body === "object" ? req.body : {});
    const report = {
      ...emptyReport(projectCode, date, ""),
      ...body,
      projectCode,
      reportDate: date,
      status: "draft",
      site: { ...(body.site && typeof body.site === "object" ? body.site : {}), reportDate: date },
    };
    if (typeof report.reportNo === "string") report.reportNo = report.reportNo.trim().slice(0, DPR_LIMITS.reportNoMax);
    const check = validateReport(report);
    if (!check.ok) {
      return fail(res, req, 400, "E-DPRT-VALIDATION", check.issues.slice(0, 8).join("؛ "));
    }
    const now = new Date().toISOString();
    report.createdAt = stored?.createdAt || now;
    report.updatedAt = now;
    data.reports[date] = report;
    saveProject(projectCode, data);
    res.json({
      ok: true,
      data: { exists: true, report, history: historyFor(data, date), suggestedNo: suggestedNo(data) },
      meta: { traceId: req.requestId },
    });
  });

  app.post("/api/dpr/projects/:projectCode/reports/:date/actions", checkScope, (req, res) => {
    const { projectCode, date } = req.params;
    const action = String(req.body?.action || "");
    if (!ACTION_RE.test(action)) return fail(res, req, 400, "E-DPRT-ACTION", "اقدام نامعتبر است");
    const data = loadProject(projectCode);
    const stored = data.reports[date];
    if (!stored) return fail(res, req, 404, "E-DPRT-NOT-FOUND", "گزارشی برای این تاریخ ثبت نشده است");
    const to = nextReportStatus(stored.status, action);
    if (!to) return fail(res, req, 409, "E-DPRT-TRANSITION", "گذار وضعیت مجاز نیست");
    stored.status = to;
    stored.updatedAt = new Date().toISOString();
    saveProject(projectCode, data);
    res.json({ ok: true, data: { status: to }, meta: { traceId: req.requestId } });
  });
}

export default { registerDprTablesRoutes };
