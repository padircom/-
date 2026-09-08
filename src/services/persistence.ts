/**
 * Arena Platform — SQL Persistence Layer (sql-v1)
 * ---------------------------------------------------------------------------
 * لایهٔ ماندگاری داده: تعریف قانونی اسکیما، تولید DDL، موتور مهاجرت،
 * سازندهٔ پرس‌وجوی پارامتری و اعتبارسنجی ردیف.
 *
 * قید طراحی: این فایل کاملاً خالص است — نه اتصال می‌گیرد نه کوئری اجرا می‌کند.
 * فقط رشتهٔ SQL و آرایهٔ پارامتر می‌سازد. اجرا کار درایور است
 * (`server/persistence/driver.mjs`). به همین دلیل کل لایه در Node تست می‌شود
 * بدون آنکه به SQL Server نیاز باشد.
 *
 * می‌بندد: PEX-G1 (داده در TS بود نه SQL) · PEX-G2 (POST progress ذخیره نمی‌شد)
 */

export const PERSISTENCE_VERSION = "sql-v1";

export type Bi = { fa: string; en: string };
export type SqlDialect = "mssql" | "sqlite";

/* ═══════════════════════════ ۱. مدل ستون ═══════════════════════════ */

export type ColumnKind = "uuid" | "text" | "int" | "bigint" | "decimal" | "bool" | "date" | "datetime" | "json";

export type ColumnDef = {
  name: string;
  kind: ColumnKind;
  /** طول برای text؛ نبودش یعنی NVARCHAR(MAX) */
  len?: number;
  /** دقت و مقیاس برای decimal */
  precision?: number;
  scale?: number;
  nullable?: boolean;
  /** عبارت پیش‌فرض SQL — عمداً رشتهٔ خام است و فقط از ثابت‌های همین فایل می‌آید */
  default?: string;
  comment?: string;
};

export type ForeignKey = { column: string; refTable: string; refColumn: string; onDelete?: "CASCADE" | "NO ACTION" | "SET NULL" };

export type IndexDef = { name: string; columns: string[]; unique?: boolean };

export type TableDef = {
  name: string;
  module: string;
  title: Bi;
  pk: string;
  columns: ColumnDef[];
  indexes?: IndexDef[];
  foreignKeys?: ForeignKey[];
};

/** ستون‌های حسابرسی که به هر جدول اضافه می‌شوند. */
export const AUDIT_COLUMNS: ColumnDef[] = [
  { name: "CreatedAt", kind: "datetime", nullable: false, default: "SYSUTCDATETIME", comment: "زمان ایجاد (UTC)" },
  { name: "CreatedBy", kind: "text", len: 60, nullable: true, comment: "شناسه کاربر ایجادکننده" },
  { name: "UpdatedAt", kind: "datetime", nullable: true, comment: "زمان آخرین تغییر (UTC)" },
  { name: "UpdatedBy", kind: "text", len: 60, nullable: true },
  { name: "RowVersion", kind: "int", nullable: false, default: "1", comment: "کنترل هم‌زمانی خوش‌بینانه" },
];

export const AUDIT_COLUMN_NAMES = AUDIT_COLUMNS.map((c) => c.name);

/* ═══════════════════════════ ۲. ایمنی شناسه ═══════════════════════════ */

const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;

/**
 * نام جدول/ستون هرگز پارامتری نمی‌شود، پس تنها دفاع همین است.
 * هر شناسه‌ای که از الگو نگذرد استثنا می‌دهد — نه اینکه فرار داده شود.
 */
export function assertIdentifier(name: string): string {
  if (!IDENT_RE.test(name)) throw new Error(`SQL_UNSAFE_IDENTIFIER: ${name}`);
  return name;
}

export function isSafeIdentifier(name: string): boolean {
  return IDENT_RE.test(name);
}

export function quoteIdent(name: string, dialect: SqlDialect = "mssql"): string {
  assertIdentifier(name);
  return dialect === "mssql" ? `[${name}]` : `"${name}"`;
}

export function qualifiedName(table: string, dialect: SqlDialect = "mssql"): string {
  assertIdentifier(table);
  return dialect === "mssql" ? `[dbo].[${table}]` : `"${table}"`;
}

/* ═══════════════════════════ ۳. نگاشت نوع ═══════════════════════════ */

export function sqlType(col: ColumnDef, dialect: SqlDialect): string {
  if (dialect === "sqlite") {
    switch (col.kind) {
      case "int":
      case "bigint":
      case "bool":
        return "INTEGER";
      case "decimal":
        return "NUMERIC";
      default:
        return "TEXT";
    }
  }
  switch (col.kind) {
    case "uuid":
      return "UNIQUEIDENTIFIER";
    case "text":
      return col.len ? `NVARCHAR(${col.len})` : "NVARCHAR(MAX)";
    case "int":
      return "INT";
    case "bigint":
      return "BIGINT";
    case "decimal":
      return `DECIMAL(${col.precision ?? 18},${col.scale ?? 2})`;
    case "bool":
      return "BIT";
    case "date":
      return "DATE";
    case "datetime":
      return "DATETIME2";
    case "json":
      return "NVARCHAR(MAX)";
  }
}

function defaultExpr(col: ColumnDef, dialect: SqlDialect): string | null {
  if (col.default === undefined) return null;
  if (col.default === "SYSUTCDATETIME") return dialect === "mssql" ? "SYSUTCDATETIME()" : "CURRENT_TIMESTAMP";
  if (col.default === "NEWID") return dialect === "mssql" ? "NEWID()" : "(lower(hex(randomblob(16))))";
  return col.default;
}

/* ═══════════════════════════ ۴. تولید DDL ═══════════════════════════ */

export function columnDdl(col: ColumnDef, dialect: SqlDialect): string {
  const parts = [quoteIdent(col.name, dialect), sqlType(col, dialect)];
  parts.push(col.nullable === false ? "NOT NULL" : "NULL");
  const def = defaultExpr(col, dialect);
  if (def) parts.push(`DEFAULT ${def}`);
  return parts.join(" ");
}

/** همهٔ ستون‌های جدول شامل ستون‌های حسابرسی. */
export function allColumns(table: TableDef): ColumnDef[] {
  return [...table.columns, ...AUDIT_COLUMNS];
}

