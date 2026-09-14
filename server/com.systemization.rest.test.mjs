import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execPath } from "node:process";

const PORT = 4717;
const BASE = `http://127.0.0.1:${PORT}`;
let child;
let dataDir;

async function api(method, path, { body, user = "u-comm", raw = false } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json", "x-user-id": user },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return raw ? { status: res.status, json } : json;
}

before(async () => {
  dataDir = await mkdtemp(join(tmpdir(), "com-sys-"));
  await cp("server/data", dataDir, { recursive: true }).catch(() => {});
  child = spawn(execPath, ["server/index.js"], {
    env: { ...process.env, PORT: String(PORT), PERSIST_DRIVER: "json", DATA_DIR: dataDir },
    stdio: "ignore",
  });
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(`${BASE}/api/cnt/status`);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("سرور بالا نیامد");
});

after(async () => {
  child?.kill("SIGTERM");
  await new Promise((r) => setTimeout(r, 200));
  await rm(dataDir, { recursive: true, force: true }).catch(() => {});
});

const P = "?projectId=com-p1";

/* ══════════════ ساخت سیستم ══════════════ */

let rootId, childId, packageId;

test("ساخت سیستم ریشه", async () => {
  const r = await api("POST", `/api/com/system${P}`, {
    body: { systemCode: "U-100", titleFa: "واحد تقطیر", systemType: "system", criticalityFa: "high", commissioningPriority: 1, disciplineCode: "PR" },
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  rootId = r.data.id;
  assert.equal(r.data.item.typeFa, "سیستم");
  assert.equal(r.data.item.criticalityLabelFa, "بحرانی");
  assert.equal(r.data.item.Status, "planned");
});

test("ساخت زیرسیستم با والد", async () => {
  const r = await api("POST", `/api/com/system${P}`, {
    body: { systemCode: "U-110", titleFa: "برج تقطیر", systemType: "subsystem", parentId: rootId, commissioningPriority: 2 },
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  childId = r.data.id;
  assert.equal(r.data.item.ParentId, rootId);
});

test("ساخت بستهٔ سطح سوم", async () => {
  const r = await api("POST", `/api/com/system${P}`, {
    body: { systemCode: "U-111", titleFa: "پمپ خوراک", systemType: "package", parentId: childId },
  });
  assert.equal(r.ok, true);
  packageId = r.data.id;
});

test("کد تکراری رد می‌شود", async () => {
  const { status, json } = await api("POST", `/api/com/system${P}`, {
    body: { systemCode: "U-100", titleFa: "تکراری", systemType: "system" },
    raw: true,
  });
  assert.equal(status, 409);
  assert.equal(json.error.code, "E-COM-DUP-SYSTEM");
});

test("ورودی نامعتبر ۴۲۲ با فهرست کامل خطاها می‌دهد", async () => {
  const { status, json } = await api("POST", `/api/com/system${P}`, {
    body: { systemCode: "کد فارسی", titleFa: "", systemType: "چرند" },
    raw: true,
  });
  assert.equal(status, 422);
  assert.ok(json.error.details.length >= 3, "همهٔ خطاها باید یک‌جا برگردند");
});

test("والد ناموجود ۴۰۴ می‌دهد", async () => {
  const { status, json } = await api("POST", `/api/com/system${P}`, {
    body: { systemCode: "U-999", titleFa: "بی‌والد", systemType: "package", parentId: "ghost" },
    raw: true,
  });
  assert.equal(status, 404);
  assert.equal(json.error.code, "E-COM-PARENT-NOT-FOUND");
});

test("والد از پروژهٔ دیگر رد می‌شود", async () => {
  const other = await api("POST", "/api/com/system?projectId=com-p2", {
    body: { systemCode: "X-1", titleFa: "پروژه دیگر", systemType: "system" },
  });
  const { status, json } = await api("POST", `/api/com/system${P}`, {
    body: { systemCode: "U-888", titleFa: "نشتی پروژه", systemType: "package", parentId: other.data.id },
    raw: true,
  });
  assert.equal(status, 409);
  assert.equal(json.error.code, "E-COM-PARENT-OTHER-PROJECT");
});

/* ══════════════ درخت ══════════════ */

test("درخت با عمق و مسیر برمی‌گردد", async () => {
  const r = await api("GET", `/api/com/system${P}`);
  assert.equal(r.ok, true);
  assert.equal(r.data.count, 3);
  assert.equal(r.data.tree.length, 1, "یک ریشه");
  const pkg = r.data.items.find((x) => x.SystemCode === "U-111");
  assert.equal(pkg.depth, 2);
  assert.deepEqual(pkg.path, ["U-100", "U-110", "U-111"]);
  assert.deepEqual(r.data.orphans, []);
});

test("جابه‌جایی معتبر گره انجام می‌شود", async () => {
  const r = await api("POST", `/api/com/system/${packageId}/move${P}`, { body: { parentId: rootId } });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.item.ParentId, rootId);
  // برگردان به حالت اول
  await api("POST", `/api/com/system/${packageId}/move${P}`, { body: { parentId: childId } });
});

test("حلقه در درخت رد می‌شود", async () => {
  const { status, json } = await api("POST", `/api/com/system/${rootId}/move${P}`, {
    body: { parentId: packageId },
    raw: true,
  });
  assert.equal(status, 409);
  assert.equal(json.error.code, "E-COM-CYCLE");
});

test("والد خود شدن رد می‌شود", async () => {
  const { status, json } = await api("POST", `/api/com/system/${rootId}/move${P}`, {
    body: { parentId: rootId },
    raw: true,
  });
  assert.equal(status, 409);
  assert.equal(json.error.code, "E-COM-SELF-PARENT");
});

test("گره را می‌توان به ریشه برد", async () => {
  const r = await api("POST", `/api/com/system/${childId}/move${P}`, { body: { parentId: null } });
  assert.equal(r.ok, true);
  assert.equal(r.data.item.ParentId, null);
  await api("POST", `/api/com/system/${childId}/move${P}`, { body: { parentId: rootId } });
});

/* ══════════════ مرزبندی ══════════════ */

test("ثبت مرز اصلی", async () => {
  const r = await api("POST", `/api/com/system/${rootId}/boundary${P}`, {
    body: { targetKind: "wbs", targetRef: "WBS-1.2", isPrimary: true, boundaryNoteFa: "از شیر ورودی تا فلنج خروجی" },
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.item.kindFa, "بستهٔ کاری");
  assert.equal(r.data.coverage.hasPrimary, true);
  /* ستون از نوع bool است؛ درایور عدد ۱ را رد می‌کند و بولی واقعی می‌خواهد.
     این ادعا مانع بازگشت همان باگ می‌شود. */
  assert.equal(r.data.item.IsPrimary, true, "IsPrimary باید بولی ذخیره شود نه عدد");
});

test("مرز غیراصلی هم بولی ذخیره می‌شود", async () => {
  const r = await api("POST", `/api/com/system/${childId}/boundary${P}`, {
    body: { targetKind: "pid", targetRef: "PID-CHILD-1" },
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.item.IsPrimary, false);
});

test("مرز تکراری رد می‌شود", async () => {
  const { status, json } = await api("POST", `/api/com/system/${rootId}/boundary${P}`, {
    body: { targetKind: "wbs", targetRef: "WBS-1.2" },
    raw: true,
  });
  assert.equal(status, 409);
  assert.equal(json.error.code, "E-COM-DUP-BOUNDARY");
});

test("دو مرز اصلی برای یک سیستم رد می‌شود", async () => {
  const { status, json } = await api("POST", `/api/com/system/${rootId}/boundary${P}`, {
    body: { targetKind: "activity", targetRef: "ACT-9", isPrimary: true },
    raw: true,
  });
  assert.equal(status, 409);
  assert.equal(json.error.code, "E-COM-MULTI-PRIMARY");
});

test("نوع مرز نامعتبر ۴۲۲ می‌دهد", async () => {
  const { status, json } = await api("POST", `/api/com/system/${rootId}/boundary${P}`, {
    body: { targetKind: "excel", targetRef: "X" },
    raw: true,
  });
  assert.equal(status, 422);
  assert.equal(json.error.code, "E-COM-BOUNDARY-KIND");
});

test("پوشش مرز شکاف سیستم بدون مرز را نشان می‌دهد", async () => {
  const r = await api("GET", `/api/com/system/${packageId}/boundary${P}`);
  assert.equal(r.data.count, 0);
  assert.ok(r.data.coverage.gapsFa.some((g) => g.includes("هیچ مرزی")));
});

test("سیستمی که فقط نقشهٔ فرآیندی دارد شکاف بستهٔ کاری می‌گیرد", async () => {
  const r = await api("GET", `/api/com/system/${childId}/boundary${P}`);
  assert.equal(r.data.count, 1);
  assert.ok(r.data.coverage.gapsFa.some((g) => g.includes("بستهٔ کاری")));
});

/* ══════════════ تاریخ هدف دروازه ══════════════ */

test("ثبت تاریخ هدف تکمیل مکانیکی", async () => {
  const r = await api("POST", `/api/com/system/${rootId}/milestone${P}`, {
    body: { gateType: "mc", targetDate: "2026-03-01" },
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.item.gateFa, "تکمیل مکانیکی");
  assert.equal(r.data.replaced, false);
  assert.equal(r.data.slip.basis, "unknown");
});

test("دروازهٔ خارج از ترتیب زمانی رد می‌شود", async () => {
  const { status, json } = await api("POST", `/api/com/system/${rootId}/milestone${P}`, {
    body: { gateType: "rfsu", targetDate: "2026-01-01" },
    raw: true,
  });
  assert.equal(status, 409);
  assert.equal(json.error.code, "E-COM-GATE-SEQUENCE");
});

test("زنجیرهٔ کامل چهار دروازه ثبت می‌شود", async () => {
  for (const [gate, date] of [["rfsu", "2026-04-01"], ["pac", "2026-05-01"], ["fac", "2027-05-01"]]) {
    const r = await api("POST", `/api/com/system/${rootId}/milestone${P}`, { body: { gateType: gate, targetDate: date } });
    assert.equal(r.ok, true, `${gate}: ${JSON.stringify(r)}`);
  }
});

test("ثبت دوبارهٔ همان دروازه جایگزین می‌شود نه تکراری", async () => {
  const r = await api("POST", `/api/com/system/${rootId}/milestone${P}`, {
    body: { gateType: "mc", targetDate: "2026-03-01", forecastDate: "2026-03-21" },
  });
  assert.equal(r.data.replaced, true);
  assert.equal(r.data.slip.slipDays, 20);
  assert.equal(r.data.slip.basis, "forecast");
});

test("تاریخ واقعی بر پیش‌بینی اولویت دارد", async () => {
  const r = await api("POST", `/api/com/system/${rootId}/milestone${P}`, {
    body: { gateType: "mc", targetDate: "2026-03-01", actualDate: "2026-03-11" },
  });
  assert.equal(r.data.slip.slipDays, 10);
  assert.equal(r.data.slip.basis, "actual");
});

test("تاریخ نامعتبر ۴۲۲ می‌دهد", async () => {
  const { status, json } = await api("POST", `/api/com/system/${rootId}/milestone${P}`, {
    body: { gateType: "mc", targetDate: "1405/01/01" },
    raw: true,
  });
  assert.equal(status, 422);
  assert.equal(json.error.code, "E-COM-TARGET-DATE");
});

/* ══════════════ برنامه و ماتریس ══════════════ */

test("برنامهٔ تحویل خلاصه و اولویت را می‌دهد", async () => {
  const r = await api("GET", `/api/com/plan${P}`);
  assert.equal(r.ok, true);
  assert.equal(r.data.summary.total, 3);
  assert.equal(r.data.summary.maxDepth, 2);
  assert.equal(r.data.gates.length, 4);
  const root = r.data.plan.find((p) => p.systemCode === "U-100");
  assert.equal(root.gates.mc.actual, "2026-03-11");
  assert.equal(root.worstSlipDays, 10);
  assert.ok(r.data.priority.length === 3);
  assert.equal(r.data.priority[0].rank, 1);
});

test("سیستم بدون مرز و تاریخ در آمادگی پایین می‌ماند", async () => {
  const r = await api("GET", `/api/com/plan${P}`);
  const pkg = r.data.priority.find((p) => p.systemCode === "U-111");
  assert.equal(pkg.readinessPct, 0, "بسته نه مرز دارد نه تاریخ هدف");
  assert.equal(pkg.band, "hold");
  assert.equal(r.data.summary.withoutBoundary, 1, "فقط U-111 مرز ندارد");
  assert.equal(r.data.summary.withoutMilestone, 2, "U-110 و U-111 تاریخ هدف ندارند");
});

test("ماتریس سیستمی ستون فارسی و ترتیب درخت دارد", async () => {
  const r = await api("GET", `/api/com/matrix${P}`);
  assert.equal(r.ok, true);
  assert.equal(r.data.count, 3);
  assert.ok(r.data.columns.includes("هدف تحویل موقت"));
  assert.equal(r.data.rows[0]["کد"], "U-100");
  assert.equal(r.data.rows[0]["مرزها"], 1);
  assert.equal(r.data.rows[0]["بدترین لغزش"], "10 روز");
  assert.equal(r.data.rows[2]["سطح"], 3);
});

/* ══════════════ جداسازی پروژه و دسترسی ══════════════ */

test("پروژهٔ دیگر داده‌های این پروژه را نمی‌بیند", async () => {
  const r = await api("GET", "/api/com/system?projectId=com-p2");
  assert.equal(r.data.count, 1);
  assert.equal(r.data.items[0].SystemCode, "X-1");
});

test("بدون projectId خطا می‌دهد", async () => {
  const { status, json } = await api("GET", "/api/com/system", { raw: true });
  assert.equal(status, 400);
  assert.equal(json.error.code, "E-CNT-NO-PROJECT");
});

test("کاربر بدون مجوز ویرایش رد می‌شود", async () => {
  const { status } = await api("POST", `/api/com/system${P}`, {
    body: { systemCode: "U-777", titleFa: "غیرمجاز", systemType: "system" },
    user: "u-client",
    raw: true,
  });
  assert.equal(status, 403);
});

test("گواهی موجود پس از افزودن ستون سیستم همچنان کار می‌کند", async () => {
  const r = await api("GET", `/api/com/certificate${P}`, { user: "u-client" });
  assert.equal(r.ok, true, "اندپوینت گواهی نباید بشکند");
});
