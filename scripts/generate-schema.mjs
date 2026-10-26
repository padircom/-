#!/usr/bin/env node
// Authoritative fresh-install DDL. Never infer column types from names/SQL text.
import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
import { SCHEMA, generateDdl, validateSchema } from '../server/sqlLogic.js';
const issues = validateSchema();
if (issues.length) throw new Error(issues.join('\n'));
const outputs = new Map();
for (const dialect of ['mssql', 'sqlite']) {
  outputs.set(`database/schema-${dialect}.sql`, generateDdl(dialect));
}
const ddl = outputs.get('database/schema-mssql.sql');
outputs.set('src/services/pmisFullSchema.ts',
  '// GENERATED from persistence.ts by npm run db:schema. Fresh installs only.\n' +
  'export const PMIS_FULL_SCHEMA_SCRIPT = `' + ddl.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${') + '`;\n' +
  `export const PMIS_FULL_SCHEMA_TABLE_COUNT = ${SCHEMA.length};\n`);
for (const [name, content] of outputs) {
  if (process.argv.includes('--check')) {
    if (readFileSync(path.join(root, name), 'utf8') !== content) throw new Error(`Schema drift: ${name}`);
  } else writeFileSync(path.join(root, name), content);
}
console.log(`Authoritative schema: ${SCHEMA.length} tables; ${outputs.size} synchronized artifacts`);
