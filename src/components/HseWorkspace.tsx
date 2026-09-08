import { useEffect, useMemo, useState } from "react";
import type { Lang } from "../data/framework";
import {
  HSE_ACTIONS,
  HSE_CHECKUP,
  HSE_INCIDENTS,
  HSE_INSPECTIONS,
  HSE_MANHOURS,
  HSE_PTWS,
  HSE_TBT,
  HSE_WASTE,
  actionEscalation,
  actionSla,
  hseScore,
  inspectionBand,
  inspectionScore,
  isRecordable,
  ltifr,
  recycleRate,
  spillTier,
  tbtCompliance,
  totalManHours,
  trir,
  type HseIncidentType,
  type PtwStatus,
} from "../services/hse";

export type HseTab = "dashboard" | "incidents" | "ptw" | "inspections" | "healthenv" | "actions";

const TABS: { id: HseTab; fa: string; en: string }[] = [
  { id: "dashboard", fa: "داشبورد", en: "Dashboard" },
  { id: "incidents", fa: "حوادث", en: "Incidents" },
  { id: "ptw", fa: "پروانه کار", en: "PTW" },
  { id: "inspections", fa: "بازرسی‌ها", en: "Inspections" },
  { id: "healthenv", fa: "بهداشت/محیط", en: "Health/Env" },
  { id: "actions", fa: "اقدامات", en: "Actions" },
];

/** مبنای زمانی ثابت D1 تا SLA/سررسیدها قطعی باشند (سید با شهریور ۱۴۰۵ هم‌خوان است). */
const HSE_NOW = "2026-09-08";

const INC_FA: Record<HseIncidentType, string> = {
  near_miss: "شبه‌حادثه",
  first_aid: "کمک اولیه",
  medical: "درمانی",
  lost_time: "ازکارافتادگی",
  fatality: "فوتی",
  spill: "نشت",
  property: "خسارت مالی",
};

const PTW_FA: Record<PtwStatus, string> = {
  draft: "پیش‌نویس",
  requested: "درخواست",
  approved: "تأییدشده",
  active: "فعال",
  suspended: "معلق",
  closed: "بسته",
  expired: "منقضی",
};

const BAND_C: Record<string, string> = { A: "#8FE3C8", B: "#7FB2FF", C: "#FFD48A", D: "#FF9F9F" };