export function tableDdl(table: TableDef, dialect: SqlDialect = "mssql"): string {
  const cols = allColumns(table).map((c) => `  ${columnDdl(c, dialect)}`);
  cols.push(`  CONSTRAINT ${quoteIdent(`PK_${table.name}`, dialect)} PRIMARY KEY (${quoteIdent(table.pk, dialect)})`);
  for (const fk of table.foreignKeys ?? []) {
    cols.push(
      `  CONSTRAINT ${quoteIdent(`FK_${table.name}_${fk.column}`, dialect)} FOREIGN KEY (${quoteIdent(fk.column, dialect)})` +
        ` REFERENCES ${qualifiedName(fk.refTable, dialect)} (${quoteIdent(fk.refColumn, dialect)})` +
        ` ON DELETE ${fk.onDelete ?? "NO ACTION"}`
    );
  }
  const head =
    dialect === "mssql"
      ? `IF OBJECT_ID('dbo.${assertIdentifier(table.name)}', 'U') IS NULL\nCREATE TABLE ${qualifiedName(table.name, dialect)} (`
      : `CREATE TABLE IF NOT EXISTS ${qualifiedName(table.name, dialect)} (`;
  return `${head}\n${cols.join(",\n")}\n);`;
}

export function indexDdl(table: TableDef, idx: IndexDef, dialect: SqlDialect = "mssql"): string {
  const unique = idx.unique ? "UNIQUE " : "";
  const cols = idx.columns.map((c) => quoteIdent(c, dialect)).join(", ");
  return `CREATE ${unique}INDEX ${quoteIdent(idx.name, dialect)} ON ${qualifiedName(table.name, dialect)} (${cols});`;
}

/** اسکریپت کامل ساخت پایگاه داده. */
export function generateDdl(dialect: SqlDialect = "mssql", tables: TableDef[] = SCHEMA): string {
  const out: string[] = [
    `-- Arena Platform · ${PERSISTENCE_VERSION} · dialect=${dialect}`,
    `-- تولیدشده از src/services/persistence.ts — ویرایش دستی نکنید.`,
    "",
  ];
  for (const t of tables) {
    out.push(`-- ${t.name} · ${t.module} · ${t.title.fa}`);
    out.push(tableDdl(t, dialect));
    for (const idx of t.indexes ?? []) out.push(indexDdl(t, idx, dialect));
    out.push(dialect === "mssql" ? "GO" : "");
    out.push("");
  }
  return out.join("\n").trimEnd() + "\n";
}

/* ═══════════════════════════ ۵. اسکیمای قانونی ═══════════════════════════ */

const c = (name: string, kind: ColumnKind, extra: Partial<ColumnDef> = {}): ColumnDef => ({ name, kind, nullable: true, ...extra });
const req = (name: string, kind: ColumnKind, extra: Partial<ColumnDef> = {}): ColumnDef => ({ name, kind, nullable: false, ...extra });
const id = (): ColumnDef => ({ name: "Id", kind: "text", len: 60, nullable: false });

