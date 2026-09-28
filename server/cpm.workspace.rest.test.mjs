/**
 * P7 CPMS — میز کار ساخت و اجرا (d2/d8) روی سرور واقعی (درایور JSON).
 *
 * سؤال محوری: حوزهٔ کاری پیمانکار، گزارش روزانه با پیوست واقعی، گزارش‌های
 * دیسیپلینی و درخواست بازرسی/آزادسازی QC واقعاً ذخیره می‌شوند و پس از
 * راه‌اندازی دوباره می‌مانند؟ و کنترل‌های سمت سرور اجرا می‌شوند؟ —
 * مجوز و دامنهٔ پروژه، عرضهٔ متقاطع WBS/پیمانکار/فعالیت، سقف وزن WBS،
 * قفل گردش‌کار، تفکیک وظیفه در تأیید و آزادسازی (SOD)، اعتبارسنجی موتور
 * و بسته بودن CRUD عمومی روی جدول‌های CPMS.
 *
 * اجرا با پوشهٔ داده و فضای فایل جداگانه؛ به rundata کاربر دست نمی‌زند.
 */
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRepository, JsonFileDriver } from "./persistence/driver.mjs";

const PORT = 4745;
const BASE = `http://127.0.0.1:${PORT}`;
const PID = "c1-p1";
const OTHER = "c1-p2";
const TAG = `P7${Date.now().toString(36).toUpperCase()}`;
const code = (n) => `${TAG}-${n}`;
const WBS = code("WBS");
const WBS2 = code("WBS2");
const SUB = code("SUB");
const ACT = code("ACT");
const SOD_ACT = code("SODACT");
const WA = code("WA");
const SOD_DPR = code("SODDPR");
const SOD_IR = code("SODIR");

let child = null;
let dataDir = null;
let storageDir = null;
const repo = () => createRepository(new JsonFileDriver(dataDir));

async function startServer() {
  child = spawn(process.execPath, ["server/index.js"], {
    env: { ...process.env, PORT: String(PORT), PERSIST_DRIVER: "json", DATA_DIR: dataDir, FILE_STORAGE_PATH: storageDir },
    stdio: "ignore",
  });
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(1000) });
      if (r.status < 500 || r.status === 503) return;
    } catch { /* هنوز بالا نیامده */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("سرور آزمون CPMS بالا نیامد");
}
async function stopServer() {
  if (!child) return;
  const exited = new Promise((r) => child.once("exit", r));
  child.kill("SIGTERM");
  await exited;
  child = null;
}

before(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), "cpmws-data-"));
  storageDir = await mkdtemp(path.join(tmpdir(), "cpmws-files-"));
  /* ردیف‌های تاریخی/خودنوشته: تفکیک وظیفه باید از خود موتور بیاید، نه فقط
     از نبود مجوز نقش. */
  const r = repo();
  const activity = { ProjectId: PID, NameFa: "فعالیت پایه", Discipline: "piping", PlannedStart: "2026-09-01", PlannedFinish: "2026-09-30", PhysicalPct: 0, IsCritical: false };
  await r.create("Activity", { ...activity, Code: SOD_ACT }, "u-planner");
  await r.create("CpmDprEntry", {
    ProjectId: PID, ReportNo: SOD_DPR, ReportDate: "2026-09-20", Shift: "day", ContractorCode: SUB, Discipline: "piping",
    LocationFa: "کارگاه", ManpowerCount: 3, WorkDoneFa: "کار پایه", Status: "submitted", SubmittedAt: "2026-09-20T06:00:00.000Z", SubmittedBy: "u-pmo",
    ModelVersion: "cpm-cpms-v1",
  }, "u-pmo", "cpmdpr");
  await r.create("CpmInspectionRequest", {
    ProjectId: PID, RequestNo: SOD_IR, RequestType: "ir", ActivityCode: SOD_ACT, Discipline: "piping", ContractorCode: SUB,
    LocationFa: "کارگاه", ScopeFa: "بازرسی پایه", RequestedAt: "2026-09-20", WitnessRequired: false, Status: "submitted",
    RequestedBy: "u-qc", SubmittedAt: "2026-09-20T06:00:00.000Z", SubmittedBy: "u-qc", ModelVersion: "cpm-cpms-v1",
  }, "u-qc", "cpmir");
  await startServer();
});

