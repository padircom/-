/* ══════════════════════════════════════════════════════════════════════
   MSP-IMPORT-v1 — ورودِ واقعیِ برنامهٔ زمان‌بندی (دامنهٔ d2)

   سه قالبِ رایج:
     ۱) XMLِ MS Project  (`<Tasks><Task>` با Duration به صورت PT…H)
     ۲) CSVِ صادرشده از MSP/P6 (ستون‌های Name, Duration, Total Slack, Predecessors)
     ۳) JSONِ ساده — برای اتصالِ مستقیمِ سرویس

   `.mpp` قالبِ باینریِ بسته است و در مرورگر قابلِ خواندن نیست؛ مسیرِ
   درست خروجیِ XML/CSV از خودِ MSP است. این ماژول همان را می‌خواند تا
   تحلیل (DCMA-lite) روی شبکهٔ واقعی انجام شود، نه روی دادهٔ نمونه.
   ══════════════════════════════════════════════════════════════════════ */

import type { ImportedTask } from "./scheduleInsights";

const num = (v: unknown, fallback = 0) => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[^\d.\-+eE]/g, ""));
  return Number.isFinite(n) ? n : fallback;
};

/** ISO 8601 duration (PT…H/PT…M) یا روزِ اعشاری → روز. */
function parseDuration(raw: string): number {
  const s = String(raw ?? "").trim();
  if (!s) return 0;
  const iso = s.match(/^P(?:(\d+)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?)?$/i);
  if (iso) {
    const days = num(iso[1]);
    const hours = num(iso[2]);
    const minutes = num(iso[3]);
    return days + hours / 8 + minutes / 480;
  }
  const ptH = s.match(/^PT([\d.]+)H/i);
  if (ptH) return num(ptH[1]) / 8;
  return num(s);
}

/** «12FS+3d» یا «12,15SS» → شناسه‌های پیش‌نیاز ( نوعِ رابطه فعلاً نادیده گرفته می‌شود). */
function parsePredecessors(raw: string): string[] {
  return String(raw ?? "")
    .split(/[,;]/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => p.replace(/(FS|SS|FF|SF)\s*[+-]?\s*[\d.]*[dwhm]?$/i, "").trim())
    .filter(Boolean);
}

const HARD_CONSTRAINTS = new Set([
  "Start No Earlier Than", "SNET", "Start No Later Than", "SNLT",
  "Finish No Earlier Than", "FNET", "Finish No Later Than", "FNLT",
  "Must Start On", "MSO", "Must Finish On", "MFO",
]);

/** خواندنِ XMLِ MS Project. */
export function parseMspXml(text: string): ImportedTask[] {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("XML_INVALID");

  const taskEls = Array.from(doc.querySelectorAll("Task"));
  const byUid = new Map<string, ImportedTask>();
  const successors: Record<string, string[]> = {};

  for (const el of taskEls) {
    const uid = el.querySelector("UID")?.textContent?.trim()
      || el.querySelector("ID")?.textContent?.trim()
      || String(byUid.size + 1);
    const name = el.querySelector("Name")?.textContent?.trim() || `Task ${uid}`;
    const durationText = el.querySelector("Duration")?.textContent?.trim() ?? "0";
    const totalSlack = num(el.querySelector("TotalSlack")?.textContent, 0);
    const constraintText = el.querySelector("ConstraintType")?.textContent?.trim() ?? "";
    const startText = el.querySelector("Start")?.textContent?.trim() ?? "";
    const finishText = el.querySelector("Finish")?.textContent?.trim() ?? "";
    const predsRaw = Array.from(el.querySelectorAll("PredecessorLink"))
      .map((p) => p.querySelector("PredecessorUID")?.textContent?.trim() ?? "")
      .filter(Boolean);

    const validDates = Boolean(startText && finishText && !Number.isNaN(Date.parse(startText)) && !Number.isNaN(Date.parse(finishText)));

    const task: ImportedTask = {
      id: uid,
      name,
      durationDays: Math.round(parseDuration(durationText) * 10) / 10,
      totalFloat: Math.round(totalSlack / 4800), // TotalSlack در MSP بر حسب ۱/۱۰۰ دقیقه است
      predecessors: predsRaw,
      successors: [],
      hardConstraint: HARD_CONSTRAINTS.has(constraintText),
      validDates,
    };
    byUid.set(uid, task);
    for (const p of predsRaw) (successors[p] ??= []).push(uid);
  }

  for (const [uid, list] of Object.entries(successors)) {
    const t = byUid.get(uid);
    if (t) t.successors = Array.from(new Set(list));
  }

  return [...byUid.values()];
}

/** خواندنِ CSVِ صادرشده (ستون‌ها با هر ترتیب، با سرستون). */
export function parseMspCsv(text: string): ImportedTask[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) throw new Error("CSV_EMPTY");
  const delim = lines[0].includes("\t") ? "\t" : lines[0].includes(";") ? ";" : ",";
  const head = lines[0].split(delim).map((h) => h.replace(/^"|"$/g, "").trim().toLowerCase());

  const col = (...names: string[]) => {
    for (const n of names) {
      const i = head.findIndex((h) => h === n.toLowerCase() || h.includes(n.toLowerCase()));
      if (i >= 0) return i;
    }
    return -1;
  };

  const iName = col("name", "task name", "عنوان", "فعالیت");
  const iDur = col("duration", "مدت", "زمان");
  const iSlack = col("total slack", "شناوری", "float");
  const iPred = col("predecessors", "پیش‌نیاز");
  const iCons = col("constraint type", "محدودیت");
  const iStart = col("start", "شروع");
  const iFinish = col("finish", "پایان");

  const tasks: ImportedTask[] = [];
  const successorMap: Record<string, string[]> = {};

  lines.slice(1).forEach((line, idx) => {
    const cells = line.split(delim).map((c) => c.replace(/^"|"$/g, "").trim());
    const get = (i: number) => (i >= 0 ? (cells[i] ?? "") : "");
    const id = String(idx + 1);
    const preds = parsePredecessors(get(iPred));
    const startText = get(iStart);
    const finishText = get(iFinish);
    tasks.push({
      id,
      name: get(iName) || `Task ${id}`,
      durationDays: Math.round(parseDuration(get(iDur)) * 10) / 10,
      totalFloat: Math.round(num(get(iSlack))),
      predecessors: preds,
      successors: [],
      hardConstraint: HARD_CONSTRAINTS.has(get(iCons)),
      validDates: Boolean(startText && finishText && !Number.isNaN(Date.parse(startText)) && !Number.isNaN(Date.parse(finishText))),
    });
    for (const p of preds) (successorMap[p] ??= []).push(id);
  });

  tasks.forEach((t, i) => {
    t.successors = Array.from(new Set(successorMap[String(i + 1)] ?? []));
  });

  return tasks;
}

/** تشخیصِ خودکارِ قالب بر پایهٔ محتوا. */
export function parseScheduleFile(name: string, text: string): ImportedTask[] {
  const lower = name.toLowerCase();
  const trimmed = text.trim();
  if (lower.endsWith(".json") || trimmed.startsWith("[")) {
    const data = JSON.parse(text);
    return Array.isArray(data) ? data : [];
  }
  if (lower.endsWith(".xml") || trimmed.startsWith("<")) return parseMspXml(text);
  return parseMspCsv(text);
}
