/**
 * PMO-CONSTRUCTION-DISPUTE-EXPERT-ENGINE-V1.0 — تست‌های سطح REST.
 * برخلاف disputeExpert.test.mjs (منطق خالص)، این فایل روت‌های واقعی
 * server/disputeExpertApi.js را روی express واقعی با موضوع‌های ساختگی
 * و repo حافظه‌ای (بدون هیچ تماس با server/data) اجرا می‌کند و زنجیرهٔ
 * مثبتِ SoD را پوشش می‌دهد که با کاربران محلی (u-pm/u-contracts) قابل
 * رسیدن نبود: تولید → تأیید محتوا → صدور → جایگزینی نسخه + گیت ۴۲۲ گزارش.
 *
 * اجرای هدفمند فقط:  node --test server/disputeExpertApi.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { registerDisputeExpertRoutes } from "./disputeExpertApi.js";

/* ─────────── موضوع‌های ساختگی (بدون دخلت در grants واقعی) ─────────── */
const SUBJECTS = [
  { id: "t-author", active: true },   // فقط ویرایش — سازنده/تولیدکننده
  { id: "t-approver", active: true }, // ویرایش + بازبینی + تأیید نهایی — تأییدکنندهٔ متفاوت/خودتأییدی
  { id: "t-admin", active: true },    // همهٔ مجوزها — برای گیت ۴۲۲ گزارش
  { id: "t-noedit", active: true },   // فقط مشاهده — برای بررسی گیت dispute.edit
];
const PERMS = {
  "t-author": ["dispute.view", "dispute.edit"],
  "t-approver": ["dispute.view", "dispute.edit", "dispute.review", "dispute.approve"],
  "t-admin": ["dispute.view", "dispute.edit", "dispute.review", "dispute.approve"],
  "t-noedit": ["dispute.view"],
};
const evaluateFake = (subject, permission) => ({ allow: (PERMS[subject?.id] ?? []).includes(permission) });

/* ─────────── repo حافظه‌ای با امضای repo واقعی (JSON driver) ─────────── */
function makeRepo() {
  const tables = new Map();
  const ids = new Map();
  const rowsOf = (table) => (tables.get(table) ?? tables.set(table, []).get(table));
  const match = (row, conds) => (conds ?? []).every((c) => {
    if (c.op !== "eq") throw new Error(`repo تستی فقط op=eq را می‌شناسد: ${c.op}`);
    return String(row[c.column] ?? "") === String(c.value ?? "");
  });
  return {
    async findOne(table, conds) { return rowsOf(table).find((r) => match(r, conds)) ?? null; },
    async list(table, opts = {}) { const w = match; const rows = rowsOf(table).filter((r) => w(r, opts.where)); return rows.slice(0, opts.limit ?? rows.length); },
    async create(table, payload, actor) {
      const id = `t-${table.slice(12).toLowerCase()}-${(ids.get(table) ?? 0) + 1}`;
      ids.set(table, (ids.get(table) ?? 0) + 1);
      const row = { ...payload, Id: id, CreatedAt: new Date().toISOString(), CreatedBy: actor, RowVersion: 1 };
      rowsOf(table).push(row);
      return row;
    },
    async patch(table, id, patch, actor, rowVersion) {
      const row = rowsOf(table).find((r) => r.Id === id);
      if (!row) throw new Error("row not found");
      if (rowVersion !== undefined && row.RowVersion !== rowVersion) throw new Error("row version conflict");
      Object.assign(row, patch, { RowVersion: row.RowVersion + 1 });
      return row;
    },
    async remove(table, id) {
      const list = rowsOf(table);
      const i = list.findIndex((r) => r.Id === id);
      if (i >= 0) list.splice(i, 1);
    },
  };
}

