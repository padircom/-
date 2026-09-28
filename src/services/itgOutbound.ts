/**
 * P9 — یکپارچه‌سازی خروجی (ITG-1..ITG-3).
 *
 * ITG-1: ساخت XER پریماورا و XML مایکروسافت پروجکت از **دادهٔ زندهٔ** پروژه.
 * ITG-2: اتصال مستقیم به API پریماورا (P6 EPPM REST) + بازرسی صادقانهٔ `.mpp`.
 * ITG-3: ساخت iCalendar و همگام‌سازی Outlook/Exchange (Graph یا EWS).
 *
 * این ماژول هیچ درخواست شبکه‌ای نمی‌زند؛ فقط مشخصات، محموله و دسته‌بندی خطا
 * را می‌سازد تا هم در سرور و هم در آزمون قابل بازرسی باشد.
 */
import { toIsoDate } from "./integration";

export const ITG_OUTBOUND_MODEL = "itg-outbound-v1";

export type Bi = { fa: string; en: string };
export type ItgRow = Record<string, unknown>;

const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v));
const day = (v: unknown): string | null => toIsoDate(v);
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const flag = (v: unknown): boolean => v === true || v === 1 || v === "1" || v === "true";

/* ═══════════════════ ITG-1: XER پریماورا ═══════════════════ */

export const XER_EXPORT_VERSION = "19.12";

export type XerExportInput = {
  project: { Id: string; Code: string; NameFa: string };
  wbs: ItgRow[];
  activities: ItgRow[];
  relations: ItgRow[];
  hoursPerDay?: number;
  exportedAt: string;
  user: string;
};

/** نگاشت قطعی ردیف‌های محلی به شناسه‌های عددی XER؛ ورودی پریماورا عدد می‌خواهد. */
function numericIds(rows: ItgRow[], start: number): Map<string, number> {
  const map = new Map<string, number>();
  rows.forEach((row, i) => map.set(str(row.Id), start + i));
  return map;
}

const cell = (v: unknown): string => {
  const s = str(v).replace(/[\t\r\n]+/g, " ");
  return s;
};

/** یک جدول XER: %T / %F / %R… */
function table(name: string, fields: string[], rows: string[][], out: string[]): void {
  if (rows.length === 0) return;
  out.push(`%T\t${name}`, `%F\t${fields.join("\t")}`);
  for (const row of rows) out.push(`%R\t${row.map(cell).join("\t")}`);
}

export type XerExportResult = {
  text: string;
  counts: { wbs: number; activities: number; relations: number; tables: number };
  idMap: { wbs: Record<string, string>; activities: Record<string, string> };
  issues: { code: string; severity: "error" | "warning"; message: string }[];
};

/**
 * XER خروجی از دادهٔ زنده.
 *
 * شناسه‌ها عددی و قطعی‌اند (WBS از ۱۰۰۰، فعالیت از ۲۰۰۰) چون فیلدهای
 * `wbs_id`/`task_id` در XER عددی‌اند؛ نگاشت برگشتی در `idMap` گزارش می‌شود
 * تا کاربر بداند کدام ردیف با کدام شناسه بیرون رفته است.
 */
