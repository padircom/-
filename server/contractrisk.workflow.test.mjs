/**
 * PMO-CONTRACT-RISK-ENGINE-V1.0 — آزمون گردش‌کامل ماژول «ثبت و تحلیل ریسک».
 * اجرا: node --test server/contractrisk.workflow.test.mjs
 *
 * این آزمون روی «لایهٔ ماندگاری واقعی» (JsonFileDriver در پوشهٔ موقت) اجرا می‌شود،
 * نه روی mock — چون ایرادهایی که این آزمون قفل می‌کند دقیقاً در همین لایه بودند:
 *  ۱) `repo.patch` ردیف به‌روزشده را برنمی‌گرداند ⇒ ویرایش ریسک و «ارزیابی مجدد»
 *     با ۴۲۲ می‌شکستند (snapshot ارزیابی `Code` را نداشت).
 *  ۲) کدهای خطای عمدی ۴xx در هندلر API به ۵۰۰ تبدیل می‌شدند ⇒ دلیل خطا به UI نمی‌رسید.
 *  ۳) تعارض هم‌زمان پاسخ مبهم می‌داد ⇒ حالا ۴۰۹ با کد صریح.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { JsonFileDriver, createRepository } from "./persistence/driver.mjs";
import { registerContractRiskRoutes } from "./contractRiskApi.js";
import { DEMO_SUBJECTS as SUBJECTS, evaluate } from "./rbacLogic.js";

const PID = "c1-p1";
const CONTRACTS = "u-contracts";   // cnt.risk.view + cnt.risk.edit
const PM = "u-pm";                 // cnt.risk.view + cnt.risk.approve
const PLANNER = "u-planner";       // بدون هیچ مجوز ریسک قراردادی
/** نقش دوگانهٔ آزمایشی (ثبت + تصویب) برای آزمودن SoD خودِ ماژول. */
const BOTH = { id: "u-cntrisk-both", displayName: "ثبت‌کننده و تصویب‌کننده (آزمایشی)", roles: ["contracts_manager", "project_manager"], projectIds: [PID], active: true, party: "contractor" };

function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cntrisk-test-"));
  const repo = createRepository(new JsonFileDriver(dir));
  repo.__dir = dir;
  return repo;
}

function mkApp(repo) {
  const handlers = new Map();
  const strip = (p) => String(p).replace("/api/cnt-risk/:projectId", "");
  const app = {
    get: (p, ...hs) => handlers.set(`GET ${strip(p)}`, hs),
    post: (p, ...hs) => handlers.set(`POST ${strip(p)}`, hs),
    patch: (p, ...hs) => handlers.set(`PATCH ${strip(p)}`, hs),
    delete: (p, ...hs) => handlers.set(`DELETE ${strip(p)}`, hs),
  };
  registerContractRiskRoutes(app, { repo: async () => repo, subjects: [...SUBJECTS, BOTH], evaluate });
  /* تطبیق مسیر با پارامترها (مثل /risks/:id) */
  const matchRoute = (method, p) => {
    for (const [key, hs] of handlers) {
      const [m, route] = key.split(" ");
      if (m !== method) continue;
      const names = (route.match(/:[A-Za-z0-9_]+/g) ?? []).map((n) => n.slice(1));
      const rx = new RegExp("^" + route.replace(/:[A-Za-z0-9_]+/g, "([^/]+)") + "$");
      const hit = rx.exec(strip(p));
      if (!hit) continue;
      const routeParams = Object.fromEntries(names.map((n, i) => [n, hit[i + 1]]));
      return { hs, routeParams };
    }
    return null;
  };
  const simulate = async (method, path_, { sub, params = {}, query = {}, body = {} } = {}) => {
    const found = matchRoute(method, path_);
    assert.ok(found, `مسیر ثبت نشده است: ${method} ${path_}`);
    const hs = found.hs;
    const req = { params: { projectId: PID, ...found.routeParams, ...params }, headers: { "x-user-id": sub }, query, body, requestId: "cntrisk-test", method };
    const res = {
      statusCode: 200, body: null, sent: null,
      status(c) { this.statusCode = c; return this; },
      json(j) { this.body = j; return this; },
      send(b) { this.sent = b; return this; },
      setHeader() { },
    };
    let err = null;
    const next = (e) => { if (e) err = e; };
    let idx = 0;
    while (idx < hs.length && !err && res.body === null && res.sent === null) {
      await hs[idx++](req, res, next);
    }
    if (res.body) return { status: res.statusCode, ok: res.body.ok !== false, data: res.body.data, code: res.body.error?.code, message: res.body.error?.message };
    if (err) return { status: err.status ?? 500, ok: false, code: err.code ?? "UNHANDLED", message: err.message };
    return { status: res.statusCode, ok: true, data: res.sent ?? null };
  };
  return simulate;
}

