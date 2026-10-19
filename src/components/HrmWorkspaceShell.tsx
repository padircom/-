/**
 * پوستهٔ یکپارچهٔ بخش ۶ سازمان: مدیریت جامع منابع انسانی (HRM Workspace Shell)
 * منطبق با ISO 30414 و قوانین کار و تأمین اجتماعی ایران.
 */
import React, { useMemo, useState } from "react";
import type { Lang } from "../data/framework";
import { useSystem } from "../context/SystemContext";
import { DEMO_SUBJECTS, subjectPermissions } from "../services/accessControl";
import { HRM_DEMO_USERS } from "../services/hrmEnterpriseApi";
import ModuleWorkspaceShell, {
  moduleCardCls,
  moduleChipCls,
  moduleSelectCls,
} from "./ModuleWorkspaceShell";
import {
  HrmAttendanceShiftPanel,
  HrmPayrollCompensationPanel,
  HrmPerformanceManagementPanel,
  HrmPersonnelOrgPanel,
  HrmTrainingCompetencyPanel,
} from "./HrmCrudPanels";

export type HrmTabId =
  | "personnel"
  | "attendance"
  | "payroll"
  | "training"
  | "performance";

interface HrmTabSpec {
  id: HrmTabId;
  icon: string;
  fa: string;
  en: string;
  code: string;
  viewPerm: string;
  writePerm: string;
  descFa: string;
  descEn: string;
}

export const HRM_TABS: readonly HrmTabSpec[] = [
  {
    id: "personnel",
    icon: "👥",
    fa: "پرسنلی، چارت و ماتریس مهارت",
    en: "Personnel, Org Chart & Skill Matrix",
    code: "MOD-06.01",
    viewPerm: "hrm.org.view",
    writePerm: "hrm.org.manage",
    descFa:
      "پرونده جامع پرسنلی، چارت سازمانی، احکام کارگزینی، قراردادهای کار و ماتریس مهارت و گواهی‌نامه‌های فنی متصل به CMMS و MES",
    descEn:
      "Comprehensive personnel registry, org chart, decrees, contracts, and skill matrix connected to CMMS and MES",
  },
  {
    id: "attendance",
    icon: "⏱️",
    fa: "حضور و غیاب و شیفت‌بندی",
    en: "Attendance & Shift Rosters",
    code: "MOD-06.02",
    viewPerm: "hrm.attendance.view",
    writePerm: "hrm.attendance.manage",
    descFa:
      "تقویم‌های کاری، شیفت‌های سه‌نوبته کارگاهی و اقماری ۱۴-۱۴ دکل، مرخصی، مأموریت و تخصیص نفرساعت به دستورکار نت و سفارش تولید",
    descEn:
      "Work calendars, 3-shift shop-floor & 14/14 rotational rig shifts, leaves, missions, and CMMS/MES time tracking",
  },
  {
    id: "payroll",
    icon: "💵",
    fa: "حقوق و دستمزد و تسهیم هزینه",
    en: "Payroll & Cost Allocation",
    code: "MOD-06.03",
    viewPerm: "hrm.payroll.view",
    writePerm: "hrm.payroll.run",
    descFa:
      "محاسبه مکانیزه حقوق و مزایا، کسورات بیمه تأمین اجتماعی (۷٪ کارگر / ۲۳٪ کارفرما) و مالیات، صدور فیش و ارسال سند بهای تمام‌شده دستمزد مستقیم/غیرمستقیم به مالی",
    descEn:
      "Automated payroll calculation, Social Security (7%/23%) & tax deductions, payslips, and direct/indirect labor cost allocation to Finance",
  },
  {
    id: "training",
    icon: "🎓",
    fa: "آموزش و توسعه صلاحیت",
    en: "Training & Competency (ISO 10015)",
    code: "MOD-06.04",
    viewPerm: "hrm.training.view",
    writePerm: "hrm.training.manage",
    descFa:
      "نیازسنجی آموزشی مبتنی بر شکاف مهارتی (TNA)، برنامه‌ریزی دوره‌های فنی/ایمنی و ارزیابی اثربخشی چهارسطحی کرک‌پاتریک (ISO 10015)",
    descEn:
      "Training Needs Assessment (TNA), course planning, training records, and Kirkpatrick 4-level effectiveness evaluation",
  },
  {
    id: "performance",
    icon: "🎯",
    fa: "ارزیابی عملکرد ۳۶۰ درجه",
    en: "360° Performance Management",
    code: "MOD-06.05",
    viewPerm: "hrm.performance.view",
    writePerm: "hrm.performance.manage",
    descFa:
      "تعریف شاخص‌های کلیدی عملکرد و اهداف کلیدی (KPIs / OKRs) و ارزیابی دوره‌ای ۳۶۰ درجه با محاسبه رتبه عملکردی و ضریب پاداش بهره‌وری",
    descEn:
      "Individual KPIs/OKRs and periodic 360-degree performance evaluations with performance grading and bonus multipliers",
  },
] as const;

interface HrmWorkspaceShellProps {
  lang?: Lang;
  activeSub?: HrmTabId;
  onSelectSub?: (id: HrmTabId) => void;
  onBackHome?: () => void;
}

