import { useState } from "react";
import { dataSources, ui, t, type Lang } from "../data/framework";

type Props = {
  lang: Lang;
  activeSource: string | null;
  onPick: (id: string) => void;
};

export default function LeftSidebar({ lang, activeSource, onPick }: Props) {
  const rtl = lang === "fa";
  const [connectNotice, setConnectNotice] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className={`relative h-full shrink-0 transition-[width] duration-300 ease-out ${collapsed ? "w-0" : "w-[248px]"}`}>
      <aside
        dir={rtl ? "rtl" : "ltr"}
        className={`glass-dark flex h-full w-[248px] flex-col rounded-2xl transition-[transform,opacity] duration-300 ease-out ${collapsed ? "pointer-events-none -translate-x-full opacity-0" : "translate-x-0 opacity-100"}`}
      >
        <header className="b-line border-b px-4 py-3.5">
          <div className="flex items-center gap-2">
            <span className="chip-bg grid h-7 w-7 place-items-center rounded-lg text-[13px]">🔌</span>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[12.5px] font-normal tx1">{t(ui.sourcesTitle, lang)}</h2>
              <p className="mt-0.5 truncate text-[9.5px] font-extralight tx3">{t(ui.sourcesSub, lang)}</p>
            </div>
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              aria-expanded={!collapsed}
              aria-label={rtl ? "پنهان کردن سایدبار منابع داده" : "Hide data sources sidebar"}
              title={rtl ? "پنهان کردن سایدبار منابع داده" : "Hide data sources sidebar"}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border b-line-soft bg-[var(--row)] tx3 transition hover:tx1"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="m15 6-6 6 6 6" />
              </svg>
            </button>
          </div>
        </header>

      <div className="thin-scroll flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {dataSources.map((s) => {
          const on = activeSource === s.id;
          return (
            <button
              key={s.id}
              onClick={() => onPick(s.id)}
              className={`glass-row block w-full rounded-xl px-2.5 py-2 text-start ${on ? "row-on" : ""}`}
              style={on ? { borderColor: s.color } : undefined}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[14px]"
                  style={{ background: `${s.color}1f`, border: `1px solid ${s.color}55` }}
                >
                  {s.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[11px] font-light tx1">{s.name}</span>
                    <span
                      className={`ms-auto h-[7px] w-[7px] shrink-0 rounded-full ${s.connected ? "pulse-dot" : ""}`}
                      style={{ background: s.connected ? "#34D399" : "#94A3B8", opacity: s.connected ? 1 : 0.55 }}
                    />
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <span className="truncate text-[9px] font-extralight tx3">{t(s.kind, lang)}</span>
                    <span className="text-[8.5px] font-extralight tx4">·</span>
                    <span
                      className="text-[9px] font-extralight"
                      style={{ color: s.connected ? "var(--ok)" : "var(--ink4)" }}
                    >
                      {s.connected ? t(ui.connected, lang) : t(ui.disconnected, lang)}
                    </span>
                    <span className="ms-auto text-[8.5px] font-extralight tx4">{s.latency}</span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

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
      {collapsed && (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          aria-expanded={false}
          aria-label={rtl ? "نمایش سایدبار منابع داده" : "Show data sources sidebar"}
          title={rtl ? "نمایش سایدبار منابع داده" : "Show data sources sidebar"}
          className="absolute left-0 top-4 z-30 grid h-10 w-7 translate-x-0 place-items-center rounded-r-xl border border-l-0 border-sky-400/35 bg-[var(--panel2)] text-sky-200 shadow-lg transition hover:w-8 hover:bg-sky-400/10"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <path d="m9 6 6 6-6 6" />
          </svg>
        </button>
      )}
    </div>
  );
}
