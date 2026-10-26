import { useRef, useState } from "react";
import { type Lang } from "../data/framework";
import { useAuth } from "../context/AuthContext";
import { useCurrentProjectId } from "../context/SystemContext";
import { useDataSourceHealth } from "../hooks/useDataSourceHealth";
import { healthMessages, type SourceHealth } from "../services/dataSourceHealth";
import { jsonRequest, type ApiResult } from "../services/apiClient";

/**
 * دکمه‌های اتصال/ورود دادهٔ منابع بیرونی — منتقل‌شده از پنل حذف‌شدهٔ «منابع داده».
 *
 * این پنل پیش از این یک کشوی مجزا در صفحهٔ اصلی بود؛ اکنون هر دکمه سرِ جای
 * واقعیِ خودش نشسته است: ورود برنامه در «برنامه‌ریزی ← زمان‌بندی/گانت»،
 * همگام‌سازی مالی در «پایش و کنترل ← کنترل هزینه» و خروجی/اتصال Power BI در
 * «پایش و کنترل ← داشبوردها و گزارشات».
 *
 * قواعد ثابت (همان قرارداد پنل حذف‌شده):
 *  - هیچ موفقیتی جعل نمی‌شود. سبز فقط وقتی است که سرور اتصال زنده را تأیید
 *    کرده باشد؛ پیکربندی‌شده و ورود فایل، «اتصال» حساب نمی‌شوند.
 *  - ورود فایل واقعاً به `/api/projects/:id/schedule/import` می‌رود و عدد
 *    فعالیت‌های واردشده از پاسخ همان درخواست می‌آید.
 *  - همگام‌سازی SAP وقتی کانکتور تنظیم نشده باشد، درخواست بی‌فایده نمی‌فرستد و
 *    دلیل را صریح می‌گوید.
 *  - CMMS و IIoT/DAS ماژول داخلی‌اند و اتصال بیرونی موازی برایشان وجود ندارد.
 */

type Note = { tone: "ok" | "err" | "info"; text: string } | null;

const BUTTON =
  "glass-row flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10.5px] font-light tx2 transition hover:tx1 disabled:cursor-not-allowed disabled:opacity-40";

/** یک نظرسنج سلامت برای هر سطح کاری؛ هر دکمهٔ وضعیت جداگانه نظرسنج نمی‌سازد. */
function useConnectorStates(): Record<string, SourceHealth> {
  const { user } = useAuth();
  return useDataSourceHealth(user?.id ?? null);
}

/** نشانگر وضعیت اتصال یک منبع؛ رنگ از همان قرارداد سلامت سرور می‌آید. */
function ConnectorStatus({ lang, id, label, state }: { lang: Lang; id: string; label: string; state: SourceHealth }) {
  const rtl = lang === "fa";
  const connected = state.status === "connected";
  const color = connected ? "#34D399" : state.status === "disconnected" ? "#F87171" : "#94A3B8";
  return (
    <span
      className={`flex items-center gap-1.5 rounded-lg border b-line-soft bg-black/10 px-2 py-1 text-[9px] ${connected ? "ok-t" : "tx3"}`}
      data-connector={id}
      data-health={state.status}
      title={`${label} — ${healthMessages[state.reason][rtl ? "fa" : "en"]}`}
    >
      <span className={`h-[6px] w-[6px] shrink-0 rounded-full ${connected ? "pulse-dot" : ""}`} style={{ background: color }} aria-hidden="true" />
      <span dir="ltr">{label}</span>
      <span className="tx4">
        {connected
          ? rtl ? "متصل" : "connected"
          : state.status === "loading"
            ? rtl ? "بررسی…" : "checking…"
            : state.status === "disconnected"
              ? rtl ? "قطع" : "disconnected"
              : rtl ? "نامشخص" : "unknown"}
      </span>
    </span>
  );
}

function Notice({ note, lang }: { note: Note; lang: Lang }) {
  if (!note) return null;
  const tone = note.tone === "ok" ? "bg-emerald-400/10 text-emerald-200" : note.tone === "err" ? "bg-rose-400/10 text-rose-200" : "bg-amber-400/10 text-amber-100";
  return (
    <p role="status" className={`w-full rounded-lg px-2 py-1 text-[9.5px] ${tone}`} dir={lang === "fa" ? "rtl" : "ltr"}>
      {note.text}
    </p>
  );
}

/* ═════════════ ۱) ورود فایل زمان‌بندی (P6 XER / MSP) ═════════════ */

type ScheduleImportResult = { importedActivities?: number; sourceSystem?: string; fileName?: string; scheduleId?: number };