after(async () => {
  await stopServer();
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
  if (storageDir) await rm(storageDir, { recursive: true, force: true });
});

async function call(method, p, { user, body, project = PID } = {}) {
  const res = await fetch(`${BASE}/api/cpm/${project}${p}`, {
    method,
    headers: { "content-type": "application/json", ...(user ? { "x-user-id": user } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}
const ws = async (user = "u-pm", project = PID) => (await call("GET", "/workspace", { user, project })).body.data;
const err = (r) => r.body?.error?.code;

const workAreaBody = (over = {}) => ({ Code: WA, WbsCode: WBS, ContractorCode: SUB, Discipline: "piping", ScopeFa: "اجرای خطوط واحد ۱۰۰", WeightPct: 30, ...over });
const dprBody = (no, over = {}) => ({ ReportNo: no, ReportDate: "2026-09-20", Shift: "day", ContractorCode: SUB, Discipline: "piping", WorkAreaCode: WA, LocationFa: "واحد ۱۰۰", ManpowerCount: 12, WorkDoneFa: "۱۵ جوش و ۳ فیت‌آپ", ...over });
const irBody = (no, over = {}) => ({ RequestNo: no, RequestType: "ir", ActivityCode: ACT, Discipline: "piping", ContractorCode: SUB, LocationFa: "خط ۱۴", ScopeFa: "بازرسی جوش W-001", RequestedAt: "2026-09-20", TargetDate: "2026-09-23", WitnessRequired: true, ...over });

test("مجوز و دامنهٔ پروژه: بدون کاربر ۴۰۱، خارج از نقش ۴۰۳، نقش‌بندی میز کار درست است", async () => {
  assert.equal((await call("GET", "/workspace")).status, 401);
  assert.equal((await call("GET", "/workspace", { user: "u-left" })).status, 401);
  assert.equal((await call("GET", "/workspace", { user: "u-admin" })).status, 403);
  assert.equal((await call("GET", "/workspace", { user: "u-auditor" })).status, 403);
  // u-site فقط c1-p1 را می‌بیند؛ درخواست پروژهٔ دیگر ۴۰۳ است.
  assert.equal((await call("GET", "/workspace", { user: "u-site", project: OTHER })).status, 403);
  const qc = await ws("u-qc");
  assert.equal(qc.can.inspectionRelease, true);
  assert.equal(qc.can.inspectionRequest, false);
  assert.equal(qc.can.dprRecord, false);
  const site = await ws("u-site");
  assert.deepEqual(site.can, { workAreaEdit: false, dprRecord: true, dprApprove: false, disciplineRecord: true, disciplineApprove: false, inspectionRequest: true, inspectionRelease: false });
  const pmo = await ws("u-pmo");
  assert.equal(pmo.can.workAreaEdit, true);
  assert.equal(pmo.can.inspectionRelease, false);
});

test("CRUD عمومی روی جدول‌های CPMS بسته است — فقط مسیر اختصاصی", async () => {
  for (const table of ["CpmWorkArea", "CpmDprEntry", "CpmDisciplineReport", "CpmDisciplineLine", "CpmInspectionRequest", "CpmDprAttachment"]) {
    for (const user of ["u-admin", "u-pm"]) {
      const r = await fetch(`${BASE}/api/data/${table}`, { headers: { "x-user-id": user } });
      assert.equal(r.status, 403, `${table} برای ${user}`);
      assert.equal((await r.json()).error.code, "TABLE_HAS_DEDICATED_API", table);
    }
  }
});

test("CPM-1: تخصیص WBS به پیمانکار با عرضهٔ متقاطع، سقف وزن و تکرار", async () => {
  // زمینهٔ آزمون از مسیرهای رسمی ساخته می‌شود.
  const wbs = await fetch(`${BASE}/api/data/WbsNode`, { method: "POST", headers: { "content-type": "application/json", "x-user-id": "u-planner" }, body: JSON.stringify({ ProjectId: PID, Code: WBS, NameFa: "واحد ۱۰۰", Level: 2 }) });
  assert.equal(wbs.status, 201);
  const wbs2 = await fetch(`${BASE}/api/data/WbsNode`, { method: "POST", headers: { "content-type": "application/json", "x-user-id": "u-planner" }, body: JSON.stringify({ ProjectId: PID, Code: WBS2, NameFa: "واحد ۲۰۰", Level: 2 }) });
  assert.equal(wbs2.status, 201);
  await fetch(`${BASE}/api/data/Activity`, { method: "POST", headers: { "content-type": "application/json", "x-user-id": "u-planner" }, body: JSON.stringify({ ProjectId: PID, Code: ACT, NameFa: "جوشکاری خط ۱۴", Discipline: "piping", PlannedStart: "2026-09-01", PlannedFinish: "2026-09-30" }) });
  const sub = await fetch(`${BASE}/api/hrm/subcontracts?projectId=${PID}`, { method: "POST", headers: { "content-type": "application/json", "x-user-id": "u-contracts" }, body: JSON.stringify({ contractNo: SUB, contractorName: "پیمانکار آزمون CPMS", startDate: "2026-01-01", endDate: "2026-12-31" }) });
  assert.equal(sub.status, 201, JSON.stringify(await sub.clone().json()));

  const created = await call("POST", "/work-areas", { user: "u-pmo", body: workAreaBody() });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.data.ProjectId, PID);            // پروژه از مسیر می‌آید، نه بدنه
  assert.equal(created.body.data.CreatedBy, "u-pmo");
  assert.equal(created.body.data.ModelVersion, "cpm-cpms-v1");
  assert.equal(created.body.data.Status, "planned");
  assert.equal(created.body.data.RowVersion, 1);

  assert.equal((await call("POST", "/work-areas", { user: "u-site", body: workAreaBody({ Code: code("WA-NA") }) })).status, 403);
  assert.equal(err(await call("POST", "/work-areas", { user: "u-pmo", body: workAreaBody({ Code: code("WA-BAD"), WbsCode: code("NOPE") }) })), "E-CPM-WBS");
  assert.equal(err(await call("POST", "/work-areas", { user: "u-pmo", body: workAreaBody({ Code: code("WA-BAD"), ContractorCode: code("NOPE") }) })), "E-CPM-CONTRACTOR");
  assert.equal(err(await call("POST", "/work-areas", { user: "u-pmo", body: workAreaBody({ Code: code("WA-BAD"), Discipline: "mech" }) })), "E-CPM-VALIDATION");
  // سقف ۱۰۰٪ در سطح هر WBS: ۳۰ + ۸۰ = ۱۱۰
  assert.equal(err(await call("POST", "/work-areas", { user: "u-pmo", body: workAreaBody({ Code: code("WA-OV"), WeightPct: 80 }) })), "E-CPM-WEIGHT");
  assert.equal(err(await call("POST", "/work-areas", { user: "u-pmo", body: workAreaBody() })), "E-CPM-DUPLICATE");
  // وزن در WBS دیگر سقف را مصرف نمی‌کند.
  assert.equal((await call("POST", "/work-areas", { user: "u-planner", body: workAreaBody({ Code: code("WA2"), WbsCode: WBS2, WeightPct: 90 }) })).status, 201);
});

test("CPM-1: ویرایش نسخه‌دار، قفل حذف با DPR گره‌خورده و بستن با درخواست بازرسی باز", async () => {
  assert.equal(err(await call("PATCH", `/work-areas/${WA}`, { user: "u-pmo", body: { Status: "active" } })), "E-CPM-VERSION");
  assert.equal(err(await call("PATCH", `/work-areas/${WA}`, { user: "u-pmo", body: { Status: "active", RowVersion: 99 } })), "E-CPM-VERSION");
  assert.equal((await call("PATCH", `/work-areas/${WA}`, { user: "u-site", body: { Status: "active", RowVersion: 1 } })).status, 403);
  const active = await call("PATCH", `/work-areas/${WA}`, { user: "u-pmo", body: { Status: "active", RowVersion: 1 } });
  assert.equal(active.status, 200, JSON.stringify(active.body));
  assert.equal(active.body.data.Status, "active");
  assert.equal(active.body.data.RowVersion, 2);
  // جابه‌جایی به WBS ناموجود ممنوع است.
  assert.equal(err(await call("PATCH", `/work-areas/${WA}`, { user: "u-pmo", body: { WbsCode: code("NOPE"), RowVersion: 2 } })), "E-CPM-WBS");
  // پروژهٔ دیگر همان کد را نمی‌بیند (PMO دامنهٔ همه‌پروژه دارد، پس ۴۰۴ می‌گیرد نه ۴۰۳).
  assert.equal((await call("PATCH", `/work-areas/${WA}`, { user: "u-pmo", project: OTHER, body: { Status: "closed", RowVersion: 2 } })).status, 404);
  const dpr = await call("POST", "/dpr", { user: "u-site", body: dprBody(code("DPR-WA")) });
  assert.equal(dpr.status, 201, JSON.stringify(dpr.body));
  assert.equal(err(await call("DELETE", `/work-areas/${WA}`, { user: "u-pmo" })), "E-CPM-IN-USE");
  assert.equal((await call("DELETE", `/work-areas/${code("WA2")}`, { user: "u-site" })).status, 403);
  assert.equal((await call("DELETE", `/work-areas/${code("WA2")}`, { user: "u-planner" })).status, 200);
});

test("CPM-2: گزارش روزانه همیشه پیش‌نویس، جعل‌ناپذیر و نسخه‌دار است", async () => {
  const no = code("DPR1");
  assert.equal(err(await call("POST", "/dpr", { user: "u-qc", body: dprBody(no) })), "E-CPM-FORBIDDEN");
  assert.equal(err(await call("POST", "/dpr", { user: "u-site", body: dprBody(no, { Status: "approved" }) })), "E-CPM-STATE");
  assert.equal(err(await call("POST", "/dpr", { user: "u-site", body: dprBody(no, { ProjectId: OTHER }) })), "E-CPM-FIELD");
  assert.equal(err(await call("POST", "/dpr", { user: "u-site", body: dprBody(no, { ReportDate: "2099-01-01" }) })), "E-CPM-VALIDATION");
  assert.equal(err(await call("POST", "/dpr", { user: "u-site", body: dprBody(no, { WorkAreaCode: code("NOPE") }) })), "E-CPM-WORKAREA");
  const created = await call("POST", "/dpr", { user: "u-site", body: dprBody(no) });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.data.Status, "draft");
  assert.equal(created.body.data.CreatedBy, "u-site");
  assert.equal(created.body.data.ModelVersion, "cpm-cpms-v1");
  assert.equal(err(await call("POST", "/dpr", { user: "u-site", body: dprBody(no) })), "E-CPM-DUPLICATE");
  // پیش‌نویس قابل اصلاح است و نسخه اجباری است.
  assert.equal(err(await call("PATCH", `/dpr/${no}`, { user: "u-site", body: { LocationFa: "واحد ۲۰۰" } })), "E-CPM-VERSION");
  const patched = await call("PATCH", `/dpr/${no}`, { user: "u-site", body: { LocationFa: "واحد ۲۰۰", RowVersion: 1 } });
  assert.equal(patched.status, 200);
  assert.equal(patched.body.data.LocationFa, "واحد ۲۰۰");
  // پس از ارسال قفل می‌شود و تأییدکننده نباید ثبت‌کننده باشد.
  assert.equal((await call("POST", `/dpr/${no}/transition`, { user: "u-site", body: { action: "submit" } })).body.data.Status, "submitted");
  assert.equal(err(await call("PATCH", `/dpr/${no}`, { user: "u-site", body: { LocationFa: "x", RowVersion: 2 } })), "E-CPM-LOCKED");
  assert.equal(err(await call("POST", `/dpr/${no}/transition`, { user: "u-site", body: { action: "approve" } })), "E-CPM-FORBIDDEN");
  const approved = await call("POST", `/dpr/${no}/transition`, { user: "u-pm", body: { action: "approve" } });
  assert.equal(approved.status, 200, JSON.stringify(approved.body));
  assert.equal(approved.body.data.Status, "approved");
  assert.equal(approved.body.data.ApprovedBy, "u-pm");
  assert.equal(err(await call("POST", `/dpr/${no}/transition`, { user: "u-pm", body: { action: "approve" } })), "E-CPM-STATE");
});

test("CPM-2: برگشت گزارش با دلیل و اصلاح پس از برگشت", async () => {
  const no = code("DPR2");
  assert.equal((await call("POST", "/dpr", { user: "u-site", body: dprBody(no) })).status, 201);
  await call("POST", `/dpr/${no}/transition`, { user: "u-site", body: { action: "submit" } });
  assert.equal(err(await call("POST", `/dpr/${no}/transition`, { user: "u-pmo", body: { action: "return" } })), "E-CPM-NOTE");
  const returned = await call("POST", `/dpr/${no}/transition`, { user: "u-pmo", body: { action: "return", note: "نفرات با تایم‌شیت نمی‌خواند" } });
  assert.equal(returned.status, 200);
  assert.equal(returned.body.data.Status, "returned");
  assert.match(returned.body.data.ReturnNoteFa, /تایم‌شیت/);
  const fixed = await call("PATCH", `/dpr/${no}`, { user: "u-site", body: { ManpowerCount: 9, RowVersion: returned.body.data.RowVersion } });
  assert.equal(fixed.status, 200);
  assert.equal((await call("POST", `/dpr/${no}/transition`, { user: "u-site", body: { action: "submit" } })).body.data.Status, "submitted");
});

test("CPM-2: پیوست واقعی با چکسام، دانلود، نوع مجاز و قفل گزارش تأییدشده", async () => {
  const no = code("DPR3");
  await call("POST", "/dpr", { user: "u-site", body: dprBody(no) });
  const payload = "CPM evidence payload\n";
  const upload = await fetch(`${BASE}/api/cpm/${PID}/dpr/${no}/attachments`, {
    method: "POST",
    headers: { "x-user-id": "u-site" },
    body: (() => { const fd = new FormData(); fd.append("file", new Blob([payload], { type: "text/plain" }), "evidence.txt"); fd.append("kind", "photo"); return fd; })(),
  });
  assert.equal(upload.status, 201, JSON.stringify(await upload.clone().json()));
  const att = (await upload.json()).data;
  assert.equal(att.Kind, "photo");
  assert.equal(att.SizeBytes, payload.length);
  assert.match(att.Checksum, /^sha256-[0-9a-f]{32}$/);
  assert.ok(att.StoredName && !att.StoredName.includes("/"));
  const bad = await fetch(`${BASE}/api/cpm/${PID}/dpr/${no}/attachments`, {
    method: "POST",
    headers: { "x-user-id": "u-site" },
    body: (() => { const fd = new FormData(); fd.append("file", new Blob(["PK"], { type: "application/zip" }), "x.zip"); return fd; })(),
  });
  assert.equal(bad.status, 400);
  assert.equal((await bad.json()).error.code, "E-CPM-FILE-TYPE");
  const qcUpload = await fetch(`${BASE}/api/cpm/${PID}/dpr/${no}/attachments`, {
    method: "POST",
    headers: { "x-user-id": "u-qc" },
    body: (() => { const fd = new FormData(); fd.append("file", new Blob([payload], { type: "text/plain" }), "e.txt"); return fd; })(),
  });
  assert.equal(qcUpload.status, 403);
  const list = await call("GET", `/dpr/${no}/attachments`, { user: "u-qc" });
  assert.equal(list.status, 200);
  assert.equal(list.body.data.items.length, 1);
  const download = await fetch(`${BASE}/api/cpm/${PID}/dpr/${no}/attachments/${att.Id}/download`, { headers: { "x-user-id": "u-qc" } });
  assert.equal(download.status, 200);
  assert.equal(await download.text(), payload);
  // گزارش تأییدشده پیوستش حذف نمی‌شود.
  await call("POST", `/dpr/${no}/transition`, { user: "u-site", body: { action: "submit" } });
  await call("POST", `/dpr/${no}/transition`, { user: "u-pm", body: { action: "approve" } });
  assert.equal(err(await call("DELETE", `/dpr/${no}/attachments/${att.Id}`, { user: "u-site" })), "E-CPM-LOCKED");
  // گزارش پیش‌نویس دیگر: حذف پیوست واقعی انجام می‌شود.
  const no2 = code("DPR4");
  await call("POST", "/dpr", { user: "u-site", body: dprBody(no2) });
  const up2 = await fetch(`${BASE}/api/cpm/${PID}/dpr/${no2}/attachments`, {
    method: "POST",
    headers: { "x-user-id": "u-site" },
    body: (() => { const fd = new FormData(); fd.append("file", new Blob([payload], { type: "text/plain" }), "e2.txt"); return fd; })(),
  });
  const att2 = (await up2.json()).data;
  assert.equal((await call("DELETE", `/dpr/${no2}/attachments/${att2.Id}`, { user: "u-site" })).status, 200);
  assert.equal((await call("GET", `/dpr/${no2}/attachments/${att2.Id}/download`, { user: "u-site" })).status, 404);
});

test("CPM-3: اعتبار آیتم‌های دیسیپلینی و شاخص‌های محاسبه‌شده", async () => {
  const piping = await call("POST", "/discipline-reports", {
    user: "u-site",
    body: {
      ReportNo: code("DR1"), ReportDate: "2026-09-20", Discipline: "piping", ContractorCode: SUB, WorkAreaCode: WA,
      Lines: [
        { ItemRef: "F-001", ItemType: "fitup", SizeInch: 14, Quantity: 3 },
        { ItemRef: "W-001", ItemType: "weld", SizeInch: 14, Quantity: 15 },
        { ItemRef: "N-001", ItemType: "ndt", SizeInch: 14, Quantity: 2, ResultCode: "ok", NdtMethod: "RT", TestDate: "2026-09-19" },
        { ItemRef: "P-001", ItemType: "pwht", Quantity: 4 },
      ],
    },
  });
  assert.equal(piping.status, 201, JSON.stringify(piping.body));
  assert.equal(piping.body.data.LineCount, 4);
  assert.equal(piping.body.data.RejectedCount, 0);
  assert.equal(piping.body.data.NdtPassRate, 1);
  assert.equal(piping.body.data.Lines.length, 4);
  // واژهٔ نامرتبط با دیسیپلین سیویل پذیرفته نمی‌شود.
  assert.equal(err(await call("POST", "/discipline-reports", { user: "u-site", body: { ReportNo: code("DR-BAD"), ReportDate: "2026-09-20", Discipline: "civil", ContractorCode: SUB, Lines: [{ ItemRef: "X-1", ItemType: "weld", Quantity: 1 }] } })), "E-CPM-VALIDATION");
  // روش NDT فقط برای آیتم ndt معنا دارد.
  assert.equal(err(await call("POST", "/discipline-reports", { user: "u-site", body: { ReportNo: code("DR-BAD"), ReportDate: "2026-09-20", Discipline: "piping", ContractorCode: SUB, Lines: [{ ItemRef: "W-9", ItemType: "weld", SizeInch: 10, Quantity: 1, NdtMethod: "RT" }] } })), "E-CPM-VALIDATION");
  // رد بدون دلیل ثبت نمی‌شود؛ با دلیل، نرخ قبولی NDT صفر می‌شود.
  assert.equal(err(await call("POST", "/discipline-reports", { user: "u-site", body: { ReportNo: code("DR-BAD"), ReportDate: "2026-09-20", Discipline: "piping", ContractorCode: SUB, Lines: [{ ItemRef: "N-9", ItemType: "ndt", SizeInch: 10, Quantity: 1, ResultCode: "rejected", NdtMethod: "UT" }] } })), "E-CPM-VALIDATION");
  const rejected = await call("POST", "/discipline-reports", {
    user: "u-site",
    body: { ReportNo: code("DR2"), ReportDate: "2026-09-20", Discipline: "electrical", ContractorCode: SUB, Lines: [{ ItemRef: "M-1", ItemType: "megger", Quantity: 2, ResultCode: "rejected", NoteFa: "عایقی پایین؛ کابل تعویض می‌شود" }] },
  });
  assert.equal(rejected.status, 201);
  assert.equal(rejected.body.data.RejectedCount, 1);
  assert.equal(rejected.body.data.NdtPassRate, null); // داده‌ای برای NDT نیست → نامعلوم، نه صفر
  // جانشینی خطوط: نبود Lines یعنی دست‌نزدن به خطوط موجود.
  const kept = await call("PATCH", `/discipline-reports/${code("DR1")}`, { user: "u-site", body: { NoteFa: "بازبینی سربرگ", RowVersion: 1 } });
  assert.equal(kept.status, 200, JSON.stringify(kept.body));
  assert.equal(kept.body.data.Lines.length, 4);
  const replaced = await call("PATCH", `/discipline-reports/${code("DR1")}`, { user: "u-site", body: { RowVersion: kept.body.data.RowVersion, Lines: [{ ItemRef: "W-001", ItemType: "weld", SizeInch: 14, Quantity: 10 }] } });
  assert.equal(replaced.status, 200);
  assert.equal(replaced.body.data.LineCount, 1);
  assert.equal(replaced.body.data.NdtPassRate, null);
});

test("CPM-3: گردش‌کار گزارش دیسیپلینی و قفل پس از تأیید", async () => {
  const no = code("DR3");
  await call("POST", "/discipline-reports", { user: "u-site", body: { ReportNo: no, ReportDate: "2026-09-20", Discipline: "instrument", ContractorCode: SUB, Lines: [{ ItemRef: "L-1", ItemType: "loop_check", Quantity: 1, ResultCode: "ok" }] } });
  assert.equal(err(await call("POST", `/discipline-reports/${no}/transition`, { user: "u-qc", body: { action: "submit" } })), "E-CPM-FORBIDDEN");
  assert.equal((await call("POST", `/discipline-reports/${no}/transition`, { user: "u-site", body: { action: "submit" } })).body.data.Status, "submitted");
  assert.equal(err(await call("POST", `/discipline-reports/${no}/transition`, { user: "u-pm", body: { action: "return" } })), "E-CPM-NOTE");
  const approved = await call("POST", `/discipline-reports/${no}/transition`, { user: "u-pm", body: { action: "approve" } });
  assert.equal(approved.status, 200);
  assert.equal(approved.body.data.ApprovedBy, "u-pm");
  const locked = await call("PATCH", `/discipline-reports/${no}`, { user: "u-site", body: { NoteFa: "اصلاح دیرهنگام", RowVersion: approved.body.data.RowVersion } });
  assert.equal(err(locked), "E-CPM-LOCKED");
  // گزارش در پروژهٔ دیگر دیده نمی‌شود.
  const other = await ws("u-pm", OTHER);
  assert.equal(other.reports.some((x) => x.ReportNo === no), false);
});

test("CPM-4: درخواست بازرسی، اعلان ۴۸ ساعته، آزادسازی QC و سند InspectionRecord", async () => {
  const no = code("IR1");
  assert.equal(err(await call("POST", "/inspections", { user: "u-qc", body: irBody(no) })), "E-CPM-FORBIDDEN");
  assert.equal(err(await call("POST", "/inspections", { user: "u-site", body: irBody(no, { ActivityCode: code("NOPE") }) })), "E-CPM-ACTIVITY");
  assert.equal(err(await call("POST", "/inspections", { user: "u-site", body: irBody(no, { TargetDate: "2026-09-19" }) })), "E-CPM-VALIDATION");
  const created = await call("POST", "/inspections", { user: "u-site", body: irBody(no, { WorkAreaCode: WA }) });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.deepEqual(created.body.data.notice, { status: "ok", hours: 72 });
  assert.equal(created.body.data.RequestedBy, "u-site");
  assert.equal(err(await call("POST", "/inspections", { user: "u-site", body: irBody(no, { WorkAreaCode: WA }) })), "E-CPM-DUPLICATE");
  // قبل از ارسال، آزادسازی معنا ندارد.
  assert.equal(err(await call("POST", `/inspections/${no}/transition`, { user: "u-qc", body: { action: "release" } })), "E-CPM-VALIDATION");
  assert.equal((await call("POST", `/inspections/${no}/transition`, { user: "u-site", body: { action: "submit" } })).body.data.Status, "submitted");
  // درخواست باز، بستن حوزهٔ کاری را قفل می‌کند.
  const waRow = (await ws("u-pmo")).workAreas.find((w) => w.Code === WA);
  assert.equal(err(await call("PATCH", `/work-areas/${WA}`, { user: "u-pmo", body: { Status: "closed", RowVersion: waRow.RowVersion } })), "E-CPM-OPEN-INSPECTIONS");
  assert.equal(err(await call("POST", `/inspections/${no}/transition`, { user: "u-site", body: { action: "release" } })), "E-CPM-FORBIDDEN");
  const released = await call("POST", `/inspections/${no}/transition`, { user: "u-qc", body: { action: "release", note: "مطابق ITP" } });
  assert.equal(released.status, 200, JSON.stringify(released.body));
  assert.equal(released.body.data.Status, "released");
  assert.equal(released.body.data.ReleasedBy, "u-qc");
  assert.ok(released.body.data.InspectionRecordId);
  // آزادسازی، قفل بستن حوزه را برمی‌دارد.
  const waNow = (await ws("u-pmo")).workAreas.find((w) => w.Code === WA);
  assert.equal((await call("PATCH", `/work-areas/${WA}`, { user: "u-pmo", body: { Status: "closed", RowVersion: waNow.RowVersion } })).status, 200);
  const rollup = await call("GET", "/releases", { user: "u-qc" });
  const row = rollup.body.data.items.find((i) => i.activityCode === ACT);
  assert.equal(row.released, 1);
  assert.equal(row.releasedFully, true);
  // سند QMS متناظر ساخته شده است.
  await stopServer();
  const r = repo();
  const records = (await r.list("InspectionRecord")).filter((x) => x.Code === `IR-${no}`);
  assert.equal(records.length, 1);
  assert.equal(records[0].Outcome, "accepted");
  assert.equal(records[0].InspectedBy, "u-qc");
  assert.equal(records[0].ProjectId, PID);
  await startServer();
});

test("CPM-4: رد درخواست با دلیل و ماندن اثر آن در گزارش آزادسازی", async () => {
  const no = code("IR2");
  await call("POST", "/inspections", { user: "u-site", body: irBody(no) });
  await call("POST", `/inspections/${no}/transition`, { user: "u-site", body: { action: "submit" } });
  assert.equal(err(await call("POST", `/inspections/${no}/transition`, { user: "u-qc", body: { action: "reject" } })), "E-CPM-VALIDATION");
  const rejected = await call("POST", `/inspections/${no}/transition`, { user: "u-qc", body: { action: "reject", note: "جوش W-002 بدون PWHT" } });
  assert.equal(rejected.status, 200);
  assert.equal(rejected.body.data.Status, "rejected");
  assert.match(rejected.body.data.DecisionNoteFa, /PWHT/);
  const rollup = await call("GET", "/releases", { user: "u-site" });
  const row = rollup.body.data.items.find((i) => i.activityCode === ACT);
  assert.equal(row.rejected, 1);
  assert.equal(row.releasedFully, false);
});

test("CPM-4 تفکیک وظیفه: ثبت‌کنندهٔ درخواست نمی‌تواند خودش آن را آزاد کند (SOD-29)", async () => {
  const r = await call("POST", `/inspections/${SOD_IR}/transition`, { user: "u-qc", body: { action: "release" } });
  assert.equal(r.status, 400, JSON.stringify(r.body));
  assert.equal(err(r), "E-CPM-VALIDATION");
  assert.match(r.body.error.message, /تفکیک وظیفه/);
  // همان قاعده در تأیید گزارش روزانهٔ خودنوشته هم اجرا می‌شود.
  const d = await call("POST", `/dpr/${SOD_DPR}/transition`, { user: "u-pmo", body: { action: "approve" } });
  assert.equal(d.status, 409, JSON.stringify(d.body));
  assert.equal(err(d), "E-CPM-SOD");
});

test("ماندگاری پس از راه‌اندازی دوباره و ردپای حسابرسی", async () => {
  await stopServer();
  await startServer();
  const board = await ws("u-pm");
  assert.ok(board.workAreas.some((w) => w.Code === WA));
  assert.ok(board.dprEntries.some((d) => d.ReportNo === code("DPR1") && d.Status === "approved"));
  assert.ok(board.reports.some((x) => x.ReportNo === code("DR3") && x.Status === "approved" && x.Lines.length === 1));
  assert.ok(board.requests.some((x) => x.RequestNo === code("IR1") && x.Status === "released" && x.ageDays === null));
  assert.equal(board.metrics.inspection.pendingReleaseActivities.includes(ACT), false);
  assert.equal(board.modelVersion, "cpm-cpms-v1");
  await stopServer();
  const r = repo();
  const logs = (await r.list("AuditLog")).filter((row) => String(row.EntityName ?? "").startsWith("Cpm"));
  assert.ok(logs.some((row) => row.Action === "CPM_WORKAREA_CREATE"));
  assert.ok(logs.some((row) => row.Action === "CPM_DPR_APPROVE"));
  assert.ok(logs.some((row) => row.Action === "CPM_INSPECTION_RELEASE"));
  assert.ok(logs.some((row) => row.Action === "CPM_DPR_ATTACHMENT"));
  assert.ok(logs.some((row) => row.Action === "CPM_WORKAREA_DELETE" && row.Severity === "warn"));
  await startServer();
});
