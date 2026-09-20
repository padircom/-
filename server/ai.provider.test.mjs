/**
 * آزمون لایهٔ ارائه‌دهندهٔ هوش مصنوعی.
 *
 * تمرکز این آزمون‌ها روی چیزهایی است که اگر بشکنند بی‌سروصدا خراب
 * می‌شوند: نشت راز، قاطی شدن خطای اعتبار با خطای سرویس، و شکل بدنهٔ
 * سرویس‌هایی که نمی‌توان بدون کلید واقعی امتحانشان کرد.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  AI_VERSION,
  AI_PROVIDERS,
  PROVIDER_BY_ID,
  isProviderId,
  checkCredential,
  maskSecret,
  buildWireRequest,
  extractText,
  classifyHttpFailure,
  failureMessageFa,
  shouldFallbackToRule,
} from "./aiLogic.js";

/* ══════════════════════ کاتالوگ ══════════════════════ */

test("ai: نسخهٔ موتور اعلام شده است", () => {
  assert.equal(AI_VERSION, "ai-v1");
});

test("ai: هر پنج ارائه‌دهنده در کاتالوگ هستند", () => {
  const ids = AI_PROVIDERS.map((p) => p.id).sort();
  assert.deepEqual(ids, ["arena", "claude", "deepseek", "openai", "rule"]);
});

test("ai: دیپ‌سیک قالب chat/completions می‌فرستد نه Responses", () => {
  /* فرستادن بدنهٔ Responses به آن خطای ۴۰۰ می‌دهد و پیامش گویا نیست. */
  const w = buildWireRequest({ provider: "deepseek", mode: "api_key", secret: "k" }, REQ);
  const body = JSON.parse(w.body);
  assert.ok(Array.isArray(body.messages));
  assert.equal(body.messages[0].role, "system");
  assert.equal(body.messages[0].content, REQ.instructions);
  assert.equal(body.input, undefined);
});

test("ai: دیپ‌سیک آدرس خودش را دارد نه آدرس اوپن‌ای‌آی", () => {
  /* نگاشتنش به openai یعنی فرستادن کلید DeepSeek به سرور OpenAI، که
   * همیشه ۴۰۱ می‌دهد و کاربر فکر می‌کند کلیدش خراب است. */
  const w = buildWireRequest({ provider: "deepseek", mode: "api_key", secret: "k" }, REQ);
  assert.ok(w.url.includes("deepseek.com"));
});

test("ai: پاسخ دیپ‌سیک از choices خوانده می‌شود", () => {
  const payload = { choices: [{ message: { content: "متن ترجمه‌شده" } }] };
  assert.equal(extractText("deepseek", payload), "متن ترجمه‌شده");
  assert.equal(extractText("deepseek", { choices: [] }), null);
});

