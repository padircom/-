/* ══════════════════════════════════════════════════════════════════════
   EDMS-API-v1 — دسترسیِ دادهٔ ماژولِ d1 (مدارک، ترانسمیتال، مکاتبات، دانش)

   این لایه تنها نقطه‌ای است که d1 با سرور صحبت می‌کند. سه اصل:

     ۱) هر تابع یا داده برمی‌گرداند یا `null` — هرگز استثنا پرتاب نمی‌کند.
        قطعِ سرور به معنایِ «برو سراغ داده‌ی نمونه» است، نه صفحهٔ خطا.
     ۲) نگاشت میانِ شکلِ رابط (عنوانِ دوزبانه، کد بررسی، SLA) و ستون‌های
        جدول اینجا انجام می‌شود؛ پنل فقط با شکلِ رابط کار می‌کند.
     ۳) نوشتن «خوش‌بینانه» نیست: ابتدا سرور، سپس بازخوانی — تا رابط و
        پایگاه هیچ‌وقت از هم جدا نشوند.
   ══════════════════════════════════════════════════════════════════════ */

export type ApiRow = Record<string, unknown>;

const BASE = "/api/data";

async function request<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { "content-type": "application/json" },
      ...init,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { ok?: boolean; data?: unknown };
    if (!json.ok) return null;
    return (json.data ?? null) as T;
  } catch {
    return null;
  }
}

export type ListResult<T> = { items: T[]; total: number };

export async function listRows(table: string, projectId?: string): Promise<ListResult<ApiRow> | null> {
  const q = projectId ? `?ProjectId=${encodeURIComponent(projectId)}` : "";
  return request<ListResult<ApiRow>>(`/${table}${q}`);
}

export async function createRow(table: string, row: ApiRow): Promise<ApiRow | null> {
  const res = await request<{ row?: ApiRow } | ApiRow>(`/${table}`, {
    method: "POST",
    body: JSON.stringify(row),
  });
  if (!res) return null;
  const candidate = (res as { row?: ApiRow }).row ?? (res as ApiRow);
  return candidate ?? null;
}

export async function patchRow(table: string, id: string, patch: ApiRow): Promise<ApiRow | null> {
  const res = await request<{ row?: ApiRow } | ApiRow>(`/${table}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  if (!res) return null;
  return (res as { row?: ApiRow }).row ?? (res as ApiRow);
}

export async function deleteRow(table: string, id: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/${table}/${encodeURIComponent(id)}`, { method: "DELETE" });
    return res.ok;
  } catch {
    return false;
  }
}

/* ── نگاشت: ردیفِ پایگاه ↔ شکلِ رابط ─────────────────────────────────── */

export type UiDoc = {
  id: string;
  code: string;
  title: { fa: string; en: string };
  revision: string;
  discipline: string;
  status: "draft" | "under_review" | "approved" | "rejected";
  reviewCode: string;
  slaHours: number;
  updatedAt: string;
};

const STATUSES: UiDoc["status"][] = ["draft", "under_review", "approved", "rejected"];

const asStatus = (v: unknown): UiDoc["status"] =>
  STATUSES.includes(String(v) as UiDoc["status"]) ? (String(v) as UiDoc["status"]) : "draft";

/** تبدیلِ تاریخِ شمسی به میلادی (الگوریتمِ استاندارد jalaali). */
function jalaliToGregorian(jy: number, jm: number, jd: number): Date | null {
  if (jy < 1300 || jy > 1600 || jm < 1 || jm > 12 || jd < 1 || jd > 31) return null;
  const jy2 = jy + 1595;
  let days =
    -355668 +
    365 * jy2 +
    Math.floor(jy2 / 33) * 8 +
    Math.floor(((jy2 % 33) + 3) / 4) +
    jd +
    (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  let gy = 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if (days >= 365) days += 1;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  let gd = days;
  if (gd > 365) {
    gy += Math.floor(--gd / 365);
    gd %= 365;
  }
  const leap = gy % 4 === 0 && (gy % 100 !== 0 || gy % 400 === 0);
  const monthLengths = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0;
  let remaining = gd + 1;
  while (gm < 12 && remaining > monthLengths[gm]) {
    remaining -= monthLengths[gm];
    gm += 1;
  }
  if (gm >= 12) return null;
  return new Date(Date.UTC(gy, gm, remaining));
}

/** هرچه از رابط می‌آید (شمسی، میلادی، ISO) را به YYYY-MM-DD میلادی می‌برد. */
function toIsoDate(value: string): string {
  const raw = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);

  /* رابط تاریخ را با تقویمِ شمسی نشان می‌دهد (مثل ۱۴۰۳/۰۳/۰۱)؛
     نباید به‌عنوانِ سالِ میلادی تعبیر شود. */
  const jalali = raw.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (jalali) {
    const g = jalaliToGregorian(Number(jalali[1]), Number(jalali[2]), Number(jalali[3]));
    if (g) return g.toISOString().slice(0, 10);
  }

  const parsed = Date.parse(raw);
  if (Number.isFinite(parsed)) return new Date(parsed).toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

/** تاریخِ میلادیِ پایگاه را برای نمایش به شمسی می‌برد. */
function toDisplayDate(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return raw;
  try {
    return new Date(parsed).toLocaleDateString("fa-IR");
  } catch {
    return raw.slice(0, 10);
  }
}

export function rowToDoc(r: ApiRow): UiDoc {
  return {
    id: String(r.Id ?? r.id ?? ""),
    code: String(r.DocNo ?? r.code ?? ""),
    title: { fa: String(r.TitleFa ?? ""), en: String(r.TitleEn ?? r.TitleFa ?? "") },
    revision: String(r.Revision ?? "Rev-00"),
    discipline: String(r.Discipline ?? "General"),
    status: asStatus(r.Status),
    reviewCode: String(r.ReviewCode ?? "—"),
    slaHours: Number(r.SlaHours ?? 0),
    updatedAt: toDisplayDate(r.IssuedAt ?? r.UpdatedAt),
  };
}

export function docToRow(d: UiDoc, projectId: string): ApiRow {
  return {
    ProjectId: projectId,
    DocNo: d.code,
    TitleFa: d.title.fa,
    TitleEn: d.title.en,
    Revision: d.revision,
    Discipline: d.discipline,
    Status: d.status,
    ReviewCode: d.reviewCode,
    SlaHours: d.slaHours,
    IssuedAt: toIsoDate(d.updatedAt),
  };
}

/** آیا سرور در دسترس است؟ (یک‌بار در شروعِ پنل صدا زده می‌شود) */
export async function edmsOnline(): Promise<boolean> {
  const r = await listRows("Document");
  return r !== null;
}
