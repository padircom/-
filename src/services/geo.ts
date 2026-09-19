/* ══════════════════════════════════════════════════════════════════════
   GEO-v1 — موقعیت‌یابی مکانی پروژه‌ها (GIS) — دامنهٔ d18

   تصمیمِ آگاهانه: به‌جای وابستگی به سرویسِ کاشیِ نقشه (که هم اینترنتِ
   دائم می‌خواهد و هم در شبکه‌های شرکتی معمولاً مسدود است)، این ماژول یک
   نمودارِ پراکندگیِ برداری روی مختصاتِ واقعی می‌سازد:

     · نگاشتِ نامِ موقعیت به مختصات (مرکزِ استان/شهر — تقریبی و اعلام‌شده)
     · فاصلهٔ دایرهٔ بزرگ (Haversine) تا نقطهٔ مرجع
     · خوشه‌بندیِ ساده بر پایهٔ آستانهٔ فاصله
     · قابِ جغرافیایی (Bounding Box) برای مقیاس خودکارِ نمودار

   وقتی پایگاه داده وصل شود، مختصات از جدول `Project_Site` می‌آید و این
   همان توابع بی‌تغییر می‌مانند.
   ══════════════════════════════════════════════════════════════════════ */

export type Coord = { lat: number; lon: number };

export type Site = {
  id: string;
  name: string;
  location: string;
  cluster: string;
  progress: number;
  status: "active" | "tender" | "stopped" | "completed";
  budget?: string;
};

export type PlottedSite = Site & {
  coord: Coord | null;
  /** فاصله تا نقطهٔ مرجع بر حسب کیلومتر؛ بدون مختصات = null. */
  distanceKm: number | null;
};

/** مرکزِ تقریبیِ استان‌ها/شهرهایِ موجود در دادهٔ پروژه‌ها (اعلام‌شده به‌عنوان تقریب). */
export const LOCATION_COORDS: Record<string, Coord> = {
  "خوزستان": { lat: 31.32, lon: 48.67 },
  "اهواز": { lat: 31.32, lon: 48.67 },
  "بوشهر": { lat: 28.92, lon: 50.84 },
  "عسلویه": { lat: 27.48, lon: 52.61 },
  "بندر دیر": { lat: 27.83, lon: 51.94 },
  "هرمزگان": { lat: 27.18, lon: 56.28 },
  "خلیج فارس": { lat: 27.5, lon: 52.0 },
  "فارس": { lat: 29.59, lon: 52.58 },
  "کرمان": { lat: 30.28, lon: 57.08 },
  "اصفهان": { lat: 32.65, lon: 51.67 },
  "ایلام": { lat: 33.63, lon: 46.42 },
  "کرمانشاه": { lat: 34.31, lon: 47.07 },
  "گیلان": { lat: 37.28, lon: 49.58 },
  "سیستان و بلوچستان": { lat: 29.49, lon: 60.86 },
  "لرستان": { lat: 33.49, lon: 48.36 },
  "مازندران": { lat: 36.56, lon: 53.06 },
  "تهران": { lat: 35.69, lon: 51.39 },
  "خراسان رضوی": { lat: 36.3, lon: 59.61 },
};

const R_EARTH_KM = 6371;
const toRad = (d: number) => (d * Math.PI) / 180;

/** فاصلهٔ دایرهٔ بزرگ (Haversine) بر حسب کیلومتر. */
export function haversineKm(a: Coord, b: Coord): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function resolveCoord(location: string): Coord | null {
  if (!location) return null;
  const key = location.trim();
  if (LOCATION_COORDS[key]) return LOCATION_COORDS[key];
  const hit = Object.keys(LOCATION_COORDS).find((k) => key.includes(k) || k.includes(key));
  return hit ? LOCATION_COORDS[hit] : null;
}

export function plotSites(sites: Site[], origin: Coord): PlottedSite[] {
  return sites.map((s) => {
    const coord = resolveCoord(s.location);
    return {
      ...s,
      coord,
      distanceKm: coord ? haversineKm(origin, coord) : null,
    };
  });
}

export type BoundingBox = { minLat: number; maxLat: number; minLon: number; maxLon: number };

export function boundingBox(points: PlottedSite[]): BoundingBox | null {
  const withCoord = points.filter((p) => p.coord) as (PlottedSite & { coord: Coord })[];
  if (!withCoord.length) return null;
  const lats = withCoord.map((p) => p.coord.lat);
  const lons = withCoord.map((p) => p.coord.lon);
  return {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLon: Math.min(...lons),
    maxLon: Math.max(...lons),
  };
}

export type GeoCluster = { center: PlottedSite; members: PlottedSite[] };

/** خوشه‌بندیِ ساده: اعضایِ نزدیک‌تر از آستانه به یک مرکز می‌چسبند. */
export function clusterByProximity(points: PlottedSite[], thresholdKm: number): GeoCluster[] {
  const withCoord = points.filter((p) => p.coord) as (PlottedSite & { coord: Coord })[];
  const clusters: GeoCluster[] = [];
  for (const p of withCoord) {
    const found = clusters.find((c) => haversineKm(c.center.coord!, p.coord) <= thresholdKm);
    if (found) found.members.push(p);
    else clusters.push({ center: p, members: [p] });
  }
  return clusters;
}

export type GeoSummary = {
  total: number;
  located: number;
  missingCoord: number;
  averageDistanceKm: number | null;
  farthest: PlottedSite | null;
  clusterCount: number;
};

export function geoSummary(points: PlottedSite[], thresholdKm = 150): GeoSummary {
  const withCoord = points.filter((p) => p.coord);
  const dists = withCoord.map((p) => p.distanceKm ?? 0);
  const farthest = withCoord.reduce<PlottedSite | null>(
    (m, p) => (!m || (p.distanceKm ?? 0) > (m.distanceKm ?? 0) ? p : m),
    null,
  );
  return {
    total: points.length,
    located: withCoord.length,
    missingCoord: points.length - withCoord.length,
    averageDistanceKm: dists.length ? dists.reduce((a, b) => a + b, 0) / dists.length : null,
    farthest,
    clusterCount: clusterByProximity(points, thresholdKm).length,
  };
}

/* ══════════════════════════════════════════════════════════════════════
   نقطهٔ مرجعِ پیش‌فرض: تهران (دفتر مرکزی). در تنظیمات قابل تغییر است.
   ══════════════════════════════════════════════════════════════════════ */
export const DEFAULT_ORIGIN: Coord = { lat: 35.69, lon: 51.39 };
