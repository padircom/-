/**
 * کلاینت REST API بخش ۶ سازمان: مدیریت جامع منابع انسانی (Enterprise HRM)
 * منطبق با ISO 30414 و قوانین کار و تأمین اجتماعی ایران.
 */

export const HRM_DEMO_USERS = [
  { id: "u-hr", labelFa: "مدیر منابع انسانی (دسترسی کامل HRM و محاسبه حقوق)", roleFa: "hr_manager" },
  { id: "u-pm", labelFa: "مدیر پروژه (مدیریت سازمان، تصویب حقوق و سند مالی)", roleFa: "project_manager" },
  { id: "u-cost", labelFa: "کنترل هزینه (مشاهده حقوق، فیش و اسناد بهای تمام‌شده)", roleFa: "cost_controller" },
  { id: "u-site", labelFa: "سرپرست کارگاه (فقط مشاهده چارت، مهارت، شیفت و آموزش)", roleFa: "site_engineer" },
  { id: "u-admin", labelFa: "مدیر سامانه (همهٔ مجوزهای مدیریتی)", roleFa: "admin" },
] as const;

export interface HrmWorkspaceSummary {
  projectId: string;
  standards: string[];
  kpis: {
    orgUnitsCount: number;
    approvedHeadcount: number;
    currentHeadcount: number;
    activeProfilesCount: number;
    activeContractsCount: number;
    validCertificatesCount: number;
    expiringCertificatesCount: number;
    cmmsLinkedSkillsCount: number;
    mesLinkedSkillsCount: number;
    shiftPatternsCount: number;
    totalOvertimeHours: number;
    pendingLeavesCount: number;
    activeMissionsCount: number;
    totalGrossPayrollRials: number;
    totalNetPayrollRials: number;
    totalEmployerSsiRials: number;
    directLaborAllocatedRials: number;
    indirectLaborAllocatedRials: number;
    trainingCoursesCount: number;
    avgTrainingEffectivenessPct: number;
    avgPerformance360ScorePct: number;
  };
  crossModuleLinks: {
    cmmsWorkOrdersLinked: Array<{
      rosterCode: string;
      personnelNo: string;
      workOrderRef: string;
      hours: number;
    }>;
    mesOrdersLinked: Array<{
      rosterCode: string;
      personnelNo: string;
      mesOrderRef: string;
      operationCode: string;
      hours: number;
    }>;
    financeVouchersPosted: Array<{
      voucherNo: string;
      costCategory: string;
      finCostCenterRef: string;
      totalAllocatedRials: number;
      status: string;
    }>;
  };
}

async function hrmFetch<T>(path: string, userId: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers || {});
  headers.set("Content-Type", "application/json");
  if (userId) headers.set("x-user-id", userId);
  const res = await fetch(path, { ...init, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      body?.error?.message ||
      body?.messageFa ||
      body?.message ||
      `خطای ارتباط با سرور منابع انسانی (${res.status})`;
    throw new Error(msg);
  }
  return body as T;
}

export async function fetchHrmWorkspace(projectId: string, userId: string): Promise<HrmWorkspaceSummary> {
  return hrmFetch<HrmWorkspaceSummary>(`/api/hrm/${encodeURIComponent(projectId)}/workspace`, userId);
}

export async function runHrmMonthlyPayroll(
  projectId: string,
  userId: string,
  payload: { periodCode: string; titleFa?: string },
): Promise<{ ok: boolean; payrollRun: Record<string, unknown>; payslipsCount: number; costVoucher: Record<string, unknown> }> {
  return hrmFetch(`/api/hrm/${encodeURIComponent(projectId)}/payroll-runs/calculate`, userId, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function createHrmCrudClient<T extends Record<string, unknown>>(resourcePath: string) {
  return {
    async list(projectId: string, userId: string): Promise<T[]> {
      const res = await hrmFetch<{ items?: T[] }>(
        `/api/hrm/${encodeURIComponent(projectId)}/${resourcePath}`,
        userId,
      );
      return Array.isArray(res.items) ? res.items : [];
    },
    async create(projectId: string, userId: string, payload: Partial<T>): Promise<T> {
      return hrmFetch<T>(`/api/hrm/${encodeURIComponent(projectId)}/${resourcePath}`, userId, {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    async update(projectId: string, userId: string, id: string, payload: Partial<T>): Promise<T> {
      return hrmFetch<T>(
        `/api/hrm/${encodeURIComponent(projectId)}/${resourcePath}/${encodeURIComponent(id)}`,
        userId,
        {
          method: "PUT",
          body: JSON.stringify(payload),
        },
      );
    },
    async remove(projectId: string, userId: string, id: string): Promise<{ ok: boolean; id: string }> {
      return hrmFetch<{ ok: boolean; id: string }>(
        `/api/hrm/${encodeURIComponent(projectId)}/${resourcePath}/${encodeURIComponent(id)}`,
        userId,
        {
          method: "DELETE",
        },
      );
    },
  };
}
