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
  code?: string;
  name: string;
  location: string;
  cluster: string;
  progress: number;
  status: "active" | "tender" | "stopped" | "completed";
  budget?: string;
};

export type CoordAccuracy = "exact" | "city" | "province" | "region";
export type CoordSource = "override" | "gazetteer" | "none";

export type PlottedSite = Site & {
  coord: Coord | null;
  /** فاصله تا نقطهٔ مرجع بر حسب کیلومتر؛ بدون مختصات = null. */
  distanceKm: number | null;
  /** دقتِ مختصات: دقیق (سایت) / شهر / استان / منطقه. */
  accuracy: CoordAccuracy;
  /** منبعِ مختصات: ثبتِ دستی (برتری دارد) یا گَزِتیر. */
  coordSource: CoordSource;
};

/** مرکزِ تقریبیِ استان‌ها/شهرهایِ موجود در دادهٔ پروژه‌ها (اعلام‌شده به‌عنوان تقریب). */
export type GazetteerEntry = { coord: Coord; accuracy: CoordAccuracy };

/** مرکزِ استان‌ها/شهرها/سایت‌ها — همراه با برچسبِ دقت تا «تقریبی» شفاف بماند. */
export const GAZETTEER: Record<string, GazetteerEntry> = {
  "تهران": { coord: { lat: 35.69, lon: 51.39 }, accuracy: "city" },
  "اصفهان": { coord: { lat: 32.65, lon: 51.67 }, accuracy: "city" },
  "اهواز": { coord: { lat: 31.32, lon: 48.67 }, accuracy: "city" },
  "خوزستان": { coord: { lat: 31.32, lon: 48.67 }, accuracy: "province" },
  "بوشهر": { coord: { lat: 28.92, lon: 50.84 }, accuracy: "city" },
  "عسلویه": { coord: { lat: 27.48, lon: 52.61 }, accuracy: "city" },
  "بندر دیر": { coord: { lat: 27.83, lon: 51.94 }, accuracy: "city" },
  "هرمزگان": { coord: { lat: 27.18, lon: 56.28 }, accuracy: "province" },
  "بندرعباس": { coord: { lat: 27.18, lon: 56.28 }, accuracy: "city" },
  "خلیج فارس": { coord: { lat: 27.5, lon: 52.0 }, accuracy: "region" },
  "فارس": { coord: { lat: 29.59, lon: 52.58 }, accuracy: "province" },
  "شیراز": { coord: { lat: 29.59, lon: 52.58 }, accuracy: "city" },
  "کرمان": { coord: { lat: 30.28, lon: 57.08 }, accuracy: "city" },
  "ایلام": { coord: { lat: 33.63, lon: 46.42 }, accuracy: "city" },
  "کرمانشاه": { coord: { lat: 34.31, lon: 47.07 }, accuracy: "city" },
  "گیلان": { coord: { lat: 37.28, lon: 49.58 }, accuracy: "province" },
  "رشت": { coord: { lat: 37.28, lon: 49.58 }, accuracy: "city" },
  "سیستان و بلوچستان": { coord: { lat: 29.49, lon: 60.86 }, accuracy: "province" },
  "زاهدان": { coord: { lat: 29.49, lon: 60.86 }, accuracy: "city" },
  "لرستان": { coord: { lat: 33.49, lon: 48.36 }, accuracy: "province" },
  "خرم آباد": { coord: { lat: 33.49, lon: 48.36 }, accuracy: "city" },
  "خرمآباد": { coord: { lat: 33.49, lon: 48.36 }, accuracy: "city" },
  "مازندران": { coord: { lat: 36.56, lon: 53.06 }, accuracy: "province" },
  "ساری": { coord: { lat: 36.56, lon: 53.06 }, accuracy: "city" },
  "خراسان رضوی": { coord: { lat: 36.3, lon: 59.61 }, accuracy: "province" },
  "مشهد": { coord: { lat: 36.3, lon: 59.61 }, accuracy: "city" },
};