export function buildXer(input: XerExportInput): XerExportResult {
  const hoursPerDay = input.hoursPerDay && input.hoursPerDay > 0 ? input.hoursPerDay : 8;
  const issues: XerExportResult["issues"] = [];
  const wbsIds = numericIds(input.wbs, 1000);
  const actIds = numericIds(input.activities, 2000);
  const out: string[] = [];
  const projectName = input.project.NameFa || input.project.Code;
  out.push(["ERMHDR", XER_EXPORT_VERSION, input.exportedAt.slice(0, 10), "PMIS", input.user, "", "", projectName].join("\t"));

  const dataDate = input.activities.map((a) => day(a.PlannedFinish)).filter((d): d is string => Boolean(d)).sort().slice(-1)[0] ?? input.exportedAt.slice(0, 10);

  table("PROJECT", ["proj_id", "proj_short_name", "proj_name", "last_recalc_date", "export_flag", "clndr_id"], [
    ["1", input.project.Code, projectName, dataDate, "Y", "1"],
  ], out);

  table("CALENDAR", ["clndr_id", "clndr_name", "day_hr_cnt", "week_hr_cnt", "default_flag"], [
    ["1", `PMIS ${hoursPerDay}h`, String(hoursPerDay), String(hoursPerDay * 5), "Y"],
  ], out);

  const wbsRows = input.wbs.map((w) => {
    const parent = str(w.ParentId);
    const known = parent && wbsIds.has(parent) ? String(wbsIds.get(parent)) : "";
    if (parent && !known) issues.push({ code: "W-ITG-XER-ORPHANWBS", severity: "warning", message: `WBS «${str(w.Code)}» والد ناشناخته دارد؛ سطح ۱ فرض شد` });
    return [String(wbsIds.get(str(w.Id))), "1", known, str(w.Code), str(w.NameFa)];
  });
  table("PROJWBS", ["wbs_id", "proj_id", "parent_wbs_id", "wbs_short_name", "wbs_name"], wbsRows, out);

  table("TASK", [
    "task_id", "proj_id", "wbs_id", "clndr_id", "task_code", "task_name", "status_code",
    "target_start_date", "target_end_date", "act_start_date", "act_end_date",
    "target_drtn_hr_cnt", "total_float_hr_cnt", "free_float_hr_cnt", "phys_complete_pct", "driving_path_flag",
  ], input.activities.map((a) => {
    const wbsId = str(a.WbsId);
    if (wbsId && !wbsIds.has(wbsId)) issues.push({ code: "W-ITG-XER-ORPHANACT", severity: "warning", message: `فعالیت «${str(a.Code)}» به WBS ناموجود اشاره دارد` });
    const duration = num(a.DurationDays);
    const totalFloat = num(a.TotalFloat);
    const freeFloat = num(a.FreeFloat);
    return [
      String(actIds.get(str(a.Id))), "1", wbsId && wbsIds.has(wbsId) ? String(wbsIds.get(wbsId)) : "", "1",
      str(a.Code), str(a.NameFa), "TK_NotStart",
      day(a.PlannedStart) ?? "", day(a.PlannedFinish) ?? "", day(a.ActualStart) ?? "", day(a.ActualFinish) ?? "",
      duration === null ? "" : String(Math.round(duration * hoursPerDay)),
      totalFloat === null ? "" : String(Math.round(totalFloat * hoursPerDay)),
      freeFloat === null ? "" : String(Math.round(freeFloat * hoursPerDay)),
      String(num(a.PhysicalPct) ?? 0), flag(a.IsCritical) ? "Y" : "",
    ];
  }), out);

  const relRows: string[][] = [];
  input.relations.forEach((rel, i) => {
    const pred = actIds.get(str(rel.PredecessorId));
    const succ = actIds.get(str(rel.SuccessorId));
    if (pred === undefined || succ === undefined) {
      issues.push({ code: "W-ITG-XER-ORPHANREL", severity: "warning", message: "رابطه به فعالیت خارج از همین پروژه اشاره دارد و صادر نشد" });
      return;
    }
    const type = str(rel.RelType) || "FS";
    const lagDays = num(rel.LagDays) ?? 0;
    relRows.push([String(3000 + i), String(succ), String(pred), "1", type, String(Math.round(lagDays * hoursPerDay)), "1"]);
  });
  table("TASKPRED", ["task_pred_id", "task_id", "pred_task_id", "proj_id", "pred_type", "lag_hr_cnt", "clndr_id"], relRows, out);

  out.push("%E");
  return {
    text: out.join("\r\n") + "\r\n",
    counts: { wbs: wbsRows.length, activities: input.activities.length, relations: relRows.length, tables: 5 },
    idMap: {
      wbs: Object.fromEntries([...wbsIds].map(([k, v]) => [k, String(v)])),
      activities: Object.fromEntries([...actIds].map(([k, v]) => [k, String(v)])),
    },
    issues,
  };
}

/* ═══════════════════ ITG-1: XML مایکروسافت پروجکت (MSPDI) ═══════════════════ */

export const MSP_NAMESPACE = "http://schemas.microsoft.com/project";

export function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export type MspExportResult = { xml: string; counts: { tasks: number; links: number; wbs: number }; issues: XerExportResult["issues"]; dataDate: string };

