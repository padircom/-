/* آزمون اندپوینت‌های ورود داده ماژول مهندسی.
 *
 * این اندپوینت‌ها تنها راه ثبت رکورد از راه رابط کاربری‌اند و مستقیم روی
 * پیشرفت مدرک، دروازهٔ صدور IFC و نامزدی درخواست تغییر اثر می‌گذارند. پس
 * آزمون فقط «آیا ذخیره شد» را نمی‌سنجد؛ می‌سنجد که ورودی بد رد شود، رکورد
 * تکراری دو بار ساخته نشود، و اثر جانبی اعلام‌شده در پاسخ واقعاً درست باشد.
 *
 * سرور اختصاصی خودش را روی یک پوشهٔ داده موقت بالا می‌آورد. دلیلش این است
 * که درایور فایلی حافظهٔ داخلی دارد: اگر آزمون روی دادهٔ نمونهٔ مشترک بنویسد،
 * پاک کردن فایل کافی نیست و سرورِ در حال اجرا دوباره آن را می‌نویسد. پوشهٔ
 * جدا یعنی آزمون هیچ‌گاه دادهٔ نمونه را آلوده نمی‌کند. */
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, cp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const PORT = 4711;
const BASE = `http://localhost:${PORT}`;
const PROJECT = "p1";

let child = null;
let dataDir = null;

