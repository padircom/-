/* ============================================================
   کاتالوگ سامانه‌ها — نام‌گذاری رسمی محصول (Arena PMIS)
   ------------------------------------------------------------
   منبع واحدِ نام و کدِ هر سامانه. هر حوزهٔ سایدبار (dN) دقیقاً به
   یک کد نمایشی نگاشت می‌شود؛ حوزهٔ d5 دو زیرسامانه (CCS و SCM) دارد.

   قواعد:
   ۱) کد نمایشی تا حد امکان همان کد فنی داخلی است (pex, qms, hrm …)
      تا نام، API، فایل منطق و مستندات یک زبان داشته باشند.
   ۲) فقط اصطلاحات عمومی صنعت؛ نام‌های ابداعی محصولات دیگر استفاده نمی‌شود.
   ۳) این فایل عنوان‌های سایدبار را تغییر نمی‌دهد (قانون BASELINE)؛
      کد فقط به‌صورت نشان در سربرگ صفحهٔ حوزه دیده می‌شود.
   ============================================================ */
import type { Bi } from "./framework";

export const PLATFORM_BRAND = {
  code: "Arena PMIS",
  /** عنوان اصلی برنامه (سربرگ، حلقهٔ PMBOK، عنوان مرورگر). */
  name: {
    fa: "سامانهٔ جامع مدیریت و کنترل پروژه آرنا",
    en: "Arena PMIS — Project Management & Control",
  } as Bi,
} as const;

export type SuiteId = "gov" | "eng" | "exe" | "cst" | "rqs" | "plt";

export type Suite = {
  id: SuiteId;
  title: Bi;
  color: string;
};

export const suites: Suite[] = [
  { id: "gov", title: { fa: "راهبری و حاکمیت", en: "Governance & Strategy" }, color: "#7FB2FF" },
  { id: "eng", title: { fa: "مهندسی و اطلاعات", en: "Engineering & Information" }, color: "#8FE3C8" },
  { id: "exe", title: { fa: "برنامه‌ریزی و اجرا", en: "Planning & Execution" }, color: "#FFD48A" },
  { id: "cst", title: { fa: "پیمان، هزینه و تأمین", en: "Contract, Cost & Supply" }, color: "#C9A7FF" },
  { id: "rqs", title: { fa: "ریسک، کیفیت و ایمنی", en: "Risk, Quality & Safety" }, color: "#FF9F9F" },
  { id: "plt", title: { fa: "پلتفرم", en: "Platform" }, color: "#94A3B8" },
];

export type SystemEntry = {
  /** کد نمایشی رسمی، مثل `EDMS`. یکتا در کل کاتالوگ. */
  code: string;
  /** حوزهٔ سایدبار میزبان (`null` یعنی سامانهٔ مستقل از سایدبار، مثل FIN). */
  domainId: string | null;
  suite: SuiteId;
  /** کد فنی داخلی (نام فایل `server/<module>Logic.js` / سرویس). */
  module?: string;
  name: Bi;
  /** معادل‌های رایج در بازار — فقط برای مستندات و جست‌وجو، نه نمایش. */
  marketEquivalents?: string[];
  /** زیرسامانهٔ یک حوزهٔ بزرگ‌تر (مثل CCS/SCM در d5). */
  partOf?: string;
};

