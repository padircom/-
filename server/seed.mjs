/**
 * سازندهٔ دادهٔ نمونه برای اجرای محلی.
 *
 * `server/data` در `.gitignore` است، پس در نصب تازه خالی است و همهٔ
 * پنل‌ها خالی دیده می‌شوند — بدون آنکه خطایی نشان داده شود. این
 * اسکریپت حداقل دادهٔ لازم برای دیدن هر شش تب HRM را می‌سازد.
 *
 * از **مسیرهای REST واقعی** استفاده می‌کند نه نوشتن مستقیم فایل:
 * دادهٔ ساخته‌شده از همان اعتبارسنجی و همان زنجیرهٔ تأیید عبور می‌کند
 * که کاربر واقعی عبور می‌دهد. دادهٔ نمونه‌ای که از در پشتی وارد شود،
 * حالت‌هایی می‌سازد که در عمل ممکن نیستند.
 *
 * ⚠️ دادهٔ نمونه را در `server/data` **نریزید**. آن مسیر را ۲۹ فایل
 * آزمون REST به‌عنوان نقطهٔ شروع کپی می‌کنند؛ داده‌ای که آنجا بنشیند
 * باعث `UNIQUE_VIOLATION` در آزمون‌ها می‌شود. مسیر پیش‌فرض اجرا
 * `server/rundata` است که در `.gitignore` است و هیچ آزمونی نمی‌خواندش.
 *
 * اجرا (سرور باید بالا باشد):
 *   node server/seed.mjs
 *   API=http://127.0.0.1:4000 node server/seed.mjs
 */
import process from "node:process";

const BASE = process.env.API || "http://127.0.0.1:4000";
const PROJECT = process.env.PROJECT_ID || "p1";

let ok = 0;
let skip = 0;
let fail = 0;

