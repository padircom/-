/**
 * میز کار هزینه و تأمین d5 — REST (LIVE-1)
 * ------------------------------------------------------------------
 * پیش از این، صفحهٔ d5 فقط آرایه‌های ثابت درون کد داشت و هیچ مسیر `fin`
 * در سرور نبود؛ هر تغییر با رفرش از بین می‌رفت.
 *
 * اصول:
 *  - دفتر هزینهٔ واقعی مشترک است (EQP و HRM هم به CostAccount.Actual
 *    ثبت می‌زنند)؛ پس اینجا فقط «افزایشی» نوشته می‌شود و هر تراکنش مبلغ
 *    پایهٔ لحظهٔ ثبت را نگه می‌دارد تا برگشتش دقیق باشد.
 *  - CostAccount.Committed را فقط d5 می‌نویسد: Σ(ارزش PO − فاکتورشده).
 *  - فاکتور PO به‌طور خودکار هزینهٔ واقعی می‌سازد (زنجیرهٔ تعهد → واقعی)
 *    و قابل حذف دستی نیست؛ برگشت فقط از مسیر خود PO.
 *  - کنترل بودجهٔ PR، تفکیک وظیفه (درخواست‌کننده ≠ تأییدکننده) و مجوز
 *    DoA ذخیره سمت سرور اجرا می‌شود؛ کلاینت فقط نمایش می‌دهد.
 *  - Snapshot EVM را سرور از دادهٔ ذخیره‌شده می‌سازد، نه از عدد کلاینت.
 *  - دادهٔ نمونه فقط با درخواست صریح و فقط روی پروژهٔ خالی.
 */
import {
  FIN_SAMPLE,
  FIN_WS_VERSION,
  committedForAccount,
  cumulativeMatch,
  defaultFinSettings,
  evmModel,
  ledgerNodes,
  poValues,
  resolveSettings,
  safeBase,
} from "./finWsLogic.js";
import { cbsAvailable, computeEvm, createEvmSnapshot, prBudgetCheck, reserveDraw, verifySnapshot, FIN_FORMULA_VERSION } from "./finLogic.js";

const PROJECT_RE = /^[A-Za-z0-9_-]{1,60}$/;
const CODE_RE = /^[A-Za-z0-9][A-Za-z0-9._\-]{0,39}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const KINDS = new Set(["direct", "indirect", "reserve"]);
const CATEGORIES = new Set(["labor", "material", "equipment", "subcontract", "overhead"]);
const CURVES = new Set(["linear", "bell", "front", "back", "scurve"]);
const KPI_FIELDS = ["KpiOnTimePct", "KpiQualityPct", "KpiPricePct", "KpiResponsePct", "KpiHsePct"];

class FinError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}
const bad = (code, message, extra) => new FinError(400, code, message, extra);
const conflict = (code, message, extra) => new FinError(409, code, message, extra);
const notFound = (message) => new FinError(404, "E-FIN-NOT-FOUND", message);

/* ─────────── اعتبارسنجی ورودی ─────────── */

function text(v, field, { max = 400, required = false } = {}) {
  const s = String(v ?? "").trim();
  if (!s) {
    if (required) throw bad("E-FIN-REQUIRED", `«${field}» الزامی است`, { field });
    return null;
  }
  if (s.length > max) throw bad("E-FIN-TOO-LONG", `«${field}» حداکثر ${max} نویسه است`, { field });
  return s;
}

function num(v, field, { min = -Infinity, max = Infinity, int = false, required = false } = {}) {
  if (v === undefined || v === null || v === "") {
    if (required) throw bad("E-FIN-REQUIRED", `«${field}» الزامی است`, { field });
    return null;
  }
  const x = Number(v);
  if (!Number.isFinite(x) || (int && !Number.isInteger(x)) || x < min || x > max) {
    throw bad("E-FIN-INVALID-NUMBER", `«${field}» عدد معتبر${int ? " صحیح" : ""} در بازهٔ مجاز نیست`, { field });
  }
  return x;
}

function date(v, field, { required = false } = {}) {
  const s = String(v ?? "").trim();
  if (!s) {
    if (required) throw bad("E-FIN-REQUIRED", `«${field}» الزامی است`, { field });
    return null;
  }
  if (!DATE_RE.test(s) || Number.isNaN(Date.parse(s))) throw bad("E-FIN-INVALID-DATE", `«${field}» تاریخ YYYY-MM-DD نیست`, { field });
  return s;
}

function code(v, field, { required = true } = {}) {
  const s = String(v ?? "").trim();
  if (!s) {
    if (required) throw bad("E-FIN-REQUIRED", `«${field}» الزامی است`, { field });
    return null;
  }
  if (!CODE_RE.test(s)) throw bad("E-FIN-INVALID-CODE", `«${field}» فقط حروف لاتین، رقم، نقطه، خط تیره (حداکثر ۴۰)`, { field });
  return s;
}

function currency(v, rates) {
  const c = String(v ?? "IRR").trim().toUpperCase() || "IRR";
  if (!/^[A-Z]{3}$/.test(c)) throw bad("E-FIN-INVALID-CURRENCY", "کد ارز سه‌حرفی نیست", { field: "Currency" });
  if (!rates[c]) throw bad("E-FIN-NO-RATE", `نرخ ارز ${c} در تنظیمات تعریف نشده`, { field: "Currency" });
  return c;
}

const nz = (v) => Number(v) || 0;

/* ─────────── ثبت مسیرها ─────────── */

