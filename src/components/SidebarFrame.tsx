import { useId, useState, type ReactNode } from "react";
import type { Lang } from "../data/framework";

type Props = {
  side: "left" | "right";
  lang: Lang;
  children: ReactNode;
};

/** Presentation-only collapse state. Children stay mounted so selection, search,
 * scroll positions and live connection state survive hiding the panel. */
export default function SidebarFrame({ side, lang, children }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const panelId = useId();
  const source = side === "left";
  const label = lang === "fa"
    ? `${collapsed ? "نمایش" : "پنهان کردن"} سایدبار ${source ? "منابع داده" : "کانتکست کاری"}`
    : `${collapsed ? "Show" : "Hide"} ${source ? "data sources" : "working context"} sidebar`;

  return (
    <div
      className={`sidebar-dock ${source ? "sources-sidebar" : "context-sidebar"}`}
      data-side={side}
      data-collapsed={collapsed}
    >
      <button
        type="button"
        className="sidebar-toggle"
        aria-expanded={!collapsed}
        aria-controls={panelId}
        aria-label={label}
        title={label}
        onClick={() => setCollapsed(value => !value)}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M9 4v16" />
        </svg>
      </button>
      <div id={panelId} className="sidebar-panel" hidden={collapsed} inert={collapsed}>
        {children}
      </div>
    </div>
  );
}
