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

/* ═══════════ تولید عملیات‌محور (mfg-api-v1) ═══════════
 *
 * کارخانه `PLANT-DEMO` را از هیچ می‌سازد: دادهٔ پایه، سفارش آزادشده، برنامهٔ
 * ظرفیت‌محدود، اجرای کارگاهی، MRP و هزینه. همهٔ گام‌ها از مسیرهای REST واقعی
 * همان قرارداد `docs/manufacturing-api.md` می‌گذرند؛ هیچ رکوردی مستقیم در
 * فایل نوشته نمی‌شود تا همان اعتبارسنجی و همان UoW مسیر واقعی اجرا شود.
 */

const PLANT = process.env.PLANT_ID || "PLANT-DEMO";
const MFG_ROLES = {
  eng: "u-mfg-eng",
  plan: "u-mfg-plan",
  manager: "u-mfg-manager",
  supervisor: "u-mfg-supervisor",
  material: "u-mfg-material",
  cost: "u-mfg-cost",
};

/** فراخوانی مسیر MFG با هویت، Idempotency-Key و If-Match. */
async function mfg(path, { user = MFG_ROLES.eng, method = "GET", body, match, idem } = {}) {
  const headers = { "content-type": "application/json", "x-user-id": user };
  if (match !== undefined) headers["if-match"] = String(match);
  if (idem) headers["idempotency-key"] = idem;
  const res = await fetch(`${BASE}/api/mfg/plants/${PLANT}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* غیر JSON */ }
  if (res.status >= 400) {
    const err = new Error(`${res.status} ${json?.error?.code || ""} ${json?.error?.message || text.slice(0, 160)}`);
    err.status = res.status;
    err.payload = json;
    throw err;
  }
  return json?.data ?? null;
}

/** گام MFG که تکرار/وجود قبلی را خطا نمی‌شمارد. */
async function mfgStep(label, fn) {
  try {
    const value = await fn();
    if (value === "skip") { skip++; console.log(`  ⏭  ${label}`); return null; }
    ok++; console.log(`  ✅ ${label}`);
    return value;
  } catch (err) {
    if ([409, 422].includes(err.status)) {
      skip++; console.log(`  ⏭  ${label} — ${err.message.slice(0, 120)}`);
      return null;
    }
    fail++; console.log(`  ⛔ ${label} — ${err.message.slice(0, 200)}`);
    return null;
  }
}

const isoAt = (dayOffset, minuteOfDay = 480) => {
  const start = new Date(Date.now() + dayOffset * 86_400_000);
  start.setUTCHours(0, 0, 0, 0);
  /* تقویم مرکز کاری «Asia/Tehran» است؛ 08:00 محلی = 04:30 UTC. */
  return new Date(start.getTime() + (minuteOfDay - 210) * 60_000).toISOString();
};

async function seedMfgWorkCenters() {
  console.log("\n── تولید: مراکز کاری، منابع و تقویم ──");
  /* هر مرکز کاری نرخ‌های هزینهٔ خودش را می‌آورد؛ تنها جای نگه‌داری نرخ،
   * MfgCostCenter است و بدون این بلوک رول‌آپ ماشین/دستمزد/سربار صفر می‌ماند. */
  const centers = [
    ["WC-CNC", "مرکز ماشین‌کاری CNC", "machine", 960, 92, "machine", [
      { CostElement: "machine", HourlyRate: 1_250_000, AllocationBasis: "machine_hours" },
      { CostElement: "labor", HourlyRate: 680_000, AllocationBasis: "labor_hours" },
      { CostElement: "overhead", HourlyRate: 480_000, AllocationBasis: "machine_hours" },
    ]],
    ["WC-ASM", "ایستگاه مونتاژ", "assembly", 960, 95, "labor", [
      { CostElement: "labor", HourlyRate: 900_000, AllocationBasis: "labor_hours" },
      { CostElement: "overhead", HourlyRate: 350_000, AllocationBasis: "machine_hours" },
    ]],
    ["WC-QC", "ایستگاه بازرسی کیفی", "inspection", 720, 100, "labor", [
      { CostElement: "labor", HourlyRate: 750_000, AllocationBasis: "labor_hours" },
    ]],
  ];
  const created = {};
  for (const [code, nameFa, kind, capacity, efficiency, resourceKind, rates] of centers) {
    const center = await mfgStep(`مرکز کاری ${code}`, async () => {
      try {
        return await mfg("/work-centers", {
          user: MFG_ROLES.eng,
          method: "POST",
          body: {
            Code: code,
            NameFa: nameFa,
            Kind: kind,
            NominalCapacityMinutesPerDay: capacity,
            EfficiencyPct: efficiency,
            TimeZoneId: "Asia/Tehran",
            Status: "active",
            DescriptionFa: "دادهٔ نمونهٔ کارخانهٔ نمایشی",
            Rates: rates,
          },
        });
      } catch (err) {
        if (err.status !== 409) throw err;
        const list = await mfg(`/work-centers?q=${encodeURIComponent(code)}`, { user: MFG_ROLES.eng });
        return (list?.items ?? []).find((row) => row.Code === code) ?? "skip";
      }
    });
    if (!center) continue;
    created[code] = center;

    await mfgStep(`منبع ${code}`, () => mfg(`/work-centers/${center.Id}/resources`, {
      user: MFG_ROLES.eng,
      method: "POST",
      body: {
        ResourceCode: `R-${code}`,
        NameFa: `${nameFa} — منبع ۱`,
        ResourceKind: resourceKind,
        CapacityUnits: 1,
        AvailabilityPct: kind === "inspection" ? 100 : 92,
        IsActive: true,
        EffectiveFrom: "2026-01-01",
      },
    }));

    /* هفتهٔ کاری ایرانی: شنبه(۶) تا چهارشنبه(۳) به‌علاوهٔ پنجشنبه(۴)؛ جمعه(۵) تعطیل. */
    for (const weekday of [6, 7, 1, 2, 3, 4]) {
      await mfgStep(`تقویم ${code} روز ${weekday}`, () => mfg(`/work-centers/${center.Id}/calendars`, {
        user: MFG_ROLES.eng,
        method: "POST",
        body: {
          RuleType: "weekly",
          RuleKey: `${code}-W${weekday}`,
          WeekdayIso: weekday,
          ShiftCode: "S1",
          StartMinuteOfDay: 480,
          EndMinuteOfDay: 1020,
          BreakMinutes: 45,
          BreakStartMinuteOfDay: 720,
          IsWorking: true,
          AvailabilityPct: 100,
          EffectiveFrom: "2026-01-01",
        },
      }));
    }
  }
  return created;
}

async function seedMfgParts() {
  console.log("\n── تولید: قطعات، مواد و BOM ──");
  const parts = [
    {
      key: "FG", PartNo: "FG-GEARBOX-01", NameFa: "گیربکس صنعتی ۵۰ کیلونیوتن", PartType: "manufactured", BaseUom: "ea",
      StandardUnitCost: 48_000_000,
      Planning: { SafetyStockQty: 2, LotSize: 5, OrderMultiple: 1, DefaultWarehouseCode: "WH-FG" },
    },
    {
      key: "SA", PartNo: "SA-HOUSING-01", NameFa: "پوستهٔ ماشین‌کاری‌شدهٔ گیربکس", PartType: "manufactured", BaseUom: "ea",
      StandardUnitCost: 19_500_000,
      Planning: { LotSize: 10, OrderMultiple: 5, DefaultWarehouseCode: "WH-WIP", OpeningInventory: { WarehouseCode: "WH-WIP", LocationCode: "WIP-01", OnHandQty: 60 } },
    },
    {
      key: "PLATE", PartNo: "RM-ST37-PLATE", NameFa: "ورق فولادی ST37 — ۲۰ میلی‌متر", PartType: "purchased", BaseUom: "kg",
      StandardUnitCost: 9_500,
      Planning: {
        ProcurementType: "buy", LeadTimeDays: 12, SafetyStockQty: 60, LotSize: 500, OrderMultiple: 50,
        DefaultWarehouseCode: "WH-RAW",
        OpeningInventory: { WarehouseCode: "WH-RAW", LocationCode: "A-01", LotNo: "LOT-ST37-01", OnHandQty: 600 },
      },
    },
    {
      key: "BEARING", PartNo: "RM-BEARING-6208", NameFa: "بلبرینگ ۶۲۰۸", PartType: "purchased", BaseUom: "ea",
      StandardUnitCost: 2_400_000,
      Planning: {
        ProcurementType: "buy", LeadTimeDays: 45, SafetyStockQty: 40, LotSize: 100, OrderMultiple: 10,
        DefaultWarehouseCode: "WH-RAW",
        OpeningInventory: { WarehouseCode: "WH-RAW", LocationCode: "B-04", OnHandQty: 200 },
      },
    },
    {
      key: "BOLT", PartNo: "RM-BOLT-M12", NameFa: "پیچ M12 گالوانیزه", PartType: "purchased", BaseUom: "ea",
      StandardUnitCost: 18_000,
      Planning: {
        ProcurementType: "buy", LeadTimeDays: 7, LotSize: 1000, OrderMultiple: 100,
        DefaultWarehouseCode: "WH-RAW",
        OpeningInventory: { WarehouseCode: "WH-RAW", LocationCode: "C-02", OnHandQty: 900 },
      },
    },
    {
      key: "SEAL", PartNo: "RM-SEAL-NBR", NameFa: "کاسه‌نمد NBR", PartType: "purchased", BaseUom: "ea",
      StandardUnitCost: 640_000,
      Planning: {
        ProcurementType: "buy", LeadTimeDays: 21, LotSize: 50, OrderMultiple: 10,
        DefaultWarehouseCode: "WH-RAW",
        OpeningInventory: { WarehouseCode: "WH-RAW", LocationCode: "B-09", OnHandQty: 60 },
      },
    },
  ];

  const byKey = {};
  for (const part of parts) {
    const { key, ...body } = part;
    const created = await mfgStep(`قطعه ${body.PartNo}`, async () => {
      try {
        return await mfg("/parts", { user: MFG_ROLES.eng, method: "POST", body });
      } catch (err) {
        if (err.status !== 409) throw err;
        const list = await mfg(`/parts?q=${encodeURIComponent(body.PartNo)}`, { user: MFG_ROLES.eng });
        return (list?.items ?? []).find((row) => row.PartNo === body.PartNo) ?? null;
      }
    });
    if (created) byKey[key] = created;
  }
  return byKey;
}

async function seedMfgBomAndRouting(parts) {
  console.log("\n── تولید: BOM و مسیر ساخت ──");
  if (!parts.SA || !parts.FG) return {};

  const buildBom = async (label, part, lines) => {
    const header = await mfgStep(label, async () => {
      try {
        const created = await mfg("/bom-headers", {
          user: MFG_ROLES.eng,
          method: "POST",
          body: {
            PartId: part.Id,
            Revision: "A",
            BaseQuantity: 1,
            BaseUom: part.BaseUom,
            EffectiveFrom: "2026-01-01",
            IsDefault: true,
            NoteFa: "نسخهٔ نمونهٔ کارخانهٔ نمایشی",
          },
        });
        for (const [lineNo, component, quantityPer, uom] of lines) {
          await mfg(`/bom-headers/${created.Id}/items`, {
            user: MFG_ROLES.eng,
            method: "POST",
            body: { LineNo: lineNo, ComponentPartId: component.Id, QuantityPer: quantityPer, Uom: uom, ScrapPct: 2, IssueMethod: "backflush" },
          });
        }
        return created;
      } catch (err) {
        if (err.status !== 409) throw err;
        const list = await mfg(`/bom-headers?partId=${encodeURIComponent(part.Id)}`, { user: MFG_ROLES.eng });
        return (list?.items ?? [])[0] ?? "skip";
      }
    });
    if (!header) return null;
    if (header.Status && header.Status !== "draft") {
      console.log(`  ⏭  ${label} — آزادسازی (قبلاً ${header.Status})`);
      skip++;
      return header;
    }
    const released = await mfgStep(`${label} — آزادسازی`, () => mfg(`/bom-headers/${header.Id}/release`, {
      user: MFG_ROLES.eng,
      method: "POST",
      match: header.RowVersion,
      body: { EffectiveAt: "2026-01-01" },
    }));
    return released ?? header;
  };

  const housingBom = await buildBom("BOM پوستهٔ گیربکس", parts.SA, [
    [10, parts.PLATE, 18, "kg"],
    [20, parts.SEAL, 2, "ea"],
  ]);
  const gearboxBom = await buildBom("BOM گیربکس", parts.FG, [
    [10, parts.SA, 1, "ea"],
    [20, parts.BEARING, 4, "ea"],
    [30, parts.BOLT, 12, "ea"],
  ]);

  const buildRouting = async (label, part, operations) => {
    const routing = await mfgStep(label, async () => {
      try {
        const created = await mfg("/routings", {
          user: MFG_ROLES.eng,
          method: "POST",
          body: {
            PartId: part.Id,
            RoutingCode: `RT-${part.PartNo}`,
            Revision: "A",
            BaseQuantity: 1,
            BaseUom: part.BaseUom,
            EffectiveFrom: "2026-01-01",
            IsDefault: true,
          },
        });
        for (const operation of operations) {
          await mfg(`/routings/${created.Id}/operations`, { user: MFG_ROLES.eng, method: "POST", body: operation });
        }
        return created;
      } catch (err) {
        if (err.status !== 409) throw err;
        const list = await mfg(`/routings?partId=${encodeURIComponent(part.Id)}`, { user: MFG_ROLES.eng });
        return (list?.items ?? [])[0] ?? "skip";
      }
    });
    if (!routing) return null;
    if (routing.Status && routing.Status !== "draft") {
      console.log(`  ⏭  ${label} — آزادسازی (قبلاً ${routing.Status})`);
      skip++;
      return routing;
    }
    const released = await mfgStep(`${label} — آزادسازی`, () => mfg(`/routings/${routing.Id}/release`, {
      user: MFG_ROLES.eng,
      method: "POST",
      match: routing.RowVersion,
      body: { EffectiveAt: "2026-01-01" },
    }));
    return released ?? routing;
  };

  const gearboxRouting = await buildRouting("مسیر ساخت گیربکس", parts.FG, [
    { SequenceNo: 10, OperationCode: "OP-10", OperationNameFa: "ماشین‌کاری پوسته", WorkCenterId: parts.WC_CNC, SetupMinutes: 45, RunMinutesPerUnit: 8, QueueMinutes: 15, MoveMinutes: 10 },
    { SequenceNo: 20, OperationCode: "OP-20", OperationNameFa: "مونتاژ نهایی", WorkCenterId: parts.WC_ASM, SetupMinutes: 20, RunMinutesPerUnit: 14, PredecessorSequence: 10, QueueMinutes: 10 },
    { SequenceNo: 30, OperationCode: "OP-30", OperationNameFa: "بازرسی کیفی نهایی", WorkCenterId: parts.WC_QC, SetupMinutes: 5, RunMinutesPerUnit: 3, PredecessorSequence: 20, InspectionRequired: true },
  ]);

  return { housingBom, gearboxBom, gearboxRouting };
}

async function seedManufacturing(workCenters) {
  console.log("\n── تولید: سفارش، زمان‌بندی، اجرا، MRP و هزینه ──");
  if (!workCenters || !workCenters["WC-CNC"]) {
    console.log("  ⏭  مراکز کاری ساخته نشد؛ بخش تولید رد شد");
    return;
  }
  const parts = await seedMfgParts();
  const graph = await seedMfgBomAndRouting({
    ...parts,
    WC_CNC: workCenters["WC-CNC"].Id,
    WC_ASM: workCenters["WC-ASM"].Id,
    WC_QC: workCenters["WC-QC"].Id,
  });
  if (!graph?.gearboxBom || !graph?.gearboxRouting || !parts.FG) return;

  const createOrder = async (orderNo, quantity, dueDays, dispatchWeight) => {
    const order = await mfgStep(`سفارش ${orderNo}`, async () => {
      try {
        return await mfg("/orders", {
          user: MFG_ROLES.plan,
          method: "POST",
          body: {
            OrderNo: orderNo,
            PartId: parts.FG.Id,
            OrderQuantity: quantity,
            Uom: parts.FG.BaseUom,
            DueAt: isoAt(dueDays, 1020),
            RequestedStartAt: isoAt(1, 480),
            PriorityRule: "EDD",
            DispatchWeight: dispatchWeight,
            DemandSource: "sales-order",
            DemandRef: `SO-${orderNo}`,
            CustomerNameSnapshot: "مشتری نمونهٔ فاز ۱",
            AllowOverrun: false,
            NoteFa: "سفارش نمونهٔ کارخانهٔ نمایشی",
          },
        });
      } catch (err) {
        if (err.status !== 409) throw err;
        const list = await mfg(`/orders?q=${encodeURIComponent(orderNo)}`, { user: MFG_ROLES.plan });
        return (list?.items ?? []).find((row) => row.OrderNo === orderNo) ?? "skip";
      }
    });
    if (!order) return null;

    await mfgStep(`آزادسازی ${orderNo} (Snapshot عملیات)`, () => mfg(`/orders/${order.Id}/release`, {
      user: MFG_ROLES.manager,
      method: "POST",
      match: order.RowVersion,
      body: { BomHeaderId: graph.gearboxBom.Id, RoutingId: graph.gearboxRouting.Id, EffectiveAt: "2026-01-01" },
    }));
    return order;
  };

  const schedule = (label, orderIds) => mfgStep(label, () => mfg("/scheduling/runs", {
    user: MFG_ROLES.plan,
    method: "POST",
    body: {
      Direction: "forward",
      CapacityMode: "finite",
      DispatchRule: "EDD",
      From: isoAt(0, 480),
      To: isoAt(30, 1020),
      OrderIds: orderIds,
    },
  }));

  const orderOperations = async (orderId) => {
    const detail = await mfg(`/orders/${orderId}`, { user: MFG_ROLES.plan });
    return (detail?.Operations ?? detail?.operations ?? []).sort((a, b) => a.SequenceNo - b.SequenceNo);
  };

  /** یک نشست کامل روی یک عملیات: شروع، گزارش تجمعی و اتمام. */
  const runOperation = async (operation, { good, scrap = 0, startedAt, finishedAt }) => {
    const execution = await mfgStep(`شروع اجرای ${operation.OperationCode}`, () => mfg(`/operations/${operation.Id}/executions`, {
      user: MFG_ROLES.supervisor,
      method: "POST",
      idem: `seed-start-${operation.Id}`,
      body: { StartedAt: startedAt },
    }));
    if (!execution) return null;
    const reported = await mfgStep(`گزارش ${operation.OperationCode}`, () => mfg(`/executions/${execution.Id}/reports`, {
      user: MFG_ROLES.supervisor,
      method: "POST",
      match: execution.RowVersion,
      body: {
        InputQuantity: Number(operation.PlannedQuantity),
        GoodQuantity: good,
        ReworkQuantity: 0,
        ScrapQuantity: scrap,
        SetupActualMinutes: Number(operation.PlannedSetupMinutes ?? 0) + 5,
        RunActualMinutes: Math.round(Number(operation.PlannedRunMinutesPerUnit ?? 0) * Number(operation.PlannedQuantity)),
        NoteFa: "گزارش نمونهٔ کارخانهٔ نمایشی",
      },
    }));
    if (!reported) return null;
    await mfgStep(`اتمام ${operation.OperationCode}`, () => mfg(`/executions/${execution.Id}/finish`, {
      user: MFG_ROLES.supervisor,
      method: "POST",
      match: reported.RowVersion,
      idem: `seed-finish-${operation.Id}`,
      body: { FinishedAt: finishedAt, InspectionApproved: operation.InspectionRequired === true },
    }));
    return reported;
  };

  /* ── سفارش ۱: چرخهٔ کامل تا بستن نهایی (همهٔ نیازمندی‌ها تأمین و مصرف می‌شوند) ── */
  const closeable = await createOrder("MO-DEMO-0001", 20, 14, 1.25);
  if (!closeable) return;
  await schedule("زمان‌بندی MO-DEMO-0001", [closeable.Id]);

  const firstOperations = await orderOperations(closeable.Id);
  for (const operation of firstOperations) {
    await runOperation(operation, { good: Number(operation.PlannedQuantity), startedAt: isoAt(1, 480), finishedAt: isoAt(2, 960) });
  }
  if (firstOperations[0]) {
    await mfgStep("ثبت توقف برنامه‌ریزی‌شدهٔ سرویس", () => mfg("/downtime", {
      user: MFG_ROLES.supervisor,
      method: "POST",
      idem: "seed-downtime-planned-1",
      body: {
        WorkCenterId: firstOperations[0].WorkCenterId,
        OperationId: firstOperations[0].Id,
        StartedAt: isoAt(1, 720),
        FinishedAt: isoAt(1, 735),
        DowntimeType: "planned",
        ReasonCode: "PREVENTIVE-MAINTENANCE",
        NoteFa: "توقف برنامه‌ریزی‌شده برای سرویس نمونه",
      },
    }));
  }

  const mrp = await mfgStep("اجرای MRP برای MO-DEMO-0001", () => mfg("/mrp/calculate", {
    user: MFG_ROLES.plan,
    method: "POST",
    body: { OrderIds: [closeable.Id], ThroughDate: isoAt(60, 1020), PreviewOnly: false },
  }));

  const materialRows = await mfg("/materials?limit=200", { user: MFG_ROLES.material });
  const materialById = new Map((materialRows?.items ?? []).map((row) => [row.Id, row]));
  for (const requirement of mrp?.requirements ?? []) {
    const material = materialById.get(requirement.MaterialId);
    await mfgStep(`مصرف مواد — ${material?.PartNo ?? requirement.MaterialId}`, () => mfg("/material-consumptions", {
      user: MFG_ROLES.supervisor,
      method: "POST",
      idem: `seed-consume-${requirement.Id}`,
      body: {
        OperationId: requirement.ProductionOrderOperationId ?? firstOperations[0]?.Id,
        RequirementId: requirement.Id,
        MaterialId: requirement.MaterialId,
        Quantity: Number(requirement.NetQuantity),
        Uom: requirement.Uom ?? material?.BaseUom ?? "ea",
        UnitCost: Number(material?.StandardUnitCost ?? 0),
        Currency: material?.Currency ?? "IRR",
        ConsumptionMethod: "manual",
        WarehouseCode: material?.DefaultWarehouseCode ?? undefined,
      },
    }));
  }

  await mfgStep("مشاهدهٔ هزینهٔ سفارش", () => mfg(`/cost/orders/${closeable.Id}`, { user: MFG_ROLES.cost }));
  const closeableBefore = await mfg(`/orders/${closeable.Id}`, { user: MFG_ROLES.cost });
  await mfgStep("تطبیق نهایی هزینهٔ MO-DEMO-0001", () => mfg(`/cost/orders/${closeable.Id}/reconcile`, {
    user: MFG_ROLES.cost,
    method: "POST",
    match: closeableBefore.RowVersion,
    idem: "seed-reconcile-1",
    body: { CostVersion: 1, ReconcileThrough: isoAt(3, 1020), ContractRevenue: 1_200_000_000 },
  }));
  const closableOrder = await mfg(`/orders/${closeable.Id}`, { user: MFG_ROLES.manager });
  await mfgStep("بستن نهایی MO-DEMO-0001", () => mfg(`/orders/${closeable.Id}/close`, {
    user: MFG_ROLES.manager,
    method: "POST",
    match: closableOrder.RowVersion,
    body: { CloseReason: "تکمیل و تحویل نمونهٔ نمایشی" },
  }));

  /* ── سفارش ۲: کمبود مواد، توقف، ضایعات و دوباره‌کاری باز روی سالن ── */
  const shortageOrder = await createOrder("MO-DEMO-0002", 40, 24, 1);
  if (shortageOrder) {
    await schedule("زمان‌بندی MO-DEMO-0002", [shortageOrder.Id]);
    const secondOperations = await orderOperations(shortageOrder.Id);
    const first = secondOperations[0];
    if (first) {
      await runOperation(first, { good: 39, scrap: 1, startedAt: isoAt(2, 480), finishedAt: isoAt(3, 900) });
      await mfgStep("ثبت توقف ماشین CNC", () => mfg("/downtime", {
        user: MFG_ROLES.supervisor,
        method: "POST",
        idem: "seed-downtime-1",
        body: {
          WorkCenterId: first.WorkCenterId,
          OperationId: first.Id,
          StartedAt: isoAt(2, 660),
          FinishedAt: isoAt(2, 705),
          DowntimeType: "unplanned",
          ReasonCode: "TOOL-CHANGE",
          NoteFa: "تعویض ابزار نمونه",
        },
      }));
      await mfgStep("ثبت ضایعات", () => mfg("/scrap", {
        user: MFG_ROLES.supervisor,
        method: "POST",
        idem: "seed-scrap-1",
        body: {
          OperationId: first.Id,
          Quantity: 1,
          Uom: parts.FG.BaseUom,
          ReasonCode: "DIMENSION",
          Disposition: "scrapped",
          CostAmount: 1_950_000,
          Currency: "IRR",
          NoteFa: "خارج از تلورانس نمونه",
        },
      }));
      if (secondOperations[1]) {
        await mfgStep("ثبت دوباره‌کاری", () => mfg("/rework", {
          user: MFG_ROLES.supervisor,
          method: "POST",
          idem: "seed-rework-1",
          body: {
            SourceOperationId: first.Id,
            TargetOperationId: secondOperations[1].Id,
            Quantity: 1,
            Uom: parts.FG.BaseUom,
            ReasonCode: "DIMENSION",
            Disposition: "return-to-operation",
            NoteFa: "اصلاح روی ایستگاه مونتاژ",
          },
        }));
      }
    }

    const shortageMrp = await mfgStep("اجرای MRP برای MO-DEMO-0002", () => mfg("/mrp/calculate", {
      user: MFG_ROLES.plan,
      method: "POST",
      body: { OrderIds: [shortageOrder.Id], ThroughDate: isoAt(90, 1020), PreviewOnly: false },
    }));
    const shortages = await mfgStep("خواندن کمبودهای مواد", () => mfg(`/mrp/shortages?orderId=${encodeURIComponent(shortageOrder.Id)}`, { user: MFG_ROLES.material }));
    const shortageIds = (shortages?.items ?? [])
      .filter((row) => Number(row.ShortageQuantity) > 0)
      .map((row) => row.Id);
    if (shortageIds.length > 0) {
      await mfgStep(`پیشنهاد تأمین برای ${shortageIds.length} کمبود`, () => mfg("/material-procurement-proposals", {
        user: MFG_ROLES.material,
        method: "POST",
        body: { ThroughDate: isoAt(120, 1020), RequirementIds: shortageIds.slice(0, 50), NoteFa: "پیشنهاد نمونهٔ کارخانهٔ نمایشی" },
      }));
    }
    void shortageMrp;
  }

  /* ── گزارش‌های عملیاتی، داشبورد و هشدار ── */
  const sampleOperation = firstOperations[0];
  if (sampleOperation) {
    await mfgStep("مشاهدهٔ هزینهٔ عملیات", () => mfg(`/cost/operations/${sampleOperation.Id}`, { user: MFG_ROLES.cost }));
    await mfgStep("گزارش انحراف عملیات", () => mfg(`/operations/${sampleOperation.Id}/variance`, { user: MFG_ROLES.supervisor }));
  }

  const window = `?from=${encodeURIComponent(isoAt(-1, 480))}&to=${encodeURIComponent(isoAt(45, 1020))}`;
  await mfgStep("داشبورد خلاصه", () => mfg(`/dashboard/overview${window}`, { user: MFG_ROLES.manager }));
  await mfgStep("بار مراکز کاری", () => mfg(`/dashboard/work-center-load${window}`, { user: MFG_ROLES.manager }));
  await mfgStep("شاخص OEE", () => mfg(`/dashboard/oee${window}`, { user: MFG_ROLES.manager }));
  await mfgStep("بار و گلوگاه ظرفیت", () => mfg(`/capacity/load${window}`, { user: MFG_ROLES.plan }));
  await mfgStep("گلوگاه‌های ظرفیت", () => mfg(`/capacity/bottlenecks${window}`, { user: MFG_ROLES.plan }));
  await mfgStep("Gantt نسخهٔ جاری", () => mfg(`/scheduling/gantt${window}`, { user: MFG_ROLES.plan }));

  const alerts = await mfgStep("فهرست هشدارها", () => mfg("/alerts", { user: MFG_ROLES.manager }));
  const firstAlert = (alerts?.items ?? []).find((row) => row.Status === "open");
  if (firstAlert) {
    await mfgStep("رسیدگی به هشدار", () => mfg(`/alerts/${firstAlert.Id}/acknowledgements`, {
      user: MFG_ROLES.manager,
      method: "POST",
      match: firstAlert.RowVersion,
      body: { NoteFa: "رسیدگی نمونهٔ کارخانهٔ نمایشی" },
    }));
  }

  await seedMfgPlanning(parts, shortageOrder ?? closeable);
}

/**
 * فاز ۵ — برنامه‌ریزی پیشرفته: تقاضا، اندازه‌گذاری لات، MPS، ATP و تقسیم لات.
 * افق برنامه از دوشنبهٔ ۲۰۲۶-۱۰-۰۵ شروع می‌شود تا با پنجرهٔ نمایشی داشبورد
 * و با مقدار پیش‌فرض تب «برنامه‌ریزی» در رابط کاربری هم‌تراز باشد.
 */
async function seedMfgPlanning(parts, splitOrder) {
  console.log("\n── تولید: برنامه‌ریزی پیشرفته (MPS، لات، ATP، تقسیم) ──");
  if (!parts?.FG) {
    console.log("  ⏭  قطعهٔ محصول نهایی نیست؛ بخش برنامه‌ریزی رد شد");
    return;
  }
  const HORIZON_START = "2026-10-05";
  /* MPS افق را با TimeBucket می‌گیرد؛ ارزیابی لات و ATP با BucketUnit.
   * این دو نام عمداً متفاوت‌اند چون در قرارداد REST جدا تعریف شده‌اند. */
  const HORIZON = { TimeBucket: "week", BucketCount: 4, HorizonStart: HORIZON_START };
  const BUCKETS = { BucketUnit: "week", BucketCount: 4, HorizonStart: HORIZON_START };

  /* پیکربندی کارخانه و نوع صنعت. گیربکس یک محصول مونتاژی است، پس «گسسته»
   * انتخاب شده؛ با این نوع، تقسیم دسته و هم‌پوشانی فعال می‌مانند و قابلیت‌های
   * تنظیمیِ غذایی/دارویی/خودرو فعال نمی‌شوند.
   *
   * PATCH اینجا یک upsert است، ولی If-Match روی رکورد موجود اجباری است. پس اول
   * می‌خوانیم: ۴۰۴ یعنی ساخت (بدون If-Match)، وگرنه با RowVersion خوانده‌شده
   * به‌روزرسانی می‌کنیم. بی‌این کار، اجرای دوم seed مقدار ۴۲۸ می‌گرفت و
   * mfgStep آن را به‌جای ⏭ به‌عنوان ⛔ می‌شمرد. */
  await mfgStep("پیکربندی کارخانه و نوع صنعت", async () => {
    const settings = {
      PlantCode: "PLANT-DEMO",
      NameFa: "کارخانهٔ نمایشی مونتاژ گیربکس",
      NameEn: "Demo Gearbox Assembly Plant",
      IndustryType: "discrete",
      IsActive: true,
      NoteFa: "محصول مونتاژی با BOM چندسطحی؛ تقسیم دسته و هم‌پوشانی مجاز است.",
    };
    const current = await mfg("/settings", { user: MFG_ROLES.manager }).catch((err) => (err.status === 404 ? null : Promise.reject(err)));
    return mfg("/settings", {
      user: MFG_ROLES.manager,
      method: "PATCH",
      body: settings,
      match: current?.plant?.rowVersion,
    });
  });

  /* تقاضای ترکیبی: سفارش قطعی، پیش‌بینی (با درصد اطمینان) و قرارداد.
   *
   * FC-DEMO-Q4-00 عمداً در همان سطلِ SO-DEMO-201 (هفتهٔ ۲۰۲۶-۱۰-۰۵) نشسته است تا
   * منطق مصرف پیش‌بینی (۱۱.۲) روی دادهٔ نمایشی فعال شود: شش عدد از پیش‌بینیِ ده‌تایی
   * با سفارش قطعی مصرف می‌شود و تقاضای ناخالص ۱۰ می‌ماند، نه ۱۶. بی‌این ردیف،
   * پیش‌بینی و سفارش قطعی هرگز هم‌سطل نمی‌شدند و ConsumedForecastQty در همهٔ
   * سطل‌ها صفر می‌ماند — یعنی این قاعده در رابط کاربری هرگز دیده نمی‌شد. */
  const demands = [
    { DemandType: "sales-order", DemandRef: "SO-DEMO-201", RequiredAt: "2026-10-06", Quantity: 6 },
    { DemandType: "forecast", DemandRef: "FC-DEMO-Q4-00", RequiredAt: "2026-10-07", Quantity: 10, ConfidencePct: 60 },
    { DemandType: "sales-order", DemandRef: "SO-DEMO-202", RequiredAt: "2026-10-13", Quantity: 8 },
    { DemandType: "forecast", DemandRef: "FC-DEMO-Q4-01", RequiredAt: "2026-10-20", Quantity: 10, ConfidencePct: 70 },
    { DemandType: "contract", DemandRef: "CT-DEMO-01", RequiredAt: "2026-10-27", Quantity: 4 },
  ];
  for (const demand of demands) {
    await mfgStep(`تقاضای ${demand.DemandRef}`, () => mfg("/demand-forecasts", {
      user: MFG_ROLES.plan,
      method: "POST",
      body: { ...demand, PartId: parts.FG.Id },
    }));
  }

  /* EOQ = √(2DS/H) = √(2·1200·4٬500٬000 / 9٬600٬000) ≈ ۳۴ — هم‌اندازهٔ یک لات گیربکس. */
  await mfgStep("سیاست اندازه‌گذاری EOQ گیربکس", () => mfg("/lot-sizing-policies", {
    user: MFG_ROLES.plan,
    method: "POST",
    body: {
      PartId: parts.FG.Id,
      PolicyCode: "LP-FG-EOQ-01",
      RuleCode: "EOQ",
      OrderingCost: 4_500_000,
      HoldingCostPerUnitPerYear: 9_600_000,
      AnnualDemandQty: 1_200,
      PeriodDays: 30,
      EffectiveFrom: HORIZON_START,
      NoteFa: "سیاست نمونهٔ کارخانهٔ نمایشی برای گیربکس صنعتی",
    },
  }));

  await mfgStep("ارزیابی خشک قاعدهٔ لات", () => mfg("/lot-sizing/evaluate", {
    user: MFG_ROLES.plan,
    method: "POST",
    body: { PartId: parts.FG.Id, ...BUCKETS },
  }));

  const mps = await mfgStep("اجرای MPS هفتگی", () => mfg("/mps/runs", {
    user: MFG_ROLES.plan,
    method: "POST",
    body: {
      ...HORIZON,
      PartIds: [parts.FG.Id],
      DemandTimeFenceBuckets: 1,
      /* حصار قطعی سه سطل است تا سفارش برنامه‌ریزی‌شدهٔ سطل سوم (EOQ ۳۴ عددی)
       * درون حصار بیفتد و گام قطعی‌کردن واقعاً چیزی برای قطعی‌کردن داشته باشد. */
      FirmPlannedTimeFenceBuckets: 3,
      IncludeOpenOrdersAsReceipts: true,
      ConsumeForecast: true,
    },
  }));

  if (mps?.run) {
    await mfgStep("قطعی‌کردن سطرهای درون حصار برنامه", () => mfg(`/mps/runs/${mps.run.Id}/firm`, {
      user: MFG_ROLES.plan,
      method: "POST",
      match: mps.run.RowVersion,
      body: {},
    }));
  }

  await mfgStep("بررسی ATP سفارش مشتری", () => mfg("/atp/checks", {
    user: MFG_ROLES.plan,
    method: "POST",
    body: {
      PartId: parts.FG.Id,
      RequestedQty: 6,
      RequestedAt: "2026-10-08",
      CustomerRef: "CUST-DEMO-01",
      Mode: "cumulative",
      ...BUCKETS,
    },
  }));

  if (splitOrder?.Id) {
    const detail = await mfgStep("جزئیات سفارش برای تقسیم لات", () => mfg(`/orders/${splitOrder.Id}`, { user: MFG_ROLES.plan }));
    /* گیت تقسیم فقط عملیات pending/queued/ready را می‌پذیرد؛ OP-10 در گام‌های
     * پیشین اجرا و تمام شده است، پس نخستین عملیاتِ هنوز شروع‌نشده انتخاب می‌شود. */
    const target = (detail?.Operations ?? []).find((op) => ["pending", "queued", "ready"].includes(op.Status));
    if (target) {
      await mfgStep(`تقسیم عملیات ${target.OperationCode} به دو لات هم‌پوشان`, () => mfg(
        `/orders/${splitOrder.Id}/operations/${target.Id}/splits`,
        {
          user: MFG_ROLES.plan,
          method: "POST",
          body: {
            SplitLotCount: 2,
            OverlapAllowed: true,
            OverlapPct: 50,
            NoteFa: "تقسیم برای هم‌پوشانی با عملیات مونتاژ",
          },
        },
      ));
    }
    await mfgStep("تحلیل زمان تحویل با هم‌پوشانی", () => mfg(`/orders/${splitOrder.Id}/lead-time-analysis`, { user: MFG_ROLES.plan }));
  }

  /* ── فاز ۵ بخش ۱۱: نسخهٔ تولید، تأیید MPS، سفارش برنامه‌ریزی‌شده، CRP، انطباق ── */
  console.log("\n── تولید: بخش ۱۱ (نسخهٔ تولید، سفارش برنامه‌ریزی‌شده، CRP، ISA-95) ──");

  const version = await mfgStep("تعریف نسخهٔ تولید برای گیربکس", async () => {
    try {
      return await mfg("/production-versions", {
        user: MFG_ROLES.eng,
        method: "POST",
        idem: "mfg-prod-version-fg-a",
        body: {
          PartId: parts.FG.Id,
          VersionCode: "V1-LINE-A",
          BomRevision: "A",
          RoutingRevision: "A",
          Priority: 1,
          IsDefault: true,
          NoteFa: "نسخهٔ خط مونتاژ A",
        },
      });
    } catch {
      const list = await mfg(`/production-versions?partId=${encodeURIComponent(parts.FG.Id)}`, { user: MFG_ROLES.eng });
      return (list?.items ?? [])[0] ?? null;
    }
  });
  if (version?.Id) {
    await mfgStep("resolve نسخهٔ فعال قطعه", () => mfg(`/parts/${parts.FG.Id}/production-version`, { user: MFG_ROLES.plan }));
  }

  /* تأیید دستی MPS باید پیش از اتکای MRP به آن انجام شود. RowVersion تازه از
   * خود رکورد خوانده می‌شود چون گام قطعی‌کردن آن را بالا برده است. */
  if (mps?.run?.Id) {
    const freshRun = await mfgStep("خواندن اجرای MPS برای تأیید", () => mfg(`/mps/runs/${mps.run.Id}`, { user: MFG_ROLES.manager }));
    if (freshRun?.RowVersion) {
      await mfgStep("تأیید MPS توسط مدیر تولید", () => mfg(`/mps/runs/${mps.run.Id}/approve`, {
        user: MFG_ROLES.manager,
        method: "POST",
        match: freshRun.RowVersion,
        body: { NoteFa: "برنامهٔ اصلی تولید تأیید شد؛ MRP مجاز به اجراست" },
      }));
    }
  }

  /* اجرای MRP حالا سفارش برنامه‌ریزی‌شده، lead-time offset و pegging هم می‌دهد. */
  /* افق MRP باید سررسیدِ خودِ سفارشِ هدف را بپوشاند، وگرنه MRP هیچ نیازمندی
   * نمی‌بیند و صفر سفارش برنامه‌ریزی‌شده می‌سازد — گردش ۱۱.۳ بی‌صدا رد می‌شود.
   * مقدار ثابت قبلی (۲۰۲۶-۱۰-۳۰) یک روز پیش از سررسید MO-DEMO-0002 بود. */
  const mrpThroughAt = splitOrder?.DueAt
    ? new Date(Date.parse(splitOrder.DueAt) + 14 * 86_400_000).toISOString()
    : "2026-12-31T23:59:59.000Z";
  const mrp = await mfgStep("اجرای MRP با ثبت نیازمندی‌ها و پیشنهاد سفارش", () => {
    const target = splitOrder?.Id;
    return mfg("/mrp/calculate", {
      user: MFG_ROLES.material,
      method: "POST",
      ...(target ? { body: { OrderIds: [target], ThroughDate: mrpThroughAt } } : {}),
    });
  });
  if (mrp?.plannedOrders?.length) {
    console.log(`  ✓ ${mrp.plannedOrders.length} سفارش برنامه‌ریزی‌شده پیشنهاد شد`);
  }

  /* گردش کامل ۱۱.۳ روی یک قطعهٔ ساختنی: تأیید سپس تبدیل به سفارش تولید.
   * قطعهٔ خریدنی عمداً انتخاب نمی‌شود — تبدیلش با MFG_PLANNED_ORDER_NOT_MAKE رد می‌شود. */
  const plannedList = await mfgStep("فهرست سفارش‌های برنامه‌ریزی‌شده", () => mfg("/planned-orders?limit=50", { user: MFG_ROLES.plan }));
  const candidate = (plannedList?.items ?? []).find((row) => row.Status === "proposed" && row.PartId === parts.SA?.Id)
    ?? (plannedList?.items ?? []).find((row) => row.Status === "proposed" && [parts.FG?.Id, parts.SA?.Id].includes(row.PartId));
  if (candidate) {
    const approved = await mfgStep(`تأیید سفارش برنامه‌ریزی‌شدهٔ ${candidate.PlannedOrderNo}`, () => mfg(
      `/planned-orders/${candidate.Id}/approve`,
      { user: MFG_ROLES.plan, method: "POST", match: candidate.RowVersion, body: { NoteFa: "مقدار لات تأیید شد" } },
    ));
    if (approved?.RowVersion) {
      await mfgStep(`تبدیل ${candidate.PlannedOrderNo} به سفارش تولید`, () => mfg(
        `/planned-orders/${candidate.Id}/convert`,
        {
          user: MFG_ROLES.plan,
          method: "POST",
          match: approved.RowVersion,
          idem: `mfg-convert-${candidate.PlannedOrderNo}`,
          body: { OrderNo: `MO-FROM-MRP-${candidate.PlannedOrderNo}`, NoteFa: "تبدیل‌شده از پیشنهاد MRP" },
        },
      ));
    }
  } else {
    console.log("  ⏭  سفارش برنامه‌ریزی‌شدهٔ ساختنیِ تأییدپذیری نبود؛ گردش تبدیل رد شد");
  }

  await mfgStep("محاسبهٔ CRP (بار در برابر ظرفیت)", () => mfg("/crp/calculate", {
    user: MFG_ROLES.plan,
    method: "POST",
    body: { Bucket: "week", BucketCount: 4, HorizonStart: HORIZON_START, OverloadPct: 100, UnderloadPct: 60 },
  }));

  await mfgStep("گزارش Lead Time Offset تجمیعی", () => mfg("/mrp/lead-time-offset", { user: MFG_ROLES.plan }));
  await mfgStep("گزارش Pegging چندسطحی", () => mfg("/mrp/pegging?level=multi", { user: MFG_ROLES.plan }));

  await mfgStep("بررسی انطباق ISA-95 / MESA-11", () => mfg("/conformance/isa95", { user: MFG_ROLES.manager }));
}

async function seedMfgAndReport() {
  const workCenters = await seedMfgWorkCenters();
  await seedManufacturing(workCenters);
}

await seedCore();
await seedRates();
await seedPeople();
await seedPlan();
await seedTimesheets();
await seedCost();
await seedMfgAndReport();

console.log(`\n${ok} ساخته شد · ${skip} از قبل بود · ${fail} ناموفق`);
if (fail > 0) {
  console.log("\nناموفق‌ها معمولاً یعنی یک گیت کسب‌وکار فعال است (مثلاً مدرک ناقص).");
  console.log("این خطا نیست — همان رفتاری است که در کاربرد واقعی هم رخ می‌دهد.");
}
console.log(`\nحالا رابط کاربری را باز کنید: http://localhost:5173\n`);
