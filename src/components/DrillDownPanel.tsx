/**
 * P9 / MIX-1 — پیمایش سلسله‌مراتبی: سبد ← پروژه ← فاز ← اقلام.
 *
 * سطح سبد و شمارش هر بخش از سرور می‌آید؛ بخشی که کاربر مجوزش را ندارد با
 * «بدون دسترسی» نمایش داده می‌شود، نه صفر. کلیک روی فاز، همان بخش را در آن
 * فاز فیلتر می‌کند و اقلام را از سرور می‌گیرد.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Lang } from "../data/framework";
import { useAuth } from "../context/AuthContext";
import { useSystem } from "../context/SystemContext";
import { DrillClient, type DrillItem, type DrillPayload, type DrillPortfolio } from "../services/drillApi";

const inputCls = "glass-row w-full rounded-lg border b-line-soft px-2.5 py-1.5 text-[10.5px] font-light tx1 outline-none focus:b-line";
const chipCls = "rounded-lg border b-line-soft px-2.5 py-1 text-[9.5px] font-light transition disabled:opacity-40";
const fx = (n: number | null | undefined, digits = 0) => (n === null || n === undefined ? "—" : Number(n).toLocaleString("en-US", { maximumFractionDigits: digits }));
const STATUS_TONE: Record<string, string> = { ready: "tx1", empty: "tx4", restricted: "text-amber-300", unavailable: "text-rose-300", too_large: "text-rose-300" };

export default function DrillDownPanel({ lang }: { lang: Lang }) {
  const rtl = lang === "fa";
  const T = (fa: string, en: string) => (rtl ? fa : en);
  const { projectScope } = useSystem();
  const { user } = useAuth();
  const projectId = projectScope?.projectId ?? "";
  const client = useMemo(() => new DrillClient(projectId, user?.id ?? null), [projectId, user?.id]);

  const [portfolio, setPortfolio] = useState<DrillPortfolio | null>(null);
  const [openProject, setOpenProject] = useState<string>(projectId);
  const [drill, setDrill] = useState<DrillPayload | null>(null);
  const [section, setSection] = useState<string>("");
  const [phase, setPhase] = useState<string>("");
  const [items, setItems] = useState<DrillItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const loadPortfolio = useCallback(async () => {
    if (!projectId) return;
    const r = await client.portfolio();
    if (r.ok) { setPortfolio(r.data); setErr(null); }
    else setErr(`${r.message} (${r.code})`);
  }, [client, projectId]);
  useEffect(() => { void loadPortfolio(); }, [loadPortfolio]);

  const loadDrill = useCallback(async (pid: string, nextSection?: string, nextPhase?: string) => {
    setBusy(true);
    const r = await client.drillOf(pid, nextSection ?? undefined, nextPhase ?? undefined, 50);
    setBusy(false);
    if (!r.ok) { setDrill(null); setItems(null); setErr(`${r.message} (${r.code})`); return; }
    setErr(null);
    setDrill(r.data);
    setItems(r.data.items);
  }, [client]);

  useEffect(() => {
    if (!openProject) return;
    setSection("");
    setPhase("");
    setItems(null);
    void loadDrill(openProject);
  }, [openProject, loadDrill]);

  const pickSection = useCallback(async (key: string) => {
    setSection(key);
    setPhase("");
    await loadDrill(openProject, key);
  }, [loadDrill, openProject]);

  const pickPhase = useCallback(async (key: string) => {
    if (!section) return;
    setPhase(key);
    await loadDrill(openProject, section, key);
  }, [loadDrill, openProject, section]);

  if (!projectId) return <div className="p-4 text-[10.5px] font-light tx3">{T("پروژه‌ای انتخاب نشده است.", "No project selected.")}</div>;

  const sectionsOfOpen = drill?.sections ?? [];
  const restrictionCount = sectionsOfOpen.filter((s) => s.restricted).length;

  return (
    <div dir={rtl ? "rtl" : "ltr"} className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10.5px] font-light tx2">{T("پیمایش سبد ← پروژه ← فاز ← اقلام", "Drill-down: portfolio → project → phase → items")}</span>
        <select value={openProject} onChange={(ev) => setOpenProject(ev.target.value)} className={`${inputCls} max-w-56`} style={{ colorScheme: "dark" }}>
          <option value={projectId}>{T("پروژهٔ جاری", "Current project")}: {projectId}</option>
          {(portfolio?.projects ?? []).filter((p) => p.projectId !== projectId).map((p) => (
            <option key={p.projectId} value={p.projectId}>{p.code ?? p.projectId}</option>
          ))}
        </select>
        <span className="ms-auto text-[9px] tx4" dir="ltr">{drill?.modelVersion ?? "mcs-drill-v1"}</span>
        <button onClick={() => void loadPortfolio()} className="rounded-lg px-2.5 py-1 text-[9.5px] font-light tx3 transition hover:tx1">↻ {T("بازخوانی", "Refresh")}</button>
      </div>
      {err && <div className="rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-[10px] text-rose-200">{err}</div>}

      <section className="glass-dark rounded-2xl p-3">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="text-[11px] font-normal tx1">{T("۱) سبد پروژه‌ها", "1) Portfolio")}</h4>
          <span className="text-[8.5px] font-extralight tx3">
            {portfolio ? `${portfolio.metrics.projects} ${T("پروژه", "projects")} · ${portfolio.metrics.readable} ${T("بخش خواندنی", "readable sections")}` : ""}
          </span>
        </div>
        <div className="space-y-1">
          {(portfolio?.projects ?? []).map((p) => (
            <button
              key={p.projectId}
              onClick={() => setOpenProject(p.projectId)}
              className={`flex w-full flex-wrap items-center gap-2 rounded-lg border px-2.5 py-1.5 text-start text-[10px] transition ${openProject === p.projectId ? "toggle-on tx1" : "b-line-soft tx2 hover:tx1"}`}
            >
              <span className="font-mono text-[9.5px] text-sky-300" dir="ltr">{p.code ?? p.projectId}</span>
              <span className="truncate">{p.title ?? p.projectId}</span>
              <span className="ms-auto tabular-nums tx3" dir="ltr">{fx(p.total)}</span>
            </button>
          ))}
          {portfolio && portfolio.projects.length === 0 && <div className="text-[10px] tx4">{T("پروژه‌ای در دامنهٔ شما نیست.", "No project in your scope.")}</div>}
        </div>
      </section>

      <section className="glass-dark rounded-2xl p-3">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="text-[11px] font-normal tx1">{T("۲) بخش‌ها در پروژه", "2) Sections in project")}</h4>
          <span className="text-[8.5px] font-extralight tx3">
            {drill ? `${drill.projectCode ?? drill.projectId}${restrictionCount ? ` · ${restrictionCount} ${T("بخش بدون دسترسی", "restricted")}` : ""}` : ""}
          </span>
        </div>
        {drill?.warning && <div className="mb-2 rounded-lg border b-line-soft px-2.5 py-1.5 text-[9px] text-amber-300">{drill.warning}</div>}
        <div className="grid gap-1.5 sm:grid-cols-2">
          {sectionsOfOpen.map((s) => (
            <button
              key={s.key}
              onClick={() => void pickSection(s.key)}
              disabled={s.restricted}
              className={`flex flex-wrap items-center gap-2 rounded-lg border px-2.5 py-1.5 text-start text-[10px] transition ${section === s.key ? "toggle-on tx1" : "b-line-soft"} ${s.restricted ? "opacity-60" : "hover:tx1"}`}
            >
              <span className="tx2">{rtl ? s.label.fa : s.label.en}</span>
              <span className={`ms-auto tabular-nums ${STATUS_TONE[s.state] ?? "tx3"}`} dir="ltr">
                {s.restricted ? T("بدون دسترسی", "restricted") : s.count === null ? "—" : fx(s.count)}
              </span>
              {s.amount !== null && <span className="tabular-nums text-[9px] tx4" dir="ltr">{fx(s.amount, 0)}</span>}
            </button>
          ))}
        </div>
      </section>

      <section className="glass-dark rounded-2xl p-3">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="text-[11px] font-normal tx1">{T("۳) فازها", "3) Phases")}</h4>
          <span className="text-[8.5px] font-extralight tx3">{T("شمارش بخش انتخاب‌شده در هر فاز", "counts of the selected section per phase")}</span>
        </div>
        {!section && <div className="text-[10px] tx4">{T("برای شمارش فازها، یک بخش را انتخاب کنید.", "Pick a section to see per-phase counts.")}</div>}
        {section && drill && (
          <div className="space-y-1">
            <button onClick={() => void pickPhase("")} className={`${chipCls} ${phase === "" ? "toggle-on tx1" : "tx3"}`}>{T("همهٔ فازها", "All phases")}</button>
            {drill.phases.filter((p) => p.counts[section]).map((p) => (
              <button
                key={p.id}
                onClick={() => void pickPhase(p.code)}
                className={`flex w-full flex-wrap items-center gap-2 rounded-lg border px-2.5 py-1.5 text-start text-[10px] transition ${phase === p.code ? "toggle-on tx1" : "b-line-soft tx2 hover:tx1"}`}
              >
                <span className="font-mono text-[9.5px] text-emerald-300" dir="ltr">{p.code}</span>
                <span className="truncate">{p.title}</span>
                <span className="ms-auto tabular-nums tx2" dir="ltr">{fx(p.counts[section])}</span>
              </button>
            ))}
            {drill.unphased[section] ? (
              <button onClick={() => void pickPhase("__unphased")} className={`${chipCls} ${phase === "__unphased" ? "toggle-on tx1" : "text-amber-300"}`}>
                {T("بدون فاز", "Unphased")}: <b className="tabular-nums" dir="ltr">{fx(drill.unphased[section])}</b>
              </button>
            ) : null}
            {drill.phases.every((p) => !p.counts[section]) && !drill.unphased[section] && (
              <div className="text-[10px] tx4">{T("این بخش در هیچ فازی ردیفی ندارد.", "This section has no rows in any phase.")}</div>
            )}
          </div>
        )}
      </section>

      <section className="glass-dark rounded-2xl p-3">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="text-[11px] font-normal tx1">{T("۴) اقلام", "4) Items")}</h4>
          <span className="text-[8.5px] font-extralight tx3">{busy ? T("در حال خواندن…", "loading…") : drill?.itemsSection ? `${drill.itemsSection.key} · ${drill.itemsSection.permission}` : ""}</span>
        </div>
        {drill?.itemsSection && !drill.itemsSection.readable && (
          <div className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-2.5 py-1.5 text-[10px] text-amber-200">{T("مجوز دیدن این بخش را ندارید.", "You lack permission for this section.")}</div>
        )}
        {items && items.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-[10px] font-light">
              <thead className="tx3">
                <tr>
                  <th className="px-1.5 py-1 text-start">{T("کد", "Code")}</th>
                  <th className="px-1.5 py-1 text-start">{T("عنوان", "Title")}</th>
                  <th className="px-1.5 py-1 text-start">{T("وضعیت", "Status")}</th>
                  <th className="px-1.5 py-1 text-start">{T("تاریخ", "Date")}</th>
                  <th className="px-1.5 py-1 text-start">{T("مبلغ/امتیاز", "Amount/score")}</th>
                  <th className="px-1.5 py-1 text-start">{T("فاز", "Phase")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-t b-line-soft">
                    <td className="px-1.5 py-1 font-mono text-[9.5px] tx2" dir="ltr">{it.code || "—"}</td>
                    <td className="px-1.5 py-1 tx1">{it.title}</td>
                    <td className="px-1.5 py-1 tx3">{it.status ?? "—"}</td>
                    <td className="px-1.5 py-1 tabular-nums tx3" dir="ltr">{it.date ?? "—"}</td>
                    <td className="px-1.5 py-1 tabular-nums tx3" dir="ltr">{it.amount === null ? "—" : fx(it.amount, 2)}</td>
                    <td className="px-1.5 py-1 font-mono text-[9.5px] tx3" dir="ltr">{it.phaseCode ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {section && items && items.length === 0 && <div className="text-[10px] tx4">{T("ردیفی با این فیلتر نیست.", "No rows for this filter.")}</div>}
        {!section && <div className="text-[10px] tx4">{T("یک بخش را انتخاب کنید تا اقلامش بیاید.", "Pick a section to list its items.")}</div>}
      </section>

      <div className="px-1 text-[9px] tx4">
        {T(
          "بخشِ بی‌مجوز با «بدون دسترسی» می‌آید و شمارشش خالی است؛ «ندیدن» با «صفر بودن» یکی نمی‌شود.",
          "Restricted sections show “restricted” with an empty count: not seeing is not the same as zero.",
        )}
      </div>
    </div>
  );
}
