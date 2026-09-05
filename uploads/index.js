import "dotenv/config";
import express from "express";
import cors from "cors";
import sql from "mssql";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import XLSX from "xlsx";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import jalaali from "jalaali-js";
import nodemailer from "nodemailer";
import { createWorker } from "tesseract.js";

const app = express();
const PORT = Number(process.env.PORT || 4000);
const startedAt = Date.now();
const storageRoot = path.resolve(process.cwd(), process.env.FILE_STORAGE_PATH || "server/storage");
const maxFileBytes = Number(process.env.MAX_FILE_MB || 25) * 1024 * 1024;
const acceptedMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/plain",
  "application/json",
  "application/xml",
  "text/xml",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/bmp",
  "image/tiff",
]);

fs.mkdirSync(storageRoot, { recursive: true });

app.disable("x-powered-by");
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : true,
  credentials: false,
}));
app.use(rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_PER_MINUTE || 300),
  standardHeaders: "draft-7",
  legacyHeaders: false,
}));
app.use(express.json({ limit: "15mb" }));
app.use((req, res, next) => {
  const requestId = req.headers["x-request-id"] || `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  next();
});

const sanitizeFileName = (name) => path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "_").slice(-180) || "upload.bin";
const uploadStorage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, storageRoot),
  filename: (_req, file, callback) => callback(null, `${Date.now()}-${crypto.randomUUID()}-${sanitizeFileName(file.originalname)}`),
});
const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: maxFileBytes, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (acceptedMimeTypes.has(file.mimetype)) return callback(null, true);
    const error = new Error(`Unsupported file type: ${file.mimetype}`);
    error.code = "UNSUPPORTED_FILE_TYPE";
    callback(error);
  },
});

const sha256 = (filePath) => crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");

const toIsoDate = (value) => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const s = String(value).trim();
  if (!s) return null;
  const match = s.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (match) return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
};

const normalizeDigits = (value) => String(value ?? "")
  .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
  .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));

function toSqlDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const normalized = normalizeDigits(value).trim();
  const match = normalized.match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (year < 1700 && jalaali.isValidJalaaliDate(year, month, day)) {
      const gregorian = jalaali.toGregorian(year, month, day);
      return new Date(Date.UTC(gregorian.gy, gregorian.gm - 1, gregorian.gd));
    }
    const date = new Date(Date.UTC(year, month - 1, day));
    if (!Number.isNaN(date.getTime())) return date;
  }
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

const normaliseActivity = (row, index) => {
  const get = (...keys) => keys.map((key) => row[key]).find((value) => value !== undefined && value !== null && String(value).trim() !== "");
  const code = String(get("Activity ID", "ActivityID", "activity_id", "task_code", "Code", "کد فعالیت") || `ACT-${String(index + 1).padStart(4, "0")}`);
  const name = String(get("Activity Name", "Name", "task_name", "Task Name", "نام فعالیت") || code);
  const startDate = toIsoDate(get("Start", "start", "Start Date", "Planned Start", "شروع"));
  const finishDate = toIsoDate(get("Finish", "finish", "Finish Date", "Planned Finish", "پایان"));
  const durationDays = Number(get("Duration", "duration", "Original Duration", "مدت") || 0) || null;
  const progress = Number(String(get("Progress", "% Complete", "Physical % Complete", "درصد پیشرفت") || "0").replace("%", "")) || 0;
  const isCritical = ["y", "yes", "true", "1", "critical", "بله"].includes(String(get("Critical", "critical", "Is Critical", "بحرانی") || "").toLowerCase());
  const wbsCode = String(get("WBS", "WBS Code", "wbs_code", "کد WBS") || "");
  return { code, name, startDate, finishDate, durationDays, progress, isCritical, wbsCode };
};

function parseXer(content) {
  const lines = content.split(/\r?\n/);
  const tableRows = [];
  let columns = [];
  let inTask = false;
  for (const line of lines) {
    if (line.startsWith("%T")) {
      inTask = line.includes("TASK");
      columns = [];
      continue;
    }
    if (!inTask) continue;
    if (line.startsWith("%F")) {
      columns = line.slice(2).split("\t").map((col) => col.trim());
      continue;
    }
    if (line.startsWith("%R") && columns.length) {
      const values = line.slice(2).split("\t");
      const row = Object.fromEntries(columns.map((col, i) => [col, values[i] ?? ""]));
      tableRows.push({
        activity_id: row.task_code || row.task_id || row.clndr_id,
        task_name: row.task_name || row.task_code || "Primavera Activity",
        start: row.early_start_date || row.target_start_date || row.act_start_date,
        finish: row.early_end_date || row.target_end_date || row.act_end_date,
        duration: row.target_drtn_hr_cnt ? Math.round(Number(row.target_drtn_hr_cnt) / 8) : undefined,
        critical: row.driving_path_flag === "Y" || row.float_path === "1",
      });
    }
  }
  return tableRows.map(normaliseActivity);
}

function parseSpreadsheet(filePath, ext) {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });
  return rows.map(normaliseActivity);
}

function parseScheduleFile(filePath, originalName) {
  const ext = path.extname(originalName).toLowerCase();
  if (ext === ".xer") return parseXer(fs.readFileSync(filePath, "utf8"));
  if ([".xlsx", ".xls", ".csv"].includes(ext)) return parseSpreadsheet(filePath, ext);
  if (ext === ".mpp") {
    const error = new Error("MPP parsing requires an external MPXJ/Project conversion service. Upload XML/XER/XLSX or configure MSP_PARSER_URL.");
    error.code = "MPP_PARSER_REQUIRED";
    throw error;
  }
  const error = new Error(`Unsupported schedule import format: ${ext}`);
  error.code = "UNSUPPORTED_SCHEDULE_FORMAT";
  throw error;
}

async function extractKnowledgeText(file) {
  const extension = path.extname(file.originalname).toLowerCase();
  if (extension === ".pdf") {
    const parser = new PDFParse({ data: fs.readFileSync(file.path) });
    try {
      const result = await parser.getText();
      return result.text || "";
    } finally {
      await parser.destroy();
    }
  }
  if (extension === ".docx") {
    const result = await mammoth.extractRawText({ buffer: fs.readFileSync(file.path) });
    return result.value || "";
  }
  if ([".txt", ".csv", ".json", ".xml"].includes(extension)) {
    return fs.readFileSync(file.path, "utf8");
  }
  const error = new Error(`Text extraction is not supported for ${extension}. Use PDF, DOCX, TXT, CSV, JSON or XML.`);
  error.code = "UNSUPPORTED_KNOWLEDGE_FORMAT";
  throw error;
}

async function extractOcrText(file, languageCode = "fas+eng") {
  const extension = path.extname(file.originalname).toLowerCase();
  if ([".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff"].includes(extension)) {
    const langs = String(languageCode).includes("+") ? String(languageCode).split("+") : languageCode;
    const worker = await createWorker(langs);
    try {
      const result = await worker.recognize(file.path);
      return { text: result.data.text || "", confidence: Number(result.data.confidence || 0), engine: "tesseract.js" };
    } finally {
      await worker.terminate();
    }
  }
  if (extension === ".pdf" && process.env.OCR_PDF_SERVICE_URL) {
    const form = new FormData();
    form.append("language", languageCode);
    form.append("file", new Blob([fs.readFileSync(file.path)], { type: file.mimetype }), file.originalname);
    const response = await fetch(process.env.OCR_PDF_SERVICE_URL, { method: "POST", body: form });
    if (!response.ok) throw new Error(`OCR PDF service returned HTTP ${response.status}`);
    const payload = await response.json();
    return { text: payload.text || "", confidence: Number(payload.confidence || 0), engine: "external-pdf-ocr" };
  }
  if (extension === ".pdf") {
    const error = new Error("Scanned PDF OCR requires OCR_PDF_SERVICE_URL or conversion to page images. Upload image scans or configure OCR service.");
    error.code = "OCR_PDF_SERVICE_REQUIRED";
    throw error;
  }
  const error = new Error(`OCR is not supported for ${extension}. Upload PNG/JPG/WebP/BMP/TIFF or configure PDF OCR service.`);
  error.code = "UNSUPPORTED_OCR_FORMAT";
  throw error;
}

function chunkText(text, maxChars = 1400, overlap = 180) {
  const normalized = text.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (!normalized) return [];
  const paragraphs = normalized.split(/\n\n+/).filter(Boolean);
  const chunks = [];
  let current = "";
  for (const paragraph of paragraphs) {
    if ((current + "\n\n" + paragraph).length <= maxChars) {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
      continue;
    }
    if (current) chunks.push(current);
    if (paragraph.length <= maxChars) {
      current = paragraph;
      continue;
    }
    for (let start = 0; start < paragraph.length; start += maxChars - overlap) {
      chunks.push(paragraph.slice(start, start + maxChars));
    }
    current = "";
  }
  if (current) chunks.push(current);
  return chunks;
}

const tokenizeQuestion = (question) => [...new Set(String(question).toLowerCase().match(/[\p{L}\p{N}_-]{3,}/gu) || [])].slice(0, 16);

function rankChunks(rows, question) {
  const terms = tokenizeQuestion(question);
  return rows.map((row) => {
    const content = String(row.Content || "").toLowerCase();
    const score = terms.reduce((sum, term) => sum + (content.includes(term) ? 1 : 0), 0);
    return { ...row, score };
  }).filter((row) => row.score > 0).sort((a, b) => b.score - a.score || a.ChunkIndex - b.ChunkIndex).slice(0, 6);
}

async function callGroundedAi(question, sources) {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey || !sources.length) return null;
  const context = sources.map((source, index) => `[S${index + 1}] ${source.DocumentTitle}\n${source.Content}`).join("\n\n");
  const response = await fetch(process.env.AI_RESPONSES_URL || "https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.AI_MODEL || "gpt-4.1-mini",
      instructions: "Answer only from the supplied project sources. Cite claims with [S1], [S2]. If evidence is insufficient, state that clearly. Keep contract and engineering terminology precise.",
      input: `Question: ${question}\n\nProject sources:\n${context}`,
      max_output_tokens: 900,
    }),
  });
  if (!response.ok) throw new Error(`AI provider returned HTTP ${response.status}`);
  const payload = await response.json();
  return payload.output_text || payload.output?.flatMap((item) => item.content || []).find((item) => item.type === "output_text")?.text || null;
}

async function writeAudit(pool, req, actionCode, details = {}) {
  try {
    await pool.request()
      .input("ProjectCode", sql.NVarChar(50), details.projectCode || null)
      .input("ActionCode", sql.NVarChar(80), actionCode)
      .input("EntityName", sql.NVarChar(100), details.entityName || null)
      .input("EntityId", sql.NVarChar(100), details.entityId || null)
      .input("AfterJson", sql.NVarChar(sql.MAX), JSON.stringify({ requestId: req.requestId, ...details }))
      .input("IpAddress", sql.NVarChar(60), req.ip || null)
      .query("INSERT INTO dbo.Audit_Log (ProjectCode, ActionCode, EntityName, EntityId, AfterJson, IpAddress) VALUES (@ProjectCode, @ActionCode, @EntityName, @EntityId, @AfterJson, @IpAddress)");
  } catch {
    // Audit failure must not block business data, but is visible through readiness/audit review.
  }
}

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

function smsConfigured() {
  return Boolean(process.env.SMS_WEBHOOK_URL);
}

async function sendEmail(notification) {
  if (!smtpConfigured()) throw new Error("SMTP is not configured");
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD || "" } : undefined,
  });
  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: notification.Recipient,
    subject: notification.Subject || "PMIS Notification",
    text: notification.Body,
  });
  return `SMTP accepted: ${info.messageId || "ok"}`;
}

async function sendSms(notification) {
  if (!smsConfigured()) throw new Error("SMS_WEBHOOK_URL is not configured");
  const response = await fetch(process.env.SMS_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(process.env.SMS_WEBHOOK_TOKEN ? { Authorization: `Bearer ${process.env.SMS_WEBHOOK_TOKEN}` } : {}) },
    body: JSON.stringify({ to: notification.Recipient, message: notification.Body, subject: notification.Subject, projectCode: notification.ProjectCode }),
  });
  if (!response.ok) throw new Error(`SMS webhook returned HTTP ${response.status}`);
  return await response.text();
}

async function createNotification(pool, req, input) {
  const result = await pool.request()
    .input("ProjectCode", sql.NVarChar(50), input.projectCode || null)
    .input("Channel", sql.NVarChar(20), input.channel || "in_app")
    .input("Recipient", sql.NVarChar(300), input.recipient || "system")
    .input("Subject", sql.NVarChar(300), input.subject || null)
    .input("Body", sql.NVarChar(sql.MAX), input.body || "PMIS notification")
    .input("Priority", sql.NVarChar(20), input.priority || "normal")
    .input("RelatedEntity", sql.NVarChar(100), input.relatedEntity || null)
    .input("RelatedEntityId", sql.NVarChar(100), input.relatedEntityId || null)
    .query(`INSERT INTO dbo.Notification_Queue (ProjectCode, Channel, Recipient, Subject, Body, Priority, RelatedEntity, RelatedEntityId) VALUES (@ProjectCode, @Channel, @Recipient, @Subject, @Body, @Priority, @RelatedEntity, @RelatedEntityId); SELECT SCOPE_IDENTITY() AS id;`);
  const id = Number(result.recordset[0].id);
  await writeAudit(pool, req, "CREATE_NOTIFICATION", { projectCode: input.projectCode, entityName: "Notification_Queue", entityId: String(id), channel: input.channel });
  return id;
}

async function deliverNotification(pool, req, id) {
  const q = await pool.request().input("Id", sql.BigInt, Number(id)).query("SELECT TOP 1 * FROM dbo.Notification_Queue WHERE Id = @Id");
  const notification = q.recordset[0];
  if (!notification) throw new Error("Notification was not found");
  let status = "sent";
  let responseText = "in-app queued";
  let provider = notification.Channel;
  try {
    if (notification.Channel === "email") {
      provider = "smtp";
      responseText = await sendEmail(notification);
    } else if (notification.Channel === "sms") {
      provider = "sms-webhook";
      responseText = await sendSms(notification);
    }
    await pool.request().input("Id", sql.BigInt, Number(id)).query("UPDATE dbo.Notification_Queue SET Status = 'sent', Attempts = Attempts + 1, LastError = NULL, SentAt = GETUTCDATE() WHERE Id = @Id");
  } catch (error) {
    status = "failed";
    responseText = error.message;
    await pool.request().input("Id", sql.BigInt, Number(id)).input("LastError", sql.NVarChar(1000), error.message).query("UPDATE dbo.Notification_Queue SET Status = 'failed', Attempts = Attempts + 1, LastError = @LastError WHERE Id = @Id");
  }
  await pool.request().input("NotificationId", sql.BigInt, Number(id)).input("Channel", sql.NVarChar(20), notification.Channel).input("Provider", sql.NVarChar(80), provider).input("Status", sql.NVarChar(30), status).input("ResponseText", sql.NVarChar(sql.MAX), responseText).query("INSERT INTO dbo.Notification_Delivery_Log (NotificationId, Channel, Provider, Status, ResponseText) VALUES (@NotificationId, @Channel, @Provider, @Status, @ResponseText)");
  await writeAudit(pool, req, "DELIVER_NOTIFICATION", { projectCode: notification.ProjectCode, entityName: "Notification_Queue", entityId: String(id), channel: notification.Channel, status });
  return { id: String(id), channel: notification.Channel, status, responseText };
}

function getSqlConfig(req) {
  const serverHeader = req.headers["x-sql-server"] || process.env.SQL_SERVER || ".\\SQL2008EXPRESS";
  const databaseHeader = req.headers["x-sql-database"] || process.env.SQL_DATABASE || "PMIS_MASTER_DB";
  const parts = String(serverHeader).split("\\");
  const serverName = parts[0] || "localhost";
  const instanceName = parts[1] || undefined;

  const config = {
    server: serverName,
    database: databaseHeader,
    options: {
      instanceName,
      encrypt: process.env.SQL_ENCRYPT === "true",
      trustServerCertificate: process.env.SQL_TRUST_CERT !== "false",
    },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
    connectionTimeout: 15000,
  };

  if (process.env.SQL_USER) {
    config.user = process.env.SQL_USER;
    config.password = process.env.SQL_PASSWORD || "";
  }
  return config;
}

let poolCache = null;
async function getPool(req) {
  if (!poolCache) {
    const config = getSqlConfig(req);
    poolCache = await new sql.ConnectionPool(config).connect();
  }
  return poolCache;
}

const rolePermissions = {
  admin: ["system.manage", "portfolio.view", "project.view", "project.edit", "report.daily.edit", "report.approve", "schedule.edit", "risk.edit", "claim.edit", "cost.view", "ai.run"],
  project_manager: ["portfolio.view", "project.view", "project.edit", "report.daily.edit", "report.approve", "schedule.edit", "risk.edit", "claim.edit", "cost.view", "ai.run"],
  planner: ["portfolio.view", "project.view", "schedule.edit", "report.daily.edit", "ai.run"],
  site_engineer: ["project.view", "report.daily.edit"],
  consultant: ["portfolio.view", "project.view", "report.approve", "risk.edit", "claim.edit"],
  client: ["portfolio.view", "project.view", "report.approve", "cost.view"],
  executive: ["portfolio.view", "project.view", "cost.view", "ai.run"],
};

/* ─────────────────── Health / Readiness / Integrations ─────────────────── */
app.get("/api/health", async (req, res) => {
  try {
    const pool = await getPool(req);
    const result = await pool.request().query("SELECT @@VERSION AS version, DB_NAME() AS [database]");
    res.json({
      ok: true,
      data: {
        status: "healthy",
        version: result.recordset[0].version,
        database: result.recordset[0].database,
        timestamp: new Date().toISOString(),
      },
      meta: { traceId: req.requestId, timestamp: new Date().toISOString() },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "DB_CONNECTION_ERROR", message: err.message, traceId: req.requestId } });
  }
});

app.post("/api/health", async (req, res) => {
  try {
    const inputServer = req.body.server || process.env.SQL_SERVER || ".\\SQL2008EXPRESS";
    const parts = String(inputServer).split("\\");
    const testConfig = {
      server: parts[0] || "localhost",
      database: req.body.database || process.env.SQL_DATABASE || "PMIS_MASTER_DB",
      options: {
        instanceName: parts[1] || undefined,
        encrypt: false,
        trustServerCertificate: true,
      },
      user: req.body.user || process.env.SQL_USER || undefined,
      password: req.body.password || process.env.SQL_PASSWORD || undefined,
    };
    const pool = await new sql.ConnectionPool(testConfig).connect();
    const result = await pool.request().query("SELECT @@VERSION AS version, DB_NAME() AS [database]");
    await pool.close();
    res.json({ ok: true, data: { version: result.recordset[0].version, database: result.recordset[0].database }, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "DB_TEST_FAILED", message: err.message, traceId: req.requestId } });
  }
});

app.get("/api/diagnostics/readiness", async (req, res) => {
  const checks = [];
  const configuredIntegrations = [
    ["Primavera P6", "P6_API_URL"],
    ["SAP / ERP", "SAP_API_URL"],
    ["Power BI", "POWERBI_WORKSPACE_ID"],
    ["CMMS", "CMMS_API_URL"],
    ["IoT / MQTT", "MQTT_BROKER_URL"],
    ["DMS", "DMS_API_URL"],
    ["AI Gateway", "AI_API_KEY"],
    ["PDF OCR Service", "OCR_PDF_SERVICE_URL"],
  ];

  checks.push({ key: "runtime", label: "Node API runtime", status: "pass", detail: `uptime ${Math.round(process.uptime())}s` });
  checks.push({ key: "cors", label: "CORS policy", status: process.env.CORS_ORIGIN ? "pass" : "warn", detail: process.env.CORS_ORIGIN || "development: reflected origin" });
  checks.push({ key: "sql-secret", label: "SQL credentials", status: process.env.SQL_USER ? "pass" : "warn", detail: process.env.SQL_USER ? "configured by environment" : "SQL_USER is not configured" });
  try {
    fs.accessSync(storageRoot, fs.constants.R_OK | fs.constants.W_OK);
    checks.push({ key: "file-storage", label: "File object storage", status: "pass", detail: storageRoot });
  } catch (error) {
    checks.push({ key: "file-storage", label: "File object storage", status: "fail", detail: error.message });
  }
  checks.push({ key: "backup", label: "Backup job", status: process.env.BACKUP_LAST_SUCCESS_AT ? "pass" : "warn", detail: process.env.BACKUP_LAST_SUCCESS_AT || "BACKUP_LAST_SUCCESS_AT not configured" });

  try {
    const pool = await getPool(req);
    const requiredObjects = [
      "Industry_Master", "Project_Master", "System_User", "Role_Master",
      "Project_User_Access", "Audit_Log", "File_Object", "Report_Template",
      "Knowledge_Document", "Document_Chunk", "OCR_Job",
      "Notification_Queue", "Notification_Delivery_Log",
      "Project_WBS", "Schedule_Activity", "Daily_Report", "KPI_Value",
      "EVM_Transaction", "Risk_Register", "Change_Request", "Claim_Register",
    ];
    const objectQuery = requiredObjects
      .map((name, index) => `SELECT '${name}' AS ObjectName, OBJECT_ID('dbo.${name}') AS ObjectId${index < requiredObjects.length - 1 ? " UNION ALL " : ""}`)
      .join("");
    const result = await pool.request().query(objectQuery);
    const missing = result.recordset.filter((row) => !row.ObjectId).map((row) => row.ObjectName);
    checks.push({ key: "database", label: "SQL Server connection", status: "pass", detail: getSqlConfig(req).database });
    checks.push({ key: "schema", label: "PMIS schema", status: missing.length ? "fail" : "pass", detail: missing.length ? `missing: ${missing.join(", ")}` : `${requiredObjects.length} required objects found` });
  } catch (error) {
    checks.push({ key: "database", label: "SQL Server connection", status: "fail", detail: error.message });
    checks.push({ key: "schema", label: "PMIS schema", status: "blocked", detail: "database unavailable" });
  }

  configuredIntegrations.forEach(([label, envKey]) => {
    const value = process.env[envKey];
    checks.push({ key: `integration-${envKey.toLowerCase()}`, label, status: value ? "pass" : "warn", detail: value ? "configured" : `${envKey} not configured` });
  });

  const failures = checks.filter((check) => check.status === "fail").length;
  const warnings = checks.filter((check) => check.status === "warn" || check.status === "blocked").length;
  res.status(failures ? 503 : 200).json({
    ok: failures === 0,
    data: {
      status: failures ? "not-ready" : warnings ? "ready-with-warnings" : "ready",
      service: "pmis-api",
      version: "1.1.0",
      startedAt: new Date(startedAt).toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      checks,
      summary: { total: checks.length, passed: checks.filter((check) => check.status === "pass").length, warnings, failures },
    },
    meta: { traceId: req.requestId, timestamp: new Date().toISOString() },
  });
});

app.get("/api/integrations/status", (req, res) => {
  const items = [
    { id: "p6", name: "Primavera P6", configured: Boolean(process.env.P6_API_URL), mode: process.env.P6_API_URL ? "api" : "file-import" },
    { id: "msp", name: "Microsoft Project", configured: true, mode: "file-import" },
    { id: "sap", name: "ERP / SAP", configured: Boolean(process.env.SAP_API_URL), mode: "rest-odata" },
    { id: "powerbi", name: "Power BI", configured: Boolean(process.env.POWERBI_WORKSPACE_ID), mode: "embedded" },
    { id: "cmms", name: "CMMS", configured: Boolean(process.env.CMMS_API_URL), mode: "rest" },
    { id: "iot", name: "IoT Sensors", configured: Boolean(process.env.MQTT_BROKER_URL), mode: "mqtt" },
    { id: "dms", name: "DMS", configured: Boolean(process.env.DMS_API_URL), mode: "rest" },
  ];
  res.json({ ok: true, data: items, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
});

/* ──────────────────────── Auth / RBAC / Audit ──────────────────────── */
app.post("/api/auth/login", async (req, res) => {
  const username = req.body.username || "admin";
  const roleCode = req.body.roleCode || "admin";
  res.json({ ok: true, data: { token: `demo-token-${Date.now()}`, user: { id: username, username, displayName: username === "admin" ? "Mohammadreza Hashemipour" : username, roleCode, projectCodes: ["*"] } }, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
});
app.get("/api/auth/me", async (req, res) => res.json({ ok: true, data: { id: "admin", username: "admin", displayName: "Mohammadreza Hashemipour", roleCode: "admin", projectCodes: ["*"] }, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } }));
app.get("/api/roles", async (req, res) => res.json({ ok: true, data: Object.entries(rolePermissions).map(([code, permissions]) => ({ code, titleFa: code, titleEn: code, permissions })), meta: { traceId: req.requestId, timestamp: new Date().toISOString() } }));
app.get("/api/users", async (req, res) => {
  try {
    const pool = await getPool(req);
    const result = await pool.request().query(`SELECT CAST(Id AS NVARCHAR(20)) AS id, UserName AS username, DisplayName AS displayName, Email AS email, 'project_manager' AS roleCode FROM dbo.System_User WHERE IsActive = 1 ORDER BY Id DESC`);
    res.json({ ok: true, data: result.recordset, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch {
    res.json({ ok: true, data: [], meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  }
});
app.get("/api/audit", async (req, res) => {
  try {
    const pool = await getPool(req);
    const result = await pool.request().query(`SELECT TOP 200 CAST(Id AS NVARCHAR(30)) AS id, CAST(UserId AS NVARCHAR(30)) AS userId, ProjectCode AS projectCode, ActionCode AS actionCode, EntityName AS entityName, EntityId AS entityId, CreatedAt AS createdAt FROM dbo.Audit_Log ORDER BY Id DESC`);
    res.json({ ok: true, data: result.recordset, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch {
    res.json({ ok: true, data: [], meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  }
});

/* ──────────────────────── Notifications ──────────────────────── */
app.get("/api/notifications", async (req, res) => {
  try {
    const pool = await getPool(req);
    const status = req.query.status;
    const projectCode = req.query.projectCode;
    const request = pool.request();
    let query = `SELECT TOP 200 CAST(Id AS NVARCHAR(30)) AS id, ProjectCode AS projectCode, Channel AS channel, Recipient AS recipient, Subject AS subject, Body AS body, Priority AS priority, Status AS status, RelatedEntity AS relatedEntity, RelatedEntityId AS relatedEntityId, Attempts AS attempts, LastError AS lastError, CONVERT(NVARCHAR(30), CreatedAt, 126) AS createdAt, CONVERT(NVARCHAR(30), SentAt, 126) AS sentAt FROM dbo.Notification_Queue WHERE 1=1`;
    if (status) { query += " AND Status = @Status"; request.input("Status", sql.NVarChar(30), status); }
    if (projectCode) { query += " AND ProjectCode = @ProjectCode"; request.input("ProjectCode", sql.NVarChar(50), projectCode); }
    query += " ORDER BY Id DESC";
    const result = await request.query(query);
    res.json({ ok: true, data: result.recordset, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "NOTIFICATION_LIST_ERROR", message: err.message, traceId: req.requestId } });
  }
});

app.post("/api/notifications", async (req, res) => {
  try {
    const pool = await getPool(req);
    const id = await createNotification(pool, req, req.body);
    res.status(201).json({ ok: true, data: { id: String(id), status: "pending" }, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "NOTIFICATION_CREATE_ERROR", message: err.message, traceId: req.requestId } });
  }
});

app.post("/api/notifications/:id/send", async (req, res) => {
  try {
    const pool = await getPool(req);
    const delivery = await deliverNotification(pool, req, req.params.id);
    res.json({ ok: true, data: delivery, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "NOTIFICATION_SEND_ERROR", message: err.message, traceId: req.requestId } });
  }
});

app.post("/api/notifications/test", async (req, res) => {
  try {
    const pool = await getPool(req);
    const id = await createNotification(pool, req, {
      projectCode: req.body.projectCode,
      channel: req.body.channel || "in_app",
      recipient: req.body.recipient || "system",
      subject: "PMIS test notification",
      body: req.body.body || "This is a PMIS delivery test.",
      priority: "normal",
      relatedEntity: "System",
      relatedEntityId: "test",
    });
    const delivery = await deliverNotification(pool, req, id);
    res.json({ ok: true, data: delivery, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "NOTIFICATION_TEST_ERROR", message: err.message, traceId: req.requestId } });
  }
});

/* ──────────────────────── File Object Storage ──────────────────────── */
app.post("/api/files", upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ ok: false, error: { code: "FILE_REQUIRED", message: "Upload a file in the file field", traceId: req.requestId } });

  try {
    const fileId = crypto.randomUUID();
    const checksum = sha256(file.path);
    const pool = await getPool(req);
    await pool.request()
      .input("Id", sql.UniqueIdentifier, fileId)
      .input("FileName", sql.NVarChar(300), file.originalname)
      .input("MimeType", sql.NVarChar(150), file.mimetype)
      .input("SizeBytes", sql.BigInt, file.size)
      .input("StorageKey", sql.NVarChar(600), file.filename)
      .input("ChecksumSha256", sql.NVarChar(128), checksum)
      .query("INSERT INTO dbo.File_Object (Id, FileName, MimeType, SizeBytes, StorageKey, ChecksumSha256) VALUES (@Id, @FileName, @MimeType, @SizeBytes, @StorageKey, @ChecksumSha256)");
    await writeAudit(pool, req, "UPLOAD_FILE", { entityName: "File_Object", entityId: fileId, projectCode: req.body.projectCode || null, fileName: file.originalname });
    res.status(201).json({ ok: true, data: { id: fileId, fileName: file.originalname, mimeType: file.mimetype, sizeBytes: file.size, checksum, downloadUrl: `/api/files/${fileId}/download` }, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    fs.unlink(file.path, () => {});
    res.status(500).json({ ok: false, error: { code: "FILE_STORE_ERROR", message: err.message, traceId: req.requestId } });
  }
});

app.get("/api/files/:id", async (req, res) => {
  try {
    const pool = await getPool(req);
    const result = await pool.request().input("Id", sql.UniqueIdentifier, req.params.id).query("SELECT CAST(Id AS NVARCHAR(36)) AS id, FileName AS fileName, MimeType AS mimeType, SizeBytes AS sizeBytes, ChecksumSha256 AS checksum FROM dbo.File_Object WHERE Id = @Id AND IsDeleted = 0");
    const record = result.recordset[0];
    if (!record) return res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "File was not found", traceId: req.requestId } });
    res.json({ ok: true, data: { ...record, downloadUrl: `/api/files/${record.id}/download` }, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "FILE_LOOKUP_ERROR", message: err.message, traceId: req.requestId } });
  }
});

app.get("/api/files/:id/download", async (req, res) => {
  try {
    const pool = await getPool(req);
    const result = await pool.request().input("Id", sql.UniqueIdentifier, req.params.id).query("SELECT FileName, MimeType, StorageKey FROM dbo.File_Object WHERE Id = @Id AND IsDeleted = 0");
    const record = result.recordset[0];
    if (!record) return res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "File was not found", traceId: req.requestId } });
    const filePath = path.resolve(storageRoot, path.basename(record.StorageKey));
    if (!filePath.startsWith(storageRoot) || !fs.existsSync(filePath)) return res.status(404).json({ ok: false, error: { code: "FILE_MISSING", message: "File object metadata exists but content is unavailable", traceId: req.requestId } });
    res.type(record.MimeType);
    res.download(filePath, sanitizeFileName(record.FileName));
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "FILE_DOWNLOAD_ERROR", message: err.message, traceId: req.requestId } });
  }
});

/* ──────────────────────── Project Knowledge / RAG ──────────────────────── */
app.post("/api/projects/:projectId/knowledge/ingest", upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ ok: false, error: { code: "FILE_REQUIRED", message: "Upload a knowledge document in the file field", traceId: req.requestId } });
  const projectCode = req.params.projectId;
  const knowledgeId = crypto.randomUUID();
  const fileId = crypto.randomUUID();
  try {
    const text = await extractKnowledgeText(file);
    const chunks = chunkText(text);
    if (!chunks.length) throw new Error("No extractable text was found. Scanned PDFs require an OCR service.");
    const checksum = sha256(file.path);
    const languageCode = /[\u0600-\u06FF]/.test(text.slice(0, 4000)) ? "fa" : "en";
    const pool = await getPool(req);
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      await new sql.Request(transaction)
        .input("Id", sql.UniqueIdentifier, fileId)
        .input("FileName", sql.NVarChar(300), file.originalname)
        .input("MimeType", sql.NVarChar(150), file.mimetype)
        .input("SizeBytes", sql.BigInt, file.size)
        .input("StorageKey", sql.NVarChar(600), file.filename)
        .input("ChecksumSha256", sql.NVarChar(128), checksum)
        .query("INSERT INTO dbo.File_Object (Id, FileName, MimeType, SizeBytes, StorageKey, ChecksumSha256) VALUES (@Id, @FileName, @MimeType, @SizeBytes, @StorageKey, @ChecksumSha256)");
      await new sql.Request(transaction)
        .input("Id", sql.UniqueIdentifier, knowledgeId)
        .input("ProjectCode", sql.NVarChar(50), projectCode)
        .input("FileId", sql.UniqueIdentifier, fileId)
        .input("DocumentType", sql.NVarChar(50), req.body.documentType || "project_document")
        .input("Title", sql.NVarChar(400), req.body.title || file.originalname.replace(/\.[^.]+$/, ""))
        .input("LanguageCode", sql.NVarChar(10), languageCode)
        .input("CharacterCount", sql.Int, text.length)
        .input("ChunkCount", sql.Int, chunks.length)
        .query("INSERT INTO dbo.Knowledge_Document (Id, ProjectCode, FileId, DocumentType, Title, LanguageCode, ExtractionStatus, CharacterCount, ChunkCount) VALUES (@Id, @ProjectCode, @FileId, @DocumentType, @Title, @LanguageCode, 'ready', @CharacterCount, @ChunkCount)");
      for (let index = 0; index < chunks.length; index += 1) {
        const content = chunks[index];
        await new sql.Request(transaction)
          .input("KnowledgeDocumentId", sql.UniqueIdentifier, knowledgeId)
          .input("ProjectCode", sql.NVarChar(50), projectCode)
          .input("ChunkIndex", sql.Int, index)
          .input("Content", sql.NVarChar(sql.MAX), content)
          .input("SearchText", sql.NVarChar(2000), content.slice(0, 2000).toLowerCase())
          .input("TokenEstimate", sql.Int, Math.ceil(content.length / 4))
          .query("INSERT INTO dbo.Document_Chunk (KnowledgeDocumentId, ProjectCode, ChunkIndex, Content, SearchText, TokenEstimate) VALUES (@KnowledgeDocumentId, @ProjectCode, @ChunkIndex, @Content, @SearchText, @TokenEstimate)");
      }
      await transaction.commit();
      await writeAudit(pool, req, "INGEST_KNOWLEDGE_DOCUMENT", { projectCode, entityName: "Knowledge_Document", entityId: knowledgeId, fileName: file.originalname, chunks: chunks.length });
      res.status(201).json({ ok: true, data: { id: knowledgeId, projectId: projectCode, fileId, title: req.body.title || file.originalname, documentType: req.body.documentType || "project_document", languageCode, characterCount: text.length, chunkCount: chunks.length, status: "ready", fileName: file.originalname }, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
    } catch (error) {
      await transaction.rollback().catch(() => {});
      throw error;
    }
  } catch (err) {
    fs.unlink(file.path, () => {});
    res.status(500).json({ ok: false, error: { code: err.code || "KNOWLEDGE_INGEST_ERROR", message: err.message, traceId: req.requestId } });
  }
});

app.get("/api/projects/:projectId/knowledge/documents", async (req, res) => {
  try {
    const pool = await getPool(req);
    const result = await pool.request().input("ProjectCode", sql.NVarChar(50), req.params.projectId).query(`
      SELECT CAST(kd.Id AS NVARCHAR(36)) AS id, kd.ProjectCode AS projectId, CAST(kd.FileId AS NVARCHAR(36)) AS fileId,
        kd.Title AS title, kd.DocumentType AS documentType, kd.LanguageCode AS languageCode,
        kd.CharacterCount AS characterCount, kd.ChunkCount AS chunkCount, kd.ExtractionStatus AS status,
        fo.FileName AS fileName
      FROM dbo.Knowledge_Document kd
      INNER JOIN dbo.File_Object fo ON fo.Id = kd.FileId AND fo.IsDeleted = 0
      WHERE kd.ProjectCode = @ProjectCode ORDER BY kd.CreatedAt DESC
    `);
    res.json({ ok: true, data: result.recordset, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "KNOWLEDGE_LIST_ERROR", message: err.message, traceId: req.requestId } });
  }
});

app.post("/api/projects/:projectId/knowledge/ask", async (req, res) => {
  const question = String(req.body.question || "").trim();
  if (question.length < 3) return res.status(400).json({ ok: false, error: { code: "QUESTION_REQUIRED", message: "Enter a valid question", traceId: req.requestId } });
  try {
    const pool = await getPool(req);
    const result = await pool.request().input("ProjectCode", sql.NVarChar(50), req.params.projectId).query(`
      SELECT TOP 500 dc.ChunkIndex, dc.Content, CAST(kd.Id AS NVARCHAR(36)) AS DocumentId,
        kd.Title AS DocumentTitle, fo.FileName
      FROM dbo.Document_Chunk dc
      INNER JOIN dbo.Knowledge_Document kd ON kd.Id = dc.KnowledgeDocumentId
      INNER JOIN dbo.File_Object fo ON fo.Id = kd.FileId AND fo.IsDeleted = 0
      WHERE dc.ProjectCode = @ProjectCode AND kd.ExtractionStatus = 'ready'
      ORDER BY kd.CreatedAt DESC, dc.ChunkIndex ASC
    `);
    const ranked = rankChunks(result.recordset, question);
    const sources = ranked.map((row) => ({ documentId: row.DocumentId, documentTitle: row.DocumentTitle, fileName: row.FileName, chunkIndex: row.ChunkIndex, excerpt: String(row.Content).slice(0, 500), score: row.score }));
    let answer = ranked.length
      ? `Relevant evidence was found in ${new Set(ranked.map((row) => row.DocumentId)).size} document(s). Review the cited excerpts before making a contractual or engineering decision.`
      : "No relevant evidence was found in the indexed project documents.";
    let mode = "extractive";
    let model;
    try {
      const aiAnswer = await callGroundedAi(question, ranked);
      if (aiAnswer) {
        answer = aiAnswer;
        mode = "ai";
        model = process.env.AI_MODEL || "gpt-4.1-mini";
      }
    } catch (error) {
      answer += ` AI provider was unavailable: ${error.message}`;
    }
    await writeAudit(pool, req, "ASK_PROJECT_KNOWLEDGE", { projectCode: req.params.projectId, entityName: "Document_Chunk", question, sources: sources.map((source) => source.documentId) });
    res.json({ ok: true, data: { answer, mode, model, sources }, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "RAG_QUERY_ERROR", message: err.message, traceId: req.requestId } });
  }
});

app.post("/api/projects/:projectId/ocr/ingest", upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ ok: false, error: { code: "FILE_REQUIRED", message: "Upload a scanned image or PDF in the file field", traceId: req.requestId } });
  const projectCode = req.params.projectId;
  const jobId = crypto.randomUUID();
  const fileId = crypto.randomUUID();
  const languageCode = req.body.languageCode || "fas+eng";
  const title = req.body.title || file.originalname.replace(/\.[^.]+$/, "");

  try {
    const pool = await getPool(req);
    const checksum = sha256(file.path);
    await pool.request()
      .input("Id", sql.UniqueIdentifier, fileId)
      .input("FileName", sql.NVarChar(300), file.originalname)
      .input("MimeType", sql.NVarChar(150), file.mimetype)
      .input("SizeBytes", sql.BigInt, file.size)
      .input("StorageKey", sql.NVarChar(600), file.filename)
      .input("ChecksumSha256", sql.NVarChar(128), checksum)
      .query("INSERT INTO dbo.File_Object (Id, FileName, MimeType, SizeBytes, StorageKey, ChecksumSha256) VALUES (@Id, @FileName, @MimeType, @SizeBytes, @StorageKey, @ChecksumSha256)");
    await pool.request()
      .input("Id", sql.UniqueIdentifier, jobId)
      .input("ProjectCode", sql.NVarChar(50), projectCode)
      .input("FileId", sql.UniqueIdentifier, fileId)
      .input("Engine", sql.NVarChar(80), "pending")
      .input("LanguageCode", sql.NVarChar(50), languageCode)
      .query("INSERT INTO dbo.OCR_Job (Id, ProjectCode, FileId, Engine, LanguageCode, Status) VALUES (@Id, @ProjectCode, @FileId, @Engine, @LanguageCode, 'running')");

    const ocr = await extractOcrText(file, languageCode);
    const chunks = chunkText(ocr.text);
    if (!chunks.length) throw new Error("OCR completed but no readable text was detected.");
    const knowledgeId = crypto.randomUUID();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      await new sql.Request(transaction)
        .input("Id", sql.UniqueIdentifier, knowledgeId)
        .input("ProjectCode", sql.NVarChar(50), projectCode)
        .input("FileId", sql.UniqueIdentifier, fileId)
        .input("DocumentType", sql.NVarChar(50), req.body.documentType || "ocr_scan")
        .input("Title", sql.NVarChar(400), title)
        .input("LanguageCode", sql.NVarChar(10), /[\u0600-\u06FF]/.test(ocr.text.slice(0, 4000)) ? "fa" : "en")
        .input("CharacterCount", sql.Int, ocr.text.length)
        .input("ChunkCount", sql.Int, chunks.length)
        .query("INSERT INTO dbo.Knowledge_Document (Id, ProjectCode, FileId, DocumentType, Title, LanguageCode, ExtractionStatus, CharacterCount, ChunkCount) VALUES (@Id, @ProjectCode, @FileId, @DocumentType, @Title, @LanguageCode, 'ready', @CharacterCount, @ChunkCount)");
      for (let index = 0; index < chunks.length; index += 1) {
        const content = chunks[index];
        await new sql.Request(transaction)
          .input("KnowledgeDocumentId", sql.UniqueIdentifier, knowledgeId)
          .input("ProjectCode", sql.NVarChar(50), projectCode)
          .input("ChunkIndex", sql.Int, index)
          .input("Content", sql.NVarChar(sql.MAX), content)
          .input("SearchText", sql.NVarChar(2000), content.slice(0, 2000).toLowerCase())
          .input("TokenEstimate", sql.Int, Math.ceil(content.length / 4))
          .query("INSERT INTO dbo.Document_Chunk (KnowledgeDocumentId, ProjectCode, ChunkIndex, Content, SearchText, TokenEstimate) VALUES (@KnowledgeDocumentId, @ProjectCode, @ChunkIndex, @Content, @SearchText, @TokenEstimate)");
      }
      await new sql.Request(transaction)
        .input("Id", sql.UniqueIdentifier, jobId)
        .input("Engine", sql.NVarChar(80), ocr.engine)
        .input("CharacterCount", sql.Int, ocr.text.length)
        .input("Confidence", sql.Decimal(5, 2), ocr.confidence)
        .input("KnowledgeDocumentId", sql.UniqueIdentifier, knowledgeId)
        .query("UPDATE dbo.OCR_Job SET Status = 'completed', Engine = @Engine, CharacterCount = @CharacterCount, Confidence = @Confidence, KnowledgeDocumentId = @KnowledgeDocumentId, CompletedAt = GETUTCDATE() WHERE Id = @Id");
      await transaction.commit();
      await writeAudit(pool, req, "OCR_INGEST_DOCUMENT", { projectCode, entityName: "OCR_Job", entityId: jobId, fileName: file.originalname, chunks: chunks.length });
      res.status(201).json({ ok: true, data: { id: jobId, projectId: projectCode, fileId, engine: ocr.engine, languageCode, status: "completed", characterCount: ocr.text.length, confidence: ocr.confidence, knowledgeDocumentId: knowledgeId, fileName: file.originalname }, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
    } catch (error) {
      await transaction.rollback().catch(() => {});
      throw error;
    }
  } catch (err) {
    try {
      const pool = await getPool(req);
      await pool.request().input("Id", sql.UniqueIdentifier, jobId).input("ErrorMessage", sql.NVarChar(1000), err.message).query("UPDATE dbo.OCR_Job SET Status = 'failed', ErrorMessage = @ErrorMessage, CompletedAt = GETUTCDATE() WHERE Id = @Id");
    } catch { /* ignore */ }
    fs.unlink(file.path, () => {});
    res.status(500).json({ ok: false, error: { code: err.code || "OCR_INGEST_ERROR", message: err.message, traceId: req.requestId } });
  }
});

app.get("/api/projects/:projectId/ocr/jobs", async (req, res) => {
  try {
    const pool = await getPool(req);
    const result = await pool.request().input("ProjectCode", sql.NVarChar(50), req.params.projectId).query(`
      SELECT TOP 100 CAST(oj.Id AS NVARCHAR(36)) AS id, oj.ProjectCode AS projectId, CAST(oj.FileId AS NVARCHAR(36)) AS fileId,
        oj.Engine AS engine, oj.LanguageCode AS languageCode, oj.Status AS status,
        oj.CharacterCount AS characterCount, oj.Confidence AS confidence, oj.ErrorMessage AS errorMessage,
        CAST(oj.KnowledgeDocumentId AS NVARCHAR(36)) AS knowledgeDocumentId, fo.FileName AS fileName
      FROM dbo.OCR_Job oj
      INNER JOIN dbo.File_Object fo ON fo.Id = oj.FileId AND fo.IsDeleted = 0
      WHERE oj.ProjectCode = @ProjectCode
      ORDER BY oj.CreatedAt DESC
    `);
    res.json({ ok: true, data: result.recordset, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "OCR_JOBS_ERROR", message: err.message, traceId: req.requestId } });
  }
});

/* ──────────────────────── Report Templates ──────────────────────── */
app.get("/api/projects/:projectId/templates", async (req, res) => {
  try {
    const pool = await getPool(req);
    const request = pool.request().input("ProjectCode", sql.NVarChar(50), req.params.projectId);
    let query = `
      SELECT CAST(rt.Id AS NVARCHAR(30)) AS id, rt.ProjectCode AS projectId, rt.ModuleCode AS moduleCode,
        rt.TemplateKind AS kind, rt.Name AS name, fo.FileName AS fileName, fo.MimeType AS mimeType,
        rt.VersionNo AS version, rt.IsLocked AS isLocked, rt.IsActive AS isActive,
        CAST(fo.Id AS NVARCHAR(36)) AS fileId
      FROM dbo.Report_Template rt
      LEFT JOIN dbo.File_Object fo ON fo.Id = rt.FileId AND fo.IsDeleted = 0
      WHERE rt.ProjectCode = @ProjectCode AND rt.IsActive = 1`;
    if (req.query.moduleCode) {
      query += " AND rt.ModuleCode = @ModuleCode";
      request.input("ModuleCode", sql.NVarChar(60), req.query.moduleCode);
    }
    query += " ORDER BY rt.Id DESC";
    const result = await request.query(query);
    const items = result.recordset.map((row) => ({ ...row, downloadUrl: row.fileId ? `/api/files/${row.fileId}/download` : undefined }));
    res.json({ ok: true, data: items, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "TEMPLATE_LIST_ERROR", message: err.message, traceId: req.requestId } });
  }
});

app.post("/api/projects/:projectId/templates", upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ ok: false, error: { code: "FILE_REQUIRED", message: "Upload a template in the file field", traceId: req.requestId } });
  const projectCode = req.params.projectId;
  const moduleCode = req.body.moduleCode || "d2-p4-s1";
  const kind = req.body.kind === "mandated" ? "mandated" : "internal";
  const fileId = crypto.randomUUID();
  const templateName = req.body.name || file.originalname.replace(/\.[^.]+$/, "");
  const version = req.body.version || "v1.0";
  const isLocked = kind === "mandated" || req.body.isLocked === "true";

  try {
    const checksum = sha256(file.path);
    const pool = await getPool(req);
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      await new sql.Request(transaction)
        .input("Id", sql.UniqueIdentifier, fileId)
        .input("FileName", sql.NVarChar(300), file.originalname)
        .input("MimeType", sql.NVarChar(150), file.mimetype)
        .input("SizeBytes", sql.BigInt, file.size)
        .input("StorageKey", sql.NVarChar(600), file.filename)
        .input("ChecksumSha256", sql.NVarChar(128), checksum)
        .query("INSERT INTO dbo.File_Object (Id, FileName, MimeType, SizeBytes, StorageKey, ChecksumSha256) VALUES (@Id, @FileName, @MimeType, @SizeBytes, @StorageKey, @ChecksumSha256)");
      const templateResult = await new sql.Request(transaction)
        .input("ProjectCode", sql.NVarChar(50), projectCode)
        .input("ModuleCode", sql.NVarChar(60), moduleCode)
        .input("TemplateKind", sql.NVarChar(20), kind)
        .input("Name", sql.NVarChar(250), templateName)
        .input("VersionNo", sql.NVarChar(50), version)
        .input("FileId", sql.UniqueIdentifier, fileId)
        .input("IsLocked", sql.Bit, isLocked)
        .query(`
          UPDATE dbo.Report_Template SET IsActive = 0 WHERE ProjectCode = @ProjectCode AND ModuleCode = @ModuleCode AND TemplateKind = @TemplateKind AND IsActive = 1;
          INSERT INTO dbo.Report_Template (ProjectCode, ModuleCode, TemplateKind, Name, VersionNo, FileId, IsLocked, IsActive)
          VALUES (@ProjectCode, @ModuleCode, @TemplateKind, @Name, @VersionNo, @FileId, @IsLocked, 1);
          SELECT SCOPE_IDENTITY() AS id;
        `);
      await transaction.commit();
      await writeAudit(pool, req, "UPLOAD_REPORT_TEMPLATE", { projectCode, entityName: "Report_Template", entityId: String(templateResult.recordset[0].id), moduleCode, kind, fileName: file.originalname });
      res.status(201).json({ ok: true, data: { id: String(templateResult.recordset[0].id), projectId: projectCode, moduleCode, kind, name: templateName, fileName: file.originalname, mimeType: file.mimetype, version, isLocked, isActive: true, fileId, downloadUrl: `/api/files/${fileId}/download` }, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
    } catch (error) {
      await transaction.rollback().catch(() => {});
      throw error;
    }
  } catch (err) {
    fs.unlink(file.path, () => {});
    res.status(500).json({ ok: false, error: { code: "TEMPLATE_UPLOAD_ERROR", message: err.message, traceId: req.requestId } });
  }
});

app.delete("/api/projects/:projectId/templates/:templateId", async (req, res) => {
  try {
    const pool = await getPool(req);
    const result = await pool.request()
      .input("ProjectCode", sql.NVarChar(50), req.params.projectId)
      .input("Id", sql.Int, Number(req.params.templateId))
      .query("UPDATE dbo.Report_Template SET IsActive = 0 WHERE Id = @Id AND ProjectCode = @ProjectCode; SELECT @@ROWCOUNT AS affected;");
    const affected = Number(result.recordset[0]?.affected || 0);
    if (!affected) return res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "Template was not found", traceId: req.requestId } });
    await writeAudit(pool, req, "ARCHIVE_REPORT_TEMPLATE", { projectCode: req.params.projectId, entityName: "Report_Template", entityId: req.params.templateId });
    res.json({ ok: true, data: { success: true }, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "TEMPLATE_ARCHIVE_ERROR", message: err.message, traceId: req.requestId } });
  }
});

/* ──────────────────────── External Integrations & AI ──────────────────────── */
app.post("/api/projects/:projectId/schedule/import", upload.single("file"), async (req, res) => {
  try {
    const { projectId } = req.params;
    const fileName = req.file?.originalname || req.body.fileName || "schedule.xer";
    const sourceSystem = req.body.sourceSystem || (fileName.toLowerCase().endsWith(".mpp") ? "msp" : fileName.toLowerCase().endsWith(".xer") ? "primavera" : "excel");
    const activities = req.file ? parseScheduleFile(req.file.path, req.file.originalname) : [];
    const pool = await getPool(req);
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      const master = await new sql.Request(transaction)
        .input("ProjectCode", sql.NVarChar(50), projectId)
        .input("ScheduleName", sql.NVarChar(250), fileName)
        .input("SourceSystem", sql.NVarChar(30), sourceSystem)
        .query(`INSERT INTO dbo.Schedule_Master (ProjectCode, ScheduleName, SourceSystem) VALUES (@ProjectCode, @ScheduleName, @SourceSystem); SELECT SCOPE_IDENTITY() AS scheduleId;`);
      const scheduleId = Number(master.recordset[0].scheduleId);
      for (const activity of activities) {
        await new sql.Request(transaction)
          .input("ScheduleId", sql.Int, scheduleId)
          .input("ActivityCode", sql.NVarChar(100), activity.code)
          .input("ActivityName", sql.NVarChar(400), activity.name)
          .input("StartDate", sql.Date, activity.startDate)
          .input("FinishDate", sql.Date, activity.finishDate)
          .input("DurationDays", sql.Int, activity.durationDays)
          .input("Progress", sql.Decimal(5, 2), activity.progress)
          .input("IsCritical", sql.Bit, activity.isCritical)
          .query(`INSERT INTO dbo.Schedule_Activity (ScheduleId, ActivityCode, ActivityName, StartDate, FinishDate, DurationDays, Progress, IsCritical) VALUES (@ScheduleId, @ActivityCode, @ActivityName, @StartDate, @FinishDate, @DurationDays, @Progress, @IsCritical);`);
      }
      const insertLog = await new sql.Request(transaction)
        .input("ProjectCode", sql.NVarChar(50), projectId)
        .input("SourceSystem", sql.NVarChar(30), sourceSystem)
        .input("Status", sql.NVarChar(30), "success")
        .input("Details", sql.NVarChar(sql.MAX), JSON.stringify({ fileName, activities: activities.length, scheduleId }))
        .query(`INSERT INTO dbo.Schedule_Import_Log (ProjectCode, SourceSystem, FileId, Status, Details) VALUES (@ProjectCode, @SourceSystem, NEWID(), @Status, @Details); SELECT SCOPE_IDENTITY() AS logId;`);
      await transaction.commit();
      await writeAudit(pool, req, "IMPORT_SCHEDULE", { projectCode: projectId, entityName: "Schedule_Master", entityId: String(scheduleId), sourceSystem, fileName, activities: activities.length });
      res.json({ ok: true, data: { logId: insertLog.recordset[0].logId, scheduleId, projectId, sourceSystem, fileName, importedActivities: activities.length, preview: activities.slice(0, 20), importedAt: new Date().toISOString(), message: "Schedule imported successfully." }, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
    } catch (error) {
      await transaction.rollback().catch(() => {});
      throw error;
    }
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "IMPORT_ERROR", message: err.message, traceId: req.requestId } });
  } finally {
    if (req.file) fs.unlink(req.file.path, () => {});
  }
});

app.get("/api/projects/:projectId/schedule/activities", async (req, res) => {
  try {
    const pool = await getPool(req);
    const result = await pool.request()
      .input("ProjectCode", sql.NVarChar(50), req.params.projectId)
      .query(`SELECT TOP 100 CAST(sa.Id AS NVARCHAR(30)) AS id, sm.ProjectCode AS projectId, CAST(sa.WbsId AS NVARCHAR(30)) AS wbsId, sa.ActivityCode AS activityCode, sa.ActivityName AS name, CONVERT(NVARCHAR(20), sa.StartDate, 23) AS startDate, CONVERT(NVARCHAR(20), sa.FinishDate, 23) AS finishDate, ISNULL(sa.DurationDays, 0) AS durationDays, sa.Progress AS progress, sa.IsCritical AS isCritical FROM dbo.Schedule_Activity sa INNER JOIN dbo.Schedule_Master sm ON sm.Id = sa.ScheduleId WHERE sm.ProjectCode = @ProjectCode ORDER BY sa.Id DESC`);
    res.json({ ok: true, data: result.recordset, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "SCHEDULE_QUERY_ERROR", message: err.message, traceId: req.requestId } });
  }
});
app.post("/api/ai/run", async (req, res) => {
  try {
    const { prompt, context = {} } = req.body;
    const apiKey = req.headers["x-ai-key"] || process.env.AI_API_KEY || "";
    if (!apiKey) return res.json({ ok: true, data: { message: "AI Gateway received prompt (demo).", prompt, context, model: "pmis-demo-gpt-4o", timestamp: new Date().toISOString() }, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
    res.json({ ok: true, data: { message: "AI call forwarded to provider (demo).", prompt, context, timestamp: new Date().toISOString() }, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "AI_ERROR", message: err.message, traceId: req.requestId } });
  }
});

/* ──────────────────────── Industries ──────────────────────── */
app.get("/api/industries", async (req, res) => {
  try {
    const pool = await getPool(req);
    const result = await pool.request().query(`SELECT Code AS id, Code AS code, TitleFa AS titleFa, TitleEn AS titleEn, Icon AS icon, Color AS color, IsActive AS isActive FROM dbo.Industry_Master WHERE IsActive = 1 ORDER BY Id ASC`);
    res.json({ ok: true, data: { items: result.recordset, page: 1, pageSize: result.recordset.length, total: result.recordset.length }, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "QUERY_ERROR", message: err.message, traceId: req.requestId } });
  }
});
app.post("/api/industries", async (req, res) => {
  try {
    const { code, titleFa, titleEn, icon, color } = req.body;
    const pool = await getPool(req);
    const result = await pool.request().input("Code", sql.NVarChar(20), code).input("TitleFa", sql.NVarChar(200), titleFa).input("TitleEn", sql.NVarChar(200), titleEn || null).input("Icon", sql.NVarChar(30), icon || "🏗").input("Color", sql.NVarChar(20), color || "#38BDF8").query(`INSERT INTO dbo.Industry_Master (Code, TitleFa, TitleEn, Icon, Color) VALUES (@Code, @TitleFa, @TitleEn, @Icon, @Color); SELECT Code AS id, Code AS code, TitleFa AS titleFa, TitleEn AS titleEn, Icon AS icon, Color AS color, IsActive AS isActive FROM dbo.Industry_Master WHERE Code = @Code;`);
    res.json({ ok: true, data: result.recordset[0], meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "INSERT_ERROR", message: err.message, traceId: req.requestId } });
  }
});
app.patch("/api/industries/:id", async (req, res) => {
  try {
    const pool = await getPool(req);
    const { titleFa, titleEn, icon, color, isActive } = req.body;
    const result = await pool.request().input("Code", sql.NVarChar(20), req.params.id).input("TitleFa", sql.NVarChar(200), titleFa || null).input("TitleEn", sql.NVarChar(200), titleEn || null).input("Icon", sql.NVarChar(30), icon || null).input("Color", sql.NVarChar(20), color || null).input("IsActive", sql.Bit, isActive == null ? null : Boolean(isActive)).query(`UPDATE dbo.Industry_Master SET TitleFa = COALESCE(@TitleFa, TitleFa), TitleEn = COALESCE(@TitleEn, TitleEn), Icon = COALESCE(@Icon, Icon), Color = COALESCE(@Color, Color), IsActive = COALESCE(@IsActive, IsActive), UpdatedAt = GETDATE() WHERE Code = @Code; SELECT Code AS id, Code AS code, TitleFa AS titleFa, TitleEn AS titleEn, Icon AS icon, Color AS color, IsActive AS isActive FROM dbo.Industry_Master WHERE Code = @Code;`);
    if (!result.recordset[0]) return res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "Industry was not found", traceId: req.requestId } });
    res.json({ ok: true, data: result.recordset[0], meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "UPDATE_ERROR", message: err.message, traceId: req.requestId } });
  }
});
app.delete("/api/industries/:id", async (req, res) => {
  try {
    const pool = await getPool(req);
    await pool.request().input("Code", sql.NVarChar(20), req.params.id).query("UPDATE dbo.Industry_Master SET IsActive = 0, UpdatedAt = GETDATE() WHERE Code = @Code");
    res.json({ ok: true, data: { success: true }, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "DELETE_ERROR", message: err.message, traceId: req.requestId } });
  }
});

/* ──────────────────────── Projects ──────────────────────── */
app.get("/api/projects", async (req, res) => {
  try {
    const pool = await getPool(req);
    const industryId = req.query.industryId;
    let query = `SELECT ProjectCode AS id, IndustryCode AS industryId, ProjectCode AS code, NameFa AS nameFa, NameEn AS nameEn, ClientFa AS clientFa, LocationFa AS locationFa, Budget, Status AS status, Progress AS progress FROM dbo.Project_Master WHERE IsArchived = 0`;
    const request = pool.request();
    if (industryId) { query += ` AND IndustryCode = @IndustryCode`; request.input("IndustryCode", sql.NVarChar(20), industryId); }
    query += ` ORDER BY Id DESC`;
    const result = await request.query(query);
    res.json({ ok: true, data: { items: result.recordset, page: 1, pageSize: result.recordset.length, total: result.recordset.length }, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "QUERY_ERROR", message: err.message, traceId: req.requestId } });
  }
});
app.post("/api/projects", async (req, res) => {
  try {
    const { industryId, code, nameFa, nameEn, clientFa, locationFa, budget, status, progress } = req.body;
    const pool = await getPool(req);
    const result = await pool.request().input("IndustryCode", sql.NVarChar(20), industryId).input("ProjectCode", sql.NVarChar(50), code).input("NameFa", sql.NVarChar(400), nameFa).input("NameEn", sql.NVarChar(400), nameEn || null).input("ClientFa", sql.NVarChar(200), clientFa || null).input("LocationFa", sql.NVarChar(250), locationFa || null).input("Budget", sql.Decimal(18, 2), parseFloat(String(budget || "0").replace(/[^0-9.]/g, "")) || 0).input("Status", sql.NVarChar(20), status || "active").input("Progress", sql.Decimal(5, 2), progress || 0).query(`INSERT INTO dbo.Project_Master (IndustryCode, ProjectCode, NameFa, NameEn, ClientFa, LocationFa, Budget, Status, Progress) VALUES (@IndustryCode, @ProjectCode, @NameFa, @NameEn, @ClientFa, @LocationFa, @Budget, @Status, @Progress); SELECT ProjectCode AS id, IndustryCode AS industryId, ProjectCode AS code, NameFa AS nameFa, Status AS status, Progress AS progress FROM dbo.Project_Master WHERE ProjectCode = @ProjectCode;`);
    res.json({ ok: true, data: result.recordset[0], meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "INSERT_ERROR", message: err.message, traceId: req.requestId } });
  }
});
app.patch("/api/projects/:id", async (req, res) => {
  try {
    const pool = await getPool(req);
    const { nameFa, nameEn, clientFa, locationFa, budget, status, progress } = req.body;
    const result = await pool.request().input("ProjectCode", sql.NVarChar(50), req.params.id).input("NameFa", sql.NVarChar(400), nameFa || null).input("NameEn", sql.NVarChar(400), nameEn || null).input("ClientFa", sql.NVarChar(200), clientFa || null).input("LocationFa", sql.NVarChar(250), locationFa || null).input("Budget", sql.Decimal(18, 2), budget == null ? null : Number(budget)).input("Status", sql.NVarChar(20), status || null).input("Progress", sql.Decimal(5, 2), progress == null ? null : Number(progress)).query(`UPDATE dbo.Project_Master SET NameFa = COALESCE(@NameFa, NameFa), NameEn = COALESCE(@NameEn, NameEn), ClientFa = COALESCE(@ClientFa, ClientFa), LocationFa = COALESCE(@LocationFa, LocationFa), Budget = COALESCE(@Budget, Budget), Status = COALESCE(@Status, Status), Progress = COALESCE(@Progress, Progress), UpdatedAt = GETDATE() WHERE ProjectCode = @ProjectCode; SELECT ProjectCode AS id, IndustryCode AS industryId, ProjectCode AS code, NameFa AS nameFa, NameEn AS nameEn, ClientFa AS clientFa, LocationFa AS locationFa, Budget AS budget, Status AS status, Progress AS progress FROM dbo.Project_Master WHERE ProjectCode = @ProjectCode;`);
    if (!result.recordset[0]) return res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "Project was not found", traceId: req.requestId } });
    res.json({ ok: true, data: result.recordset[0], meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "UPDATE_ERROR", message: err.message, traceId: req.requestId } });
  }
});

/* ──────────────────────── Daily Reports ──────────────────────── */
app.get("/api/projects/:projectId/daily-reports", async (req, res) => {
  try {
    const { projectId } = req.params;
    const pool = await getPool(req);
    const result = await pool.request().input("ProjectCode", sql.NVarChar(50), projectId).query(`SELECT CAST(Id AS NVARCHAR(30)) AS id, ProjectCode AS projectId, ReportNo AS reportNo, CONVERT(NVARCHAR(20), ReportDate, 23) AS reportDate, NULL AS templateId, HeaderJson AS header, Status AS status FROM dbo.Daily_Report WHERE ProjectCode = @ProjectCode ORDER BY Id DESC`);
    res.json({ ok: true, data: result.recordset, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "QUERY_ERROR", message: err.message, traceId: req.requestId } });
  }
});
app.post("/api/projects/:projectId/daily-reports", async (req, res) => {
  try {
    const { projectId } = req.params;
    const { reportNo, reportDate, header, status } = req.body;
    const sqlReportDate = toSqlDate(reportDate);
    const pool = await getPool(req);
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      const result = await new sql.Request(transaction).input("ProjectCode", sql.NVarChar(50), projectId).input("ReportNo", sql.NVarChar(30), normalizeDigits(reportNo || `DPR-${Date.now()}`)).input("ReportDate", sql.Date, sqlReportDate).input("HeaderJson", sql.NVarChar(sql.MAX), JSON.stringify(header || {})).input("Status", sql.NVarChar(30), status || "draft").query(`INSERT INTO dbo.Daily_Report (ProjectCode, ReportNo, ReportDate, HeaderJson, Status) VALUES (@ProjectCode, @ReportNo, @ReportDate, @HeaderJson, @Status); DECLARE @ReportId INT = SCOPE_IDENTITY(); INSERT INTO dbo.Report_Workflow (DailyReportId, CurrentStatus, CurrentAssigneeRole) VALUES (@ReportId, @Status, CASE WHEN @Status = 'submitted' THEN 'consultant' ELSE 'site_engineer' END); SELECT @ReportId AS id, @ProjectCode AS projectId, @ReportNo AS reportNo, CONVERT(NVARCHAR(20), @ReportDate, 23) AS reportDate, @Status AS status;`);
      await transaction.commit();
      res.json({ ok: true, data: result.recordset[0], meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
    } catch (error) {
      await transaction.rollback().catch(() => {});
      throw error;
    }
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "INSERT_ERROR", message: err.message, traceId: req.requestId } });
  }
});

const workflowTransitions = {
  submit: { from: ["draft", "revision_required", "rejected"], to: "submitted", roles: ["admin", "project_manager", "site_engineer", "planner"], assignee: "consultant" },
  start_consultant_review: { from: ["submitted"], to: "consultant_review", roles: ["admin", "consultant"], assignee: "consultant" },
  consultant_accept: { from: ["submitted", "consultant_review"], to: "client_review", roles: ["admin", "consultant"], assignee: "client" },
  request_revision: { from: ["submitted", "consultant_review", "client_review"], to: "revision_required", roles: ["admin", "consultant", "client", "project_manager"], assignee: "site_engineer" },
  approve: { from: ["client_review"], to: "approved", roles: ["admin", "client"], assignee: null },
  reject: { from: ["submitted", "consultant_review", "client_review"], to: "rejected", roles: ["admin", "consultant", "client"], assignee: "project_manager" },
};

app.get("/api/daily-reports/:id/workflow", async (req, res) => {
  try {
    const pool = await getPool(req);
    const workflow = await pool.request().input("DailyReportId", sql.Int, Number(req.params.id)).query(`SELECT CAST(Id AS NVARCHAR(30)) AS id, CAST(DailyReportId AS NVARCHAR(30)) AS dailyReportId, CurrentStatus AS currentStatus, CurrentAssigneeRole AS currentAssigneeRole FROM dbo.Report_Workflow WHERE DailyReportId = @DailyReportId`);
    const record = workflow.recordset[0];
    if (!record) return res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "Report workflow was not found", traceId: req.requestId } });
    const actions = await pool.request().input("WorkflowId", sql.Int, Number(record.id)).query(`SELECT CAST(Id AS NVARCHAR(30)) AS id, ActionCode AS actionCode, FromStatus AS fromStatus, ToStatus AS toStatus, ActorRole AS actorRole, Comment AS comment, CONVERT(NVARCHAR(30), CreatedAt, 126) AS createdAt FROM dbo.Report_Workflow_Action WHERE WorkflowId = @WorkflowId ORDER BY Id DESC`);
    res.json({ ok: true, data: { ...record, actions: actions.recordset }, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "WORKFLOW_QUERY_ERROR", message: err.message, traceId: req.requestId } });
  }
});

app.post("/api/daily-reports/:id/workflow/actions", async (req, res) => {
  const actionCode = String(req.body.actionCode || "");
  const actorRole = String(req.body.actorRole || "");
  const transition = workflowTransitions[actionCode];
  if (!transition) return res.status(400).json({ ok: false, error: { code: "INVALID_ACTION", message: "Unknown workflow action", traceId: req.requestId } });
  if (!transition.roles.includes(actorRole)) return res.status(403).json({ ok: false, error: { code: "ROLE_NOT_ALLOWED", message: `Role ${actorRole} cannot perform ${actionCode}`, traceId: req.requestId } });
  try {
    const pool = await getPool(req);
    const currentResult = await pool.request().input("DailyReportId", sql.Int, Number(req.params.id)).query(`SELECT Id, CurrentStatus FROM dbo.Report_Workflow WHERE DailyReportId = @DailyReportId`);
    const current = currentResult.recordset[0];
    if (!current) return res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "Report workflow was not found", traceId: req.requestId } });
    if (!transition.from.includes(current.CurrentStatus)) return res.status(409).json({ ok: false, error: { code: "INVALID_TRANSITION", message: `Cannot ${actionCode} from ${current.CurrentStatus}`, traceId: req.requestId } });
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      await new sql.Request(transaction)
        .input("WorkflowId", sql.Int, current.Id)
        .input("ActionCode", sql.NVarChar(40), actionCode)
        .input("FromStatus", sql.NVarChar(30), current.CurrentStatus)
        .input("ToStatus", sql.NVarChar(30), transition.to)
        .input("ActorRole", sql.NVarChar(60), actorRole)
        .input("AssigneeRole", sql.NVarChar(60), transition.assignee)
        .input("Comment", sql.NVarChar(2000), req.body.comment || null)
        .query(`INSERT INTO dbo.Report_Workflow_Action (WorkflowId, ActionCode, FromStatus, ToStatus, ActorRole, Comment) VALUES (@WorkflowId, @ActionCode, @FromStatus, @ToStatus, @ActorRole, @Comment); UPDATE dbo.Report_Workflow SET CurrentStatus = @ToStatus, CurrentAssigneeRole = @AssigneeRole, UpdatedAt = GETUTCDATE(), SubmittedAt = CASE WHEN @ToStatus = 'submitted' THEN GETUTCDATE() ELSE SubmittedAt END, ReviewedAt = CASE WHEN @ToStatus IN ('consultant_review','client_review') THEN GETUTCDATE() ELSE ReviewedAt END, ApprovedAt = CASE WHEN @ToStatus = 'approved' THEN GETUTCDATE() ELSE ApprovedAt END WHERE Id = @WorkflowId; UPDATE dbo.Daily_Report SET Status = @ToStatus, UpdatedAt = GETUTCDATE() WHERE Id = @DailyReportId;`);
      await transaction.commit();
      await writeAudit(pool, req, "REPORT_WORKFLOW_ACTION", { entityName: "Daily_Report", entityId: req.params.id, actionCode, actorRole, toStatus: transition.to });
      const notificationId = await createNotification(pool, req, {
        channel: process.env.WORKFLOW_NOTIFICATION_CHANNEL || "in_app",
        recipient: process.env.WORKFLOW_NOTIFICATION_RECIPIENT || transition.assignee || "project-team",
        subject: `Daily report workflow: ${transition.to}`,
        body: `Daily report ${req.params.id} moved from ${current.CurrentStatus} to ${transition.to} by ${actorRole}.${req.body.comment ? ` Comment: ${req.body.comment}` : ""}`,
        priority: transition.to === "approved" ? "normal" : transition.to === "revision_required" || transition.to === "rejected" ? "high" : "normal",
        relatedEntity: "Daily_Report",
        relatedEntityId: req.params.id,
      });
      if (process.env.WORKFLOW_NOTIFICATION_AUTO_SEND === "true") await deliverNotification(pool, req, notificationId);
      const actions = await pool.request().input("WorkflowId", sql.Int, current.Id).query(`SELECT CAST(Id AS NVARCHAR(30)) AS id, ActionCode AS actionCode, FromStatus AS fromStatus, ToStatus AS toStatus, ActorRole AS actorRole, Comment AS comment, CONVERT(NVARCHAR(30), CreatedAt, 126) AS createdAt FROM dbo.Report_Workflow_Action WHERE WorkflowId = @WorkflowId ORDER BY Id DESC`);
      res.json({ ok: true, data: { id: String(current.Id), dailyReportId: req.params.id, currentStatus: transition.to, currentAssigneeRole: transition.assignee, actions: actions.recordset }, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
    } catch (error) {
      await transaction.rollback().catch(() => {});
      throw error;
    }
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "WORKFLOW_ACTION_ERROR", message: err.message, traceId: req.requestId } });
  }
});

/* ──────────────────────── Portfolio Summary ──────────────────────── */
app.get("/api/portfolio/summary", async (req, res) => {
  try {
    const pool = await getPool(req);
    const result = await pool.request().query(`SELECT SUM(ActiveProjects) AS activeProjects, SUM(TenderProjects) AS tenderProjects, SUM(StoppedProjects) AS stoppedProjects, SUM(CompletedProjects) AS completedProjects FROM dbo.Portfolio_Snapshot`);
    const summary = result.recordset[0] || { activeProjects: 0, tenderProjects: 0, stoppedProjects: 0, completedProjects: 0 };
    res.json({ ok: true, data: { ...summary, spi: 0.97, cpi: 1.03, criticalRisks: 11 }, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "SUMMARY_ERROR", message: err.message, traceId: req.requestId } });
  }
});

app.use((req, res) => {
  res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: `Route ${req.method} ${req.path} was not found`, traceId: req.requestId } });
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  console.error(`[${req.requestId}]`, err);
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ ok: false, error: { code: "FILE_UPLOAD_ERROR", message: err.message, traceId: req.requestId } });
  }
  if (err.code === "UNSUPPORTED_FILE_TYPE") {
    return res.status(415).json({ ok: false, error: { code: err.code, message: err.message, traceId: req.requestId } });
  }
  res.status(500).json({ ok: false, error: { code: "UNHANDLED_ERROR", message: "Unexpected server error", traceId: req.requestId } });
});

const server = app.listen(PORT, () => {
  console.log("=======================================================");
  console.log(`  PMIS REST API Service running on http://localhost:${PORT}`);
  console.log(`  SQL Server Target: ${process.env.SQL_SERVER || ".\\SQL2008EXPRESS"} (${process.env.SQL_DATABASE || "PMIS_MASTER_DB"})`);
  console.log("=======================================================");
});

async function shutdown(signal) {
  console.log(`${signal} received; stopping PMIS API...`);
  server.close(async () => {
    if (poolCache) await poolCache.close().catch(() => {});
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
