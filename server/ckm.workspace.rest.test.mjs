/**
 * LIVE-2 — میز کار ارتباطات و دانش d11 روی سرور واقعی (درایور JSON).
 *
 * سؤال محوری: مکاتبات، جلسات، ذی‌نفعان، درس‌آموخته‌ها و قواعد اطلاع‌رسانی
 * واقعاً ذخیره می‌شوند و پس از راه‌اندازی دوباره می‌مانند؟ و کنترل‌های
 * سمت سرور (مجوز، محرمانگی مکاتبات، تفکیک وظیفه در امضا/تصویب/تأیید،
 * قفل صورت‌جلسه، اعتبارسنجی موتور CKM، بسته بودن CRUD عمومی) اجرا می‌شوند؟
 */
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, cp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const PORT = 4744;
const BASE = `http://localhost:${PORT}`;
const PID = "lv2";
const TODAY = new Date().toISOString().slice(0, 10);
const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

let child = null;
let dataDir = null;

async function startServer() {
  child = spawn(process.execPath, ["server/index.js"], {
    env: { ...process.env, PORT: String(PORT), PERSIST_DRIVER: "json", DATA_DIR: dataDir },
    stdio: "ignore",
  });
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(1000) });
      if (r.status < 500 || r.status === 503) return;
    } catch { /* هنوز بالا نیامده */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("سرور آزمون بالا نیامد");
}

async function stopServer() {
  if (!child) return;
  const exited = new Promise((r) => child.once("exit", r));
  child.kill("SIGTERM");
  await exited;
  child = null;
}

before(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), "ckmws-data-"));
  await cp("server/data", dataDir, { recursive: true }).catch(() => {});
  await startServer();
});

after(async () => {
  await stopServer();
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
});

