/**
 * سرویس ساختگی هوش مصنوعی — فقط برای آزمون محلی.
 *
 * سندباکس دسترسی اینترنت ندارد، پس نمی‌توان به DeepSeek یا OpenAI
 * واقعی وصل شد. این سرویس همان قالب سیمی را می‌پذیرد و پاسخ می‌دهد،
 * تا بتوان ثابت کرد زنجیرهٔ ترجمه از رابط تا سرور سالم است و مشکل
 * فقط نبودِ شبکه است.
 *
 * در محیط عملیاتی اجرا نمی‌شود؛ فقط با اجرای دستی برای عیب‌یابی.
 */
import http from "node:http";

const PORT = Number(process.env.FAKE_AI_PORT || 4111);

const server = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => { body += c; });
  req.on("end", () => {
    let parsed = {};
    try {
      parsed = JSON.parse(body || "{}");
    } catch {
      parsed = {};
    }

    /* متن کاربر را از هر دو قالب بیرون می‌کشد: chat/completions
     * (DeepSeek) و Responses (OpenAI). */
    const fromMessages = Array.isArray(parsed.messages)
      ? parsed.messages.find((m) => m.role === "user")?.content
      : null;
    const input = String(fromMessages ?? parsed.input ?? "");

    /* ترجمهٔ ساختگی: پیشوند می‌گذارد تا در آزمون قابل تشخیص باشد. */
    const translated = `[ترجمهٔ آزمایشی] ${input}`;

    const authorized = String(req.headers.authorization || "").length > 10;
    if (!authorized) {
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: { message: "missing key" } }));
      return;
    }

    res.writeHead(200, { "content-type": "application/json" });
    /* هر دو شکل پاسخ را می‌دهد تا هر دو خوانندهٔ لایهٔ ارائه‌دهنده
     * بتوانند بخوانند. */
    res.end(JSON.stringify({
      choices: [{ message: { role: "assistant", content: translated } }],
      output_text: translated,
    }));
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`fake AI listening on http://127.0.0.1:${PORT}`);
});