/** بارگذاری واقعی فایل برنامه؛ مسیر نسبی و پیام خطای سرور بی‌کم‌وکاست. */
async function uploadScheduleFile(projectId: string, file: File, sourceSystem: "primavera" | "msp", userId: string | null): Promise<ApiResult<ScheduleImportResult>> {
  try {
    const form = new FormData();
    form.append("file", file);
    form.append("sourceSystem", sourceSystem);
    const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/schedule/import`, {
      method: "POST",
      headers: { accept: "application/json", ...(userId ? { "x-user-id": userId } : {}) },
      body: form,
    });
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return { ok: false, status: res.status, code: "E-API-NO-JSON", message: "پاسخ سرور قابل خواندن نیست (سرور API در دسترس است؟)" };
    }
    const json = await res.json();
    if (json?.ok) return { ok: true, data: json.data as ScheduleImportResult };
    const { code, message, ...details } = json?.error ?? {};
    return { ok: false, status: res.status, code: code ?? "E-API-UNKNOWN", message: message ?? "خطای ناشناخته", details };
  } catch {
    return { ok: false, status: 0, code: "E-API-NETWORK", message: "اتصال به سرور برقرار نشد" };
  }
}

export function ScheduleImportActions({ lang, projectId, onImported }: { lang: Lang; projectId?: string; onImported?: () => void }) {
  const rtl = lang === "fa";
  const { user } = useAuth();
  /* پروژهٔ جاری از زمینهٔ سامانه می‌آید؛ پروپ اختیاری برای صفحاتی است که
   * شناسهٔ پروژه را مستقیم در دست دارند. */
  const contextProjectId = useCurrentProjectId();
  const scopedProjectId = projectId ?? contextProjectId;
  const health = useConnectorStates();
  const xerRef = useRef<HTMLInputElement | null>(null);
  const mspRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState<"p6" | "msp" | null>(null);
  const [note, setNote] = useState<Note>(null);

  const run = async (file: File | undefined, sourceSystem: "primavera" | "msp") => {
    if (!file) return;
    if (!scopedProjectId) {
      setNote({ tone: "err", text: rtl ? "پروژه‌ای انتخاب نشده است؛ ابتدا از سبد پروژه‌ها یک پروژه انتخاب کنید." : "No project selected. Pick a project from the portfolio first." });
      return;
    }
    setBusy(sourceSystem === "primavera" ? "p6" : "msp");
    setNote(null);
    const result = await uploadScheduleFile(scopedProjectId, file, sourceSystem, user?.id ?? null);
    setBusy(null);
    if (!result.ok) {
      setNote({ tone: "err", text: `${file.name} — ${result.message}` });
      return;
    }
    const imported = Number(result.data.importedActivities ?? 0);
    setNote({
      tone: "ok",
      text: rtl
        ? `${file.name} وارد شد · ${imported.toLocaleString("fa-IR")} فعالیت از «${sourceSystem === "primavera" ? "Primavera P6" : "Microsoft Project"}» ثبت شد.`
        : `${file.name} imported · ${imported} activities from ${sourceSystem === "primavera" ? "Primavera P6" : "Microsoft Project"}.`,
    });
    onImported?.();
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5" data-connector-actions="schedule-import">
      <ConnectorStatus lang={lang} id="p6" label="P6" state={health.p6} />
      <ConnectorStatus lang={lang} id="msp" label="MSP" state={health.msp} />
      <input
        ref={xerRef}
        type="file"
        accept=".xer,.txt"
        className="sr-only"
        data-testid="import-p6-file"
        onChange={(e) => { void run(e.target.files?.[0], "primavera"); e.target.value = ""; }}
      />
      <input
        ref={mspRef}
        type="file"
        accept=".mpp,.xml,.csv"
        className="sr-only"
        data-testid="import-msp-file"
        onChange={(e) => { void run(e.target.files?.[0], "msp"); e.target.value = ""; }}
      />
      <button type="button" className={BUTTON} disabled={busy !== null} onClick={() => xerRef.current?.click()}>
        <span aria-hidden="true">⬆</span>
        {busy === "p6" ? (rtl ? "در حال ورود…" : "importing…") : "Import P6 (XER)"}
      </button>
      <button type="button" className={BUTTON} disabled={busy !== null} onClick={() => mspRef.current?.click()}>
        <span aria-hidden="true">⬆</span>
        {busy === "msp" ? (rtl ? "در حال ورود…" : "importing…") : "Import MSP (MPP)"}
      </button>
      <span className="text-[9px] tx4">
        {rtl ? "MPP دودویی است؛ در نبود سرویس تبدیل MSP، XML/CSV همان MS Project پذیرفته می‌شود." : "MPP is binary; without the MSP conversion service, MS Project XML/CSV is accepted."}
      </span>
      <Notice note={note} lang={lang} />
    </div>
  );
}

/* ═════════════ ۲) همگام‌سازی مالی با ERP / SAP ═════════════ */

type SapSyncResult = { source?: string; endpoint?: string; httpStatus?: number; recordCount?: number | null; shape?: string; note?: string; runAt?: string };

export function ErpSyncAction({
  lang,
  projectId,
  showStatus = true,
  showSyncButton = true,
}: {
  lang: Lang;
  projectId?: string;
  showStatus?: boolean;
  showSyncButton?: boolean;
}) {
  const rtl = lang === "fa";
  const { user } = useAuth();
  const contextProjectId = useCurrentProjectId();
  const scopedProjectId = projectId ?? contextProjectId;
  const health = useConnectorStates();
  const state = health.sap;
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note>(null);

  const sync = async () => {
    // کانکتورِ تنظیم‌نشده درخواست بی‌حاصل نمی‌گیرد؛ علت همان‌جا گفته می‌شود.
    if (state.reason === "unconfigured" || state.reason === "missing") {
      setNote({
        tone: "info",
        text: rtl
          ? "اتصال ERP / SAP تنظیم نشده است؛ پیکربندی آدرس و توکن در «مدیریت سامانه ← اتصال SQL/API» انجام می‌شود. تا آن زمان هیچ همگام‌سازی‌ای ادعا نمی‌شود."
          : "The ERP / SAP connector is not configured. Set its URL and token in System Administration → SQL/API. No sync is claimed until then.",
      });
      return;
    }
    setBusy(true);
    setNote(null);
    const result = await jsonRequest<SapSyncResult>(`/api/integrations/sap/sync`, user?.id ?? null, "POST", { projectId: scopedProjectId || null });
    setBusy(false);
    if (!result.ok) {
      setNote({
        tone: "err",
        text: rtl
          ? `همگام‌سازی انجام نشد (${result.code}): ${result.message}`
          : `Sync failed (${result.code}): ${result.message}`,
      });
      return;
    }
    const count = result.data.recordCount;
    setNote({
      tone: count === null || count === undefined ? "info" : "ok",
      text: rtl
        ? `پاسخ ERP / SAP دریافت شد · کد ${result.data.httpStatus ?? "—"} · رکورد خوانده‌شده: ${count === null || count === undefined ? "شکل پاسخ قابل شمارش نبود" : count.toLocaleString("fa-IR")}${result.data.note ? ` · ${result.data.note}` : ""}`
        : `ERP / SAP responded · HTTP ${result.data.httpStatus ?? "—"} · records read: ${count === null || count === undefined ? "response shape not countable" : count}${result.data.note ? ` · ${result.data.note}` : ""}`,
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5" data-connector-actions="erp-sync">
      {showStatus && <ConnectorStatus lang={lang} id="sap" label="ERP / SAP" state={state} />}
      {showSyncButton && (
        <button type="button" className={BUTTON} disabled={busy} onClick={() => void sync()}>
          <span aria-hidden="true">⇄</span>
          {busy ? (rtl ? "در حال همگام‌سازی…" : "syncing…") : rtl ? "همگام‌سازی با ERP / SAP" : "Sync with ERP / SAP"}
        </button>
      )}
      <Notice note={note} lang={lang} />
    </div>
  );
}

/* ═════════════ ۳) خروجی / اتصال Power BI ═════════════ */

export function PowerBiAction({ lang, onExport, canExport }: { lang: Lang; onExport: () => void; canExport: boolean }) {
  const rtl = lang === "fa";
  const { user } = useAuth();
  const health = useConnectorStates();
  const state = health.pbi;
  const [note, setNote] = useState<Note>(null);

  const run = () => {
    if (!canExport) {
      setNote({
        tone: "info",
        text: rtl
          ? "خروجی به دادهٔ خوانده‌شدهٔ همین صفحه وابسته است؛ تا دریافت داده از سرور، فایلی ساخته نمی‌شود."
          : "The export needs the data already read by this page; nothing is produced before the server responds.",
      });
      return;
    }
    onExport();
    const connected = state.status === "connected";
    setNote({
      tone: connected ? "ok" : "info",
      text: connected
        ? rtl
          ? `خروجی ساخته شد · اتصال Power BI تأیید شده است${state.latencyMs !== null ? ` (${state.latencyMs.toLocaleString("fa-IR")} ms)` : ""} · ${user?.id ?? ""}`
          : `Export created · Power BI connection verified${state.latencyMs !== null ? ` (${state.latencyMs} ms)` : ""}`
        : rtl
          ? "خروجی ساخته شد. اتصال زندهٔ Power BI تأیید نشده است؛ پیکربندی Workspace در «مدیریت سامانه ← اتصال SQL/API» انجام می‌شود."
          : "Export created. A live Power BI connection is not verified; configure the workspace in System Administration → SQL/API.",
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5" data-connector-actions="powerbi">
      <ConnectorStatus lang={lang} id="pbi" label="Power BI" state={state} />
      <button type="button" className={BUTTON} onClick={run}>
        <span aria-hidden="true">⤓</span>
        {rtl ? "خروجی / اتصال به Power BI" : "Export / Connect to Power BI"}
      </button>
      <Notice note={note} lang={lang} />
    </div>
  );
}