export default function HseWorkspace({
  lang,
  initialTab = "dashboard",
  hideTabs = false,
}: {
  lang: Lang;
  initialTab?: HseTab;
  hideTabs?: boolean;
}) {
  const rtl = lang === "fa";
  const [tab, setTab] = useState<HseTab>(initialTab);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const m = useMemo(() => {
    const mh = totalManHours(HSE_MANHOURS);
    const trirV = trir(HSE_INCIDENTS, mh);
    const ltifrV = ltifr(HSE_INCIDENTS, mh);
    const ptwOk = HSE_PTWS.filter((p) => p.status === "approved" || p.status === "active" || p.status === "closed").length;
    const ptwCompliance = HSE_PTWS.length ? ptwOk / HSE_PTWS.length : 0;
    const scores = HSE_INSPECTIONS.map((n) => inspectionScore(n.items));
    const inspectionAvg = scores.length ? Math.round(scores.reduce((s, x) => s + x, 0) / scores.length) : 0;
    const closed = HSE_ACTIONS.filter((a) => a.closedAt).length;
    const actionClosure = HSE_ACTIONS.length ? closed / HSE_ACTIONS.length : 0;
    const score = hseScore({ trir: trirV, ptwCompliance, inspectionAvg, actionClosure });
    return { mh, trirV, ltifrV, ptwCompliance, inspectionAvg, actionClosure, score };
  }, []);

  const kpis = [
    { k: "TRIR", v: m.trirV.toFixed(2), c: m.trirV > 2 ? "#FF9F9F" : "#8FE3C8" },
    { k: "LTIFR", v: m.ltifrV.toFixed(2), c: m.ltifrV > 0.5 ? "#FFD48A" : "#8FE3C8" },
    { k: rtl ? "من‌اور" : "Man-hrs", v: m.mh.toLocaleString("en-US"), c: "#7FB2FF" },
    { k: rtl ? "امتیاز HSE" : "HSE score", v: String(m.score.total), c: m.score.band === "Green" ? "#8FE3C8" : m.score.band === "Yellow" ? "#FFD48A" : "#FF9F9F" },
    { k: rtl ? "اقدام باز" : "Open acts", v: String(HSE_ACTIONS.filter((a) => !a.closedAt).length), c: "#C9A7FF" },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden" dir={rtl ? "rtl" : "ltr"}>
      <section className="glass-dark shrink-0 rounded-2xl p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-amber-400/40 bg-amber-400/10 text-[15px]">🦺</span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[12px] font-semibold tx1">
              {rtl ? "ایمنی، بهداشت و محیط‌زیست (HSE)" : "Health, Safety & Environment (HSE)"}
            </h3>
            <p className="text-[8.5px] font-extralight tx3">
              {rtl
                ? "نرخ OSHA از من‌اور واقعی · WO پرخطر بدون PTW فعال هشدار می‌گیرد · اقدام بحرانی به CAPA ارجاع می‌شود"
                : "OSHA rates from real man-hours · high-risk WO without active PTW warns · critical actions go to CAPA"}
            </p>
          </div>
          <span className="rounded-lg border b-line-soft px-2 py-1 text-[9px] tx3" dir="ltr">D1 · Seed</span>
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
            <div className="grid gap-2 sm:grid-cols-5">
              {kpis.map((c) => (
                <div key={c.k} className="glass-dark rounded-2xl p-3">
                  <div className="text-[8.5px] font-extralight tx3">{c.k}</div>
                  <div className="mt-1 text-[18px] font-semibold tabular-nums" style={{ color: c.c }}>{c.v}</div>
                </div>
              ))}
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              <div className="glass-dark rounded-2xl p-3">
                <div className="text-[10.5px] font-normal tx1">{rtl ? "ترکیب حوادث" : "Incident mix"}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[
                    { n: HSE_INCIDENTS.filter((i) => isRecordable(i.type)).length, l: rtl ? "قابل‌ثبت" : "Recordable", c: "#FF9F9F" },
                    { n: HSE_INCIDENTS.filter((i) => i.type === "near_miss").length, l: rtl ? "شبه‌حادثه" : "Near-miss", c: "#FFD48A" },
                    { n: HSE_INCIDENTS.filter((i) => i.status !== "closed").length, l: rtl ? "باز" : "Open", c: "#7FB2FF" },
                  ].map((x) => (
                    <span key={x.l} className="rounded-lg px-2 py-1 text-[9px]" style={{ background: `${x.c}22`, color: x.c }}>
                      {x.n} {x.l}
                    </span>
                  ))}
                </div>
              </div>
              <div className="glass-dark rounded-2xl p-3">
                <div className="text-[10.5px] font-normal tx1">{rtl ? "پروانه کار" : "Permits"}</div>
                <p className="mt-2 text-[10px] tx2">
                  {rtl ? "فعال" : "Active"} {HSE_PTWS.filter((p) => p.status === "active").length} ·{" "}
                  {rtl ? "در چرخه" : "In flow"} {HSE_PTWS.filter((p) => p.status === "requested" || p.status === "approved").length} ·{" "}
                  {rtl ? "انطباق" : "Compliance"} {Math.round(m.ptwCompliance * 100)}٪
                </p>
              </div>
              <div className="glass-dark rounded-2xl p-3">
                <div className="text-[10.5px] font-normal tx1">{rtl ? "بازرسی و اقدام" : "Inspection & actions"}</div>
                <p className="mt-2 text-[10px] tx2">
                  {rtl ? "میانگین بازرسی" : "Insp. avg"} {m.inspectionAvg} ·{" "}
                  {rtl ? "بسته‌شدن اقدام" : "Closure"} {Math.round(m.actionClosure * 100)}٪
                </p>
              </div>
            </div>
          </div>
        )}

        {tab === "incidents" && (
          <div className="fade-rise glass-dark overflow-x-auto rounded-2xl p-3">
            <table className="w-full min-w-[680px] border-collapse text-[10px]">
              <thead>
                <tr className="border-b b-line-soft text-[9px] tx3">
                  <th className="px-2 py-2 text-start">Code</th>
                  <th className="px-2 py-2 text-start">{rtl ? "نوع" : "Type"}</th>
                  <th className="px-2 py-2 text-start">{rtl ? "شرح" : "Description"}</th>
                  <th className="px-2 py-2 text-center">{rtl ? "تاریخ" : "Date"}</th>
                  <th className="px-2 py-2 text-center">OSHA</th>
                  <th className="px-2 py-2 text-center">{rtl ? "وضعیت" : "Status"}</th>
                </tr>
              </thead>
              <tbody className="divide-y b-line-soft">
                {HSE_INCIDENTS.map((i) => (
                  <tr key={i.id}>
                    <td className="px-2 py-1.5 font-mono tx2" dir="ltr">{i.code}</td>
                    <td className="px-2 py-1.5 tx1">{rtl ? INC_FA[i.type] : i.type}</td>
                    <td className="px-2 py-1.5 tx2">{i.descFa}</td>
                    <td className="px-2 py-1.5 text-center tx3" dir="ltr">{i.dateISO}</td>
                    <td className="px-2 py-1.5 text-center" style={{ color: isRecordable(i.type) ? "#FF9F9F" : "#9AA4B2" }}>
                      {isRecordable(i.type) ? "●" : "○"}
                    </td>
                    <td className="px-2 py-1.5 text-center tx3">{i.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "ptw" && (
          <div className="fade-rise space-y-1.5">
            {HSE_PTWS.map((p) => (
              <div key={p.id} className="glass-dark flex flex-wrap items-center gap-2 rounded-xl p-2.5 text-[10px]">
                <span className="font-mono tx2" dir="ltr">{p.no}</span>
                <span className="rounded bg-amber-400/10 px-2 py-0.5 text-amber-200" dir="ltr">{p.type}</span>
                <span className="tx3" dir="ltr">{p.workDate}</span>
                <span className="tx1">{p.area}</span>
                <span
                  className="ms-auto rounded px-2 py-0.5 text-[8.5px]"
                  style={{
                    background: p.status === "active" ? "#8FE3C822" : p.status === "suspended" ? "#FF9F9F22" : "#7FB2FF22",
                    color: p.status === "active" ? "#8FE3C8" : p.status === "suspended" ? "#FF9F9F" : "#7FB2FF",
                  }}
                >
                  {rtl ? PTW_FA[p.status] : p.status}
                </span>
              </div>
            ))}
            <p className="text-[8.5px] tx4">
              {rtl ? "چرخه: draft ← requested ← approved ← active ← closed (با تعلیق/انقضا)" : "Flow: draft → requested → approved → active → closed (suspend/expire)"}
            </p>
          </div>
        )}

        {tab === "inspections" && (
          <div className="fade-rise grid gap-2 md:grid-cols-2">
            {HSE_INSPECTIONS.map((n) => {
              const s = inspectionScore(n.items);
              const b = inspectionBand(s);
              return (
                <div key={n.id} className="glass-dark rounded-2xl p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] tx1">{n.area}</span>
                    <span className="text-[9px] tx3" dir="ltr">{n.dateISO}</span>
                    <span className="ms-auto rounded-lg px-2 py-0.5 text-[10px] font-semibold" style={{ background: `${BAND_C[b]}22`, color: BAND_C[b] }} dir="ltr">
                      {b} · {s}
                    </span>
                  </div>
                  <ul className="mt-2 space-y-1 text-[9.5px]">
                    {n.items.map((it, j) => (
                      <li key={j} className="flex gap-2 tx2">
                        <span style={{ color: it.ok ? "#8FE3C8" : "#FF9F9F" }}>{it.ok ? "✓" : "✕"}</span>
                        {it.item}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}

        {tab === "healthenv" && (
          <div className="fade-rise grid gap-2 md:grid-cols-2">
            <div className="glass-dark rounded-2xl p-3">
              <div className="text-[10.5px] font-normal tx1">{rtl ? "آموزش TBT" : "TBT training"}</div>
              <p className="mt-2 text-[10px] tx2" dir="ltr">
                {HSE_TBT.held}/{HSE_TBT.planned} · {Math.round(tbtCompliance(HSE_TBT.planned, HSE_TBT.held) * 100)}%
              </p>
              <div className="mt-2 h-2 w-full rounded bg-white/10">
                <div className="h-2 rounded bg-sky-400/60" style={{ width: `${tbtCompliance(HSE_TBT.planned, HSE_TBT.held) * 100}%` }} />
              </div>
            </div>
            <div className="glass-dark rounded-2xl p-3">
              <div className="text-[10.5px] font-normal tx1">{rtl ? "معاینات دوره‌ای" : "Checkups"}</div>
              <p className="mt-2 text-[10px] tx2" dir="ltr">
                {HSE_CHECKUP.covered}/{HSE_CHECKUP.total} · {Math.round((HSE_CHECKUP.covered / HSE_CHECKUP.total) * 100)}%
              </p>
            </div>
            <div className="glass-dark rounded-2xl p-3">
              <div className="text-[10.5px] font-normal tx1">{rtl ? "پسماند" : "Waste"}</div>
              <p className="mt-2 text-[10px] tx2" dir="ltr">
                ♻ {Math.round(recycleRate(HSE_WASTE.recycledKg, HSE_WASTE.totalKg) * 100)}% · {HSE_WASTE.recycledKg}/{HSE_WASTE.totalKg} kg
              </p>
            </div>
            <div className="glass-dark rounded-2xl p-3">
              <div className="text-[10.5px] font-normal tx1">{rtl ? "نشت‌ها" : "Spills"}</div>
              {HSE_INCIDENTS.filter((i) => i.type === "spill").map((s) => (
                <p key={s.id} className="mt-1 text-[10px] tx2">
                  <span className="font-mono" dir="ltr">{s.code}</span> · {s.descFa} ·{" "}
                  <span style={{ color: spillTier(s.volumeL ?? 0) === "T1" ? "#8FE3C8" : "#FFD48A" }} dir="ltr">
                    {spillTier(s.volumeL ?? 0)}
                  </span>
                </p>
              ))}
            </div>
          </div>
        )}

        {tab === "actions" && (
          <div className="fade-rise space-y-1.5">
            {HSE_ACTIONS.map((a) => {
              const sla = actionSla(a, HSE_NOW);
              const esc = actionEscalation(a, HSE_NOW);
              return (
                <div key={a.id} className="glass-dark flex flex-wrap items-center gap-2 rounded-xl p-2.5 text-[10px]">
                  <span className="tx1">{a.title}</span>
                  <span className="rounded bg-white/5 px-2 py-0.5 tx3" dir="ltr">{a.severity}</span>
                  <span className="tx3" dir="ltr">{a.dueISO}</span>
                  <span
                    className="ms-auto rounded px-2 py-0.5 text-[8.5px]"
                    style={{
                      background: sla === "overdue" ? "#FF9F9F22" : sla === "due_soon" ? "#FFD48A22" : "#8FE3C822",
                      color: sla === "overdue" ? "#FF9F9F" : sla === "due_soon" ? "#FFD48A" : "#8FE3C8",
                    }}
                    dir="ltr"
                  >
                    {sla} · {esc}
                  </span>
                </div>
              );
            })}
            <p className="text-[8.5px] tx4">
              {rtl ? "اقدام بحرانی معوق بالای ۷ روز به L3 می‌رسد و به CAPA حاکمیت ارجاع می‌شود" : "Critical overdue >7d escalates to L3 and refers to governance CAPA"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
