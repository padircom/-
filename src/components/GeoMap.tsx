import L from "leaflet";
import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import { type Lang } from "../data/framework";
import { type PlottedSite, haversineKm } from "../services/geo";

/* ══════════════════════════════════════════════════════════════════════
   نقشه‌ی پایه (d18) — Leaflet + کاشی‌های عمومیِ بدون نیاز به کلید

   سه لایهٔ پایه:
     · نقشهٔ راه    — Esri World Street Map (پیش‌فرض)
     · ماهواره      — Esri World Imagery
     · روشن         — CARTO Positron (برای گزارش و چاپ)

   نشانه‌ها با divIcon ساخته می‌شوند تا به فایل‌های تصویریِ بسته وابسته
   نباشند (مشکلِ همیشگیِ آیکونِ پیش‌فرضِ Leaflet در باندلرها).

   اگر کاشی‌ای بارگذاری نشود (شبکه‌ی بسته / فیلتر)، 'tileerror' شمارش
   می‌شود و والد به نمایِ برداری برمی‌گردد — نقشه هیچ‌وقت خالی نمی‌ماند.
   ══════════════════════════════════════════════════════════════════════ */

const TILES = {
  street: {
    // Use Esri's public street basemap by default. The OSM tile endpoint can
    // return policy-block images in shared previews, which Leaflet treats as tiles.
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri, HERE, Garmin, USGS, Intermap, INCREMENT P, NRCAN, Esri Japan, METI, Esri China (Hong Kong), OpenStreetMap contributors, and the GIS User Community",
    label: { fa: "نقشهٔ راه", en: "Street" },
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri",
    label: { fa: "ماهواره", en: "Satellite" },
  },
  light: {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap &copy; CARTO",
    label: { fa: "روشن", en: "Light" },
  },
} as const;

export type TileKey = keyof typeof TILES;

export type TileMode = "direct" | "internal";
export type TileConfig = { mode: TileMode; internalBase?: string };

const TILE_CFG_KEY = "geo.tile.config.v1";

export function loadTileConfig(): TileConfig {
  try {
    const raw = localStorage.getItem(TILE_CFG_KEY);
    if (raw) {
      const c = JSON.parse(raw) as { mode?: string; internalBase?: string };
      if (c.mode === "direct" || c.mode === "internal") return c as TileConfig;
      // Migrate the former proxy option; this app has no tile-proxy endpoint.
      if (c.mode === "proxy") return { mode: "direct" };
    }
  } catch {
    /* نادیده */
  }
  return { mode: "direct" };
}

export function saveTileConfig(c: TileConfig): void {
  try {
    localStorage.setItem(TILE_CFG_KEY, JSON.stringify(c));
  } catch {
    /* نادیده */
  }
}

/** URL کاشی بر اساس سرویس عمومی یا قالب آدرسِ سرور داخلی. */
function tileUrlFor(k: TileKey, cfg: TileConfig): string {
  if (cfg.mode === "internal") {
    const base = (cfg.internalBase || "").trim();
    if (base) return base.replace(/\{s\}/g, "a").replace(/\{r\}/g, "");
  }
  return TILES[k].url;
}

const statusColor: Record<PlottedSite["status"], string> = {
  active: "#34D399",
  tender: "#7FB2FF",
  stopped: "#F87171",
  completed: "#A78BFA",
};

