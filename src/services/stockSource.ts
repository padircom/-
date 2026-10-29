/**
 * مرز مالکیت موجودی انبار بین d5 و SCM.
 *
 * - SCM مالک موجودی عملیاتی است (`ScmStockBalance`: رسید، حواله، انتقال).
 * - d5 «کنترل موجودی» نمای هزینه‌ای است و پارامترهای برنامه‌ریزی را نگه می‌دارد
 *   (مصرف روزانه، لیدتایم، قیمت واحد در `StockItem`) که SCM ندارد.
 *
 * پس برای کالایی که در SCM موجودی ثبت شده، «مانده» و «در راه» از جمعِ همهٔ
 * انبارهای SCM می‌آید و در d5 فقط‌خواندنی است؛ برای بقیه، StockItem مرجع می‌ماند.
 * تطبیق فقط با برابریِ `StockItem.Code` و `ScmStockBalance.MaterialCode` است؛
 * اگر کدها یکی نباشند هیچ ردیفی تغییر نمی‌کند (رفتار قبلی).
 * منطق خالص است و با `npm run build:stksrc` در آزمون‌های Node بررسی می‌شود.
 */

export type FinStockLike = { Code: string; OnHand: number | string; OnOrder?: number | string | null };
export type ScmBalanceLike = {
  MaterialCode: string;
  OnHand: number | string;
  OnOrder?: number | string | null;
};

export type StockMismatch = { code: string; finOnHand: number; scmOnHand: number };

export type StockMerge<T extends FinStockLike> = {
  /** همان ردیف‌های StockItem؛ برای کالای مدیریت‌شده در SCM مقدارِ OnHand/OnOrder جایگزین شده. */
  stock: T[];
  /** کدهایی که مانده‌شان از SCM آمده (در d5 فقط‌خواندنی‌اند). */
  scmManaged: Set<string>;
  /** کدهایی که مقدار StockItem با جمع SCM فرق دارد (پیش از جایگزینی). */
  mismatches: StockMismatch[];
  /** کالاهایی که فقط در SCM موجودی دارند؛ پارامتر برنامه‌ریزی ندارند و در d5 نمی‌آیند. */
  scmOnly: string[];
};

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function mergeScmStock<T extends FinStockLike>(fin: T[], balances: ScmBalanceLike[]): StockMerge<T> {
  const sums = new Map<string, { onHand: number; onOrder: number; hasOrder: boolean }>();
  for (const b of balances ?? []) {
    const code = String(b.MaterialCode ?? "");
    if (!code) continue;
    const cur = sums.get(code) ?? { onHand: 0, onOrder: 0, hasOrder: false };
    cur.onHand += num(b.OnHand);
    if (b.OnOrder !== undefined && b.OnOrder !== null) {
      cur.onOrder += num(b.OnOrder);
      cur.hasOrder = true;
    }
    sums.set(code, cur);
  }

  const scmManaged = new Set<string>();
  const mismatches: StockMismatch[] = [];
  const finCodes = new Set(fin.map((s) => s.Code));
  const stock = fin.map((s) => {
    const sum = sums.get(s.Code);
    if (!sum) return s;
    scmManaged.add(s.Code);
    if (num(s.OnHand) !== sum.onHand) mismatches.push({ code: s.Code, finOnHand: num(s.OnHand), scmOnHand: sum.onHand });
    return { ...s, OnHand: sum.onHand, OnOrder: sum.hasOrder ? sum.onOrder : s.OnOrder };
  });
  const scmOnly = [...sums.keys()].filter((c) => !finCodes.has(c)).sort();
  return { stock, scmManaged, mismatches, scmOnly };
}
