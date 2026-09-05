import { useEffect, useMemo, useState } from "react";
import type { Lang } from "../data/framework";
import {
  ACTIVITIES,
  computeEvm,
  computePhi,
  KPI_SEED,
  kpiWeightSum,
  majorVarianceBlocksReport,
  DATA_DATE,
  FORMULA_VERSION,
} from "../services/projectControls";

export type PmaTab =
  | "dash"
  | "wpd"
  | "evm"
  | "kpi"
  | "phi"
  | "var"
  | "ews"
  | "action"
  | "forecast"
  | "reports"
  | "exec";

const TABS: { id: PmaTab; fa: string; en: string }[] = [
  { id: "dash", fa: "داشبورد PM", en: "PM Dash" },
  { id: "wpd", fa: "WPD", en: "WPD" },
  { id: "evm", fa: "EVM", en: "EVM" },
  { id: "kpi", fa: "KPI", en: "KPI" },
  { id: "phi", fa: "سلامت PHI", en: "PHI" },
  { id: "var", fa: "انحراف", en: "Variance" },
  { id: "ews", fa: "هشدار زود", en: "EWS" },
  { id: "action", fa: "اکشن‌پلن", en: "Action" },
  { id: "forecast", fa: "پیش‌بینی", en: "Forecast" },
  { id: "reports", fa: "گزارش‌ها", en: "Reports" },
  { id: "exec", fa: "یک‌صفحه", en: "EXEC" },
];

