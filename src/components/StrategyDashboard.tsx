import { useEffect, useState } from "react";
import { t, type Lang, type Process } from "../data/framework";
import { useAuth } from "../context/AuthContext";
import { jsonRequest } from "../services/apiClient";
import { PERSPECTIVES, type StrategyInput, type Persisted, type SxWorkspace, type strategyMetrics } from "../services/strategyExcellenceWorkspace";

type Saved = Persisted<StrategyInput> & { metrics: ReturnType<typeof strategyMetrics> };
export default function StrategyDashboard({ projectId, lang, onOpenWorkspace, onOpenProcess, processes }: { projectId: string; lang: Lang; onOpenWorkspace: () => void; onOpenProcess: (id: string) => void; processes: Process[] }) {
  const fa = lang === "fa";
  const { user } = useAuth();
  const [data, setData] = useState<SxWorkspace<Saved> | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const r = await jsonRequest<SxWorkspace<Saved>>(`/api/spm/${encodeURIComponent(projectId)}/workspace`, user?.id ?? null, "GET");
      if (!alive) return;
      setLoading(false);
      if (r.ok) { setData(r.data); setError(""); }
      else { setData(null); setError(r.message); }
    };
    void load();
    const timer = window.setInterval(load, 30000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [projectId, user?.id]);
  const latest = data?.records.reduce<Saved | null>((best, row) => !best || (row.UpdatedAt ?? row.CreatedAt) > (best.UpdatedAt ?? best.CreatedAt) ? row : best, null) ?? null;
  const pct = (n: number | null | undefined) => n == null ? "—" : `${(n * 100).toLocaleString(fa ? "fa-IR" : "en-US", { maximumFractionDigits: 1 })}٪`;
  return <div className="thin-scroll h-full min-h-0 overflow-y-auto p-3 md:p-5" dir={fa ? "rtl" : "ltr"}>
    <div className="mx-auto max-w-5xl space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-[10px] text-pink-300">BSC · {fa ? "دادهٔ ذخیره‌شدهٔ پروژه" : "Project's persisted data"}</p><h2 className="mt-1 text-lg font-semibold tx1">{fa ? "داشبورد مدیریت استراتژیک" : "Strategic management dashboard"}</h2><p className="text-[11px] tx3">{latest ? `${latest.TitleFa} · ${latest.DataDate}` : fa ? "نمای کلی پیش از ورود به زیرفرایندها" : "Overview before entering sub-processes"}</p></div>
        <button type="button" onClick={onOpenWorkspace} className="glass-row rounded-lg border b-line-soft px-3 py-2 text-[11px] tx1">{fa ? "ورود به میز کار و ثبت داده ←" : "Open workspace & enter data →"}</button>
      </header>
      {loading && <p role="status" className="tx3 text-xs">{fa ? "در حال دریافت داده…" : "Loading live data…"}</p>}
      {error && <p role="alert" className="rounded-xl border border-rose-400/30 p-3 text-xs text-rose-300">{error}</p>}
      {!loading && !error && !latest && <div className="glass-dark rounded-xl p-5 text-xs tx2">{fa ? "هنوز برنامهٔ استراتژیک ذخیره نشده است؛ آماری به جای دادهٔ واقعی ساخته نمی‌شود. برای شروع به میز کار بروید." : "No saved strategic plan yet. No placeholder metrics are shown; open the workspace to begin."}</div>}
      {latest && <>
        <section className="glass-dark rounded-xl border b-line-soft p-4"><h3 className="text-xs font-semibold tx1">{fa ? "تحقق چهار منظر BSC" : "Four BSC perspectives"}</h3><div className="mt-4 grid gap-3 sm:grid-cols-2">{latest.metrics.perspectives.map(p => <div key={p.code}><div className="mb-1 flex justify-between text-[11px] tx2"><span>{PERSPECTIVES.find(x => x.code === p.code)?.label[lang] ?? p.code}</span><span>{pct(p.attainment)}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-500/20"><div className="h-full rounded-full bg-pink-400" style={{ width: `${Math.max(0, Math.min(100, (p.attainment ?? 0) * 100))}%` }} /></div></div>)}</div><p className="mt-3 text-[10px] tx3">{fa ? "خط خالی یعنی دادهٔ کافی برای محاسبه وجود ندارد؛ صفر در نظر گرفته نمی‌شود." : "An empty bar may indicate missing data; missing is not treated as zero."}</p></section>
      </>}
      <section className="glass-dark rounded-xl border b-line-soft p-4"><h3 className="text-xs font-semibold tx1">{fa ? "مسیر کاری" : "Work path"}</h3><p className="mt-2 text-[11px] tx3">{fa ? "برای دیدن جزئیات یکی از فرایندها را از سایدبار سمت راست انتخاب کنید. برای ایجاد یا اصلاح برنامه، شاخص و ابتکار، از میز کار استفاده کنید." : "Choose a process on the right for details. Use the workspace to enter or update plans, KPIs and initiatives."}</p><div className="mt-3 flex flex-wrap gap-2">{processes.map(process => process.subs[0] && <button key={process.id} onClick={() => onOpenProcess(process.subs[0].id)} className="glass-row rounded-lg border b-line-soft px-3 py-2 text-[11px] tx1">{t(process.title, lang)} {fa ? "←" : "→"}</button>)}</div></section>
      {latest && <p className="text-[10px] tx3">{fa ? "آخرین ثبت" : "Last saved"}: <span dir="ltr">{latest.UpdatedAt ?? latest.CreatedAt}</span> · {fa ? "این داده‌ها اظهار پروژه‌اند، نه تجمیع خودکار سازمان." : "Project-declared data, not an automatic organizational rollup."}</p>}
    </div>
  </div>;
}
