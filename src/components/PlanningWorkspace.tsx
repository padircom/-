import { useEffect, useMemo, useState } from "react";
import { t, type Lang } from "../data/framework";
import { ACTIVITIES, computeEvm, computePhi, DATA_DATE } from "../services/projectControls";

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

const acts = ACTIVITIES.map((a) => ({
  code: a.code,
  name: { fa: a.nameFa, en: a.nameEn },
  dur: a.durH,
  tf: a.tfH,
  crit: a.tfH <= 0,
  pct: Math.round(a.pctApproved * 100),
}));

const ms = [
  { code: "MS-MECH-RFSU", type: "Contractual", status: "Delayed", contractual: "1404/11/14", forecast: "1404/11/28", penalty: 125000 },
  { code: "MS-CIV-FOC", type: "Key", status: "AtRisk", contractual: "1403/07/01", forecast: "1403/07/04", penalty: 0 },
  { code: "MS-PIP-HYDRO", type: "Gate", status: "OnTrack", contractual: "1403/09/15", forecast: "1403/09/12", penalty: 0 },
];

const roc = [
  { code: "CIV-FND", fa: "فونداسیون", steps: "گود ۱۰ · مگر ۸ · آرماتور ۲۲ · قالب ۱۲ · بتن ۳۰ · عمل‌آوری ۱۸" },
  { code: "PIP-LINE", fa: "پایپینگ", steps: "اسپول ۱۲ · فیت‌آپ ۱۵ · جوش ۲۲ · NDT ۱۳ · PWHT ۸ · تست ۱۸ · رنگ ۱۲" },
  { code: "ELE-CABLE", fa: "کابل", steps: "تری ۱۵ · کشیدن ۳۵ · سرسیم ۲۵ · مگر ۲۵" },
];

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
  const [dprLines, setDprLines] = useState([{ act: "CIV-001", qty: "12", step: "3" }]);
  const [ack, setAck] = useState<Record<string, boolean>>({});
  const [fmt, setFmt] = useState("PDF");
  const [kind, setKind] = useState("External");

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const evm = useMemo(() => computeEvm(), []);
  const phi = useMemo(() => computePhi(evm), [evm]);
  const kpis = useMemo(
    () => [
      { k: "SPI", v: evm.spi.toFixed(2), c: "#FFD48A" },
      { k: "CPI", v: evm.scheduleOnly ? "SO" : (evm.cpi ?? 0).toFixed(2), c: "#8FE3C8" },
      { k: "PPC", v: "81%", c: "#7FB2FF" },
      { k: rtl ? "سلامت" : "Health", v: String(Math.round(phi.total)), c: "#C9A7FF" },
      { k: rtl ? "جریمه برآوردی" : "Penalty est.", v: "125k", c: "#FF9F9F" },
    ],
    [rtl, evm, phi]
  );

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
          <span className="rounded-lg border b-line-soft px-2 py-1 text-[9px] tx3" dir="ltr">DataDate {DATA_DATE}</span>
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
                <div className="text-[10.5px] font-normal tx1">{rtl ? "ویجت مایلستون" : "Milestone widget"}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[
                    { n: 4, l: rtl ? "روی برنامه" : "OnTrack", c: "#8FE3C8" },
                    { n: 2, l: rtl ? "در ریسک" : "AtRisk", c: "#FFD48A" },
                    { n: 1, l: rtl ? "تأخیر" : "Delayed", c: "#FF9F9F" },
                  ].map((x) => (
                    <span key={x.l} className="rounded-lg px-2 py-1 text-[9px]" style={{ background: `${x.c}22`, color: x.c }}>
                      {x.n} {x.l}
                    </span>
                  ))}
                </div>
              </div>
              <div className="glass-dark rounded-2xl p-3">
                <div className="text-[10.5px] font-normal tx1">{rtl ? "ویجت مسیر بحرانی" : "CP widget"}</div>
                <p className="mt-2 text-[10px] tx2">
                  TF=0 · {ACTIVITIES.filter((a) => a.tfH <= 0).length} {rtl ? "فعالیت" : "acts"} · {rtl ? "قفل" : "locked"} {ACTIVITIES.filter((a) => a.locked).length}
                </p>
              </div>
              <div className="glass-dark rounded-2xl p-3">
                <div className="text-[10.5px] font-normal tx1">EVM</div>
                <p className="mt-2 text-[10px] tx2" dir="ltr">
                  PV {evm.pv.toFixed(0)} · EV {evm.ev.toFixed(0)} · AC {evm.ac == null ? "SO" : evm.ac.toFixed(0)} · VAC {evm.vac.toFixed(0)}
                </p>
                <div className="mt-2 flex h-10 items-end gap-1">
                  {ACTIVITIES.map((a) => (
                    <div key={a.code} className="flex-1 rounded-t-sm bg-emerald-400/35" style={{ height: `${Math.max(8, a.pctApproved * 100)}%` }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "wbs" && (
          <div className="fade-rise glass-dark rounded-2xl p-3">
            <div className="text-[11px] tx1">{rtl ? "ساختار شکست — قفل بدون CR" : "WBS — locked without CR"}</div>
            <ul className="mt-2 space-y-1 text-[10px] tx2">
              <li>1 {rtl ? "مهندسی" : "Engineering"} · 0.18</li>
              <li className="ps-4">1.2 {rtl ? "فونداسیون" : "Foundations"} · 0.12 · WP</li>
              <li className="ps-8">CIV-001 {rtl ? "بتن پی" : "Fnd pour"}</li>
              <li>2 {rtl ? "ساخت" : "Construction"} · 0.62</li>
            </ul>
          </div>
        )}

        {tab === "gantt" && (
          <div className="fade-rise glass-dark overflow-x-auto rounded-2xl p-3">
            <table className="w-full min-w-[720px] border-collapse text-[10px]">
              <thead>
                <tr className="border-b b-line-soft text-[9px] tx3">
                  <th className="px-2 py-2 text-start">Code</th>
                  <th className="px-2 py-2 text-start">{rtl ? "نام" : "Name"}</th>
                  <th className="px-2 py-2 text-center">TF</th>
                  <th className="px-2 py-2 text-start">{rtl ? "میله" : "Bar"}</th>
                </tr>
              </thead>
              <tbody className="divide-y b-line-soft">
                {acts.map((a) => (
                  <tr key={a.code}>
                    <td className="px-2 py-1.5 font-mono tx2" dir="ltr">{a.code}</td>
                    <td className="px-2 py-1.5 tx1">{t(a.name, lang)}</td>
                    <td className="px-2 py-1.5 text-center" style={{ color: a.crit ? "#FF9F9F" : undefined }}>{a.tf}</td>
                    <td className="px-2 py-1.5">
                      <div className="h-2 w-full rounded bg-white/10">
                        <div
                          className="h-2 rounded"
                          style={{ width: `${a.pct}%`, background: a.crit ? "#FF9F9F" : "#8FE3C8" }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[8.5px] tx4">{rtl ? "خط‌چین baseline · رنگ Arena نه P6 خالص روی شِل" : "Dashed baseline · Arena colors on shell"}</p>
          </div>
        )}

        {tab === "baseline" && (
          <div className="fade-rise glass-dark rounded-2xl p-3 space-y-2">
            <p className="text-[10.5px] tx1">{rtl ? "BL-01 قفل‌شده · تغییر تاریخ نیاز به CR" : "BL-01 locked · date change needs CR"}</p>
            <button className="rounded-lg border b-line-soft px-3 py-1.5 text-[10px] tx2">{rtl ? "قفل (نمونه)" : "Lock (demo)"}</button>
          </div>
        )}

        {tab === "milestone" && (
          <div className="fade-rise glass-dark overflow-x-auto rounded-2xl p-3">
            <table className="w-full min-w-[700px] border-collapse text-[10px]">
              <thead>
                <tr className="border-b b-line-soft text-[9px] tx3">
                  <th className="px-2 py-2 text-start">Code</th>
                  <th className="px-2 py-2 text-center">{rtl ? "وضعیت" : "Status"}</th>
                  <th className="px-2 py-2 text-center">{rtl ? "قراردادی" : "Contractual"}</th>
                  <th className="px-2 py-2 text-center">{rtl ? "پیش‌بینی=EF" : "Forecast=EF"}</th>
                  <th className="px-2 py-2 text-center">{rtl ? "جریمه" : "Penalty"}</th>
                </tr>
              </thead>
              <tbody className="divide-y b-line-soft">
                {ms.map((m) => (
                  <tr key={m.code}>
                    <td className="px-2 py-1.5 font-mono tx2" dir="ltr">{m.code}</td>
                    <td className="px-2 py-1.5 text-center">
                      <span className="rounded px-2 py-0.5 text-[8.5px]" style={{
                        background: m.status === "Delayed" ? "#FF9F9F22" : m.status === "AtRisk" ? "#FFD48A22" : "#8FE3C822",
                        color: m.status === "Delayed" ? "#FF9F9F" : m.status === "AtRisk" ? "#FFD48A" : "#8FE3C8",
                      }}>{m.status}</span>
                    </td>
                    <td className="px-2 py-1.5 text-center tx3">{m.contractual}</td>
                    <td className="px-2 py-1.5 text-center tx1">{m.forecast}</td>
                    <td className="px-2 py-1.5 text-center text-rose-300">{m.penalty || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "cp" && (
          <div className="fade-rise space-y-2">
            <div className="glass-dark rounded-2xl p-3 text-[10px] tx2">
              {rtl ? "فعالیت‌های TF=0 و Near-Critical (آستانه ۴۰ ساعت)" : "TF=0 and near-critical (40h)"}
            </div>
            {acts.filter((a) => a.crit || a.tf <= 40).map((a) => (
              <div key={a.code} className="glass-dark flex items-center gap-3 rounded-xl p-3 text-[10px]">
                <span className="font-mono text-sky-300" dir="ltr">{a.code}</span>
                <span className="tx1">{t(a.name, lang)}</span>
                <span className="ms-auto tx3">TF {a.tf}</span>
              </div>
            ))}
          </div>
        )}

        {tab === "lookahead" && (
          <div className="fade-rise glass-dark rounded-2xl p-3">
            <div className="mb-2 flex gap-1">
              {[1, 2, 3, 4, 6].map((w) => (
                <span key={w} className="rounded-lg border b-line-soft px-2 py-1 text-[9px] tx2">{w}w</span>
              ))}
            </div>
            {acts.map((a) => (
              <div key={a.code} className="flex justify-between border-b b-line-soft py-1.5 text-[10px]">
                <span className="font-mono tx2" dir="ltr">{a.code}</span>
                <span className="tx1">{t(a.name, lang)}</span>
                <span className="tx3">PPC {a.pct}%</span>
              </div>
            ))}
          </div>
        )}

        {tab === "dpr" && (
          <div className="fade-rise space-y-2">
            <div className="glass-dark flex flex-wrap gap-2 rounded-2xl p-3 text-[10px]">
              <span className="tx3">{rtl ? "تاریخ" : "Date"}</span>
              <span className="rounded border b-line-soft px-2 py-1 tx1">1405/06/14</span>
              <span className="tx3">{rtl ? "شیفت" : "Shift"}</span>
              <span className="rounded border b-line-soft px-2 py-1 tx1">A</span>
            </div>
            {dprLines.map((ln, i) => (
              <div key={i} className="glass-dark flex flex-wrap gap-2 rounded-xl p-2.5 text-[10px]">
                <span className="font-mono tx2" dir="ltr">{ln.act}</span>
                <span className="tx3">{rtl ? "گام RoC" : "RoC step"} {ln.step}</span>
                <span className="tx1">{rtl ? "مقدار" : "Qty"} {ln.qty}</span>
              </div>
            ))}
            <div className="flex gap-2">
              <button
                onClick={() => setDprLines((p) => [...p, { act: "PIP-ISO-012", qty: "4", step: "2" }])}
                className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-3 py-1.5 text-[10px] text-emerald-200"
              >
                + {rtl ? "خط پیشرفت" : "Progress line"}
              </button>
              <button className="rounded-lg border b-line-soft px-3 py-1.5 text-[10px] tx2">{rtl ? "ارسال WF2" : "Submit WF2"}</button>
            </div>
          </div>
        )}

        {tab === "weekly" && (
          <div className="fade-rise glass-dark rounded-2xl p-3 text-[10.5px] tx2">
            {rtl ? "تحلیل هفته از DPR تأییدشده · PPC ۸۱٪ · ۳ فعالیت عقب" : "Weekly from approved DPR · PPC 81% · 3 lagging"}
          </div>
        )}

        {tab === "mpr" && (
          <div className="fade-rise glass-dark rounded-2xl p-3 text-[10.5px] tx2">
            {rtl ? "MPR از KPI + EVM + زمان‌بندی · خروجی از گزارش‌ساز" : "MPR from KPI + EVM + schedule · generate via Reports"}
          </div>
        )}

        {tab === "reports" && (
          <div className="fade-rise glass-dark space-y-3 rounded-2xl p-3">
            <div className="flex flex-wrap gap-2 text-[10px]">
              <select value={kind} onChange={(e) => setKind(e.target.value)} className="rounded-lg border b-line-soft bg-black/20 px-2 py-1 tx1" style={{ colorScheme: "dark" }}>
                <option>Internal</option>
                <option>External</option>
              </select>
              <select value={fmt} onChange={(e) => setFmt(e.target.value)} className="rounded-lg border b-line-soft bg-black/20 px-2 py-1 tx1" style={{ colorScheme: "dark" }}>
                <option>PDF</option>
                <option>XLSX</option>
                <option>DOCX</option>
              </select>
              <button className="rounded-lg border border-sky-400/40 bg-sky-400/15 px-3 py-1 text-sky-200">
                {rtl ? "تولید (نمونه)" : "Generate (demo)"}
              </button>
            </div>
            <p className="text-[9px] tx4">{kind} · {fmt} · {rtl ? "هدر سه لوگو · رنگ Arena/P6 فقط در خروجی خارجی" : "3 logos · P6 colors only on external output"}</p>
          </div>
        )}

        {tab === "alerts" && (
          <div className="fade-rise space-y-2">
            {[
              { id: "a1", cat: "EVM", txt: "SPI < 0.9", sev: "Warning" },
              { id: "a2", cat: "MS", txt: "MS-MECH-RFSU Delayed", sev: "Critical" },
            ].map((a) => (
              <div key={a.id} className="glass-dark flex items-center gap-3 rounded-xl p-3 text-[10px]">
                <span className="rounded bg-rose-400/15 px-2 py-0.5 text-rose-300">{a.sev}</span>
                <span className="tx3">{a.cat}</span>
                <span className="tx1">{a.txt}</span>
                <button
                  onClick={() => setAck((m) => ({ ...m, [a.id]: true }))}
                  className="ms-auto rounded-lg border b-line-soft px-2 py-1 text-[9px] tx2"
                >
                  {ack[a.id] ? "ACK" : rtl ? "تأیید وصول" : "Ack"}
                </button>
              </div>
            ))}
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
            {roc.map((r) => (
              <div key={r.code} className="glass-dark rounded-2xl p-3">
                <div className="font-mono text-[10px] text-emerald-300" dir="ltr">{r.code}</div>
                <div className="text-[11px] tx1">{r.fa}</div>
                <div className="mt-1 text-[9.5px] tx3">{r.steps}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
