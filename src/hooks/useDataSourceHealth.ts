import { useEffect, useState } from "react";
import { dataSources } from "../data/framework";
import {
  HEALTH_POLL_MS, HEALTH_TIMEOUT_MS, parseHealthSnapshot, sourceHealth,
  type HealthReason, type HealthSnapshot,
} from "../services/dataSourceHealth";

/** Read-only polling; never tests arbitrary external URLs or writes configuration. */
export function useDataSourceHealth(userId: string | null) {
  const [snapshot, setSnapshot] = useState<HealthSnapshot | null>(null);
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    let alive = true;
    let active: AbortController | null = null;
    let next: ReturnType<typeof setTimeout> | undefined;
    const publishError = (error: HealthReason) => {
      if (alive) setSnapshot({ owner: userId, receivedAt: Date.now(), items: {}, error });
    };
    const cancel = () => {
      clearTimeout(next);
      const previous = active;
      active = null;
      previous?.abort();
    };
    const schedule = () => {
      clearTimeout(next);
      if (alive && userId && !document.hidden) next = setTimeout(refresh, HEALTH_POLL_MS);
    };
    async function refresh() {
      if (!alive || document.hidden || active) return;
      if (!userId) { publishError("signed-out"); return; }
      if (!navigator.onLine) { publishError("offline"); return; }
      clearTimeout(next);
      const controller = new AbortController();
      active = controller;
      let timedOut = false;
      const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, HEALTH_TIMEOUT_MS);
      try {
        const response = await fetch("/api/integrations/status", {
          headers: { accept: "application/json", "x-user-id": userId },
          cache: "no-store",
          signal: controller.signal,
        });
        let value: HealthSnapshot;
        if (!response.ok) {
          value = { owner: userId, receivedAt: Date.now(), items: {}, error:
            response.status === 401 ? "unauthorized" : response.status === 403 ? "forbidden" : "unavailable" };
        } else if (!(response.headers.get("content-type") ?? "").includes("application/json")) {
          value = { owner: userId, receivedAt: Date.now(), items: {}, error: "malformed" };
        } else {
          const body: unknown = await response.json();
          value = parseHealthSnapshot(body, userId, Date.now());
        }
        if (alive && active === controller) { setSnapshot(value); setNow(Date.now()); }
      } catch (error) {
        if (alive && active === controller) publishError(timedOut ? "timeout" : error instanceof SyntaxError ? "malformed" : "network");
      } finally {
        clearTimeout(timeout);
        if (active === controller) { active = null; schedule(); }
      }
    }
    const wake = () => {
      setNow(Date.now());
      cancel();
      void refresh();
    };
    const offline = () => { cancel(); publishError("offline"); };
    publishError(userId ? "loading" : "signed-out");
    void refresh();
    // Expire old confirmations even if the next request hangs or the tab sleeps.
    const clock = setInterval(() => setNow(Date.now()), 1_000);
    window.addEventListener("online", wake);
    window.addEventListener("offline", offline);
    window.addEventListener("focus", wake);
    document.addEventListener("visibilitychange", wake);
    return () => {
      alive = false;
      cancel();
      clearInterval(clock);
      window.removeEventListener("online", wake);
      window.removeEventListener("offline", offline);
      window.removeEventListener("focus", wake);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [userId]);

  // An old user's successful request must never leak into the next session.
  const current: HealthSnapshot = snapshot?.owner === userId ? snapshot : {
    owner: userId, receivedAt: now, items: {}, error: userId ? "loading" : "signed-out",
  };
  return Object.fromEntries(dataSources.map(source => [source.id, sourceHealth(current, source.id, now)]));
}