async function call(path, { user = "u-admin", method = "GET", body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json", "x-user-id": user },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* غیر JSON */ }
  return { status: res.status, json, text };
}

/** فراخوانی که شکستش کشنده نیست — ردیف تکراری خطا نیست. */
async function step(label, fn) {
  try {
    const r = await fn();
    if (r === "skip") {
      skip++;
      console.log(`  ⏭  ${label}`);
      return null;
    }
    ok++;
    console.log(`  ✅ ${label}`);
    return r;
  } catch (err) {
    fail++;
    console.log(`  ⛔ ${label} — ${err.message}`);
    return null;
  }
}

/** ردیف جدول عمومی؛ ۴۰۹ یعنی از قبل هست. */
async function row(table, data) {
  const r = await call(`/api/data/${table}`, { method: "POST", body: data });
  if (r.status === 409) return "skip";
  if (r.status >= 400) throw new Error(`${r.status} ${r.text.slice(0, 120)}`);
  return r.json?.data ?? r.json;
}

/* ═══════════ داده‌های پایه ═══════════ */

async function seedCore() {
  console.log("\n── پایه ──");
  /* پروژه بدون صنعت ساخته نمی‌شود (`IndustryId` اجباری است). */
  await step("صنعت نفت و گاز", () => row("Industry", {
    Id: "IND-OG", Code: "OG", TitleFa: "نفت، گاز و پتروشیمی", TitleEn: "Oil & Gas", IsActive: true,
  }));
  await step("پروژه p1", () => row("Project", {
    Id: PROJECT, IndustryId: "IND-OG", Code: "OG-2401",
    NameFa: "واحد فرآورش گاز — فاز ۱",
    Status: "active", StartDate: "2026-01-01", FinishDate: "2027-06-30",
  }));

  for (const [id, title, budget] of [
    ["CBS-CIV", "ابنیه و سازه", 8_000_000_000],
    ["CBS-MEC", "مکانیک و لوله‌کشی", 5_000_000_000],
    ["CBS-ELE", "برق و ابزار دقیق", 3_000_000_000],
  ]) {
    await step(`حساب هزینه ${id}`, () => row("CostAccount", {
      Id: id, ProjectId: PROJECT, Code: id, TitleFa: title,
      Budget: budget, Committed: 0, Actual: 0, Currency: "IRR",
    }));
  }

  for (const [id, name, mh] of [
    ["A-CIV-01", "آرماتوربندی فونداسیون", 2400],
    ["A-CIV-02", "قالب‌بندی و بتن‌ریزی", 1800],
    ["A-MEC-01", "نصب اسپول لوله", 3200],
  ]) {
    await step(`فعالیت ${id}`, () => row("Activity", {
      Id: id, ProjectId: PROJECT, Code: id, NameFa: name,
      BudgetMh: mh, PlannedStart: "2026-01-05", PlannedFinish: "2026-06-30",
      PercentComplete: 0,
    }));
  }
}

/* ═══════════ HRM ═══════════ */

const TRADES = [
  ["CIV-RBR", "آرماتوربند", 120_000],
  ["CIV-FRM", "قالب‌بند", 110_000],
  ["MEC-WLD", "جوشکار", 180_000],
];

async function seedRates() {
  console.log("\n── کارت نرخ (D12) ──");
  for (const [code, , rate] of TRADES) {
    await step(`نرخ ${code}`, async () => {
      const r = await call("/api/hrm/rate-cards", {
        user: "u-hr", method: "POST",
        body: {
          projectId: PROJECT, tradeCode: code, hourlyRate: rate,
          effectiveFrom: "2026-01-01", sourceFa: "مصوبهٔ کارگاه — دادهٔ نمونه",
        },
      });
      /* کلید یکتای کارت نرخ (پروژه، رسته، درجه، تاریخ اثر) — ۴۰۹ یعنی
       * همین نسخه از قبل هست، نه خطا. */
      if (r.status === 409) return "skip";
      if (r.status >= 400) throw new Error(`${r.status} ${r.text.slice(0, 120)}`);
      return r.json.data;
    });
  }
}

async function seedPeople() {
  console.log("\n── پروندهٔ پرسنلی (D7) ──");
  const people = [
    ["PER-001", "رضا محمدی", "CIV-RBR"],
    ["PER-002", "علی کریمی", "CIV-RBR"],
    ["PER-003", "حسن نوری", "CIV-FRM"],
    ["PER-004", "مهدی صادقی", "MEC-WLD"],
    ["PER-005", "سعید رضایی", "MEC-WLD"],
  ];
  for (const [id, name, trade] of people) {
    await step(`نفر ${name}`, async () => {
      const r = await call("/api/hrm/people", {
        user: "u-hr", method: "POST",
        body: {
          projectId: PROJECT, personnelNo: id, fullNameFa: name,
          primaryTradeCode: trade, employmentType: "permanent",
        },
      });
      if (r.status === 409) return "skip";
      if (r.status >= 400) throw new Error(`${r.status} ${r.text.slice(0, 140)}`);
      return r.json.data;
    });
  }
}

async function seedPlan() {
  console.log("\n── برنامهٔ مبنای نیرو (D8) ──");
  await step("مبنای شش ماهه", async () => {
    const lines = [];
    const curve = [8, 14, 22, 26, 20, 12];
    curve.forEach((hc, i) => {
      const period = `2026-0${i + 1}`;
      for (const [code] of TRADES) {
        lines.push({
          periodCode: period, tradeCode: code,
          plannedHeadcount: Math.round(hc / 3),
          plannedMh: Math.round((hc / 3) * 26 * 8),
        });
      }
    });
    const r = await call("/api/hrm/manpower-plan", {
      user: "u-planner", method: "POST", body: { projectId: PROJECT, lines },
    });
    if (r.status >= 400) throw new Error(`${r.status} ${r.text.slice(0, 140)}`);
    return r.json.data;
  });
}

/** برگهٔ کارکرد تا انتهای زنجیرهٔ تأیید. */
async function sheet(crewId, workDate, entries) {
  const c = await call("/api/hrm/timesheets", {
    user: "u-site", method: "POST",
    body: { projectId: PROJECT, crewId, workDate, entries },
  });
  if (c.status === 409) return "skip";
  if (c.status >= 400) throw new Error(`ثبت ${c.status} ${c.text.slice(0, 140)}`);

  const id = c.json.data.id;
  const chain = [
    ["submitted", "u-site", {}],
    ["foreman_approved", "u-hr", { foremanSignatureRef: `sig-${crewId}-${workDate}` }],
    ["qc_verified", "u-qc", {}],
    ["pm_approved", "u-pm", {}],
  ];
  for (const [to, user, extra] of chain) {
    const t = await call(`/api/hrm/timesheets/${id}/transition`, {
      user, method: "POST", body: { projectId: PROJECT, to, ...extra },
    });
    if (t.status >= 400) throw new Error(`گذار ${to}: ${t.status} ${t.text.slice(0, 140)}`);
  }
  return id;
}

async function seedTimesheets() {
  console.log("\n── تایم‌شیت تأییدشده (D4) ──");
  const days = ["2026-01-05", "2026-01-06", "2026-01-07", "2026-02-03", "2026-02-04", "2026-03-02"];

  for (const day of days) {
    await step(`برگهٔ ${day}`, () => sheet(`CR-${day.slice(5).replace("-", "")}`, day, [
      { personId: "PER-001", tradeCode: "CIV-RBR", activityId: "A-CIV-01", cbsId: "CBS-CIV", hoursRaw: 9 },
      { personId: "PER-002", tradeCode: "CIV-RBR", activityId: "A-CIV-01", cbsId: "CBS-CIV", hoursRaw: 8 },
      { personId: "PER-003", tradeCode: "CIV-FRM", activityId: "A-CIV-02", cbsId: "CBS-CIV", hoursRaw: 8 },
      { personId: "PER-004", tradeCode: "MEC-WLD", activityId: "A-MEC-01", cbsId: "CBS-MEC", hoursRaw: 10 },
    ]));
  }
}

async function seedCost() {
  console.log("\n── ارسال هزینه و رویداد (D12 + D13) ──");
  await step("ارسال هزینهٔ 2026-01", async () => {
    const r = await call("/api/hrm/cost/post", {
      user: "u-pmo", method: "POST",
      body: { projectId: PROJECT, periodCode: "2026-01", apply: true },
    });
    if (r.status >= 400) throw new Error(`${r.status} ${r.text.slice(0, 200)}`);
    const d = r.json.data;
    return `مبلغ ${d.totals.amount} · رویداد ${d.eventsEmitted}`;
  });
}

/* ═══════════ اجرا ═══════════ */

console.log(`دادهٔ نمونه → ${BASE} (پروژه ${PROJECT})`);

const ping = await fetch(`${BASE}/api/hrm/meta?projectId=${PROJECT}`, {
  headers: { "x-user-id": "u-site" },
}).catch(() => null);
if (!ping) {
  console.error(`\n⛔ سرور روی ${BASE} پاسخ نمی‌دهد.`);
  console.error("   ابتدا اجرا کنید:");
  console.error("   PORT=4000 PERSIST_DRIVER=json DATA_DIR=./server/rundata node server/index.js\n");
  process.exit(1);
}

await seedCore();
await seedRates();
await seedPeople();
await seedPlan();
await seedTimesheets();
await seedCost();

console.log(`\n${ok} ساخته شد · ${skip} از قبل بود · ${fail} ناموفق`);
if (fail > 0) {
  console.log("\nناموفق‌ها معمولاً یعنی یک گیت کسب‌وکار فعال است (مثلاً مدرک ناقص).");
  console.log("این خطا نیست — همان رفتاری است که در کاربرد واقعی هم رخ می‌دهد.");
}
console.log(`\nحالا رابط کاربری را باز کنید: http://localhost:5173\n`);
