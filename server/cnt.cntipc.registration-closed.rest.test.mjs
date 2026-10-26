/**
 * ADR-CNT-IPC-UNIFY فاز ۳ / بند ۳ — پس از مهاجرت با
 * scripts/migrate-cntipc-to-core.mjs، مسیر ثبت/گذار CntIpcCertificate با
 * متغیر محیطی CNT_IPC_REGISTRATION_CLOSED=1 بسته می‌شود. این فایل همان
 * سرور را یک‌بار با فلگ روشن بالا می‌آورد تا رفتار ۴۱۰ را تأیید کند، بدون
 * آنکه به آزمون‌های دیگر (که فلگ را روشن نمی‌کنند) دست بزند.
 */
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRepository, JsonFileDriver } from "./persistence/driver.mjs";

const PORT = 4751;
const BASE = `http://127.0.0.1:${PORT}`;
const PID = "c1-p1";
const CONTRACT = `CLOSED-${Date.now().toString(36).toUpperCase()}`;

let child = null;
let dataDir = null;
const repo = () => createRepository(new JsonFileDriver(dataDir));

async function startServer() {
  child = spawn(process.execPath, ["server/index.js"], {
    env: { ...process.env, PORT: String(PORT), PERSIST_DRIVER: "json", DATA_DIR: dataDir, CNT_IPC_REGISTRATION_CLOSED: "1" },
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
  throw new Error("سرور آزمون بالا نیامد");
}

before(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), "cntipc-closed-"));
  const r = repo();
  await r.create("ContractMaster", {
    ProjectId: PID, Code: CONTRACT, TitleFa: "پیمان آزمون", ContractType: "lump_sum", Party: "client",
    EmployerName: "کارفرما", ContractorName: "پیمانکار", SignDate: "2026-01-01", StartDate: "2026-01-01",
    DurationDays: 365, InitialAmount: 1_000_000, CurrentAmount: 1_000_000, Currency: "IRR",
    CeilingPct: 10, RetainagePct: 5, AdjustmentEnabled: false, Status: "active",
  }, "u-contracts", "cnt");
  await startServer();
});
after(async () => {
  if (child) { const exited = new Promise((r) => child.once("exit", r)); child.kill("SIGTERM"); await exited; }
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
});

async function call(method, p, { user, body } = {}) {
  const res = await fetch(`${BASE}/api/cnt-ipc/${PID}${p}`, {
    method,
    headers: { "content-type": "application/json", ...(user ? { "x-user-id": user } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

test("CNT_IPC_REGISTRATION_CLOSED=1: ثبت گواهی تازهٔ CNT-1 با ۴۱۰ رد می‌شود", async () => {
  const r = await call("POST", "/certificates", { user: "u-cost", body: { TemplateCode: "X", PeriodNo: 1, PeriodFrom: "2026-01-01", PeriodTo: "2026-01-31", Inputs: [] } });
  assert.equal(r.status, 410);
  assert.equal(r.body?.error?.code, "E-CNT-IPC-CLOSED");
});

test("CNT_IPC_REGISTRATION_CLOSED=1: گذار گواهی نیز با ۴۱۰ رد می‌شود", async () => {
  const r = await call("POST", "/certificates/any-id/transition", { user: "u-cost", body: { action: "submit" } });
  assert.equal(r.status, 410);
  assert.equal(r.body?.error?.code, "E-CNT-IPC-CLOSED");
});

test("CNT_IPC_REGISTRATION_CLOSED=1: ساخت/انتشار قالب همچنان کار می‌کند (فقط ثبت گواهی بسته شده)", async () => {
  const created = await call("POST", "/templates", { user: "u-cost", body: {
    Code: "TPLCLOSED", TitleFa: "قالب", ContractCode: CONTRACT,
    Items: [{ Code: "R01", TitleFa: "ردیف", Unit: "ls", Basis: "lump", Sign: "+" }],
    Deductions: [], NoteFa: null,
  } });
  assert.equal(created.status, 201);
});
