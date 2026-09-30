import { useEffect, useState } from "react";
import type { Lang } from "../data/framework";
import { petrochemicalWorkStages } from "../data/petrochemicalWorkStages";
import StageDropdown from "./StageDropdown";

/**
 * «مراحل کاری پتروشیمی» — همان منطق کاری کاتالوگ نفتی، روی خوشهٔ c2.
 *
 * تفاوت عمدی با نسخهٔ نفتی:
 *
 * ۱. دامنه: نفتی فقط روی یک پروژه (c1-p1) باز می‌شود؛ این یکی روی کل
 *    خوشهٔ پتروشیمی و هر پنج پروژهٔ زیرمجموعه.
 * ۲. پیش‌نویس: کلید ذخیره به **خوشه** بسته است نه پروژه، یعنی وزن‌های
 *    ویرایش‌شده بین c2-p1 تا c2-p5 مشترک‌اند. این خواستهٔ صریح کاربر
 *    بود؛ عارضه‌اش این است که ویرایش در یک پروژه در بقیه هم دیده
 *    می‌شود، پس در پانوشت صفحه صریح گفته شده تا کسی آن را اشتباهاً
 *    «وزنِ همین پروژه» نخواند.
 * ۳. حالت خالی: تا وقتی برگه‌های مرجع نرسیده‌اند، به‌جای سه کشوی مرده
 *    یک توضیح نشان داده می‌شود. کشوی خالیِ بی‌توضیح یعنی کاربر فکر
 *    می‌کند صفحه خراب است.
 */
