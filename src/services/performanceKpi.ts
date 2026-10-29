/**
 * شاخص‌های عملکردِ نمایش‌داده‌شده در تب «شاخص‌ها» و جدول روند انحراف (d3).
 *
 * عمداً هیچ محاسبهٔ تازه‌ای ندارد: SPI/CPI/SV/CV را همان `evmPoint` سرور حساب کرده و
 * اینجا فقط رنگ‌بندی با همان آستانه‌های قاعدهٔ هشدار سرور (`SPI_ALERT_THRESHOLD`،
 * `CPI_ALERT_THRESHOLD`) و ردیف‌های جدول از روی تصاویر ثبت‌شده ساخته می‌شود.
 * مقدار نامعلوم هرگز صفر فرض نمی‌شود.
 */
import { CPI_ALERT_THRESHOLD, SPI_ALERT_THRESHOLD } from "./monitoringWorkspace";

export type EvmPointLike = {
  id: string;
  dataDate: string | null;
  integrity: string;
  pv: number | null;
  ev: number | null;
  ac: number | null;
  bac: number | null;
  spi: number | null;
  cpi: number | null;
  sv: number | null;
  cv: number | null;
};

export type IndexTone = "ok" | "alert" | "unknown";

export function indexTone(kind: "spi" | "cpi", value: number | null | undefined): IndexTone {
  if (value === null || value === undefined || !Number.isFinite(value)) return "unknown";
  return value < (kind === "spi" ? SPI_ALERT_THRESHOLD : CPI_ALERT_THRESHOLD) ? "alert" : "ok";
}

/** علامت انحراف: SV/CV منفی یعنی عقب‌تر از برنامه / بیشتر از بودجه. */
export function varianceTone(value: number | null | undefined): IndexTone {
  if (value === null || value === undefined || !Number.isFinite(value)) return "unknown";
  return value < 0 ? "alert" : "ok";
}

/** پیشرفت کسب‌شده نسبت به کل بودجه (EV ÷ BAC)؛ بدون BAC معتبر → نامعلوم. */
export function earnedProgress(ev: number | null | undefined, bac: number | null | undefined): number | null {
  if (ev === null || ev === undefined || bac === null || bac === undefined || !(bac > 0)) return null;
  return ev / bac;
}

export type VarianceRow = EvmPointLike & { usable: boolean };

/** ردیف‌های روند انحراف، قدیم ← جدید؛ تصویر بی‌تاریخ در انتها نمی‌افتد بلکه کنار گذاشته می‌شود. */
export function varianceRows(history: EvmPointLike[]): VarianceRow[] {
  return history
    .filter((h) => h.dataDate)
    .map((h) => ({ ...h, usable: h.sv !== null && h.cv !== null }))
    .sort((a, b) => String(a.dataDate).localeCompare(String(b.dataDate)) || a.id.localeCompare(b.id));
}
