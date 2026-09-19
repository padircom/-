import { useMemo, useState } from "react";
import { clusters, projectsByCluster, type Lang, t } from "../data/framework";
import { useSystem } from "../context/SystemContext";
import {
  DEFAULT_ORIGIN,
  type PlottedSite,
  type Site,
  boundingBox,
  clusterByProximity,
  geoSummary,
  plotSites,
} from "../services/geo";

/* ══════════════════════════════════════════════════════════════════════
   «مدیریت موقعیت مکانی پروژه‌ها (GIS)» — دامنهٔ d18

   نمودارِ پراکندگی روی مختصاتِ واقعی؛ بدون کاشیِ نقشه و بدون اینترنت.
   ══════════════════════════════════════════════════════════════════════ */

const W = 760;
const H = 420;
const PAD = 36;

const statusColor: Record<Site["status"], string> = {
  active: "#34D399",
  tender: "#7FB2FF",
  stopped: "#F87171",
  completed: "#A78BFA",
};

export default function GeoProjectsPanel({ lang }: { lang: Lang }) {
  const rtl = lang === "fa";
  const { projectScope } = useSystem();
  const [threshold, setThreshold] = useState(150);
  const [filter, setFilter] = useState<"all" | Site["status"]>("all");

  const sites: Site[] = useMemo(() => {
    const out: Site[] = [];
    for (const c of clusters) {
      for (const p of projectsByCluster[c.id] ?? []) {
        out.push({
          id: p.id,
          name: t(p.name, lang),
          location: t(p.location, lang),
          cluster: t(c.title, lang),
          progress: p.progress,
          status: p.status,
          budget: p.budget,
        });
      }
    }
    return out;
  }, [lang]);

  const plotted = useMemo(() => plotSites(sites, DEFAULT_ORIGIN), [sites]);
  const sum = useMemo(() => geoSummary(plotted, threshold), [plotted, threshold]);
  const groups = useMemo(() => clusterByProximity(plotted, threshold), [plotted, threshold]);
  const box = useMemo(() => boundingBox(plotted), [plotted]);

  const rows = plotted.filter((p) => filter === "all" || p.status === filter);
  const withCoord = rows.filter((p) => p.coord) as (PlottedSite & { coord: NonNullable<PlottedSite["coord"]> })[];

  const x = (lon: number) => {
    if (!box) return PAD;
    const span = Math.max(0.5, box.maxLon - box.minLon);
    return PAD + ((lon - box.minLon) / span) * (W - PAD * 2);
  };
  const y = (lat: number) => {
    if (!box) return PAD;
    const span = Math.max(0.5, box.maxLat - box.minLat);
    return H - PAD - ((lat - box.minLat) / span) * (H - PAD * 2);
  };

  const num = (n: number) => Math.round(n).toLocaleString(rtl ? "fa-IR" : "en-US");

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden" dir={rtl ? "rtl" : "ltr"}>
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        <Cell label={rtl ? "پروژه‌ها" : "Projects"} value={num(sum.total)} hint={rtl ? `${num(sum.located)} دارای مختصات` : `${num(sum.located)} geolocated`} />
        <Cell
          label={rtl ? "بدون مختصات" : "Missing coordinates"}
          value={num(sum.missingCoord)}
          tone={sum.missingCoord > 0 ? "#FBBF24" : "#34D399"}
          hint={rtl ? "نیازمند تکمیلِ جدول Project_Site" : "needs Project_Site completion"}
        />
        <Cell
          label={rtl ? "میانگین فاصله از مرجع" : "Avg. distance from origin"}
          value={sum.averageDistanceKm === null ? "—" : `${num(sum.averageDistanceKm)} ${rtl ? "کیلومتر" : "km"}`}
          hint={rtl ? "مرجع: تهران" : "origin: Tehran"}
        />
        <Cell label={rtl ? "تعداد خوشه‌ها" : "Clusters"} value={num(sum.clusterCount)} hint={rtl ? `آستانه ${num(threshold)} کیلومتر` : `${num(threshold)} km threshold`} />
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {(["all", "active", "tender", "stopped", "completed"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setFilter(k)}
            className={`rounded-lg px-2.5 py-1 text-[10px] font-light transition ${filter === k ? "toggle-on tx1" : "tx3 hover:tx2"}`}
          >
            {k === "all" ? (rtl ? "همه" : "All") : k === "active" ? (rtl ? "فعال" : "Active") : k === "tender" ? (rtl ? "مناقصه" : "Tender") : k === "stopped" ? (rtl ? "متوقف" : "Stopped") : (rtl ? "تکمیل" : "Completed")}
          </button>
        ))}
        <label className="ms-auto flex items-center gap-2 text-[9.5px] tx3">
          <span>{rtl ? "آستانهٔ خوشه‌بندی" : "Cluster radius"}</span>
          <input
            type="range"
            min={50}
            max={400}
            step={25}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="w-32"
          />
          <span dir="ltr" className="tabular-nums">{num(threshold)} km</span>
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border b-line-soft bg-[var(--row)] p-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="GIS">
          {/* شبکه */}
          {[0, 1, 2, 3, 4].map((i) => (
            <line key={`h${i}`} x1={PAD} x2={W - PAD} y1={PAD + (i * (H - PAD * 2)) / 4} y2={PAD + (i * (H - PAD * 2)) / 4} stroke="var(--line-soft)" strokeWidth="0.6" />
          ))}
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <line key={`v${i}`} y1={PAD} y2={H - PAD} x1={PAD + (i * (W - PAD * 2)) / 5} x2={PAD + (i * (W - PAD * 2)) / 5} stroke="var(--line-soft)" strokeWidth="0.6" />
          ))}
          {/* مرجع */}
          <g>
            <circle cx={x(DEFAULT_ORIGIN.lon)} cy={y(DEFAULT_ORIGIN.lat)} r="5" fill="none" stroke="#FBBF24" strokeWidth="1.4" strokeDasharray="3 2" />
            <text x={x(DEFAULT_ORIGIN.lon) + 8} y={y(DEFAULT_ORIGIN.lat) - 6} fontSize="8" fill="#FBBF24">
              {rtl ? "مرجع" : "origin"}
            </text>
          </g>
          {/* حلقهٔ خوشه‌ها */}
          {groups.map((g, i) => {
            const members = g.members.filter((m) => m.coord) as (PlottedSite & { coord: NonNullable<PlottedSite["coord"]> })[];
            if (!members.length) return null;
            const cx = members.reduce((s, m) => s + x(m.coord.lon), 0) / members.length;
            const cy = members.reduce((s, m) => s + y(m.coord.lat), 0) / members.length;
            const r = 10 + Math.min(26, members.length * 5);
            return <circle key={`c${i}`} cx={cx} cy={cy} r={r} fill="rgba(127,178,255,0.06)" stroke="rgba(127,178,255,0.25)" strokeWidth="0.8" />;
          })}
          {/* پروژه‌ها */}
          {withCoord.map((p) => (
            <g key={p.id}>
              <circle
                cx={x(p.coord.lon)}
                cy={y(p.coord.lat)}
                r={projectScope?.projectId === p.id ? 6 : 4.5}
                fill={statusColor[p.status]}
                fillOpacity={0.75}
                stroke={projectScope?.projectId === p.id ? "#fff" : "none"}
                strokeWidth={1.2}
              />
              <title>{`${p.name} · ${p.location}${p.distanceKm !== null ? ` · ${Math.round(p.distanceKm)} km` : ""}`}</title>
            </g>
          ))}
        </svg>
        <div className="mt-1 flex flex-wrap items-center gap-3 px-2 text-[9px] tx3">
          {(Object.keys(statusColor) as Site["status"][]).map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <i className="h-2 w-2 rounded-full" style={{ background: statusColor[s] }} />
              {s === "active" ? (rtl ? "فعال" : "Active") : s === "tender" ? (rtl ? "مناقصه" : "Tender") : s === "stopped" ? (rtl ? "متوقف" : "Stopped") : (rtl ? "تکمیل" : "Completed")}
            </span>
          ))}
        </div>
      </div>

      <div className="thin-scroll max-h-[30%] overflow-auto rounded-xl border b-line-soft">
        <table className="w-full border-collapse text-[10px]">
          <thead className="sticky top-0 bg-[var(--panel2)]">
            <tr className="tx4">
              <th className="px-2 py-1.5 text-start font-light">{rtl ? "پروژه" : "Project"}</th>
              <th className="px-2 py-1.5 text-start font-light">{rtl ? "صنعت" : "Cluster"}</th>
              <th className="px-2 py-1.5 text-start font-light">{rtl ? "موقعیت" : "Location"}</th>
              <th className="px-2 py-1.5 text-end font-light" dir="ltr">Lat/Lon</th>
              <th className="px-2 py-1.5 text-end font-light">{rtl ? "فاصله" : "Distance"}</th>
              <th className="px-2 py-1.5 text-end font-light">{rtl ? "پیشرفت" : "Progress"}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-t border-[var(--line-soft)]">
                <td className="px-2 py-1.5 tx1">{p.name}</td>
                <td className="px-2 py-1.5 tx3">{p.cluster}</td>
                <td className="px-2 py-1.5 tx2">{p.location}</td>
                <td className="px-2 py-1.5 text-end tx3" dir="ltr">
                  {p.coord ? `${p.coord.lat.toFixed(2)}, ${p.coord.lon.toFixed(2)}` : "—"}
                </td>
                <td className="px-2 py-1.5 text-end tx2" dir="ltr">
                  {p.distanceKm === null ? "—" : `${num(p.distanceKm)} km`}
                </td>
                <td className="px-2 py-1.5 text-end tx2" dir="ltr">{p.progress}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[9px] font-extralight tx4">
        {rtl
          ? "مختصات مرکز استان/شهر و تقریبی است؛ فاصله با فرمولِ Haversine تا مرجع (تهران) محاسبه می‌شود. نگاشت روی نمودارِ برداری است و کاشیِ نقشه نمی‌خواهد."
          : "Coordinates are province/city centroids (approximate); distance uses the Haversine formula to the origin (Tehran). The plot is vector-based and needs no map tiles."}
      </p>
    </div>
  );
}

function Cell({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="rounded-xl border b-line-soft bg-[var(--row)] p-3">
      <div className="text-[8.5px] font-extralight tx4">{label}</div>
      <div className="mt-1 text-[12.5px] font-light tx1" style={{ color: tone }}>{value}</div>
      {hint && <div className="mt-0.5 text-[9px] font-extralight tx3">{hint}</div>}
    </div>
  );
}
