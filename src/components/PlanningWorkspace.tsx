import { useEffect, useMemo, useState } from "react";
import { t, type Lang } from "../data/framework";
import { PEX_SCURVE } from "../data/pexProject";
import { buildPexModel } from "../services/pexModel";
import { canPostProgress, type WeightMode } from "../services/planning";
import { getSchedule, type ApiSchedule } from "../services/pexApiClient";

export type PexTab =
  | "dashboard"
  | "wbs"
  | "gantt"
  | "baseline"
  | "milestone"
  | "cp"
  | "lookahead"
  | "dpr"
  | "weekly"
  | "mpr"
  | "reports"
  | "alerts"
  | "template"
  | "roc";

const TABS: { id: PexTab; fa: string; en: string }[] = [
  { id: "dashboard", fa: "داشبورد", en: "Dashboard" },
  { id: "wbs", fa: "WBS", en: "WBS" },
  { id: "gantt", fa: "گانت", en: "Gantt" },
  { id: "baseline", fa: "Baseline", en: "Baseline" },
  { id: "milestone", fa: "مایلستون", en: "Milestone" },
  { id: "cp", fa: "مسیر بحرانی", en: "Critical Path" },
  { id: "lookahead", fa: "نگاه‌به‌جلو", en: "Look-ahead" },
  { id: "dpr", fa: "گزارش روزانه", en: "DPR" },
  { id: "weekly", fa: "هفتگی", en: "Weekly" },
  { id: "mpr", fa: "ماهانه", en: "MPR" },
  { id: "reports", fa: "گزارش‌ساز", en: "Reports" },
  { id: "alerts", fa: "هشدار", en: "Alerts" },
  { id: "template", fa: "قالب AI", en: "Templates" },
  { id: "roc", fa: "RoC", en: "RoC" },
];

const STATUS_COLOR: Record<string, string> = {
  OnTrack: "#8FE3C8",
  AtRisk: "#FFD48A",
  Delayed: "#FF9F9F",
  Achieved: "#7FB2FF",
  Cancelled: "#9AA4B2",
};

const SEV_COLOR: Record<string, string> = {
  warning: "#FFD48A",
  critical: "#FF9F9F",
  emergency: "#FF7A7A",
};

const fmtNum = (n: number) => n.toLocaleString("en-US");
const dayIndex = (iso: string) => Math.round(Date.parse(iso) / 86_400_000);