export const SCHEMA: TableDef[] = [
  /* ── هسته ── */
  {
    name: "SchemaMigration",
    module: "core",
    title: { fa: "تاریخچه مهاجرت اسکیما", en: "Schema migration history" },
    pk: "Version",
    columns: [
      req("Version", "text", { len: 20 }),
      req("Name", "text", { len: 200 }),
      req("Checksum", "text", { len: 40 }),
      req("AppliedAt", "datetime", { default: "SYSUTCDATETIME" }),
      c("DurationMs", "int"),
    ],
  },
  {
    name: "Industry",
    module: "core",
    title: { fa: "خوشه صنعتی", en: "Industry cluster" },
    pk: "Id",
    columns: [id(), req("Code", "text", { len: 20 }), req("TitleFa", "text", { len: 200 }), c("TitleEn", "text", { len: 200 }), c("Color", "text", { len: 20 }), c("Icon", "text", { len: 20 }), req("IsActive", "bool", { default: "1" })],
    indexes: [{ name: "UX_Industry_Code", columns: ["Code"], unique: true }],
  },
  {
    name: "Project",
    module: "core",
    title: { fa: "پروژه", en: "Project" },
    pk: "Id",
    columns: [
      id(),
      req("IndustryId", "text", { len: 60 }),
      req("Code", "text", { len: 50 }),
      req("NameFa", "text", { len: 400 }),
      c("NameEn", "text", { len: 400 }),
      c("ClientFa", "text", { len: 200 }),
      c("ConsultantFa", "text", { len: 200 }),
      c("ContractorFa", "text", { len: 200 }),
      c("LocationFa", "text", { len: 250 }),
      c("ContractNo", "text", { len: 60 }),
      c("Budget", "decimal", { precision: 18, scale: 2 }),
      c("StartDate", "date"),
      c("FinishDate", "date"),
      req("Status", "text", { len: 30, default: "'active'" }),
    ],
    indexes: [
      { name: "UX_Project_Code", columns: ["Code"], unique: true },
      { name: "IX_Project_Industry", columns: ["IndustryId"] },
    ],
    foreignKeys: [{ column: "IndustryId", refTable: "Industry", refColumn: "Id", onDelete: "NO ACTION" }],
  },
  {
    name: "AppUser",
    module: "d7",
    title: { fa: "کاربر", en: "Application user" },
    pk: "Id",
    columns: [id(), req("Username", "text", { len: 60 }), req("DisplayName", "text", { len: 160 }), c("Email", "text", { len: 160 }), req("IsActive", "bool", { default: "1" }), c("Clearance", "text", { len: 20 }), c("Party", "text", { len: 20 }), c("PasswordChangedAt", "datetime")],
    indexes: [{ name: "UX_AppUser_Username", columns: ["Username"], unique: true }],
  },
  {
    name: "UserRole",
    module: "d7",
    title: { fa: "انتساب نقش", en: "Role assignment" },
    pk: "Id",
    columns: [id(), req("UserId", "text", { len: 60 }), req("RoleCode", "text", { len: 40 })],
    indexes: [{ name: "UX_UserRole", columns: ["UserId", "RoleCode"], unique: true }],
    foreignKeys: [{ column: "UserId", refTable: "AppUser", refColumn: "Id", onDelete: "CASCADE" }],
  },
  {
    name: "UserProjectScope",
    module: "d7",
    title: { fa: "دامنه پروژه کاربر", en: "User project scope" },
    pk: "Id",
    columns: [id(), req("UserId", "text", { len: 60 }), req("ProjectCode", "text", { len: 50 })],
    indexes: [{ name: "UX_UserProjectScope", columns: ["UserId", "ProjectCode"], unique: true }],
    foreignKeys: [{ column: "UserId", refTable: "AppUser", refColumn: "Id", onDelete: "CASCADE" }],
  },
  {
    name: "Delegation",
    module: "d7",
    title: { fa: "تفویض اختیار", en: "Delegation" },
    pk: "Id",
    columns: [id(), req("FromUserId", "text", { len: 60 }), req("ToUserId", "text", { len: 60 }), req("Permissions", "json"), req("ValidFrom", "date"), req("ValidTo", "date"), req("Reason", "text", { len: 400 }), req("Revoked", "bool", { default: "0" })],
    indexes: [{ name: "IX_Delegation_To", columns: ["ToUserId", "ValidTo"] }],
  },
  {
    name: "AuditLog",
    module: "d7",
    title: { fa: "لاگ ممیزی", en: "Audit log" },
    pk: "Id",
    columns: [id(), req("At", "datetime"), req("SubjectId", "text", { len: 60 }), req("Action", "text", { len: 80 }), c("Permission", "text", { len: 60 }), c("Decision", "text", { len: 40 }), c("ProjectCode", "text", { len: 50 }), c("EntityName", "text", { len: 60 }), c("EntityId", "text", { len: 60 }), req("Severity", "text", { len: 20, default: "'info'" }), c("Details", "json")],
    indexes: [
      { name: "IX_AuditLog_At", columns: ["At"] },
      { name: "IX_AuditLog_Subject", columns: ["SubjectId", "At"] },
    ],
  },

  /* ── d1 مدارک ── */
  {
    name: "Document",
    module: "d1",
    title: { fa: "مدرک", en: "Document" },
    pk: "Id",
    columns: [id(), req("ProjectId", "text", { len: 60 }), req("DocNo", "text", { len: 80 }), req("TitleFa", "text", { len: 400 }), req("Revision", "text", { len: 10 }), req("Status", "text", { len: 30 }), c("Discipline", "text", { len: 40 }), c("Classification", "text", { len: 20 }), c("FilePath", "text", { len: 400 }), c("IssuedAt", "date")],
    indexes: [{ name: "UX_Document_DocNoRev", columns: ["ProjectId", "DocNo", "Revision"], unique: true }],
    foreignKeys: [{ column: "ProjectId", refTable: "Project", refColumn: "Id", onDelete: "CASCADE" }],
  },
  {
    name: "Transmittal",
    module: "d1",
    title: { fa: "ترانسمیتال", en: "Transmittal" },
    pk: "Id",
    columns: [id(), req("ProjectId", "text", { len: 60 }), req("TrnNo", "text", { len: 80 }), req("Direction", "text", { len: 20 }), req("IssuedAt", "date"), c("DueAt", "date"), req("Status", "text", { len: 30 }), c("Items", "json")],
    foreignKeys: [{ column: "ProjectId", refTable: "Project", refColumn: "Id", onDelete: "CASCADE" }],
  },

  /* ── d2 برنامه‌ریزی ── */
  {
    name: "WbsNode",
    module: "d2",
    title: { fa: "گره WBS", en: "WBS node" },
    pk: "Id",
    columns: [id(), req("ProjectId", "text", { len: 60 }), req("Code", "text", { len: 60 }), req("NameFa", "text", { len: 300 }), c("ParentId", "text", { len: 60 }), req("Level", "int"), c("Weight", "decimal", { precision: 9, scale: 4 })],
    indexes: [{ name: "UX_WbsNode_Code", columns: ["ProjectId", "Code"], unique: true }],
    foreignKeys: [{ column: "ProjectId", refTable: "Project", refColumn: "Id", onDelete: "CASCADE" }],
  },
  {
    name: "Activity",
    module: "d2",
    title: { fa: "فعالیت", en: "Activity" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      c("WbsId", "text", { len: 60 }),
      req("Code", "text", { len: 60 }),
      req("NameFa", "text", { len: 400 }),
      c("Discipline", "text", { len: 40 }),
      req("PlannedStart", "date"),
      req("PlannedFinish", "date"),
      c("ActualStart", "date"),
      c("ActualFinish", "date"),
      c("DurationDays", "int"),
      c("TotalFloat", "int"),
      c("FreeFloat", "int"),
      req("PhysicalPct", "decimal", { precision: 5, scale: 2, default: "0" }),
      c("BudgetCost", "decimal", { precision: 18, scale: 2 }),
      c("RocCode", "text", { len: 40 }),
      req("IsCritical", "bool", { default: "0" }),
    ],
    indexes: [
      { name: "UX_Activity_Code", columns: ["ProjectId", "Code"], unique: true },
      { name: "IX_Activity_Float", columns: ["ProjectId", "TotalFloat"] },
    ],
    foreignKeys: [{ column: "ProjectId", refTable: "Project", refColumn: "Id", onDelete: "CASCADE" }],
  },
  {
    name: "ActivityRelation",
    module: "d2",
    title: { fa: "رابطه فعالیت", en: "Activity relation" },
    pk: "Id",
    columns: [id(), req("PredecessorId", "text", { len: 60 }), req("SuccessorId", "text", { len: 60 }), req("RelType", "text", { len: 4, default: "'FS'" }), req("LagDays", "int", { default: "0" })],
    indexes: [{ name: "UX_ActivityRelation", columns: ["PredecessorId", "SuccessorId", "RelType"], unique: true }],
  },
  {
    name: "Baseline",
    module: "d2",
    title: { fa: "برنامه مبنا", en: "Baseline" },
    pk: "Id",
    columns: [id(), req("ProjectId", "text", { len: 60 }), req("Name", "text", { len: 120 }), req("SetAt", "datetime"), req("SetBy", "text", { len: 60 }), req("IsCurrent", "bool", { default: "0" }), c("Snapshot", "json")],
    foreignKeys: [{ column: "ProjectId", refTable: "Project", refColumn: "Id", onDelete: "CASCADE" }],
  },
  {
    name: "Period",
    module: "d2",
    title: { fa: "دوره گزارشی", en: "Reporting period" },
    pk: "Id",
    columns: [id(), req("ProjectId", "text", { len: 60 }), req("Code", "text", { len: 20 }), req("StartDate", "date"), req("EndDate", "date"), req("Status", "text", { len: 20, default: "'open'" }), c("ClosedAt", "datetime"), c("ClosedBy", "text", { len: 60 })],
    indexes: [{ name: "UX_Period_Code", columns: ["ProjectId", "Code"], unique: true }],
    foreignKeys: [{ column: "ProjectId", refTable: "Project", refColumn: "Id", onDelete: "CASCADE" }],
  },
  {
    name: "ProgressEntry",
    module: "d2",
    title: { fa: "ثبت پیشرفت", en: "Progress entry" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("ActivityId", "text", { len: 60 }),
      req("PeriodCode", "text", { len: 20 }),
      req("EntryDate", "date"),
      req("PhysicalPct", "decimal", { precision: 5, scale: 2 }),
      c("Steps", "json"),
      c("BlockedSteps", "json"),
      req("AcceptedIntoEv", "bool", { default: "0" }),
      c("Note", "text", { len: 500 }),
      req("EnteredBy", "text", { len: 60 }),
      c("ApprovedBy", "text", { len: 60 }),
      c("ApprovedAt", "datetime"),
    ],
    indexes: [
      { name: "IX_ProgressEntry_Activity", columns: ["ActivityId", "EntryDate"] },
      { name: "IX_ProgressEntry_Period", columns: ["ProjectId", "PeriodCode"] },
    ],
  },

  /* ── d3 پایش ── */
  {
    name: "EvmSnapshot",
    module: "d3",
    title: { fa: "عکس ارزش کسب‌شده", en: "EVM snapshot" },
    pk: "Id",
    columns: [id(), req("ProjectId", "text", { len: 60 }), req("DataDate", "date"), req("Pv", "decimal", { precision: 18, scale: 2 }), req("Ev", "decimal", { precision: 18, scale: 2 }), req("Ac", "decimal", { precision: 18, scale: 2 }), c("Bac", "decimal", { precision: 18, scale: 2 }), c("Eac", "decimal", { precision: 18, scale: 2 }), c("Spi", "decimal", { precision: 8, scale: 4 }), c("Cpi", "decimal", { precision: 8, scale: 4 })],
    indexes: [{ name: "UX_EvmSnapshot", columns: ["ProjectId", "DataDate"], unique: true }],
  },
  {
    name: "KpiSnapshot",
    module: "d3",
    title: { fa: "عکس شاخص", en: "KPI snapshot" },
    pk: "Id",
    columns: [id(), req("ProjectId", "text", { len: 60 }), req("KpiCode", "text", { len: 40 }), req("PeriodCode", "text", { len: 20 }), req("Value", "decimal", { precision: 18, scale: 4 }), c("Target", "decimal", { precision: 18, scale: 4 }), c("Status", "text", { len: 20 })],
    indexes: [{ name: "UX_KpiSnapshot", columns: ["ProjectId", "KpiCode", "PeriodCode"], unique: true }],
  },

  /* ── d4 ریسک و ادعا ── */
  {
    name: "Risk",
    module: "d4",
    title: { fa: "ریسک", en: "Risk" },
    pk: "Id",
    columns: [id(), req("ProjectId", "text", { len: 60 }), req("Code", "text", { len: 40 }), req("TitleFa", "text", { len: 400 }), req("Category", "text", { len: 40 }), req("Probability", "int"), req("Impact", "int"), c("Score", "int"), req("Status", "text", { len: 30 }), c("Owner", "text", { len: 120 }), c("Response", "text", { len: 1000 })],
    indexes: [{ name: "UX_Risk_Code", columns: ["ProjectId", "Code"], unique: true }],
    foreignKeys: [{ column: "ProjectId", refTable: "Project", refColumn: "Id", onDelete: "CASCADE" }],
  },
  {
    name: "ChangeRequest",
    module: "d4",
    title: { fa: "درخواست تغییر", en: "Change request" },
    pk: "Id",
    columns: [id(), req("ProjectId", "text", { len: 60 }), req("Code", "text", { len: 40 }), req("TitleFa", "text", { len: 400 }), req("RaisedBy", "text", { len: 60 }), req("RaisedAt", "date"), c("CostImpact", "decimal", { precision: 18, scale: 2 }), c("TimeImpactDays", "int"), req("Status", "text", { len: 30 }), c("ApprovedBy", "text", { len: 60 }), c("ApprovedAt", "datetime")],
    indexes: [{ name: "UX_ChangeRequest_Code", columns: ["ProjectId", "Code"], unique: true }],
  },
  {
    name: "Claim",
    module: "d4",
    title: { fa: "ادعا", en: "Claim" },
    pk: "Id",
    columns: [id(), req("ProjectId", "text", { len: 60 }), req("Code", "text", { len: 40 }), req("TitleFa", "text", { len: 400 }), req("NoticeDate", "date"), c("SubmittedAt", "date"), c("Amount", "decimal", { precision: 18, scale: 2 }), c("ExtensionDays", "int"), req("Status", "text", { len: 30 }), req("TimeBarred", "bool", { default: "0" })],
    indexes: [{ name: "UX_Claim_Code", columns: ["ProjectId", "Code"], unique: true }],
  },

  /* ── d5 مالی ── */
  {
    name: "CostAccount",
    module: "d5",
    title: { fa: "حساب هزینه", en: "Cost account" },
    pk: "Id",
    columns: [id(), req("ProjectId", "text", { len: 60 }), req("Code", "text", { len: 40 }), req("TitleFa", "text", { len: 300 }), req("Budget", "decimal", { precision: 18, scale: 2 }), req("Committed", "decimal", { precision: 18, scale: 2, default: "0" }), req("Actual", "decimal", { precision: 18, scale: 2, default: "0" }), c("Currency", "text", { len: 10, default: "'IRR'" })],
    indexes: [{ name: "UX_CostAccount_Code", columns: ["ProjectId", "Code"], unique: true }],
  },
  {
    name: "PaymentCertificate",
    module: "d5",
    title: { fa: "صورت‌وضعیت", en: "Payment certificate" },
    pk: "Id",
    columns: [id(), req("ProjectId", "text", { len: 60 }), req("SerialNo", "int"), req("PeriodCode", "text", { len: 20 }), req("GrossAmount", "decimal", { precision: 18, scale: 2 }), c("Deductions", "decimal", { precision: 18, scale: 2, default: "0" }), c("NetAmount", "decimal", { precision: 18, scale: 2 }), req("Status", "text", { len: 30 }), req("PreparedBy", "text", { len: 60 }), req("PreparedAt", "datetime"), c("ApprovedBy", "text", { len: 60 }), c("ApprovedAt", "datetime")],
    indexes: [{ name: "UX_PaymentCertificate", columns: ["ProjectId", "SerialNo"], unique: true }],
  },

  /* ── d8 کیفیت ── */
  {
    name: "Ncr",
    module: "d8",
    title: { fa: "عدم انطباق", en: "Non-conformance report" },
    pk: "Id",
    columns: [id(), req("ProjectId", "text", { len: 60 }), req("Code", "text", { len: 40 }), req("TitleFa", "text", { len: 400 }), req("Severity", "text", { len: 20 }), req("Discipline", "text", { len: 40 }), req("RaisedBy", "text", { len: 60 }), req("RaisedAt", "date"), c("DueAt", "date"), req("Status", "text", { len: 30 }), c("ClosedBy", "text", { len: 60 }), c("ClosedAt", "datetime"), c("Disposition", "text", { len: 40 })],
    indexes: [
      { name: "UX_Ncr_Code", columns: ["ProjectId", "Code"], unique: true },
      { name: "IX_Ncr_Open", columns: ["ProjectId", "Status", "Severity"] },
    ],
  },
  {
    name: "InspectionRecord",
    module: "d8",
    title: { fa: "گزارش بازرسی", en: "Inspection record" },
    pk: "Id",
    columns: [id(), req("ProjectId", "text", { len: 60 }), req("Code", "text", { len: 40 }), req("ItpPointCode", "text", { len: 40 }), req("ActivityId", "text", { len: 60 }), req("InspectedAt", "date"), req("Outcome", "text", { len: 20 }), req("InspectedBy", "text", { len: 60 }), c("WitnessedBy", "text", { len: 60 }), c("Remarks", "text", { len: 1000 })],
    indexes: [{ name: "UX_InspectionRecord_Code", columns: ["ProjectId", "Code"], unique: true }],
  },

  /* ── d10 منابع انسانی ── */
  {
    name: "WorkforceMember",
    module: "d10",
    title: { fa: "نیروی کار", en: "Workforce member" },
    pk: "Id",
    columns: [id(), req("ProjectId", "text", { len: 60 }), req("PersonnelNo", "text", { len: 30 }), req("FullName", "text", { len: 160 }), req("TradeCode", "text", { len: 30 }), c("Discipline", "text", { len: 40 }), c("NationalId", "text", { len: 20 }), c("Mobile", "text", { len: 20 }), c("DailyRate", "decimal", { precision: 18, scale: 2 }), req("IsSubcontracted", "bool", { default: "0" }), req("Active", "bool", { default: "1" })],
    indexes: [{ name: "UX_WorkforceMember", columns: ["ProjectId", "PersonnelNo"], unique: true }],
  },
  {
    name: "Timesheet",
    module: "d10",
    title: { fa: "تایم‌شیت", en: "Timesheet" },
    pk: "Id",
    columns: [id(), req("ProjectId", "text", { len: 60 }), req("MemberId", "text", { len: 60 }), req("WorkDate", "date"), req("NormalHours", "decimal", { precision: 5, scale: 2, default: "0" }), req("OvertimeHours", "decimal", { precision: 5, scale: 2, default: "0" }), req("HolidayHours", "decimal", { precision: 5, scale: 2, default: "0" }), c("ActivityId", "text", { len: 60 }), req("Status", "text", { len: 20, default: "'draft'" }), req("EnteredBy", "text", { len: 60 }), c("ApprovedBy", "text", { len: 60 }), c("ApprovedAt", "datetime")],
    indexes: [{ name: "UX_Timesheet", columns: ["MemberId", "WorkDate"], unique: true }],
  },

  /* ── d11 ارتباطات ── */
  {
    name: "Correspondence",
    module: "d11",
    title: { fa: "مکاتبه", en: "Correspondence" },
    pk: "Id",
    columns: [id(), req("ProjectId", "text", { len: 60 }), req("LetterNo", "text", { len: 80 }), req("Direction", "text", { len: 20 }), req("Kind", "text", { len: 30 }), req("SubjectFa", "text", { len: 500 }), req("IssuedAt", "date"), c("DueAt", "date"), req("Status", "text", { len: 30 }), c("Classification", "text", { len: 20 }), c("RefLetterNo", "text", { len: 80 }), req("TimeBarred", "bool", { default: "0" })],
    indexes: [
      { name: "UX_Correspondence_LetterNo", columns: ["ProjectId", "LetterNo"], unique: true },
      { name: "IX_Correspondence_Due", columns: ["ProjectId", "DueAt", "Status"] },
    ],
  },
  {
    name: "MeetingMinute",
    module: "d11",
    title: { fa: "صورت‌جلسه", en: "Meeting minutes" },
    pk: "Id",
    columns: [id(), req("ProjectId", "text", { len: 60 }), req("Code", "text", { len: 40 }), req("TitleFa", "text", { len: 300 }), req("HeldAt", "date"), c("Attendees", "json"), c("Decisions", "json"), c("Actions", "json")],
    indexes: [{ name: "UX_MeetingMinute_Code", columns: ["ProjectId", "Code"], unique: true }],
  },
  {
    name: "LessonLearned",
    module: "d11",
    title: { fa: "درس آموخته", en: "Lesson learned" },
    pk: "Id",
    columns: [id(), req("ProjectId", "text", { len: 60 }), req("Code", "text", { len: 40 }), req("TitleFa", "text", { len: 400 }), req("Category", "text", { len: 40 }), req("Impact", "text", { len: 20 }), req("Validated", "bool", { default: "0" }), req("ReuseCount", "int", { default: "0" }), c("Value", "int")],
    indexes: [{ name: "UX_LessonLearned_Code", columns: ["ProjectId", "Code"], unique: true }],
  },

  /* ── گزارش ── */
  {
    name: "ReportIssue",
    module: "core",
    title: { fa: "صدور گزارش", en: "Report issue" },
    pk: "Id",
    columns: [id(), req("ProjectId", "text", { len: 60 }), req("ReportCode", "text", { len: 20 }), req("DocNo", "text", { len: 80 }), req("Revision", "text", { len: 10 }), req("Audience", "text", { len: 20 }), req("IssuedAt", "datetime"), req("IssuedBy", "text", { len: 60 }), c("Distribution", "json"), c("Format", "text", { len: 10 })],
    indexes: [{ name: "UX_ReportIssue", columns: ["DocNo", "Revision"], unique: true }],
  },
];