export function registerFinWorkspaceRoutes(app, { repo, subjects, evaluate }) {
  const ok = (req, res, data, status = 200) => res.status(status).json({ ok: true, data, meta: { traceId: req.requestId, version: FIN_WS_VERSION } });

  const fail = (req, res, err) => {
    if (err instanceof FinError) {
      return res.status(err.status).json({ ok: false, error: { code: err.code, message: err.message, ...err.extra, traceId: req.requestId } });
    }
    if (err?.code === "ROW_VALIDATION_FAILED") {
      return res.status(400).json({ ok: false, error: { code: "E-FIN-VALIDATION", message: err.message, traceId: req.requestId } });
    }
    if (err?.code === "UNIQUE_VIOLATION" || err?.code === "DUPLICATE_KEY") {
      return res.status(409).json({ ok: false, error: { code: "E-FIN-DUPLICATE", message: "کد تکراری است", traceId: req.requestId } });
    }
    console.error(`[${req.requestId}] fin error:`, err);
    return res.status(500).json({ ok: false, error: { code: "E-FIN-INTERNAL", message: "خطای داخلی سرور", traceId: req.requestId } });
  };

  const subjectOf = (req) => {
    const id = String(req.headers["x-user-id"] || "").trim();
    return id ? subjects.find((u) => u.id === id && u.active !== false) ?? null : null;
  };

  /** میان‌افزار مجوز؛ FIN_RBAC_ENFORCE=0 فقط برای استقرار مرحله‌ای. */
  const need = (permission) => (req, res, next) => {
    const enforce = String(process.env.FIN_RBAC_ENFORCE ?? "1") !== "0";
    const subject = subjectOf(req);
    if (!PROJECT_RE.test(String(req.params.projectId || ""))) {
      return res.status(400).json({ ok: false, error: { code: "E-FIN-BAD-PROJECT", message: "شناسهٔ پروژه نامعتبر است", traceId: req.requestId } });
    }
    if (!subject) {
      if (!enforce) return next();
      return res.status(401).json({ ok: false, error: { code: "E-FIN-AUTH-REQUIRED", message: "شناسهٔ کاربر برای این اقدام الزامی است", permission, traceId: req.requestId } });
    }
    const verdict = evaluate(subject, permission, { projectId: undefined });
    if (!verdict.allow && enforce) {
      return res.status(403).json({ ok: false, error: { code: "E-FIN-FORBIDDEN", message: "مجوز این اقدام را ندارید", permission, traceId: req.requestId } });
    }
    return next();
  };

  const actor = (req) => String(req.headers["x-user-id"] || "system").slice(0, 60);

  const audit = async (r, req, action, details) => {
    try {
      await r.create("AuditLog", {
        At: new Date().toISOString(),
        SubjectId: actor(req),
        Action: action,
        ProjectCode: req.params.projectId,
        EntityName: details.entityName ?? null,
        EntityId: details.entityId ?? null,
        Severity: details.severity ?? "info",
        Details: { traceId: req.requestId, ...details },
      }, actor(req));
    } catch {
      console.error(`[${req.requestId}] finAudit failed for ${action}`);
    }
  };

  const byProject = (pid) => [{ column: "ProjectId", op: "eq", value: pid }];
  const byCode = (pid, column, value) => [...byProject(pid), { column, op: "eq", value }];

  async function loadSettings(r, pid) {
    const row = await r.findOne("FinSetting", byProject(pid));
    return { row, resolved: resolveSettings(row ?? defaultFinSettings(new Date().toISOString().slice(0, 10))) };
  }

  async function loadAll(r, pid) {
    const w = { where: byProject(pid), limit: 5000 };
    const [settings, accounts, transactions, prs, pos, stock, receivables, snapshots, transfers] = await Promise.all([
      loadSettings(r, pid),
      r.list("CostAccount", w),
      r.list("CostTransaction", w),
      r.list("PurchaseRequisition", w),
      r.list("PurchaseOrder", w),
      r.list("StockItem", w),
      r.list("Receivable", w),
      r.list("EvmSnapshot", w),
      r.list("BudgetTransfer", w),
    ]);
    const sortBy = (k) => (a, b) => String(a[k]).localeCompare(String(b[k]), "en", { numeric: true });
    return {
      settings, accounts: accounts.sort(sortBy("Code")), transactions: transactions.sort(sortBy("Code")),
      prs: prs.sort(sortBy("Code")), pos: pos.sort(sortBy("PoNo")), stock: stock.sort(sortBy("Code")),
      receivables: receivables.sort(sortBy("Code")), snapshots: snapshots.sort(sortBy("DataDate")).reverse(),
      transfers: transfers.sort(sortBy("Code")).reverse(),
    };
  }

  async function account(r, pid, accCode) {
    const a = await r.findOne("CostAccount", byCode(pid, "Code", accCode));
    if (!a) throw bad("E-FIN-NO-ACCOUNT", `حساب هزینهٔ ${accCode} وجود ندارد`, { field: "CostAccountCode" });
    return a;
  }

  /** تعهد حساب را از روی POها دوباره می‌سازد (تنها نویسندهٔ Committed). */
  async function recomputeCommitted(r, req, pid, accCode, rates) {
    if (!accCode) return;
    const a = await r.findOne("CostAccount", byCode(pid, "Code", accCode));
    if (!a) return;
    const pos = await r.list("PurchaseOrder", { where: byCode(pid, "CostAccountCode", accCode), limit: 5000 });
    const next = Math.round(committedForAccount(accCode, pos, rates) * 100) / 100;
    if (nz(a.Committed) !== next) await r.patch("CostAccount", a.Id, { Committed: next }, actor(req));
  }

  async function adjustActual(r, req, pid, accCode, delta) {
    const a = await account(r, pid, accCode);
    await r.patch("CostAccount", a.Id, { Actual: Math.round((nz(a.Actual) + delta) * 100) / 100 }, actor(req));
  }

  async function nextCode(r, table, pid, column, prefix) {
    const rows = await r.list(table, { where: byProject(pid), limit: 5000 });
    const used = new Set(rows.map((x) => String(x[column])));
    let i = rows.length + 1;
    while (used.has(`${prefix}${String(i).padStart(3, "0")}`)) i++;
    return `${prefix}${String(i).padStart(3, "0")}`;
  }

  async function postTransaction(r, req, pid, rates, st, t) {
    const base = safeBase(t.Amount, t.Currency, rates);
    if (base === null) throw bad("E-FIN-NO-RATE", `نرخ ارز ${t.Currency} تعریف نشده`);
    const row = await r.create("CostTransaction", { ProjectId: pid, ...t, BaseAmount: Math.round(base * 100) / 100 }, actor(req), "ctx");
    await adjustActual(r, req, pid, t.CostAccountCode, base);
    return row;
  }

  const route = (handler) => async (req, res) => {
    try {
      const r = await repo();
      await handler(req, res, r, req.params.projectId);
    } catch (err) {
      fail(req, res, err);
    }
  };

  const base = "/api/fin/:projectId";

  /* ═══════════ خواندن ═══════════ */

  app.get(`${base}/workspace`, need("fin.cost.view"), route(async (req, res, r, pid) => {
    const all = await loadAll(r, pid);
    const snapshots = all.snapshots.map((s) => {
      const inputs = s.Inputs ?? null;
      let valid = false;
      let reason = "no_inputs";
      if (inputs) {
        const v = verifySnapshot({
          projectId: pid, dataDate: String(s.DataDate).slice(0, 10), formulaVersion: s.FormulaVersion,
          inputs, result: computeEvm(inputs), hash: s.Hash,
        });
        valid = v.valid;
        reason = v.reason ?? null;
      }
      return { ...s, valid, reason };
    });
    ok(req, res, {
      projectId: pid,
      settings: all.settings.resolved,
      settingsSaved: Boolean(all.settings.row),
      accounts: all.accounts,
      transactions: all.transactions,
      prs: all.prs,
      pos: all.pos,
      stock: all.stock,
      receivables: all.receivables,
      snapshots,
      transfers: all.transfers,
    });
  }));

  /* ═══════════ دادهٔ نمونه ═══════════ */

  app.post(`${base}/seed`, need("fin.cost.post"), route(async (req, res, r, pid) => {
    const all = await loadAll(r, pid);
    const count = all.accounts.length + all.transactions.length + all.prs.length + all.pos.length + all.stock.length + all.receivables.length;
    if (count > 0) throw conflict("E-FIN-NOT-EMPTY", "پروژه داده دارد؛ دادهٔ نمونه فقط روی پروژهٔ خالی بارگذاری می‌شود");
    const u = actor(req);
    const st = FIN_SAMPLE.settings;
    await r.upsert("FinSetting", { ProjectId: pid }, { ...st }, u);
    const rates = resolveSettings(st).Rates;
    for (const a of FIN_SAMPLE.accounts) await r.create("CostAccount", { ProjectId: pid, Committed: 0, Actual: 0, Currency: "IRR", ...a }, u, "ca");
    for (const t of FIN_SAMPLE.transactions) {
      const { BaseAmount: _ignored, ...rest } = t;
      await postTransaction(r, req, pid, rates, st, rest);
    }
    for (const p of FIN_SAMPLE.prs) await r.create("PurchaseRequisition", { ProjectId: pid, RequestedBy: u, RequestedAt: st.DataDate, BudgetStatus: "unknown", ...p }, u, "pr");
    for (const p of FIN_SAMPLE.pos) {
      await r.create("PurchaseOrder", { ProjectId: pid, IssuedAt: st.DataDate, ...p }, u, "po");
      /* فاکتورهای نمونه هم مثل مسیر واقعی به هزینهٔ واقعی می‌نشینند. */
      const inv = poValues(p).invoiced;
      if (inv > 0) {
        await postTransaction(r, req, pid, rates, st, {
          Code: `TX-${p.PoNo}-1`, CostAccountCode: p.CostAccountCode, DescriptionFa: `فاکتور ${p.PoNo} — ${p.VendorName}`,
          Amount: inv, Currency: p.Currency || "IRR", PeriodNo: st.CurrentPeriod, TxnDate: st.DataDate, SourceType: "po_invoice", SourceRef: p.PoNo,
        });
      }
    }
    for (const code of new Set(FIN_SAMPLE.pos.map((p) => p.CostAccountCode))) await recomputeCommitted(r, req, pid, code, rates);
    for (const s of FIN_SAMPLE.stock) await r.create("StockItem", { ProjectId: pid, ...s }, u, "stk");
    for (const a of FIN_SAMPLE.receivables) await r.create("Receivable", { ProjectId: pid, ...a }, u, "ar");
    await audit(r, req, "FIN_SAMPLE_SEEDED", { entityName: "FinWorkspace", entityId: pid });
    ok(req, res, { seeded: true }, 201);
  }));

  /* ═══════════ تنظیمات ═══════════ */

  app.put(`${base}/settings`, need("fin.cost.post"), route(async (req, res, r, pid) => {
    const b = req.body ?? {};
    const PeriodCount = num(b.PeriodCount, "PeriodCount", { min: 1, max: 120, int: true, required: true });
    const CurrentPeriod = num(b.CurrentPeriod, "CurrentPeriod", { min: 1, max: PeriodCount, int: true, required: true });
    const Curve = String(b.Curve ?? "scurve");
    if (!CURVES.has(Curve)) throw bad("E-FIN-INVALID-CURVE", "منحنی توزیع نامعتبر است", { field: "Curve" });
    const rates = { IRR: 1 };
    for (const [k, v] of Object.entries(b.Rates ?? {})) {
      const c = String(k).toUpperCase();
      if (!/^[A-Z]{3}$/.test(c)) throw bad("E-FIN-INVALID-CURRENCY", `کد ارز ${k} نامعتبر است`, { field: "Rates" });
      rates[c] = c === "IRR" ? 1 : num(v, `Rates.${c}`, { min: 0.000001, required: true });
    }
    const row = {
      DataDate: date(b.DataDate, "DataDate", { required: true }),
      CurrentPeriod, PeriodCount, Curve, Rates: rates,
      BillingMarkupPct: num(b.BillingMarkupPct, "BillingMarkupPct", { min: -50, max: 200 }),
      CollectionLagPeriods: num(b.CollectionLagPeriods, "CollectionLagPeriods", { min: 0, max: 24, int: true }),
      RetentionPct: num(b.RetentionPct, "RetentionPct", { min: 0, max: 100 }),
      AdvanceRecoveryPct: num(b.AdvanceRecoveryPct, "AdvanceRecoveryPct", { min: 0, max: 100 }),
      LegalDeductionPct: num(b.LegalDeductionPct, "LegalDeductionPct", { min: 0, max: 100 }),
      MrpHorizonDays: num(b.MrpHorizonDays, "MrpHorizonDays", { min: 1, max: 730, int: true }),
    };
    await r.upsert("FinSetting", { ProjectId: pid }, row, actor(req));
    await audit(r, req, "FIN_SETTINGS_SET", { entityName: "FinSetting", entityId: pid, dataDate: row.DataDate, period: row.CurrentPeriod });
    ok(req, res, resolveSettings(row));
  }));

  /* ═══════════ حساب‌های هزینه (CBS) ═══════════ */

  function accountFields(b, partial) {
    const out = {};
    if (!partial || b.TitleFa !== undefined) out.TitleFa = text(b.TitleFa, "TitleFa", { max: 300, required: true });
    if (!partial || b.ParentCode !== undefined) out.ParentCode = code(b.ParentCode, "ParentCode", { required: false });
    if (!partial || b.Kind !== undefined) {
      const k = String(b.Kind ?? "direct");
      if (!KINDS.has(k)) throw bad("E-FIN-INVALID-KIND", "نوع حساب نامعتبر است", { field: "Kind" });
      out.Kind = k;
    }
    if (!partial || b.Category !== undefined) {
      const c = String(b.Category ?? "overhead");
      if (!CATEGORIES.has(c)) throw bad("E-FIN-INVALID-CATEGORY", "دستهٔ هزینه نامعتبر است", { field: "Category" });
      out.Category = c;
    }
    if (!partial || b.Budget !== undefined) out.Budget = num(b.Budget, "Budget", { min: 0, required: true });
    return out;
  }

  async function assertParent(r, pid, selfCode, parentCode) {
    if (!parentCode) return;
    if (parentCode === selfCode) throw bad("E-FIN-CBS-CYCLE", "حساب نمی‌تواند والد خودش باشد");
    const all = await r.list("CostAccount", { where: byProject(pid), limit: 5000 });
    const byC = new Map(all.map((a) => [a.Code, a]));
    if (!byC.has(parentCode)) throw bad("E-FIN-NO-PARENT", `حساب والد ${parentCode} وجود ندارد`, { field: "ParentCode" });
    let cur = parentCode;
    const seen = new Set();
    while (cur) {
      if (cur === selfCode) throw bad("E-FIN-CBS-CYCLE", "این والد در CBS حلقه می‌سازد");
      if (seen.has(cur)) break;
      seen.add(cur);
      cur = byC.get(cur)?.ParentCode || null;
    }
  }

  app.post(`${base}/accounts`, need("fin.budget.edit"), route(async (req, res, r, pid) => {
    const b = req.body ?? {};
    const Code = code(b.Code, "Code");
    const f = accountFields(b, false);
    await assertParent(r, pid, Code, f.ParentCode);
    if (await r.findOne("CostAccount", byCode(pid, "Code", Code))) throw conflict("E-FIN-DUPLICATE", `حساب ${Code} از قبل هست`);
    const row = await r.create("CostAccount", { ProjectId: pid, Code, ...f, Committed: 0, Actual: 0, Currency: "IRR" }, actor(req), "ca");
    await audit(r, req, "FIN_ACCOUNT_CREATED", { entityName: "CostAccount", entityId: Code, budget: f.Budget });
    ok(req, res, row, 201);
  }));

  app.patch(`${base}/accounts/:code`, need("fin.budget.edit"), route(async (req, res, r, pid) => {
    const a = await r.findOne("CostAccount", byCode(pid, "Code", req.params.code));
    if (!a) throw notFound("حساب پیدا نشد");
    const f = accountFields(req.body ?? {}, true);
    if (f.ParentCode !== undefined) await assertParent(r, pid, a.Code, f.ParentCode);
    await r.patch("CostAccount", a.Id, f, actor(req));
    await audit(r, req, "FIN_ACCOUNT_UPDATED", { entityName: "CostAccount", entityId: a.Code, before: { Budget: a.Budget }, after: f });
    ok(req, res, await r.get("CostAccount", a.Id));
  }));

  /** پیشرفت فیزیکی حساب (مبنای EV) — کار کنترل هزینه، نه ویرایش بودجه. */
  app.put(`${base}/accounts/:code/progress`, need("fin.cost.post"), route(async (req, res, r, pid) => {
    const a = await r.findOne("CostAccount", byCode(pid, "Code", req.params.code));
    if (!a) throw notFound("حساب پیدا نشد");
    const ProgressPct = num(req.body?.ProgressPct, "ProgressPct", { min: 0, max: 100 });
    await r.patch("CostAccount", a.Id, { ProgressPct }, actor(req));
    await audit(r, req, "FIN_PROGRESS_SET", { entityName: "CostAccount", entityId: a.Code, before: a.ProgressPct ?? null, after: ProgressPct });
    ok(req, res, await r.get("CostAccount", a.Id));
  }));

  app.delete(`${base}/accounts/:code`, need("fin.budget.edit"), route(async (req, res, r, pid) => {
    const a = await r.findOne("CostAccount", byCode(pid, "Code", req.params.code));
    if (!a) throw notFound("حساب پیدا نشد");
    const [kids, txns, prs, pos] = await Promise.all([
      r.list("CostAccount", { where: byCode(pid, "ParentCode", a.Code), limit: 1 }),
      r.list("CostTransaction", { where: byCode(pid, "CostAccountCode", a.Code), limit: 1 }),
      r.list("PurchaseRequisition", { where: byCode(pid, "CostAccountCode", a.Code), limit: 1 }),
      r.list("PurchaseOrder", { where: byCode(pid, "CostAccountCode", a.Code), limit: 1 }),
    ]);
    if (kids.length || txns.length || prs.length || pos.length || nz(a.Actual) !== 0 || nz(a.Committed) !== 0) {
      throw conflict("E-FIN-ACCOUNT-IN-USE", "حساب فرزند، هزینه، تعهد یا درخواست خرید دارد و حذف نمی‌شود");
    }
    await r.remove("CostAccount", a.Id);
    await audit(r, req, "FIN_ACCOUNT_DELETED", { entityName: "CostAccount", entityId: a.Code, severity: "warning" });
    ok(req, res, { deleted: a.Code });
  }));

  /* ═══════════ هزینهٔ واقعی ═══════════ */

  app.post(`${base}/transactions`, need("fin.cost.post"), route(async (req, res, r, pid) => {
    const b = req.body ?? {};
    const { resolved: st } = await loadSettings(r, pid);
    const CostAccountCode = code(b.CostAccountCode, "CostAccountCode");
    await account(r, pid, CostAccountCode);
    const t = {
      Code: code(b.Code, "Code", { required: false }) ?? (await nextCode(r, "CostTransaction", pid, "Code", "TX-")),
      CostAccountCode,
      DescriptionFa: text(b.DescriptionFa, "DescriptionFa", { required: true }),
      Amount: num(b.Amount, "Amount", { min: 0.01, required: true }),
      Currency: currency(b.Currency, st.Rates),
      PeriodNo: num(b.PeriodNo ?? st.CurrentPeriod, "PeriodNo", { min: 1, max: st.PeriodCount, int: true, required: true }),
      TxnDate: date(b.TxnDate, "TxnDate") ?? st.DataDate,
      SourceType: "manual",
      SourceRef: null,
    };
    if (await r.findOne("CostTransaction", byCode(pid, "Code", t.Code))) throw conflict("E-FIN-DUPLICATE", `هزینهٔ ${t.Code} از قبل هست`);
    const row = await postTransaction(r, req, pid, st.Rates, st, t);
    await audit(r, req, "FIN_COST_POSTED", { entityName: "CostTransaction", entityId: t.Code, account: CostAccountCode, base: row.BaseAmount });
    ok(req, res, row, 201);
  }));

  app.delete(`${base}/transactions/:code`, need("fin.cost.post"), route(async (req, res, r, pid) => {
    const t = await r.findOne("CostTransaction", byCode(pid, "Code", req.params.code));
    if (!t) throw notFound("هزینه پیدا نشد");
    if (t.SourceType !== "manual") throw conflict("E-FIN-SYSTEM-POSTING", "این هزینه از فاکتور PO ساخته شده و فقط از مسیر همان PO اصلاح می‌شود");
    await adjustActual(r, req, pid, t.CostAccountCode, -nz(t.BaseAmount));
    await r.remove("CostTransaction", t.Id);
    await audit(r, req, "FIN_COST_REVERSED", { entityName: "CostTransaction", entityId: t.Code, base: t.BaseAmount, severity: "warning" });
    ok(req, res, { deleted: t.Code });
  }));

  /* ═══════════ درخواست خرید ═══════════ */

  app.post(`${base}/prs`, need("fin.procure.edit"), route(async (req, res, r, pid) => {
    const b = req.body ?? {};
    const { resolved: st } = await loadSettings(r, pid);
    const CostAccountCode = code(b.CostAccountCode, "CostAccountCode");
    await account(r, pid, CostAccountCode);
    const row = {
      ProjectId: pid,
      Code: code(b.Code, "Code", { required: false }) ?? (await nextCode(r, "PurchaseRequisition", pid, "Code", `PR-${st.DataDate.slice(0, 4)}-`)),
      TitleFa: text(b.TitleFa, "TitleFa", { required: true }),
      Quantity: num(b.Quantity, "Quantity", { min: 0.001, required: true }),
      Unit: text(b.Unit, "Unit", { max: 20 }),
      EstimatedAmount: num(b.EstimatedAmount, "EstimatedAmount", { min: 0.01, required: true }),
      Currency: currency(b.Currency, st.Rates),
      CostAccountCode,
      NeedByDate: date(b.NeedByDate, "NeedByDate"),
      IsUrgent: Boolean(b.IsUrgent),
      RequestedBy: actor(req),
      RequestedAt: st.DataDate,
      BudgetStatus: "unknown",
      Status: "draft",
    };
    if (await r.findOne("PurchaseRequisition", byCode(pid, "Code", row.Code))) throw conflict("E-FIN-DUPLICATE", `درخواست ${row.Code} از قبل هست`);
    const created = await r.create("PurchaseRequisition", row, actor(req), "pr");
    await audit(r, req, "FIN_PR_CREATED", { entityName: "PurchaseRequisition", entityId: row.Code });
    ok(req, res, created, 201);
  }));

  const PR_FLOW = {
    submit: { from: ["draft"], to: "submitted", perm: "fin.procure.edit" },
    approve: { from: ["submitted"], to: "approved", perm: "fin.procure.approve" },
    reject: { from: ["submitted"], to: "rejected", perm: "fin.procure.approve" },
    cancel: { from: ["draft", "submitted", "approved"], to: "cancelled", perm: "fin.procure.edit" },
  };

  for (const [action, flow] of Object.entries(PR_FLOW)) {
    app.post(`${base}/prs/:code/${action}`, need(flow.perm), route(async (req, res, r, pid) => {
      const pr = await r.findOne("PurchaseRequisition", byCode(pid, "Code", req.params.code));
      if (!pr) throw notFound("درخواست خرید پیدا نشد");
      if (!flow.from.includes(pr.Status)) throw conflict("E-FIN-BAD-TRANSITION", `از وضعیت ${pr.Status} اقدام ${action} مجاز نیست`);
      const patch = { Status: flow.to };
      const b = req.body ?? {};
      if (action === "approve" || action === "reject") {
        /* تفکیک وظیفه: درخواست‌کننده تأییدکنندهٔ خودش نیست. */
        if (pr.RequestedBy && pr.RequestedBy === actor(req)) throw new FinError(403, "E-FIN-SOD", "درخواست‌کنندهٔ خرید نمی‌تواند آن را تأیید یا رد کند");
        patch.ApprovedBy = actor(req);
        patch.ApprovedAt = new Date().toISOString();
      }
      if (action === "approve") {
        const { resolved: st } = await loadSettings(r, pid);
        const accounts = await r.list("CostAccount", { where: byProject(pid), limit: 5000 });
        const available = pr.CostAccountCode ? cbsAvailable(ledgerNodes(accounts), pr.CostAccountCode) : null;
        const est = safeBase(nz(pr.EstimatedAmount), pr.Currency, st.Rates);
        if (available === null || est === null) {
          patch.BudgetStatus = "unknown";
        } else {
          const override = b.override === true;
          const reason = text(b.reasonFa, "reasonFa", { max: 1000 });
          const chk = prBudgetCheck(est, available, override && Boolean(reason));
          if (!chk.ok) {
            throw conflict("E-FIN-OVER-BUDGET", "برآورد از بودجهٔ در دسترس حساب بیشتر است؛ تأیید فقط با override و ذکر دلیل", { available, estimate: est });
          }
          patch.BudgetStatus = est <= available ? "ok" : "over_budget";
          if (est > available) patch.RemarksFa = `تأیید فراتر از بودجه: ${reason}`;
        }
      }
      if (action === "reject") patch.RemarksFa = text(b.reasonFa, "reasonFa", { max: 1000 }) ?? pr.RemarksFa ?? null;
      await r.patch("PurchaseRequisition", pr.Id, patch, actor(req));
      await audit(r, req, `FIN_PR_${action.toUpperCase()}`, { entityName: "PurchaseRequisition", entityId: pr.Code, budgetStatus: patch.BudgetStatus ?? null, severity: patch.BudgetStatus === "over_budget" ? "warning" : "info" });
      ok(req, res, await r.get("PurchaseRequisition", pr.Id));
    }));
  }

  /* ═══════════ سفارش خرید ═══════════ */

  function kpis(b) {
    const out = {};
    for (const k of KPI_FIELDS) if (b[k] !== undefined) out[k] = num(b[k], k, { min: 0, max: 100, int: true });
    return out;
  }

  app.post(`${base}/pos`, need("fin.procure.edit"), route(async (req, res, r, pid) => {
    const b = req.body ?? {};
    const { resolved: st } = await loadSettings(r, pid);
    const PoNo = code(b.PoNo, "PoNo", { required: false }) ?? (await nextCode(r, "PurchaseOrder", pid, "PoNo", `PO-${st.DataDate.slice(0, 4)}-`));
    if (await r.findOne("PurchaseOrder", byCode(pid, "PoNo", PoNo))) throw conflict("E-FIN-DUPLICATE", `سفارش ${PoNo} از قبل هست`);
    let pr = null;
    const PrCode = code(b.PrCode, "PrCode", { required: false });
    if (PrCode) {
      pr = await r.findOne("PurchaseRequisition", byCode(pid, "Code", PrCode));
      if (!pr) throw bad("E-FIN-NO-PR", `درخواست ${PrCode} وجود ندارد`, { field: "PrCode" });
      if (pr.Status !== "approved") throw conflict("E-FIN-PR-NOT-APPROVED", "سفارش فقط از درخواست خرید تأییدشده صادر می‌شود");
    }
    const CostAccountCode = code(b.CostAccountCode ?? pr?.CostAccountCode, "CostAccountCode");
    await account(r, pid, CostAccountCode);
    const Quantity = num(b.Quantity ?? pr?.Quantity, "Quantity", { min: 0.001, required: true });
    const UnitPrice = num(b.UnitPrice, "UnitPrice", { min: 0.01, required: true });
    const row = {
      ProjectId: pid, PoNo, PrCode,
      VendorName: text(b.VendorName, "VendorName", { max: 200, required: true }),
      TitleFa: text(b.TitleFa ?? pr?.TitleFa, "TitleFa", { required: true }),
      Quantity, Unit: text(b.Unit ?? pr?.Unit, "Unit", { max: 20 }), UnitPrice,
      Amount: Math.round(Quantity * UnitPrice * 100) / 100,
      Currency: currency(b.Currency ?? pr?.Currency, st.Rates),
      CostAccountCode,
      IssuedAt: date(b.IssuedAt, "IssuedAt") ?? st.DataDate,
      PromisedDate: date(b.PromisedDate, "PromisedDate", { required: true }),
      ReceivedQty: 0, InvoicedQty: 0, PaidAmount: 0,
      Status: "issued",
      ...kpis(b),
    };
    const created = await r.create("PurchaseOrder", row, actor(req), "po");
    if (pr) await r.patch("PurchaseRequisition", pr.Id, { Status: "converted" }, actor(req));
    await recomputeCommitted(r, req, pid, CostAccountCode, st.Rates);
    await audit(r, req, "FIN_PO_ISSUED", { entityName: "PurchaseOrder", entityId: PoNo, prCode: PrCode, amount: row.Amount, currency: row.Currency });
    ok(req, res, created, 201);
  }));

  app.patch(`${base}/pos/:poNo`, need("fin.procure.edit"), route(async (req, res, r, pid) => {
    const po = await r.findOne("PurchaseOrder", byCode(pid, "PoNo", req.params.poNo));
    if (!po) throw notFound("سفارش خرید پیدا نشد");
    if (po.Status === "cancelled" || po.Status === "closed") throw conflict("E-FIN-PO-CLOSED", "سفارش بسته یا لغوشده قابل تغییر نیست");
    const b = req.body ?? {};
    const { resolved: st } = await loadSettings(r, pid);
    const patch = { ...kpis(b) };
    const ordered = nz(po.Quantity);
    if (b.ReceivedQty !== undefined) {
      patch.ReceivedQty = num(b.ReceivedQty, "ReceivedQty", { min: 0, max: ordered * 1.1, required: true });
    }
    if (b.InvoicedQty !== undefined) {
      const inv = num(b.InvoicedQty, "InvoicedQty", { min: 0, max: ordered * 1.1, required: true });
      if (inv < nz(po.InvoicedQty)) throw conflict("E-FIN-INVOICE-DECREASE", "فاکتور ثبت‌شده کم نمی‌شود؛ برگشت فاکتور سند جدا لازم دارد");
      patch.InvoicedQty = inv;
    }
    if (b.InvoiceUnitPrice !== undefined) {
      if (nz(po.InvoicedQty) > 0 && Number(b.InvoiceUnitPrice) !== nz(po.InvoiceUnitPrice ?? po.UnitPrice)) {
        throw conflict("E-FIN-INVOICE-PRICE-LOCKED", "قیمت فاکتور پس از ثبت اولین فاکتور قفل است");
      }
      patch.InvoiceUnitPrice = num(b.InvoiceUnitPrice, "InvoiceUnitPrice", { min: 0.01, required: true });
    }
    if (b.PaidAmount !== undefined) patch.PaidAmount = num(b.PaidAmount, "PaidAmount", { min: 0, required: true });
    if (b.DeliveredDate !== undefined) patch.DeliveredDate = date(b.DeliveredDate, "DeliveredDate");
    if (b.PromisedDate !== undefined) patch.PromisedDate = date(b.PromisedDate, "PromisedDate", { required: true });

    const next = { ...po, ...patch };
    const vNext = poValues(next);
    if (nz(next.PaidAmount) > vNext.invoiced + 0.01) throw conflict("E-FIN-PAY-EXCEEDS-INVOICE", "پرداخت از مبلغ فاکتورشده بیشتر است");
    /* دروازهٔ پرداخت: افزایش پرداخت فقط وقتی تطابق سه‌جانبه برقرار است. */
    if (patch.PaidAmount !== undefined && patch.PaidAmount > nz(po.PaidAmount)) {
      const m = cumulativeMatch(next);
      if (m && !m.ok) throw conflict("E-FIN-PAYMENT-BLOCKED", "تطابق سه‌جانبه برقرار نیست؛ پرداخت مسدود است", { reasons: m.reasons });
    }
    if (patch.ReceivedQty !== undefined) {
      patch.Status = patch.ReceivedQty >= ordered ? "received" : patch.ReceivedQty > 0 ? "partially_received" : po.Status;
    }

    await r.patch("PurchaseOrder", po.Id, patch, actor(req));
    /* زنجیرهٔ تعهد → هزینهٔ واقعی: افزایش فاکتور = سند هزینهٔ خودکار. */
    const invDelta = vNext.invoiced - poValues(po).invoiced;
    if (invDelta > 0.001) {
      const existing = await r.list("CostTransaction", { where: byCode(pid, "SourceRef", po.PoNo), limit: 5000 });
      await postTransaction(r, req, pid, st.Rates, st, {
        Code: `TX-${po.PoNo}-${existing.length + 1}`,
        CostAccountCode: po.CostAccountCode,
        DescriptionFa: `فاکتور ${po.PoNo} — ${po.VendorName}`,
        Amount: Math.round(invDelta * 100) / 100,
        Currency: po.Currency || "IRR",
        PeriodNo: st.CurrentPeriod,
        TxnDate: st.DataDate,
        SourceType: "po_invoice",
        SourceRef: po.PoNo,
      });
    }
    await recomputeCommitted(r, req, pid, po.CostAccountCode, st.Rates);
    await audit(r, req, "FIN_PO_UPDATED", { entityName: "PurchaseOrder", entityId: po.PoNo, changes: patch, invoicedDelta: invDelta > 0 ? invDelta : 0 });
    ok(req, res, await r.get("PurchaseOrder", po.Id));
  }));

  app.post(`${base}/pos/:poNo/cancel`, need("fin.procure.edit"), route(async (req, res, r, pid) => {
    const po = await r.findOne("PurchaseOrder", byCode(pid, "PoNo", req.params.poNo));
    if (!po) throw notFound("سفارش خرید پیدا نشد");
    if (po.Status === "cancelled") throw conflict("E-FIN-BAD-TRANSITION", "سفارش قبلاً لغو شده");
    if (nz(po.InvoicedQty) > 0 || nz(po.ReceivedQty) > 0) throw conflict("E-FIN-PO-IN-PROGRESS", "سفارشی که رسید یا فاکتور دارد لغو نمی‌شود");
    const { resolved: st } = await loadSettings(r, pid);
    await r.patch("PurchaseOrder", po.Id, { Status: "cancelled", ClosedAt: new Date().toISOString() }, actor(req));
    if (po.PrCode) {
      const pr = await r.findOne("PurchaseRequisition", byCode(pid, "Code", po.PrCode));
      if (pr && pr.Status === "converted") await r.patch("PurchaseRequisition", pr.Id, { Status: "approved" }, actor(req));
    }
    await recomputeCommitted(r, req, pid, po.CostAccountCode, st.Rates);
    await audit(r, req, "FIN_PO_CANCELLED", { entityName: "PurchaseOrder", entityId: po.PoNo, severity: "warning" });
    ok(req, res, await r.get("PurchaseOrder", po.Id));
  }));

  /* ═══════════ موجودی انبار ═══════════ */

  function stockFields(b, partial) {
    const out = {};
    const f = (k, fn) => { if (!partial || b[k] !== undefined) out[k] = fn(); };
    f("NameFa", () => text(b.NameFa, "NameFa", { max: 300, required: true }));
    f("Unit", () => text(b.Unit, "Unit", { max: 20 }));
    f("OnHand", () => num(b.OnHand, "OnHand", { min: 0, required: true }));
    f("AvgDailyUse", () => num(b.AvgDailyUse, "AvgDailyUse", { min: 0, required: true }));
    f("MaxDailyUse", () => num(b.MaxDailyUse, "MaxDailyUse", { min: 0, required: true }));
    f("LeadTimeDays", () => num(b.LeadTimeDays, "LeadTimeDays", { min: 0, max: 730, int: true, required: true }));
    f("UnitCost", () => num(b.UnitCost, "UnitCost", { min: 0, required: true }));
    f("OnOrder", () => num(b.OnOrder, "OnOrder", { min: 0 }) ?? 0);
    f("BatchNo", () => text(b.BatchNo, "BatchNo", { max: 40 }));
    if (out.MaxDailyUse != null && out.AvgDailyUse != null && out.MaxDailyUse < out.AvgDailyUse) {
      throw bad("E-FIN-USE-RANGE", "حداکثر مصرف روزانه از میانگین کمتر است", { field: "MaxDailyUse" });
    }
    return out;
  }

  app.post(`${base}/stock`, need("fin.procure.edit"), route(async (req, res, r, pid) => {
    const b = req.body ?? {};
    const Code = code(b.Code, "Code");
    if (await r.findOne("StockItem", byCode(pid, "Code", Code))) throw conflict("E-FIN-DUPLICATE", `کالای ${Code} از قبل هست`);
    const row = await r.create("StockItem", { ProjectId: pid, Code, ...stockFields(b, false) }, actor(req), "stk");
    await audit(r, req, "FIN_STOCK_CREATED", { entityName: "StockItem", entityId: Code });
    ok(req, res, row, 201);
  }));

  app.patch(`${base}/stock/:code`, need("fin.procure.edit"), route(async (req, res, r, pid) => {
    const s = await r.findOne("StockItem", byCode(pid, "Code", req.params.code));
    if (!s) throw notFound("کالا پیدا نشد");
    const f = stockFields(req.body ?? {}, true);
    const merged = { ...s, ...f };
    if (nz(merged.MaxDailyUse) < nz(merged.AvgDailyUse)) throw bad("E-FIN-USE-RANGE", "حداکثر مصرف روزانه از میانگین کمتر است", { field: "MaxDailyUse" });
    await r.patch("StockItem", s.Id, f, actor(req));
    await audit(r, req, "FIN_STOCK_UPDATED", { entityName: "StockItem", entityId: s.Code, before: { OnHand: s.OnHand }, after: f });
    ok(req, res, await r.get("StockItem", s.Id));
  }));

  app.delete(`${base}/stock/:code`, need("fin.procure.edit"), route(async (req, res, r, pid) => {
    const s = await r.findOne("StockItem", byCode(pid, "Code", req.params.code));
    if (!s) throw notFound("کالا پیدا نشد");
    if (nz(s.OnHand) > 0) throw conflict("E-FIN-STOCK-NOT-EMPTY", "کالای دارای موجودی حذف نمی‌شود");
    await r.remove("StockItem", s.Id);
    await audit(r, req, "FIN_STOCK_DELETED", { entityName: "StockItem", entityId: s.Code, severity: "warning" });
    ok(req, res, { deleted: s.Code });
  }));

  /* ═══════════ مطالبات ═══════════ */

  app.post(`${base}/receivables`, need("fin.cost.post"), route(async (req, res, r, pid) => {
    const b = req.body ?? {};
    const { resolved: st } = await loadSettings(r, pid);
    const row = {
      ProjectId: pid,
      Code: code(b.Code, "Code", { required: false }) ?? (await nextCode(r, "Receivable", pid, "Code", "AR-")),
      PartyFa: text(b.PartyFa, "PartyFa", { max: 300, required: true }),
      Amount: num(b.Amount, "Amount", { min: 0.01, required: true }),
      Currency: currency(b.Currency, st.Rates),
      DueDate: date(b.DueDate, "DueDate", { required: true }),
      Status: "open",
    };
    if (await r.findOne("Receivable", byCode(pid, "Code", row.Code))) throw conflict("E-FIN-DUPLICATE", `مطالبهٔ ${row.Code} از قبل هست`);
    const created = await r.create("Receivable", row, actor(req), "ar");
    await audit(r, req, "FIN_AR_CREATED", { entityName: "Receivable", entityId: row.Code });
    ok(req, res, created, 201);
  }));

  app.post(`${base}/receivables/:code/collect`, need("fin.cost.post"), route(async (req, res, r, pid) => {
    const a = await r.findOne("Receivable", byCode(pid, "Code", req.params.code));
    if (!a) throw notFound("مطالبه پیدا نشد");
    if (a.Status !== "open") throw conflict("E-FIN-BAD-TRANSITION", "مطالبه قبلاً وصول شده");
    const { resolved: st } = await loadSettings(r, pid);
    await r.patch("Receivable", a.Id, { Status: "collected", CollectedAt: date(req.body?.CollectedAt, "CollectedAt") ?? st.DataDate }, actor(req));
    await audit(r, req, "FIN_AR_COLLECTED", { entityName: "Receivable", entityId: a.Code });
    ok(req, res, await r.get("Receivable", a.Id));
  }));

  app.delete(`${base}/receivables/:code`, need("fin.cost.post"), route(async (req, res, r, pid) => {
    const a = await r.findOne("Receivable", byCode(pid, "Code", req.params.code));
    if (!a) throw notFound("مطالبه پیدا نشد");
    if (a.Status !== "open") throw conflict("E-FIN-AR-COLLECTED", "مطالبهٔ وصول‌شده حذف نمی‌شود");
    await r.remove("Receivable", a.Id);
    await audit(r, req, "FIN_AR_DELETED", { entityName: "Receivable", entityId: a.Code, severity: "warning" });
    ok(req, res, { deleted: a.Code });
  }));

  /* ═══════════ ذخیرهٔ احتیاطی (DoA) ═══════════ */

  app.post(`${base}/reserve-draw`, need("fin.reserve.draw"), route(async (req, res, r, pid) => {
    const b = req.body ?? {};
    const amount = num(b.amount, "amount", { min: 0.01, required: true });
    const toCode = code(b.toCode, "toCode");
    const reasonFa = text(b.reasonFa, "reasonFa", { max: 1000, required: true });
    const accounts = await r.list("CostAccount", { where: byProject(pid), limit: 5000 });
    const reserves = accounts.filter((a) => a.Kind === "reserve");
    const from = b.fromCode ? reserves.find((a) => a.Code === b.fromCode) : reserves.length === 1 ? reserves[0] : null;
    if (!from) throw bad("E-FIN-NO-RESERVE", reserves.length > 1 ? "چند حساب ذخیره هست؛ fromCode را مشخص کنید" : "حساب ذخیرهٔ احتیاطی تعریف نشده");
    const to = accounts.find((a) => a.Code === toCode);
    if (!to) throw bad("E-FIN-NO-ACCOUNT", `حساب مقصد ${toCode} وجود ندارد`, { field: "toCode" });
    if (to.Kind === "reserve") throw bad("E-FIN-RESERVE-TO-RESERVE", "مقصد نمی‌تواند حساب ذخیره باشد", { field: "toCode" });
    const draw = reserveDraw(nz(from.Budget), amount, actor(req));
    if (!draw.ok) throw conflict("E-FIN-RESERVE-REJECTED", draw.reason === "insufficient_reserve" ? "موجودی ذخیره کافی نیست" : "بدون اختیار", { reason: draw.reason });
    await r.patch("CostAccount", from.Id, { Budget: draw.remaining }, actor(req));
    await r.patch("CostAccount", to.Id, { Budget: nz(to.Budget) + amount }, actor(req));
    const Code = await nextCode(r, "BudgetTransfer", pid, "Code", "BT-");
    const subject = subjectOf(req);
    const row = await r.create("BudgetTransfer", {
      ProjectId: pid, Code, FromCode: from.Code, ToCode: to.Code, Amount: amount,
      Authority: subject?.roles?.[0] ?? "unknown", ReasonFa: reasonFa, ApprovedBy: actor(req), ApprovedAt: new Date().toISOString(),
    }, actor(req), "bt");
    await audit(r, req, "FIN_RESERVE_DRAW", { entityName: "BudgetTransfer", entityId: Code, from: from.Code, to: to.Code, amount, severity: "warning" });
    ok(req, res, { transfer: row, reserveRemaining: draw.remaining }, 201);
  }));

  /* ═══════════ Snapshot تغییرناپذیر EVM ═══════════ */

  app.post(`${base}/snapshots`, need("fin.cost.post"), route(async (req, res, r, pid) => {
    const [settings, accounts] = await Promise.all([loadSettings(r, pid), r.list("CostAccount", { where: byProject(pid), limit: 5000 })]);
    const st = settings.resolved;
    const em = evmModel({ settings: st, accounts });
    if (em.bac <= 0) throw conflict("E-FIN-NO-BUDGET", "بودجه‌ای ثبت نشده؛ Snapshot معنا ندارد");
    if (!em.evKnown) throw conflict("E-FIN-NO-PROGRESS", "پیشرفت فیزیکی هیچ حسابی ثبت نشده؛ EV نامعلوم است");
    const existing = await r.findOne("EvmSnapshot", byCode(pid, "DataDate", st.DataDate));
    if (existing) throw conflict("E-FIN-SNAPSHOT-EXISTS", `برای تاریخ ${st.DataDate} Snapshot ثبت شده و تغییرناپذیر است`);
    const snap = createEvmSnapshot(pid, st.DataDate, em.inputs);
    const row = await r.create("EvmSnapshot", {
      ProjectId: pid, DataDate: st.DataDate, Pv: em.pvCum, Ev: em.ev, Ac: em.ac, Bac: em.bac,
      Eac: snap.result.eac?.cpi ?? null, Spi: snap.result.spi, Cpi: snap.result.cpi,
      FormulaVersion: FIN_FORMULA_VERSION, Hash: snap.hash, Inputs: em.inputs,
    }, actor(req), "evm");
    await audit(r, req, "EVM_SNAPSHOT", { entityName: "EvmSnapshot", entityId: row.Id, hash: snap.hash, dataDate: st.DataDate });
    ok(req, res, { ...row, valid: true }, 201);
  }));
}
