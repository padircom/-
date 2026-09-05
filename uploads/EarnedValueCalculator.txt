import { useState } from "react";
import { type Lang } from "../data/framework";

type Props = { lang: Lang };

export default function EarnedValueCalculator({ lang }: Props) {
  const [pv, setPv] = useState("85000");
  const [ev, setEv] = useState("68400");
  const [ac, setAc] = useState("72000");

  const p = parseFloat(pv) || 0;
  const e = parseFloat(ev) || 0;
  const a = parseFloat(ac) || 0;

  const sv = e - p;
  const cv = e - a;
  const spi = p === 0 ? 0 : e / p;
  const cpi = a === 0 ? 0 : e / a;
  const eac = a === 0 ? 0 : a + (p - e) / cpi;

  const fmt = (v: number) => v.toLocaleString(lang === "fa" ? "fa-IR" : "en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const card = (label: string, value: string, color = "var(--ink2)") => (
    <div className="glass-row rounded-xl border px-3 py-2.5 text-center">
      <div className="text-[9px] font-extralight tracking-wide tx3">{label}</div>
      <div className="mt-0.5 text-[13px] font-light tabular-nums" style={{ color }}>{value}</div>
    </div>
  );

  const inputRow = (label: string, value: string, set: (v: string) => void, unit = "") => (
    <label className="flex items-center gap-2 rounded-xl px-2 py-2 b-line-soft bg-[var(--chip-bg)]">
      <span className="w-16 shrink-0 text-[10px] font-light tx3">{label}</span>
      <input
        type="text"
        dir="ltr"
        value={value}
        onChange={(e) => set(e.target.value.replace(/[^0-9.]/g, ""))}
        className="min-w-0 flex-1 rounded-md bg-transparent px-2 py-1 text-[13px] font-light text-[var(--ink)] outline-none placeholder-[var(--ink4)] tabular-nums"
        placeholder={unit || "..."}
      />
    </label>
  );

  return (
    <div className="glass flex h-full min-h-0 flex-col rounded-2xl p-4 overflow-y-auto">
      <h2 className="mb-4 text-[15px] font-normal tx1">{lang === "fa" ? "ماشین حساب ارزش حاصله (EVM)" : "Earned Value Calculator (EVM)"}</h2>

      <div className="space-y-1.5">
        {inputRow(lang === "fa" ? "ارزش برنامه‌ریزی‌شده (PV)" : "Planned Value (PV)", pv, setPv, lang === "fa" ? "تومان" : "USD")}
        {inputRow(lang === "fa" ? "ارزش کسب‌شده (EV)" : "Earned Value (EV)", ev, setEv, lang === "fa" ? "تومان" : "USD")}
        {inputRow(lang === "fa" ? "هزینه واقعی (AC)" : "Actual Cost (AC)", ac, setAc, lang === "fa" ? "تومان" : "USD")}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {card(lang === "fa" ? "SV (انحراف زمان" : "SV (Schedule Variance)", fmt(sv), sv >= 0 ? "#10B981" : "#F87171")}
        {card(lang === "fa" ? "CV (انحراف هزینه" : "CV (Cost Variance)", fmt(cv), cv >= 0 ? "#10B981" : "#F87171")}
        {card(lang === "fa" ? "SPI (شاخص زمان" : "SPI (Schedule Performance)", fmt(spi), spi >= 1 ? "#10B981" : "#F87171")}
        {card(lang === "fa" ? "CPI (شاخص هزینه" : "CPI (Cost Performance)", fmt(cpi), cpi >= 1 ? "#10B981" : "#F87171")}
      </div>

      <div className="mt-3 rounded-xl border border-[var(--line)] px-3 py-3">
        <div className="text-[9px] font-extralight tx3">
          {lang === "fa" ? "تخمین هزینه نهایی (EAC) بر اساس CPI" : "Estimate At Completion (EAC) — CPI-based"}
        </div>
        <div className="mt-1 text-[18px] font-light tabular-nums text-[var(--accent)]">{fmt(eac)}</div>
      </div>
    </div>
  );
}