export default function PmaWorkspace({
  lang,
  initialTab = "dash",
  hideTabs = false,
}: {
  lang: Lang;
  initialTab?: PmaTab;
  hideTabs?: boolean;
}) {
  const rtl = lang === "fa";
  const [tab, setTab] = useState<PmaTab>(initialTab);
  const [ack, setAck] = useState(false);
  const [hasAction, setHasAction] = useState(false);
  useEffect(() => setTab(initialTab), [initialTab]);

  const evm = useMemo(() => computeEvm(), []);
  const phi = useMemo(() => computePhi(evm), [evm]);
  const blocked = majorVarianceBlocksReport(hasAction);
  const band = phi.band === "Green" ? "#8FE3C8" : phi.band === "Yellow" ? "#FFD48A" : "#FF9F9F";
  const ews = evm.spi < 0.85 ? { l: "Critical", c: "#FF9F9F" } : evm.spi < 0.95 ? { l: "Warning", c: "#FFD48A" } : { l: "Watch", c: "#8FE3C8" };
  const lockedN = ACTIVITIES.filter((a) => a.locked).length;
  const etc = evm.eacCpi - evm.ev;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden" dir={rtl ? "rtl" : "ltr"}>
      <section className="glass-dark shrink-0 rounded-2xl p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-amber-400/40 bg-amber-400/10 text-[15px]">📈</span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[12px] font-semibold tx1">
              {rtl ? "پایش و کنترل عملکرد (PMA/MON)" : "Monitoring & Performance (PMA/MON)"}
            </h3>
            <p className="text-[8.5px] font-extralight tx3">
              {rtl
                ? "فقط Approved · قفل DataDate · Snapshot غیرقابل ویرایش · Excel ظرف است"
                : "Approved only · DataDate lock · immutable snapshot · Excel vessel"}
            </p>
          </div>
          <span className="rounded-lg border b-line-soft px-2 py-1 text-[9px] tx3" dir="ltr">DataDate {DATA_DATE}</span>
          <span className="rounded-lg px-2 py-1 text-[10px] font-semibold tabular-nums" style={{ background: `${band}22`, color: band }}>
            PHI {Math.round(phi.total)}
          </span>
        </div>
      </section>

      {!hideTabs && (
        <nav className="flex shrink-0 flex-wrap gap-1 rounded-xl bg-black/15 p-1">
          {TABS.map((x) => (
            <button
              key={x.id}
              onClick={() => setTab(x.id)}
              className={`rounded-lg px-2.5 py-1.5 text-[10px] font-light ${tab === x.id ? "toggle-on tx1" : "tx3"}`}
            >
              {rtl ? x.fa : x.en}
            </button>
          ))}
        </nav>
      )}

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto pr-1">
        {tab === "dash" && (
          <div className="fade-rise grid gap-2 sm:grid-cols-4">
            {[
              ["SPI", evm.spi.toFixed(2), "#FFD48A"],
              ["CPI", evm.scheduleOnly ? "SO" : (evm.cpi ?? 0).toFixed(2), "#8FE3C8"],
              ["SPI(t)", evm.spiT.toFixed(2), "#7FB2FF"],
              [rtl ? "سلامت" : "PHI", String(Math.round(phi.total)), band],
            ].map(([k, v, c]) => (
              <div key={k} className="glass-dark rounded-2xl p-3">
                <div className="text-[8.5px] tx3">{k}</div>
                <div className="mt-1 text-[18px] font-semibold tabular-nums" style={{ color: c }}>{v}</div>
              </div>
            ))}
            <p className="sm:col-span-4 text-[8.5px] tx4">
              {rtl ? `قفل ${lockedN} · VAC ${evm.vac.toFixed(0)} · EWS ${ews.l}` : `Locked ${lockedN} · VAC ${evm.vac.toFixed(0)} · EWS ${ews.l}`}
            </p>
          </div>
        )}

        {tab === "wpd" && (
          <div className="fade-rise glass-dark rounded-2xl p-3 text-[10px] tx2 space-y-1">
            <div>{rtl ? "منبع: DPR تأییدشده PEX" : "Source: approved PEX DPR"} · {DATA_DATE}</div>
            {ACTIVITIES.map((a) => (
              <div key={a.code} dir="ltr">{a.code} · approved {a.pctApproved} · {a.locked ? "Locked" : "Open"}</div>
            ))}
          </div>
        )}

        {tab === "evm" && (
          <div className="fade-rise glass-dark overflow-x-auto rounded-2xl p-3 text-[10px]">
            <div className="flex gap-3 tabular-nums tx1">
              <span>PV {evm.pv.toFixed(0)}</span>
              <span>EV {evm.ev.toFixed(0)}</span>
              <span>SPI {evm.spi.toFixed(2)}</span>
              <span>EAC {evm.eacCpi.toFixed(0)}</span>
            </div>
            <p className="mt-2 text-[8.5px] tx4">{FORMULA_VERSION} · Schedule-Only</p>
          </div>
        )}

        {tab === "kpi" && (
          <div className="fade-rise space-y-1.5">
            {KPI_SEED.map((k) => (
              <div key={k.code} className="glass-dark flex items-center gap-3 rounded-xl px-3 py-2 text-[10px]">
                <span className="font-mono text-sky-300" dir="ltr">{k.code}</span>
                <span className="tx3">{k.cat}</span>
                <span className="ms-auto tx1">w={k.w}</span>
              </div>
            ))}
            <p className="text-[8.5px] tx4">Σ {kpiWeightSum()}</p>
          </div>
        )}

        {tab === "phi" && (
          <div className="fade-rise glass-dark rounded-2xl p-3 space-y-2 text-[10px]">
            <div className="text-[16px] font-semibold" style={{ color: band }}>PHI {phi.total.toFixed(1)} · {phi.band}</div>
            {([
              [rtl ? "زمان" : "Schedule", 30, Math.round(phi.schedule)],
              [rtl ? "هزینه" : "Cost", 25, Math.round(phi.cost)],
              [rtl ? "کیفیت" : "Quality", 20, Math.round(phi.quality)],
              ["HSE", 15, Math.round(phi.hse)],
              [rtl ? "ریسک" : "Risk", 10, Math.round(phi.risk)],
            ] as const).map(([n, w, s]) => (
              <div key={String(n)}>
                <div className="flex justify-between tx2"><span>{n}</span><span>{w}% · {s}</span></div>
                <div className="mt-0.5 h-1.5 rounded bg-white/10"><div className="h-1.5 rounded bg-amber-300/70" style={{ width: `${s}%` }} /></div>
              </div>
            ))}
          </div>
        )}

        {tab === "var" && (
          <div className="fade-rise glass-dark rounded-2xl p-3 text-[10px] tx2 space-y-2">
            <div>{rtl ? "SV منفی · Major" : "Negative SV · Major"}</div>
            <div className={blocked ? "text-rose-300" : "text-emerald-300"}>
              {blocked ? (rtl ? "گزارش External قفل" : "External report locked") : (rtl ? "باز شد" : "Unblocked")}
            </div>
            <button type="button" onClick={() => setHasAction(true)} className="rounded-lg border b-line-soft px-2 py-1 text-[9px] tx2">
              {rtl ? "ثبت Action" : "Link Action"}
            </button>
          </div>
        )}

        {tab === "ews" && (
          <div className="fade-rise glass-dark flex items-center gap-2 rounded-xl p-3 text-[10px]">
            <span className="text-rose-300">Critical</span>
            <span className="tx1">SPI {evm.spi.toFixed(2)}</span>
            <button type="button" onClick={() => setAck(true)} className="ms-auto rounded border b-line-soft px-2 py-1 text-[9px] tx2">
              {ack ? "ACK" : rtl ? "تأیید ≤۲۴س" : "Ack ≤24h"}
            </button>
          </div>
        )}

        {tab === "action" && (
          <div className="fade-rise space-y-1.5 text-[10px]">
            {["Master PEX", "AP-3M", "AP-2M", "AP-1M", "Look-ahead"].map((h, i) => (
              <div key={h} className="glass-dark rounded-xl px-3 py-2 tx1" style={{ marginInlineStart: i * 8 }}>{h}</div>
            ))}
          </div>
        )}

        {tab === "forecast" && (
          <div className="fade-rise glass-dark rounded-2xl p-3 text-[10px] tx2">
            EAC {evm.eacCpi.toFixed(0)} · ETC {etc.toFixed(0)} · SPI {evm.spi.toFixed(2)} · {FORMULA_VERSION}
          </div>
        )}

        {tab === "reports" && (
          <div className="fade-rise glass-dark rounded-2xl p-3 flex flex-wrap gap-1.5">
            {["D", "W", "BW", "M", "Q", "GATE", "ADH", "TRD", "EXEC", "EV", "VA", "KPI", "ALT", "ACT"].map((c) => (
              <span key={c} className="rounded-lg border b-line-soft px-2 py-1 text-[9px] tx2">RPT-{c}</span>
            ))}
            {blocked && <p className="w-full text-[9px] text-rose-300">{rtl ? "تولید External تا رفع Major ممکن نیست" : "Blocked until Major closed"}</p>}
          </div>
        )}

        {tab === "exec" && (
          <div className="fade-rise glass-dark grid gap-2 rounded-2xl p-3 sm:grid-cols-3 text-[10px]">
            {[
              [rtl ? "پیشرفت" : "Progress", `${Math.round((evm.ev / evm.bac) * 100)}%`],
              [rtl ? "زمان" : "Time", `SPI ${evm.spi.toFixed(2)}`],
              [rtl ? "هزینه" : "Cost", "Schedule-Only"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border b-line-soft p-2">
                <div className="tx3">{k}</div>
                <div className="tx1 font-medium">{v}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