/** XML پروژهٔ مایکروسافت (MSPDI) از همان دادهٔ زنده؛ تکالیف منبع صادر نمی‌شوند. */
export function buildMspXml(input: XerExportInput): MspExportResult {
  const issues: XerExportResult["issues"] = [];
  const wbsIds = numericIds(input.wbs, 1000);
  const dataDate = input.activities.map((a) => day(a.PlannedFinish)).filter((d): d is string => Boolean(d)).sort().slice(-1)[0] ?? input.exportedAt.slice(0, 10);
  const hoursPerDay = input.hoursPerDay && input.hoursPerDay > 0 ? input.hoursPerDay : 8;

  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>');
  lines.push(`<Project xmlns="${MSP_NAMESPACE}">`);
  lines.push(`  <Name>${xmlEscape(input.project.NameFa || input.project.Code)}</Name>`);
  lines.push(`  <Title>${xmlEscape(input.project.Code)}</Title>`);
  lines.push(`  <CreationDate>${input.exportedAt}</CreationDate>`);
  lines.push(`  <MinutesPerDay>${Math.round(hoursPerDay * 60)}</MinutesPerDay>`);
  lines.push("  <Tasks>");

  /* WBS ها به‌صورت تکالیف خلاصه می‌آیند تا سلسله‌مراتب در مایکروسافت پروجکت
   * همان چیزی باشد که در برنامه است. */
  const uidOfWbs = new Map<string, number>();
  let uid = 1;
  for (const w of input.wbs) {
    const id = str(w.Id);
    const parent = str(w.ParentId);
    uidOfWbs.set(id, uid);
    lines.push("    <Task>");
    lines.push(`      <UID>${uid}</UID>`);
    lines.push(`      <ID>${uid}</ID>`);
    lines.push(`      <Name>${xmlEscape(str(w.NameFa) || str(w.Code))}</Name>`);
    lines.push("      <Type>0</Type>");
    lines.push("      <IsNull>0</IsNull>");
    lines.push("      <Summary>1</Summary>");
    lines.push(`      <WBS>${xmlEscape(str(w.Code))}</WBS>`);
    lines.push(`      <OutlineLevel>${Math.max(1, num(w.Level) ?? 1)}</OutlineLevel>`);
    if (parent && wbsIds.has(parent)) lines.push(`      <OutlineParentUID>${uidOfWbs.get(parent) ?? 0}</OutlineParentUID>`);
    lines.push("    </Task>");
    uid += 1;
  }

  const activityUid = new Map<string, number>();
  let linkTotal = 0;
  for (const a of input.activities) {
    const id = str(a.Id);
    const wbs = str(a.WbsId);
    const start = day(a.PlannedStart);
    const finish = day(a.PlannedFinish);
    if (!start || !finish) issues.push({ code: "W-ITG-MSP-NODATE", severity: "warning", message: `فعالیت «${str(a.Code)}» تاریخ برنامه‌ای کامل ندارد` });
    const durationDays = num(a.DurationDays) ?? 0;
    activityUid.set(id, uid);
    lines.push("    <Task>");
    lines.push(`      <UID>${uid}</UID>`);
    lines.push(`      <ID>${uid}</ID>`);
    lines.push(`      <Name>${xmlEscape(str(a.NameFa) || str(a.Code))}</Name>`);
    lines.push("      <Type>1</Type>");
    lines.push("      <IsNull>0</IsNull>");
    lines.push("      <Summary>0</Summary>");
    lines.push(`      <WBS>${xmlEscape(str(a.Code))}</WBS>`);
    if (wbs && wbsIds.has(wbs)) lines.push(`      <OutlineParentUID>${uidOfWbs.get(wbs) ?? 0}</OutlineParentUID>`);
    if (start) lines.push(`      <Start>${start}T08:00:00</Start>`);
    if (finish) lines.push(`      <Finish>${finish}T17:00:00</Finish>`);
    lines.push(`      <Duration>PT${Math.round(durationDays * hoursPerDay)}H0M0S</Duration>`);
    lines.push("      <DurationFormat>7</DurationFormat>");
    lines.push(`      <PercentComplete>${Math.max(0, Math.min(100, Math.round(num(a.PhysicalPct) ?? 0)))}</PercentComplete>`);
    lines.push(`      <Milestone>${durationDays === 0 ? 1 : 0}</Milestone>`);
    lines.push(`      <Critical>${flag(a.IsCritical) ? 1 : 0}</Critical>`);
    if (day(a.ActualStart)) lines.push(`      <ActualStart>${day(a.ActualStart)}T08:00:00</ActualStart>`);
    let linkCount = 0;
    const links: string[] = [];
    for (const rel of input.relations) {
      if (str(rel.SuccessorId) !== id) continue;
      const predUid = activityUid.get(str(rel.PredecessorId));
      if (predUid === undefined) {
        issues.push({ code: "W-ITG-MSP-ORPHANREL", severity: "warning", message: `رابطهٔ پیش‌نیاز فعالیت «${str(a.Code)}» خارج از پروژه است` });
        continue;
      }
      const relType = str(rel.RelType) || "FS";
      const type = relType === "FF" ? 0 : relType === "FS" ? 1 : relType === "SF" ? 2 : 3;
      /* MSPDI: هر رابطه یک عنصر خواهرِ مستقل است؛ تودرتو کردن آن‌ها
       * سند را نامعتبر می‌کند. */
      links.push(`      <PredecessorLink><PredecessorUID>${predUid}</PredecessorUID><Type>${type}</Type><CrossProject>0</CrossProject><LinkLag>${Math.round((num(rel.LagDays) ?? 0) * hoursPerDay * 60)}</LinkLag><LagFormat>7</LagFormat></PredecessorLink>`);
      linkCount += 1;
    }
    for (const link of links) lines.push(link);
    linkTotal += linkCount;
    lines.push("    </Task>");
    uid += 1;
  }
  lines.push("  </Tasks>");
  lines.push("  <Resources/>");
  lines.push("  <Assignments/>");
  lines.push("</Project>");
  return { xml: lines.join("\n") + "\n", counts: { tasks: uid - 1, links: linkTotal, wbs: input.wbs.length }, issues, dataDate };
}

