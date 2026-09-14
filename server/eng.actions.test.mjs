/* آزمون قرارداد اقدام‌های یکپارچه‌سازی.
 *
 * کارت‌های اقدام در رابط کاربری از میدان‌های مشخصی از پاسخ خلاصه می‌سازند
 * (drafts، rows، snapshots، unlinked و …). اگر نام این میدان‌ها در سرور
 * عوض شود، رابط کاربری خطا نمی‌دهد بلکه بی‌صدا «۰ مورد» نشان می‌دهد و
 * کاربر گمان می‌کند کاری برای انجام نیست. این آزمون همان میدان‌ها را
 * قفل می‌کند.
 *
 * همچنین می‌سنجد که پیش‌نمایش واقعاً بدون اثر باشد: اجرای دوبارهٔ dry-run
 * نباید چیزی بنویسد. */
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, cp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const PORT = 4712;
const BASE = `http://localhost:${PORT}`;
const PROJECT = "p1";
const AS_OF = "2026-06-01";

let child = null;
let dataDir = null;

before(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), "eng-actions-"));
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
    } catch { /* هنوز */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("سرور آزمون بالا نیامد");
});

after(async () => {
  if (child) child.kill("SIGTERM");
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
});

async function act(pathname, userId, apply = false) {
  const res = await fetch(`${BASE}${pathname}?projectId=${PROJECT}&asOf=${AS_OF}${apply ? "&apply=1" : ""}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-user-id": userId },
    body: "{}",
  });
  return { status: res.status, body: await res.json() };
}

/* نگاشت اقدام → نقشی که واقعاً اجازه دارد، و میدان‌هایی که رابط می‌خواند. */
const ACTIONS = [
  { path: "/api/eng/pex/sync-ifc-locks", user: "u-pm", planKeys: ["lock", "release", "unchanged"] },
  { path: "/api/eng/rcc/draft-crs", user: "u-pm", planKeys: ["drafts", "skippedNoImpact"] },
  { path: "/api/eng/rcc/draft-eot", user: "u-pm", planKeys: ["drafts"] },
  { path: "/api/eng/fin/draft-pr", user: "u-pm", planKeys: ["drafts"] },
  { path: "/api/eng/qms/draft-dcn", user: "u-engmgr", planKeys: ["drafts", "skippedNotDesign"] },
  { path: "/api/eng/fin/draft-mr", user: "u-design", planKeys: ["drafts", "skippedNotIfc"] },
  { path: "/api/eng/mon/publish-kpi", user: "u-engmgr", dataKeys: ["snapshots", "periodCode"] },
  { path: "/api/eng/snapshot/progress", user: "u-engmgr", dataKeys: ["snapshots", "periodCode"] },
  { path: "/api/eng/pex/backfill-roc", user: "u-engmgr", dataKeys: ["rows", "unlinked"] },
];

/* ══════ قرارداد میدان‌ها ══════ */

for (const a of ACTIONS) {
  test(`قرارداد پاسخ: ${a.path}`, async () => {
    const { status, body } = await act(a.path, a.user);
    assert.equal(status, 200, `${a.path} پاسخ ${status} داد`);
    assert.equal(body.ok, true);

    /* پیش‌فرض باید dry-run باشد؛ اقدام دائمی هرگز نباید تصادفی اجرا شود. */
    assert.equal(body.data.dryRun, true, `${a.path} پیش‌فرض dry-run نیست`);

    const plan = body.data.plan ?? body.data;
    for (const k of a.planKeys ?? []) {
      assert.ok(k in plan, `میدان plan.${k} در ${a.path} نیست — خلاصهٔ رابط کاربری صفر می‌شود`);
    }
    for (const k of a.dataKeys ?? []) {
      assert.ok(k in body.data, `میدان data.${k} در ${a.path} نیست`);
    }
  });
}

test("خلاصه‌ها عدد می‌دهند نه undefined", async () => {
  /* همان محاسبه‌ای که کارت اقدام انجام می‌دهد، اینجا تکرار می‌شود تا
   * «۰ مورد»ِ کاذب لو برود. */
  const locks = (await act("/api/eng/pex/sync-ifc-locks", "u-pm")).body.data.plan;
  assert.equal(typeof locks.unchanged, "number");
  assert.ok(Array.isArray(locks.lock) && Array.isArray(locks.release));

  const eot = (await act("/api/eng/rcc/draft-eot", "u-pm")).body.data.plan;
  assert.ok(Array.isArray(eot.drafts));
  const days = eot.drafts.reduce((s, x) => s + Number(x.extensionDays ?? 0), 0);
  assert.ok(Number.isFinite(days), "مجموع روز تمدید عدد نیست");

  const roc = (await act("/api/eng/pex/backfill-roc", "u-engmgr")).body.data;
  assert.ok(Array.isArray(roc.rows));
  assert.equal(typeof roc.unlinked, "number");
});

/* ══════ بی‌اثر بودن پیش‌نمایش ══════ */

test("پیش‌نمایش هیچ رکوردی نمی‌نویسد حتی با اجرای مکرر", async () => {
  const snap = async () => {
    const files = ["Activity.json", "ChangeRequest.json", "MaterialRequest.json", "KpiSnapshot.json"];
    const out = {};
    for (const f of files) {
      out[f] = await readFile(path.join(dataDir, f), "utf8").catch(() => "[]");
    }
    return JSON.stringify(out);
  };

  const before = await snap();
  for (const a of ACTIONS) {
    await act(a.path, a.user);
    await act(a.path, a.user);
  }
  const after = await snap();
  assert.equal(after, before, "پیش‌نمایش داده را تغییر داد — دیگر dry-run نیست");
});

/* ══════ دسترسی ══════ */

test("اقدام‌ها بدون شناسهٔ کاربر ۴۰۱ می‌دهند", async () => {
  for (const a of ACTIONS) {
    const res = await fetch(`${BASE}${a.path}?projectId=${PROJECT}`, { method: "POST" });
    assert.equal(res.status, 401, a.path);
  }
});

test("اقدام‌ها با نقش بی‌ربط ۴۰۳ می‌دهند", async () => {
  /* بازرس کیفیت هیچ مجوز نوشتاری مهندسی ندارد. */
  for (const a of ACTIONS) {
    const { status } = await act(a.path, "u-qc");
    assert.equal(status, 403, `${a.path} برای u-qc باز است`);
  }
});

test("اعمال دائمی همان اقدام را واقعاً می‌نویسد", async () => {
  /* یک اقدام کم‌خطر انتخاب می‌شود تا اثبات شود apply=1 مسیر جدایی دارد
   * و dryRun در پاسخ خاموش می‌گردد. */
  const { status, body } = await act("/api/eng/snapshot/progress", "u-engmgr", true);
  assert.equal(status, 200);
  assert.equal(body.data.dryRun, false);
  assert.ok(body.data.written > 0, "هیچ عکسی نوشته نشد");
});
