#!/usr/bin/env node
// Generate demo/example seed data only; this is not a production bootstrap.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'database');
const framework = readFileSync(path.join(root, 'src/data/framework.ts'), 'utf8');
const quote = value => `'${String(value).replace(/'/g, "''")}'`;
const projectPattern = /\{\s*id:\s*"([\w-]+)",\s*code:\s*"([^"]*)",\s*name:\s*\{\s*fa:\s*"([^"]*)",\s*en:\s*"([^"]*)"\s*\},\s*client:\s*\{\s*fa:\s*"([^"]*)",\s*en:\s*"([^"]*)"\s*\},\s*status:\s*"(\w+)",\s*progress:\s*(\d+),\s*budget:\s*"([^"]*)",\s*location:\s*\{\s*fa:\s*"([^"]*)",\s*en:\s*"([^"]*)"/g;

const geo = new Map();
const geoPath = path.join(root, 'src/services/geo.ts');
if (existsSync(geoPath)) {
  const source = readFileSync(geoPath, 'utf8');
  for (const match of source.matchAll(/"([^"]+)":\s*\{\s*coord:\s*\{\s*lat:\s*(-?[\d.]+),\s*lon:\s*(-?[\d.]+)\s*\},\s*accuracy:\s*"(\w+)"/g)) {
    geo.set(match[1], { lat: Number(match[2]), lon: Number(match[3]), accuracy: match[4] });
  }
}
function resolveGeo(location) {
  const key = String(location).trim();
  if (geo.has(key)) return geo.get(key);
  for (const [name, value] of geo) if (key.includes(name) || name.includes(key)) return value;
  return null;
}

function buildSeed(mssql) {
  const prefix = mssql ? 'dbo.' : '';
  const lines = ['-- داده‌ی اولیه (تولید خودکار از src/data/framework.ts)', ''];
  const industries = /\{\s*id:\s*"(c\d+)",\s*icon:\s*"([^"]*)",\s*color:\s*"([^"]*)",\s*title:\s*\{\s*fa:\s*"([^"]*)",\s*en:\s*"([^"]*)"/g;
  let industryCount = 0;
  for (const [, id, icon, color, fa, en] of framework.matchAll(industries)) {
    lines.push(`INSERT INTO ${prefix}Industry_Master (Code, TitleFa, TitleEn, Icon, Color, IsActive) VALUES (${quote(id)}, ${quote(fa)}, ${quote(en)}, ${quote(icon)}, ${quote(color)}, 1);`);
    industryCount++;
  }
  lines.push(`-- ${industryCount} صنعت`, '');
  let projectCount = 0;
  for (const match of framework.matchAll(projectPattern)) {
    const [, , code, nameFa, nameEn, clientFa, clientEn, status, progress, budget, locationFa] = match;
    const industryCode = code.slice(0, 2).toUpperCase();
    lines.push(`INSERT INTO ${prefix}Project_Master (ProjectCode, NameFa, NameEn, ClientFa, ClientEn, Status, Progress, Budget, LocationFa, LocationEn, IndustryCode, IsActive) VALUES (${quote(code)}, ${quote(nameFa)}, ${quote(nameEn)}, ${quote(clientFa)}, ${quote(clientEn)}, ${quote(status)}, ${progress}, ${quote(budget)}, ${quote(locationFa)}, ${quote(match[11])}, ${quote(industryCode)}, 1);`);
    projectCount++;
  }
  lines.unshift(`-- ${projectCount} پروژه`);
  lines.push('', '-- مختصاتِ سایت از گَزِتیرِ ماژول GIS');
  let siteCount = 0;
  for (const match of framework.matchAll(projectPattern)) {
    const code = match[2], locationFa = match[10], coordinates = resolveGeo(locationFa);
    if (!coordinates) continue;
    lines.push(`INSERT INTO ${prefix}Project_Site (ProjectCode, Latitude, Longitude, Accuracy, LocationFa) VALUES (${quote(code)}, ${coordinates.lat}, ${coordinates.lon}, ${quote(coordinates.accuracy)}, ${quote(locationFa)});`);
    siteCount++;
  }
  lines.push(`-- ${siteCount} سایت`);
  return lines.join('\n');
}

mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, 'seed-data-mssql.sql'), buildSeed(true), 'utf8');
writeFileSync(path.join(outDir, 'seed-data-sqlite.sql'), buildSeed(false), 'utf8');
console.log('Demo seed data generated; no DDL was written.');
