/**
 * عکس‌برداری از خروجی زندهٔ برنامه در یک فایل HTML مستقل.
 *
 * چرا لازم شد: پیش‌نمایش سندباکس توکن دسترسی می‌خواهد که فقط پلتفرم
 * می‌داند، و لینک دست‌ساز با «Missing Traffic Access Token» رد
 * می‌شود. این اسکریپت همان داده‌ای را که رابط کاربری نشان می‌دهد از
 * API واقعی می‌خواند و در یک فایل تخت می‌نویسد — بدون جاوااسکریپت،
 * بدون فراخوانی شبکه، قابل باز شدن در هر نمایشگری.
 *
 * جایگزین برنامه نیست؛ راهی است برای **دیدن نتیجه** وقتی مسیر
 * معمول بسته است.
 *
 * اجرا (سرور API باید بالا باشد):
 *   node server/snapshot.mjs
 */
import { writeFile } from "node:fs/promises";
import process from "node:process";

const API = process.env.API || "http://127.0.0.1:4000";
const P = process.env.PROJECT_ID || "p1";

async function get(path, user = "u-pmo") {
  const res = await fetch(`${API}${path}`, { headers: { "x-user-id": user } });
  const body = await res.json().catch(() => null);
  return body?.ok ? body.data : null;
}

const esc = (v) =>
  String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** «—» برای نامعلوم؛ صفر ادعاست، تهی اعتراف. */
const cell = (v) => (v === null || v === undefined || v === "" ? "—" : esc(v));

function table(cols, rows) {
  if (!rows.length) return `<p class="empty">ردیفی نیست.</p>`;
  return `<table>
    <thead><tr>${cols.map((c) => `<th>${esc(c[0])}</th>`).join("")}</tr></thead>
    <tbody>${rows
      .map((r) => `<tr>${cols.map((c) => `<td>${cell(c[1](r))}</td>`).join("")}</tr>`)
      .join("")}</tbody>
  </table>`;
}

const [analytics, plan, sheets, people, outbox, recon, postings, catalog] = await Promise.all([
  get(`/api/hrm/analytics?projectId=${P}&from=2026-01&to=2026-06`, "u-pm"),
  get(`/api/hrm/manpower-plan?projectId=${P}`, "u-planner"),
  get(`/api/hrm/timesheets?projectId=${P}`, "u-site"),
  get(`/api/hrm/people?projectId=${P}`, "u-hr"),
  get(`/api/events/outbox?projectId=${P}`),
  get(`/api/events/reconcile?projectId=${P}`),
  get(`/api/hrm/cost/postings?projectId=${P}`, "u-pm"),
  get(`/api/hrm/reports?projectId=${P}`, "u-pm"),
]);

if (!analytics) {
  console.error(`⛔ سرور API روی ${API} پاسخ نداد.`);
  console.error("   ابتدا: PORT=4000 PERSIST_DRIVER=json DATA_DIR=./server/rundata node server/index.js");
  process.exit(1);
}

const t = analytics.histogram.totals;
const kpiCards = analytics.kpis
  .map(
    (k) => `<div class="kpi ${k.status}">
      <div class="kpi-v">${k.value === null ? "—" : esc(k.value)}</div>
      <div class="kpi-l">${esc(k.nameFa)}</div>
      ${k.caveatFa ? `<div class="kpi-c">${esc(k.caveatFa)}</div>` : ""}
    </div>`
  )
  .join("");

