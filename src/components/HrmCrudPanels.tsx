/**
 * پنل‌های پنج‌گانهٔ بخش ۶ سازمان: مدیریت جامع منابع انسانی (Enterprise HRM)
 * منطبق با ISO 30414، ISO 10015 و قوانین کار و تأمین اجتماعی ایران.
 */
import React, { useCallback, useEffect, useState } from "react";
import CrudResource from "./crud/CrudResource";
import type { FormFieldDef } from "./crud/formLogic";
import type { GridColumnDef } from "./crud/gridLogic";
import {
  createHrmCrudClient,
  fetchHrmWorkspace,
  runHrmMonthlyPayroll,
  type HrmWorkspaceSummary,
} from "../services/hrmEnterpriseApi";

interface PanelProps {
  projectId: string;
  userId: string;
  canWrite: boolean;
  canApprove?: boolean;
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
        persianDates
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

function useHrmResource<T extends Record<string, unknown>>(resourcePath: string, projectId: string, userId: string) {
  const client = React.useMemo(() => createHrmCrudClient<T>(resourcePath), [resourcePath]);
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
 * ۱. مدیریت اطلاعات پرسنلی، چارت سازمانی، احکام، قراردادها و ماتریس مهارت
 * ═══════════════════════════════════════════════════════════════════════════ */
export const HrmPersonnelOrgPanel: React.FC<PanelProps> = ({ projectId, userId, canWrite }) => {
  const [subTab, setSubTab] = useState<"profiles" | "org" | "actions" | "contracts" | "skills">("profiles");
  const [summary, setSummary] = useState<HrmWorkspaceSummary | null>(null);

  useEffect(() => {
    fetchHrmWorkspace(projectId, userId).then(setSummary).catch(() => setSummary(null));
  }, [projectId, userId]);

  const orgRes = useHrmResource("org-units", projectId, userId);
  const profRes = useHrmResource("personnel-profiles", projectId, userId);
  const actRes = useHrmResource("personnel-actions", projectId, userId);
  const cntRes = useHrmResource("contracts", projectId, userId);
  const sklRes = useHrmResource("skill-matrix", projectId, userId);

  const orgFields: FieldSpec[] = [
    { name: "Code", label: "کد واحد سازمانی", type: "code", required: true },
    { name: "TitleFa", label: "عنوان فارسی واحد", type: "text", required: true },
    { name: "TitleEn", label: "عنوان انگلیسی", type: "text" },
    {
      name: "UnitType",
      label: "سطح سازمانی",
      type: "select",
      required: true,
      defaultValue: "department",
      options: [
        { value: "executive", label: "مدیریت ارشد / ستاد (Executive)" },
        { value: "division", label: "معاونت (Division)" },
        { value: "department", label: "مدیریت / اداره (Department)" },
        { value: "workshop", label: "کارگاه تولید / ساخت (MES Workshop)" },
        { value: "rig-crew", label: "عملیات دکل حفاری (IIoT Rig Crew)" },
      ],
    },
    { name: "ParentUnitCode", label: "کد واحد مافوق", type: "code" },
    { name: "ManagerPersonNo", label: "کد پرسنلی مدیر واحد", type: "code" },
    { name: "CostCenterRef", label: "مرکز هزینه مالی (FinRef)", type: "code" },
    { name: "ApprovedHeadcount", label: "سقف مصوب نفرات", type: "number", required: true, defaultValue: 10 },
    { name: "CurrentHeadcount", label: "نفرات شاغل فعلی", type: "number", required: true, defaultValue: 8 },
    {
      name: "Status",
      label: "وضعیت",
      type: "select",
      defaultValue: "active",
      options: [
        { value: "active", label: "فعال" },
        { value: "restructuring", label: "در حال بازآرایی" },
        { value: "inactive", label: "غیرفعال" },
      ],
    },
    { name: "NoteFa", label: "توضیحات چارت سازمانی", type: "textarea", span: 2 },
  ];

  const orgCols: ColumnSpec<Record<string, unknown>>[] = [
    { key: "Code", header: "کد واحد", sortable: true },
    { key: "TitleFa", header: "عنوان واحد سازمانی", sortable: true },
    { key: "UnitType", header: "سطح واحد" },
    { key: "ParentUnitCode", header: "واحد مافوق" },
    { key: "ManagerPersonNo", header: "مدیر واحد" },
    { key: "CostCenterRef", header: "مرکز هزینه مالی" },
    { key: "ApprovedHeadcount", header: "سقف مصوب" },
    { key: "CurrentHeadcount", header: "شاغل فعلی" },
    { key: "Status", header: "وضعیت" },
  ];

  const profFields: FieldSpec[] = [
    { name: "PersonnelNo", label: "شماره پرسنلی", type: "code", required: true },
    { name: "FullNameFa", label: "نام و نام خانوادگی", type: "text", required: true },
    { name: "NationalId", label: "کد ملی", type: "code", required: true },
    { name: "HireDate", label: "تاریخ استخدام", type: "date", required: true },
    {
      name: "EmploymentType",
      label: "نوع استخدام",
      type: "select",
      required: true,
      defaultValue: "contractual",
      options: [
        { value: "permanent", label: "رسمی / دائم" },
        { value: "contractual", label: "قراردادی مدت‌معین" },
        { value: "rotational-rig", label: "اقماری دکل حفاری (۱۴/۱۴)" },
        { value: "project-based", label: "پروژه‌ای" },
        { value: "consultant", label: "مشاور" },
      ],
    },
    { name: "OrgUnitCode", label: "کد واحد سازمانی", type: "code", required: true },
    { name: "JobTitleFa", label: "عنوان پست سازمانی", type: "text", required: true },
    { name: "JobGrade", label: "گروه شغلی (۱ تا ۲۰)", type: "code", defaultValue: "G-14" },
    {
      name: "EducationLevel",
      label: "مقطع تحصیلی",
      type: "select",
      defaultValue: "bachelor",
      options: [
        { value: "diploma", label: "دیپلم فنی" },
        { value: "associate", label: "کاردانی" },
        { value: "bachelor", label: "کارشناسی" },
        { value: "master", label: "کارشناسی ارشد" },
        { value: "phd", label: "دکتری" },
      ],
    },
    { name: "InsuranceNo", label: "شماره بیمه تأمین اجتماعی", type: "code" },
    { name: "CmmsTechnicianRef", label: "کد تکنسین در CMMS (ارجاع نرم)", type: "code" },
    { name: "MesOperatorRef", label: "کد مرکز کاری در MES (ارجاع نرم)", type: "code" },
    {
      name: "Status",
      label: "وضعیت اشتغال",
      type: "select",
      defaultValue: "active",
      options: [
        { value: "active", label: "شاغل فعال" },
        { value: "on-leave", label: "مرخصی" },
        { value: "mission", label: "مأموریت" },
        { value: "terminated", label: "خاتمه همکاری" },
      ],
    },
    { name: "NoteFa", label: "سوابق و ملاحظات پرونده پرسنلی", type: "textarea", span: 2 },
  ];

  const profCols: ColumnSpec<Record<string, unknown>>[] = [
    { key: "PersonnelNo", header: "کد پرسنلی", sortable: true },
    { key: "FullNameFa", header: "نام و نام خانوادگی", sortable: true },
    { key: "OrgUnitCode", header: "واحد سازمانی" },
    { key: "JobTitleFa", header: "پست سازمانی" },
    { key: "JobGrade", header: "گروه شغلی" },
    { key: "EmploymentType", header: "نوع استخدام" },
    { key: "CmmsTechnicianRef", header: "پیوند CMMS" },
    { key: "MesOperatorRef", header: "پیوند MES" },
    { key: "Status", header: "وضعیت" },
  ];

  const actFields: FieldSpec[] = [
    { name: "ActionNo", label: "شماره حکم کارگزینی", type: "code", required: true },
    { name: "PersonnelNo", label: "شماره پرسنلی", type: "code", required: true },
    {
      name: "ActionType",
      label: "نوع حکم کارگزینی",
      type: "select",
      required: true,
      defaultValue: "salary-revision",
      options: [
        { value: "hire", label: "استخدام / شروع به کار" },
        { value: "promotion", label: "ارتقای گروه و پست شغلی" },
        { value: "transfer", label: "انتقال سازمانی" },
        { value: "salary-revision", label: "اصلاح حکم حقوقی سالانه" },
        { value: "shift-change", label: "تغییر الگوی شیفت / اقماری" },
      ],
    },
    { name: "EffectiveDate", label: "تاریخ اجرا", type: "date", required: true },
    { name: "FromJobGrade", label: "گروه شغلی قبلی", type: "code" },
    { name: "ToJobGrade", label: "گروه شغلی جدید", type: "code", required: true },
    { name: "BaseSalaryRials", label: "مزد مبنا / پایه (ریال)", type: "currency", required: true, defaultValue: 360000000 },
    { name: "HousingAllowanceRials", label: "حق مسکن مصوب (ریال)", type: "currency", defaultValue: 45000000 },
    { name: "FoodAllowanceRials", label: "بن خواربار و رفاهی (ریال)", type: "currency", defaultValue: 55000000 },
    { name: "ChildAllowanceRials", label: "حق اولاد / عائله‌مندی (ریال)", type: "currency", defaultValue: 16000000 },
    { name: "SeniorityAllowanceRials", label: "پایه سنوات (ریال)", type: "currency", defaultValue: 20000000 },
    {
      name: "Status",
      label: "وضعیت حکم",
      type: "select",
      defaultValue: "issued",
      options: [
        { value: "draft", label: "پیش‌نویس" },
        { value: "issued", label: "صادرشده و نافذ" },
        { value: "superseded", label: "جایگزین‌شده" },
      ],
    },
    { name: "NoteFa", label: "شرح حکم کارگزینی", type: "textarea", span: 2 },
  ];

  const actCols: ColumnSpec<Record<string, unknown>>[] = [
    { key: "ActionNo", header: "شماره حکم", sortable: true },
    { key: "PersonnelNo", header: "شماره پرسنلی", sortable: true },
    { key: "ActionType", header: "نوع حکم" },
    { key: "EffectiveDate", header: "تاریخ اجرا" },
    { key: "ToJobGrade", header: "گروه شغلی" },
    { key: "BaseSalaryRials", header: "مزد مبنا (ریال)", render: (r) => fmtRials(r.BaseSalaryRials) },
    { key: "HousingAllowanceRials", header: "حق مسکن", render: (r) => fmtRials(r.HousingAllowanceRials) },
    { key: "FoodAllowanceRials", header: "بن خواربار", render: (r) => fmtRials(r.FoodAllowanceRials) },
    { key: "Status", header: "وضعیت" },
  ];

  const cntFields: FieldSpec[] = [
    { name: "ContractNo", label: "شماره قرارداد کار", type: "code", required: true },
    { name: "PersonnelNo", label: "شماره پرسنلی", type: "code", required: true },
    {
      name: "ContractType",
      label: "نوع قرارداد (ماده ۷ قانون کار)",
      type: "select",
      defaultValue: "fixed-term",
      options: [
        { value: "fixed-term", label: "مدت‌معین" },
        { value: "permanent", label: "دائم / غیرموقت" },
        { value: "project-phase", label: "کار معین / فاز پروژه" },
        { value: "hourly", label: "ساعتی" },
      ],
    },
    { name: "StartDate", label: "تاریخ شروع قرارداد", type: "date", required: true },
    { name: "EndDate", label: "تاریخ پایان قرارداد", type: "date", required: true },
    { name: "BaseMonthlyRials", label: "مبلغ ناخالص ماهانه (ریال)", type: "currency", required: true, defaultValue: 500000000 },
    { name: "WeeklyHours", label: "ساعت کار هفتگی", type: "number", defaultValue: 44 },
    { name: "WorkLocationFa", label: "محل خدمت", type: "text", required: true },
    {
      name: "Status",
      label: "وضعیت قرارداد",
      type: "select",
      defaultValue: "active",
      options: [
        { value: "draft", label: "پیش‌نویس" },
        { value: "active", label: "فعال و جاری" },
        { value: "renewed", label: "تمدیدشده" },
        { value: "expired", label: "منقضی" },
      ],
    },
    { name: "NoteFa", label: "شرایط اختصاصی قرارداد", type: "textarea", span: 2 },
  ];

  const cntCols: ColumnSpec<Record<string, unknown>>[] = [
    { key: "ContractNo", header: "شماره قرارداد", sortable: true },
    { key: "PersonnelNo", header: "کد پرسنلی", sortable: true },
    { key: "ContractType", header: "نوع قرارداد" },
    { key: "StartDate", header: "تاریخ شروع" },
    { key: "EndDate", header: "تاریخ پایان" },
    { key: "BaseMonthlyRials", header: "حقوق ماهانه (ریال)", render: (r) => fmtRials(r.BaseMonthlyRials) },
    { key: "WorkLocationFa", header: "محل خدمت" },
    { key: "Status", header: "وضعیت" },
  ];

  const sklFields: FieldSpec[] = [
    { name: "MatrixCode", label: "کد رکورد ماتریس مهارت", type: "code", required: true },
    { name: "PersonnelNo", label: "شماره پرسنلی", type: "code", required: true },
    { name: "SkillCode", label: "کد مهارت استاندارد", type: "code", required: true },
    { name: "SkillTitleFa", label: "عنوان مهارت و صلاحیت فنی", type: "text", required: true },
    {
      name: "Discipline",
      label: "رسته تخصصی",
      type: "select",
      defaultValue: "mechanical",
      options: [
        { value: "cnc-machining", label: "ماشین‌کاری CNC و ساخت (MES)" },
        { value: "welding", label: "جوشکاری تحت فشار ASME (MES)" },
        { value: "mechanical", label: "تعمیرات مکانیک و دوار (CMMS)" },
        { value: "electrical", label: "برق صنعتی و قدرت (CMMS)" },
        { value: "instrumentation", label: "ابزار دقیق و کنترل (IIoT/CMMS)" },
        { value: "rig-operations", label: "عملیات حفاری و کنترل فوران (IWCF)" },
        { value: "hse", label: "ایمنی و بهداشت شغلی (HSE)" },
      ],
    },
    { name: "ProficiencyLevel", label: "سطح مهارت ILUO (۱ تا ۵)", type: "number", required: true, defaultValue: 4 },
    { name: "CertificateNo", label: "شماره گواهی‌نامه معتبر", type: "code" },
    { name: "IssuedDate", label: "تاریخ صدور گواهی", type: "date" },
    { name: "ExpiryDate", label: "تاریخ انقضای گواهی", type: "date" },
    { name: "CmmsAssetFamilyRef", label: "خانواده تجهیز مرتبط در CMMS", type: "code" },
    { name: "MesWorkCenterRef", label: "مرکز کاری مرتبط در MES", type: "code" },
    {
      name: "Status",
      label: "وضعیت اعتبار گواهی",
      type: "select",
      defaultValue: "valid",
      options: [
        { value: "valid", label: "معتبر (Valid)" },
        { value: "expiring-soon", label: "در آستانه انقضا" },
        { value: "expired", label: "منقضی‌شده" },
      ],
    },
    { name: "NoteFa", label: "توضیحات ممیزی صلاحیت", type: "textarea", span: 2 },
  ];

  const sklCols: ColumnSpec<Record<string, unknown>>[] = [
    { key: "MatrixCode", header: "کد ماتریس", sortable: true },
    { key: "PersonnelNo", header: "شماره پرسنلی", sortable: true },
    { key: "SkillTitleFa", header: "مهارت و گواهی‌نامه فنی" },
    { key: "Discipline", header: "رسته" },
    { key: "ProficiencyLevel", header: "سطح (۱-۵)" },
    { key: "CertificateNo", header: "شماره گواهی" },
    { key: "ExpiryDate", header: "تاریخ انقضا" },
    { key: "CmmsAssetFamilyRef", header: "خانواده تجهیز CMMS" },
    { key: "MesWorkCenterRef", header: "مرکز کاری MES" },
    { key: "Status", header: "وضعیت اعتبار" },
  ];

  return (
    <div className="space-y-4">
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
            <div className="text-xs text-slate-500">واحدهای چارت سازمانی</div>
            <div className="text-lg font-bold text-slate-800">{summary.kpis.orgUnitsCount} واحد</div>
            <div className="text-[11px] text-emerald-700">
              ظرفیت مصوب: {summary.kpis.approvedHeadcount} نفر (شاغل: {summary.kpis.currentHeadcount})
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
            <div className="text-xs text-slate-500">پرونده‌های پرسنلی فعال</div>
            <div className="text-lg font-bold text-slate-800">{summary.kpis.activeProfilesCount} نفر</div>
            <div className="text-[11px] text-slate-600">منطبق با شاخص‌های ISO 30414</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
            <div className="text-xs text-slate-500">قراردادهای کار جاری</div>
            <div className="text-lg font-bold text-slate-800">{summary.kpis.activeContractsCount} قرارداد</div>
            <div className="text-[11px] text-slate-600">ماده ۷ قانون کار + بیمه تأمین اجتماعی</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
            <div className="text-xs text-slate-500">گواهی‌نامه‌های فنی معتبر</div>
            <div className="text-lg font-bold text-emerald-700">{summary.kpis.validCertificatesCount} گواهی</div>
            <div className="text-[11px] text-amber-700">
              نیازمند تمدید: {summary.kpis.expiringCertificatesCount} مورد
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-xs">
            <div className="text-xs text-slate-500">یکپارچگی مهارت با CMMS / MES</div>
            <div className="text-lg font-bold text-indigo-700">
              {summary.kpis.cmmsLinkedSkillsCount} نت · {summary.kpis.mesLinkedSkillsCount} تولید
            </div>
            <div className="text-[11px] text-slate-600">کنترل صلاحیت اپراتور و تکنسین</div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {[
          { id: "profiles", label: "پرونده جامع پرسنلی" },
          { id: "org", label: "چارت و ساختار سازمانی" },
          { id: "actions", label: "احکام کارگزینی" },
          { id: "contracts", label: "قراردادهای کار" },
          { id: "skills", label: "ماتریس مهارت‌ها و گواهی‌نامه‌ها (CMMS/MES)" },
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

      {subTab === "profiles" && (
        <EnterpriseCrudBlock title="شناسنامه و پرونده جامع پرسنلی (ISO 30414 Workforce Registry)"
          subtitle="مدیریت اطلاعات استخدامی، کد بیمه تأمین اجتماعی، گروه شغلی و اتصال نرم به تکنسین‌های CMMS و اپراتورهای MES"
          idKey="Id"
          rows={profRes.rows}
          columns={profCols}
          fields={profFields}
          loading={profRes.loading}
          error={profRes.error}
          onRefresh={profRes.reload}
          onCreate={canWrite ? profRes.onCreate : undefined}
          onUpdate={canWrite ? profRes.onUpdate : undefined}
          onDelete={canWrite ? profRes.onDelete : undefined}
        />
      )}

      {subTab === "org" && (
        <EnterpriseCrudBlock title="ساختار و چارت سازمانی (Organizational Hierarchy & Headcount)"
          subtitle="تعریف واحدهای سازمانی، کارگاه‌های تولید، اکیپ‌های دکل حفاری، سقف مصوب نفرات و مراکز هزینه مالی"
          idKey="Id"
          rows={orgRes.rows}
          columns={orgCols}
          fields={orgFields}
          loading={orgRes.loading}
          error={orgRes.error}
          onRefresh={orgRes.reload}
          onCreate={canWrite ? orgRes.onCreate : undefined}
          onUpdate={canWrite ? orgRes.onUpdate : undefined}
          onDelete={canWrite ? orgRes.onDelete : undefined}
        />
      )}

      {subTab === "actions" && (
        <EnterpriseCrudBlock title="احکام کارگزینی و پرسنلی (Personnel Decrees & Job Classification)"
          subtitle="صدور احکام استخدام، ارتقای گروه شغلی، انتقال و بازنگری مزد مبنا، حق مسکن، بن خواربار و پایه سنوات"
          idKey="Id"
          rows={actRes.rows}
          columns={actCols}
          fields={actFields}
          loading={actRes.loading}
          error={actRes.error}
          onRefresh={actRes.reload}
          onCreate={canWrite ? actRes.onCreate : undefined}
          onUpdate={canWrite ? actRes.onUpdate : undefined}
          onDelete={canWrite ? actRes.onDelete : undefined}
        />
      )}

      {subTab === "contracts" && (
        <EnterpriseCrudBlock title="قراردادهای کار پرسنل (Employment Contracts — Iran Labor Law Art. 7)"
          subtitle="مدیریت قراردادهای مدت‌معین، دائم و فاز پروژه با پوشش بیمه تأمین اجتماعی"
          idKey="Id"
          rows={cntRes.rows}
          columns={cntCols}
          fields={cntFields}
          loading={cntRes.loading}
          error={cntRes.error}
          onRefresh={cntRes.reload}
          onCreate={canWrite ? cntRes.onCreate : undefined}
          onUpdate={canWrite ? cntRes.onUpdate : undefined}
          onDelete={canWrite ? cntRes.onDelete : undefined}
        />
      )}

      {subTab === "skills" && (
        <EnterpriseCrudBlock title="ماتریس مهارت‌ها و گواهی‌نامه‌های فنی/کارگاهی (Skill Matrix Linked to CMMS & MES)"
          subtitle="پایش سطح مهارت ۱ تا ۵ (ILUO)، اعتبار گواهی‌های جوشکاری ASME، ارتعاش‌سنجی ISO 18436 و کنترل فوران چاه IWCF"
          idKey="Id"
          rows={sklRes.rows}
          columns={sklCols}
          fields={sklFields}
          loading={sklRes.loading}
          error={sklRes.error}
          onRefresh={sklRes.reload}
          onCreate={canWrite ? sklRes.onCreate : undefined}
          onUpdate={canWrite ? sklRes.onUpdate : undefined}
          onDelete={canWrite ? sklRes.onDelete : undefined}
        />
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
 * ۲. حضور و غیاب، شیفت‌های کارگاهی/دکلی و یکپارچگی کارکرد با CMMS و MES
 * ═══════════════════════════════════════════════════════════════════════════ */
export const HrmAttendanceShiftPanel: React.FC<PanelProps> = ({ projectId, userId, canWrite }) => {
  const [subTab, setSubTab] = useState<"rosters" | "patterns" | "leaves" | "missions">("rosters");

  const patRes = useHrmResource("shift-patterns", projectId, userId);
  const rstRes = useHrmResource("shift-rosters", projectId, userId);
  const lveRes = useHrmResource("leaves", projectId, userId);
  const msnRes = useHrmResource("missions", projectId, userId);

  const rstFields: FieldSpec[] = [
    { name: "RosterCode", label: "کد ثبت کارکرد", type: "code", required: true },
    { name: "PersonnelNo", label: "شماره پرسنلی", type: "code", required: true },
    { name: "ShiftCode", label: "کد الگوی شیفت", type: "code", required: true, defaultValue: "SHF-SHOP-3X8" },
    { name: "WorkDate", label: "تاریخ کارکرد", type: "date", required: true },
    { name: "CheckInClock", label: "ساعت ورود", type: "text", defaultValue: "07:00" },
    { name: "CheckOutClock", label: "ساعت خروج", type: "text", defaultValue: "17:30" },
    { name: "NormalHours", label: "ساعت کار عادی", type: "number", required: true, defaultValue: 8 },
    { name: "OvertimeHours", label: "ساعت اضافه‌کاری (ماده ۵۹)", type: "number", defaultValue: 2 },
    { name: "NightHours", label: "ساعت شب‌کاری (ماده ۵۸)", type: "number", defaultValue: 0 },
    {
      name: "AttendanceState",
      label: "وضعیت حضور",
      type: "select",
      defaultValue: "present",
      options: [
        { value: "present", label: "حاضر در شیفت" },
        { value: "mission", label: "مأموریت" },
        { value: "leave", label: "مرخصی" },
        { value: "off-rotation", label: "استراحت اقماری دکل (Off-Rotation)" },
        { value: "absent", label: "غیبت" },
      ],
    },
    { name: "CmmsWorkOrderRef", label: "شماره دستورکار نت (CMMS WO Ref)", type: "code" },
    { name: "MesOrderRef", label: "شماره سفارش تولید (MES Order Ref)", type: "code" },
    { name: "MesOperationCode", label: "کد عملیات تولید (MES Op)", type: "code" },
    {
      name: "Status",
      label: "وضعیت تأیید کارکرد",
      type: "select",
      defaultValue: "verified",
      options: [
        { value: "recorded", label: "ثبت اولیه" },
        { value: "verified", label: "تأییدشده سرپرست" },
        { value: "locked", label: "قفل‌شده برای حقوق" },
      ],
    },
    { name: "NoteFa", label: "شرح فعالیت انجام‌شده روی دستورکار/سفارش", type: "textarea", span: 2 },
  ];

  const rstCols: ColumnSpec<Record<string, unknown>>[] = [
    { key: "RosterCode", header: "کد کارکرد", sortable: true },
    { key: "PersonnelNo", header: "کد پرسنلی", sortable: true },
    { key: "ShiftCode", header: "الگوی شیفت" },
    { key: "WorkDate", header: "تاریخ" },
    { key: "NormalHours", header: "ساعت عادی" },
    { key: "OvertimeHours", header: "اضافه‌کاری" },
    { key: "NightHours", header: "شب‌کاری" },
    { key: "CmmsWorkOrderRef", header: "دستورکار CMMS" },
    { key: "MesOrderRef", header: "سفارش تولید MES" },
    { key: "Status", header: "وضعیت" },
  ];

  const patFields: FieldSpec[] = [
    { name: "ShiftCode", label: "کد شیفت", type: "code", required: true },
    { name: "TitleFa", label: "عنوان الگوی شیفت و تقویم", type: "text", required: true },
    {
      name: "PatternType",
      label: "نوع چرخه شیفت",
      type: "select",
      defaultValue: "three-shift",
      options: [
        { value: "day-regular", label: "روزکار عادی (شنبه تا چهارشنبه)" },
        { value: "two-shift", label: "دونوبته صبح و عصر (۱۰٪ نوبت‌کاری)" },
        { value: "three-shift", label: "سه‌نوبته ۲۴ ساعته کارگاهی (۲۲.۵٪ نوبت‌کاری)" },
        { value: "rotational-14-14", label: "اقماری ۱۴ روز کار / ۱۴ روز استراحت دکل" },
        { value: "rotational-21-7", label: "اقماری ۲۱ روز کار / ۷ روز استراحت سایت" },
      ],
    },
    { name: "StartClock", label: "ساعت شروع شیفت", type: "text", defaultValue: "07:00" },
    { name: "EndClock", label: "ساعت پایان شیفت", type: "text", defaultValue: "15:00" },
    { name: "WorkDaysCycle", label: "روزهای کار در چرخه", type: "number", defaultValue: 6 },
    { name: "RestDaysCycle", label: "روزهای استراحت در چرخه", type: "number", defaultValue: 2 },
    { name: "StandardDailyHours", label: "ساعت موظف روزانه", type: "number", defaultValue: 8 },
    { name: "ShiftAllowancePct", label: "فوق‌العاده نوبت‌کاری (٪ ماده ۵۶)", type: "number", defaultValue: 22.5 },
    { name: "NightBonusPct", label: "فوق‌العاده شب‌کاری (٪ ماده ۵۸)", type: "number", defaultValue: 35 },
    { name: "NoteFa", label: "توضیحات تقویم کاری", type: "textarea", span: 2 },
  ];

  const patCols: ColumnSpec<Record<string, unknown>>[] = [
    { key: "ShiftCode", header: "کد شیفت", sortable: true },
    { key: "TitleFa", header: "عنوان الگوی شیفت" },
    { key: "PatternType", header: "نوع چرخه" },
    { key: "StartClock", header: "شروع" },
    { key: "EndClock", header: "پایان" },
    { key: "WorkDaysCycle", header: "روز کار" },
    { key: "RestDaysCycle", header: "روز استراحت" },
    { key: "ShiftAllowancePct", header: "نوبت‌کاری (٪)" },
    { key: "NightBonusPct", header: "شب‌کاری (٪)" },
  ];

  const lveFields: FieldSpec[] = [
    { name: "LeaveNo", label: "شماره درخواست مرخصی", type: "code", required: true },
    { name: "PersonnelNo", label: "شماره پرسنلی", type: "code", required: true },
    {
      name: "LeaveType",
      label: "نوع مرخصی",
      type: "select",
      defaultValue: "annual",
      options: [
        { value: "annual", label: "استحقاقی سالانه (ماده ۶۴ قانون کار)" },
        { value: "sick", label: "استعلاجی" },
        { value: "without-pay", label: "بدون حقوق" },
        { value: "emergency", label: "اضطراری / ساعتی" },
      ],
    },
    { name: "FromDate", label: "از تاریخ", type: "date", required: true },
    { name: "ToDate", label: "تا تاریخ", type: "date", required: true },
    { name: "DaysCount", label: "تعداد روز", type: "number", required: true, defaultValue: 2 },
    { name: "ReplacementPersonNo", label: "کد پرسنلی جانشین در شیفت", type: "code" },
    {
      name: "Status",
      label: "وضعیت تأیید",
      type: "select",
      defaultValue: "approved",
      options: [
        { value: "pending", label: "در انتظار بررسی" },
        { value: "approved", label: "تأییدشده" },
        { value: "rejected", label: "ردشده" },
      ],
    },
    { name: "NoteFa", label: "توضیحات مرخصی و هماهنگی شیفت", type: "textarea", span: 2 },
  ];

  const lveCols: ColumnSpec<Record<string, unknown>>[] = [
    { key: "LeaveNo", header: "شماره مرخصی", sortable: true },
    { key: "PersonnelNo", header: "کد پرسنلی" },
    { key: "LeaveType", header: "نوع مرخصی" },
    { key: "FromDate", header: "از تاریخ" },
    { key: "ToDate", header: "تا تاریخ" },
    { key: "DaysCount", header: "تعداد روز" },
    { key: "ReplacementPersonNo", header: "جانشین شیفت" },
    { key: "Status", header: "وضعیت" },
  ];

  const msnFields: FieldSpec[] = [
    { name: "MissionNo", label: "شماره حکم مأموریت", type: "code", required: true },
    { name: "PersonnelNo", label: "شماره پرسنلی", type: "code", required: true },
    { name: "DestinationFa", label: "مقصد مأموریت (سایت/کارخانه/دکل)", type: "text", required: true },
    { name: "PurposeFa", label: "موضوع و هدف فنی مأموریت", type: "text", required: true },
    { name: "FromDate", label: "تاریخ اعزام", type: "date", required: true },
    { name: "ToDate", label: "تاریخ بازگشت", type: "date", required: true },
    { name: "DaysCount", label: "مدت (روز)", type: "number", required: true, defaultValue: 3 },
    { name: "MissionAllowanceRials", label: "فوق‌العاده مأموریت (ماده ۴۶ - ریال)", type: "currency", defaultValue: 36000000 },
    { name: "TransportCostRials", label: "هزینه ایاب و ذهاب و اسکان (ریال)", type: "currency", defaultValue: 24000000 },
    { name: "CmmsSiteRef", label: "سایت/کارخانه مقصد (CMMS/MES Ref)", type: "code" },
    {
      name: "Status",
      label: "وضعیت حکم مأموریت",
      type: "select",
      defaultValue: "approved",
      options: [
        { value: "draft", label: "پیش‌نویس" },
        { value: "approved", label: "ابلاغ‌شده" },
        { value: "completed", label: "انجام‌شده" },
        { value: "settled", label: "تسویه‌شده در مالی" },
      ],
    },
    { name: "NoteFa", label: "گزارش خلاصه مأموریت", type: "textarea", span: 2 },
  ];

  const msnCols: ColumnSpec<Record<string, unknown>>[] = [
    { key: "MissionNo", header: "شماره حکم", sortable: true },
    { key: "PersonnelNo", header: "کد پرسنلی" },
    { key: "DestinationFa", header: "مقصد مأموریت" },
    { key: "PurposeFa", header: "موضوع مأموریت" },
    { key: "FromDate", header: "اعزام" },
    { key: "ToDate", header: "بازگشت" },
    { key: "MissionAllowanceRials", header: "فوق‌العاده مأموریت", render: (r) => fmtRials(r.MissionAllowanceRials) },
    { key: "CmmsSiteRef", header: "سایت مقصد" },
    { key: "Status", header: "وضعیت" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {[
          { id: "rosters", label: "کارکرد روزانه و تخصیص نفرساعت به CMMS / MES" },
          { id: "patterns", label: "تقویم‌های کاری و شیفت‌های کارگاهی/اقماری دکل" },
          { id: "leaves", label: "مدیریت مرخصی‌ها و جانشینی شیفت" },
          { id: "missions", label: "احکام مأموریت‌های فنی و اعزام به سایت" },
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

      {subTab === "rosters" && (
        <EnterpriseCrudBlock title="ثبت کارکرد روزانه، اضافه‌کاری و تخصیص نفرساعت به دستورکار نت (CMMS) و سفارش تولید (MES)"
          subtitle="یکپارچگی کامل ساعت حضور تکنسین‌ها و اپراتورها با پیشرفت دستورکارهای نت و عملیات ساخت برای محاسبه بهای تمام‌شده"
          idKey="Id"
          rows={rstRes.rows}
          columns={rstCols}
          fields={rstFields}
          loading={rstRes.loading}
          error={rstRes.error}
          onRefresh={rstRes.reload}
          onCreate={canWrite ? rstRes.onCreate : undefined}
          onUpdate={canWrite ? rstRes.onUpdate : undefined}
          onDelete={canWrite ? rstRes.onDelete : undefined}
        />
      )}

      {subTab === "patterns" && (
        <EnterpriseCrudBlock title="تقویم‌های کاری و الگوهای شیفت‌بندی کارگاهی و اقماری دکل (Shift Patterns)"
          subtitle="پشتیبانی از شیفت‌های سه‌نوبته ۲۴ ساعته (۲۲.۵٪ نوبت‌کاری)، اقماری ۱۴-۱۴ دکل حفاری و شب‌کاری ۳۵٪ منطبق با مواد ۵۱ تا ۵۸ قانون کار"
          idKey="Id"
          rows={patRes.rows}
          columns={patCols}
          fields={patFields}
          loading={patRes.loading}
          error={patRes.error}
          onRefresh={patRes.reload}
          onCreate={canWrite ? patRes.onCreate : undefined}
          onUpdate={canWrite ? patRes.onUpdate : undefined}
          onDelete={canWrite ? patRes.onDelete : undefined}
        />
      )}

      {subTab === "leaves" && (
        <EnterpriseCrudBlock title="مدیریت درخواست‌های مرخصی استحقاقی، استعلاجی و کنترل جانشین شیفت"
          subtitle="ثبت و گردش تأیید مرخصی‌ها با کنترل عدم تداخل با شیفت‌های بحرانی تولید و تعمیرات"
          idKey="Id"
          rows={lveRes.rows}
          columns={lveCols}
          fields={lveFields}
          loading={lveRes.loading}
          error={lveRes.error}
          onRefresh={lveRes.reload}
          onCreate={canWrite ? lveRes.onCreate : undefined}
          onUpdate={canWrite ? lveRes.onUpdate : undefined}
          onDelete={canWrite ? lveRes.onDelete : undefined}
        />
      )}

      {subTab === "missions" && (
        <EnterpriseCrudBlock title="احکام مأموریت‌های فنی، اعزام به سایت و دکل‌های عملیاتی"
          subtitle="محاسبه فوق‌العاده مأموریت (ماده ۴۶ قانون کار) و هزینه‌های سفر متصل به سایت‌های CMMS و کارخانه‌های MES"
          idKey="Id"
          rows={msnRes.rows}
          columns={msnCols}
          fields={msnFields}
          loading={msnRes.loading}
          error={msnRes.error}
          onRefresh={msnRes.reload}
          onCreate={canWrite ? msnRes.onCreate : undefined}
          onUpdate={canWrite ? msnRes.onUpdate : undefined}
          onDelete={canWrite ? msnRes.onDelete : undefined}
        />
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
 * ۳. حقوق و دستمزد، کسورات قانونی، فیش حقوقی و تسهیم هزینه به مالی
 * ═══════════════════════════════════════════════════════════════════════════ */
export const HrmPayrollCompensationPanel: React.FC<PanelProps> = ({ projectId, userId, canWrite, canApprove }) => {
  const [subTab, setSubTab] = useState<"payslips" | "runs" | "vouchers">("payslips");
  const [calcPeriod, setCalcPeriod] = useState("1405-08");
  const [calcBusy, setCalcBusy] = useState(false);
  const [calcFeedback, setCalcFeedback] = useState<string | null>(null);

  const runRes = useHrmResource("payroll-runs", projectId, userId);
  const slpRes = useHrmResource("payslips", projectId, userId);
  const vchRes = useHrmResource("cost-vouchers", projectId, userId);

  const handleCalculatePayroll = async () => {
    setCalcBusy(true);
    setCalcFeedback(null);
    try {
      const res = await runHrmMonthlyPayroll(projectId, userId, {
        periodCode: calcPeriod,
        titleFa: `محاسبه مکانیزه حقوق، بیمه و مالیات دوره ${calcPeriod}`,
      });
      setCalcFeedback(
        `دوره حقوق «${String(res.payrollRun.RunNo)}» با موفقیت محاسبه شد: صدور ${res.payslipsCount} فیش حقوقی و ثبت سند تسهیم هزینه مالی «${String(res.costVoucher.VoucherNo)}».`,
      );
      await Promise.all([runRes.reload(), slpRes.reload(), vchRes.reload()]);
    } catch (e: unknown) {
      setCalcFeedback(e instanceof Error ? e.message : "خطا در اجرای محاسبه حقوق");
    } finally {
      setCalcBusy(false);
    }
  };

  const slpFields: FieldSpec[] = [
    { name: "SlipNo", label: "شماره فیش حقوقی", type: "code", required: true },
    { name: "RunNo", label: "شماره دوره محاسبه", type: "code", required: true, defaultValue: "PAY-1405-07" },
    { name: "PeriodCode", label: "دوره مالی (مثلاً 1405-07)", type: "code", required: true, defaultValue: "1405-07" },
    { name: "PersonnelNo", label: "شماره پرسنلی", type: "code", required: true },
    { name: "WorkedDays", label: "روزهای کارکرد", type: "number", defaultValue: 30 },
    { name: "NormalHours", label: "ساعت کار عادی", type: "number", defaultValue: 176 },
    { name: "OvertimeHours", label: "ساعت اضافه‌کاری", type: "number", defaultValue: 25 },
    { name: "BasePayRials", label: "حقوق پایه ماهانه (ریال)", type: "currency", required: true, defaultValue: 380000000 },
    { name: "OvertimePayRials", label: "فوق‌العاده اضافه‌کاری ۱.۴ برابر (ریال)", type: "currency", defaultValue: 75000000 },
    { name: "ShiftAndHardshipRials", label: "فوق‌العاده نوبت‌کاری و سختی کار (ریال)", type: "currency", defaultValue: 65000000 },
    { name: "BenefitsAllowanceRials", label: "مسکن، بن، عائله‌مندی و سنوات (ریال)", type: "currency", defaultValue: 150000000 },
    { name: "GrossPayRials", label: "جمع ناخالص حقوق و مزایا (ریال)", type: "currency", required: true, defaultValue: 670000000 },
    { name: "EmployeeSsi7PctRials", label: "بیمه تأمین اجتماعی سهم کارگر ۷٪ (ریال)", type: "currency", defaultValue: 46900000 },
    { name: "EmployerSsi23PctRials", label: "بیمه سهم کارفرما ۲۰٪ + بیکاری ۳٪ (ریال)", type: "currency", defaultValue: 154100000 },
    { name: "IncomeTaxRials", label: "مالیات بر درآمد حقوق (ریال)", type: "currency", defaultValue: 43000000 },
    { name: "NetPayRials", label: "خالص پرداختی به پرسنل (ریال)", type: "currency", required: true, defaultValue: 580100000 },
    {
      name: "CostType",
      label: "نوع هزینه در بهای تمام‌شده",
      type: "select",
      defaultValue: "direct",
      options: [
        { value: "direct", label: "دستمزد مستقیم تولید/نت/عملیات (Direct Labor)" },
        { value: "indirect", label: "دستمزد غیرمستقیم و پشتیبانی (Indirect Labor)" },
        { value: "overhead", label: "سربار اداری و عمومی (Admin Overhead)" },
      ],
    },
    { name: "FinCostCenterRef", label: "کد مرکز هزینه در مالی", type: "code", defaultValue: "CC-210-MES" },
    { name: "NoteFa", label: "توضیحات فیش حقوقی", type: "textarea", span: 2 },
  ];

  const slpCols: ColumnSpec<Record<string, unknown>>[] = [
    { key: "SlipNo", header: "شماره فیش", sortable: true },
    { key: "PeriodCode", header: "دوره" },
    { key: "PersonnelNo", header: "کد پرسنلی", sortable: true },
    { key: "OvertimeHours", header: "اضافه‌کاری (ساعت)" },
    { key: "GrossPayRials", header: "ناخالص (ریال)", render: (r) => fmtRials(r.GrossPayRials) },
    { key: "EmployeeSsi7PctRials", header: "بیمه ۷٪ کارگر", render: (r) => fmtRials(r.EmployeeSsi7PctRials) },
    { key: "EmployerSsi23PctRials", header: "بیمه ۲۳٪ کارفرما", render: (r) => fmtRials(r.EmployerSsi23PctRials) },
    { key: "IncomeTaxRials", header: "مالیات حقوق", render: (r) => fmtRials(r.IncomeTaxRials) },
    { key: "NetPayRials", header: "خالص پرداختی (ریال)", render: (r) => fmtRials(r.NetPayRials) },
    { key: "CostType", header: "نوع هزینه" },
    { key: "FinCostCenterRef", header: "مرکز هزینه" },
  ];

  const runFields: FieldSpec[] = [
    { name: "RunNo", label: "شماره دوره محاسبه", type: "code", required: true },
    { name: "PeriodCode", label: "کد ماه/دوره", type: "code", required: true },
    { name: "TitleFa", label: "عنوان دوره حقوق و دستمزد", type: "text", required: true },
    { name: "EmployeeCount", label: "تعداد پرسنل محاسبه‌شده", type: "number", defaultValue: 4 },
    { name: "TotalGrossRials", label: "جمع ناخالص حقوق (ریال)", type: "currency", required: true },
    { name: "TotalEmployeeSsiRials", label: "جمع بیمه سهم کارگر ۷٪ (ریال)", type: "currency" },
    { name: "TotalEmployerSsiRials", label: "جمع بیمه سهم کارفرما ۲۳٪ (ریال)", type: "currency" },
    { name: "TotalTaxRials", label: "جمع مالیات حقوق (ریال)", type: "currency" },
    { name: "TotalNetPayableRials", label: "خالص قابل پرداخت (ریال)", type: "currency", required: true },
    { name: "DirectLaborCostRials", label: "جمع هزینه دستمزد مستقیم (ریال)", type: "currency" },
    { name: "IndirectLaborCostRials", label: "جمع هزینه دستمزد غیرمستقیم (ریال)", type: "currency" },
    { name: "FinVoucherRef", label: "شماره سند حسابداری مالی", type: "code" },
    {
      name: "Status",
      label: "وضعیت دوره",
      type: "select",
      defaultValue: "posted-to-finance",
      options: [
        { value: "calculated", label: "محاسبه‌شده" },
        { value: "approved", label: "تصویب‌شده" },
        { value: "posted-to-finance", label: "ارسال‌شده به مالی (Posted)" },
      ],
    },
    { name: "NoteFa", label: "یادداشت دوره حقوق", type: "textarea", span: 2 },
  ];

  const runCols: ColumnSpec<Record<string, unknown>>[] = [
    { key: "RunNo", header: "شماره دوره", sortable: true },
    { key: "PeriodCode", header: "دوره" },
    { key: "TitleFa", header: "عنوان" },
    { key: "EmployeeCount", header: "نفرات" },
    { key: "TotalGrossRials", header: "جمع ناخالص", render: (r) => fmtRials(r.TotalGrossRials) },
    { key: "TotalEmployerSsiRials", header: "بیمه کارفرما ۲۳٪", render: (r) => fmtRials(r.TotalEmployerSsiRials) },
    { key: "TotalNetPayableRials", header: "خالص پرداختی", render: (r) => fmtRials(r.TotalNetPayableRials) },
    { key: "FinVoucherRef", header: "سند مالی" },
    { key: "Status", header: "وضعیت" },
  ];

  const vchFields: FieldSpec[] = [
    { name: "VoucherNo", label: "شماره سند تسهیم هزینه", type: "code", required: true },
    { name: "RunNo", label: "شماره دوره حقوق", type: "code", required: true },
    { name: "PeriodCode", label: "دوره مالی", type: "code", required: true },
    {
      name: "CostCategory",
      label: "طبقه بهای تمام‌شده دستمزد",
      type: "select",
      defaultValue: "direct-production",
      options: [
        { value: "direct-production", label: "دستمزد مستقیم تولید (MES Production)" },
        { value: "direct-maintenance", label: "دستمزد مستقیم نت (CMMS Work Orders)" },
        { value: "indirect-supervision", label: "دستمزد غیرمستقیم سرپرستی کارگاه" },
        { value: "admin-overhead", label: "سربار عمومی و اداری ستاد" },
      ],
    },
    { name: "FinCostCenterRef", label: "مرکز هزینه مالی (FinCostCenter)", type: "code", required: true },
    { name: "MesOrderRef", label: "سفارش تولید مقصد در MES", type: "code" },
    { name: "CmmsWorkOrderRef", label: "دستورکار نت مقصد در CMMS", type: "code" },
    { name: "DirectLaborRials", label: "مبلغ دستمزد مستقیم (ریال)", type: "currency", defaultValue: 0 },
    { name: "IndirectLaborRials", label: "مبلغ دستمزد غیرمستقیم (ریال)", type: "currency", defaultValue: 0 },
    { name: "EmployerSsiRials", label: "سهم بیمه کارفرما ۲۳٪ (ریال)", type: "currency", defaultValue: 0 },
    { name: "TotalAllocatedRials", label: "جمع کل سند ارسالی به مالی (ریال)", type: "currency", required: true },
    {
      name: "Status",
      label: "وضعیت ثبت در مالی",
      type: "select",
      defaultValue: "posted",
      options: [
        { value: "draft", label: "پیش‌نویس" },
        { value: "posted", label: "ثبت‌شده در دفتر مالی" },
        { value: "reconciled", label: "تطبیق‌یافته با بهای تمام‌شده" },
      ],
    },
    { name: "NoteFa", label: "شرح سند تسهیم هزینه", type: "textarea", span: 2 },
  ];

  const vchCols: ColumnSpec<Record<string, unknown>>[] = [
    { key: "VoucherNo", header: "شماره سند مالی", sortable: true },
    { key: "PeriodCode", header: "دوره" },
    { key: "CostCategory", header: "طبقه بهای تمام‌شده" },
    { key: "FinCostCenterRef", header: "مرکز هزینه مالی" },
    { key: "MesOrderRef", header: "سفارش MES" },
    { key: "CmmsWorkOrderRef", header: "دستورکار CMMS" },
    { key: "DirectLaborRials", header: "دستمزد مستقیم", render: (r) => fmtRials(r.DirectLaborRials) },
    { key: "IndirectLaborRials", header: "دستمزد غیرمستقیم", render: (r) => fmtRials(r.IndirectLaborRials) },
    { key: "TotalAllocatedRials", header: "جمع کل سند (ریال)", render: (r) => fmtRials(r.TotalAllocatedRials) },
    { key: "Status", header: "وضعیت" },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <div className="text-sm font-bold text-teal-950">
            موتور محاسبه مکانیزه حقوق و دستمزد، بیمه تأمین اجتماعی (۷٪ / ۲۳٪) و تسهیم بهای تمام‌شده به مالی
          </div>
          <div className="text-xs text-teal-800 mt-0.5">
            محاسبه بر اساس احکام کارگزینی، کارکرد شیفت‌ها (ضریب ۱.۴ اضافه‌کاری ماده ۵۹ قانون کار)، کسورات قانونی و صدور خودکار سند تفکیکی دستمزد مستقیم (MES/CMMS) و غیرمستقیم.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={calcPeriod}
            onChange={(e) => setCalcPeriod(e.target.value)}
            placeholder="مثلاً 1405-08"
            className="rounded-md border border-teal-300 bg-white px-2.5 py-1.5 text-xs font-mono text-slate-800 w-28"
          />
          <button
            type="button"
            disabled={!canWrite || calcBusy}
            onClick={handleCalculatePayroll}
            className="rounded-md bg-teal-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {calcBusy ? "در حال محاسبه..." : "اجرای محاسبه حقوق و صدور سند مالی"}
          </button>
        </div>
      </div>

      {calcFeedback && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-900">
          {calcFeedback}
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {[
          { id: "payslips", label: "فیش‌های حقوقی پرسنل (Payslips)" },
          { id: "runs", label: "دوره‌های محاسبه حقوق و دستمزد (Payroll Runs)" },
          { id: "vouchers", label: "اسناد تسهیم بهای تمام‌شده دستمزد به مالی (Finance & Costing Vouchers)" },
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

      {subTab === "payslips" && (
        <EnterpriseCrudBlock title="فیش‌های حقوقی صادرشده پرسنل (Employee Payslips — Iran Labor Law & SSI)"
          subtitle="جزئیات کامل مزد مبنا، اضافه‌کاری، فوق‌العاده نوبت‌کاری/اقماری، حق بیمه ۷٪ کارگر، ۲۳٪ کارفرما و مالیات حقوق"
          idKey="Id"
          rows={slpRes.rows}
          columns={slpCols}
          fields={slpFields}
          loading={slpRes.loading}
          error={slpRes.error}
          onRefresh={slpRes.reload}
          onCreate={canWrite ? slpRes.onCreate : undefined}
          onUpdate={canWrite ? slpRes.onUpdate : undefined}
          onDelete={canWrite ? slpRes.onDelete : undefined}
        />
      )}

      {subTab === "runs" && (
        <EnterpriseCrudBlock title="دوره‌های ماهانه محاسبه حقوق و دستمزد (Monthly Payroll Runs)"
          subtitle="خلاصه تجمیعی حقوق ناخالص، کسورات بیمه و مالیات، تفکیک دستمزد مستقیم/غیرمستقیم و وضعیت ارسال به مالی"
          idKey="Id"
          rows={runRes.rows}
          columns={runCols}
          fields={runFields}
          loading={runRes.loading}
          error={runRes.error}
          onRefresh={runRes.reload}
          onCreate={canWrite ? runRes.onCreate : undefined}
          onUpdate={canWrite ? runRes.onUpdate : undefined}
          onDelete={canWrite ? runRes.onDelete : undefined}
        />
      )}

      {subTab === "vouchers" && (
        <EnterpriseCrudBlock title="اسناد تسهیم هزینه دستمزد مستقیم و غیرمستقیم به حسابداری مالی و بهای تمام‌شده"
          subtitle="ارسال مکانیزه بهای تمام‌شده نفرساعت به مراکز هزینه مالی، سفارش‌های تولید MES و دستورکارهای نت CMMS"
          idKey="Id"
          rows={vchRes.rows}
          columns={vchCols}
          fields={vchFields}
          loading={vchRes.loading}
          error={vchRes.error}
          onRefresh={vchRes.reload}
          onCreate={canApprove || canWrite ? vchRes.onCreate : undefined}
          onUpdate={canApprove || canWrite ? vchRes.onUpdate : undefined}
          onDelete={canApprove || canWrite ? vchRes.onDelete : undefined}
        />
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
 * ۴. آموزش و توسعه صلاحیت (Training Needs, Course Planning & Kirkpatrick Effectiveness)
 * ═══════════════════════════════════════════════════════════════════════════ */
export const HrmTrainingCompetencyPanel: React.FC<PanelProps> = ({ projectId, userId, canWrite }) => {
  const [subTab, setSubTab] = useState<"records" | "courses" | "needs">("records");

  const tnaRes = useHrmResource("training-needs", projectId, userId);
  const crsRes = useHrmResource("training-courses", projectId, userId);
  const recRes = useHrmResource("training-records", projectId, userId);

  const recFields: FieldSpec[] = [
    { name: "RecordNo", label: "شماره گواهی / سابقه آموزش", type: "code", required: true },
    { name: "CourseCode", label: "کد دوره آموزشی", type: "code", required: true },
    { name: "PersonnelNo", label: "شماره پرسنلی فراگیر", type: "code", required: true },
    { name: "AttendancePct", label: "درصد حضور در دوره", type: "number", defaultValue: 100 },
    { name: "ExamScorePct", label: "نمره آزمون پایانی (۰ تا ۱۰۰)", type: "number", required: true, defaultValue: 90 },
    { name: "CertificateNo", label: "شماره گواهی‌نامه صادره", type: "code" },
    { name: "IssuedDate", label: "تاریخ صدور گواهی", type: "date" },
    { name: "ExpiryDate", label: "تاریخ انقضای گواهی", type: "date" },
    { name: "EffectivenessScorePct", label: "امتیاز اثربخشی کرک‌پاتریک (٪)", type: "number", required: true, defaultValue: 88 },
    { name: "KirkpatrickSummaryFa", label: "نتایج ارزیابی ۴ سطحی کرک‌پاتریک (واکنش، یادگیری، رفتار، نتایج)", type: "textarea", span: 2 },
    {
      name: "Status",
      label: "وضعیت",
      type: "select",
      defaultValue: "certified",
      options: [
        { value: "enrolled", label: "ثبت‌نام‌شده" },
        { value: "passed", label: "قبول در آزمون" },
        { value: "certified", label: "گواهی صادرشده و اثربخشی تأییدشده" },
        { value: "failed", label: "نیازمند تکرار دوره" },
      ],
    },
  ];

  const recCols: ColumnSpec<Record<string, unknown>>[] = [
    { key: "RecordNo", header: "کد سابقه", sortable: true },
    { key: "CourseCode", header: "کد دوره" },
    { key: "PersonnelNo", header: "کد پرسنلی" },
    { key: "ExamScorePct", header: "نمره آزمون (٪)" },
    { key: "EffectivenessScorePct", header: "امتیاز اثربخشی (٪)" },
    { key: "CertificateNo", header: "شماره گواهی" },
    { key: "KirkpatrickSummaryFa", header: "خلاصه اثربخشی ۴ سطحی کرک‌پاتریک" },
    { key: "Status", header: "وضعیت" },
  ];

  const crsFields: FieldSpec[] = [
    { name: "CourseCode", label: "کد دوره آموزشی", type: "code", required: true },
    { name: "TitleFa", label: "عنوان دوره آموزشی", type: "text", required: true },
    {
      name: "Category",
      label: "دسته‌بندی تخصصی دوره",
      type: "select",
      defaultValue: "technical",
      options: [
        { value: "technical", label: "فنی و مهندسی (مکانیک/برق/ابزار دقیق)" },
        { value: "mes-cmms", label: "تخصصی ساخت (MES) و نگهداری و تعمیرات (CMMS)" },
        { value: "safety-hse", label: "ایمنی، کنترل فوران چاه و HSE" },
        { value: "quality-iso", label: "سیستم‌های مدیریت کیفیت و استانداردهای ISO" },
        { value: "management", label: "مدیریت پروژه و رهبری سازمانی" },
      ],
    },
    { name: "ProviderFa", label: "مؤسسه / مرجع برگزارکننده", type: "text", required: true },
    { name: "InstructorFa", label: "نام مدرس", type: "text" },
    { name: "DurationHours", label: "مدت دوره (نفر-ساعت)", type: "number", required: true, defaultValue: 24 },
    { name: "StartDate", label: "تاریخ شروع", type: "date", required: true },
    { name: "EndDate", label: "تاریخ پایان", type: "date" },
    { name: "Capacity", label: "ظرفیت دوره", type: "number", defaultValue: 15 },
    { name: "CostPerPersonRials", label: "هزینه هر نفر (ریال)", type: "currency", defaultValue: 65000000 },
    { name: "SkillCodeGranted", label: "کد مهارت اعطایی به ماتریس مهارت", type: "code" },
    {
      name: "Status",
      label: "وضعیت برگزاری",
      type: "select",
      defaultValue: "planned",
      options: [
        { value: "planned", label: "برنامه‌ریزی‌شده در تقویم آموزشی" },
        { value: "ongoing", label: "در حال برگزاری" },
        { value: "completed", label: "برگزارشده و خاتمه‌یافته" },
      ],
    },
  ];

  const crsCols: ColumnSpec<Record<string, unknown>>[] = [
    { key: "CourseCode", header: "کد دوره", sortable: true },
    { key: "TitleFa", header: "عنوان دوره آموزشی" },
    { key: "Category", header: "دسته‌بندی" },
    { key: "ProviderFa", header: "مجری آموزشی" },
    { key: "DurationHours", header: "مدت (ساعت)" },
    { key: "StartDate", header: "تاریخ شروع" },
    { key: "SkillCodeGranted", header: "مهارت اعطایی" },
    { key: "Status", header: "وضعیت" },
  ];

  const tnaFields: FieldSpec[] = [
    { name: "TnaCode", label: "کد نیازسنجی آموزشی (TNA)", type: "code", required: true },
    { name: "OrgUnitCode", label: "کد واحد سازمانی", type: "code", required: true },
    { name: "PersonnelNo", label: "شماره پرسنلی", type: "code" },
    { name: "JobTitleFa", label: "پست سازمانی هدف", type: "text", required: true },
    { name: "SkillGapFa", label: "شکاف مهارتی شناسایی‌شده (Skill Gap)", type: "textarea", required: true, span: 2 },
    { name: "RecommendedCourseFa", label: "دوره پیشنهادی جهت رفع شکاف", type: "text", required: true },
    {
      name: "Priority",
      label: "اولویت نیاز آموزشی",
      type: "select",
      defaultValue: "high",
      options: [
        { value: "critical", label: "بحرانی (پیشنیاز عملیات/گواهی)" },
        { value: "high", label: "بالا" },
        { value: "medium", label: "متوسط" },
      ],
    },
    { name: "TargetPeriod", label: "فصل هدف برگزاری", type: "code", defaultValue: "1405-Q3" },
    { name: "EstimatedCostRials", label: "بودجه برآوردی (ریال)", type: "currency", defaultValue: 70000000 },
    {
      name: "Status",
      label: "وضعیت نیازسنجی",
      type: "select",
      defaultValue: "approved",
      options: [
        { value: "identified", label: "شناسایی‌شده در ممیزی مهارت" },
        { value: "approved", label: "مصوب کمیته آموزش" },
        { value: "scheduled", label: "زمان‌بندی‌شده در تقویم" },
        { value: "completed", label: "اثربخشی احرازشده" },
      ],
    },
  ];

  const tnaCols: ColumnSpec<Record<string, unknown>>[] = [
    { key: "TnaCode", header: "کد TNA", sortable: true },
    { key: "OrgUnitCode", header: "واحد سازمانی" },
    { key: "PersonnelNo", header: "کد پرسنلی" },
    { key: "JobTitleFa", header: "پست سازمانی" },
    { key: "SkillGapFa", header: "شکاف مهارتی" },
    { key: "RecommendedCourseFa", header: "دوره پیشنهادی" },
    { key: "Priority", header: "اولویت" },
    { key: "Status", header: "وضعیت" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {[
          { id: "records", label: "سوابق آموزش و ارزیابی اثربخشی دوره‌ها (Kirkpatrick 4-Level)" },
          { id: "courses", label: "تقویم و برنامه‌ریزی دوره‌های آموزشی (Course Planning)" },
          { id: "needs", label: "نیازسنجی آموزشی مبتنی بر شکاف مهارتی (TNA — ISO 10015)" },
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

      {subTab === "records" && (
        <EnterpriseCrudBlock title="سوابق آموزشی پرسنل و ارزیابی اثربخشی چهارسطحی کرک‌پاتریک (ISO 10015 / ISO 30414)"
          subtitle="سنجش واکنش، یادگیری، تغییر رفتار در کارگاه و تأثیر مستقیم دوره بر کاهش توقفات CMMS و ضایعات MES"
          idKey="Id"
          rows={recRes.rows}
          columns={recCols}
          fields={recFields}
          loading={recRes.loading}
          error={recRes.error}
          onRefresh={recRes.reload}
          onCreate={canWrite ? recRes.onCreate : undefined}
          onUpdate={canWrite ? recRes.onUpdate : undefined}
          onDelete={canWrite ? recRes.onDelete : undefined}
        />
      )}

      {subTab === "courses" && (
        <EnterpriseCrudBlock title="برنامه‌ریزی و تقویم دوره‌های آموزشی تخصصی، ایمنی و مدیریتی"
          subtitle="مدیریت دوره‌های فنی، مدرسان، بودجه آموزشی و مهارت‌های اعطایی به ماتریس مهارت"
          idKey="Id"
          rows={crsRes.rows}
          columns={crsCols}
          fields={crsFields}
          loading={crsRes.loading}
          error={crsRes.error}
          onRefresh={crsRes.reload}
          onCreate={canWrite ? crsRes.onCreate : undefined}
          onUpdate={canWrite ? crsRes.onUpdate : undefined}
          onDelete={canWrite ? crsRes.onDelete : undefined}
        />
      )}

      {subTab === "needs" && (
        <EnterpriseCrudBlock title="نیازسنجی آموزشی (Training Needs Assessment — TNA)"
          subtitle="تحلیل شکاف مهارتی پرسنل بر اساس الزامات مراکز کاری تولید (MES)، خانواده‌های تجهیز نت (CMMS) و دکل‌های حفاری"
          idKey="Id"
          rows={tnaRes.rows}
          columns={tnaCols}
          fields={tnaFields}
          loading={tnaRes.loading}
          error={tnaRes.error}
          onRefresh={tnaRes.reload}
          onCreate={canWrite ? tnaRes.onCreate : undefined}
          onUpdate={canWrite ? tnaRes.onUpdate : undefined}
          onDelete={canWrite ? tnaRes.onDelete : undefined}
        />
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════
 * ۵. مدیریت و ارزیابی عملکرد (KPIs / OKRs & 360-Degree Periodic Appraisal)
 * ═══════════════════════════════════════════════════════════════════════════ */
export const HrmPerformanceManagementPanel: React.FC<PanelProps> = ({ projectId, userId, canWrite }) => {
  const [subTab, setSubTab] = useState<"reviews" | "kpis">("reviews");

  const kpiRes = useHrmResource("performance-kpis", projectId, userId);
  const revRes = useHrmResource("performance-reviews", projectId, userId);

  const revFields: FieldSpec[] = [
    { name: "ReviewNo", label: "شماره پرونده ارزیابی", type: "code", required: true },
    { name: "PeriodCode", label: "دوره ارزیابی (مثلاً 1405-Q2)", type: "code", required: true, defaultValue: "1405-Q2" },
    { name: "PersonnelNo", label: "شماره پرسنلی ارزیابی‌شونده", type: "code", required: true },
    { name: "ReviewerPersonNo", label: "شماره پرسنلی مدیر ارزیاب", type: "code", required: true, defaultValue: "EMP-1001" },
    { name: "SelfScorePct", label: "امتیاز خودارزیابی (۰-۱۰۰)", type: "number", defaultValue: 88 },
    { name: "ManagerScorePct", label: "امتیاز مدیر مستقیم (۰-۱۰۰)", type: "number", defaultValue: 92 },
    { name: "PeerScorePct", label: "امتیاز همکاران ۳۶۰ درجه (۰-۱۰۰)", type: "number", defaultValue: 90 },
    { name: "SubordinateScorePct", label: "امتیاز زیرمجموعه/تیم (۰-۱۰۰)", type: "number", defaultValue: 90 },
    { name: "KpiAchievementPct", label: "درصد تحقق اهداف کمّی KPI/OKR", type: "number", required: true, defaultValue: 93 },
    { name: "FinalScorePct", label: "امتیاز وزنی نهایی ۳۶۰ درجه", type: "number", required: true, defaultValue: 91.5 },
    {
      name: "PerformanceGrade",
      label: "رتبه عملکردی دوره",
      type: "select",
      defaultValue: "A-Outstanding",
      options: [
        { value: "A-Outstanding", label: "A — عملکرد برجسته و سرآمد (Outstanding)" },
        { value: "B-Exceeds", label: "B — فراتر از انتظار (Exceeds Expectations)" },
        { value: "C-Meets", label: "C — منطبق با اهداف (Meets Expectations)" },
        { value: "D-NeedsImprovement", label: "D — نیازمند برنامه بهبود فردی (PIP)" },
      ],
    },
    { name: "BonusMultiplierPct", label: "ضریب پاداش بهره‌وری دوره (٪)", type: "number", defaultValue: 120 },
    { name: "StrengthsFa", label: "نقاط قوت کلیدی و دستاوردهای دوره", type: "textarea", span: 2 },
    { name: "ImprovementPlanFa", label: "برنامه توسعه فردی (IDP) و اهداف دوره بعد", type: "textarea", span: 2 },
  ];

  const revCols: ColumnSpec<Record<string, unknown>>[] = [
    { key: "ReviewNo", header: "شماره ارزیابی", sortable: true },
    { key: "PeriodCode", header: "دوره" },
    { key: "PersonnelNo", header: "کد پرسنلی", sortable: true },
    { key: "SelfScorePct", header: "خودارزیابی" },
    { key: "ManagerScorePct", header: "مدیر مستقیم" },
    { key: "PeerScorePct", header: "همکاران" },
    { key: "KpiAchievementPct", header: "تحقق KPI (٪)" },
    { key: "FinalScorePct", header: "امتیاز نهایی ۳۶۰°" },
    { key: "PerformanceGrade", header: "رتبه عملکرد" },
    { key: "BonusMultiplierPct", header: "ضریب پاداش (٪)" },
  ];

  const kpiFields: FieldSpec[] = [
    { name: "KpiCode", label: "کد شاخص KPI / OKR", type: "code", required: true },
    { name: "TitleFa", label: "عنوان شاخص عملکردی یا هدف کلیدی", type: "text", required: true },
    { name: "OrgUnitCode", label: "واحد سازمانی مرتبط", type: "code", required: true },
    { name: "JobRoleFa", label: "پست سازمانی هدف", type: "text", required: true },
    {
      name: "Perspective",
      label: "منظر ارزیابی",
      type: "select",
      defaultValue: "operational",
      options: [
        { value: "operational", label: "عملیاتی و بهره‌وری تولید/حفاری (OEE / NPT)" },
        { value: "quality", label: "کیفیت و قابلیت اطمینان نت (MTTR / PM)" },
        { value: "safety", label: "ایمنی و انطباق HSE" },
        { value: "competency", label: "رشد مهارت و انتقال دانش (KMS)" },
        { value: "teamwork", label: "رهبری و کار تیمی ۳۶۰ درجه" },
      ],
    },
    { name: "MetricUnit", label: "واحد سنجش", type: "text", defaultValue: "%" },
    { name: "TargetValue", label: "مقدار هدف دوره", type: "number", required: true, defaultValue: 92 },
    { name: "WeightPct", label: "وزن در ارزیابی کل (٪)", type: "number", required: true, defaultValue: 30 },
    {
      name: "EvalFrequency",
      label: "تناوب سنجش",
      type: "select",
      defaultValue: "quarterly",
      options: [
        { value: "monthly", label: "ماهانه" },
        { value: "quarterly", label: "فصلی (سه‌ماهه)" },
        { value: "semi-annual", label: "شش‌ماهه" },
        { value: "annual", label: "سالانه" },
      ],
    },
  ];

  const kpiCols: ColumnSpec<Record<string, unknown>>[] = [
    { key: "KpiCode", header: "کد شاخص", sortable: true },
    { key: "TitleFa", header: "عنوان شاخص کلیدی عملکرد (KPI / OKR)" },
    { key: "OrgUnitCode", header: "واحد سازمانی" },
    { key: "JobRoleFa", header: "پست سازمانی" },
    { key: "Perspective", header: "منظر" },
    { key: "TargetValue", header: "مقدار هدف" },
    { key: "WeightPct", header: "وزن (٪)" },
    { key: "EvalFrequency", header: "تناوب" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {[
          { id: "reviews", label: "ارزیابی دوره‌ای ۳۶۰ درجه و ضریب پاداش بهره‌وری (360° Appraisal)" },
          { id: "kpis", label: "بانک اهداف و شاخص‌های کلیدی عملکرد فردی (KPIs & OKRs)" },
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

      {subTab === "reviews" && (
        <EnterpriseCrudBlock title="ارزیابی دوره‌ای ۳۶۰ درجه عملکرد پرسنل (خودارزیابی، مدیر، همکاران، زیرمجموعه و تحقق KPI)"
          subtitle="محاسبه امتیاز وزنی، تعیین رتبه عملکردی A تا D، ضریب پاداش بهره‌وری و برنامه توسعه فردی (IDP)"
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

      {subTab === "kpis" && (
        <EnterpriseCrudBlock title="تعریف اهداف کلیدی (OKR) و شاخص‌های کلیدی عملکرد (KPI) متصل به عملیات MES، CMMS و IIoT"
          subtitle="هم‌راستاسازی اهداف فردی سرپرستان، تکنسین‌ها و اپراتورها با شاخص‌های OEE، MTTR، انطباق PM و کاهش NPT"
          idKey="Id"
          rows={kpiRes.rows}
          columns={kpiCols}
          fields={kpiFields}
          loading={kpiRes.loading}
          error={kpiRes.error}
          onRefresh={kpiRes.reload}
          onCreate={canWrite ? kpiRes.onCreate : undefined}
          onUpdate={canWrite ? kpiRes.onUpdate : undefined}
          onDelete={canWrite ? kpiRes.onDelete : undefined}
        />
      )}
    </div>
  );
};
