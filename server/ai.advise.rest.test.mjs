/**
 * FIX-1 — مشاورهٔ آزاد هوش مصنوعی روی سرور واقعی.
 *
 * سؤال محوری: وقتی سرویسی فعال نیست یا ورودی ناقص است، آیا سرور
 * صادقانه می‌گوید، یا پاسخی ساختگی/نامربوط برمی‌گرداند؟
 * (هیچ درخواستی به سرویس بیرونی فرستاده نمی‌شود.)
 */
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, cp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { advisorInstructions, ADVISOR_NO_PROVIDER_FA } from "./aiLogic.js";

const PORT = 4741;
const BASE = `http://localhost:${PORT}`;

let child = null;
let dataDir = null;

before(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), "ai-advise-"));
  await cp("server/data", dataDir, { recursive: true }).catch(() => {});
  child = spawn(process.execPath, ["server/index.js"], {
    env: { ...process.env, PORT: String(PORT), PERSIST_DRIVER: "json", DATA_DIR: dataDir, AI_API_KEY: "" },
    stdio: "ignore",
  });
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(1000) });
      if (r.status < 600) return;
    } catch { /* هنوز بالا نیامده */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("سرور آزمون بالا نیامد");
});

after(async () => {
  if (child) child.kill("SIGTERM");
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
});

async function run(body, headers = {}) {
  const res = await fetch(`${BASE}/api/ai/run`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

test("advise: موتور قاعده‌محور پیام صادقانه می‌دهد، نه پیام «ترجمه» یا پاسخ ساختگی", async () => {
  const r = await run({ prompt: "advise", context: { provider: "mock", text: "مسیر بحرانی چیست؟" } });
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.equal(r.body.data.answer, null);
  assert.equal(r.body.data.message, ADVISOR_NO_PROVIDER_FA);
  assert.doesNotMatch(r.body.data.message, /ترجمه نمی‌کند/);
});

test("advise: بدون ارائه‌دهنده هم پیش‌فرض قاعده‌محور و صادقانه است", async () => {
  const r = await run({ prompt: "advise", context: { text: "سلام" } });
  assert.equal(r.status, 200);
  assert.equal(r.body.data.message, ADVISOR_NO_PROVIDER_FA);
});

test("advise: سرویس واقعی بدون کلید خطای اعتبار صریح می‌دهد", async () => {
  const r = await run({ prompt: "advise", context: { provider: "openai", text: "سلام" } });
  assert.equal(r.status, 400);
  assert.equal(r.body.ok, false);
  assert.ok(r.body.error.message);
});

test("advise: سرویس واقعی با کلید ولی بدون متن، خطای ورودی می‌دهد", async () => {
  const r = await run({ prompt: "advise", context: { provider: "openai", text: "  " } }, { "x-ai-key": "sk-test-000000000000000000000000" });
  assert.equal(r.status, 400);
  assert.equal(r.body.error.code, "E-AI-NO-INPUT");
});

test("advise: ترجمه همچنان رفتار قبلی را دارد", async () => {
  const r = await run({ prompt: "translate", context: { provider: "mock", text: "hello" } });
  assert.equal(r.status, 200);
  assert.match(r.body.data.message, /ترجمه نمی‌کند/);
});

test("advisorInstructions: ادعای تحلیل داده ممنوع است و زمینهٔ صفحه را دارد", () => {
  const s = advisorInstructions({ domain: "پیمان", process: "صورت‌وضعیت", sub: "کسورات", lang: "fa" });
  assert.match(s, /do NOT have access/);
  assert.match(s, /Never claim/);
  assert.match(s, /پیمان › صورت‌وضعیت › کسورات/);
  assert.match(s, /Persian/);
  assert.match(advisorInstructions({ lang: "en" }), /Reply in English/);
});