const TABLE_BY_NAME = new Map(SCHEMA.map((t) => [t.name, t]));

export function tableDef(name: string): TableDef | undefined {
  return TABLE_BY_NAME.get(name);
}

export function tablesOfModule(module: string): TableDef[] {
  return SCHEMA.filter((t) => t.module === module);
}

export function schemaStats() {
  const columns = SCHEMA.reduce((s, t) => s + allColumns(t).length, 0);
  const indexes = SCHEMA.reduce((s, t) => s + (t.indexes?.length ?? 0), 0);
  const fks = SCHEMA.reduce((s, t) => s + (t.foreignKeys?.length ?? 0), 0);
  return { tables: SCHEMA.length, columns, indexes, foreignKeys: fks };
}

/** ایرادهای ساختاری اسکیما — باید همیشه خالی باشد. */
export function validateSchema(tables: TableDef[] = SCHEMA): string[] {
  const errs: string[] = [];
  const names = new Set<string>();
  for (const t of tables) {
    if (names.has(t.name)) errs.push(`جدول تکراری: ${t.name}`);
    names.add(t.name);
    if (!isSafeIdentifier(t.name)) errs.push(`نام جدول ناامن: ${t.name}`);

    const cols = new Set<string>();
    for (const col of allColumns(t)) {
      if (cols.has(col.name)) errs.push(`${t.name}: ستون تکراری ${col.name}`);
      cols.add(col.name);
      if (!isSafeIdentifier(col.name)) errs.push(`${t.name}: نام ستون ناامن ${col.name}`);
    }
    if (!cols.has(t.pk)) errs.push(`${t.name}: کلید اصلی ${t.pk} ستون نیست`);

    for (const idx of t.indexes ?? []) {
      if (!isSafeIdentifier(idx.name)) errs.push(`${t.name}: نام ایندکس ناامن ${idx.name}`);
      for (const cn of idx.columns) if (!cols.has(cn)) errs.push(`${t.name}.${idx.name}: ستون ${cn} وجود ندارد`);
    }
    for (const fk of t.foreignKeys ?? []) {
      if (!cols.has(fk.column)) errs.push(`${t.name}: کلید خارجی روی ستون ناموجود ${fk.column}`);
      if (!tables.some((x) => x.name === fk.refTable)) errs.push(`${t.name}: کلید خارجی به جدول ناموجود ${fk.refTable}`);
    }
  }
  return errs;
}

