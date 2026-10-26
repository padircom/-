import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { SCHEMA, allColumns, generateDdl } from './sqlLogic.js';

const root = new URL('../', import.meta.url);
test('delivered DDL is exactly the authoritative schema, not inferred legacy types', () => {
  for (const dialect of ['mssql', 'sqlite']) {
    assert.equal(readFileSync(new URL(`database/schema-${dialect}.sql`, root), 'utf8'), generateDdl(dialect));
  }
  execFileSync(process.execPath, ['scripts/generate-schema.mjs', '--check'], { cwd: root });
});

test('fresh SQLite install creates every registered table and every IPC signing column', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('PRAGMA foreign_keys=ON;');
    db.exec(readFileSync(new URL('database/schema-sqlite.sql', root), 'utf8'));
    const names = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name));
    for (const table of SCHEMA) {
      assert.ok(names.has(table.name), table.name);
      const columns = db.prepare(`PRAGMA table_info("${table.name}")`).all().map(r => r.name);
      assert.deepEqual(columns, allColumns(table).map(c => c.name), table.name);
    }
    const signing = db.prepare('PRAGMA table_info("IPC_WorkflowStep")').all().map(r => r.name);
    for (const name of ['DocumentSha256', 'SnapshotSha256', 'PkiSignature', 'PkiCertPem', 'PkiCertSha256', 'PkiKeyId', 'PkiAlgorithm', 'PkiSignedAt', 'PkiTrustLevel', 'PkiCertInfoJson']) assert.ok(signing.includes(name), name);
  } finally { db.close(); }
});
