/**
 * FIX-3 — پیوست‌های گزارش روزانه (DPR) روی سرور واقعی.
 *
 * سؤال محوری: فایل واقعاً ذخیره و بازگردانده می‌شود، ورودی بد رد
 * می‌شود، نام ذخیره از کاربر گرفته نمی‌شود و فهرست پس از راه‌اندازی
 * دوبارهٔ سرور باقی می‌ماند؟
 */
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, cp, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const PORT = 4742;
const BASE = `http://localhost:${PORT}`;

let child = null;
let dataDir = null;
let storageDir = null;

async function startServer() {
  child = spawn(process.execPath, ["server/index.js"], {
    env: { ...process.env, PORT: String(PORT), PERSIST_DRIVER: "json", DATA_DIR: dataDir, FILE_STORAGE_PATH: storageDir, MAX_FILE_MB: "1" },
    stdio: "ignore",
  });
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${BASE}/api/pex/dpr-docs/health`, { signal: AbortSignal.timeout(1000) });
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
  dataDir = await mkdtemp(path.join(tmpdir(), "dprdoc-data-"));
  storageDir = await mkdtemp(path.join(tmpdir(), "dprdoc-store-"));
  await cp("server/data", dataDir, { recursive: true }).catch(() => {});
  await startServer();
});

after(async () => {
  await stopServer();
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
  if (storageDir) await rm(storageDir, { recursive: true, force: true });
});

function form(content, name, type, note) {
  const fd = new FormData();
  fd.append("file", new Blob([content], { type }), name);
  if (note) fd.append("note", note);
  return fd;
}

const upload = (dprId, fd, headers = {}) =>
  fetch(`${BASE}/api/pex/dpr/${dprId}/documents`, { method: "POST", body: fd, headers });

let savedId = null;

test("dprdoc: سلامت ماژول و نسخه", async () => {
  const r = await (await fetch(`${BASE}/api/pex/dpr-docs/health`)).json();
  assert.equal(r.ok, true);
  assert.equal(r.data.version, "dprdoc-v1");
  assert.equal(r.data.documents, 0);
});

test("dprdoc: آپلود، فهرست و دانلود همان محتوا", async () => {
  const res = await upload("42", form("گزارش روز ۱۲", "report.txt", "text/plain", "عکس جبههٔ کار"), { "x-user-id": "u-site" });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.data.dprId, "42");
  assert.equal(body.data.fileName, "report.txt");
  assert.equal(body.data.note, "عکس جبههٔ کار");
  assert.equal(body.data.uploadedBy, "u-site");
  assert.equal(body.data.storageKey, undefined, "کلید ذخیره نباید افشا شود");
  assert.ok(body.meta.traceId);
  savedId = body.data.id;

  const list = await (await fetch(`${BASE}/api/pex/dpr/42/documents`)).json();
  assert.equal(list.data.length, 1);
  assert.equal(list.data[0].storageKey, undefined);

  const dl = await fetch(`${BASE}/api/pex/dpr/42/documents/${savedId}`);
  assert.equal(dl.status, 200);
  assert.equal(await dl.text(), "گزارش روز ۱۲");
});

test("dprdoc: نام فایل کاربر روی دیسک استفاده نمی‌شود", async () => {
  await upload("43", form("x", "../../evil.txt", "text/plain"));
  const files = await readdir(path.join(storageDir, "dpr"));
  assert.ok(files.every((f) => f === "_index.json" || /^\d+-[0-9a-f-]{36}\.bin$/.test(f)), files.join(","));
});

test("dprdoc: ورودی نامعتبر رد می‌شود", async () => {
  assert.equal((await upload("bad id!", form("x", "a.txt", "text/plain"))).status, 400);
  assert.equal((await upload("44", new FormData())).status, 400);
  const badType = await upload("44", form("MZ", "a.exe", "application/x-msdownload"));
  assert.equal(badType.status, 415);
  const big = await upload("44", form("a".repeat(1024 * 1024 + 10), "big.txt", "text/plain"));
  assert.equal(big.status, 413);
  assert.equal((await fetch(`${BASE}/api/pex/dpr/42/documents/not-a-uuid`)).status, 400);
  assert.equal((await fetch(`${BASE}/api/pex/dpr/42/documents/00000000-0000-0000-0000-000000000000`)).status, 404);
});

test("dprdoc: فهرست پس از راه‌اندازی دوبارهٔ سرور باقی می‌ماند", async () => {
  await stopServer();
  await startServer();
  const list = await (await fetch(`${BASE}/api/pex/dpr/42/documents`)).json();
  assert.equal(list.data.length, 1);
  assert.equal(list.data[0].id, savedId);
});

test("dprdoc: حذف پیوست و فایل آن", async () => {
  const del = await fetch(`${BASE}/api/pex/dpr/42/documents/${savedId}`, { method: "DELETE" });
  assert.equal(del.status, 200);
  const list = await (await fetch(`${BASE}/api/pex/dpr/42/documents`)).json();
  assert.equal(list.data.length, 0);
  assert.equal((await fetch(`${BASE}/api/pex/dpr/42/documents/${savedId}`)).status, 404);
});