/* ═══════════════════════════ ۶. موتور مهاجرت ═══════════════════════════ */

export type Migration = { version: string; name: string; statements: string[] };
export type AppliedMigration = { version: string; name: string; checksum: string; appliedAt: string };

/**
 * چک‌سام پایدار و مستقل از فاصله‌گذاری.
 * FNV-1a سی‌ودو بیتی — سبک است و برای تشخیص تغییرِ اسکریپت مهاجرت کافی؛
 * ادعای رمزنگاری ندارد.
 */
export function checksumOf(statements: string[]): string {
  const text = statements.map((s) => s.replace(/\s+/g, " ").trim()).join(";");
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `fnv1a-${h.toString(16).padStart(8, "0")}`;
}

export const MIGRATIONS: Migration[] = [
  {
    version: "0001",
    name: "core_and_security",
    statements: [
      ...["SchemaMigration", "Industry", "Project", "AppUser", "UserRole", "UserProjectScope", "Delegation", "AuditLog"].flatMap((n) => {
        const t = TABLE_BY_NAME.get(n)!;
        return [tableDdl(t, "mssql"), ...(t.indexes ?? []).map((i) => indexDdl(t, i, "mssql"))];
      }),
    ],
  },
  {
    version: "0002",
    name: "documents_and_planning",
    statements: ["Document", "Transmittal", "WbsNode", "Activity", "ActivityRelation", "Baseline", "Period", "ProgressEntry"].flatMap((n) => {
      const t = TABLE_BY_NAME.get(n)!;
      return [tableDdl(t, "mssql"), ...(t.indexes ?? []).map((i) => indexDdl(t, i, "mssql"))];
    }),
  },
  {
    version: "0003",
    name: "controls_risk_finance",
    statements: ["EvmSnapshot", "KpiSnapshot", "Risk", "ChangeRequest", "Claim", "CostAccount", "PaymentCertificate"].flatMap((n) => {
      const t = TABLE_BY_NAME.get(n)!;
      return [tableDdl(t, "mssql"), ...(t.indexes ?? []).map((i) => indexDdl(t, i, "mssql"))];
    }),
  },
  {
    version: "0004",
    name: "quality_workforce_comms",
    statements: ["Ncr", "InspectionRecord", "WorkforceMember", "Timesheet", "Correspondence", "MeetingMinute", "LessonLearned", "ReportIssue"].flatMap((n) => {
      const t = TABLE_BY_NAME.get(n)!;
      return [tableDdl(t, "mssql"), ...(t.indexes ?? []).map((i) => indexDdl(t, i, "mssql"))];
    }),
  },
];

