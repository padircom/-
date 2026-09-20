import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execPath } from "node:process";

const PORT = 4718;
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
  dataDir = await mkdtemp(join(tmpdir(), "com-pre-"));
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

const P = "?projectId=pre-p1";
let systemId, coldPackId, hotPackId, sheetId;

test("آماده‌سازی: ساخت سیستم", async () => {
  const r = await api("POST", `/api/com/system${P}`, {
    body: { systemCode: "U-300", titleFa: "واحد بخار", systemType: "system", criticalityFa: "high" },
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  systemId = r.data.id;
});

/* ══════════════ بستهٔ آزمون ══════════════ */

test("ساخت بستهٔ آزمون سرد و فهرست آزمون‌های مجاز", async () => {
  const r = await api("POST", `/api/com/pack${P}`, {
    body: { systemId, packNo: "TP-001", titleFa: "آزمون سرد خط بخار", packType: "a", disciplineCode: "PI" },
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  coldPackId = r.data.id;
  assert.equal(r.data.item.typeFa, "آزمون سرد");
  assert.equal(r.data.item.statusFa, "پیش‌نویس");
  const kinds = r.data.allowedTestKinds.map((k) => k.code);
  assert.ok(kinds.includes("hydrotest"));
  assert.ok(!kinds.includes("load_test"), "آزمون گرم نباید در بستهٔ سرد مجاز باشد");
});

test("ساخت بستهٔ آزمون گرم", async () => {
  const r = await api("POST", `/api/com/pack${P}`, {
    body: { systemId, packNo: "TP-002", titleFa: "آزمون گرم توربین", packType: "b" },
  });
  assert.equal(r.ok, true);
  hotPackId = r.data.id;
  assert.equal(r.data.item.typeFa, "آزمون گرم");
});

test("بستهٔ بدون سیستم رد می‌شود", async () => {
  const { status, json } = await api("POST", `/api/com/pack${P}`, {
    body: { packNo: "TP-X", titleFa: "بی‌سیستم", packType: "a" },
    raw: true,
  });
  assert.equal(status, 404);
  assert.equal(json.error.code, "E-COM-SYSTEM-NOT-FOUND");
});

test("شمارهٔ بستهٔ تکراری رد می‌شود", async () => {
  const { status, json } = await api("POST", `/api/com/pack${P}`, {
    body: { systemId, packNo: "TP-001", titleFa: "تکراری", packType: "a" },
    raw: true,
  });
  assert.equal(status, 409);
  assert.equal(json.error.code, "E-COM-DUP-PACK");
});

test("نوع بستهٔ نامعتبر ۴۲۲ می‌دهد", async () => {
  const { status, json } = await api("POST", `/api/com/pack${P}`, {
    body: { systemId, packNo: "TP-Y", titleFa: "بد", packType: "z" },
    raw: true,
  });
  assert.equal(status, 422);
  assert.equal(json.error.code, "E-COM-PACK-TYPE");
});

/* ══════════════ برگهٔ آزمون ══════════════ */

test("ثبت برگهٔ هیدروتست با سه ردیف", async () => {
  const r = await api("POST", `/api/com/sheet${P}`, {
    body: {
      packId: coldPackId,
      sheetNo: "CS-001",
      titleFa: "هیدروتست خط ۱۰ اینچ",
      testKind: "hydrotest",
      testedBy: "u-site",
      lines: [
        { lineNo: 1, parameterFa: "فشار آزمون", expectedValue: "15", unitFa: "بار", isMandatory: true },
        { lineNo: 2, parameterFa: "مدت نگهداشت", expectedValue: "60", unitFa: "دقیقه", isMandatory: true },
        { lineNo: 3, parameterFa: "دمای محیط", expectedValue: "25", unitFa: "درجه", isMandatory: false },
      ],
    },
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  sheetId = r.data.id;
  assert.equal(r.data.item.kindFa, "آزمون هیدرواستاتیک");
  assert.equal(r.data.item.SheetType, "a", "نوع برگه از بسته گرفته می‌شود");
  assert.equal(r.data.lines.length, 3);
  assert.equal(r.data.verdict.mandatory, 2);
  assert.equal(r.data.verdict.resultFa, "pending");
});

test("آزمون گرم در بستهٔ سرد رد می‌شود", async () => {
  const { status, json } = await api("POST", `/api/com/sheet${P}`, {
    body: { packId: coldPackId, sheetNo: "CS-BAD", titleFa: "زیر بار", testKind: "load_test", lines: [{ lineNo: 1, parameterFa: "بار" }] },
    raw: true,
  });
  assert.equal(status, 422);
  assert.equal(json.error.code, "E-COM-KIND-PACK-MISMATCH");
});

test("آزمون سرد در بستهٔ گرم هم رد می‌شود", async () => {
  const { status, json } = await api("POST", `/api/com/sheet${P}`, {
    body: { packId: hotPackId, sheetNo: "CS-BAD2", titleFa: "هیدرو", testKind: "hydrotest", lines: [{ lineNo: 1, parameterFa: "فشار" }] },
    raw: true,
  });
  assert.equal(status, 422);
  assert.equal(json.error.code, "E-COM-KIND-PACK-MISMATCH");
});

test("برگهٔ بدون ردیف رد می‌شود", async () => {
  const { status, json } = await api("POST", `/api/com/sheet${P}`, {
    body: { packId: coldPackId, sheetNo: "CS-EMPTY", titleFa: "خالی", testKind: "megger", lines: [] },
    raw: true,
  });
  assert.equal(status, 422);
  assert.equal(json.error.code, "E-COM-NO-LINES");
});

test("ردیف با شمارهٔ تکراری رد می‌شود", async () => {
  const { status, json } = await api("POST", `/api/com/sheet${P}`, {
    body: {
      packId: coldPackId, sheetNo: "CS-DUP", titleFa: "تکراری", testKind: "megger",
      lines: [{ lineNo: 1, parameterFa: "الف" }, { lineNo: 1, parameterFa: "ب" }],
    },
    raw: true,
  });
  assert.equal(status, 422);
  assert.equal(json.error.code, "E-COM-DUP-LINE");
});

test("بستهٔ ناموجود ۴۰۴ می‌دهد", async () => {
  const { status, json } = await api("POST", `/api/com/sheet${P}`, {
    body: { packId: "ghost", sheetNo: "CS-G", titleFa: "شبح", testKind: "megger", lines: [{ lineNo: 1, parameterFa: "الف" }] },
    raw: true,
  });
  assert.equal(status, 404);
  assert.equal(json.error.code, "E-COM-PACK-NOT-FOUND");
});

/* ══════════════ ثبت قرائت و امضا ══════════════ */

test("برگهٔ ناتمام امضا نمی‌شود", async () => {
  const { status, json } = await api("POST", `/api/com/sheet/${sheetId}/sign${P}`, {
    body: { witnessedBy: "u-qc" },
    raw: true,
  });
  assert.equal(status, 409);
  assert.equal(json.error.code, "E-COM-SHEET-PENDING");
});

test("ثبت قرائت ردیف اول", async () => {
  const r = await api("POST", `/api/com/sheet/${sheetId}/reading${P}`, {
    body: { lineNo: 1, actualValue: "15.2", passed: true },
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.item.ActualValue, "15.2");
  assert.equal(r.data.item.Passed, true);
  assert.equal(r.data.verdict.pending, 1, "ردیف دوم هنوز مانده");
});

test("ردیف ناموجود ۴۰۴ می‌دهد", async () => {
  const { status, json } = await api("POST", `/api/com/sheet/${sheetId}/reading${P}`, {
    body: { lineNo: 99, passed: true },
    raw: true,
  });
  assert.equal(status, 404);
  assert.equal(json.error.code, "E-COM-LINE-NOT-FOUND");
});

test("ثبت قرائت ردیف دوم برگه را کامل می‌کند", async () => {
  const r = await api("POST", `/api/com/sheet/${sheetId}/reading${P}`, {
    body: { lineNo: 2, actualValue: "60", passed: true },
  });
  assert.equal(r.data.verdict.resultFa, "pass");
  assert.equal(r.data.verdict.pending, 0);
});

test("امضا بدون شاهد رد می‌شود", async () => {
  const { status, json } = await api("POST", `/api/com/sheet/${sheetId}/sign${P}`, { body: {}, raw: true });
  assert.equal(status, 409);
  assert.equal(json.error.code, "E-COM-NO-WITNESS");
});

test("سرپرست کارگاه ثبت می‌کند ولی امضا نمی‌کند", async () => {
  const rec = await api("POST", `/api/com/sheet/${sheetId}/reading${P}`, {
    body: { lineNo: 3, actualValue: "24" },
    user: "u-site",
    raw: true,
  });
  assert.equal(rec.status, 200, "سرپرست کارگاه باید بتواند قرائت ثبت کند");
  const sign = await api("POST", `/api/com/sheet/${sheetId}/sign${P}`, {
    body: { witnessedBy: "u-qc" },
    user: "u-site",
    raw: true,
  });
  assert.equal(sign.status, 403, "سرپرست کارگاه نباید بتواند امضا کند");
});

test("بازرس کیفی برگه را امضا می‌کند", async () => {
  const r = await api("POST", `/api/com/sheet/${sheetId}/sign${P}`, {
    body: { witnessedBy: "بازرس کارفرما" },
    user: "u-qc",
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.item.Status, "signed");
  assert.equal(r.data.item.ResultFa, "pass");
  assert.equal(r.data.item.resultLabelFa, "قبول");
  assert.ok(r.data.item.TestDate, "تاریخ آزمون باید پر شود");
});

test("امضای دوباره رد می‌شود", async () => {
  const { status, json } = await api("POST", `/api/com/sheet/${sheetId}/sign${P}`, {
    body: { witnessedBy: "x" },
    raw: true,
  });
  assert.equal(status, 409);
  assert.equal(json.error.code, "E-COM-ALREADY-SIGNED");
});

test("برگهٔ امضاشده قابل ویرایش نیست", async () => {
  const { status, json } = await api("POST", `/api/com/sheet/${sheetId}/reading${P}`, {
    body: { lineNo: 1, passed: false },
    raw: true,
  });
  assert.equal(status, 409);
  assert.equal(json.error.code, "E-COM-SHEET-LOCKED");
});

/* ══════════════ تأیید بسته ══════════════ */

test("بستهٔ ناتمام تأیید نمی‌شود و همهٔ موانع را می‌گوید", async () => {
  await api("POST", `/api/com/sheet${P}`, {
    body: { packId: coldPackId, sheetNo: "CS-002", titleFa: "مگر تست", testKind: "megger", lines: [{ lineNo: 1, parameterFa: "مقاومت عایقی", expectedValue: "500", unitFa: "مگااهم" }] },
  });
  const { status, json } = await api("POST", `/api/com/pack/${coldPackId}/clear${P}`, { body: {}, raw: true });
  assert.equal(status, 409);
  assert.equal(json.error.code, "E-COM-PACK-NOT-READY");
  assert.ok(json.error.details.some((d) => d.includes("امضا نشده")));
});

test("پیش‌بینی تأیید بدون نوشتن کار می‌کند", async () => {
  const r = await api("POST", `/api/com/pack/${coldPackId}/clear${P}`, { body: { dryRun: true } });
  assert.equal(r.data.dryRun, true);
  assert.equal(r.data.progress.canClear, false);
  assert.equal(r.data.progress.total, 2);
  assert.equal(r.data.progress.signed, 1);
});

test("بستهٔ کامل تأیید می‌شود", async () => {
  const sheets = await api("GET", `/api/com/sheet${P}&packId=${coldPackId}`);
  const draft = sheets.data.items.find((x) => x.Status === "draft");
  await api("POST", `/api/com/sheet/${draft.Id}/reading${P}`, { body: { lineNo: 1, actualValue: "620", passed: true } });
  await api("POST", `/api/com/sheet/${draft.Id}/sign${P}`, { body: { witnessedBy: "بازرس" }, user: "u-qc" });

  const r = await api("POST", `/api/com/pack/${coldPackId}/clear${P}`, { body: {} });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.item.Status, "cleared");
  assert.equal(r.data.item.ClearedSheets, 2);
  assert.ok(r.data.item.ClearedAt);
});

test("بستهٔ تأییدشده برگهٔ جدید نمی‌پذیرد", async () => {
  const { status, json } = await api("POST", `/api/com/sheet${P}`, {
    body: { packId: coldPackId, sheetNo: "CS-LATE", titleFa: "دیرهنگام", testKind: "flushing", lines: [{ lineNo: 1, parameterFa: "الف" }] },
    raw: true,
  });
  assert.equal(status, 409);
  assert.equal(json.error.code, "E-COM-PACK-CLEARED");
});

test("تأیید دوبارهٔ بسته رد می‌شود", async () => {
  const { status, json } = await api("POST", `/api/com/pack/${coldPackId}/clear${P}`, { body: {}, raw: true });
  assert.equal(status, 409);
  assert.equal(json.error.code, "E-COM-PACK-ALREADY-CLEARED");
});

/* ══════════════ دروازهٔ آزمون سرد ══════════════ */

test("دروازهٔ سرد با همهٔ بسته‌های تأییدشده باز می‌شود", async () => {
  const r = await api("GET", `/api/com/system/${systemId}/cold-clearance${P}`);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.data.clearance.ok, true, "تنها بستهٔ سرد تأیید شده است");
  assert.equal(r.data.clearance.packCount, 1, "بستهٔ گرم نباید شمرده شود");
  assert.equal(r.data.system.code, "U-300");
});

test("سیستم بدون بستهٔ سرد دروازه‌اش بسته است", async () => {
  const s2 = await api("POST", `/api/com/system${P}`, {
    body: { systemCode: "U-400", titleFa: "واحد آب", systemType: "system" },
  });
  const r = await api("GET", `/api/com/system/${s2.data.id}/cold-clearance${P}`);
  assert.equal(r.data.clearance.ok, false);
  assert.match(r.data.clearance.blockersFa[0], /هیچ بستهٔ آزمون سردی/);
});

test("خلاصهٔ پیش‌راه‌اندازی سیستم بدون بسته را نام می‌برد", async () => {
  const r = await api("GET", `/api/com/precomm${P}`);
  assert.equal(r.ok, true);
  assert.equal(r.data.summary.packs, 2);
  assert.deepEqual(r.data.summary.byType, { a: 1, b: 1 });
  assert.ok(r.data.summary.systemsWithoutPack.includes("U-400"));
  assert.equal(r.data.testKinds.length, 2);
});

/* ══════════════ جداسازی و دسترسی ══════════════ */

test("کاربر بدون مجوز ثبت رد می‌شود", async () => {
  const { status } = await api("POST", `/api/com/pack${P}`, {
    body: { systemId, packNo: "TP-Z", titleFa: "غیرمجاز", packType: "a" },
    user: "u-client",
    raw: true,
  });
  assert.equal(status, 403);
});

test("پروژهٔ دیگر بسته‌های این پروژه را نمی‌بیند", async () => {
  const r = await api("GET", "/api/com/pack?projectId=pre-p2");
  assert.equal(r.data.count, 0);
});

test("بدون projectId خطا می‌دهد", async () => {
  const { status, json } = await api("GET", "/api/com/pack", { raw: true });
  assert.equal(status, 400);
  assert.equal(json.error.code, "E-CNT-NO-PROJECT");
});

test("اندپوینت‌های تحویلی قبلی نشکسته‌اند", async () => {
  const plan = await api("GET", `/api/com/plan${P}`);
  assert.equal(plan.ok, true, "برنامهٔ تحویل باید کار کند");
  const cert = await api("GET", `/api/com/certificate${P}`, { user: "u-client" });
  assert.equal(cert.ok, true, "گواهی تحویل باید کار کند");
});