export default function PetrochemicalWorkStages({ lang, clusterId = "c2" }: { lang: Lang; clusterId?: string }) {
  const fa = lang === "fa";
  const [category, setCategory] = useState("");
  const [group, setGroup] = useState("");
  const [job, setJob] = useState("");

  /* پیش‌نویس در سطح خوشه ذخیره می‌شود؛ کاتالوگ مرجع هرگز تغییر نمی‌کند. */
  const draftKey = `petrochemical-work-step-weight-draft:${clusterId}`;
  const [weightEdits, setWeightEdits] = useState<Record<string, string>>(() => {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(draftKey) ?? "{}");
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, string> : {};
    } catch { return {}; }
  });
  useEffect(() => {
    try { localStorage.setItem(draftKey, JSON.stringify(weightEdits)); } catch { /* private browsing */ }
  }, [draftKey, weightEdits]);

  const stepKey = (categoryIndex: string, jobIndex: number, stepIndex: number) => `${categoryIndex}:${jobIndex}:${stepIndex}`;
  const weightFor = (jobIndex: number, stepIndex: number, reference: number) =>
    weightEdits[stepKey(category, jobIndex, stepIndex)] ?? String(reference);
  const editWeight = (jobIndex: number, stepIndex: number, raw: string) => {
    const value = raw.replace(",", ".");
    if (!/^(?:\d{0,3}(?:\.\d{0,2})?)$/.test(value) || (value !== "" && Number(value) > 100)) return;
    setWeightEdits(current => ({ ...current, [stepKey(category, jobIndex, stepIndex)]: value }));
  };

  const selectedCategory = category === "" ? undefined : petrochemicalWorkStages[Number(category)];
  const groupFor = (name: string) => name.includes(" / ") ? name.slice(0, name.indexOf(" / ")) : name;
  const phaseFor = (name: string) => name.includes(" / ") ? name.slice(name.indexOf(" / ") + 3) : name;
  const groups = [...new Set(selectedCategory?.jobs.map(item => groupFor(item.name)) ?? [])];
  const selectedGroup = group === "" ? undefined : groups[Number(group)];
  const selectedJob = job === "" ? undefined : selectedCategory?.jobs[Number(job)];
  const jobIndex = Number(job);
  const values = selectedJob?.steps.map((entry, i) => weightFor(jobIndex, i, entry.weight)) ?? [];
  const incomplete = values.some(value => value === "");
  const total = values.reduce((sum, value) => sum + (Number(value) || 0), 0);

  const empty = petrochemicalWorkStages.length === 0;

  return (
    <section className="fade-rise glass-dark space-y-4 rounded-2xl p-4">
      <div>
        <h3 className="text-sm font-semibold tx1">{fa ? "مراحل کاری پتروشیمی" : "Petrochemical work stages"}</h3>
        <p className="mt-1 text-[10px] tx3">{fa ? "وزن‌های مرجع قابل ویرایش‌اند؛ تغییرات به‌صورت پیش‌نویس در همین مرورگر ذخیره می‌شوند و به پیشرفت پروژه متصل نیستند." : "Reference weights are editable; drafts are saved in this browser and are not connected to project progress."}</p>
      </div>

      {empty ? (
        <div className="space-y-2 rounded-xl border border-amber-400/30 bg-amber-400/5 p-3">
          <p className="text-[11px] text-amber-200">
            {fa ? "کاتالوگ مرجع پتروشیمی هنوز بارگذاری نشده است." : "The petrochemical reference catalogue has not been loaded yet."}
          </p>
          <p className="text-[10px] tx3">
            {fa
              ? "ساختار این تب (انتخاب حوزه، جاب‌فاز و ردیف کاری، جدول گام‌ها، ویرایش وزن و جمع لحظه‌ای) آماده است و به‌محض رونویسی برگه‌های واقعی فعال می‌شود. عمداً با وزن حدسی پر نشده: وزن گام مستقیماً وارد اندازه‌گیری پیشرفت فیزیکی می‌شود و عددی که به هیچ سندی قابل ردیابی نباشد، در صورت‌وضعیت و دعوای تأخیر قابل دفاع نیست."
              : "The tab logic is ready and switches on as soon as the real sheets are transcribed. It was deliberately not seeded with guessed weights: step weights feed physical progress measurement, and a number that traces to no document cannot be defended in an invoice or a delay claim."}
          </p>
          <p className="text-[10px] tx4" dir="ltr">src/data/petrochemicalWorkStages.ts</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-3">
          <StageDropdown label={fa ? "۱. حوزه کاری" : "1. Discipline"} placeholder={fa ? "انتخاب حوزه" : "Select discipline"}
            value={category} choices={petrochemicalWorkStages.map((item, i) => ({ label: item.name, value: String(i) }))}
            onChange={value => { setCategory(value); setGroup(""); setJob(""); }} />
          <StageDropdown label={fa ? "۲. جاب‌فاز" : "2. Job phase"} placeholder={fa ? "انتخاب جاب‌فاز" : "Select job phase"}
            value={group} disabled={!selectedCategory}
            choices={groups.map((name, i) => ({ label: name, value: String(i) }))}
            onChange={value => { setGroup(value); setJob(""); }} />
          <StageDropdown label={fa ? "۳. ردیف کاری" : "3. Work row"} placeholder={fa ? "انتخاب ردیف" : "Select row"}
            value={job} disabled={!selectedGroup}
            choices={selectedCategory?.jobs.flatMap((item, i) => groupFor(item.name) === selectedGroup
              ? [{ label: phaseFor(item.name), value: String(i) }] : []) ?? []}
            onChange={setJob} />
        </div>
      )}

      {selectedJob && <div className="space-y-2">
        <h4 className="text-[11px] font-semibold tx1">{selectedGroup === phaseFor(selectedJob.name) ? selectedGroup : `${selectedGroup} · ${phaseFor(selectedJob.name)}`}</h4>
        <div className="overflow-x-auto rounded-xl border b-line-soft">
          <table className="w-full min-w-max border-separate border-spacing-0 text-[10px]">
            <thead><tr className="bg-[var(--bg-c)] text-[var(--ink)]">
              {selectedJob.steps.map((_, i) => <th key={i} className="min-w-32 max-w-40 border-e border-b b-line-soft px-2 py-3 text-center">STEP {i + 1}</th>)}
              <th className="sticky end-0 z-10 min-w-24 border-b b-line-soft bg-[var(--bg-c)] px-2 py-3 text-center">Total weight</th>
            </tr></thead>
            <tbody>
              <tr className="bg-[var(--bg-b)]">
                {selectedJob.steps.map((entry, i) => <td key={i} className="min-w-32 max-w-40 border-e border-b b-line-soft px-2 py-3 text-center tx1">{entry.name}</td>)}
                <td className="sticky end-0 border-b b-line-soft bg-[var(--bg-c)]" />
              </tr>
              <tr className="bg-[var(--row-active)] text-[var(--ink)]">
                {selectedJob.steps.map((entry, i) => <td key={i} className="border-e b-line-soft px-2 py-1 text-center tabular-nums" dir="ltr"><div className="flex items-center justify-center gap-1">
                  <input type="text" inputMode="decimal" aria-label={`${selectedJob.name} — STEP ${i + 1} — ${fa ? "وزن درصدی" : "Weight percent"}`}
                    value={weightFor(jobIndex, i, entry.weight)} onChange={e => editWeight(jobIndex, i, e.target.value)}
                    className="w-14 rounded border b-line-soft bg-[var(--bg-c)] px-1 py-0.5 text-center tabular-nums tx1 outline-none focus:border-[var(--accent)]" />%
                </div></td>)}
                <td className={`sticky end-0 bg-[var(--bg-c)] px-2 py-1 text-center font-semibold tabular-nums ${!incomplete && Math.abs(total - 100) < 0.001 ? "text-[var(--ink)]" : "text-amber-300"}`} dir="ltr">{incomplete ? "—" : `${Math.round(total * 100) / 100}%`}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-[9px] tx3">{fa ? "درصد هر گام قابل ویرایش است؛ جمع به‌صورت لحظه‌ای محاسبه می‌شود." : "Each step weight can be edited; the total updates immediately."}</p>
      </div>}

      <p className="text-[9px] tx4">
        {fa
          ? "پیش‌نویس وزن‌ها در سطح خوشهٔ پتروشیمی مشترک است: ویرایش در هر یک از پروژه‌های زیرمجموعه، در بقیه هم دیده می‌شود."
          : "The weight draft is shared across the petrochemical cluster: an edit made in one sub-project is visible in all of them."}
      </p>
    </section>
  );
}
