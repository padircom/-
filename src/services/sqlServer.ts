/**
 * SQL Server Data Service Layer
 * -----------------------------------------------------------------------------
 * مرورگر نمی‌تواند مستقیماً به SQL Server وصل شود. این لایه به یک Backend API
 * (Node.js/Express + mssql یا .NET Web API) وصل می‌شود که خودش به SQL Server
 * متصل است.
 *
 * معماری:
 *   React (این برنامه)  →  REST API  →  SQL Server (.\SQL2008EXPRESS)
 *
 * تا زمانی که API واقعی راه‌اندازی نشده، حالت offline/mock فعال است و داده‌ها
 * از localStorage خوانده می‌شوند.
 */

export type ConnectionStatus = "connected" | "connecting" | "offline" | "error";

export type SqlConfig = {
  apiBaseUrl: string;      // e.g. http://localhost:4000/api
  server: string;          // e.g. .\SQL2008EXPRESS
  database: string;        // e.g. PMIS_MASTER_DB
  user: string;
  password: string;
  encrypt: boolean;
  trustServerCertificate: boolean;
  useWindowsAuth: boolean;
  timeoutMs: number;
};

export const defaultSqlConfig: SqlConfig = {
  apiBaseUrl: "http://localhost:4000/api",
  server: ".\\SQL2008EXPRESS",
  database: "PMIS_MASTER_DB",
  user: "sa",
  password: "",
  encrypt: false,
  trustServerCertificate: true,
  useWindowsAuth: true,
  timeoutMs: 15000,
};

export const SQL_CONFIG_STORE = "pmis:sql-config:v1";

export const loadSqlConfig = (): SqlConfig => {
  try {
    const raw = localStorage.getItem(SQL_CONFIG_STORE);
    return raw ? { ...defaultSqlConfig, ...JSON.parse(raw) } : defaultSqlConfig;
  } catch {
    return defaultSqlConfig;
  }
};

export const saveSqlConfig = (cfg: SqlConfig) => {
  try {
    // Secrets belong in the backend vault/configuration, never in browser storage.
    const { password: _password, ...safeConfig } = cfg;
    localStorage.setItem(SQL_CONFIG_STORE, JSON.stringify(safeConfig));
  } catch {
    /* ignore */
  }
};