export default function PlanningWorkspace({
  lang,
  initialTab = "dashboard",
  hideTabs = false,
}: {
  lang: Lang;
  initialTab?: PexTab;
  hideTabs?: boolean;
}) {
  const rtl = lang === "fa";
  const [tab, setTab] = useState<PexTab>(initialTab);
  const [weightMode, setWeightMode] = useState<WeightMode>("Cost");
  const [alpha, setAlpha] = useState(0.6);
  const [ack, setAck] = useState<Record<string, boolean>>({});
  const [fmt, setFmt] = useState("PDF");
  const [kind, setKind] = useState("External");
  const [dprDate, setDprDate] = useState("2026-09-04");

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const [live, setLive] = useState<ApiSchedule | null>(null);

  useEffect(() => {
    let alive = true;
    getSchedule(weightMode, alpha).then((res) => {
      if (alive) setLive(res);
    });
    return () => {
      alive = false;
    };
  }, [weightMode, alpha]);

  const m = useMemo(() => buildPexModel(weightMode, alpha), [weightMode, alpha]);
  const dataDate = m.dataDate;

  const span = useMemo(() => {
    const from = dayIndex(m.baseline.projectStart);
    const to = Math.max(dayIndex(m.cpm.projectFinish), dayIndex(m.baseline.projectFinish));
    return { from, to, width: Math.max(1, to - from) };
  }, [m]);
  const barStyle = (start: string, finish: string) => ({
    marginInlineStart: `${((dayIndex(start) - span.from) / span.width) * 100}%`,
    width: `${Math.max(1.2, ((dayIndex(finish) - dayIndex(start)) / span.width) * 100)}%`,
  });

  const msCount = useMemo(() => {
    const c: Record<string, number> = {};
    for (const x of m.milestones) c[x.status] = (c[x.status] ?? 0) + 1;
    return c;
  }, [m]);

  const kpis = useMemo(
    () => [
      { k: rtl ? "پیشرفت واقعی" : "Actual", v: `${m.overallPct}%`, c: "#8FE3C8" },
      { k: rtl ? "برنامه‌ای" : "Planned", v: `${m.plannedPct}%`, c: "#7FB2FF" },
      { k: rtl ? "انحراف" : "Variance", v: `${m.variance.deltaPct > 0 ? "+" : ""}${m.variance.deltaPct}`, c: m.variance.status === "behind" ? "#FF9F9F" : "#8FE3C8" },
      { k: "PPC", v: `${m.ppcPct}%`, c: "#C9A7FF" },
      { k: rtl ? "سلامت زمان‌بندی" : "Health", v: String(m.dcma.healthScore), c: m.dcma.healthScore < 80 ? "#FFD48A" : "#8FE3C8" },
      { k: rtl ? "جریمه برآوردی" : "Penalty est.", v: `${Math.round(m.totalPenalty / 1000)}k`, c: "#FF9F9F" },
    ],
    [rtl, m]
  );

  const postGate = canPostProgress(m.openPeriod, dprDate);
  const lookahead = m.rows.filter((r) => r.physicalPct < 100 && r.es <= "2026-10-16" && !r.isMilestone);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden" dir={rtl ? "rtl" : "ltr"}>
      <section className="glass-dark shrink-0 rounded-2xl p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-emerald-400/40 bg-emerald-400/10 text-[15px]">🧭</span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[12px] font-semibold tx1">
              {rtl ? "برنامه‌ریزی و اجرای عملیات (PEX)" : "Planning & Execution (PEX)"}
            </h3>
            <p className="text-[8.5px] font-extralight tx3">
              {rtl
                ? "WBS ستون فقرات · Baseline قفل · Excel/XER ظرف · پیشرفت فقط Approved · Forecast مایلستون = CPM EF"
                : "WBS backbone · locked baseline · Excel/XER vessel · EV from Approved only · MS forecast = CPM EF"}
            </p>
          </div>
          <span className="rounded-lg border b-line-soft px-2 py-1 text-[9px] tx3" dir="ltr">{m.project.code} · DataDate {dataDate}</span>
          <span className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-[9px] text-emerald-200" dir="ltr">{m.cpm.formulaVersion}</span>
          <span
            className="rounded-lg px-2 py-1 text-[9px]"
            style={live ? { background: "#8FE3C822", color: "#8FE3C8" } : { background: "#FFD48A22", color: "#FFD48A" }}
            title={live ? "/api/pex/schedule" : rtl ? "بک‌اند در دسترس نیست؛ محاسبه محلی با همان موتور" : "backend unavailable; local engine"}
          >
            {live ? (rtl ? "داده زنده" : "live") : rtl ? "محاسبه محلی" : "local"}
          </span>
        </div>
      </section>

      {!hideTabs && (
        <nav className="flex shrink-0 flex-wrap items-center gap-1 rounded-xl bg-black/15 p-1">
          {TABS.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`rounded-lg px-2.5 py-1.5 text-[10px] font-light transition ${
                tab === item.id ? "toggle-on tx1 shadow-sm" : "tx3 hover:tx2"
              }`}
            >
              {rtl ? item.fa : item.en}
            </button>
          ))}
        </nav>
      )}

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto pr-1">
        {tab === "dashboard" && (
          <div className="fade-rise space-y-2">
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {kpis.map((c) => (
                <div key={c.k} className="glass-dark rounded-2xl p-3">
                  <div className="text-[8.5px] font-extralight tx3">{c.k}</div>
                  <div className="mt-1 text-[18px] font-semibold tabular-nums" style={{ color: c.c }}>{c.v}</div>
                </div>
              ))}
            </div>

            <div className="grid gap-2 md:grid-cols-3">
              <div className="glass-dark rounded-2xl p-3">
                <div className="text-[10.5px] font-normal tx1">{rtl ? "ویجت مایلستون" : "Milestone widget"}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {Object.entries(msCount).map(([st, n]) => (
                    <span key={st} className="rounded-lg px-2 py-1 text-[9px]" style={{ background: `${STATUS_COLOR[st]}22`, color: STATUS_COLOR[st] }}>
                      {n} {st}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-[9px] tx3">
                  {rtl ? "جریمه انباشته" : "Accrued penalty"} <span dir="ltr">{fmtNum(m.totalPenalty)} {m.project.currency}</span>
                </p>
              </div>

              <div className="glass-dark rounded-2xl p-3">
                <div className="text-[10.5px] font-normal tx1">{rtl ? "ویجت مسیر بحرانی" : "CP widget"}</div>
                <p className="mt-2 text-[10px] tx2" dir="ltr">
                  CP {m.cpm.criticalPath.length} act · len {m.cpm.cpLengthDays}d · BL {m.baseline.cpLengthDays}d
                </p>
                <p className="mt-1 text-[10px]" style={{ color: m.snapshot.drift > 10 ? "#FF9F9F" : m.snapshot.drift > 5 ? "#FFD48A" : "#8FE3C8" }} dir="ltr">
                  Drift {m.snapshot.drift > 0 ? "+" : ""}{m.snapshot.drift}d · Finish {m.cpm.projectFinish}
                </p>
                <p className="mt-1 text-[9px] tx3">{rtl ? "گام‌های مسدود بابت IR" : "Steps blocked by IR"}: {m.blockedCount}</p>
              </div>

              <div className="glass-dark rounded-2xl p-3">
                <div className="text-[10.5px] font-normal tx1">{rtl ? "منحنی S" : "S-curve"}</div>
                <div className="mt-2 flex h-12 items-end gap-1">
                  {PEX_SCURVE.map((p) => (
                    <div key={p.date} className="flex-1 rounded-t-sm bg-sky-400/35" style={{ height: `${Math.max(6, p.cumPct)}%` }} title={`${p.date} · ${p.cumPct}%`} />
                  ))}
                  <div className="flex-1 rounded-t-sm bg-emerald-400/60" style={{ height: `${Math.max(6, m.overallPct)}%` }} title={`${dataDate} · ${m.overallPct}%`} />
                </div>
                <p className="mt-1 text-[9px] tx3">{rtl ? "میله سبز: پیشرفت واقعی در Data Date" : "Green: actual at data date"}</p>
              </div>
            </div>

            <div className="glass-dark rounded-2xl p-3">
              <div className="mb-2 text-[10.5px] tx1">{rtl ? "پیشرفت بسته‌های کاری" : "Work package progress"}</div>
              {m.wbsRollup.map((w) => (
                <div key={w.id} className="mb-2 last:mb-0">
                  <div className="flex justify-between text-[9.5px] tx2">
                    <span>{w.id} · {rtl ? w.nameFa : w.nameEn} · {rtl ? "وزن" : "w"} {(w.weight * 100).toFixed(1)}%</span>
                    <span dir="ltr">{w.actualPct}% / {w.plannedPct}%</span>
                  </div>
                  <div className="mt-1 h-2 w-full rounded bg-white/10">
                    <div className="h-2 rounded" style={{ width: `${w.actualPct}%`, background: w.actualPct + 3 < w.plannedPct ? "#FFD48A" : "#8FE3C8" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "wbs" && (
          <div className="fade-rise space-y-2">
            <div className="glass-dark flex flex-wrap items-center gap-2 rounded-2xl p-3 text-[10px]">
              <span className="tx3">{rtl ? "روش وزن‌دهی (PMS)" : "Weight mode (PMS)"}</span>
              {(["Cost", "MH", "Hybrid"] as WeightMode[]).map((wm) => (
                <button
                  key={wm}
                  onClick={() => setWeightMode(wm)}
                  className={`rounded-lg px-2.5 py-1 text-[9.5px] transition ${weightMode === wm ? "toggle-on tx1" : "border b-line-soft tx3"}`}
                >
                  {wm}
                </button>
              ))}
              {weightMode === "Hybrid" && (
                <span className="flex items-center gap-2 tx3">
                  α {alpha.toFixed(1)} / β {(1 - alpha).toFixed(1)}
                  <input type="range" min={0} max={1} step={0.1} value={alpha} onChange={(e) => setAlpha(Number(e.target.value))} className="h-1 w-24" />
                </span>
              )}
              <span className="ms-auto text-[9px] tx4">{rtl ? "Σ وزن فرزندان = ۱ · تغییر ساختار فقط با CR" : "Σ child weights = 1 · structure change needs CR"}</span>
            </div>
            {m.wbsRollup.map((w) => (
              <div key={w.id} className="glass-dark rounded-2xl p-3">
                <div className="flex flex-wrap items-center gap-2 text-[11px] tx1">
                  <span className="font-mono text-emerald-300" dir="ltr">{w.id}</span>
                  {rtl ? w.nameFa : w.nameEn}
                  <span className="ms-auto text-[9.5px] tx3" dir="ltr">w {(w.weight * 100).toFixed(1)}% · {w.actualPct}%</span>
                </div>
                <ul className="mt-2 space-y-1">
                  {m.rows.filter((r) => r.wbs === w.id).map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center gap-2 border-b b-line-soft pb-1 text-[10px] last:border-0">
                      <span className="font-mono tx2" dir="ltr">{r.id}</span>
                      <span className="tx1">{rtl ? r.nameFa : r.nameEn}</span>
                      <span className="tx4" dir="ltr">RoC {r.roc}</span>
                      <span className="ms-auto tx3" dir="ltr">w {(r.weight * 100).toFixed(1)}%</span>
                      <span className="w-14 text-end tabular-nums" style={{ color: r.physicalPct + 3 < r.plannedPct ? "#FFD48A" : "#8FE3C8" }}>{r.physicalPct}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {tab === "gantt" && (
          <div className="fade-rise glass-dark overflow-x-auto rounded-2xl p-3">
            <table className="w-full min-w-[820px] border-collapse text-[10px]">
              <thead>
                <tr className="border-b b-line-soft text-[9px] tx3">
                  <th className="px-2 py-2 text-start">Code</th>
                  <th className="px-2 py-2 text-start">{rtl ? "نام" : "Name"}</th>
                  <th className="px-2 py-2 text-center">ES</th>
                  <th className="px-2 py-2 text-center">EF</th>
                  <th className="px-2 py-2 text-center">TF</th>
                  <th className="px-2 py-2 text-start" style={{ width: "42%" }}>{rtl ? "میله (خط بالا: Baseline)" : "Bar (top: baseline)"}</th>
                </tr>
              </thead>
              <tbody className="divide-y b-line-soft">
                {m.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-2 py-1.5 font-mono tx2" dir="ltr">{r.id}</td>
                    <td className="px-2 py-1.5 tx1">{t({ fa: r.nameFa, en: r.nameEn }, lang)}</td>
                    <td className="px-2 py-1.5 text-center tx3" dir="ltr">{r.es}</td>
                    <td className="px-2 py-1.5 text-center tx2" dir="ltr">{r.ef}</td>
                    <td className="px-2 py-1.5 text-center tabular-nums" style={{ color: r.totalFloat <= 0 ? "#FF9F9F" : r.totalFloat <= 10 ? "#FFD48A" : undefined }}>{r.totalFloat}</td>
                    <td className="px-2 py-1.5">
                      <div className="relative w-full">
                        <div className="h-[3px] w-full rounded bg-white/5">
                          <div className="h-[3px] rounded bg-sky-300/40" style={barStyle(r.baselineStart!, r.baselineFinish!)} />
                        </div>
                        <div className="mt-[3px] h-2 w-full rounded bg-white/10">
                          <div
                            className="h-2 rounded"
                            style={{ ...barStyle(r.es, r.ef), background: r.critical ? "#FF9F9F" : r.totalFloat <= 10 ? "#FFD48A" : "#8FE3C8" }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[8.5px] tx4">
              {rtl
                ? "خط نازک بالا = برنامه پایه · میله = برنامه جاری با Data Date · قرمز = مسیر بحرانی"
                : "Thin line = baseline · bar = current schedule at data date · red = critical path"}
            </p>
          </div>
        )}

        {tab === "baseline" && (
          <div className="fade-rise space-y-2">
            <div className="grid gap-2 sm:grid-cols-4">
              {[
                { k: rtl ? "شناسه پایه" : "Baseline", v: m.project.baselineId },
                { k: rtl ? "پایان پایه" : "BL finish", v: m.baseline.projectFinish },
                { k: rtl ? "پایان جاری" : "Current finish", v: m.cpm.projectFinish },
                { k: rtl ? "رانش (روز کاری)" : "Drift (wd)", v: `${m.snapshot.drift > 0 ? "+" : ""}${m.snapshot.drift}` },
              ].map((x) => (
                <div key={x.k} className="glass-dark rounded-2xl p-3">
                  <div className="text-[8.5px] tx3">{x.k}</div>
                  <div className="mt-1 text-[12px] tx1" dir="ltr">{x.v}</div>
                </div>
              ))}
            </div>
            <div className="glass-dark overflow-x-auto rounded-2xl p-3">
              <table className="w-full min-w-[720px] border-collapse text-[10px]">
                <thead>
                  <tr className="border-b b-line-soft text-[9px] tx3">
                    <th className="px-2 py-2 text-start">Code</th>
                    <th className="px-2 py-2 text-center">BL Start</th>
                    <th className="px-2 py-2 text-center">BL Finish</th>
                    <th className="px-2 py-2 text-center">EF</th>
                    <th className="px-2 py-2 text-center">{rtl ? "لغزش" : "Slip"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y b-line-soft">
                  {m.rows.map((r) => {
                    const slip = Math.round((dayIndex(r.ef) - dayIndex(r.baselineFinish!)) * (5 / 7));
                    return (
                      <tr key={r.id}>
                        <td className="px-2 py-1.5 font-mono tx2" dir="ltr">{r.id}</td>
                        <td className="px-2 py-1.5 text-center tx3" dir="ltr">{r.baselineStart}</td>
                        <td className="px-2 py-1.5 text-center tx3" dir="ltr">{r.baselineFinish}</td>
                        <td className="px-2 py-1.5 text-center tx1" dir="ltr">{r.ef}</td>
                        <td className="px-2 py-1.5 text-center tabular-nums" style={{ color: slip > 0 ? "#FF9F9F" : "#8FE3C8" }}>{slip > 0 ? `+${slip}` : slip}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="mt-2 text-[8.5px] tx4">{rtl ? "برنامه پایه مقدس است؛ جابه‌جایی تاریخ‌های پایه فقط با CR تأییدشده." : "Baseline is sacred; changing baseline dates requires an approved CR."}</p>
            </div>
          </div>
        )}

        {tab === "milestone" && (
          <div className="fade-rise glass-dark overflow-x-auto rounded-2xl p-3">
            <table className="w-full min-w-[860px] border-collapse text-[10px]">
              <thead>
                <tr className="border-b b-line-soft text-[9px] tx3">
                  <th className="px-2 py-2 text-start">Code</th>
                  <th className="px-2 py-2 text-start">{rtl ? "عنوان" : "Title"}</th>
                  <th className="px-2 py-2 text-center">{rtl ? "نوع" : "Type"}</th>
                  <th className="px-2 py-2 text-center">{rtl ? "وضعیت" : "Status"}</th>
                  <th className="px-2 py-2 text-center">{rtl ? "قراردادی" : "Contractual"}</th>
                  <th className="px-2 py-2 text-center">{rtl ? "پیش‌بینی=EF" : "Forecast=EF"}</th>
                  <th className="px-2 py-2 text-center">{rtl ? "لغزش" : "Slip"}</th>
                  <th className="px-2 py-2 text-center">{rtl ? "جریمه" : "Penalty"}</th>
                  <th className="px-2 py-2 text-center">{rtl ? "تشدید" : "Esc."}</th>
                </tr>
              </thead>
              <tbody className="divide-y b-line-soft">
                {m.milestones.map((x) => (
                  <tr key={x.id}>
                    <td className="px-2 py-1.5 font-mono tx2" dir="ltr">{x.id}</td>
                    <td className="px-2 py-1.5 tx1">{t({ fa: x.nameFa, en: x.nameEn }, lang)}</td>
                    <td className="px-2 py-1.5 text-center tx3">{x.type}</td>
                    <td className="px-2 py-1.5 text-center">
                      <span className="rounded px-2 py-0.5 text-[8.5px]" style={{ background: `${STATUS_COLOR[x.status]}22`, color: STATUS_COLOR[x.status] }}>{x.status}</span>
                    </td>
                    <td className="px-2 py-1.5 text-center tx3" dir="ltr">{x.contractualDate}</td>
                    <td className="px-2 py-1.5 text-center tx1" dir="ltr">{x.forecastDate}</td>
                    <td className="px-2 py-1.5 text-center tabular-nums" style={{ color: x.slipDays > 0 ? "#FF9F9F" : "#8FE3C8" }}>{x.slipDays > 0 ? `+${x.slipDays}` : x.slipDays}</td>
                    <td className="px-2 py-1.5 text-center text-rose-300 tabular-nums" dir="ltr">{x.penalty ? fmtNum(x.penalty) : x.bonus ? `+${fmtNum(x.bonus)}` : "—"}</td>
                    <td className="px-2 py-1.5 text-center tx2">{x.escalation ? `L${x.escalation}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[8.5px] tx4">
              {rtl
                ? "پیش‌بینی هر مایلستون = EF فعالیت راننده در CPM · جریمه/پاداش روزانه طبق قرارداد · سطح تشدید: <۳ روز L1، <۷ روز L2، ≥۷ روز L3"
                : "Forecast = driver activity EF · daily LD/bonus per contract · escalation: <3d L1, <7d L2, ≥7d L3"}
            </p>
          </div>
        )}

        {tab === "cp" && (
          <div className="fade-rise space-y-2">
            <div className="glass-dark rounded-2xl p-3 text-[10px] tx2">
              <span dir="ltr">CP = {m.cpm.criticalPath.join(" → ") || "—"}</span>
              <div className="mt-1 tx3" dir="ltr">
                len {m.cpm.cpLengthDays}d · BL {m.baseline.cpLengthDays}d · drift {m.snapshot.drift > 0 ? "+" : ""}{m.snapshot.drift}d · health {m.dcma.healthScore}
              </div>
            </div>

            <div className="glass-dark rounded-2xl p-3">
              <div className="text-[10.5px] tx1">{rtl ? "نزدیک‌بحرانی (TF ≤ ۱۰ روز)" : "Near-critical (TF ≤ 10d)"}</div>
              {m.nearCritical.length === 0 && <p className="mt-1 text-[9.5px] tx4">{rtl ? "موردی نیست." : "None."}</p>}
              {m.nearCritical.map((r) => (
                <div key={r.id} className="mt-1 flex items-center gap-3 text-[10px]">
                  <span className="font-mono text-sky-300" dir="ltr">{r.id}</span>
                  <span className="tx1">{t({ fa: r.nameFa, en: r.nameEn }, lang)}</span>
                  <span className="ms-auto tx3">TF {r.totalFloat}</span>
                </div>
              ))}
            </div>

            <div className="glass-dark rounded-2xl p-3">
              <div className="mb-2 text-[10.5px] tx1">{rtl ? "چک‌لیست DCMA 14" : "DCMA 14-point check"}</div>
              <div className="grid gap-1 sm:grid-cols-2">
                {m.dcma.checks.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 rounded-lg border b-line-soft px-2 py-1 text-[9.5px]">
                    <span className="tx4">{c.id}</span>
                    <span className="tx2">{c.nameFa}</span>
                    <span className="ms-auto tabular-nums tx3" dir="ltr">{Math.round(c.value * 100) / 100}</span>
                    <span style={{ color: c.pass ? "#8FE3C8" : "#FF9F9F" }}>{c.pass ? "✓" : "✕"}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-dark overflow-x-auto rounded-2xl p-3">
              <div className="mb-2 text-[10.5px] tx1">{rtl ? "شناوری فعالیت‌ها" : "Activity float"}</div>
              <table className="w-full min-w-[560px] border-collapse text-[10px]">
                <thead>
                  <tr className="border-b b-line-soft text-[9px] tx3">
                    <th className="px-2 py-1.5 text-start">Code</th>
                    <th className="px-2 py-1.5 text-center">LS</th>
                    <th className="px-2 py-1.5 text-center">LF</th>
                    <th className="px-2 py-1.5 text-center">TF</th>
                    <th className="px-2 py-1.5 text-center">FF</th>
                  </tr>
                </thead>
                <tbody className="divide-y b-line-soft">
                  {m.rows.map((r) => (
                    <tr key={r.id}>
                      <td className="px-2 py-1.5 font-mono tx2" dir="ltr">{r.id}</td>
                      <td className="px-2 py-1.5 text-center tx3" dir="ltr">{r.ls}</td>
                      <td className="px-2 py-1.5 text-center tx3" dir="ltr">{r.lf}</td>
                      <td className="px-2 py-1.5 text-center tabular-nums" style={{ color: r.critical ? "#FF9F9F" : undefined }}>{r.totalFloat}</td>
                      <td className="px-2 py-1.5 text-center tabular-nums tx2">{r.freeFloat}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "lookahead" && (
          <div className="fade-rise glass-dark rounded-2xl p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-[9px] tx3">
              <span>{rtl ? "پنجره ۶ هفته از Data Date" : "6-week window from data date"}</span>
              <span className="ms-auto" dir="ltr">{dataDate} → 2026-10-16</span>
            </div>
            {lookahead.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 border-b b-line-soft py-1.5 text-[10px] last:border-0">
                <span className="font-mono tx2" dir="ltr">{r.id}</span>
                <span className="tx1">{t({ fa: r.nameFa, en: r.nameEn }, lang)}</span>
                <span className="tx3" dir="ltr">{r.es} → {r.ef}</span>
                <span className="tx3">TF {r.totalFloat}</span>
                <span className="tabular-nums" style={{ color: r.physicalPct + 3 < r.plannedPct ? "#FFD48A" : "#8FE3C8" }}>{r.physicalPct}%</span>
              </div>
            ))}
          </div>
        )}

        {tab === "dpr" && (
          <div className="fade-rise space-y-2">
            <div className="glass-dark flex flex-wrap items-center gap-2 rounded-2xl p-3 text-[10px]">
              <span className="tx3">{rtl ? "تاریخ گزارش" : "Report date"}</span>
              <input
                value={dprDate}
                onChange={(e) => setDprDate(e.target.value)}
                className="rounded border b-line-soft bg-black/20 px-2 py-1 tx1"
                dir="ltr"
              />
              <span className="tx3">{rtl ? "دوره باز" : "Open period"}</span>
              <span className="rounded border b-line-soft px-2 py-1 tx1" dir="ltr">{m.openPeriod.code} · {m.openPeriod.from} → {m.openPeriod.to}</span>
              <span
                className="ms-auto rounded-lg px-2 py-1 text-[9px]"
                style={{ background: postGate.ok ? "#8FE3C822" : "#FF9F9F22", color: postGate.ok ? "#8FE3C8" : "#FF9F9F" }}
              >
                {postGate.ok
                  ? rtl ? "ثبت پیشرفت مجاز" : "posting allowed"
                  : postGate.reason === "period_closed"
                    ? rtl ? "دوره بسته است" : "period closed"
                    : rtl ? "خارج از دوره" : "out of period"}
              </span>
            </div>

            <div className="glass-dark overflow-x-auto rounded-2xl p-3">
              <div className="mb-2 text-[10.5px] tx1">{rtl ? "خطوط پیشرفت گام‌های RoC" : "RoC step progress lines"}</div>
              <table className="w-full min-w-[640px] border-collapse text-[10px]">
                <thead>
                  <tr className="border-b b-line-soft text-[9px] tx3">
                    <th className="px-2 py-1.5 text-start">{rtl ? "فعالیت" : "Activity"}</th>
                    <th className="px-2 py-1.5 text-start">RoC</th>
                    <th className="px-2 py-1.5 text-center">{rtl ? "درصد فیزیکی" : "Physical %"}</th>
                    <th className="px-2 py-1.5 text-start">{rtl ? "گام مسدود (بدون IR)" : "Blocked (no IR)"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y b-line-soft">
                  {m.rows.filter((r) => !r.isMilestone).map((r) => (
                    <tr key={r.id}>
                      <td className="px-2 py-1.5 font-mono tx2" dir="ltr">{r.id}</td>
                      <td className="px-2 py-1.5 tx3" dir="ltr">{r.roc}</td>
                      <td className="px-2 py-1.5 text-center tabular-nums tx1">{r.physicalPct}%</td>
                      <td className="px-2 py-1.5 text-[9px]" style={{ color: r.blockedSteps.length ? "#FF9F9F" : undefined }}>
                        {r.blockedSteps.length ? r.blockedSteps.join(" · ") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-[8.5px] tx4">
                {rtl
                  ? "گام دارای الزام بازرسی بدون IR تأییدشده وارد پیشرفت و EV نمی‌شود؛ فقط پیشرفت Approved محاسبه می‌گردد."
                  : "Steps requiring inspection without an approved IR are excluded from progress and EV."}
              </p>
            </div>
          </div>
        )}

        {tab === "weekly" && (
          <div className="fade-rise space-y-2">
            <div className="glass-dark rounded-2xl p-3 text-[10.5px] tx2">
              {rtl ? "درصد تعهدات انجام‌شده هفته (PPC)" : "Percent Plan Complete"} — <span className="tx1">{m.ppcPct}%</span>
            </div>
            <div className="glass-dark overflow-x-auto rounded-2xl p-3">
              <table className="w-full min-w-[520px] border-collapse text-[10px]">
                <thead>
                  <tr className="border-b b-line-soft text-[9px] tx3">
                    <th className="px-2 py-1.5 text-start">{rtl ? "هفته" : "Week"}</th>
                    <th className="px-2 py-1.5 text-start">{rtl ? "فعالیت" : "Activity"}</th>
                    <th className="px-2 py-1.5 text-center">{rtl ? "تعهد" : "Committed"}</th>
                    <th className="px-2 py-1.5 text-center">{rtl ? "انجام" : "Completed"}</th>
                    <th className="px-2 py-1.5 text-center">PPC</th>
                  </tr>
                </thead>
                <tbody className="divide-y b-line-soft">
                  {m.commitments.map((c) => (
                    <tr key={c.activityId}>
                      <td className="px-2 py-1.5 tx3" dir="ltr">{c.week}</td>
                      <td className="px-2 py-1.5 font-mono tx2" dir="ltr">{c.activityId}</td>
                      <td className="px-2 py-1.5 text-center tabular-nums tx2">{c.committed}</td>
                      <td className="px-2 py-1.5 text-center tabular-nums tx2">{c.completed}</td>
                      <td className="px-2 py-1.5 text-center tabular-nums" style={{ color: c.completed / c.committed < 0.8 ? "#FFD48A" : "#8FE3C8" }}>
                        {Math.round((c.completed / c.committed) * 100)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "mpr" && (
          <div className="fade-rise space-y-2">
            <div className="grid gap-2 sm:grid-cols-4">
              {[
                { k: rtl ? "پیشرفت واقعی" : "Actual", v: `${m.overallPct}%` },
                { k: rtl ? "برنامه‌ای" : "Planned", v: `${m.plannedPct}%` },
                { k: rtl ? "وضعیت" : "Status", v: m.variance.status },
                { k: rtl ? "دوره" : "Period", v: m.openPeriod.code },
              ].map((x) => (
                <div key={x.k} className="glass-dark rounded-2xl p-3">
                  <div className="text-[8.5px] tx3">{x.k}</div>
                  <div className="mt-1 text-[13px] tx1" dir="ltr">{x.v}</div>
                </div>
              ))}
            </div>
            <div className="glass-dark rounded-2xl p-3 text-[10px] tx2">
              <p>{rtl ? "خلاصه ماهانه از داده تأییدشده تولید می‌شود:" : "Monthly summary from approved data:"}</p>
              <ul className="mt-2 space-y-1 tx3">
                <li>· {rtl ? "مایلستون‌های در تأخیر" : "Delayed milestones"}: {m.milestones.filter((x) => x.status === "Delayed").length}</li>
                <li>· {rtl ? "جریمه انباشته" : "Accrued penalty"}: <span dir="ltr">{fmtNum(m.totalPenalty)} {m.project.currency}</span></li>
                <li>· {rtl ? "رانش مسیر بحرانی" : "CP drift"}: <span dir="ltr">{m.snapshot.drift}d</span></li>
                <li>· {rtl ? "سلامت زمان‌بندی (DCMA)" : "Schedule health (DCMA)"}: {m.dcma.healthScore}</li>
                <li>· {rtl ? "دوره‌های بسته‌شده" : "Closed periods"}: {m.periods.filter((p) => p.closedAt).map((p) => p.code).join("، ") || "—"}</li>
              </ul>
            </div>
          </div>
        )}

        {tab === "reports" && (
          <div className="fade-rise space-y-2">
            <div className="glass-dark flex flex-wrap gap-2 rounded-2xl p-3 text-[10px]">
              <select value={kind} onChange={(e) => setKind(e.target.value)} className="rounded-lg border b-line-soft bg-black/20 px-2 py-1 tx1" style={{ colorScheme: "dark" }}>
                <option>Internal</option>
                <option>External</option>
              </select>
              <select value={fmt} onChange={(e) => setFmt(e.target.value)} className="rounded-lg border b-line-soft bg-black/20 px-2 py-1 tx1" style={{ colorScheme: "dark" }}>
                <option>PDF</option>
                <option>XLSX</option>
                <option>DOCX</option>
              </select>
              <button className="rounded-lg border border-sky-400/40 bg-sky-400/15 px-3 py-1 text-sky-200">{rtl ? "تولید (نمونه)" : "Generate (demo)"}</button>
              <span className="ms-auto text-[9px] tx4">{kind} · {fmt} · {rtl ? "سربرگ A4 با سه لوگو" : "A4 header, three logos"}</span>
            </div>
            <div className="glass-dark rounded-2xl p-3">
              <div className="mb-2 text-[10.5px] tx1">{rtl ? "گزارش‌های استاندارد ماژول" : "Standard module reports"}</div>
              <div className="grid gap-1 sm:grid-cols-2">
                {[
                  ["MS-01", rtl ? "وضعیت مایلستون‌ها" : "Milestone status", `${m.milestones.length}`],
                  ["MS-02", rtl ? "جریمه و پاداش" : "LD & bonus", fmtNum(m.totalPenalty)],
                  ["MS-03", rtl ? "تشدید مایلستون" : "Escalation", String(m.milestones.filter((x) => x.escalation >= 2).length)],
                  ["CP-01", rtl ? "مسیر بحرانی" : "Critical path", String(m.cpm.criticalPath.length)],
                  ["CP-02", rtl ? "نزدیک‌بحرانی" : "Near-critical", String(m.nearCritical.length)],
                  ["CP-03", rtl ? "رانش مسیر بحرانی" : "CP drift", `${m.snapshot.drift}d`],
                  ["CP-04", rtl ? "سلامت DCMA" : "DCMA health", String(m.dcma.healthScore)],
                  ["PMS-01", rtl ? "پیشرفت وزنی WBS" : "WBS weighted progress", `${m.overallPct}%`],
                  ["PMS-02", rtl ? "انحراف برنامه‌ای" : "Progress variance", `${m.variance.deltaPct}`],
                  ["PMS-03", rtl ? "PPC هفتگی" : "Weekly PPC", `${m.ppcPct}%`],
                ].map(([code, name, val]) => (
                  <div key={code} className="flex items-center gap-2 rounded-lg border b-line-soft px-2 py-1.5 text-[9.5px]">
                    <span className="font-mono text-emerald-300" dir="ltr">{code}</span>
                    <span className="tx2">{name}</span>
                    <span className="ms-auto tabular-nums tx1" dir="ltr">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "alerts" && (
          <div className="fade-rise space-y-2">
            {m.alerts.length === 0 && <div className="glass-dark rounded-2xl p-3 text-[10px] tx3">{rtl ? "هشدار فعالی نیست." : "No active alerts."}</div>}
            {m.alerts.map((a, i) => {
              const key = `${a.code}-${a.refId ?? i}`;
              return (
                <div key={key} className="glass-dark flex flex-wrap items-center gap-3 rounded-xl p-3 text-[10px]">
                  <span className="rounded px-2 py-0.5" style={{ background: `${SEV_COLOR[a.severity]}22`, color: SEV_COLOR[a.severity] }}>{a.severity}</span>
                  <span className="font-mono tx3" dir="ltr">{a.code}</span>
                  <span className="tx3">{a.type}</span>
                  <span className="tx1">{a.message}</span>
                  {a.refId && <span className="font-mono text-sky-300" dir="ltr">{a.refId}</span>}
                  <button
                    onClick={() => setAck((s) => ({ ...s, [key]: true }))}
                    className="ms-auto rounded-lg border b-line-soft px-2 py-1 text-[9px] tx2"
                  >
                    {ack[key] ? "ACK" : rtl ? "تأیید وصول" : "Ack"}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {tab === "template" && (
          <div className="fade-rise grid gap-2 md:grid-cols-3">
            <div className="glass-dark rounded-2xl p-3 text-[10px] tx2">{rtl ? "بلوک: هدر · جدول · نمودار" : "Blocks: header · table · chart"}</div>
            <div className="glass-dark rounded-2xl p-3 text-[10px] tx1">{rtl ? "بوم WYSIWYG (نمونه)" : "WYSIWYG canvas (demo)"}</div>
            <div className="glass-dark rounded-2xl p-3 text-[10px] tx2">{rtl ? "AI پیشنهاد می‌دهد؛ اعمال فقط پس از Approve" : "AI suggests; apply only after Approve"}</div>
          </div>
        )}

        {tab === "roc" && (
          <div className="fade-rise space-y-2">
            {m.rocIssues.length > 0 && (
              <div className="glass-dark rounded-2xl p-3 text-[10px] text-rose-300">
                {rtl ? "دستورهای نامعتبر (Σ ≠ ۱۰۰):" : "Invalid rules (Σ ≠ 100):"} {m.rocIssues.map((x) => `${x.code}=${x.sum}`).join("، ")}
              </div>
            )}
            {Object.entries(m.roc).map(([code, r]) => (
              <div key={code} className="glass-dark rounded-2xl p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[10px] text-emerald-300" dir="ltr">{code}</span>
                  <span className="text-[11px] tx1">{r.nameFa}</span>
                  <span className="ms-auto text-[9px] tx4">{r.ref}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {r.steps.map((st) => (
                    <span
                      key={st.code}
                      className="rounded-lg border b-line-soft px-2 py-1 text-[9px]"
                      style={{ color: st.ir ? "#FFD48A" : undefined }}
                      title={st.ir ? (rtl ? "نیازمند تأیید بازرسی" : "requires inspection") : undefined}
                    >
                      {st.nameFa} {st.weight}{st.ir ? " ⚑" : ""}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            <p className="text-[8.5px] tx4">{rtl ? "⚑ گام دارای الزام بازرسی؛ بدون IR تأییدشده وارد پیشرفت نمی‌شود." : "⚑ inspection-gated step; excluded until IR approved."}</p>
          </div>
        )}
      </div>
    </div>
  );
}
