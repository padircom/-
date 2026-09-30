import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Lang } from "../data/framework";
import { oilfieldWorkStages } from "../data/oilfieldWorkStages";

type Choice = { label: string; value: string };

/** A themed listbox instead of the OS select popup (which can render white on Windows). */
function StageDropdown({ label, placeholder, value, choices, disabled, onChange }: {
  label: string; placeholder: string; value: string; choices: Choice[];
  disabled?: boolean; onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const toggle = () => {
    if (!open) setRect(wrapper.current?.getBoundingClientRect() ?? null);
    setOpen(current => !current);
  };
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node) && !menu.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const closeOnScroll = (event: Event) => {
      if (!menu.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    window.addEventListener("resize", closeEscapeOrResize);
    document.addEventListener("scroll", closeOnScroll, true);
    function closeEscapeOrResize() { setOpen(false); }
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
      window.removeEventListener("resize", closeEscapeOrResize);
      document.removeEventListener("scroll", closeOnScroll, true);
    };
  }, [open]);
  const selected = choices.find(item => item.value === value);
  return (
    <div ref={wrapper} className="relative min-w-0 space-y-1 text-[11px] tx2">
      <span id={`stage-label-${label}`}>{label}</span>
      <button type="button" disabled={disabled} aria-labelledby={`stage-label-${label}`}
        aria-expanded={open} aria-haspopup="listbox"
        onClick={toggle}
        className="oilfield-select-trigger flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-start text-[11px] outline-none disabled:opacity-50">
        <span className="truncate">{selected?.label ?? placeholder}</span><span aria-hidden="true">⌄</span>
      </button>
      {open && rect && !disabled && createPortal(<div ref={menu} role="listbox" aria-label={label}
        className="oilfield-select-menu fixed max-h-64 overflow-y-auto rounded-lg border p-1"
        style={{ zIndex: 99999, top: rect.bottom + 264 > window.innerHeight && rect.top > 264 ? rect.top - 264 : rect.bottom + 4, left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)), width: Math.min(rect.width, window.innerWidth - 16), backgroundColor: "#172341" }}>
        {choices.map(choice => <button type="button" role="option" aria-selected={value === choice.value}
          key={choice.value} onClick={() => { onChange(choice.value); setOpen(false); }}
          className="oilfield-select-option block w-full rounded-md px-3 py-2 text-start text-[11px] focus:outline-none">
          {choice.label}
        </button>)}
      </div>, document.body)}
    </div>
  );
}

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
  const groupFor = (name: string) => name.includes(" / ") ? name.slice(0, name.indexOf(" / ")) : name;
  const phaseFor = (name: string) => name.includes(" / ") ? name.slice(name.indexOf(" / ") + 3) : name;
  const groups = [...new Set(selectedCategory?.jobs.map(item => groupFor(item.name)) ?? [])];
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
          choices={selectedCategory?.jobs.flatMap((item, i) => groupFor(item.name) === selectedGroup
            ? [{ label: phaseFor(item.name), value: String(i) }] : []) ?? []}
          onChange={setJob} />
      </div>
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
    </section>
  );
}
