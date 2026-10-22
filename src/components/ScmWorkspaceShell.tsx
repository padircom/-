/**
 * میز کار SCM (سرگروه چهارم سازمان): زنجیرهٔ تأمین، بازرگانی و انبار.
 * ═══════════════════════════════════════════════════════════════════════
 * پوسته روی `ModuleWorkspaceShell` سوار است (مثل MES/CMMS/IIoT) و هر زیرماژول
 * را به بخش CRUD خودش می‌سپارد. داده یک‌بار از `GET /api/scm/:projectId/workspace`
 * خوانده می‌شود و پس از هر تغییر موفق دوباره خوانده می‌شود.
 *
 * دو نکتهٔ صادقانه:
 * ۱) مسیر `workspace` مجوز `scm.package.view` می‌خواهد؛ اگر هویت انتخابی این
 *    مجوز را نداشته باشد، خطای سرور عیناً نشان داده می‌شود (نه دادهٔ ساختگی).
 * ۲) تب‌ها با مجوز واقعی همان مسیرها فعال/غیرفعال می‌شوند (`canScmAccess`) و
 *    تصمیم نهایی همیشه با سرور است.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Lang } from "../data/framework";
import { useAuth } from "../context/AuthContext";
import { useCurrentProjectId } from "../context/SystemContext";
import ModuleWorkspaceShell, { moduleCardCls, moduleChipCls, moduleSelectCls } from "./ModuleWorkspaceShell";
import {
  ScmCrmCrudSection,
  ScmFinanceCrudSection,
  ScmInventoryCrudSection,
  ScmMovementsCrudSection,
  ScmPurchasingCrudSection,
  type ScmPanelProps,
} from "./ScmCrudPanels";
import {
  callScm,
  canScmAccess,
  describeScmError,
  ScmClient,
  SCM_DEMO_USERS,
  type ScmWorkspacePayload,
} from "../services/scmApi";

export type ScmSubModuleId = "inventory" | "purchasing" | "crm" | "movements" | "finance";

/** دسته‌های سایدبار داخلی — همان الگوی CMMS/MES: خط جداکننده + عنوان دسته. */
const SCM_NAV_GROUPS: Record<string, { fa: string; en: string }> = {
  inventory: { fa: "انبار و تأمین", en: "Inventory & Supply" },
  purchasing: { fa: "انبار و تأمین", en: "Inventory & Supply" },
  crm: { fa: "بازرگانی و گردش کالا", en: "Commercial & Goods Movement" },
  movements: { fa: "بازرگانی و گردش کالا", en: "Commercial & Goods Movement" },
  finance: { fa: "مالی و هزینه‌یابی", en: "Finance & Costing" },
};

export const SCM_SUBMODULES: Array<{
  id: ScmSubModuleId;
  icon: string;
  fa: string;
  en: string;
  descFa: string;
  descEn: string;
  /** اگر هیچ‌کدام از این مجوزها نباشد، تب غیرفعال می‌شود. */
  viewPermissions: string[];
}> = [
  {
    id: "inventory",
    icon: "🏬",
    fa: "مدیریت انبارها و موجودی",
    en: "Warehouses & Inventory Management",
    descFa: "انبارها، کاتالوگ کالا و ماندهٔ لحظه‌ای موجودی روی همان APIهای /warehouses, /catalog و /stock-balances.",
    descEn: "Warehouses, material catalog and live balances via /warehouses, /catalog and /stock-balances.",
    viewPermissions: ["scm.mrr.view"],
  },
  {
    id: "purchasing",
    icon: "🧾",
    fa: "درخواست و سفارشات خرید",
    en: "Purchase Requisitions & Orders",
    descFa: "MR، فروشنده و AVL، بستهٔ خرید و پیوند MR، استعلام، LBL/SBL، دعوت‌نامه، جلسات KOM/PIM و PSR.",
    descEn: "MRs, vendors & AVL, packages and MR links, inquiries, LBL/SBL, invitations, KOM/PIM meetings and PSR.",
    viewPermissions: ["scm.package.view", "scm.mr.view", "scm.vendor.view"],
  },
  {
    id: "crm",
    icon: "🤝",
    fa: "فروش و مدیریت مشتریان (CRM)",
    en: "Sales & Customer Relationship Management (CRM)",
    descFa: "در این نسخه، سمت بازرگانی مناقصه: پیشنهاد فنی/بازرگانی، شفاف‌سازی، ارزیابی TBE/TBA/CBE و Bid Report.",
    descEn: "In this release, the commercial side of tendering: proposals, clarifications, TBE/TBA/CBE evaluations and bid reports.",
    viewPermissions: ["scm.bidder.view"],
  },
  {
    id: "movements",
    icon: "🚚",
    fa: "ورود و خروج کالا (رسید / حواله)",
    en: "Goods Receipt & Issue (GRN / GIN)",
    descFa: "MRC، حوالهٔ مصرف MIV، مرجوعی MRV، انتقال بین انبار، رسید مواد MRR/OPI، بازرسی و حمل.",
    descEn: "MRC, issue notes (MIV), returns (MRV), inter-warehouse transfers, receiving (MRR/OPI), inspection and shipment.",
    viewPermissions: ["scm.mrr.view"],
  },
  {
    id: "finance",
    icon: "💳",
    fa: "حسابداری و هزینه‌یابی مالی",
    en: "Financial Accounting & Costing",
    descFa: "تجمیع برآوردی موجودی و تعهدات خرید؛ دفتر کل و بهای تمام‌شده در این ماژول پیاده نشده است.",
    descEn: "Estimated stock and procurement-commitment summary; general ledger and costing are not implemented in this module.",
    viewPermissions: ["scm.mrr.view", "scm.package.view"],
  },
];

