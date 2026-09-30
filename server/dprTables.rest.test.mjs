/** جداول پشتیبان گزارش روزانه (dprt-v1) روی سرور واقعی.
 *
 * سؤال محوری: گزارش کامل ذخیره و بازگردانده می‌شود، سابقهٔ تجمعی از
 * روزهای قبل می‌آید، گزارش ارسال/تأییدشده قفل می‌شود، ورودی بد ۴۰۰
 * می‌گیرد و داده پس از راه‌اندازی دوبارهٔ سرور باقی می‌ماند؟
 *
 * ایزوله مثل dprDoc: سرور جدا روی پورت جدا با DATA_DIR موقت.
 */
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const PORT = 4751;
const BASE = `http://localhost:${PORT}`;
const PC = "PC-TEST-1";

let child = null;
let dataDir = null;

async function startServer() {
  child = spawn(process.execPath, ["server/index.js"], {
    env: { ...process.env, PORT: String(PORT), PERSIST_DRIVER: "json", DATA_DIR: dataDir },
    stdio: "ignore",
  });
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${BASE}/api/dpr/tables/health`, { signal: AbortSignal.timeout(1000) });
      if (r.ok) return;
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
  dataDir = await mkdtemp(path.join(tmpdir(), "dprt-data-"));
  await startServer();
});

after(async () => {
  await stopServer();
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
});

const enc = encodeURIComponent;
const get = (p) => fetch(`${BASE}${p}`).then(async (r) => ({ status: r.status, body: await r.json() }));
const put = (p, data) =>
  fetch(`${BASE}${p}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(
    async (r) => ({ status: r.status, body: await r.json() }),
  );
const post = (p, data) =>
  fetch(`${BASE}${p}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(
    async (r) => ({ status: r.status, body: await r.json() }),
  );

function shell(date, reportNo) {
  return {
    projectCode: PC,
    reportDate: date,
    reportNo,
    status: "draft",
    site: { reportDate: date, reportNo, siteStatus: "Active", weather: "Sunny", humidity: 20, avgTemp: 38 },
    narrative: { siteActivities: "بتن‌ریزی", workFront: "فونداسیون", areaOfConcerns: "" },
    manpower: { "MP-001": { pd: 3, ad: 1, pn: 0, an: 0 } },
    machinery: { "MC-003": { active: 2, ready: 1, repair: 0, owner: "پیمانکار" } },
    changes: [{ date, refId: "CO-1", location: "A", unit: "M3", discipline: "Civil", activity: "خاکبرداری", totalQty: 2000, thisQty: 120, contractor: "", opsFa: "شرح", noteFa: "" }],
    activities: [{ acCode: "OP16-A-1004", subPhase: "", dis: "", area: "", workPackage: "", subPackage: "", activity: "بتن", unit: "M3", estimated: 2000, todayQty: 120, startDate: "", endDate: "", executor: "", note: "" }],
  };
}

test("dprt-rest: سلامت ماژول و نسخه", async () => {
  const { status, body } = await get("/api/dpr/tables/health");
  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.data.version, "dprt-v1");
});

test("dprt-rest: گزارش ناموجود ← پوسته + پیشنهاد خالی", async () => {
  const { status, body } = await get(`/api/dpr/projects/${PC}/reports/${enc("1403/08/26")}`);
  assert.equal(status, 200);
  assert.equal(body.data.exists, false);
  assert.equal(body.data.report.reportDate, "1403/08/26");
  assert.equal(body.data.suggestedNo, "");
  assert.deepEqual(body.data.history, { changes: {}, activities: {} });
});

test("dprt-rest: تاریخ و پروژهٔ بد ← ۴۰۰", async () => {
  const badDate = await get(`/api/dpr/projects/${PC}/reports/${enc("2026-09-30")}`);
  assert.equal(badDate.status, 400);
  const badPc = await get(`/api/dpr/projects/${enc("../x")}/reports`);
  assert.equal(badPc.status, 400);
});

test("dprt-rest: ذخیره و بازخوانی همان داده", async () => {
  const saved = await put(`/api/dpr/projects/${PC}/reports/${enc("1403/08/26")}`, shell("1403/08/26", "DRT-171"));
  assert.equal(saved.status, 200);
  assert.equal(saved.body.data.report.reportNo, "DRT-171");
  assert.equal(saved.body.data.report.site.avgTemp, 38);
  const again = await get(`/api/dpr/projects/${PC}/reports/${enc("1403/08/26")}`);
  assert.equal(again.body.data.exists, true);
  assert.equal(again.body.data.report.manpower["MP-001"].pd, 3);
  assert.equal(again.body.data.report.machinery["MC-003"].active, 2);
});

test("dprt-rest: اعتبارسنجی سرور (کد ناشناخته و عدد منفی)", async () => {
  const bad = shell("1403/08/26", "DRT-171");
  bad.manpower = { "MP-999": { pd: 1, ad: 0, pn: 0, an: 0 } };
  const r1 = await put(`/api/dpr/projects/${PC}/reports/${enc("1403/08/26")}`, bad);
  assert.equal(r1.status, 400);
  assert.equal(r1.body.error.code, "E-DPRT-VALIDATION");
  const bad2 = shell("1403/08/26", "DRT-171");
  bad2.machinery = { "MC-001": { active: -2, ready: 0, repair: 0, owner: "" } };
  const r2 = await put(`/api/dpr/projects/${PC}/reports/${enc("1403/08/26")}`, bad2);
  assert.equal(r2.status, 400);
});

test("dprt-rest: سابقهٔ تجمعی و پیشنهاد سریال روز بعد", async () => {
  const next = await get(`/api/dpr/projects/${PC}/reports/${enc("1403/08/27")}`);
  assert.equal(next.body.data.exists, false);
  assert.equal(next.body.data.suggestedNo, "DRT-172");
  assert.equal(next.body.data.history.changes["CO-1"], 120);
  const key = "OP16-A-1004‖بتن";
  assert.equal(next.body.data.history.activities[key], 120);
});

test("dprt-rest: ارسال ← قفل ویرایش؛ برگشت ← باز شدن", async () => {
  const s = await post(`/api/dpr/projects/${PC}/reports/${enc("1403/08/26")}/actions`, { action: "submit" });
  assert.equal(s.status, 200);
  assert.equal(s.body.data.status, "submitted");
  const locked = await put(`/api/dpr/projects/${PC}/reports/${enc("1403/08/26")}`, shell("1403/08/26", "DRT-171"));
  assert.equal(locked.status, 409);
  assert.equal(locked.body.error.code, "E-DPRT-LOCKED");
  const back = await post(`/api/dpr/projects/${PC}/reports/${enc("1403/08/26")}/actions`, { action: "return" });
  assert.equal(back.body.data.status, "draft");
  const ok = await put(`/api/dpr/projects/${PC}/reports/${enc("1403/08/26")}`, shell("1403/08/26", "DRT-171"));
  assert.equal(ok.status, 200);
});

test("dprt-rest: تأیید نهایی و گذار نامجاز", async () => {
  await post(`/api/dpr/projects/${PC}/reports/${enc("1403/08/26")}/actions`, { action: "submit" });
  const a = await post(`/api/dpr/projects/${PC}/reports/${enc("1403/08/26")}/actions`, { action: "approve" });
  assert.equal(a.body.data.status, "approved");
  const bad = await post(`/api/dpr/projects/${PC}/reports/${enc("1403/08/26")}/actions`, { action: "return" });
  assert.equal(bad.status, 409);
  const list = await get(`/api/dpr/projects/${PC}/reports`);
  assert.equal(list.body.data.length, 1);
  assert.equal(list.body.data[0].status, "approved");
});

test("dprt-rest: ماندگاری پس از راه‌اندازی دوباره", async () => {
  await stopServer();
  await startServer();
  const again = await get(`/api/dpr/projects/${PC}/reports/${enc("1403/08/26")}`);
  assert.equal(again.body.data.exists, true);
  assert.equal(again.body.data.report.status, "approved");
  assert.equal(again.body.data.report.reportNo, "DRT-171");
});