export function pendingMigrations(applied: AppliedMigration[], all: Migration[] = MIGRATIONS): Migration[] {
  const done = new Set(applied.map((a) => a.version));
  return all.filter((m) => !done.has(m.version)).sort((a, b) => a.version.localeCompare(b.version));
}

/**
 * اگر اسکریپت مهاجرتی که قبلاً اجرا شده بعداً ویرایش شود، چک‌سام نمی‌خواند.
 * این خطرناک‌ترین حالت است چون پایگاه داده و کد بی‌سروصدا واگرا می‌شوند.
 */
export function detectDrift(applied: AppliedMigration[], all: Migration[] = MIGRATIONS): { version: string; expected: string; found: string }[] {
  const byVersion = new Map(all.map((m) => [m.version, m]));
  const out: { version: string; expected: string; found: string }[] = [];
  for (const a of applied) {
    const m = byVersion.get(a.version);
    if (!m) continue;
    const expected = checksumOf(m.statements);
    if (expected !== a.checksum) out.push({ version: a.version, expected, found: a.checksum });
  }
  return out;
}

export type MigrationPlan = {
  upToDate: boolean;
  pending: { version: string; name: string; statements: number; checksum: string }[];
  drift: { version: string; expected: string; found: string }[];
  missingLocally: string[];
};

export function migrationPlan(applied: AppliedMigration[], all: Migration[] = MIGRATIONS): MigrationPlan {
  const pending = pendingMigrations(applied, all).map((m) => ({ version: m.version, name: m.name, statements: m.statements.length, checksum: checksumOf(m.statements) }));
  const drift = detectDrift(applied, all);
  const known = new Set(all.map((m) => m.version));
  const missingLocally = applied.filter((a) => !known.has(a.version)).map((a) => a.version);
  return { upToDate: pending.length === 0 && drift.length === 0 && missingLocally.length === 0, pending, drift, missingLocally };
}

/* ═══════════════════════════ ۷. اعتبارسنجی ردیف ═══════════════════════════ */

export type RowIssue = { code: string; column?: string; message: string };
export type Row = Record<string, unknown>;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function validateRow(table: TableDef, row: Row, mode: "insert" | "update" = "insert"): RowIssue[] {
  const issues: RowIssue[] = [];
  const cols = new Map(allColumns(table).map((col) => [col.name, col]));

  for (const key of Object.keys(row)) {
    if (!cols.has(key)) issues.push({ code: "E-SQL-UNKNOWN-COL", column: key, message: `ستون ${key} در جدول ${table.name} نیست` });
  }

  for (const col of cols.values()) {
    const has = Object.prototype.hasOwnProperty.call(row, col.name);
    const v = row[col.name];

    if (mode === "insert" && col.nullable === false && col.default === undefined && (!has || v === null || v === undefined)) {
      issues.push({ code: "E-SQL-NOT-NULL", column: col.name, message: `${col.name} اجباری است` });
      continue;
    }
    if (!has || v === null || v === undefined) continue;

    switch (col.kind) {
      case "int":
      case "bigint":
        if (typeof v !== "number" || !Number.isInteger(v)) issues.push({ code: "E-SQL-TYPE", column: col.name, message: `${col.name} باید عدد صحیح باشد` });
        break;
      case "decimal":
        if (typeof v !== "number" || Number.isNaN(v)) issues.push({ code: "E-SQL-TYPE", column: col.name, message: `${col.name} باید عدد باشد` });
        break;
      case "bool":
        if (typeof v !== "boolean") issues.push({ code: "E-SQL-TYPE", column: col.name, message: `${col.name} باید بولی باشد` });
        break;
      case "date":
        if (typeof v !== "string" || !ISO_DATE.test(v)) issues.push({ code: "E-SQL-DATE", column: col.name, message: `${col.name} باید تاریخ YYYY-MM-DD باشد` });
        break;
      case "datetime":
        if (typeof v !== "string" || Number.isNaN(Date.parse(v))) issues.push({ code: "E-SQL-DATETIME", column: col.name, message: `${col.name} باید زمان ISO باشد` });
        break;
      case "json":
        if (typeof v !== "string" && typeof v !== "object") issues.push({ code: "E-SQL-TYPE", column: col.name, message: `${col.name} باید شیء یا رشته JSON باشد` });
        break;
      case "uuid":
      case "text":
        if (typeof v !== "string") {
          issues.push({ code: "E-SQL-TYPE", column: col.name, message: `${col.name} باید رشته باشد` });
        } else if (col.len && v.length > col.len) {
          issues.push({ code: "E-SQL-LENGTH", column: col.name, message: `${col.name} از ${col.len} نویسه بلندتر است (${v.length})` });
        }
        break;
    }
  }
  return issues;
}

