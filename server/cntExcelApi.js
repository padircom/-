/**
 * CNT — ورود/خروج اختصاصی Excel قالبها و ریزمتره (فاز ۴ ADR-CNT-IPC-UNIFY)
 * ---------------------------------------------------------------------------
 * چرا مسیر اختصاصی و نه موتور عمومی فایل (`/api/integration/*` و `/api/files`)؟
 * قالب صورتوضعیت و ریزمتره دو جدول حساساند: عدد و مبنای کسر را از روی
 * فایل اکسل نمیپذیریم بیآنکه از `normalizeIpcTemplate` / `validateBoqItem`
 * موتور بگذرد. مسیرهای اختصاصی:
 *
 *   GET  /api/cnt/excel/templates            → خروجی XLSX واقعی (سه شیت)
 *   POST /api/cnt/excel/templates            → ورود (preview بصورت پیشفرض، commit=1 برای ثبت)
 *   GET  /api/cnt/excel/measurements         → خروجی XLSX ریزمتره
 *   POST /api/cnt/excel/measurements         → ورود (preview/commit)
 *
 * قواعد:
 *  - خروجی XLSX باینری واقعی است (نه HTML با پسوند xls)؛ فونت/جهت در سلولها
 *    نیاز به CSS ندارد چون xlsx فارسی را بهصورت یونیکد نگه میدارد.
 *  - ورود همیشه نخست «پیشنمایش» است؛ تا `commit=1` نیاید چیزی نوشته نمیشود.
 *  - نرخ و مبلغ تجمعی هرگز از فایل پذیرفته نمیشود؛仅 ورودیهای مجاز
 *    (شناسه ردیف، مقدار، شرح، نرخ تعریفشده در قالب) خوانده میشوند.
 *  - پیش از نوشتن، دروازهٔ کیفی ریزمتره همان `qualityGate` موتور سنجیده
 *    میشود — مسیر Excel نباید دور زدن دروازه باشد.
 */
import XLSX from "xlsx";
import multer from "multer";
import {
  normalizeIpcTemplate,
  CNT_MODEL,
  templateRunningBaseWarningsFa,
} from "./cntIpcLogic.js";

/* CntIpcTemplate از پیش در CNT_IPC_DEDICATED_ROUTES بسته شده است؛ اینجا
 * دوباره تعریفش نمیکنیم تا مسیر اختصاصی قدیمی (و پیام خطایش) عوض نشود. */
export const CNT_EXCEL_DEDICATED_ROUTES = {
  MeasurementSheet: "/api/cnt/excel/measurements",
};

const PROJECT_RE = /^[A-Za-z0-9_-]{1,50}$/;
const MAX_ROWS = 500;
const MAX_BYTES = 2 * 1024 * 1024;

const excelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
});

class ExcelError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}
const bad = (code, message, extra) => new ExcelError(400, code, message, extra);
const conflict = (code, message, extra) => new ExcelError(409, code, message, extra);

/** سرستونهای دوزبانه — خروجی و ورود دقیقاً یکیاند تا round-trip ممکن باشد. */
const TEMPLATE_HEADERS = ["Code", "TitleFa", "ContractCode", "Status", "Version", "NoteFa"];
const ITEM_HEADERS = ["TemplateCode", "Code", "TitleFa", "Unit", "Basis", "PercentOf", "Sign"];
const DEDUCTION_HEADERS = ["TemplateCode", "Code", "TitleFa", "Kind", "Mode", "Rate", "Base", "ItemCode"];
const BOQ_HEADERS = ["ItemNo", "TitleFa", "Unit", "PricingBasis", "ContractQty", "UnitRate", "LineAmount", "RateStatus", "Status"];
const MEASUREMENT_HEADERS = ["ItemNo", "SheetNo", "Count", "Length", "Width", "Height", "Factor", "Quantity", "LocationFa", "Status"];

const jsonOf = (v, fallback) => {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    try { const p = JSON.parse(v); return Array.isArray(p) ? p : fallback; } catch { return fallback; }
  }
  return fallback;
};
const cell = (v) => (v === null || v === undefined ? "" : v);
const numOrNull = (v) => (v === "" || v === null || v === undefined ? null : Number(v));

