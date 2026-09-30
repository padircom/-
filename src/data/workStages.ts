/** نوع‌ها و سازندهٔ مشترک کاتالوگ «مراحل کاری».
 *
 * چرا این فایل جداست:
 *
 * کاتالوگ نفتی و کاتالوگ پتروشیمی دو مجموعه دادهٔ متفاوت‌اند ولی یک
 * ساختار دارند: حوزهٔ کاری ← گروه ← ردیف کاری ← گام‌های وزن‌دار. اگر هر
 * فایل نوع و حلقهٔ ساخت خودش را داشته باشد، دو ساختار به‌مرور واگرا
 * می‌شوند و کامپوننتی که قرار است هر دو را نشان دهد دیگر یکی نیست.
 *
 * دربارهٔ وزن‌ها:
 *
 * وزن‌ها **همان‌طور که در برگهٔ مرجع آمده‌اند** نگه داشته می‌شوند، حتی
 * وقتی جمعشان ۱۰۰ نیست. اصلاح خودکارِ جمع یعنی دست بردن در سند مرجع؛
 * به‌جای آن، رابط کاربری جمع واقعی را نشان می‌دهد تا تصمیم با کاربر
 * باشد.
 */

export type WorkStep = { name: string; weight: number };

/** یک ردیف کاری: نام ردیف، گروهی که زیرش می‌نشیند، و گام‌هایش. */
export type WorkJob = { name: string; group: string; steps: WorkStep[] };

export type WorkCategory = { name: string; jobs: WorkJob[] };

/**
 * یک ردیف خام برگهٔ مرجع، در دو شکل:
 *
 *   سه‌تایی  → [حوزه، ردیف، گام‌ها]
 *   چهارتایی → [حوزه، گروه، ردیف، گام‌ها]
 *
 * شکل چهارتایی برای برگه‌هایی است که ستون گروه‌بندی مستقل دارند
 * (مثل `Mob Type` یا `Building Type`).
 *
 * چرا گروه صریح شد و از رشته استخراج نمی‌شود:
 *
 * پیش‌تر گروه از روی جداکنندهٔ ` / ` داخل نام ردیف حدس زده می‌شد. این
 * روش روی نام‌هایی که خودشان ` / ` دارند می‌شکند — «HAND RAIL / LADDER»
 * یک ردیف واحد است نه گروه «HAND RAIL»، و «Fire Fighting Building /
 * Clinic» یک نوع ساختمان است نه دو تا. حدس زدن روی این نام‌ها کشوی
 * «جاب‌فاز» را با گروه‌های جعلی پر می‌کرد.
 *
 * شکل سه‌تایی برای سازگاری با کاتالوگ نفتی می‌ماند و همان قاعدهٔ قدیمی
 * ` / ` را اعمال می‌کند، تا رفتار آن کاتالوگ عوض نشود.
 */
export type WorkStageRow =
  | readonly [category: string, job: string, steps: string]
  | readonly [category: string, group: string, job: string, steps: string];

/** تجزیهٔ رشتهٔ گام‌ها: `نام:وزن|نام:وزن|…` */
function parseSteps(raw: string): WorkStep[] {
  return raw.split("|").map((entry) => {
    /* از آخر جدا می‌شود چون نام گام خودش می‌تواند «:» داشته باشد. */
    const splitAt = entry.lastIndexOf(":");
    return { name: entry.slice(0, splitAt), weight: Number(entry.slice(splitAt + 1)) };
  });
}

/**
 * تبدیل ردیف‌های خام به درخت حوزه ← گروه ← ردیف ← گام.
 *
 * ترتیب حوزه‌ها و ردیف‌ها همان ترتیب ورودی می‌ماند، چون کاربر برگه را
 * به همان ترتیبی می‌شناسد که در اکسل دیده است؛ مرتب‌سازی الفبایی یعنی
 * او باید هر بار دنبال ردیفش بگردد.
 */
export function buildWorkStages(rows: readonly WorkStageRow[]): WorkCategory[] {
  const out: WorkCategory[] = [];

  for (const row of rows) {
    const categoryName = row[0];

    let group: string;
    let jobName: string;
    let rawSteps: string;

    if (row.length === 4) {
      [, group, jobName, rawSteps] = row;
    } else {
      /* شکل قدیمی: گروه از ` / ` داخل نام درمی‌آید. */
      const [, name, steps] = row;
      const at = name.indexOf(" / ");
      group = at === -1 ? name : name.slice(0, at);
      jobName = at === -1 ? name : name.slice(at + 3);
      rawSteps = steps;
    }

    let category = out.find((c) => c.name === categoryName);
    if (!category) {
      category = { name: categoryName, jobs: [] };
      out.push(category);
    }
    category.jobs.push({ name: jobName, group, steps: parseSteps(rawSteps) });
  }

  return out;
}