/* ═══════════════════ ITG-2: اتصال پریماورا P6 ═══════════════════ */

export const P6_ENV_FIELDS = ["P6_BASE_URL", "P6_DATABASE", "P6_USER_ID", "P6_PASSWORD"] as const;
export type P6Env = Partial<Record<(typeof P6_ENV_FIELDS)[number] | "P6_AUTH_MODE" | "P6_TIMEOUT_MS", string>>;
export type P6Config = {
  configured: boolean;
  missing: string[];
  baseUrl: string;
  database: string;
  user: string;
  authMode: "basic" | "bearer";
  timeoutMs: number;
};

export function p6ConfigFrom(env: P6Env): P6Config {
  const missing = P6_ENV_FIELDS.filter((k) => !str(env[k]).trim());
  const timeoutRaw = Number(env.P6_TIMEOUT_MS ?? 10000);
  return {
    configured: missing.length === 0,
    missing,
    baseUrl: str(env.P6_BASE_URL).replace(/\/+$/, ""),
    database: str(env.P6_DATABASE),
    user: str(env.P6_USER_ID),
    authMode: str(env.P6_AUTH_MODE).toLowerCase() === "bearer" ? "bearer" : "basic",
    timeoutMs: Number.isFinite(timeoutRaw) && timeoutRaw >= 1000 && timeoutRaw <= 60000 ? Math.round(timeoutRaw) : 10000,
  };
}

/** محمولهٔ ورود فعالیت‌ها به P6 (EPPM REST: POST /p6/rest/api/activity). */
export function buildP6ActivityPayload(project: { Code: string }, activities: ItgRow[]): { activities: Record<string, unknown>[] } {
  return {
    activities: activities.map((a) => ({
      Id: str(a.Code),
      Name: str(a.NameFa) || str(a.Code),
      ProjectId: project.Code,
      PlannedStartDate: day(a.PlannedStart),
      PlannedFinishDate: day(a.PlannedFinish),
      ActualStartDate: day(a.ActualStart),
      ActualFinishDate: day(a.ActualFinish),
      PercentComplete: num(a.PhysicalPct) ?? 0,
      DurationType: "FixedDurationAndUnitsTime",
    })),
  };
}

export type P6ErrorCode = "E-P6-NOT-CONFIGURED" | "E-P6-AUTH" | "E-P6-FORBIDDEN" | "E-P6-NOT-FOUND" | "E-P6-VALIDATION" | "E-P6-UNREACHABLE" | "E-P6-TIMEOUT" | "E-P6-HTTP" | "E-P6-BAD-PAYLOAD";

