import { useState } from "react";
import { dataSources, ui, t, type Lang } from "../data/framework";
import { useAuth } from "../context/AuthContext";
import { useDataSourceHealth } from "../hooks/useDataSourceHealth";
import { healthMessages } from "../services/dataSourceHealth";
import SidebarFrame from "./SidebarFrame";

type Props = {
  lang: Lang;
  activeSource: string | null;
  onPick: (id: string) => void;
};

export default function LeftSidebar({ lang, activeSource, onPick }: Props) {
  const rtl = lang === "fa";
  const { user } = useAuth();
  const health = useDataSourceHealth(user?.id ?? null);
  const connectedCount = dataSources.filter(source => health[source.id].status === "connected").length;
  const summary = rtl
    ? `${connectedCount.toLocaleString("fa-IR")} اتصال تأییدشده از ${dataSources.length.toLocaleString("fa-IR")} منبع`
    : `${connectedCount} of ${dataSources.length} connections verified`;
  const selectedSource = dataSources.find(source => source.id === activeSource);
  const [connectNotice, setConnectNotice] = useState(false);
  return (
    <SidebarFrame side="left" lang={lang}>
      <aside
        dir={rtl ? "rtl" : "ltr"}
        className="glass-dark flex h-full min-h-0 w-full flex-col rounded-2xl"
      >
        <header className="b-line border-b px-4 py-3.5">
          <div className="flex items-center gap-2">
            <span className="chip-bg grid h-7 w-7 place-items-center rounded-lg text-[13px]">🔌</span>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[12.5px] font-normal tx1">{t(ui.sourcesTitle, lang)}</h2>
              <p className="mt-0.5 truncate text-[9.5px] font-extralight tx3" title={summary}>{summary}</p>
            </div>
          </div>
        </header>

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {dataSources.map((s) => {
          const on = activeSource === s.id;
          const state = health[s.id];
          const connected = state.status === "connected";
          const label = connected ? t(ui.connected, lang)
            : state.status === "loading" ? (rtl ? "بررسی…" : "Checking…")
            : state.status === "disconnected" ? t(ui.disconnected, lang)
            : (rtl ? "نامشخص" : "Unknown");
          return (
            <button
              key={s.id}
              onClick={() => onPick(s.id)}
              type="button"
              data-source-id={s.id}
              data-health={state.status}
              title={t(healthMessages[state.reason], lang)}
              aria-describedby={on ? "source-health-detail" : undefined}
              className={`source-row block w-full px-2 py-2.5 text-start ${on ? "row-on" : ""}`}
              aria-pressed={on}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="grid h-6 w-6 shrink-0 place-items-center text-[14px]"
                  style={{ color: s.color }}
                >
                  {s.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[11px] font-light tx1">{s.name}</span>
                    <span
                      className={`ms-auto h-[7px] w-[7px] shrink-0 rounded-full ${connected ? "pulse-dot" : ""}`}
                      aria-hidden="true"
                      style={{ background: connected ? "#34D399" : state.reason === "disconnected" ? "#F87171" : "#94A3B8" }}
                    />
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <span className="truncate text-[9px] font-extralight tx3">{t(s.kind, lang)}</span>
                    <span className="text-[8.5px] font-extralight tx4">·</span>
                    <span
                      className="text-[9px] font-extralight"
                      style={{ color: connected ? "var(--ok)" : "var(--ink3)" }}
                    >
                      {label}
                    </span>
                    <span className="ms-auto shrink-0 text-[8.5px] font-extralight tx4 tabular-nums" dir="ltr">
                      {connected && state.latencyMs !== null ? `${state.latencyMs.toLocaleString("en-US")} ms` : "—"}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {selectedSource && (
        <div id="source-health-detail" role="status" className="b-line border-t px-3 py-2 text-[9px] leading-4 tx3">
          <span className="font-normal tx2" dir="ltr">{selectedSource.name}</span>
          <p>{t(healthMessages[health[selectedSource.id].reason], lang)}</p>
        </div>
      )}

      <div className="b-line border-t p-3">
        <button
          onClick={() => {
            setConnectNotice(true);
            window.setTimeout(() => setConnectNotice(false), 3500);
          }}
          className="connect-btn w-full rounded-xl px-3 py-2 text-[11px] font-light"
        >
          {t(ui.connect, lang)}
        </button>
        {connectNotice && (
          <p className="fade-rise mt-2 text-[9px] font-extralight leading-4 tx3">
            {rtl
              ? "در نمونه نمایشی، درخواست اتصال ثبت شد. پیکربندی واقعی در مدیریت سامانه ← اتصال SQL/API انجام می‌شود."
              : "Demo request registered. Configure the live SQL/API connector in System Administration."}
          </p>
        )}
      </div>
      </aside>
    </SidebarFrame>
  );
}
