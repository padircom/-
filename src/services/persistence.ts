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

  /*
   * ایندکس یکتا روی ستون nullable در SQL Server فقط یک NULL می‌پذیرد.
   * وقتی ستونی به جدول پرداده افزوده می‌شود، همهٔ ردیف‌های قدیمی NULL
   * می‌گیرند و ساخت ایندکس یکتا شکست می‌خورد. فیلتر خودکار این حالت را
   * می‌بندد بی‌آنکه معنای یکتایی برای مقادیر واقعی عوض شود.
   *
   * فقط برای ایندکس یکتا و فقط وقتی دست‌کم یک ستونش nullable است.
   */
  const nullableCols = idx.unique
    ? idx.columns.filter((cn) => {
        const col = allColumns(table).find((x) => x.name === cn);
        return col ? col.nullable !== false : false;
      })
    : [];

  /* SQLite هم ایندکس جزئی را پشتیبانی می‌کند، ولی گویش‌های پشتیبانی‌شدهٔ
   * این پروژه mssql و sqlite‌اند و مشکلِ «یک NULL» رفتار SQL Server است. */
  let filter = "";
  if (nullableCols.length && dialect === "mssql") {
    filter = ` WHERE ${nullableCols.map((cn) => `${quoteIdent(cn, dialect)} IS NOT NULL`).join(" AND ")}`;
  }

  return `CREATE ${unique}INDEX ${quoteIdent(idx.name, dialect)} ON ${qualifiedName(table.name, dialect)} (${cols})${filter};`;
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
    /* بازنویسیِ پروژه‌ایِ درختِ فرایندهای دو حوزهٔ آغازین (d6 و d20).
     * Payload عمداً JSON است تا خودِ ساختارِ متغیرِ زیرفرایندها در یک ردیف
     * ذخیره شود؛ نسخهٔ پایه همچنان در framework.ts باقی می‌ماند. */
    name: "ProcessTree",
    module: "core",
    title: { fa: "درخت فرایند پروژه", en: "Project process taxonomy" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("DomainId", "text", { len: 20 }),
      req("Payload", "json"),
      req("IsActive", "bool", { default: "1" }),
    ],
    indexes: [
      { name: "UX_ProcessTree_ProjectDomain", columns: ["ProjectId", "DomainId"], unique: true },
    ],
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
    columns: [
      id(), req("ProjectId", "text", { len: 60 }), req("DocNo", "text", { len: 80 }),
      req("TitleFa", "text", { len: 400 }), c("TitleEn", "text", { len: 400 }),
      req("Revision", "text", { len: 10 }), req("Status", "text", { len: 30 }),
      c("Discipline", "text", { len: 40 }), c("Classification", "text", { len: 20 }),
      c("FilePath", "text", { len: 400 }), c("IssuedAt", "date"),
      /* کدِ بررسی (C1..C4) و زمانِ باقیماندهٔ SLA — همان‌هایی که پنلِ d1 نشان می‌دهد */
      c("ReviewCode", "text", { len: 10 }), c("SlaHours", "int"),
    ],
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
      /* بودجهٔ نفر-ساعت. مالک عدد، برنامه‌ریزی (d2) است؛ HRM فقط
       * مصرف‌کننده است و آن را مخرجِ ارزش کسب‌شده می‌کند (H-01).
       * بدون این ستون، شاخص بهره‌وری هیچ مبنایی ندارد. */
      c("BudgetMh", "decimal", { precision: 14, scale: 2 }),
      c("RocCode", "text", { len: 40 }),
      req("IsCritical", "bool", { default: "0" }),
      c("BlockedByEquipmentId", "text", { len: 60 }),
      c("BlockedByDocumentId", "text", { len: 60, comment: "قفل ساخت تا صدور IFC؛ ADR-ENG-04" }),
      /* قفل ایمنی. هم‌خانوادهٔ دو ستون بالا: فعالیت قفل می‌شود نه حذف،
       * چون حذف تاریخ توقف را از مسیر بحرانی پاک می‌کند و مبنای ادعای
       * تمدید زمان از بین می‌رود (ADR-HSE-10). */
      c("IsStopWorkOrder", "bool", { default: "0" }),
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

  /* ── چرخهٔ تدارکات: MR نزد مهندسی، PR و PO نزد مالی (شکاف ۳) ──
   *
   * مرز مالکیت صریح است: مهندسی می‌گوید «چه چیزی لازم است و کِی»، مالی
   * می‌گوید «از که و به چه قیمت». MaterialRequest در d12 می‌ماند چون
   * منشأ آن مدرک IFC است؛ PurchaseRequisition و PurchaseOrder در d5
   * می‌مانند چون کنترل بودجه و تعهد مالی آنجاست.
   *
   * پیوند بین دو دامنه با کلید نرم (MrCode/PrCode) برقرار می‌شود تا
   * ماژول‌ها به هم سخت گره نخورند — همان الگوی DocumentId و WbsId. */
  {
    name: "PurchaseRequisition",
    module: "d5",
    title: { fa: "درخواست خرید", en: "Purchase requisition" },
    pk: "Id",
    columns: [id(), req("ProjectId", "text", { len: 60 }), req("Code", "text", { len: 40 }), c("MrCode", "text", { len: 40 }), req("TitleFa", "text", { len: 400 }), c("Discipline", "text", { len: 40 }), req("RequestedBy", "text", { len: 60 }), req("RequestedAt", "date"), c("NeedByDate", "date"), c("EstimatedAmount", "decimal", { precision: 18, scale: 2 }), c("Currency", "text", { len: 10 }), c("CostAccountCode", "text", { len: 40 }), c("BudgetStatus", "text", { len: 30, comment: "ok|over_budget|unknown" }), req("Status", "text", { len: 30, comment: "draft|submitted|approved|rejected|converted|cancelled" }), c("ApprovedBy", "text", { len: 60 }), c("ApprovedAt", "datetime"), c("RemarksFa", "text", { len: 1000 })],
    indexes: [
      { name: "UX_PurchaseRequisition", columns: ["ProjectId", "Code"], unique: true },
      { name: "IX_PurchaseRequisition_Mr", columns: ["ProjectId", "MrCode"] },
    ],
  },
  {
    name: "PurchaseOrder",
    module: "d5",
    title: { fa: "سفارش خرید", en: "Purchase order" },
    pk: "Id",
    columns: [id(), req("ProjectId", "text", { len: 60 }), req("PoNo", "text", { len: 40 }), c("PrCode", "text", { len: 40 }), req("VendorName", "text", { len: 200 }), c("VendorCode", "text", { len: 40 }), req("TitleFa", "text", { len: 400 }), c("Discipline", "text", { len: 40 }), req("IssuedAt", "date"), c("PromisedDate", "date"), c("Amount", "decimal", { precision: 18, scale: 2 }), c("Currency", "text", { len: 10 }), c("CostAccountCode", "text", { len: 40 }), req("Status", "text", { len: 30, comment: "draft|issued|acknowledged|partially_received|received|closed|cancelled" }), c("ClosedAt", "datetime"), c("RemarksFa", "text", { len: 1000 })],
    indexes: [
      { name: "UX_PurchaseOrder", columns: ["ProjectId", "PoNo"], unique: true },
      { name: "IX_PurchaseOrder_Pr", columns: ["ProjectId", "PrCode"] },
    ],
  },

  /* ── d8 کیفیت ── */
  {
    name: "Ncr",
    module: "d8",
    title: { fa: "عدم انطباق", en: "Non-conformance report" },
    pk: "Id",
    columns: [id(), req("ProjectId", "text", { len: 60 }), req("Code", "text", { len: 40 }), req("TitleFa", "text", { len: 400 }), req("Severity", "text", { len: 20 }), req("Discipline", "text", { len: 40 }), req("RaisedBy", "text", { len: 60 }), req("RaisedAt", "date"), c("DueAt", "date"), req("Status", "text", { len: 30 }), c("ClosedBy", "text", { len: 60 }), c("ClosedAt", "datetime"), c("Disposition", "text", { len: 40 }), c("ActivityId", "text", { len: 60, comment: "فعالیت مرتبط — دروازهٔ کیفی ماژول پیمان با این ستون عدم انطباق باز را پیمایش می‌کند" })],
    indexes: [
      { name: "UX_Ncr_Code", columns: ["ProjectId", "Code"], unique: true },
      { name: "IX_Ncr_Open", columns: ["ProjectId", "Status", "Severity"] },
      /* پیمایش دروازهٔ کیفی: «عدم انطباق باز روی این فعالیت هست؟» نباید
       * جدول را کامل اسکن کند. */
      { name: "IX_Ncr_Activity", columns: ["ProjectId", "ActivityId", "Status"] },
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
    columns: [id(), req("ProjectId", "text", { len: 60 }), req("PersonnelNo", "text", { len: 30 }), req("FullName", "text", { len: 160 }), req("TradeCode", "text", { len: 30 }), c("Discipline", "text", { len: 40 }), c("NationalId", "text", { len: 20 }), c("Mobile", "text", { len: 20 }), c("DailyRate", "decimal", { precision: 18, scale: 2 }), req("IsSubcontracted", "bool", { default: "0" }), req("Active", "bool", { default: "1" }), c("LicenseType", "text", { len: 40 }), c("LicenseExpiry", "date")],
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

  /* ── d10 تایم‌شیت (HRM D4) ──
   *
   * جدول‌های میراثی `WorkforceMember` و `Timesheet` بالا دست نخورده
   * می‌مانند: دادهٔ تاریخی روی آن‌ها نشسته و سند D2 (ADR-02) سیاست
   * VIEW سازگاری را تعیین کرده است. جدول‌های زیر مدل کامل D2 را
   * پیاده می‌کنند و دانهٔ داده‌شان متفاوت است.
   */
  {
    name: "HrmTimesheetHeader",
    module: "d10",
    title: { fa: "برگهٔ روزانهٔ کارکرد", en: "Timesheet header" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      /* دانهٔ داده: یک اکیپ × یک روز × یک شیفت. کلید یکتای پایین
       * همین را تضمین می‌کند و شناسهٔ قطعی، همگام‌سازی آفلاین را
       * ایدمپوتنت می‌کند. */
      req("CrewId", "text", { len: 60 }),
      c("ObsNodeId", "text", { len: 60 }),
      req("WorkDate", "date"),
      req("Shift", "text", { len: 10, default: "'day'" }),
      req("Status", "text", { len: 24, default: "'draft'" }),
      req("Source", "text", { len: 10, default: "'web'" }),
      c("Weather", "text", { len: 40 }),
      c("SiteCondition", "text", { len: 80 }),
      /* موقعیت و عکس، ادعای «این نفرات آن روز آنجا بودند» را
       * قابل دفاع می‌کند؛ بدون آن صورت‌کارکرد فقط یک ادعاست. */
      c("GpsLat", "decimal", { precision: 9, scale: 6 }),
      c("GpsLng", "decimal", { precision: 9, scale: 6 }),
      c("GpsAccuracyM", "decimal", { precision: 8, scale: 2 }),
      c("PhotoRefs", "text", { len: 1000 }),
      c("ForemanSignatureRef", "text", { len: 200 }),
      c("ClientSignatureRef", "text", { len: 200 }),
      c("DeviceId", "text", { len: 80 }),
      c("AppVersion", "text", { len: 30 }),
      c("CapturedAt", "datetime"),
      req("SyncState", "text", { len: 12, default: "'synced'" }),
      /* شمارندهٔ نسخه، تنها راه تشخیص تعارض دو دستگاه است. */
      req("Revision", "int", { default: "1" }),
      c("LockedAt", "datetime"),
      c("LockedBy", "text", { len: 60 }),
      /* جمع‌ها مشتق و cache شده‌اند: همیشه برابر جمع ردیف‌ها. */
      req("TotalHoursRaw", "decimal", { precision: 9, scale: 2, default: "0" }),
      req("TotalHoursNormal", "decimal", { precision: 9, scale: 2, default: "0" }),
      req("TotalHoursOt", "decimal", { precision: 9, scale: 2, default: "0" }),
      req("TotalHoursNight", "decimal", { precision: 9, scale: 2, default: "0" }),
      req("TotalHoursHoliday", "decimal", { precision: 9, scale: 2, default: "0" }),
      req("EnteredBy", "text", { len: 60 }),
      c("SubmittedAt", "datetime"),
      c("ApprovedBy", "text", { len: 60 }),
      c("ApprovedAt", "datetime"),
      c("RejectReason", "text", { len: 600 }),
    ],
    indexes: [
      { name: "UX_HrmTsHeader", columns: ["ProjectId", "CrewId", "WorkDate", "Shift"], unique: true },
      { name: "IX_HrmTsHeader_Status", columns: ["ProjectId", "WorkDate", "Status"] },
    ],
  },
  {
    name: "HrmTimesheetEntry",
    module: "d10",
    title: { fa: "ردیف شارژ کارکرد", en: "Timesheet entry" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("HeaderId", "text", { len: 60 }),
      req("PersonId", "text", { len: 60 }),
      req("WorkDate", "date"),
      /* رسته و پایه در لحظهٔ ثبت snapshot می‌شوند: نفر ممکن است بعداً
       * ارتقا بگیرد، ولی گزارش تاریخی نباید تغییر کند. */
      req("TradeCode", "text", { len: 30 }),
      c("Grade", "text", { len: 20 }),
      /* ساعت بی‌صاحب پذیرفته نمی‌شود — قاعدهٔ ۱ سند D2. */
      req("ActivityId", "text", { len: 60 }),
      c("WbsId", "text", { len: 60 }),
      req("CbsId", "text", { len: 60 }),
      /* تنها عددی که کاربر وارد می‌کند. بقیه خروجی موتورند. */
      req("HoursRaw", "decimal", { precision: 5, scale: 2 }),
      req("HoursNormal", "decimal", { precision: 5, scale: 2, default: "0" }),
      req("HoursOt", "decimal", { precision: 5, scale: 2, default: "0" }),
      req("HoursNight", "decimal", { precision: 5, scale: 2, default: "0" }),
      req("HoursHoliday", "decimal", { precision: 5, scale: 2, default: "0" }),
      req("AttendanceCode", "text", { len: 20, default: "'present'" }),
      /* بی‌کاری اجباری ساعت واقعی است ولی بهره‌ور نیست؛ این تفکیک
       * مبنای LostTime و ادعای تأخیر است. */
      req("IsProductive", "bool", { default: "1" }),
      c("QtyDone", "decimal", { precision: 14, scale: 3 }),
      c("QtyUom", "text", { len: 20 }),
      c("RateLineId", "text", { len: 60 }),
      c("RcaReasonId", "text", { len: 60 }),
      c("Note", "text", { len: 600 }),
      /* ابطال به‌جای حذف — قاعدهٔ ۵ سند D2. */
      c("VoidedAt", "datetime"),
      c("VoidedBy", "text", { len: 60 }),
      c("VoidReason", "text", { len: 400 }),
    ],
    indexes: [
      { name: "IX_HrmTsEntry_Header", columns: ["HeaderId"] },
      { name: "IX_HrmTsEntry_Person", columns: ["PersonId", "WorkDate"] },
      { name: "IX_HrmTsEntry_Act", columns: ["ProjectId", "WorkDate", "ActivityId"] },
      { name: "IX_HrmTsEntry_Cbs", columns: ["CbsId", "WorkDate"] },
    ],
  },
  {
    name: "HrmPeriodLock",
    module: "d10",
    title: { fa: "قفل دورهٔ کارکرد", en: "Timesheet period lock" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("PeriodCode", "text", { len: 20 }),
      req("LockedBy", "text", { len: 60 }),
      req("LockedAt", "datetime"),
      c("ReasonFa", "text", { len: 400 }),
      c("UnlockedBy", "text", { len: 60 }),
      c("UnlockedAt", "datetime"),
      c("UnlockReasonFa", "text", { len: 400 }),
    ],
    indexes: [{ name: "UX_HrmPeriodLock", columns: ["ProjectId", "PeriodCode"], unique: true }],
  },
  {
    name: "HrmSyncConflict",
    module: "d10",
    title: { fa: "تعارض همگام‌سازی آفلاین", en: "Offline sync conflict" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("EntityType", "text", { len: 40 }),
      req("EntityId", "text", { len: 60 }),
      c("DeviceId", "text", { len: 80 }),
      req("LocalRevision", "int", { default: "0" }),
      req("ServerRevision", "int", { default: "0" }),
      c("LocalPayload", "text", { len: 4000 }),
      c("ServerPayload", "text", { len: 4000 }),
      req("DetectedAt", "datetime"),
      /* تصمیم ثبت می‌شود، نه فقط نتیجه: بعداً باید بتوان گفت چرا
       * نسخهٔ محلی کنار گذاشته شد. */
      req("Resolution", "text", { len: 20, default: "'manual'" }),
      c("ResolvedBy", "text", { len: 60 }),
      c("ResolvedAt", "datetime"),
      c("DiffSummaryFa", "text", { len: 1000 }),
      /* الزام سند اصلاحی به‌صورت صریح ذخیره می‌شود، نه استنتاج از متن
       * `DiffSummaryFa`. متن نمایشی برای خواندن آدم است؛ تصمیم گرفتن
       * بر پایهٔ آن یعنی یک ویرایش نگارشی می‌تواند بی‌صدا یک گیت را
       * خاموش کند. */
      req("RequiresAdjustment", "bool", { default: "0" }),
      /* دلیل انسانی همان گیت — تا پیام خطا دقیقاً بگوید چرا. */
      c("BlockReasonFa", "text", { len: 300 }),
      req("Status", "text", { len: 16, default: "'open'" }),
    ],
    indexes: [
      { name: "IX_HrmSyncConflict", columns: ["ProjectId", "Status", "DetectedAt"] },
      { name: "IX_HrmSyncConflict_Entity", columns: ["EntityType", "EntityId"] },
    ],
  },
  {
    name: "HrmAdjustment",
    module: "d10",
    title: { fa: "سند اصلاحی کارکرد", en: "Timesheet adjustment" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      /* دورهٔ بسته تغییر نمی‌کند؛ اصلاح فقط با ردیف جدید و ارجاع به
       * ردیف اصلی انجام می‌شود — ADR-10. */
      req("OriginalEntryId", "text", { len: 60 }),
      req("AdjustmentType", "text", { len: 20 }),
      req("DeltaHours", "decimal", { precision: 6, scale: 2, default: "0" }),
      c("NewActivityId", "text", { len: 60 }),
      c("NewCbsId", "text", { len: 60 }),
      c("ReasonCode", "text", { len: 40 }),
      req("ReasonTextFa", "text", { len: 600 }),
      req("PeriodCode", "text", { len: 20 }),
      c("ApprovedBy", "text", { len: 60 }),
      c("ApprovedAt", "datetime"),
      req("Status", "text", { len: 16, default: "'draft'" }),
      req("PostedToFin", "bool", { default: "0" }),
    ],
    indexes: [
      { name: "IX_HrmAdjustment_Entry", columns: ["OriginalEntryId"] },
      { name: "IX_HrmAdjustment_Period", columns: ["ProjectId", "PeriodCode", "Status"] },
    ],
  },

  /* ── d10 بهره‌وری (HRM D5) ──
   *
   * چهار جدول زیر یک زنجیرهٔ واحدند: لاگ بهره‌وری عدد را می‌سازد،
   * کاتالوگ علت آن را توضیح می‌دهد، ثبت علت آن را به یک فعالیت
   * می‌چسباند و عکس‌برداری متریک عدد را در زمان قفل می‌کند.
   */
  {
    name: "HrmProductivityLog",
    module: "d10",
    title: { fa: "سیاههٔ بهره‌وری", en: "Productivity log" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      /* دانه: فعالیت × دوره. ریزتر از این، عدد نوسان آماری می‌شود؛
       * درشت‌تر، علت افت گم می‌شود. */
      req("ActivityId", "text", { len: 60 }),
      req("PeriodCode", "text", { len: 20 }),
      c("TradeCode", "text", { len: 30 }),
      c("CbsId", "text", { len: 60 }),
      req("BudgetMh", "decimal", { precision: 14, scale: 2, default: "0" }),
      /* ارزش کسب‌شده = بودجه × پیشرفت **تأییدشده**. پیشرفت اعلامی
       * هرگز وارد این ستون نمی‌شود — ADR-09. */
      req("EarnedMh", "decimal", { precision: 14, scale: 2, default: "0" }),
      req("ActualMh", "decimal", { precision: 14, scale: 2, default: "0" }),
      req("ApprovedProgressPct", "decimal", { precision: 5, scale: 2, default: "0" }),
      req("Pi", "decimal", { precision: 8, scale: 3, default: "0" }),
      req("Pf", "decimal", { precision: 8, scale: 3, default: "0" }),
      c("QtyDone", "decimal", { precision: 14, scale: 3 }),
      c("QtyUom", "text", { len: 20 }),
      c("UnitRate", "decimal", { precision: 14, scale: 4 }),
      c("StdRate", "decimal", { precision: 14, scale: 4 }),
      c("VariancePct", "decimal", { precision: 8, scale: 2 }),
      req("Trend", "text", { len: 12, default: "'stable'" }),
      req("Status", "text", { len: 12, default: "'green'" }),
      /* ساعت غیرمولد جدا نگه داشته می‌شود چون مبنای ادعای تأخیر است
       * و نباید در PI با ساعت مولد قاطی شود. */
      req("LostMh", "decimal", { precision: 14, scale: 2, default: "0" }),
      req("IsCalibrated", "bool", { default: "0", comment: "نرخ استاندارد پس از سه دوره کالیبره می‌شود؛ H-15" }),
      req("ComputedAt", "datetime"),
      /* اثر انگشت ورودی: اگر عوض نشده باشد، محاسبهٔ دوباره لازم نیست
       * و اگر عوض شده باشد، عدد قدیمی قابل دفاع نیست. */
      req("InputHash", "text", { len: 64 }),
      req("IsFinal", "bool", { default: "0" }),
    ],
    indexes: [
      { name: "UX_HrmProdLog", columns: ["ProjectId", "ActivityId", "PeriodCode"], unique: true },
      { name: "IX_HrmProdLog_Period", columns: ["ProjectId", "PeriodCode", "Status"] },
      { name: "IX_HrmProdLog_Trade", columns: ["ProjectId", "TradeCode", "PeriodCode"] },
    ],
  },
  {
    name: "HrmRcaReason",
    module: "d10",
    title: { fa: "علت افت بهره‌وری", en: "Productivity RCA reason" },
    pk: "Id",
    columns: [
      id(),
      req("Code", "text", { len: 40 }),
      req("NameFa", "text", { len: 200 }),
      req("NameEn", "text", { len: 200 }),
      req("Category", "text", { len: 30 }),
      /* پرچم ادعاپذیری تصمیم قراردادی است نه فنی؛ اینجا ذخیره
       * می‌شود تا ماژول ادعا (d4) آن را دوباره اختراع نکند. */
      req("IsClaimable", "bool", { default: "0" }),
      req("DefaultOwnerDomain", "text", { len: 10 }),
      req("IsActive", "bool", { default: "1" }),
    ],
    indexes: [{ name: "UX_HrmRcaReason_Code", columns: ["Code"], unique: true }],
  },
  {
    name: "HrmRcaEntry",
    module: "d10",
    title: { fa: "ثبت علت افت", en: "Productivity RCA entry" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("ActivityId", "text", { len: 60 }),
      req("PeriodCode", "text", { len: 20 }),
      req("ReasonCode", "text", { len: 40 }),
      /* سهم درصدی هر علت؛ جمع سهم‌های یک فعالیت-دوره باید ۱۰۰ شود
       * وگرنه ریشه‌یابی ناقص است و موتور هشدار می‌دهد. */
      req("SharePct", "decimal", { precision: 5, scale: 2, default: "100" }),
      req("LostMh", "decimal", { precision: 14, scale: 2, default: "0" }),
      c("EstimatedCost", "decimal", { precision: 18, scale: 2 }),
      req("NoteFa", "text", { len: 800 }),
      req("RaisedBy", "text", { len: 60 }),
      req("RaisedAt", "datetime"),
      /* پل به ادعا: شناسه پس از ساخت ادعا در d4 پر می‌شود و دوباره
       * ساختن ادعا از همین ردیف را می‌بندد. */
      c("ClaimRef", "text", { len: 60 }),
      c("ClaimedAt", "datetime"),
      req("Status", "text", { len: 16, default: "'open'" }),
    ],
    indexes: [
      { name: "IX_HrmRcaEntry_Act", columns: ["ProjectId", "ActivityId", "PeriodCode"] },
      { name: "IX_HrmRcaEntry_Reason", columns: ["ProjectId", "ReasonCode", "Status"] },
    ],
  },
  {
    name: "HrmMetricSnapshot",
    module: "d10",
    title: { fa: "عکس متریک بهره‌وری", en: "Productivity metric snapshot" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("PeriodCode", "text", { len: 20 }),
      req("MetricCode", "text", { len: 20 }),
      req("Dimension", "text", { len: 16, default: "'project'" }),
      c("DimensionId", "text", { len: 60 }),
      req("Value", "decimal", { precision: 14, scale: 3, default: "0" }),
      c("Target", "decimal", { precision: 14, scale: 3 }),
      req("Status", "text", { len: 10, default: "'green'" }),
      req("ComputedAt", "datetime"),
      req("InputHash", "text", { len: 64 }),
      /* ADR-11: پس از نهایی شدن، تغییرناپذیر. گزارش ماه گذشته نباید
       * با ورود دادهٔ امروز عوض شود. */
      req("IsFinal", "bool", { default: "0" }),
    ],
    indexes: [
      { name: "UX_HrmMetricSnap", columns: ["ProjectId", "PeriodCode", "MetricCode", "Dimension", "DimensionId"], unique: true },
      { name: "IX_HrmMetricSnap_Period", columns: ["ProjectId", "PeriodCode", "Status"] },
    ],
  },

  /* ── d10 اکیپ و نیروی پیمانکاری (HRM D6) ──
   *
   * پنج جدول: اکیپ، عضویت، قرارداد پیمانکاری، حضور گروهی و
   * صورت‌کارکرد. دو دنیای موازی‌اند که عمداً جدا نگه داشته شده‌اند —
   * دلیلش در بخش ۱ سند D6 آمده است.
   */
  {
    name: "HrmCrew",
    module: "d10",
    title: { fa: "اکیپ کاری", en: "Work crew" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("Code", "text", { len: 40 }),
      req("NameFa", "text", { len: 200 }),
      c("ObsNodeId", "text", { len: 60 }),
      /* سرپرست اکیپ همان کسی است که برگهٔ کارکرد را امضا می‌کند؛
       * اکیپ بی‌سرپرست یعنی برگهٔ بی‌امضا. */
      c("ForemanPersonId", "text", { len: 60 }),
      req("PrimaryTradeCode", "text", { len: 30 }),
      /* ترکیب هدف رسته‌ها به‌صورت JSON: `{"CIV-FRM":6,"CIV-RBR":4}`.
       * انحراف ترکیب واقعی از آن، ریشهٔ شایع افت بهره‌وری است. */
      c("TargetMix", "json"),
      req("TargetSize", "int", { default: "0" }),
      c("DefaultCbsId", "text", { len: 60 }),
      c("ShiftCode", "text", { len: 10, default: "'day'" }),
      /* نیروی پیمانکاری اکیپ خودش را دارد؛ این پرچم مسیر هزینه را
       * از دستمزد مستقیم به صورت‌وضعیت پیمانکار می‌برد. */
      req("IsSubcontracted", "bool", { default: "0" }),
      c("SubContractId", "text", { len: 60 }),
      req("Status", "text", { len: 12, default: "'forming'" }),
      c("DisbandedAt", "datetime"),
      c("DisbandReasonFa", "text", { len: 400 }),
    ],
    indexes: [
      { name: "UX_HrmCrew_Code", columns: ["ProjectId", "Code"], unique: true },
      { name: "IX_HrmCrew_Status", columns: ["ProjectId", "Status", "PrimaryTradeCode"] },
    ],
  },
  {
    name: "HrmCrewMember",
    module: "d10",
    title: { fa: "عضویت در اکیپ", en: "Crew membership" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("CrewId", "text", { len: 60 }),
      req("PersonId", "text", { len: 60 }),
      req("RoleInCrew", "text", { len: 16, default: "'skilled'" }),
      req("TradeCode", "text", { len: 30 }),
      c("Grade", "text", { len: 20 }),
      req("FromDate", "date"),
      /* بازهٔ باز یعنی عضویت جاری. قید T-4 روی همین بازه‌ها اجرا
       * می‌شود: یک نفر در یک روز فقط در یک اکیپ فعال. */
      c("ToDate", "date"),
      /* درصد تخصیص: نفر می‌تواند نیمه‌وقت بین دو اکیپ باشد، ولی جمع
       * تخصیص‌های همپوشانش نباید از ۱۰۰ بگذرد (قید T-1). */
      req("AllocationPct", "decimal", { precision: 5, scale: 2, default: "100" }),
      c("ExitReasonFa", "text", { len: 400 }),
      req("Status", "text", { len: 12, default: "'active'" }),
    ],
    indexes: [
      { name: "IX_HrmCrewMember_Crew", columns: ["CrewId", "Status"] },
      { name: "IX_HrmCrewMember_Person", columns: ["ProjectId", "PersonId", "FromDate"] },
    ],
  },
  {
    name: "HrmSubContract",
    module: "d10",
    title: { fa: "قرارداد نیروی پیمانکاری", en: "Labour subcontract" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("ContractNo", "text", { len: 80 }),
      req("ContractorName", "text", { len: 200 }),
      /* رسته‌های مجاز؛ حضور خارج از این فهرست رد می‌شود تا پیمانکارِ
       * جوشکاری نتواند صورت‌کارکرد برق‌کار بفرستد. */
      c("ScopeTrades", "json"),
      req("PricingModel", "text", { len: 16, default: "'hourly'" }),
      /* نرخ توافقی به تفکیک رسته: `{"CIV-FRM":180000}`. نبود نرخ یک
       * رسته یعنی آن ردیف بی‌قیمت می‌ماند، نه صفر. */
      c("AgreedRates", "json"),
      req("Currency", "text", { len: 10, default: "'IRR'" }),
      req("StartDate", "date"),
      req("EndDate", "date"),
      req("RetentionPct", "decimal", { precision: 5, scale: 2, default: "0" }),
      c("PenaltyTermsFa", "text", { len: 1000 }),
      c("FinVendorId", "text", { len: 60 }),
      c("CntContractId", "text", { len: 60, comment: "پل به MOD-14 وقتی قرارداد در ماژول پیمان هم ثبت شده باشد" }),
      req("Status", "text", { len: 12, default: "'draft'" }),
    ],
    indexes: [
      { name: "UX_HrmSubContract_No", columns: ["ProjectId", "ContractNo"], unique: true },
      { name: "IX_HrmSubContract_Status", columns: ["ProjectId", "Status", "EndDate"] },
    ],
  },
  {
    name: "HrmSubAttendance",
    module: "d10",
    title: { fa: "حضور نیروی پیمانکاری", en: "Subcontractor attendance" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("SubContractId", "text", { len: 60 }),
      req("WorkDate", "date"),
      req("TradeCode", "text", { len: 30 }),
      /* دانهٔ داده **گروهی** است: تعداد نفر، نه فرد. جدا از
       * HrmTimesheetEntry می‌ماند چون مسیر تأیید و صورت‌وضعیتش
       * متفاوت است و قاطی کردنشان نفر-ساعت را دوبار می‌شمارد. */
      req("Headcount", "int", { default: "0" }),
      req("HoursPerPerson", "decimal", { precision: 5, scale: 2, default: "0" }),
      req("TotalHours", "decimal", { precision: 9, scale: 2, default: "0" }),
      req("ActivityId", "text", { len: 60 }),
      req("CbsId", "text", { len: 60 }),
      c("CrewId", "text", { len: 60 }),
      c("GatePassRef", "text", { len: 100 }),
      c("VerifiedBy", "text", { len: 60 }),
      c("VerifiedAt", "datetime"),
      c("InvoicePeriod", "text", { len: 20 }),
      c("SubIpcId", "text", { len: 60 }),
      req("Status", "text", { len: 16, default: "'draft'" }),
      c("RejectReasonFa", "text", { len: 600 }),
    ],
    indexes: [
      { name: "UX_HrmSubAtt", columns: ["SubContractId", "WorkDate", "TradeCode", "ActivityId"], unique: true },
      { name: "IX_HrmSubAtt_Period", columns: ["ProjectId", "InvoicePeriod", "Status"] },
    ],
  },
  {
    name: "HrmSubIpc",
    module: "d10",
    title: { fa: "صورت‌کارکرد نیروی پیمانکاری", en: "Labour subcontract certificate" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("SubContractId", "text", { len: 60 }),
      req("PeriodCode", "text", { len: 20 }),
      req("SerialNo", "int", { default: "1" }),
      req("TotalHours", "decimal", { precision: 12, scale: 2, default: "0" }),
      req("GrossAmount", "decimal", { precision: 18, scale: 2, default: "0" }),
      req("RetentionAmount", "decimal", { precision: 18, scale: 2, default: "0" }),
      req("DeductionAmount", "decimal", { precision: 18, scale: 2, default: "0" }),
      req("NetAmount", "decimal", { precision: 18, scale: 2, default: "0" }),
      /* ساعت بی‌نرخ صفر نمی‌شود؛ جدا نگه داشته می‌شود تا کسی مبلغ
       * ناقص را کامل نپندارد. */
      req("UnpricedHours", "decimal", { precision: 12, scale: 2, default: "0" }),
      c("DeductionNoteFa", "text", { len: 800 }),
      req("Status", "text", { len: 16, default: "'draft'" }),
      c("PreparedBy", "text", { len: 60 }),
      c("ApprovedBy", "text", { len: 60 }),
      c("ApprovedAt", "datetime"),
      c("FinPostingRef", "text", { len: 60 }),
    ],
    indexes: [
      { name: "UX_HrmSubIpc", columns: ["SubContractId", "PeriodCode"], unique: true },
      { name: "IX_HrmSubIpc_Status", columns: ["ProjectId", "Status", "PeriodCode"] },
    ],
  },

  /* ── D7 پذیرش، احکام و انطباق ── */
  {
    name: "HrmPerson",
    module: "d10",
    title: { fa: "پروندهٔ پرسنلی", en: "Personnel file" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("PersonnelNo", "text", { len: 40 }),
      req("FullNameFa", "text", { len: 200 }),
      c("NameEn", "text", { len: 200 }),
      /* کد ملی پشت مجوز `hrm.personal.view` ماسک می‌شود؛ ذخیره‌اش
       * لازم است چون گزارش بیمه و لیست ورود کارگاه بدون آن بی‌معناست. */
      c("NationalId", "text", { len: 20 }),
      c("Mobile", "text", { len: 20 }),
      c("EmergencyContact", "text", { len: 200 }),
      req("EmploymentType", "text", { len: 20, default: "'permanent'" }),
      /* نیروی پیمانکاری کارفرمای خودش را دارد؛ بدون این ستون مرز
       * دستمزد مستقیم و صورت‌کارکرد پیمانکار گم می‌شد. */
      c("EmployerSubContractId", "text", { len: 60 }),
      req("PrimaryTradeCode", "text", { len: 30 }),
      c("Grade", "text", { len: 20 }),
      c("HireDate", "date"),
      c("TerminationDate", "date"),
      req("Status", "text", { len: 16, default: "'candidate'" }),
      /* آینهٔ نتیجهٔ دروازهٔ HSE در لحظهٔ آخرین استعلام. منبع حقیقت
       * ماژول ایمنی است؛ این فقط حافظهٔ نتیجه برای نمایش سریع است و
       * هرگز مبنای تصمیم نیست. */
      req("HseClearance", "text", { len: 12, default: "'none'" }),
      c("HseCheckedAt", "datetime"),
      c("GatePassRef", "text", { len: 60 }),
      c("PhotoRef", "text", { len: 200 }),
      c("SignatureRef", "text", { len: 200 }),
      c("ActivatedAt", "datetime"),
      c("DemobilizedAt", "datetime"),
      c("ExitReasonFa", "text", { len: 400 }),
    ],
    indexes: [
      { name: "UX_HrmPerson_No", columns: ["ProjectId", "PersonnelNo"], unique: true },
      { name: "IX_HrmPerson_Status", columns: ["ProjectId", "Status", "PrimaryTradeCode"] },
    ],
  },
  {
    name: "HrmPersonDoc",
    module: "d10",
    title: { fa: "مدرک پرسنلی", en: "Personnel document" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("PersonId", "text", { len: 60 }),
      req("DocType", "text", { len: 20 }),
      c("DocNo", "text", { len: 60 }),
      c("IssuedAt", "date"),
      /* بدون تاریخ انقضا یعنی «دائمی»، نه «منقضی». تفاوت این دو،
       * تفاوت پروندهٔ سالم و پروندهٔ قرمز کاذب است. */
      c("ExpiresAt", "date"),
      c("FileRef", "text", { len: 200 }),
      /* مدرک مسدودکننده مانع فعال شدن نفر است؛ بقیه فقط هشدارند. */
      req("IsBlocking", "bool", { default: "0" }),
      req("Status", "text", { len: 12, default: "'valid'" }),
      c("VerifiedBy", "text", { len: 60 }),
      c("VerifiedAt", "datetime"),
      c("NoteFa", "text", { len: 400 }),
    ],
    indexes: [
      { name: "UX_HrmPersonDoc", columns: ["PersonId", "DocType", "DocNo"], unique: true },
      { name: "IX_HrmPersonDoc_Exp", columns: ["ProjectId", "ExpiresAt", "IsBlocking"] },
    ],
  },
  {
    name: "HrmSkill",
    module: "d10",
    title: { fa: "مهارت و صلاحیت", en: "Skill & competency" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("PersonId", "text", { len: 60 }),
      req("SkillCode", "text", { len: 30 }),
      c("SkillNameFa", "text", { len: 200 }),
      /* سطح ۱ تا ۵؛ سطح ۰ یعنی «ارزیابی نشده» که با «بلد نیست» یکی
       * نیست و در ماتریس مهارت جدا نشان داده می‌شود. */
      req("Level", "int", { default: "0" }),
      c("CertifiedAt", "date"),
      c("ExpiresAt", "date"),
      c("EvidenceRef", "text", { len: 200 }),
      c("VerifiedBy", "text", { len: 60 }),
      req("IsBlocking", "bool", { default: "0" }),
      req("Status", "text", { len: 12, default: "'valid'" }),
    ],
    indexes: [
      { name: "UX_HrmSkill", columns: ["PersonId", "SkillCode"], unique: true },
      { name: "IX_HrmSkill_Exp", columns: ["ProjectId", "ExpiresAt", "IsBlocking"] },
    ],
  },
  {
    name: "HrmMobRequest",
    module: "d10",
    title: { fa: "درخواست تجهیز نیرو", en: "Mobilization request" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("RequestNo", "text", { len: 40 }),
      req("RequestType", "text", { len: 16, default: "'mobilize'" }),
      req("TradeCode", "text", { len: 30 }),
      req("Qty", "int", { default: "1" }),
      req("NeedByDate", "date"),
      c("ObsNodeId", "text", { len: 60 }),
      c("CrewId", "text", { len: 60 }),
      c("PlanLineRef", "text", { len: 60 }),
      req("JustificationFa", "text", { len: 800 }),
      req("FulfilledQty", "int", { default: "0" }),
      c("FulfilledAt", "datetime"),
      req("Status", "text", { len: 20, default: "'draft'" }),
      c("SubmittedBy", "text", { len: 60 }),
      c("ApprovedBy", "text", { len: 60 }),
      c("ApprovedAt", "datetime"),
      c("RejectReasonFa", "text", { len: 400 }),
    ],
    indexes: [
      { name: "UX_HrmMobReq_No", columns: ["ProjectId", "RequestNo"], unique: true },
      { name: "IX_HrmMobReq_Status", columns: ["ProjectId", "Status", "NeedByDate"] },
    ],
  },
  {
    name: "HrmDemobCheck",
    module: "d10",
    title: { fa: "چک‌لیست تخلیهٔ نیرو", en: "Demobilization checklist" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("PersonId", "text", { len: 60 }),
      req("ItemCode", "text", { len: 30 }),
      req("IsDone", "bool", { default: "0" }),
      c("DoneBy", "text", { len: 60 }),
      c("DoneAt", "datetime"),
      c("NoteFa", "text", { len: 400 }),
      /* بند اختیاری (مثل مصاحبهٔ خروج) نبودنش مانع تخلیه نیست. */
      req("IsMandatory", "bool", { default: "1" }),
    ],
    indexes: [
      { name: "UX_HrmDemobCheck", columns: ["PersonId", "ItemCode"], unique: true },
    ],
  },

  {
    /* برنامهٔ مبنای نیرو (D8).
     *
     * تا اینجا «برنامه» فقط در حافظهٔ نمای برنامه‌ریزی بود. برای اینکه
     * هیستوگرام و منحنی S مبنای قابل استناد داشته باشند، باید جایی
     * ثبت شود که تغییرش ردیابی شود؛ وگرنه هر بار که کسی برنامه را
     * عوض کند، انحراف دیروز بی‌صدا ناپدید می‌شود.
     *
     * `Revision` هست چون برنامهٔ اولیه و بازنگری‌شده دو چیز متفاوت‌اند
     * و ادعای تأخیر معمولاً به همان مبنای اولیه استناد می‌کند. */
    name: "HrmManpowerPlan",
    module: "d10",
    title: { fa: "برنامهٔ مبنای نیرو", en: "Manpower baseline plan" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("PeriodCode", "text", { len: 10 }),
      req("Revision", "text", { len: 20, default: "'baseline'" }),
      c("TradeCode", "text", { len: 30 }),
      c("ObsNodeId", "text", { len: 60 }),
      req("PlannedMh", "decimal", { precision: 14, scale: 2, default: "0" }),
      req("PlannedHeadcount", "int", { default: "0" }),
      c("NoteFa", "text", { len: 400 }),
    ],
    indexes: [
      /* یک ردیف به ازای هر ترکیب دوره/رسته/بازنگری — دو مبنای همزمان
       * یعنی دو عدد انحراف متفاوت برای یک ماه. */
      { name: "UX_HrmManpowerPlan", columns: ["ProjectId", "PeriodCode", "Revision", "TradeCode"], unique: true },
      { name: "IX_HrmManpowerPlan_Period", columns: ["ProjectId", "PeriodCode"] },
    ],
  },

  {
    /* دفتر دسته‌های همگام‌سازی (D9).
     *
     * بدون این جدول، ایدمپوتنسی ممکن نیست: شبکهٔ کارگاه دقیقاً وقتی
     * قطع می‌شود که سرور نوشته و پاسخ نرسیده. دستگاه دوباره می‌فرستد
     * و بدون سابقهٔ دسته، سرور دوباره می‌نویسد و نفر-ساعت دو برابر
     * می‌شود.
     *
     * پاسخ کامل ذخیره می‌شود نه فقط «دیده شد»: ارسال دوباره باید
     * *همان* پاسخ اول را بگیرد، وگرنه دستگاه نمی‌داند کدام برگه‌ها
     * را از صف پاک کند. */
    name: "HrmSyncBatch",
    module: "d10",
    title: { fa: "دستهٔ همگام‌سازی میدانی", en: "Field sync batch" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("DeviceId", "text", { len: 80 }),
      req("Fingerprint", "text", { len: 40 }),
      req("ItemCount", "int", { default: "0" }),
      req("ReceivedAt", "datetime"),
      req("ReceivedBy", "text", { len: 60 }),
      c("AppVersion", "text", { len: 30 }),
      /* پاسخ اول، عیناً. حجمش کران‌دار است چون سقف دسته ۲۰۰ برگه است. */
      c("ResultJson", "text", { len: 8000 }),
      req("AppliedCount", "int", { default: "0" }),
      req("ConflictCount", "int", { default: "0" }),
      req("ReplayCount", "int", { default: "0" }),
      c("LastReplayAt", "datetime"),
    ],
    indexes: [
      /* کلید ایدمپوتنسی. اثر انگشت از محتوا ساخته می‌شود، پس همان
       * دسته از همان دستگاه دقیقاً یک ردیف دارد. */
      { name: "UX_HrmSyncBatch", columns: ["ProjectId", "DeviceId", "Fingerprint"], unique: true },
      { name: "IX_HrmSyncBatch_Device", columns: ["ProjectId", "DeviceId", "ReceivedAt"] },
    ],
  },

  {
    /* کارت نرخ ساعتی (D12، ADR-05).
     *
     * نسخه‌دار است چون نرخ در طول پروژه تغییر می‌کند و هزینهٔ فروردین
     * باید با نرخ فروردین حساب شود، نه با نرخ امروز. بدون نسخه، هر
     * افزایش دستمزد کل تاریخ هزینهٔ پروژه را بازنویسی می‌کرد.
     *
     * `EffectiveTo` تهی یعنی نسخهٔ جاری. بازهٔ بسته لازم نیست چون
     * صدور نسخهٔ تازه، نسخهٔ قبلی را می‌بندد. */
    name: "HrmRateCard",
    module: "d10",
    title: { fa: "کارت نرخ ساعتی رسته", en: "Trade hourly rate card" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("TradeCode", "text", { len: 40 }),
      c("Grade", "text", { len: 20 }),
      /* نرخ پایهٔ ساعت عادی. ضرایب اضافه‌کاری/شب/تعطیل از قانون کار
       * اعمال می‌شوند و اینجا تکرار نمی‌شوند — دو منبع برای یک ضریب
       * یعنی دو عدد متفاوت. */
      req("HourlyRate", "decimal", { precision: 18, scale: 2, default: "0" }),
      req("Currency", "text", { len: 8, default: "'IRR'" }),
      req("EffectiveFrom", "text", { len: 10 }),
      c("EffectiveTo", "text", { len: 10 }),
      c("SourceFa", "text", { len: 200 }),
      req("Status", "text", { len: 16, default: "'active'" }),
    ],
    indexes: [
      { name: "IX_HrmRateCard", columns: ["ProjectId", "TradeCode", "EffectiveFrom"] },
      { name: "UX_HrmRateCard", columns: ["ProjectId", "TradeCode", "Grade", "EffectiveFrom"], unique: true },
    ],
  },
  {
    /* دفتر ارسال هزینهٔ نیرو به مالی (D12).
     *
     * کلید یکتای (ProjectId, CostAccountId, PeriodCode) همان الگوی
     * `EquipmentCostPosting` است و همان کار را می‌کند: اجرای دوبارهٔ
     * ارسال، `Actual` حساب هزینه را متورم نمی‌کند چون سهم قبلی HRM
     * از این دفتر خوانده و کسر می‌شود.
     *
     * سهم قبلی از **دفتر** خوانده می‌شود نه از متن یادداشت — یادداشت
     * برای آدم است، نه مبنای حساب. */
    name: "HrmCostPosting",
    module: "d10",
    title: { fa: "ارسال هزینهٔ نیرو به مالی", en: "Labour cost posting" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("CostAccountId", "text", { len: 60 }),
      req("PeriodCode", "text", { len: 20 }),
      req("Amount", "decimal", { precision: 18, scale: 2, default: "0" }),
      req("EquivalentHours", "decimal", { precision: 14, scale: 2, default: "0" }),
      req("Currency", "text", { len: 8, default: "'IRR'" }),
      /* ساعتی که نرخ نداشت و مبلغ‌گذاری نشد — ساعت گم‌شده بدتر از
       * مبلغ نامعلوم است، پس شمرده و گزارش می‌شود. */
      req("UnpricedHours", "decimal", { precision: 14, scale: 2, default: "0" }),
      c("MemoFa", "text", { len: 400 }),
      req("PostedAt", "datetime"),
      req("PostedBy", "text", { len: 60 }),
      /* کلید ایدمپوتنسی رویداد `hrm.labor.posted` — D13 روی همین
       * می‌نشیند. */
      c("EventKey", "text", { len: 120 }),
    ],
    indexes: [
      { name: "UX_HrmCostPosting", columns: ["ProjectId", "CostAccountId", "PeriodCode"], unique: true },
      { name: "IX_HrmCostPosting_Period", columns: ["ProjectId", "PeriodCode", "PostedAt"] },
    ],
  },

  {
    /* صندوق خروجی رویداد (D13، شکاف H-04).
     *
     * چرا جدول و نه فراخوانی مستقیم: مصرف‌کننده (ERP سازمان) ممکن است
     * پایین باشد. اگر HRM مستقیم صدا می‌زد، یا تراکنش را نگه می‌داشت
     * تا مقصد جواب بدهد، یا رویداد را بی‌صدا از دست می‌داد. الگوی
     * outbox هر دو را حل می‌کند: نوشتن محلی قطعی است، تحویل بعداً و
     * با تلاش دوباره.
     *
     * `EventKey` یکتاست و از داده ساخته می‌شود، نه از زمان. همان
     * رویداد دو بار در صندوق نمی‌نشیند حتی اگر منبع دو بار تولیدش
     * کند — این تنها دفاع در برابر «ارسال دوباره پس از قطعی شبکه». */
    name: "IntegrationEvent",
    module: "core",
    title: { fa: "رویداد یکپارچه‌سازی", en: "Integration event" },
    pk: "Id",
    columns: [
      id(),
      req("EventKey", "text", { len: 160 }),
      req("EventType", "text", { len: 60 }),
      req("SchemaVersion", "text", { len: 10, default: "'1.0'" }),
      req("SourceModule", "text", { len: 10 }),
      c("TargetModule", "text", { len: 10 }),
      req("ProjectId", "text", { len: 60 }),
      c("EntityName", "text", { len: 60 }),
      c("EntityId", "text", { len: 120 }),
      /* بار رویداد کامل ذخیره می‌شود، نه ارجاع.
       *
       * ارجاع یعنی مصرف‌کننده باید برگردد و بخواند — و آن‌وقت رویدادِ
       * دیروز با دادهٔ امروز خوانده می‌شود. رویداد باید عکس لحظهٔ
       * وقوع باشد. */
      c("PayloadJson", "text", { len: 8000 }),
      req("Status", "text", { len: 16, default: "'pending'" }),
      req("OccurredAt", "datetime"),
      c("DeliveredAt", "datetime"),
      req("AttemptCount", "int", { default: "0" }),
      c("LastErrorFa", "text", { len: 400 }),
      c("AckRef", "text", { len: 120 }),
      req("EmittedBy", "text", { len: 60 }),
    ],
    indexes: [
      { name: "UX_IntegrationEvent", columns: ["EventKey"], unique: true },
      { name: "IX_IntegrationEvent_Queue", columns: ["Status", "OccurredAt"] },
      { name: "IX_IntegrationEvent_Project", columns: ["ProjectId", "EventType", "OccurredAt"] },
    ],
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

  /* ── d9 ماشین‌آلات و تجهیزات ── */
  {
    name: "Equipment",
    module: "d9",
    title: { fa: "ماشین‌آلات و تجهیزات", en: "Equipment registry" },
    pk: "Id",
    columns: [id(), req("ProjectId", "text", { len: 60 }), req("Code", "text", { len: 40 }), req("NameFa", "text", { len: 200 }), req("Category", "text", { len: 30 }), req("Ownership", "text", { len: 20 }), c("BrandFa", "text", { len: 120 }), c("Model", "text", { len: 80 }), c("Year", "int"), c("Capacity", "decimal", { precision: 18, scale: 2 }), c("CapacityUom", "text", { len: 20 }), req("Status", "text", { len: 20, default: "'active'" }), c("CommissionedAt", "date"), c("LocationFa", "text", { len: 200 }), c("PurchaseValue", "decimal", { precision: 18, scale: 2 }), c("SalvageValue", "decimal", { precision: 18, scale: 2 })],
    indexes: [
      { name: "UX_Equipment_Code", columns: ["ProjectId", "Code"], unique: true },
      { name: "IX_Equipment_Status", columns: ["ProjectId", "Status", "Category"] },
    ],
  },
  {
    name: "EquipmentMeter",
    module: "d9",
    title: { fa: "ساعت کارکرد", en: "Equipment meter reading" },
    pk: "Id",
    columns: [id(), req("ProjectId", "text", { len: 60 }), req("EquipmentId", "text", { len: 60 }), req("ReadAt", "date"), req("HourMeter", "decimal", { precision: 18, scale: 2, default: "0" }), req("WorkHours", "decimal", { precision: 10, scale: 2, default: "0" }), req("Source", "text", { len: 20, default: "'manual'" }), c("EnteredBy", "text", { len: 60 })],
    indexes: [
      { name: "UX_EquipmentMeter", columns: ["EquipmentId", "ReadAt"], unique: true },
      { name: "IX_EquipmentMeter_Equip", columns: ["EquipmentId"] },
    ],
  },
  {
    name: "EquipmentRental",
    module: "d9",
    title: { fa: "اجاره ماشین‌آلات", en: "Equipment rental" },
    pk: "Id",
    columns: [id(), req("ProjectId", "text", { len: 60 }), req("EquipmentId", "text", { len: 60 }), c("Supplier", "text", { len: 200 }), c("ContractNo", "text", { len: 60 }), req("RateType", "text", { len: 20 }), req("Rate", "decimal", { precision: 18, scale: 2 }), c("Currency", "text", { len: 10, default: "'IRR'" }), req("StartDate", "date"), c("EndDate", "date"), req("Status", "text", { len: 20, default: "'active'" })],
    indexes: [
      { name: "UX_EquipmentRental_Contract", columns: ["ProjectId", "ContractNo"], unique: true },
      { name: "IX_EquipmentRental_Equip", columns: ["EquipmentId", "Status"] },
    ],
  },
  {
    name: "MaintenanceOrder",
    module: "d9",
    title: { fa: "دستورکار تعمیرات", en: "Maintenance work order" },
    pk: "Id",
    columns: [id(), req("ProjectId", "text", { len: 60 }), req("EquipmentId", "text", { len: 60 }), req("Code", "text", { len: 40 }), req("Kind", "text", { len: 30 }), req("Priority", "text", { len: 20 }), req("ReportedAt", "date"), c("DownFrom", "datetime"), c("DownTo", "datetime"), req("Status", "text", { len: 20, default: "'open'" }), c("Cost", "decimal", { precision: 18, scale: 2, default: "0" }), c("DescriptionFa", "text", { len: 1000 }), c("AssignedTo", "text", { len: 60 }), c("RootCause", "text", { len: 30 })],
    indexes: [
      { name: "UX_MaintenanceOrder_Code", columns: ["ProjectId", "Code"], unique: true },
      { name: "IX_MaintenanceOrder_Open", columns: ["ProjectId", "Status", "Priority"] },
    ],
  },

  /* ── d9 توسعهٔ EQP: دیسپچ، سوخت، PM، قطعات، تحلیل ریشه‌ای ── */
  {
    name: "EquipmentDispatch",
    module: "d9",
    title: { fa: "دیسپچ روزانه ماشین‌آلات", en: "Daily equipment dispatch" },
    pk: "Id",
    columns: [id(), req("ProjectId", "text", { len: 60 }), req("EquipmentId", "text", { len: 60 }), req("DispatchDate", "date"), req("Shift", "text", { len: 10, default: "'day'" }), c("OperatorId", "text", { len: 60 }), c("ActivityId", "text", { len: 60 }), c("CostAccountId", "text", { len: 60 }), c("SiteFa", "text", { len: 200 }), req("PlannedHours", "decimal", { precision: 6, scale: 2, default: "8" }), c("PlannedQty", "decimal", { precision: 18, scale: 2 }), c("QtyUom", "text", { len: 20 }), req("SafetyCheck", "bool", { default: "0" }), req("Status", "text", { len: 20, default: "'draft'" }), c("ApprovedBy", "text", { len: 60 }), c("NoteFa", "text", { len: 500 })],
    indexes: [
      { name: "UX_EquipmentDispatch", columns: ["EquipmentId", "DispatchDate", "Shift"], unique: true },
      { name: "IX_EquipmentDispatch_Day", columns: ["ProjectId", "DispatchDate", "Status"] },
    ],
  },
  {
    name: "EquipmentFuelLog",
    module: "d9",
    title: { fa: "مصرف سوخت و مواد مصرفی", en: "Fuel & consumables log" },
    pk: "Id",
    columns: [id(), req("ProjectId", "text", { len: 60 }), req("EquipmentId", "text", { len: 60 }), req("LogDate", "date"), req("Kind", "text", { len: 20, default: "'diesel'" }), req("Quantity", "decimal", { precision: 14, scale: 2 }), c("Uom", "text", { len: 20 }), c("UnitCost", "decimal", { precision: 18, scale: 2 }), c("HourMeter", "decimal", { precision: 18, scale: 2 }), c("IssuedBy", "text", { len: 60 })],
    indexes: [
      { name: "IX_EquipmentFuelLog_Equip", columns: ["EquipmentId", "LogDate"] },
      { name: "IX_EquipmentFuelLog_Kind", columns: ["ProjectId", "Kind", "LogDate"] },
    ],
  },
  {
    name: "PmSchedule",
    module: "d9",
    title: { fa: "برنامه نگهداری پیشگیرانه", en: "Preventive maintenance schedule" },
    pk: "Id",
    columns: [id(), req("ProjectId", "text", { len: 60 }), req("EquipmentId", "text", { len: 60 }), req("Code", "text", { len: 40 }), req("TitleFa", "text", { len: 300 }), req("Basis", "text", { len: 20, default: "'run_hours'" }), req("IntervalValue", "decimal", { precision: 14, scale: 2 }), c("LastDoneAt", "date"), c("LastDoneReading", "decimal", { precision: 18, scale: 2 }), c("ChecklistFa", "text", { len: 2000 }), req("Active", "bool", { default: "1" })],
    indexes: [
      { name: "UX_PmSchedule_Code", columns: ["ProjectId", "Code"], unique: true },
      { name: "IX_PmSchedule_Equip", columns: ["EquipmentId", "Active"] },
    ],
  },
  {
    name: "SparePart",
    module: "d9",
    title: { fa: "قطعات یدکی", en: "Spare parts inventory" },
    pk: "Id",
    columns: [id(), req("ProjectId", "text", { len: 60 }), req("PartNo", "text", { len: 60 }), req("NameFa", "text", { len: 300 }), c("Uom", "text", { len: 20 }), req("OnHand", "decimal", { precision: 14, scale: 2, default: "0" }), req("MinLevel", "decimal", { precision: 14, scale: 2, default: "0" }), c("LeadTimeDays", "int"), c("AvgDailyUsage", "decimal", { precision: 14, scale: 4 }), c("UnitCost", "decimal", { precision: 18, scale: 2 }), req("Critical", "bool", { default: "0" }), c("EquipmentCategory", "text", { len: 30 })],
    indexes: [
      { name: "UX_SparePart_No", columns: ["ProjectId", "PartNo"], unique: true },
      { name: "IX_SparePart_Critical", columns: ["ProjectId", "Critical"] },
    ],
  },
  {
    /* دفتر ثبت سهم EQP در حساب‌های هزینه — پشتوانهٔ ایدمپوتنسی G-02.
     * بدون این جدول، «سهم قبلی همین دوره» جایی برای زندگی نداشت و ثبت دوباره
     * جمع Actual را متورم می‌کرد. */
    name: "EquipmentCostPosting",
    module: "d9",
    title: { fa: "ثبت هزینه ماشین‌آلات", en: "Equipment cost posting" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("CostAccountId", "text", { len: 60 }),
      req("PeriodCode", "text", { len: 20 }),
      req("Amount", "decimal", { precision: 18, scale: 2, default: "0" }),
      c("RentalCost", "decimal", { precision: 18, scale: 2, default: "0" }),
      c("MaintenanceCost", "decimal", { precision: 18, scale: 2, default: "0" }),
      c("FuelCost", "decimal", { precision: 18, scale: 2, default: "0" }),
      c("WorkHours", "decimal", { precision: 12, scale: 2, default: "0" }),
      c("MemoFa", "text", { len: 600 }),
      req("PostedAt", "datetime"),
    ],
    indexes: [{ name: "UX_EquipmentCostPosting", columns: ["CostAccountId", "PeriodCode"], unique: true }],
  },
  {
    name: "PartTransaction",
    module: "d9",
    title: { fa: "تراکنش قطعات یدکی", en: "Spare part transaction" },
    pk: "Id",
    columns: [id(), req("ProjectId", "text", { len: 60 }), req("PartId", "text", { len: 60 }), req("TxnDate", "date"), req("Direction", "text", { len: 10, default: "'issue'" }), req("Quantity", "decimal", { precision: 14, scale: 2 }), c("WorkOrderId", "text", { len: 60 }), c("EquipmentId", "text", { len: 60 }), c("UnitCost", "decimal", { precision: 18, scale: 2 }), c("NoteFa", "text", { len: 500 })],
    indexes: [
      { name: "IX_PartTransaction_Part", columns: ["PartId", "TxnDate"] },
      { name: "IX_PartTransaction_Wo", columns: ["WorkOrderId"] },
    ],
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

  /* ── d12 مهندسی و طراحی (ENG) ──
   * مرز با d1: مالکیت فایل نزد Document می‌ماند (ADR-ENG-01). این جدول‌ها
   * چرخهٔ عمر مهندسی را نگه می‌دارند و با DocumentId به مخزن ارجاع می‌دهند. */
  {
    name: "MdrDeliverable",
    module: "d12",
    title: { fa: "قلم فهرست مدارک مهندسی", en: "MDR deliverable" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("DocNo", "text", { len: 80, comment: "شمارهٔ مدرک؛ با Document.DocNo هم‌ارز است" }),
      req("TitleFa", "text", { len: 400 }),
      c("TitleEn", "text", { len: 400 }),
      req("Discipline", "text", { len: 40, comment: "process|piping|civil|electrical|instrument|mechanical|hvac|safety" }),
      req("DocType", "text", { len: 40, comment: "drawing|specification|calculation|datasheet|pid|model3d|report" }),
      req("PlannedWeight", "decimal", { precision: 9, scale: 4, comment: "وزن نسبی در پیشرفت مهندسی" }),
      c("EstimatedManhours", "decimal", { precision: 12, scale: 2 }),
      c("WbsId", "text", { len: 60, comment: "گره WBS مهندسی در PEX" }),
      c("DocumentId", "text", { len: 60, comment: "ارجاع به مخزن d1؛ ADR-ENG-01" }),
      c("TargetIfaDate", "date"),
      c("TargetIfcDate", "date"),
      req("Status", "text", { len: 30, comment: "planned|in_progress|issued|approved|superseded|cancelled" }),
      c("CriticalityLevel", "text", { len: 20, comment: "low|medium|high" }),
      c("ContractReviewDays", "int", { comment: "مهلت قراردادی بررسی؛ نبودش یعنی پیش‌فرض ۱۴ (ADR-ENG-08)" }),
      c("RemarksFa", "text", { len: 1000 }),
    ],
    indexes: [
      { name: "UX_MdrDeliverable", columns: ["ProjectId", "DocNo"], unique: true },
      { name: "IX_MdrDeliverable_Discipline", columns: ["ProjectId", "Discipline"] },
      { name: "IX_MdrDeliverable_Status", columns: ["ProjectId", "Status"] },
    ],
  },
  {
    name: "EngineeringRevision",
    module: "d12",
    title: { fa: "ریویژن مدرک مهندسی", en: "Engineering revision" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("DeliverableId", "text", { len: 60 }),
      req("RevCode", "text", { len: 10, comment: "A, B, 0, 1, 2 …" }),
      req("Purpose", "text", { len: 20, comment: "IFR|IFA|IFC|IFT|AB — هدف صدور" }),
      req("IssuedAt", "date"),
      c("IssuedBy", "text", { len: 60 }),
      c("TransmittalId", "text", { len: 60, comment: "ترانسمیتال خروجی در d1" }),
      c("ReviewDueAt", "date", { comment: "IssuedAt + ContractReviewDays؛ ADR-ENG-08" }),
      c("ReviewCode", "text", { len: 10, comment: "1|2|3|4 — کد بررسی کارفرما/مشاور" }),
      c("ReviewedBy", "text", { len: 60 }),
      c("ReviewedAt", "date"),
      c("ReviewAgingDays", "int", { comment: "تأخیر بررسی؛ مبنای ادعای RCC" }),
      req("Status", "text", { len: 30, comment: "draft|idc|issued|under_review|coded|superseded" }),
      c("IdcCompletedAt", "date"),
      c("DocumentId", "text", { len: 60, comment: "فایل این ریویژن در d1" }),
      c("RemarksFa", "text", { len: 1000 }),
    ],
    indexes: [
      { name: "UX_EngineeringRevision", columns: ["DeliverableId", "RevCode"], unique: true },
      { name: "IX_EngineeringRevision_Project", columns: ["ProjectId", "Status"] },
      { name: "IX_EngineeringRevision_Due", columns: ["ProjectId", "ReviewDueAt"] },
    ],
    foreignKeys: [{ column: "DeliverableId", refTable: "MdrDeliverable", refColumn: "Id", onDelete: "CASCADE" }],
  },
  {
    name: "CrsComment",
    module: "d12",
    title: { fa: "نظر و پاسخ شیت بررسی", en: "Comment resolution sheet item" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("RevisionId", "text", { len: 60 }),
      req("CommentNo", "int"),
      req("RaisedBy", "text", { len: 60 }),
      req("RaisedAt", "date"),
      c("Discipline", "text", { len: 40 }),
      c("SheetRef", "text", { len: 80, comment: "شمارهٔ شیت یا مختصات روی نقشه" }),
      req("Severity", "text", { len: 20, comment: "critical|major|minor|editorial" }),
      req("CommentText", "text", { len: 2000 }),
      c("ResponseText", "text", { len: 2000, comment: "پاسخ طراح؛ ADR-ENG-07 هم‌رکورد است" }),
      c("RespondedBy", "text", { len: 60 }),
      c("RespondedAt", "date"),
      req("ResponseStatus", "text", { len: 20, comment: "open|agreed|disagreed|noted" }),
      c("VerifiedBy", "text", { len: 60, comment: "صحه‌گذاری ناظر" }),
      c("VerifiedAt", "date"),
      c("ClosedInRevCode", "text", { len: 10, comment: "ریویژنی که نظر در آن اعمال شد" }),
    ],
    indexes: [
      { name: "UX_CrsComment", columns: ["RevisionId", "CommentNo"], unique: true },
      { name: "IX_CrsComment_Status", columns: ["ProjectId", "ResponseStatus"] },
    ],
    foreignKeys: [{ column: "RevisionId", refTable: "EngineeringRevision", refColumn: "Id", onDelete: "CASCADE" }],
  },
  {
    name: "SquadCheck",
    module: "d12",
    title: { fa: "بررسی بین‌دیسیپلینی", en: "Inter-discipline squad check" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("RevisionId", "text", { len: 60 }),
      req("Discipline", "text", { len: 40, comment: "دیسیپلین بازبین" }),
      req("ReviewerId", "text", { len: 60 }),
      req("RequestedAt", "date"),
      c("DueAt", "date"),
      c("CompletedAt", "date"),
      req("Status", "text", { len: 20, comment: "pending|in_review|cleared|objected" }),
      c("FindingsCount", "int"),
      c("RemarksFa", "text", { len: 1000 }),
    ],
    indexes: [
      { name: "UX_SquadCheck", columns: ["RevisionId", "Discipline"], unique: true },
      { name: "IX_SquadCheck_Status", columns: ["ProjectId", "Status"] },
    ],
    foreignKeys: [{ column: "RevisionId", refTable: "EngineeringRevision", refColumn: "Id", onDelete: "CASCADE" }],
  },
  {
    name: "InterfaceClashLog",
    module: "d12",
    title: { fa: "لاگ تداخل مدل سه‌بعدی", en: "3D clash / interface log" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("ClashNo", "text", { len: 40 }),
      req("DetectedAt", "date"),
      req("SourceTool", "text", { len: 40, comment: "navisworks|solibri|manual — ADR-ENG-09 فقط لاگ" }),
      req("DisciplineA", "text", { len: 40 }),
      req("DisciplineB", "text", { len: 40 }),
      c("ElementA", "text", { len: 200 }),
      c("ElementB", "text", { len: 200 }),
      c("Zone", "text", { len: 80 }),
      req("Severity", "text", { len: 20, comment: "critical|major|minor" }),
      req("Status", "text", { len: 20, comment: "open|assigned|resolved|accepted" }),
      c("OwnerDiscipline", "text", { len: 40 }),
      c("ResolvedAt", "date"),
      c("ResolutionFa", "text", { len: 1000 }),
      c("ModelReviewStage", "text", { len: 20, comment: "30|60|90" }),
    ],
    indexes: [
      { name: "UX_InterfaceClashLog", columns: ["ProjectId", "ClashNo"], unique: true },
      { name: "IX_InterfaceClashLog_Status", columns: ["ProjectId", "Status"] },
    ],
  },
  {
    name: "TechnicalQuery",
    module: "d12",
    title: { fa: "استعلام و تغییر فنی کارگاهی", en: "Technical query / field change" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("Code", "text", { len: 40 }),
      req("Kind", "text", { len: 10, comment: "TQ|FCR|DCN — یک جدول، چرخهٔ عمر مشترک" }),
      req("TitleFa", "text", { len: 400 }),
      req("Discipline", "text", { len: 40 }),
      req("RaisedBy", "text", { len: 60 }),
      req("RaisedAt", "date"),
      c("DeliverableId", "text", { len: 60, comment: "مدرک مرتبط در MDR" }),
      c("DueAt", "date"),
      req("Status", "text", { len: 30, comment: "open|with_resident|with_designer|answered|closed|rejected" }),
      c("AnsweredBy", "text", { len: 60 }),
      c("AnsweredAt", "date"),
      c("AnswerText", "text", { len: 2000 }),
      c("CostImpact", "decimal", { precision: 18, scale: 2, comment: "اثر هزینه‌ای؛ محرک CR خودکار" }),
      c("TimeImpactDays", "int", { comment: "اثر زمانی؛ محرک CR خودکار" }),
      c("LinkedCrCode", "text", { len: 40, comment: "کد CR ساخته‌شده در d4؛ ADR-ENG-06" }),
      c("RedlineDocumentId", "text", { len: 60, comment: "نقشهٔ قرمز در d1" }),
      c("AsBuiltStatus", "text", { len: 20, comment: "not_required|pending|drafted|approved" }),
      c("ParentTqId", "text", { len: 60, comment: "DCN معمولاً فرزند یک TQ/FCR است" }),
    ],
    indexes: [
      { name: "UX_TechnicalQuery", columns: ["ProjectId", "Code"], unique: true },
      { name: "IX_TechnicalQuery_Status", columns: ["ProjectId", "Status"] },
      { name: "IX_TechnicalQuery_Kind", columns: ["ProjectId", "Kind"] },
    ],
  },
  {
    name: "VendorPrintReview",
    module: "d12",
    title: { fa: "بررسی مدرک فنی سازنده", en: "Vendor print review" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("VendorDocNo", "text", { len: 80 }),
      req("VendorName", "text", { len: 200 }),
      req("TitleFa", "text", { len: 400 }),
      c("PoNo", "text", { len: 60, comment: "سفارش خرید در d5؛ نگاشت FIN" }),
      c("TagNo", "text", { len: 80, comment: "تگ تجهیز" }),
      req("Discipline", "text", { len: 40 }),
      req("RevCode", "text", { len: 10 }),
      req("ReceivedAt", "date"),
      c("DueAt", "date"),
      c("ReviewCode", "text", { len: 10, comment: "1|2|3|4" }),
      c("ReviewedBy", "text", { len: 60 }),
      c("ReviewedAt", "date"),
      req("Status", "text", { len: 30, comment: "received|under_review|coded|approved_for_mfg|rejected" }),
      c("DocumentId", "text", { len: 60 }),
      c("RemarksFa", "text", { len: 1000 }),
    ],
    indexes: [
      { name: "UX_VendorPrintReview", columns: ["ProjectId", "VendorDocNo", "RevCode"], unique: true },
      { name: "IX_VendorPrintReview_Po", columns: ["ProjectId", "PoNo"] },
      { name: "IX_VendorPrintReview_Status", columns: ["ProjectId", "Status"] },
    ],
  },
  {
    name: "MaterialRequest",
    module: "d12",
    title: { fa: "درخواست کالای مهندسی", en: "Material request" },
    pk: "Id",
    columns: [id(), req("ProjectId", "text", { len: 60 }), req("Code", "text", { len: 40 }), req("TitleFa", "text", { len: 400 }), req("Discipline", "text", { len: 40 }), c("DeliverableId", "text", { len: 60 }), c("DocNo", "text", { len: 80 }), c("ItemCode", "text", { len: 60 }), c("Quantity", "decimal", { precision: 18, scale: 3 }), c("Unit", "text", { len: 20 }), c("LeadTimeDays", "int"), c("NeedByDate", "date"), c("ReleaseByDate", "date"), req("RaisedBy", "text", { len: 60 }), req("RaisedAt", "date"), req("Status", "text", { len: 30, comment: "draft|approved|released|ordered|closed|cancelled" }), c("LinkedPrCode", "text", { len: 40 }), c("RemarksFa", "text", { len: 1000 })],
    indexes: [
      { name: "UX_MaterialRequest", columns: ["ProjectId", "Code"], unique: true },
      { name: "IX_MaterialRequest_Deliverable", columns: ["ProjectId", "DeliverableId"] },
    ],
  },
  {
    name: "EngineeringProgressSnapshot",
    module: "d12",
    title: { fa: "عکس دوره‌ای پیشرفت مهندسی", en: "Engineering progress snapshot" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("PeriodCode", "text", { len: 20 }),
      c("Discipline", "text", { len: 40, comment: "خالی یعنی کل پروژه" }),
      req("PlannedPct", "decimal", { precision: 7, scale: 4 }),
      req("ActualPct", "decimal", { precision: 7, scale: 4 }),
      c("EarnedWeight", "decimal", { precision: 12, scale: 4 }),
      c("SpiEng", "decimal", { precision: 7, scale: 4 }),
      c("DeliverableCount", "int"),
      c("IfcIssuedCount", "int"),
      c("OpenCommentCount", "int"),
      req("SnapshotAt", "datetime"),
    ],
    indexes: [{ name: "UX_EngineeringProgressSnapshot", columns: ["ProjectId", "PeriodCode", "Discipline"], unique: true }],
  },

  /* ── d14 پیمان، صورت‌وضعیت و تعدیل (cnt-v1) ──
   * دو حالت ارزش‌گذاری در یک مدل: هر ردیف PricingBasis دارد و در مرز
   * IPC_LineItem.EarnedCurrent هر دو به ارزش ریالی تبدیل می‌شوند
   * (ADR-CNT-11). از آن نقطه به بعد هیچ جدولی حالت را نمی‌شناسد. */
  {
    name: "ContractMaster",
    module: "d14",
    title: { fa: "شناسنامه پیمان", en: "Contract master" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("Code", "text", { len: 40 }),
      req("TitleFa", "text", { len: 400 }),
      req("ContractType", "text", { len: 30, comment: "unit_price|lump_sum|mixed|cost_plus" }),
      req("Party", "text", { len: 20, comment: "main|subcontract" }),
      req("EmployerName", "text", { len: 200 }),
      c("ConsultantName", "text", { len: 200 }),
      req("ContractorName", "text", { len: 200 }),
      req("SignDate", "date"),
      req("StartDate", "date"),
      req("DurationDays", "int"),
      /* مبلغ اولیه هرگز با الحاقیه تغییر نمی‌کند: سقف ۲۵٪ مادهٔ ۲۹ همیشه
       * بر همین مبنا سنجیده می‌شود، در حالی که مانده بر مبنای جاری است. */
      req("InitialAmount", "decimal", { precision: 18, scale: 2 }),
      req("CurrentAmount", "decimal", { precision: 18, scale: 2 }),
      req("Currency", "text", { len: 10, default: "'IRR'" }),
      req("CeilingPct", "decimal", { precision: 9, scale: 4, default: "25" }),
      c("AdvancePct", "decimal", { precision: 9, scale: 4 }),
      c("AdvanceRecoveryPct", "decimal", { precision: 9, scale: 4 }),
      req("RetainagePct", "decimal", { precision: 9, scale: 4, default: "10" }),
      c("InsuranceRatePct", "decimal", { precision: 9, scale: 4 }),
      c("WithholdingTaxPct", "decimal", { precision: 9, scale: 4 }),
      c("VatPct", "decimal", { precision: 9, scale: 4 }),
      req("AdjustmentEnabled", "bool", { default: "0" }),
      c("BaseIndexPeriod", "text", { len: 20 }),
      c("ReviewDaysConsultant", "int"),
      c("ReviewDaysEmployer", "int"),
      req("Status", "text", { len: 30, comment: "draft|active|suspended|completed|terminated" }),
      /* پیوند نرم به حساب هزینهٔ مالی (همان الگوی MrCode/PrCode): پیمان
       * به d5 سخت گره نمی‌خورد ولی بدون این ستون، ارسال صورت‌وضعیت به
       * مالی نمی‌داند پول را کجا بنشاند. */
      c("CostAccountCode", "text", { len: 40 }),
    ],
    indexes: [
      { name: "UX_ContractMaster", columns: ["ProjectId", "Code"], unique: true },
      { name: "IX_ContractMaster_Status", columns: ["ProjectId", "Status"] },
    ],
  },
  {
    name: "ContractAmendment",
    module: "d14",
    title: { fa: "الحاقیه پیمان", en: "Contract amendment" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("ContractId", "text", { len: 60 }),
      req("Code", "text", { len: 40 }),
      req("TitleFa", "text", { len: 400 }),
      req("AmendmentType", "text", { len: 20, comment: "amount|duration|scope|rate" }),
      req("EffectiveDate", "date"),
      c("AmountDelta", "decimal", { precision: 18, scale: 2 }),
      c("DurationDeltaDays", "int"),
      c("LinkedCrCode", "text", { len: 40 }),
      req("Status", "text", { len: 30, comment: "draft|approved|rejected|cancelled" }),
    ],
    indexes: [
      { name: "UX_ContractAmendment", columns: ["ProjectId", "Code"], unique: true },
      { name: "IX_ContractAmendment_Contract", columns: ["ContractId", "EffectiveDate"] },
    ],
  },
  {
    name: "ApprovalAuthority",
    module: "d14",
    title: { fa: "سطح اختیار تأیید", en: "Approval authority" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("ContractId", "text", { len: 60 }),
      req("Level", "int", { comment: "1=مشاور 2=کارفرما" }),
      req("RoleCode", "text", { len: 40 }),
      c("MaxAmount", "decimal", { precision: 18, scale: 2 }),
      req("Status", "text", { len: 20, comment: "active|revoked" }),
    ],
    indexes: [{ name: "UX_ApprovalAuthority", columns: ["ContractId", "Level", "RoleCode"], unique: true }],
  },
  {
    name: "ContractBOQ_Item",
    module: "d14",
    title: { fa: "ردیف فهرست بها", en: "Contract BOQ item" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("ContractId", "text", { len: 60 }),
      req("ItemNo", "text", { len: 40 }),
      c("ParentItemNo", "text", { len: 40 }),
      c("ChapterCode", "text", { len: 20 }),
      req("TitleFa", "text", { len: 600 }),
      /* انشعاب دوحالته؛ اعتبارسنجی ترکیب ستون‌ها در موتور است نه در
       * پایگاه داده، تا پیام خطای فارسی با شمارهٔ ردیف تولید شود. */
      req("PricingBasis", "text", { len: 20, comment: "unit_price|lump_sum" }),
      c("Unit", "text", { len: 20 }),
      c("ContractQty", "decimal", { precision: 18, scale: 3 }),
      c("UnitRate", "decimal", { precision: 18, scale: 2 }),
      c("LumpSumAmount", "decimal", { precision: 18, scale: 2 }),
      req("LineAmount", "decimal", { precision: 18, scale: 2 }),
      c("WbsId", "text", { len: 60 }),
      c("CostAccountCode", "text", { len: 40 }),
      req("IsStarred", "bool", { default: "0" }),
      req("RateStatus", "text", { len: 20, comment: "agreed|rate_pending|disputed" }),
      req("Status", "text", { len: 30, comment: "active|superseded|cancelled" }),
    ],
    indexes: [
      { name: "UX_ContractBOQ_Item", columns: ["ContractId", "ItemNo"], unique: true },
      { name: "IX_BOQ_Chapter", columns: ["ContractId", "ChapterCode"] },
      { name: "IX_BOQ_Wbs", columns: ["ProjectId", "WbsId"] },
    ],
  },
  {
    name: "LumpSumMilestone",
    module: "d14",
    title: { fa: "مرحله پیمان مقطوع", en: "Lump sum milestone" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("ContractId", "text", { len: 60 }),
      req("BoqItemId", "text", { len: 60 }),
      req("MilestoneNo", "int"),
      req("TitleFa", "text", { len: 400 }),
      req("WeightPct", "decimal", { precision: 9, scale: 4 }),
      c("PlannedDate", "date"),
      /* بدون معیار تحقق، درصد پیشرفت مقطوع سلیقه‌ای می‌شود. */
      c("AcceptanceCriteriaFa", "text", { len: 1000 }),
      c("AchievedDate", "date"),
      c("AchievedPct", "decimal", { precision: 9, scale: 4 }),
      c("EvidenceDocNo", "text", { len: 80 }),
      c("VerifiedBy", "text", { len: 60 }),
      req("Status", "text", { len: 20, comment: "pending|claimed|verified|rejected" }),
    ],
    indexes: [
      { name: "UX_LumpSumMilestone", columns: ["BoqItemId", "MilestoneNo"], unique: true },
      { name: "IX_LumpSumMilestone_Contract", columns: ["ContractId", "Status"] },
    ],
  },
  {
    name: "BOQ_QuantityChange",
    module: "d14",
    title: { fa: "تغییر مقادیر", en: "BOQ quantity change" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("ContractId", "text", { len: 60 }),
      req("BoqItemId", "text", { len: 60 }),
      req("ChangeNo", "int"),
      c("PreviousQty", "decimal", { precision: 18, scale: 3 }),
      c("NewQty", "decimal", { precision: 18, scale: 3 }),
      c("DeltaAmount", "decimal", { precision: 18, scale: 2 }),
      c("ReasonFa", "text", { len: 1000 }),
      c("LinkedCrCode", "text", { len: 40 }),
      req("RequestedAt", "date"),
      req("Status", "text", { len: 20, comment: "draft|approved|rejected" }),
    ],
    indexes: [{ name: "UX_BOQ_QuantityChange", columns: ["BoqItemId", "ChangeNo"], unique: true }],
  },
  {
    name: "ExtraWorkItem",
    module: "d14",
    title: { fa: "کار جدید", en: "Extra work item" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("ContractId", "text", { len: 60 }),
      req("Code", "text", { len: 40 }),
      req("TitleFa", "text", { len: 600 }),
      c("Unit", "text", { len: 20 }),
      c("Quantity", "decimal", { precision: 18, scale: 3 }),
      c("ProposedRate", "decimal", { precision: 18, scale: 2 }),
      c("AgreedRate", "decimal", { precision: 18, scale: 2 }),
      c("AnalysisMethod", "text", { len: 30, comment: "similar_item|rate_analysis|daywork" }),
      c("LinkedCrCode", "text", { len: 40 }),
      c("BoqItemId", "text", { len: 60 }),
      req("Status", "text", { len: 20, comment: "proposed|rate_pending|agreed|rejected" }),
    ],
    indexes: [{ name: "UX_ExtraWorkItem", columns: ["ContractId", "Code"], unique: true }],
  },
  {
    name: "MeasurementSheet",
    module: "d14",
    title: { fa: "برگه ریزمتره", en: "Measurement sheet" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("ContractId", "text", { len: 60 }),
      c("IpcId", "text", { len: 60 }),
      req("BoqItemId", "text", { len: 60 }),
      req("SheetNo", "int"),
      c("LocationFa", "text", { len: 400 }),
      c("DrawingNo", "text", { len: 80 }),
      c("Count", "decimal", { precision: 18, scale: 3 }),
      c("Length", "decimal", { precision: 18, scale: 3 }),
      c("Width", "decimal", { precision: 18, scale: 3 }),
      c("Height", "decimal", { precision: 18, scale: 3 }),
      c("Factor", "decimal", { precision: 18, scale: 4 }),
      req("Quantity", "decimal", { precision: 18, scale: 3 }),
      c("SourceDprId", "text", { len: 60 }),
      c("InspectionRecordCode", "text", { len: 40 }),
      req("Status", "text", { len: 20, comment: "draft|claimed|verified|rejected" }),
    ],
    indexes: [
      { name: "UX_MeasurementSheet", columns: ["BoqItemId", "SheetNo"], unique: true },
      { name: "IX_MeasurementSheet_Ipc", columns: ["ContractId", "IpcId"] },
    ],
  },
  {
    name: "InterimPaymentCertificate",
    module: "d14",
    title: { fa: "صورت‌وضعیت موقت", en: "Interim payment certificate" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("ContractId", "text", { len: 60 }),
      req("SerialNo", "int"),
      req("IpcType", "text", { len: 20, comment: "interim|final|advance|adjustment_only" }),
      req("PeriodCode", "text", { len: 20 }),
      req("PeriodFrom", "date"),
      req("PeriodTo", "date"),
      req("GrossCurrent", "decimal", { precision: 18, scale: 2, default: "0" }),
      req("GrossCumulative", "decimal", { precision: 18, scale: 2, default: "0" }),
      c("AdjustmentAmount", "decimal", { precision: 18, scale: 2 }),
      c("MaterialDiffAmount", "decimal", { precision: 18, scale: 2 }),
      req("SubtotalAmount", "decimal", { precision: 18, scale: 2, default: "0" }),
      req("TotalDeductions", "decimal", { precision: 18, scale: 2, default: "0" }),
      /* ارزش افزوده افزوده می‌شود نه کسر (ADR-CNT-05). */
      c("VatAmount", "decimal", { precision: 18, scale: 2 }),
      req("NetPayable", "decimal", { precision: 18, scale: 2, default: "0" }),
      req("WorkflowState", "text", { len: 30, comment: "draft|contractor_submitted|consultant_review|consultant_approved|employer_review|approved|rejected|paid" }),
      c("SubmittedAt", "date"),
      c("ConsultantApprovedAt", "date"),
      c("EmployerApprovedAt", "date"),
      c("PaidAt", "date"),
      req("PostedToFin", "bool", { default: "0" }),
      c("LegacyRef", "text", { len: 60 }),
      req("Status", "text", { len: 20, comment: "open|closed|cancelled" }),
    ],
    indexes: [
      { name: "UX_InterimPaymentCertificate", columns: ["ContractId", "SerialNo"], unique: true },
      { name: "IX_IPC_Period", columns: ["ProjectId", "PeriodCode"] },
      { name: "IX_IPC_Workflow", columns: ["ProjectId", "WorkflowState"] },
    ],
  },
  {
    name: "IPC_LineItem",
    module: "d14",
    title: { fa: "ردیف صورت‌وضعیت", en: "IPC line item" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("IpcId", "text", { len: 60 }),
      req("BoqItemId", "text", { len: 60 }),
      req("PricingBasis", "text", { len: 20, comment: "unit_price|lump_sum" }),
      c("PrevQty", "decimal", { precision: 18, scale: 3 }),
      c("CumQty", "decimal", { precision: 18, scale: 3 }),
      /* جاری همیشه مشتق است: تجمعی منهای تجمعی قبل (ADR-CNT-03). */
      c("CurrentQty", "decimal", { precision: 18, scale: 3 }),
      c("PrevPct", "decimal", { precision: 9, scale: 4 }),
      c("CumPct", "decimal", { precision: 9, scale: 4 }),
      c("MilestoneId", "text", { len: 60 }),
      c("UnitRate", "decimal", { precision: 18, scale: 2 }),
      req("EarnedCurrent", "decimal", { precision: 18, scale: 2, default: "0" }),
      req("EarnedCumulative", "decimal", { precision: 18, scale: 2, default: "0" }),
      c("ClaimedQty", "decimal", { precision: 18, scale: 3 }),
      c("VerifiedQty", "decimal", { precision: 18, scale: 3 }),
      c("ApprovedQty", "decimal", { precision: 18, scale: 3 }),
      req("QualityGateStatus", "text", { len: 20, comment: "passed|no_ir|open_ncr|overridden" }),
      c("OverrideBy", "text", { len: 60 }),
      c("OverrideReasonFa", "text", { len: 600 }),
      req("Status", "text", { len: 20, comment: "draft|claimed|verified|approved|rejected" }),
    ],
    indexes: [
      { name: "UX_IPC_LineItem", columns: ["IpcId", "BoqItemId"], unique: true },
      { name: "IX_IPC_LineItem_Boq", columns: ["ProjectId", "BoqItemId"] },
    ],
  },
  {
    name: "IPC_WorkflowStep",
    module: "d14",
    title: { fa: "گام گردش صورت‌وضعیت", en: "IPC workflow step" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("IpcId", "text", { len: 60 }),
      req("StepNo", "int"),
      req("Actor", "text", { len: 20, comment: "contractor|consultant|employer" }),
      c("ActorUserId", "text", { len: 60 }),
      req("Action", "text", { len: 30, comment: "submit|approve|reject|return_for_correction" }),
      req("ActedAt", "datetime"),
      c("DueAt", "date"),
      c("OverdueDays", "int"),
      c("CommentFa", "text", { len: 1000 }),
    ],
    indexes: [{ name: "UX_IPC_WorkflowStep", columns: ["IpcId", "StepNo"], unique: true }],
  },
  {
    name: "IPC_Deduction",
    module: "d14",
    title: { fa: "کسور صورت‌وضعیت", en: "IPC deduction" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("IpcId", "text", { len: 60 }),
      req("DeductionType", "text", { len: 30, comment: "insurance|withholding_tax|retainage|advance_recovery|penalty|back_to_back|other" }),
      c("BaseAmount", "decimal", { precision: 18, scale: 2 }),
      c("RatePct", "decimal", { precision: 9, scale: 4 }),
      req("Amount", "decimal", { precision: 18, scale: 2 }),
      req("IsStatutory", "bool", { default: "0" }),
      c("NoteFa", "text", { len: 600 }),
    ],
    indexes: [{ name: "UX_IPC_Deduction", columns: ["IpcId", "DeductionType"], unique: true }],
  },
  {
    name: "AdjustmentIndexCatalog",
    module: "d14",
    title: { fa: "کاتالوگ شاخص تعدیل", en: "Adjustment index catalog" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("IndexPeriod", "text", { len: 20 }),
      req("ChapterCode", "text", { len: 20 }),
      req("IndexValue", "decimal", { precision: 18, scale: 4 }),
      c("SourceFa", "text", { len: 200 }),
      c("PublishedAt", "date"),
      req("Status", "text", { len: 20, comment: "draft|published|superseded" }),
    ],
    indexes: [{ name: "UX_AdjustmentIndexCatalog", columns: ["ProjectId", "IndexPeriod", "ChapterCode"], unique: true }],
  },
  {
    name: "PriceAdjustmentCalculation",
    module: "d14",
    title: { fa: "محاسبه تعدیل", en: "Price adjustment calculation" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("ContractId", "text", { len: 60 }),
      req("IpcId", "text", { len: 60 }),
      req("ChapterCode", "text", { len: 20 }),
      /* کارکرد همین دوره، نه تجمعی: تعدیل تجمعی جمع تعدیل دوره‌هاست
       * نه تعدیل جمع (ADR-CNT-04). */
      req("WorkAmount", "decimal", { precision: 18, scale: 2 }),
      req("BaseIndex", "decimal", { precision: 18, scale: 4 }),
      req("PeriodIndex", "decimal", { precision: 18, scale: 4 }),
      req("AdjustmentFactor", "decimal", { precision: 18, scale: 6 }),
      req("AdjustmentAmount", "decimal", { precision: 18, scale: 2 }),
      c("AppliedRatePct", "decimal", { precision: 9, scale: 4 }),
      c("CalcNoteFa", "text", { len: 600 }),
      req("Status", "text", { len: 20, comment: "draft|approved|rejected" }),
    ],
    indexes: [{ name: "UX_PriceAdjustmentCalculation", columns: ["IpcId", "ChapterCode"], unique: true }],
  },
  {
    name: "MaterialDiffCalc",
    module: "d14",
    title: { fa: "مابه‌التفاوت مصالح", en: "Material differential" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("ContractId", "text", { len: 60 }),
      req("IpcId", "text", { len: 60 }),
      req("MaterialCode", "text", { len: 30, comment: "rebar|cement|bitumen|fx|other" }),
      req("MaterialNameFa", "text", { len: 200 }),
      c("Quantity", "decimal", { precision: 18, scale: 3 }),
      c("Unit", "text", { len: 20 }),
      c("BaseRate", "decimal", { precision: 18, scale: 2 }),
      c("PeriodRate", "decimal", { precision: 18, scale: 2 }),
      req("DiffAmount", "decimal", { precision: 18, scale: 2 }),
      c("EvidenceDocNo", "text", { len: 80 }),
      req("Status", "text", { len: 20, comment: "draft|approved|rejected" }),
    ],
    indexes: [{ name: "UX_MaterialDiffCalc", columns: ["IpcId", "MaterialCode"], unique: true }],
  },
  {
    name: "ContractGuarantee",
    module: "d14",
    title: { fa: "ضمانت‌نامه", en: "Contract guarantee" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("ContractId", "text", { len: 60 }),
      req("Code", "text", { len: 40 }),
      req("GuaranteeType", "text", { len: 20, comment: "advance|performance|bid|retention|warranty" }),
      req("BankName", "text", { len: 200 }),
      req("GuaranteeNo", "text", { len: 60 }),
      req("Amount", "decimal", { precision: 18, scale: 2 }),
      c("Currency", "text", { len: 10, default: "'IRR'" }),
      req("IssueDate", "date"),
      req("ExpiryDate", "date"),
      c("ExtendedToDate", "date"),
      c("ReleaseDate", "date"),
      req("Status", "text", { len: 20, comment: "active|extended|released|forfeited|expired" }),
      c("AlertLevel", "text", { len: 20, comment: "none|d30|d10|d3|overdue" }),
    ],
    indexes: [
      { name: "UX_ContractGuarantee", columns: ["ProjectId", "Code"], unique: true },
      { name: "IX_Guarantee_Expiry", columns: ["ProjectId", "ExpiryDate", "Status"] },
    ],
  },
  {
    name: "AdvancePaymentSchedule",
    module: "d14",
    title: { fa: "برنامه پیش‌پرداخت", en: "Advance payment schedule" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("ContractId", "text", { len: 60 }),
      req("InstallmentNo", "int"),
      c("PaidAmount", "decimal", { precision: 18, scale: 2 }),
      c("PaidAt", "date"),
      c("RecoveryPct", "decimal", { precision: 9, scale: 4 }),
      c("RecoveredToDate", "decimal", { precision: 18, scale: 2, default: "0" }),
      /* سقف استهلاک: بدون آن، صورت‌وضعیت آخر بیش از دریافتی مستهلک می‌کند. */
      req("OutstandingAmount", "decimal", { precision: 18, scale: 2, default: "0" }),
      req("Status", "text", { len: 20, comment: "pending|paid|recovering|settled" }),
    ],
    indexes: [{ name: "UX_AdvancePaymentSchedule", columns: ["ContractId", "InstallmentNo"], unique: true }],
  },
  {
    name: "RetainageLedger",
    module: "d14",
    title: { fa: "دفتر سپرده حسن انجام کار", en: "Retainage ledger" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("ContractId", "text", { len: 60 }),
      c("IpcId", "text", { len: 60 }),
      req("EntryType", "text", { len: 20, comment: "accrual|release_pac|release_fac|forfeit|adjustment" }),
      req("Amount", "decimal", { precision: 18, scale: 2 }),
      req("BalanceAfter", "decimal", { precision: 18, scale: 2 }),
      /* قلاب رویدادی برای PAC/FAC که هنوز ساخته نشده (ADR-CNT-09). */
      c("TriggerEvent", "text", { len: 60 }),
      c("TriggerDocNo", "text", { len: 80 }),
      req("EntryDate", "date"),
      req("Status", "text", { len: 20, comment: "posted|reversed" }),
    ],
    indexes: [{ name: "IX_RetainageLedger_Contract", columns: ["ContractId", "EntryDate"] }],
  },
  {
    name: "SubcontractorIPC",
    module: "d14",
    title: { fa: "صورت‌وضعیت پیمانکار جزء", en: "Subcontractor IPC" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("ContractId", "text", { len: 60 }),
      c("MainContractId", "text", { len: 60 }),
      c("MainIpcId", "text", { len: 60 }),
      req("SerialNo", "int"),
      req("PeriodCode", "text", { len: 20 }),
      req("GrossCurrent", "decimal", { precision: 18, scale: 2, default: "0" }),
      c("TotalDeductions", "decimal", { precision: 18, scale: 2 }),
      req("NetPayable", "decimal", { precision: 18, scale: 2, default: "0" }),
      req("WorkflowState", "text", { len: 30, comment: "draft|submitted|reviewed|approved|rejected|paid" }),
      req("Status", "text", { len: 20, comment: "open|closed|cancelled" }),
    ],
    indexes: [{ name: "UX_SubcontractorIPC", columns: ["ContractId", "SerialNo"], unique: true }],
  },
  {
    name: "SubcontractorIPC_LineItem",
    module: "d14",
    title: { fa: "ردیف صورت‌وضعیت جزء", en: "Subcontractor IPC line" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("SubIpcId", "text", { len: 60 }),
      c("BoqItemId", "text", { len: 60 }),
      req("DescriptionFa", "text", { len: 600 }),
      c("Unit", "text", { len: 20 }),
      c("Quantity", "decimal", { precision: 18, scale: 3 }),
      c("UnitRate", "decimal", { precision: 18, scale: 2 }),
      req("Amount", "decimal", { precision: 18, scale: 2, default: "0" }),
      c("MainApprovedQty", "decimal", { precision: 18, scale: 3 }),
      c("VarianceFlag", "text", { len: 20, comment: "ok|exceeds_main|no_main_ref" }),
      req("Status", "text", { len: 20, comment: "draft|approved|rejected" }),
    ],
    indexes: [{ name: "IX_SubIpcLine_Sub", columns: ["SubIpcId", "BoqItemId"] }],
  },
  {
    name: "BackToBackDeduction",
    module: "d14",
    title: { fa: "کسور متقابل", en: "Back-to-back deduction" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("SubIpcId", "text", { len: 60 }),
      req("SourceModule", "text", { len: 30, comment: "fin_material|hse_incident|qlt_rework|other" }),
      c("SourceRefCode", "text", { len: 60 }),
      req("DescriptionFa", "text", { len: 600 }),
      req("Amount", "decimal", { precision: 18, scale: 2 }),
      c("EvidenceDocNo", "text", { len: 80 }),
      req("Status", "text", { len: 20, comment: "draft|approved|disputed|waived" }),
    ],
    indexes: [{ name: "IX_BackToBack_Sub", columns: ["SubIpcId", "SourceModule"] }],
  },
  {
    name: "ContractMetricsSnapshot",
    module: "d14",
    title: { fa: "عکس شاخص پیمان", en: "Contract metrics snapshot" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("ContractId", "text", { len: 60 }),
      req("PeriodCode", "text", { len: 20 }),
      c("PhysicalPct", "decimal", { precision: 9, scale: 4 }),
      c("FinancialPct", "decimal", { precision: 9, scale: 4 }),
      c("VariancePct", "decimal", { precision: 9, scale: 4 }),
      c("CeilingUsedPct", "decimal", { precision: 9, scale: 4 }),
      c("AdvanceRecoveredPct", "decimal", { precision: 9, scale: 4 }),
      c("ExtraWorkRatioPct", "decimal", { precision: 9, scale: 4 }),
      c("AvgIpcCycleDays", "decimal", { precision: 9, scale: 2 }),
      c("OpenGuaranteeCount", "int"),
      c("RetainageBalance", "decimal", { precision: 18, scale: 2 }),
      req("SnapshotAt", "datetime"),
    ],
    indexes: [{ name: "UX_ContractMetricsSnapshot", columns: ["ContractId", "PeriodCode"], unique: true }],
  },
  {
    name: "ContractAlertRule",
    module: "d14",
    title: { fa: "قاعده هشدار پیمان", en: "Contract alert rule" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("RuleCode", "text", { len: 30 }),
      req("TitleFa", "text", { len: 400 }),
      req("Severity", "text", { len: 20, comment: "info|medium|high|critical" }),
      c("ThresholdValue", "decimal", { precision: 18, scale: 4 }),
      req("IsEnabled", "bool", { default: "1" }),
      req("Status", "text", { len: 20, comment: "active|disabled" }),
    ],
    indexes: [{ name: "UX_ContractAlertRule", columns: ["ProjectId", "RuleCode"], unique: true }],
  },
  {
    /* دفتر ثبت CNT→FIN — پشتوانهٔ ایدمپوتنسی G-03.
     *
     * بدون این جدول «آیا این صورت‌وضعیت قبلاً به مالی رفته؟» فقط با
     * پرچم بولی `PostedToFin` پاسخ داده می‌شد، که سه چیز را نمی‌گوید:
     * چه مبلغی رفت، به کدام حساب، و اگر صورت‌وضعیت پس از ارسال اصلاح
     * شد چقدر باید تفاوت را جبران کرد. پرچم بولی برای پول کافی نیست.
     *
     * کلید یکتا `(IpcId)` است نه `(ContractId, SerialNo)`: شمارهٔ سریال
     * می‌تواند در اصلاحیه تکرار شود ولی شناسهٔ صورت‌وضعیت هرگز. */
    name: "ContractFinPosting",
    module: "d14",
    title: { fa: "ثبت صورت‌وضعیت در مالی", en: "Contract FIN posting" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("ContractId", "text", { len: 60 }),
      req("IpcId", "text", { len: 60 }),
      req("SerialNo", "int"),
      req("PeriodCode", "text", { len: 20 }),
      req("CostAccountId", "text", { len: 60 }),
      /* مبلغ ناخالص مبنای تعهد است و خالص پرداختنی مبنای Actual:
       * کسور هنوز پول پروژه است ولی دیگر تعهد پیمانکار نیست. */
      req("GrossAmount", "decimal", { precision: 18, scale: 2, default: "0" }),
      req("NetAmount", "decimal", { precision: 18, scale: 2, default: "0" }),
      req("DeductionAmount", "decimal", { precision: 18, scale: 2, default: "0" }),
      c("VatAmount", "decimal", { precision: 18, scale: 2, default: "0" }),
      /* مقدار Actual پیش و پس از ثبت، برای رد ممیزی و امکان برگشت. */
      req("PreviousActual", "decimal", { precision: 18, scale: 2, default: "0" }),
      req("NextActual", "decimal", { precision: 18, scale: 2, default: "0" }),
      c("MemoFa", "text", { len: 600 }),
      req("PostedBy", "text", { len: 60 }),
      req("PostedAt", "datetime"),
      c("ReversedBy", "text", { len: 60 }),
      c("ReversedAt", "datetime"),
      c("ReversalReasonFa", "text", { len: 600 }),
      req("Status", "text", { len: 20, comment: "posted|reversed" }),
    ],
    indexes: [
      { name: "UX_ContractFinPosting_Ipc", columns: ["IpcId"], unique: true },
      { name: "IX_ContractFinPosting_Account", columns: ["CostAccountId", "PeriodCode"] },
    ],
  },

  /* ════════════ d15 — راه‌اندازی و تحویل نهایی (PAC/FAC) ════════════
   *
   * ماژول مستقل است نه جدولی داخل d14، چون تحویل موقت و قطعی رویداد
   * پروژه‌اند نه رویداد پیمان: یک پروژه می‌تواند چند پیمان داشته باشد که
   * همگی به یک PAC ختم شوند. ساختنش داخل CNT یعنی دو منبع حقیقت وقتی
   * ماژول راه‌اندازی کامل ساخته شود (ADR-CNT-09). */
  {
    name: "CompletionCertificate",
    module: "d15",
    title: { fa: "گواهی تحویل", en: "Completion certificate" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      c("ContractId", "text", { len: 60, comment: "خالی یعنی گواهی در سطح پروژه است نه یک پیمان" }),
      req("CertificateType", "text", { len: 10, comment: "mc|rfsu|pac|fac" }),
      req("CertificateNo", "text", { len: 80 }),
      req("TitleFa", "text", { len: 400 }),
      /* تاریخ تحویل واقعی مبنای شروع دورهٔ تضمین است، نه تاریخ صدور برگه. */
      req("HandoverDate", "date"),
      c("IssueDate", "date"),
      c("WarrantyMonths", "int", { comment: "دورهٔ تضمین پس از تحویل موقت" }),
      c("WarrantyEndDate", "date"),
      c("PredecessorId", "text", { len: 60, comment: "FAC به PAC خود ارجاع می‌دهد" }),
      c("OpenPunchCount", "int"),
      c("SystemId", "text", { len: 60, comment: "خالی یعنی گواهی سطح پیمان است نه یک سیستم" }),
      /* مبنای محاسبهٔ تأخیر کارفرما در امضا؛ فاصلهٔ IssueDate از این تاریخ
         ورودی ادعای تمدید مدت در ماژول ادعا می‌شود. */
      c("ReadyForGateAt", "date", { comment: "تاریخ آمادگی برای دروازه" }),
      c("CommitteeFa", "text", { len: 600 }),
      c("NoteFa", "text", { len: 1000 }),
      req("Status", "text", { len: 20, comment: "draft|issued|revoked" }),
    ],
    indexes: [
      { name: "UX_CompletionCertificate", columns: ["ProjectId", "CertificateNo"], unique: true },
      { name: "IX_CompletionCertificate_Type", columns: ["ProjectId", "CertificateType", "Status"] },
      { name: "IX_CompletionCertificate_Contract", columns: ["ContractId", "CertificateType"] },
    ],
  },
  {
    name: "PunchListItem",
    module: "d15",
    title: { fa: "نقص فهرست تحویل", en: "Punch list item" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      c("CertificateId", "text", { len: 60 }),
      c("ContractId", "text", { len: 60 }),
      req("ItemNo", "text", { len: 40 }),
      req("TitleFa", "text", { len: 600 }),
      req("Category", "text", { len: 20, comment: "a|b|c — الف مانع تحویل است" }),
      c("SystemId", "text", { len: 60, comment: "خالی یعنی نقص در دامنهٔ همهٔ سیستم‌هاست" }),
      c("DisciplineCode", "text", { len: 20 }),
      c("LocationFa", "text", { len: 200 }),
      c("RaisedBy", "text", { len: 60 }),
      req("RaisedAt", "date"),
      c("DueDate", "date"),
      c("ClosedAt", "date"),
      c("ClosedBy", "text", { len: 60 }),
      c("EvidenceDocNo", "text", { len: 80 }),
      req("Status", "text", { len: 20, comment: "open|in_progress|closed|waived" }),
    ],
    indexes: [
      { name: "UX_PunchListItem", columns: ["ProjectId", "ItemNo"], unique: true },
      { name: "IX_PunchListItem_Cert", columns: ["CertificateId", "Status"] },
      { name: "IX_PunchListItem_Category", columns: ["ProjectId", "Category", "Status"] },
      { name: "IX_PunchListItem_Gate", columns: ["ProjectId", "SystemId", "Category", "Status"] },
    ],
  },

  /* ══════════════ MOD-13 · تفکیک سیستمی (D3) ══════════════ */
  {
    name: "SystemSubsystem",
    module: "d15",
    title: { fa: "سیستم و زیرسیستم", en: "System / subsystem" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      /* درخت تک‌والدی؛ خالی یعنی گرهٔ ریشه. حلقه در موتور بررسی می‌شود چون
         SQL Server 2008 چک بازگشتی در CHECK ندارد. */
      c("ParentId", "text", { len: 60, comment: "خودارجاع؛ خالی = ریشه" }),
      req("SystemCode", "text", { len: 40 }),
      req("TitleFa", "text", { len: 400 }),
      c("TitleEn", "text", { len: 400 }),
      req("SystemType", "text", { len: 20, comment: "system|subsystem|package" }),
      c("DisciplineCode", "text", { len: 20 }),
      c("CommissioningPriority", "int", { comment: "۱ = بالاترین اولویت راه‌اندازی" }),
      c("CriticalityFa", "text", { len: 10, comment: "high|medium|low" }),
      c("OwnerUserId", "text", { len: 60 }),
      c("SortOrder", "int"),
      req("Status", "text", { len: 20, comment: "planned|precomm|comm|handed_over|closed" }),
    ],
    indexes: [
      { name: "UX_SystemSubsystem_Code", columns: ["ProjectId", "SystemCode"], unique: true },
      { name: "IX_SystemSubsystem_Parent", columns: ["ParentId"] },
      { name: "IX_SystemSubsystem_Status", columns: ["ProjectId", "Status"] },
    ],
  },
  {
    name: "SystemBoundaryMapping",
    module: "d15",
    title: { fa: "مرزبندی سیستم", en: "System boundary mapping" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("SystemId", "text", { len: 60 }),
      /* عمداً FK سخت ندارد: یک ردیف می‌تواند به WbsNode، Activity یا برچسب
         P&ID اشاره کند و FK چندگانه در SQL Server ممکن نیست. */
      req("TargetKind", "text", { len: 20, comment: "wbs|activity|pid|equipment|tag" }),
      req("TargetRef", "text", { len: 120 }),
      c("BoundaryNoteFa", "text", { len: 600, comment: "مثلاً از شیر V-101 تا فلنج پمپ" }),
      req("IsPrimary", "bool", { default: "0", comment: "نگاشت اصلی مبنای محاسبهٔ پیشرفت" }),
    ],
    indexes: [
      { name: "UX_SystemBoundary", columns: ["SystemId", "TargetKind", "TargetRef"], unique: true },
      { name: "IX_SystemBoundary_Target", columns: ["ProjectId", "TargetKind", "TargetRef"] },
    ],
  },
  {
    name: "SystemMilestoneTarget",
    module: "d15",
    title: { fa: "تاریخ هدف دروازه", en: "System gate milestone target" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("SystemId", "text", { len: 60 }),
      req("GateType", "text", { len: 10, comment: "mc|rfsu|pac|fac" }),
      req("TargetDate", "date", { comment: "مصوب اولیه" }),
      c("ForecastDate", "date", { comment: "پیش‌بینی جاری" }),
      c("ActualDate", "date", { comment: "از تاریخ صدور گواهی پر می‌شود" }),
      c("SlipDays", "int", { comment: "مشتق: Actual یا Forecast منهای Target" }),
      c("NoteFa", "text", { len: 600 }),
    ],
    indexes: [
      { name: "UX_SystemMilestone", columns: ["SystemId", "GateType"], unique: true },
      { name: "IX_SystemMilestone_Gate", columns: ["ProjectId", "GateType", "TargetDate"] },
    ],
  },

  /* ══════════════ MOD-13 · بستهٔ آزمون و برگه‌های سرد و گرم (D4) ══════════════ */
  {
    name: "CheckRecordPack",
    module: "d15",
    title: { fa: "بستهٔ آزمون", en: "Check record pack" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("SystemId", "text", { len: 60 }),
      req("PackNo", "text", { len: 60 }),
      req("TitleFa", "text", { len: 400 }),
      /* یک جدول برای سرد و گرم (ADR-COM-06): تفاوتشان در زمان اجرا و
         پیش‌نیاز است نه در شکل داده. */
      req("PackType", "text", { len: 10, comment: "a = آزمون سرد | b = آزمون گرم" }),
      c("DisciplineCode", "text", { len: 20 }),
      c("TotalSheets", "int", { comment: "مشتق از برگه‌ها" }),
      c("ClearedSheets", "int", { comment: "مشتق از برگه‌ها" }),
      c("ClearedAt", "date", { comment: "تاریخ صدور گواهی تأیید آزمون" }),
      c("ClearedBy", "text", { len: 60 }),
      c("NoteFa", "text", { len: 1000 }),
      req("Status", "text", { len: 20, comment: "draft|in_progress|cleared|rejected" }),
    ],
    indexes: [
      { name: "UX_CheckRecordPack", columns: ["ProjectId", "PackNo"], unique: true },
      { name: "IX_CheckRecordPack_System", columns: ["SystemId", "PackType", "Status"] },
    ],
  },
  {
    name: "CheckSheet",
    module: "d15",
    title: { fa: "برگهٔ آزمون", en: "Check sheet" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("PackId", "text", { len: 60 }),
      req("SheetNo", "text", { len: 60 }),
      req("SheetType", "text", { len: 10, comment: "a = سرد | b = گرم" }),
      req("TestKind", "text", { len: 30, comment: "hydrotest|flushing|blowing|megger|loop_check|calibration|alignment|no_load|load_test|vibration" }),
      req("TitleFa", "text", { len: 400 }),
      c("TestDate", "date"),
      c("TestedBy", "text", { len: 60 }),
      c("WitnessedBy", "text", { len: 60, comment: "شاهد کارفرما یا مشاور" }),
      c("ResultFa", "text", { len: 20, comment: "pass|fail|conditional" }),
      /* برگهٔ مردود می‌تواند عدم انطباق بسازد؛ ارجاع نگه داشته می‌شود تا
         ردپای ممیزی از آزمون تا رفع عیب پیوسته بماند. */
      c("NcrRef", "text", { len: 60 }),
      c("NoteFa", "text", { len: 1000 }),
      req("Status", "text", { len: 20, comment: "draft|signed|void" }),
    ],
    indexes: [
      { name: "UX_CheckSheet", columns: ["ProjectId", "SheetNo"], unique: true },
      { name: "IX_CheckSheet_Pack", columns: ["PackId", "Status"] },
      { name: "IX_CheckSheet_Kind", columns: ["ProjectId", "SheetType", "TestKind"] },
    ],
  },
  {
    name: "CheckSheetLine",
    module: "d15",
    title: { fa: "ردیف برگهٔ آزمون", en: "Check sheet line" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("SheetId", "text", { len: 60 }),
      req("LineNo", "int"),
      req("ParameterFa", "text", { len: 300 }),
      c("ExpectedValue", "text", { len: 120 }),
      c("ActualValue", "text", { len: 120 }),
      c("UnitFa", "text", { len: 40 }),
      /* ردیف الزامی مبنای قبولی برگه است؛ ردیف اختیاری فقط ثبت می‌شود. */
      req("IsMandatory", "bool", { default: "1" }),
      c("Passed", "bool", { comment: "خالی یعنی هنوز سنجیده نشده" }),
      c("NoteFa", "text", { len: 600 }),
    ],
    indexes: [
      { name: "UX_CheckSheetLine", columns: ["SheetId", "LineNo"], unique: true },
      { name: "IX_CheckSheetLine_Sheet", columns: ["SheetId", "IsMandatory"] },
    ],
  },

  /* ══════════════ d16 — بهداشت، ایمنی و محیط زیست (HSE) ══════════════
   * پروانهٔ کار پیش‌نیاز دروازهٔ RFSU در ماژول راه‌اندازی است؛ تا پیش از
   * این جداول، آن پیش‌نیاز فقط رشتهٔ آزاد بود و قابل کنترل نبود. */
  {
    name: "WorkPermit",
    module: "d16",
    title: { fa: "پروانهٔ کار", en: "Work permit" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("PermitNo", "text", { len: 40 }),
      req("PermitType", "text", { len: 30, comment: "hot|cold|confined|height|electrical|excavation|lifting" }),
      req("TitleFa", "text", { len: 400 }),
      c("SystemId", "text", { len: 60, comment: "سیستم موضوع کار — پل به دروازهٔ RFSU ماژول راه‌اندازی" }),
      c("ActivityId", "text", { len: 60 }),
      c("LocationFa", "text", { len: 300 }),
      req("RequestedBy", "text", { len: 60 }),
      req("ValidFrom", "datetime"),
      req("ValidTo", "datetime"),
      c("ApprovedBy", "text", { len: 60 }),
      c("ApprovedAt", "datetime"),
      c("ClosedBy", "text", { len: 60 }),
      c("ClosedAt", "datetime"),
      /* کار گرم هم‌زمان با کار دیگر نیازمند تأییدیهٔ جداگانه است. */
      req("SimopsRequired", "bool", { default: "0" }),
      c("SimopsApprovedBy", "text", { len: 60 }),
      /* رشتهٔ آزاد قدیمی؛ با GasTestLog جایگزین می‌شود ولی برای دادهٔ
       * تاریخی حذف نمی‌شود و به‌عنوان یادداشت خوانده می‌شود. */
      c("GasTestResultFa", "text", { len: 200 }),
      c("NoteFa", "text", { len: 1000 }),
      req("Status", "text", { len: 20, comment: "draft|active|suspended|closed|expired|rejected" }),
      /* ── افزوده در مهاجرت 0017؛ همه nullable تا روی دادهٔ موجود نشکند ── */
      /* پیش‌نیاز «JSA مصوب» — تا پیش از این قابل سنجش نبود (شکاف GH-05). */
      c("JsaId", "text", { len: 60, comment: "ارزیابی ریسک شغلی پشتیبان — HSE_RiskAssessment" }),
      /* شناسهٔ داخلی نباید روی کاغذ کارگاه چاپ شود؛ توکن مستقل قابل ابطال است. */
      c("QrToken", "text", { len: 64, comment: "توکن اعتبارسنجی میدانی — مستقل از Id" }),
      /* تعلیق از لغو جداست: پروانهٔ معلق دوباره فعال می‌شود، پروانهٔ لغوشده نه. */
      c("SuspendedAt", "datetime"),
      c("SuspendedBy", "text", { len: 60 }),
      c("SuspendReasonFa", "text", { len: 400 }),
      c("ParentPermitId", "text", { len: 60, comment: "تمدید — زنجیرهٔ پروانه حفظ شود" }),
    ],
    indexes: [
      { name: "UX_WorkPermit_No", columns: ["ProjectId", "PermitNo"], unique: true },
      { name: "IX_WorkPermit_System", columns: ["ProjectId", "SystemId", "Status"] },
      { name: "IX_WorkPermit_Validity", columns: ["ProjectId", "Status", "ValidTo"] },
      { name: "UX_WorkPermit_Qr", columns: ["QrToken"], unique: true },
      { name: "IX_WorkPermit_Jsa", columns: ["JsaId"] },
    ],
  },
  {
    name: "SafetyIncident",
    module: "d16",
    title: { fa: "رویداد ایمنی", en: "Safety incident" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("IncidentNo", "text", { len: 40 }),
      req("TitleFa", "text", { len: 400 }),
      req("IncidentType", "text", { len: 30, comment: "near_miss|first_aid|medical_treatment|lost_time|fatality|environmental|property_damage" }),
      req("OccurredAt", "datetime"),
      c("LocationFa", "text", { len: 300 }),
      c("SystemId", "text", { len: 60 }),
      c("ActivityId", "text", { len: 60 }),
      req("ReportedBy", "text", { len: 60 }),
      c("InjuredPersonFa", "text", { len: 200 }),
      /* روزهای ازکارافتادگی مبنای محاسبهٔ LTIFR است. */
      c("LostDays", "int"),
      c("RootCauseFa", "text", { len: 1000 }),
      c("CorrectiveActionFa", "text", { len: 1000 }),
      c("NcrRef", "text", { len: 60 }),
      c("ClosedAt", "datetime"),
      c("ClosedBy", "text", { len: 60 }),
      req("Severity", "text", { len: 20, comment: "low|medium|high|critical" }),
      req("Status", "text", { len: 20, comment: "open|investigating|closed" }),
      /* ── افزوده در مهاجرت 0018؛ همه nullable تا روی دادهٔ موجود نشکند ── */
      /* حادثه زیر پروانهٔ فعال رخ داد؟ مبنای تحلیل اثربخشی سامانهٔ پروانه. */
      c("PermitId", "text", { len: 60 }),
      /* مهر زمانی گزارش فوری — بدون آن سنجش SLA اعلام ممکن نیست. */
      c("FlashReportAt", "datetime"),
      c("IsEmergencyActivated", "bool"),
      /* ثبت میدانی موبایل؛ مختصات برای تحلیل نقاط داغ کارگاه. */
      c("GpsLat", "decimal", { precision: 9, scale: 6 }),
      c("GpsLng", "decimal", { precision: 9, scale: 6 }),
    ],
    indexes: [
      { name: "UX_SafetyIncident_No", columns: ["ProjectId", "IncidentNo"], unique: true },
      { name: "IX_SafetyIncident_Type", columns: ["ProjectId", "IncidentType", "OccurredAt"] },
      { name: "IX_SafetyIncident_Open", columns: ["ProjectId", "Status", "Severity"] },
      { name: "IX_SafetyIncident_Permit", columns: ["PermitId"] },
    ],
  },
  {
    name: "SafetyInspection",
    module: "d16",
    title: { fa: "بازرسی ایمنی", en: "Safety inspection" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("InspectionNo", "text", { len: 40 }),
      req("TitleFa", "text", { len: 400 }),
      req("InspectionType", "text", { len: 30, comment: "walkthrough|toolbox|audit|drill|equipment" }),
      req("InspectedAt", "date"),
      req("InspectedBy", "text", { len: 60 }),
      c("AreaFa", "text", { len: 300 }),
      c("FindingsCount", "int"),
      c("ClosedFindings", "int"),
      c("ScorePct", "decimal", { precision: 5, scale: 2 }),
      c("NoteFa", "text", { len: 1000 }),
      req("Status", "text", { len: 20, comment: "draft|completed|closed" }),
    ],
    indexes: [
      { name: "UX_SafetyInspection_No", columns: ["ProjectId", "InspectionNo"], unique: true },
      { name: "IX_SafetyInspection_Date", columns: ["ProjectId", "InspectedAt"] },
    ],
  },
  {
    name: "SafetyTrainingRecord",
    module: "d16",
    title: { fa: "سابقهٔ آموزش ایمنی", en: "Safety training record" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      /* ماژول منابع انسانی گیت hseTraining را از اینجا می‌خواند و نمی‌نویسد. */
      req("PersonRef", "text", { len: 60, comment: "ارجاع به WorkforceMember" }),
      req("CourseCode", "text", { len: 40 }),
      req("CourseTitleFa", "text", { len: 300 }),
      req("CompletedAt", "date"),
      c("ExpiresAt", "date", { comment: "خالی یعنی بدون انقضا" }),
      c("ScorePct", "decimal", { precision: 5, scale: 2 }),
      c("CertificateNo", "text", { len: 60 }),
      req("Status", "text", { len: 20, comment: "valid|expired|revoked" }),
    ],
    indexes: [
      { name: "UX_SafetyTraining", columns: ["ProjectId", "PersonRef", "CourseCode"], unique: true },
      { name: "IX_SafetyTraining_Expiry", columns: ["ProjectId", "ExpiresAt", "Status"] },
    ],
  },
  {
    /* جلسهٔ آموزش. SafetyTrainingRecord سابقهٔ «فرد در دوره» است ولی
     * نمی‌گوید آن دوره کِی، توسط چه کسی و برای چند نفر برگزار شد. بدون
     * این جدول، ممیز نمی‌تواند بپرسد «مدرک برگزاری این آموزش کجاست». */
    name: "TrainingSession",
    module: "d16",
    title: { fa: "جلسهٔ آموزش ایمنی", en: "Training session" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("SessionNo", "text", { len: 40 }),
      req("TitleFa", "text", { len: 300 }),
      req("CourseCode", "text", { len: 40 }),
      req("TrainingType", "text", { len: 30, comment: "induction|toolbox|specialist|refresher|drill" }),
      req("HeldAt", "datetime"),
      req("DurationMinutes", "int"),
      req("InstructorFa", "text", { len: 200 }),
      c("LocationFa", "text", { len: 200 }),
      c("ContractorFa", "text", { len: 200 }),
      /* اعتبار گواهی از جلسه مشتق می‌شود نه از ردیف فرد: اگر هر ردیف
       * انقضای خودش را داشته باشد، دو نفر از یک جلسه می‌توانند تاریخ
       * انقضای متفاوت بگیرند و ماتریس آموزش بی‌معنا می‌شود. */
      c("ValidityMonths", "int", { comment: "خالی یعنی گواهی بدون انقضا" }),
      c("MaterialRef", "text", { len: 300 }),
      req("Status", "text", { len: 20, comment: "planned|held|cancelled" }),
    ],
    indexes: [
      { name: "UX_TrainingSession_No", columns: ["ProjectId", "SessionNo"], unique: true },
      { name: "IX_TrainingSession_Date", columns: ["ProjectId", "HeldAt", "TrainingType"] },
    ],
  },
  {
    /* حاضران یک جلسه. امضا و نتیجهٔ آزمون اینجاست؛ SafetyTrainingRecord
     * فقط برای حاضرِ قبول‌شده ساخته می‌شود. */
    name: "TrainingAttendee",
    module: "d16",
    title: { fa: "حاضر در جلسهٔ آموزش", en: "Training attendee" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("SessionId", "text", { len: 60 }),
      req("PersonRef", "text", { len: 60, comment: "ارجاع به WorkforceMember" }),
      req("PersonNameFa", "text", { len: 200 }),
      c("TradeCode", "text", { len: 40 }),
      c("ContractorFa", "text", { len: 200 }),
      req("Attended", "bool", { default: "0" }),
      c("ScorePct", "decimal", { precision: 5, scale: 2 }),
      /* قبولی صریح ثبت می‌شود نه از نمره حدس زده شود: بعضی دوره‌ها
       * آزمون ندارند و حضور کافی است. */
      req("Passed", "bool", { default: "0" }),
      c("SignatureRef", "text", { len: 300 }),
      c("NoteFa", "text", { len: 400 }),
    ],
    indexes: [
      { name: "UX_TrainingAttendee", columns: ["SessionId", "PersonRef"], unique: true },
      { name: "IX_TrainingAttendee_Person", columns: ["ProjectId", "PersonRef"] },
    ],
  },
  {
    /* تحویل تجهیزات حفاظت فردی. بدون این جدول، تخلف «نبود تجهیزات
     * حفاظت فردی» قابل دفاع نیست: پیمانکار می‌گوید تجهیز تحویل نشده. */
    name: "PpeIssuance",
    module: "d16",
    title: { fa: "تحویل تجهیزات حفاظت فردی", en: "PPE issuance" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("IssueNo", "text", { len: 40 }),
      req("PersonRef", "text", { len: 60 }),
      req("PersonNameFa", "text", { len: 200 }),
      req("PpeType", "text", { len: 30, comment: "helmet|boots|goggles|gloves|harness|respirator|earplug|coverall|face_shield" }),
      req("IssuedAt", "date"),
      req("IssuedBy", "text", { len: 60 }),
      req("Quantity", "int", { default: "1" }),
      c("SizeFa", "text", { len: 40 }),
      c("SerialNo", "text", { len: 60 }),
      /* تجهیز عمردار (مثل هارنس) تاریخ تعویض دارد؛ خالی یعنی مصرفی. */
      c("ReplaceDueDate", "date", { comment: "خالی یعنی تجهیز مصرفی است" }),
      c("ReturnedAt", "date"),
      c("UnitCost", "decimal", { precision: 18, scale: 2 }),
      c("ContractorFa", "text", { len: 200 }),
      req("Status", "text", { len: 20, comment: "issued|returned|lost|damaged" }),
    ],
    indexes: [
      { name: "UX_PpeIssuance_No", columns: ["ProjectId", "IssueNo"], unique: true },
      { name: "IX_PpeIssuance_Person", columns: ["ProjectId", "PersonRef", "PpeType"] },
      { name: "IX_PpeIssuance_Replace", columns: ["ProjectId", "ReplaceDueDate", "Status"] },
    ],
  },
  {
    /* عامل زیان‌آور شغلی. معاینهٔ دوره‌ای بدون فهرست عوامل بی‌معناست:
     * جوشکار باید ریه و چشم بدهد، اپراتور جرثقیل شنوایی و بینایی. */
    name: "OccupationalHazard",
    module: "d16",
    title: { fa: "عامل زیان‌آور شغلی", en: "Occupational hazard" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("HazardCode", "text", { len: 40 }),
      req("TitleFa", "text", { len: 300 }),
      req("HazardType", "text", { len: 30, comment: "noise|dust|chemical|vibration|radiation|heat|ergonomic|biological" }),
      c("TradeCode", "text", { len: 40, comment: "خالی یعنی همهٔ مشاغل" }),
      c("ExposureLimitFa", "text", { len: 200 }),
      req("ExamIntervalMonths", "int", { comment: "فاصلهٔ معاینهٔ دوره‌ای" }),
      c("RequiredExamsFa", "text", { len: 400 }),
      c("RequiredPpeFa", "text", { len: 300 }),
      req("Status", "text", { len: 20, comment: "active|retired" }),
    ],
    indexes: [
      { name: "UX_OccupationalHazard", columns: ["ProjectId", "HazardCode"], unique: true },
      { name: "IX_OccupationalHazard_Trade", columns: ["ProjectId", "TradeCode", "Status"] },
    ],
  },
  {
    /* معاینهٔ طب کار. نتیجه سه‌حالته است نه دوحالته: «مشروط» یعنی فرد
     * می‌تواند کار کند ولی نه هر کاری، و این حالت در عمل رایج‌ترین است. */
    name: "HealthExamination",
    module: "d16",
    title: { fa: "معاینهٔ طب کار", en: "Health examination" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("ExamNo", "text", { len: 40 }),
      req("PersonRef", "text", { len: 60 }),
      req("PersonNameFa", "text", { len: 200 }),
      req("ExamType", "text", { len: 20, comment: "pre_employment|periodic|exit|special" }),
      req("ExaminedAt", "date"),
      req("Fitness", "text", { len: 20, comment: "fit|fit_with_restriction|unfit|pending" }),
      c("RestrictionFa", "text", { len: 400, comment: "الزامی وقتی Fitness=fit_with_restriction" }),
      c("HazardCode", "text", { len: 40 }),
      c("NextExamDate", "date"),
      c("PhysicianFa", "text", { len: 200 }),
      c("ClinicFa", "text", { len: 200 }),
      /* پروندهٔ پزشکی محرمانه است؛ فقط ارجاع نگه می‌داریم نه محتوا. */
      c("ReportRef", "text", { len: 300, comment: "ارجاع به سند؛ محتوای پزشکی اینجا ذخیره نمی‌شود" }),
      req("Status", "text", { len: 20, comment: "valid|expired|superseded" }),
    ],
    indexes: [
      { name: "UX_HealthExam_No", columns: ["ProjectId", "ExamNo"], unique: true },
      { name: "IX_HealthExam_Person", columns: ["ProjectId", "PersonRef", "ExamType"] },
      { name: "IX_HealthExam_Next", columns: ["ProjectId", "NextExamDate", "Status"] },
    ],
  },
  {
    /* سیاههٔ پسماند. شمارهٔ مانیفست برای پسماند خطرناک الزامی است و
     * موتور آن را کنترل می‌کند: پسماند خطرناکِ بدون مانیفست یعنی
     * تخلف زیست‌محیطی قابل پیگرد. */
    name: "WasteLog",
    module: "d16",
    title: { fa: "سیاههٔ پسماند", en: "Waste log" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("WasteNo", "text", { len: 40 }),
      req("WasteType", "text", { len: 30, comment: "hazardous|non_hazardous|recyclable|construction|liquid" }),
      req("DescriptionFa", "text", { len: 300 }),
      req("Quantity", "decimal", { precision: 18, scale: 3 }),
      req("Unit", "text", { len: 20, comment: "kg|ton|liter|m3" }),
      req("GeneratedAt", "date"),
      c("AreaFa", "text", { len: 200 }),
      req("DisposalMethod", "text", { len: 30, comment: "landfill|incineration|recycling|treatment|licensed_contractor" }),
      c("ManifestNo", "text", { len: 60, comment: "برای پسماند خطرناک الزامی است" }),
      c("CarrierFa", "text", { len: 200 }),
      c("DestinationFa", "text", { len: 200 }),
      c("DisposedAt", "date"),
      c("CostAmount", "decimal", { precision: 18, scale: 2 }),
      req("Status", "text", { len: 20, comment: "generated|in_transit|disposed|rejected" }),
    ],
    indexes: [
      { name: "UX_WasteLog_No", columns: ["ProjectId", "WasteNo"], unique: true },
      { name: "IX_WasteLog_Type", columns: ["ProjectId", "WasteType", "Status"] },
      { name: "IX_WasteLog_Date", columns: ["ProjectId", "GeneratedAt"] },
    ],
  },
  {
    /* پایش زیست‌محیطی. حد مجاز روی خود ردیف ثبت می‌شود نه در جدول
     * جدا: حد قانونی با زمان عوض می‌شود و اندازه‌گیری پارسال باید در
     * برابر حد پارسال قضاوت شود، نه حد امروز. */
    name: "EnvironmentalMonitoring",
    module: "d16",
    title: { fa: "پایش زیست‌محیطی", en: "Environmental monitoring" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("ReadingNo", "text", { len: 40 }),
      req("Medium", "text", { len: 20, comment: "air|water|soil|noise|effluent" }),
      req("ParameterFa", "text", { len: 200 }),
      req("MeasuredAt", "datetime"),
      req("MeasuredValue", "decimal", { precision: 18, scale: 4 }),
      req("Unit", "text", { len: 30 }),
      req("LimitValue", "decimal", { precision: 18, scale: 4, comment: "حد مجاز در زمان اندازه‌گیری" }),
      c("LocationFa", "text", { len: 200 }),
      c("MethodFa", "text", { len: 200 }),
      c("LabFa", "text", { len: 200 }),
      c("CorrectiveActionFa", "text", { len: 400 }),
      c("ViolationId", "text", { len: 60, comment: "تخلف صادرشده در پی فراتررفتن از حد" }),
      req("Status", "text", { len: 20, comment: "recorded|verified|disputed" }),
    ],
    indexes: [
      { name: "UX_EnvMonitoring_No", columns: ["ProjectId", "ReadingNo"], unique: true },
      { name: "IX_EnvMonitoring_Medium", columns: ["ProjectId", "Medium", "MeasuredAt"] },
    ],
  },

  /* ══════════ d16 — شاخص و هشدار زودهنگام (زیرماژول ۰۸٫۶) ══════════
   * تا پیش از این، شاخص‌های ایمنی هر بار از صفر بازمحاسبه می‌شدند و
   * هیچ تاریخچه‌ای نمی‌ماند؛ یعنی «روند» — که کل ارزش پایش ایمنی است —
   * قابل نمایش نبود. عکس دوره‌ای، مقدارِ همان زمان را تثبیت می‌کند حتی
   * اگر دادهٔ پایه بعداً اصلاح شود. */
  {
    name: "HSE_MetricSnapshot",
    module: "d16",
    title: { fa: "عکس شاخص ایمنی", en: "HSE metric snapshot" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("PeriodCode", "text", { len: 20, comment: "دورهٔ گزارش، مثلاً 1405-06" }),
      req("MetricCode", "text", { len: 40, comment: "ltifr|trir|permit_compliance|training_hours_per_worker|violation_closure_rate|hse_score" }),
      req("Value", "decimal", { precision: 18, scale: 4 }),
      c("Target", "decimal", { precision: 18, scale: 4, comment: "هدف دوره؛ خالی یعنی هدفی تعیین نشده" }),
      /* واحد روی خود ردیف می‌ماند: نرخ، درصد و ساعت در یک جدول
       * می‌نشینند و بدون واحد، مقایسه‌شان بی‌معناست. */
      req("Unit", "text", { len: 20, comment: "rate|pct|hours|score" }),
      req("CapturedAt", "datetime"),
      /* نفرساعت مبنا ذخیره می‌شود چون شاخص نسبی بدون مخرجش قابل
       * بازبینی نیست و بازرس بیرونی همیشه مخرج را می‌پرسد. */
      c("BaseManHours", "decimal", { precision: 18, scale: 2 }),
      c("SampleSize", "int", { comment: "تعداد رکورد پایه" }),
      /* شاخصی که مخرجش صفر بوده «تهی» است نه صفر — این پرچم تفاوت
       * «ایمن بودیم» با «نمی‌دانیم» را حفظ می‌کند. */
      req("IsEstimated", "bool", { default: "0", comment: "دادهٔ پایه ناقص بوده" }),
      c("NoteFa", "text", { len: 400 }),
      req("Status", "text", { len: 20, default: "draft", comment: "draft|published|superseded" }),
    ],
    indexes: [
      { name: "UX_HseMetric", columns: ["ProjectId", "PeriodCode", "MetricCode"], unique: true },
      { name: "IX_HseMetric_Code", columns: ["ProjectId", "MetricCode", "CapturedAt"] },
    ],
  },
  {
    name: "HSE_AlertRule",
    module: "d16",
    title: { fa: "قاعدهٔ هشدار ایمنی", en: "HSE alert rule" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("RuleCode", "text", { len: 40, comment: "unsafe_gas|active_stop_work|expired_permit|training_gap|env_exceedance" }),
      req("TitleFa", "text", { len: 200 }),
      req("Severity", "text", { len: 20, comment: "critical|high|medium|low" }),
      /* آستانه روی خود قاعده است نه در کد: حد قابل تحمل تخلف باز در
       * پروژهٔ پالایشگاهی با پروژهٔ ساختمانی یکی نیست. */
      req("Threshold", "decimal", { precision: 18, scale: 4 }),
      req("Comparison", "text", { len: 10, comment: "gt|gte|lt|lte|eq" }),
      req("IsEnabled", "bool", { default: "1" }),
      /* هشدار خاموش‌شده حذف نمی‌شود: تاریخچهٔ اینکه چه کسی چه زمانی
       * یک هشدار ایمنی را غیرفعال کرده، خودش سند ممیزی است. */
      c("MutedUntil", "date", { comment: "سکوت موقت با تاریخ پایان" }),
      c("MuteReasonFa", "text", { len: 400 }),
      c("OwnerRole", "text", { len: 40, comment: "نقش پاسخ‌گو" }),
      c("ActionFa", "text", { len: 400, comment: "اقدام پیشنهادی هنگام فعال‌شدن" }),
      req("Status", "text", { len: 20, default: "active", comment: "active|retired" }),
    ],
    indexes: [
      { name: "UX_HseAlertRule", columns: ["ProjectId", "RuleCode"], unique: true },
    ],
  },

  /* ══════════ d16 — ارزیابی ریسک شغلی (JSA) ══════════
   * پیش‌نیاز صدور پروانهٔ کار طبق ISO 45001 بند ۸٫۱٫۲. بدون این جداول،
   * شرط «JSA مصوب» روی پروانه قابل سنجش نبود. */
  {
    name: "HSE_RiskAssessment",
    module: "d16",
    title: { fa: "ارزیابی ریسک شغلی", en: "Job safety analysis" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("JsaNo", "text", { len: 40 }),
      req("TitleFa", "text", { len: 400 }),
      c("ActivityId", "text", { len: 60, comment: "فعالیت زمان‌بندی مرتبط" }),
      c("TemplateCode", "text", { len: 40, comment: "ارجاع به کتابخانهٔ الگو" }),
      c("DisciplineCode", "text", { len: 40 }),
      c("LocationFa", "text", { len: 300 }),
      req("PreparedBy", "text", { len: 60 }),
      req("PreparedAt", "date"),
      c("ApprovedBy", "text", { len: 60 }),
      c("ApprovedAt", "date"),
      c("ValidUntil", "date", { comment: "خالی یعنی بدون انقضا" }),
      /* بیشینهٔ ریسک باقیمانده از ردیف‌ها مشتق می‌شود؛ اگر ورودی بود،
       * ارزیابی خطر به عددی تشریفاتی تبدیل می‌شد. */
      c("MaxResidualRisk", "int", { comment: "مشتق از خطرات — ورودی نیست" }),
      c("NoteFa", "text", { len: 1000 }),
      req("Status", "text", { len: 20, comment: "draft|approved|expired|void" }),
    ],
    indexes: [
      { name: "UX_HseRiskAssessment_No", columns: ["ProjectId", "JsaNo"], unique: true },
      { name: "IX_HseRiskAssessment_Activity", columns: ["ProjectId", "ActivityId", "Status"] },
      { name: "IX_HseRiskAssessment_Valid", columns: ["ProjectId", "Status", "ValidUntil"] },
    ],
  },
  {
    name: "JSA_JobStep",
    module: "d16",
    title: { fa: "گام کاری ارزیابی ریسک", en: "JSA job step" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("JsaId", "text", { len: 60 }),
      req("StepNo", "int"),
      req("DescriptionFa", "text", { len: 600 }),
      c("ResponsibleFa", "text", { len: 200 }),
      c("NoteFa", "text", { len: 600 }),
    ],
    indexes: [
      { name: "UX_JsaJobStep", columns: ["JsaId", "StepNo"], unique: true },
      { name: "IX_JsaJobStep_Jsa", columns: ["JsaId"] },
    ],
  },
  {
    name: "JSA_Hazard",
    module: "d16",
    title: { fa: "خطر گام کاری", en: "JSA hazard" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("JsaId", "text", { len: 60, comment: "تکرار عمدی برای پیمایش بدون اتصال" }),
      req("StepId", "text", { len: 60 }),
      req("HazardNo", "int"),
      req("HazardFa", "text", { len: 600 }),
      c("HazardCategory", "text", { len: 30, comment: "fall|struck|caught|electrical|chemical|fire|ergonomic|environmental|biological|noise" }),
      /* احتمال و شدت ۱ تا ۵؛ حاصل‌ضرب ریسک را می‌سازد. */
      req("Likelihood", "int"),
      req("Severity", "int"),
      c("InitialRisk", "int", { comment: "مشتق: احتمال × شدت" }),
      c("ResidualLikelihood", "int"),
      c("ResidualSeverity", "int"),
      c("ResidualRisk", "int", { comment: "مشتق پس از اعمال کنترل‌ها" }),
      c("NoteFa", "text", { len: 600 }),
    ],
    indexes: [
      { name: "UX_JsaHazard", columns: ["StepId", "HazardNo"], unique: true },
      { name: "IX_JsaHazard_Jsa", columns: ["JsaId"] },
      { name: "IX_JsaHazard_Risk", columns: ["ProjectId", "ResidualRisk"] },
    ],
  },
  {
    name: "JSA_Control",
    module: "d16",
    title: { fa: "کنترل خطر", en: "JSA control" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("JsaId", "text", { len: 60 }),
      req("HazardId", "text", { len: 60 }),
      req("ControlNo", "int"),
      /* سلسله‌مراتب ISO 45001 بند ۸٫۱٫۲ — ترتیب اثربخشی از بالا به پایین. */
      req("ControlLevel", "text", { len: 20, comment: "elimination|substitution|engineering|administrative|ppe" }),
      req("ControlFa", "text", { len: 600 }),
      c("ResponsibleFa", "text", { len: 200 }),
      c("VerifiedBy", "text", { len: 60 }),
      c("VerifiedAt", "date"),
    ],
    indexes: [
      { name: "UX_JsaControl", columns: ["HazardId", "ControlNo"], unique: true },
      { name: "IX_JsaControl_Jsa", columns: ["JsaId", "ControlLevel"] },
    ],
  },
  {
    /* گازسنجی عددی — شکاف GH-06. ستون متنی GasTestResultFa پاسخ‌گو نبود:
     * «OK» قابل ممیزی نیست و آستانه‌ها را نمی‌سنجد. */
    name: "GasTestLog",
    module: "d16",
    title: { fa: "سابقهٔ گازسنجی", en: "Gas test log" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("PermitId", "text", { len: 60 }),
      req("TestedAt", "datetime"),
      /* حد انفجار — آستانهٔ ایمن کمتر از ۱۰٪. */
      c("LelPct", "decimal", { precision: 5, scale: 2 }),
      /* اکسیژن — بازهٔ ایمن ۱۹٫۵ تا ۲۳٫۵٪؛ هر دو سو خطرناک است. */
      c("OxygenPct", "decimal", { precision: 5, scale: 2 }),
      c("H2sPpm", "decimal", { precision: 8, scale: 2 }),
      c("CoPpm", "decimal", { precision: 8, scale: 2 }),
      /* مشتق از مقادیر عددی، نه ورودی: اپراتور تحت فشار زمانی تیک
       * «ایمن» را می‌زند. */
      req("IsSafe", "bool", { default: "0" }),
      c("BreachedFa", "text", { len: 300, comment: "فهرست پارامترهای خارج از محدوده" }),
      req("TestedBy", "text", { len: 60 }),
      /* ردگیری کالیبراسیون دستگاه — گازسنج خارج از کالیبراسیون بی‌ارزش است. */
      c("DeviceSerial", "text", { len: 60 }),
      c("NoteFa", "text", { len: 500 }),
    ],
    indexes: [
      { name: "IX_GasTestLog_Permit", columns: ["PermitId", "TestedAt"] },
      { name: "IX_GasTestLog_Safe", columns: ["ProjectId", "IsSafe", "TestedAt"] },
    ],
  },
  {
    /* قفل و برچسب — قفل جامانده روی تجهیز خطر مستقیم راه‌اندازی ناخواسته است. */
    name: "IsolationLog",
    module: "d16",
    title: { fa: "سابقهٔ ایزولاسیون", en: "Isolation log" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("PermitId", "text", { len: 60 }),
      req("IsolationNo", "int"),
      req("IsolationType", "text", { len: 20, comment: "electrical|mechanical|process|hydraulic" }),
      req("PointTagFa", "text", { len: 300 }),
      c("LockNo", "text", { len: 40, comment: "شمارهٔ فیزیکی قفل" }),
      c("TagNo", "text", { len: 40, comment: "شمارهٔ فیزیکی برچسب" }),
      c("AppliedAt", "datetime"),
      c("AppliedBy", "text", { len: 60 }),
      c("RemovedAt", "datetime"),
      c("RemovedBy", "text", { len: 60 }),
      req("Status", "text", { len: 20, comment: "planned|applied|removed" }),
    ],
    indexes: [
      { name: "UX_IsolationLog", columns: ["PermitId", "IsolationNo"], unique: true },
      { name: "IX_IsolationLog_Status", columns: ["ProjectId", "Status"] },
    ],
  },
  {
    /* امضای سه‌سطحی با ترتیب اجباری — مدیر منطقه نباید چیزی را تأیید کند
     * که افسر ایمنی هنوز ندیده است. */
    name: "PTW_Approval",
    module: "d16",
    title: { fa: "امضای پروانهٔ کار", en: "Work permit approval" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("PermitId", "text", { len: 60 }),
      req("ApprovalLevel", "text", { len: 20, comment: "supervisor|hse|area_manager" }),
      req("ApproverRef", "text", { len: 60 }),
      req("SignedAt", "datetime"),
      req("DecisionFa", "text", { len: 20, comment: "approved|rejected" }),
      c("CommentFa", "text", { len: 600 }),
    ],
    indexes: [
      { name: "UX_PtwApproval", columns: ["PermitId", "ApprovalLevel"], unique: true },
      { name: "IX_PtwApproval_Approver", columns: ["ProjectId", "ApproverRef"] },
    ],
  },
  {
    /* چک‌لیست احتیاطی. IsConfirmed عمداً nullable است: null یعنی «هنوز
     * بررسی نشده» — همان اصل «سکوت ≠ تأیید» ماژول راه‌اندازی. */
    name: "PTW_Precaution",
    module: "d16",
    title: { fa: "اقدام احتیاطی پروانه", en: "Permit precaution" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("PermitId", "text", { len: 60 }),
      req("PrecautionNo", "int"),
      req("PrecautionFa", "text", { len: 500 }),
      req("IsMandatory", "bool", { default: "1" }),
      c("IsConfirmed", "bool"),
      c("ConfirmedBy", "text", { len: 60 }),
      c("ConfirmedAt", "datetime"),
      c("NoteFa", "text", { len: 400 }),
    ],
    indexes: [
      { name: "UX_PtwPrecaution", columns: ["PermitId", "PrecautionNo"], unique: true },
      { name: "IX_PtwPrecaution_Pending", columns: ["ProjectId", "IsConfirmed"] },
    ],
  },
  {
    /* یک حادثه می‌تواند چند مصدوم داشته باشد؛ ستون متنی InjuredPersonFa
     * برای دادهٔ تاریخی می‌ماند ولی مبنای محاسبه این جدول است. */
    name: "InjuredPerson",
    module: "d16",
    title: { fa: "فرد مصدوم", en: "Injured person" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("IncidentId", "text", { len: 60 }),
      req("PersonNo", "int"),
      c("PersonRef", "text", { len: 60, comment: "ارجاع به WorkforceMember" }),
      req("FullNameFa", "text", { len: 200 }),
      c("CompanyFa", "text", { len: 200, comment: "پیمانکار جزء یا کارفرما" }),
      req("InjuryType", "text", { len: 30, comment: "cut|fracture|burn|poisoning|crush|sprain|eye|other" }),
      c("BodyPart", "text", { len: 30, comment: "head|eye|hand|arm|leg|foot|torso|back|multiple" }),
      /* مبنای LTIFR — روز از دست رفتهٔ همین فرد، نه کل حادثه. */
      c("LostWorkDays", "int"),
      c("RestrictedDays", "int", { comment: "کار سبک — در TRIR می‌آید ولی در LTIFR نه" }),
      c("ReturnedToWork", "bool"),
      c("ReturnedAt", "date"),
      c("TreatmentFa", "text", { len: 400 }),
      c("NoteFa", "text", { len: 600 }),
    ],
    indexes: [
      { name: "UX_InjuredPerson", columns: ["IncidentId", "PersonNo"], unique: true },
      { name: "IX_InjuredPerson_Incident", columns: ["IncidentId"] },
      { name: "IX_InjuredPerson_Person", columns: ["ProjectId", "PersonRef"] },
    ],
  },
  {
    /* کمیتهٔ حقیقت‌یاب. هزینهٔ غیرمستقیم جدا ثبت می‌شود چون معمولاً ۴ تا
     * ۱۰ برابر مستقیم است و مدیریت فقط مستقیم را می‌بیند. */
    name: "HSE_Investigation",
    module: "d16",
    title: { fa: "تحقیق حادثه", en: "Incident investigation" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("IncidentId", "text", { len: 60 }),
      req("LeadInvestigator", "text", { len: 60 }),
      c("TeamFa", "text", { len: 600, comment: "اعضای کمیته" }),
      req("StartedAt", "date"),
      c("CompletedAt", "date"),
      c("MethodFa", "text", { len: 30, comment: "five_why|fishbone|tripod|taproot" }),
      c("SummaryFa", "text", { len: 2000 }),
      c("DirectCost", "decimal", { precision: 18, scale: 2 }),
      c("IndirectCost", "decimal", { precision: 18, scale: 2 }),
      c("LessonsLearnedFa", "text", { len: 2000 }),
      c("ApprovedBy", "text", { len: 60 }),
      c("ApprovedAt", "date"),
      req("Status", "text", { len: 20, comment: "open|in_progress|completed|approved" }),
    ],
    indexes: [
      { name: "UX_HseInvestigation", columns: ["IncidentId"], unique: true },
      { name: "IX_HseInvestigation_Status", columns: ["ProjectId", "Status"] },
    ],
  },
  {
    /* درخت ۵ چرا. خودارجاع چون یک «چرا» می‌تواند چند پاسخ داشته باشد؛
     * فهرست خطی تحلیل‌گر را مجبور می‌کند بقیه را دور بریزد. */
    name: "RootCauseNode",
    module: "d16",
    title: { fa: "گره ریشه‌یابی", en: "Root cause node" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("InvestigationId", "text", { len: 60 }),
      req("NodeNo", "int"),
      c("ParentId", "text", { len: 60, comment: "خودارجاع — ریشهٔ درخت null است" }),
      req("Depth", "int"),
      req("StatementFa", "text", { len: 800 }),
      req("CauseLevel", "text", { len: 20, comment: "immediate|underlying|root" }),
      c("Category", "text", { len: 20, comment: "man|machine|method|material|environment|management" }),
      c("EvidenceFa", "text", { len: 800 }),
      c("IsVerified", "bool"),
    ],
    indexes: [
      { name: "UX_RootCauseNode", columns: ["InvestigationId", "NodeNo"], unique: true },
      { name: "IX_RootCauseNode_Parent", columns: ["ParentId"] },
      { name: "IX_RootCauseNode_Level", columns: ["InvestigationId", "CauseLevel"] },
    ],
  },
  {
    /* اقدام اصلاحی و پیشگیرانه. تحقیق بدون دست‌کم یک اقدام پیشگیرانه
     * بسته نمی‌شود — اقدام صرفاً اصلاحی یعنی حادثه دوباره رخ می‌دهد. */
    name: "CapaAction",
    module: "d16",
    title: { fa: "اقدام اصلاحی و پیشگیرانه", en: "CAPA action" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("SourceType", "text", { len: 20, comment: "incident|investigation|inspection|violation|audit" }),
      req("SourceId", "text", { len: 60 }),
      req("ActionNo", "int"),
      req("ActionFa", "text", { len: 800 }),
      req("ActionType", "text", { len: 20, comment: "corrective|preventive" }),
      c("RootCauseNodeId", "text", { len: 60, comment: "کدام ریشه را می‌بندد" }),
      req("OwnerRef", "text", { len: 60 }),
      req("DueDate", "date"),
      c("CompletedAt", "date"),
      c("VerifiedBy", "text", { len: 60 }),
      c("VerifiedAt", "date"),
      c("EffectivenessFa", "text", { len: 600 }),
      req("Status", "text", { len: 20, comment: "open|in_progress|completed|verified|cancelled" }),
    ],
    indexes: [
      { name: "UX_CapaAction", columns: ["SourceType", "SourceId", "ActionNo"], unique: true },
      { name: "IX_CapaAction_Owner", columns: ["ProjectId", "OwnerRef", "Status"] },
      { name: "IX_CapaAction_Due", columns: ["ProjectId", "Status", "DueDate"] },
    ],
  },
  {
    /* عکس روزانهٔ نفرساعت. بدون آن LTIFR و TRIR مخرج ندارند و طبق
     * ADR-HSE-04 باید null برگردند نه صفر. */
    name: "HSE_ManHourLog",
    module: "d16",
    title: { fa: "سابقهٔ نفرساعت ایمنی", en: "HSE man-hour log" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("LogDate", "date"),
      req("ManHours", "decimal", { precision: 12, scale: 2 }),
      c("HeadCount", "int"),
      /* اجباری با پیش‌فرض «کل پروژه»: اگر nullable بماند، ایندکس یکتای
       * SQL Server (که برای ستون nullable شرطی می‌شود) ردیف‌های بدون
       * پیمانکار را یکتا نمی‌شمارد و نفرساعت هر روز چندبار جمع می‌شود —
       * یعنی مخرج LTIFR بزرگ‌تر از واقع. */
      req("ContractorFa", "text", { len: 200, default: "'کل پروژه'" }),
      /* از کجا آمده: ورود دستی یا تجمیع Timesheet موجود. */
      req("SourceFa", "text", { len: 20, comment: "manual|timesheet" }),
      c("NoteFa", "text", { len: 400 }),
    ],
    indexes: [
      { name: "UX_HseManHourLog", columns: ["ProjectId", "LogDate", "ContractorFa"], unique: true },
      { name: "IX_HseManHourLog_Date", columns: ["ProjectId", "LogDate"] },
    ],
  },

  /* ── MOD-08 / HSE — بازرسی، تخلف و توقف کار (D6، زیرماژول ۰۸٫۴) ── */

  {
    /* یافتهٔ منفرد بازرسی. جدول SafetyInspection موجود فقط FindingsCount
     * عددی دارد؛ بدون این جدول نمی‌شود گفت کدام یافته بسته شده و کدام
     * هنوز باز است، و درصد بستن قابل محاسبه نیست. */
    name: "InspectionFinding",
    module: "d16",
    title: { fa: "یافتهٔ بازرسی", en: "Inspection finding" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("InspectionId", "text", { len: 60 }),
      req("FindingNo", "int"),
      req("DescriptionFa", "text", { len: 600 }),
      req("Category", "text", { len: 30, comment: "unsafe_act|unsafe_condition|housekeeping|ppe|documentation|environmental" }),
      req("Severity", "text", { len: 20, comment: "low|medium|high|critical" }),
      c("AreaFa", "text", { len: 200 }),
      c("ActivityId", "text", { len: 60 }),
      c("PhotoRef", "text", { len: 300 }),
      c("OwnerRef", "text", { len: 60 }),
      c("DueDate", "date"),
      c("ClosedAt", "date"),
      c("ClosedBy", "text", { len: 60 }),
      c("ClosureNoteFa", "text", { len: 600 }),
      req("Status", "text", { len: 20, comment: "open|in_progress|closed|void" }),
    ],
    indexes: [
      { name: "UX_InspectionFinding", columns: ["InspectionId", "FindingNo"], unique: true },
      { name: "IX_InspectionFinding_Status", columns: ["ProjectId", "Status"] },
      { name: "IX_InspectionFinding_Activity", columns: ["ProjectId", "ActivityId"] },
    ],
  },
  {
    /* تخلف ایمنی و دستور توقف کار — شکاف GH-04. تا امروز ماژول HSE
     * هیچ اهرم اجرایی نداشت: می‌توانست خطر را ثبت کند ولی نمی‌توانست
     * کار را متوقف کند. */
    name: "HSE_Violation",
    module: "d16",
    title: { fa: "تخلف ایمنی و توقف کار", en: "HSE violation and stop-work order" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("ViolationNo", "text", { len: 40 }),
      req("TitleFa", "text", { len: 300 }),
      req("ViolationType", "text", { len: 30, comment: "unsafe_act|unsafe_condition|no_ptw|ppe_missing|environmental|housekeeping" }),
      req("Severity", "text", { len: 20, comment: "low|medium|high|critical" }),
      req("IssuedAt", "datetime"),
      req("IssuedBy", "text", { len: 60 }),
      c("AreaFa", "text", { len: 200 }),
      c("ActivityId", "text", { len: 60 }),
      c("SystemId", "text", { len: 60 }),
      c("PermitId", "text", { len: 60 }),
      c("InspectionId", "text", { len: 60 }),
      c("FindingId", "text", { len: 60 }),
      c("ContractorFa", "text", { len: 200 }),
      c("OffenderRef", "text", { len: 60 }),
      /* کلید قفل PEX. مشتق نیست چون تصمیم انسانی است، ولی موتور برای
       * شدت بحرانی آن را الزامی می‌شمارد. */
      req("IsStopWork", "bool", { default: "0" }),
      c("StopWorkScope", "text", { len: 20, comment: "activity|area|system|project" }),
      c("FineAmount", "decimal", { precision: 18, scale: 2 }),
      c("GpsLat", "decimal", { precision: 9, scale: 6 }),
      c("GpsLng", "decimal", { precision: 9, scale: 6 }),
      c("CorrectiveRequestFa", "text", { len: 600 }),
      c("DueDate", "date"),
      c("NoteFa", "text", { len: 600 }),
      req("Status", "text", { len: 20, comment: "issued|in_progress|re_inspected|closed|void" }),
    ],
    indexes: [
      { name: "UX_HseViolation_No", columns: ["ProjectId", "ViolationNo"], unique: true },
      /* پیمایش «کدام فعالیت‌ها قفل‌اند؟» نباید کل جدول را اسکن کند. */
      { name: "IX_HseViolation_Stop", columns: ["ProjectId", "IsStopWork", "Status"] },
      { name: "IX_HseViolation_Activity", columns: ["ProjectId", "ActivityId", "Status"] },
      { name: "IX_HseViolation_Inspection", columns: ["ProjectId", "InspectionId"] },
    ],
  },
  {
    /* آزادسازی توقف کار. جدول جداست تا زنجیرهٔ «چه کسی، کِی، با چه
     * مدرکی آزاد کرد» پاک‌شدنی نباشد؛ اگر ستون روی HSE_Violation بود،
     * آزادسازی دوباره تاریخچهٔ قبلی را بازنویسی می‌کرد. */
    name: "ViolationClosure",
    module: "d16",
    title: { fa: "آزادسازی تخلف", en: "Violation closure" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("ViolationId", "text", { len: 60 }),
      req("AttemptNo", "int"),
      req("ReInspectedAt", "datetime"),
      req("ReInspectedBy", "text", { len: 60 }),
      req("IsSatisfactory", "bool", { default: "0" }),
      c("EvidenceFa", "text", { len: 600 }),
      c("PhotoRef", "text", { len: 300 }),
      /* آزادکننده باید مجوز hse.violation.release داشته باشد و نباید
       * همان صادرکننده یا متخلف باشد. */
      c("ReleasedBy", "text", { len: 60 }),
      c("ReleasedAt", "datetime"),
      c("RejectReasonFa", "text", { len: 600 }),
    ],
    indexes: [
      { name: "UX_ViolationClosure", columns: ["ViolationId", "AttemptNo"], unique: true },
      { name: "IX_ViolationClosure_Violation", columns: ["ProjectId", "ViolationId"] },
    ],
  },

  /* ══════════════ ساختار شکست از قرارداد (d2 × d14) ══════════════
   *
   * پنج جدول زیر یک زنجیره‌اند:
   *   سند قرارداد → بند → قلم BoQ استخراجی → گرهٔ درخت → ستون دلخواه
   *
   * تصمیم بنیادی: **یک درخت، چهار نما.** WBS، CBS، WPA و PMS جدول
   * جداگانه ندارند؛ همه گره‌های `WbsNode` هستند و با ستون `ViewKind`
   * از هم جدا می‌شوند. اگر چهار جدول موازی می‌ساختیم، روز سوم از هم
   * واگرا می‌شدند و هیچ‌کس نمی‌فهمید کدام درست است.
   */
  {
    /* سند قرارداد بارگذاری‌شده — معمولاً PDF.
     *
     * متن استخراج‌شده اینجا نگه داشته می‌شود نه در فایل، چون استخراج
     * گران است و باید یک بار انجام شود. `ExtractStatus` صریح است تا
     * «هنوز استخراج نشده» با «استخراج شد و چیزی پیدا نشد» قاطی نشود —
     * همان درسی که در D8 گرفتیم: صفر ادعاست، null اعتراف.
     */
    name: "CtrDocument",
    module: "d2",
    title: { fa: "سند قرارداد بارگذاری‌شده", en: "Uploaded contract document" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      /* پیوند به ماژول پیمان (d14) اگر قرارداد آنجا ثبت شده باشد. */
      c("ContractId", "text", { len: 60 }),
      req("FileName", "text", { len: 260 }),
      req("MimeType", "text", { len: 120 }),
      req("SizeBytes", "int", { default: "0" }),
      /* چک‌سام محتوا: بارگذاری دوبارهٔ همان فایل نباید سند تازه بسازد. */
      req("ContentHash", "text", { len: 64 }),
      c("StoredPath", "text", { len: 400 }),
      req("PageCount", "int", { default: "0" }),
      /* pending | extracted | empty | failed  — «empty» یعنی PDF اسکن
       * است و متن ندارد؛ آن‌وقت مسیر OCR لازم است. */
      req("ExtractStatus", "text", { len: 16, default: "'pending'" }),
      c("ExtractedText", "text"),
      c("ExtractErrorFa", "text", { len: 400 }),
      req("UploadedBy", "text", { len: 60 }),
      req("UploadedAt", "datetime"),
    ],
    indexes: [
      { name: "IX_CtrDocument_Project", columns: ["ProjectId", "UploadedAt"] },
      { name: "UX_CtrDocument_Hash", columns: ["ProjectId", "ContentHash"], unique: true },
    ],
  },
  {
    /* بند قرارداد — واحد ارجاع.
     *
     * هر چیزی که بعداً استخراج شود باید بگوید از کدام بند آمده. بدون
     * این، شش ماه بعد کسی نمی‌تواند ثابت کند عددی که در صورت‌وضعیت
     * نشسته از قرارداد درآمده است.
     */
    name: "CtrClause",
    module: "d2",
    title: { fa: "بند قرارداد", en: "Contract clause" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("DocumentId", "text", { len: 60 }),
      /* شمارهٔ بند همان‌طور که در متن آمده: «۵-۲-۳» یا «ماده ۷». */
      req("ClauseNo", "text", { len: 60 }),
      c("ParentClauseNo", "text", { len: 60 }),
      req("Depth", "int", { default: "1" }),
      c("TitleFa", "text", { len: 400 }),
      req("BodyText", "text"),
      req("PageNo", "int", { default: "0" }),
      /* جای دقیق در متن استخراجی؛ مبنای برجسته‌سازی در پیش‌نمایش. */
      req("CharStart", "int", { default: "0" }),
      req("CharEnd", "int", { default: "0" }),
      req("Ordinal", "int", { default: "0" }),
    ],
    indexes: [
      { name: "IX_CtrClause_Doc", columns: ["ProjectId", "DocumentId", "Ordinal"] },
      { name: "UX_CtrClause_No", columns: ["DocumentId", "ClauseNo"], unique: true },
    ],
  },
  {
    /* قلم BoQ استخراج‌شده از متن — پیش از تأیید انسانی.
     *
     * این جدول عمداً از `BoqItem` ماژول پیمان جداست. استخراج ماشینی
     * حدس است و حدس نباید مستقیم وارد دفتر مالی شود. پس از تأیید،
     * ردیف به d14 منتقل و `PromotedToBoqId` پر می‌شود.
     *
     * قاعدهٔ سخت: **AI عدد نمی‌سازد.** اگر مقدار یا نرخ در متن نبود،
     * `null` می‌ماند و `Confidence` پایین می‌آید. یک عدد ساختگی در
     * BoQ یعنی صورت‌وضعیت غلط.
     */
    name: "CtrBoqDraft",
    module: "d2",
    title: { fa: "قلم BoQ استخراجی", en: "Extracted BoQ draft line" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("DocumentId", "text", { len: 60 }),
      c("ClauseId", "text", { len: 60 }),
      req("ItemNo", "text", { len: 60 }),
      c("ParentItemNo", "text", { len: 60 }),
      c("ChapterCode", "text", { len: 40 }),
      req("TitleFa", "text", { len: 600 }),
      c("Unit", "text", { len: 40 }),
      /* هر سه می‌توانند null باشند — یعنی «در متن نبود». */
      c("Qty", "decimal", { precision: 18, scale: 4 }),
      c("UnitRate", "decimal", { precision: 18, scale: 2 }),
      c("LumpSumAmount", "decimal", { precision: 18, scale: 2 }),
      /* unit_price | lump_sum */
      req("PricingBasis", "text", { len: 16, default: "'unit_price'" }),
      c("Currency", "text", { len: 8 }),
      /* rule | ai | manual — چه کسی این ردیف را ساخت. */
      req("ExtractedBy", "text", { len: 12, default: "'rule'" }),
      c("ProviderId", "text", { len: 20 }),
      /* ۰ تا ۱۰۰. زیر آستانه باید دست انسان بخورد. */
      req("Confidence", "int", { default: "0" }),
      /* ارجاع خوانا: «ص ۱۴ / بند ۵-۲». مبنای اثبات منشأ. */
      c("SourceRefFa", "text", { len: 200 }),
      req("PageNo", "int", { default: "0" }),
      /* draft | confirmed | rejected */
      req("Status", "text", { len: 16, default: "'draft'" }),
      c("ReviewedBy", "text", { len: 60 }),
      c("ReviewedAt", "datetime"),
      c("PromotedToBoqId", "text", { len: 60 }),
      req("Ordinal", "int", { default: "0" }),
    ],
    indexes: [
      { name: "IX_CtrBoqDraft_Doc", columns: ["ProjectId", "DocumentId", "Ordinal"] },
      { name: "UX_CtrBoqDraft_Item", columns: ["DocumentId", "ItemNo"], unique: true },
      { name: "IX_CtrBoqDraft_Status", columns: ["ProjectId", "Status"] },
    ],
  },
  {
    /* گرهٔ درخت شکست — یک جدول برای هر چهار نما.
     *
     * نام `WbsNode` از قبل برای جدول سادهٔ گره‌های زمان‌بندی گرفته شده
     * است (که `Activity.WbsId` به آن ارجاع می‌دهد). نام `BreakdownNode`
     * هم آزاد است و هم دقیق‌تر، چون این جدول فقط WBS نیست.
     *
     * `ViewKind` تعیین می‌کند این گره در کدام نما دیده شود:
     *   wbs — نمای اجرا (ساختار کار)
     *   cbs — نمای هزینه (از فصول BoQ، نه از AI)
     *   wpa — نمای لامپ‌سام (مبنای صورت‌وضعیت درصدی)
     *   pms — نمای وزنی (WF/WV، یکی از صفحات گزارش روزانه)
     *
     * وزن‌ها: `WeightFactor` (WF) وزن نسبی گره میان هم‌نیاکانش، و
     * `WeightValue` (WV) وزن مطلق در کل پروژه. جمع WF هر سطح باید
     * ۱۰۰ شود؛ اگر نشود درصد پیشرفت کل پروژه دروغ می‌گوید. این گیت
     * سخت است نه هشدار نرم.
     */
    name: "BreakdownNode",
    module: "d2",
    title: { fa: "گرهٔ ساختار شکست", en: "Breakdown structure node" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      c("DocumentId", "text", { len: 60 }),
      /* wbs | cbs | wpa | pms */
      req("ViewKind", "text", { len: 8, default: "'wbs'" }),
      req("Code", "text", { len: 80 }),
      c("ParentCode", "text", { len: 80 }),
      req("Depth", "int", { default: "1" }),
      req("TitleFa", "text", { len: 600 }),
      c("TitleEn", "text", { len: 600 }),
      c("Unit", "text", { len: 40 }),
      c("Qty", "decimal", { precision: 18, scale: 4 }),
      c("Amount", "decimal", { precision: 18, scale: 2 }),
      /* WF و WV — هر دو درصد. */
      c("WeightFactor", "decimal", { precision: 9, scale: 4 }),
      c("WeightValue", "decimal", { precision: 9, scale: 4 }),
      /* نگاشت قطعی به حساب هزینه؛ برای نمای CBS. از فصل BoQ می‌آید
       * نه از AI، چون کدهای هزینه در قرارداد قطعی‌اند. */
      c("CostAccountCode", "text", { len: 60 }),
      c("BoqDraftId", "text", { len: 60 }),
      c("ClauseId", "text", { len: 60 }),
      c("SourceRefFa", "text", { len: 200 }),
      /* rule | ai | manual */
      req("GeneratedBy", "text", { len: 12, default: "'rule'" }),
      c("ProviderId", "text", { len: 20 }),
      req("Confidence", "int", { default: "0" }),
      /* draft | approved — فقط approved به Baseline می‌رود. */
      req("Status", "text", { len: 16, default: "'draft'" }),
      c("ApprovedBy", "text", { len: 60 }),
      c("ApprovedAt", "datetime"),
      req("Ordinal", "int", { default: "0" }),
    ],
    indexes: [
      { name: "IX_BreakdownNode_View", columns: ["ProjectId", "ViewKind", "Ordinal"] },
      { name: "UX_BreakdownNode_Code", columns: ["ProjectId", "ViewKind", "Code"], unique: true },
      { name: "IX_BreakdownNode_Parent", columns: ["ProjectId", "ViewKind", "ParentCode"] },
    ],
  },
  {
    /* ستون دلخواه نمای PMS.
     *
     * کاربر گفت PMS ستون‌های ثابت دارد به‌علاوهٔ «یکسری ستون دیگر که
     * بر اساس نیاز اضافه می‌کند». آن ستون‌ها اینجا تعریف و مقدارشان
     * در `BreakdownValue` نگه داشته می‌شود — نه به‌صورت JSON در خود گره،
     * چون آن‌وقت نه قابل جست‌وجوست و نه قابل جمع زدن.
     */
    name: "BreakdownColumnDef",
    module: "d2",
    title: { fa: "ستون دلخواه ساختار شکست", en: "Custom breakdown column" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("ViewKind", "text", { len: 8, default: "'pms'" }),
      req("ColumnKey", "text", { len: 60 }),
      req("TitleFa", "text", { len: 200 }),
      c("TitleEn", "text", { len: 200 }),
      /* text | number | percent | date */
      req("DataKind", "text", { len: 12, default: "'text'" }),
      c("Unit", "text", { len: 40 }),
      /* آیا در تجمیع والد جمع زده شود. */
      req("RollsUp", "bool", { default: "0" }),
      req("Ordinal", "int", { default: "0" }),
      req("IsActive", "bool", { default: "1" }),
    ],
    indexes: [
      { name: "UX_BreakdownColumnDef", columns: ["ProjectId", "ViewKind", "ColumnKey"], unique: true },
      { name: "IX_BreakdownColumnDef_View", columns: ["ProjectId", "ViewKind", "Ordinal"] },
    ],
  },
  {
    /* مقدار ستون دلخواه روی یک گره. */
    name: "BreakdownValue",
    module: "d2",
    title: { fa: "مقدار ستون دلخواه", en: "Custom column value" },
    pk: "Id",
    columns: [
      id(),
      req("ProjectId", "text", { len: 60 }),
      req("NodeId", "text", { len: 60 }),
      req("ColumnKey", "text", { len: 60 }),
      c("ValueText", "text", { len: 600 }),
      c("ValueNumber", "decimal", { precision: 18, scale: 4 }),
    ],
    indexes: [
      { name: "UX_BreakdownValue", columns: ["NodeId", "ColumnKey"], unique: true },
      { name: "IX_BreakdownValue_Project", columns: ["ProjectId", "ColumnKey"] },
    ],
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

/**
 * DDL افزودن ستون به جدول موجود، ایدمپوتنت.
 * تعریف ستون از همان `SCHEMA` خوانده می‌شود تا مهاجرت و اسکیما هرگز واگرا نشوند —
 * اگر ستون در SCHEMA نباشد، خطا در زمان ساخت باندل رخ می‌دهد نه روی پایگاه داده.
 */
export function addColumnDdl(tableName: string, columnName: string, dialect: SqlDialect = "mssql"): string {
  const t = TABLE_BY_NAME.get(tableName);
  if (!t) throw new Error(`addColumnDdl: جدول ${tableName} در اسکیما نیست`);
  const col = allColumns(t).find((c) => c.name === columnName);
  if (!col) throw new Error(`addColumnDdl: ستون ${tableName}.${columnName} در اسکیما نیست`);
  if (col.nullable === false) throw new Error(`addColumnDdl: ستون ${tableName}.${columnName} باید nullable باشد تا روی دادهٔ موجود نشکند`);

  const body = `ALTER TABLE ${qualifiedName(t.name, dialect)} ADD ${columnDdl(col, dialect)};`;
  if (dialect !== "mssql") return body;
  return (
    `IF COL_LENGTH('dbo.${assertIdentifier(t.name)}', '${assertIdentifier(col.name)}') IS NULL\n` +
    `  ${body}`
  );
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
  {
    version: "0005",
    name: "equipment_fleet",
    statements: ["Equipment", "EquipmentMeter", "EquipmentRental", "MaintenanceOrder"].flatMap((n) => {
      const t = TABLE_BY_NAME.get(n)!;
      return [tableDdl(t, "mssql"), ...(t.indexes ?? []).map((i) => indexDdl(t, i, "mssql"))];
    }),
  },
  {
    version: "0006",
    name: "equipment_dispatch_cmms",
    statements: ["EquipmentDispatch", "EquipmentFuelLog", "PmSchedule", "SparePart", "PartTransaction"].flatMap((n) => {
      const t = TABLE_BY_NAME.get(n)!;
      return [tableDdl(t, "mssql"), ...(t.indexes ?? []).map((i) => indexDdl(t, i, "mssql"))];
    }),
  },
  {
    /* نخستین مهاجرت افزایشی: جدول تازه نمی‌سازد، ستون به جدول‌های موجود
     * می‌افزاید. هر ستون nullable است تا روی دادهٔ تولیدی موجود نشکند. */
    version: "0007",
    name: "equipment_cross_module_links",
    statements: [
      addColumnDdl("WorkforceMember", "LicenseType", "mssql"),
      addColumnDdl("WorkforceMember", "LicenseExpiry", "mssql"),
      addColumnDdl("MaintenanceOrder", "RootCause", "mssql"),
      addColumnDdl("Activity", "BlockedByEquipmentId", "mssql"),
      "CREATE INDEX [IX_Activity_BlockedByEquipment] ON [dbo].[Activity] ([BlockedByEquipmentId]);",
      ...["EquipmentCostPosting"].flatMap((n) => {
        const t = TABLE_BY_NAME.get(n)!;
        return [tableDdl(t, "mssql"), ...(t.indexes ?? []).map((i) => indexDdl(t, i, "mssql"))];
      }),
    ],
  },
  {
    /* ماژول مهندسی و طراحی (d12): هشت جدول تازه و یک ستون پیوند به PEX.
     * ستون Activity.BlockedByDocumentId آینهٔ الگوی BlockedByEquipmentId است
     * (ADR-ENG-04) و nullable می‌ماند تا روی دادهٔ موجود نشکند. */
    version: "0008",
    name: "engineering_design_module",
    statements: [
      addColumnDdl("Activity", "BlockedByDocumentId", "mssql"),
      "CREATE INDEX [IX_Activity_BlockedByDocument] ON [dbo].[Activity] ([BlockedByDocumentId]);",
      ...[
        "MdrDeliverable",
        "EngineeringRevision",
        "CrsComment",
        "SquadCheck",
        "InterfaceClashLog",
        "TechnicalQuery",
        "VendorPrintReview",
        "EngineeringProgressSnapshot",
      ].flatMap((n) => {
        const t = TABLE_BY_NAME.get(n)!;
        return [tableDdl(t, "mssql"), ...(t.indexes ?? []).map((i) => indexDdl(t, i, "mssql"))];
      }),
    ],
  },
  {
    version: "0009",
    name: "procurement_cycle_mr_pr_po",
    statements: [
      ...[
        "MaterialRequest",
        "PurchaseRequisition",
        "PurchaseOrder",
      ].flatMap((n) => {
        const t = TABLE_BY_NAME.get(n)!;
        return [tableDdl(t, "mssql"), ...(t.indexes ?? []).map((i) => indexDdl(t, i, "mssql"))];
      }),
    ],
  },
  {
    version: "0010",
    name: "contracts_boq_ipc_adjustment",
    statements: [
      ...[
        "ContractMaster",
        "ContractAmendment",
        "ApprovalAuthority",
        "ContractBOQ_Item",
        "LumpSumMilestone",
        "BOQ_QuantityChange",
        "ExtraWorkItem",
        "MeasurementSheet",
        "InterimPaymentCertificate",
        "IPC_LineItem",
        "IPC_WorkflowStep",
        "IPC_Deduction",
        "AdjustmentIndexCatalog",
        "PriceAdjustmentCalculation",
        "MaterialDiffCalc",
        "ContractGuarantee",
        "AdvancePaymentSchedule",
        "RetainageLedger",
        "SubcontractorIPC",
        "SubcontractorIPC_LineItem",
        "BackToBackDeduction",
        "ContractMetricsSnapshot",
        "ContractAlertRule",
      ].flatMap((n) => {
        const t = TABLE_BY_NAME.get(n)!;
        return [tableDdl(t, "mssql"), ...(t.indexes ?? []).map((i) => indexDdl(t, i, "mssql"))];
      }),
    ],
  },
  {
    /* دروازهٔ کیفی ماژول پیمان باید بپرسد «آیا عدم انطباق بازی روی این
     * فعالیت هست؟» ولی جدول عدم انطباق ستون فعالیت نداشت، پس پرسش بی‌پاسخ
     * می‌ماند و دروازه نیمه‌کور بود. ستون nullable است تا هیچ رکورد موجودی
     * نشکند، و ایندکس همراهش می‌آید چون این پیمایش در هر ثبت ریزمتره اجرا
     * می‌شود. */
    version: "0011",
    name: "ncr_activity_link",
    statements: [
      addColumnDdl("Ncr", "ActivityId", "mssql"),
      indexDdl(TABLE_BY_NAME.get("Ncr")!, TABLE_BY_NAME.get("Ncr")!.indexes!.find((i) => i.name === "IX_Ncr_Activity")!, "mssql"),
    ],
  },
  {
    version: "0012",
    name: "completion_certificates",
    statements: [
      ...["CompletionCertificate", "PunchListItem"].flatMap((n) => {
        const t = TABLE_BY_NAME.get(n)!;
        return [tableDdl(t, "mssql"), ...(t.indexes ?? []).map((i) => indexDdl(t, i, "mssql"))];
      }),
    ],
  },
  {
    /**
     * MOD-13 · تفکیک سیستمی (D3).
     *
     * صفر تغییر مخرب: هیچ ستونی حذف یا تغییرنام نمی‌شود، هر سه ستون افزوده‌شده
     * nullable هستند و مقادیر موجود pac و fac در CertificateType معتبر می‌مانند
     * چون فقط دامنهٔ مقدار گسترش یافته و نوع ستون همان text(10) است.
     */
    version: "0013",
    name: "systemization",
    statements: [
      ...["SystemSubsystem", "SystemBoundaryMapping", "SystemMilestoneTarget"].flatMap((n) => {
        const t = TABLE_BY_NAME.get(n)!;
        return [tableDdl(t, "mssql"), ...(t.indexes ?? []).map((i) => indexDdl(t, i, "mssql"))];
      }),
      addColumnDdl("CompletionCertificate", "SystemId", "mssql"),
      addColumnDdl("CompletionCertificate", "ReadyForGateAt", "mssql"),
      addColumnDdl("PunchListItem", "SystemId", "mssql"),
      indexDdl(
        TABLE_BY_NAME.get("PunchListItem")!,
        { name: "IX_PunchListItem_Gate", columns: ["ProjectId", "SystemId", "Category", "Status"] },
        "mssql",
      ),
    ],
  },
  {
    /**
     * MOD-13 · بستهٔ آزمون و برگه‌های سرد و گرم (D4).
     *
     * فقط جدول جدید؛ هیچ جدول یا ستون موجودی دست نمی‌خورد.
     */
    version: "0014",
    name: "check_records",
    statements: [
      ...["CheckRecordPack", "CheckSheet", "CheckSheetLine"].flatMap((n) => {
        const t = TABLE_BY_NAME.get(n)!;
        return [tableDdl(t, "mssql"), ...(t.indexes ?? []).map((i) => indexDdl(t, i, "mssql"))];
      }),
    ],
  },
  {
    /**
     * ۰۰۱۵ — بهداشت، ایمنی و محیط زیست: پروانهٔ کار، رویداد، بازرسی و آموزش.
     *
     * پروانهٔ کار پیش‌نیاز دروازهٔ RFSU ماژول راه‌اندازی است؛ پیش از این
     * جدول، آن پیش‌نیاز فقط رشتهٔ آزاد بود و قابل کنترل نبود.
     *
     * فقط جدول جدید؛ هیچ جدول یا ستون موجودی دست نمی‌خورد.
     */
    version: "0015",
    name: "hse_permits_incidents",
    statements: [
      ...["WorkPermit", "SafetyIncident", "SafetyInspection", "SafetyTrainingRecord"].flatMap((n) => {
        const t = TABLE_BY_NAME.get(n)!;
        return [tableDdl(t, "mssql"), ...(t.indexes ?? []).map((i) => indexDdl(t, i, "mssql"))];
      }),
    ],
  },
  {
    /**
     * ۰۰۱۶ — ارزیابی ریسک شغلی (JSA) و سلسله‌مراتب کنترل خطر.
     *
     * پیش‌نیاز صدور پروانهٔ کار طبق ISO 45001 بند ۸٫۱٫۲؛ پیش از این،
     * شرط «JSA مصوب» روی پروانه قابل سنجش نبود.
     *
     * فقط جدول جدید؛ هیچ جدول یا ستون موجودی دست نمی‌خورد.
     */
    version: "0016",
    name: "hse_jsa_risk",
    statements: [
      ...["HSE_RiskAssessment", "JSA_JobStep", "JSA_Hazard", "JSA_Control"].flatMap((n) => {
        const t = TABLE_BY_NAME.get(n)!;
        return [tableDdl(t, "mssql"), ...(t.indexes ?? []).map((i) => indexDdl(t, i, "mssql"))];
      }),
    ],
  },
  {
    /* سامانهٔ پروانهٔ کار: چهار جدول تازه و شش ستون به WorkPermit موجود.
     * ستون‌های افزوده همه nullable‌اند تا روی دادهٔ تولیدی نشکنند، و
     * هیچ ستونی حذف یا تغییر نوع نمی‌دهد — از جمله GasTestResultFa که
     * با وجود جایگزینی با GasTestLog برای دادهٔ تاریخی می‌ماند.
     * ترتیب اجباری: پس از 0016، چون WorkPermit.JsaId به HSE_RiskAssessment
     * ارجاع می‌دهد. */
    version: "0017",
    name: "hse_ptw_engine",
    statements: [
      addColumnDdl("WorkPermit", "JsaId", "mssql"),
      addColumnDdl("WorkPermit", "QrToken", "mssql"),
      addColumnDdl("WorkPermit", "SuspendedAt", "mssql"),
      addColumnDdl("WorkPermit", "SuspendedBy", "mssql"),
      addColumnDdl("WorkPermit", "SuspendReasonFa", "mssql"),
      addColumnDdl("WorkPermit", "ParentPermitId", "mssql"),
      ...["UX_WorkPermit_Qr", "IX_WorkPermit_Jsa"].map((ix) => {
        const t = TABLE_BY_NAME.get("WorkPermit")!;
        return indexDdl(t, t.indexes!.find((i) => i.name === ix)!, "mssql");
      }),
      ...["GasTestLog", "IsolationLog", "PTW_Approval", "PTW_Precaution"].flatMap((n) => {
        const t = TABLE_BY_NAME.get(n)!;
        return [tableDdl(t, "mssql"), ...(t.indexes ?? []).map((i) => indexDdl(t, i, "mssql"))];
      }),
    ],
  },
  {
    /* حوادث، تحقیق و اقدام اصلاحی: پنج جدول تازه و پنج ستون به
     * SafetyIncident موجود. ستون متنی InjuredPersonFa حذف نمی‌شود —
     * دادهٔ تاریخی روی آن است و خودکار به InjuredPerson تبدیل نمی‌شود.
     * ترتیب اجباری: پس از 0017، چون SafetyIncident.PermitId به
     * WorkPermit ارجاع می‌دهد. */
    version: "0018",
    name: "hse_incident_capa",
    statements: [
      addColumnDdl("SafetyIncident", "PermitId", "mssql"),
      addColumnDdl("SafetyIncident", "FlashReportAt", "mssql"),
      addColumnDdl("SafetyIncident", "IsEmergencyActivated", "mssql"),
      addColumnDdl("SafetyIncident", "GpsLat", "mssql"),
      addColumnDdl("SafetyIncident", "GpsLng", "mssql"),
      ...["IX_SafetyIncident_Permit"].map((ix) => {
        const t = TABLE_BY_NAME.get("SafetyIncident")!;
        return indexDdl(t, t.indexes!.find((i) => i.name === ix)!, "mssql");
      }),
      ...["InjuredPerson", "HSE_Investigation", "RootCauseNode", "CapaAction", "HSE_ManHourLog"].flatMap((n) => {
        const t = TABLE_BY_NAME.get(n)!;
        return [tableDdl(t, "mssql"), ...(t.indexes ?? []).map((i) => indexDdl(t, i, "mssql"))];
      }),
    ],
  },
  {
    /* بازرسی، تخلف و توقف کار. یک ستون به Activity و سه جدول تازه.
     * ستون Activity.IsStopWorkOrder با پیش‌فرض 0 افزوده می‌شود تا
     * ردیف‌های موجود بی‌صدا قفل نشوند. */
    version: "0019",
    name: "hse_violation_swo",
    statements: [
      addColumnDdl("Activity", "IsStopWorkOrder", "mssql"),
      ...["InspectionFinding", "HSE_Violation", "ViolationClosure"].flatMap((n) => {
        const t = TABLE_BY_NAME.get(n)!;
        return [tableDdl(t, "mssql"), ...(t.indexes ?? []).map((i) => indexDdl(t, i, "mssql"))];
      }),
    ],
  },
  {
    /* آموزش، بهداشت و محیط‌زیست. هفت جدول تازه؛ SafetyTrainingRecord
     * از مهاجرت‌های قبلی موجود است و دست نمی‌خورد. */
    version: "0020",
    name: "hse_training_health_env",
    statements: [
      ...[
        "TrainingSession", "TrainingAttendee", "PpeIssuance",
        "OccupationalHazard", "HealthExamination",
        "WasteLog", "EnvironmentalMonitoring",
      ].flatMap((n) => {
        const t = TABLE_BY_NAME.get(n)!;
        return [tableDdl(t, "mssql"), ...(t.indexes ?? []).map((i) => indexDdl(t, i, "mssql"))];
      }),
    ],
  },
  {
    version: "0021",
    name: "hse_metrics_alerts",
    statements: [
      ...["HSE_MetricSnapshot", "HSE_AlertRule"].flatMap((n) => {
        const t = TABLE_BY_NAME.get(n)!;
        return [tableDdl(t, "mssql"), ...(t.indexes ?? []).map((i) => indexDdl(t, i, "mssql"))];
      }),
    ],
  },
  {
    /* G-03 — پل CNT→FIN.
     *
     * ستون `CostAccountCode` روی پیمان nullable است، پس پیمان‌های
     * موجود نمی‌شکنند؛ ولی تا وقتی پر نشود ارسال به مالی برای آن پیمان
     * رد می‌شود. این عمدی است: حدس‌زدن حساب هزینه بدتر از نفرستادن است. */
    version: "0022",
    name: "cnt_fin_bridge",
    statements: [
      ...["ContractFinPosting"].flatMap((n) => {
        const t = TABLE_BY_NAME.get(n)!;
        return [tableDdl(t, "mssql"), ...(t.indexes ?? []).map((i) => indexDdl(t, i, "mssql"))];
      }),
      "ALTER TABLE ContractMaster ADD CostAccountCode NVARCHAR(40) NULL;",
    ],
  },
  {
    version: "0023",
    name: "hrm_timesheet_core",
    statements: [
      ...["HrmTimesheetHeader", "HrmTimesheetEntry", "HrmPeriodLock", "HrmSyncConflict", "HrmAdjustment"].flatMap((n) => {
        const t = TABLE_BY_NAME.get(n)!;
        return [tableDdl(t, "mssql"), ...(t.indexes ?? []).map((i) => indexDdl(t, i, "mssql"))];
      }),
    ],
  },
  {
    version: "0024",
    name: "hrm_productivity",
    statements: [
      ...["HrmProductivityLog", "HrmRcaReason", "HrmRcaEntry", "HrmMetricSnapshot"].flatMap((n) => {
        const t = TABLE_BY_NAME.get(n)!;
        return [tableDdl(t, "mssql"), ...(t.indexes ?? []).map((i) => indexDdl(t, i, "mssql"))];
      }),
      /* بودجهٔ نفر-ساعت روی جدول موجود فعالیت — nullable تا دادهٔ
       * تاریخی دست نخورد و مهاجرت روی پایگاه پر هم اجرا شود. */
      "ALTER TABLE Activity ADD BudgetMh DECIMAL(14,2) NULL;",
    ],
  },
  {
    version: "0025",
    name: "hrm_crew_subcontract",
    statements: [
      ...["HrmCrew", "HrmCrewMember", "HrmSubContract", "HrmSubAttendance", "HrmSubIpc"].flatMap((n) => {
        const t = TABLE_BY_NAME.get(n)!;
        return [tableDdl(t, "mssql"), ...(t.indexes ?? []).map((i) => indexDdl(t, i, "mssql"))];
      }),
    ],
  },
  {
    version: "0026",
    name: "hrm_person_onboarding",
    statements: [
      ...["HrmPerson", "HrmPersonDoc", "HrmSkill", "HrmMobRequest", "HrmDemobCheck"].flatMap((n) => {
        const t = TABLE_BY_NAME.get(n)!;
        return [tableDdl(t, "mssql"), ...(t.indexes ?? []).map((i) => indexDdl(t, i, "mssql"))];
      }),
    ],
  },
  {
    version: "0027",
    name: "hrm_manpower_plan",
    statements: [
      ...["HrmManpowerPlan"].flatMap((n) => {
        const t = TABLE_BY_NAME.get(n)!;
        return [tableDdl(t, "mssql"), ...(t.indexes ?? []).map((i) => indexDdl(t, i, "mssql"))];
      }),
    ],
  },
  {
    version: "0028",
    name: "hrm_sync_batch",
    statements: [
      ...["HrmSyncBatch"].flatMap((n) => {
        const t = TABLE_BY_NAME.get(n)!;
        return [tableDdl(t, "mssql"), ...(t.indexes ?? []).map((i) => indexDdl(t, i, "mssql"))];
      }),
    ],
  },
  {
    version: "0029",
    name: "hrm_conflict_adjustment_flag",
    statements: [
      /* ستون‌ها با NULL افزوده و سپس مقداردهی می‌شوند تا مهاجرت روی
       * پایگاه پر هم اجرا شود و ردیف تاریخی از دست نرود. */
      "ALTER TABLE HrmSyncConflict ADD RequiresAdjustment BIT NULL;",
      "ALTER TABLE HrmSyncConflict ADD BlockReasonFa NVARCHAR(300) NULL;",
      /* ردیف‌های تاریخی: تنها منبع موجود همان متن است، پس یک بار —
       * و فقط یک بار، در زمان مهاجرت — از آن خوانده می‌شود. */
      "UPDATE HrmSyncConflict SET RequiresAdjustment = CASE WHEN DiffSummaryFa LIKE N'%سند اصلاحی%' THEN 1 ELSE 0 END WHERE RequiresAdjustment IS NULL;",
    ],
  },
  {
    version: "0030",
    name: "hrm_cost_posting",
    statements: [
      ...["HrmRateCard", "HrmCostPosting"].flatMap((n) => {
        const t = TABLE_BY_NAME.get(n)!;
        return [tableDdl(t, "mssql"), ...(t.indexes ?? []).map((i) => indexDdl(t, i, "mssql"))];
      }),
    ],
  },
  {
    version: "0031",
    name: "integration_event_outbox",
    statements: [
      ...["IntegrationEvent"].flatMap((n) => {
        const t = TABLE_BY_NAME.get(n)!;
        return [tableDdl(t, "mssql"), ...(t.indexes ?? []).map((i) => indexDdl(t, i, "mssql"))];
      }),
    ],
  },
  {
    /* ساختار شکست از قرارداد: سند → بند → BoQ پیش‌نویس → گره → ستون. */
    version: "0032",
    name: "contract_breakdown_structure",
    statements: [
      ...["CtrDocument", "CtrClause", "CtrBoqDraft", "BreakdownNode", "BreakdownColumnDef", "BreakdownValue"].flatMap((n) => {
        const t = TABLE_BY_NAME.get(n)!;
        return [tableDdl(t, "mssql"), ...(t.indexes ?? []).map((i) => indexDdl(t, i, "mssql"))];
      }),
    ],
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
