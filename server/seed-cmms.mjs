/**
 * دادهٔ نمونهٔ CMMS — از مسیرهای REST واقعی، نه در پشتی.
 *
 * همان الگوی `server/seed.mjs`: دادهٔ نمونه‌ای که از در پشتی نوشته شود،
 * حالت‌هایی می‌سازد که در عمل ممکن نیستند؛ اینجا هر رکورد از همان
 * اعتبارسنجی و همان RBAC عبور می‌کند که کاربر واقعی عبور می‌دهد.
 *
 * چه چیزی می‌سازد:
 *   ۱) سایت ریشهٔ دامنه (`SITE-DEMO`) در صورت نبودن — با مسیر واقعی
 *      `POST /api/cmms/sites` و مجوز `sys.config.manage`
 *   ۲) یک مرکز کاری MES (مقصد رویدادها و رزرو ظرفیت)
 *   ۳) خانوادهٔ تجهیز + فعالیت PM + چک‌لیست + دو پمپ گره‌خورده به مرکز کاری
 *   ۴) دو دستورکار: یکی با توقف و ادامه، دیگری با توقف باز (خرابی)
 *   ۵) پروندهٔ RCFA با زنجیرهٔ ۵ چرا، علل استخوان‌ماهی و CAPA اجرا/تأییدشده
 *   ۶) رزرو نرم ظرفیت برای توقف اساسی
 *
 * پیش از این نسخه، سایت باید دستی در `CmmsSite.json` نوشته می‌شد و سرور
 * دوباره بالا می‌آمد؛ چون مسیر REST برای ساخت سایت وجود نداشت. اکنون
 * همان مسیر با مجوز مدیر سامانه وجود دارد و این اسکریپت خودش سایت را
 * می‌سازد؛ پس اجرای تنها دستور زیر کافی است:
 *
 *   node server/seed-cmms.mjs
 *   API=http://127.0.0.1:4000 node server/seed-cmms.mjs
 *
 * همچنین از `server/seed.mjs` هم فراخوانی می‌شود تا «دادهٔ نمونهٔ کامل» با
 * یک دستور ساخته شود.
 *
 * ⚠️ دادهٔ نمونه را در `server/data` نریزید؛ ۲۹ فایل آزمون REST آن مسیر را
 * نقطهٔ شروع کپی می‌کنند و دادهٔ اضافه به `UNIQUE_VIOLATION` می‌رسد. مسیر
 * پیش‌فرض اجرای محلی `server/rundata*` است که در `.gitignore` می‌نشیند.
 */
import process from "node:process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const CMMS_SEED_SITE = "SITE-DEMO";

/**
 * اجرای seed نت. `base` آدرس API و `site` شناسهٔ سایت است.
 * خروجی: `{ ok, fail }` تا `server/seed.mjs` بتواند جمع بزند.
 */
