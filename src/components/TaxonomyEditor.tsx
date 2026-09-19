import { useEffect, useMemo, useState } from "react";
import { type Bi, type Lang, type Process, type SubProcess } from "../data/framework";
import { resetProcessTree, saveProcessTree } from "../services/taxonomyApi";

const clone = (value: Process[]): Process[] =>
  value.map((p) => ({
    ...p,
    title: { ...p.title },
    subs: p.subs.map((s) => ({
      ...s,
      title: { ...s.title },
      activity: { ...s.activity },
      sql: [...s.sql],
      links: s.links?.map((link) => ({ ...link, label: { ...link.label } })),
    })),
  }));

const newId = (prefix: string) => {
  const random = typeof globalThis.crypto?.randomUUID === "function" ? globalThis.crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
};

const emptyBi = (fa: string, en: string): Bi => ({ fa, en });

const emptySub = (processId: string): SubProcess => ({
  id: newId(`${processId}-s`),
  title: emptyBi("زیرفرآیند جدید", "New sub-process"),
  activity: emptyBi("شرح فعالیت", "Activity description"),
  source: "User Entry",
  sql: [],
  output: "Output",
  connectsTo: "Governance",
  ai: "AI Assistant",
});

const emptyProcess = (): Process => {
  const id = newId("process");
  return {
    id,
    title: emptyBi("فرآیند جدید", "New process"),
    subs: [emptySub(id)],
  };
};

type Props = {
  lang: Lang;
  domainTitle: Bi;
  domainId: string;
  projectId: string;
  processes: Process[];
  defaultProcesses: Process[];
  actor?: string;
  onClose: () => void;
  onSaved: (processes: Process[]) => void;
};

