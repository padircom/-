/**
 * پنل‌های پنج‌گانهٔ بخش ۷ سازمان: مدیریت اسناد، بایگانی دیجیتال و مدیریت دانش (Enterprise EDMS / KMS)
 * منطبق با ISO 15489، ISO 30301، ISO 9001 و ISO 30401.
 */
import React, { useCallback, useEffect, useState } from "react";
import CrudResource from "./crud/CrudResource";
import type { FormFieldDef } from "./crud/formLogic";
import type { GridColumnDef } from "./crud/gridLogic";
import {
  checkinEdmsDocument,
  checkoutEdmsDocument,
  createEdmsCrudClient,
  fetchEdmsWorkspace,
  generateEdmsDocCode,
  searchEdmsFullText,
  type EdmsSearchHit,
  type EdmsWorkspaceSummary,
} from "../services/edmsEnterpriseApi";

interface PanelProps {
  projectId: string;
  userId: string;
  canWrite: boolean;
}

interface FieldSpec {
  name: string;
  label: string;
  type?: "text" | "code" | "number" | "currency" | "select" | "textarea" | "date";
  required?: boolean;
  defaultValue?: string | number;
  options?: Array<{ value: string; label: string }>;
  span?: number;
}

type ColumnSpec<T = Record<string, unknown>> = GridColumnDef<T>;

