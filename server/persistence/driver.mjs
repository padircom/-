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
import crypto from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
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

const transactionContext = new AsyncLocalStorage();

function persistenceError(code, message, cause) {
  const error = new Error(message, cause ? { cause } : undefined);
  error.code = code;
  return error;
}

function safelyRead(value, key) {
  try { return value?.[key]; } catch { return undefined; }
}

function isErrorInstance(value) {
  try { return value instanceof Error; } catch { return false; }
}

function normalizeTransactionError(reason, { preservePrototype = false } = {}) {
  const isError = isErrorInstance(reason);
  let message;
  if (isError) {
    try { message = String(reason.message); } catch { /* use safe fallback below */ }
  }
  if (message === undefined) {
    try { message = String(reason); } catch { message = "<unprintable rejected value>"; }
  }
  const failure = new Error(message, { cause: reason });
  if (isError) {
    const name = safelyRead(reason, "name");
    if (typeof name === "string" && name) failure.name = name;
    const code = safelyRead(reason, "code");
    if (code !== undefined) failure.code = code;
    if (preservePrototype) {
      try { Object.setPrototypeOf(failure, Object.getPrototypeOf(reason)); } catch { /* preserve Error fallback */ }
      try {
        for (const key of Reflect.ownKeys(reason)) {
          if (["stack", "message", "cause", "name"].includes(key)) continue;
          const value = safelyRead(reason, key);
          if (value === undefined) continue;
          try { Object.defineProperty(failure, key, { value, enumerable: true, configurable: true, writable: true }); } catch { /* best effort */ }
        }
      } catch { /* proxy or exotic Error */ }
    }
  } else {
    failure.name = "NonErrorRejection";
  }
  return failure;
}

/** جلوی deadlock و نوشتن بیرون از Unit of Work را می‌گیرد. */
function assertNotUsingOuterRepository(driver) {
  if (transactionContext.getStore()?.owner === driver) {
    throw persistenceError("TRANSACTION_OUTER_REPO_ACCESS", "از transaction-scoped repository داخل transaction callback استفاده کنید");
  }
}

class AsyncMutex {
  #tail = Promise.resolve();

  async run(work) {
    const previous = this.#tail;
    let release;
    this.#tail = new Promise((resolve) => { release = resolve; });
    await previous;
    try {
      return await work();
    } finally {
      release();
    }
  }
}

/** جایگزینی یک فایل با rename؛ در صورت قطع فرایند فایل قدیم یا جدید باقی می‌ماند. */
function writeFileAtomic(target, content) {
  const dir = path.dirname(target);
  const temp = `${target}.${process.pid}.${crypto.randomUUID()}.tmp`;
  let fd = null;
  try {
    fd = fs.openSync(temp, "wx", 0o600);
    fs.writeFileSync(fd, content, "utf8");
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = null;
    fs.renameSync(temp, target);
    // در فایل‌سیستم‌هایی که directory fsync پشتیبانی می‌کنند، rename هم durable شود.
    try {
      const dirFd = fs.openSync(dir, "r");
      try { fs.fsyncSync(dirFd); } finally { fs.closeSync(dirFd); }
    } catch {
      // rename همچنان اتمیک است؛ برخی فایل‌سیستم‌ها fsync دایرکتوری را رد می‌کنند.
    }
  } catch (error) {
    if (fd !== null) {
      try { fs.closeSync(fd); } catch { /* best effort */ }
    }
    try { fs.unlinkSync(temp); } catch { /* best effort */ }
    throw error;
  }
}

/* ═══════════════════════ درایور فایلی ═══════════════════════ */

export class JsonFileDriver {
  constructor(rootDir) {
    this.kind = "json";
    this.root = rootDir;
    this.cache = new Map();
    this.mutex = new AsyncMutex();
    this.journalFile = path.join(this.root, ".transaction-journal.json");
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

  /** نوشتن اتمی یک جدول: فایل تازه تا پایان serialize جایگزین فایل قبلی نمی‌شود. */
  #save(table, rows) {
    const target = this.#file(table);
    writeFileAtomic(target, JSON.stringify(rows, null, 2));
    this.cache.set(table, rows);
  }