const html = `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<title>عکس خروجی زندهٔ HRM</title>
<link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@200;300;400;600&display=swap" rel="stylesheet">
<style>
  :root { color-scheme: dark; }
  body { font-family: Vazirmatn, system-ui, sans-serif; background:#0b0d10; color:#dfe3e8;
         margin:0; padding:28px; font-weight:300; font-size:13px; line-height:1.9; }
  h1 { font-size:19px; font-weight:600; margin:0 0 4px; }
  h2 { font-size:14px; font-weight:600; margin:30px 0 10px; padding-bottom:6px;
       border-bottom:1px solid #1e242c; }
  .sub { color:#7d8794; font-size:11px; margin-bottom:22px; }
  .row { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:14px; }
  .kpi { background:#12161b; border:1px solid #1e242c; border-radius:10px;
         padding:10px 14px; min-width:132px; }
  .kpi-v { font-size:19px; font-weight:600; }
  .kpi-l { font-size:10px; color:#8b95a2; }
  .kpi-c { font-size:9px; color:#c9a227; margin-top:3px; }
  .kpi.green .kpi-v { color:#4ade80; }
  .kpi.amber .kpi-v { color:#fbbf24; }
  .kpi.red   .kpi-v { color:#f87171; }
  .kpi.na    .kpi-v { color:#6b7280; }
  table { width:100%; border-collapse:collapse; font-size:11px; margin-bottom:8px; }
  th { text-align:right; color:#8b95a2; font-weight:400; font-size:10px;
       border-bottom:1px solid #1e242c; padding:6px 8px; }
  td { padding:5px 8px; border-bottom:1px solid #14181d; }
  tr:hover td { background:#12161b; }
  .empty { color:#6b7280; font-size:11px; }
  .note { background:#12161b; border-right:2px solid #3b82f6; padding:8px 12px;
          border-radius:0 8px 8px 0; font-size:11px; color:#9aa5b1; margin:10px 0; }
  .ok   { color:#4ade80; } .warn { color:#fbbf24; } .bad { color:#f87171; }
  code { background:#12161b; padding:1px 5px; border-radius:4px; font-size:10px; }
</style>
</head>
<body>

<h1>پلتفرم مدیریت پروژه — عکس خروجی زندهٔ ماژول منابع انسانی</h1>
<div class="sub">
  ساخته‌شده در ${esc(new Date().toISOString().slice(0, 16).replace("T", " "))} از API واقعی ·
  پروژه <code>${esc(P)}</code> · بازه ${esc(analytics.fromCode)} تا ${esc(analytics.toCode)}
</div>

<div class="note">${esc(analytics.headlineFa)}</div>

<h2>شش شاخص کلیدی نیرو (D8)</h2>
<div class="row">${kpiCards}</div>

<h2>هیستوگرام برنامه در برابر واقعی (D8)</h2>
${table(
  [
    ["دوره", (r) => r.periodCode],
    ["برنامه", (r) => r.plannedMh],
    ["مستقیم", (r) => r.directMh],
    ["پیمانکاری", (r) => r.subMh],
    ["واقعی", (r) => r.actualMh],
    ["انحراف٪", (r) => (r.variancePct === null ? null : `${r.variancePct}٪`)],
    ["وضعیت", (r) => r.status],
  ],
  analytics.histogram.bars
)}
<div class="note">
  جمع: برنامه <b>${esc(t.plannedMh)}</b> · واقعی <b>${esc(t.actualMh)}</b> ·
  انحراف <b class="${Math.abs(Number(t.variancePct)) > 10 ? "bad" : "ok"}">${cell(t.variancePct)}٪</b>
  — دورهٔ بدون برنامهٔ مبنا «—» می‌گیرد نه صفر.
</div>

<h2>برنامهٔ مبنای نیرو (D8)</h2>
<div class="note">${esc(plan?.rows?.length ?? 0)} ردیف · جمع ${esc(plan?.totalPlannedMh ?? 0)} نفر-ساعت</div>
${table(
  [
    ["دوره", (r) => r.PeriodCode],
    ["رسته", (r) => r.TradeCode],
    ["بازنگری", (r) => r.Revision],
    ["نفرات", (r) => r.PlannedHeadcount],
    ["نفر-ساعت", (r) => r.PlannedMh],
  ],
  (plan?.rows ?? []).slice(0, 20)
)}

<h2>برگه‌های کارکرد (D4)</h2>
${table(
  [
    ["شناسه", (r) => r.Id],
    ["تاریخ", (r) => r.WorkDate],
    ["اکیپ", (r) => r.CrewId],
    ["وضعیت", (r) => r.Status],
    ["ساعت خام", (r) => r.TotalHoursRaw],
    ["اضافه‌کاری", (r) => r.TotalHoursOt],
  ],
  (sheets?.items ?? []).slice(0, 15)
)}

<h2>پروندهٔ پرسنلی و انطباق (D7)</h2>
<div class="note">
  کل ${esc(people?.headcount ?? 0)} · فعال ${esc(people?.activeCount ?? 0)} ·
  منطبق ${esc(people?.compliantCount ?? 0)} · مسدود ${esc(people?.blockedActiveCount ?? 0)}
</div>
${table(
  [
    ["شمارهٔ پرسنلی", (r) => r.PersonnelNo],
    ["نام", (r) => r.FullNameFa],
    ["رسته", (r) => r.PrimaryTradeCode],
    ["وضعیت", (r) => r.Status],
  ],
  (people?.rows ?? []).slice(0, 15)
)}

<h2>ارسال هزینه به دفتر مالی (D12)</h2>
<div class="note">
  ${esc(postings?.count ?? 0)} سطر · مبلغ ${esc(postings?.totalAmount ?? 0)} ·
  ${esc(postings?.totalHours ?? 0)} نفر-ساعت معادل · بدون نرخ ${esc(postings?.unpricedHours ?? 0)}
</div>
${table(
  [
    ["دوره", (r) => r.PeriodCode],
    ["حساب هزینه", (r) => r.CostAccountId],
    ["مبلغ", (r) => r.Amount],
    ["ساعت معادل", (r) => r.EquivalentHours],
    ["کلید رویداد", (r) => r.EventKey],
  ],
  postings?.items ?? []
)}

<h2>صندوق رویداد و تحویل به سامانهٔ بیرونی (D13)</h2>
<div class="note">
  ${esc(outbox?.count ?? 0)} رویداد · سلامت
  <b class="${outbox?.health?.flag === "green" ? "ok" : outbox?.health?.flag === "amber" ? "warn" : "bad"}">${esc(outbox?.health?.flag)}</b>
  · در صف ${esc(outbox?.health?.pending ?? 0)} · تحویل‌شده ${esc(outbox?.health?.delivered ?? 0)}
  ${outbox?.health?.noteFa ? ` — ${esc(outbox.health.noteFa)}` : ""}
</div>
${table(
  [
    ["نوع", (r) => r.EventType],
    ["مقصد", (r) => r.TargetModule],
    ["موجودیت", (r) => r.EntityId],
    ["وضعیت", (r) => r.Status],
    ["تلاش", (r) => r.AttemptCount],
  ],
  outbox?.items ?? []
)}

<h2>آشتی دفتر داخلی با صندوق رویداد (D13)</h2>
<div class="note ${recon?.isClean ? "ok" : "warn"}">${esc(recon?.messageFa ?? "")}</div>
${table(
  [
    ["دوره", (r) => r.periodCode],
    ["حساب", (r) => r.costAccountId],
    ["دفتر", (r) => r.postedAmount],
    ["رویداد", (r) => r.eventAmount],
    ["وضعیت", (r) => r.status],
    ["شرح", (r) => r.noteFa],
  ],
  recon?.rows ?? []
)}

<h2>کاتالوگ گزارش رسمی (D11)</h2>
${table(
  [
    ["کد", (r) => r.code],
    ["عنوان", (r) => r.title?.fa],
    ["دوره‌ای", (r) => r.periodicity],
    ["مخاطب", (r) => (r.audiences ?? []).join("، ")],
  ],
  catalog?.items ?? []
)}

<div class="note" style="margin-top:26px">
  این فایل عکسی از خروجی <b>واقعی</b> API است، نه نمونهٔ ساختگی. همان اعدادی
  که رابط کاربری نشان می‌دهد — از همان مسیرها، با همان مجوزها.
</div>

</body></html>`;

await writeFile("dist/hrm-snapshot.html", html, "utf8");
console.log("✅ dist/hrm-snapshot.html ساخته شد");
console.log(`   ${analytics.histogram.bars.length} دوره · ${plan?.rows?.length ?? 0} ردیف مبنا · ${sheets?.items?.length ?? 0} برگه · ${outbox?.count ?? 0} رویداد`);