async function call(method, p, { user, body } = {}) {
  const res = await fetch(`${BASE}/api/ckm/${PID}${p}`, {
    method,
    headers: { "content-type": "application/json", ...(user ? { "x-user-id": user } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}
const ws = async (user = "u-pm") => (await call("GET", "/workspace", { user })).body.data;
const code = (r) => r.body?.error?.code;

test("مجوز: بدون کاربر ۴۰۱، مدیر سامانه ۴۰۳، کنترل مدارک ۲۰۰؛ بدون مجوز مکاتبات، نامه‌ها پنهان", async () => {
  assert.equal((await call("GET", "/workspace")).status, 401);
  assert.equal((await call("GET", "/workspace", { user: "u-admin" })).status, 403);
  const r = await call("GET", "/workspace", { user: "u-doc" });
  assert.equal(r.status, 200);
  assert.equal(r.body.data.lettersHidden, false);
  assert.equal(r.body.data.today, TODAY);
  const site = await call("GET", "/workspace", { user: "u-site" });
  assert.equal(site.status, 200, "سرپرست کارگاه صورت‌جلسه ثبت می‌کند پس میز کار را می‌بیند");
  assert.equal(site.body.data.lettersHidden, true);
});

test("نمونه: فقط با مجوز پیش‌نویس، فقط روی پروژهٔ خالی، تاریخ‌ها نسبت به امروز جابه‌جا", async () => {
  assert.equal((await call("POST", "/seed", { user: "u-site" })).status, 403);
  const r = await call("POST", "/seed", { user: "u-doc" });
  assert.equal(r.status, 201);
  assert.equal(code(await call("POST", "/seed", { user: "u-doc" })), "E-CKM-NOT-EMPTY");
  const w = await ws();
  assert.equal(w.letters.length, 10);
  assert.equal(w.meetings.length, 5);
  assert.equal(w.actions.length, 10);
  assert.equal(w.stakeholders.length, 8);
  assert.equal(w.lessons.length, 8);
  assert.equal(w.rules.length, 5);
  /* نمونه نسبت به ۲۰۲۶-۰۹-۰۸ نوشته شده: نامهٔ ۰۹-۰۳ باید پنج روز پیش از امروز باشد. */
  const gn = w.letters.find((l) => l.LetterNo === "OG2401-GN-0299");
  assert.equal(String(gn.IssuedAt).slice(0, 10), addDays(TODAY, -5));
  assert.ok(gn.DueAt, "مهلت را سرور می‌نویسد");
  /* صورت‌جلسهٔ تصویب‌نشده در نمونه توزیع‌شده نیست (قاعدهٔ جدید). */
  assert.equal(w.meetings.find((m) => m.Code === "M-5").DistributedAt ?? null, null);
  const site = await ws("u-site");
  assert.equal(site.letters.length, 0, "مکاتبات محرمانه به نقش بدون مجوز نمی‌رسد");
  assert.equal(site.meetings.length, 5);
});

test("CRUD عمومی و ورود Excel برای جدول‌های d11 بسته است", async () => {
  for (const t of ["Correspondence", "MeetingMinute", "LessonLearned", "Stakeholder"]) {
    const g = await fetch(`${BASE}/api/data/${t}`);
    assert.equal(g.status, 403, t);
    assert.equal((await g.json()).error.code, "TABLE_HAS_DEDICATED_API");
    const p = await fetch(`${BASE}/api/data/${t}`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    assert.equal(p.status, 403, t);
  }
});

test("نامهٔ وارده: اعتبارسنجی موتور، ثبت دبیرخانه، مهلت روز کاری، شمارهٔ تکراری", async () => {
  const baseLetter = { LetterNo: "IN-100", Direction: "incoming", Kind: "claim_notice", SubjectFa: "اعلان ادعای توقف", FromParty: "پیمانکار", ToParty: "کارفرما", IssuedAt: addDays(TODAY, -2) };
  assert.equal(code(await call("POST", "/letters", { user: "u-doc", body: { ...baseLetter, Links: ["CLM-1"] } })), "E-CKM-104", "وارده بدون تاریخ ثبت");
  assert.equal(code(await call("POST", "/letters", { user: "u-doc", body: { ...baseLetter, ReceivedAt: addDays(TODAY, -1) } })), "E-CKM-103", "اعلان بدون ارجاع");
  assert.equal(code(await call("POST", "/letters", { user: "u-doc", body: { ...baseLetter, ReceivedAt: addDays(TODAY, 1), Links: ["CLM-1"] } })), "E-CKM-RECEIVED-RANGE");
  assert.equal((await call("POST", "/letters", { user: "u-auditor", body: baseLetter })).status, 403, "ممیز فقط می‌خواند");
  const ok = await call("POST", "/letters", { user: "u-doc", body: { ...baseLetter, ReceivedAt: addDays(TODAY, -1), Links: ["CLM-1"], OwnerRole: "مدیر قرارداد" } });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.data.Status, "registered");
  assert.equal(ok.body.data.TimeBarred, true);
  assert.ok(ok.body.data.DueAt > TODAY);
  assert.equal(code(await call("POST", "/letters", { user: "u-doc", body: { ...baseLetter, ReceivedAt: addDays(TODAY, -1), Links: ["CLM-1"] } })), "E-CKM-DUPLICATE");
  assert.equal(code(await call("PATCH", "/letters/IN-100", { user: "u-doc", body: { SubjectFa: "تغییر متن" } })), "E-CKM-LETTER-REGISTERED");
  assert.equal(code(await call("DELETE", "/letters/IN-100", { user: "u-doc" })), "E-CKM-LETTER-REGISTERED");
});

test("نامهٔ صادره: پیش‌نویس ← امضا فقط با مجوز، ارجاع اعلان الزامی، امضاکننده ≠ تهیه‌کننده", async () => {
  const d = { LetterNo: "OUT-200", Direction: "outgoing", Kind: "notice", SubjectFa: "اعلان شرایط پیش‌بینی‌نشدهٔ زمین", FromParty: "پیمانکار", ToParty: "کارفرما" };
  const c = await call("POST", "/letters", { user: "u-contracts", body: d });
  assert.equal(c.status, 201);
  assert.equal(c.body.data.Status, "draft");
  assert.equal((await call("POST", "/letters/OUT-200/issue", { user: "u-contracts" })).status, 403, "مدیر پیمان مجوز امضا ندارد");
  assert.equal(code(await call("POST", "/letters/OUT-200/issue", { user: "u-pm" })), "E-CKM-103", "اعلان بدون ارجاع امضا نمی‌شود");
  assert.equal((await call("PATCH", "/letters/OUT-200", { user: "u-contracts", body: { Links: ["RSK-22"], SubjectFa: "اعلان شرایط پیش‌بینی‌نشدهٔ زمین گمانهٔ ۷" } })).status, 200);
  const iss = await call("POST", "/letters/OUT-200/issue", { user: "u-pm" });
  assert.equal(iss.status, 200);
  assert.equal(iss.body.data.Status, "registered");
  assert.equal(iss.body.data.SignedBy, "u-pm");
  assert.equal(code(await call("POST", "/letters/OUT-200/issue", { user: "u-pm" })), "E-CKM-ALREADY-ISSUED");

  assert.equal((await call("POST", "/letters", { user: "u-pm", body: { ...d, LetterNo: "OUT-201", Kind: "general" } })).status, 201);
  const sod = await call("POST", "/letters/OUT-201/issue", { user: "u-pm" });
  assert.equal(sod.status, 403);
  assert.equal(code(sod), "E-CKM-SOD");
  assert.equal((await call("DELETE", "/letters/OUT-201", { user: "u-pm" })).status, 200, "پیش‌نویس حذف می‌شود");
});

test("پاسخ و بستن: بازهٔ تاریخ، اعلان بی‌پاسخ بسته نمی‌شود، نامهٔ عادی بی‌پاسخ فقط با دلیل", async () => {
  assert.equal(code(await call("POST", "/letters/IN-100/respond", { user: "u-doc", body: { RespondedAt: addDays(TODAY, 1) } })), "E-CKM-RESPONSE-RANGE");
  assert.equal(code(await call("POST", "/letters/OUT-200/close", { user: "u-doc" })), "E-CKM-UNANSWERED-NOTICE");
  const rsp = await call("POST", "/letters/IN-100/respond", { user: "u-doc", body: { ResponseRef: "OUT-210" } });
  assert.equal(rsp.status, 200);
  assert.equal(rsp.body.data.Status, "responded");
  assert.equal(String(rsp.body.data.RespondedAt).slice(0, 10), TODAY);
  assert.equal(code(await call("POST", "/letters/IN-100/respond", { user: "u-doc" })), "E-CKM-BAD-STATE");
  assert.equal((await call("POST", "/letters/IN-100/close", { user: "u-doc" })).status, 200);

  assert.equal((await call("POST", "/letters", { user: "u-doc", body: { LetterNo: "IN-101", Direction: "incoming", Kind: "general", SubjectFa: "معرفی نماینده", FromParty: "کارفرما", ToParty: "پیمانکار", ReceivedAt: TODAY } })).status, 201);
  assert.equal(code(await call("POST", "/letters/IN-101/close", { user: "u-doc" })), "E-CKM-REASON-REQUIRED");
  assert.equal((await call("POST", "/letters/IN-101/close", { user: "u-doc", body: { reasonFa: "صرفاً جهت اطلاع" } })).status, 200);
  assert.equal(code(await call("PATCH", "/letters/IN-101", { user: "u-doc", body: { OwnerRole: "x" } })), "E-CKM-LETTER-CLOSED");
});

test("جلسه: مصوبه با مالک و موعد، تصویب‌کننده ≠ ثبت‌کننده، قفل پس از تصویب، توزیع فقط پس از تصویب", async () => {
  const m = { Code: "MTG-9", TitleFa: "جلسهٔ هفتگی پیشرفت", MeetingType: "weekly", Chair: "مدیر پروژه", Invited: ["مدیر پروژه", "برنامه‌ریزی", "کیفیت"], Attendees: ["مدیر پروژه", "برنامه‌ریزی"] };
  assert.equal(code(await call("POST", "/meetings", { user: "u-doc", body: { ...m, HeldAt: addDays(TODAY, 2) } })), "E-CKM-FUTURE-MEETING");
  assert.equal(code(await call("POST", "/meetings", { user: "u-doc", body: { ...m, HeldAt: TODAY, Invited: [] } })), "E-CKM-NO-INVITED");
  assert.equal((await call("POST", "/meetings", { user: "u-auditor", body: { ...m, HeldAt: TODAY } })).status, 403);
  assert.equal((await call("POST", "/meetings", { user: "u-doc", body: { ...m, HeldAt: addDays(TODAY, -1) } })).status, 201);

  assert.equal(code(await call("POST", "/meetings/MTG-9/actions", { user: "u-doc", body: { TitleFa: "ارائهٔ برنامهٔ جبرانی جوشکاری", DueDate: addDays(TODAY, 5) } })), "E-CKM-201");
  assert.equal(code(await call("POST", "/meetings/MTG-9/actions", { user: "u-doc", body: { TitleFa: "ارائهٔ برنامهٔ جبرانی جوشکاری", OwnerRole: "برنامه‌ریزی" } })), "E-CKM-202");
  assert.equal(code(await call("POST", "/meetings/MTG-9/actions", { user: "u-doc", body: { TitleFa: "ارائهٔ برنامهٔ جبرانی جوشکاری", OwnerRole: "برنامه‌ریزی", DueDate: addDays(TODAY, -3) } })), "E-CKM-DUE-BEFORE-MEETING");
  const a = await call("POST", "/meetings/MTG-9/actions", { user: "u-site", body: { TitleFa: "ارائهٔ برنامهٔ جبرانی جوشکاری", OwnerRole: "برنامه‌ریزی", DueDate: addDays(TODAY, 5) } });
  assert.equal(a.status, 201);
  assert.equal(a.body.data.Code, "ACT-011");

  assert.equal(code(await call("POST", "/meetings/MTG-9/distribute", { user: "u-doc" })), "E-CKM-NOT-APPROVED");
  const sod = await call("POST", "/meetings/MTG-9/approve", { user: "u-doc" });
  assert.equal(sod.status, 403);
  assert.equal(code(sod), "E-CKM-SOD");
  assert.equal((await call("POST", "/meetings/MTG-9/approve", { user: "u-pm" })).status, 200);
  assert.equal(code(await call("POST", "/meetings/MTG-9/actions", { user: "u-doc", body: { TitleFa: "مصوبهٔ دیرهنگام پس از تصویب", OwnerRole: "کیفیت", DueDate: addDays(TODAY, 5) } })), "E-CKM-MINUTES-LOCKED");
  assert.equal(code(await call("PATCH", "/meetings/MTG-9", { user: "u-doc", body: { Attendees: ["همه"] } })), "E-CKM-MINUTES-LOCKED");
  assert.equal(code(await call("DELETE", "/meetings/MTG-9", { user: "u-doc" })), "E-CKM-MINUTES-LOCKED");
  const dist = await call("POST", "/meetings/MTG-9/distribute", { user: "u-doc" });
  assert.equal(dist.status, 200);
  assert.deepEqual([...dist.body.data.DistributedTo].sort(), ["برنامه‌ریزی", "کیفیت", "مدیر پروژه"].sort());

  assert.equal(code(await call("PATCH", "/actions/ACT-011", { user: "u-doc", body: { Status: "cancelled" } })), "E-CKM-REQUIRED");
  const done = await call("PATCH", "/actions/ACT-011", { user: "u-doc", body: { Status: "done" } });
  assert.equal(done.body.data.Status, "done");
  assert.equal(String(done.body.data.ClosedAt).slice(0, 10), TODAY);
  assert.equal(code(await call("PATCH", "/actions/ACT-011", { user: "u-doc", body: { Status: "in_progress" } })), "E-CKM-ACTION-CLOSED");
});

test("ذی‌نفعان: فقط با مجوز ویرایش ثبت ذی‌نفعان؛ بازهٔ قدرت/علاقه ۱ تا ۵", async () => {
  const s = { Code: "S-20", NameFa: "شهرداری منطقه", Org: "نهاد محلی", Power: 3, Interest: 4, CurrentLevel: "neutral", DesiredLevel: "supportive", Channels: ["نشست ماهانه"], Frequency: "monthly", OwnerRole: "مدیر پروژه" };
  assert.equal((await call("POST", "/stakeholders", { user: "u-doc", body: s })).status, 403);
  assert.equal(code(await call("POST", "/stakeholders", { user: "u-pm", body: { ...s, Power: 6 } })), "E-CKM-INVALID-NUMBER");
  assert.equal(code(await call("POST", "/stakeholders", { user: "u-pm", body: { ...s, CurrentLevel: "happy" } })), "E-CKM-INVALID-VALUE");
  assert.equal((await call("POST", "/stakeholders", { user: "u-pm", body: s })).status, 201);
  assert.equal((await call("PATCH", "/stakeholders/S-20", { user: "u-pm", body: { CurrentLevel: "supportive" } })).body.data.CurrentLevel, "supportive");
  assert.equal((await call("DELETE", "/stakeholders/S-8", { user: "u-pm" })).status, 200);
});

test("درس‌آموخته: منشأ و توصیه الزامی، تأییدکننده ≠ ثبت‌کننده، استفادهٔ مجدد فقط از درس تأییدشده و یک بار برای هر کاربر", async () => {
  const l = { Code: "K-20", TitleFa: "بازدید مشترک پیش از تحویل زمین", Category: "schedule", Impact: "high", SituationFa: "تحویل زمین بدون صورت‌جلسهٔ مشترک", RecommendationFa: "پیش از هر تحویل زمین بازدید مشترک و صورت‌جلسهٔ امضاشده الزامی شود" };
  assert.equal(code(await call("POST", "/lessons", { user: "u-doc", body: l })), "E-CKM-401");
  assert.equal(code(await call("POST", "/lessons", { user: "u-doc", body: { ...l, SourceRef: "CLM-014", RecommendationFa: "دقت شود" } })), "E-CKM-402");
  const c = await call("POST", "/lessons", { user: "u-doc", body: { ...l, SourceRef: "CLM-014" } });
  assert.equal(c.status, 201);
  assert.equal(c.body.data.CapturedBy, "u-doc");
  assert.equal(code(await call("POST", "/lessons/K-20/reuse", { user: "u-pm", body: { noteFa: "در قرارداد فاز ۲ اعمال شد" } })), "E-CKM-LESSON-NOT-VALIDATED");
  const sod = await call("POST", "/lessons/K-20/validate", { user: "u-doc" });
  assert.equal(sod.status, 403);
  assert.equal(code(sod), "E-CKM-SOD");
  assert.equal((await call("POST", "/lessons/K-20/validate", { user: "u-pm" })).body.data.Validated, true);
  assert.equal(code(await call("PATCH", "/lessons/K-20", { user: "u-doc", body: { TitleFa: "x" } })), "E-CKM-LESSON-LOCKED");
  assert.equal(code(await call("POST", "/lessons/K-20/reuse", { user: "u-site", body: { noteFa: "کوتاه" } })), "E-CKM-TOO-SHORT");
  assert.equal((await call("POST", "/lessons/K-20/reuse", { user: "u-site", body: { noteFa: "در تحویل زمین منطقهٔ ۴ اعمال شد" } })).body.data.ReuseCount, 1);
  assert.equal(code(await call("POST", "/lessons/K-20/reuse", { user: "u-site", body: { noteFa: "دوباره در منطقهٔ ۵ اعمال شد" } })), "E-CKM-ALREADY-REUSED");
  const second = await call("POST", "/lessons/K-20/reuse", { user: "u-pm", body: { noteFa: "در قرارداد فاز ۲ اعمال شد" } });
  assert.equal(second.body.data.ReuseCount, 2);
  assert.ok(second.body.data.Value > c.body.data.Value, "ارزش با تأیید و استفاده بالا می‌رود");
  assert.equal(code(await call("DELETE", "/lessons/K-20", { user: "u-doc" })), "E-CKM-LESSON-LOCKED");
});

test("قواعد اطلاع‌رسانی: فقط با مجوز، رویداد و کانال از فهرست مجاز", async () => {
  const r = { Code: "NR-9", EventCode: "minutes_undistributed", NameFa: "صورت‌جلسهٔ توزیع‌نشده", Channels: ["in_app", "email"], AudienceRoles: ["دبیرخانه"], EscalateAfterHours: 48, EscalateToRole: "مدیر پروژه" };
  assert.equal((await call("POST", "/rules", { user: "u-contracts", body: r })).status, 403);
  assert.equal(code(await call("POST", "/rules", { user: "u-doc", body: { ...r, EventCode: "whatever" } })), "E-CKM-INVALID-VALUE");
  assert.equal(code(await call("POST", "/rules", { user: "u-doc", body: { ...r, Channels: ["fax"] } })), "E-CKM-INVALID-VALUE");
  assert.equal(code(await call("POST", "/rules", { user: "u-doc", body: { ...r, Channels: [] } })), "E-CKM-NO-CHANNEL");
  const c = await call("POST", "/rules", { user: "u-doc", body: r });
  assert.equal(c.status, 201);
  assert.equal(c.body.data.Active, true);
  assert.equal((await call("PATCH", "/rules/NR-9", { user: "u-doc", body: { Active: false } })).body.data.Active, false);
  assert.equal((await call("DELETE", "/rules/NR-9", { user: "u-doc" })).status, 200);
});

test("ماندگاری پس از راه‌اندازی دوباره + لاگ ممیزی", async () => {
  await stopServer();
  await startServer();
  const w = await ws();
  assert.equal(w.letters.find((l) => l.LetterNo === "OUT-200").SignedBy, "u-pm");
  assert.equal(w.meetings.find((m) => m.Code === "MTG-9").MinutesApproved, true);
  assert.equal(w.lessons.find((l) => l.Code === "K-20").ReuseCount, 2);
  assert.equal(w.reuses.filter((x) => x.LessonCode === "K-20").length, 2);
  assert.ok(!w.stakeholders.some((s) => s.Code === "S-8"));
  const audit = JSON.parse(await readFile(path.join(dataDir, "AuditLog.json"), "utf8"));
  const rows = Array.isArray(audit) ? audit : audit.rows ?? Object.values(audit);
  const actions = new Set(rows.filter((x) => x.ProjectCode === PID).map((x) => x.Action));
  for (const a of ["CKM_SAMPLE_SEEDED", "CKM_LETTER_ISSUED", "CKM_LETTER_RESPOND", "CKM_MINUTES_APPROVED", "CKM_MINUTES_DISTRIBUTED", "CKM_ACTION_CLOSE", "CKM_LESSON_VALIDATE", "CKM_LESSON_REUSE", "CKM_RULE_CREATED"]) {
    assert.ok(actions.has(a), `لاگ ممیزی ${a} ثبت نشده`);
  }
});