const fullRisk = (over = {}) => ({
  TitleFa: "تأخیر در پرداخت صورت‌وضعیت", Category: "payment_cashflow",
  DescriptionFa: "احتمال تأخیر کارفرما در پرداخت", Owner: "u-contracts",
  Probability: 4, ImpactTime: 4, ImpactFinancial: 5, ImpactLegal: 2, ImpactOperational: 3, ImpactQuality: 1,
  ControlEffectiveness: "strong", ControlEvidenceRefs: ["PR-1", "PR-2"], ...over,
});

test("ثبت ریسک: امتیاز ذاتی و باقیمانده با دلیل‌نما محاسبه و ثبت می‌شود", async () => {
  const repo = makeRepo(); const api = mkApp(repo);
  const r = await api("POST", "/risks", { sub: CONTRACTS, body: fullRisk() });
  assert.equal(r.status, 200, JSON.stringify(r));
  assert.ok(r.data.risk.Code.startsWith("CR-"), "کد ریسک ساخته می‌شود");
  assert.equal(r.data.risk.InherentBand, "high");
  /* تا وقتی قاعدهٔ سازمانی تصویب نشده، نتیجه «برآورد اولیه» است نه رتبهٔ قطعی */
  assert.equal(r.data.scoring.status, "needs_review");
  assert.ok(r.data.scoring.rationaleFa.some((x) => x.includes("امتیاز ذاتی")));
  assert.ok(r.data.scoring.rationaleFa.some((x) => x.includes("مصوب نیست")));
  assert.ok(r.data.scoring.rationaleFa.some((x) => x.includes("شاهد") || x.includes("کنترل")));
  /* ارزیابی اولیه هم‌زمان با ثبت ساخته می‌شود */
  const ws = await api("GET", "/workspace", { sub: PM });
  assert.equal(ws.data.assessments.length, 1);
  assert.equal(ws.data.risks.length, 1);
  /* مرکز کنترل، وضعیت تصویب قاعده را صریح می‌گوید */
  assert.equal(ws.data.scoringRule.approved, false);
  assert.equal(ws.data.scoringRule.isDefault, true);
  /* پس از تصویب قاعدهٔ سازمانی، همان محاسبه «قطعی» می‌شود */
  const rule = await api("POST", "/scoring-rules", { sub: CONTRACTS, body: { Code: "CRR-0", NameFa: "قاعدهٔ پایه", Version: "1.0" } });
  await api("POST", `/scoring-rules/${rule.data.rule.Id}/approve`, { sub: PM });
  const after = await api("POST", "/risks", { sub: CONTRACTS, body: fullRisk({ TitleFa: "ریسک پس از تصویب قاعده" }) });
  assert.equal(after.data.scoring.status, "scored");
  assert.ok(after.data.scoring.rationaleFa.every((x) => !x.includes("مصوب نیست")));
});

test("ویرایش ریسک: خودِ ردیف برگردانده می‌شود و ارزیابی تازه ثبت می‌شود (رگرسیون ۴۲۲)", async () => {
  const repo = makeRepo(); const api = mkApp(repo);
  const created = await api("POST", "/risks", { sub: CONTRACTS, body: fullRisk() });
  const id = created.data.risk.Id;
  const r = await api("PATCH", `/risks/${id}`, { sub: CONTRACTS, body: { TitleFa: "تأخیر در پرداخت (ویرایش‌شده)", Probability: 5 } });
  assert.equal(r.status, 200, JSON.stringify(r));
  assert.ok(r.data.risk.Id, "پاسخ باید خودِ ردیف را برگرداند، نه شیء نتیجه");
  assert.equal(r.data.risk.TitleFa, "تأخیر در پرداخت (ویرایش‌شده)");
  assert.equal(r.data.risk.Probability, 5);
  assert.ok(r.data.risk.RowVersion >= 2, "نسخهٔ ردیف بعد از ویرایش یک واحد جلو می‌رود");
  const ws = await api("GET", "/workspace", { sub: PM });
  assert.equal(ws.data.assessments.length, 2, "ویرایش هم یک ارزیابی تازه ثبت می‌کند");
});

test("ارزیابی مجدد: یک ارزیابی تازه با امتیاز به‌روزشده", async () => {
  const repo = makeRepo(); const api = mkApp(repo);
  const created = await api("POST", "/risks", { sub: CONTRACTS, body: fullRisk() });
  const id = created.data.risk.Id;
  const r = await api("POST", `/risks/${id}/reassess`, { sub: CONTRACTS });
  assert.equal(r.status, 200, JSON.stringify(r));
  assert.equal(r.data.risk.Id, id);
  assert.equal(typeof r.data.scoring.residualScore, "number");
  const ws = await api("GET", "/workspace", { sub: PM });
  assert.equal(ws.data.assessments.length, 2);
  assert.equal(ws.data.trend.length, 2, "روند امتیاز از سوابق واقعی ساخته می‌شود");
});

