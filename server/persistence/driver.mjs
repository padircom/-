/**
 * Arena Platform — Persistence drivers (sql-v1)
 * ---------------------------------------------------------------------------
 * دو درایور با یک قرارداد مشترک:
 *
 *   • MssqlDriver     — تولید: کوئری پارامتری ساخته‌شده در persistence.ts را اجرا می‌کند.
 *   • JsonFileDriver  — توسعه/سندباکس: همان معنا را روی فایل JSON پیاده می‌کند.
 *
 * چرا درایور فایلی؟ در این محیط SQL Server در دسترس نیست. بدون آن، شکاف PEX-G2
 * («POST progress ذخیره نمی‌شود») روی کاغذ بسته می‌شد ولی در عمل نه. با این درایور
 * ماندگاری همین حالا واقعی است و سوییچ به SQL فقط یک متغیر محیطی است.
 *
 * هر دو درایور از همان اعتبارسنجی، نگاشت نوع و معنای WHERE در persistence.ts
 * استفاده می‌کنند، پس رفتارشان واگرا نمی‌شود.
 */

import fs from "node:fs";
import path from "node:path";
import {
  allColumns,
  applySelect,
  buildCount,
  buildDelete,
  buildInsert,
  buildSelect,
  buildUpdate,
  concurrencyResult,
  mapFromStorage,
  mapToStorage,
  matchesWhere,
  newId,
  tableDef,
  validateRow,
} from "../sqlLogic.js";

export class ValidationError extends Error {
  constructor(issues) {
    super(`ROW_VALIDATION_FAILED: ${issues.map((i) => i.message).join(" · ")}`);
    this.name = "ValidationError";
    this.code = "ROW_VALIDATION_FAILED";
    this.issues = issues;
  }
}

function must(tableName) {
  const t = tableDef(tableName);
  if (!t) throw new Error(`UNKNOWN_TABLE: ${tableName}`);
  return t;
}

/* ═══════════════════════ درایور فایلی ═══════════════════════ */

export class JsonFileDriver {
  constructor(rootDir) {
    this.kind = "json";
    this.root = rootDir;
    this.cache = new Map();
    fs.mkdirSync(this.root, { recursive: true });
  }

