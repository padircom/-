import { useEffect, useMemo, useState } from "react";
import { type Bi, type Lang, t } from "../data/framework";
import {
  ACTIVITIES,
  computeEvm,
  computePhi,
  DATA_DATE,
  FORMULA_VERSION,
  majorVarianceBlocksReport,
} from "../services/projectControls";
import {
  RBS,
  IMPACT_DIMS,
  DELAY_METHODS,
  ccbEscalate,
  depletionAlert,
  execPack,
  guardianTick,
  impactReady,
  parseRiskCsv,
  quantumDays,
  scoreColor,
  seedNotices,
  type CcbRole,
  type Notice,
} from "../services/rcc";

export type D4Tab =
  | "matrix"
  | "register"
  | "reserve"
  | "issue"
  | "change"
  | "ccb"
  | "delay"
  | "claim"
  | "notice"
  | "dispute"
  | "exec";

type Props = {
  lang: Lang;
  subId?: string;
  initialTab?: D4Tab;
  hideTabs?: boolean;
};

type RiskStatus = "open" | "mitigated" | "accepted";
type RiskRow = {
  id: string;
  title: Bi;
  probability: number;
  impact: number;
  owner: string;
  status: RiskStatus;
  source: string;
  cause?: string;
  event?: string;
  effect?: string;
  rbs?: string;
};
type ChangeRow = {
  id: string;
  title: Bi;
  reason: Bi;
  timeImpact: string;
  costImpact: string;
  status: "pending" | "approved" | "rejected";
  fromPim: boolean;
  days: number;
  cost: number;
  emergency: boolean;
};
type IssueRow = { id: string; title: string; source: string; convert: "cr" | "claim" | "" };

const TABS: { id: D4Tab; fa: string; en: string }[] = [
  { id: "matrix", fa: "ماتریس", en: "Matrix" },
  { id: "register", fa: "ثبت ریسک", en: "Register" },
  { id: "reserve", fa: "ذخیره / پایش", en: "Reserve / monitor" },
  { id: "issue", fa: "مسئله", en: "Issue" },
  { id: "change", fa: "تغییر", en: "Change" },
  { id: "ccb", fa: "CCB", en: "CCB" },
  { id: "delay", fa: "تأخیر", en: "Delay" },
  { id: "claim", fa: "ادعا", en: "Claim" },
  { id: "notice", fa: "Notice / Time-Bar", en: "Notice / Time-Bar" },
  { id: "dispute", fa: "اختلاف", en: "Dispute" },
  { id: "exec", fa: "EXEC", en: "EXEC" },
];

const tabFromSub = (subId?: string): D4Tab => {
  if (subId === "d4-p3-s1" || subId === "d4-p3-imp") return "change";
  if (subId === "d4-p3-ccb") return "ccb";
  if (subId === "d4-p4-s1" || subId === "d4-p4-tia") return "delay";
  if (subId === "d4-p5-s1" || subId === "d4-p5-gate") return "claim";
  if (subId === "d4-p5-ntc" || subId === "d4-p5-tb") return "notice";
  if (subId === "d4-p5-dsp") return "dispute";
  if (subId === "d4-p5-exe") return "exec";
  if (subId === "d4-p1-s1" || subId === "d4-p1-cee") return "register";
  if (subId === "d4-p1-rsv") return "reserve";
  if (subId === "d4-p1-iss") return "issue";
  if (subId === "d4-p1-mx") return "matrix";
  return "matrix";
};

const seedRisks: RiskRow[] = [
  { id: "r1", title: { fa: "تأخیر Long Lead", en: "Long-lead delay" }, probability: 4, impact: 5, owner: "Procurement", status: "open", source: "PEX TF=0", cause: "تأمین", event: "تأخیر حمل", effect: "لغزش CP", rbs: "PRC" },
  { id: "r2", title: { fa: "محدودیت ماشین‌آلات", en: "Equipment constraint" }, probability: 4, impact: 4, owner: "Site", status: "open", source: "DPR", rbs: "CON" },
  { id: "r3", title: { fa: "تغییر مشخصات فنی", en: "Spec change" }, probability: 3, impact: 4, owner: "Engineering", status: "mitigated", source: "PIM Code-3", rbs: "TEC" },
  { id: "r4", title: { fa: "VAR عمده بدون اکشن", en: "Major VAR no action" }, probability: 5, impact: 5, owner: "PMO", status: "open", source: "PMA EWS", rbs: "PM" },
];