export default function TaxonomyEditor({
  lang,
  domainTitle,
  domainId,
  projectId,
  processes,
  defaultProcesses,
  actor,
  onClose,
  onSaved,
}: Props) {
  const rtl = lang === "fa";
  const [draft, setDraft] = useState<Process[]>(() => clone(processes));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => setDraft(clone(processes)), [processes]);

  const subCount = useMemo(() => draft.reduce((n, p) => n + p.subs.length, 0), [draft]);
  const fieldClass = "h-8 w-full rounded-lg border b-line-soft bg-black/20 px-2 text-[10px] font-light tx1 outline-none transition focus:border-sky-400/60";
  const textAreaClass = "min-h-[54px] w-full resize-y rounded-lg border b-line-soft bg-black/20 px-2 py-1.5 text-[10px] font-light tx1 outline-none transition focus:border-sky-400/60";

  const setProcessBi = (processId: string, key: "title", fieldLang: Lang, value: string) => {
    setDraft((prev) => prev.map((p) => p.id === processId ? { ...p, [key]: { ...p[key], [fieldLang]: value } } : p));
  };

  const setSubBi = (processId: string, subId: string, key: "title" | "activity", fieldLang: Lang, value: string) => {
    setDraft((prev) => prev.map((p) => p.id !== processId
      ? p
      : { ...p, subs: p.subs.map((s) => s.id === subId ? { ...s, [key]: { ...s[key], [fieldLang]: value } } : s) }));
  };

  const setSubField = (processId: string, subId: string, field: "source" | "output" | "connectsTo" | "ai", value: string) => {
    setDraft((prev) => prev.map((p) => p.id !== processId
      ? p
      : {
          ...p,
          subs: p.subs.map((s) => s.id === subId ? { ...s, [field]: value } : s),
        }));
  };

  const setSubSql = (processId: string, subId: string, value: string) => {
    setDraft((prev) => prev.map((p) => p.id !== processId
      ? p
      : { ...p, subs: p.subs.map((s) => s.id === subId ? { ...s, sql: value.split(",").map((x) => x.trim()).filter(Boolean) } : s) }));
  };

  const addProcess = () => setDraft((prev) => [...prev, emptyProcess()]);
  const addSub = (processId: string) => setDraft((prev) => prev.map((p) => p.id === processId ? { ...p, subs: [...p.subs, emptySub(processId)] } : p));

  const removeProcess = (processId: string) => {
    const label = draft.find((p) => p.id === processId)?.title[lang] ?? processId;
    if (!window.confirm(rtl ? `فرآیند «${label}» و زیرفرآیندهایش حذف شود؟` : `Delete process “${label}” and its sub-processes?`)) return;
    setDraft((prev) => prev.filter((p) => p.id !== processId));
  };

  const removeSub = (processId: string, subId: string) => {
    const process = draft.find((p) => p.id === processId);
    const label = process?.subs.find((s) => s.id === subId)?.title[lang] ?? subId;
    if (!window.confirm(rtl ? `زیرفرآیند «${label}» حذف شود؟` : `Delete sub-process “${label}”?`)) return;
    setDraft((prev) => prev.map((p) => p.id === processId ? { ...p, subs: p.subs.filter((s) => s.id !== subId) } : p));
  };

  const save = async () => {
    setError("");
    setNotice("");
    if (!draft.length || draft.some((p) => !p.title.fa.trim() || !p.title.en.trim())) {
      setError(rtl ? "حداقل یک فرآیند با عنوان فارسی و انگلیسی لازم است." : "At least one process with Persian and English titles is required.");
      return;
    }
    if (draft.some((p) => p.subs.some((s) => !s.title.fa.trim() || !s.title.en.trim()))) {
      setError(rtl ? "عنوان فارسی و انگلیسی همهٔ زیرفرآیندها را تکمیل کنید." : "Complete both titles for every sub-process.");
      return;
    }
    setBusy(true);
    const saved = await saveProcessTree(projectId, domainId, draft, actor);
    setBusy(false);
    if (!saved) {
      setError(rtl ? "ذخیره انجام نشد؛ اتصال API یا شِمای ProcessTree را بررسی کنید." : "Save failed; check the API connection or ProcessTree schema.");
      return;
    }
    setNotice(rtl ? "ساختار در پایگاه ذخیره شد." : "The taxonomy was saved to the database.");
    onSaved(saved);
  };

  const reset = async () => {
    if (!window.confirm(rtl ? "ساختار این حوزه به نسخهٔ پیش‌فرض برگردد؟" : "Restore this domain to the default taxonomy?")) return;
    setError("");
    setNotice("");
    setBusy(true);
    const ok = await resetProcessTree(projectId, domainId, actor);
    setBusy(false);
    if (!ok) {
      setError(rtl ? "بازگردانی انجام نشد." : "Reset failed.");
      return;
    }
    setDraft(clone(defaultProcesses));
    setNotice(rtl ? "نسخهٔ پیش‌فرض فعال شد." : "The default taxonomy is active again.");
    onSaved(clone(defaultProcesses));
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-5" dir={rtl ? "rtl" : "ltr"}>
      <section className="glass flex max-h-[92vh] w-[min(1180px,calc(100vw-40px))] min-h-0 flex-col overflow-hidden rounded-2xl border border-sky-400/35 shadow-2xl">
        <header className="flex shrink-0 flex-wrap items-center gap-3 border-b b-line-soft px-4 py-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl border border-sky-400/40 bg-sky-400/10 text-[17px]">✎</span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[13px] font-semibold tx1">{rtl ? "ویرایش ساختار فرایندها و زیرفرایندها" : "Edit processes & sub-processes"}</h2>
            <p className="mt-0.5 text-[9px] font-extralight tx3">
              {tLabel(domainTitle, lang)} · <span dir="ltr">{domainId}</span> · <span dir="ltr">{projectId}</span> · {draft.length.toLocaleString(rtl ? "fa-IR" : "en-US")} {rtl ? "فرآیند" : "processes"} · {subCount.toLocaleString(rtl ? "fa-IR" : "en-US")} {rtl ? "زیرفرآیند" : "sub-processes"}
            </p>
          </div>
          <button type="button" onClick={onClose} className="glass-row rounded-lg px-3 py-1.5 text-[10px] tx2 hover:tx1">✕ {rtl ? "بستن" : "Close"}</button>
        </header>

        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-sky-400/20 bg-sky-400/5 px-3 py-2 text-[9.5px] tx3">
            <span>🛡</span>
            <span>{rtl ? "ویرایش برای همین پروژه ذخیره می‌شود و پس از بارگذاری مجدد باقی می‌ماند." : "Edits are stored for this project and survive a page reload."}</span>
            <button type="button" onClick={addProcess} className="ms-auto rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-1.5 text-[9.5px] text-emerald-300 hover:bg-emerald-400/20">＋ {rtl ? "فرآیند جدید" : "Add process"}</button>
            <button type="button" onClick={() => void reset()} disabled={busy} className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-2.5 py-1.5 text-[9.5px] text-amber-300 disabled:opacity-40">↺ {rtl ? "بازگردانی پیش‌فرض" : "Restore default"}</button>
          </div>

          {draft.length === 0 && (
            <div className="rounded-xl border border-dashed b-line-soft p-6 text-center text-[10px] tx3">{rtl ? "فرآیندی وجود ندارد؛ از دکمهٔ افزودن استفاده کنید." : "No processes. Add a process to begin."}</div>
          )}

          <div className="space-y-3">
            {draft.map((process, index) => (
              <article key={process.id} className="rounded-2xl border b-line-soft bg-black/15 p-3">
                <div className="mb-3 flex flex-wrap items-end gap-2 border-b b-line-soft pb-3">
                  <span className="mb-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-sky-400/10 text-[10px] text-sky-300">{index + 1}</span>
                  <BiField label={rtl ? "عنوان فارسی فرآیند" : "Persian process title"} value={process.title.fa} lang="fa" className="min-w-[220px] flex-1" onChange={(value) => setProcessBi(process.id, "title", "fa", value)} inputClass={fieldClass} />
                  <BiField label={rtl ? "عنوان انگلیسی فرآیند" : "English process title"} value={process.title.en} lang="en" className="min-w-[220px] flex-1" onChange={(value) => setProcessBi(process.id, "title", "en", value)} inputClass={fieldClass} />
                  <button type="button" onClick={() => addSub(process.id)} className="h-8 rounded-lg border border-emerald-400/35 bg-emerald-400/10 px-2.5 text-[9.5px] text-emerald-300 hover:bg-emerald-400/20">＋ {rtl ? "زیرفرآیند" : "Sub-process"}</button>
                  <button type="button" onClick={() => removeProcess(process.id)} className="h-8 rounded-lg border border-rose-400/35 bg-rose-400/10 px-2.5 text-[9.5px] text-rose-300 hover:bg-rose-400/20">⌫ {rtl ? "حذف فرآیند" : "Delete process"}</button>
                </div>

                <div className="space-y-2">
                  {process.subs.map((sub, subIndex) => (
                    <div key={sub.id} className="rounded-xl border border-[var(--line-soft)] bg-[var(--row)] p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="text-[9px] tx4">{index + 1}.{subIndex + 1}</span>
                        <span className="font-mono text-[8.5px] tx4" dir="ltr">{sub.id}</span>
                        <button type="button" onClick={() => removeSub(process.id, sub.id)} className="ms-auto text-[9px] text-rose-300/80 hover:text-rose-200">⌫ {rtl ? "حذف زیرفرایند" : "Delete sub-process"}</button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <BiField label={rtl ? "عنوان فارسی" : "Persian title"} value={sub.title.fa} lang="fa" onChange={(value) => setSubBi(process.id, sub.id, "title", "fa", value)} inputClass={fieldClass} />
                        <BiField label={rtl ? "عنوان انگلیسی" : "English title"} value={sub.title.en} lang="en" onChange={(value) => setSubBi(process.id, sub.id, "title", "en", value)} inputClass={fieldClass} />
                        <BiField label={rtl ? "شرح فعالیت فارسی" : "Persian activity"} value={sub.activity.fa} lang="fa" multiline onChange={(value) => setSubBi(process.id, sub.id, "activity", "fa", value)} inputClass={textAreaClass} />
                        <BiField label={rtl ? "شرح فعالیت انگلیسی" : "English activity"} value={sub.activity.en} lang="en" multiline onChange={(value) => setSubBi(process.id, sub.id, "activity", "en", value)} inputClass={textAreaClass} />
                      </div>
                      <div className="mt-2 grid grid-cols-4 gap-2">
                        <PlainField label={rtl ? "منبع داده" : "Source"} value={sub.source} onChange={(value) => setSubField(process.id, sub.id, "source", value)} inputClass={fieldClass} />
                        <PlainField label={rtl ? "خروجی" : "Output"} value={sub.output} onChange={(value) => setSubField(process.id, sub.id, "output", value)} inputClass={fieldClass} />
                        <PlainField label={rtl ? "اتصال به" : "Connects to"} value={sub.connectsTo} onChange={(value) => setSubField(process.id, sub.id, "connectsTo", value)} inputClass={fieldClass} />
                        <PlainField label={rtl ? "قابلیت AI" : "AI function"} value={sub.ai} onChange={(value) => setSubField(process.id, sub.id, "ai", value)} inputClass={fieldClass} />
                      </div>
                      <div className="mt-2">
                        <PlainField label={rtl ? "جداول SQL (با ویرگول جدا کنید)" : "SQL tables (comma-separated)"} value={sub.sql.join(", ")} onChange={(value) => setSubSql(process.id, sub.id, value)} inputClass={fieldClass} dir="ltr" />
                      </div>
                    </div>
                  ))}
                  {process.subs.length === 0 && <div className="rounded-lg border border-dashed b-line-soft p-3 text-center text-[9px] tx4">{rtl ? "این فرآیند زیرفرآیند ندارد." : "This process has no sub-processes."}</div>}
                </div>
              </article>
            ))}
          </div>
        </div>

        <footer className="flex shrink-0 flex-wrap items-center gap-2 border-t b-line-soft px-4 py-3">
          <div className="min-h-[20px] flex-1 text-[9.5px]">
            {error && <span className="text-rose-300">⚠ {error}</span>}
            {!error && notice && <span className="text-emerald-300">✓ {notice}</span>}
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="rounded-lg border b-line-soft px-3 py-2 text-[10px] tx2 disabled:opacity-40">{rtl ? "انصراف" : "Cancel"}</button>
          <button type="button" onClick={() => void save()} disabled={busy} className="rounded-lg border border-sky-400/45 bg-sky-400/15 px-4 py-2 text-[10px] text-sky-200 hover:bg-sky-400/25 disabled:opacity-40">{busy ? (rtl ? "در حال ذخیره…" : "Saving…") : `✓ ${rtl ? "ذخیره ساختار" : "Save taxonomy"}`}</button>
        </footer>
      </section>
    </div>
  );
}

function tLabel(value: Bi, lang: Lang) {
  return value[lang];
}

function BiField({
  label,
  value,
  lang,
  multiline = false,
  className = "",
  inputClass,
  onChange,
}: {
  label: string;
  value: string;
  lang: Lang;
  multiline?: boolean;
  className?: string;
  inputClass: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[8.5px] tx4">{label}</span>
      {multiline ? (
        <textarea dir={lang === "fa" ? "rtl" : "ltr"} value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} />
      ) : (
        <input dir={lang === "fa" ? "rtl" : "ltr"} value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} />
      )}
    </label>
  );
}

function PlainField({
  label,
  value,
  onChange,
  inputClass,
  dir,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  inputClass: string;
  dir?: "ltr" | "rtl";
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[8.5px] tx4">{label}</span>
      <input dir={dir} value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} />
    </label>
  );
}
