import { useEffect, useState } from "react";
import { type Lang } from "../data/framework";
import {
  BACKEND_SAMPLE,
  TABLES,
  defaultSqlConfig,
  loadSqlConfig,
  runQuery,
  saveSqlConfig,
  testConnection,
  type ConnectionStatus,
  type PingResult,
  type SqlConfig,
  type TableKey,
} from "../services/sqlServer";
import { PMIS_CORE_SCHEMA_SCRIPT } from "../services/pmisSchema";
import { PMIS_ENDPOINTS } from "../services/pmisContract";

export default function SqlConnectionPanel({ lang }: { lang: Lang }) {
  const rtl = lang === "fa";
  const [cfg, setCfg] = useState<SqlConfig>(loadSqlConfig);
  const [status, setStatus] = useState<ConnectionStatus>("offline");
  const [ping, setPing] = useState<PingResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"connection" | "contract" | "schema" | "query" | "backend">("connection");
  const [sqlText, setSqlText] = useState("SELECT TOP 20 * FROM dbo.Project_Master");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => { saveSqlConfig(cfg); }, [cfg]);

  const set = <K extends keyof SqlConfig>(k: K, v: SqlConfig[K]) => setCfg((p) => ({ ...p, [k]: v }));

  const doTest = async () => {
    setBusy(true);
    setStatus("connecting");
    const res = await testConnection(cfg);
    setPing(res);
    setStatus(res.status);
    setBusy(false);
  };

  const doQuery = async () => {
    setBusy(true);
    setQueryError(null);
    try {
      const data = await runQuery(cfg, sqlText);
      setRows(data as Record<string, unknown>[]);
    } catch (e) {
      setQueryError(e instanceof Error ? e.message : String(e));
      setRows([]);
    }
    setBusy(false);
  };

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 1800);
    } catch { /* ignore */ }
  };

  const download = (content: string, name: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const statusMeta: Record<ConnectionStatus, { color: string; fa: string; en: string }> = {
    connected: { color: "#34D399", fa: "متصل", en: "Connected" },
    connecting: { color: "#FBBF24", fa: "در حال اتصال…", en: "Connecting…" },
    offline: { color: "#94A3B8", fa: "آفلاین (localStorage)", en: "Offline (localStorage)" },
    error: { color: "#F87171", fa: "خطا", en: "Error" },
  };

  const field = (label: string, key: keyof SqlConfig, type: "text" | "password" | "number" = "text") => (
    <label className="flex flex-col gap-1">
      <span className="text-[9px] font-extralight tx3">{label}</span>
      <input
        type={type}
        value={String(cfg[key])}
        onChange={(e) => set(key, (type === "number" ? Number(e.target.value) : e.target.value) as never)}
        dir="ltr"
        className="w-full rounded-lg border b-line-soft bg-black/15 px-2.5 py-1.5 font-mono text-[11px] tx1 outline-none focus:border-sky-400"
      />
    </label>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden" dir={rtl ? "rtl" : "ltr"}>
      {/* Header + live status */}
      <section className="glass-dark shrink-0 rounded-2xl p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl border border-sky-400/40 bg-sky-400/10 text-[16px]">🗄</span>
          <div>
            <h3 className="text-[12.5px] font-semibold tx1">{rtl ? "اتصال به SQL Server" : "SQL Server Connection"}</h3>
            <p className="text-[8.5px] font-extralight tx3">
              {rtl ? "React → REST API → SQL Server (مرورگر مستقیم وصل نمی‌شود)" : "React → REST API → SQL Server (browser cannot connect directly)"}
            </p>
          </div>

          <span
            className="ms-auto flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-light"
            style={{ background: `${statusMeta[status].color}18`, border: `1px solid ${statusMeta[status].color}55`, color: statusMeta[status].color }}
          >
            <i className={`h-[7px] w-[7px] rounded-full ${status === "connected" ? "pulse-dot" : ""}`} style={{ background: statusMeta[status].color }} />
            {rtl ? statusMeta[status].fa : statusMeta[status].en}
            {ping?.ok && <span className="tabular-nums" dir="ltr"> · {ping.latencyMs}ms</span>}
          </span>

          <button
            onClick={doTest}
            disabled={busy}
            className="rounded-lg border border-emerald-400/55 bg-emerald-400/12 px-3 py-1.5 text-[10px] font-medium text-emerald-300 transition hover:bg-emerald-400/22 disabled:opacity-45"
          >
            ⚡ {busy ? (rtl ? "در حال تست…" : "Testing…") : (rtl ? "تست اتصال" : "Test Connection")}
          </button>
        </div>

        {ping && (
          <div className="mt-2 rounded-xl border b-line-soft bg-black/15 px-3 py-2 text-[9.5px] font-light" style={{ color: ping.ok ? "var(--ok)" : "#F87171" }}>
            {ping.ok ? "✓" : "✕"} {ping.message}
            {ping.serverVersion && <div className="mt-1 truncate text-[8.5px] font-extralight tx3" dir="ltr">{ping.serverVersion}</div>}
          </div>
        )}
      </section>

      {/* Tabs */}
      <nav className="flex shrink-0 flex-wrap gap-1.5 rounded-xl bg-black/15 p-1">
        {[
          { id: "connection" as const, fa: "تنظیمات اتصال", en: "Connection", icon: "🔌" },
          { id: "contract" as const, fa: "قرارداد API", en: "API Contract", icon: "↔" },
          { id: "schema" as const, fa: "اسکریپت دیتابیس", en: "Schema Script", icon: "📜" },
          { id: "query" as const, fa: "اجرای کوئری", en: "Query Runner", icon: "▶" },
          { id: "backend" as const, fa: "راه‌اندازی API", en: "API Setup", icon: "🖥" },
        ].map((x) => (
          <button
            key={x.id}
            onClick={() => setTab(x.id)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10.5px] font-light transition ${tab === x.id ? "toggle-on tx1" : "tx3 hover:tx2"}`}
          >
            <span>{x.icon}</span>{rtl ? x.fa : x.en}
          </button>
        ))}
      </nav>

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto pr-1">
        {/* ── Connection settings ── */}
        {tab === "connection" && (
          <div className="fade-rise space-y-3">
            <div className="glass-dark rounded-2xl p-4">
              <h4 className="mb-3 border-b b-line-soft pb-2 text-[11.5px] font-medium text-sky-300">
                {rtl ? "پارامترهای اتصال" : "Connection Parameters"}
              </h4>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {field(rtl ? "آدرس API بک‌اند" : "Backend API URL", "apiBaseUrl")}
                {field(rtl ? "نام سرور / اینستنس" : "Server / Instance", "server")}
                {field(rtl ? "نام دیتابیس" : "Database", "database")}
                {field(rtl ? "نام کاربری" : "Username", "user")}
                {field(rtl ? "رمز عبور" : "Password", "password", "password")}
                {field(rtl ? "مهلت پاسخ (ms)" : "Timeout (ms)", "timeoutMs", "number")}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-4 border-t b-line-soft pt-3">
                {[
                  { k: "useWindowsAuth" as const, fa: "احراز هویت ویندوز", en: "Windows Auth" },
                  { k: "encrypt" as const, fa: "رمزنگاری اتصال", en: "Encrypt" },
                  { k: "trustServerCertificate" as const, fa: "اعتماد به گواهی سرور", en: "Trust Certificate" },
                ].map((o) => (
                  <label key={o.k} className="flex cursor-pointer items-center gap-1.5 text-[10px] font-light tx2">
                    <input
                      type="checkbox"
                      checked={Boolean(cfg[o.k])}
                      onChange={(e) => set(o.k, e.target.checked as never)}
                      className="h-4 w-4 accent-sky-400"
                    />
                    {rtl ? o.fa : o.en}
                  </label>
                ))}
                <button
                  onClick={() => setCfg(defaultSqlConfig)}
                  className="ms-auto rounded-lg border border-rose-400/40 bg-rose-400/10 px-2.5 py-1 text-[9.5px] font-light text-rose-300"
                >
                  ↺ {rtl ? "بازنشانی" : "Reset"}
                </button>
              </div>

              <div className="mt-3 rounded-xl border b-line-soft bg-black/15 p-3">
                <div className="mb-1 text-[9px] font-extralight tx4">{rtl ? "رشته اتصال معادل:" : "Equivalent connection string:"}</div>
                <code className="block break-all text-[10px] text-sky-300" dir="ltr">
                  {cfg.useWindowsAuth
                    ? `Server=${cfg.server};Database=${cfg.database};Trusted_Connection=True;TrustServerCertificate=${cfg.trustServerCertificate};`
                    : `Server=${cfg.server};Database=${cfg.database};User Id=${cfg.user};Password=***;Encrypt=${cfg.encrypt};TrustServerCertificate=${cfg.trustServerCertificate};`}
                </code>
              </div>
              <p className="mt-2 text-[8.5px] font-extralight leading-4 text-amber-300">
                {rtl
                  ? "هشدار امنیتی: رمز SQL فقط برای تست محلی این نشست استفاده می‌شود و در مرورگر ذخیره نمی‌گردد. در محیط عملیاتی، اطلاعات اتصال و کلیدهای API باید فقط در تنظیمات امن Backend نگهداری شوند."
                  : "Security: the SQL password is used only for this local-session test and is never persisted in the browser. Production secrets must live only in secure backend configuration."}
              </p>
            </div>

            <div className="glass-dark rounded-2xl p-4">
              <h4 className="mb-2 text-[11.5px] font-medium tx1">{rtl ? "جداول نگاشت‌شده" : "Mapped Tables"}</h4>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {(Object.keys(TABLES) as TableKey[]).map((k) => (
                  <div key={k} className="rounded-lg border b-line-soft bg-black/10 px-2.5 py-1.5">
                    <div className="text-[8px] font-extralight tx4">{k}</div>
                    <div className="truncate font-mono text-[10px] text-sky-300" dir="ltr">dbo.{TABLES[k]}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Typed REST contract ── */}
        {tab === "contract" && (
          <div className="fade-rise glass-dark rounded-2xl p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h4 className="text-[11.5px] font-medium text-sky-300">{rtl ? "قرارداد REST API بین رابط و Backend" : "REST API Contract: Client to Backend"}</h4>
              <span className="ms-auto rounded-md border border-sky-400/35 bg-sky-400/10 px-2 py-0.5 text-[8.5px] font-light text-sky-200">
                {PMIS_ENDPOINTS.length} {rtl ? "مسیر تعریف‌شده" : "defined routes"}
              </span>
            </div>
            <p className="mb-3 text-[9.5px] font-extralight leading-5 tx3">
              {rtl
                ? "این قرارداد Typed منبع مشترک پیاده‌سازی Backend و اتصال تدریجی رابط کاربری است. هر endpoint به جدول یا Entity مشخص SQL Server نگاشت شده است."
                : "This typed contract is the shared implementation source for the backend and incremental frontend integration. Every route maps to a SQL Server entity."}
            </p>
            <div className="thin-scroll max-h-[54vh] overflow-auto rounded-xl border b-line-soft">
              <table className="w-full min-w-[720px] border-collapse text-[10px]">
                <thead>
                  <tr className="border-b b-line-soft bg-black/25 text-[8.5px] font-extralight tx3">
                    <th className="px-3 py-2 text-start">Method</th>
                    <th className="px-3 py-2 text-start">Path</th>
                    <th className="px-3 py-2 text-start">SQL Entity</th>
                    <th className="px-3 py-2 text-start">{rtl ? "کارکرد" : "Purpose"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y b-line-soft">
                  {PMIS_ENDPOINTS.map((endpoint) => {
                    const methodColor = endpoint.method === "GET" ? "#60A5FA" : endpoint.method === "POST" ? "#34D399" : endpoint.method === "PATCH" ? "#FBBF24" : "#F87171";
                    return (
                      <tr key={`${endpoint.method}-${endpoint.path}`} className="hover:bg-white/[0.03]">
                        <td className="px-3 py-2"><span className="rounded px-1.5 py-0.5 text-[8.5px] font-medium" style={{ background: `${methodColor}1a`, color: methodColor }}>{endpoint.method}</span></td>
                        <td className="px-3 py-2 font-mono text-[10px] tx1" dir="ltr">/api{endpoint.path}</td>
                        <td className="px-3 py-2 font-mono text-[9.5px] text-sky-300" dir="ltr">dbo.{endpoint.entity}</td>
                        <td className="px-3 py-2 font-light tx2">{endpoint.descriptionFa}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Schema script ── */}
        {tab === "schema" && (
          <div className="fade-rise glass-dark rounded-2xl p-4">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h4 className="text-[11.5px] font-medium text-sky-300">{rtl ? "اسکریپت ساخت دیتابیس و جداول" : "Database & Tables Bootstrap Script"}</h4>
              <div className="ms-auto flex gap-1.5">
                <button onClick={() => copy(PMIS_CORE_SCHEMA_SCRIPT, "schema")} className="rounded-lg border b-line-soft px-2.5 py-1 text-[9.5px] tx2 hover:tx1">
                  {copied === "schema" ? "✓ " : "⧉ "}{rtl ? "کپی" : "Copy"}
                </button>
                <button onClick={() => download(PMIS_CORE_SCHEMA_SCRIPT, "PMIS_Core_Schema.sql")} className="rounded-lg border border-sky-400/40 bg-sky-400/10 px-2.5 py-1 text-[9.5px] text-sky-200">
                  ⬇ {rtl ? "دانلود .sql" : "Download .sql"}
                </button>
              </div>
            </div>
            <p className="mb-2 text-[9.5px] font-extralight tx3">
              {rtl ? "این اسکریپت را در SQL Server Management Studio اجرا کنید تا دیتابیس و جداول ساخته شوند." : "Run this in SQL Server Management Studio to create the database and tables."}
            </p>
            <pre className="thin-scroll max-h-[52vh] overflow-auto rounded-xl bg-black/40 p-3 text-[10px] leading-5 text-emerald-200" dir="ltr">{PMIS_CORE_SCHEMA_SCRIPT}</pre>
          </div>
        )}

        {/* ── Query runner ── */}
        {tab === "query" && (
          <div className="fade-rise space-y-3">
            <div className="glass-dark rounded-2xl p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h4 className="text-[11.5px] font-medium text-sky-300">{rtl ? "اجرای کوئری روی دیتابیس" : "Run Query on Database"}</h4>
                <button onClick={doQuery} disabled={busy} className="ms-auto rounded-lg border border-emerald-400/55 bg-emerald-400/12 px-3 py-1 text-[10px] font-medium text-emerald-300 disabled:opacity-45">
                  ▶ {busy ? (rtl ? "در حال اجرا…" : "Running…") : (rtl ? "اجرا" : "Run")}
                </button>
              </div>
              <textarea
                value={sqlText}
                onChange={(e) => setSqlText(e.target.value)}
                dir="ltr"
                className="h-28 w-full resize-none rounded-xl border b-line-soft bg-black/30 p-3 font-mono text-[11px] text-sky-200 outline-none focus:border-sky-400"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(Object.keys(TABLES) as TableKey[]).slice(0, 8).map((k) => (
                  <button
                    key={k}
                    onClick={() => setSqlText(`SELECT TOP 50 * FROM dbo.${TABLES[k]}`)}
                    className="rounded-md border b-line-soft px-2 py-0.5 text-[9px] font-light tx3 hover:tx1"
                    dir="ltr"
                  >
                    {TABLES[k]}
                  </button>
                ))}
              </div>
              {queryError && (
                <div className="mt-2 rounded-lg border border-rose-400/40 bg-rose-400/10 px-3 py-2 text-[10px] text-rose-300">✕ {queryError}</div>
              )}
            </div>

            <div className="glass-dark rounded-2xl p-3">
              <div className="mb-2 text-[10.5px] font-normal tx1">
                {rtl ? "نتیجه:" : "Result:"} <span className="tabular-nums tx3">{rows.length}</span> {rtl ? "ردیف" : "rows"}
              </div>
              {rows.length === 0 ? (
                <div className="grid h-32 place-items-center text-[10px] font-extralight tx4">
                  {rtl ? "نتیجه‌ای برای نمایش وجود ندارد." : "No results to display."}
                </div>
              ) : (
                <div className="thin-scroll max-h-[42vh] overflow-auto">
                  <table className="w-full border-collapse text-[10px]">
                    <thead>
                      <tr className="border-b b-line-soft bg-black/25 text-[8.5px] font-extralight tx3">
                        {Object.keys(rows[0]).map((c) => (<th key={c} className="px-2 py-1.5 text-start" dir="ltr">{c}</th>))}
                      </tr>
                    </thead>
                    <tbody className="divide-y b-line-soft">
                      {rows.map((r, i) => (
                        <tr key={i}>
                          {Object.keys(rows[0]).map((c) => (
                            <td key={c} className="px-2 py-1 font-light tx2" dir="ltr">{String(r[c] ?? "")}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Backend setup ── */}
        {tab === "backend" && (
          <div className="fade-rise space-y-3">
            <div className="glass-dark rounded-2xl p-4">
              <h4 className="mb-2 text-[11.5px] font-medium text-amber-300">{rtl ? "چرا به API نیاز است؟" : "Why is an API required?"}</h4>
              <p className="text-[10.5px] font-light leading-6 tx2">
                {rtl
                  ? "مرورگرها به دلایل امنیتی اجازه اتصال مستقیم TCP به SQL Server را نمی‌دهند. بنابراین یک سرویس واسط (Node.js یا .NET) لازم است که روی همان شبکه‌ی دیتابیس اجرا شود و درخواست‌های REST این برنامه را به SQL Server منتقل کند."
                  : "Browsers cannot open raw TCP connections to SQL Server. A thin backend service (Node.js or .NET) must run on the database network and relay REST requests from this app to SQL Server."}
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                {[
                  { n: "1", fa: "اجرای اسکریپت اسکیما در SSMS", en: "Run schema script in SSMS" },
                  { n: "2", fa: "راه‌اندازی سرویس API با کد زیر", en: "Start the API service below" },
                  { n: "3", fa: "تست اتصال از تب اول", en: "Test connection from first tab" },
                ].map((s) => (
                  <div key={s.n} className="rounded-xl border b-line-soft bg-black/15 p-3">
                    <div className="mb-1 grid h-6 w-6 place-items-center rounded-full bg-sky-400/20 text-[10px] font-medium text-sky-300">{s.n}</div>
                    <div className="text-[10px] font-light tx1">{rtl ? s.fa : s.en}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-dark rounded-2xl p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h4 className="text-[11.5px] font-medium text-sky-300">{rtl ? "کد آماده سرویس Node.js" : "Ready-made Node.js service"}</h4>
                <div className="ms-auto flex gap-1.5">
                  <button onClick={() => copy(BACKEND_SAMPLE, "backend")} className="rounded-lg border b-line-soft px-2.5 py-1 text-[9.5px] tx2 hover:tx1">
                    {copied === "backend" ? "✓ " : "⧉ "}{rtl ? "کپی" : "Copy"}
                  </button>
                  <button onClick={() => download(BACKEND_SAMPLE, "server.js")} className="rounded-lg border border-sky-400/40 bg-sky-400/10 px-2.5 py-1 text-[9.5px] text-sky-200">
                    ⬇ server.js
                  </button>
                </div>
              </div>
              <div className="mb-2 rounded-lg bg-black/25 px-3 py-1.5 font-mono text-[10px] text-emerald-300" dir="ltr">npm i express cors mssql &amp;&amp; node server.js</div>
              <pre className="thin-scroll max-h-[46vh] overflow-auto rounded-xl bg-black/40 p-3 text-[10px] leading-5 text-sky-200" dir="ltr">{BACKEND_SAMPLE}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
