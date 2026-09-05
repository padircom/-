import {
  statusMeta,
  stateLegend,
  t,
  type Bi,
  type Lang,
  type ProjectStatus,
} from "../data/framework";
import { useSystem } from "../context/SystemContext";

/* ─────────── Utility: parse "$4.2B" / "$980M" / "$95k" ─────────── */
const parseBudget = (raw: string): number => {
  const s = raw.replace(/[^0-9.KMBkmb]/g, "");
  const num = parseFloat(s);
  if (!isFinite(num)) return 0;
  if (/b/i.test(s)) return num * 1000;
  if (/m/i.test(s)) return num;
  if (/k/i.test(s)) return num / 1000;
  return num / 1000;
};
const fmtM = (m: number) => (m >= 1000 ? `$${(m / 1000).toFixed(1)}B` : `$${Math.round(m)}M`);

/* ══════════════ KPI Rings — 4 small dial gauges ══════════════ */
export function KpiRingBar({ lang }: { lang: Lang }) {
  const rtl = lang === "fa";
  const rings = [
    { label: { fa: "سلامت پورتفولیو", en: "Portfolio Health" }, value: 78, color: "#34D399", suffix: "%" },
    { label: { fa: "SPI", en: "SPI" }, value: 97, color: "#FFD48A", suffix: "", display: "0.97" },
    { label: { fa: "CPI", en: "CPI" }, value: 103, cap: 100, color: "#7FB2FF", suffix: "", display: "1.03" },
    { label: { fa: "ریسک بحرانی", en: "Critical Risks" }, value: 22, color: "#FF9F9F", suffix: "", display: "11", inverted: true },
  ];
  return (
    <div className="glass-dark flex shrink-0 items-stretch gap-2 rounded-2xl px-3 py-2">
      {rings.map((k) => {
        const capped = Math.min(100, k.value);
        return (
          <div key={k.label.en} className="flex flex-1 items-center gap-2">
            <Dial value={capped} color={k.color} display={k.display ?? `${capped}${k.suffix}`} />
            <div className="min-w-0">
              <div className="truncate text-[9px] font-extralight tx3">{t(k.label as Bi, lang)}</div>
              <div className="text-[10px] font-light tx2">{rtl ? "شاخص کلیدی" : "Key Indicator"}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Dial({ value, color, display }: { value: number; color: string; display: string }) {
  const r = 16;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 40 40" className="h-10 w-10 shrink-0 -rotate-90">
      <circle className="s-track" cx="20" cy="20" r={r} fill="none" strokeWidth="2.5" />
      <circle
        cx="20" cy="20" r={r} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round"
        strokeDasharray={`${(value / 100) * c} ${c}`}
        style={{ transition: "stroke-dasharray 600ms ease" }}
      />
      <text
        className="f-ink rotate-90" style={{ transformOrigin: "20px 20px" }}
        x="20" y="20" textAnchor="middle" dominantBaseline="central" fontSize="8" fontWeight="500"
      >
        {display}
      </text>
    </svg>
  );
}

/* ══════════════ Donut — status distribution across all projects ══════════════ */
export function StatusDonut({ lang }: { lang: Lang }) {
  const rtl = lang === "fa";
  const { projectsByCluster } = useSystem();
  const totals: Record<ProjectStatus, number> = { active: 0, tender: 0, stopped: 0, completed: 0 };
  Object.values(projectsByCluster).forEach((list) => list.forEach((p) => { totals[p.status] += 1; }));
  const total = totals.active + totals.tender + totals.stopped + totals.completed;

  const r = 26;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const segments = (Object.keys(totals) as ProjectStatus[]).map((key) => {
    const val = totals[key];
    const len = (val / Math.max(1, total)) * c;
    const seg = { key, val, len, offset, color: statusMeta[key].color };
    offset += len;
    return seg;
  });

  return (
    <div className="glass-dark flex shrink-0 items-center gap-3 rounded-2xl px-3 py-2">
      <svg viewBox="0 0 70 70" className="h-16 w-16 shrink-0 -rotate-90">
        <circle cx="35" cy="35" r={r} fill="none" stroke="var(--ring-track)" strokeWidth="8" />
        {segments.map((s) => (
          <circle
            key={s.key}
            cx="35" cy="35" r={r} fill="none"
            stroke={s.color} strokeWidth="8"
            strokeDasharray={`${s.len} ${c - s.len}`}
            strokeDashoffset={-s.offset}
            style={{ transition: "stroke-dasharray 600ms ease" }}
          />
        ))}
        <text className="f-ink rotate-90" style={{ transformOrigin: "35px 35px" }}
              x="35" y="35" textAnchor="middle" dominantBaseline="central" fontSize="11" fontWeight="500">
          {total}
        </text>
      </svg>
      <div className="min-w-0">
        <div className="text-[10px] font-normal tx1">{rtl ? "توزیع وضعیت پروژه‌ها" : "Status distribution"}</div>
        <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
          {stateLegend.map((s) => (
            <div key={s.key} className="flex items-center gap-1 text-[8.5px] font-extralight tx3">
              <i className="h-[6px] w-[6px] rounded-full" style={{ background: s.dot }} />
              <span className="truncate">{t(s.label, lang)}</span>
              <span className="tabular-nums tx2">{totals[s.key]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ══════════════ Budget bar chart — sum per cluster ══════════════ */
export function BudgetBarChart({ lang, onPick, selected }: { lang: Lang; onPick: (id: string) => void; selected: string | null }) {
  const rtl = lang === "fa";
  const { clusters, projectsByCluster } = useSystem();
  const data = clusters.map((c) => ({
    id: c.id,
    label: t(c.title, lang),
    icon: c.icon,
    color: c.color,
    total: (projectsByCluster[c.id] ?? []).reduce((s, p) => s + parseBudget(p.budget), 0),
  }));
  const max = Math.max(1, ...data.map((d) => d.total));

  return (
    <div className="glass-dark flex min-h-0 flex-1 flex-col rounded-2xl px-3 py-2">
      <div className="mb-1 flex items-center justify-between">
        <div className="text-[10px] font-normal tx1">{rtl ? "بودجه بر حسب خوشه صنعتی" : "Budget by industrial cluster"}</div>
        <div className="text-[8.5px] font-extralight tx4">{rtl ? "مجموع بودجه هر خوشه" : "Sum of budgets"}</div>
      </div>
      <div className="flex-1 space-y-1">
        {data.map((d) => {
          const w = (d.total / max) * 100;
          const on = selected === d.id;
          return (
            <button key={d.id} onClick={() => onPick(d.id)} className="flex w-full items-center gap-2">
              <span className="w-4 text-[11px] leading-none">{d.icon}</span>
              <span className="w-[86px] shrink-0 truncate text-[9px] font-light tx2 text-start">{d.label}</span>
              <div className="relative h-3.5 flex-1 overflow-hidden rounded-md bg-[var(--ring-track)]">
                <div
                  className="h-full rounded-md transition-all"
                  style={{ width: `${w}%`, background: on ? d.color : `${d.color}bb`, boxShadow: on ? `0 0 8px -1px ${d.color}` : "none" }}
                />
              </div>
              <span className="w-14 text-end text-[9px] font-light tabular-nums tx2" dir="ltr">{fmtM(d.total)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════ Heatmap: cluster × status ══════════════ */
export function ClusterStatusHeatmap({ lang }: { lang: Lang }) {
  const rtl = lang === "fa";
  const { clusters, projectsByCluster } = useSystem();
  const rows = clusters.map((c) => {
    const list = projectsByCluster[c.id] ?? [];
    const counts: Record<ProjectStatus, number> = { active: 0, tender: 0, stopped: 0, completed: 0 };
    list.forEach((p) => { counts[p.status] += 1; });
    return { id: c.id, label: t(c.title, lang), icon: c.icon, counts };
  });
  const flat = rows.flatMap((r) => Object.values(r.counts));
  const max = Math.max(1, ...flat);

  return (
    <div className="glass-dark shrink-0 rounded-2xl px-3 py-2">
      <div className="mb-1 flex items-center justify-between">
        <div className="text-[10px] font-normal tx1">{rtl ? "ماتریس خوشه × وضعیت" : "Cluster × Status heatmap"}</div>
        <div className="text-[8.5px] font-extralight tx4">{rtl ? "تراکم پروژه‌ها" : "Project density"}</div>
      </div>
      <div className="grid grid-cols-[110px_repeat(4,minmax(0,1fr))] gap-1 text-[9px]">
        <div />
        {stateLegend.map((s) => (
          <div key={s.key} className="flex items-center justify-center gap-1 tx3">
            <i className="h-[5px] w-[5px] rounded-full" style={{ background: s.dot }} />
            <span className="truncate text-[8px]">{t(s.label, lang)}</span>
          </div>
        ))}
        {rows.map((row) => (
          <div key={row.id} className="contents">
            <div className="flex items-center gap-1 tx2 text-[8.5px]">
              <span>{row.icon}</span>
              <span className="truncate">{row.label}</span>
            </div>
            {stateLegend.map((s) => {
              const val = row.counts[s.key];
              const intensity = val / max;
              return (
                <div key={s.key}
                     className="flex h-6 items-center justify-center rounded-md border tabular-nums"
                     style={{
                       background: `${s.dot}${Math.max(15, Math.round(intensity * 90)).toString(16).padStart(2, "0")}`,
                       borderColor: `${s.dot}55`,
                       color: intensity > 0.5 ? "#fff" : s.dot,
                       fontWeight: val ? 500 : 300,
                     }}>
                  {val || "·"}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