before(async () => {
  /* کپی دادهٔ نمونه تا آزمون رکوردهای واقعی را ببیند ولی روی نسخهٔ خودش بنویسد. */
  dataDir = await mkdtemp(path.join(tmpdir(), "eng-forms-"));
  /* پوشهٔ دادهٔ نمونه ردیابی‌نشده است و ممکن است در محیط تمیز نباشد؛ نبودش
   * نباید آزمون را ببندد چون درایور فایلی جدول غایب را جدول خالی می‌بیند. */
  await cp("server/data", dataDir, { recursive: true }).catch(() => {});

  child = spawn(process.execPath, ["server/index.js"], {
    env: { ...process.env, PORT: String(PORT), PERSIST_DRIVER: "json", DATA_DIR: dataDir },
    stdio: "ignore",
  });

  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${BASE}/api/eng/status?projectId=${PROJECT}`, { signal: AbortSignal.timeout(1000) });
      if (r.ok) return;
    } catch { /* هنوز بالا نیامده */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("سرور آزمون بالا نیامد");
});

after(async () => {
  if (child) child.kill("SIGTERM");
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
});

async function post(path, body, userId) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(userId ? { "x-user-id": userId } : {}) },
    body: JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch { /* پاسخ بدون بدنه */ }
  return { status: res.status, body: json };
}

/** شناسهٔ یکتا تا اجرای پیاپی آزمون به هم نخورد. */
const tag = () => `T${Date.now().toString(36).slice(-6)}${Math.floor(Math.random() * 900 + 100)}`;


/* ══════ اعتبارسنجی ══════ */

test("ثبت مدرک: بدنهٔ تهی همهٔ میدان‌های الزامی را با هم گزارش می‌کند", async () => {
  const { status, body } = await post(`/api/eng/mdr?projectId=${PROJECT}`, {}, "u-design");
  assert.equal(status, 422);
  assert.equal(body.error.code, "E-ENG-VALIDATION");
  /* گزارش یک‌جای همهٔ ایرادها، نه فقط اولین مورد — رفت‌وبرگشت کاربر را کم می‌کند. */
  const fields = body.error.issues.map((i) => i.field);
  for (const f of ["docNo", "titleFa", "discipline", "docType", "plannedWeight"]) {
    assert.ok(fields.includes(f), `${f} در فهرست ایرادها نیست`);
  }
});

test("ثبت مدرک: دیسیپلین خارج از فهرست رد می‌شود", async () => {
  const { status, body } = await post(`/api/eng/mdr?projectId=${PROJECT}`, {
    docNo: tag(), titleFa: "آزمون", discipline: "aerospace", docType: "ISO", plannedWeight: 1,
  }, "u-design");
  assert.equal(status, 422);
  assert.ok(body.error.issues.some((i) => i.field === "discipline" && i.code === "NOT_ALLOWED"));
});

test("ثبت مدرک: وزن منفی و وزن بیش از صد رد می‌شود", async () => {
  for (const [w, code] of [[-5, "TOO_SMALL"], [140, "TOO_LARGE"]]) {
    const { status, body } = await post(`/api/eng/mdr?projectId=${PROJECT}`, {
      docNo: tag(), titleFa: "آزمون", discipline: "civil", docType: "ISO", plannedWeight: w,
    }, "u-design");
    assert.equal(status, 422);
    assert.ok(body.error.issues.some((i) => i.field === "plannedWeight" && i.code === code), `وزن ${w}`);
  }
});

test("ثبت مدرک: تاریخ بدقالب رد می‌شود", async () => {
  const { status, body } = await post(`/api/eng/mdr?projectId=${PROJECT}`, {
    docNo: tag(), titleFa: "آزمون", discipline: "civil", docType: "ISO", plannedWeight: 1,
    targetIfaDate: "1405/03/12",
  }, "u-design");
  assert.equal(status, 422);
  assert.ok(body.error.issues.some((i) => i.field === "targetIfaDate" && i.code === "BAD_DATE"));
});

test("ثبت مدرک: تاریخ صدور پیش از تاریخ ارسال رد می‌شود", async () => {
  /* زنجیرهٔ مدرک وارونه یعنی برنامهٔ غیرممکن؛ باید همان‌جا جلویش گرفته شود. */
  const { status, body } = await post(`/api/eng/mdr?projectId=${PROJECT}`, {
    docNo: tag(), titleFa: "آزمون", discipline: "civil", docType: "ISO", plannedWeight: 1,
    targetIfaDate: "2026-09-01", targetIfcDate: "2026-08-01",
  }, "u-design");
  assert.equal(status, 422);
  assert.ok(body.error.issues.some((i) => i.code === "BEFORE_IFA"));
});

test("ثبت مدرک: نبود projectId خطای مشخص می‌دهد", async () => {
  const { status, body } = await post(`/api/eng/mdr`, {
    docNo: tag(), titleFa: "آزمون", discipline: "civil", docType: "ISO", plannedWeight: 1,
  }, "u-design");
  assert.equal(status, 400);
  assert.equal(body.error.code, "E-ENG-NO-PROJECT");
});

/* ══════ مسیر موفق و اثر جانبی ══════ */

test("ثبت مدرک: رکورد ساخته می‌شود و جمع وزن گزارش می‌گردد", async () => {
  const docNo = `ZZ-${tag()}`;
  const { status, body } = await post(`/api/eng/mdr?projectId=${PROJECT}`, {
    docNo, titleFa: "مدرک آزمون خودکار", discipline: "piping", docType: "ISO",
    plannedWeight: 2.5, targetIfaDate: "2026-07-01", targetIfcDate: "2026-08-15",
  }, "u-design");
  assert.equal(status, 201);
  assert.equal(body.data.created, true);
  assert.equal(body.data.item.DocNo, docNo);
  assert.equal(body.data.item.Discipline, "piping");
  /* عدد وزن باید عدد باشد نه رشته — مصرف‌کنندهٔ نمودار روی آن حساب می‌کند. */
  assert.equal(typeof body.data.totalWeight, "number");
});

test("ثبت مدرک: شمارهٔ تکراری با ۴۰۹ رد می‌شود نه رکورد دوم", async () => {
  const docNo = `ZZ-${tag()}`;
  const first = await post(`/api/eng/mdr?projectId=${PROJECT}`, {
    docNo, titleFa: "اول", discipline: "civil", docType: "DWG", plannedWeight: 1,
  }, "u-design");
  assert.equal(first.status, 201);

  const second = await post(`/api/eng/mdr?projectId=${PROJECT}`, {
    docNo, titleFa: "دوم", discipline: "civil", docType: "DWG", plannedWeight: 1,
  }, "u-design");
  assert.equal(second.status, 409);
  assert.equal(second.body.error.code, "E-ENG-DUP-DOCNO");
});

/* ══════ ریویژن ══════ */

test("صدور ریویژن: مدرک ناموجود ۴۰۴ می‌دهد", async () => {
  const { status, body } = await post(`/api/eng/revision?projectId=${PROJECT}`, {
    deliverableId: "does-not-exist", revCode: "A1", purpose: "IFA", issuedAt: "2026-07-01",
  }, "u-design");
  assert.equal(status, 404);
  assert.equal(body.error.code, "E-ENG-NO-DELIVERABLE");
});

test("صدور ریویژن: هدف نامعتبر رد می‌شود", async () => {
  const { status, body } = await post(`/api/eng/revision?projectId=${PROJECT}`, {
    deliverableId: "x", revCode: "A1", purpose: "FINAL", issuedAt: "2026-07-01",
  }, "u-design");
  assert.equal(status, 422);
  assert.ok(body.error.issues.some((i) => i.field === "purpose"));
});

test("صدور ریویژن: IFC بدون فایل مدرک رد می‌شود", async () => {
  const docNo = `ZZ-${tag()}`;
  const m = await post(`/api/eng/mdr?projectId=${PROJECT}`, {
    docNo, titleFa: "برای ریویژن", discipline: "process", docType: "PID", plannedWeight: 1,
  }, "u-design");

  /* ADR-ENG-03: پلهٔ IFC بدون DocumentId پیشرفت نمی‌دهد. اگر اجازه دهیم
   * ثبت شود، کاربر گمان می‌کند ۹۵٪ گرفته در حالی که روی ۲۰٪ مانده است. */
  const { status, body } = await post(`/api/eng/revision?projectId=${PROJECT}`, {
    deliverableId: m.body.data.item.Id, revCode: "C1", purpose: "IFC", issuedAt: "2026-07-10",
  }, "u-design");
  assert.equal(status, 422);
  assert.ok(body.error.issues.some((i) => i.field === "documentId"));
});

test("صدور ریویژن: IFA با اتمام بررسی گروهی پیشرفت شصت درصد می‌دهد", async () => {
  const docNo = `ZZ-${tag()}`;
  const m = await post(`/api/eng/mdr?projectId=${PROJECT}`, {
    docNo, titleFa: "برای پیشرفت", discipline: "process", docType: "PID", plannedWeight: 1,
  }, "u-design");

  const { status, body } = await post(`/api/eng/revision?projectId=${PROJECT}`, {
    deliverableId: m.body.data.item.Id, revCode: "A1", purpose: "IFA",
    issuedAt: "2026-07-05", idcCompletedAt: "2026-07-02",
  }, "u-design");
  assert.equal(status, 201);
  /* عدد از ROC_STEPS می‌آید؛ هاردکد اینجا عمدی است تا تغییر بی‌اعلام پله لو برود. */
  assert.equal(body.data.progress.pct, 60);
  assert.equal(body.data.progress.step, "IFA");
});

/* ══════ نظر بررسی ══════ */

test("ثبت نظر: ریویژن ناموجود ۴۰۴ می‌دهد", async () => {
  const { status, body } = await post(`/api/eng/crs?projectId=${PROJECT}`, {
    revisionId: "nope", commentText: "متن", severity: "minor", raisedAt: "2026-07-01",
  }, "u-design");
  assert.equal(status, 404);
  assert.equal(body.error.code, "E-ENG-NO-REVISION");
});

test("ثبت نظر: شدت خارج از فهرست رد می‌شود", async () => {
  const { status, body } = await post(`/api/eng/crs?projectId=${PROJECT}`, {
    revisionId: "x", commentText: "متن", severity: "blocker", raisedAt: "2026-07-01",
  }, "u-design");
  assert.equal(status, 422);
  assert.ok(body.error.issues.some((i) => i.field === "severity"));
});

test("ثبت نظر: شمارهٔ نظر خودکار و افزایشی است", async () => {
  const docNo = `ZZ-${tag()}`;
  const m = await post(`/api/eng/mdr?projectId=${PROJECT}`, {
    docNo, titleFa: "برای نظر", discipline: "civil", docType: "DWG", plannedWeight: 1,
  }, "u-design");

  const rev = await post(`/api/eng/revision?projectId=${PROJECT}`, {
    deliverableId: m.body.data.item.Id, revCode: "A1", purpose: "IFA",
    issuedAt: "2026-07-05", idcCompletedAt: "2026-07-02",
  }, "u-design");
  const revisionId = rev.body.data.item.Id;

  /* شماره‌گذاری دستی در اکسل منبع رایج خطاست؛ سرور باید خودش بشمارد. */
  const c1 = await post(`/api/eng/crs?projectId=${PROJECT}`, {
    revisionId, commentText: "نظر اول", severity: "minor", raisedAt: "2026-07-08",
  }, "u-design");
  const c2 = await post(`/api/eng/crs?projectId=${PROJECT}`, {
    revisionId, commentText: "نظر دوم", severity: "major", raisedAt: "2026-07-09",
  }, "u-design");

  assert.equal(c1.status, 201);
  assert.equal(c2.status, 201);
  assert.equal(c1.body.data.commentNo, 1);
  assert.equal(c2.body.data.commentNo, 2);
  /* نظر باز باید دروازهٔ IFC را ببندد. */
  assert.equal(c2.body.data.gate.passed, false);
});

/* ══════ استعلام فنی ══════ */

test("ثبت استعلام: نوع نامعتبر رد می‌شود", async () => {
  const { status, body } = await post(`/api/eng/tq?projectId=${PROJECT}`, {
    code: tag(), kind: "RFI", titleFa: "ع", discipline: "civil", raisedAt: "2026-07-01",
  }, "u-site");
  assert.equal(status, 422);
  assert.ok(body.error.issues.some((i) => i.field === "kind"));
});

test("ثبت استعلام: بدون اثر زمان و هزینه نامزد تغییر نیست", async () => {
  const code = `ZTQ-${tag()}`;
  const { status, body } = await post(`/api/eng/tq?projectId=${PROJECT}`, {
    code, kind: "TQ", titleFa: "پرسش ساده", discipline: "civil", raisedAt: "2026-07-01",
  }, "u-site");
  assert.equal(status, 201);
  assert.equal(body.data.hasImpact, false);
});

test("ثبت استعلام: اثر زمان آن را نامزد درخواست تغییر می‌کند", async () => {
  const code = `ZTQ-${tag()}`;
  const { status, body } = await post(`/api/eng/tq?projectId=${PROJECT}`, {
    code, kind: "FCR", titleFa: "مغایرت تراز", discipline: "civil",
    raisedAt: "2026-07-01", timeImpactDays: 6,
  }, "u-site");
  assert.equal(status, 201);
  assert.equal(body.data.hasImpact, true);
  assert.equal(body.data.item.TimeImpactDays, 6);
});

test("ثبت استعلام: کد تکراری ۴۰۹ می‌دهد", async () => {
  const code = `ZTQ-${tag()}`;
  const a = await post(`/api/eng/tq?projectId=${PROJECT}`, {
    code, kind: "TQ", titleFa: "اول", discipline: "civil", raisedAt: "2026-07-01",
  }, "u-site");
  assert.equal(a.status, 201);
  const b = await post(`/api/eng/tq?projectId=${PROJECT}`, {
    code, kind: "TQ", titleFa: "دوم", discipline: "civil", raisedAt: "2026-07-02",
  }, "u-site");
  assert.equal(b.status, 409);
  assert.equal(b.body.error.code, "E-ENG-DUP-TQ");
});

/* ══════ دسترسی ══════ */

test("فرم‌ها: بدون شناسهٔ کاربر ۴۰۱ می‌دهند", async () => {
  for (const path of ["/api/eng/mdr", "/api/eng/revision", "/api/eng/crs", "/api/eng/tq"]) {
    const { status, body } = await post(`${path}?projectId=${PROJECT}`, {}, null);
    assert.equal(status, 401, path);
    assert.equal(body.error.code, "E-ENG-AUTH-REQUIRED", path);
  }
});

test("فرم‌ها: نقش بی‌ربط ۴۰۳ می‌گیرد و اعتبارسنجی حتی اجرا نمی‌شود", async () => {
  /* ترتیب مهم است: مجوز پیش از اعتبارسنجی بررسی می‌شود تا کاربر بی‌اجازه
   * از پیام‌های خطا ساختار داده را حدس نزند. */
  const { status, body } = await post(`/api/eng/mdr?projectId=${PROJECT}`, {}, "u-qc");
  assert.equal(status, 403);
  assert.equal(body.error.code, "E-ENG-FORBIDDEN");
});

test("تفکیک وظیفه: سرپرست طراحی ریویژن صادر می‌کند ولی مدیر مهندسی نه", async () => {
  const docNo = `ZZ-${tag()}`;
  const m = await post(`/api/eng/mdr?projectId=${PROJECT}`, {
    docNo, titleFa: "مرز نقش", discipline: "piping", docType: "ISO", plannedWeight: 1,
  }, "u-design");

  /* SOD-08: صادرکنندهٔ مدرک نباید همان کسی باشد که کد بررسی می‌زند. */
  const denied = await post(`/api/eng/revision?projectId=${PROJECT}`, {
    deliverableId: m.body.data.item.Id, revCode: "A9", purpose: "IFA", issuedAt: "2026-07-05",
  }, "u-engmgr");
  assert.equal(denied.status, 403);
});

/* پاکسازی لازم نیست: پوشهٔ دادهٔ موقت در قلاب after حذف می‌شود. */
