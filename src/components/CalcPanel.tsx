import { useState } from "react";
import { type Lang } from "../data/framework";
import CalendarView from "./CalendarView";
import EarnedValueCalculator from "./EarnedValueCalculator";
import RegularCalculator from "./RegularCalculator";

type CalculatorTab = "ev" | "regular" | "calendar";

export default function CalcPanel({ lang }: { lang: Lang }) {
  const [tab, setTab] = useState<CalculatorTab>("ev");
  const rtl = lang === "fa";
  const tabs: { id: CalculatorTab; label: string }[] = [
    { id: "ev", label: rtl ? "ارزش حاصله (EVM)" : "Earned Value (EVM)" },
    { id: "regular", label: rtl ? "ماشین‌حساب عمومی" : "Regular Calculator" },
    { id: "calendar", label: rtl ? "تقویم و کارها" : "Calendar & Tasks" },
  ];
  const tabButton = (id: CalculatorTab) =>
    `flex-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition ${
      tab === id ? "glass-row text-[var(--accent)] shadow-inner" : "text-[var(--ink4)] hover:text-[var(--ink3)]"
    }`;

  return (
    <div className="glass flex h-full min-h-0 flex-col rounded-2xl p-3" dir={rtl ? "rtl" : "ltr"}>
      <div role="tablist" aria-label={rtl ? "تقویم و محاسبات" : "Calendar and calculations"}
        className="mb-3 flex items-center gap-1 rounded-xl bg-[rgba(255,255,255,0.03)] p-[2px]">
        {tabs.map(({ id, label }) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id}
            onClick={() => setTab(id)} className={tabButton(id)}>
            {label}
          </button>
        ))}
      </div>

      {/* Keep every tab mounted so drafts, calculator values and calendar entries
          survive tab changes and returning to this quick-access workspace. */}
      <div className="min-h-0 flex-1 overflow-y-auto" hidden={tab !== "ev"}>
        <EarnedValueCalculator lang={lang} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto" hidden={tab !== "regular"}>
        <RegularCalculator lang={lang} />
      </div>
      <div className="min-h-0 flex-1 overflow-hidden" hidden={tab !== "calendar"}>
        <CalendarView lang={lang} />
      </div>
    </div>
  );
}