test("مقیاس نامعتبر ⇒ ۴۰۰ با کد CNTRISK_SCALE (نه ۵۰۰)", async () => {
  const repo = makeRepo(); const api = mkApp(repo);
  const r = await api("POST", "/risks", { sub: CONTRACTS, body: fullRisk({ Probability: 9 }) });
  assert.equal(r.status, 400, JSON.stringify(r));
  assert.equal(r.code, "CNTRISK_SCALE");
  assert.ok(String(r.message).includes("۱ تا ۵"), "پیام فارسی دلیل خطا به کاربر می‌رسد");
});

test("ریسک ناموجود ⇒ ۴۰۴ CNTRISK_NOT_FOUND", async () => {
  const repo = makeRepo(); const api = mkApp(repo);
  const r = await api("POST", "/risks/does-not-exist/reassess", { sub: CONTRACTS });
  assert.equal(r.status, 404, JSON.stringify(r));
  assert.equal(r.code, "CNTRISK_NOT_FOUND");
});

test("اقدام پاسخ با ریسک ناموجود ⇒ ۴۰۰ CNTRISK_RISK_LINK", async () => {
  const repo = makeRepo(); const api = mkApp(repo);
  const r = await api("POST", "/actions", { sub: CONTRACTS, body: { RiskCode: "CR-NOT-THERE", Strategy: "mitigate", TitleFa: "اقدام" } });
  assert.equal(r.status, 400, JSON.stringify(r));
  assert.equal(r.code, "CNTRISK_RISK_LINK");
});

test("بدون مجوز: ثبت با مرجع مجوزِ غیر مجاز ⇒ ۴۰۳", async () => {
  const repo = makeRepo(); const api = mkApp(repo);
  const r = await api("POST", "/risks", { sub: PLANNER, body: fullRisk() });
  assert.equal(r.status, 403, JSON.stringify(r));
  assert.equal(r.code, "CNTRISK_FORBIDDEN");
  const w = await api("GET", "/workspace", { sub: PLANNER });
  assert.equal(w.status, 403);
});

test("کنترل بدون شاهد ⇒ محدود به «ضعیف»؛ با شاهد ⇒ اثر کامل اعمال می‌شود", async () => {
  const repo = makeRepo(); const api = mkApp(repo);
  const noEvidence = await api("POST", "/risks", { sub: CONTRACTS, body: fullRisk({ ControlEvidenceRefs: [] }) });
  assert.equal(noEvidence.status, 200);
  assert.ok(noEvidence.data.scoring.rationaleFa.some((x) => x.includes("شاهد")));
  assert.ok(noEvidence.data.scoring.controlEffectApplied < 0.6, "بدون شاهد، اثر کنترل کامل اعمال نمی‌شود");
  const withEvidence = await api("POST", "/risks", { sub: CONTRACTS, body: fullRisk() });
  assert.equal(withEvidence.data.scoring.controlEffectApplied, 0.6);
  assert.ok(withEvidence.data.scoring.residualScore < withEvidence.data.scoring.inherentScore);
});

test("قاعدهٔ امتیازدهی: سازنده خودش تصویب نمی‌کند (SoD) و تصویب دوباره ۴۰۹ است", async () => {
  const repo = makeRepo(); const api = mkApp(repo);
  /* سازنده همان کاربری است که مجوزِ تصویب را هم دارد ⇒ تفکیک وظیفه در خودِ ماژول */
  const rule = await api("POST", "/scoring-rules", { sub: BOTH.id, body: { Code: "CRR-1", NameFa: "قاعدهٔ سازمانی", Version: "1.0" } });
  assert.equal(rule.status, 200, JSON.stringify(rule));
  assert.equal(rule.data.rule.Status, "needs_review");
  const selfApprove = await api("POST", `/scoring-rules/${rule.data.rule.Id}/approve`, { sub: BOTH.id });
  assert.equal(selfApprove.status, 403, JSON.stringify(selfApprove));
  assert.equal(selfApprove.code, "CNTRISK_SOD");
  /* مرجع مجازِ دیگر ⇒ تصویب و برگشتِ خودِ ردیف */
  const approved = await api("POST", `/scoring-rules/${rule.data.rule.Id}/approve`, { sub: PM });
  assert.equal(approved.status, 200, JSON.stringify(approved));
  assert.equal(approved.data.rule.Status, "approved");
  assert.equal(approved.data.rule.ApprovedBy, PM, "پاسخ باید خودِ ردیفِ تصویب‌شده باشد");
  const again = await api("POST", `/scoring-rules/${rule.data.rule.Id}/approve`, { sub: PM });
  assert.equal(again.status, 409, JSON.stringify(again));
  assert.equal(again.code, "CNTRISK_RULE_STATE");
  /* پس از تصویب، وضعیت قاعده در مرکز کنترل «مصوب» گزارش می‌شود */
  const ws = await api("GET", "/workspace", { sub: PM });
  assert.equal(ws.data.scoringRule.approved, true);
});

