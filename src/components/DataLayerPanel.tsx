import { useEffect, useMemo, useState } from "react";
import { type Lang } from "../data/framework";
import {
  MIGRATIONS,
  PERSISTENCE_VERSION,
  SCHEMA,
  allColumns,
  checksumOf,
  generateDdl,
  migrationPlan,
  schemaStats,
  sqlType,
  validateSchema,
  type AppliedMigration,
  type SqlDialect,
  type TableDef,
} from "../services/persistence";

type Pane = "overview" | "schema" | "ddl" | "migrations";

const MODULE_LABEL: Record<string, { fa: string; en: string }> = {
  core: { fa: "هسته", en: "Core" },
  d1: { fa: "مدارک", en: "Documents" },
  d2: { fa: "برنامه‌ریزی", en: "Planning" },
  d3: { fa: "پایش", en: "Controls" },
  d4: { fa: "ریسک و ادعا", en: "Risk & claims" },
  d5: { fa: "مالی", en: "Finance" },
  d7: { fa: "سامانه", en: "System" },
  d8: { fa: "کیفیت", en: "Quality" },
  d10: { fa: "منابع انسانی", en: "Workforce" },
  d11: { fa: "ارتباطات", en: "Communications" },
};

/** پاسخ API فقط وقتی JSON است معتبر شمرده می‌شود — در dev سرور Vite مسیر /api صفحهٔ HTML می‌دهد. */
async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.headers.get("content-type")?.includes("application/json")) return null;
    const body = await res.json();
    return (body?.data ?? body) as T;
  } catch {
    return null;
  }
}

