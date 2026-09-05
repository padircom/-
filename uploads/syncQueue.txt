import { executeCommand, loadSqlConfig, testConnection } from "./sqlServer";
import { logAudit } from "./auditLogger";

export type SyncStatus = "pending" | "synced" | "failed";

export type SyncQueueItem = {
  id: string;
  action: string;
  table: string;
  sql: string;
  params: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  attempts: number;
  status: SyncStatus;
  error?: string;
};

export type SyncQueueStats = {
  total: number;
  pending: number;
  synced: number;
  failed: number;
};

const SYNC_QUEUE_STORE = "pmis:sql-sync-queue:v1";

export const getSyncQueue = (): SyncQueueItem[] => {
  try {
    return JSON.parse(localStorage.getItem(SYNC_QUEUE_STORE) ?? "[]") as SyncQueueItem[];
  } catch {
    return [];
  }
};

const saveSyncQueue = (items: SyncQueueItem[]) => {
  try {
    localStorage.setItem(SYNC_QUEUE_STORE, JSON.stringify(items.slice(0, 500)));
  } catch {
    /* ignore */
  }
};

export const getSyncQueueStats = (): SyncQueueStats => {
  const queue = getSyncQueue();
  return {
    total: queue.length,
    pending: queue.filter((q) => q.status === "pending").length,
    synced: queue.filter((q) => q.status === "synced").length,
    failed: queue.filter((q) => q.status === "failed").length,
  };
};

export const enqueueSqlSync = (
  action: string,
  table: string,
  sql: string,
  params: Record<string, unknown>
) => {
  const now = new Date().toISOString();
  const item: SyncQueueItem = {
    id: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    action,
    table,
    sql,
    params,
    createdAt: now,
    updatedAt: now,
    attempts: 0,
    status: "pending",
  };
  saveSyncQueue([item, ...getSyncQueue()]);
  logAudit("SYNC_QUEUE_ENQUEUE", "SQL Sync Queue", `${action} queued for ${table}`);
  return item;
};

export const flushSyncQueue = async () => {
  const cfg = loadSqlConfig();
  const ping = await testConnection(cfg);
  if (!ping.ok) return { ok: false, flushed: 0, failed: 0, message: ping.message };

  const queue = getSyncQueue();
  let flushed = 0;
  let failed = 0;
  const next: SyncQueueItem[] = [];

  for (const item of queue) {
    if (item.status === "synced") {
      next.push(item);
      continue;
    }
    try {
      await executeCommand(cfg, item.sql, item.params);
      flushed += 1;
      next.push({ ...item, status: "synced", attempts: item.attempts + 1, updatedAt: new Date().toISOString(), error: undefined });
    } catch (err) {
      failed += 1;
      next.push({
        ...item,
        status: "failed",
        attempts: item.attempts + 1,
        updatedAt: new Date().toISOString(),
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  saveSyncQueue(next);
  logAudit("SYNC_QUEUE_FLUSH", "SQL Sync Queue", `Flushed=${flushed}; Failed=${failed}`, failed ? "warning" : "info");
  return { ok: failed === 0, flushed, failed, message: `Flushed ${flushed}, failed ${failed}` };
};

export const clearSyncedQueueItems = () => {
  saveSyncQueue(getSyncQueue().filter((x) => x.status !== "synced"));
};