/* ─────────── سرور HTTP واقعی روی پورت تصادفی ─────────── */
function startServer() {
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.use((req, _res, next) => { req.requestId = "test-req"; next(); });
  registerDisputeExpertRoutes(app, { repo: async () => makeRepo.instance, subjects: SUBJECTS, evaluate: evaluateFake });
  const server = app.listen(0);
  makeRepo.instance = makeRepo();
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}/api/dispute-expert/c1-p1`;
  const api = async (method, path, user, body) => {
    const res = await fetch(base + path, {
      method,
      headers: { "content-type": "application/json", "x-user-id": user },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const ct = res.headers.get("content-type") ?? "";
    return { status: res.status, body: ct.includes("json") ? await res.json() : await res.text() };
  };
  return { server, api, close: () => new Promise((r) => server.close(r)) };
}

test("زنجیرهٔ مثبت SoD گزارش کارشناسی: تولید → تأیید محتوا (بازبین≠تولیدکننده) → صدور (تأییدکننده≠تولیدکننده) → جایگزینی نسخهٔ پیشین + گیت ۴۲۲", async (t) => {
  const { server, api, close } = startServer();
  const PID = "c1-p1";
  try {
    await t.test("ایجاد پرونده توسط سازنده", async () => {
      const r = await api("POST", "/cases", "t-author", { TitleFa: "پروندهٔ تست زنجیرهٔ SoD", SubjectCode: "payment_delay" });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.ok, true);
    });

    /* شناسهٔ پرونده را از GET می‌گیریم تا وابسته به ترتیب ایجاد نباشد */
    let caseId, caseRow;
    {
      const list = await api("GET", "/cases", "t-approver");
      assert.equal(list.body.ok, true);
      caseRow = list.body.data.cases[0];
      caseId = caseRow.Id;
    }

    let v1Id, v2Id;

    await t.test("ثبت نسخهٔ v1 (draft) توسط سازنده", async () => {
      const r = await api("POST", `/cases/${caseId}/reports`, "t-author", { TitleFa: "گزارش کارشناسی نسخهٔ ۱" });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.ok, true);
      v1Id = r.body.data.row.Id;
      assert.equal(r.body.data.row.Version, 1);
    });

    await t.test("گذر مستقیم draft→approved بدون واسطه ممنوع است (DSP_STATUS)", async () => {
      const r = await api("POST", `/cases/${caseId}/reports/${v1Id}/status`, "t-approver", { to: "approved" });
      assert.equal(r.status, 409);
      assert.equal(r.body.error.code, "DSP_STATUS");
    });

    await t.test("صدور/تأیید پیش از تولید خروجی مسدود است (DSP_NOT_GENERATED)", async () => {
      const ir = await api("POST", `/cases/${caseId}/reports/${v1Id}/status`, "t-author", { to: "in_review" });
      assert.equal(ir.status, 200, JSON.stringify(ir.body));
      const r = await api("POST", `/cases/${caseId}/reports/${v1Id}/status`, "t-approver", { to: "approved" });
      assert.equal(r.status, 409);
      assert.equal(r.body.error.code, "DSP_NOT_GENERATED");
    });

    await t.test("گیت ۴۲۲ گزارش: تولید Word از پروندهٔ بدون دادهٔ کافی", async () => {
      const r = await api("GET", `/cases/${caseId}/reports/${v1Id}/document?format=word`, "t-admin");
      assert.equal(r.status, 422);
      assert.equal(r.body.error.code, "DSP_REPORT_GATE");
    });

    /* برای عبور از گیت، رکوردهای واقعی موردنیاز را ثبت می‌کنیم (بازبینی issues گیت را تعیین می‌کند).
       ابتدا تلاش برای کشف need ها: بذار هر کدام را prüfen. ساده‌تر: یک بستهٔ معتبر را بررسی می‌کنیم. */
    await t.test("تکمیل دادهٔ پرونده برای گذر از گیت (طرفین، ادعا، مهلت، مرجع احرازشده)", async () => {
      const post = (table, body, user = "t-author") => api("POST", `/cases/${caseId}/rows/${table}`, user, body);
      const c1 = await post("PmisDisputeParties", { Role: "contractor", NameFa: "پیمانکار الف" });
      assert.equal(c1.status, 200, JSON.stringify(c1.body));
      const c2 = await post("PmisDisputeParties", { Role: "employer", NameFa: "کارفرما ب" });
      assert.equal(c2.status, 200, JSON.stringify(c2.body));
      const partyCode = c1.body.data.row.Code;
      const ev = await post("PmisDisputeEvidence", { DocType: "correspondence", TitleFa: "نامهٔ رسمی شمردار" });
      assert.equal(ev.status, 200, JSON.stringify(ev.body));
      const evCode = ev.body.data.row.Code;
      const cl = await post("PmisDisputeClaims", { ClaimantPartyCode: partyCode, BasisKind: "money", TitleFa: "ادعای تأخیر در پرداخت", EvidenceRefs: [evCode], LegalRefs: [{ SourceKind: "contract_clause", TitleFa: "بند ۳۰ قرارداد", Verification: "verified_text", VerifiedBy: "t-approver", TextFa: "متن احرازشدهٔ بند" }] });
      assert.equal(cl.status, 200, JSON.stringify(cl.body));
      const claimId = cl.body.data.row.Id;
      /* لایهٔ بررسی با بازبین، لایهٔ تأیید با تأییدکنندهٔ متفاوت (SoD مبالغ) */
      const rv = await api("PATCH", `/cases/${caseId}/rows/PmisDisputeClaims/${claimId}`, "t-approver", { ReviewedAmount: 500000000, ReviewBasisFa: "بر مبنای صورت‌وضعیت‌های قطعی و رسید بانکی", ApprovedAmount: undefined });
      assert.equal(rv.status, 200, JSON.stringify(rv.body));
      /* اجرای تحلیل قاعده‌محور + تأیید انسانی توسط بازبین (برای فصل کارشناسی گیت) */
      const run = await api("POST", `/cases/${caseId}/analysis/run`, "t-approver", {});
      assert.equal(run.status, 200, JSON.stringify(run.body));
      const list = await api("GET", `/cases/${caseId}`, "t-approver");
      const analyses = list.body.data.children.PmisDisputeAnalyses ?? [];
      for (const a of analyses.filter((a) => a.Code.startsWith("ANA-"))) {
        const appr = await api("PATCH", `/cases/${caseId}/rows/PmisDisputeAnalyses/${a.Id}`, "t-approver", { ApprovalStatus: "approved" });
        assert.equal(appr.status, 200, JSON.stringify(appr.body));
      }
    });

    await t.test("تولید Word واقعی از دادهٔ پرونده (عبور از گیت ۴۲۲)", async () => {
      const r = await api("GET", `/cases/${caseId}/reports/${v1Id}/document?format=word`, "t-author");
      assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
      assert.ok(String(r.body).includes("فصل"), "خروجی باید فصل‌های گزارش را داشته باشد");
    });

    await t.test("SoD منفی: کاربر بدون dispute.review از گیت مجوز رد می‌شود", async () => {
      /* تولیدکننده (t-author) فقط dispute.edit دارد — تأیید محتوا گیت مجوز را هم رد نمی‌کند */
      const r = await api("POST", `/cases/${caseId}/reports/${v1Id}/status`, "t-author", { to: "approved" });
      assert.equal(r.status, 403);
      assert.equal(r.body.error.code, "DSP_FORBIDDEN");
    });

    await t.test("SoD منفی: تولیدکنندهٔ دارای مجوز بازبینی نمی‌تواند نسخهٔ خود را تأیید کند", async () => {
      /* موضوعی با مجوز بازبینی که خودش نسخه را به بازبینی بُرده — تولیدکننده همان موضوع است */
      const claim2 = await api("POST", `/cases/${caseId}/rows/PmisDisputeReports`, "t-approver", { TitleFa: "نسخهٔ آزمون SoD تولیدکننده" });
      assert.equal(claim2.status, 200, JSON.stringify(claim2.body));
      const repId = claim2.body.data.row.Id;
      const ir = await api("POST", `/cases/${caseId}/reports/${repId}/status`, "t-approver", { to: "in_review" });
      assert.equal(ir.status, 200, JSON.stringify(ir.body));
      const gen = await api("GET", `/cases/${caseId}/reports/${repId}/document?format=word`, "t-approver");
      assert.equal(gen.status, 200, JSON.stringify(gen.body).slice(0, 160));
      const own = await api("POST", `/cases/${caseId}/reports/${repId}/status`, "t-approver", { to: "approved" });
      assert.equal(own.status, 403, JSON.stringify(own.body));
      assert.equal(own.body.error.code, "DSP_SOD");
    });

    await t.test("مثبت: بازبین (≠تولیدکننده) تأیید محتوا می‌کند", async () => {
      const r = await api("POST", `/cases/${caseId}/reports/${v1Id}/status`, "t-approver", { to: "approved" });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.ok, true);
      assert.equal(r.body.data.row.ApprovedBy, "t-approver");
      assert.equal(r.body.data.row.Status, "approved");
    });

    await t.test("مثبت: بازبین (دارای dispute.approve، ≠تولیدکننده) نسخه را صادر می‌کند", async () => {
      const r = await api("POST", `/cases/${caseId}/reports/${v1Id}/status`, "t-approver", { to: "issued" });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.data.row.Status, "issued");
      assert.equal(r.body.data.row.IssuedBy, "t-approver");
    });

    await t.test("نسخهٔ v2: تولید → بازبینی → تأیید → صدور؛ v1 به‌صورت خودکار جایگزین می‌شود", async () => {
      const mk = await api("POST", `/cases/${caseId}/reports`, "t-author", { TitleFa: "گزارش کارشناسی نسخهٔ ۲ (اصلام)" });
      assert.equal(mk.status, 200);
      v2Id = mk.body.data.row.Id;
      assert.equal(mk.body.data.row.Version, 2);
      const gen = await api("GET", `/cases/${caseId}/reports/${v2Id}/document?format=word`, "t-author");
      assert.equal(gen.status, 200, JSON.stringify(gen.body).slice(0, 160));
      const ir = await api("POST", `/cases/${caseId}/reports/${v2Id}/status`, "t-author", { to: "in_review" });
      assert.equal(ir.status, 200, JSON.stringify(ir.body));
      const appr = await api("POST", `/cases/${caseId}/reports/${v2Id}/status`, "t-approver", { to: "approved" });
      assert.equal(appr.status, 200, JSON.stringify(appr.body));
      const iss = await api("POST", `/cases/${caseId}/reports/${v2Id}/status`, "t-approver", { to: "issued" });
      assert.equal(iss.status, 200, JSON.stringify(iss.body));
      const v1 = await api("GET", `/cases/${caseId}`, "t-admin");
      const pv1 = v1.body.data.children.PmisDisputeReports.find((x) => x.Id === v1Id);
      assert.equal(pv1.Status, "superseded", "نسخهٔ پیشین باید به‌صورت خودکار جایگزین شود");
      const pv2 = v1.body.data.children.PmisDisputeReports.find((x) => x.Id === v2Id);
      assert.equal(pv2.Status, "issued");
    });

    await t.test("نظریه: مؤلف سمت سرور تزریق می‌شود؛ خودتأییدی SoD، تأیید متقابل مجاز", async () => {
      const mk = await api("POST", `/cases/${caseId}/rows/PmisDisputeOpinions`, "t-author", { TitleFa: "نظریهٔ آزمون SoD", BodyFa: "متن نظریه", SourcesJson: [], AuthoredBy: "t-approver" });
      assert.equal(mk.status, 200, JSON.stringify(mk.body));
      assert.equal(mk.body.data.row.AuthoredBy, "t-author", "سرور باید مؤلف واقعی را تحمیل کند حتی اگر کلاینت مقدار جعلی فرستاده باشد");
      const oId = mk.body.data.row.Id;
      const permGate = await api("PATCH", `/cases/${caseId}/rows/PmisDisputeOpinions/${oId}`, "t-author", { ReviewStatus: "final" });
      assert.equal(permGate.status, 403);
      assert.equal(permGate.body.error.code, "DSP_FORBIDDEN");
      /* خودتأییدی با موضوع دارای dispute.review که خودش مؤلف است → DSP_SOD واقعی */
      const mk2 = await api("POST", `/cases/${caseId}/rows/PmisDisputeOpinions`, "t-approver", { TitleFa: "نظریهٔ آزمون SoD (دوم)", BodyFa: "متن نظریه" });
      assert.equal(mk2.status, 200, JSON.stringify(mk2.body));
      const oId2 = mk2.body.data.row.Id;
      const own = await api("PATCH", `/cases/${caseId}/rows/PmisDisputeOpinions/${oId2}`, "t-approver", { ReviewStatus: "final" });
      assert.equal(own.status, 403, JSON.stringify(own.body));
      assert.equal(own.body.error.code, "DSP_SOD");
      const other = await api("PATCH", `/cases/${caseId}/rows/PmisDisputeOpinions/${oId}`, "t-approver", { ReviewStatus: "final" });
      assert.equal(other.status, 200, JSON.stringify(other.body));
      assert.equal(other.body.data.row.ReviewedBy, "t-approver");
    });

    await t.test("RBAC دقیق مسیر: نبود x-user-id → ۴۰۱؛ مجوز ناکافی → ۴۰۳", async () => {
      const anon = await fetch(`http://127.0.0.1:${server.address().port}/api/dispute-expert/c1-p1/cases`, { headers: { "content-type": "application/json" } });
      assert.equal(anon.status, 401);
      const forbidden = await api("POST", "/cases", "t-noedit", { TitleFa: "x", SubjectCode: "other" });
      assert.equal(forbidden.status, 403, JSON.stringify(forbidden.body));
      assert.equal(forbidden.body.error.code, "DSP_FORBIDDEN");
    });
  } finally {
    await close();
  }
});
