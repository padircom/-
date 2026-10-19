/**
 * پوستهٔ یکپارچهٔ بخش ۷ سازمان: مدیریت اسناد، بایگانی دیجیتال و مدیریت دانش (EDMS / KMS Workspace Shell)
 * منطبق با ISO 15489، ISO 30301، ISO 9001 و ISO 30401.
 */
import React, { useMemo, useState } from "react";
import type { Lang } from "../data/framework";
import { useSystem } from "../context/SystemContext";
import { DEMO_SUBJECTS, subjectPermissions } from "../services/accessControl";
import { EDMS_DEMO_USERS } from "../services/edmsEnterpriseApi";
import ModuleWorkspaceShell, {
  moduleCardCls,
  moduleChipCls,
  moduleSelectCls,
} from "./ModuleWorkspaceShell";
import {
  EdmsArchiveOcrSearchPanel,
  EdmsDocumentControlPanel,
  EdmsKnowledgeManagementPanel,
  EdmsRevisionsLockPanel,
  EdmsWorkflowsTransmittalsPanel,
} from "./EdmsCrudPanels";

export type EdmsTabId =
  | "dmi"
  | "revisions"
  | "workflows"
  | "archive"
  | "kms";

interface EdmsTabSpec {
  id: EdmsTabId;
  icon: string;
  fa: string;
  en: string;
  code: string;
  viewPerm: string;
  writePerm: string;
  descFa: string;
  descEn: string;
}

export const EDMS_TABS: readonly EdmsTabSpec[] = [
  {
    id: "dmi",
    icon: "🗂️",
    fa: "شناسنامه اسناد (DMI) و کدینگ",
    en: "Document Master Index & Coding",
    code: "MOD-07.01",
    viewPerm: "edms.document.view",
    writePerm: "edms.document.manage",
    descFa:
      "ثبت و کنترل شناسنامه جامع اسناد مهندسی، قراردادی، کیفیتی و اداری (Document Master Index) و شماره‌گذاری استاندارد خودکار",
    descEn:
      "Centralized Document Master Index (DMI) and automated standard document numbering and coding rules",
  },
  {
    id: "revisions",
    icon: "🔒",
    fa: "کنترل نسخه‌ها و Check-In/Out",
    en: "Revision Control & Check-In/Out",
    code: "MOD-07.02",
    viewPerm: "edms.revision.view",
    writePerm: "edms.revision.manage",
    descFa:
      "مدیریت سخت‌گیرانه نسخه‌ها (Draft, Rev-A, Rev-B, Approved, IFC, As-Built)، قفل انحصاری Check-Out / Check-In و مقایسه تغییرات",
    descEn:
      "Strict revision control (Draft, Rev-A, Rev-B, Approved, IFC, As-Built), exclusive Check-Out/Check-In locking, and diff comparison",
  },
  {
    id: "workflows",
    icon: "📨",
    fa: "گردش‌کار تأیید و ترانسمیتال",
    en: "Approval Workflows & Transmittals",
    code: "MOD-07.03",
    viewPerm: "edms.workflow.view",
    writePerm: "edms.workflow.approve",
    descFa:
      "گردش‌کار بررسی و تصویب اسناد (کدهای بررسی ۱ تا ۴) و صدور و پیگیری برگه‌های ارسال مدارک و مکاتبات مهندسی/اداری (Transmittals)",
    descEn:
      "Multi-step document review & approval workflows (Review Codes 1-4) and official engineering/administrative transmittals",
  },
  {
    id: "archive",
    icon: "🔍",
    fa: "بایگانی دیجیتال، OCR و جستجو",
    en: "Digital Archive, OCR & Search",
    code: "MOD-07.04",
    viewPerm: "edms.archive.view",
    writePerm: "edms.archive.manage",
    descFa:
      "زون‌بندی بایگانی دیجیتال و خزانه WORM (ISO 15489 / 30301)، اسکن و استخراج متن فارسی/انگلیسی (OCR) و موتور جستجوی تمام‌متن",
    descEn:
      "Digital & physical archive zoning (ISO 15489 / 30301), document scanning/OCR text extraction, and unified Full-Text Search engine",
  },
  {
    id: "kms",
    icon: "🧠",
    fa: "مدیریت دانش و ویکی (KMS)",
    en: "Knowledge Management & Wiki (KMS)",
    code: "MOD-07.05",
    viewPerm: "edms.kms.view",
    writePerm: "edms.kms.manage",
    descFa:
      "ثبت دروس آموخته‌شده (Lessons Learned) در پروژه‌ها و تولید و پایگاه دانش/ویکی سازمانی برای دستورالعمل‌ها و Best Practices (ISO 30401)",
    descEn:
      "Project & manufacturing Lessons Learned repository and organizational Wiki / Knowledge Base for SOPs and Best Practices (ISO 30401)",
  },
] as const;

