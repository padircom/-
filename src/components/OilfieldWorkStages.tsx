import { useEffect, useState } from "react";
import type { Lang } from "../data/framework";
import { oilfieldWorkStages } from "../data/oilfieldWorkStages";
import StageDropdown from "./StageDropdown";

export default function OilfieldWorkStages({ lang }: { lang: Lang }) {
  const fa = lang === "fa";
  const [category, setCategory] = useState("");
  const [group, setGroup] = useState("");
  const [job, setJob] = useState("");
  // Draft edits belong to this oilfield only; never mutate the reference catalogue.
  const [weightEdits, setWeightEdits] = useState<Record<string, string>>(() => {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem("oilfield-work-step-weight-draft:c1-p1") ?? "{}");
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, string> : {};
    } catch { return {}; }
  });
  useEffect(() => {
    try { localStorage.setItem("oilfield-work-step-weight-draft:c1-p1", JSON.stringify(weightEdits)); } catch { /* private browsing */ }
  }, [weightEdits]);
  const stepKey = (categoryIndex: string, jobIndex: number, stepIndex: number) => `${categoryIndex}:${jobIndex}:${stepIndex}`;
  const weightFor = (jobIndex: number, stepIndex: number, reference: number) =>
    weightEdits[stepKey(category, jobIndex, stepIndex)] ?? String(reference);
  const editWeight = (jobIndex: number, stepIndex: number, raw: string) => {
    const value = raw.replace(",", ".");
    if (!/^(?:\d{0,3}(?:\.\d{0,2})?)$/.test(value) || (value !== "" && Number(value) > 100)) return;
    setWeightEdits(current => ({ ...current, [stepKey(category, jobIndex, stepIndex)]: value }));
  };
  const selectedCategory = category === "" ? undefined : oilfieldWorkStages[Number(category)];
  const groups = [...new Set(selectedCategory?.jobs.map(item => item.group) ?? [])];
  const selectedGroup = group === "" ? undefined : groups[Number(group)];
  const selectedJob = job === "" ? undefined : selectedCategory?.jobs[Number(job)];
  const jobIndex = Number(job);
  const values = selectedJob?.steps.map((entry, i) => weightFor(jobIndex, i, entry.weight)) ?? [];
  const incomplete = values.some(value => value === "");
  const total = values.reduce((sum, value) => sum + (Number(value) || 0), 0);

  return (
    <section className="fade-rise glass-dark space-y-4 rounded-2xl p-4">
      <div>
        <h3 className="text-sm font-semibold tx1">{fa ? "مراحل کاری میدان نفتی" : "Oilfield work stages"}</h3>
        <p className="mt-1 text-[10px] tx3">{fa ? "وزن‌های مرجع قابل ویرایش‌اند؛ تغییرات به‌صورت پیش‌نویس در همین مرورگر ذخیره می‌شوند و به پیشرفت پروژه متصل نیستند." : "Reference weights are editable; drafts are saved in this browser and are not connected to project progress."}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <StageDropdown label={fa ? "۱. حوزه کاری" : "1. Discipline"} placeholder={fa ? "انتخاب حوزه" : "Select discipline"}
          value={category} choices={oilfieldWorkStages.map((item, i) => ({ label: item.name, value: String(i) }))}
          onChange={value => { setCategory(value); setGroup(""); setJob(""); }} />
        <StageDropdown label={fa ? "۲. جاب‌فاز" : "2. Job phase"} placeholder={fa ? "انتخاب جاب‌فاز" : "Select job phase"}
          value={group} disabled={!selectedCategory}
          choices={groups.map((name, i) => ({ label: name, value: String(i) }))}
          onChange={value => { setGroup(value); setJob(""); }} />
        <StageDropdown label={fa ? "۳. ردیف کاری" : "3. Work row"} placeholder={fa ? "انتخاب ردیف" : "Select row"}
          value={job} disabled={!selectedGroup}
          choices={selectedCategory?.jobs.flatMap((item, i) => item.group === selectedGroup
              ? [{ label: item.name, value: String(i) }] : []) ?? []}
          onChange={setJob} />
      </div>
      {selectedJob && <div className="space-y-2">
        <h4 className="text-[11px] font-semibold tx1">{selectedJob.group === selectedJob.name ? selectedJob.name : `${selectedJob.group} · ${selectedJob.name}`}</h4>
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
    </section>
  );
}