function markerIcon(color: string, size = 14) {
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:50%;background:${color};
      border:2px solid rgba(255,255,255,.85);box-shadow:0 0 0 1px rgba(0,0,0,.35)"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export default function GeoMap({
  lang,
  points,
  onTileFailure,
  config,
}: {
  lang: Lang;
  points: PlottedSite[];
  onTileFailure?: () => void;
  config: TileConfig;
}) {
  const rtl = lang === "fa";
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerLayer = useRef<L.LayerGroup | null>(null);
  const measureLayer = useRef<L.LayerGroup | null>(null);
  const baseRef = useRef<Record<TileKey, L.TileLayer>>({} as Record<TileKey, L.TileLayer>);

  type MapPoint = PlottedSite & { lat: number; lon: number };
  const [measure, setMeasure] = useState<MapPoint[]>([]);
  const [ready, setReady] = useState(false);

  /* ── ساختِ نقشه (یک‌بار) ── */
  useEffect(() => {
    if (!hostRef.current || mapRef.current) return;
    const map = L.map(hostRef.current, {
      center: [32.5, 53.5],
      zoom: 5,
      zoomControl: true,
      attributionControl: true,
      preferCanvas: true,
    });

    let failures = 0;
    let loaded = 0;
    const fallbackTimer = window.setTimeout(() => {
      if (loaded === 0) onTileFailure?.();
    }, 8000);
    const onErr = () => {
      failures += 1;
      if (failures >= 4) onTileFailure?.();
    };
    const onLoad = () => {
      loaded += 1;
      window.clearTimeout(fallbackTimer);
    };
    // Register before adding the first layer so early errors cannot be missed.
    map.on("tileerror", onErr);
    map.on("tileload", onLoad);

    (Object.keys(TILES) as TileKey[]).forEach((k) => {
      const t = TILES[k];
      baseRef.current[k] = L.tileLayer(tileUrlFor(k, config), { attribution: t.attribution, maxZoom: 18 });
    });

    L.control
      .layers(
        {
          [TILES.street.label[rtl ? "fa" : "en"]]: baseRef.current.street,
          [TILES.satellite.label[rtl ? "fa" : "en"]]: baseRef.current.satellite,
          [TILES.light.label[rtl ? "fa" : "en"]]: baseRef.current.light,
        },
        {},
        { position: rtl ? "topleft" : "topright" },
      )
      .addTo(map);

    L.control.scale({ imperial: false, position: "bottomleft" }).addTo(map);

    /* فعال‌سازی لایهٔ راه پس از ثبت listenerها؛ در قطع شبکه به برداری برمی‌گردیم. */
    baseRef.current.street.addTo(map);

    markerLayer.current = L.layerGroup().addTo(map);
    measureLayer.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    setReady(true);

    return () => {
      window.clearTimeout(fallbackTimer);
      map.off("tileerror", onErr);
      map.off("tileload", onLoad);
      map.remove();
      mapRef.current = null;
      markerLayer.current = null;
      measureLayer.current = null;
    };
  }, [onTileFailure, rtl, config]);

  /* ── نشانه‌ها ── */
  useEffect(() => {
    const map = mapRef.current;
    const layer = markerLayer.current;
    if (!map || !layer || !ready) return;
    layer.clearLayers();

    const visible = points
      .filter((p): p is PlottedSite & { coord: NonNullable<PlottedSite["coord"]> } => Boolean(p.coord))
      .map((p) => ({ ...p, lat: p.coord.lat, lon: p.coord.lon }));

    visible.forEach((p) => {
      const marker = L.marker([p.lat, p.lon], { icon: markerIcon(statusColor[p.status], p.status === "active" ? 18 : 14) });
      marker.bindPopup(
        `<div dir="${rtl ? "rtl" : "ltr"}" style="font:12px/1.6 system-ui">
           <strong>${p.name}</strong><br/>
           <span style="opacity:.75">${p.location}</span><br/>
           <span style="opacity:.75">${p.distanceKm === null ? "—" : `${p.distanceKm.toFixed(0)} km ${rtl ? "تا مبدأ" : "from origin"}`}</span>
         </div>`,
      );
      marker.on("click", () => {
        setMeasure((prev) => (prev.length >= 2 ? [p] : [...prev, p]));
      });
      layer.addLayer(marker);
    });

    if (visible.length) {
      const bounds = L.latLngBounds(visible.map((p) => [p.lat, p.lon] as [number, number]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
    }
  }, [points, ready, rtl]);

  /* ── اندازه‌گیریِ فاصله با دو کلیک ── */
  useEffect(() => {
    const layer = measureLayer.current;
    if (!layer) return;
    layer.clearLayers();
    if (measure.length < 2) return;
    const [a, b] = measure;
    L.polyline(
      [
        [a.lat, a.lon],
        [b.lat, b.lon],
      ],
      { color: "#7FB2FF", weight: 2, dashArray: "6 6" },
    ).addTo(layer);
    const km = haversineKm({ lat: a.lat, lon: a.lon }, { lat: b.lat, lon: b.lon });
    const mid: [number, number] = [(a.lat + b.lat) / 2, (a.lon + b.lon) / 2];
    L.marker(mid, {
      icon: L.divIcon({
        className: "",
        html: `<span style="white-space:nowrap;background:#0b1220cc;color:#E6EDF7;border:1px solid #7FB2FF66;
               border-radius:6px;padding:2px 6px;font:11px system-ui">${km.toFixed(1)} km</span>`,
        iconSize: [0, 0],
      }),
    }).addTo(layer);
  }, [measure]);

  return (
    <div className="relative h-full min-h-[320px] w-full overflow-hidden rounded-xl border b-line-soft">
      <div ref={hostRef} className="h-full w-full" />
      <div className="pointer-events-none absolute bottom-2 end-2 z-[500] rounded-lg bg-[#0b1220cc] px-2 py-1 text-[9.5px] tx3">
        {measure.length === 0
          ? rtl
            ? "روی دو نشانه کلیک کنید تا فاصله اندازه‌گیری شود"
            : "Click two markers to measure distance"
          : rtl
            ? `${measure.length}/۲ انتخاب شده — برای شروعِ دوباره روی نشانه‌ای کلیک کنید`
            : `${measure.length}/2 selected — click a marker to restart`}
      </div>
    </div>
  );
}