interface EdmsWorkspaceShellProps {
  lang?: Lang;
  activeSub?: EdmsTabId;
  onSelectSub?: (id: EdmsTabId) => void;
  onBackHome?: () => void;
}

export const EdmsWorkspaceShell: React.FC<EdmsWorkspaceShellProps> = ({
  lang = "fa",
  activeSub = "dmi",
  onSelectSub,
  onBackHome,
}) => {
  const fa = lang === "fa";
  const tr = (f: string, e: string) => (fa ? f : e);
  const { projectScope } = useSystem();
  const projectId = projectScope?.projectId || "c1-p1";

  const [internalTab, setInternalTab] = useState<EdmsTabId>("dmi");
  const validTab = EDMS_TABS.find((t) => t.id === activeSub)?.id;
  const activeTab: EdmsTabId = validTab ?? internalTab;

  const handleSelectTab = (id: EdmsTabId) => {
    setInternalTab(id);
    onSelectSub?.(id);
  };

  const [userId, setUserId] = useState<string>(EDMS_DEMO_USERS[0].id);

  const effectivePerms = useMemo(() => {
    const subj = DEMO_SUBJECTS.find((s) => s.id === userId);
    return new Set(subj ? subjectPermissions(subj) : []);
  }, [userId]);

  const currentTab = EDMS_TABS.find((t) => t.id === activeTab) ?? EDMS_TABS[0];
  const canView = effectivePerms.has(currentTab.viewPerm);
  const canWrite =
    effectivePerms.has(currentTab.writePerm) ||
    (activeTab === "workflows" && effectivePerms.has("edms.transmittal.manage"));

  return (
    <ModuleWorkspaceShell
      lang={lang}
      accent="#6366f1"
      icon="🗂️"
      title={tr(
        "سامانهٔ مدیریت اسناد، بایگانی دیجیتال و مدیریت دانش (EDMS / KMS)",
        "Enterprise Electronic Document & Knowledge Management System (EDMS / KMS)",
      )}
      subtitle={tr(
        "سرگروه هفتم سازمان (۵+۲) · منطبق با ISO 15489، ISO 30301، ISO 9001 و ISO 30401 روی /api/edms",
        "Organizational Pillar #7 · Aligned with ISO 15489, ISO 30301, ISO 9001 & ISO 30401 over /api/edms",
      )}
      badges={
        <>
          <span className="rounded-md border border-indigo-500/40 bg-indigo-500/10 px-2 py-0.5 text-[10px] text-indigo-300">
            ISO 15489 · ISO 9001 · KMS
          </span>
          <span className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
            {canWrite ? tr("مجوز ویرایش/تأیید فعال", "Write/Approve Enabled") : tr("فقط مشاهده", "Read Only")}
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
            aria-label={tr("هویت کاربر EDMS/KMS", "EDMS/KMS User Identity")}
          >
            {EDMS_DEMO_USERS.map((u) => (
              <option key={u.id} value={u.id}>
                {u.id} — {u.labelFa}
              </option>
            ))}
          </select>
        </>
      }
      onBack={onBackHome ?? (() => {})}
      navTitle={tr("مدیریت اسناد و دانش سازمانی (EDMS/KMS)", "Document & Knowledge Management (EDMS/KMS)")}
      navItems={EDMS_TABS.map((item) => {
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
          {currentTab.code} · /api/edms/{projectId} · {userId}
        </span>
      }
      notice={
        <div className={`${moduleCardCls} p-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px]`}>
          <span className="tx2">
            {tr(
              "استقلال منطقی جداول Edms* و Kms* حفظ شده و اسناد فنی و دروس آموخته با کلیدهای ارجاع نرم به دارایی‌های CMMS، مراکز کاری MES و WBS متصل‌اند.",
              "Logical schema independence (Edms* & Kms* tables) is preserved with soft references to CMMS assets, MES work centers, and WBS.",
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
          data-testid="edms-tab-locked"
        >
          نقش انتخاب‌شده مجوز مشاهدهٔ این زیرماژول (
          <code className="font-mono">{currentTab.viewPerm}</code>) را ندارد.
        </div>
      ) : (
        <>
          {activeTab === "dmi" && (
            <EdmsDocumentControlPanel projectId={projectId} userId={userId} canWrite={canWrite} />
          )}
          {activeTab === "revisions" && (
            <EdmsRevisionsLockPanel projectId={projectId} userId={userId} canWrite={canWrite} />
          )}
          {activeTab === "workflows" && (
            <EdmsWorkflowsTransmittalsPanel projectId={projectId} userId={userId} canWrite={canWrite} />
          )}
          {activeTab === "archive" && (
            <EdmsArchiveOcrSearchPanel projectId={projectId} userId={userId} canWrite={canWrite} />
          )}
          {activeTab === "kms" && (
            <EdmsKnowledgeManagementPanel projectId={projectId} userId={userId} canWrite={canWrite} />
          )}
        </>
      )}
    </ModuleWorkspaceShell>
  );
};

export default EdmsWorkspaceShell;