export const systems: SystemEntry[] = [
  /* راهبری و حاکمیت */
  { code: "SPM", domainId: "d20", suite: "gov", name: { fa: "راهبرد و عملکرد سازمانی", en: "Strategy & Performance Management" } },
  { code: "PMO", domainId: "d6", suite: "gov", name: { fa: "دفتر مدیریت پروژه و حاکمیت", en: "PMO & Governance" }, marketEquivalents: ["PMOS"] },
  { code: "OEX", domainId: "d19", suite: "gov", name: { fa: "تعالی سازمانی", en: "Organisational Excellence" } },
  { code: "MCS", domainId: "d3", suite: "gov", name: { fa: "پایش و کنترل پروژه", en: "Monitoring & Control System" }, marketEquivalents: ["PMiX"] },
  { code: "GIS", domainId: "d18", suite: "gov", name: { fa: "موقعیت مکانی پروژه‌ها", en: "Project GIS" } },

  /* مهندسی و اطلاعات */
  { code: "EDMS", domainId: "d1", suite: "eng", name: { fa: "اسناد و مدارک", en: "Document Management System" }, marketEquivalents: ["EDMS"] },
  { code: "ENG", domainId: "d12", suite: "eng", module: "eng", name: { fa: "مهندسی و طراحی", en: "Engineering Management" } },
  { code: "CKM", domainId: "d11", suite: "eng", module: "ckm", name: { fa: "ارتباطات، مکاتبات و دانش", en: "Communication & Knowledge Management" }, marketEquivalents: ["PATS"] },

  /* برنامه‌ریزی و اجرا */
  { code: "PEX", domainId: "d2", suite: "exe", module: "pex", name: { fa: "برنامه‌ریزی و اجرا", en: "Planning & Execution" }, marketEquivalents: ["CPMS"] },
  { code: "HRM", domainId: "d10", suite: "exe", module: "hrm", name: { fa: "نیروی انسانی و بهره‌وری", en: "Workforce Management" } },
  { code: "EQM", domainId: "d9", suite: "exe", module: "eqm", name: { fa: "ماشین‌آلات و تجهیزات", en: "Equipment Management" } },
  { code: "CSU", domainId: "d15", suite: "exe", module: "com", name: { fa: "پیش‌راه‌اندازی، راه‌اندازی و تحویل", en: "Completion & Start-Up" }, marketEquivalents: ["PRiMS"] },

  /* پیمان، هزینه و تأمین */
  { code: "CNT", domainId: "d14", suite: "cst", module: "cnt", name: { fa: "پیمان و صورت‌وضعیت", en: "Contract Administration" } },
  { code: "CCS", domainId: "d5", suite: "cst", module: "fin", name: { fa: "کنترل هزینه", en: "Cost Control System" }, marketEquivalents: ["PCCS"] },
  { code: "SCM", domainId: "d5", suite: "cst", partOf: "d5", name: { fa: "زنجیرهٔ تأمین، خرید و انبار", en: "Supply Chain Management" }, marketEquivalents: ["PPMS", "PWMS"] },
  { code: "FIN", domainId: null, suite: "cst", module: "fin", name: { fa: "مالی پروژه", en: "Project Finance" } },

  /* ریسک، کیفیت و ایمنی */
  { code: "RCM", domainId: "d4", suite: "rqs", name: { fa: "ریسک، تغییرات و ادعاها", en: "Risk, Change & Claims" } },
  { code: "QMS", domainId: "d8", suite: "rqs", module: "qms", name: { fa: "کیفیت و بازرسی", en: "Quality Management System" } },
  { code: "HSE", domainId: "d16", suite: "rqs", module: "hse", name: { fa: "ایمنی، بهداشت و محیط‌زیست", en: "HSE Management" } },
  { code: "HSE-F", domainId: "d17", suite: "rqs", module: "hse", partOf: "d16", name: { fa: "ثبت سریع میدانی HSE", en: "HSE Field" } },

  /* پلتفرم */
  { code: "ADM", domainId: "d7", suite: "plt", name: { fa: "مدیریت سامانه و پیکربندی", en: "System Administration" } },
];

/** همهٔ سامانه‌های یک حوزه (d5 دو سامانه دارد، بقیه یکی). */
export function systemsForDomain(domainId: string): SystemEntry[] {
  return systems.filter((s) => s.domainId === domainId);
}

export function systemByCode(code: string): SystemEntry | undefined {
  return systems.find((s) => s.code === code);
}

export function suiteOf(entry: SystemEntry): Suite {
  return suites.find((s) => s.id === entry.suite)!;
}