/* ─────────────────────── Core request helper ─────────────────────── */
async function request<T>(cfg: SqlConfig, path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
  try {
    const res = await fetch(`${cfg.apiBaseUrl.replace(/\/$/, "")}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "X-Sql-Server": cfg.server,
        "X-Sql-Database": cfg.database,
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} — ${res.statusText}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/* ─────────────────────── Connection test ─────────────────────── */
export type PingResult = {
  ok: boolean;
  status: ConnectionStatus;
  latencyMs: number;
  serverVersion?: string;
  database?: string;
  message: string;
};

export async function testConnection(cfg: SqlConfig): Promise<PingResult> {
  const started = performance.now();
  try {
    const data = await request<{ version: string; database: string }>(cfg, "/health", {
      method: "POST",
      body: JSON.stringify({
        server: cfg.server,
        database: cfg.database,
        user: cfg.useWindowsAuth ? undefined : cfg.user,
        password: cfg.useWindowsAuth ? undefined : cfg.password,
        options: {
          encrypt: cfg.encrypt,
          trustServerCertificate: cfg.trustServerCertificate,
          trustedConnection: cfg.useWindowsAuth,
        },
      }),
    });
    return {
      ok: true,
      status: "connected",
      latencyMs: Math.round(performance.now() - started),
      serverVersion: data.version,
      database: data.database,
      message: "اتصال به SQL Server برقرار شد",
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isNetwork = msg.includes("Failed to fetch") || msg.includes("aborted") || msg.includes("NetworkError");
    return {
      ok: false,
      status: isNetwork ? "offline" : "error",
      latencyMs: Math.round(performance.now() - started),
      message: isNetwork
        ? "سرویس API در دسترس نیست — حالت آفلاین (localStorage) فعال است"
        : `خطای اتصال: ${msg}`,
    };
  }
}

/* ─────────────────────── Generic query runner ─────────────────────── */
export async function runQuery<T = Record<string, unknown>>(
  cfg: SqlConfig,
  sql: string,
  params: Record<string, unknown> = {}
): Promise<T[]> {
  const data = await request<{ recordset: T[] }>(cfg, "/query", {
    method: "POST",
    body: JSON.stringify({ sql, params, server: cfg.server, database: cfg.database }),
  });
  return data.recordset ?? [];
}

/* ─────────────────────── Table helpers ─────────────────────── */
export const TABLES = {
  industry: "Industry_Master",
  project: "Project_Master",
  wbs: "Project_WBS",
  schedule: "Schedule_Master",
  daily: "Daily_Report",
  progress: "Progress_Transaction",
  evm: "EVM_Transaction",
  kpi: "KPI_Value",
  risk: "Risk_Register",
  change: "Change_Request",
  delay: "Delay_Register",
  claim: "Claim_Register",
  cost: "Cost_Transaction",
  document: "Document_Master",
} as const;

export type TableKey = keyof typeof TABLES;

export async function selectAll<T = Record<string, unknown>>(cfg: SqlConfig, table: TableKey): Promise<T[]> {
  return runQuery<T>(cfg, `SELECT * FROM dbo.${TABLES[table]}`);
}

export async function insertRow(cfg: SqlConfig, table: TableKey, row: Record<string, unknown>) {
  const cols = Object.keys(row);
  const sql = `INSERT INTO dbo.${TABLES[table]} (${cols.join(", ")}) VALUES (${cols.map((c) => `@${c}`).join(", ")})`;
  return runQuery(cfg, sql, row);
}

export async function updateRow(cfg: SqlConfig, table: TableKey, id: string | number, row: Record<string, unknown>) {
  const sets = Object.keys(row).map((c) => `${c} = @${c}`).join(", ");
  const sql = `UPDATE dbo.${TABLES[table]} SET ${sets} WHERE Id = @__id`;
  return runQuery(cfg, sql, { ...row, __id: id });
}

export async function deleteRow(cfg: SqlConfig, table: TableKey, id: string | number) {
  return runQuery(cfg, `DELETE FROM dbo.${TABLES[table]} WHERE Id = @__id`, { __id: id });
}

/* ─────────────────────── Schema bootstrap script ─────────────────────── */
export const SCHEMA_SCRIPT = `-- PMIS Master Schema (SQL Server)
IF DB_ID('PMIS_MASTER_DB') IS NULL CREATE DATABASE PMIS_MASTER_DB;
GO
USE PMIS_MASTER_DB;
GO

IF OBJECT_ID('dbo.Industry_Master','U') IS NULL
CREATE TABLE dbo.Industry_Master (
  Id            INT IDENTITY(1,1) PRIMARY KEY,
  Code          NVARCHAR(20)  NOT NULL UNIQUE,
  TitleFa       NVARCHAR(200) NOT NULL,
  TitleEn       NVARCHAR(200) NULL,
  Icon          NVARCHAR(20)  NULL,
  Color         NVARCHAR(20)  NULL,
  CreatedAt     DATETIME      DEFAULT GETDATE()
);

IF OBJECT_ID('dbo.Project_Master','U') IS NULL
CREATE TABLE dbo.Project_Master (
  Id            INT IDENTITY(1,1) PRIMARY KEY,
  IndustryCode  NVARCHAR(20)  NOT NULL,
  ProjectCode   NVARCHAR(50)  NOT NULL UNIQUE,
  NameFa        NVARCHAR(400) NOT NULL,
  NameEn        NVARCHAR(400) NULL,
  ClientFa      NVARCHAR(200) NULL,
  LocationFa    NVARCHAR(200) NULL,
  Budget        NVARCHAR(50)  NULL,
  Status        NVARCHAR(20)  NOT NULL,
  Progress      DECIMAL(5,2)  DEFAULT 0,
  CreatedAt     DATETIME      DEFAULT GETDATE()
);

IF OBJECT_ID('dbo.Daily_Report','U') IS NULL
CREATE TABLE dbo.Daily_Report (
  Id            INT IDENTITY(1,1) PRIMARY KEY,
  ProjectCode   NVARCHAR(50)  NOT NULL,
  ReportNo      NVARCHAR(30)  NOT NULL,
  ReportDate    NVARCHAR(20)  NOT NULL,
  TemplateKind  NVARCHAR(20)  NULL,
  TemplateFile  NVARCHAR(300) NULL,
  HeaderJson    NVARCHAR(MAX) NULL,
  CreatedBy     NVARCHAR(100) NULL,
  CreatedAt     DATETIME      DEFAULT GETDATE()
);

IF OBJECT_ID('dbo.Progress_Transaction','U') IS NULL
CREATE TABLE dbo.Progress_Transaction (
  Id            INT IDENTITY(1,1) PRIMARY KEY,
  ProjectCode   NVARCHAR(50)  NOT NULL,
  WbsCode       NVARCHAR(60)  NULL,
  ActivityName  NVARCHAR(300) NULL,
  Unit          NVARCHAR(30)  NULL,
  TodayQty      DECIMAL(18,2) DEFAULT 0,
  CumulativeQty DECIMAL(18,2) DEFAULT 0,
  ReportDate    NVARCHAR(20)  NULL,
  CreatedAt     DATETIME      DEFAULT GETDATE()
);

IF OBJECT_ID('dbo.EVM_Transaction','U') IS NULL
CREATE TABLE dbo.EVM_Transaction (
  Id            INT IDENTITY(1,1) PRIMARY KEY,
  ProjectCode   NVARCHAR(50)  NOT NULL,
  PeriodLabel   NVARCHAR(40)  NULL,
  PV            DECIMAL(18,2) DEFAULT 0,
  EV            DECIMAL(18,2) DEFAULT 0,
  AC            DECIMAL(18,2) DEFAULT 0,
  SPI           DECIMAL(9,4)  NULL,
  CPI           DECIMAL(9,4)  NULL,
  CreatedAt     DATETIME      DEFAULT GETDATE()
);

IF OBJECT_ID('dbo.Risk_Register','U') IS NULL
CREATE TABLE dbo.Risk_Register (
  Id            INT IDENTITY(1,1) PRIMARY KEY,
  ProjectCode   NVARCHAR(50)  NOT NULL,
  TitleFa       NVARCHAR(400) NOT NULL,
  Probability   INT           NOT NULL,
  Impact        INT           NOT NULL,
  Score         AS (Probability * Impact) PERSISTED,
  Owner         NVARCHAR(120) NULL,
  Status        NVARCHAR(30)  NULL,
  CreatedAt     DATETIME      DEFAULT GETDATE()
);
GO`;

/* ─────────────────────── Minimal Node backend sample ─────────────────────── */
export const BACKEND_SAMPLE = `// server.js  —  npm i express cors mssql
const express = require("express");
const cors = require("cors");
const sql = require("mssql");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const buildConfig = (b) => ({
  server: (b.server || ".\\\\SQL2008EXPRESS").split("\\\\")[0] || "localhost",
  options: {
    instanceName: (b.server || "").split("\\\\")[1],
    encrypt: !!b.options?.encrypt,
    trustServerCertificate: b.options?.trustServerCertificate !== false,
    trustedConnection: !!b.options?.trustedConnection,
  },
  database: b.database || "PMIS_MASTER_DB",
  user: b.user,
  password: b.password,
  connectionTimeout: 15000,
});

app.post("/api/health", async (req, res) => {
  try {
    const pool = await sql.connect(buildConfig(req.body));
    const r = await pool.request().query("SELECT @@VERSION AS version, DB_NAME() AS [database]");
    res.json(r.recordset[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/query", async (req, res) => {
  try {
    const { sql: text, params = {} } = req.body;
    const pool = await sql.connect(buildConfig(req.body));
    const rq = pool.request();
    Object.entries(params).forEach(([k, v]) => rq.input(k, v));
    const result = await rq.query(text);
    res.json({ recordset: result.recordset ?? [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(4000, () => console.log("PMIS API on http://localhost:4000"));`;