interface SimpleCrudProps {
  title: string;
  subtitle?: string;
  idKey: string;
  rows: Record<string, unknown>[];
  columns: ColumnSpec<Record<string, unknown>>[];
  fields: FieldSpec[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onCreate?: (values: Record<string, unknown>) => Promise<void>;
  onUpdate?: (id: string | number, values: Record<string, unknown>) => Promise<void>;
  onDelete?: (ids: Array<string | number>) => Promise<void>;
}

const EnterpriseCrudBlock: React.FC<SimpleCrudProps> = ({
  title,
  subtitle,
  idKey,
  rows,
  columns,
  fields,
  loading,
  error,
  onRefresh,
  onCreate,
  onUpdate,
  onDelete,
}) => {
  const formFields: FormFieldDef[] = React.useMemo(
    () =>
      fields.map((f) => ({
        name: f.name,
        label: f.label,
        type:
          f.type === "code"
            ? "text"
            : f.type === "currency"
              ? "number"
              : (f.type ?? "text"),
        required: f.required,
        options: f.options,
        ltr: f.type === "code" || f.type === "number" || f.type === "currency" || f.type === "date",
        fullWidth: f.span === 2 || f.type === "textarea",
      })),
    [fields],
  );

  const defaults = React.useMemo(() => {
    const out: Record<string, string> = {};
    for (const f of fields) {
      if (f.defaultValue !== undefined) out[f.name] = String(f.defaultValue);
    }
    return out;
  }, [fields]);

  return (
    <div className="space-y-1.5">
      {subtitle && <p className="text-xs tx3 px-1">{subtitle}</p>}
      <CrudResource<Record<string, unknown>>
        fa={true}
        caption={title}
        rows={rows}
        columns={columns}
        rowKey={(r) => String(r[idKey] ?? "")}
        loading={loading}
        error={error}
        onRetry={onRefresh}
        onChanged={onRefresh}
        describeError={(e) => (e instanceof Error ? e.message : "خطا در عملیات")}
        create={
          onCreate
            ? {
                title: `ثبت رکورد جدید — ${title}`,
                fields: formFields,
                defaults,
                allowed: true,
                submit: async (payload) => {
                  await onCreate(payload);
                },
              }
            : undefined
        }
        edit={
          onUpdate
            ? {
                title: `ویرایش رکورد — ${title}`,
                fields: formFields,
                allowed: true,
                submit: async (row, payload) => {
                  await onUpdate(String(row[idKey] ?? ""), payload);
                },
              }
            : undefined
        }
        actions={
          onDelete
            ? () => [
                {
                  key: "delete",
                  label: "حذف",
                  tone: "danger",
                  confirm: {
                    title: "تأیید حذف رکورد",
                    message: "آیا از حذف این رکورد اطمینان دارید؟",
                    confirmLabel: "حذف قطعی",
                    danger: true,
                  },
                  run: async (row) => {
                    await onDelete([String(row[idKey] ?? "")]);
                  },
                },
              ]
            : undefined
        }
      />
    </div>
  );
};

const fmtRials = (v: unknown) => {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n.toLocaleString("fa-IR") : "۰";
};

function useEdmsResource<T extends Record<string, unknown>>(resourcePath: string, projectId: string, userId: string) {
  const client = React.useMemo(() => createEdmsCrudClient<T>(resourcePath), [resourcePath]);
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await client.list(projectId, userId);
      setRows(list);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "خطا در بارگذاری داده‌ها");
    } finally {
      setLoading(false);
    }
  }, [client, projectId, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onCreate = useCallback(
    async (values: Record<string, unknown>) => {
      await client.create(projectId, userId, values as Partial<T>);
      await load();
    },
    [client, projectId, userId, load],
  );

  const onUpdate = useCallback(
    async (id: string | number, values: Record<string, unknown>) => {
      await client.update(projectId, userId, String(id), values as Partial<T>);
      await load();
    },
    [client, projectId, userId, load],
  );

  const onDelete = useCallback(
    async (ids: Array<string | number>) => {
      for (const id of ids) {
        await client.remove(projectId, userId, String(id));
      }
      await load();
    },
    [client, projectId, userId, load],
  );

  return { rows, loading, error, reload: load, onCreate, onUpdate, onDelete };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * ۱. کنترل مدارک و فراداده‌ها (DMI) و الگوی شماره‌گذاری استاندارد خودکار
 * ═══════════════════════════════════════════════════════════════════════════ */
export const EdmsDocumentControlPanel: React.FC<PanelProps> = ({ projectId, userId, canWrite }) => {
  const [subTab, setSubTab] = useState<"dmi" | "numbering">("dmi");
  const [summary, setSummary] = useState<EdmsWorkspaceSummary | null>(null);
  const [genMsg, setGenMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchEdmsWorkspace(projectId, userId).then(setSummary).catch(() => setSummary(null));
  }, [projectId, userId]);

  const dmiRes = useEdmsResource("master-documents", projectId, userId);
  const numRes = useEdmsResource("numbering-rules", projectId, userId);

  const handleGenerateNextCode = async (ruleId: string, ruleTitle: string) => {
    setGenMsg(null);
    try {
      const res = await generateEdmsDocCode(projectId, userId, ruleId);
      setGenMsg(`کد استاندارد جدید «${res.generatedCode}» از الگوی «${ruleTitle}» تولید و رزرو شد.`);
      await numRes.reload();
    } catch (e: unknown) {
      setGenMsg(e instanceof Error ? e.message : "خطا در تولید کد خودکار");
    }
  };

  const dmiFields: FieldSpec[] = [
    { name: "DocCode", label: "شماره سند استاندارد (DocCode)", type: "code", required: true },
    { name: "TitleFa", label: "عنوان فارسی سند / مدرک", type: "text", required: true },
    { name: "TitleEn", label: "عنوان انگلیسی سند", type: "text" },
    {
      name: "DocCategory",
      label: "طبقه کلان سند",
      type: "select",
      defaultValue: "engineering",
      options: [
        { value: "engineering", label: "مهندسی و طراحی (Engineering)" },
        { value: "quality", label: "تضمین کیفیت و دستورالعمل ISO 9001" },
        { value: "contractual", label: "قراردادی، پیمان و حقوقی" },
        { value: "operation", label: "دفترچه بهره‌برداری و تعمیرات (O&M)" },
        { value: "administrative", label: "اداری و مکاتبات سازمانی" },
        { value: "vendor", label: "مدارک سازندگان (Vendor Print)" },
      ],
    },
    {
      name: "Discipline",
      label: "دیسیپلین تخصصی",
      type: "select",
      defaultValue: "mechanical",
      options: [
        { value: "process", label: "فرآیند (Process)" },
        { value: "mechanical", label: "مکانیک و تجهیزات دوار (Mechanical)" },
        { value: "piping", label: "لوله‌کشی (Piping)" },
        { value: "electrical", label: "برق (Electrical)" },
        { value: "instrumentation", label: "ابزار دقیق و کنترل (Instrument)" },
        { value: "civil", label: "سیویل و سازه (Civil)" },
        { value: "quality", label: "کیفیت و جوشکاری (QA/QC)" },
        { value: "commercial", label: "بازرگانی و پیمان (Commercial)" },
      ],
    },
    {
      name: "DocType",
      label: "نوع مدرک",
      type: "select",
      defaultValue: "drawing",
      options: [
        { value: "drawing", label: "نقشه فنی (Drawing / P&ID)" },
        { value: "procedure", label: "روش اجرایی / دستورالعمل (Procedure / WPS)" },
        { value: "specification", label: "مشخصات فنی (Specification)" },
        { value: "datasheet", label: "برگه اطلاعات فنی (Datasheet)" },
        { value: "contract", label: "سند قرارداد / الحاقیه" },
        { value: "manual", label: "دفترچه راهنما و تعمیرات (Manual)" },
      ],
    },
    { name: "NumberingRuleCode", label: "کد الگوی شماره‌گذاری", type: "code", defaultValue: "NUM-ENG-MECH" },
    {
      name: "CurrentRevision",
      label: "ویرایش جاری",
      type: "select",
      defaultValue: "Rev-A",
      options: [
        { value: "Draft", label: "پیش‌نویس (Draft)" },
        { value: "Rev-0", label: "ویرایش اولیه (Rev-0)" },
        { value: "Rev-A", label: "ویرایش بررسی (Rev-A)" },
        { value: "Rev-B", label: "ویرایش اصلاحی (Rev-B)" },
        { value: "Approved", label: "مصوب نهایی (Approved)" },
        { value: "IFC", label: "صادرشده برای ساخت (IFC)" },
        { value: "As-Built", label: "چون‌ساخت نهایی (As-Built)" },
      ],
    },
    {
      name: "LifecycleStage",
      label: "مرحله چرخه حیات",
      type: "select",
      defaultValue: "Approved",
      options: [
        { value: "Draft", label: "پیش‌نویس (Draft)" },
        { value: "In-Review", label: "در گردش بررسی (In-Review)" },
        { value: "Approved", label: "مصوب (Approved)" },
        { value: "IFC", label: "ابلاغ ساخت (IFC)" },
        { value: "As-Built", label: "چون‌ساخت (As-Built)" },
      ],
    },
    {
      name: "Confidentiality",
      label: "سطح محرمانگی (ISO 27001 / 15489)",
      type: "select",
      defaultValue: "internal",
      options: [
        { value: "public", label: "عمومی" },
        { value: "internal", label: "داخلی سازمان" },
        { value: "confidential", label: "محرمانه" },
        { value: "restricted", label: "کاملاً سری / خزانه رمزنگاری‌شده" },
      ],
    },
    { name: "OwnerDepartmentFa", label: "واحد مالک سند", type: "text", required: true },
    { name: "OriginatorFa", label: "تهیه‌کننده / مؤلف", type: "text" },
    { name: "ArchiveZoneCode", label: "کد زون بایگانی دیجیتال", type: "code", defaultValue: "ZON-ENG-01" },
    { name: "LinkedAssetOrWbsRef", label: "پیوند نرم به تجهیز CMMS / سفارش MES / WBS", type: "code" },
    { name: "NoteFa", label: "توضیحات شناسنامه سند", type: "textarea", span: 2 },
  ];

  const dmiCols: ColumnSpec<Record<string, unknown>>[] = [
    { key: "DocCode", header: "شماره سند استاندارد", sortable: true },
    { key: "TitleFa", header: "عنوان سند", sortable: true },
    { key: "DocCategory", header: "طبقه" },
    { key: "Discipline", header: "دیسیپلین" },
    { key: "DocType", header: "نوع مدرک" },
    { key: "CurrentRevision", header: "ویرایش جاری" },
    { key: "LifecycleStage", header: "مرحله چرخه" },
    { key: "Confidentiality", header: "محرمانگی" },
    { key: "ArchiveZoneCode", header: "زون بایگانی" },
    { key: "LinkedAssetOrWbsRef", header: "پیوند تجهیز/WBS" },
    { key: "Status", header: "وضعیت" },
  ];

  const numFields: FieldSpec[] = [
    { name: "RuleCode", label: "کد الگوی شماره‌گذاری", type: "code", required: true },
    { name: "TitleFa", label: "عنوان الگوی کدینگ", type: "text", required: true },
    {
      name: "DocCategory",
      label: "طبقه اسناد هدف",
      type: "select",
      defaultValue: "engineering",
      options: [
        { value: "engineering", label: "مهندسی (Engineering)" },
        { value: "quality", label: "کیفیت و روش‌های اجرایی (QMS)" },
        { value: "contractual", label: "قراردادها و پیمان‌ها (Contracts)" },
        { value: "operation", label: "بهره‌برداری و نت (Operations)" },
        { value: "administrative", label: "مکاتبات اداری" },
      ],
    },
    { name: "PrefixPattern", label: "پیشوند استاندارد (Prefix)", type: "code", required: true, defaultValue: "AZD-ENG-ME-DWG" },
    { name: "DisciplineCode", label: "کد دیسیپلین", type: "code", defaultValue: "ME" },
    { name: "DocTypeCode", label: "کد نوع سند", type: "code", defaultValue: "DWG" },
    { name: "Separator", label: "جداکننده", type: "text", defaultValue: "-" },
    { name: "SeqDigits", label: "تعداد ارقام شمارنده", type: "number", defaultValue: 4 },
    { name: "CurrentSeq", label: "آخرین شماره صادرشده", type: "number", defaultValue: 100 },
    { name: "ExampleDocCode", label: "نمونه کد تولیدشده", type: "code" },
    { name: "NoteFa", label: "توضیحات استاندارد کدینگ", type: "textarea", span: 2 },
  ];

  const numCols: ColumnSpec<Record<string, unknown>>[] = [
    { key: "RuleCode", header: "کد الگو", sortable: true },
    { key: "TitleFa", header: "عنوان الگوی شماره‌گذاری" },
    { key: "PrefixPattern", header: "پیشوند استاندارد" },
    { key: "DisciplineCode", header: "دیسیپلین" },
    { key: "DocTypeCode", header: "نوع سند" },
    { key: "CurrentSeq", header: "شمارنده جاری" },
    { key: "ExampleDocCode", header: "آخرین کد تولیدشده" },
    {
      key: "Id",
      header: "تولید خودکار کد بعدی",
      render: (r) => (
        <button
          type="button"
          disabled={!canWrite}
          onClick={(e) => {
            e.stopPropagation();
            void handleGenerateNextCode(String(r.Id), String(r.TitleFa));
          }}
          className="rounded bg-indigo-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-40"
        >
          تولید کد بعدی +۱
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
            <div className="text-xs text-slate-500">اسناد ثبت‌شده در DMI</div>
            <div className="text-lg font-bold text-slate-800">{summary.kpis.masterDocumentsCount} سند اصلی</div>
            <div className="text-[11px] text-emerald-700">
              مصوب / IFC / As-Built: {summary.kpis.approvedOrIfcDocsCount} سند
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
            <div className="text-xs text-slate-500">نسخه‌ها و قفل‌های ویرایش</div>
            <div className="text-lg font-bold text-slate-800">{summary.kpis.revisionsCount} ریویژن</div>
            <div className="text-[11px] text-amber-700">
              قفل Check-Out فعال: {summary.kpis.activeCheckoutLocksCount} مورد
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
            <div className="text-xs text-slate-500">گردش‌کار و ترانسمیتال</div>
            <div className="text-lg font-bold text-slate-800">{summary.kpis.transmittalsCount} مرسوله</div>
            <div className="text-[11px] text-indigo-700">
              در گردش بررسی: {summary.kpis.activeWorkflowsCount} سند
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
            <div className="text-xs text-slate-500">بایگانی دیجیتال و دقت OCR</div>
            <div className="text-lg font-bold text-emerald-700">{summary.kpis.avgOcrConfidencePct}٪ دقت OCR</div>
            <div className="text-[11px] text-slate-600">
              اسناد بایگانی‌شده: {summary.kpis.totalArchivedDocsCount} پرونده
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
            <div className="text-xs text-slate-500">پایگاه دانش و دروس آموخته</div>
            <div className="text-lg font-bold text-indigo-700">
              {summary.kpis.lessonsLearnedCount} درس · {summary.kpis.knowledgeArticlesCount} ویکی
            </div>
            <div className="text-[11px] text-emerald-700">
              صرفه‌جویی دانش: {fmtRials(summary.kpis.totalKnowledgeSavingsRials)} ریال
            </div>
          </div>
        </div>
      )}

      {genMsg && (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-900">
          {genMsg}
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {[
          { id: "dmi", label: "شناسنامه جامع اسناد (Document Master Index — DMI)" },
          { id: "numbering", label: "الگوهای کدینگ و شماره‌گذاری استاندارد خودکار اسناد" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSubTab(t.id as typeof subTab)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              subTab === t.id
                ? "bg-teal-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === "dmi" && (
        <EnterpriseCrudBlock title="شناسنامه جامع اسناد مهندسی، قراردادی، کیفیتی و اداری (Document Master Index — DMI)"
          subtitle="مدیریت متمرکز فراداده‌ها، سطح محرمانگی، وضعیت چرخه حیات (Draft, Rev-A, Rev-B, Approved, IFC, As-Built) و ارتباط با تجهیزات و WBS"
          idKey="Id"
          rows={dmiRes.rows}
          columns={dmiCols}
          fields={dmiFields}
          loading={dmiRes.loading}
          error={dmiRes.error}
          onRefresh={dmiRes.reload}
          onCreate={canWrite ? dmiRes.onCreate : undefined}
          onUpdate={canWrite ? dmiRes.onUpdate : undefined}
          onDelete={canWrite ? dmiRes.onDelete : undefined}
        />
      )}

      {subTab === "numbering" && (
        <EnterpriseCrudBlock title="الگوهای شماره‌گذاری و کدینگ استاندارد خودکار اسناد (ISO 9001 / MDR Coding Rules)"
          subtitle="تعریف ساختار کدینگ یکپارچه بر اساس پروژه، طبقه، دیسیپلین، نوع سند و شمارنده خودکار"
          idKey="Id"
          rows={numRes.rows}
          columns={numCols}
          fields={numFields}
          loading={numRes.loading}
          error={numRes.error}
          onRefresh={numRes.reload}
          onCreate={canWrite ? numRes.onCreate : undefined}
          onUpdate={canWrite ? numRes.onUpdate : undefined}
          onDelete={canWrite ? numRes.onDelete : undefined}
        />
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
 * ۲. مدیریت نسخه‌ها، Check-In / Check-Out و مقایسه تغییرات (Revision Control)
 * ═══════════════════════════════════════════════════════════════════════════ */
export const EdmsRevisionsLockPanel: React.FC<PanelProps> = ({ projectId, userId, canWrite }) => {
  const [subTab, setSubTab] = useState<"revisions" | "locks">("revisions");
  const [selectedDocId, setSelectedDocId] = useState("");
  const [lockReason, setLockReason] = useState("بازنگری فنی و ارتقای نسخه سند");
  const [nextRevCode, setNextRevCode] = useState("Approved");
  const [diffSummary, setDiffSummary] = useState("اعمال اصلاحات فنی و بستن کامنت‌های بررسی");
  const [lockFeedback, setLockFeedback] = useState<string | null>(null);

  const dmiRes = useEdmsResource("master-documents", projectId, userId);
  const revRes = useEdmsResource("revisions", projectId, userId);
  const lckRes = useEdmsResource("checkout-locks", projectId, userId);

  const handleCheckout = async () => {
    if (!selectedDocId) return;
    setLockFeedback(null);
    try {
      const res = await checkoutEdmsDocument(projectId, userId, selectedDocId, lockReason);
      setLockFeedback(`سند با شماره قفل «${String(res.lock.LockNo)}» برای ویرایش اختصاصی قفل (Check-Out) شد.`);
      await Promise.all([dmiRes.reload(), lckRes.reload()]);
    } catch (e: unknown) {
      setLockFeedback(e instanceof Error ? e.message : "خطا در قفل کردن سند");
    }
  };

  const handleCheckin = async () => {
    if (!selectedDocId) return;
    setLockFeedback(null);
    try {
      const res = await checkinEdmsDocument(projectId, userId, selectedDocId, {
        newRevision: nextRevCode,
        diffHighlightsFa: diffSummary,
      });
      setLockFeedback(
        `سند با موفقیت Check-In شد و نسخه جدید «${String(res.revision.RevisionCode)}» (${String(res.revision.RevisionNo)}) ثبت گردید.`,
      );
      await Promise.all([dmiRes.reload(), revRes.reload(), lckRes.reload()]);
    } catch (e: unknown) {
      setLockFeedback(e instanceof Error ? e.message : "خطا در آزادسازی و Check-In سند");
    }
  };

  const revFields: FieldSpec[] = [
    { name: "RevisionNo", label: "شناسه یکتای ریویژن", type: "code", required: true },
    { name: "DocCode", label: "شماره سند استاندارد", type: "code", required: true },
    {
      name: "RevisionCode",
      label: "کد نسخه (Revision)",
      type: "select",
      defaultValue: "Rev-A",
      options: [
        { value: "Draft", label: "پیش‌نویس (Draft)" },
        { value: "Rev-0", label: "نسخه اولیه (Rev-0)" },
        { value: "Rev-A", label: "نسخه بررسی (Rev-A)" },
        { value: "Rev-B", label: "نسخه اصلاح‌شده (Rev-B)" },
        { value: "Approved", label: "نسخه مصوب (Approved)" },
        { value: "IFC", label: "نسخه ابلاغ ساخت (IFC)" },
        { value: "As-Built", label: "نسخه چون‌ساخت (As-Built)" },
      ],
    },
    { name: "ComparedToRev", label: "مقایسه‌شده با نسخه قبلی", type: "code", defaultValue: "Rev-A" },
    { name: "ChangeSummaryFa", label: "خلاصه تغییرات نسخه", type: "text", required: true },
    { name: "DiffHighlightsFa", label: "جزئیات مقایسه تغییرات فنی و متنی (Diff Highlights)", type: "textarea", span: 2 },
    { name: "PageCount", label: "تعداد صفحات", type: "number", defaultValue: 8 },
    { name: "PreparedBy", label: "تهیه‌کننده", type: "code", defaultValue: "u-engmgr" },
    { name: "CheckedBy", label: "صحه‌گذار", type: "code", defaultValue: "u-qa" },
    { name: "ApprovedBy", label: "تصویب‌کننده", type: "code", defaultValue: "u-pm" },
    { name: "IssueDate", label: "تاریخ صدور نسخه", type: "date", required: true },
    {
      name: "Status",
      label: "وضعیت نسخه",
      type: "select",
      defaultValue: "approved",
      options: [
        { value: "draft", label: "پیش‌نویس" },
        { value: "under-review", label: "در حال بررسی" },
        { value: "approved", label: "مصوب" },
        { value: "ifc", label: "ابلاغ ساخت (IFC)" },
        { value: "as-built", label: "چون‌ساخت (As-Built)" },
        { value: "superseded", label: "منسوخ / جایگزین‌شده" },
      ],
    },
  ];

  const revCols: ColumnSpec<Record<string, unknown>>[] = [
    { key: "RevisionNo", header: "شناسه ریویژن", sortable: true },
    { key: "DocCode", header: "شماره سند", sortable: true },
    { key: "RevisionCode", header: "نسخه" },
    { key: "ComparedToRev", header: "نسبت به" },
    { key: "ChangeSummaryFa", header: "خلاصه تغییر" },
    { key: "DiffHighlightsFa", header: "مقایسه تغییرات (Diff)" },
    { key: "IssueDate", header: "تاریخ صدور" },
    { key: "Status", header: "وضعیت" },
  ];

  const lckFields: FieldSpec[] = [
    { name: "LockNo", label: "شماره قفل ویرایش", type: "code", required: true },
    { name: "DocCode", label: "شماره سند", type: "code", required: true },
    { name: "BaseRevision", label: "نسخه پایه هنگام قفل", type: "code", required: true, defaultValue: "Rev-A" },
    { name: "CheckedOutBy", label: "کاربر قفل‌کننده (Checked-Out By)", type: "code", required: true, defaultValue: userId },
    { name: "CheckedOutAt", label: "زمان قفل (ISO)", type: "text", required: true, defaultValue: new Date().toISOString() },
    { name: "ExpectedReturnDate", label: "تاریخ بازگشت پیش‌بینی‌شده", type: "date" },
    { name: "CheckOutReasonFa", label: "علت قفل کردن سند", type: "text", required: true },
    { name: "ResultingRevision", label: "نسخه حاصل پس از Check-In", type: "code" },
    { name: "CheckInDiffNotesFa", label: "یادداشت تغییرات هنگام Check-In", type: "textarea", span: 2 },
    {
      name: "Status",
      label: "وضعیت قفل",
      type: "select",
      defaultValue: "checked-out",
      options: [
        { value: "checked-out", label: "قفل‌شده (Checked-Out)" },
        { value: "checked-in", label: "آزادشده با ثبت نسخه جدید (Checked-In)" },
        { value: "force-unlocked", label: "بازگشایی اضطراری مدیر سیستم" },
      ],
    },
  ];

  const lckCols: ColumnSpec<Record<string, unknown>>[] = [
    { key: "LockNo", header: "شماره قفل", sortable: true },
    { key: "DocCode", header: "شماره سند", sortable: true },
    { key: "BaseRevision", header: "نسخه پایه" },
    { key: "CheckedOutBy", header: "قفل‌کننده" },
    { key: "CheckOutReasonFa", header: "علت Check-Out" },
    { key: "ResultingRevision", header: "نسخه حاصل" },
    { key: "Status", header: "وضعیت قفل" },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4 space-y-3">
        <div className="text-sm font-bold text-indigo-950">
          میز کار رزرو انحصاری سند (Check-Out) و بارگذاری ویرایش جدید با ثبت تغییرات (Check-In)
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <select
            value={selectedDocId}
            onChange={(e) => setSelectedDocId(e.target.value)}
            className="rounded-md border border-indigo-300 bg-white px-2.5 py-1.5 text-xs text-slate-800"
          >
            <option value="">انتخاب سند از فهرست DMI...</option>
            {dmiRes.rows.map((d) => (
              <option key={String(d.Id)} value={String(d.Id)}>
                {String(d.DocCode)} — {String(d.TitleFa)} ({String(d.CurrentRevision)} / {String(d.Status)})
              </option>
            ))}
          </select>
          <input
            type="text"
            value={lockReason}
            onChange={(e) => setLockReason(e.target.value)}
            placeholder="علت Check-Out یا خلاصه تغییرات..."
            className="rounded-md border border-indigo-300 bg-white px-2.5 py-1.5 text-xs text-slate-800"
          />
          <select
            value={nextRevCode}
            onChange={(e) => setNextRevCode(e.target.value)}
            className="rounded-md border border-indigo-300 bg-white px-2.5 py-1.5 text-xs text-slate-800"
          >
            <option value="Rev-A">ارتقا به Rev-A</option>
            <option value="Rev-B">ارتقا به Rev-B</option>
            <option value="Approved">ارتقا به Approved</option>
            <option value="IFC">ارتقا به IFC (ابلاغ ساخت)</option>
            <option value="As-Built">ارتقا به As-Built (چون‌ساخت)</option>
          </select>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!canWrite || !selectedDocId}
              onClick={handleCheckout}
              className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-40"
            >
              قفل کردن (Check-Out)
            </button>
            <button
              type="button"
              disabled={!canWrite || !selectedDocId}
              onClick={handleCheckin}
              className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-40"
            >
              ثبت نسخه و آزادسازی (Check-In)
            </button>
          </div>
        </div>
        <input
          type="text"
          value={diffSummary}
          onChange={(e) => setDiffSummary(e.target.value)}
          placeholder="شرح دقیق مقایسه تغییرات فنی نسبت به نسخه قبل (Diff Highlights)..."
          className="w-full rounded-md border border-indigo-200 bg-white px-2.5 py-1.5 text-xs text-slate-800"
        />
        {lockFeedback && (
          <div className="rounded-md border border-indigo-300 bg-white px-3 py-1.5 text-xs font-medium text-indigo-900">
            {lockFeedback}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {[
          { id: "revisions", label: "تاریخچه نسخه‌ها و مقایسه تغییرات (Draft, Rev-A, Rev-B, Approved, IFC, As-Built)" },
          { id: "locks", label: "دفتر قفل‌های Check-Out / Check-In و جلوگیری از تداخل ویرایش" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSubTab(t.id as typeof subTab)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              subTab === t.id
                ? "bg-teal-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === "revisions" && (
        <EnterpriseCrudBlock title="کنترل سخت‌گیرانه نسخه‌های اسناد و مقایسه تغییرات (ISO 9001 Revision History & Diff)"
          subtitle="ردیابی کامل سیر تکامل سند از پیش‌نویس تا چون‌ساخت (As-Built) همراه با امضای دیجیتال SHA-256 و خلاصه تغییرات"
          idKey="Id"
          rows={revRes.rows}
          columns={revCols}
          fields={revFields}
          loading={revRes.loading}
          error={revRes.error}
          onRefresh={revRes.reload}
          onCreate={canWrite ? revRes.onCreate : undefined}
          onUpdate={canWrite ? revRes.onUpdate : undefined}
          onDelete={canWrite ? revRes.onDelete : undefined}
        />
      )}

      {subTab === "locks" && (
        <EnterpriseCrudBlock title="مدیریت قفل‌های Check-Out / Check-In اسناد"
          subtitle="کنترل انحصاری ویرایش اسناد برای جلوگیری از بازنویسی ناخواسته (Overwriting) توسط کاربران همزمان"
          idKey="Id"
          rows={lckRes.rows}
          columns={lckCols}
          fields={lckFields}
          loading={lckRes.loading}
          error={lckRes.error}
          onRefresh={lckRes.reload}
          onCreate={canWrite ? lckRes.onCreate : undefined}
          onUpdate={canWrite ? lckRes.onUpdate : undefined}
          onDelete={canWrite ? lckRes.onDelete : undefined}
        />
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
 * ۳. گردش‌کار بررسی و تأیید (Review & Approval Workflow) و ترانسمیتال‌ها
 * ═══════════════════════════════════════════════════════════════════════════ */
export const EdmsWorkflowsTransmittalsPanel: React.FC<PanelProps> = ({ projectId, userId, canWrite }) => {
  const [subTab, setSubTab] = useState<"workflows" | "transmittals">("workflows");

  const wflRes = useEdmsResource("workflows", projectId, userId);
  const trnRes = useEdmsResource("transmittals", projectId, userId);

  const wflFields: FieldSpec[] = [
    { name: "WorkflowNo", label: "شماره گردش‌کار", type: "code", required: true },
    { name: "DocCode", label: "شماره سند در گردش", type: "code", required: true },
    { name: "RevisionCode", label: "نسخه مورد بررسی", type: "code", required: true, defaultValue: "Rev-B" },
    {
      name: "WorkflowType",
      label: "الگوی گردش‌کار",
      type: "select",
      defaultValue: "technical-review",
      options: [
        { value: "technical-review", label: "بررسی فنی بین‌دیسیپلینی (IDC / Technical Review)" },
        { value: "ifc-release", label: "تصویب و ابلاغ ساخت (IFC Release)" },
        { value: "iso-procedure", label: "تأیید و ابلاغ دستورالعمل ISO 9001" },
        { value: "client-approval", label: "تأیید کارفرما و دستگاه نظارت" },
        { value: "as-built-handover", label: "تحویل نهایی پرونده چون‌ساخت (As-Built)" },
      ],
    },
    {
      name: "CurrentStep",
      label: "ایستگاه جاری در گردش‌کار",
      type: "select",
      defaultValue: "lead-engineer",
      options: [
        { value: "initiator", label: "۱. تهیه‌کننده مدرک (Initiator)" },
        { value: "checker", label: "۲. صحه‌گذار دیسیپلین (Checker)" },
        { value: "lead-engineer", label: "۳. سرپرست مهندسی (Lead Engineer)" },
        { value: "qa-control", label: "۴. کنترل کیفیت و استاندارد (QA/DCC)" },
        { value: "client-rep", label: "۵. نماینده کارفرما / مشاور" },
        { value: "completed", label: "۶. تکمیل‌شده و ابلاغی" },
      ],
    },
    {
      name: "ReviewResultCode",
      label: "کد نتیجه بررسی مهندسی",
      type: "select",
      defaultValue: "pending",
      options: [
        { value: "pending", label: "در انتظار اعلام نظر (Pending)" },
        { value: "Code-1-Approved", label: "Code 1 — مصوب بدون کامنت (Approved)" },
        { value: "Code-2-ApprovedAsNoted", label: "Code 2 — مصوب مشروط به اعمال کامنت‌ها" },
        { value: "Code-3-ReviseResubmit", label: "Code 3 — مردود؛ اصلاح و ارسال مجدد" },
        { value: "Code-4-InfoOnly", label: "Code 4 — صرفاً جهت اطلاع" },
      ],
    },
    { name: "InitiatedBy", label: "شروع‌کننده", type: "code", defaultValue: "u-doc" },
    { name: "AssignedReviewer", label: "مسئول بررسی فعلی", type: "code", defaultValue: "u-qa" },
    { name: "FinalApprover", label: "تصویب‌کننده نهایی", type: "code", defaultValue: "u-pm" },
    { name: "DueDate", label: "مهلت پاسخ‌گویی (SLA)", type: "date", required: true },
    { name: "ReviewCommentsFa", label: "کامنت‌های فنی و نظرات بررسی‌کنندگان", type: "textarea", span: 2 },
    {
      name: "Status",
      label: "وضعیت گردش‌کار",
      type: "select",
      defaultValue: "in-review",
      options: [
        { value: "in-review", label: "در جریان بررسی" },
        { value: "approved", label: "تأیید و نهایی‌شده" },
        { value: "approved-with-comments", label: "تأیید مشروط به کامنت" },
        { value: "rejected", label: "برگشت‌خورده جهت اصلاح" },
      ],
    },
  ];

  const wflCols: ColumnSpec<Record<string, unknown>>[] = [
    { key: "WorkflowNo", header: "شماره گردش‌کار", sortable: true },
    { key: "DocCode", header: "شماره سند", sortable: true },
    { key: "RevisionCode", header: "نسخه" },
    { key: "WorkflowType", header: "نوع چرخه" },
    { key: "CurrentStep", header: "ایستگاه جاری" },
    { key: "ReviewResultCode", header: "کد بررسی (۱ تا ۴)" },
    { key: "AssignedReviewer", header: "بررسی‌کننده" },
    { key: "DueDate", header: "مهلت SLA" },
    { key: "Status", header: "وضعیت" },
  ];

  const trnFields: FieldSpec[] = [
    { name: "TransmittalNo", label: "شماره برگه ارسال مدارک (Transmittal)", type: "code", required: true },
    { name: "SubjectFa", label: "موضوع مرسوله / مکاتبه رسمی", type: "text", required: true },
    {
      name: "Direction",
      label: "جهت مبادله",
      type: "select",
      defaultValue: "outgoing",
      options: [
        { value: "outgoing", label: "ارسالی (Outgoing Transmittal)" },
        { value: "incoming", label: "دریافتی (Incoming Transmittal)" },
      ],
    },
    { name: "SenderOrgFa", label: "سازمان / واحد فرستنده", type: "text", required: true },
    { name: "ReceiverOrgFa", label: "سازمان / واحد گیرنده", type: "text", required: true },
    {
      name: "IssuePurpose",
      label: "هدف ارسال مدارک",
      type: "select",
      defaultValue: "for-approval",
      options: [
        { value: "for-approval", label: "جهت بررسی و تصویب (IFA)" },
        { value: "for-construction", label: "جهت اجرا و ساخت در سایت (IFC)" },
        { value: "for-review", label: "جهت اظهارنظر فنی (IFR)" },
        { value: "as-built-dossier", label: "تحویل پرونده چون‌ساخت (As-Built)" },
        { value: "for-information", label: "جهت اطلاع و بهره‌برداری (IFI)" },
      ],
    },
    { name: "IncludedDocCodes", label: "فهرست کد اسناد و ویرایش‌های ضمیمه", type: "textarea", required: true, span: 2 },
    {
      name: "DeliveryChannel",
      label: "کانال تحویل رسمی",
      type: "select",
      defaultValue: "edms-portal",
      options: [
        { value: "edms-portal", label: "پورتال یکپارچه EDMS با رسید دیجیتال" },
        { value: "encrypted-media", label: "بسته رمزنگاری‌شده امن" },
        { value: "official-courier", label: "نسخه چاپی ممهور + پیک رسمی" },
      ],
    },
    { name: "IssueDate", label: "تاریخ صدور ترانسمیتال", type: "date", required: true },
    { name: "AcknowledgedDate", label: "تاریخ اعلام وصول گیرنده", type: "date" },
    { name: "ReceiptRefNo", label: "شماره رسید / نامه اعلام وصول", type: "code" },
    { name: "IssuedBy", label: "صادرکننده در DCC", type: "code", defaultValue: userId },
    {
      name: "Status",
      label: "وضعیت مرسوله",
      type: "select",
      defaultValue: "issued",
      options: [
        { value: "draft", label: "پیش‌نویس" },
        { value: "issued", label: "صادر و ارسال‌شده" },
        { value: "acknowledged", label: "رسید دریافت ثبت‌شده" },
        { value: "closed", label: "بسته‌شده" },
      ],
    },
  ];

  const trnCols: ColumnSpec<Record<string, unknown>>[] = [
    { key: "TransmittalNo", header: "شماره ترانسمیتال", sortable: true },
    { key: "Direction", header: "جهت" },
    { key: "SubjectFa", header: "موضوع مرسوله" },
    { key: "SenderOrgFa", header: "فرستنده" },
    { key: "ReceiverOrgFa", header: "گیرنده" },
    { key: "IssuePurpose", header: "هدف ارسال" },
    { key: "IncludedDocCodes", header: "اسناد ضمیمه" },
    { key: "IssueDate", header: "تاریخ ارسال" },
    { key: "ReceiptRefNo", header: "شماره رسید" },
    { key: "Status", header: "وضعیت" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {[
          { id: "workflows", label: "گردش‌کار بررسی و تأیید اسناد (Review & Approval Workflow)" },
          { id: "transmittals", label: "ترانسمیتال‌ها و مبادلات رسمی مدارک مهندسی/اداری (Transmittals)" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSubTab(t.id as typeof subTab)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              subTab === t.id
                ? "bg-teal-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === "workflows" && (
        <EnterpriseCrudBlock title="چرخه گردش‌کار بررسی، صحه‌گذاری و تصویب اسناد (Review & Approval Workflow)"
          subtitle="مدیریت ایستگاه‌های بررسی مهندسی، کنترل کیفیت و کارفرما با کدهای استاندارد بررسی ۱ تا ۴"
          idKey="Id"
          rows={wflRes.rows}
          columns={wflCols}
          fields={wflFields}
          loading={wflRes.loading}
          error={wflRes.error}
          onRefresh={wflRes.reload}
          onCreate={canWrite ? wflRes.onCreate : undefined}
          onUpdate={canWrite ? wflRes.onUpdate : undefined}
          onDelete={canWrite ? wflRes.onDelete : undefined}
        />
      )}

      {subTab === "transmittals" && (
        <EnterpriseCrudBlock title="مدیریت ترانسمیتال‌ها و مکاتبات رسمی ارسال/دریافت مدارک (Official Transmittals)"
          subtitle="ثبت برگه‌های ارسال مدارک به کارفرما، مشاور، پیمانکاران و کارگاه‌های ساخت با پیگیری اعلام وصول"
          idKey="Id"
          rows={trnRes.rows}
          columns={trnCols}
          fields={trnFields}
          loading={trnRes.loading}
          error={trnRes.error}
          onRefresh={trnRes.reload}
          onCreate={canWrite ? trnRes.onCreate : undefined}
          onUpdate={canWrite ? trnRes.onUpdate : undefined}
          onDelete={canWrite ? trnRes.onDelete : undefined}
        />
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
 * ۴. بایگانی دیجیتال، اسکن/OCR و موتور جستجوی تمام‌متن (Full-Text Search)
 * ═══════════════════════════════════════════════════════════════════════════ */
export const EdmsArchiveOcrSearchPanel: React.FC<PanelProps> = ({ projectId, userId, canWrite }) => {
  const [subTab, setSubTab] = useState<"search" | "ocr" | "zones">("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [searchHits, setSearchHits] = useState<EdmsSearchHit[]>([]);
  const [searching, setSearching] = useState(false);

  const zonRes = useEdmsResource("archive-zones", projectId, userId);
  const ocrRes = useEdmsResource("ocr-index", projectId, userId);

  const runSearch = useCallback(async () => {
    setSearching(true);
    try {
      const res = await searchEdmsFullText(projectId, userId, searchQuery, sourceFilter);
      setSearchHits(res.items);
    } catch {
      setSearchHits([]);
    } finally {
      setSearching(false);
    }
  }, [projectId, userId, searchQuery, sourceFilter]);

  useEffect(() => {
    void runSearch();
  }, [runSearch]);

  const ocrFields: FieldSpec[] = [
    { name: "IndexNo", label: "شماره رکورد اسکن و OCR", type: "code", required: true },
    { name: "DocCode", label: "شماره سند مرتبط", type: "code", required: true },
    { name: "RevisionCode", label: "نسخه اسکن‌شده", type: "code", required: true, defaultValue: "Approved" },
    { name: "ArchiveZoneCode", label: "کد زون بایگانی", type: "code", required: true, defaultValue: "ZON-ENG-01" },
    { name: "ScanDpi", label: "رزولوشن اسکن (DPI)", type: "number", defaultValue: 400 },
    {
      name: "OcrLang",
      label: "زبان موتور OCR",
      type: "select",
      defaultValue: "fa+en",
      options: [
        { value: "fa+en", label: "دوزبانه فارسی + انگلیسی (fa+en)" },
        { value: "fa", label: "فارسی" },
        { value: "en", label: "انگلیسی فنی" },
      ],
    },
    { name: "OcrConfidencePct", label: "ضریب اطمینان استخراج متن (٪)", type: "number", defaultValue: 98.2 },
    { name: "KeywordsTagsFa", label: "کلیدواژه‌ها و تگ‌های نمایه‌سازی", type: "text", required: true },
    { name: "PhysicalBoxRef", label: "کد زونکن / باکس فیزیکی", type: "code" },
    { name: "IndexedDate", label: "تاریخ نمایه‌سازی", type: "date", required: true },
    { name: "ExtractedTextFa", label: "متن استخراج‌شده توسط موتور OCR (قابل جستجوی تمام‌متن)", type: "textarea", required: true, span: 2 },
  ];

  const ocrCols: ColumnSpec<Record<string, unknown>>[] = [
    { key: "IndexNo", header: "کد نمایه OCR", sortable: true },
    { key: "DocCode", header: "شماره سند", sortable: true },
    { key: "RevisionCode", header: "نسخه" },
    { key: "ArchiveZoneCode", header: "زون بایگانی" },
    { key: "ScanDpi", header: "DPI" },
    { key: "OcrConfidencePct", header: "دقت OCR (٪)" },
    { key: "KeywordsTagsFa", header: "کلیدواژه‌ها" },
    { key: "PhysicalBoxRef", header: "باکس فیزیکی" },
    { key: "Status", header: "وضعیت" },
  ];

  const zonFields: FieldSpec[] = [
    { name: "ZoneCode", label: "کد زون بایگانی", type: "code", required: true },
    { name: "TitleFa", label: "عنوان زون بایگانی دیجیتال/فیزیکی", type: "text", required: true },
    {
      name: "Classification",
      label: "طبقه اسناد آرشیوی",
      type: "select",
      defaultValue: "engineering-drawings",
      options: [
        { value: "engineering-drawings", label: "نقشه‌های مهندسی و پرونده‌های As-Built" },
        { value: "quality-iso-records", label: "سوابق کیفیت، جوشکاری و گواهی‌های NDT" },
        { value: "contracts-legal", label: "قراردادها، ضمانت‌نامه‌ها و اسناد حقوقی" },
        { value: "as-built-vault", label: "دفترچه‌های تعمیرات و کاتالوگ‌های عملیات" },
      ],
    },
    {
      name: "StorageTier",
      label: "لایه ذخیره‌سازی",
      type: "select",
      defaultValue: "hot-nvme",
      options: [
        { value: "hot-nvme", label: "دسترسی سریع آنلاین (Hot NVMe)" },
        { value: "warm-object", label: "ذخیره‌سازی شیئی سازمانی (Warm Object)" },
        { value: "cold-worm-vault", label: "خزانه غیرقابل‌تغییر WORM (ISO 30301)" },
        { value: "physical-fireproof", label: "خزانه فیزیکی ضدحریق" },
      ],
    },
    { name: "RetentionYears", label: "مدت نگهداری قانونی (سال - ISO 15489)", type: "number", defaultValue: 25 },
    { name: "StoredDocsCount", label: "تعداد پرونده‌های ذخیره‌شده", type: "number", defaultValue: 50 },
    { name: "NoteFa", label: "سیاست نگهداشت و امحای قانونی", type: "textarea", span: 2 },
  ];

  const zonCols: ColumnSpec<Record<string, unknown>>[] = [
    { key: "ZoneCode", header: "کد زون", sortable: true },
    { key: "TitleFa", header: "عنوان زون بایگانی" },
    { key: "Classification", header: "طبقه اسناد" },
    { key: "StorageTier", header: "لایه ذخیره‌سازی" },
    { key: "RetentionYears", header: "نگهداری (سال)" },
    { key: "StoredDocsCount", header: "تعداد اسناد" },
    { key: "Status", header: "وضعیت" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {[
          { id: "search", label: "موتور جستجوی تمام‌متن (Full-Text Search روی متادیتا، OCR و دانش)" },
          { id: "ocr", label: "اسکن اسناد، استخراج متن (OCR) و نمایه‌سازی" },
          { id: "zones", label: "زون‌بندی بایگانی دیجیتال و جدول امحا/نگهداشت (ISO 15489)" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSubTab(t.id as typeof subTab)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              subTab === t.id
                ? "bg-teal-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === "search" && (
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
            <div className="text-sm font-bold text-slate-800">
              موتور جستجوی تمام‌متن یکپارچه در اسناد DMI، متون استخراج‌شده اسکن (OCR)، دروس آموخته و ویکی فنی
            </div>
            <div className="flex flex-col md:flex-row gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجوی عبارت فنی (مثلاً: توربوکمپرسور، دوبلکس، فورانگیر BOP، هم‌محوری لیزری، شیم‌پلیت)..."
                className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-xs text-slate-800"
              />
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800"
              >
                <option value="all">همهٔ منابع (DMI + OCR + Lessons + Wiki)</option>
                <option value="dmi">فقط شناسنامه اسناد (DMI)</option>
                <option value="ocr">فقط متن اسکن‌شده (OCR)</option>
                <option value="lessons">فقط دروس آموخته (Lessons Learned)</option>
                <option value="wiki">فقط مقالات پایگاه دانش (Wiki)</option>
              </select>
              <button
                type="button"
                onClick={runSearch}
                className="rounded-md bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700"
              >
                {searching ? "در حال جستجو..." : `جستجو (${searchHits.length} نتیجه)`}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {searchHits.map((hit) => (
              <div
                key={`${hit.sourceType}-${hit.id}`}
                className="rounded-lg border border-slate-200 bg-white p-3.5 shadow-xs hover:border-teal-400 transition"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-teal-50 px-2 py-0.5 text-[11px] font-bold text-teal-800 border border-teal-200">
                      {hit.sourceLabelFa}
                    </span>
                    <span className="font-mono text-xs font-bold text-indigo-700">{hit.code}</span>
                    <span className="text-xs font-bold text-slate-900">{hit.titleFa}</span>
                  </div>
                  <span className="text-[11px] text-slate-500">{hit.revisionOrCategory}</span>
                </div>
                <p className="mt-1.5 text-xs text-slate-700 leading-relaxed">{hit.snippetFa}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {subTab === "ocr" && (
        <EnterpriseCrudBlock title="اسکن اسناد، استخراج هوشمند متن (OCR) و نمایهٔ جستجوی تمام‌متن"
          subtitle="تبدیل اسناد کاغذی و نقشه‌های اسکن‌شده به متون قابل جستجو با ثبت کلیدواژه‌ها و شماره باکس فیزیکی"
          idKey="Id"
          rows={ocrRes.rows}
          columns={ocrCols}
          fields={ocrFields}
          loading={ocrRes.loading}
          error={ocrRes.error}
          onRefresh={ocrRes.reload}
          onCreate={canWrite ? ocrRes.onCreate : undefined}
          onUpdate={canWrite ? ocrRes.onUpdate : undefined}
          onDelete={canWrite ? ocrRes.onDelete : undefined}
        />
      )}

      {subTab === "zones" && (
        <EnterpriseCrudBlock title="زون‌بندی و طبقه‌بندی بایگانی دیجیتال و فیزیکی (ISO 15489 / ISO 30301)"
          subtitle="مدیریت خزانه‌های رمزنگاری‌شده AES-256، ذخیره‌سازی غیرقابل‌تغییر WORM و جدول زمان‌بندی نگهداری قانونی"
          idKey="Id"
          rows={zonRes.rows}
          columns={zonCols}
          fields={zonFields}
          loading={zonRes.loading}
          error={zonRes.error}
          onRefresh={zonRes.reload}
          onCreate={canWrite ? zonRes.onCreate : undefined}
          onUpdate={canWrite ? zonRes.onUpdate : undefined}
          onDelete={canWrite ? zonRes.onDelete : undefined}
        />
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
 * ۵. مدیریت دانش سازمانی (KMS: Lessons Learned & Knowledge Base Wiki)
 * ═══════════════════════════════════════════════════════════════════════════ */
export const EdmsKnowledgeManagementPanel: React.FC<PanelProps> = ({ projectId, userId, canWrite }) => {
  const [subTab, setSubTab] = useState<"lessons" | "wiki">("lessons");

  const lsnRes = useEdmsResource("lessons-learned", projectId, userId);
  const wikRes = useEdmsResource("knowledge-articles", projectId, userId);

  const lsnFields: FieldSpec[] = [
    { name: "LessonCode", label: "کد درس‌آموخته", type: "code", required: true },
    { name: "TitleFa", label: "عنوان درس‌آموخته فنی / اجرایی", type: "text", required: true },
    {
      name: "DomainPillar",
      label: "ستون سازمانی مرتبط",
      type: "select",
      defaultValue: "manufacturing-mes",
      options: [
        { value: "project-pmis", label: "پروژه‌ها و مهندسی (PMIS)" },
        { value: "manufacturing-mes", label: "ساخت و تولید صنعتی (MES)" },
        { value: "maintenance-cmms", label: "نگهداری و تعمیرات و قابلیت اطمینان (CMMS)" },
        { value: "supply-scm", label: "زنجیره تأمین، تدارکات و انبار (SCM)" },
        { value: "drilling-iiot", label: "پایش میدانی و عملیات حفاری (IIoT & Rig)" },
        { value: "hrm-safety", label: "منابع انسانی و ایمنی (HRM / HSE)" },
      ],
    },
    { name: "SourceContextFa", label: "پروژه، کارگاه یا دکل منشأ تجربه", type: "text", required: true },
    {
      name: "SeverityImpact",
      label: "سطح اهمیت و اثرگذاری",
      type: "select",
      defaultValue: "high",
      options: [
        { value: "strategic", label: "استراتژیک (جلوگیری از توقف کلیدی)" },
        { value: "high", label: "بالا" },
        { value: "medium", label: "متوسط" },
      ],
    },
    { name: "EstimatedSavingRials", label: "صرفه‌جویی مالی برآوردی از به‌کارگیری دانش (ریال)", type: "currency", defaultValue: 1200000000 },
    { name: "AuthorBy", label: "ثبت‌کننده تجربه", type: "code", defaultValue: "EMP-1003" },
    { name: "AppliedCount", label: "تعداد دفعات بازاستفاده در سازمان", type: "number", defaultValue: 5 },
    { name: "ProblemOrEventFa", label: "شرح رخداد، چالش یا مشکل فنی مشاهده‌شده", type: "textarea", required: true, span: 2 },
    { name: "RootCauseFa", label: "تحلیل علت ریشه‌ای (Root Cause)", type: "textarea", required: true, span: 2 },
    { name: "ActionAndLessonFa", label: "اقدام اصلاحی و توصیه استاندارد برای پروژه‌های آتی", type: "textarea", required: true, span: 2 },
  ];

  const lsnCols: ColumnSpec<Record<string, unknown>>[] = [
    { key: "LessonCode", header: "کد درس‌آموخته", sortable: true },
    { key: "TitleFa", header: "عنوان تجربه و درس‌آموخته", sortable: true },
    { key: "DomainPillar", header: "ستون تخصصی" },
    { key: "SourceContextFa", header: "محل رخداد" },
    { key: "SeverityImpact", header: "سطح اثر" },
    { key: "EstimatedSavingRials", header: "صرفه‌جویی برآوردی (ریال)", render: (r) => fmtRials(r.EstimatedSavingRials) },
    { key: "AppliedCount", header: "تعداد بازاستفاده" },
    { key: "Status", header: "وضعیت" },
  ];

  const wikFields: FieldSpec[] = [
    { name: "ArticleCode", label: "کد مقاله پایگاه دانش (Wiki)", type: "code", required: true },
    { name: "TitleFa", label: "عنوان مقاله، راهنما یا Best Practice", type: "text", required: true },
    {
      name: "ArticleType",
      label: "نوع محتوای دانش",
      type: "select",
      defaultValue: "best-practice",
      options: [
        { value: "best-practice", label: "تجربه برتر صنعتی (Best Practice)" },
        { value: "sop-procedure", label: "دستورالعمل استاندارد کارگاهی (SOP)" },
        { value: "troubleshooting-guide", label: "راهنمای عیب‌یابی سریع تجهیزات (Troubleshooting)" },
        { value: "engineering-standard", label: "استاندارد طراحی و مهندسی" },
      ],
    },
    { name: "KnowledgeAreaFa", label: "حوزه تخصصی دانش", type: "text", required: true },
    { name: "TagsCsv", label: "برچسب‌ها (جداشده با ویرگول)", type: "text", required: true },
    { name: "RefDocCode", label: "کد سند مرجع در DMI", type: "code" },
    { name: "AuthorBy", label: "نویسنده / متخصص", type: "code", defaultValue: "EMP-1002" },
    { name: "VersionNo", label: "نسخه مقاله", type: "number", defaultValue: 1 },
    { name: "SummaryFa", label: "چکیده مدیریتی و فنی مقاله", type: "textarea", required: true, span: 2 },
    { name: "BodyMarkdownFa", label: "متن کامل راهنما و گام‌های اجرایی", type: "textarea", required: true, span: 2 },
  ];

  const wikCols: ColumnSpec<Record<string, unknown>>[] = [
    { key: "ArticleCode", header: "کد مقاله", sortable: true },
    { key: "TitleFa", header: "عنوان مقاله پایگاه دانش / Wiki", sortable: true },
    { key: "ArticleType", header: "نوع محتوا" },
    { key: "KnowledgeAreaFa", header: "حوزه تخصصی" },
    { key: "RefDocCode", header: "سند مرجع DMI" },
    { key: "ViewCount", header: "بازدید" },
    { key: "HelpfulVotes", header: "امتیاز مفید بودن" },
    { key: "VersionNo", header: "نسخه" },
    { key: "Status", header: "وضعیت" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {[
          { id: "lessons", label: "بانک دروس آموخته‌شده در پروژه‌ها، تولید، نت و حفاری (Lessons Learned)" },
          { id: "wiki", label: "پایگاه دانش سازمانی، ویکی فنی و Best Practices (ISO 30401 KMS)" },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSubTab(t.id as typeof subTab)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              subTab === t.id
                ? "bg-teal-600 text-white shadow-xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === "lessons" && (
        <EnterpriseCrudBlock title="ثبت و بازاستفاده از دروس آموخته‌شده در پروژه‌ها و عملیات تولید (Lessons Learned)"
          subtitle="مستندسازی ریشه‌ای تجربیات فنی در ستون‌های PMIS، MES، CMMS، SCM و IIoT برای پیشگیری از تکرار خطاها"
          idKey="Id"
          rows={lsnRes.rows}
          columns={lsnCols}
          fields={lsnFields}
          loading={lsnRes.loading}
          error={lsnRes.error}
          onRefresh={lsnRes.reload}
          onCreate={canWrite ? lsnRes.onCreate : undefined}
          onUpdate={canWrite ? lsnRes.onUpdate : undefined}
          onDelete={canWrite ? lsnRes.onDelete : undefined}
        />
      )}

      {subTab === "wiki" && (
        <EnterpriseCrudBlock title="پایگاه دانش سازمانی و ویکی فنی (Organizational Knowledge Base & Best Practices — ISO 30401)"
          subtitle="نگهداری دستورالعمل‌های عیب‌یابی، راهنماهای هم‌محوری و ماشین‌کاری و انتقال دانش ضمنی خبرگان به نسل جدید"
          idKey="Id"
          rows={wikRes.rows}
          columns={wikCols}
          fields={wikFields}
          loading={wikRes.loading}
          error={wikRes.error}
          onRefresh={wikRes.reload}
          onCreate={canWrite ? wikRes.onCreate : undefined}
          onUpdate={canWrite ? wikRes.onUpdate : undefined}
          onDelete={canWrite ? wikRes.onDelete : undefined}
        />
      )}
    </div>
  );
};