export async function seedCmms({ base = process.env.API || "http://127.0.0.1:4000", site = CMMS_SEED_SITE } = {}) {
  const ROOT = `/api/cmms/sites/${site}`;
  let ok = 0, fail = 0, skip = 0;
  const call = async (p, { user = "u-cmms-manager", method = "GET", body } = {}) => {
    const res = await fetch(`${base}${p}`, {
      method, headers: { "content-type": "application/json", ...(user ? { "x-user-id": user } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json = null; try { json = JSON.parse(text); } catch { /* غیر JSON */ }
    return { status: res.status, json, text };
  };
  const step = async (label, p, opts) => {
    const res = await call(p, opts);
    const good = res.status < 300;
    if (good) { ok += 1; console.log(`✓ ${label}`); }
    else { fail += 1; console.log(`✗ ${label} [${res.status}]`, (res.text || "").slice(0, 200)); }
    return res.json?.data;
  };
  const stamp = Date.now();
  const iso = (h) => new Date(Date.now() + h * 3600_000).toISOString();

  /* ۰) سایت ریشهٔ دامنه — ۴۰۹ یعنی از قبل هست و شکست نیست. */
  {
    const res = await call("/api/cmms/sites", {
      user: "u-admin", method: "POST",
      body: { SiteId: site, SiteCode: site, NameFa: "مجتمع نمونه", SiteType: "plant", Currency: "IRR", IsActive: true },
    });
    if (res.status === 409) { skip += 1; console.log(`⏭  سایت ${site} از قبل هست`); }
    else if (res.status < 300) { ok += 1; console.log(`✓ سایت · ساخت ${site}`); }
    else { fail += 1; console.log(`✗ سایت · ساخت ${site} [${res.status}]`, (res.text || "").slice(0, 200)); }
  }

  /* ۱) مرکز کاری MES — مقصد رویدادها و رزرو ظرفیت */
  const wc = await step("MES · مرکز کاری", "/api/mfg/plants/PLANT-DEMO/work-centers", {
    user: "u-mfg-eng", method: "POST",
    body: { Code: `WC-ROT-${String(stamp).slice(-4)}`, NameFa: "خط مونتاژ دوار ۱", Kind: "machine", TimeZoneId: "Asia/Tehran", NominalCapacityMinutesPerDay: 480, EfficiencyPct: 95 },
  });

  /* ۲) خانوادهٔ تجهیز + فعالیت PM + چک‌لیست */
  const group = await step("خانواده · گروه", `${ROOT}/family-groups`, { user: "u-cmms-engineer", method: "POST", body: { GroupCode: `GRP-ROT-${stamp}`, NameFa: "تجهیزات دوار", EquipmentClass: "pump" } });
  const family = await step("خانواده · تعریف", `${ROOT}/families`, { user: "u-cmms-engineer", method: "POST", body: { FamilyGroupId: group.Id, FamilyCode: `FAM-PUMP-${stamp}`, NameFa: "پمپ سانتریفیوژ API 610", CriticalityRank: "A" } });
  const task = await step("خانواده · فعالیت PM", `${ROOT}/families/:familyId/pm-tasks`.replace(":familyId", family.Id), {
    user: "u-cmms-engineer", method: "POST",
    body: { TaskCode: "PM-INS-01", NameFa: "بازرسی آب‌بند و ارتعاش", TaskType: "inspection", TradeSkill: "mechanical", IntervalValue: 30, IntervalUnit: "days" },
  });
  for (const [code, desc, type, extra, order] of [
    ["CI-01", "بازدید چشمی نشتی", "passfail", {}, 1],
    ["CI-02", "ارتعاش یاتاقان (mm/s)", "numeric", { MinValue: 0, MaxValue: 4.5 }, 2],
    ["CI-03", "دمای پوستهٔ یاتاقان", "numeric", { MinValue: 0, MaxValue: 75 }, 3],
  ]) {
    await step(`خانواده · قلم ${code}`, `${ROOT}/families/:familyId/pm-tasks/:taskId/checklist-items`.replace(":familyId", family.Id).replace(":taskId", task.Id), {
      user: "u-cmms-engineer", method: "POST", body: { ItemCode: `${code}-${String(stamp).slice(-3)}`, DescriptionFa: desc, InputType: type, IsRequired: true, SortOrder: order, ...extra },
    });
  }

  /* ۳) تجهیزات (گره‌خورده به مرکز کاری MES) */
  const assetA = await step("تجهیز · P-101", `${ROOT}/assets`, { user: "u-cmms-engineer", method: "POST", body: { FamilyId: family.Id, AssetTag: `P-101-${String(stamp).slice(-3)}`, NameFa: "پمپ خوراک برج تقطیر", CriticalityRank: "A", ...(wc ? { MfgWorkCenterId: wc.Id } : {}) } });
  const assetB = await step("تجهیز · P-102", `${ROOT}/assets`, { user: "u-cmms-engineer", method: "POST", body: { FamilyId: family.Id, AssetTag: `P-102-${String(stamp).slice(-3)}`, NameFa: "پمپ رفلاکس", CriticalityRank: "B", ...(wc ? { MfgWorkCenterId: wc.Id } : {}) } });

  /* ۴) دستورکارها: آزادسازی (رزرو ظرفیت) → اجرا → توقف → ادامه → اتمام → بستن */
  const woA = await step("دستورکار · WO-1001", `${ROOT}/work-orders`, {
    user: "u-cmms-planner", method: "POST",
    body: { WorkOrderNo: `WO-1001-${String(stamp).slice(-4)}`, WorkOrderType: "pm", AssetId: assetA.Id, TitleFa: "سرویس دوره‌ای ۳۰ روزه پمپ خوراک", FamilyPmTaskId: task.Id, Priority: 2, PlannedStartAt: iso(24), PlannedFinishAt: iso(28), ProductionImpact: "line-stop" },
  });
  const woB = await step("دستورکار · WO-1002 (خرابی)", `${ROOT}/work-orders`, {
    user: "u-cmms-planner", method: "POST",
    body: { WorkOrderNo: `WO-1002-${String(stamp).slice(-4)}`, WorkOrderType: "cm", AssetId: assetB.Id, TitleFa: "رفع نشتی مکانیکی آب‌بند", Priority: 1, ProductionImpact: "partial" },
  });
  await step("دستورکار · آزادسازی WO-1001 (رزرو ظرفیت MES)", `${ROOT}/work-orders/:id/release`.replace(":id", woA.Id), { user: "u-cmms-manager", method: "POST", body: {} });
  const holdA = await step("دستورکار · توقف WO-1001 (رویداد توقف به MES)", `${ROOT}/work-orders/:id/hold`.replace(":id", woA.Id), {
    user: "u-cmms-manager", method: "POST", body: { HoldReasonCode: "waiting-parts", NoteFa: "آب‌بند یدکی در انبار نیست؛ سفارش خرید باز است." },
  });
  console.log("   ↳ تحویل رویداد:", JSON.stringify(holdA?.integration?.delivered), "status:", holdA?.integration?.status ?? "—");
  await step("دستورکار · ادامهٔ WO-1001", `${ROOT}/work-orders/:id/resume`.replace(":id", woA.Id), { user: "u-cmms-manager", method: "POST", body: { ResumeNoteFa: "آب‌بند از انبار مرکزی تأمین شد" } });
  await step("دستورکار · اجرای WO-1001", `${ROOT}/work-orders/:id/start`.replace(":id", woA.Id), { user: "u-cmms-tech", method: "POST", body: {} });
  await step("دستورکار · آزادسازی + توقف WO-1002 (خرابی، رویداد ناخواسته)", `${ROOT}/work-orders/:id/release`.replace(":id", woB.Id), { user: "u-cmms-manager", method: "POST", body: {} });
  const holdB = await step("دستورکار · توقف WO-1002", `${ROOT}/work-orders/:id/hold`.replace(":id", woB.Id), {
    user: "u-cmms-tech", method: "POST", body: { HoldReasonCode: "machine-breakdown", NoteFa: "یاتاقان داغ کرد و پمپ از سرویس خارج شد." },
  });
  console.log("   ↳ تحویل رویداد:", JSON.stringify(holdB?.integration?.delivered), "externalRef:", holdB?.integration?.externalRef ?? "—");

  /* ۵) RCFA تعاملی + CAPA */
  const rca = await step("RCFA · پرونده", `${ROOT}/rca-cases`, {
    user: "u-cmms-reliability", method: "POST",
    body: { CaseNo: `RCA-${String(stamp).slice(-4)}`, AssetId: assetB.Id, Method: "combined", ProblemStatementFa: "نشتی مکرر آب‌بند پمپ رفلاکس در سه ماه گذشته (۳ رخداد)." },
  });
  const whys = ["آب‌بند مکانیکی فرسوده شده است", "آب‌بند در سرویس دوره‌ای تعویض نشده است", "فعالیت تعویض آب‌بند در برنامهٔ PM تعریف نشده بود"];
  for (let i = 0; i < whys.length; i += 1) {
    await step(`RCFA · چرا سطح ${i + 1}`, `${ROOT}/rca-cases/:id/entries`.replace(":id", rca.Id), {
      user: "u-cmms-reliability", method: "POST",
      body: { EntryType: "why", Sequence: i + 1, StatementFa: whys[i], IsRootCause: i === whys.length - 1, EvidencePath: i === whys.length - 1 ? "doc:PM-PROGRAM-REV7" : null },
    });
  }
  const causes = [
    { Category: "method", StatementFa: "برنامهٔ PM فاقد فعالیت تعویض آب‌بند است", OccurrenceCount: 3, ImpactScore: 9, IsRootCause: true, EvidenceRef: "audit:PM-REV7" },
    { Category: "machine", StatementFa: "لقی محور پمپ", OccurrenceCount: 5, ImpactScore: 4 },
    { Category: "measurement", StatementFa: "پایش ارتعاش یاتاقان با تواتر کافی انجام نمی‌شود", OccurrenceCount: 2, ImpactScore: 6 },
  ];
  for (const cause of causes) {
    await step(`RCFA · علت «${cause.StatementFa.slice(0, 22)}…»`, `${ROOT}/rca-cases/:id/causes`.replace(":id", rca.Id), { user: "u-cmms-reliability", method: "POST", body: cause });
  }
  const capaPrevent = await step("CAPA · پیشگیرانه", `${ROOT}/rca-cases/:id/capas`.replace(":id", rca.Id), {
    user: "u-cmms-reliability", method: "POST",
    body: { ActionType: "preventive", StatementFa: "افزودن فعالیت تعویض آب‌بند به برنامهٔ PM و بازبینی سالانهٔ آن", Priority: 1, OwnerUserId: "u-cmms-tech" },
  });
  const capaCorrect = await step("CAPA · اصلاحی", `${ROOT}/rca-cases/:id/capas`.replace(":id", rca.Id), {
    user: "u-cmms-reliability", method: "POST",
    body: { ActionType: "corrective", StatementFa: "تعویض آب‌بند و بازسازی محور پمپ رفلاکس", Priority: 2, OwnerUserId: "u-cmms-tech" },
  });
  await step("CAPA · اجرای پیشگیرانه", `${ROOT}/rca-cases/:id/capas/:capaId/implement`.replace(":id", rca.Id).replace(":capaId", capaPrevent.Id), {
    user: "u-cmms-reliability", method: "POST", body: { ImplementationEvidenceRef: "PM-REV7-DONE" },
  });
  await step("CAPA · تأیید اثربخشی پیشگیرانه", `${ROOT}/rca-cases/:id/capas/:capaId/verify`.replace(":id", rca.Id).replace(":capaId", capaPrevent.Id), {
    user: "u-cmms-reliability", method: "POST", body: { VerificationResult: "effective", VerificationNoteFa: "دو سرویس بعدی بدون نشتی انجام شد." },
  });
  /* ارجاع پیش از تأیید اثربخشی انجام می‌شود: CAPA تأییدشده قابل ارجاع نیست. */
  const referred = await step("CAPA · تبدیل به دستورکار جدید", `${ROOT}/rca-cases/:id/capas/:capaId/refer`.replace(":id", rca.Id).replace(":capaId", capaCorrect.Id), {
    user: "u-cmms-reliability", method: "POST", body: { ReferralKind: "work-order", WorkOrderType: "cm", Priority: 2 },
  });
  console.log("   ↳ دستورکار ساخته‌شده:", referred?.workOrder?.WorkOrderNo ?? "—");
  await step("CAPA · اجرای اصلاحی", `${ROOT}/rca-cases/:id/capas/:capaId/implement`.replace(":id", rca.Id).replace(":capaId", capaCorrect.Id), {
    user: "u-cmms-reliability", method: "POST", body: { ImplementationEvidenceRef: "WO-1101-CLOSE" },
  });
  await step("CAPA · تأیید اثربخشی اصلاحی", `${ROOT}/rca-cases/:id/capas/:capaId/verify`.replace(":id", rca.Id).replace(":capaId", capaCorrect.Id), {
    user: "u-cmms-reliability", method: "POST", body: { VerificationResult: "effective" },
  });

  /* ۶) بلوکهٔ نرم ظرفیت (توقف اساسی برنامه‌ریزی‌شده) */
  if (wc) {
    const block = await step("ظرفیت · رزرو توقف اساسی", `${ROOT}/capacity-blocks`, {
      user: "u-cmms-planner", method: "POST",
      body: { WorkCenterRef: wc.Id, SourceType: "shutdown", WindowStart: iso(72), WindowEnd: iso(80), ReasonFa: "توقف اساسی سه‌ماهه برای بازسازی خط مونتاژ" },
    });
    console.log("   ↳ رزرو:", block?.block?.BlockNo ?? "—", "دقیقه:", block?.block?.ReservedMinutes ?? "—", "هشدار هم‌پوشانی:", block?.conflict?.conflicts?.length ?? 0);
  }

  /* ۷) راستی‌آزمایی وضعیت نهایی */
  const dash = await call(`${ROOT}/dashboard`, { user: "u-cmms-manager" });
  const events = await call(`${ROOT}/integration/events`, { user: "u-cmms-manager" });
  const blocks = await call(`${ROOT}/capacity-blocks`, { user: "u-cmms-manager" });
  const mesBlocks = await call(`/api/mfg/integration/cmms/capacity-blocks?workCenterId=${wc?.Id}`, { user: "u-mfg-eng" });
  console.log("\n— خلاصهٔ پیش‌نمایش —");
  console.log("CMMS:", JSON.stringify(dash.json?.data?.counts ?? {}));
  console.log("صف رویداد:", JSON.stringify(events.json?.data?.summary ?? {}));
  console.log("بلوکه‌های ظرفیت (CMMS):", JSON.stringify(blocks.json?.data?.summary ?? {}));
  console.log("رزروهای دیده‌شده در MES:", mesBlocks.json?.data?.total ?? "—");
  console.log(`گام‌های موفق: ${ok} · از قبل بود: ${skip} · ناموفق: ${fail}`);
  return { ok, fail, skip };
}

/* اجرای مستقیم: `node server/seed-cmms.mjs` */
const invokedDirectly = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === pathToFileURL(fileURLToPath(import.meta.url)).href;
if (invokedDirectly) await seedCmms();
