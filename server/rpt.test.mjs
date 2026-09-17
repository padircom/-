import test from "node:test";
import assert from "node:assert/strict";
import {
  A4,
  PRIMAVERA_COLORS,
  REPORT_CATALOG,
  csvCell,
  documentNumber,
  escapeHtml,
  estimatePages,
  exportFileName,
  formatValue,
  groupThousands,
  letterheadHtml,
  paginate,
  primaveraColor,
  publishGate,
  reportByCode,
  rowsPerPage,
  statusFromFloat,
  statusLabel,
  toCsv,
  toExcelHtml,
  toFaDigits,
  toPrintHtml,
  toWordHtml,
  totalRows,
  usableHeightMm,
  validateLetterhead,
} from "./rptLogic.js";

const party = (n) => ({ name: n, logoText: n.toUpperCase(), role: { fa: "نقش", en: "Role" } });

const officialLh = {
  projectName: "پروژه آزمایشی",
  projectCode: "OG-2401",
  contractNo: "C-1",
  contractor: party("arena"),
  client: party("nioc"),
  consultant: party("pars"),
  docNo: "OG-2401-RPT-M-0007-R01",
  revision: "R01",
  issueDate: "2026-09-08",
  periodLabel: "1405-06",
  classification: "confidential",
  distribution: ["کارفرما", "مشاور"],
  preparedBy: "دفتر فنی",
  approvedBy: "مدیر پروژه",
};

/* ─────────── هندسه A4 ─────────── */

test("A4: ارتفاع مفید برابر کل منهای حاشیه بالا و پایین است", () => {
  assert.equal(usableHeightMm(), A4.heightMm - A4.marginTopMm - A4.marginBottomMm);
  assert.equal(A4.widthMm, 210);
  assert.equal(A4.heightMm, 297);
});

test("rowsPerPage: عدد مثبت منطقی برمی‌گرداند", () => {
  const n = rowsPerPage();
  assert.ok(n > 10 && n < 100, `unexpected ${n}`);
  assert.equal(rowsPerPage(1000), 1); // ردیف غول‌پیکر هم دست‌کم یک ردیف
});

test("paginate: تقسیم دقیق و بدون گم شدن ردیف", () => {
  const rows = Array.from({ length: 25 }, (_, i) => i);
  const pages = paginate(rows, 10);
  assert.equal(pages.length, 3);
  assert.equal(pages[2].length, 5);
  assert.equal(pages.flat().length, 25);
});

test("paginate: آرایه خالی یک صفحه خالی می‌دهد", () => {
  assert.deepEqual(paginate([], 10), [[]]);
});

/* ─────────── رنگ‌بندی پریماورا ─────────── */

test("statusFromFloat: شناوری صفر یا منفی بحرانی است", () => {
  assert.equal(statusFromFloat(0, 40), "critical");
  assert.equal(statusFromFloat(-5, 40), "critical");
});

test("statusFromFloat: شناوری کم نزدیک بحرانی و زیاد در مسیر است", () => {
  assert.equal(statusFromFloat(8, 40), "near_critical");
  assert.equal(statusFromFloat(30, 40), "on_track");
});

test("statusFromFloat: پیشرفت کامل بر شناوری اولویت دارد", () => {
  assert.equal(statusFromFloat(-10, 100), "completed");
});

test("statusFromFloat: کار شروع‌نشده با شناوری زیاد تفکیک می‌شود", () => {
  assert.equal(statusFromFloat(40, 0), "not_started");
});

test("primaveraColor: بحرانی قرمز و تکمیل‌شده آبی است", () => {
  assert.equal(primaveraColor("critical"), "#D0021B");
  assert.equal(primaveraColor("completed"), "#1F6FB2");
  assert.equal(Object.keys(PRIMAVERA_COLORS).length, 6);
});

test("statusLabel: دوزبانه است", () => {
  assert.equal(statusLabel("critical", "fa"), "بحرانی");
  assert.equal(statusLabel("critical", "en"), "Critical");
});

/* ─────────── قالب‌بندی ─────────── */

test("groupThousands: جداکننده هزارگان و علامت منفی", () => {
  assert.equal(groupThousands(1234567), "1,234,567");
  assert.equal(groupThousands(-4200), "-4,200");
  assert.equal(groupThousands(999), "999");
});

test("toFaDigits: ارقام لاتین به فارسی تبدیل می‌شوند", () => {
  assert.equal(toFaDigits("1405-06"), "۱۴۰۵-۰۶");
});

