/* یکپارچگی کاتالوگ نام‌گذاری سامانه‌ها (src/data/systemCatalog.ts).
 * کاتالوگ و framework را درجا با esbuild باندل می‌کند؛ نیازی به build:* ندارد. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { readFileSync } from "node:fs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function load() {
  const out = await build({
    stdin: {
      contents: `export * from "./src/data/systemCatalog.ts"; export { domains, ui } from "./src/data/framework.ts";`,
      resolveDir: root,
      loader: "ts",
    },
    bundle: true,
    format: "esm",
    platform: "node",
    write: false,
    logLevel: "silent",
  });
  const code = out.outputFiles[0].text;
  return import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));
}

const mod = await load();

test("کدها یکتا و با قالب استاندارد هستند", () => {
  const codes = mod.systems.map((s) => s.code);
  assert.equal(new Set(codes).size, codes.length, "کد تکراری");
  for (const c of codes) assert.match(c, /^[A-Z]{2,4}(-[A-Z])?$/, `قالب نامعتبر: ${c}`);
});

test("هر حوزهٔ سایدبار دست‌کم یک سامانه دارد", () => {
  for (const d of mod.domains) {
    assert.ok(mod.systemsForDomain(d.id).length >= 1, `حوزهٔ بی‌کد: ${d.id}`);
  }
});

test("هیچ سامانه‌ای به حوزهٔ ناموجود اشاره نمی‌کند", () => {
  const ids = new Set(mod.domains.map((d) => d.id));
  for (const s of mod.systems) {
    if (s.domainId !== null) assert.ok(ids.has(s.domainId), `${s.code} → ${s.domainId}`);
    if (s.partOf) assert.ok(ids.has(s.partOf), `${s.code} partOf ${s.partOf}`);
  }
});

test("فقط d5 چند سامانه دارد (CCS و SCM)", () => {
  const multi = mod.domains.filter((d) => mod.systemsForDomain(d.id).length > 1).map((d) => d.id);
  assert.deepEqual(multi, ["d5"]);
  assert.deepEqual(mod.systemsForDomain("d5").map((s) => s.code), ["CCS", "SCM"]);
});

test("همهٔ سامانه‌ها نام دوزبانه و مجموعهٔ معتبر دارند", () => {
  const suiteIds = new Set(mod.suites.map((s) => s.id));
  for (const s of mod.systems) {
    assert.ok(s.name.fa && s.name.en, s.code);
    assert.ok(suiteIds.has(s.suite), s.code);
  }
});

test("NAM-2: برند واحد — سربرگ، عنوان مرورگر و بنر سرور", () => {
  assert.equal(mod.PLATFORM_BRAND.code, "Arena PMIS");
  assert.deepEqual(mod.ui.hubTitle, mod.PLATFORM_BRAND.name, "سربرگ باید از کاتالوگ خوانده شود");
  const html = readFileSync(path.join(root, "index.html"), "utf8");
  assert.match(html, /<title>Arena PMIS \| سامانهٔ جامع مدیریت و کنترل پروژه آرنا<\/title>/);
  assert.doesNotMatch(html, /PM Control Platform/);
  const server = readFileSync(path.join(root, "server/index.js"), "utf8");
  assert.match(server, /Arena PMIS REST API Service running/);
});