/** دسته‌بندی خطای P6 — پیام صادقانه، نه «موفق» بی‌شاهد. */
export function classifyP6Error(status: number, phase: "probe" | "push" = "push"): { code: P6ErrorCode; retryable: boolean; messageFa: string } {
  if (status === 0) return { code: "E-P6-UNREACHABLE", retryable: true, messageFa: "اتصال به سرویس پریماورا برقرار نشد" };
  if (status === 401) return { code: "E-P6-AUTH", retryable: false, messageFa: "نام کاربری/رمز پریماورا پذیرفته نشد" };
  if (status === 403) return { code: "E-P6-FORBIDDEN", retryable: false, messageFa: "کاربر پریماورا به این عملیات دسترسی ندارد" };
  if (status === 404) return { code: "E-P6-NOT-FOUND", retryable: false, messageFa: phase === "probe" ? "سرویس P6 در این نشانی پیدا نشد" : "پروژه یا مسیر فعالیت در P6 پیدا نشد" };
  if (status === 400 || status === 422) return { code: "E-P6-VALIDATION", retryable: false, messageFa: "P6 محموله را نپذیرفت؛ کد/تاریخ فعالیت‌ها را بررسی کنید" };
  if (status === 408 || status === 504) return { code: "E-P6-TIMEOUT", retryable: true, messageFa: "پاسخ P6 در مهلت نرسید" };
  if (status >= 500) return { code: "E-P6-HTTP", retryable: true, messageFa: `خطای سرویس P6 (${status})` };
  return { code: "E-P6-HTTP", retryable: false, messageFa: `پاسخ ناموفق P6 (${status})` };
}

export function p6ProbePath(config: P6Config): string {
  return `${config.baseUrl}/p6/rest/api/project?limit=1&database=${encodeURIComponent(config.database)}`;
}
export function p6ActivityPath(config: P6Config): string {
  return `${config.baseUrl}/p6/rest/api/activity`;
}

/** حالت MPP: ساختار OLE2/CFB یا ZIP؛ هیچ تحلیل‌گر MPP خالص JS در پروژه نیست. */
export type MppInspection = { isMpp: boolean; container: "ole2" | "zip" | "unknown"; supported: boolean; guidanceFa: string; bytes: number };

export function inspectMppHeader(bytes: Uint8Array | number[]): MppInspection {
  const arr = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes);
  const head = [...arr.slice(0, 8)].map((b) => b.toString(16).padStart(2, "0")).join("");
  const ole2 = head.startsWith("d0cf11e0a1b11ae1");
  const zip = head.startsWith("504b0304");
  const container: MppInspection["container"] = ole2 ? "ole2" : zip ? "zip" : "unknown";
  return {
    isMpp: ole2 || zip,
    container,
    supported: false,
    bytes: arr.length,
    guidanceFa: ole2 || zip
      ? "فایل .mpp یک ظرف دودویی است و تحلیل‌گر MPP در این سامانه وجود ندارد؛ از خروجی XML مایکروسافت پروجکت یا XER پریماورا استفاده کنید."
      : "ساختار فایل شناسایی نشد؛ فایل MPP/MS Project معتبر نیست.",
  };
}

/* ═══════════════════ ITG-3: تقویم و Outlook/Exchange ═══════════════════ */

export const ICS_PRODUCER = "-//Arena PMIS//Integration//FA";

export type ItgCalendarEvent = {
  uid: string;
  summary: string;
  description: string;
  start: string;
  end: string;
  allDay: boolean;
  location: string | null;
  category: string;
  /** مبدأ داخلی برای بازرسی و کلید یکتای صندوق خروجی. */
  source: { table: string; id: string };
};

const ONE_DAY = 86400000;