/** تبدیل مقدار سطح برنامه به مقدار قابل ذخیره. */
export function toStorage(col: ColumnDef, v: unknown): unknown {
  if (v === undefined || v === null) return null;
  if (col.kind === "json") return typeof v === "string" ? v : JSON.stringify(v);
  if (col.kind === "bool") return v ? 1 : 0;
  return v;
}

/** تبدیل مقدار ذخیره‌شده به مقدار سطح برنامه. */
export function fromStorage(col: ColumnDef, v: unknown): unknown {
  if (v === undefined || v === null) return null;
  if (col.kind === "json") {
    if (typeof v !== "string") return v;
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  }
  if (col.kind === "bool") return v === true || v === 1 || v === "1";
  if (col.kind === "int" || col.kind === "bigint" || col.kind === "decimal") return typeof v === "string" ? Number(v) : v;
  return v;
}

export function mapToStorage(table: TableDef, row: Row): Row {
  const cols = new Map(allColumns(table).map((col) => [col.name, col]));
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) {
    const col = cols.get(k);
    if (!col) continue;
    out[k] = toStorage(col, v);
  }
  return out;
}

export function mapFromStorage(table: TableDef, row: Row): Row {
  const cols = new Map(allColumns(table).map((col) => [col.name, col]));
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) {
    const col = cols.get(k);
    out[k] = col ? fromStorage(col, v) : v;
  }
  return out;
}

/* ═══════════════════════════ ۸. سازندهٔ پرس‌وجو ═══════════════════════════ */

export type WhereOp = "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "like" | "in" | "isnull" | "notnull";
export type WhereClause = { column: string; op: WhereOp; value?: unknown };
export type OrderBy = { column: string; dir?: "asc" | "desc" };

export type BuiltQuery = { sql: string; params: unknown[] };

const OP_SQL: Record<Exclude<WhereOp, "in" | "isnull" | "notnull">, string> = {
  eq: "=",
  ne: "<>",
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
  like: "LIKE",
};

/** جای‌نگهدار پارامتر — هرگز مقدار داخل SQL جاسازی نمی‌شود. */
function placeholder(dialect: SqlDialect, index: number): string {
  return dialect === "mssql" ? `@p${index}` : "?";
}

function buildWhere(where: WhereClause[], dialect: SqlDialect, params: unknown[], table?: TableDef): string {
  if (where.length === 0) return "";
  const known = table ? new Set(allColumns(table).map((col) => col.name)) : null;
  const parts: string[] = [];
  for (const w of where) {
    assertIdentifier(w.column);
    if (known && !known.has(w.column)) throw new Error(`SQL_UNKNOWN_COLUMN: ${table!.name}.${w.column}`);
    const col = quoteIdent(w.column, dialect);
    if (w.op === "isnull") {
      parts.push(`${col} IS NULL`);
    } else if (w.op === "notnull") {
      parts.push(`${col} IS NOT NULL`);
    } else if (w.op === "in") {
      const list = Array.isArray(w.value) ? w.value : [w.value];
      if (list.length === 0) {
        parts.push("1 = 0"); // IN تهی یعنی هیچ ردیفی — نه خطای نحوی
        continue;
      }
      const ph = list.map((v) => {
        params.push(v);
        return placeholder(dialect, params.length - 1);
      });
      parts.push(`${col} IN (${ph.join(", ")})`);
    } else {
      params.push(w.value);
      parts.push(`${col} ${OP_SQL[w.op]} ${placeholder(dialect, params.length - 1)}`);
    }
  }
  return ` WHERE ${parts.join(" AND ")}`;
}

export function buildInsert(table: TableDef, row: Row, dialect: SqlDialect = "mssql"): BuiltQuery {
  const cols = new Map(allColumns(table).map((col) => [col.name, col]));
  const entries = Object.entries(row).filter(([k]) => cols.has(k));
  if (entries.length === 0) throw new Error(`SQL_EMPTY_INSERT: ${table.name}`);
  const params: unknown[] = [];
  const names: string[] = [];
  const values: string[] = [];
  for (const [k, v] of entries) {
    names.push(quoteIdent(k, dialect));
    params.push(toStorage(cols.get(k)!, v));
    values.push(placeholder(dialect, params.length - 1));
  }
  return { sql: `INSERT INTO ${qualifiedName(table.name, dialect)} (${names.join(", ")}) VALUES (${values.join(", ")});`, params };
}

/**
 * به‌روزرسانی با کنترل هم‌زمانی خوش‌بینانه: اگر `expectedRowVersion` بدهید،
 * شرط به WHERE اضافه می‌شود و در صورت تغییر هم‌زمان، صفر ردیف تحت تأثیر قرار می‌گیرد.
 */
export function buildUpdate(
  table: TableDef,
  row: Row,
  where: WhereClause[],
  dialect: SqlDialect = "mssql",
  opts: { expectedRowVersion?: number; updatedBy?: string } = {}
): BuiltQuery {
  const cols = new Map(allColumns(table).map((col) => [col.name, col]));
  const entries = Object.entries(row).filter(([k]) => cols.has(k) && k !== table.pk && k !== "RowVersion" && k !== "CreatedAt" && k !== "CreatedBy");
  if (entries.length === 0) throw new Error(`SQL_EMPTY_UPDATE: ${table.name}`);
  const params: unknown[] = [];
  const sets: string[] = [];
  for (const [k, v] of entries) {
    params.push(toStorage(cols.get(k)!, v));
    sets.push(`${quoteIdent(k, dialect)} = ${placeholder(dialect, params.length - 1)}`);
  }
  params.push(new Date().toISOString());
  sets.push(`${quoteIdent("UpdatedAt", dialect)} = ${placeholder(dialect, params.length - 1)}`);
  if (opts.updatedBy) {
    params.push(opts.updatedBy);
    sets.push(`${quoteIdent("UpdatedBy", dialect)} = ${placeholder(dialect, params.length - 1)}`);
  }
  sets.push(`${quoteIdent("RowVersion", dialect)} = ${quoteIdent("RowVersion", dialect)} + 1`);

  const fullWhere: WhereClause[] = [...where];
  if (opts.expectedRowVersion !== undefined) fullWhere.push({ column: "RowVersion", op: "eq", value: opts.expectedRowVersion });
  const whereSql = buildWhere(fullWhere, dialect, params, table);
  if (!whereSql) throw new Error(`SQL_UNSAFE_UPDATE_NO_WHERE: ${table.name}`);
  return { sql: `UPDATE ${qualifiedName(table.name, dialect)} SET ${sets.join(", ")}${whereSql};`, params };
}

