/**
 * پیوست‌های گزارش روزانه (DPR) — dprDocApi
 * ------------------------------------------------------------------
 * FIX-3: `server/index.js` این ماژول را import و ثبت می‌کرد ولی فایلش
 * در ریپو نبود و سرور با ERR_MODULE_NOT_FOUND بالا نمی‌آمد.
 *
 * طراحی:
 *  - فایل‌ها زیر `<storageRoot>/dpr/` ذخیره می‌شوند (همان ریشهٔ ذخیرهٔ
 *    `/api/files`، قابل تنظیم با FILE_STORAGE_PATH) — نه داخل ریپو.
 *  - فهرست پیوست‌ها در `<storageRoot>/dpr/_index.json` با نوشتن اتمی
 *    (فایل موقت + rename) نگه داشته می‌شود؛ مستقل از SQL تا در حالت
 *    JSON هم کار کند.
 *  - نوع فایل با همان فهرست مجاز سرور و سقف حجم سرور کنترل می‌شود.
 *  - نام ذخیره تولیدی است؛ نام کاربر فقط برای دانلود استفاده می‌شود.
 *
 * مسیرها:
 *   GET    /api/pex/dpr-docs/health
 *   GET    /api/pex/dpr/:id/documents
 *   POST   /api/pex/dpr/:id/documents            (multipart، فیلد file، note اختیاری)
 *   GET    /api/pex/dpr/:id/documents/:docId      (دانلود)
 *   DELETE /api/pex/dpr/:id/documents/:docId
 */
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

export const DPR_DOC_VERSION = "dprdoc-v1";

/** شناسهٔ DPR: عدد (SQL identity) یا کد کوتاه حرفی‌عددی. */
const DPR_ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
const DOC_ID_RE = /^[a-f0-9-]{36}$/;

const DEFAULT_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
]);