/** بخش‌بندی خطوط ICS در ۷۵ اکتت (RFC 5545 §3.1). */
export function icsFold(line: string): string {
  const out: string[] = [];
  let current = "";
  for (const ch of line) {
    const bytes = new TextEncoder().encode(current + ch).length;
    if (bytes > 73 && current) {
      out.push(current);
      current = ch;
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out.join("\r\n ");
}
export function icsEscape(s: string): string {
  return str(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}
const icsStamp = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const nextDay = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) + ONE_DAY).toISOString().slice(0, 10);

/** کلید یکتای رویداد — از داده ساخته می‌شود تا تکرارِ همگام‌سازی رویداد تازه نسازد. */
export function calendarEventKey(projectId: string, table: string, id: string): string {
  return `${projectId}|${table}|${id}`;
}
export function icsUid(projectId: string, table: string, id: string): string {
  const raw = `${projectId}:${table}:${id}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x1000193;
  for (let i = 0; i < raw.length; i += 1) {
    h1 = (h1 ^ raw.charCodeAt(i)) * 0x01000193;
    h2 = (h2 + raw.charCodeAt(i) * (i + 1)) >>> 0;
  }
  const a = (h1 >>> 0).toString(16).padStart(8, "0");
  const b = (h2 >>> 0).toString(16).padStart(8, "0");
  return `${a}-${b}@pmis.local`;
}

export type IcsBuildResult = { ics: string; counts: { events: number; milestones: number }; issues: { code: string; severity: "error" | "warning"; message: string }[] };

export function buildIcs(events: ItgCalendarEvent[], opts: { now: string; method?: "PUBLISH" | "REQUEST" | "CANCEL" }): IcsBuildResult {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${ICS_PRODUCER}`,
    "CALSCALE:GREGORIAN",
    `METHOD:${opts.method ?? "PUBLISH"}`,
    "X-WR-CALNAME:PMIS",
  ];
  const issues: IcsBuildResult["issues"] = [];
  const seen = new Set<string>();
  for (const ev of events) {
    if (!ev.start) {
      issues.push({ code: "W-ITG-ICS-NODATE", severity: "warning", message: `رویداد «${ev.summary}» تاریخ ندارد و صادر نشد` });
      continue;
    }
    if (seen.has(ev.uid)) {
      issues.push({ code: "W-ITG-ICS-DUPUID", severity: "warning", message: `شناسهٔ تکراری رویداد «${ev.uid}» حذف شد` });
      continue;
    }
    seen.add(ev.uid);
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${ev.uid}`);
    lines.push(`DTSTAMP:${icsStamp(opts.now)}Z`);
    if (ev.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${ev.start.replace(/-/g, "")}`);
      lines.push(`DTEND;VALUE=DATE:${nextDay(ev.start).replace(/-/g, "")}`);
    } else {
      lines.push(`DTSTART:${icsStamp(ev.start)}Z`);
      lines.push(`DTEND:${icsStamp(ev.end)}Z`);
    }
    lines.push(`SUMMARY:${icsEscape(ev.summary)}`);
    lines.push(`DESCRIPTION:${icsEscape(ev.description)}`);
    if (ev.location) lines.push(`LOCATION:${icsEscape(ev.location)}`);
    lines.push(`CATEGORIES:${icsEscape(ev.category)}`);
    lines.push("TRANSP:OPAQUE");
    lines.push("STATUS:CONFIRMED");
    lines.push("SEQUENCE:0");
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return {
    ics: lines.map(icsFold).join("\r\n") + "\r\n",
    /* نقاط عطف = رویدادهای بدون مدت؛ همهٔ رویدادها «تمام‌روز»‌اند و شمارش آن‌ها
     * به‌جای مایل‌استون، عدد را بی‌معنی می‌کرد. */
    counts: { events: seen.size, milestones: events.filter((e) => e.category === "milestone").length },
    issues,
  };
}

