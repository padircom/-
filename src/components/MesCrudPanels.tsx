/**
 * پنل‌های CRUD ماژول MES (تولید): جدول تعاملی (جستجو، فیلتر، مرتب‌سازی، صفحه‌بندی)
 * با ثبت/ویرایش/مشاهده و اقدام‌های وضعیت، روی همان APIهای `MfgClient`.
 * ═══════════════════════════════════════════════════════════════════════
 * قواعد:
 * ۱) داده‌ها از سرور می‌آیند؛ هیچ شمارهٔ سفارش/وضعیتی در کلاینت ساخته نمی‌شود.
 * ۲) حذف فقط جایی مجاز است که سرور DELETE دارد و شرط آن (draft و مصرف‌نشده) برقرار است؛
 *    در بقیهٔ موارد وضعیت به cancelled/غیرفعال تغییر می‌کند تا سابقه حفظ شود.
 * ۳) PATCH همیشه RowVersion را می‌فرستد (If-Match)؛ تضاد نسخه به کاربر نشان داده می‌شود.
 * ۴) هر تغییر موفق با `onChanged` بخش‌های دیگر تب را هم تازه می‌کند.
 */
import { useCallback, useEffect, useState, type ReactNode } from "react";
import CrudResource, { type ResourceAction } from "./crud/CrudResource";
import type { GridColumnDef } from "./crud/gridLogic";
import type { FormFieldDef, FormValues } from "./crud/formLogic";
import { crudInputCls, crudLabelCls, crudPrimaryBtnCls } from "./crud/styles";
import { useAsyncList } from "./crud/useAsyncList";
import {
  MFG_INDUSTRY_TYPES,
  MfgClient,
  MfgRequestError,
  canMfgAccess,
  type MfgIndustryCapabilityMap,
  type MfgIndustryType,
  type MfgPlantSettingsPatch,
  type MfgPlantSettingsResponse,
  type MfgBomHeader,
  type MfgBomItem,
  type MfgDemandForecast,
  type MfgLotSizingPolicy,
  type MfgListResponse,
  type MfgMaterial,
  type MfgPart,
  type MfgPlannedOrder,
  type MfgProductionAlert,
  type MfgProductionOrder,
  type MfgProductionVersion,
  type MfgRouting,
  type MfgRoutingOperation,
  type MfgWorkCenter,
  type MfgWorkCenterResource,
} from "../services/manufacturingApi";

/* ───────────── ثابت‌ها و کمک‌ها ───────────── */

const PAGE = 200;
const MAX_PAGES = 25;

const PART_TYPES = ["manufactured", "purchased", "phantom", "subcontract"] as const;
const BOM_ISSUE_METHODS = ["manual", "backflush", "kit"] as const;
const WORK_CENTER_KINDS = ["machine", "labor", "assembly", "inspection"] as const;
const WORK_CENTER_STATUSES = ["active", "inactive", "maintenance"] as const;
const RESOURCE_KINDS = ["machine", "labor"] as const;
const PRIORITY_RULES = ["EDD", "CR", "MANUAL"] as const;
const DEMAND_SOURCES = ["manual", "sales-order", "contract", "forecast"] as const;
const DEMAND_TYPES = ["sales-order", "forecast", "contract", "manual"] as const;
const DEMAND_STATUSES = ["draft", "confirmed", "cancelled"] as const;
const DEMAND_TYPE_LABELS: Record<string, { fa: string; en: string }> = {
  "sales-order": { fa: "سفارش فروش", en: "Sales order" },
  forecast: { fa: "پیش‌بینی فروش", en: "Forecast" },
  contract: { fa: "قرارداد", en: "Contract" },
  manual: { fa: "ثبت دستی", en: "Manual" },
};
const DEMAND_STATUS_LABELS: Record<string, { fa: string; en: string }> = {
  draft: { fa: "پیش‌نویس", en: "Draft" },
  confirmed: { fa: "تأییدشده", en: "Confirmed" },
  cancelled: { fa: "لغوشده", en: "Cancelled" },
};
const LOT_RULES = ["L4L", "FOQ", "EOQ", "POQ"] as const;

function opts(values: readonly string[]) {
  return values.map((value) => ({ value, label: value }));
}

function describeMesError(error: unknown): string {
  if (error instanceof MfgRequestError) return error.code ? `${error.message} (${error.code})` : error.message;
  if (error instanceof Error) return error.message;
  return String(error);
}

/** خواندن همهٔ صفحات یک فهرست (سرور سقف ۲۰۰ ردیف در هر صفحه دارد). */
async function loadAll<T>(fetchPage: (offset: number) => Promise<MfgListResponse<T>>): Promise<T[]> {
  const out: T[] = [];
  for (let guard = 0; guard < MAX_PAGES; guard += 1) {
    const res = await fetchPage(out.length);
    out.push(...res.items);
    if (res.items.length === 0 || out.length >= (res.page?.total ?? out.length)) break;
  }
  return out;
}

function useMesRows<T>(loader: (offset: number) => Promise<MfgListResponse<T>>, deps: unknown[]) {
  const list = useAsyncList(() => loadAll(loader), deps, describeMesError);
  return { rows: (list.data ?? []) as T[], loading: list.loading, error: list.error, reload: list.reload };
}

/** انتخاب والد برای جدول‌های وابسته (مثلاً ردیف‌های یک BOM). */
function ParentSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className={`${crudLabelCls} min-w-[220px]`}>
      {label}
      <select className={crudInputCls} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.length === 0 && <option value="">—</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border b-line-soft bg-black/15 p-3 space-y-2">
      <header className="space-y-0.5">
        <h3 className="tx1 text-sm font-semibold">{title}</h3>
        {hint && <p className="tx3 text-[11px]">{hint}</p>}
      </header>
      {children}
    </section>
  );
}

interface MesPanelProps {
  fa: boolean;
  plantId: string;
  userId: string;
  onChanged: () => void;
}

/** تبدیل بدنهٔ فرم به شکل سخت‌گیر کلاینت؛ سرور خودش اعتبارسنجی را انجام می‌دهد. */
function asBody<T>(payload: Record<string, unknown>): T {
  return payload as unknown as T;
}

function shortDate(value: string | null | undefined): string {
  return value ? String(value).slice(0, 10) : "—";
}

function shortDateTime(value: string | null | undefined): string {
  return value ? String(value).replace("T", " ").slice(0, 16) : "—";
}

function yesNo(fa: boolean, value: boolean | null | undefined) {
  return value ? (fa ? "بله" : "Yes") : fa ? "خیر" : "No";
}

/** اقدام تغییر وضعیت ساده با تأیید (بدون فرم). */
function statusAction<T extends { RowVersion: number }>(
  key: string,
  label: string,
  tone: ResourceAction<T>["tone"],
  run: (row: T) => Promise<unknown>,
  successText: string,
  message: string,
  extra: Partial<ResourceAction<T>> = {},
): ResourceAction<T> {
  return {
    key,
    label,
    tone,
    confirm: { title: label, message, confirmLabel: label, danger: tone === "danger" },
    run: (row) => run(row),
    successText,
    ...extra,
  };
}

/* ═══════════════════════ ۱. مهندسی ساخت ═══════════════════════ */

/**
 * گزینه‌های منوی «نوع صنعت / الگوی تولید» — دقیقاً هفت IndustryType موجود در
 * سرویس (MFG_INDUSTRY_TYPES) با برچسب فارسی ماژول MES. کد value همان مقدار
 * `IndustryType` است که API تنظیمات کارخانه ذخیره می‌کند.
 */
const INDUSTRY_TYPE_OPTIONS: ReadonlyArray<{ code: MfgIndustryType; fa: string; en: string }> = [
  { code: "discrete", fa: "صنایع قطعه‌سازی و مونتاژ", en: "Discrete & assembly" },
  { code: "process", fa: "صنایع فرآیندی و شیمیایی", en: "Process & chemical" },
  { code: "food", fa: "صنایع غذایی و آشامیدنی", en: "Food & beverage" },
  { code: "pharma", fa: "صنایع دارویی و بهداشتی", en: "Pharmaceutical & medical" },
  { code: "automotive", fa: "صنایع خودروسازی و قطعات", en: "Automotive & parts" },
  { code: "metal", fa: "صنایع فلزی و فولاد", en: "Metals & steel" },
  { code: "drilling_energy", fa: "صنایع نفت، گاز و حفاری", en: "Oil, gas & drilling" },
];

function industryTypeLabel(fa: boolean, code: MfgIndustryType | null | undefined): string {
  const option = INDUSTRY_TYPE_OPTIONS.find((entry) => entry.code === code);
  if (!option) return code ?? "—";
  return fa ? option.fa : option.en;
}

/**
 * منوی «نوع صنعت / الگوی تولید» — بالای تب «مهندسی ساخت».
 *
 * اتصال به APIهای موجود `/api/mfg/plants/:plantId/settings`:
 *  - با ورود به تب، تنظیمات ذخیره‌شده کارخانه خوانده می‌شود؛ اگر رکورد نباشد
 *    (۴۰ صادقانه از سرور)، کارخانه «هنوز پیکربندی نشده» است و ساخت رکورد
 *    جدید NameFa را الزامی می‌داند.
 *  - تغییر صنعت: اگر رکورد وجود داشته باشد با If-Match (RowVersion) ذخیره
 *    می‌شود؛ اگر نه، رکورد جدید ساخته می‌شود. در هر دو حالت پاسخ سرور همان
 *    نگاشت قابلیت‌های صنعت (فیلدهای اختصاصی) است که بلافاصله اینجا رندر می‌شود.
 *  - پیش از ساخت (بدون رکورد) از مسیر preview سرور (GET /capabilities) برای
 *    دیدن فیلدهای صنعتِ انتخابی بدون ذخیره استفاده می‌شود.
 */
