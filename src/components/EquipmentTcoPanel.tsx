import { useMemo, useState } from "react";
import { type Lang } from "../data/framework";
import { CATEGORY_BY_CODE, buyVsRent, tco, type TcoInput } from "../services/equipment";

/* ══════════════════════════════════════════════════════════════════════
   d9-p5-s3 — هزینهٔ کل مالکیت (TCO) و خرید در برابر اجاره

   ماشین‌حسابِ زنده است، نه دادهٔ نمونه: همهٔ عددها را کاربر وارد می‌کند و
   محاسبه با همان توابعِ `tco` و `buyVsRent` انجام می‌شود که API سرور
   (`/api/eqp/tco`) هم از آن‌ها استفاده می‌کند؛ پس نتیجهٔ صفحه و سرور یکی است.
   مدل: استهلاک خط مستقیم، بدون تنزیل (ADR-09).
   با انتخاب یک ماشین، فقط «ارزش خرید»، «ارزش اسقاط» و «عمر اقتصادی» از
   ناوگان پیش‌پر می‌شود؛ هزینه‌های سالانه را کاربر باید خودش وارد کند.
   ══════════════════════════════════════════════════════════════════════ */

export type TcoEquipment = {
  Id: string;
  Code?: unknown;
  NameFa?: unknown;
  Category?: unknown;
  PurchaseValue?: unknown;
  SalvageValue?: unknown;
};

type Field =
  | "purchaseValue" | "salvageValue" | "lifeYears" | "annualWorkHours"
  | "annualOperatingCost" | "annualMaintenanceCost" | "annualInsuranceCost"
  | "mobilizationCost" | "demobilizationCost" | "rentalHourlyRate" | "variableOwnCostPerHour";

type Form = Record<Field, string>;

const EMPTY: Form = {
  purchaseValue: "", salvageValue: "", lifeYears: "", annualWorkHours: "",
  annualOperatingCost: "", annualMaintenanceCost: "", annualInsuranceCost: "",
  mobilizationCost: "", demobilizationCost: "", rentalHourlyRate: "", variableOwnCostPerHour: "",
};

const LABELS: Record<Field, { fa: string; en: string }> = {
  purchaseValue: { fa: "ارزش خرید (ریال)", en: "Purchase value (IRR)" },
  salvageValue: { fa: "ارزش اسقاط (ریال)", en: "Salvage value (IRR)" },
  lifeYears: { fa: "عمر اقتصادی (سال)", en: "Economic life (years)" },
  annualWorkHours: { fa: "ساعت کارکرد سالانه", en: "Annual work hours" },
  annualOperatingCost: { fa: "هزینهٔ بهره‌برداری سالانه (ریال)", en: "Annual operating cost (IRR)" },
  annualMaintenanceCost: { fa: "هزینهٔ نگهداری سالانه (ریال)", en: "Annual maintenance cost (IRR)" },
  annualInsuranceCost: { fa: "بیمهٔ سالانه (ریال)", en: "Annual insurance (IRR)" },
  mobilizationCost: { fa: "هزینهٔ بسیج (ریال)", en: "Mobilization cost (IRR)" },
  demobilizationCost: { fa: "هزینهٔ جمع‌آوری (ریال)", en: "Demobilization cost (IRR)" },
  rentalHourlyRate: { fa: "نرخ اجارهٔ ساعتی (ریال)", en: "Rental rate per hour (IRR)" },
  variableOwnCostPerHour: { fa: "هزینهٔ متغیر ساعتیِ مالکیت (ریال)", en: "Own variable cost per hour (IRR)" },
};

const ownFields: Field[] = [
  "purchaseValue", "salvageValue", "lifeYears", "annualWorkHours",
  "annualOperatingCost", "annualMaintenanceCost", "annualInsuranceCost",
  "mobilizationCost", "demobilizationCost",
];
const rentFields: Field[] = ["rentalHourlyRate", "variableOwnCostPerHour"];

const toNum = (s: string) => {
  const n = Number(s.replace(/[,٬\s]/g, "").replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))));
  return Number.isFinite(n) ? n : NaN;
};