export function buildDelete(table: TableDef, where: WhereClause[], dialect: SqlDialect = "mssql"): BuiltQuery {
  const params: unknown[] = [];
  const whereSql = buildWhere(where, dialect, params, table);
  if (!whereSql) throw new Error(`SQL_UNSAFE_DELETE_NO_WHERE: ${table.name}`);
  return { sql: `DELETE FROM ${qualifiedName(table.name, dialect)}${whereSql};`, params };
}

export type SelectSpec = {
  columns?: string[];
  where?: WhereClause[];
  orderBy?: OrderBy[];
  limit?: number;
  offset?: number;
};

export function buildSelect(table: TableDef, spec: SelectSpec = {}, dialect: SqlDialect = "mssql"): BuiltQuery {
  const known = new Set(allColumns(table).map((col) => col.name));
  const cols = spec.columns?.length
    ? spec.columns.map((cn) => {
        if (!known.has(cn)) throw new Error(`SQL_UNKNOWN_COLUMN: ${table.name}.${cn}`);
        return quoteIdent(cn, dialect);
      })
    : ["*"];
  const params: unknown[] = [];
  let sql = `SELECT ${cols.join(", ")} FROM ${qualifiedName(table.name, dialect)}`;
  sql += buildWhere(spec.where ?? [], dialect, params, table);

  const order = spec.orderBy ?? [];
  for (const o of order) {
    if (!known.has(o.column)) throw new Error(`SQL_UNKNOWN_COLUMN: ${table.name}.${o.column}`);
  }
  if (order.length) {
    sql += ` ORDER BY ${order.map((o) => `${quoteIdent(o.column, dialect)} ${o.dir === "desc" ? "DESC" : "ASC"}`).join(", ")}`;
  }

  if (spec.limit !== undefined || spec.offset !== undefined) {
    const limit = Math.max(0, Math.trunc(spec.limit ?? 1000));
    const offset = Math.max(0, Math.trunc(spec.offset ?? 0));
    if (dialect === "mssql") {
      // OFFSET/FETCH در SQL Server بدون ORDER BY نامعتبر است.
      if (!order.length) sql += ` ORDER BY ${quoteIdent(table.pk, dialect)} ASC`;
      sql += ` OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`;
    } else {
      sql += ` LIMIT ${limit} OFFSET ${offset}`;
    }
  }
  return { sql: sql + ";", params };
}

export function buildCount(table: TableDef, where: WhereClause[] = [], dialect: SqlDialect = "mssql"): BuiltQuery {
  const params: unknown[] = [];
  const sql = `SELECT COUNT(*) AS ${quoteIdent("Total", dialect)} FROM ${qualifiedName(table.name, dialect)}${buildWhere(where, dialect, params, table)};`;
  return { sql, params };
}

/* ═══════════════════════════ ۹. ارزیابی شرط در حافظه ═══════════════════════════ */

/**
 * همان معنای WHERE، ولی روی آرایهٔ جاوااسکریپت.
 * درایور فایلی از این استفاده می‌کند تا رفتارش با درایور SQL یکی بماند.
 */
export function matchesWhere(row: Row, where: WhereClause[]): boolean {
  return where.every((w) => {
    const v = row[w.column];
    switch (w.op) {
      case "isnull":
        return v === null || v === undefined;
      case "notnull":
        return v !== null && v !== undefined;
      case "in":
        return (Array.isArray(w.value) ? w.value : [w.value]).includes(v as never);
      case "like": {
        const pattern = String(w.value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".");
        return new RegExp(`^${pattern}$`, "i").test(String(v ?? ""));
      }
      case "ne":
        return v !== w.value;
      case "gt":
        return (v as number) > (w.value as number);
      case "gte":
        return (v as number) >= (w.value as number);
      case "lt":
        return (v as number) < (w.value as number);
      case "lte":
        return (v as number) <= (w.value as number);
      case "eq":
      default:
        return v === w.value;
    }
  });
}

export function applySelect(rows: Row[], spec: SelectSpec = {}): Row[] {
  let out = rows.filter((r) => matchesWhere(r, spec.where ?? []));
  for (const o of [...(spec.orderBy ?? [])].reverse()) {
    const dir = o.dir === "desc" ? -1 : 1;
    out = [...out].sort((a, b) => {
      const av = a[o.column];
      const bv = b[o.column];
      if (av === bv) return 0;
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      return (av < bv ? -1 : 1) * dir;
    });
  }
  const offset = spec.offset ?? 0;
  if (spec.limit !== undefined || spec.offset !== undefined) out = out.slice(offset, offset + (spec.limit ?? out.length));
  return out;
}

/* ═══════════════════════════ ۱۰. کمکی ═══════════════════════════ */

/** شناسهٔ یکتای قابل مرتب‌سازی بر حسب زمان — بدون وابستگی به کتابخانه. */
export function newId(prefix = "row", now: number = Date.now(), rand: () => number = Math.random): string {
  return `${prefix}-${now.toString(36)}-${Math.floor(rand() * 0x1000000).toString(36).padStart(5, "0")}`;
}

/** ردیف تازه با ستون‌های حسابرسی پر شده. */
export function withAudit(row: Row, userId: string, at: string = new Date().toISOString()): Row {
  return { ...row, CreatedAt: at, CreatedBy: userId, RowVersion: 1 };
}

export type ConflictResult = { ok: boolean; code?: "CONCURRENCY_CONFLICT" | "NOT_FOUND"; message?: string };

export function concurrencyResult(affectedRows: number, existed: boolean): ConflictResult {
  if (affectedRows > 0) return { ok: true };
  if (!existed) return { ok: false, code: "NOT_FOUND", message: "رکورد یافت نشد" };
  return { ok: false, code: "CONCURRENCY_CONFLICT", message: "رکورد توسط کاربر دیگری تغییر کرده است؛ صفحه را تازه کنید" };
}
