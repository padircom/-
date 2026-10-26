/* فاز ۵ — کلاینت اسناد صورتوضعیت: نام فایل، خطای باینری، پیشفرض
 * «پیشنمایش» بودن ورود Excel، و مسیرهای اختصاصی (نه موتور عمومی فایل). */
import test from "node:test";
import assert from "node:assert/strict";
import {
  fileNameFromDisposition, CntIpcFilesClient, cntIpcPkiStatus, cntIpcVerifySignatures,
} from "./cntIpcFilesLogic.js";

const realFetch = globalThis.fetch;
function stubFetch(handler) {
  globalThis.fetch = async (url, init) => handler(String(url), init ?? {});
}
function restore() { globalThis.fetch = realFetch; }

test("نام فایل ساده از content-disposition", () => {
  assert.equal(fileNameFromDisposition('attachment; filename="ipc-12.pdf"', "f.pdf"), "ipc-12.pdf");
  assert.equal(fileNameFromDisposition('attachment; filename=cnt-templates-p1.xlsx', "f.xlsx"), "cnt-templates-p1.xlsx");
});

test("نام فایل UTF-8 و جلوگیری از عبور مسیر", () => {
  assert.equal(fileNameFromDisposition("attachment; filename*=UTF-8''%D9%81%D8%A7%DA%A9%D8%AA%D9%88%D8%B1.pdf", "f.pdf"), "فاکتور.pdf");
  assert.equal(fileNameFromDisposition('attachment; filename="../../etc/passwd"', "f.pdf"), "passwd");
  assert.equal(fileNameFromDisposition(null, "fallback.pdf"), "fallback.pdf");
  assert.equal(fileNameFromDisposition('attachment; filename="a\u0000b.pdf"', "f.pdf"), "f.pdf");
});

test("مسیر PDF و Excel اختصاصیاند و projectId/ipcId رمزگذاری میشوند", async () => {
  const seen = [];
  stubFetch(async (url) => {
    seen.push(url);
    return new Response(new Blob(["%PDF-1.4"], { type: "application/pdf" }), {
      status: 200, headers: { "content-type": "application/pdf", "content-disposition": 'attachment; filename="a.pdf"', "x-cnt-ipc-doc-sha256": "abc" },
    });
  });
  try {
    const c = new CntIpcFilesClient("c1-p1", "ipc/1", "u-pm");
    const r = await c.pdf();
    assert.equal(r.ok, true);
    assert.equal(r.docSha256, "abc");
    assert.equal(r.fileName, "a.pdf");
    await c.excel("measurements", "C-9");
    assert.ok(seen[0].startsWith("/api/cnt/ipc/ipc%2F1/pdf?projectId=c1-p1"));
    assert.ok(seen[1].startsWith("/api/cnt/excel/c1-p1/measurements?contractId=C-9"));
    assert.ok(!seen.some((u) => u.includes("/api/integration") || u.includes("/api/data")),
      "نباید از موتور عمومی فایل استفاده شود");
  } finally { restore(); }
});

test("خطای JSON سرور (۴۲۲/۵۰۱/۴۰۳) به پیام فارسی تبدیل میشود نه فایل خراب", async () => {
  stubFetch(async () => new Response(JSON.stringify({ ok: false, error: { code: "E-CNT-RPT-LETTERHEAD", message: "سربرگ سند رسمی کامل نیست" } }), {
    status: 422, headers: { "content-type": "application/json" },
  }));
  try {
    const r = await new CntIpcFilesClient("c1-p1", "ipc-1", "u-pm").pdf();
    assert.equal(r.ok, false);
    assert.equal(r.code, "E-CNT-RPT-LETTERHEAD");
    assert.equal(r.message, "سربرگ سند رسمی کامل نیست");
    assert.ok(!("blob" in r));
  } finally { restore(); }
});

test("هدر هویت روی دانلود باینری فرستاده میشود", async () => {
  let headers = null;
  stubFetch(async (_u, init) => {
    headers = init.headers;
    return new Response(new Blob(["PK"]), { status: 200, headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" } });
  });
  try {
    await new CntIpcFilesClient("c1-p1", "ipc-1", "u-pm").excel("templates");
    assert.equal(headers["x-user-id"], "u-pm");
  } finally { restore(); }
});

test("ورود Excel پیشفرض بدون commit است (هیچ نوشتهای پنهانی نیست)", async () => {
  const urls = [];
  stubFetch(async (url, init) => {
    urls.push(String(url));
    assert.ok(init.body instanceof FormData);
    return new Response(JSON.stringify({ ok: true, data: { committed: false, count: 2, preview: [], issues: [] } }), {
      status: 200, headers: { "content-type": "application/json" },
    });
  });
  try {
    const c = new CntIpcFilesClient("c1-p1", "ipc-1", "u-pm");
    const file = new File(["x"], "a.xlsx");
    const preview = await c.importExcel("templates", file, false);
    assert.equal(preview.ok, true);
    assert.equal(preview.data.committed, false);
    assert.ok(!urls[0].includes("commit"), "پیشنمایش نباید commit بفرستد");
    await c.importExcel("measurements", file, true, "C-1");
    assert.ok(urls[1].includes("commit=1"));
    assert.ok(urls[1].includes("contractId=C-1"));
  } finally { restore(); }
});

test("وضعیت PKI و راستیآزمایی فقط اطلاعات عمومی میگیرند", async () => {
  stubFetch(async (url) => {
    const body = String(url).includes("/pki/status")
      ? { ok: true, data: { configured: true, ok: true, required: false, trustLevel: "ca-verified", issuesFa: [], certificate: { KeyId: "k1" } } }
      : { ok: true, data: { ok: true, documentSha256: "d", chain: { ok: true, checked: 2, issuesFa: [] }, pki: { ok: true, checked: 2 }, certificates: [], issuesFa: [] } };
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  });
  try {
    const s = await cntIpcPkiStatus("u-pm");
    assert.equal(s.ok, true);
    assert.equal(s.data.trustLevel, "ca-verified");
    const v = await cntIpcVerifySignatures("c1-p1", "ipc-1", "u-pm");
    assert.equal(v.data.ok, true);
  } finally { restore(); }
});