export const HrmWorkspaceShell: React.FC<HrmWorkspaceShellProps> = ({
  lang = "fa",
  activeSub = "personnel",
  onSelectSub,
  onBackHome,
}) => {
  const fa = lang === "fa";
  const tr = (f: string, e: string) => (fa ? f : e);
  const { projectScope } = useSystem();
  const projectId = projectScope?.projectId || "c1-p1";

  const [internalTab, setInternalTab] = useState<HrmTabId>("personnel");
  const validTab = HRM_TABS.find((t) => t.id === activeSub)?.id;
  const activeTab: HrmTabId = validTab ?? internalTab;

  const handleSelectTab = (id: HrmTabId) => {
    setInternalTab(id);
    onSelectSub?.(id);
  };

  const [userId, setUserId] = useState<string>(HRM_DEMO_USERS[0].id);

  const effectivePerms = useMemo(() => {
    const subj = DEMO_SUBJECTS.find((s) => s.id === userId);
    return new Set(subj ? subjectPermissions(subj) : []);
  }, [userId]);

  const currentTab = HRM_TABS.find((t) => t.id === activeTab) ?? HRM_TABS[0];
  const canView = effectivePerms.has(currentTab.viewPerm);
  const canWrite = effectivePerms.has(currentTab.writePerm);
  const canApprovePayroll = effectivePerms.has("hrm.payroll.approve");

  return (
    <ModuleWorkspaceShell
      lang={lang}
      accent="#14b8a6"
      icon="👥"
      title={tr(
        "سامانهٔ جامع مدیریت منابع انسانی و سرمایه انسانی (HRM)",
        "Enterprise Human Resource Management System (HRM)",
      )}
      subtitle={tr(
        "سرگروه ششم سازمان (۵+۲) · منطبق با ISO 30414، ISO 10015 و قوانین کار و تأمین اجتماعی ایران روی /api/hrm",
        "Organizational Pillar #6 · Aligned with ISO 30414, ISO 10015 & Iran Labor Law over /api/hrm",
      )}
      badges={
        <>
          <span className="rounded-md border border-teal-500/40 bg-teal-500/10 px-2 py-0.5 text-[10px] text-teal-300">
            ISO 30414 · Labor Law
          </span>
          <span className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
            {canWrite ? tr("مجوز ویرایش فعال", "Write Enabled") : tr("فقط مشاهده", "Read Only")}
          </span>
        </>
      }
      actions={
        <>
          <span className={moduleChipCls} dir="ltr">
            project: {projectId}
          </span>
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className={moduleSelectCls}
            aria-label={tr("هویت کاربر HRM", "HRM User Identity")}
          >
            {HRM_DEMO_USERS.map((u) => (
              <option key={u.id} value={u.id}>
                {u.id} — {u.labelFa}
              </option>
            ))}
          </select>
        </>
      }
      onBack={onBackHome ?? (() => {})}
      navTitle={tr("مدیریت منابع انسانی و کارکرد (HRM)", "Human Resource Management (HRM)")}
      navItems={HRM_TABS.map((item) => {
        const allowed = effectivePerms.has(item.viewPerm);
        return {
          id: item.id,
          label: fa ? item.fa : item.en,
          icon: item.icon,
          disabled: !allowed,
          disabledHint: tr(
            `مجوز موردنیاز: ${item.viewPerm}`,
            `Required permission: ${item.viewPerm}`,
          ),
        };
      })}
      activeId={currentTab.id}
      onSelect={handleSelectTab}
      panelTitle={fa ? currentTab.fa : currentTab.en}
      panelIcon={currentTab.icon}
      panelDesc={fa ? currentTab.descFa : currentTab.descEn}
      panelMeta={
        <span className={moduleChipCls} dir="ltr">
          {currentTab.code} · /api/hrm/{projectId} · {userId}
        </span>
      }
      notice={
        <div className={`${moduleCardCls} p-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px]`}>
          <span className="tx2">
            {tr(
              "استقلال منطقی جداول Hrm* حفظ شده و ارتباط با دستورکارهای CMMS، مراکز کاری MES و مراکز هزینه مالی از طریق ارجاع نرم برقرار است.",
              "Logical schema independence (Hrm* tables) is preserved with soft references to CMMS work orders, MES work centers, and Finance cost centers.",
            )}
          </span>
          <span className="font-mono text-[10px] tx3" dir="ltr">
            view: {currentTab.viewPerm} | write: {currentTab.writePerm}
          </span>
        </div>
      }
    >
      {!canView ? (
        <div
          className="rounded-lg border border-amber-300 bg-amber-50 p-6 text-sm text-amber-900"
          data-testid="hrm-tab-locked"
        >
          نقش انتخاب‌شده مجوز مشاهدهٔ این زیرماژول (
          <code className="font-mono">{currentTab.viewPerm}</code>) را ندارد. برای مشاهدهٔ محاسبات محرمانهٔ حقوق و دستمزد، نقش را به «مدیر منابع انسانی»، «مدیر پروژه» یا «کنترل هزینه» تغییر دهید.
        </div>
      ) : (
        <>
          {activeTab === "personnel" && (
            <HrmPersonnelOrgPanel projectId={projectId} userId={userId} canWrite={canWrite} />
          )}
          {activeTab === "attendance" && (
            <HrmAttendanceShiftPanel projectId={projectId} userId={userId} canWrite={canWrite} />
          )}
          {activeTab === "payroll" && (
            <HrmPayrollCompensationPanel
              projectId={projectId}
              userId={userId}
              canWrite={canWrite}
              canApprove={canApprovePayroll}
            />
          )}
          {activeTab === "training" && (
            <HrmTrainingCompetencyPanel projectId={projectId} userId={userId} canWrite={canWrite} />
          )}
          {activeTab === "performance" && (
            <HrmPerformanceManagementPanel projectId={projectId} userId={userId} canWrite={canWrite} />
          )}
        </>
      )}
    </ModuleWorkspaceShell>
  );
};

export default HrmWorkspaceShell;