export function MesIndustrySettingsPanel({ fa, plantId, userId }: { fa: boolean; plantId: string; userId: string }) {
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const canView = canMfgAccess(userId, "mfg.plant.view", plantId);
  const canEdit = canMfgAccess(userId, "mfg.plant.edit", plantId);

  const [settings, setSettings] = useState<MfgPlantSettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [draft, setDraft] = useState<MfgIndustryType | "">("");
  const [nameFa, setNameFa] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [preview, setPreview] = useState<MfgIndustryCapabilityMap | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    setSaveMessage(null);
    setPreview(null);

    /* هیچ درخواست تنظیمات برای نقش بی‌مجوز فرستاده نمی‌شود؛ API این مسیر
     * را با mfg.plant.view محافظت می‌کند و پاسخ ۴۰۳ در رابط ایجاد نمی‌کنیم. */
    if (!canView) {
      setSettings(null);
      setDraft("");
      setLoadError(tr("برای مشاهدهٔ نوع صنعت، مجوز mfg.plant.view لازم است.", "Viewing industry settings requires mfg.plant.view."));
      setLoading(false);
      return;
    }

    try {
      const res = await MfgClient.getPlantSettings(plantId, userId);
      setSettings(res);
      setDraft(res.plant.industryType);
    } catch (err) {
      // ۴۰۴ = رکورد تنظیمات ندارد؛ IndustryType هنوز تصمیم گرفته نشده (نه پیش‌فرض ساختگی).
      if (err instanceof MfgRequestError && err.status === 404) {
        setSettings(null);
        setDraft("");
      } else {
        setSettings(null);
        setDraft("");
        setLoadError(describeMesError(err));
      }
    } finally {
      setLoading(false);
    }
  }, [plantId, userId, canView, fa]);

  useEffect(() => {
    void load();
  }, [load]);

  /* منوی انتخاب برای نقش‌های فقط‌خواندنی هم فعال است: آن‌ها نگاشت صنعت را
   * با GET مجاز پیش‌نمایش می‌کنند، اما هرگز PATCH نمی‌فرستند. */
  useEffect(() => {
    const needsPreview = draft !== "" && (
      settings === null || (!canEdit && draft !== settings.plant.industryType)
    );
    if (!canView || !needsPreview) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    MfgClient.getIndustryCapabilities(plantId, draft, userId)
      .then((res) => {
        if (!cancelled) setPreview(res);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setPreview(null);
        if (err instanceof MfgRequestError && err.status !== 404) {
          setLoadError(describeMesError(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [settings, draft, plantId, userId, canView, canEdit]);

  const committed = settings?.plant.industryType ?? null;
  const effectiveMap = preview ?? settings?.capabilities ?? null;

  const save = async (next: MfgIndustryType) => {
    if (!next || saving || !canEdit) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      const body: MfgPlantSettingsPatch = { IndustryType: next };
      if (settings === null) {
        // ساخت نخست: سرور NameFa را الزامی می‌داند.
        const trimmed = nameFa.trim();
        if (!trimmed) {
          setSaveMessage({
            ok: false,
            text: tr("برای ساخت نخستین رکورد، نام کارخانه (NameFa) را وارد کنید.", "Enter the plant name (NameFa) to create the record."),
          });
          return;
        }
        body.NameFa = trimmed;
      }
      const res = await MfgClient.updatePlantSettings(plantId, body, settings?.plant.rowVersion ?? null, userId);
      setSettings(res);
      setDraft(res.plant.industryType);
      setSaveMessage({
        ok: true,
        text: tr(
          `نوع صنعت به «${industryTypeLabel(fa, res.plant.industryType)}» ذخیره شد (v${res.plant.rowVersion}).`,
          `Industry type saved as "${industryTypeLabel(false, res.plant.industryType)}" (v${res.plant.rowVersion}).`,
        ),
      });
    } catch (err) {
      if (err instanceof MfgRequestError && err.status === 409) {
        setSaveMessage({ ok: false, text: tr("تنظیمات کارخانه از زمان خواندن تغییر کرده؛ تازه‌خوانی شد.", "Plant settings changed elsewhere; reloaded.") });
        void load();
      } else {
        setSaveMessage({ ok: false, text: describeMesError(err) });
      }
    } finally {
      setSaving(false);
    }
  };

  const onIndustryChange = (value: string) => {
    const next = (MFG_INDUSTRY_TYPES as readonly string[]).includes(value) ? (value as MfgIndustryType) : "";
    setDraft(next);
    setLoadError("");
    setSaveMessage(null);
    // ویرایشگر تغییر را ذخیره می‌کند؛ نقش فقط‌خواندنی فقط پیش‌نمایش مجاز GET می‌گیرد.
    if (next !== "" && settings !== null && next !== committed && canEdit) {
      void save(next);
    }
  };

  return (
    <Section
      title={tr("نوع صنعت / الگوی تولید", "Industry Type / Production Pattern")}
      hint={tr(
        "الگوی تولید کارخانه؛ با ذخیرهٔ تغییر، فیلدهای اختصاصی همان صنعت فعال و نمایش داده می‌شوند",
        "The plant's production pattern; saving a change activates and shows that industry's dedicated fields",
      )}
    >
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-end gap-3">
          <label className={`${crudLabelCls} min-w-[260px] flex-1 max-w-md`}>
            {tr("نوع صنعت / الگوی تولید", "Industry type / production pattern")}
            <select
              className={crudInputCls}
              value={draft}
              disabled={loading || saving || !canView}
              onChange={(event) => onIndustryChange(event.target.value)}
              aria-label={tr("نوع صنعت", "Industry type")}
            >
              <option value="">
                {loading
                  ? tr("در حال خواندن تنظیمات کارخانه…", "Loading plant settings…")
                  : tr("— انتخاب نوع صنعت —", "— select an industry —")}
              </option>
              {INDUSTRY_TYPE_OPTIONS.map((option) => (
                <option key={option.code} value={option.code}>
                  {fa ? option.fa : option.en} ({option.code})
                </option>
              ))}
            </select>
          </label>

          {settings === null && draft !== "" && (
            <>
              <label className={`${crudLabelCls} min-w-[220px] flex-1 max-w-xs`}>
                {tr("نام کارخانه — در ساخت نخست الزامی است (NameFa)", "Plant name — required on first creation (NameFa)")}
                <input
                  className={crudInputCls}
                  dir="rtl"
                  maxLength={240}
                  value={nameFa}
                  onChange={(event) => setNameFa(event.target.value)}
                  placeholder={tr("مثلاً کارخانهٔ موتور دیزل تبریز", "e.g. Tabriz Diesel Engine Plant")}
                />
              </label>
              {canEdit && (
                <button
                  type="button"
                  className={`${crudPrimaryBtnCls} h-[30px] shrink-0`}
                  disabled={saving || !nameFa.trim()}
                  onClick={() => void save(draft)}
                >
                  {saving ? tr("در حال ذخیره…", "Saving…") : tr("ساخت رکورد و ذخیره", "Create & save")}
                </button>
              )}
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          {loading ? (
            <span className="rounded-md border b-line-soft px-2 py-0.5 tx3">{tr("در حال بارگذاری تنظیمات…", "Loading settings…")}</span>
          ) : (
            <span
              className={`rounded-md border px-2 py-0.5 ${
                committed ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200" : "border-amber-500/40 bg-amber-500/10 text-amber-200"
              }`}
            >
              {committed
                ? tr(
                    `ذخیره‌شده: ${industryTypeLabel(fa, committed)} (v${settings?.plant.rowVersion ?? "?"})`,
                    `Saved: ${industryTypeLabel(false, committed)} (v${settings?.plant.rowVersion ?? "?"})`,
                  )
                : tr("این کارخانه هنوز پیکربندی نشده (رکورد تنظیمات ندارد)", "This plant is not configured yet (no settings record)")}
            </span>
          )}
          {preview && draft !== "" && (
            <span className="rounded-md border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-sky-200">
              {tr(`پیش‌نمایش (ذخیره‌نشده): ${industryTypeLabel(fa, draft)}`, `Preview (not saved): ${industryTypeLabel(false, draft)}`)}
            </span>
          )}
          {!canView && !loading && (
            <span className="tx3" dir="ltr" title={tr("برای مشاهدهٔ نوع صنعت، مجوز mfg.plant.view لازم است", "Viewing industry settings requires mfg.plant.view")}>
              requires mfg.plant.view
            </span>
          )}
          {canView && !canEdit && !loading && (
            <span className="tx3" title={tr("انتخاب صنعت فقط پیش‌نمایش است؛ ذخیرهٔ تغییر به مجوز mfg.plant.edit نیاز دارد", "Industry selection is preview-only; saving requires mfg.plant.edit")}>
              {tr("پیش‌نمایش فقط‌خواندنی · ذخیره نیازمند mfg.plant.edit", "Read-only preview · saving requires mfg.plant.edit")}
            </span>
          )}
        </div>

        {loadError && <p className="text-[11px] text-rose-300">{loadError}</p>}
        {saveMessage && (
          <p className={`text-[11px] ${saveMessage.ok ? "text-emerald-300" : "text-rose-300"}`}>{saveMessage.text}</p>
        )}

        {effectiveMap ? (
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] tx3">
              <span>
                {tr(
                  `فیلدهای اختصاصی فعال برای صنعت «${effectiveMap.industryTitleFa}»: ${effectiveMap.totals.enabledCount} از ${effectiveMap.totals.capabilityCount}`,
                  `Dedicated fields enabled for "${effectiveMap.industryTitleEn}": ${effectiveMap.totals.enabledCount} of ${effectiveMap.totals.capabilityCount}`,
                )}
              </span>
              {effectiveMap.characteristicFa && <span className="tx3">({effectiveMap.characteristicFa})</span>}
            </div>
            <div className="grid max-h-64 grid-cols-1 gap-1.5 overflow-y-auto pr-1 md:grid-cols-2 xl:grid-cols-3">
              {effectiveMap.capabilities.map((cap) => (
                <div
                  key={cap.code}
                  className={`rounded-lg border px-2 py-1.5 text-[11px] ${
                    cap.enabled ? "border-emerald-500/30 bg-emerald-500/[0.07]" : "border b-line-soft opacity-60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="tx1 font-medium">{fa ? cap.titleFa : cap.titleEn}</span>
                    <span dir="ltr" className="tx3 font-mono text-[10px]">
                      {cap.code}
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className={cap.enabled ? "text-emerald-300" : "tx3"}>
                      {cap.enabled ? tr("فعال برای این صنعت", "enabled for this industry") : tr("نامرتبط", "not relevant")}
                    </span>
                    <span className={cap.implemented ? "text-sky-300" : "text-amber-300"}>
                      {cap.implemented ? tr("در سامانه پیاده شده", "implemented in this system") : tr("هنوز پیاده نشده", "not implemented yet")}
                    </span>
                  </div>
                  {fa && <p className="mt-0.5 leading-relaxed tx3">{cap.reasonFa}</p>}
                </div>
              ))}
            </div>
          </div>
        ) : (
          !loading &&
          draft === "" && (
            <p className="text-[11px] tx3">
              {tr(
                "نوع صنعت را از منوی بالا انتخاب کنید تا فیلدهای اختصاصی آن صنعت اینجا فعال و نمایش داده شود.",
                "Pick an industry type from the dropdown to activate and show its dedicated fields here.",
              )}
            </p>
          )
        )}
      </div>
    </Section>
  );
}

export function MesPartsPanel({ fa, plantId, userId, onChanged }: MesPanelProps) {
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const allowed = canMfgAccess(userId, "mfg.part.edit", plantId);
  const list = useMesRows((offset) => MfgClient.listParts(plantId, userId, { limit: PAGE, offset }), [plantId, userId]);
  const rows = list.rows as MfgPart[];

  const partFields: FormFieldDef[] = [
    { name: "NameFa", label: tr("نام قطعه", "Part name"), required: true, maxLength: 240, fullWidth: true },
    { name: "NameEn", label: tr("نام لاتین", "English name"), maxLength: 240, ltr: true },
    { name: "PartType", label: tr("نوع قطعه", "Part type"), type: "select", required: true, options: opts(PART_TYPES) },
    { name: "BaseUom", label: tr("واحد پایه", "Base UoM"), required: true, maxLength: 16, ltr: true, placeholder: "ea" },
    { name: "Currency", label: tr("ارز", "Currency"), required: true, maxLength: 8, ltr: true, placeholder: "IRR" },
    { name: "StandardUnitCost", label: tr("بهای استاندارد واحد", "Standard unit cost"), type: "number", min: 0 },
    { name: "IsLotTracked", label: tr("ردیابی لات", "Lot tracked"), type: "checkbox" },
    { name: "DescriptionFa", label: tr("شرح", "Description"), type: "textarea", maxLength: 1200, fullWidth: true },
  ];

  const columns: GridColumnDef<MfgPart>[] = [
    { key: "PartNo", header: tr("شمارهٔ قطعه", "Part no."), ltr: true, mono: true },
    { key: "NameFa", header: tr("نام", "Name") },
    { key: "PartType", header: tr("نوع", "Type"), filter: "auto" },
    { key: "BaseUom", header: tr("واحد", "UoM"), ltr: true, align: "center" },
    { key: "StandardUnitCost", header: tr("بهای واحد", "Unit cost"), ltr: true, align: "end" },
    { key: "IsLotTracked", header: tr("ردیابی لات", "Lot tracked"), accessor: (row) => yesNo(fa, row.IsLotTracked), filter: "auto" },
    {
      key: "status",
      header: tr("وضعیت", "Status"),
      accessor: (row) => (row.IsActive ? tr("فعال", "Active") : tr("غیرفعال", "Inactive")),
      filter: "auto",
    },
  ];

  return (
    <CrudResource<MfgPart>
      fa={fa}
      caption={tr("قطعات", "Parts")}
      rows={rows}
      columns={columns}
      rowKey={(row) => row.Id}
      loading={list.loading}
      error={list.error}
      onRetry={list.reload}
      onChanged={() => { list.reload(); onChanged(); }}
      describeError={describeMesError}
      emptyText={tr("قطعه‌ای ثبت نشده است", "No part registered")}
      create={{
        title: tr("قطعهٔ جدید", "New part"),
        fields: [{ name: "PartNo", label: tr("شمارهٔ قطعه", "Part no."), required: true, maxLength: 60, ltr: true }, ...partFields],
        defaults: { PartType: "manufactured", BaseUom: "ea", Currency: "IRR", IsLotTracked: "false" },
        allowed,
        deniedTitle: "mfg.part.edit",
        submit: (payload) => MfgClient.createPart(plantId, userId, asBody(payload)),
        successText: tr("قطعه ثبت شد.", "Part created."),
      }}
      edit={{
        title: tr("ویرایش قطعه", "Edit part"),
        fields: partFields,
        allowed,
        deniedTitle: "mfg.part.edit",
        submit: (row, payload) => MfgClient.patchPart(plantId, userId, row.Id, row.RowVersion, payload),
        successText: tr("تغییرات قطعه ذخیره شد.", "Part updated."),
      }}
      actions={(row) => [
        statusAction<MfgPart>(
          "toggle",
          row.IsActive ? tr("غیرفعال‌سازی", "Deactivate") : tr("فعال‌سازی", "Activate"),
          "warn",
          (r) => MfgClient.patchPart(plantId, userId, r.Id, r.RowVersion, { IsActive: !r.IsActive }),
          row.IsActive ? tr("قطعه غیرفعال شد.", "Part deactivated.") : tr("قطعه فعال شد.", "Part activated."),
          tr("رکورد حذف نمی‌شود؛ فقط از برنامه‌ریزی جدید کنار می‌رود.", "The record is kept; it only leaves new planning."),
          { disabled: () => !allowed, title: allowed ? undefined : "mfg.part.edit" },
        ),
      ]}
    />
  );
}

export function MesBomHeadersPanel({ fa, plantId, userId, onChanged }: MesPanelProps) {
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const allowed = canMfgAccess(userId, "mfg.bom.edit", plantId);
  const releaseAllowed = canMfgAccess(userId, "mfg.bom.release", plantId);
  const list = useMesRows((offset) => MfgClient.listBomHeaders(plantId, userId, { limit: PAGE, offset }), [plantId, userId]);
  const parts = useMesRows((offset) => MfgClient.listParts(plantId, userId, { limit: PAGE, offset }), [plantId, userId]);
  const rows = list.rows as MfgBomHeader[];
  const partOptions = (parts.rows as MfgPart[]).map((p) => ({ value: p.Id, label: `${p.PartNo} — ${p.NameFa}` }));
  const partLabel = (id: string) => (parts.rows as MfgPart[]).find((p) => p.Id === id)?.PartNo ?? id;

  const fields: FormFieldDef[] = [
    { name: "Revision", label: tr("نسخه (Revision)", "Revision"), required: true, maxLength: 60, ltr: true },
    { name: "BaseQuantity", label: tr("مقدار پایه", "Base quantity"), type: "number", required: true, min: 0.000001 },
    { name: "BaseUom", label: tr("واحد پایه", "Base UoM"), required: true, maxLength: 16, ltr: true },
    { name: "EffectiveFrom", label: tr("معتبر از", "Effective from"), type: "date", required: true },
    { name: "EffectiveTo", label: tr("معتبر تا", "Effective to"), type: "date" },
    { name: "IsDefault", label: tr("BOM پیش‌فرض", "Default BOM"), type: "checkbox" },
    { name: "NoteFa", label: tr("یادداشت", "Note"), type: "textarea", maxLength: 1000, fullWidth: true },
  ];

  const columns: GridColumnDef<MfgBomHeader>[] = [
    { key: "PartId", header: tr("قطعه", "Part"), accessor: (row) => partLabel(row.PartId), ltr: true, mono: true },
    { key: "Revision", header: tr("نسخه", "Revision"), ltr: true, mono: true },
    { key: "Status", header: tr("وضعیت", "Status"), filter: "auto" },
    { key: "BaseQuantity", header: tr("مقدار پایه", "Base qty"), align: "end", ltr: true },
    { key: "BaseUom", header: tr("واحد", "UoM"), ltr: true, align: "center" },
    { key: "EffectiveFrom", header: tr("معتبر از", "From"), accessor: (row) => shortDate(row.EffectiveFrom), ltr: true },
    { key: "IsDefault", header: tr("پیش‌فرض", "Default"), accessor: (row) => yesNo(fa, row.IsDefault), filter: "auto" },
  ];

  return (
    <CrudResource<MfgBomHeader>
      fa={fa}
      caption={tr("BOM (فهرست مواد)", "Bills of material")}
      rows={rows}
      columns={columns}
      rowKey={(row) => row.Id}
      loading={list.loading || parts.loading}
      error={list.error ?? parts.error}
      onRetry={() => { list.reload(); parts.reload(); }}
      onChanged={() => { list.reload(); onChanged(); }}
      describeError={describeMesError}
      emptyText={tr("BOM ثبت نشده است", "No BOM registered")}
      create={{
        title: tr("BOM جدید (پیش‌نویس)", "New BOM (draft)"),
        fields: [
          { name: "PartId", label: tr("قطعهٔ والد", "Parent part"), type: "select", required: true, options: partOptions },
          ...fields,
        ],
        defaults: { BaseQuantity: "1", IsDefault: "false" },
        allowed,
        deniedTitle: "mfg.bom.edit",
        submit: (payload) => MfgClient.createBomHeader(plantId, userId, payload),
        successText: tr("BOM پیش‌نویس ثبت شد.", "Draft BOM created."),
      }}
      edit={{
        title: tr("ویرایش BOM", "Edit BOM"),
        fields,
        allowed,
        deniedTitle: "mfg.bom.edit",
        locked: (row) => row.Status !== "draft",
        lockedTitle: tr("فقط BOM پیش‌نویس قابل ویرایش است", "Only draft BOMs can be edited"),
        submit: (row, payload) => MfgClient.patchBomHeader(plantId, userId, row.Id, row.RowVersion, payload),
        successText: tr("BOM ذخیره شد.", "BOM updated."),
      }}
      actions={(row) => [
        statusAction<MfgBomHeader>(
          "release",
          tr("آزادسازی", "Release"),
          "primary",
          (r) => MfgClient.releaseBom(plantId, userId, r.Id, r.RowVersion, {}),
          tr("BOM آزاد شد.", "BOM released."),
          tr("پس از آزادسازی، BOM فقط خواندنی است.", "After release the BOM becomes read-only."),
          {
            hidden: () => row.Status !== "draft",
            disabled: () => !releaseAllowed,
            title: releaseAllowed ? undefined : "mfg.bom.release",
          },
        ),
      ]}
    />
  );
}

export function MesBomItemsPanel({ fa, plantId, userId, onChanged }: MesPanelProps) {
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const allowed = canMfgAccess(userId, "mfg.bom.edit", plantId);
  const headers = useMesRows((offset) => MfgClient.listBomHeaders(plantId, userId, { limit: PAGE, offset }), [plantId, userId]);
  const parts = useMesRows((offset) => MfgClient.listParts(plantId, userId, { limit: PAGE, offset }), [plantId, userId]);
  const [bomId, setBomId] = useState<string>("");
  const selectedId = bomId || (headers.rows as MfgBomHeader[])[0]?.Id || "";
  const selected = (headers.rows as MfgBomHeader[]).find((h) => h.Id === selectedId) ?? null;
  const items = useMesRows(
    (offset) => (selectedId ? MfgClient.listBomItems(plantId, userId, selectedId, { limit: PAGE, offset }) : Promise.resolve({ items: [], page: { limit: PAGE, offset: 0, total: 0 } })),
    [plantId, userId, selectedId],
  );
  const rows = items.rows as MfgBomItem[];
  const partOptions = (parts.rows as MfgPart[]).map((p) => ({ value: p.Id, label: `${p.PartNo} — ${p.NameFa}` }));
  const partLabel = (id: string) => (parts.rows as MfgPart[]).find((p) => p.Id === id)?.PartNo ?? id;
  const isDraft = selected?.Status === "draft";

  const fields: FormFieldDef[] = [
    { name: "LineNo", label: tr("شمارهٔ ردیف", "Line no."), type: "number", integer: true, required: true, min: 1 },
    { name: "ComponentPartId", label: tr("قطعهٔ جزء", "Component part"), type: "select", required: true, options: partOptions },
    { name: "QuantityPer", label: tr("مقدار مصرف", "Quantity per"), type: "number", required: true, min: 0.000001 },
    { name: "Uom", label: tr("واحد", "UoM"), maxLength: 16, ltr: true },
    { name: "ScrapPct", label: tr("درصد ضایعات", "Scrap %"), type: "number", min: 0, max: 100 },
    { name: "IssueMethod", label: tr("روش صدور", "Issue method"), type: "select", required: true, options: opts(BOM_ISSUE_METHODS) },
    { name: "IssueAtOperationCode", label: tr("صدور در عملیات", "Issue at operation"), maxLength: 40, ltr: true },
    { name: "IsPhantom", label: tr("فانتوم", "Phantom"), type: "checkbox" },
    { name: "NoteFa", label: tr("یادداشت", "Note"), type: "textarea", maxLength: 600, fullWidth: true },
  ];

  const columns: GridColumnDef<MfgBomItem>[] = [
    { key: "LineNo", header: tr("ردیف", "Line"), align: "center", ltr: true },
    { key: "ComponentPartId", header: tr("جزء", "Component"), accessor: (row) => partLabel(row.ComponentPartId), ltr: true, mono: true },
    { key: "QuantityPer", header: tr("مقدار مصرف", "Qty per"), align: "end", ltr: true },
    { key: "Uom", header: tr("واحد", "UoM"), ltr: true, align: "center" },
    { key: "ScrapPct", header: tr("ضایعات %", "Scrap %"), align: "end", ltr: true },
    { key: "IssueMethod", header: tr("صدور", "Issue"), filter: "auto" },
    { key: "IsPhantom", header: tr("فانتوم", "Phantom"), accessor: (row) => yesNo(fa, row.IsPhantom), filter: "auto" },
  ];

  return (
    <CrudResource<MfgBomItem>
      fa={fa}
      caption={tr("ردیف‌های BOM", "BOM lines")}
      rows={rows}
      columns={columns}
      rowKey={(row) => row.Id}
      loading={items.loading || headers.loading}
      error={items.error ?? headers.error}
      onRetry={() => { items.reload(); headers.reload(); }}
      onChanged={() => { items.reload(); onChanged(); }}
      describeError={describeMesError}
      emptyText={tr("ردیفی برای این BOM ثبت نشده است", "No lines for this BOM")}
      toolbarExtra={
        <ParentSelect
          label={tr("BOM", "BOM")}
          value={selectedId}
          onChange={setBomId}
          options={(headers.rows as MfgBomHeader[]).map((h) => ({ value: h.Id, label: `${partLabel(h.PartId)} · ${h.Revision} (${h.Status})` }))}
        />
      }
      create={{
        title: tr("ردیف BOM جدید", "New BOM line"),
        fields,
        defaults: { IssueMethod: "manual", ScrapPct: "0", IsPhantom: "false" },
        allowed: allowed && isDraft,
        deniedTitle: isDraft ? "mfg.bom.edit" : tr("فقط BOM پیش‌نویس", "Draft BOM only"),
        submit: (payload) => MfgClient.createBomItem(plantId, userId, selectedId, payload),
        successText: tr("ردیف افزوده شد.", "Line added."),
      }}
      edit={{
        title: tr("ویرایش ردیف BOM", "Edit BOM line"),
        fields,
        allowed: allowed && isDraft,
        deniedTitle: isDraft ? "mfg.bom.edit" : tr("فقط BOM پیش‌نویس", "Draft BOM only"),
        submit: (row, payload) => MfgClient.patchBomItem(plantId, userId, row.Id, row.RowVersion, payload),
        successText: tr("ردیف ذخیره شد.", "Line updated."),
      }}
      actions={() => [
        statusAction<MfgBomItem>(
          "delete",
          tr("حذف", "Delete"),
          "danger",
          (r) => MfgClient.deleteBomItem(plantId, userId, r.Id),
          tr("ردیف حذف شد.", "Line deleted."),
          tr("فقط در BOM پیش‌نویس و اگر در سفارش آزادشده مصرف نشده باشد حذف می‌شود.", "Only in a draft BOM and only if no released order uses it."),
          { hidden: () => !isDraft, disabled: () => !allowed, title: allowed ? undefined : "mfg.bom.edit" },
        ),
      ]}
    />
  );
}

export function MesRoutingsPanel({ fa, plantId, userId, onChanged }: MesPanelProps) {
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const allowed = canMfgAccess(userId, "mfg.routing.edit", plantId);
  const releaseAllowed = canMfgAccess(userId, "mfg.routing.release", plantId);
  const list = useMesRows((offset) => MfgClient.listRoutings(plantId, userId, { limit: PAGE, offset }), [plantId, userId]);
  const parts = useMesRows((offset) => MfgClient.listParts(plantId, userId, { limit: PAGE, offset }), [plantId, userId]);
  const rows = list.rows as MfgRouting[];
  const partOptions = (parts.rows as MfgPart[]).map((p) => ({ value: p.Id, label: `${p.PartNo} — ${p.NameFa}` }));
  const partLabel = (id: string) => (parts.rows as MfgPart[]).find((p) => p.Id === id)?.PartNo ?? id;

  const fields: FormFieldDef[] = [
    { name: "RoutingCode", label: tr("کد مسیر", "Routing code"), required: true, maxLength: 60, ltr: true },
    { name: "Revision", label: tr("نسخه", "Revision"), required: true, maxLength: 60, ltr: true },
    { name: "BaseQuantity", label: tr("مقدار پایه", "Base quantity"), type: "number", required: true, min: 0.000001 },
    { name: "BaseUom", label: tr("واحد پایه", "Base UoM"), required: true, maxLength: 16, ltr: true },
    { name: "EffectiveFrom", label: tr("معتبر از", "Effective from"), type: "date", required: true },
    { name: "EffectiveTo", label: tr("معتبر تا", "Effective to"), type: "date" },
    { name: "IsDefault", label: tr("مسیر پیش‌فرض", "Default routing"), type: "checkbox" },
    { name: "NoteFa", label: tr("یادداشت", "Note"), type: "textarea", maxLength: 1000, fullWidth: true },
  ];

  const columns: GridColumnDef<MfgRouting>[] = [
    { key: "RoutingCode", header: tr("کد", "Code"), ltr: true, mono: true },
    { key: "PartId", header: tr("قطعه", "Part"), accessor: (row) => partLabel(row.PartId), ltr: true, mono: true },
    { key: "Revision", header: tr("نسخه", "Revision"), ltr: true, mono: true },
    { key: "Status", header: tr("وضعیت", "Status"), filter: "auto" },
    { key: "EffectiveFrom", header: tr("معتبر از", "From"), accessor: (row) => shortDate(row.EffectiveFrom), ltr: true },
    { key: "IsDefault", header: tr("پیش‌فرض", "Default"), accessor: (row) => yesNo(fa, row.IsDefault), filter: "auto" },
  ];

  return (
    <CrudResource<MfgRouting>
      fa={fa}
      caption={tr("مسیرهای ساخت (Routing)", "Routings")}
      rows={rows}
      columns={columns}
      rowKey={(row) => row.Id}
      loading={list.loading || parts.loading}
      error={list.error ?? parts.error}
      onRetry={() => { list.reload(); parts.reload(); }}
      onChanged={() => { list.reload(); onChanged(); }}
      describeError={describeMesError}
      emptyText={tr("مسیری ثبت نشده است", "No routing registered")}
      create={{
        title: tr("مسیر جدید (پیش‌نویس)", "New routing (draft)"),
        fields: [{ name: "PartId", label: tr("قطعهٔ والد", "Parent part"), type: "select", required: true, options: partOptions }, ...fields],
        defaults: { BaseQuantity: "1", IsDefault: "false" },
        allowed,
        deniedTitle: "mfg.routing.edit",
        submit: (payload) => MfgClient.createRouting(plantId, userId, payload),
        successText: tr("مسیر پیش‌نویس ثبت شد.", "Draft routing created."),
      }}
      edit={{
        title: tr("ویرایش مسیر", "Edit routing"),
        fields,
        allowed,
        deniedTitle: "mfg.routing.edit",
        locked: (row) => row.Status !== "draft",
        lockedTitle: tr("فقط مسیر پیش‌نویس قابل ویرایش است", "Only draft routings can be edited"),
        submit: (row, payload) => MfgClient.patchRouting(plantId, userId, row.Id, row.RowVersion, payload),
        successText: tr("مسیر ذخیره شد.", "Routing updated."),
      }}
      actions={() => [
        statusAction<MfgRouting>(
          "release",
          tr("آزادسازی", "Release"),
          "primary",
          (r) => MfgClient.releaseRouting(plantId, userId, r.Id, r.RowVersion, {}),
          tr("مسیر آزاد شد.", "Routing released."),
          tr("پس از آزادسازی، مسیر فقط خواندنی است.", "After release the routing becomes read-only."),
          {
            hidden: (row) => row.Status !== "draft",
            disabled: () => !releaseAllowed,
            title: releaseAllowed ? undefined : "mfg.routing.release",
          },
        ),
      ]}
    />
  );
}

export function MesRoutingOperationsPanel({ fa, plantId, userId, onChanged }: MesPanelProps) {
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const allowed = canMfgAccess(userId, "mfg.routing.edit", plantId);
  const routings = useMesRows((offset) => MfgClient.listRoutings(plantId, userId, { limit: PAGE, offset }), [plantId, userId]);
  const workCenters = useMesRows((offset) => MfgClient.listWorkCenters(plantId, userId, { limit: PAGE, offset }), [plantId, userId]);
  const [routingId, setRoutingId] = useState<string>("");
  const selectedId = routingId || (routings.rows as MfgRouting[])[0]?.Id || "";
  const selected = (routings.rows as MfgRouting[]).find((r) => r.Id === selectedId) ?? null;
  const isDraft = selected?.Status === "draft";
  const ops = useMesRows(
    (offset) => (selectedId ? MfgClient.listRoutingOperations(plantId, userId, selectedId, { limit: PAGE, offset }) : Promise.resolve({ items: [], page: { limit: PAGE, offset: 0, total: 0 } })),
    [plantId, userId, selectedId],
  );
  const rows = ops.rows as MfgRoutingOperation[];
  const wcOptions = (workCenters.rows as MfgWorkCenter[]).map((w) => ({ value: w.Id, label: `${w.Code} — ${w.NameFa}` }));
  const wcLabel = (id: string) => (workCenters.rows as MfgWorkCenter[]).find((w) => w.Id === id)?.Code ?? id;

  const fields: FormFieldDef[] = [
    { name: "SequenceNo", label: tr("توالی", "Sequence"), type: "number", integer: true, required: true, min: 1 },
    { name: "OperationCode", label: tr("کد عملیات", "Operation code"), required: true, maxLength: 60, ltr: true },
    { name: "OperationNameFa", label: tr("نام عملیات", "Operation name"), required: true, maxLength: 240, fullWidth: true },
    { name: "OperationNameEn", label: tr("نام لاتین", "English name"), maxLength: 240, ltr: true },
    { name: "WorkCenterId", label: tr("مرکز کاری", "Work center"), type: "select", required: true, options: wcOptions },
    { name: "SetupMinutes", label: tr("زمان آماده‌سازی (دقیقه)", "Setup (min)"), type: "number", min: 0 },
    { name: "RunMinutesPerUnit", label: tr("زمان اجرا به ازای واحد (دقیقه)", "Run min / unit"), type: "number", required: true, min: 0 },
    { name: "QueueMinutes", label: tr("زمان صف (دقیقه)", "Queue (min)"), type: "number", min: 0 },
    { name: "MoveMinutes", label: tr("زمان جابه‌جایی (دقیقه)", "Move (min)"), type: "number", min: 0 },
    { name: "PredecessorSequence", label: tr("توالی پیش‌نیاز", "Predecessor sequence"), type: "number", integer: true, min: 1 },
    { name: "OverlapAllowed", label: tr("هم‌پوشانی مجاز", "Overlap allowed"), type: "checkbox" },
    { name: "TransferBatchQty", label: tr("اندازهٔ دستهٔ انتقال", "Transfer batch qty"), type: "number", min: 0.000001, visibleWhen: (v: FormValues) => v.OverlapAllowed === "true" },
    { name: "InspectionRequired", label: tr("نیاز به بازرسی", "Inspection required"), type: "checkbox" },
    { name: "WorkInstructionRef", label: tr("ارجاع دستورکار", "Work instruction ref."), maxLength: 120, ltr: true },
    { name: "NoteFa", label: tr("یادداشت", "Note"), type: "textarea", maxLength: 800, fullWidth: true },
  ];

  const columns: GridColumnDef<MfgRoutingOperation>[] = [
    { key: "SequenceNo", header: tr("توالی", "Seq."), align: "center", ltr: true },
    { key: "OperationCode", header: tr("کد", "Code"), ltr: true, mono: true },
    { key: "OperationNameFa", header: tr("عملیات", "Operation") },
    { key: "WorkCenterId", header: tr("مرکز کاری", "Work center"), accessor: (row) => wcLabel(row.WorkCenterId), ltr: true, filter: "auto" },
    { key: "SetupMinutes", header: tr("آماده‌سازی", "Setup"), align: "end", ltr: true },
    { key: "RunMinutesPerUnit", header: tr("اجرا/واحد", "Run/unit"), align: "end", ltr: true },
    { key: "InspectionRequired", header: tr("بازرسی", "Inspection"), accessor: (row) => yesNo(fa, row.InspectionRequired), filter: "auto" },
  ];

  return (
    <CrudResource<MfgRoutingOperation>
      fa={fa}
      caption={tr("عملیات مسیر", "Routing operations")}
      rows={rows}
      columns={columns}
      rowKey={(row) => row.Id}
      loading={ops.loading || routings.loading}
      error={ops.error ?? routings.error}
      onRetry={() => { ops.reload(); routings.reload(); }}
      onChanged={() => { ops.reload(); onChanged(); }}
      describeError={describeMesError}
      emptyText={tr("عملیاتی برای این مسیر ثبت نشده است", "No operations for this routing")}
      toolbarExtra={
        <ParentSelect
          label={tr("مسیر", "Routing")}
          value={selectedId}
          onChange={setRoutingId}
          options={(routings.rows as MfgRouting[]).map((r) => ({ value: r.Id, label: `${r.RoutingCode} · ${r.Revision} (${r.Status})` }))}
        />
      }
      create={{
        title: tr("عملیات جدید", "New operation"),
        fields,
        defaults: { SetupMinutes: "0", QueueMinutes: "0", MoveMinutes: "0", OverlapAllowed: "false", InspectionRequired: "false" },
        allowed: allowed && isDraft,
        deniedTitle: isDraft ? "mfg.routing.edit" : tr("فقط مسیر پیش‌نویس", "Draft routing only"),
        submit: (payload) => MfgClient.createRoutingOperation(plantId, userId, selectedId, payload),
        successText: tr("عملیات افزوده شد.", "Operation added."),
      }}
      edit={{
        title: tr("ویرایش عملیات", "Edit operation"),
        fields,
        allowed: allowed && isDraft,
        deniedTitle: isDraft ? "mfg.routing.edit" : tr("فقط مسیر پیش‌نویس", "Draft routing only"),
        submit: (row, payload) => MfgClient.patchRoutingOperation(plantId, userId, row.Id, row.RowVersion, payload),
        successText: tr("عملیات ذخیره شد.", "Operation updated."),
      }}
      actions={() => [
        statusAction<MfgRoutingOperation>(
          "delete",
          tr("حذف", "Delete"),
          "danger",
          (r) => MfgClient.deleteRoutingOperation(plantId, userId, r.Id),
          tr("عملیات حذف شد.", "Operation deleted."),
          tr("فقط در مسیر پیش‌نویس و اگر در سفارش مصرف نشده باشد حذف می‌شود.", "Only in a draft routing and only if no order uses it."),
          { hidden: () => !isDraft, disabled: () => !allowed, title: allowed ? undefined : "mfg.routing.edit" },
        ),
      ]}
    />
  );
}

export function MesWorkCentersPanel({ fa, plantId, userId, onChanged }: MesPanelProps) {
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const allowed = canMfgAccess(userId, "mfg.workcenter.edit", plantId);
  const list = useMesRows((offset) => MfgClient.listWorkCenters(plantId, userId, { limit: PAGE, offset }), [plantId, userId]);
  const rows = list.rows as MfgWorkCenter[];

  const fields: FormFieldDef[] = [
    { name: "NameFa", label: tr("نام مرکز کاری", "Work center name"), required: true, maxLength: 240, fullWidth: true },
    { name: "NameEn", label: tr("نام لاتین", "English name"), maxLength: 240, ltr: true },
    { name: "Kind", label: tr("نوع", "Kind"), type: "select", required: true, options: opts(WORK_CENTER_KINDS) },
    { name: "NominalCapacityMinutesPerDay", label: tr("ظرفیت اسمی (دقیقه/روز)", "Nominal capacity (min/day)"), type: "number", required: true, min: 1 },
    { name: "EfficiencyPct", label: tr("بازدهی %", "Efficiency %"), type: "number", min: 0, max: 100 },
    { name: "TimeZoneId", label: tr("منطقهٔ زمانی", "Time zone"), required: true, maxLength: 80, ltr: true, placeholder: "Asia/Tehran" },
    { name: "Status", label: tr("وضعیت", "Status"), type: "select", required: true, options: opts(WORK_CENTER_STATUSES) },
    { name: "DescriptionFa", label: tr("شرح", "Description"), type: "textarea", maxLength: 1200, fullWidth: true },
  ];

  const columns: GridColumnDef<MfgWorkCenter>[] = [
    { key: "Code", header: tr("کد", "Code"), ltr: true, mono: true },
    { key: "NameFa", header: tr("نام", "Name") },
    { key: "Kind", header: tr("نوع", "Kind"), filter: "auto" },
    { key: "NominalCapacityMinutesPerDay", header: tr("ظرفیت (دقیقه/روز)", "Capacity (min/day)"), align: "end", ltr: true },
    { key: "EfficiencyPct", header: tr("بازدهی %", "Efficiency %"), align: "end", ltr: true },
    { key: "TimeZoneId", header: tr("منطقهٔ زمانی", "Time zone"), ltr: true },
    { key: "Status", header: tr("وضعیت", "Status"), filter: "auto" },
  ];

  return (
    <CrudResource<MfgWorkCenter>
      fa={fa}
      caption={tr("مراکز کاری", "Work centers")}
      rows={rows}
      columns={columns}
      rowKey={(row) => row.Id}
      loading={list.loading}
      error={list.error}
      onRetry={list.reload}
      onChanged={() => { list.reload(); onChanged(); }}
      describeError={describeMesError}
      emptyText={tr("مرکز کاری ثبت نشده است", "No work center registered")}
      create={{
        title: tr("مرکز کاری جدید", "New work center"),
        fields: [{ name: "Code", label: tr("کد", "Code"), required: true, maxLength: 60, ltr: true }, ...fields],
        defaults: { Kind: "machine", NominalCapacityMinutesPerDay: "480", EfficiencyPct: "100", TimeZoneId: "Asia/Tehran", Status: "active" },
        allowed,
        deniedTitle: "mfg.workcenter.edit",
        submit: (payload) => MfgClient.createWorkCenter(plantId, userId, asBody(payload)),
        successText: tr("مرکز کاری ثبت شد.", "Work center created."),
      }}
      edit={{
        title: tr("ویرایش مرکز کاری", "Edit work center"),
        fields,
        allowed,
        deniedTitle: "mfg.workcenter.edit",
        submit: (row, payload) => MfgClient.patchWorkCenter(plantId, userId, row.Id, row.RowVersion, payload),
        successText: tr("مرکز کاری ذخیره شد.", "Work center updated."),
      }}
    />
  );
}

export function MesResourcesPanel({ fa, plantId, userId, onChanged }: MesPanelProps) {
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const allowed = canMfgAccess(userId, "mfg.workcenter.edit", plantId);
  const workCenters = useMesRows((offset) => MfgClient.listWorkCenters(plantId, userId, { limit: PAGE, offset }), [plantId, userId]);
  const [wcId, setWcId] = useState<string>("");
  const selectedId = wcId || (workCenters.rows as MfgWorkCenter[])[0]?.Id || "";
  const resources = useMesRows(
    (offset) => (selectedId ? MfgClient.listWorkCenterResources(plantId, userId, selectedId, { limit: PAGE, offset }) : Promise.resolve({ items: [], page: { limit: PAGE, offset: 0, total: 0 } })),
    [plantId, userId, selectedId],
  );
  const rows = resources.rows as MfgWorkCenterResource[];

  const fields: FormFieldDef[] = [
    { name: "NameFa", label: tr("نام منبع", "Resource name"), required: true, maxLength: 200, fullWidth: true },
    { name: "ResourceKind", label: tr("نوع منبع", "Resource kind"), type: "select", required: true, options: opts(RESOURCE_KINDS) },
    { name: "CapacityUnits", label: tr("تعداد ظرفیت", "Capacity units"), type: "number", required: true, min: 0.000001 },
    { name: "AvailabilityPct", label: tr("دسترس‌پذیری %", "Availability %"), type: "number", min: 0, max: 100 },
    { name: "EquipmentId", label: tr("شناسهٔ تجهیز", "Equipment id"), maxLength: 60, ltr: true },
    { name: "EffectiveFrom", label: tr("معتبر از", "Effective from"), type: "date" },
    { name: "EffectiveTo", label: tr("معتبر تا", "Effective to"), type: "date" },
    { name: "IsActive", label: tr("فعال", "Active"), type: "checkbox" },
  ];

  const columns: GridColumnDef<MfgWorkCenterResource>[] = [
    { key: "ResourceCode", header: tr("کد منبع", "Resource code"), ltr: true, mono: true },
    { key: "NameFa", header: tr("نام", "Name") },
    { key: "ResourceKind", header: tr("نوع", "Kind"), filter: "auto" },
    { key: "CapacityUnits", header: tr("ظرفیت", "Capacity"), align: "end", ltr: true },
    { key: "AvailabilityPct", header: tr("دسترس‌پذیری %", "Availability %"), align: "end", ltr: true },
    { key: "IsActive", header: tr("وضعیت", "Status"), accessor: (row) => (row.IsActive ? tr("فعال", "Active") : tr("غیرفعال", "Inactive")), filter: "auto" },
  ];

  return (
    <CrudResource<MfgWorkCenterResource>
      fa={fa}
      caption={tr("منابع مرکز کاری", "Work center resources")}
      rows={rows}
      columns={columns}
      rowKey={(row) => row.Id}
      loading={resources.loading || workCenters.loading}
      error={resources.error ?? workCenters.error}
      onRetry={() => { resources.reload(); workCenters.reload(); }}
      onChanged={() => { resources.reload(); onChanged(); }}
      describeError={describeMesError}
      emptyText={tr("منبعی برای این مرکز کاری ثبت نشده است", "No resource for this work center")}
      toolbarExtra={
        <ParentSelect
          label={tr("مرکز کاری", "Work center")}
          value={selectedId}
          onChange={setWcId}
          options={(workCenters.rows as MfgWorkCenter[]).map((w) => ({ value: w.Id, label: `${w.Code} — ${w.NameFa}` }))}
        />
      }
      create={{
        title: tr("منبع جدید", "New resource"),
        fields: [{ name: "ResourceCode", label: tr("کد منبع", "Resource code"), required: true, maxLength: 60, ltr: true }, ...fields],
        defaults: { ResourceKind: "machine", CapacityUnits: "1", AvailabilityPct: "100", IsActive: "true" },
        allowed: allowed && Boolean(selectedId),
        deniedTitle: "mfg.workcenter.edit",
        submit: (payload) => MfgClient.createWorkCenterResource(plantId, userId, selectedId, payload),
        successText: tr("منبع ثبت شد.", "Resource created."),
      }}
      edit={{
        title: tr("ویرایش منبع", "Edit resource"),
        fields,
        allowed,
        deniedTitle: "mfg.workcenter.edit",
        submit: (row, payload) => MfgClient.patchWorkCenterResource(plantId, userId, row.Id, row.RowVersion, payload),
        successText: tr("منبع ذخیره شد.", "Resource updated."),
      }}
    />
  );
}

/* ═══════════════════════ ۲. سفارش‌های تولید ═══════════════════════ */

export function MesOrdersPanel({ fa, plantId, userId, onChanged }: MesPanelProps) {
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const canCreate = canMfgAccess(userId, "mfg.order.create", plantId);
  const canRelease = canMfgAccess(userId, "mfg.order.release", plantId);
  const canReprioritize = canMfgAccess(userId, "mfg.order.reprioritize", plantId);
  const canClose = canMfgAccess(userId, "mfg.order.close", plantId);
  const orders = useMesRows((offset) => MfgClient.listOrders(plantId, userId, { limit: PAGE, offset }), [plantId, userId]);
  const parts = useMesRows((offset) => MfgClient.listParts(plantId, userId, { limit: PAGE, offset }), [plantId, userId]);
  const boms = useMesRows((offset) => MfgClient.listBomHeaders(plantId, userId, { limit: PAGE, offset }), [plantId, userId]);
  const routings = useMesRows((offset) => MfgClient.listRoutings(plantId, userId, { limit: PAGE, offset }), [plantId, userId]);
  const rows = orders.rows as MfgProductionOrder[];
  const partList = parts.rows as MfgPart[];
  const partOptions = partList.filter((p) => p.IsActive).map((p) => ({ value: p.Id, label: `${p.PartNo} — ${p.NameFa}` }));
  const partLabel = (id: string) => partList.find((p) => p.Id === id)?.PartNo ?? id;
  const releasedBoms = (boms.rows as MfgBomHeader[]).filter((b) => b.Status === "released");
  const releasedRoutings = (routings.rows as MfgRouting[]).filter((r) => r.Status === "released");

  const createFields: FormFieldDef[] = [
    { name: "OrderNo", label: tr("شمارهٔ سفارش", "Order no."), required: true, maxLength: 60, ltr: true },
    { name: "PartId", label: tr("قطعه", "Part"), type: "select", required: true, options: partOptions },
    { name: "OrderQuantity", label: tr("مقدار سفارش", "Order quantity"), type: "number", required: true, min: 0.000001 },
    { name: "Uom", label: tr("واحد", "UoM"), required: true, maxLength: 16, ltr: true },
    { name: "DueAt", label: tr("موعد تحویل", "Due at"), type: "datetime", required: true },
    { name: "RequestedStartAt", label: tr("شروع درخواستی", "Requested start"), type: "datetime" },
    { name: "PriorityRule", label: tr("قاعدهٔ اولویت", "Priority rule"), type: "select", required: true, options: opts(PRIORITY_RULES) },
    {
      name: "ManualRank", label: tr("رتبهٔ دستی", "Manual rank"), type: "number", integer: true, min: 0, required: true,
      visibleWhen: (v) => v.PriorityRule === "MANUAL",
    },
    { name: "DispatchWeight", label: tr("وزن اولویت", "Dispatch weight"), type: "number", min: 0 },
    { name: "DemandSource", label: tr("منبع تقاضا", "Demand source"), type: "select", required: true, options: opts(DEMAND_SOURCES) },
    {
      name: "DemandRef", label: tr("ارجاع تقاضا", "Demand ref."), maxLength: 80, ltr: true, required: true,
      visibleWhen: (v) => v.DemandSource !== "manual",
    },
    {
      name: "ContractId", label: tr("شناسهٔ قرارداد", "Contract id"), maxLength: 60, ltr: true, required: true,
      visibleWhen: (v) => v.DemandSource === "contract",
    },
    { name: "CustomerRef", label: tr("ارجاع مشتری", "Customer ref."), maxLength: 80, ltr: true },
    { name: "NoteFa", label: tr("یادداشت", "Note"), type: "textarea", maxLength: 1000, fullWidth: true },
  ];

  const columns: GridColumnDef<MfgProductionOrder>[] = [
    { key: "OrderNo", header: tr("شمارهٔ سفارش", "Order no."), ltr: true, mono: true },
    { key: "PartId", header: tr("قطعه", "Part"), accessor: (row) => partLabel(row.PartId), ltr: true, mono: true },
    { key: "OrderQuantity", header: tr("مقدار", "Qty"), align: "end", ltr: true },
    { key: "Status", header: tr("وضعیت", "Status"), filter: "auto" },
    { key: "PriorityRule", header: tr("اولویت", "Priority"), filter: "auto" },
    { key: "DueAt", header: tr("موعد", "Due"), accessor: (row) => shortDateTime(row.DueAt), ltr: true },
    { key: "DemandSource", header: tr("منبع تقاضا", "Demand source"), filter: "auto" },
  ];

  const reload = () => { orders.reload(); onChanged(); };

  return (
    <CrudResource<MfgProductionOrder>
      fa={fa}
      caption={tr("سفارش‌های تولید", "Production orders")}
      rows={rows}
      columns={columns}
      rowKey={(row) => row.Id}
      loading={orders.loading || parts.loading}
      error={orders.error ?? parts.error}
      onRetry={() => { orders.reload(); parts.reload(); }}
      onChanged={reload}
      describeError={describeMesError}
      emptyText={tr("سفارشی ثبت نشده است", "No order yet")}
      create={{
        title: tr("سفارش تولید جدید", "New production order"),
        fields: createFields,
        defaults: { Uom: "ea", PriorityRule: "EDD", DispatchWeight: "1", DemandSource: "manual" },
        allowed: canCreate,
        deniedTitle: "mfg.order.create",
        submit: (payload) => MfgClient.createOrder(plantId, userId, payload),
        successText: tr("سفارش تولید ایجاد شد.", "Production order created."),
      }}
      actions={(row) => [
        {
          key: "release",
          label: tr("آزادسازی", "Release"),
          tone: "primary",
          hidden: () => row.Status !== "created",
          disabled: () => !canRelease,
          title: canRelease ? undefined : "mfg.order.release",
          form: () => {
            const boms = releasedBoms.filter((b) => b.PartId === row.PartId);
            const routes = releasedRoutings.filter((r) => r.PartId === row.PartId);
            return {
              title: tr("آزادسازی سفارش", "Release order"),
              submitLabel: tr("آزادسازی", "Release"),
              fields: [
                { name: "BomHeaderId", label: tr("BOM آزادشده", "Released BOM"), type: "select", required: true, options: boms.map((b) => ({ value: b.Id, label: `${b.Revision} (${b.BaseQuantity} ${b.BaseUom})` })) },
                { name: "RoutingId", label: tr("مسیر آزادشده", "Released routing"), type: "select", required: true, options: routes.map((r) => ({ value: r.Id, label: `${r.RoutingCode} · ${r.Revision}` })) },
              ],
              initialValues: () => ({ BomHeaderId: boms[0]?.Id ?? "", RoutingId: routes[0]?.Id ?? "" }),
            };
          },
          run: (_row, input) =>
            MfgClient.releaseOrder(plantId, userId, row.Id, row.RowVersion, {
              BomHeaderId: String(input.BomHeaderId ?? ""),
              RoutingId: String(input.RoutingId ?? ""),
            }),
          successText: tr("سفارش آزاد شد.", "Order released."),
        } satisfies ResourceAction<MfgProductionOrder>,
        {
          key: "priority",
          label: tr("تغییر اولویت", "Re-prioritize"),
          tone: "neutral",
          hidden: () => row.Status === "closed",
          disabled: () => !canReprioritize,
          title: canReprioritize ? undefined : "mfg.order.reprioritize",
          form: () => ({
            title: tr("تغییر اولویت سفارش", "Re-prioritize order"),
            fields: [
              { name: "PriorityRule", label: tr("قاعدهٔ اولویت", "Priority rule"), type: "select", required: true, options: opts(PRIORITY_RULES) },
              { name: "ManualRank", label: tr("رتبهٔ دستی", "Manual rank"), type: "number", integer: true, min: 0, required: true, visibleWhen: (v) => v.PriorityRule === "MANUAL" },
              { name: "DispatchWeight", label: tr("وزن اولویت", "Dispatch weight"), type: "number", min: 0 },
            ],
            initialValues: () => ({ PriorityRule: row.PriorityRule, ManualRank: row.ManualRank === null || row.ManualRank === undefined ? "" : String(row.ManualRank), DispatchWeight: String(row.DispatchWeight) }),
          }),
          run: (_row, input) =>
            MfgClient.reprioritizeOrder(plantId, userId, row.Id, row.RowVersion, {
              PriorityRule: input.PriorityRule as "EDD" | "CR" | "MANUAL",
              ...(input.ManualRank !== undefined && input.ManualRank !== "" ? { ManualRank: Number(input.ManualRank) } : { ManualRank: null }),
              ...(input.DispatchWeight !== undefined && input.DispatchWeight !== "" ? { DispatchWeight: Number(input.DispatchWeight) } : {}),
            }),
          successText: tr("اولویت به‌روز شد.", "Priority updated."),
        } satisfies ResourceAction<MfgProductionOrder>,
        {
          key: "close",
          label: tr("بستن نهایی", "Close"),
          tone: "danger",
          hidden: () => !["in-progress", "completed"].includes(row.Status),
          disabled: () => !canClose,
          title: canClose ? undefined : "mfg.order.close",
          confirm: {
            title: tr("بستن نهایی سفارش", "Close order"),
            message: tr("پس از بستن، سفارش دیگر تغییر نمی‌کند.", "Once closed, the order can no longer change."),
            confirmLabel: tr("بستن", "Close"),
            danger: true,
            reason: { label: tr("دلیل بستن (اختیاری)", "Close reason (optional)"), required: false },
          },
          run: (_row, input) =>
            MfgClient.closeOrder(plantId, userId, row.Id, row.RowVersion, {
              ...(input.reason ? { CloseReason: String(input.reason) } : {}),
            }),
          successText: tr("سفارش بسته شد.", "Order closed."),
        } satisfies ResourceAction<MfgProductionOrder>,
      ]}
    />
  );
}

/* ═══════════════════════ ۳. برنامه‌ریزی پیشرفته ═══════════════════════ */

export function MesDemandPanel({ fa, plantId, userId, onChanged }: MesPanelProps) {
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const allowed = canMfgAccess(userId, "mfg.demand.edit", plantId);
  const deniedText = tr("نقش فعال مجوز ویرایش تقاضا ندارد", "The active role cannot edit demand");
  const list = useMesRows((offset) => MfgClient.listDemandForecasts(plantId, userId, { limit: PAGE, offset }), [plantId, userId]);
  const parts = useMesRows((offset) => MfgClient.listParts(plantId, userId, { limit: PAGE, offset }), [plantId, userId]);
  const rows = list.rows as MfgDemandForecast[];
  const partList = parts.rows as MfgPart[];
  const partOptions = partList.map((p) => ({ value: p.Id, label: `${p.PartNo} — ${p.NameFa}` }));
  const partLabel = (id: string) => {
    const part = partList.find((p) => p.Id === id);
    return part ? `${part.PartNo} — ${part.NameFa}` : id;
  };
  const typeLabel = (code: string) => {
    const label = DEMAND_TYPE_LABELS[code];
    return label ? (fa ? label.fa : label.en) : code;
  };
  const statusLabel = (code: string) => {
    const label = DEMAND_STATUS_LABELS[code];
    return label ? (fa ? label.fa : label.en) : code;
  };
  const typeOptions = DEMAND_TYPES.map((value) => ({ value, label: typeLabel(value) }));
  const statusOptions = DEMAND_STATUSES.map((value) => ({ value, label: statusLabel(value) }));

  const fields: FormFieldDef[] = [
    { name: "RequiredAt", label: tr("تاریخ نیاز", "Required on"), type: "date", required: true },
    { name: "Quantity", label: tr("مقدار", "Quantity"), type: "number", required: true, min: 0.000001 },
    {
      name: "Uom",
      label: tr("واحد", "UoM"),
      maxLength: 16,
      ltr: true,
      hint: tr("خالی بماند، واحد پایهٔ قطعه استفاده می‌شود", "Leave blank to use the part's base unit"),
    },
    {
      name: "ConfidencePct",
      label: tr("درصد اطمینان", "Confidence %"),
      type: "number",
      min: 0,
      max: 100,
      hint: tr("برای ردیف «پیش‌بینی فروش» الزامی است", "Required for a sales-forecast row"),
    },
    { name: "CustomerRef", label: tr("ارجاع مشتری", "Customer ref."), maxLength: 80, ltr: true },
    { name: "CustomerNameSnapshot", label: tr("نام مشتری", "Customer name"), maxLength: 240 },
    { name: "NoteFa", label: tr("یادداشت", "Note"), type: "textarea", maxLength: 800, fullWidth: true },
  ];

  const columns: GridColumnDef<MfgDemandForecast>[] = [
    { key: "DemandRef", header: tr("ارجاع تقاضا", "Demand reference"), ltr: true, mono: true },
    { key: "PartId", header: tr("قطعه", "Part"), accessor: (row) => partLabel(row.PartId) },
    {
      key: "DemandType",
      header: tr("نوع تقاضا", "Demand type"),
      accessor: (row) => row.DemandType,
      render: (row) => typeLabel(row.DemandType),
      filter: typeOptions.map((option) => ({ value: option.value, label: option.label })),
    },
    { key: "RequiredAt", header: tr("تاریخ نیاز", "Required on"), accessor: (row) => shortDate(row.RequiredAt), ltr: true },
    {
      key: "Quantity",
      header: tr("مقدار", "Quantity"),
      accessor: (row) => row.Quantity,
      render: (row) => `${row.Quantity.toLocaleString()} ${row.Uom}`,
      align: "end",
      ltr: true,
    },
    {
      key: "ConsumedQuantity",
      header: tr("مصرف‌شده", "Consumed"),
      accessor: (row) => row.ConsumedQuantity ?? 0,
      render: (row) => {
        const consumed = row.ConsumedQuantity ?? 0;
        const pct = row.Quantity > 0 ? Math.round((consumed / row.Quantity) * 100) : 0;
        return `${consumed.toLocaleString()} (${pct}${fa ? "٪" : "%"})`;
      },
      align: "end",
      ltr: true,
    },
    {
      key: "RemainingQuantity",
      header: tr("باقی‌مانده", "Remaining"),
      accessor: (row) => Math.max(0, (row.Quantity ?? 0) - (row.ConsumedQuantity ?? 0)),
      align: "end",
      ltr: true,
    },
    {
      key: "Status",
      header: tr("وضعیت", "Status"),
      accessor: (row) => row.Status,
      render: (row) => statusLabel(row.Status),
      filter: statusOptions.map((option) => ({ value: option.value, label: option.label })),
    },
  ];

  return (
    <CrudResource<MfgDemandForecast>
      fa={fa}
      caption={tr("تقاضا و پیش‌بینی", "Demand & forecast")}
      rows={rows}
      columns={columns}
      rowKey={(row) => row.Id}
      loading={list.loading || parts.loading}
      error={list.error ?? parts.error}
      onRetry={() => { list.reload(); parts.reload(); }}
      onChanged={() => { list.reload(); onChanged(); }}
      describeError={describeMesError}
      emptyText={tr("تقاضایی ثبت نشده است؛ با «ثبت جدید» اولین ردیف را بسازید", "No demand recorded yet; create the first row with New")}
      defaultSort={{ key: "RequiredAt", dir: "asc" }}
      viewFields={[
        { name: "DemandRef", label: tr("ارجاع تقاضا", "Demand reference"), ltr: true },
        { name: "PartId", label: tr("قطعه", "Part"), type: "select", options: partOptions },
        { name: "DemandType", label: tr("نوع تقاضا", "Demand type"), type: "select", options: typeOptions },
        ...fields,
        { name: "Status", label: tr("وضعیت", "Status"), type: "select", options: statusOptions },
        { name: "ConsumedQuantity", label: tr("مقدار مصرف‌شده", "Consumed quantity"), type: "number" },
      ]}
      create={{
        title: tr("تقاضای جدید", "New demand"),
        fields: [
          { name: "PartId", label: tr("قطعه", "Part"), type: "select", required: true, options: partOptions },
          { name: "DemandType", label: tr("نوع تقاضا", "Demand type"), type: "select", required: true, options: typeOptions },
          { name: "DemandRef", label: tr("ارجاع تقاضا", "Demand ref."), required: true, maxLength: 60, ltr: true },
          ...fields,
        ],
        defaults: { DemandType: "forecast" },
        allowed,
        deniedTitle: deniedText,
        submit: (payload) => {
          // سرور پیش‌بینی بدون درصد اطمینان را رد می‌کند؛ همان‌جا در فرم به کاربر بگو، نه بعد از خطای سرور.
          if (payload.DemandType === "forecast" && (payload.ConfidencePct === null || payload.ConfidencePct === undefined)) {
            throw new Error(tr("برای ردیف «پیش‌بینی فروش»، درصد اطمینان الزامی است", "Confidence % is required for a sales-forecast row"));
          }
          return MfgClient.createDemandForecast(plantId, userId, asBody(payload));
        },
        successText: tr("تقاضا ثبت شد.", "Demand created."),
      }}
      edit={{
        title: tr("ویرایش تقاضا", "Edit demand"),
        fields: [...fields, { name: "Status", label: tr("وضعیت", "Status"), type: "select", required: true, options: statusOptions }],
        allowed,
        deniedTitle: deniedText,
        submit: (row, payload) => MfgClient.patchDemandForecast(plantId, userId, row.Id, row.RowVersion, asBody(payload)),
        successText: tr("تقاضا ذخیره شد.", "Demand updated."),
      }}
      actions={(row) => [
        statusAction<MfgDemandForecast>(
          "cancel",
          tr("لغو", "Cancel"),
          "warn",
          (r) => MfgClient.patchDemandForecast(plantId, userId, r.Id, r.RowVersion, { Status: "cancelled" }),
          tr("تقاضا لغو شد.", "Demand cancelled."),
          tr("ردیف لغوشده در سابقه می‌ماند.", "The cancelled row stays in history."),
          {
            hidden: () => row.Status === "cancelled" || (row.ConsumedQuantity ?? 0) > 0,
            disabled: () => !allowed,
            title: allowed ? undefined : deniedText,
          },
        ),
        statusAction<MfgDemandForecast>(
          "delete",
          tr("حذف", "Delete"),
          "danger",
          (r) => MfgClient.deleteDemandForecast(plantId, userId, r.Id),
          tr("تقاضا حذف شد.", "Demand deleted."),
          tr("فقط پیش‌نویس مصرف‌نشده قابل حذف است.", "Only an unused draft can be deleted."),
          {
            hidden: () => !(row.Status === "draft" && !row.MpsRunId),
            disabled: () => !allowed,
            title: allowed ? undefined : deniedText,
          },
        ),
      ]}
    />
  );
}

export function MesLotSizingPanel({ fa, plantId, userId, onChanged }: MesPanelProps) {
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const allowed = canMfgAccess(userId, "mfg.lotsize.edit", plantId);
  const list = useMesRows((offset) => MfgClient.listLotSizingPolicies(plantId, userId, { limit: PAGE, offset }), [plantId, userId]);
  const parts = useMesRows((offset) => MfgClient.listParts(plantId, userId, { limit: PAGE, offset }), [plantId, userId]);
  const rows = list.rows as MfgLotSizingPolicy[];
  const partList = parts.rows as MfgPart[];
  const partOptions = partList.map((p) => ({ value: p.Id, label: `${p.PartNo} — ${p.NameFa}` }));
  const partLabel = (id: string) => partList.find((p) => p.Id === id)?.PartNo ?? id;

  const fields: FormFieldDef[] = [
    { name: "RuleCode", label: tr("قاعدهٔ لات", "Lot rule"), type: "select", required: true, options: opts(LOT_RULES) },
    { name: "FixedLotQty", label: tr("اندازهٔ لات ثابت (FOQ)", "Fixed lot qty (FOQ)"), type: "number", min: 0 },
    { name: "OrderMultiple", label: tr("مضرب سفارش", "Order multiple"), type: "number", min: 0 },
    { name: "MinOrderQty", label: tr("حداقل سفارش", "Min order qty"), type: "number", min: 0 },
    { name: "MaxOrderQty", label: tr("حداکثر سفارش", "Max order qty"), type: "number", min: 0 },
    { name: "OrderingCost", label: tr("هزینهٔ سفارش‌دهی (EOQ)", "Ordering cost (EOQ)"), type: "number", min: 0 },
    { name: "HoldingCostPerUnitPerYear", label: tr("هزینهٔ نگهداری سالانه/واحد", "Holding cost / unit / yr"), type: "number", min: 0 },
    { name: "AnnualDemandQty", label: tr("تقاضای سالانه", "Annual demand"), type: "number", min: 0 },
    { name: "PeriodDays", label: tr("طول دوره (روز، POQ)", "Period (days, POQ)"), type: "number", integer: true, min: 1 },
    { name: "EffectiveFrom", label: tr("معتبر از", "Effective from"), type: "date", required: true },
    { name: "EffectiveTo", label: tr("معتبر تا", "Effective to"), type: "date" },
    { name: "NoteFa", label: tr("یادداشت", "Note"), type: "textarea", maxLength: 1000, fullWidth: true },
  ];

  const columns: GridColumnDef<MfgLotSizingPolicy>[] = [
    { key: "PartId", header: tr("قطعه", "Part"), accessor: (row) => partLabel(row.PartId), ltr: true, mono: true },
    { key: "RuleCode", header: tr("قاعده", "Rule"), filter: "auto", align: "center" },
    { key: "OrderMultiple", header: tr("مضرب", "Multiple"), align: "end", ltr: true },
    { key: "MinOrderQty", header: tr("حداقل", "Min"), align: "end", ltr: true },
    { key: "eoq", header: tr("EOQ", "EOQ"), accessor: (row) => row.eoq ?? "—", align: "end", ltr: true },
    { key: "EffectiveFrom", header: tr("معتبر از", "From"), accessor: (row) => shortDate(row.EffectiveFrom), ltr: true },
    { key: "IsActive", header: tr("وضعیت", "Status"), accessor: (row) => (row.IsActive ? tr("فعال", "Active") : tr("غیرفعال", "Inactive")), filter: "auto" },
  ];

  return (
    <CrudResource<MfgLotSizingPolicy>
      fa={fa}
      caption={tr("سیاست‌های لات‌سایزینگ", "Lot-sizing policies")}
      rows={rows}
      columns={columns}
      rowKey={(row) => row.Id}
      loading={list.loading || parts.loading}
      error={list.error ?? parts.error}
      onRetry={() => { list.reload(); parts.reload(); }}
      onChanged={() => { list.reload(); onChanged(); }}
      describeError={describeMesError}
      emptyText={tr("سیاستی ثبت نشده است", "No policy registered")}
      create={{
        title: tr("سیاست لات جدید", "New lot-sizing policy"),
        fields: [{ name: "PartId", label: tr("قطعه", "Part"), type: "select", required: true, options: partOptions }, ...fields],
        defaults: { RuleCode: "L4L", EffectiveFrom: new Date().toISOString().slice(0, 10) },
        allowed,
        deniedTitle: "mfg.lotsize.edit",
        submit: (payload) => MfgClient.createLotSizingPolicy(plantId, userId, asBody(payload)),
        successText: tr("سیاست ثبت شد.", "Policy created."),
      }}
      edit={{
        title: tr("ویرایش سیاست لات", "Edit lot-sizing policy"),
        fields: [...fields, { name: "IsActive", label: tr("فعال", "Active"), type: "checkbox" }],
        allowed,
        deniedTitle: "mfg.lotsize.edit",
        submit: (row, payload) => MfgClient.patchLotSizingPolicy(plantId, userId, row.Id, row.RowVersion, asBody(payload)),
        successText: tr("سیاست ذخیره شد.", "Policy updated."),
      }}
    />
  );
}

export function MesProductionVersionsPanel({ fa, plantId, userId, onChanged }: MesPanelProps) {
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const allowed = canMfgAccess(userId, "mfg.version.edit", plantId);
  const list = useMesRows((offset) => MfgClient.listProductionVersions(plantId, userId, { limit: PAGE, offset }), [plantId, userId]);
  const parts = useMesRows((offset) => MfgClient.listParts(plantId, userId, { limit: PAGE, offset }), [plantId, userId]);
  const workCenters = useMesRows((offset) => MfgClient.listWorkCenters(plantId, userId, { limit: PAGE, offset }), [plantId, userId]);
  const rows = list.rows as MfgProductionVersion[];
  const partList = parts.rows as MfgPart[];
  const partOptions = partList.map((p) => ({ value: p.Id, label: `${p.PartNo} — ${p.NameFa}` }));
  const partLabel = (id: string) => partList.find((p) => p.Id === id)?.PartNo ?? id;
  const wcOptions = [{ value: "", label: tr("عمومی (همهٔ خطوط)", "General (all lines)") }, ...(workCenters.rows as MfgWorkCenter[]).map((w) => ({ value: w.Id, label: `${w.Code} — ${w.NameFa}` }))];

  const fields: FormFieldDef[] = [
    { name: "VersionCode", label: tr("کد نسخه", "Version code"), required: true, maxLength: 60, ltr: true },
    { name: "BomRevision", label: tr("نسخهٔ BOM", "BOM revision"), required: true, maxLength: 60, ltr: true },
    { name: "RoutingRevision", label: tr("نسخهٔ مسیر", "Routing revision"), required: true, maxLength: 60, ltr: true },
    { name: "WorkCenterId", label: tr("خط تولید", "Production line"), type: "select", options: wcOptions },
    { name: "Priority", label: tr("اولویت", "Priority"), type: "number", integer: true, min: 1 },
    { name: "EffectiveFrom", label: tr("معتبر از", "Effective from"), type: "date" },
    { name: "EffectiveTo", label: tr("معتبر تا", "Effective to"), type: "date" },
    { name: "IsDefault", label: tr("پیش‌فرض", "Default"), type: "checkbox" },
    { name: "NoteFa", label: tr("یادداشت", "Note"), type: "textarea", maxLength: 1000, fullWidth: true },
  ];

  const columns: GridColumnDef<MfgProductionVersion>[] = [
    { key: "VersionCode", header: tr("کد نسخه", "Version"), ltr: true, mono: true },
    { key: "PartId", header: tr("قطعه", "Part"), accessor: (row) => partLabel(row.PartId), ltr: true, mono: true },
    { key: "BomRevision", header: tr("BOM", "BOM"), ltr: true, align: "center" },
    { key: "RoutingRevision", header: tr("مسیر", "Routing"), ltr: true, align: "center" },
    { key: "Priority", header: tr("اولویت", "Priority"), align: "center", ltr: true },
    { key: "IsDefault", header: tr("پیش‌فرض", "Default"), accessor: (row) => yesNo(fa, row.IsDefault), filter: "auto" },
    { key: "IsActive", header: tr("وضعیت", "Status"), accessor: (row) => (row.IsActive ? tr("فعال", "Active") : tr("غیرفعال", "Inactive")), filter: "auto" },
  ];

  return (
    <CrudResource<MfgProductionVersion>
      fa={fa}
      caption={tr("نسخه‌های تولید", "Production versions")}
      rows={rows}
      columns={columns}
      rowKey={(row) => row.Id}
      loading={list.loading || parts.loading}
      error={list.error ?? parts.error}
      onRetry={() => { list.reload(); parts.reload(); }}
      onChanged={() => { list.reload(); onChanged(); }}
      describeError={describeMesError}
      emptyText={tr("نسخه‌ای ثبت نشده است", "No version registered")}
      create={{
        title: tr("نسخهٔ تولید جدید", "New production version"),
        fields: [{ name: "PartId", label: tr("قطعه", "Part"), type: "select", required: true, options: partOptions }, ...fields],
        defaults: { BomRevision: "A", RoutingRevision: "A", Priority: "1", IsDefault: "false" },
        allowed,
        deniedTitle: "mfg.version.edit",
        submit: (payload) => MfgClient.createProductionVersion(plantId, userId, asBody(payload)),
        successText: tr("نسخه ثبت شد.", "Version created."),
      }}
      edit={{
        title: tr("ویرایش نسخهٔ تولید", "Edit production version"),
        fields: [...fields, { name: "IsActive", label: tr("فعال", "Active"), type: "checkbox" }],
        allowed,
        deniedTitle: "mfg.version.edit",
        submit: (row, payload) => MfgClient.patchProductionVersion(plantId, userId, row.Id, row.RowVersion, asBody(payload)),
        successText: tr("نسخه ذخیره شد.", "Version updated."),
      }}
    />
  );
}

export function MesPlannedOrdersPanel({ fa, plantId, userId, onChanged }: MesPanelProps) {
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const canEdit = canMfgAccess(userId, "mfg.plannedorder.edit", plantId);
  const canApprove = canMfgAccess(userId, "mfg.plannedorder.approve", plantId);
  const canConvert = canMfgAccess(userId, "mfg.plannedorder.convert", plantId);
  const list = useMesRows((offset) => MfgClient.listPlannedOrders(plantId, userId, { limit: PAGE, offset }), [plantId, userId]);
  const parts = useMesRows((offset) => MfgClient.listParts(plantId, userId, { limit: PAGE, offset }), [plantId, userId]);
  const rows = list.rows as MfgPlannedOrder[];
  const partList = parts.rows as MfgPart[];
  const partLabel = (id: string) => partList.find((p) => p.Id === id)?.PartNo ?? id;

  const fields: FormFieldDef[] = [
    { name: "Quantity", label: tr("مقدار", "Quantity"), type: "number", required: true, min: 0.000001 },
    { name: "PlannedReleaseAt", label: tr("زمان شروع برنامه", "Planned release"), type: "datetime", required: true },
    { name: "PlannedDueAt", label: tr("زمان پایان برنامه", "Planned due"), type: "datetime", required: true },
    { name: "NoteFa", label: tr("یادداشت", "Note"), type: "textarea", maxLength: 1000, fullWidth: true },
  ];

  const columns: GridColumnDef<MfgPlannedOrder>[] = [
    { key: "PlannedOrderNo", header: tr("شماره", "No."), ltr: true, mono: true },
    { key: "PartId", header: tr("قطعه", "Part"), accessor: (row) => partLabel(row.PartId), ltr: true, mono: true },
    { key: "Source", header: tr("منبع", "Source"), filter: "auto" },
    { key: "Quantity", header: tr("مقدار", "Qty"), align: "end", ltr: true },
    { key: "LotSizingRule", header: tr("قاعدهٔ لات", "Lot rule"), filter: "auto", align: "center" },
    { key: "PlannedDueAt", header: tr("موعد", "Due"), accessor: (row) => shortDateTime(row.PlannedDueAt), ltr: true },
    { key: "Status", header: tr("وضعیت", "Status"), filter: "auto" },
  ];

  const editable = (row: MfgPlannedOrder) => !["converted", "cancelled"].includes(row.Status);

  return (
    <CrudResource<MfgPlannedOrder>
      fa={fa}
      caption={tr("سفارش‌های برنامه‌ریزی‌شده", "Planned orders")}
      rows={rows}
      columns={columns}
      rowKey={(row) => row.Id}
      loading={list.loading || parts.loading}
      error={list.error ?? parts.error}
      onRetry={() => { list.reload(); parts.reload(); }}
      onChanged={() => { list.reload(); onChanged(); }}
      describeError={describeMesError}
      emptyText={tr("سفارش برنامه‌ریزی‌شده‌ای وجود ندارد", "No planned order")}
      viewFields={fields}
      edit={{
        title: tr("ویرایش سفارش برنامه‌ریزی‌شده", "Edit planned order"),
        fields,
        allowed: canEdit,
        deniedTitle: "mfg.plannedorder.edit",
        locked: (row) => !editable(row),
        lockedTitle: tr("این ردیف تبدیل یا لغو شده است", "This row is converted or cancelled"),
        submit: (row, payload) => MfgClient.patchPlannedOrder(plantId, userId, row.Id, row.RowVersion, payload),
        successText: tr("سفارش برنامه‌ریزی‌شده ذخیره شد.", "Planned order updated."),
      }}
      actions={(row) => [
        {
          key: "approve",
          label: tr("تأیید", "Approve"),
          tone: "ok",
          hidden: () => row.Status !== "proposed",
          disabled: () => !canApprove,
          title: canApprove ? undefined : "mfg.plannedorder.approve",
          form: () => ({
            title: tr("تأیید سفارش برنامه‌ریزی‌شده", "Approve planned order"),
            fields: [{ name: "NoteFa", label: tr("یادداشت (اختیاری)", "Note (optional)"), type: "textarea", maxLength: 1000, fullWidth: true }],
          }),
          run: (_row, input) => MfgClient.approvePlannedOrder(plantId, userId, row.Id, row.RowVersion, { NoteFa: input.NoteFa ? String(input.NoteFa) : null }),
          successText: tr("تأیید شد.", "Approved."),
        } satisfies ResourceAction<MfgPlannedOrder>,
        {
          key: "reject",
          label: tr("رد", "Reject"),
          tone: "danger",
          hidden: () => row.Status !== "proposed",
          disabled: () => !canApprove,
          title: canApprove ? undefined : "mfg.plannedorder.approve",
          form: () => ({
            title: tr("رد سفارش برنامه‌ریزی‌شده", "Reject planned order"),
            fields: [{ name: "RejectReasonFa", label: tr("دلیل رد", "Reject reason"), type: "textarea", required: true, maxLength: 500, fullWidth: true }],
          }),
          run: (_row, input) => MfgClient.rejectPlannedOrder(plantId, userId, row.Id, row.RowVersion, { RejectReasonFa: String(input.RejectReasonFa ?? "") }),
          successText: tr("رد شد.", "Rejected."),
        } satisfies ResourceAction<MfgPlannedOrder>,
        {
          key: "convert",
          label: tr("تبدیل به سفارش تولید", "Convert to order"),
          tone: "primary",
          hidden: () => row.Status !== "approved",
          disabled: () => !canConvert,
          title: canConvert ? undefined : "mfg.plannedorder.convert",
          form: () => ({
            title: tr("تبدیل به سفارش تولید", "Convert to production order"),
            fields: [
              { name: "OrderNo", label: tr("شمارهٔ سفارش (اختیاری)", "Order no. (optional)"), maxLength: 60, ltr: true },
              { name: "PriorityRule", label: tr("قاعدهٔ اولویت", "Priority rule"), type: "select", options: opts(PRIORITY_RULES) },
              { name: "NoteFa", label: tr("یادداشت", "Note"), type: "textarea", maxLength: 1000, fullWidth: true },
            ],
            initialValues: () => ({ PriorityRule: "EDD" }),
          }),
          run: (_row, input) =>
            MfgClient.convertPlannedOrder(plantId, userId, row.Id, row.RowVersion, {
              ...(input.OrderNo ? { OrderNo: String(input.OrderNo) } : {}),
              ...(input.PriorityRule ? { PriorityRule: input.PriorityRule as "EDD" | "CR" | "MANUAL" } : {}),
              ...(input.NoteFa ? { NoteFa: String(input.NoteFa) } : {}),
            }),
          successText: tr("سفارش تولید ایجاد شد.", "Production order created."),
        } satisfies ResourceAction<MfgPlannedOrder>,
      ]}
    />
  );
}

/* ═══════════════════════ ۴. اجرای کارگاهی: هشدارها ═══════════════════════ */

export function MesAlertsPanel({ fa, plantId, userId, onChanged }: MesPanelProps) {
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const canAck = canMfgAccess(userId, "mfg.alert.ack", plantId);
  const list = useMesRows((offset) => MfgClient.listAlerts(plantId, userId, { limit: PAGE, offset }), [plantId, userId]);
  const rows = list.rows as MfgProductionAlert[];

  const columns: GridColumnDef<MfgProductionAlert>[] = [
    { key: "Severity", header: tr("شدت", "Severity"), filter: "auto", align: "center" },
    { key: "TitleFa", header: tr("عنوان", "Title") },
    { key: "OrderNo", header: tr("سفارش", "Order"), ltr: true, mono: true, accessor: (row) => row.OrderNo ?? "—" },
    { key: "WorkCenterCode", header: tr("مرکز کاری", "Work center"), ltr: true, accessor: (row) => row.WorkCenterCode ?? "—", filter: "auto" },
    { key: "OccurrenceCount", header: tr("تکرار", "Count"), align: "end", ltr: true },
    { key: "LastRaisedAt", header: tr("آخرین رخداد", "Last raised"), accessor: (row) => shortDateTime(row.LastRaisedAt), ltr: true },
    { key: "Status", header: tr("وضعیت", "Status"), filter: "auto" },
  ];

  return (
    <CrudResource<MfgProductionAlert>
      fa={fa}
      caption={tr("هشدارهای تولید", "Production alerts")}
      rows={rows}
      columns={columns}
      rowKey={(row) => row.Id}
      loading={list.loading}
      error={list.error}
      onRetry={list.reload}
      onChanged={() => { list.reload(); onChanged(); }}
      describeError={describeMesError}
      emptyText={tr("هشدار فعالی وجود ندارد", "No active alert")}
      actions={(row) => [
        {
          key: "ack",
          label: tr("تأیید دریافت", "Acknowledge"),
          tone: "primary",
          hidden: () => row.Status !== "open",
          disabled: () => !canAck,
          title: canAck ? undefined : "mfg.alert.ack",
          form: () => ({
            title: tr("تأیید دریافت هشدار", "Acknowledge alert"),
            fields: [{ name: "NoteFa", label: tr("یادداشت (اختیاری)", "Note (optional)"), type: "textarea", maxLength: 1000, fullWidth: true }],
          }),
          run: (_row, input) => MfgClient.acknowledgeAlert(plantId, userId, row.Id, row.RowVersion, { NoteFa: input.NoteFa ? String(input.NoteFa) : null }),
          successText: tr("هشدار تأیید شد.", "Alert acknowledged."),
        } satisfies ResourceAction<MfgProductionAlert>,
      ]}
    />
  );
}

/* ═══════════════════════ ۵. مواد و MRP (فقط خواندنی) ═══════════════════════ */

export function MesMaterialsPanel({ fa, plantId, userId }: Omit<MesPanelProps, "onChanged">) {
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const list = useMesRows((offset) => MfgClient.listMaterials(plantId, userId, { limit: PAGE, offset }), [plantId, userId]);
  const rows = list.rows as MfgMaterial[];

  const columns: GridColumnDef<MfgMaterial>[] = [
    { key: "PartNo", header: tr("شمارهٔ قطعه", "Part no."), ltr: true, mono: true, accessor: (row) => row.PartNo ?? "—" },
    { key: "PartNameFa", header: tr("نام", "Name"), accessor: (row) => row.PartNameFa ?? "—" },
    { key: "ProcurementType", header: tr("تأمین", "Procurement"), filter: "auto" },
    { key: "LeadTimeDays", header: tr("زمان تحویل (روز)", "Lead time (days)"), align: "end", ltr: true },
    { key: "SafetyStockQty", header: tr("موجودی اطمینان", "Safety stock"), align: "end", ltr: true },
    { key: "LotSize", header: tr("اندازهٔ لات", "Lot size"), align: "end", ltr: true },
    { key: "OrderMultiple", header: tr("مضرب", "Multiple"), align: "end", ltr: true },
    { key: "DefaultWarehouseCode", header: tr("انبار پیش‌فرض", "Default warehouse"), ltr: true, accessor: (row) => row.DefaultWarehouseCode ?? "—" },
  ];

  return (
    <CrudResource<MfgMaterial>
      fa={fa}
      caption={tr("مواد و تنظیمات MRP", "Materials & MRP settings")}
      rows={rows}
      columns={columns}
      rowKey={(row) => row.Id}
      loading={list.loading}
      error={list.error}
      onRetry={list.reload}
      onChanged={list.reload}
      describeError={describeMesError}
      emptyText={tr("ماده‌ای تعریف نشده است", "No material defined")}
    />
  );
}

/* ═══════════════════════ بخش‌های تب‌ها ═══════════════════════ */

export interface MesSectionProps {
  fa: boolean;
  plantId: string;
  userId: string;
  onChanged: () => void;
}

export type MesEngineeringSectionId = "industry" | "parts" | "bom" | "routings" | "workcenters";

export function MesEngineeringCrudSection(props: MesSectionProps & { section?: MesEngineeringSectionId }) {
  const t = (faText: string, enText: string) => (props.fa ? faText : enText);
  /* بدون `section` همهٔ بخش‌ها (رفتار قبلی)؛ با آن فقط همان زیرتب فعال
   * رندر می‌شود تا صفحهٔ مهندسی ساخت اسکرول طولانی نداشته باشد. */
  const show = (id: MesEngineeringSectionId) => !props.section || props.section === id;
  return (
    <div className="space-y-3">
      {show("industry") && <MesIndustrySettingsPanel fa={props.fa} plantId={props.plantId} userId={props.userId} />}
      {show("parts") && (
        <Section title={t("قطعات", "Parts")} hint={t("ثبت، ویرایش و فعال/غیرفعال‌سازی قطعه", "Create, edit and activate/deactivate parts")}>
          <MesPartsPanel {...props} />
        </Section>
      )}
      {show("bom") && (
        <Section title={t("BOM (فهرست مواد)", "Bills of material")} hint={t("BOM پیش‌نویس قابل ویرایش و حذف ردیف است؛ آزادسازی آن را قفل می‌کند", "Draft BOMs are editable; release locks them")}>
          <MesBomHeadersPanel {...props} />
          <MesBomItemsPanel {...props} />
        </Section>
      )}
      {show("routings") && (
        <Section title={t("مسیرهای ساخت", "Routings")} hint={t("عملیات مسیر پیش‌نویس را می‌توان افزود، ویرایش و حذف کرد", "Draft routing operations can be added, edited and deleted")}>
          <MesRoutingsPanel {...props} />
          <MesRoutingOperationsPanel {...props} />
        </Section>
      )}
      {show("workcenters") && (
        <Section title={t("مراکز کاری و منابع", "Work centers & resources")} hint={t("ظرفیت و وضعیت خطوط تولید", "Capacity and status of production lines")}>
          <MesWorkCentersPanel {...props} />
          <MesResourcesPanel {...props} />
        </Section>
      )}
    </div>
  );
}

export function MesOrdersCrudSection(props: MesSectionProps) {
  const t = (faText: string, enText: string) => (props.fa ? faText : enText);
  return (
    <Section title={t("سفارش‌های تولید", "Production orders")} hint={t("آزادسازی با BOM و مسیر آزادشده، تغییر اولویت و بستن نهایی", "Release with a released BOM and routing, re-prioritize and close")}>
      <MesOrdersPanel {...props} />
    </Section>
  );
}

export type MesPlanningSectionId = "demand" | "lotsize" | "planned" | "none";

export function MesPlanningCrudSection(props: MesSectionProps & { section?: MesPlanningSectionId }) {
  const t = (faText: string, enText: string) => (props.fa ? faText : enText);
  /* هر بخش CRUD فقط در زیرتب هم‌نام خودش در برنامه‌ریزی پیشرفته می‌آید؛
   * در بقیهٔ زیرتب‌ها چیزی رندر نمی‌شود تا بالای صفحه بی‌دلیل بلند نشود. */
  const show = (id: MesPlanningSectionId) => !props.section || props.section === id;
  if (props.section === "none") return null;
  return (
    <div className="space-y-3">
      {show("demand") && (
        <Section title={t("تقاضا و پیش‌بینی", "Demand & forecast")} hint={t("ردیف‌های پیش‌نویس مصرف‌نشده حذف می‌شوند؛ بقیه لغو می‌شوند", "Unused drafts can be deleted; others are cancelled")}>
          <MesDemandPanel {...props} />
        </Section>
      )}
      {show("lotsize") && (
        <Section title={t("لات‌سایزینگ و نسخه‌های تولید", "Lot sizing & production versions")}>
          <MesLotSizingPanel {...props} />
          <MesProductionVersionsPanel {...props} />
        </Section>
      )}
      {show("planned") && (
        <Section title={t("سفارش‌های برنامه‌ریزی‌شده", "Planned orders")} hint={t("تأیید، رد و تبدیل به سفارش تولید", "Approve, reject and convert to production orders")}>
          <MesPlannedOrdersPanel {...props} />
        </Section>
      )}
    </div>
  );
}

export function MesExecutionCrudSection(props: MesSectionProps) {
  const t = (faText: string, enText: string) => (props.fa ? faText : enText);
  return (
    <Section title={t("هشدارهای کارگاه", "Shop-floor alerts")} hint={t("تأیید دریافت هشدار باز", "Acknowledge open alerts")}>
      <MesAlertsPanel {...props} />
    </Section>
  );
}

export function MesMrpCrudSection(props: Omit<MesSectionProps, "onChanged">) {
  const t = (faText: string, enText: string) => (props.fa ? faText : enText);
  return (
    <Section title={t("فهرست مواد و MRP", "Materials & MRP")} hint={t("نمایش فقط‌خواندنی؛ تغییر مواد از مسیر ثبت قطعه انجام می‌شود", "Read-only; material changes go through part registration")}>
      <MesMaterialsPanel {...props} />
    </Section>
  );
}
