import { useCallback, useMemo, useRef, useState } from "react";
import GeoMap, { type TileConfig, loadTileConfig, saveTileConfig } from "./GeoMap";
import { clusters, projectsByCluster, type Lang, t } from "../data/framework";
import { useSystem } from "../context/SystemContext";
import {
  DEFAULT_ORIGIN,
  type PlottedSite,
  type Site,
  boundingBox,
  clusterByProximity,
  exportCoordCsv,
  geoSummary,
  loadOverrides,
  parseCoordCsv,
  plotSites,
  saveOverrides,
  setOverride,
} from "../services/geo";

/* ══════════════════════════════════════════════════════════════════════
   «مدیریت موقعیت مکانی پروژه‌ها (GIS)» — دامنهٔ d18

   دو نمایِ مکمّل:
     · نقشه — Leaflet با کاشیِ OSM/ماهواره (نیاز به دسترسیِ مرورگر به اینترنت)
     · برداری — نمودارِ پراکندگیِ آفلاین برای شبکه‌های بسته
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
  const [view, setView] = useState<"map" | "vector">("map");
  const [tilesDown, setTilesDown] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, { lat: number; lon: number }>>(() => loadOverrides());
  const [editing, setEditing] = useState(false);
  const [tileCfg, setTileCfg] = useState<TileConfig>(() => loadTileConfig());
  const csvRef = useRef<HTMLInputElement | null>(null);

  const handleTileFailure = useCallback(() => {
    setTilesDown(true);
    setView("vector");
  }, []);

  const sites: Site[] = useMemo(() => {
    const out: Site[] = [];
    for (const c of clusters) {
      for (const p of projectsByCluster[c.id] ?? []) {
        out.push({
          id: p.id,
          code: p.code,
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

  const plotted = useMemo(() => plotSites(sites, DEFAULT_ORIGIN, overrides), [sites, overrides]);
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
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-lg border b-line-soft">
          {(["map", "vector"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`px-2.5 py-1 text-[10px] font-light transition ${view === v ? "bg-sky-500/20 tx1" : "tx3 hover:tx2"}`}
            >
              {v === "map" ? (rtl ? "نقشه" : "Map") : (rtl ? "برداری" : "Vector")}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className={`rounded-lg border b-line-soft px-2.5 py-1 text-[10px] font-light transition ${editing ? "bg-sky-500/20 tx1" : "tx3 hover:tx2"}`}
        >
          {rtl ? "مختصاتِ واقعی پروژه‌ها" : "Real coordinates"}
        </button>
        <input
          ref={csvRef}
          type="file"
          accept=".csv,.txt"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void f.text().then((txt) => {
              const codeToId: Record<string, string> = {};
              for (const c of clusters) for (const p of projectsByCluster[c.id] ?? []) codeToId[p.code] = p.id;
              const parsed = parseCoordCsv(txt, codeToId);
              setOverrides((prev) => {
                const next = { ...prev, ...parsed };
                saveOverrides(next);
                return next;
              });
            });
            e.target.value = "";
          }}
        />
        <div className="flex flex-wrap items-center gap-1.5">
          <select
            value={tileCfg.mode}
            onChange={(e) => {
              const next = { ...tileCfg, mode: e.target.value as TileConfig["mode"] };
              setTileCfg(next);
              saveTileConfig(next);
            }}
            className="rounded-lg border b-line-soft bg-transparent px-1.5 py-1 text-[10px] font-light tx2"
          >
            <option value="direct">{rtl ? "کاشی: مستقیم" : "Tiles: direct"}</option>
            <option value="proxy">{rtl ? "کاشی: از سرور" : "Tiles: via server"}</option>
            <option value="internal">{rtl ? "کاشی: سرور داخلی" : "Tiles: internal server"}</option>
          </select>
          {tileCfg.mode === "internal" && (
            <input
              dir="ltr"
              defaultValue={tileCfg.internalBase ?? ""}
              placeholder="https://tiles.company.local/{z}/{x}/{y}.png"
              onBlur={(e) => {
                const next = { ...tileCfg, internalBase: e.target.value.trim() };
                setTileCfg(next);
                saveTileConfig(next);
              }}
              className="w-[260px] rounded-lg border b-line-soft bg-transparent px-1.5 py-1 text-[10px] tx1"
            />
          )}
        </div>
        {tilesDown && (
          <span className="text-[9.5px] text-amber-300">
            {rtl
              ? "کاشی‌های نقشه در دسترس نبود — نمایِ برداریِ آفلاین نمایش داده می‌شود."
              : "Map tiles were unreachable — showing the offline vector view."}
          </span>
        )}
      </div>


      {editing && (
        <div className="shrink-0 rounded-xl border b-line-soft bg-[var(--row)] p-2.5">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px]">
            <span className="tx1">{rtl ? "مختصاتِ دقیقِ سایت (برتری بر مرکز استان/شهر)" : "Exact site coordinates (override centroids)"}</span>
            <button
              type="button"
              onClick={() => csvRef.current?.click()}
              className="rounded-lg border b-line-soft px-2 py-0.5 text-[9.5px] font-light tx3 transition hover:tx2"
            >
              {rtl ? "درون‌ریزی CSV (code,lat,lon)" : "Import CSV (code,lat,lon)"}
            </button>
            <button
              type="button"
              onClick={() => {
                const blob = new Blob([exportCoordCsv(overrides)], { type: "text/csv;charset=utf-8" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = "project-sites.csv";
                a.click();
                URL.revokeObjectURL(a.href);
              }}
              className="rounded-lg border b-line-soft px-2 py-0.5 text-[9.5px] font-light tx3 transition hover:tx2"
            >
              {rtl ? "برون‌ریزی CSV" : "Export CSV"}
            </button>
          </div>
          <div className="thin-scroll max-h-[220px] overflow-auto">
            <table className="w-full border-collapse text-[10px]">
              <thead className="sticky top-0 bg-[var(--panel2)]">
                <tr className="tx4">
                  <th className="px-2 py-1 text-start font-light">{rtl ? "پروژه" : "Project"}</th>
                  <th className="px-2 py-1 text-start font-light">{rtl ? "عرض (lat)" : "Latitude"}</th>
                  <th className="px-2 py-1 text-start font-light">{rtl ? "طول (lon)" : "Longitude"}</th>
                  <th className="px-2 py-1 text-start font-light">{rtl ? "منبع" : "Source"}</th>
                </tr>
              </thead>
              <tbody>
                {plotted.map((p) => {
                  const ov = overrides[p.id];
                  return (
                    <tr key={p.id} className="border-t border-[var(--line-soft)]">
                      <td className="px-2 py-1 tx2">
                        <span className="tx4 me-1" dir="ltr">{p.code}</span>
                        <span className="truncate">{p.name}</span>
                      </td>
                      <td className="px-2 py-1">
                        <input
                          dir="ltr"
                          defaultValue={ov ? String(ov.lat) : p.coord ? p.coord.lat.toFixed(4) : ""}
                          placeholder="—"
                          onBlur={(e) => {
                            const lat = Number(e.target.value);
                            const lon = Number(overrides[p.id]?.lon ?? p.coord?.lon);
                            if (Number.isFinite(lat) && Number.isFinite(lon) && e.target.value.trim()) {
                              setOverrides((prev) => setOverride(prev, p.id, { lat, lon }));
                            }
                          }}
                          className="w-[90px] rounded border border-[var(--line-soft)] bg-transparent px-1 py-0.5 text-[10px] tx1"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          dir="ltr"
                          defaultValue={ov ? String(ov.lon) : p.coord ? p.coord.lon.toFixed(4) : ""}
                          placeholder="—"
                          onBlur={(e) => {
                            const lon = Number(e.target.value);
                            const lat = Number(overrides[p.id]?.lat ?? p.coord?.lat);
                            if (Number.isFinite(lat) && Number.isFinite(lon) && e.target.value.trim()) {
                              setOverrides((prev) => setOverride(prev, p.id, { lat, lon }));
                            }
                          }}
                          className="w-[90px] rounded border border-[var(--line-soft)] bg-transparent px-1 py-0.5 text-[10px] tx1"
                        />
                      </td>
                      <td className="px-2 py-1 tx4">
                        {ov
                          ? rtl ? "ثبت‌شده (دقیق)" : "Manual (exact)"
                          : p.coord
                            ? rtl ? `گَزِتیر (${p.accuracy === "city" ? "شهر" : p.accuracy === "province" ? "استان" : "منطقه"})` : `gazetteer (${p.accuracy})`
                            : rtl ? "ندارد" : "missing"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {view === "map" && (
        <div className="min-h-[320px] flex-1">
          <GeoMap lang={lang} points={withCoord} onTileFailure={handleTileFailure} config={tileCfg} />
        </div>
      )}

      {view === "vector" && (
        <>
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
          ? "مختصات مرکز استان/شهر و تقریبی است؛ فاصله با فرمولِ Haversine تا مرجع (تهران) محاسبه می‌شود. نمایِ نقشه از کاشی‌های عمومیِ OSM/Esri استفاده می‌کند و در شبکه‌ی بسته به‌طور خودکار به نمایِ برداری برمی‌گردد."
          : "Coordinates are province/city centroids (approximate); distance uses the Haversine formula to the origin (Tehran). The map view uses public OSM/Esri tiles and falls back to the vector view on a closed network."}
      </p>
        </>
      )}
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