function sheetFrom(rows, headers) {
  const aoa = [headers, ...rows.map((r) => headers.map((h) => cell(r[h])))];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = headers.map((h) => ({ wch: Math.max(14, Math.min(40, h.length + 8)) }));
  return ws;
}
function workbook(specs) {
  const wb = XLSX.utils.book_new();
  for (const [name, rows, headers] of specs) {
    XLSX.utils.book_append_sheet(wb, sheetFrom(rows, headers), name);
  }
  return XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
}
function parseWorkbook(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const out = {};
  for (const name of wb.SheetNames) {
    out[name] = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: "", raw: false });
  }
  return out;
}

export function registerCntExcelRoutes(app, { repo, subjects, evaluate } = {}) {
  if (!app) throw new Error("registerCntExcelRoutes: app is required");

  const ok = (req, res, data, status = 200) => res.status(status).json({ ok: true, data, meta: { traceId: req.requestId } });
  const fail = (req, res, err) => {
    if (err instanceof ExcelError) return res.status(err.status).json({ ok: false, error: { code: err.code, message: err.message, ...err.extra, traceId: req.requestId } });
    if (err?.name === "CntValidationError" || err?.code === "CNT_VALIDATION" || err?.code === "ROW_VALIDATION_FAILED") {
      return res.status(422).json({ ok: false, error: { code: "E-CNT-EXCEL-VALIDATION", message: err.message, traceId: req.requestId } });
    }
    console.error("[%s] cnt-excel error:", req.requestId, err);
    return res.status(500).json({ ok: false, error: { code: "E-CNT-EXCEL-INTERNAL", message: "خطای داخلی سرور", traceId: req.requestId } });
  };
  const subjectOf = (req) => {
    const id = String(req.headers["x-user-id"] || "").trim();
    return id ? subjects?.find((u) => u.id === id && u.active !== false) ?? null : null;
  };
  const guard = (permission) => (req, res, next) => {
    const enforce = String(process.env.CNT_RBAC_ENFORCE ?? "1") !== "0";
    if (!PROJECT_RE.test(String(req.params.projectId || ""))) {
      return res.status(400).json({ ok: false, error: { code: "E-CNT-EXCEL-BAD-PROJECT", message: "شناسهٔ پروژه نامعتبر است", traceId: req.requestId } });
    }
    const subject = subjectOf(req);
    if (!subject) {
      if (!enforce) return next();
      return res.status(401).json({ ok: false, error: { code: "E-CNT-EXCEL-AUTH-REQUIRED", message: "شناسهٔ کاربر معتبر الزامی است", permission, traceId: req.requestId } });
    }
    if (!evaluate(subject, permission, { projectId: req.params.projectId }).allow) {
      return res.status(403).json({ ok: false, error: { code: "E-CNT-EXCEL-FORBIDDEN", message: "مجوز این اقدام یا دسترسی به این پروژه را ندارید", permission, traceId: req.requestId } });
    }
    return next();
  };
  const route = (handler) => async (req, res) => {
    try {
      const r = await repo();
      if (!r) throw new ExcelError(503, "E-CNT-EXCEL-NO-STORE", "لایهٔ ماندگاری در دسترس نیست");
      await handler(req, res, r, req.params.projectId);
    } catch (err) { fail(req, res, err); }
  };
  const byProject = (pid) => [{ column: "ProjectId", op: "eq", value: pid }];
  const actor = (req) => String(req.headers["x-user-id"] || "system").slice(0, 60);
  const audit = async (r, req, action, details) => {
    try {
      await r.create("AuditLog", {
        At: new Date().toISOString(), SubjectId: actor(req), Action: action,
        ProjectCode: req.params.projectId, EntityName: details.entityName ?? null,
        EntityId: details.entityId ?? null, Severity: details.severity ?? "info",
        Details: { traceId: req.requestId, ...details },
      }, actor(req));
    } catch { /* ممیزی نباید اصل کار را بشکند */ }
  };

  const base = "/api/cnt/excel/:projectId";

  /* ───────────────────────── خروجی قالبها ───────────────────────── */
  app.get(`${base}/templates`, guard("cnt.contract.view"), route(async (req, res, r, pid) => {
    const rows = await r.list("CntIpcTemplate", { where: byProject(pid), limit: MAX_ROWS + 1 });
    if (rows.length > MAX_ROWS) throw conflict("E-CNT-EXCEL-CAPACITY", `بیش از ${MAX_ROWS} قالب در پروژه است`);
    const templates = [], items = [], deductions = [];
    for (const row of rows) {
      templates.push({
        Code: row.Code, TitleFa: row.TitleFa, ContractCode: row.ContractCode ?? "",
        Status: row.Status, Version: row.Version ?? 0, NoteFa: row.NoteFa ?? "",
      });
      for (const it of jsonOf(row.ItemsJson, [])) items.push({ TemplateCode: row.Code, ...it });
      for (const d of jsonOf(row.DeductionsJson, [])) deductions.push({ TemplateCode: row.Code, ...d });
    }
    const buf = workbook([
      ["قالبها", templates, TEMPLATE_HEADERS],
      ["ردیفها", items, ITEM_HEADERS],
      ["کسورات", deductions, DEDUCTION_HEADERS],
    ]);
    res.setHeader("content-type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("content-disposition", `attachment; filename="cnt-ipc-templates-${pid}.xlsx"`);
    return res.send(buf);
  }));

  /* ───────────────────────── ورود قالبها ───────────────────────── */
  app.post(`${base}/templates`, guard("cnt.ipctemplate.edit"), excelUpload.single("file"), route(async (req, res, r, pid) => {
    if (!req.file?.buffer?.length) throw bad("E-CNT-EXCEL-NO-FILE", "فایل XLSX ارسال نشده است");
    const sheets = parseWorkbook(req.file.buffer);
    const templates = sheets["قالبها"] ?? [];
    const items = sheets["ردیفها"] ?? [];
    const deductions = sheets["کسورات"] ?? [];
    if (!templates.length) throw bad("E-CNT-EXCEL-EMPTY", "شیت «قالبها» خالی است");
    if (templates.length + items.length + deductions.length > MAX_ROWS * 3) {
      throw conflict("E-CNT-EXCEL-CAPACITY", `سقف ${MAX_ROWS} ردیف در هر شیت رعایت نشده است`);
    }

    const byCode = new Map();
    for (const t of templates) {
      const code = String(t.Code ?? "").trim().toUpperCase();
      if (!code) throw bad("E-CNT-EXCEL-VALIDATION", "کد قالب الزامی است", { field: "Code" });
      byCode.set(code, { Code: code, TitleFa: String(t.TitleFa ?? ""), ContractCode: t.ContractCode || null,
        NoteFa: t.NoteFa || null, Items: [], Deductions: [] });
    }
    for (const it of items) {
      const code = String(it.TemplateCode ?? "").trim().toUpperCase();
      if (!byCode.has(code)) throw bad("E-CNT-EXCEL-VALIDATION", `ردیف به قالب ناموجود «${code}» اشاره میکند`, { field: "TemplateCode" });
      byCode.get(code).Items.push({
        Code: String(it.Code ?? ""), TitleFa: String(it.TitleFa ?? ""),
        Unit: String(it.Unit ?? ""), Basis: String(it.Basis ?? ""),
        PercentOf: it.PercentOf || null, Sign: String(it.Sign ?? "+"),
      });
    }
    for (const d of deductions) {
      const code = String(d.TemplateCode ?? "").trim().toUpperCase();
      if (!byCode.has(code)) throw bad("E-CNT-EXCEL-VALIDATION", `کسر به قالب ناموجود «${code}» اشاره میکند`, { field: "TemplateCode" });
      byCode.get(code).Deductions.push({
        Code: String(d.Code ?? ""), TitleFa: String(d.TitleFa ?? ""),
        Kind: String(d.Kind ?? "other"), Mode: String(d.Mode ?? "percent"),
        Rate: numOrNull(d.Rate), Base: String(d.Base ?? "gross"), ItemCode: d.ItemCode || null,
      });
    }

    /* اعتبارسنجی از خود موتور قالب — همان قاعدهای که مسیر REST اعمال میکند. */
    const normalized = [];
    const issues = [];
    for (const t of byCode.values()) {
      try {
        const n = normalizeIpcTemplate(t);
        normalized.push({ template: n, warningsFa: templateRunningBaseWarningsFa(n.Deductions) });
      } catch (err) {
        issues.push({ Code: t.Code, messageFa: err?.message ?? "قالب نامعتبر است" });
      }
    }
    if (issues.length) {
      return res.status(422).json({ ok: false, error: { code: "E-CNT-EXCEL-VALIDATION", message: `${issues.length} قالب نامعتبر است`, issues, traceId: req.requestId } });
    }

    const commit = req.query.commit === "1" || req.body?.commit === "1" || req.body?.commit === true;
    const preview = normalized.map(({ template, warningsFa }) => ({
      Code: template.Code, TitleFa: template.TitleFa,
      itemCount: template.Items.length, deductionCount: template.Deductions.length,
      warningsFa,
    }));
    if (!commit) return ok(req, res, { committed: false, count: preview.length, preview, issues: [] });

    let written = 0, inserted = 0;
    for (const { template } of normalized) {
      const existing = await r.findOne("CntIpcTemplate", [...byProject(pid), { column: "Code", op: "eq", value: template.Code }]);
      if (existing) {
        /* قالب منتشرشده دستنخورده میماند — نسخهٔ تازه فقط با کد تازه. */
        if (existing.Status !== "draft") continue;
        await r.patch("CntIpcTemplate", existing.Id, {
          TitleFa: template.TitleFa, ContractCode: template.ContractCode,
          ItemsJson: template.Items, DeductionsJson: template.Deductions, NoteFa: template.NoteFa,
        }, actor(req), existing.RowVersion);
      } else {
        await r.create("CntIpcTemplate", {
          ProjectId: pid, Code: template.Code, TitleFa: template.TitleFa,
          ContractCode: template.ContractCode, ItemsJson: template.Items,
          DeductionsJson: template.Deductions, NoteFa: template.NoteFa,
          Status: "draft", Version: 0, ModelVersion: CNT_MODEL,
        }, actor(req), "cntipctpl");
        inserted += 1;
      }
      written += 1;
    }
    await audit(r, req, "CNT_IPC_EXCEL_TEMPLATE_IMPORT", { entityName: "CntIpcTemplate", written, inserted });
    return ok(req, res, { committed: true, written, inserted, updated: written - inserted, count: preview.length, preview, issues: [] });
  }));

  /* ───────────────────────── خروجی ریزمتره ───────────────────────── */
  app.get(`${base}/measurements`, guard("cnt.contract.view"), route(async (req, res, r, pid) => {
    const contractId = String(req.query.contractId || "");
    if (!contractId) throw bad("E-CNT-EXCEL-NO-CONTRACT", "پارامتر contractId الزامی است");
    const [boq, sheets] = await Promise.all([
      r.list("ContractBOQ_Item", { where: [{ column: "ContractId", op: "eq", value: contractId }], limit: MAX_ROWS + 1 }),
      r.list("MeasurementSheet", { where: [{ column: "ContractId", op: "eq", value: contractId }], limit: MAX_ROWS + 1 }),
    ]);
    if (boq.length > MAX_ROWS || sheets.length > MAX_ROWS) throw conflict("E-CNT-EXCEL-CAPACITY", `سقف ${MAX_ROWS} ردیف رعایت نشده است`);
    const itemByNo = new Map(boq.map((b) => [String(b.ItemNo), b]));
    const buf = workbook([
      ["فهرستبها", boq.map((b) => ({
        ItemNo: b.ItemNo, TitleFa: b.TitleFa, Unit: b.Unit ?? "",
        PricingBasis: b.PricingBasis, ContractQty: b.ContractQty, UnitRate: b.UnitRate,
        LineAmount: b.LineAmount, RateStatus: b.RateStatus, Status: b.Status,
      })), BOQ_HEADERS],
      ["ریزمتره", sheets.map((s) => {
        const b = itemByNo.get(String(s.BoqItemId)) ?? {};
        return {
          ItemNo: b.ItemNo ?? s.BoqItemId, SheetNo: s.SheetNo,
          Count: s.Count, Length: s.Length, Width: s.Width, Height: s.Height,
          Factor: s.Factor, Quantity: s.Quantity, LocationFa: s.LocationFa ?? "", Status: s.Status,
        };
      }), MEASUREMENT_HEADERS],
    ]);
    res.setHeader("content-type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("content-disposition", `attachment; filename="cnt-measurements-${pid}.xlsx"`);
    return res.send(buf);
  }));

  /* ───────────────────────── ورود ریزمتره ───────────────────────── */
  app.post(`${base}/measurements`, guard("cnt.measurement.record"), excelUpload.single("file"), route(async (req, res, r, pid) => {
    if (!req.file?.buffer?.length) throw bad("E-CNT-EXCEL-NO-FILE", "فایل XLSX ارسال نشده است");
    const contractId = String(req.query.contractId || req.body?.contractId || "");
    if (!contractId) throw bad("E-CNT-EXCEL-NO-CONTRACT", "پارامتر contractId الزامی است");
    const contract = await r.findOne("ContractMaster", [...byProject(pid), { column: "Id", op: "eq", value: contractId }]);
    if (!contract) throw new ExcelError(404, "E-CNT-EXCEL-NOT-FOUND", "پیمان یافت نشد");

    const sheets = parseWorkbook(req.file.buffer);
    const rows = sheets["ریزمتره"] ?? [];
    if (!rows.length) throw bad("E-CNT-EXCEL-EMPTY", "شیت «ریزمتره» خالی است");
    if (rows.length > MAX_ROWS) throw conflict("E-CNT-EXCEL-CAPACITY", `سقف ${MAX_ROWS} ردیف رعایت نشده است`);

    const boq = await r.list("ContractBOQ_Item", { where: [{ column: "ContractId", op: "eq", value: contractId }], limit: MAX_ROWS + 1 });
    const byNo = new Map(boq.map((b) => [String(b.ItemNo), b]));
    const issues = [];
    const parsed = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const itemNo = String(row.ItemNo ?? "").trim();
      const b = byNo.get(itemNo);
      const sheetNo = Number(row.SheetNo);
      const at = i + 2; /* شمارهٔ ردیف در اکسل (سرستون ردیف ۱) */
      if (!b) { issues.push({ row: at, field: "ItemNo", messageFa: `ردیف ${at}: ردیف فهرستبهای «${itemNo}» یافت نشد` }); continue; }
      if (String(b.PricingBasis) !== "unit_price") {
        issues.push({ row: at, field: "ItemNo", messageFa: `ردیف ${at}: ردیف ${itemNo} مقطوع است و ریزمتره ندارد` }); continue;
      }
      if (!Number.isInteger(sheetNo) || sheetNo < 1) {
        issues.push({ row: at, field: "SheetNo", messageFa: `ردیف ${at}: شمارهٔ برگه باید عدد صحیح مثبت باشد` }); continue;
      }
      const dims = {
        Count: numOrNull(row.Count), Length: numOrNull(row.Length), Width: numOrNull(row.Width),
        Height: numOrNull(row.Height), Factor: numOrNull(row.Factor),
      };
      if (Object.values(dims).some((v) => v !== null && (!Number.isFinite(v) || v < 0))) {
        issues.push({ row: at, field: "Quantity", messageFa: `ردیف ${at}: ابعاد/تعداد باید عدد نامنفی باشند` }); continue;
      }
      /* Quantity هرگز از فایل خوانده نمیشود — فقط ابعاد، و مقدار نهایی
       * همان ضرب موتور است. ستون Quantity صرفاً برای خوانایی انسانی است. */
      const status = ["draft", "claimed", "verified", "rejected"].includes(String(row.Status)) ? String(row.Status) : "draft";
      parsed.push({ row: at, itemNo, boqItemId: String(b.Id), sheetNo, dims, status,
        locationFa: row.LocationFa ? String(row.LocationFa).slice(0, 400) : null });
    }
    if (issues.length) {
      return res.status(422).json({ ok: false, error: { code: "E-CNT-EXCEL-VALIDATION", message: `${issues.length} ردیف نامعتبر است`, issues, traceId: req.requestId } });
    }

    const commit = req.query.commit === "1" || req.body?.commit === "1" || req.body?.commit === true;
    const preview = parsed.map((p) => ({ row: p.row, itemNo: p.itemNo, sheetNo: p.sheetNo, status: p.status }));
    if (!commit) return ok(req, res, { committed: false, count: preview.length, preview, issues: [] });

    let written = 0, inserted = 0;
    for (const p of parsed) {
      const up = await r.upsert("MeasurementSheet", { BoqItemId: p.boqItemId, SheetNo: p.sheetNo }, {
        ProjectId: pid, ContractId: contractId, BoqItemId: p.boqItemId, SheetNo: p.sheetNo,
        LocationFa: p.locationFa, ...p.dims,
        /* مقدار نهایی از ابعاد مشتق میشود؛ سلول Quantity فایل کنترلی نیست. */
        Quantity: (p.dims.Count ?? 1) * (p.dims.Length ?? 1) * (p.dims.Width ?? 1) * (p.dims.Height ?? 1) * (p.dims.Factor ?? 1),
        Status: p.status,
      }, actor(req));
      written += 1;
      if (up.action === "insert") inserted += 1;
    }
    await audit(r, req, "CNT_IPC_EXCEL_MEASUREMENT_IMPORT", { entityName: "MeasurementSheet", written, inserted });
    return ok(req, res, { committed: true, written, inserted, updated: written - inserted, count: preview.length, preview, issues: [] });
  }));

  return { CNT_EXCEL_DEDICATED_ROUTES };
}