function safeDownloadName(name) {
  const base = path.basename(String(name || "file"));
  return base.replace(/[\u0000-\u001f"\\/:*?<>|]+/g, "_").slice(-180) || "file";
}

function fail(res, req, status, code, message) {
  return res.status(status).json({ ok: false, error: { code, message, traceId: req.requestId } });
}

/**
 * @param {import("express").Express} app
 * @param {{ storageRoot?: string, acceptedMimeTypes?: Set<string>, maxFileBytes?: number }} [opts]
 */
export function registerDprDocRoutes(app, opts = {}) {
  if (!app) throw new Error("registerDprDocRoutes: app is required");

  const root = path.resolve(opts.storageRoot || path.resolve(process.cwd(), "server/storage"));
  const dir = path.join(root, "dpr");
  const indexFile = path.join(dir, "_index.json");
  const accepted = opts.acceptedMimeTypes instanceof Set ? opts.acceptedMimeTypes : DEFAULT_MIME;
  const maxBytes = Number(opts.maxFileBytes) > 0 ? Number(opts.maxFileBytes) : 25 * 1024 * 1024;

  fs.mkdirSync(dir, { recursive: true });

  /** dprId → DprDoc[] (جدیدترین اول) */
  let index = {};
  try {
    if (fs.existsSync(indexFile)) {
      const parsed = JSON.parse(fs.readFileSync(indexFile, "utf8"));
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) index = parsed;
    }
  } catch {
    /* فهرست خراب: با فهرست خالی ادامه می‌دهیم ولی فایل خراب را نگه می‌داریم */
    try { fs.copyFileSync(indexFile, `${indexFile}.corrupt-${Date.now()}`); } catch { /* ignore */ }
    index = {};
  }

  function persist() {
    const tmp = `${indexFile}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(index, null, 2));
    fs.renameSync(tmp, indexFile);
  }

  const upload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, dir),
      filename: (_req, _file, cb) => cb(null, `${Date.now()}-${crypto.randomUUID()}.bin`),
    }),
    limits: { fileSize: maxBytes, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (accepted.has(file.mimetype)) return cb(null, true);
      const err = new Error(`نوع فایل مجاز نیست: ${file.mimetype}`);
      err.code = "UNSUPPORTED_FILE_TYPE";
      cb(err);
    },
  });

  const checkDprId = (req, res, next) => {
    if (!DPR_ID_RE.test(String(req.params.id))) return fail(res, req, 400, "E-DPRDOC-BAD-ID", "شناسهٔ DPR نامعتبر است");
    next();
  };

  const findDoc = (dprId, docId) => (index[dprId] || []).find((d) => d.id === docId) || null;

  app.get("/api/pex/dpr-docs/health", (req, res) => {
    const count = Object.values(index).reduce((n, list) => n + list.length, 0);
    res.json({ ok: true, data: { mounted: true, version: DPR_DOC_VERSION, documents: count }, meta: { traceId: req.requestId } });
  });

  app.get("/api/pex/dpr/:id/documents", checkDprId, (req, res) => {
    const list = (index[req.params.id] || []).map(({ storageKey: _k, ...pub }) => pub);
    res.json({ ok: true, data: list, meta: { traceId: req.requestId } });
  });

  app.post("/api/pex/dpr/:id/documents", checkDprId, (req, res) => {
    upload.single("file")(req, res, (err) => {
      if (err) {
        const tooBig = err.code === "LIMIT_FILE_SIZE";
        const badType = err.code === "UNSUPPORTED_FILE_TYPE";
        return fail(res, req, tooBig ? 413 : badType ? 415 : 400,
          tooBig ? "E-DPRDOC-TOO-LARGE" : badType ? "E-DPRDOC-TYPE" : "E-DPRDOC-UPLOAD",
          tooBig ? `حجم فایل بیش از ${Math.round(maxBytes / 1048576)} مگابایت است` : err.message);
      }
      if (!req.file) return fail(res, req, 400, "E-DPRDOC-NO-FILE", "فایلی در فیلد file ارسال نشده است");
      try {
        const doc = {
          id: crypto.randomUUID(),
          dprId: req.params.id,
          fileName: safeDownloadName(Buffer.from(req.file.originalname, "latin1").toString("utf8")),
          mimeType: req.file.mimetype,
          sizeBytes: req.file.size,
          note: req.body?.note ? String(req.body.note).slice(0, 500) : null,
          uploadedBy: req.headers["x-user-id"] ? String(req.headers["x-user-id"]).slice(0, 100) : null,
          uploadedAt: new Date().toISOString(),
          storageKey: req.file.filename,
        };
        index[doc.dprId] = [doc, ...(index[doc.dprId] || [])];
        persist();
        const { storageKey: _k, ...pub } = doc;
        res.status(201).json({ ok: true, data: pub, meta: { traceId: req.requestId } });
      } catch (e) {
        fs.unlink(req.file.path, () => {});
        fail(res, req, 500, "E-DPRDOC-STORE", e.message);
      }
    });
  });

  app.get("/api/pex/dpr/:id/documents/:docId", checkDprId, (req, res) => {
    if (!DOC_ID_RE.test(String(req.params.docId))) return fail(res, req, 400, "E-DPRDOC-BAD-DOC", "شناسهٔ پیوست نامعتبر است");
    const doc = findDoc(req.params.id, req.params.docId);
    if (!doc) return fail(res, req, 404, "E-DPRDOC-NOT-FOUND", "پیوست پیدا نشد");
    const fp = path.join(dir, path.basename(doc.storageKey));
    if (!fp.startsWith(dir + path.sep) || !fs.existsSync(fp)) return fail(res, req, 404, "E-DPRDOC-MISSING", "فایل پیوست روی دیسک نیست");
    res.type(doc.mimeType);
    res.download(fp, doc.fileName);
  });

  app.delete("/api/pex/dpr/:id/documents/:docId", checkDprId, (req, res) => {
    if (!DOC_ID_RE.test(String(req.params.docId))) return fail(res, req, 400, "E-DPRDOC-BAD-DOC", "شناسهٔ پیوست نامعتبر است");
    const list = index[req.params.id] || [];
    const i = list.findIndex((d) => d.id === req.params.docId);
    if (i < 0) return fail(res, req, 404, "E-DPRDOC-NOT-FOUND", "پیوست پیدا نشد");
    const [doc] = list.splice(i, 1);
    if (list.length) index[req.params.id] = list; else delete index[req.params.id];
    persist();
    fs.promises.unlink(path.join(dir, path.basename(doc.storageKey))).catch(() => {});
    res.json({ ok: true, data: { id: doc.id, deleted: true }, meta: { traceId: req.requestId } });
  });
}

export default { registerDprDocRoutes };
