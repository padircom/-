import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { DEMO_SUBJECTS, ROLE_CATALOG, effectivePermissions } from "../services/accessControl";
import { type Lang } from "../data/framework";

/* کدهای نقش با `ROLE_CATALOG` موتور RBAC یکی‌اند. پیش از این، این فهرست
 * دستی و کوتاه‌تر بود و کاربرانی مثل مدیر پیمان اصلاً در رابط کاربری وجود
 * نداشتند — یعنی سرور مجوزشان را می‌شناخت ولی کاربر نمی‌توانست وارد شود و
 * ۴۰۳ می‌گرفت. حالا فهرست از خود موتور مشتق می‌شود. */
export type RoleCode =
  | "admin" | "project_manager" | "planner" | "site_engineer" | "consultant"
  | "client" | "executive" | "contracts_manager" | "cost_controller"
  | "qc_inspector" | "qa_manager" | "hr_manager" | "doc_controller"
  | "pmo" | "engineering_manager" | "design_lead" | "subcontractor" | "auditor";

export type PermissionCode =
  | "system.manage"
  | "portfolio.view"
  | "project.view"
  | "project.edit"
  | "report.daily.edit"
  | "report.approve"
  | "schedule.edit"
  | "risk.edit"
  | "claim.edit"
  | "cost.view"
  | "ai.run";

export type AuthUser = {
  id: string;
  username: string;
  displayName: string;
  role: RoleCode;
  email: string;
  projectIds: string[]; // ["*"] means all projects
  active: boolean;
};

export type AuditEvent = {
  id: string;
  userId: string;
  username: string;
  action: string;
  entity?: string;
  entityId?: string;
  projectId?: string;
  createdAt: string;
};

type AuthContextType = {
  user: AuthUser | null;
  users: AuthUser[];
  permissions: PermissionCode[];
  loginAs: (userId: string) => void;
  logout: () => void;
  can: (permission: PermissionCode, projectId?: string | null) => boolean;
  audit: (action: string, details?: Partial<Omit<AuditEvent, "id" | "userId" | "username" | "createdAt">>) => void;
  auditEvents: AuditEvent[];
  clearAudit: () => void;
};

const AUTH_USER_STORE = "pmis:auth-user:v1";
const AUDIT_STORE = "pmis:audit-log:v1";

export const roleLabels: Record<string, { fa: string; en: string }> = Object.fromEntries(
  ROLE_CATALOG.map((r) => [r.code, { fa: r.title.fa, en: r.title.en }]),
);

/* نگاشت نقش‌های ریز موتور به مجوزهای درشت رابط کاربری.
 *
 * دو فهرست مجوز عمداً یکی نمی‌شوند: موتور ۷۶ مجوز ریز برای تصمیم سمت سرور
 * دارد و رابط کاربری ۱۱ مجوز درشت برای نمایش و غیرفعال کردن دکمه. یکی کردنشان
 * یعنی هر بار افزودن مجوز به سرور، رابط کاربری هم باید عوض شود. آنچه واقعاً
 * باگ می‌ساخت واگرایی فهرست کاربران و نقش‌ها بود، نه ریزدانگی متفاوت مجوزها. */
const ENGINE_TO_UI: Record<string, PermissionCode[]> = {
  "sys.config.manage": ["system.manage"],
  "sys.user.manage": ["system.manage"],
  "core.portfolio.view": ["portfolio.view"],
  "core.project.view": ["project.view"],
  "core.project.edit": ["project.edit"],
  "core.ai.run": ["ai.run"],
  "plan.progress.report": ["report.daily.edit"],
  "plan.schedule.edit": ["schedule.edit"],
  "plan.baseline.set": ["schedule.edit"],
  "report.official.publish": ["report.approve"],
  "report.internal.generate": ["report.approve"],
  "doc.document.approve": ["report.approve"],
  "rcc.risk.edit": ["risk.edit"],
  "rcc.claim.edit": ["claim.edit"],
  "rcc.claim.submit": ["claim.edit"],
  "fin.cost.view": ["cost.view"],
  "cnt.contract.view": ["cost.view"],
};

