import type { Cluster, Project } from "../data/framework";
import type { SystemSettings } from "../context/SystemContext";

export type BackupPayload = {
  version: string;
  exportedAt: string;
  clusters: Cluster[];
  projectsByCluster: Record<string, Project[]>;
  settings: SystemSettings;
  auditLogs?: unknown[];
};

export type SecurityCheck = {
  id: string;
  title: string;
  detail: string;
  status: "ready" | "attention" | "blocked";
};

export const BACKUP_VERSION = "PMIS-BACKUP-V1";

export function validateBackup(value: unknown): { ok: true; data: BackupPayload } | { ok: false; error: string } {
  if (!value || typeof value !== "object") return { ok: false, error: "Backup must be a JSON object." };
  const item = value as Partial<BackupPayload>;
  if (item.version !== BACKUP_VERSION) return { ok: false, error: "Unsupported backup version." };
  if (!Array.isArray(item.clusters)) return { ok: false, error: "Backup clusters are missing or invalid." };
  if (!item.projectsByCluster || typeof item.projectsByCluster !== "object") return { ok: false, error: "Backup projects are missing or invalid." };
  if (!item.settings || typeof item.settings !== "object") return { ok: false, error: "Backup settings are missing or invalid." };

  const clusters = item.clusters as Cluster[];
  const projectsByCluster = item.projectsByCluster as Record<string, Project[]>;
  const invalidCluster = clusters.some((c) => !c.id || !c.title || !c.color);
  if (invalidCluster) return { ok: false, error: "Backup contains an invalid cluster record." };
  const invalidProject = Object.values(projectsByCluster).flat().some((p) => !p.id || !p.code || !p.name || !p.status);
  if (invalidProject) return { ok: false, error: "Backup contains an invalid project record." };

  return { ok: true, data: { ...item, clusters, projectsByCluster, settings: item.settings as SystemSettings } as BackupPayload };
}

export function downloadJson(value: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function getSecurityChecks({
  authenticated,
  role,
  sqlConfigured,
  sqlStatus,
  hasBackup,
}: {
  authenticated: boolean;
  role: string;
  sqlConfigured: boolean;
  sqlStatus: string;
  hasBackup: boolean;
}): SecurityCheck[] {
  return [
    {
      id: "auth",
      title: "Authentication session",
      detail: authenticated ? `Authenticated as ${role}` : "No authenticated session",
      status: authenticated ? "ready" : "blocked",
    },
    {
      id: "rbac",
      title: "Role-based access control",
      detail: role === "project_manager" ? "Master configuration access enabled" : "Restricted role; master configuration is protected",
      status: role === "project_manager" ? "ready" : "attention",
    },
    {
      id: "sql",
      title: "SQL Server API channel",
      detail: sqlConfigured ? `API configured · ${sqlStatus}` : "Configure the API endpoint before production use",
      status: sqlStatus === "connected" ? "ready" : "attention",
    },
    {
      id: "backup",
      title: "Validated recovery snapshot",
      detail: hasBackup ? "A backup snapshot is available in this browser" : "Export a full snapshot before deployment",
      status: hasBackup ? "ready" : "attention",
    },
    {
      id: "transport",
      title: "HTTPS / server security headers",
      detail: "Must be enforced by the production reverse proxy or backend",
      status: "attention",
    },
  ];
}