interface Props {
  lang: Lang;
  activeSub: ScmSubModuleId;
  onSelectSub: (sub: ScmSubModuleId) => void;
  onBackHome?: () => void;
}

/** رنگ تأکیدی SCM (هم‌خوان با تیل قبلی). */
const SCM_ACCENT = "#2dd4bf";

export default function ScmWorkspaceShell({ lang, activeSub, onSelectSub, onBackHome }: Props) {
  const fa = lang === "fa";
  const tr = (faText: string, enText: string) => (fa ? faText : enText);
  const projectId = useCurrentProjectId();
  const { user } = useAuth();

  /* پیش‌فرض: خود کاربر وارد‌شده اگر مجوز SCM دارد، وگرنه هویتی که همهٔ مجوزهای
   * این ماژول را دارد (مدیر پروژه). فهرست از همان ماتریس RBAC می‌آید. */
  const [userId, setUserId] = useState<string>(() => {
    const loggedIn = SCM_DEMO_USERS.find((candidate) => candidate.id === user?.id);
    if (loggedIn) return loggedIn.id;
    return SCM_DEMO_USERS.find((candidate) => candidate.id === "u-pm")?.id ?? SCM_DEMO_USERS[0]?.id ?? "";
  });

  /* اگر کاربر وارد‌شده عوض شود، هویت انتخابی هم اگر بخشی از فهرست باشد هم‌راستا می‌شود. */
  useEffect(() => {
    const loggedIn = SCM_DEMO_USERS.find((candidate) => candidate.id === user?.id);
    if (loggedIn) setUserId(loggedIn.id);
  }, [user?.id]);

  const client = useMemo(() => new ScmClient(projectId, userId || null), [projectId, userId]);

  const [state, setState] = useState<{ data: ScmWorkspacePayload | null; loading: boolean; error: string | null }>({
    data: null,
    loading: true,
    error: null,
  });
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    callScm(client.workspace())
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ data: null, loading: false, error: describeScmError(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [client, nonce]);

  const canAny = useCallback(
    (permissions: string[]) => permissions.some((permission) => canScmAccess(userId, permission)),
    [userId],
  );

  const visibleSubs = useMemo(
    () => SCM_SUBMODULES.filter((item) => canAny(item.viewPermissions)),
    [canAny],
  );
  const current = SCM_SUBMODULES.find((item) => item.id === activeSub) ?? SCM_SUBMODULES[0];
  const canSeeCurrent = canAny(current.viewPermissions);

  const panelProps: ScmPanelProps = {
    fa,
    projectId,
    userId,
    client,
    data: state.data,
    loading: state.loading,
    error: state.error,
    reload,
  };

  const renderBody = () => {
    if (!canSeeCurrent) {
      return (
        <div className={`${moduleCardCls} p-4 space-y-1`}>
          <div className="tx1 text-sm font-medium">{tr("مجوز دسترسی به این بخش را ندارید", "You do not have access to this section")}</div>
          <p className="tx3 text-[11px]" dir="ltr">
            {tr("مجوز موردنیاز: ", "Required permission: ")}
            {current.viewPermissions.join(" / ")}
          </p>
          <p className="tx3 text-[11px]">
            {tr(
              "هویت دیگری را از نوار بالا انتخاب کنید؛ ماتریس مجوز نقش‌ها در accessControl.ts تعریف شده است.",
              "Pick another identity from the top bar; the role permission matrix lives in accessControl.ts.",
            )}
          </p>
        </div>
      );
    }

    switch (current.id) {
      case "inventory":
        return <ScmInventoryCrudSection {...panelProps} />;
      case "purchasing":
        return <ScmPurchasingCrudSection {...panelProps} />;
      case "crm":
        return <ScmCrmCrudSection {...panelProps} />;
      case "movements":
        return <ScmMovementsCrudSection {...panelProps} />;
      case "finance":
        return <ScmFinanceCrudSection {...panelProps} />;
      default:
        return null;
    }
  };

  const counters: Array<{ label: string; value: number }> = [
    { label: tr("فروشنده", "Vendors"), value: state.data?.vendors.length ?? 0 },
    { label: tr("MR", "MRs"), value: state.data?.mrs.length ?? 0 },
    { label: tr("بستهٔ خرید", "Packages"), value: state.data?.packages.length ?? 0 },
    { label: tr("استعلام", "Inquiries"), value: state.data?.inquiries.length ?? 0 },
    { label: tr("رسید مواد", "Receipts"), value: state.data?.mrrs.length ?? 0 },
    { label: tr("ماندهٔ موجودی", "Balances"), value: state.data?.balances.length ?? 0 },
  ];

  return (
    <ModuleWorkspaceShell
      lang={lang}
      accent={SCM_ACCENT}
      icon="📦"
      title={tr(
        "سامانهٔ زنجیره تأمین، بازرگانی و مالی (SCM & Finance)",
        "Supply Chain, Commercial & Financial System (SCM & Finance)",
      )}
      subtitle={tr(
        "سرگروه چهارم سازمان · مدیریت یکپارچهٔ انبار، تدارکات، بازرگانی مناقصه و تجمیع مالی برآوردی روی /api/scm",
        "Organizational Pillar #4 · Integrated warehousing, procurement, tendering and estimated financial roll-up over /api/scm",
      )}
      badges={
        <span className="rounded-md border border-teal-500/40 bg-teal-500/10 px-2 py-0.5 text-[10px] text-teal-300">
          {tr("متصل به API", "Live API")}
        </span>
      }
      actions={
        <>
          <span className={moduleChipCls} dir="ltr">
            project: {projectId}
          </span>
          <select
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            className={moduleSelectCls}
            dir="ltr"
            aria-label={tr("هویت کاربر", "User identity")}
          >
            {SCM_DEMO_USERS.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.id} — {fa ? candidate.roleFa : candidate.roleEn} ({candidate.permissions.length}/10)
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={reload}
            className="rounded-lg border b-line-soft px-2.5 py-1 text-[10.5px] tx2 hover:tx1"
          >
            ↻ {tr("بازخوانی", "Refresh")}
          </button>
        </>
      }
      onBack={onBackHome}
      navTitle={tr("زنجیره تأمین، بازرگانی و مالی", "Supply Chain, Commercial & Finance")}
      navItems={SCM_SUBMODULES.map((item) => {
        const allowed = canAny(item.viewPermissions);
        return {
          id: item.id,
          label: fa ? item.fa : item.en,
          icon: item.icon,
          group: fa ? SCM_NAV_GROUPS[item.id]?.fa : SCM_NAV_GROUPS[item.id]?.en,
          disabled: !allowed,
          disabledHint: tr(
            `مجوز این بخش را ندارید (${item.viewPermissions.join(" / ")})`,
            `No permission for this section (${item.viewPermissions.join(" / ")})`,
          ),
        };
      })}
      activeId={current.id}
      onSelect={onSelectSub}
      panelTitle={fa ? current.fa : current.en}
      panelIcon={current.icon}
      panelDesc={fa ? current.descFa : current.descEn}
      panelMeta={
        <span className={moduleChipCls} dir="ltr">
          /api/scm/{projectId} · {userId}
        </span>
      }
      notice={
        <>
          <div className={`${moduleCardCls} p-3 flex flex-wrap items-center gap-3 text-[11px]`}>
            {counters.map((counter) => (
              <span key={counter.label} className="tx3">
                {counter.label}: <span className="tx1" dir="ltr">{counter.value}</span>
              </span>
            ))}
            {state.loading && <span className="tx3">{tr("در حال دریافت…", "Loading…")}</span>}
          </div>
          {state.error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 space-y-1">
              <div className="tx1 text-xs font-medium">{tr("دریافت میز کار ناموفق بود", "Failed to load the workspace")}</div>
              <div className="tx2 text-[11px]" dir="rtl">{state.error}</div>
              <div className="tx3 text-[11px]">
                {tr(
                  "مسیر workspace مجوز scm.package.view می‌خواهد؛ هویت دیگری را از نوار بالا انتخاب کنید یا با همان هویت درست وارد شوید.",
                  "The workspace route requires scm.package.view; pick another identity above or sign in with a permitted one.",
                )}
              </div>
            </div>
          )}
          {visibleSubs.length === 0 && SCM_DEMO_USERS.length === 0 && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 tx1 text-xs">
              {tr("هیچ هویتی در ماتریس مجوز این ماژول تعریف نشده است.", "No identity has SCM permissions in the matrix.")}
            </div>
          )}
        </>
      }
    >
      {renderBody()}
    </ModuleWorkspaceShell>
  );
}
