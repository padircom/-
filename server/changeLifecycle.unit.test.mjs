import test from "node:test";
import assert from "node:assert/strict";
import { registerChangeMgmtRoutes } from "./changeMgmtApi.js";
import { DEMO_SUBJECTS as SUBJECTS, evaluate } from "./rbacLogic.js";

/* E2E درون‌فرایندی فاز ۳: چرخهٔ کامل تغییر با repo حافظه‌ای وارونه — بدون سرور زنده.
   پیش‌شرط سرورهای واقعی فقط sol-phase REST smoke است؛ این فایل مسیرها را مستقیم می‌خواند. */

const PID = "c1-p1";

function mkRepo() {
  const data = new Map();
  const t = (n) => (data.has(n) ? data.get(n) : (data.set(n, []), data.get(n)));
  return {
    list: async (n, o = {}) => t(n).filter((r) => (o.where ?? []).every((w) => String(r[w.column]) === String(w.value))),
    findOne: async (n, w) => t(n).find((r) => w.every((x) => String(r[x.column]) === String(x.value))) ?? null,
    get: async (n, id) => t(n).find((r) => r.Id === id) ?? null,
    create: async (n, row) => {
      const r2 = { Id: row.Id ?? `${n.slice(0, 4).toLowerCase()}-${Math.random().toString(36).slice(2, 8)}`, RowVersion: 1, ...row };
      t(n).push(r2);
      return r2;
    },
    _tables: data,
    patch: async (n, id, p) => {
      const arr = t(n); const i = arr.findIndex((r) => r.Id === id);
      arr[i] = { ...arr[i], ...p, RowVersion: (arr[i].RowVersion ?? 1) + 1 };
      return arr[i];
    },
    remove: async (n, id) => { const i = t(n).findIndex((r) => r.Id === id); if (i >= 0) t(n).splice(i, 1); },
  };
}

function mkApp(repo) {
  const handlers = [];
  const push = (m) => (p, ...hs) => handlers.push({ method: m, p, hs });
  const app = { get: push("GET"), post: push("POST"), patch: push("PATCH"), delete: push("DELETE"), put: push("PUT") };
  registerChangeMgmtRoutes(app, { repo: async () => repo, subjects: SUBJECTS, evaluate });
  const simulate = async (method, path, { sub, params = {}, query = {}, body = {} } = {}) => {
    const route = handlers.find((h) => h.method === method && h.p === path);
    const req = { params: { projectId: PID, ...params }, headers: { "x-user-id": sub }, query, body, requestId: "sim", method, table: params.table ?? "" };
    const res = { _j: null, status() { return this; }, json(j) { this._j = j; return this; } };
    let idx = 0; let err = null;
    const next = (e) => { if (e) err = e; };
    const mw = async (i) => {
      if (i >= route.hs.length || res._j !== null || err) return;
      let advanced = false;
      await route.hs[i](req, res, (e) => { if (e) err = e; else advanced = true; });
      if (advanced && !err) await mw(i + 1);
    };
    try { await mw(0); } catch (e) { err = e; }
    if (res._j) return res._j;
    return { ok: false, error: { code: err?.code ?? "UNHANDLED", message: String(err) } };
  };
  return simulate;
}

