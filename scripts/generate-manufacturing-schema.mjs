#!/usr/bin/env node
/**
 * تولید DDL مستقل ماژول MFG از همان TableDefهای مهاجرت.
 * ترتیب و قیود از منبع TypeScript می‌آیند؛ این فایل خروجی دستی نیست.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { indexDdl, tableDdl, tablesOfModule, validateSchema } from "../server/sqlLogic.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tables = tablesOfModule("mfg");
if (tables.length !== 26) {
  throw new Error(`اسکیما MFG باید دقیقاً ۲۶ جدول داشته باشد؛ تعداد فعلی: ${tables.length}`);
}
const issues = validateSchema();
if (issues.length) throw new Error(`اسکیما نامعتبر:\n${issues.join("\n")}`);

const lines = [
  "-- MFG · Standalone Operation-Based Production Planning & Control (MES)",
  "-- تولیدشده از src/services/manufacturingSchema.ts و persistence.ts؛ ویرایش دستی نکنید.",
  "-- دیتابیس کاملاً مستقل MES: بدون هیچ وابستگی یا کلید خارجی به جداول سامانهٔ کنترل پروژه.",
  "-- PlantId دامنهٔ اجباری داده‌های تولید است؛ ارجاع به سامانه‌های دیگر فقط از طریق کلید نرم و REST API است.",
  "",
];
for (const table of tables) {
  lines.push(`-- ${table.name} · ${table.title.fa}`);
  lines.push(tableDdl(table, "mssql"));
  for (const index of table.indexes ?? []) {
    lines.push(
      `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'${index.name}' AND object_id = OBJECT_ID(N'dbo.${table.name}'))`,
    );
    lines.push(`  ${indexDdl(table, index, "mssql")}`);
  }
  lines.push("GO", "");
}

const outputDir = path.join(root, "database");
mkdirSync(outputDir, { recursive: true });
const output = path.join(outputDir, "manufacturing-schema.sql");
writeFileSync(output, `${lines.join("\n").trimEnd()}\n`, "utf8");
console.log(`✓ ${path.relative(root, output)} — ${tables.length} جدول MFG`);