test("پیشنهاد اصلاح قرارداد: تصمیم فقط از مسیر مجاز و با SoD", async () => {
  const repo = makeRepo(); const api = mkApp(repo);
  const imp = await api("POST", "/improvements", { sub: CONTRACTS, body: { ClauseRef: "ماده ۱۲", CurrentText: "متن فعلی", ProblemFa: "ابهام", ProposedText: "متن پیشنهادی" } });
  assert.equal(imp.status, 200, JSON.stringify(imp));
  const id = imp.data.improvement.Id;
  const direct = await api("PATCH", `/improvements/${id}`, { sub: CONTRACTS, body: { Status: "approved" } });
  assert.equal(direct.status, 403, JSON.stringify(direct));
  assert.equal(direct.code, "CNTRISK_DECIDE");
  const byProposer = await api("POST", `/improvements/${id}/decide`, { sub: CONTRACTS, body: { Decision: "approved" } });
  assert.equal(byProposer.status, 403, JSON.stringify(byProposer));
  const decided = await api("POST", `/improvements/${id}/decide`, { sub: PM, body: { Decision: "approved" } });
  assert.equal(decided.status, 200, JSON.stringify(decided));
  assert.equal(decided.data.improvement.Status, "approved");
  assert.equal(decided.data.improvement.ReviewerBy, PM);
});

test("تعارض هم‌زمان ⇒ ۴۰۹ با کد صریح (نه پاسخ مبهم)", async () => {
  const repo = makeRepo(); const api = mkApp(repo);
  const created = await api("POST", "/risks", { sub: CONTRACTS, body: fullRisk() });
  const id = created.data.risk.Id;
  const stale = await api("PATCH", `/risks/${id}`, { sub: CONTRACTS, body: { TitleFa: "ویرایش با نسخهٔ کهنه", RowVersion: 99 } });
  assert.equal(stale.status, 409, JSON.stringify(stale));
  assert.ok(["CONCURRENCY_CONFLICT", "CNTRISK_CONFLICT"].includes(stale.code), `کد دریافتی: ${stale.code}`);
});

test("تحلیل بند: متن بلند ⇒ یافتهٔ قابل ردیابی به بند؛ متن کوتاه ⇒ رد صادقانه", async () => {
  const repo = makeRepo(); const api = mkApp(repo);
  const longText = "ماده ۱۲ — تمدید مدت و خسارت تأخیر: در صورتی که تأخیر در اجرای موضوع پیمان ناشی از کارفرما باشد، پیمانکار حق دارد مدت پیمان را تمدید کرده و خسارات تأخیر را مطابق مفاد این ماده مطالبه نماید. مهلت اعلام این حق حداکثر ۱۴ روز از تاریخ رفع مانع خواهد بود.\nماده ۱۸ — جریمه تأخیر: در صورت تأخیر در اجرا، جریمه روزانه معادل ۰٫۱ درصد ارزش قرارداد محاسبه و در صورت‌وضعیت بعدی کسر خواهد شد.";
  const ok = await api("POST", "/analyze", { sub: CONTRACTS, body: { Text: longText, SourceLabel: "قرارداد اصلی" } });
  assert.equal(ok.status, 200, JSON.stringify(ok));
  assert.equal(ok.data.analysis.extractable, true);
  assert.ok(ok.data.findings.length > 0);
  assert.ok(ok.data.findings.every((f) => f.ReviewStatus === "pending"));
  const short = await api("POST", "/analyze", { sub: CONTRACTS, body: { Text: "متن کوتاه" } });
  assert.equal(short.status, 200);
  assert.equal(short.data.analysis.extractable, false);
  assert.equal(short.data.findings.length, 0);
});

test("پروژهٔ خالی ⇒ مرکز کنترل خالی و صفرِ صادقانه (بدون عدد ساختگی)", async () => {
  const repo = makeRepo(); const api = mkApp(repo);
  const ws = await api("GET", "/workspace", { sub: PM });
  assert.equal(ws.status, 200);
  assert.equal(ws.data.risks.length, 0);
  assert.equal(ws.data.assessments.length, 0);
  assert.equal(ws.data.trend.length, 0);
  assert.ok(ws.data.summary, "جمع‌بندی وجود دارد ولی از دادهٔ واقعی ساخته شده است");
});