  #file(table) {
    return path.join(this.root, `${table}.json`);
  }

  #load(table) {
    if (this.cache.has(table)) return this.cache.get(table);
    let rows = [];
    try {
      rows = JSON.parse(fs.readFileSync(this.#file(table), "utf8"));
      if (!Array.isArray(rows)) rows = [];
    } catch {
      rows = [];
    }
    this.cache.set(table, rows);
    return rows;
  }

  /** نوشتن اتمی: اول فایل موقت، بعد rename — تا قطع برق فایل را نصفه نگذارد. */
  #save(table, rows) {
    this.cache.set(table, rows);
    const target = this.#file(table);
    const tmp = `${target}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(rows, null, 2), "utf8");
    fs.renameSync(tmp, target);
  }

  async ping() {
    return { ok: true, driver: "json", root: this.root };
  }

  async select(tableName, spec = {}) {
    const t = must(tableName);
    return applySelect(this.#load(tableName), spec).map((r) => mapFromStorage(t, r));
  }

  async count(tableName, where = []) {
    return this.#load(tableName).filter((r) => matchesWhere(r, where)).length;
  }

  async insert(tableName, row) {
    const t = must(tableName);
    const issues = validateRow(t, row, "insert");
    if (issues.length) throw new ValidationError(issues);
    const rows = this.#load(tableName);
    const pkVal = row[t.pk];
    if (rows.some((r) => r[t.pk] === pkVal)) {
      const e = new Error(`DUPLICATE_KEY: ${tableName}.${t.pk}=${pkVal}`);
      e.code = "DUPLICATE_KEY";
      throw e;
    }
    for (const idx of t.indexes ?? []) {
      if (!idx.unique) continue;
      const clash = rows.some((r) => idx.columns.every((cn) => r[cn] === mapToStorage(t, row)[cn]));
      if (clash) {
        const e = new Error(`UNIQUE_VIOLATION: ${idx.name}`);
        e.code = "UNIQUE_VIOLATION";
        throw e;
      }
    }
    const stored = mapToStorage(t, row);
    this.#save(tableName, [...rows, stored]);
    return mapFromStorage(t, stored);
  }

  async update(tableName, patch, where, opts = {}) {
    const t = must(tableName);
    const issues = validateRow(t, patch, "update");
    if (issues.length) throw new ValidationError(issues);
    const rows = this.#load(tableName);
    const targets = rows.filter((r) => matchesWhere(r, where));
    if (targets.length === 0) return { affected: 0, ...concurrencyResult(0, false) };

    const stored = mapToStorage(t, patch);
    let affected = 0;
    const next = rows.map((r) => {
      if (!matchesWhere(r, where)) return r;
      if (opts.expectedRowVersion !== undefined && r.RowVersion !== opts.expectedRowVersion) return r;
      affected++;
      return {
        ...r,
        ...stored,
        UpdatedAt: new Date().toISOString(),
        UpdatedBy: opts.updatedBy ?? r.UpdatedBy ?? null,
        RowVersion: (r.RowVersion ?? 1) + 1,
      };
    });
    if (affected) this.#save(tableName, next);
    return { affected, ...concurrencyResult(affected, true) };
  }

  async remove(tableName, where) {
    const rows = this.#load(tableName);
    const next = rows.filter((r) => !matchesWhere(r, where));
    const affected = rows.length - next.length;
    if (affected) this.#save(tableName, next);
    return { affected };
  }

  async reset(tableName) {
    this.#save(tableName, []);
  }
}

/* ═══════════════════════ درایور SQL Server ═══════════════════════ */

export class MssqlDriver {
  /** @param pool یک ConnectionPool آماده از بستهٔ mssql */
  constructor(pool, sqlModule) {
    this.kind = "mssql";
    this.pool = pool;
    this.sql = sqlModule;
  }

  async #run({ sql, params }) {
    const request = this.pool.request();
    params.forEach((v, i) => request.input(`p${i}`, v));
    return request.query(sql);
  }

  async ping() {
    const r = await this.pool.request().query("SELECT DB_NAME() AS [database]");
    return { ok: true, driver: "mssql", database: r.recordset?.[0]?.database };
  }

  async select(tableName, spec = {}) {
    const t = must(tableName);
    const r = await this.#run(buildSelect(t, spec, "mssql"));
    return (r.recordset ?? []).map((row) => mapFromStorage(t, row));
  }

  async count(tableName, where = []) {
    const t = must(tableName);
    const r = await this.#run(buildCount(t, where, "mssql"));
    return r.recordset?.[0]?.Total ?? 0;
  }

  async insert(tableName, row) {
    const t = must(tableName);
    const issues = validateRow(t, row, "insert");
    if (issues.length) throw new ValidationError(issues);
    await this.#run(buildInsert(t, row, "mssql"));
    return row;
  }

  async update(tableName, patch, where, opts = {}) {
    const t = must(tableName);
    const issues = validateRow(t, patch, "update");
    if (issues.length) throw new ValidationError(issues);
    const existed = (await this.count(tableName, where)) > 0;
    const r = await this.#run(buildUpdate(t, patch, where, "mssql", opts));
    const affected = r.rowsAffected?.[0] ?? 0;
    return { affected, ...concurrencyResult(affected, existed) };
  }

  async remove(tableName, where) {
    const t = must(tableName);
    const r = await this.#run(buildDelete(t, where, "mssql"));
    return { affected: r.rowsAffected?.[0] ?? 0 };
  }
}

/* ═══════════════════════ مخزن ═══════════════════════ */

/**
 * لایهٔ نازک بالای درایور: تولید شناسه، ستون‌های حسابرسی و کمک‌متدهای پرکاربرد.
 * منطق دامنه اینجا نمی‌آید — این فقط ماندگاری است.
 */
export function createRepository(driver) {
  return {
    driver,
    ping: () => driver.ping(),

    async create(tableName, data, userId = "system", idPrefix) {
      const t = must(tableName);
      const at = new Date().toISOString();
      const row = {
        ...data,
        [t.pk]: data[t.pk] ?? newId(idPrefix ?? tableName.toLowerCase()),
        CreatedAt: at,
        CreatedBy: userId,
        RowVersion: 1,
      };
      return driver.insert(tableName, row);
    },

    async list(tableName, spec = {}) {
      return driver.select(tableName, spec);
    },

    async get(tableName, idValue) {
      const t = must(tableName);
      const rows = await driver.select(tableName, { where: [{ column: t.pk, op: "eq", value: idValue }], limit: 1 });
      return rows[0] ?? null;
    },

    async findOne(tableName, where) {
      const rows = await driver.select(tableName, { where, limit: 1 });
      return rows[0] ?? null;
    },

    async patch(tableName, idValue, data, userId = "system", expectedRowVersion) {
      const t = must(tableName);
      return driver.update(tableName, data, [{ column: t.pk, op: "eq", value: idValue }], { updatedBy: userId, expectedRowVersion });
    },

    async remove(tableName, idValue) {
      const t = must(tableName);
      return driver.remove(tableName, [{ column: t.pk, op: "eq", value: idValue }]);
    },

    count: (tableName, where = []) => driver.count(tableName, where),

    /** درج یا به‌روزرسانی بر پایهٔ کلیدهای طبیعی. */
    async upsert(tableName, naturalKey, data, userId = "system") {
      const where = Object.entries(naturalKey).map(([column, value]) => ({ column, op: "eq", value }));
      const existing = await this.findOne(tableName, where);
      if (!existing) return { action: "insert", row: await this.create(tableName, { ...naturalKey, ...data }, userId) };
      const t = must(tableName);
      const res = await driver.update(tableName, data, where, { updatedBy: userId });
      return { action: "update", row: await this.get(tableName, existing[t.pk]), result: res };
    },

    /** ستون‌های قابل نوشتن یک جدول — برای فیلتر کردن ورودی HTTP. */
    writableColumns(tableName) {
      const t = must(tableName);
      const audit = new Set(["CreatedAt", "CreatedBy", "UpdatedAt", "UpdatedBy", "RowVersion"]);
      return allColumns(t)
        .map((col) => col.name)
        .filter((n) => !audit.has(n));
    },

    /** فقط ستون‌های شناخته‌شده و قابل نوشتن را از بدنهٔ درخواست برمی‌دارد. */
    pickWritable(tableName, body) {
      const allowed = new Set(this.writableColumns(tableName));
      const out = {};
      for (const [k, v] of Object.entries(body ?? {})) if (allowed.has(k)) out[k] = v;
      return out;
    },
  };
}

/* ═══════════════════════ انتخاب درایور ═══════════════════════ */

/**
 * اگر اتصال SQL Server برقرار شود از آن استفاده می‌کند، وگرنه به فایل برمی‌گردد.
 * تنزل آرام است تا نبود پایگاه داده کل API را از کار نیندازد.
 */
export async function createPersistence({ getPool, sqlModule, dataDir, preferSql = true, logger = console } = {}) {
  if (preferSql && typeof getPool === "function") {
    try {
      const pool = await getPool();
      if (pool) {
        const driver = new MssqlDriver(pool, sqlModule);
        await driver.ping();
        logger.info?.("[persistence] SQL Server driver active");
        return { repo: createRepository(driver), driver };
      }
    } catch (err) {
      logger.warn?.(`[persistence] SQL Server unavailable (${err.message}) — falling back to JSON file store`);
    }
  }
  const driver = new JsonFileDriver(dataDir ?? path.resolve(process.cwd(), "server/data"));
  logger.info?.(`[persistence] JSON file driver active at ${driver.root}`);
  return { repo: createRepository(driver), driver };
}