test("ai: شناسه‌ها یکتا هستند", () => {
  const ids = AI_PROVIDERS.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("ai: تشخیص شناسهٔ معتبر", () => {
  assert.equal(isProviderId("claude"), true);
  assert.equal(isProviderId("gemini"), false);
  assert.equal(isProviderId(null), false);
  assert.equal(isProviderId(42), false);
});

test("ai: آرنا ورود با حساب کاربری را می‌پذیرد", () => {
  const arena = PROVIDER_BY_ID.get("arena");
  assert.ok(arena.authModes.includes("account"));
});

test("ai: موتور قاعده‌محور به شبکه نیاز ندارد", () => {
  const rule = PROVIDER_BY_ID.get("rule");
  assert.equal(rule.needsNetwork, false);
  assert.equal(rule.authModes.length, 0);
});

test("ai: هر ارائه‌دهندهٔ شبکه‌ای آدرس و مدل پیش‌فرض دارد", () => {
  for (const p of AI_PROVIDERS) {
    if (!p.needsNetwork) continue;
    assert.ok(p.defaultUrl.startsWith("https://"), `${p.id} بدون آدرس امن`);
    assert.ok(p.defaultModel.length > 0, `${p.id} بدون مدل`);
  }
});

/* ══════════════════════ اعتبار ══════════════════════ */

test("ai: موتور قاعده‌محور بدون هیچ اعتباری معتبر است", () => {
  const r = checkCredential({ provider: "rule" });
  assert.equal(r.ok, true);
});

test("ai: نبود ارائه‌دهنده رد می‌شود", () => {
  assert.equal(checkCredential(null).code, "E-AI-NO-PROVIDER");
  assert.equal(checkCredential({}).code, "E-AI-NO-PROVIDER");
});

test("ai: ارائه‌دهندهٔ ناشناخته رد می‌شود", () => {
  const r = checkCredential({ provider: "gemini", secret: "x" });
  assert.equal(r.code, "E-AI-UNKNOWN-PROVIDER");
});

test("ai: کلید خالی رد می‌شود", () => {
  const r = checkCredential({ provider: "openai", mode: "api_key", secret: "   " });
  assert.equal(r.ok, false);
  assert.equal(r.code, "E-AI-NO-SECRET");
});

test("ai: کلاد حالت حساب کاربری را نمی‌پذیرد", () => {
  const r = checkCredential({ provider: "claude", mode: "account", secret: "tok" });
  assert.equal(r.ok, false);
  assert.equal(r.code, "E-AI-MODE-UNSUPPORTED");
});

test("ai: پیام نبود نشست با پیام نبود کلید فرق دارد", () => {
  const acct = checkCredential({ provider: "arena", mode: "account", secret: "" });
  const key = checkCredential({ provider: "openai", mode: "api_key", secret: "" });
  assert.notEqual(acct.messageFa, key.messageFa);
});

/* ══════════════════════ پوشاندن راز ══════════════════════ */

test("ai: راز کوتاه کاملاً پوشانده می‌شود", () => {
  const m = maskSecret("abc123");
  assert.equal(m, "••••••");
  assert.ok(!m.includes("abc"));
});

test("ai: راز بلند فقط چهار نویسهٔ ابتدا و انتها را نشان می‌دهد", () => {
  const secret = "sk-proj-ABCDEFGHIJKLMNOPQRSTUV";
  const m = maskSecret(secret);
  assert.ok(m.startsWith("sk-p"));
  assert.ok(m.endsWith("STUV"));
  assert.ok(!m.includes("GHIJKLMN"));
});

test("ai: راز خالی رشتهٔ خالی می‌دهد نه undefined", () => {
  assert.equal(maskSecret(null), "");
  assert.equal(maskSecret(undefined), "");
});

/* ══════════════════════ ساخت درخواست ══════════════════════ */

const REQ = { instructions: "فقط از منابع پاسخ بده", input: "متن قرارداد" };

test("ai: کلاد دستور را در میدان system می‌گذارد نه در پیام‌ها", () => {
  const w = buildWireRequest({ provider: "claude", mode: "api_key", secret: "k1" }, REQ);
  const body = JSON.parse(w.body);
  assert.equal(body.system, REQ.instructions);
  assert.equal(body.messages[0].role, "user");
  assert.equal(body.messages[0].content, REQ.input);
  /* اگر دستور داخل پیام هم تکرار شود، دو منبع برای یک قاعده می‌شود. */
  assert.ok(!String(body.messages[0].content).includes("فقط از منابع"));
});

test("ai: کلاد از سربرگ x-api-key استفاده می‌کند نه Bearer", () => {
  const w = buildWireRequest({ provider: "claude", mode: "api_key", secret: "k1" }, REQ);
  assert.equal(w.headers["x-api-key"], "k1");
  assert.equal(w.headers.authorization, undefined);
  assert.ok(w.headers["anthropic-version"]);
});

test("ai: اوپن‌ای‌آی از Bearer استفاده می‌کند", () => {
  const w = buildWireRequest({ provider: "openai", mode: "api_key", secret: "k2" }, REQ);
  assert.equal(w.headers.authorization, "Bearer k2");
  assert.equal(w.headers["x-api-key"], undefined);
});

test("ai: حالت حساب کاربری سربرگ متمایز می‌فرستد", () => {
  const acct = buildWireRequest({ provider: "arena", mode: "account", secret: "t" }, REQ);
  const key = buildWireRequest({ provider: "arena", mode: "api_key", secret: "t" }, REQ);
  assert.equal(acct.headers["x-auth-mode"], "account");
  assert.equal(key.headers["x-auth-mode"], undefined);
});

test("ai: آدرس و مدل قابل جایگزینی است", () => {
  const w = buildWireRequest(
    { provider: "openai", mode: "api_key", secret: "k" },
    REQ,
    { url: "https://proxy.local/v1", model: "custom-1" },
  );
  assert.equal(w.url, "https://proxy.local/v1");
  assert.equal(JSON.parse(w.body).model, "custom-1");
});

test("ai: سقف توکن پیش‌فرض دارد و قابل تغییر است", () => {
  const def = JSON.parse(buildWireRequest({ provider: "openai", mode: "api_key", secret: "k" }, REQ).body);
  assert.equal(def.max_output_tokens, 1200);
  const custom = JSON.parse(
    buildWireRequest({ provider: "openai", mode: "api_key", secret: "k" }, { ...REQ, maxOutputTokens: 300 }).body,
  );
  assert.equal(custom.max_output_tokens, 300);
});

test("ai: موتور قاعده‌محور درخواست سیمی ندارد", () => {
  assert.throws(
    () => buildWireRequest({ provider: "rule", mode: "api_key", secret: "" }, REQ),
    /rule engine/,
  );
});

test("ai: راز فقط در سربرگ می‌رود، نه در بدنه", () => {
  for (const provider of ["openai", "claude", "arena"]) {
    const w = buildWireRequest({ provider, mode: "api_key", secret: "SECRET-XYZ" }, REQ);
    assert.ok(!w.body.includes("SECRET-XYZ"), `${provider} راز را در بدنه نشت داد`);
  }
});

/* ══════════════════════ خواندن پاسخ ══════════════════════ */

test("ai: پاسخ کلاد از بلوک‌های متنی خوانده می‌شود", () => {
  const payload = { content: [{ type: "text", text: "خط اول" }, { type: "text", text: "خط دوم" }] };
  assert.equal(extractText("claude", payload), "خط اول\nخط دوم");
});

test("ai: بلوک غیرمتنی کلاد نادیده گرفته می‌شود", () => {
  const payload = { content: [{ type: "thinking", text: "پنهان" }, { type: "text", text: "آشکار" }] };
  assert.equal(extractText("claude", payload), "آشکار");
});

test("ai: میان‌بر output_text خوانده می‌شود", () => {
  assert.equal(extractText("openai", { output_text: "پاسخ کوتاه" }), "پاسخ کوتاه");
});

test("ai: نبود میان‌بر، از آرایهٔ output جبران می‌شود", () => {
  const payload = { output: [{ content: [{ type: "output_text", text: "از آرایه" }] }] };
  assert.equal(extractText("openai", payload), "از آرایه");
});

test("ai: پاسخ بی‌محتوا null می‌دهد نه رشتهٔ خالی", () => {
  assert.equal(extractText("openai", {}), null);
  assert.equal(extractText("openai", null), null);
  assert.equal(extractText("claude", { content: [] }), null);
});

/* ══════════════════════ تفکیک خطا ══════════════════════ */

test("ai: ۴۰۱ و ۴۰۳ خطای اعتبار هستند", () => {
  assert.equal(classifyHttpFailure(401), "auth");
  assert.equal(classifyHttpFailure(403), "auth");
});

test("ai: ۴۲۹ سقف مصرف است نه خطای سرویس", () => {
  assert.equal(classifyHttpFailure(429), "rate_limit");
});

test("ai: مهلت از خطای سرویس جدا است", () => {
  assert.equal(classifyHttpFailure(408), "timeout");
  assert.equal(classifyHttpFailure(504), "timeout");
  assert.equal(classifyHttpFailure(500), "server");
  assert.equal(classifyHttpFailure(503), "server");
});

test("ai: پیام خطا نام ارائه‌دهنده را می‌برد", () => {
  const msg = failureMessageFa("auth", "claude");
  assert.ok(msg.includes("کلاد"));
});

test("ai: هر نوع شکست پیام متمایز دارد", () => {
  const kinds = ["auth", "rate_limit", "timeout", "server", "network", "unknown"];
  const msgs = kinds.map((k) => failureMessageFa(k, "openai"));
  assert.equal(new Set(msgs).size, kinds.length);
});

/* ══════════════════════ سیاست کف ══════════════════════ */

test("ai: خطای اعتبار بی‌صدا به موتور قاعده‌محور نمی‌افتد", () => {
  /* اگر بیفتد، کاربر فکر می‌کند AI کار کرده و خروجی ضعیف را می‌پذیرد. */
  assert.equal(shouldFallbackToRule("auth"), false);
});

test("ai: قطعی شبکه و سقف مصرف مانع کار نمی‌شوند", () => {
  assert.equal(shouldFallbackToRule("network"), true);
  assert.equal(shouldFallbackToRule("rate_limit"), true);
  assert.equal(shouldFallbackToRule("timeout"), true);
  assert.equal(shouldFallbackToRule("server"), true);
});
