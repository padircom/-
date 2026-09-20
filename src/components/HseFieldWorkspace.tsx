import { useCallback, useEffect, useMemo, useState } from "react";
import type { Lang } from "../data/framework";
import { PEX_PROJECT } from "../data/pexSnapshot";
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
  nextInspectionDue,
  recycleRate,
  severityWeight,
  spillTier,
  tbtCompliance,
  totalManHours,
  trir,
  type HseIncidentType,
  type PtwStatus,
  type PtwType,
} from "../services/hseField";
import {
  createIncident,
  createPermit,
  listIncidents,
  listInspections,
  listPermits,
  permitAction,
  woGate,
  type HseIncidentDto,
  type HseInspectionDto,
  type HsePermitDto,
  type WoGateDto,
} from "../services/hseApi";

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

const INC_TYPES: HseIncidentType[] = ["near_miss", "first_aid", "medical", "lost_time", "fatality", "spill", "property"];
const PTW_TYPES: PtwType[] = ["hot", "cold", "confined", "electrical", "height", "excavation", "radiation"];
const GATE_TYPES = ["general", ...PTW_TYPES];
const ROLES = ["requester", "supervisor", "area_authority", "hse_officer", "performing_authority", "admin"];
const PTW_NEXT: Record<string, string[]> = {
  draft: ["request"],
  requested: ["approve"],
  approved: ["activate"],
  active: ["suspend", "close"],
  suspended: ["resume", "close"],
  closed: [],
  expired: [],
};
const FLAG_KEYS = ["gasTest", "rescuePlan", "isolation", "barricade"] as const;

const BAND_C: Record<string, string> = { A: "#8FE3C8", B: "#7FB2FF", C: "#FFD48A", D: "#FF9F9F" };

const seedIncidents = (): HseIncidentDto[] =>
  HSE_INCIDENTS.map((i) => ({ ...i, projectCode: PEX_PROJECT.code, severityW: severityWeight(i.type), volumeL: i.volumeL ?? null }));

const seedPermits = (): HsePermitDto[] =>
  HSE_PTWS.map((p) => ({ ...p, projectCode: PEX_PROJECT.code, flagsJson: null }));

