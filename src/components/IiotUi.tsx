/**
 * اجزای کوچک مشترک داشبورد IIoT & DAS.
 * ═══════════════════════════════════════════════════════════════════════
 * هیچ منطق دامنه‌ای اینجا نیست: چراغ، دکمه، کارت آمار و نوار. رنگ‌ها از
 * «قرارداد تُن» (`iiotDashboard.ts`) می‌آیند تا همهٔ پنل‌ها یک زبان رنگی
 * داشته باشند و پرسنل شیفت مجبور نباشد هر پنل را جدا یاد بگیرد.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { IiotRequestError } from "../services/iiotApi";
import { IIOT_TONE_FRAME, IIOT_TONE_LABEL, toneForStatus, type IiotTone } from "../services/iiotDashboard";

export function Chip({ text, tone = "idle", title, dir }: { text: string; tone?: IiotTone; title?: string; dir?: "ltr" | "rtl" }) {
  return (
    <span dir={dir} title={title} className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] ${IIOT_TONE_FRAME[tone]}`}>
      {text}
    </span>
  );
}

export function StatusChip({ status, fa }: { status: string | null | undefined; fa: boolean }) {
  const tone = toneForStatus(status);
  const label = fa ? IIOT_TONE_LABEL[tone].fa : IIOT_TONE_LABEL[tone].en;
  return <Chip text={`${IIOT_TONE_LABEL[tone].glyph} ${label}`} tone={tone} />;
}

export function Btn({
  children, onClick, disabled, title, tone = "neutral", busy, small,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  tone?: "neutral" | "danger" | "warn" | "ok" | "primary";
  busy?: boolean;
  small?: boolean;
}) {
  const palette: Record<string, string> = {
    neutral: "border b-line-soft tx2 hover:tx1",
    primary: "border border-sky-500/40 bg-sky-500/10 text-sky-200 hover:bg-sky-500/20",
    danger: "border border-rose-500/40 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20",
    warn: "border border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20",
    ok: "border border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      title={title}
      className={`rounded-lg px-2.5 ${small ? "py-1 text-[10px]" : "py-1.5 text-xs"} transition ${
        disabled ? "cursor-not-allowed opacity-40 border b-line-soft tx3" : palette[tone]
      }`}
    >
      {busy ? "…" : children}
    </button>
  );
}

export function StatCard({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: string; tone?: IiotTone }) {
  return (
    <div className="rounded-xl border b-line-soft bg-black/15 p-3 space-y-0.5">
      <div className="tx3 text-[11px]">{label}</div>
      <div className={`text-lg font-semibold ${tone ? IIOT_TONE_FRAME[tone].split(" ").pop() : "tx1"}`}>{value}</div>
      {hint && <div className="tx3 text-[10px]">{hint}</div>}
    </div>
  );
}

export function Meter({ pct, tone = "ok" }: { pct: number; tone?: IiotTone }) {
  const fill: Record<IiotTone, string> = {
    ok: "bg-emerald-400", warn: "bg-amber-400", danger: "bg-rose-500", idle: "bg-slate-500",
  };
  return (
    <div className="h-1.5 w-full rounded-full bg-black/30">
      <div className={`h-1.5 rounded-full ${fill[tone]}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

export function SectionCard({ title, hint, actions, children }: { title: string; hint?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="glass-dark rounded-2xl p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b b-line-soft pb-2">
        <div>
          <h4 className="tx1 text-sm font-semibold">{title}</h4>
          {hint && <p className="tx3 text-[11px] mt-0.5">{hint}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-1.5">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

export function Note({ kind, text, ltr }: { kind: "error" | "ok" | "info"; text: string; ltr?: boolean }) {
  const palette = {
    error: "border-rose-500/40 bg-rose-500/10 text-rose-200",
    ok: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
    info: "border-sky-500/30 bg-sky-500/10 text-sky-200",
  } as const;
  return <div dir={ltr ? "ltr" : undefined} className={`rounded-lg border px-2.5 py-1.5 text-[11px] ${palette[kind]}`}>{text}</div>;
}

export function Muted({ text }: { text: string }) {
  return <div className="tx3 text-[11px] py-3 text-center">{text}</div>;
}

/** نشان «بدون مجوز» — دلیل غیرفعال بودن دکمه را صریح می‌گوید، نه مبهم. */
export function permissionTitle(allowed: boolean, permission: string, fa: boolean): string | undefined {
  if (allowed) return undefined;
  return fa ? `مجوز لازم: ${permission}` : `Required permission: ${permission}`;
}

/** بردِ سه‌رنگ داشبورد: همان چیزی که در یک نگاه به پرسنل شیفت می‌گوید کجاست. */
export function ToneLegend({ fa }: { fa: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {(["ok", "warn", "danger", "idle"] as IiotTone[]).map((tone) => (
        <Chip key={tone} text={`${IIOT_TONE_LABEL[tone].glyph} ${fa ? IIOT_TONE_LABEL[tone].fa : IIOT_TONE_LABEL[tone].en}`} tone={tone} />
      ))}
    </div>
  );
}

/* ═══════════════════════ بارگذاری زنده ═══════════════════════ */

export type IiotLoadState<T> =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; data: T }
  | { kind: "error"; message: string; code?: string; status?: number };

/** خطای API را به متن و کد خوانا تبدیل می‌کند — رمز خطا برای پرسنل شیفت مفید است. */
export function errorInfo(error: unknown): { message: string; code?: string; status?: number } {
  if (error instanceof IiotRequestError) {
    return { message: error.message, code: error.code, status: error.status };
  }
  if (error instanceof Error) return { message: error.message };
  return { message: "خطای ناشناخته" };
}

/**
 * بارگذاری + تازه‌سازی خودکار.
 *
 * دو رفتار مهم: (۱) در بازخوانی‌های دوره‌ای، دادهٔ قبلی روی صفحه می‌ماند و
 * صفحه «پرش» نمی‌کند — فقط مقدارها عوض می‌شوند. (۲) با `live=false` تایمر
 * می‌ایستد ولی دادهٔ موجود پاک نمی‌شود؛ دکمهٔ توقف، صفحه را سیاه نمی‌کند.
 */
export function usePolled<T>(
  loader: () => Promise<T>,
  deps: unknown[],
  options: { live: boolean; intervalMs: number },
): { state: IiotLoadState<T>; refresh: () => void; updatedAt: string | null } {
  const [state, setState] = useState<IiotLoadState<T>>({ kind: "idle" });
  const [nonce, setNonce] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const data = await loaderRef.current();
        if (cancelled) return;
        setState({ kind: "ready", data });
        setUpdatedAt(new Date().toISOString());
      } catch (error) {
        if (cancelled) return;
        setState({ kind: "error", ...errorInfo(error) });
      }
    };
    /* فقط اولین بار «در حال بارگذاری» نشان می‌دهیم؛ بازخوانی دوره‌ای بی‌صدا است. */
    setState((prev) => (prev.kind === "ready" ? prev : { kind: "loading" }));
    void run();
    const timer = options.live ? window.setInterval(() => void run(), options.intervalMs) : undefined;
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce, options.live, options.intervalMs]);

  return { state, refresh, updatedAt };
}
