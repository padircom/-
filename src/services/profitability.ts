/* ══════════════════════════════════════════════════════════════════════
   P&L-v1 — سود و زیان پروژه (دامنهٔ d5)

   سه لایه، به ترتیبِ استانداردِ صورت‌های مالیِ پروژه‌ای:

     درآمدِ شناسایی‌شده = تجمعیِ صورت‌وضعیت‌های تأییدشده
     بهای تمام‌شده     = هزینهٔ واقعیِ مستقیم + غیرمستقیمِ تخصیص‌یافته
     سودِ ناخالص       = درآمد − بهای تمام‌شده

   و در کنار آن «در انتهای کار» (At-Complete):
     حاشیهٔ نهایی = (ارزش قرارداد − برآوردِ نهاییِ هزینه) ÷ ارزش قرارداد

   تفاوتِ این دو عمداً نگه داشته شده: سودِ امروز می‌تواند مثبت و سودِ
   انتهای کار منفی باشد (صورت‌وضعیت جلوتر از هزینه افتاده). یکی کردنشان
   همان خطایی است که در گزارش‌های ماهانه دیده می‌شود.
   ══════════════════════════════════════════════════════════════════════ */

export type PlInput = {
  /** ارزش قرارداد (با احتساب تغییرات مصوب). */
  contractValue: number;
  /** تجمعیِ صورت‌وضعیت‌های تأییدشده تا امروز. */
  certifiedToDate: number;
  /** هزینهٔ واقعی تا امروز (مستقیم + تخصیص‌یافته). */
  costToDate: number;
  /** برآوردِ هزینه در انتهای کار (EAC). */
  forecastCost: number;
  /** پیش‌پرداختِ دریافتی (ماندهٔ تسویه‌نشده). */
  advanceOutstanding: number;
  /** ذخیره/کسوراتِ نگه‌داشته‌شده (Retention). */
  retention: number;
};

export type PlResult = {
  revenue: number;
  cost: number;
  grossProfit: number;
  grossMarginPct: number;
  /** درآمدِ قابلِ وصول: تأییدشده − کسورات − ماندهٔ پیش‌پرداخت. */
  netReceivable: number;
  /** برآوردِ سود در انتهای کار. */
  forecastProfit: number;
  forecastMarginPct: number;
  /** انحرافِ سود از برنامه‌ایِ متناسب با پیشرفت. */
  earnedMarginPct: number;
  /** سودِ امروز امّا زیانِ انتهای کار (هشدارِ کلاسیک). */
  overBillingRisk: boolean;
};

const ratio = (a: number, b: number) => (b === 0 ? 0 : a / b);

export function profitLoss(input: PlInput): PlResult {
  const revenue = input.certifiedToDate;
  const cost = input.costToDate;
  const grossProfit = revenue - cost;
  const netReceivable = revenue - input.retention - input.advanceOutstanding;
  const forecastProfit = input.contractValue - input.forecastCost;
  const progress = ratio(revenue, input.contractValue);
  const earnedCost = input.forecastCost * progress;
  return {
    revenue,
    cost,
    grossProfit,
    grossMarginPct: ratio(grossProfit, revenue),
    netReceivable,
    forecastProfit,
    forecastMarginPct: ratio(forecastProfit, input.contractValue),
    earnedMarginPct: ratio(revenue - earnedCost, revenue),
    overBillingRisk: grossProfit > 0 && forecastProfit < 0,
  };
}

/* ══════════════════════════════════════════════════════════════════════
   ظرفِ داده — تا اتصالِ ماژول پیمان (d14) و هزینه (d5) به SQL
   ══════════════════════════════════════════════════════════════════════ */

export const PL_SEED: PlInput = {
  contractValue: 8_950_000_000_000,
  certifiedToDate: 3_240_000_000_000,
  costToDate: 2_910_000_000_000,
  forecastCost: 8_420_000_000_000,
  advanceOutstanding: 410_000_000_000,
  retention: 162_000_000_000,
};