const seedChanges: ChangeRow[] = [
  { id: "cr1", title: { fa: "تغییر مسیر خط لوله", en: "Pipeline reroute" }, reason: { fa: "تعارض زیرساخت", en: "Utility clash" }, timeImpact: "+12d", costImpact: "+$180k", status: "pending", fromPim: true, days: 12, cost: 180000, emergency: false },
  { id: "cr2", title: { fa: "کلاس بتن فونداسیون", en: "Concrete class" }, reason: { fa: "الزام فنی", en: "Tech requirement" }, timeImpact: "+4d", costImpact: "+$42k", status: "approved", fromPim: false, days: 4, cost: 42000, emergency: false },
];

const statusText: Record<RiskStatus, Bi> = {
  open: { fa: "باز", en: "Open" },
  mitigated: { fa: "کنترل‌شده", en: "Mitigated" },
  accepted: { fa: "پذیرفته‌شده", en: "Accepted" },
};

export default function RiskClaimsWorkspace({ lang, subId, initialTab, hideTabs = false }: Props) {
  const rtl = lang === "fa";
  const [tab, setTab] = useState<D4Tab>(initialTab ?? tabFromSub(subId));
  const [risks, setRisks] = useState<RiskRow[]>(seedRisks);
  const [changes, setChanges] = useState<ChangeRow[]>(seedChanges);
  const [notices, setNotices] = useState<Notice[]>(() => seedNotices());
  const [guardLog, setGuardLog] = useState("");
  const [riskTitle, setRiskTitle] = useState("");
  const [cause, setCause] = useState("");
  const [event, setEvent] = useState("");
  const [effect, setEffect] = useState("");
  const [rbs, setRbs] = useState("PM");
  const [riskP, setRiskP] = useState("3");
  const [riskI, setRiskI] = useState("3");
  const [riskOwner, setRiskOwner] = useState("");
  const [changeTitle, setChangeTitle] = useState("");
  const [changeReason, setChangeReason] = useState("");
  const [hasAction, setHasAction] = useState(false);
  const [dims, setDims] = useState<Record<string, boolean>>(() => Object.fromEntries(IMPACT_DIMS.map((d) => [d, false])));
  const [issues, setIssues] = useState<IssueRow[]>([{ id: "i1", title: "Long-lead realized", source: "realized_risk", convert: "" }]);
  const [ccbRole, setCcbRole] = useState<CcbRole>("PM");
  const [justif, setJustif] = useState("");
  const [ccbLog, setCcbLog] = useState("");
  const [entitlement, setEntitlement] = useState(true);
  const [causation, setCausation] = useState(true);
  const [quantumOk, setQuantumOk] = useState(false);
  const [dispute, setDispute] = useState("negotiation");
  const [settleViaCr, setSettleViaCr] = useState(false);
  const [opening] = useState(1_000_000);
  const [balance, setBalance] = useState(720_000);
  const [txAmt, setTxAmt] = useState("10000");
  const [hover, setHover] = useState<string | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    setTab(initialTab ?? tabFromSub(subId));
  }, [initialTab, subId]);

  const evm = useMemo(() => computeEvm(), []);
  const phi = useMemo(() => computePhi(evm), [evm]);
  const blocked = majorVarianceBlocksReport(hasAction);
  const baselineLocked = ACTIVITIES.some((a) => a.locked);
  const claimOk = baselineLocked && Boolean(DATA_DATE);
  const critical = risks.filter((r) => r.probability * r.impact >= 12).length;
  const progressPct = evm.bac ? (evm.ev / evm.bac) * 100 : 0;
  const depleted = depletionAlert(progressPct, opening, balance);
  const watch = useMemo(() => guardianTick(notices), [notices]);
  const hotWatch = watch.filter((w) => w.daysLeft <= 3);
  const tfZero = ACTIVITIES.filter((a) => a.tfH <= 0).length;
  const qDays = quantumDays(tfZero);
  const dimsOk = impactReady(dims);
  const pack = execPack({
    risks: risks.length,
    issues: issues.length,
    crs: changes.length,
    claims: notices.length,
    noticesBarred: notices.filter((n) => n.timeBarred).length,
    spi: evm.spi,
    phi: phi.total,
  });

  const addRisk = () => {
    if (!riskTitle.trim() || !riskOwner.trim()) {
      setErr(rtl ? "عنوان و مالک اجباری است." : "Title and owner are required.");
      return;
    }
    setErr("");
    setRisks((prev) => [
      {
        id: `r-${Date.now()}`,
        title: { fa: riskTitle, en: riskTitle },
        probability: Number(riskP),
        impact: Number(riskI),
        owner: riskOwner,
        status: "open",
        source: "Manual",
        cause,
        event,
        effect,
        rbs,
      },
      ...prev,
    ]);
    setRiskTitle("");
    setCause("");
    setEvent("");
    setEffect("");
    setRiskOwner("");
  };

  const addChange = () => {
    if (!changeTitle.trim() || !dimsOk) return;
    setChanges((prev) => [
      {
        id: `cr-${Date.now()}`,
        title: { fa: changeTitle, en: changeTitle },
        reason: { fa: changeReason || "—", en: changeReason || "—" },
        timeImpact: "TBD",
        costImpact: "TBD",
        status: "pending",
        fromPim: false,
        days: 0,
        cost: 0,
        emergency: false,
      },
      ...prev,
    ]);
    setChangeTitle("");
    setChangeReason("");
  };

  const runGuardian = () => {
    const ev = guardianTick(notices);
    setNotices((prev) =>
      prev.map((n) => {
        const hit = ev.find((e) => e.noticeId === n.id && e.action === "mark_time_barred");
        return hit ? { ...n, timeBarred: true } : n;
      })
    );
    setGuardLog(ev.map((e) => `${e.ews} ${e.noticeId} d=${e.daysLeft} ${e.action}`).join(" · ") || (rtl ? "موردی نیست" : "none"));
  };

  const onCsv = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseRiskCsv(String(reader.result || ""));
      setRisks((prev) => [
        ...rows.map((r, i) => ({
          id: `csv-${Date.now()}-${i}`,
          title: { fa: r.title, en: r.title },
          probability: r.probability,
          impact: r.impact,
          owner: r.owner || "CSV",
          status: "open" as const,
          source: "Excel vessel",
          cause: r.cause,
          event: r.event,
          effect: r.effect,
          rbs: r.rbs,
        })),
        ...prev,
      ]);
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden" dir={rtl ? "rtl" : "ltr"}>
      <section className="glass-dark shrink-0 rounded-2xl p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-rose-400/40 bg-rose-400/10 text-[15px]">⚠</span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[12px] font-semibold tx1">{rtl ? "ریسک، تغییر و ادعا (d4)" : "Risk, change & claims (d4)"}</h3>
            <p className="text-[8.5px] font-extralight tx3">
              {rtl ? "F1–F8 روی workspace · اعداد PEX/PMA فقط خواندنی" : "F1–F8 on workspace · PEX/PMA read-only"}
            </p>
          </div>
          <span className="rounded-lg bg-black/20 px-2 py-1 text-[9px] tx2" dir="ltr">
            SPI {evm.spi.toFixed(2)} · PHI {Math.round(phi.total)}
          </span>
          {hotWatch.length > 0 && (
            <span className="rounded-lg border border-rose-400/40 bg-rose-400/10 px-2 py-1 text-[9px] text-rose-300">Time-Bar {hotWatch.length}</span>
          )}
          {depleted && (
            <span className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-2 py-1 text-[9px] text-amber-200">
              {rtl ? "تهی ذخیره > پیشرفت+۱۰٪" : "Reserve depletion"}
            </span>
          )}
          {blocked && (
            <span className="rounded-lg border border-rose-400/40 bg-rose-400/10 px-2 py-1 text-[9px] text-rose-300">
              {rtl ? "گزارش PMA قفل" : "PMA locked"}
            </span>
          )}
        </div>
        {!hideTabs && (
          <div className="mt-2 flex flex-wrap gap-1">
            {TABS.map((tb) => (
              <button key={tb.id} type="button" onClick={() => setTab(tb.id)} className={`rounded-lg px-2 py-1 text-[9.5px] ${tab === tb.id ? "toggle-on tx1" : "tx3"}`}>
                {rtl ? tb.fa : tb.en}
              </button>
            ))}
          </div>
        )}
      </section>

      {(tab === "matrix" || tab === "register") && (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden xl:grid-cols-2">
          {tab === "register" && (
            <section className="glass-dark flex min-h-0 flex-col overflow-hidden rounded-2xl">
              <header className="border-b b-line-soft px-3 py-2">
                <h4 className="text-[11px] tx1">{rtl ? "شناسایی Cause–Event–Effect" : "Cause–Event–Effect"}</h4>
              </header>
              <div className="grid grid-cols-2 gap-2 border-b b-line-soft p-2.5">
                <input value={riskTitle} onChange={(e) => setRiskTitle(e.target.value)} placeholder={rtl ? "عنوان*" : "Title*"} className="col-span-2 rounded-lg border b-line-soft bg-[var(--row)] px-2 py-1.5 text-[10px] tx1 outline-none" />
                <input value={cause} onChange={(e) => setCause(e.target.value)} placeholder={rtl ? "علت" : "Cause"} className="rounded-lg border b-line-soft bg-[var(--row)] px-2 py-1.5 text-[10px] tx1 outline-none" />
                <input value={event} onChange={(e) => setEvent(e.target.value)} placeholder={rtl ? "رویداد" : "Event"} className="rounded-lg border b-line-soft bg-[var(--row)] px-2 py-1.5 text-[10px] tx1 outline-none" />
                <input value={effect} onChange={(e) => setEffect(e.target.value)} placeholder={rtl ? "اثر" : "Effect"} className="col-span-2 rounded-lg border b-line-soft bg-[var(--row)] px-2 py-1.5 text-[10px] tx1 outline-none" />
                <select value={rbs} onChange={(e) => setRbs(e.target.value)} className="rounded-lg border b-line-soft bg-[var(--row)] px-2 py-1.5 text-[9.5px] tx1">
                  {RBS.map((b) => (
                    <option key={b.code} value={b.code}>{b.code} · {rtl ? b.fa : b.en}</option>
                  ))}
                </select>
                <input value={riskOwner} onChange={(e) => setRiskOwner(e.target.value)} placeholder={rtl ? "مالک*" : "Owner*"} className="rounded-lg border b-line-soft bg-[var(--row)] px-2 py-1.5 text-[10px] tx1 outline-none" />
                <select value={riskP} onChange={(e) => setRiskP(e.target.value)} className="rounded-lg border b-line-soft bg-[var(--row)] px-2 py-1.5 text-[9.5px] tx1">{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>P{n}</option>)}</select>
                <select value={riskI} onChange={(e) => setRiskI(e.target.value)} className="rounded-lg border b-line-soft bg-[var(--row)] px-2 py-1.5 text-[9.5px] tx1">{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>I{n}</option>)}</select>
                <button type="button" onClick={addRisk} className="rounded-lg border border-rose-400/50 bg-rose-400/10 px-2 py-1.5 text-[9.5px] text-rose-300">+ {rtl ? "ثبت" : "Add"}</button>
                <label className="rounded-lg border b-line-soft px-2 py-1.5 text-center text-[9px] tx3">
                  {rtl ? "اکسل ظرف" : "Excel vessel"}
                  <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => onCsv(e.target.files?.[0])} />
                </label>
                {err && <div className="col-span-2 text-[9px] text-rose-300">{err}</div>}
              </div>
              <div className="thin-scroll min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2">
                {risks.map((r) => (
                  <div key={r.id} className="glass-row rounded-xl px-2.5 py-2">
                    <div className="flex items-center gap-2">
                      <i className="h-2 w-2 rounded-full" style={{ background: scoreColor(r.probability * r.impact) }} />
                      <span className="min-w-0 flex-1 truncate text-[10px] tx1">{t(r.title, lang)}</span>
                      <span className="text-[8px] tx4">{r.rbs}</span>
                      <b className="text-[10px] tabular-nums" style={{ color: scoreColor(r.probability * r.impact) }}>{r.probability * r.impact}</b>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 text-[8.5px] tx3">
                      <span>{t(statusText[r.status], lang)}</span>
                      <span>{r.owner}</span>
                      {r.cause && <span>C:{r.cause}</span>}
                      <span className="ms-auto" dir="ltr">{r.source}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
          <section className="glass-dark flex min-h-0 flex-col overflow-hidden rounded-2xl p-3">
            <div className="flex items-center gap-2">
              <h4 className="text-[11px] tx1">{rtl ? "ماتریس از آستانه پلن (۸/۱۲/۱۶)" : "Matrix from plan 8/12/16"}</h4>
              <span className="ms-auto text-[9px] text-rose-300">{critical} {rtl ? "بحرانی" : "critical"}</span>
            </div>
            <div className="mt-3 grid grid-cols-[22px_repeat(5,minmax(0,1fr))] gap-1">
              <div />
              {[1, 2, 3, 4, 5].map((n) => <div key={n} className="text-center text-[8px] tx4">I{n}</div>)}
              {[5, 4, 3, 2, 1].map((p) => (
                <div key={p} className="contents">
                  <div className="flex items-center justify-center text-[8px] tx4">P{p}</div>
                  {[1, 2, 3, 4, 5].map((i) => {
                    const key = `${p}-${i}`;
                    const count = risks.filter((r) => r.probability === p && r.impact === i).length;
                    const col = scoreColor(p * i);
                    return (
                      <button key={key} type="button" onMouseEnter={() => setHover(key)} onMouseLeave={() => setHover(null)} className="relative aspect-square rounded-lg border" style={{ background: `${col}30`, borderColor: `${col}88` }}>
                        <span className="text-[10px]" style={{ color: col }}>{count || "·"}</span>
                        {hover === key && <span className="absolute inset-x-0 -top-5 text-[7px] tx1">{p}×{i}</span>}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            <p className="mt-3 text-[9px] leading-5 tx3">
              {rtl ? "PHI/SPI موتور مشترک فقط خواندنی است." : "Shared PHI/SPI is read-only."}
            </p>
          </section>
        </div>
      )}

      {tab === "reserve" && (
        <section className="glass-dark min-h-0 flex-1 overflow-y-auto rounded-2xl p-3">
          <h4 className="text-[11px] tx1">{rtl ? "دفتر ذخیره (Contingency)" : "Reserve ledger (contingency)"}</h4>
          <p className="mt-0.5 text-[8.5px] tx3">
            {rtl ? `پیشرفت از EV/BAC موتور: ${progressPct.toFixed(1)}٪ — RCC عدد را عوض نمی‌کند.` : `Progress from EV/BAC engine: ${progressPct.toFixed(1)}% — RCC does not rewrite it.`}
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="glass-row rounded-xl p-2.5"><div className="text-[8px] tx3">{rtl ? "افتتاح" : "Opening"}</div><div className="text-[14px] tx1" dir="ltr">{opening.toLocaleString()}</div></div>
            <div className="glass-row rounded-xl p-2.5"><div className="text-[8px] tx3">{rtl ? "مانده" : "Balance"}</div><div className="text-[14px] tx1" dir="ltr">{balance.toLocaleString()}</div></div>
            <div className="glass-row rounded-xl p-2.5"><div className="text-[8px] tx3">{rtl ? "مصرف٪" : "Used %"}</div><div className="text-[14px] tx1" dir="ltr">{((1 - balance / opening) * 100).toFixed(1)}</div></div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <input value={txAmt} onChange={(e) => setTxAmt(e.target.value)} className="w-28 rounded-lg border b-line-soft bg-[var(--row)] px-2 py-1.5 text-[10px] tx1 outline-none" dir="ltr" />
            {(["consume", "commit", "release"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  const a = Math.abs(Number(txAmt) || 0);
                  if (!a) return;
                  setBalance((b) => (k === "release" ? b + a : Math.max(0, b - a)));
                }}
                className="rounded-lg border b-line-soft px-2 py-1.5 text-[9.5px] tx2"
              >
                {k}
              </button>
            ))}
          </div>
        </section>
      )}

      {tab === "issue" && (
        <section className="glass-dark min-h-0 flex-1 overflow-y-auto rounded-2xl p-3">
          <h4 className="text-[11px] tx1">{rtl ? "مسئله از ریسک محقق" : "Issue from realized risk"}</h4>
          <button
            type="button"
            className="mt-2 rounded-lg border b-line-soft px-2 py-1.5 text-[9.5px] tx2"
            onClick={() => {
              const hi = risks.filter((r) => r.probability * r.impact >= 16);
              setIssues((prev) => [
                ...hi.map((r) => ({ id: `iss-${r.id}`, title: t(r.title, lang), source: "realized_risk", convert: "" as const })),
                ...prev,
              ]);
            }}
          >
            {rtl ? "پیشنهاد از ریسک High" : "Suggest from High risks"}
          </button>
          <div className="mt-2 space-y-1.5">
            {issues.map((i) => (
              <div key={i.id} className="glass-row flex flex-wrap items-center gap-2 rounded-xl px-2.5 py-2 text-[10px]">
                <span className="flex-1 tx1">{i.title}</span>
                <span className="tx4">{i.source}</span>
                <button type="button" className="rounded border b-line-soft px-1.5 py-0.5 text-[8.5px] tx2" onClick={() => setIssues((p) => p.map((x) => (x.id === i.id ? { ...x, convert: "cr" } : x)))}>→ CR</button>
                <button type="button" className="rounded border b-line-soft px-1.5 py-0.5 text-[8.5px] tx2" onClick={() => setIssues((p) => p.map((x) => (x.id === i.id ? { ...x, convert: "claim" } : x)))}>→ Claim</button>
                {i.convert && <span className="text-amber-200">{i.convert}</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "change" && (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden xl:grid-cols-[.9fr_1.2fr]">
          <section className="glass-dark overflow-y-auto rounded-2xl p-3">
            <h4 className="text-[11px] tx1">{rtl ? "درخواست تغییر · ۱۲ بُعد" : "Change request · 12 dims"}</h4>
            <p className="mt-0.5 text-[8.5px] tx3">{rtl ? "بدون دستکاری Baseline" : "No baseline rewrite"}</p>
            <div className="mt-3 space-y-2">
              <input value={changeTitle} onChange={(e) => setChangeTitle(e.target.value)} placeholder={rtl ? "عنوان CR…" : "CR title…"} className="w-full rounded-lg border b-line-soft bg-[var(--row)] px-2.5 py-2 text-[10px] tx1 outline-none" />
              <textarea value={changeReason} onChange={(e) => setChangeReason(e.target.value)} placeholder={rtl ? "علت…" : "Reason…"} className="h-16 w-full resize-none rounded-lg border b-line-soft bg-[var(--row)] px-2.5 py-2 text-[10px] tx1 outline-none" />
              <div className="grid grid-cols-3 gap-1">
                {IMPACT_DIMS.map((d) => (
                  <label key={d} className="flex items-center gap-1 text-[8px] tx3">
                    <input type="checkbox" checked={!!dims[d]} onChange={(e) => setDims((p) => ({ ...p, [d]: e.target.checked }))} />
                    {d}
                  </label>
                ))}
              </div>
              <button type="button" disabled={!dimsOk} onClick={addChange} className="w-full rounded-lg border border-amber-400/50 bg-amber-400/10 py-2 text-[10px] text-amber-200 disabled:opacity-40">+ CR</button>
            </div>
          </section>
          <section className="glass-dark min-h-0 overflow-y-auto rounded-2xl p-3">
            {changes.map((c) => (
              <div key={c.id} className="glass-row mb-2 rounded-xl p-3">
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-[11px] tx1">{t(c.title, lang)}</span>
                  <span className="rounded bg-amber-400/10 px-1.5 py-0.5 text-[8.5px] text-amber-200">{c.status}</span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-[9px] tx3">
                  <span>{t(c.reason, lang)}</span>
                  <span dir="ltr">{c.timeImpact}</span>
                  <span dir="ltr">{c.costImpact}</span>
                </div>
              </div>
            ))}
          </section>
        </div>
      )}

      {tab === "ccb" && (
        <section className="glass-dark min-h-0 flex-1 overflow-y-auto rounded-2xl p-3 space-y-2">
          <h4 className="text-[11px] tx1">{rtl ? "کمیته کنترل تغییر" : "Change Control Board"}</h4>
          <div className="flex flex-wrap gap-2">
            {(["PM", "PMO", "Sponsor", "CCB"] as CcbRole[]).map((r) => (
              <button key={r} type="button" onClick={() => setCcbRole(r)} className={`rounded-lg px-2 py-1 text-[9px] ${ccbRole === r ? "toggle-on tx1" : "tx3"}`}>{r}</button>
            ))}
          </div>
          <textarea value={justif} onChange={(e) => setJustif(e.target.value)} placeholder={rtl ? "توجیه اجباری…" : "Justification required…"} className="h-16 w-full resize-none rounded-lg border b-line-soft bg-[var(--row)] px-2.5 py-2 text-[10px] tx1 outline-none" />
          {changes.filter((c) => c.status === "pending").map((c) => {
            const esc = ccbEscalate(ccbRole, c.cost, c.days, c.emergency);
            return (
              <div key={c.id} className="glass-row rounded-xl p-2.5 text-[10px]">
                <div className="tx1">{t(c.title, lang)}</div>
                <div className="mt-1 tx3" dir="ltr">{c.cost} · {c.days}d {esc ? "→ escalate" : ""}</div>
                <div className="mt-2 flex gap-1">
                  {(["approved", "rejected"] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      disabled={!justif.trim() || !dimsOk}
                      onClick={() => {
                        setChanges((p) => p.map((x) => (x.id === c.id ? { ...x, status: st } : x)));
                        setCcbLog(`${st} ${c.id} by ${ccbRole}`);
                      }}
                      className="rounded border b-line-soft px-2 py-1 text-[8.5px] tx2 disabled:opacity-40"
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          {ccbLog && <p className="text-[8.5px] tx4">{rtl ? "پیشنهاد اسنپ‌شات به PEX — عدد قفل نوشته نشد." : "Snapshot suggested to PEX — locked numbers not written."} {ccbLog}</p>}
        </section>
      )}

      {tab === "delay" && (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden xl:grid-cols-2">
          <section className="glass-dark space-y-2 overflow-y-auto rounded-2xl p-3">
            <h4 className="text-[11px] tx1">{rtl ? "۸ روش تأخیر" : "8 delay methods"}</h4>
            {DELAY_METHODS.map((m) => (
              <div key={m.code} className="glass-row rounded-xl px-2.5 py-2">
                <div className="text-[10px] tx1">{rtl ? m.fa : m.en}</div>
                <div className="text-[8px] tx4" dir="ltr">{m.code}</div>
              </div>
            ))}
            <div className="rounded-xl border b-line-soft p-2.5 text-[9px] tx3">
              PEX locked: {ACTIVITIES.filter((a) => a.locked).map((a) => a.code).join(" · ")}
            </div>
          </section>
          <section className="glass-dark rounded-2xl p-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="glass-row rounded-xl p-2.5">
                <div className="text-[8.5px] tx3">SPI</div>
                <div className="text-[16px] tx1" dir="ltr">{evm.spi.toFixed(3)}</div>
              </div>
              <div className="glass-row rounded-xl p-2.5">
                <div className="text-[8.5px] tx3">{rtl ? "کوانتوم روز" : "Quantum days"}</div>
                <div className="text-[16px] tx1" dir="ltr">{qDays}</div>
              </div>
            </div>
            <p className="mt-3 text-[9.5px] leading-5 tx2">
              {rtl
                ? `TF=0 × ۱۲روز = ${qDays} · pctApproved دست نخورده · ${FORMULA_VERSION}`
                : `TF=0 × 12d = ${qDays} · pctApproved untouched · ${FORMULA_VERSION}`}
            </p>
          </section>
        </div>
      )}

      {tab === "claim" && (
        <section className="glass-dark min-h-0 flex-1 overflow-y-auto rounded-2xl p-3">
          {!claimOk ? (
            <div className="rounded-xl border border-rose-400/40 bg-rose-400/10 p-3 text-[11px] text-rose-200">
              {rtl ? "ادعا بدون Baseline قفل و DataDate مجاز نیست." : "Claim blocked without locked BL + DataDate."}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-[10px]">
                <label className="glass-row rounded-xl p-2.5"><input type="checkbox" checked={entitlement} onChange={(e) => setEntitlement(e.target.checked)} /> Entitlement</label>
                <label className="glass-row rounded-xl p-2.5"><input type="checkbox" checked={causation} onChange={(e) => setCausation(e.target.checked)} /> Causation</label>
                <label className="glass-row rounded-xl p-2.5"><input type="checkbox" checked={quantumOk} onChange={(e) => setQuantumOk(e.target.checked)} /> Quantum {qDays}d</label>
              </div>
              <p className={`text-[9.5px] ${entitlement && causation && quantumOk ? "text-emerald-300" : "text-rose-300"}`}>
                {entitlement && causation && quantumOk ? (rtl ? "بسته قابل ارسال" : "Package sendable") : (rtl ? "سه محور اجباری" : "All three axes required")}
              </p>
              <label className="flex items-center gap-2 text-[10px] tx2">
                <input type="checkbox" checked={hasAction} onChange={(e) => setHasAction(e.target.checked)} />
                {rtl ? "اکشن Major VAR (رفع قفل گزارش PMA)" : "Major VAR action (lift PMA lock)"}
              </label>
            </div>
          )}
        </section>
      )}

      {tab === "notice" && (
        <section className="glass-dark flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl p-3">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-[11px] tx1">{rtl ? "نگهبان Time-Bar" : "Time-Bar guardian"}</h4>
            <button type="button" onClick={runGuardian} className="rounded-lg border border-rose-400/50 bg-rose-400/10 px-2 py-1 text-[9.5px] text-rose-200">
              {rtl ? "اجرای نگهبان" : "Run guardian"}
            </button>
            {guardLog && <span className="text-[8px] tx3" dir="ltr">{guardLog}</span>}
          </div>
          <div className="thin-scroll mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto">
            {notices.map((n) => {
              const ev = watch.find((w) => w.noticeId === n.id);
              return (
                <div key={n.id} className="glass-row rounded-xl px-2.5 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] tx1">{n.title}</span>
                    <span className="text-[8px] tx4" dir="ltr">{n.clause}</span>
                    <span className="ms-auto text-[9px] tabular-nums tx2" dir="ltr">{n.dueAt}</span>
                  </div>
                  <div className="mt-1 flex gap-2 text-[8.5px] tx3">
                    <span>{n.claimId}</span>
                    {n.timeBarred && <span className="text-rose-300">TIME-BARRED</span>}
                    {ev && !n.timeBarred && <span>{ev.ews} · {ev.daysLeft}d</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {tab === "dispute" && (
        <section className="glass-dark min-h-0 flex-1 overflow-y-auto rounded-2xl p-3 space-y-2">
          <h4 className="text-[11px] tx1">{rtl ? "مذاکره / تسویه / اختلاف" : "Negotiation / settlement / dispute"}</h4>
          <div className="flex flex-wrap gap-1">
            {["negotiation", "adjudication", "arbitration", "court"].map((s) => (
              <button key={s} type="button" onClick={() => setDispute(s)} className={`rounded-lg px-2 py-1 text-[9px] ${dispute === s ? "toggle-on tx1" : "tx3"}`}>{s}</button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-[10px] tx2">
            <input type="checkbox" checked={settleViaCr} onChange={(e) => setSettleViaCr(e.target.checked)} />
            {rtl ? "تسویه فقط از طریق CR مصوب (BAC دست‌نخورده)" : "Settlement only via approved CR (BAC untouched)"}
          </label>
          <p className="text-[9px] tx3">
            {settleViaCr
              ? (rtl ? "اثر مالی → دفتر ذخیره F2، نه بازنویسی BAC." : "Financial effect → F2 ledger, not BAC rewrite.")
              : (rtl ? "بدون CR: پیش‌نویس ذخیره می‌ماند." : "Without CR: settlement stays draft.")}
          </p>
        </section>
      )}

      {tab === "exec" && (
        <section className="glass-dark min-h-0 flex-1 overflow-y-auto rounded-2xl p-3">
          <h4 className="text-[11px] tx1">{rtl ? "گراف یک‌صفحه" : "One-page graph"}</h4>
          <div className="mt-3 flex flex-wrap items-center gap-1 text-[10px]">
            {pack.chain.map((n, i) => (
              <span key={n} className="contents">
                <span className="rounded-lg border b-line-soft px-2 py-1 tx1">{n}</span>
                {i < pack.chain.length - 1 && <span className="tx4">→</span>}
              </span>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
            <div className="glass-row rounded-xl p-2">RSK {pack.counts.risks}</div>
            <div className="glass-row rounded-xl p-2">ISS {pack.counts.issues}</div>
            <div className="glass-row rounded-xl p-2">CR {pack.counts.crs}</div>
            <div className="glass-row rounded-xl p-2">CLM {pack.counts.claims}</div>
            <div className="glass-row rounded-xl p-2">TB {pack.counts.noticesBarred}</div>
            <div className="glass-row rounded-xl p-2" dir="ltr">SPI {pack.counts.spi.toFixed(2)} RO</div>
          </div>
        </section>
      )}
    </div>
  );
}