export default function DataLayerPanel({ lang }: { lang: Lang }) {
  const rtl = lang === "fa";
  const T = (b: { fa: string; en: string }) => (rtl ? b.fa : b.en);

  const [pane, setPane] = useState<Pane>("overview");
  const [dialect, setDialect] = useState<SqlDialect>("mssql");
  const [moduleFilter, setModuleFilter] = useState<string>("all");
  const [selected, setSelected] = useState<string>("Activity");
  const [search, setSearch] = useState("");

  const [live, setLive] = useState<{ driver: string } | null>(null);
  const [applied, setApplied] = useState<AppliedMigration[] | null>(null);
  const [probing, setProbing] = useState(false);

  const stats = useMemo(() => schemaStats(), []);
  const schemaErrors = useMemo(() => validateSchema(), []);
  const plan = useMemo(() => migrationPlan(applied ?? []), [applied]);

  const tables = useMemo(
    () =>
      SCHEMA.filter((t) => (moduleFilter === "all" || t.module === moduleFilter) && (search === "" || t.name.toLowerCase().includes(search.toLowerCase()) || t.title.fa.includes(search))),
    [moduleFilter, search]
  );
  const table = useMemo<TableDef>(() => SCHEMA.find((t) => t.name === selected) ?? SCHEMA[0], [selected]);
  const ddl = useMemo(() => generateDdl(dialect), [dialect]);

  const probe = async () => {
    setProbing(true);
    const s = await fetchJson<{ driver: string }>("/api/data/schema");
    setLive(s);
    const m = await fetchJson<{ applied: AppliedMigration[] }>("/api/data/migrations");
    setApplied(m?.applied ?? null);
    setProbing(false);
  };

  useEffect(() => {
    void probe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const downloadDdl = () => {
    const blob = new Blob(["\uFEFF", ddl], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `arena-schema-${PERSISTENCE_VERSION}-${dialect}.sql`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const modules = ["all", ...Array.from(new Set(SCHEMA.map((t) => t.module)))];

  return (
    <div className="fade-rise space-y-3" dir={rtl ? "rtl" : "ltr"}>
      {/* عنوان */}
      <div className="glass-dark flex flex-wrap items-center gap-2 rounded-2xl p-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-lg border border-sky-400/40 bg-sky-400/10 text-[15px]">🗄</span>
        <div className="min-w-0 flex-1">
          <div className="text-[11.5px] font-semibold tx1">{rtl ? "لایه ماندگاری داده" : "Data persistence layer"}</div>
          <div className="text-[8.5px] font-extralight tx3">
            {rtl
              ? `${stats.tables} جدول · ${stats.columns} ستون · ${stats.indexes} ایندکس · ${stats.foreignKeys} کلید خارجی · ${MIGRATIONS.length} مهاجرت`
              : `${stats.tables} tables · ${stats.columns} columns · ${stats.indexes} indexes · ${stats.foreignKeys} FKs · ${MIGRATIONS.length} migrations`}
          </div>
        </div>
        <span className={`rounded-lg border px-2 py-1 text-[8.5px] ${schemaErrors.length === 0 ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-rose-400/30 bg-rose-400/10 text-rose-300"}`}>
          {schemaErrors.length === 0 ? (rtl ? "اسکیما معتبر" : "Schema valid") : `${schemaErrors.length} ${rtl ? "ایراد" : "errors"}`}
        </span>
        <span className="rounded-lg border b-line-soft px-2 py-1 font-mono text-[8.5px] tx3" dir="ltr">{PERSISTENCE_VERSION}</span>
      </div>

      <nav className="flex flex-wrap gap-1 rounded-xl bg-black/15 p-1">
        {([
          ["overview", { fa: "نمای کلی", en: "Overview" }, "◧"],
          ["schema", { fa: "مرورگر اسکیما", en: "Schema browser" }, "▦"],
          ["ddl", { fa: "تولید DDL", en: "DDL generator" }, "⌘"],
          ["migrations", { fa: "مهاجرت‌ها", en: "Migrations" }, "⇪"],
        ] as const).map(([k, label, icon]) => (
          <button
            key={k}
            onClick={() => setPane(k)}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-light transition ${pane === k ? "toggle-on tx1 shadow-sm" : "tx3 hover:tx2"}`}
          >
            <span>{icon}</span>
            <span>{T(label)}</span>
          </button>
        ))}
      </nav>

      {/* ═══════ نمای کلی ═══════ */}
      {pane === "overview" && (
        <div className="grid gap-3 lg:grid-cols-2">
          <section className="glass-dark rounded-2xl p-3">
            <div className="mb-2 flex items-center gap-2 border-b b-line-soft pb-1.5">
              <h4 className="text-[10.5px] font-semibold tx1">{rtl ? "درایور فعال" : "Active driver"}</h4>
              <button onClick={probe} disabled={probing} className="glass-row ms-auto rounded-lg px-2 py-1 text-[9px] tx2 transition hover:tx1 disabled:opacity-50">
                {probing ? (rtl ? "در حال بررسی…" : "probing…") : rtl ? "بررسی مجدد" : "Re-probe"}
              </button>
            </div>
            {live ? (
              <div className="space-y-1.5">
                <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-2.5">
                  <div className="text-[11px] font-bold text-emerald-300">
                    {live.driver === "mssql" ? (rtl ? "SQL Server متصل است" : "SQL Server connected") : rtl ? "درایور فایلی JSON فعال است" : "JSON file driver active"}
                  </div>
                  <p className="mt-0.5 text-[8.5px] font-light tx2">
                    {live.driver === "mssql"
                      ? rtl
                        ? "کوئری‌های پارامتری مستقیم روی پایگاه داده اجرا می‌شوند."
                        : "Parameterised queries run directly against the database."
                      : rtl
                      ? "SQL Server در دسترس نبود، پس تنزل آرام به فایل انجام شد. ماندگاری واقعی است و با تنظیم SQL_SERVER به پایگاه داده سوییچ می‌شود."
                      : "SQL Server was unreachable, so the layer degraded to files. Persistence is real; set SQL_SERVER to switch."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-2.5 text-[9px] text-amber-200">
                {rtl
                  ? "سرویس API پاسخ JSON نداد. در حالت توسعهٔ Vite مسیر /api پراکسی نمی‌شود؛ اسکیما، DDL و برنامهٔ مهاجرت همچنان به‌صورت محلی محاسبه و نمایش داده می‌شوند."
                  : "The API returned no JSON. Under the Vite dev server /api is not proxied; schema, DDL and the migration plan are still computed locally."}
              </div>
            )}

            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {([
                [rtl ? "جدول" : "Tables", stats.tables],
                [rtl ? "ستون" : "Columns", stats.columns],
                [rtl ? "ایندکس" : "Indexes", stats.indexes],
                [rtl ? "کلید خارجی" : "Foreign keys", stats.foreignKeys],
              ] as const).map(([label, v]) => (
                <div key={label} className="glass-row rounded-xl px-2.5 py-2 text-center">
                  <div className="text-[16px] font-bold tx1">{v}</div>
                  <div className="text-[8px] tx3">{label}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="glass-dark rounded-2xl p-3">
            <h4 className="mb-2 border-b b-line-soft pb-1.5 text-[10.5px] font-semibold tx1">{rtl ? "جدول‌ها بر حسب ماژول" : "Tables by module"}</h4>
            <div className="space-y-1">
              {Object.entries(
                SCHEMA.reduce<Record<string, number>>((acc, t) => ({ ...acc, [t.module]: (acc[t.module] ?? 0) + 1 }), {})
              )
                .sort((a, b) => b[1] - a[1])
                .map(([mod, n]) => (
                  <div key={mod} className="flex items-center gap-2">
                    <span className="w-24 shrink-0 text-[9px] tx2">{MODULE_LABEL[mod] ? T(MODULE_LABEL[mod]) : mod}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/30">
                      <div className="h-full rounded-full bg-sky-400/60" style={{ width: `${(n / stats.tables) * 100}%` }} />
                    </div>
                    <span className="w-6 shrink-0 text-end text-[9px] tx3">{n}</span>
                  </div>
                ))}
            </div>
            <p className="mt-2 rounded-lg bg-sky-400/10 px-2 py-1.5 text-[8.5px] text-sky-200">
              {rtl
                ? "هر جدول پنج ستون حسابرسی مشترک دارد: CreatedAt، CreatedBy، UpdatedAt، UpdatedBy و RowVersion. آخری کنترل هم‌زمانی خوش‌بینانه را ممکن می‌کند."
                : "Every table carries five shared audit columns: CreatedAt, CreatedBy, UpdatedAt, UpdatedBy and RowVersion — the last enabling optimistic concurrency."}
            </p>
          </section>
        </div>
      )}

      {/* ═══════ مرورگر اسکیما ═══════ */}
      {pane === "schema" && (
        <div className="grid gap-3 lg:grid-cols-[260px_1fr]">
          <section className="glass-dark rounded-2xl p-2.5">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={rtl ? "جستجوی جدول…" : "search table…"}
              className="mb-1.5 w-full rounded-lg border b-line-soft bg-black/25 px-2 py-1 text-[9.5px] tx1 outline-none focus:border-sky-400/50"
            />
            <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} className="mb-1.5 w-full rounded-lg border b-line-soft bg-black/30 px-2 py-1 text-[9.5px] tx1 outline-none">
              {modules.map((m) => (
                <option key={m} value={m} className="bg-neutral-900">
                  {m === "all" ? (rtl ? "همه ماژول‌ها" : "All modules") : MODULE_LABEL[m] ? T(MODULE_LABEL[m]) : m}
                </option>
              ))}
            </select>
            <div className="thin-scroll max-h-[480px] space-y-0.5 overflow-y-auto pr-0.5">
              {tables.map((t) => (
                <button
                  key={t.name}
                  onClick={() => setSelected(t.name)}
                  className={`glass-row w-full rounded-lg px-2 py-1.5 text-start transition ${selected === t.name ? "row-on" : ""}`}
                >
                  <div className="font-mono text-[9.5px] tx1" dir="ltr">{t.name}</div>
                  <div className="truncate text-[8px] tx4">{T(t.title)} · {t.columns.length} {rtl ? "ستون" : "cols"}</div>
                </button>
              ))}
              {tables.length === 0 && <div className="py-6 text-center text-[9px] tx4">{rtl ? "یافت نشد" : "no match"}</div>}
            </div>
          </section>

          <section className="glass-dark min-w-0 rounded-2xl p-3">
            <div className="mb-2 flex flex-wrap items-baseline gap-2 border-b b-line-soft pb-1.5">
              <h4 className="font-mono text-[12px] font-semibold tx1" dir="ltr">{table.name}</h4>
              <span className="text-[9px] tx3">{T(table.title)}</span>
              <span className="ms-auto rounded border b-line-soft px-1.5 py-0.5 text-[8px] tx4" dir="ltr">PK: {table.pk}</span>
            </div>
            <div className="thin-scroll max-h-[430px] overflow-auto rounded-xl border b-line-soft">
              <table className="w-full min-w-[560px] border-collapse text-[9px]">
                <thead className="sticky top-0 bg-neutral-900">
                  <tr>
                    <th className="px-2 py-1.5 text-start tx3">{rtl ? "ستون" : "Column"}</th>
                    <th className="px-2 py-1.5 text-start tx3">{rtl ? "نوع" : "Type"}</th>
                    <th className="px-2 py-1.5 text-center tx3">{rtl ? "تهی" : "Null"}</th>
                    <th className="px-2 py-1.5 text-start tx3">{rtl ? "پیش‌فرض" : "Default"}</th>
                    <th className="px-2 py-1.5 text-start tx3">{rtl ? "توضیح" : "Note"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y b-line-soft">
                  {allColumns(table).map((col) => {
                    const isAudit = ["CreatedAt", "CreatedBy", "UpdatedAt", "UpdatedBy", "RowVersion"].includes(col.name);
                    const isPk = col.name === table.pk;
                    return (
                      <tr key={col.name} className={isAudit ? "opacity-60" : ""}>
                        <td className="px-2 py-1 font-mono tx1" dir="ltr">
                          {col.name}
                          {isPk && <span className="ms-1 rounded bg-amber-400/15 px-1 text-[7px] text-amber-200">PK</span>}
                        </td>
                        <td className="px-2 py-1 font-mono text-[8.5px] text-sky-300" dir="ltr">{sqlType(col, dialect)}</td>
                        <td className="px-2 py-1 text-center">{col.nullable === false ? <span className="text-rose-300">✕</span> : <span className="tx4">✓</span>}</td>
                        <td className="px-2 py-1 font-mono text-[8px] tx4" dir="ltr">{col.default ?? "—"}</td>
                        <td className="px-2 py-1 text-[8.5px] tx3">{col.comment ?? ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {(table.indexes?.length || table.foreignKeys?.length) && (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {!!table.indexes?.length && (
                  <div className="rounded-xl border b-line-soft bg-black/15 p-2">
                    <div className="mb-1 text-[9px] font-semibold tx2">{rtl ? "ایندکس‌ها" : "Indexes"}</div>
                    {table.indexes.map((i) => (
                      <div key={i.name} className="text-[8.5px] font-light tx3" dir="ltr">
                        {i.unique && <span className="me-1 rounded bg-emerald-400/15 px-1 text-[7px] text-emerald-300">UNIQUE</span>}
                        {i.name} ({i.columns.join(", ")})
                      </div>
                    ))}
                  </div>
                )}
                {!!table.foreignKeys?.length && (
                  <div className="rounded-xl border b-line-soft bg-black/15 p-2">
                    <div className="mb-1 text-[9px] font-semibold tx2">{rtl ? "کلیدهای خارجی" : "Foreign keys"}</div>
                    {table.foreignKeys.map((f) => (
                      <div key={f.column} className="text-[8.5px] font-light tx3" dir="ltr">
                        {f.column} → {f.refTable}.{f.refColumn} · ON DELETE {f.onDelete ?? "NO ACTION"}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ═══════ DDL ═══════ */}
      {pane === "ddl" && (
        <section className="glass-dark rounded-2xl p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2 border-b b-line-soft pb-1.5">
            <h4 className="text-[10.5px] font-semibold tx1">{rtl ? "اسکریپت ساخت پایگاه داده" : "Database creation script"}</h4>
            <div className="flex gap-1 rounded-lg bg-black/25 p-0.5">
              {(["mssql", "sqlite"] as SqlDialect[]).map((d) => (
                <button key={d} onClick={() => setDialect(d)} className={`rounded px-2 py-1 text-[9px] transition ${dialect === d ? "toggle-on tx1" : "tx3 hover:tx2"}`} dir="ltr">
                  {d === "mssql" ? "SQL Server" : "SQLite"}
                </button>
              ))}
            </div>
            <span className="text-[8.5px] tx4" dir="ltr">{ddl.split("\n").length} lines · {(ddl.length / 1024).toFixed(1)} kB</span>
            <div className="ms-auto flex gap-1">
              <button onClick={() => navigator.clipboard?.writeText(ddl)} className="glass-row rounded-lg px-2.5 py-1 text-[9px] tx2 transition hover:tx1">
                {rtl ? "کپی" : "Copy"}
              </button>
              <button onClick={downloadDdl} className="glass-row rounded-lg px-2.5 py-1 text-[9px] tx2 transition hover:tx1">
                {rtl ? "دانلود .sql" : "Download .sql"}
              </button>
            </div>
          </div>
          <pre className="thin-scroll max-h-[520px] overflow-auto rounded-xl border b-line-soft bg-black/35 p-3 text-[8.5px] leading-relaxed text-sky-100" dir="ltr">
            {ddl}
          </pre>
          <p className="mt-1.5 text-[8.5px] font-extralight tx3">
            {rtl
              ? "این اسکریپت از تعریف قانونی اسکیما تولید می‌شود، نه دستی. هر تغییر در persistence.ts بلافاصله اینجا و در مهاجرت‌ها بازتاب می‌یابد."
              : "Generated from the canonical schema definition, never hand-written. Any change in persistence.ts is reflected here and in the migrations."}
          </p>
        </section>
      )}

      {/* ═══════ مهاجرت‌ها ═══════ */}
      {pane === "migrations" && (
        <div className="grid gap-3 lg:grid-cols-2">
          <section className="glass-dark rounded-2xl p-3">
            <h4 className="mb-2 border-b b-line-soft pb-1.5 text-[10.5px] font-semibold tx1">{rtl ? "کاتالوگ مهاجرت" : "Migration catalogue"}</h4>
            <div className="space-y-1.5">
              {MIGRATIONS.map((m) => {
                const done = (applied ?? []).some((a) => a.version === m.version);
                return (
                  <div key={m.version} className="glass-row rounded-xl px-2.5 py-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-[10px] tx1" dir="ltr">{m.version}</span>
                      <span className="text-[9.5px] font-light tx2" dir="ltr">{m.name}</span>
                      <span className={`ms-auto rounded px-1.5 py-0.5 text-[8px] ${done ? "bg-emerald-400/15 text-emerald-300" : "bg-amber-400/15 text-amber-200"}`}>
                        {done ? (rtl ? "اجرا شده" : "applied") : rtl ? "معلق" : "pending"}
                      </span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-2 text-[8px] font-extralight tx4" dir="ltr">
                      <span>{m.statements.length} statements</span>
                      <span>{checksumOf(m.statements)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="glass-dark rounded-2xl p-3">
            <h4 className="mb-2 border-b b-line-soft pb-1.5 text-[10.5px] font-semibold tx1">{rtl ? "وضعیت پایگاه داده" : "Database state"}</h4>
            {applied === null ? (
              <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-2.5 text-[9px] text-amber-200">
                {rtl ? "وضعیت اجراشده‌ها از API خوانده نشد؛ همهٔ مهاجرت‌ها معلق فرض می‌شوند." : "Applied state unavailable from the API; all migrations assumed pending."}
              </div>
            ) : (
              <div className={`rounded-xl border p-2.5 ${plan.upToDate ? "border-emerald-400/30 bg-emerald-400/10" : "border-amber-400/30 bg-amber-400/10"}`}>
                <div className={`text-[11px] font-bold ${plan.upToDate ? "text-emerald-300" : "text-amber-200"}`}>
                  {plan.upToDate ? (rtl ? "پایگاه داده به‌روز است" : "Database is up to date") : rtl ? "مهاجرت معلق دارید" : "Pending migrations"}
                </div>
                <div className="mt-0.5 text-[9px] tx2">
                  {rtl ? `${applied.length} اجرا شده · ${plan.pending.length} معلق` : `${applied.length} applied · ${plan.pending.length} pending`}
                </div>
              </div>
            )}

            {plan.drift.length > 0 && (
              <div className="mt-2 rounded-xl border border-rose-400/30 bg-rose-400/10 p-2.5">
                <div className="text-[10px] font-bold text-rose-300">{rtl ? "واگرایی چک‌سام" : "Checksum drift"}</div>
                <p className="mt-0.5 text-[8.5px] tx2">
                  {rtl
                    ? "اسکریپت مهاجرتی که قبلاً اجرا شده ویرایش شده است. این خطرناک‌ترین حالت است چون کد و پایگاه داده بی‌سروصدا واگرا می‌شوند."
                    : "A migration that was already applied has been edited — code and database silently diverge."}
                </p>
                {plan.drift.map((d) => (
                  <div key={d.version} className="mt-1 font-mono text-[8px] text-rose-200" dir="ltr">
                    {d.version}: expected {d.expected} · found {d.found}
                  </div>
                ))}
              </div>
            )}

            {plan.missingLocally.length > 0 && (
              <div className="mt-2 rounded-xl border border-orange-400/30 bg-orange-400/10 p-2.5 text-[8.5px] text-orange-200">
                {rtl ? "مهاجرت‌های ناشناخته در پایگاه داده: " : "Unknown migrations in database: "}
                <span dir="ltr">{plan.missingLocally.join(", ")}</span>
              </div>
            )}

            <p className="mt-2 rounded-lg bg-sky-400/10 px-2 py-1.5 text-[8.5px] text-sky-200">
              {rtl
                ? "اجرای مهاجرت با POST /api/data/migrate انجام می‌شود و در صورت واگرایی چک‌سام با کد ۴۰۹ متوقف می‌شود."
                : "Run migrations with POST /api/data/migrate; it halts with 409 if checksum drift is detected."}
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