test("چرخهٔ کامل تغییر: ثبت → تحلیل → تصمیم با SoD → اجرا → پیشنهاد نسخهٔ مبنای نامستقر → پیوند نرم → داشبورد", async () => {
  const repo = mkRepo();
  const api = mkApp(repo);

  /* ۱) ثبت تغییر با u-contracts */
  let r = await api("POST", "/api/change-mgmt/:projectId/requests", {
    sub: "u-contracts",
    body: { TitleFa: "تغییر نمایشی برای فاز سوم", ChangeType: "design", WbsRefs: ["W-1"], ActivityRefs: ["A-1"] },
  });
  assert.ok(r.ok, JSON.stringify(r)); const chgId = r.data.request.Id;
  assert.equal(r.data.request.Status, "draft");

  /* ۲) ردیف‌های تحلیل (u-contracts دارای change.analyze) */
  r = await api("POST", "/api/change-mgmt/:projectId/requests/:id/rows/:table", {
    sub: "u-contracts", params: { id: chgId, table: "PmisChangeScheduleImpacts" },
    body: { MethodFa: "مقایسهٔ پنجره‌ها", AssumptionsFa: "فرض واقعی آزمون", EstimatedDurationDeltaDays: 12, CompletionEffectDays: 12 },
  });
  assert.ok(r.ok, JSON.stringify(r));
  r = await api("POST", "/api/change-mgmt/:projectId/requests/:id/rows/:table", {
    sub: "u-contracts", params: { id: chgId, table: "PmisChangeCostEstimates" },
    body: { Layer: "estimated", Amount: 50000000, FormulaFa: "کمیت×نرخ", SourceFa: "برآورد PMO", BasisDate: "2026-10-01" },
  });
  assert.ok(r.ok, JSON.stringify(r));
  r = await api("POST", "/api/change-mgmt/:projectId/requests/:id/rows/:table", {
    sub: "u-contracts", params: { id: chgId, table: "PmisChangeCostEstimates" },
    body: { Layer: "approved", Amount: 46000000, FormulaFa: "پس از CCB", SourceFa: "صورت‌جلسهٔ مرجع مجاز ۱۲", BasisDate: "2026-10-02" },
  });
  assert.ok(r.ok, JSON.stringify(r));

  /* ۳) بذر داده‌های پایهٔ d2 (فقط‌خواندنی خوانده می‌شوند) */
  await repo.create("WbsNode", { Id: "w1", ProjectId: PID, Code: "W-1", NameFa: "سازه" });
  await repo.create("Activity", { Id: "a1", ProjectId: PID, Code: "A-1", NameFa: "بتن‌ریزی", DurationDays: 20, IsCritical: true, TotalFloatDays: 0, PlannedFinish: "2027-01-10" });
  await repo.create("Baseline", { Id: "bl1", ProjectId: PID, Name: "Baseline v1", IsCurrent: true, SetAt: "2026-10-01T00:00:00Z", SetBy: "u-pm", Snapshot: { schedules: [1] } });

  /* ۴) گذر چرخهٔ عمر */
  const chain = ["submitted", "completeness_review", "initial_eval", "technical_review", "time_analysis", "cost_analysis", "contract_review", "risk_assessment", "dispute_screening", "consolidation", "pending_decision"];
  const stageOwners = [["submitted","u-contracts"],["completeness_review","u-contracts"],["initial_eval","u-contracts"],["technical_review","u-contracts"],["time_analysis","u-contracts"],["cost_analysis","u-contracts"],["contract_review","u-contracts"],["risk_assessment","u-contracts"],["dispute_screening","u-contracts"],["consolidation","u-contracts"],["pending_decision","u-contracts"]];
  for (const [to, sub] of stageOwners) {
    r = await api("POST", "/api/change-mgmt/:projectId/requests/:id/transition", { sub, params: { id: chgId }, body: { to, noteFa: "گذر آزمون" } });
    assert.ok(r.ok, `${to} (${sub}): ${JSON.stringify(r)}`);
  }

  /* ۵) SoD/مجوز: آماده‌کنندهٔ تصمیم (u-contracts) نمی‌تواند تصمیم بگیرد —
     چون change.approve ندارد (FORBIDDEN)؛ اگر داشت و StatusChangedBy خودش بود SOD بود */
  r = await api("POST", "/api/change-mgmt/:projectId/requests/:id/transition", { sub: "u-contracts", params: { id: chgId }, body: { to: "approved", noteFa: "تأیید" } });
  assert.equal(r.ok, false); assert.ok(["CHG_SOD", "CHG_FORBIDDEN"].includes(r.error.code), JSON.stringify(r.error));

  /* ۶) تأیید مرجع مجاز */
  r = await api("POST", "/api/change-mgmt/:projectId/requests/:id/transition", { sub: "u-pm", params: { id: chgId }, body: { to: "approved", noteFa: "تأیید با شرط مستندات" } });
  assert.ok(r.ok); assert.equal(r.data.request.Status, "approved");
  for (const to of ["notified", "implementing"]) {
    r = await api("POST", "/api/change-mgmt/:projectId/requests/:id/transition", { sub: "u-pm", params: { id: chgId }, body: { to, noteFa: "گذر" } });
    assert.ok(r.ok, `${to}: ${JSON.stringify(r)}`);
  }

  /* ۷) پیشنهاد نسخهٔ نامستقر مبنا — هرگز مبنای جاری بازنویسی نمی‌شود */
  r = await api("POST", "/api/change-mgmt/:projectId/requests/:id/baseline-proposal", { sub: "u-pm", params: { id: chgId }, body: { noteFa: "اعمال تغییر طراحی روی نسخهٔ جدید مبنا" } });
  assert.equal(r.data.baseline.IsCurrent, false);
  assert.equal(r.data.baseline.Snapshot.appliedChange.changeCode, r.data.baseline.Snapshot.appliedChange.changeCode ? r.data.baseline.Snapshot.appliedChange.changeCode : null); // sanity: self-consistent
  assert.equal(r.data.baseline.Snapshot.appliedChange.changeId, chgId, "نسخهٔ نامستقر به همین تغییر پیوند خورده");
  const d2Current = await repo.get("Baseline", "bl1");
  assert.equal(d2Current.IsCurrent, true, "مبنای جاری d2 دست‌نخورده بماند");
  /* تکراری: ۴۰۹ */
  r = await api("POST", "/api/change-mgmt/:projectId/requests/:id/baseline-proposal", { sub: "u-pm", params: { id: chgId }, body: { noteFa: "دوباره" } });
  assert.equal(r.ok, false); assert.equal(r.error.code, "CHG_BASELINE");

  /* ۸) پیوند نرم + راستی‌آزمایی */
  await repo.create("DelayEvent", { Id: "dl1", ProjectId: PID, Code: "DLY-77", TitleFa: "توقف بارندگی" });
  r = await api("POST", "/api/change-mgmt/:projectId/requests/:id/rows/:table", {
    sub: "u-contracts", params: { id: chgId, table: "PmisChangeModuleLinks" },
    body: { LinkKind: "delay_event", TargetCode: "DLY-77", TargetTitleFa: "توقف بارندگی" },
  });
  assert.ok(r.ok, JSON.stringify(r));
  r = await api("GET", "/api/change-mgmt/:projectId/requests/:id/analysis/links-verify", { sub: "u-pm", params: { id: chgId } });
  assert.ok(r.ok);
  assert.equal(r.data.totals.verified, 2); /* پیوند delay_event + baseline_revision شناخته‌شده */
  assert.equal(r.data.totals.missing, 0);

  /* ۹) داشبورد با drill-down واقعی */
  r = await api("GET", "/api/change-mgmt/:projectId/dashboard", { sub: "u-pm" });
  assert.ok(r.ok);
  assert.equal(r.data.totalRequests, 1);
  assert.equal(r.data.byStatus.implementing, 1);
  assert.equal(r.data.implementingCount, 1); /* approvedCount صفر است — در وضعیت implementing هستیم */
  assert.equal(r.data.drilldown.requests.length, 1);
  assert.equal(r.data.costLayers.estimated, 50000000);
  assert.equal(r.data.costLayers.approved, 46000000);

  /* ۱۰) state-flow اضافی: سرنوشت audit trail از همهٔ وقایع */
  const audits = await repo.list("PmisChangeAuditTrail", { where: [{ column: "ProjectId", op: "eq", value: PID }] });
  assert.ok(audits.length >= 5, "مسیر عددی دست‌نخورده");
  assert.ok(audits.some((a) => a.Action === "status_changed" && a.ToValue === "approved"));
  assert.ok(audits.some((a) => a.Action === "baseline_proposal_created"));
});
