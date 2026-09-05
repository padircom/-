import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { type Lang } from "../data/framework";

export type RoleCode = "admin" | "project_manager" | "planner" | "site_engineer" | "consultant" | "client" | "executive";

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

export const roleLabels: Record<RoleCode, { fa: string; en: string }> = {
  admin: { fa: "مدیر سامانه", en: "System Admin" },
  project_manager: { fa: "مدیر پروژه", en: "Project Manager" },
  planner: { fa: "کارشناس برنامه‌ریزی", en: "Planner" },
  site_engineer: { fa: "کارگاه / اجرا", en: "Site Engineer" },
  consultant: { fa: "مشاور", en: "Consultant" },
  client: { fa: "کارفرما", en: "Client" },
  executive: { fa: "مدیر ارشد", en: "Executive" },
};

export const rolePermissions: Record<RoleCode, PermissionCode[]> = {
  admin: ["system.manage", "portfolio.view", "project.view", "project.edit", "report.daily.edit", "report.approve", "schedule.edit", "risk.edit", "claim.edit", "cost.view", "ai.run"],
  project_manager: ["portfolio.view", "project.view", "project.edit", "report.daily.edit", "report.approve", "schedule.edit", "risk.edit", "claim.edit", "cost.view", "ai.run"],
  planner: ["portfolio.view", "project.view", "schedule.edit", "report.daily.edit", "ai.run"],
  site_engineer: ["project.view", "report.daily.edit"],
  consultant: ["portfolio.view", "project.view", "report.approve", "risk.edit", "claim.edit"],
  client: ["portfolio.view", "project.view", "report.approve", "cost.view"],
  executive: ["portfolio.view", "project.view", "cost.view", "ai.run"],
};

const demoUsers: AuthUser[] = [
  { id: "u-admin", username: "admin", displayName: "محمدرضا هاشمی‌پور", role: "admin", email: "admin@pmis.local", projectIds: ["*"], active: true },
  { id: "u-pm", username: "pm.azadegan", displayName: "مدیر پروژه آزادگان", role: "project_manager", email: "pm@pmis.local", projectIds: ["c1-p1", "c1-p2"], active: true },
  { id: "u-planner", username: "planner", displayName: "کارشناس برنامه‌ریزی", role: "planner", email: "planner@pmis.local", projectIds: ["*"], active: true },
  { id: "u-site", username: "site.engineer", displayName: "سرپرست کارگاه", role: "site_engineer", email: "site@pmis.local", projectIds: ["c1-p1"], active: true },
  { id: "u-consultant", username: "consultant", displayName: "نماینده مشاور", role: "consultant", email: "consultant@pmis.local", projectIds: ["c1-p1", "c5-p1"], active: true },
  { id: "u-client", username: "client", displayName: "نماینده کارفرما", role: "client", email: "client@pmis.local", projectIds: ["c1-p1", "c3-p1"], active: true },
  { id: "u-ceo", username: "ceo", displayName: "مدیر ارشد", role: "executive", email: "ceo@pmis.local", projectIds: ["*"], active: true },
];

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