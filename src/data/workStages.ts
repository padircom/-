/** نوع‌ها و سازندهٔ مشترک کاتالوگ «مراحل کاری».
 *
 * چرا جداست:
 *
 * کاتالوگ نفتی و کاتالوگ پتروشیمی دو مجموعه دادهٔ متفاوت‌اند ولی یک
 * ساختار دارند: حوزهٔ کاری ← ردیف کاری ← گام‌های وزن‌دار. اگر هر فایل
 * نوع و حلقهٔ ساخت خودش را داشته باشد، دو ساختار به‌مرور از هم واگرا
 * می‌شوند و کامپوننتی که قرار است هر دو را نشان دهد دیگر یکی نیست.
 *
 * دربارهٔ وزن‌ها:
 *
 * وزن‌ها **همان‌طور که در برگهٔ مرجع آمده‌اند** نگه داشته می‌شوند،
 * حتی وقتی جمعشان ۱۰۰ نیست. اصلاح خودکارِ جمع یعنی دست بردن در سند
 * مرجع؛ به‌جای آن، رابط کاربری جمع واقعی را نشان می‌دهد تا خود کاربر
 * تصمیم بگیرد.
 */

export type WorkStep = { name: string; weight: number };
export type WorkJob = { name: string; steps: WorkStep[] };
export type WorkCategory = { name: string; jobs: WorkJob[] };

/**
 * یک ردیف خام برگهٔ مرجع: [حوزهٔ کاری، ردیف کاری، گام‌ها].
 *
 * گام‌ها با `|` جدا می‌شوند و هر گام به شکل `نام:وزن` است. این قالب
 * فشرده عمدی است: رونویسی یک برگهٔ اکسل با ۱۵ گام در یک خط، در بازبینی
 * گیت هم خوانا می‌ماند.
 */
export type WorkStageRow = [category: string, job: string, steps: string];

/**
 * تبدیل ردیف‌های خام به درخت حوزه ← ردیف ← گام.
 *
 * ترتیب حوزه‌ها و ردیف‌ها همان ترتیب ورودی می‌ماند، چون کاربر برگه را
 * به همان ترتیبی می‌شناسد که در اکسل دیده است؛ مرتب‌سازی الفبایی یعنی
 * او باید هر بار دنبال ردیفش بگردد.
 */
export function buildWorkStages(rows: readonly WorkStageRow[]): WorkCategory[] {
  const out: WorkCategory[] = [];
  for (const [categoryName, jobName, rawSteps] of rows) {
    let category = out.find((c) => c.name === categoryName);
    if (!category) {
      category = { name: categoryName, jobs: [] };
      out.push(category);
    }
    category.jobs.push({
      name: jobName,
      steps: rawSteps.split("|").map((entry) => {
        /* از آخر جدا می‌شود چون نام گام خودش می‌تواند «:» داشته باشد. */
        const splitAt = entry.lastIndexOf(":");
        return { name: entry.slice(0, splitAt), weight: Number(entry.slice(splitAt + 1)) };
      }),
    });
  }
  return out;
}
