/**
 * دادهٔ نمونهٔ خرید، تدارکات و انبار — SCM/PPMS + SCM/PWMS (d5).
 *
 * همان قاعدهٔ `server/seed.mjs` و `server/seed-cmms.mjs`: هیچ رکوردی از در
 * پشتی نوشته نمی‌شود؛ همه از مسیرهای REST واقعی `/api/scm/:projectId/...`
 * می‌گذرند و همان اعتبارسنجی، همان گیت‌های کسب‌وکار و همان RBAC را می‌بینند.
 *
 * چه چیزی می‌سازد (کل زنجیرهٔ P5 و P6):
 *   MR → فروشنده → AVL → بستهٔ خرید → پیوند MR → استعلام → LBL/SBL → دعوت‌نامه
 *   → لاگ تغییر MR → پیشنهاد و شفاف‌سازی → ارزیابی TBE → Bid Report → KOM
 *   → بازرسی و Release Note → حمل → PSR → انبار → کاتالوگ کالا → MRC
 *   → موجودی → MIV → MRV → انتقال بین انبار → رسید مواد (MRR/OPI)
 *
 * پیش‌نیاز MRR: یک سفارش خرید (`PurchaseOrder`) در میز کار هزینهٔ d5.
 * اگر پروژه خالی باشد، اسکریپت با همان مسیر واقعی یک PR→تصویب→PO می‌سازد؛
 * وگرنه از PO موجود استفاده می‌کند.
 *
 * اجرا (سرور باید بالا باشد):
 *   node server/seed-scm.mjs
 *   API=http://127.0.0.1:4000 PROJECT_ID=c1-p1 node server/seed-scm.mjs
 *
 * شناسهٔ پیش‌فرضِ پروژه `c1-p1` است، نه `p1`: میز کار d5 (`CostSupplyWorkspace`)
 * همین شناسهٔ دامنهٔ RBAC را پروژهٔ جاری می‌گیرد؛ با `p1` داده ساخته می‌شد
 * ولی در همان صفحه دیده نمی‌شد.
 *
 * از `server/seed.mjs` هم فراخوانی می‌شود تا «دادهٔ نمونهٔ کامل» با یک دستور
 * ساخته شود.
 */
import process from "node:process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/** کاربران نمونه‌ای که مجوز هر گام را دارند (ماتریس در accessControl.ts). */
export const SCM_SEED_USERS = Object.freeze({
  procurement: "u-cost",   // cost_controller: fin.procure.edit + scm.*.manage
  manager: "u-pm",         // project_manager: fin.procure.approve + scm.mr.manage
  store: "u-admin",        // admin: scm.mrr.post/view (ثبت رسید/حواله/موجودی)
});

/**
 * اجرای seed خرید و انبار. خروجی `{ ok, fail, skip }`.
 */
