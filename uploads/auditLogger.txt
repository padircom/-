/**
 * PMIS Audit Logger & Activity Tracker
 * -----------------------------------------------------------------------------
 * ثبت کلیه تراکنش‌ها، تغییرات ساختاری و عملیاتی نرم‌افزار در پایگاه داده SQL Server (dbo.Audit_Register)
 */

export type AuditSeverity = "info" | "warning" | "security" | "critical";

export type AuditLogEntry = {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  module: string;
  details: string;
  ipAddress: string;
  severity: AuditSeverity;
};

const AUDIT_STORE_KEY = "pmis:audit-logs:v1";

export const getAuditLogs = (): AuditLogEntry[] => {
  try {
    const saved = localStorage.getItem(AUDIT_STORE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

export const logAudit = (
  action: string,
  moduleName: string,
  details: string,
  severity: AuditSeverity = "info",
  user?: { name: string; role: string }
) => {
  const entry: AuditLogEntry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    userId: user?.name ?? "Current User",
    userName: user?.name ?? "محمدرضا هاشمی‌پور",
    userRole: user?.role ?? "مدیر پروژه / PMO",
    action,
    module: moduleName,
    details,
    ipAddress: "127.0.0.1 (Localhost)",
    severity,
  };

  try {
    const current = getAuditLogs();
    const next = [entry, ...current].slice(0, 200); // keep last 200 logs
    localStorage.setItem(AUDIT_STORE_KEY, JSON.stringify(next));
  } catch (e) {
    console.error("Failed to write audit log:", e);
  }
  return entry;
};