test("formatValue: درصد و عدد در حالت فارسی رقم فارسی می‌دهند", () => {
  assert.equal(formatValue(75.34, "percent", "fa"), "۷۵.۳%");
  assert.equal(formatValue(1200, "number", "en"), "1,200");
});

test("formatValue: مقدار خالی خط تیره می‌شود", () => {
  assert.equal(formatValue(undefined, "number"), "—");
  assert.equal(formatValue("", "text"), "—");
});

test("formatValue: عدد صفر خط تیره نمی‌شود", () => {
  assert.equal(formatValue(0, "number", "en"), "0");
});

/* ─────────── شماره سند ─────────── */

test("documentNumber: قالب استاندارد با صفر پیشوند", () => {
  assert.equal(documentNumber("OG-2401", "RPT-M", 7, 1), "OG-2401-RPT-M-0007-R01");
  assert.equal(documentNumber("P1", "RPT-D", 123, 12), "P1-RPT-D-0123-R12");
});

test("exportFileName: کاراکتر ناامن پاک می‌شود و پسوند درست می‌آید", () => {
  const r = reportByCode("RPT-M");
  const name = exportFileName(r, officialLh, "xls");
  assert.ok(name.endsWith(".xls"));
  assert.ok(!/[\\/:*?"<>|]/.test(name));
});

/* ─────────── اعتبارسنجی سربرگ ─────────── */

test("validateLetterhead: گزارش رسمی کامل هیچ خطایی ندارد", () => {
  assert.equal(validateLetterhead(officialLh, "official").filter((i) => i.severity === "error").length, 0);
});

test("validateLetterhead: نبود هر یک از سه لوگو گزارش رسمی را رد می‌کند", () => {
  const bad = { ...officialLh, consultant: { ...officialLh.consultant, logoText: "" } };
  assert.ok(validateLetterhead(bad, "official").some((i) => i.code === "E-RPT-103"));
});

test("validateLetterhead: گزارش رسمی بدون فهرست توزیع رد می‌شود", () => {
  const bad = { ...officialLh, distribution: [] };
  assert.ok(validateLetterhead(bad, "official").some((i) => i.code === "E-RPT-106"));
});

test("validateLetterhead: گزارش داخلی سختگیری رسمی را ندارد", () => {
  const loose = { ...officialLh, docNo: "", distribution: [], approvedBy: "", consultant: party("") };
  assert.equal(validateLetterhead(loose, "internal").filter((i) => i.severity === "error").length, 0);
});

test("validateLetterhead: طبقه‌بندی داخلی روی نسخه ابلاغی هشدار می‌دهد", () => {
  const odd = { ...officialLh, classification: "internal" };
  assert.ok(validateLetterhead(odd, "official").some((i) => i.code === "W-RPT-301"));
});

/* ─────────── دروازه انتشار ─────────── */

test("publishGate: گزارش داخلی هرگز مسدود نمی‌شود", () => {
  assert.equal(publishGate("internal", { openMajorNcr: 5, timeBarBreach: 9 }).ok, true);
});

test("publishGate: عدم انطباق عمده باز، انتشار رسمی را می‌بندد", () => {
  const g = publishGate("official", { openMajorNcr: 2 });
  assert.equal(g.ok, false);
  assert.equal(g.reasons.length, 1);
});

test("publishGate: سه مسدودکننده هم‌زمان سه دلیل می‌دهد", () => {
  const g = publishGate("official", { openMajorNcr: 1, unapprovedPeriod: true, timeBarBreach: 3 });
  assert.equal(g.reasons.length, 3);
});

test("publishGate: وضعیت پاک اجازه انتشار می‌دهد", () => {
  assert.equal(publishGate("official", {}).ok, true);
});

/* ─────────── سریال‌سازها ─────────── */

test("escapeHtml: کاراکترهای خطرناک فرار داده می‌شوند", () => {
  assert.equal(escapeHtml('<b>"x"&</b>'), "&lt;b&gt;&quot;x&quot;&amp;&lt;/b&gt;");
});

test("csvCell: کاما و نقل‌قول طبق RFC 4180 محصور می‌شوند", () => {
  assert.equal(csvCell("ساده"), "ساده");
  assert.equal(csvCell("a,b"), '"a,b"');
  assert.equal(csvCell('او گفت "بله"'), '"او گفت ""بله"""');
});

test("toCsv: سرستون‌ها و همه ردیف‌های جدول در خروجی هستند", () => {
  const r = reportByCode("RPT-W");
  const csv = toCsv(r, "fa");
  assert.ok(csv.includes("دیسیپلین"));
  assert.ok(csv.includes("عمران"));
  assert.ok(csv.includes("پایپینگ"));
  assert.ok(csv.split("\r\n").length > 5);
});

test("letterheadHtml: هر سه لوگو در سربرگ حاضرند", () => {
  const html = letterheadHtml(officialLh, "official", "fa");
  assert.ok(html.includes("ARENA"));
  assert.ok(html.includes("NIOC"));
  assert.ok(html.includes("PARS"));
});

test("letterheadHtml: نشان نسخه با نوع قالب عوض می‌شود", () => {
  assert.ok(letterheadHtml(officialLh, "official", "fa").includes("ابلاغی"));
  assert.ok(letterheadHtml(officialLh, "internal", "fa").includes("داخلی"));
});

test("toPrintHtml: سند کامل با قواعد چاپ A4 تولید می‌شود", () => {
  const html = toPrintHtml(reportByCode("RPT-M"), officialLh, "official", "fa");
  assert.ok(html.startsWith("<!doctype html>"));
  assert.ok(html.includes("@page"));
  assert.ok(html.includes("210mm"));
  assert.ok(html.includes('dir="rtl"'));
});

test("toPrintHtml: امضا و فهرست توزیع فقط در نسخه رسمی می‌آید", () => {
  const off = toPrintHtml(reportByCode("RPT-M"), officialLh, "official", "fa");
  const int = toPrintHtml(reportByCode("RPT-M"), officialLh, "internal", "fa");
  assert.ok(off.includes("فهرست توزیع"));
  assert.ok(!int.includes("فهرست توزیع"));
});

test("toPrintHtml: ستون وضعیت با رنگ پریماورا رنگ‌آمیزی می‌شود", () => {
  const html = toPrintHtml(reportByCode("RPT-W"), officialLh, "internal", "fa");
  assert.ok(html.includes("#D0021B")); // بحرانی
});

test("toWordHtml: فضای‌نام آفیس افزوده می‌شود تا Word درست باز کند", () => {
  const html = toWordHtml(reportByCode("RPT-D"), officialLh, "internal", "fa");
  assert.ok(html.includes("urn:schemas-microsoft-com:office:word"));
});

test("toExcelHtml: فقط جدول و KPI منتقل می‌شود و فضای‌نام اکسل دارد", () => {
  const html = toExcelHtml(reportByCode("RPT-D"), officialLh, "fa");
  assert.ok(html.includes("urn:schemas-microsoft-com:office:excel"));
  assert.ok(html.includes("<table"));
  assert.ok(!html.includes("@page"));
});

/* ─────────── کاتالوگ ─────────── */

test("کاتالوگ: ۱۴ گزارش با کد یکتا", () => {
  assert.equal(REPORT_CATALOG.length, 14);
  assert.equal(new Set(REPORT_CATALOG.map((r) => r.code)).size, 14);
});

test("کاتالوگ: هر گزارش دست‌کم یک بخش و یک مخاطب دارد", () => {
  for (const r of REPORT_CATALOG) {
    assert.ok(r.sections.length > 0, `${r.code} بدون بخش`);
    assert.ok(r.audiences.length > 0, `${r.code} بدون مخاطب`);
    assert.ok(r.sourceModule, `${r.code} بدون ماژول مبدأ`);
  }
});

test("کاتالوگ: هر ستون جدول در همه ردیف‌ها کلید معتبر دارد", () => {
  for (const r of REPORT_CATALOG) {
    for (const sec of r.sections) {
      if (sec.kind !== "table") continue;
      for (const row of sec.rows) {
        for (const c of sec.columns) {
          assert.ok(c.key in row, `${r.code}/${c.key} در ردیف نیست`);
        }
      }
    }
  }
});

test("کاتالوگ: گزارش فصلی و دروازه‌ای فقط رسمی‌اند", () => {
  assert.deepEqual(reportByCode("RPT-Q").audiences, ["official"]);
  assert.deepEqual(reportByCode("RPT-GATE").audiences, ["official"]);
});

test("totalRows و estimatePages: شمارش و برآورد صفحه سازگارند", () => {
  const r = reportByCode("RPT-W");
  assert.equal(totalRows(r), 5);
  assert.equal(estimatePages(r), 1);
});

test("reportByCode: کد ناشناخته undefined می‌دهد", () => {
  assert.equal(reportByCode("RPT-NOPE"), undefined);
});