export const LOCATION_COORDS: Record<string, Coord> = Object.fromEntries(
  Object.entries(GAZETTEER).map(([k, v]) => [k, v.coord]),
);

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
  return resolveSite(location)?.coord ?? null;
}

/** تطبیقِ نامِ مکان با گَزِتیر، همراه با دقت. */
export function resolveSite(location: string): GazetteerEntry | null {
  if (!location) return null;
  const key = location.trim();
  if (GAZETTEER[key]) return GAZETTEER[key];
  const hit = Object.keys(GAZETTEER).find((k) => key.includes(k) || k.includes(key));
  return hit ? GAZETTEER[hit] : null;
}

/* ══════════════════════════════════════════════════════════════════════
   ثبتِ مختصاتِ واقعیِ پروژه — بدون نیاز به پایگاه داده

   مختصاتِ مرکزِ استان کافی نیست؛ کاربر باید بتواند مختصاتِ دقیقِ سایت را
   برای هر پروژه وارد کند (یا از CSV درون‌ریزی کند). این ثبت در حافظهٔ
   مرورگر نگه داشته می‌شود و بر گَزِتیر برتری دارد؛ با اتصال به SQL،
   همان مقدارها از جدول Project_Site خوانده می‌شود.
   ══════════════════════════════════════════════════════════════════════ */

const OVERRIDE_KEY = "geo.site.overrides.v1";

export function loadOverrides(): Record<string, Coord> {
  try {
    const raw = localStorage.getItem(OVERRIDE_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw) as Record<string, Coord>;
    return Object.fromEntries(
      Object.entries(data).filter(([, c]) => c && Number.isFinite(c.lat) && Number.isFinite(c.lon)),
    );
  } catch {
    return {};
  }
}

export function saveOverrides(map: Record<string, Coord>): void {
  try {
    localStorage.setItem(OVERRIDE_KEY, JSON.stringify(map));
  } catch {
    /* حافظهٔ مرورگر در دسترس نیست — بی‌توجه */
  }
}

export function setOverride(current: Record<string, Coord>, id: string, coord: Coord | null): Record<string, Coord> {
  const next = { ...current };
  if (coord) next[id] = coord;
  else delete next[id];
  saveOverrides(next);
  return next;
}

/** درون‌ریزیِ CSV با ستون‌هایِ id یا code و lat و lon. */
export function parseCoordCsv(text: string, codeToId: Record<string, string> = {}): Record<string, Coord> {
  const out: Record<string, Coord> = {};
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  for (const line of lines.slice(1)) {
    const cells = line.split(/[,;\t]/).map((c) => c.replace(/^"|"$/g, "").trim());
    if (cells.length < 3) continue;
    const [rawId, rawLat, rawLon] = cells;
    const lat = Number(rawLat);
    const lon = Number(rawLon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;
    const id = codeToId[rawId] ?? rawId;
    if (id) out[id] = { lat, lon };
  }
  return out;
}

export function exportCoordCsv(overrides: Record<string, Coord>): string {
  const rows = ["id,lat,lon", ...Object.entries(overrides).map(([id, c]) => `${id},${c.lat},${c.lon}`)];
  return rows.join("\n");
}

export function plotSites(sites: Site[], origin: Coord, overrides: Record<string, Coord> = {}): PlottedSite[] {
  return sites.map((s) => {
    const override = overrides[s.id];
    if (override) {
      return {
        ...s,
        coord: override,
        distanceKm: haversineKm(origin, override),
        accuracy: "exact" as CoordAccuracy,
        coordSource: "override" as CoordSource,
      };
    }
    const hit = resolveSite(s.location);
    return {
      ...s,
      coord: hit?.coord ?? null,
      distanceKm: hit ? haversineKm(origin, hit.coord) : null,
      accuracy: hit?.accuracy ?? "region",
      coordSource: hit ? ("gazetteer" as CoordSource) : ("none" as CoordSource),
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