export async function seedScm({
  base = process.env.API || "http://127.0.0.1:4000",
  projectId = process.env.PROJECT_ID || "c1-p1",
} = {}) {
  let ok = 0, fail = 0, skip = 0;
  const call = async (p, { user = SCM_SEED_USERS.procurement, method = "GET", body } = {}) => {
    const res = await fetch(`${base}${p}`, {
      method, headers: { "content-type": "application/json", ...(user ? { "x-user-id": user } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json = null; try { json = JSON.parse(text); } catch { /* غیر JSON */ }
    return { status: res.status, json, text };
  };
  /* ردیف تکراری (۴۰۹) شکست نیست: seed باید چندبار قابل اجرا باشد. */
  const step = async (label, p, opts) => {
    const res = await call(p, opts);
    if (res.status < 300) { ok += 1; console.log(`✓ ${label}`); }
    else if (res.status === 409) { skip += 1; console.log(`⏭  ${label} — از قبل بود`); }
    else { fail += 1; console.log(`✗ ${label} [${res.status}]`, (res.text || "").slice(0, 200)); }
    return res.json?.data;
  };

  const R = `/api/scm/${encodeURIComponent(projectId)}`;

  /* ── ۰) پیش‌نیاز: سفارش خرید در میز کار هزینه (LIVE-1) ─────────────── */
  let poNo = null;
  {
    const seeded = await call(`/api/fin/${encodeURIComponent(projectId)}/seed`, { user: SCM_SEED_USERS.procurement, method: "POST", body: {} });
    if (seeded.status < 300) { ok += 1; console.log("✓ fin · دادهٔ نمونهٔ هزینه و تأمین (شامل PO)"); }
    else if (seeded.status === 409) { skip += 1; console.log("⏭  fin · پروژه از قبل داده دارد؛ از PO موجود استفاده می‌شود"); }
    else { fail += 1; console.log(`✗ fin · دادهٔ نمونه [${seeded.status}]`, (seeded.text || "").slice(0, 200)); }

    const ws = await call(`/api/fin/${encodeURIComponent(projectId)}/workspace`, { user: SCM_SEED_USERS.procurement });
    const pos = ws.json?.data?.pos ?? [];
    poNo = pos[0]?.PoNo ?? null;
    const accountCode = ws.json?.data?.accounts?.find((a) => a.Kind === "direct" && a.ParentCode)?.Code
      ?? ws.json?.data?.accounts?.[0]?.Code ?? null;

    /* اگر هیچ PO نیست، همان زنجیرهٔ واقعی PR → تصویب → PO ساخته می‌شود. */
    if (!poNo && accountCode) {
      const pr = await step("fin · درخواست خرید", `/api/fin/${encodeURIComponent(projectId)}/prs`, {
        user: SCM_SEED_USERS.procurement, method: "POST",
        body: { Code: "PR-SCM-001", CostAccountCode: accountCode, TitleFa: "پمپ سانتریفیوژ API 610", Quantity: 2, Unit: "دستگاه", EstimatedAmount: 1_000_000_000, Currency: "IRR", NeedByDate: "2026-11-20" },
      }) ?? await call(`/api/fin/${encodeURIComponent(projectId)}/workspace`, { user: SCM_SEED_USERS.procurement })
        .then((r) => (r.json?.data?.prs ?? []).find((row) => row.Code === "PR-SCM-001"));
      if (pr?.Code) {
        await step("fin · ارسال PR", `/api/fin/${encodeURIComponent(projectId)}/prs/${pr.Code}/submit`, { user: SCM_SEED_USERS.procurement, method: "POST", body: {} });
        await step("fin · تصویب PR (تفکیک وظیفه)", `/api/fin/${encodeURIComponent(projectId)}/prs/${pr.Code}/approve`, { user: SCM_SEED_USERS.manager, method: "POST", body: {} });
        const po = await step("fin · صدور PO", `/api/fin/${encodeURIComponent(projectId)}/pos`, {
          user: SCM_SEED_USERS.procurement, method: "POST",
          body: { PoNo: "PO-SCM-001", PrCode: pr.Code, VendorName: "پمپ‌سازی ایران", Quantity: 2, Unit: "دستگاه", UnitPrice: 500_000_000, Currency: "IRR", PromisedDate: "2026-12-20" },
        });
        poNo = po?.PoNo ?? "PO-SCM-001";
      }
    }
    console.log(`   ↳ PO مبنا برای رسید مواد: ${poNo ?? "—"}`);
  }

  /* ── ۱) زنجیرهٔ خرید: MR تا اعلام برنده ───────────────────────────── */
  await step("MR", `${R}/mrs`, { user: SCM_SEED_USERS.manager, method: "POST", body: { Code: "MR-SCM-001", TitleFa: "پمپ سانتریفیوژ API 610", Discipline: "rotating", Quantity: 2, Unit: "EA", NeedByDate: "2026-11-01" } });
  await step("فروشنده", `${R}/vendors`, { method: "POST", body: { Code: "V-SCM-001", NameFa: "پمپ‌سازی ایران", NameEn: "Iran Pump Co.", Disciplines: ["rotating"], MaterialCategories: ["mechanical"], Status: "active" } });
  await step("AVL", `${R}/avl`, { method: "POST", body: { VendorCode: "V-SCM-001", Discipline: "rotating", MaterialCategory: "mechanical", Status: "approved" } });
  await step("بستهٔ خرید", `${R}/packages`, { method: "POST", body: { Code: "PKG-SCM-001", TitleFa: "بستهٔ خرید پمپ دوار", Discipline: "rotating", Status: "planned" } });
  await step("پیوند MR به بسته", `${R}/packages/PKG-SCM-001/mrs`, { method: "POST", body: { MrCode: "MR-SCM-001" } });
  await step("بستهٔ استعلام", `${R}/inquiries`, { method: "POST", body: { Code: "INQ-SCM-001", PackageCode: "PKG-SCM-001", TitleFa: "استعلام پمپ دوار", InquiryType: "rfq", IssueDate: "2026-10-20", DueDate: "2026-11-10" } });
  await step("فهرست مناقصه‌گران (LBL)", `${R}/inquiries/INQ-SCM-001/bidders`, { method: "POST", body: { VendorCode: "V-SCM-001", ListType: "lbl" } });
  await step("تأیید دریافت (ack)", `${R}/inquiries/INQ-SCM-001/bidders/V-SCM-001/ack`, { method: "POST", body: { AckStatus: "acknowledged" } });
  await step("دعوت‌نامه", `${R}/invitations`, { method: "POST", body: { InvitationNo: "INV-SCM-001", InquiryCode: "INQ-SCM-001", VendorCode: "V-SCM-001", ValidUntil: "2026-11-12" } });
  await step("تأیید دعوت‌نامه", `${R}/invitations/INV-SCM-001/ack`, { method: "POST", body: { AckStatus: "accepted" } });
  const change = await step("لاگ تغییر MR", `${R}/mr-changes`, { method: "POST", body: { MrCode: "MR-SCM-001", ChangeType: "quantity", OldValue: "2", NewValue: "3" } });
  if (change?.Id) await step("اعلان تغییر MR", `${R}/mr-changes/${change.Id}/notify`, { method: "POST", body: {} });
  await step("پیشنهاد فنی/بازرگانی", `${R}/proposals`, { method: "POST", body: { ProposalNo: "PROP-SCM-001", InquiryCode: "INQ-SCM-001", VendorCode: "V-SCM-001", Type: "both", Amount: 1_000_000, Currency: "EUR", ValidUntil: "2027-02-01" } });
  await step("شفاف‌سازی", `${R}/proposals/PROP-SCM-001/clarifications`, { method: "POST", body: { QuestionFa: "شرایط گارانتی و تأمین قطعات یدکی چیست؟", AnswerFa: "۱۸ ماه گارانتی و تأمین قطعات تا ۱۰ سال" } });
  await step("ارزیابی TBE", `${R}/evaluations`, { method: "POST", body: { EvalNo: "EV-SCM-001", ProposalNo: "PROP-SCM-001", Type: "tbe", Score: 85, Result: "pass" } });
  await step("ارزیابی تجاری (TBA)", `${R}/evaluations`, { method: "POST", body: { EvalNo: "EV-SCM-002", ProposalNo: "PROP-SCM-001", Type: "tba", Score: 78, Result: "pass" } });
  await step("Bid Report", `${R}/bid-reports`, { method: "POST", body: { ReportNo: "BR-SCM-001", InquiryCode: "INQ-SCM-001", WinnerVendorCode: "V-SCM-001", TotalAmount: 1_000_000, Currency: "EUR", RecommendationFa: "پیشنهاد برنده بر پایهٔ ارزیابی فنی و تجاری", Status: "issued" } });

  /* ── ۲) پس از PO: KOM، بازرسی، حمل، PSR ──────────────────────────── */
  await step("KOM", `${R}/koms`, { method: "POST", body: { KomNo: "KOM-SCM-001", PoNo: poNo, Type: "kom", MeetingDate: "2026-12-05", LocationFa: "دفتر کارفرما" } });
  await step("بازرسی کارخانه", `${R}/inspections`, { method: "POST", body: { InspectionNo: "INS-SCM-001", PoNo: poNo, Type: "factory", InspectionDate: "2026-12-20", Result: "pass", ReleaseNoteNo: "RN-SCM-001", Inspector: "بازرس شخص ثالث" } });
  await step("حمل", `${R}/shipments`, { method: "POST", body: { ShipmentNo: "SHP-SCM-001", PoNo: poNo, Mode: "sea", OriginFa: "شانگهای", DestinationFa: "بندرعباس", EtaDate: "2027-01-20", CustomsStatus: "pending" } });
  await step("گزارش پیشرفت خرید (PSR)", `${R}/psrs`, { method: "POST", body: { PsrNo: "PSR-SCM-001", PoNo: poNo, PackageCode: "PKG-SCM-001", ProgressPct: 45, ReportDate: "2026-12-31", StatusFa: "در حال ساخت", NextActionFa: "تکمیل تست هیدرواستاتیک" } });

  /* ── ۳) انبار: کاتالوگ، رزرو، موجودی، حواله و عودت، انتقال، رسید ─── */
  await step("انبار", `${R}/warehouses`, { user: SCM_SEED_USERS.store, method: "POST", body: { Code: "WH-SCM-001", NameFa: "انبار مرکزی سایت", LocationFa: "سایت اصلی" } });
  await step("انبار پای‌خط", `${R}/warehouses`, { user: SCM_SEED_USERS.store, method: "POST", body: { Code: "WH-SCM-002", NameFa: "انبار پای‌خط واحد دوار", LocationFa: "نزدیک واحد ۲۰۰" } });
  await step("کاتالوگ کالا", `${R}/catalog`, { user: SCM_SEED_USERS.store, method: "POST", body: { Code: "MAT-SCM-001", NameFa: "پمپ سانتریفیوژ API 610 — سایز 4x6", Category: "mechanical", Unit: "EA", SpecFa: "API 610 / OH2 / Q=120 m³/h" } });
  await step("درخواست رزرو (MRC)", `${R}/mrcs`, { user: SCM_SEED_USERS.manager, method: "POST", body: { MrcNo: "MRC-SCM-001", RequiredDate: "2026-11-05", Lines: [{ MaterialCode: "MAT-SCM-001", Quantity: 2 }] } });
  await step("موجودی — انبار مرکزی", `${R}/stock-balances`, { user: SCM_SEED_USERS.store, method: "POST", body: { WarehouseCode: "WH-SCM-001", MaterialCode: "MAT-SCM-001", OnHand: 10, Reserved: 2, OnOrder: 3 } });
  await step("موجودی — انبار پای‌خط", `${R}/stock-balances`, { user: SCM_SEED_USERS.store, method: "POST", body: { WarehouseCode: "WH-SCM-002", MaterialCode: "MAT-SCM-001", OnHand: 2, Reserved: 0, OnOrder: 0 } });
  await step("سند خروج (MIV)", `${R}/mivs`, { user: SCM_SEED_USERS.store, method: "POST", body: { MivNo: "MIV-SCM-001", MrcNo: "MRC-SCM-001", WarehouseCode: "WH-SCM-001", IssuedAt: "2026-11-10", Lines: [{ MaterialCode: "MAT-SCM-001", Quantity: 2 }] } });
  await step("سند عودت (MRV)", `${R}/mrvs`, { user: SCM_SEED_USERS.store, method: "POST", body: { MrvNo: "MRV-SCM-001", MivNo: "MIV-SCM-001", WarehouseCode: "WH-SCM-001", ReturnedAt: "2026-11-15" } });
  await step("انتقال بین انبار", `${R}/transfers`, { user: SCM_SEED_USERS.store, method: "POST", body: { TransferNo: "TR-SCM-001", FromWarehouse: "WH-SCM-001", ToWarehouse: "WH-SCM-002", MaterialCode: "MAT-SCM-001", Quantity: 1, TransferredAt: "2026-11-18" } });
  if (poNo) {
    await step("رسید مواد (MRR/OPI)", `${R}/mrrs`, { user: SCM_SEED_USERS.store, method: "POST", body: { Code: "MRR-SCM-001", PoNo: poNo, ReceivedAt: "2026-12-01", Quantity: 2, AcceptedQty: 2, RejectedQty: 0, OverQty: 0, ShortageQty: 0, DamageQty: 0, Warehouse: "WH-SCM-001", Status: "accepted" } });
  } else {
    console.log("⏭  رسید مواد — سفارش خریدی برای پیوند نبود");
    skip += 1;
  }

  /* ── ۴) راستی‌آزمایی: همان تجمیعی که میز کار می‌خواند ─────────────── */
  const ws = await call(`${R}/workspace`, { user: SCM_SEED_USERS.store });
  const d = ws.json?.data ?? {};
  console.log("\n— خلاصهٔ پیش‌نمایش —");
  console.log("SCM:", JSON.stringify({
    vendors: d.vendors?.length ?? "—", avls: d.avls?.length ?? "—", packages: d.packages?.length ?? "—",
    inquiries: d.inquiries?.length ?? "—", bidders: d.bidders?.length ?? "—", mrrs: d.mrrs?.length ?? "—",
    warehouses: d.warehouses?.length ?? "—", catalog: d.catalog?.length ?? "—", balances: d.balances?.length ?? "—",
    mivs: d.mivs?.length ?? "—", mrvs: d.mrvs?.length ?? "—", transfers: d.transfers?.length ?? "—",
  }));
  console.log(`گام‌های موفق: ${ok} · از قبل بود: ${skip} · ناموفق: ${fail}`);
  return { ok, fail, skip };
}

/* اجرای مستقیم: `node server/seed-scm.mjs` */
const invokedDirectly = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === pathToFileURL(fileURLToPath(import.meta.url)).href;
if (invokedDirectly) await seedScm();