/** رویدادهای تقویم از سه منبع زندهٔ پروژه: فعالیت‌ها، نقاط عطف و مهلت بازرسی‌ها. */
export function calendarEventsFrom(input: {
  project: { Id: string; Code: string };
  activities: ItgRow[];
  inspections: ItgRow[];
  horizonDays?: number;
}): ItgCalendarEvent[] {
  const horizonDays = input.horizonDays && input.horizonDays > 0 ? input.horizonDays : 120;
  const today = new Date().toISOString().slice(0, 10);
  const until = new Date(Date.parse(`${today}T00:00:00Z`) + horizonDays * ONE_DAY).toISOString().slice(0, 10);
  const events: ItgCalendarEvent[] = [];
  for (const a of input.activities) {
    const start = day(a.PlannedStart);
    const finish = day(a.PlannedFinish);
    const id = str(a.Id);
    const code = str(a.Code);
    if (!start || !finish) continue;
    if (finish < today || start > until) continue;
    const duration = num(a.DurationDays) ?? 0;
    const isMilestone = duration === 0;
    events.push({
      uid: icsUid(input.project.Id, "Activity", id),
      summary: `${isMilestone ? "◆" : "▸"} ${code} — ${str(a.NameFa)}`,
      description: `فعالیت ${code} | دیسیپلین: ${str(a.Discipline) || "—"} | پیشرفت: ${num(a.PhysicalPct) ?? 0}%`,
      start: isMilestone ? finish : start,
      end: isMilestone ? finish : finish,
      allDay: true,
      location: null,
      category: isMilestone ? "milestone" : "activity",
      source: { table: "Activity", id },
    });
  }
  for (const r of input.inspections) {
    const target = day(r.TargetDate);
    if (!target || target < today || target > until) continue;
    if (["released", "cancelled", "rejected"].includes(str(r.Status))) continue;
    const id = str(r.Id);
    events.push({
      uid: icsUid(input.project.Id, "CpmInspectionRequest", id),
      summary: `⚑ بازرسی ${str(r.RequestType) === "rfi" ? "RFI" : "IR"} ${str(r.RequestNo)}`,
      description: `وضعیت: ${str(r.Status)} | دیسیپلین: ${str(r.Discipline) || "—"} | فعالیت: ${str(r.ActivityCode) || "—"}`,
      start: target,
      end: target,
      allDay: true,
      location: str(r.LocationFa) || null,
      category: "inspection",
      source: { table: "CpmInspectionRequest", id },
    });
  }
  return events.sort((a, b) => a.start.localeCompare(b.start) || a.uid.localeCompare(b.uid));
}

export const GRAPH_ENV_FIELDS = ["MS_GRAPH_TENANT_ID", "MS_GRAPH_CLIENT_ID", "MS_GRAPH_CLIENT_SECRET", "MS_GRAPH_MAILBOX"] as const;
export const EWS_ENV_FIELDS = ["EWS_ENDPOINT", "EWS_USERNAME", "EWS_PASSWORD"] as const;

export type ExchangeConfig = { mode: "graph" | "ews" | "none"; configured: boolean; missing: string[]; mailbox: string | null; endpoint: string | null };

export function exchangeConfigFrom(env: Record<string, string | undefined>): ExchangeConfig {
  const graphMissing = GRAPH_ENV_FIELDS.filter((k) => !str(env[k]).trim());
  if (graphMissing.length === 0) return { mode: "graph", configured: true, missing: [], mailbox: str(env.MS_GRAPH_MAILBOX), endpoint: "https://graph.microsoft.com/v1.0" };
  const ewsMissing = EWS_ENV_FIELDS.filter((k) => !str(env[k]).trim());
  if (ewsMissing.length === 0) return { mode: "ews", configured: true, missing: [], mailbox: str(env.EWS_USERNAME), endpoint: str(env.EWS_ENDPOINT) };
  return { mode: "none", configured: false, missing: graphMissing.length <= ewsMissing.length ? [...graphMissing] : [...ewsMissing], mailbox: null, endpoint: null };
}

/** محمولهٔ Graph برای ارسال دعوت تقویم با پیوست ICS. */
export function buildGraphSendPayload(input: { mailbox: string; ics: string; subject: string; bodyFa: string }): Record<string, unknown> {
  const base64 = base64Utf8(input.ics);
  return {
    message: {
      subject: input.subject,
      body: { contentType: "Text", content: input.bodyFa },
      toRecipients: [{ emailAddress: { address: input.mailbox } }],
      attachments: [
        {
          "@odata.type": "#microsoft.graph.fileAttachment",
          name: "pmis-calendar.ics",
          contentType: "text/calendar; charset=utf-8",
          contentBytes: base64,
        },
      ],
    },
    saveToSentItems: false,
  };
}
/** base64 یونیکد بدون وابستگی به Buffer (هم مرورگر، هم سرور). */
export function base64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  if (typeof btoa === "function") return btoa(binary);
  return (globalThis as { Buffer?: { from: (s: string, e: string) => { toString: (e: string) => string } } }).Buffer!.from(binary, "binary").toString("base64");
}

export function exchangeSendPath(config: ExchangeConfig): string {
  if (config.mode === "graph") return `${config.endpoint}/users/${encodeURIComponent(config.mailbox ?? "")}/sendMail`;
  if (config.mode === "ews") return config.endpoint ?? "";
  return "";
}