  #transactionImageName(txId, table) {
    return `.txn-${txId}-${table}.after.json`;
  }

  #cleanupOrphanTransactionFiles() {
    let names = [];
    try { names = fs.readdirSync(this.root); } catch { return; }
    for (const name of names) {
      if (/^\.txn-[0-9a-f-]{36}-[A-Za-z][A-Za-z0-9]*\.after\.json$/i.test(name)) {
        try { fs.unlinkSync(path.join(this.root, name)); } catch { /* best effort */ }
      }
    }
  }

  /**
   * Journal is a redo log: after it is durably renamed into place, the Unit of
   * Work is committed. If the process stops during per-table replacement, the
   * next operation replays every after-image before it can read or write data.
   */
  #recoverTransactions() {
    if (!fs.existsSync(this.journalFile)) {
      this.#cleanupOrphanTransactionFiles();
      return;
    }

    let journal;
    try {
      journal = JSON.parse(fs.readFileSync(this.journalFile, "utf8"));
    } catch (cause) {
      throw persistenceError("JSON_TRANSACTION_RECOVERY_FAILED", "JSON transaction journal is unreadable; persistence is fail-closed", cause);
    }
    if (journal?.version !== 1 || !/^[0-9a-f-]{36}$/i.test(String(journal.txId ?? "")) || !Array.isArray(journal.tables) || journal.tables.length === 0) {
      throw persistenceError("JSON_TRANSACTION_RECOVERY_FAILED", "JSON transaction journal has an invalid shape");
    }

    const seen = new Set();
    try {
      for (const entry of journal.tables) {
        const table = must(entry?.table).name;
        const imageName = this.#transactionImageName(journal.txId, table);
        if (entry.image !== imageName || seen.has(table)) throw new Error("Invalid/duplicate transaction image entry");
        seen.add(table);
        const imagePath = path.join(this.root, imageName);
        if (!fs.existsSync(imagePath)) throw new Error(`Transaction after-image missing for ${table}`);
        const content = fs.readFileSync(imagePath, "utf8");
        const rows = JSON.parse(content);
        if (!Array.isArray(rows)) throw new Error(`Transaction after-image is not an array for ${table}`);
        writeFileAtomic(this.#file(table), content);
        this.cache.set(table, rows);
      }
      fs.unlinkSync(this.journalFile);
      this.#cleanupOrphanTransactionFiles();
    } catch (cause) {
      throw persistenceError("JSON_TRANSACTION_RECOVERY_FAILED", "JSON transaction recovery did not complete; persistence is fail-closed", cause);
    }
  }

  #commitTransaction(staged, changedTables) {
    const txId = crypto.randomUUID();
    const tables = [...changedTables].sort();
    const entries = [];
    try {
      for (const table of tables) {
        must(table);
        const image = this.#transactionImageName(txId, table);
        writeFileAtomic(path.join(this.root, image), JSON.stringify(staged.get(table), null, 2));
        entries.push({ table, image });
      }
      writeFileAtomic(this.journalFile, JSON.stringify({ version: 1, txId, tables: entries }, null, 2));
      this.#recoverTransactions();
    } catch (error) {
      if (!fs.existsSync(this.journalFile)) {
        for (const { image } of entries) {
          try { fs.unlinkSync(path.join(this.root, image)); } catch { /* best effort */ }
        }
      }
      throw error;
    }
  }

  async ping() {
    assertNotUsingOuterRepository(this);
    return this.mutex.run(async () => {
      this.#recoverTransactions();
      return { ok: true, driver: "json", root: this.root };
    });
  }

  async select(tableName, spec = {}) {
    assertNotUsingOuterRepository(this);
    return this.mutex.run(async () => {
      this.#recoverTransactions();
      const t = must(tableName);
      const logicalRows = this.#load(tableName).map((row) => mapFromStorage(t, row));
      return applySelect(logicalRows, spec);
    });
  }

  async count(tableName, where = []) {
    assertNotUsingOuterRepository(this);
    return this.mutex.run(async () => {
      this.#recoverTransactions();
      const t = must(tableName);
      return this.#load(tableName).filter((row) => matchesWhere(mapFromStorage(t, row), where)).length;
    });
  }

  async insert(tableName, row) {
    assertNotUsingOuterRepository(this);
    return this.mutex.run(async () => {
      this.#recoverTransactions();
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
      const stored = mapToStorage(t, row);
      for (const idx of t.indexes ?? []) {
        if (!idx.unique) continue;
        const clash = rows.some((r) => idx.columns.every((cn) => r[cn] === stored[cn]));
        if (clash) {
          const e = new Error(`UNIQUE_VIOLATION: ${idx.name}`);
          e.code = "UNIQUE_VIOLATION";
          throw e;
        }
      }
      this.#save(tableName, [...rows, stored]);
      return mapFromStorage(t, stored);
    });
  }

  async update(tableName, patch, where, opts = {}) {
    assertNotUsingOuterRepository(this);
    return this.mutex.run(async () => {
      this.#recoverTransactions();
      const t = must(tableName);
      const issues = validateRow(t, patch, "update");
      if (issues.length) throw new ValidationError(issues);
      const rows = this.#load(tableName);
      const matches = (row) => matchesWhere(mapFromStorage(t, row), where);
      const targets = rows.filter(matches);
      if (targets.length === 0) return { affected: 0, ...concurrencyResult(0, false) };

      const stored = mapToStorage(t, patch);
      let affected = 0;
      const next = rows.map((r) => {
        if (!matches(r)) return r;
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
    });
  }

  async remove(tableName, where) {
    assertNotUsingOuterRepository(this);
    return this.mutex.run(async () => {
      this.#recoverTransactions();
      const table = must(tableName);
      const rows = this.#load(tableName);
      const next = rows.filter((row) => !matchesWhere(mapFromStorage(table, row), where));
      const affected = rows.length - next.length;
      if (affected) this.#save(tableName, next);
      return { affected };
    });
  }

  async reset(tableName) {
    assertNotUsingOuterRepository(this);
    return this.mutex.run(async () => {
      this.#recoverTransactions();
      must(tableName);
      this.#save(tableName, []);
    });
  }

  async transaction(work) {
    assertNotUsingOuterRepository(this);
    if (typeof work !== "function") throw new TypeError("transaction(work) requires a callback");
    return this.mutex.run(async () => {
      this.#recoverTransactions();
      const staged = new Map();
      const changedTables = new Set();
      const txDriver = this.#createTransactionDriver(staged, changedTables);
      const result = await transactionContext.run({ owner: this }, () => work(txDriver));
      if (changedTables.size === 0) return result;
      try {
        this.#commitTransaction(staged, changedTables);
      } catch (cause) {
        // وجود journal یعنی commit point رد شده؛ تلاش برای redo فوری می‌کند.
        if (fs.existsSync(this.journalFile)) {
          try {
            this.#recoverTransactions();
            return result;
          } catch (recoveryError) {
            throw persistenceError("JSON_TRANSACTION_RECOVERY_FAILED", "تراکنش ثبت شد اما بازیابی کامل نشد؛ مخزن تا recovery بعدی بسته می‌ماند", recoveryError);
          }
        }
        throw cause;
      }
      return result;
    });
  }

  #createTransactionDriver(staged, changedTables) {
    const rowsFor = (tableName) => {
      const table = must(tableName);
      if (!staged.has(tableName)) staged.set(tableName, this.#load(tableName).map((row) => ({ ...row })));
      return { table, rows: staged.get(tableName) };
    };
    const nestedUnsupported = async () => { throw persistenceError("NESTED_TRANSACTION_UNSUPPORTED", "تراکنش تو‌در‌تو پشتیبانی نمی‌شود"); };

    return {
      kind: "json-transaction",
      transaction: nestedUnsupported,
      async select(tableName, spec = {}) {
        const { table, rows } = rowsFor(tableName);
        return applySelect(rows.map((row) => mapFromStorage(table, row)), spec);
      },
      async count(tableName, where = []) {
        const { table, rows } = rowsFor(tableName);
        return rows.filter((row) => matchesWhere(mapFromStorage(table, row), where)).length;
      },
      async insert(tableName, row) {
        const { table, rows } = rowsFor(tableName);
        const issues = validateRow(table, row, "insert");
        if (issues.length) throw new ValidationError(issues);
        const stored = mapToStorage(table, row);
        if (rows.some((item) => item[table.pk] === stored[table.pk])) {
          const error = new Error(`DUPLICATE_KEY: ${tableName}.${table.pk}=${stored[table.pk]}`);
          error.code = "DUPLICATE_KEY";
          throw error;
        }
        for (const index of table.indexes ?? []) {
          if (!index.unique) continue;
          const collision = rows.some((item) => index.columns.every((column) => item[column] === stored[column]));
          if (collision) {
            const error = new Error(`UNIQUE_VIOLATION: ${index.name}`);
            error.code = "UNIQUE_VIOLATION";
            throw error;
          }
        }
        rows.push(stored);
        changedTables.add(tableName);
        return mapFromStorage(table, stored);
      },
      async update(tableName, patch, where, opts = {}) {
        const { table, rows } = rowsFor(tableName);
        const issues = validateRow(table, patch, "update");
        if (issues.length) throw new ValidationError(issues);
        const matches = (row) => matchesWhere(mapFromStorage(table, row), where);
        const targets = rows.filter(matches);
        if (targets.length === 0) return { affected: 0, ...concurrencyResult(0, false) };
        const stored = mapToStorage(table, patch);
        let affected = 0;
        const next = rows.map((row) => {
          if (!matches(row) || (opts.expectedRowVersion !== undefined && row.RowVersion !== opts.expectedRowVersion)) return row;
          affected++;
          return {
            ...row,
            ...stored,
            UpdatedAt: new Date().toISOString(),
            UpdatedBy: opts.updatedBy ?? row.UpdatedBy ?? null,
            RowVersion: (row.RowVersion ?? 1) + 1,
          };
        });
        if (affected) {
          staged.set(tableName, next);
          changedTables.add(tableName);
        }
        return { affected, ...concurrencyResult(affected, true) };
      },
      async remove(tableName, where) {
        const { table, rows } = rowsFor(tableName);
        const next = rows.filter((row) => !matchesWhere(mapFromStorage(table, row), where));
        const affected = rows.length - next.length;
        if (affected) {
          staged.set(tableName, next);
          changedTables.add(tableName);
        }
        return { affected };
      },
      async reset(tableName) {
        must(tableName);
        staged.set(tableName, []);
        changedTables.add(tableName);
      },
    };
  }
}

/* ═══════════════════════ درایور SQL Server ═══════════════════════ */

export class MssqlDriver {
  /** @param pool یک ConnectionPool یا Transaction آماده از بستهٔ mssql */
  constructor(pool, sqlModule, { transactionScoped = false } = {}) {
    this.kind = "mssql";
    this.pool = pool;
    this.sql = sqlModule;
    this.transactionScoped = transactionScoped;
  }

  async #run({ sql, params }) {
    assertNotUsingOuterRepository(this);
    const request = this.pool.request();
    params.forEach((v, i) => request.input(`p${i}`, v));
    return request.query(sql);
  }

  async ping() {
    assertNotUsingOuterRepository(this);
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

  async transaction(work) {
    assertNotUsingOuterRepository(this);
    if (typeof work !== "function") throw new TypeError("transaction(work) requires a callback");
    if (this.transactionScoped) throw persistenceError("NESTED_TRANSACTION_UNSUPPORTED", "تراکنش تو‌در‌تو پشتیبانی نمی‌شود");
    if (typeof this.sql?.Transaction !== "function") throw persistenceError("TRANSACTIONS_UNSUPPORTED", "mssql Transaction API is unavailable");

    let transaction;
    let began = false;
    let commitStarted = false;
    try {
      transaction = new this.sql.Transaction(this.pool);
      await transaction.begin();
      began = true;
      const scopedDriver = new MssqlDriver(transaction, this.sql, { transactionScoped: true });
      const result = await transactionContext.run({ owner: this }, () => work(scopedDriver));
      commitStarted = true;
      await transaction.commit();
      return result;
    } catch (reason) {
      let failure = !commitStarted && isErrorInstance(reason) ? reason : normalizeTransactionError(reason);
      if (began && transaction) {
        try {
          await transaction.rollback();
        } catch (rollbackReason) {
          const rollbackFailure = normalizeTransactionError(rollbackReason);
          if (failure === reason) {
            try {
              Object.defineProperty(failure, "rollbackError", { value: rollbackFailure, configurable: true, writable: true });
            } catch {
              failure = normalizeTransactionError(reason, { preservePrototype: true });
              failure.rollbackError = rollbackFailure;
            }
          } else {
            failure.rollbackError = rollbackFailure;
          }
        }
      }
      if (commitStarted) {
        const originalCode = failure.code;
        failure.code = "MSSQL_TRANSACTION_COMMIT_UNCERTAIN";
        if (originalCode !== undefined && originalCode !== failure.code) failure.originalCode = originalCode;
      }
      throw failure;
    }
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

    /** Unit of Work: callback به repository تراکنش‌محدودشده دسترسی دارد؛
     * در exception همهٔ تغییرات rollback می‌شوند. داخل callback فقط از txRepo استفاده کنید. */
    async transaction(work) {
      if (typeof work !== "function") throw new TypeError("transaction(work) requires a callback");
      if (typeof driver.transaction !== "function") throw persistenceError("TRANSACTIONS_UNSUPPORTED", "درایور فعلی تراکنش چندجدولی را پشتیبانی نمی‌کند");
      return driver.transaction((txDriver) => work(createRepository(txDriver)));
    },

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
