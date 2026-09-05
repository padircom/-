import { useState } from "react";
import { type Lang } from "../data/framework";
import EarnedValueCalculator from "./EarnedValueCalculator";
import RegularCalculator from "./RegularCalculator";

export default function CalcPanel({ lang }: { lang: Lang }) {
  const [tab, setTab] = useState<"ev" | "regular">("ev");
  const rtl = lang === "fa";

  return (
    <div className="glass flex h-full min-h-0 flex-col rounded-2xl p-3" dir={rtl ? "rtl" : "ltr"}>
      {/* Tab switcher */}
      <div className="mb-3 flex items-center gap-1 rounded-xl bg-[rgba(255,255,255,0.03)] p-[2px]">
        <button
          onClick={() => setTab("ev")}
          className={`flex-1 rounded-lg px-3 py-1.5 text-[11px] font-medium transition ${
            tab === "ev" ? "glass-row text-[var(--accent)] shadow-inner" : "text-[var(--ink4)] hover:text-[var(--ink3)]"
          }`}
        >
          {rtl ? "ارزش حاصله (EVM)" : "Earned Value (EVM)"}
        </button>
        <button
          onClick={() => setTab("regular")}
          className={`flex-1 rounded-lg px-3 py-1.5 text-[11px] font-medium transition ${
            tab === "regular" ? "glass-row text-[var(--accent)] shadow-inner" : "text-[var(--ink4)] hover:text-[var(--ink3)]"
          }`}
        >
          {rtl ? "ماشین حساب عمومی" : "Regular Calculator"}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "ev" ? <EarnedValueCalculator lang={lang} /> : <RegularCalculator lang={lang} />}
      </div>
    </div>
  );
}