export const rolePermissions: Record<string, PermissionCode[]> = Object.fromEntries(
  ROLE_CATALOG.map((r) => {
    const ui = new Set<PermissionCode>();
    for (const grant of effectivePermissions(r.code)) {
      for (const p of ENGINE_TO_UI[grant] ?? []) ui.add(p);
    }
    return [r.code, [...ui]];
  }),
);

/* کاربران نمونه از همان فهرستی می‌آیند که سرور برای ارزیابی مجوز استفاده
 * می‌کند. پیش از این دو فهرست دستی جدا بودند و کاربرانی مثل `u-contracts`
 * (مدیر پیمان) فقط سمت سرور وجود داشتند؛ نتیجه این بود که سرور مجوزشان را
 * می‌شناخت ولی هیچ‌کس در رابط کاربری نمی‌توانست به آن هویت وارد شود و هر
 * ثبت پیمان ۴۰۳ می‌گرفت.
 *
 * کاربران عمداً معیوب کنار گذاشته می‌شوند: `u-over` دو نقش متضاد دارد و برای
 * آزمون تفکیک وظیفه ساخته شده، `u-left` غیرفعال است. */
const EXCLUDED_FROM_LOGIN = new Set(["u-over", "u-left"]);

const demoUsers: AuthUser[] = DEMO_SUBJECTS.filter(
  (sub) => sub.active && !EXCLUDED_FROM_LOGIN.has(sub.id),
).map((sub) => {
  const username = sub.id.replace(/^u-/, "");
  return {
    id: sub.id,
    username,
    displayName: sub.displayName,
    role: (sub.roles[0] ?? "viewer") as RoleCode,
    email: `${username}@pmis.local`,
    projectIds: sub.projectIds,
    active: sub.active,
  };
});

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const loadAudit = (): AuditEvent[] => {
  try {
    return JSON.parse(localStorage.getItem(AUDIT_STORE) ?? "[]") as AuditEvent[];
  } catch {
    return [];
  }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try {
      const savedId = localStorage.getItem(AUTH_USER_STORE);
      return demoUsers.find((u) => u.id === savedId) ?? demoUsers[0];
    } catch {
      return demoUsers[0];
    }
  });
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>(loadAudit);

  const permissions = useMemo(() => (user ? rolePermissions[user.role] : []), [user]);

  useEffect(() => {
    if (user) localStorage.setItem(AUTH_USER_STORE, user.id);
    else localStorage.removeItem(AUTH_USER_STORE);
  }, [user]);

  useEffect(() => {
    localStorage.setItem(AUDIT_STORE, JSON.stringify(auditEvents.slice(0, 200)));
  }, [auditEvents]);

  const loginAs = (userId: string) => {
    const found = demoUsers.find((u) => u.id === userId && u.active);
    if (!found) return;
    setUser(found);
    const event: AuditEvent = {
      id: `audit-${Date.now()}`,
      userId: found.id,
      username: found.username,
      action: "AUTH_LOGIN_AS",
      createdAt: new Date().toISOString(),
    };
    setAuditEvents((prev) => [event, ...prev].slice(0, 200));
  };

  const logout = () => {
    if (user) {
      setAuditEvents((prev) => [{ id: `audit-${Date.now()}`, userId: user.id, username: user.username, action: "AUTH_LOGOUT", createdAt: new Date().toISOString() }, ...prev].slice(0, 200));
    }
    setUser(null);
  };

  const can = (permission: PermissionCode, projectId?: string | null) => {
    if (!user) return false;
    if (!permissions.includes(permission)) return false;
    if (!projectId || user.projectIds.includes("*")) return true;
    return user.projectIds.includes(projectId);
  };

  const audit: AuthContextType["audit"] = (action, details = {}) => {
    if (!user) return;
    setAuditEvents((prev) => [{ id: `audit-${Date.now()}`, userId: user.id, username: user.username, action, createdAt: new Date().toISOString(), ...details }, ...prev].slice(0, 200));
  };

  return (
    <AuthContext.Provider value={{ user, users: demoUsers, permissions, loginAs, logout, can, audit, auditEvents, clearAudit: () => setAuditEvents([]) }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export function roleLabel(role: RoleCode, lang: Lang) {
  return roleLabels[role][lang];
}