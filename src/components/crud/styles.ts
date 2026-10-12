/** کلاس‌های مشترک فرم و جدول CRUD — هم‌خوان با سایر ماژول‌های سامانه. */
export const crudInputCls =
  "w-full rounded-lg border b-line-soft bg-black/25 px-2.5 py-1.5 text-xs tx1 outline-none focus:b-line disabled:opacity-50";

export const crudLabelCls = "tx3 text-[11px] flex flex-col gap-1";

export const crudBtnCls = "rounded-lg border b-line-soft px-2.5 py-1 text-[11px] tx2 transition hover:tx1 disabled:cursor-not-allowed disabled:opacity-40";

export const crudPrimaryBtnCls =
  "rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs text-sky-200 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-40";

export const crudDangerBtnCls =
  "rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-40";

export const crudToneCls: Record<"neutral" | "primary" | "danger" | "warn" | "ok", string> = {
  neutral: "border b-line-soft tx2 hover:tx1",
  primary: "border border-sky-500/40 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20",
  danger: "border border-rose-500/40 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20",
  warn: "border border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20",
  ok: "border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20",
};