const seedInspections = (): HseInspectionDto[] =>
  HSE_INSPECTIONS.map((n) => {
    const score = inspectionScore(n.items);
    const band = inspectionBand(score);
    return { id: n.id, projectCode: PEX_PROJECT.code, area: n.area, dateISO: n.dateISO, items: n.items, score, band, nextDue: nextInspectionDue(n.dateISO, band) };
  });

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

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
  const [incidents, setIncidents] = useState<HseIncidentDto[]>(seedIncidents);
  const [permits, setPermits] = useState<HsePermitDto[]>(seedPermits);
  const [inspections, setInspections] = useState<HseInspectionDto[]>(seedInspections);
  const [source, setSource] = useState<"sql" | "seed" | null>(null);
  const [apiOk, setApiOk] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState("hse_officer");

  // فرم حادثه
  const [incOpen, setIncOpen] = useState(false);
  const [incType, setIncType] = useState<HseIncidentType>("near_miss");
  const [incDate, setIncDate] = useState(todayIso());
  const [incArea, setIncArea] = useState("");
  const [incDesc, setIncDesc] = useState("");
  const [incLost, setIncLost] = useState(0);
  const [incVol, setIncVol] = useState(0);

  // فرم پروانه
  const [ptwOpen, setPtwOpen] = useState(false);
  const [ptwType, setPtwType] = useState<PtwType>("hot");
  const [ptwDate, setPtwDate] = useState(todayIso());
  const [ptwArea, setPtwArea] = useState("");
  const [ptwRisk, setPtwRisk] = useState("high");
  const [ptwFlags, setPtwFlags] = useState<Record<string, boolean>>({});
  const [ptwWarn, setPtwWarn] = useState<string[]>([]);

  // گیت WO
  const [gateType, setGateType] = useState("hot");
  const [gateArea, setGateArea] = useState("");
  const [gateDate, setGateDate] = useState(todayIso());
  const [gateRes, setGateRes] = useState<WoGateDto | null>(null);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const refresh = useCallback(async () => {
    const [ri, rp, rn] = await Promise.allSettled([
      listIncidents(PEX_PROJECT.code),
      listPermits(PEX_PROJECT.code),
      listInspections(PEX_PROJECT.code),
    ]);
    let anySql = false;
    if (ri.status === "fulfilled" && ri.value.length) { setIncidents(ri.value); anySql = true; }
    if (rp.status === "fulfilled" && rp.value.length) { setPermits(rp.value); anySql = true; }
    if (rn.status === "fulfilled" && rn.value.length) { setInspections(rn.value); anySql = true; }
    setApiOk(ri.status === "fulfilled" || rp.status === "fulfilled" || rn.status === "fulfilled");
    setSource(anySql ? "sql" : "seed");
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const m = useMemo(() => {
    const mh = totalManHours(HSE_MANHOURS);
    const inc = incidents.map((i) => ({ ...i, volumeL: i.volumeL ?? undefined }));
    const trirV = trir(inc, mh);
    const ltifrV = ltifr(inc, mh);
    const ptwOk = permits.filter((p) => p.status === "approved" || p.status === "active" || p.status === "closed").length;
    const ptwCompliance = permits.length ? ptwOk / permits.length : 0;
    const scores = inspections.map((n) => inspectionScore(n.items));
    const inspectionAvg = scores.length ? Math.round(scores.reduce((s, x) => s + x, 0) / scores.length) : 0;
    const closed = HSE_ACTIONS.filter((a) => a.closedAt).length;
    const actionClosure = HSE_ACTIONS.length ? closed / HSE_ACTIONS.length : 0;
    const score = hseScore({ trir: trirV, ptwCompliance, inspectionAvg, actionClosure });
    return { mh, trirV, ltifrV, ptwCompliance, inspectionAvg, actionClosure, score };
  }, [incidents, permits, inspections]);

  const kpis = [
    { k: "TRIR", v: m.trirV.toFixed(2), c: m.trirV > 2 ? "#FF9F9F" : "#8FE3C8" },
    { k: "LTIFR", v: m.ltifrV.toFixed(2), c: m.ltifrV > 0.5 ? "#FFD48A" : "#8FE3C8" },
    { k: rtl ? "من‌اور" : "Man-hrs", v: m.mh.toLocaleString("en-US"), c: "#7FB2FF" },
    { k: rtl ? "امتیاز HSE" : "HSE score", v: String(m.score.total), c: m.score.band === "Green" ? "#8FE3C8" : m.score.band === "Yellow" ? "#FFD48A" : "#FF9F9F" },
    { k: rtl ? "اقدام باز" : "Open acts", v: String(HSE_ACTIONS.filter((a) => !a.closedAt).length), c: "#C9A7FF" },
  ];

  const saveIncident = async () => {
    setBusy(true);
    setError("");
    try {
      await createIncident(PEX_PROJECT.code, {
        dateISO: incDate, type: incType, lostDays: incLost, area: incArea, descFa: incDesc,
        ...(incType === "spill" ? { volumeL: incVol } : {}),
      });
      setIncOpen(false);
      setIncArea("");
      setIncDesc("");
      setIncLost(0);
      setIncVol(0);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا");
    } finally {
      setBusy(false);
    }
  };

  const savePermit = async () => {
    setBusy(true);
    setError("");
    try {
      const row = await createPermit(PEX_PROJECT.code, {
        type: ptwType, workDate: ptwDate, area: ptwArea, riskLevel: ptwRisk, flags: ptwFlags,
      });
      setPtwWarn(row.warnings ?? []);
      setPtwOpen(false);
      setPtwArea("");
      setPtwFlags({});
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا");
    } finally {
      setBusy(false);
    }
  };

  const runPtwAction = async (id: string, action: string) => {
    setBusy(true);
    setError("");
    try {
      await permitAction(id, action, role);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا");
    } finally {
      setBusy(false);
    }
  };

  const checkGate = async () => {
    setBusy(true);
    setError("");
    try {
      setGateRes(await woGate(PEX_PROJECT.code, { workType: gateType, area: gateArea || undefined, workDate: gateDate }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "خطا");
    } finally {
      setBusy(false);
    }
  };

  const inputCls = "rounded-lg border b-line-soft bg-black/20 px-2 py-1 tx1 placeholder:text-[9px]";

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
          <span
            className="rounded-lg border px-2 py-1 text-[9px]"
            dir="ltr"
            style={{
              borderColor: source === "sql" ? "#8FE3C855" : "#9AA4B255",
              color: source === "sql" ? "#8FE3C8" : "#9AA4B2",
            }}
          >
            {source === "sql" ? "● SQL" : "○ Seed"}
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

      {!apiOk && (
        <div className="glass-dark shrink-0 rounded-xl border border-amber-400/30 p-2.5 text-[10px] text-amber-200">
          {rtl ? "سرور/SQL در دسترس نیست — ثبت واقعی نیاز به اتصال دارد؛ نمایش از seed." : "Server/SQL unreachable — reads fall back to seed."}
        </div>
      )}
      {error && (
        <div className="glass-dark shrink-0 rounded-xl border border-rose-400/30 p-2.5 text-[10px] text-rose-200" dir="ltr">
          {error}
        </div>
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
                    { n: incidents.filter((i) => isRecordable(i.type)).length, l: rtl ? "قابل‌ثبت" : "Recordable", c: "#FF9F9F" },
                    { n: incidents.filter((i) => i.type === "near_miss").length, l: rtl ? "شبه‌حادثه" : "Near-miss", c: "#FFD48A" },
                    { n: incidents.filter((i) => i.status !== "closed").length, l: rtl ? "باز" : "Open", c: "#7FB2FF" },
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
                  {rtl ? "فعال" : "Active"} {permits.filter((p) => p.status === "active").length} ·{" "}
                  {rtl ? "در چرخه" : "In flow"} {permits.filter((p) => p.status === "requested" || p.status === "approved").length} ·{" "}
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
            <div className="glass-dark rounded-2xl p-3">
              <div className="text-[10.5px] font-normal tx1">{rtl ? "سنجش گیت WO پرخطر (advisory)" : "High-risk WO gate check (advisory)"}</div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
                <select value={gateType} onChange={(e) => setGateType(e.target.value)} className={inputCls} style={{ colorScheme: "dark" }} dir="ltr">
                  {GATE_TYPES.map((g) => (
                    <option key={g}>{g}</option>
                  ))}
                </select>
                <input value={gateArea} onChange={(e) => setGateArea(e.target.value)} placeholder={rtl ? "ناحیه (اختیاری)" : "Area (optional)"} className={`${inputCls} w-32`} dir="ltr" />
                <input type="date" value={gateDate} onChange={(e) => setGateDate(e.target.value)} className={inputCls} style={{ colorScheme: "dark" }} dir="ltr" />
                <button onClick={() => void checkGate()} disabled={busy} className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-amber-200 disabled:opacity-40">
                  {rtl ? "سنجش" : "Check"}
                </button>
                {gateRes && (
                  <span
                    className="rounded-lg px-2 py-1 text-[9.5px]"
                    dir="ltr"
                    style={{
                      background: gateRes.verdict === "allow" ? "#8FE3C822" : "#FFD48A22",
                      color: gateRes.verdict === "allow" ? "#8FE3C8" : "#FFD48A",
                    }}
                  >
                    {gateRes.verdict} · {gateRes.reason}
                    {gateRes.permitNo ? ` · ${gateRes.permitNo}` : ""}
                    {gateRes.pending?.length ? ` · pending: ${gateRes.pending.join(",")}` : ""}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === "incidents" && (
          <div className="fade-rise space-y-2">
            <div className="flex gap-2">
              <button onClick={() => setIncOpen((v) => !v)} className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-[10px] text-amber-200">
                + {rtl ? "ثبت حادثه" : "Report incident"}
              </button>
              <button onClick={() => void refresh()} className="rounded-lg border b-line-soft px-3 py-1.5 text-[10px] tx2">
                {rtl ? "تازه‌سازی" : "Refresh"}
              </button>
            </div>
            {incOpen && (
              <div className="glass-dark flex flex-wrap items-center gap-2 rounded-2xl p-3 text-[10px]">
                <select value={incType} onChange={(e) => setIncType(e.target.value as HseIncidentType)} className={inputCls} style={{ colorScheme: "dark" }}>
                  {INC_TYPES.map((t) => (
                    <option key={t} value={t}>{rtl ? INC_FA[t] : t}</option>
                  ))}
                </select>
                <input type="date" value={incDate} onChange={(e) => setIncDate(e.target.value)} className={inputCls} style={{ colorScheme: "dark" }} dir="ltr" />
                <input value={incArea} onChange={(e) => setIncArea(e.target.value)} placeholder={rtl ? "ناحیه" : "Area"} className={`${inputCls} w-28`} dir="ltr" />
                <input value={incDesc} onChange={(e) => setIncDesc(e.target.value)} placeholder={rtl ? "شرح" : "Description"} className={`${inputCls} min-w-[160px] flex-1`} />
                <label className="flex items-center gap-1 tx3" dir="ltr">
                  LT <input type="number" min={0} value={incLost} onChange={(e) => setIncLost(Number(e.target.value))} className={`${inputCls} w-16`} />
                </label>
                {incType === "spill" && (
                  <label className="flex items-center gap-1 tx3" dir="ltr">
                    L <input type="number" min={0} value={incVol} onChange={(e) => setIncVol(Number(e.target.value))} className={`${inputCls} w-20`} />
                  </label>
                )}
                <button onClick={() => void saveIncident()} disabled={busy || !apiOk} className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-emerald-200 disabled:opacity-40">
                  {rtl ? "ثبت" : "Save"}
                </button>
              </div>
            )}
            <div className="glass-dark overflow-x-auto rounded-2xl p-3">
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
                  {incidents.map((i) => (
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
          </div>
        )}

        {tab === "ptw" && (
          <div className="fade-rise space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <select value={role} onChange={(e) => setRole(e.target.value)} className={`${inputCls} text-[10px]`} style={{ colorScheme: "dark" }} dir="ltr">
                {ROLES.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
              <button onClick={() => setPtwOpen((v) => !v)} className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-[10px] text-amber-200">
                + {rtl ? "درخواست پروانه" : "New permit"}
              </button>
              <button onClick={() => void refresh()} className="rounded-lg border b-line-soft px-3 py-1.5 text-[10px] tx2">
                {rtl ? "تازه‌سازی" : "Refresh"}
              </button>
              {ptwWarn.length > 0 && (
                <span className="rounded-lg bg-amber-400/10 px-2 py-1 text-[9px] text-amber-200" dir="ltr">
                  missing: {ptwWarn.join(", ")}
                </span>
              )}
            </div>
            {ptwOpen && (
              <div className="glass-dark flex flex-wrap items-center gap-2 rounded-2xl p-3 text-[10px]">
                <select value={ptwType} onChange={(e) => setPtwType(e.target.value as PtwType)} className={inputCls} style={{ colorScheme: "dark" }} dir="ltr">
                  {PTW_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
                <input type="date" value={ptwDate} onChange={(e) => setPtwDate(e.target.value)} className={inputCls} style={{ colorScheme: "dark" }} dir="ltr" />
                <input value={ptwArea} onChange={(e) => setPtwArea(e.target.value)} placeholder={rtl ? "ناحیه" : "Area"} className={`${inputCls} w-28`} dir="ltr" />
                <select value={ptwRisk} onChange={(e) => setPtwRisk(e.target.value)} className={inputCls} style={{ colorScheme: "dark" }} dir="ltr">
                  {["low", "medium", "high"].map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
                {FLAG_KEYS.map((f) => (
                  <label key={f} className="flex items-center gap-1 tx3" dir="ltr">
                    <input type="checkbox" checked={!!ptwFlags[f]} onChange={(e) => setPtwFlags((m) => ({ ...m, [f]: e.target.checked }))} />
                    {f}
                  </label>
                ))}
                <button onClick={() => void savePermit()} disabled={busy || !apiOk} className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-emerald-200 disabled:opacity-40">
                  {rtl ? "ثبت پیش‌نویس" : "Save draft"}
                </button>
              </div>
            )}
            {permits.map((p) => (
              <div key={p.id} className="glass-dark flex flex-wrap items-center gap-2 rounded-xl p-2.5 text-[10px]">
                <span className="font-mono tx2" dir="ltr">{p.no}</span>
                <span className="rounded bg-amber-400/10 px-2 py-0.5 text-amber-200" dir="ltr">{p.type}</span>
                <span className="tx3" dir="ltr">{p.workDate}</span>
                <span className="tx1">{p.area}</span>
                <span
                  className="rounded px-2 py-0.5 text-[8.5px]"
                  style={{
                    background: p.status === "active" ? "#8FE3C822" : p.status === "suspended" ? "#FF9F9F22" : "#7FB2FF22",
                    color: p.status === "active" ? "#8FE3C8" : p.status === "suspended" ? "#FF9F9F" : "#7FB2FF",
                  }}
                >
                  {rtl ? PTW_FA[p.status] : p.status}
                </span>
                <span className="ms-auto flex gap-1" dir="ltr">
                  {(PTW_NEXT[p.status] ?? []).map((a) => (
                    <button
                      key={a}
                      onClick={() => void runPtwAction(p.id, a)}
                      disabled={busy || !apiOk}
                      className="rounded-lg border b-line-soft px-2 py-0.5 text-[9px] tx2 disabled:opacity-40"
                    >
                      {a}
                    </button>
                  ))}
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
            {inspections.map((n) => {
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
              {incidents.filter((i) => i.type === "spill").map((s) => (
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