export default function EquipmentTcoPanel({ lang, equipment }: { lang: Lang; equipment: TcoEquipment[] }) {
  const rtl = lang === "fa";
  const [form, setForm] = useState<Form>(EMPTY);
  const [equipmentId, setEquipmentId] = useState("");
  const text = (a: string, b: string) => (rtl ? a : b);
  const fmt = (n: number, digits = 0) =>
    n.toLocaleString(rtl ? "fa-IR" : "en-US", { maximumFractionDigits: digits });

  const set = (f: Field, v: string) => setForm((p) => ({ ...p, [f]: v }));

  function pick(id: string) {
    setEquipmentId(id);
    const eq = equipment.find((e) => e.Id === id);
    if (!eq) return;
    const life = CATEGORY_BY_CODE[String(eq.Category)]?.economicLifeYears;
    setForm((p) => ({
      ...p,
      purchaseValue: eq.PurchaseValue != null ? String(eq.PurchaseValue) : p.purchaseValue,
      salvageValue: eq.SalvageValue != null ? String(eq.SalvageValue) : p.salvageValue,
      lifeYears: life ? String(life) : p.lifeYears,
    }));
  }

  const parsed = useMemo(() => {
    const v = (f: Field) => (form[f].trim() === "" ? 0 : toNum(form[f]));
    const nums = Object.fromEntries((Object.keys(form) as Field[]).map((f) => [f, v(f)])) as Record<Field, number>;
    const invalid = (Object.keys(nums) as Field[]).filter((f) => Number.isNaN(nums[f]) || nums[f] < 0);
    const missing: Field[] = (["purchaseValue", "lifeYears", "annualWorkHours"] as Field[]).filter((f) => !(nums[f] > 0));
    if (invalid.length || missing.length) return { ok: false as const, invalid, missing };
    const input: TcoInput = {
      purchaseValue: nums.purchaseValue,
      salvageValue: nums.salvageValue,
      lifeYears: nums.lifeYears,
      annualWorkHours: nums.annualWorkHours,
      annualOperatingCost: nums.annualOperatingCost,
      annualMaintenanceCost: nums.annualMaintenanceCost,
      annualInsuranceCost: nums.annualInsuranceCost,
      mobilizationCost: nums.mobilizationCost,
      demobilizationCost: nums.demobilizationCost,
    };
    return {
      ok: true as const,
      salvageTooHigh: nums.salvageValue > nums.purchaseValue,
      result: tco(input),
      cmp: nums.rentalHourlyRate > 0 ? buyVsRent(input, nums.rentalHourlyRate, nums.variableOwnCostPerHour) : null,
    };
  }, [form]);

  const input = "w-full rounded-lg border b-line-soft bg-[var(--row)] p-2 text-xs tx1";
  const verdictText = {
    buy: text("خرید به‌صرفه‌تر است", "Buying is cheaper"),
    rent: text("اجاره به‌صرفه‌تر است", "Renting is cheaper"),
    neutral: text("تفاوت ناچیز است (کمتر از ۵٪)", "Roughly equal (under 5%)"),
  };

  const renderField = (f: Field) => (
    <label key={f} className="tx3 text-xs">
      {text(LABELS[f].fa, LABELS[f].en)}
      <input
        className={`${input} mt-1`}
        inputMode="decimal"
        dir="ltr"
        value={form[f]}
        onChange={(e) => set(f, e.target.value)}
        aria-invalid={parsed.ok ? undefined : parsed.invalid.includes(f)}
      />
    </label>
  );

  return (
    <section className="space-y-3" dir={rtl ? "rtl" : "ltr"} aria-label="TCO">
      <p className="rounded-xl border b-line-soft bg-[var(--row)] px-3 py-2 text-[10.5px] font-light tx2">
        {text(
          "ماشین‌حساب هزینهٔ کل مالکیت: همهٔ عددها را شما وارد می‌کنید و چیزی ذخیره نمی‌شود. استهلاک خط مستقیم و بدون تنزیل است.",
          "Total-cost-of-ownership calculator: every figure is entered by you and nothing is saved. Depreciation is straight-line, undiscounted.",
        )}
      </p>

      <select className={input} aria-label="TCO equipment" value={equipmentId} onChange={(e) => pick(e.target.value)}>
        <option value="">{text("پیش‌پر کردن از یک ماشین (اختیاری)", "Prefill from equipment (optional)")}</option>
        {equipment.map((e) => (
          <option key={e.Id} value={e.Id}>{String(e.Code ?? "")} — {String(e.NameFa ?? "")}</option>
        ))}
      </select>

      <div className="glass-dark space-y-3 rounded-xl p-3">
        <h4 className="text-sm tx1">{text("هزینهٔ مالکیت", "Cost of ownership")}</h4>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">{ownFields.map(renderField)}</div>
        <h4 className="pt-1 text-sm tx1">{text("مقایسه با اجاره (اختیاری)", "Compare with renting (optional)")}</h4>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{rentFields.map(renderField)}</div>
      </div>

      {!parsed.ok ? (
        <p role="status" className="rounded-xl border b-line-soft px-3 py-2 text-[10.5px] tx3">
          {parsed.invalid.length
            ? text("مقدار نامعتبر یا منفی وارد شده است.", "A value is invalid or negative.")
            : text("برای محاسبه، ارزش خرید، عمر اقتصادی و ساعت کارکرد سالانه را وارد کنید.", "Enter purchase value, economic life and annual work hours to calculate.")}
        </p>
      ) : (
        <div className="space-y-2">
          {parsed.salvageTooHigh && (
            <p role="alert" className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-[10.5px] text-amber-200">
              {text("ارزش اسقاط از ارزش خرید بیشتر است؛ در محاسبه برابر ارزش خرید در نظر گرفته شد.", "Salvage exceeds purchase value; it was capped at the purchase value.")}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
            <Result label={text("هزینهٔ کل مالکیت", "Total cost")} value={fmt(parsed.result.totalCost)} />
            <Result label={text("هزینهٔ سالانه", "Annual cost")} value={fmt(parsed.result.annualCost)} />
            <Result label={text("هزینه به ازای هر ساعت", "Cost per hour")} value={fmt(parsed.result.costPerHour)} />
            <Result label={text("استهلاک کل", "Total depreciation")} value={fmt(parsed.result.depreciationTotal)} hint={`${fmt(parsed.result.lifetimeHours)} ${text("ساعت در طول عمر", "h over life")}`} />
          </div>
          {parsed.cmp && (
            <div className="glass-dark space-y-2 rounded-xl p-3">
              <div className="text-sm tx1">{verdictText[parsed.cmp.verdict]}</div>
              <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
                <Result label={text("هزینهٔ ساعتی مالکیت", "Own cost / h")} value={fmt(parsed.cmp.ownCostPerHour)} />
                <Result label={text("نرخ اجارهٔ ساعتی", "Rental / h")} value={fmt(parsed.cmp.rentCostPerHour)} />
                <Result
                  label={text("صرفه‌جویی ساعتی", "Saving / h")}
                  value={fmt(parsed.cmp.savingPerHour)}
                  tone={parsed.cmp.savingPerHour < 0 ? "#F87171" : "#34D399"}
                  hint={parsed.cmp.savingPerHour >= 0 ? text("به نفع خرید", "favours buying") : text("به نفع اجاره", "favours renting")}
                />
                <Result
                  label={text("نقطهٔ سربه‌سر (ساعت)", "Break-even (h)")}
                  value={Number.isFinite(parsed.cmp.breakEvenHours) ? fmt(parsed.cmp.breakEvenHours) : "∞"}
                  hint={Number.isFinite(parsed.cmp.breakEvenHours) ? undefined : text("نرخ اجاره از هزینهٔ متغیر بیشتر نیست", "rental rate does not exceed own variable cost")}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Result({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="rounded-xl border b-line-soft bg-[var(--row)] p-3">
      <div className="text-[8.5px] font-extralight tx4">{label}</div>
      <div className="mt-1 text-[12.5px] font-light tx1" dir="ltr" style={{ color: tone }}>{value}</div>
      {hint && <div className="mt-0.5 text-[9px] font-extralight tx3">{hint}</div>}
    </div>
  );
}
