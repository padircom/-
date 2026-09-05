import { useEffect, useMemo, useState } from "react";
import { t, type Bi, type Lang } from "../data/framework";

export type EdmsTab =
  | "overview"
  | "mdr"
  | "revision"
  | "correspondence"
  | "transmittal"
  | "workflow"
  | "excel"
  | "numbering"
  | "lessons";

type DocumentRow = {
  id: string;
  code: string;
  title: Bi;
  revision: string;
  discipline: string;
  status: "approved" | "under_review" | "rejected" | "draft";
  reviewCode: "C1" | "C2" | "C3" | "C4" | "—";
  slaHours: number;
  updatedAt: string;
};

type LetterRow = {
  id: string;
  letterNo: string;
  subject: Bi;
  sender: Bi;
  receiver: Bi;
  date: string;
  actionRequired: boolean;
  dueDate: string;
};

type TransmittalRow = {
  id: string;
  transmittalNo: string;
  purpose: Bi;
  recipient: Bi;
  docCount: number;
  date: string;
  status: "sent" | "received" | "ack";
};

type LessonRow = {
  id: string;
  title: Bi;
  category: Bi;
  impact: Bi;
  lesson: Bi;
  author: string;
};

type WfTask = {
  id: string;
  doc: string;
  step: Bi;
  owner: Bi;
  sla: string;
  code: string;
};

const sampleDocs: DocumentRow[] = [
  { id: "doc1", code: "OG-2401-CIV-DR-001", title: { fa: "نقشه تفصیلی فونداسیون مخازن", en: "Foundation Detailed Drawing" }, revision: "Rev-02", discipline: "Civil", status: "approved", reviewCode: "C1", slaHours: 18, updatedAt: "1403/02/10" },
  { id: "doc2", code: "OG-2401-MEC-DS-004", title: { fa: "برگ مشخصات فنی پمپ‌های سانتریفیوژ", en: "Centrifugal Pump Data Sheet" }, revision: "Rev-01", discipline: "Mechanical", status: "under_review", reviewCode: "C2", slaHours: 42, updatedAt: "1403/02/15" },
  { id: "doc3", code: "OG-2401-PIP-ISO-012", title: { fa: "نقشه ایزومتریک خطوط لوله‌کشی فاز ۱", en: "Piping Isometric Line 012" }, revision: "Rev-00", discipline: "Piping", status: "draft", reviewCode: "—", slaHours: 0, updatedAt: "1403/02/18" },
  { id: "doc4", code: "OG-2401-ELE-SLD-007", title: { fa: "دیاگرام تک‌خطی پست برق", en: "Electrical Single Line Diagram" }, revision: "Rev-03", discipline: "Electrical", status: "rejected", reviewCode: "C3", slaHours: 96, updatedAt: "1403/02/08" },
];

const sampleLetters: LetterRow[] = [
  { id: "let1", letterNo: "LTR-2401-104", subject: { fa: "درخواست ابلاغ نقشه‌های اصلاحی کیلومتر ۲۴", en: "Request for revised drawings KM24" }, sender: { fa: "پیمانکار", en: "Contractor" }, receiver: { fa: "مشاور", en: "Consultant" }, date: "1403/02/12", actionRequired: true, dueDate: "1403/02/20" },
  { id: "let2", letterNo: "LTR-2401-089", subject: { fa: "پاسخ به ادعای شرایط نامساعد جوی", en: "Response to weather claim" }, sender: { fa: "کارفرما", en: "Employer" }, receiver: { fa: "پیمانکار", en: "Contractor" }, date: "1403/02/05", actionRequired: false, dueDate: "-" },
];

const sampleTransmittals: TransmittalRow[] = [
  { id: "tr1", transmittalNo: "TR-OG-2401-042", purpose: { fa: "جهت بررسی و تأیید", en: "For Review & Approval" }, recipient: { fa: "دستگاه نظارت", en: "Supervision Team" }, docCount: 6, date: "1403/02/14", status: "sent" },
  { id: "tr2", transmittalNo: "TR-OG-2401-038", purpose: { fa: "جهت ساخت و اجرا", en: "For Construction (IFC)" }, recipient: { fa: "پیمانکار اجرایی", en: "Contractor" }, docCount: 12, date: "1403/02/01", status: "ack" },
];

const sampleLessons: LessonRow[] = [
  { id: "ls1", title: { fa: "تأخیر در تأیید نقشه‌های شاپ قالب‌بندی", en: "Delay in shop drawing approvals" }, category: { fa: "مهندسی", en: "Engineering" }, impact: { fa: "تأخیر ۲ هفته‌ای در بتن‌ریزی", en: "2-week delay in concreting" }, lesson: { fa: "ارسال همزمان نسخه‌های الکترونیکی جهت تسریع بررسی پیش از جلسه حضوری", en: "Parallel electronic submission prior to formal review" }, author: "مهندس احمدی" },
  { id: "ls2", title: { fa: "تعارض خطوط لوله زیرزمینی با کابل فشار قوی", en: "Underground pipe & HV cable conflict" }, category: { fa: "اجرا / سایت", en: "Construction" }, impact: { fa: "توقف ۲ روزه حفاری", en: "2-day excavation stoppage" }, lesson: { fa: "انجام اسکن سونار کارگاهی قبل از گودبرداری در زون‌های صنعتی قدیمی", en: "Perform site sonar scan prior to excavation in old zones" }, author: "مهندس رضایی" },
];

const wfTasks: WfTask[] = [
  { id: "w1", doc: "OG-2401-MEC-DS-004", step: { fa: "بررسی مشاور", en: "Consultant review" }, owner: { fa: "ناظر مکانیک", en: "Mech. Supervisor" }, sla: "36h", code: "C2" },
  { id: "w2", doc: "OG-2401-ELE-SLD-007", step: { fa: "بازگشت برای اصلاح", en: "Return for comment" }, owner: { fa: "طراح برق", en: "Elec. Designer" }, sla: "SLA+12h", code: "C3" },
];

const statusMetaDoc = {
  approved: { fa: "تأییدشده", en: "Approved", color: "#34D399" },
  under_review: { fa: "در حال بررسی", en: "Under Review", color: "#FBBF24" },
  rejected: { fa: "ردشده", en: "Rejected", color: "#F87171" },
  draft: { fa: "پیش‌نویس", en: "Draft", color: "#94A3B8" },
};

const TABS: { id: EdmsTab; fa: string; en: string }[] = [
  { id: "overview", fa: "نمای کلی", en: "Overview" },
  { id: "mdr", fa: "MDR", en: "MDR" },
  { id: "revision", fa: "نسخه", en: "Revision" },
  { id: "workflow", fa: "گردش کار", en: "Workflow" },
  { id: "excel", fa: "اکسل", en: "Excel" },
  { id: "numbering", fa: "شماره", en: "Numbering" },
  { id: "correspondence", fa: "مکاتبات", en: "Letters" },
  { id: "transmittal", fa: "ترانسمیتال", en: "Transmittal" },
  { id: "lessons", fa: "دانش", en: "Lessons" },
];

export default function DocumentWorkspace({
  lang,
  initialTab = "overview",
  hideTabs = false,
}: {
  lang: Lang;
  initialTab?: EdmsTab;
  hideTabs?: boolean;
}) {
  const rtl = lang === "fa";
  const [tab, setTab] = useState<EdmsTab>(initialTab);
  const [docs, setDocs] = useState(sampleDocs);
  const [query, setQuery] = useState("");
  const [newDocCode, setNewDocCode] = useState("");
  const [newDocTitle, setNewDocTitle] = useState("");
  const [newDocDiscipline, setNewDocDiscipline] = useState("Civil");
  const [reserved, setReserved] = useState("OG-2401-CIV-DR-005");

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter(
      (d) =>
        d.code.toLowerCase().includes(q) ||
        t(d.title, lang).toLowerCase().includes(q) ||
        d.discipline.toLowerCase().includes(q)
    );
  }, [docs, query, lang]);

  const kpis = useMemo(() => {
    const total = docs.length;
    const approved = docs.filter((d) => d.status === "approved").length;
    const rejected = docs.filter((d) => d.status === "rejected").length;
    const cycle = Math.round(docs.reduce((a, d) => a + d.slaHours, 0) / Math.max(total, 1));
    return { total, approved, rejected, cycle, rejectRate: total ? Math.round((rejected / total) * 100) : 0, slaBreach: docs.filter((d) => d.slaHours > 48).length };
  }, [docs]);

  const addDocument = () => {
    if (!newDocCode.trim()) return;
    setDocs((prev) => [
      {
        id: `doc-${Date.now()}`,
        code: newDocCode,
        title: { fa: newDocTitle || "مدرک جدید", en: newDocTitle || "New Document" },
        revision: "Rev-00",
        discipline: newDocDiscipline,
        status: "under_review",
        reviewCode: "C4",
        slaHours: 24,
        updatedAt: new Date().toLocaleDateString(rtl ? "fa-IR" : "en-GB"),
      },
      ...prev,
    ]);
    setNewDocCode("");
    setNewDocTitle("");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden" dir={rtl ? "rtl" : "ltr"}>
      <section className="glass-dark shrink-0 rounded-2xl p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-sky-400/40 bg-sky-400/10 text-[15px]">🗂</span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[12px] font-semibold tx1">
              {rtl ? "مدیریت اطلاعات و مستندات پروژه (PIM / EDMS)" : "Project Information & Document Management"}
            </h3>
            <p className="text-[8.5px] font-extralight tx3">
              {rtl
                ? "منبع حقیقت: پایگاه‌داده · اکسل فقط ظرف بازتولید · کنترل نسخه، گردش کار Code 1–4، ترانسمیتال، آفلاین"
                : "Database is source of truth · Excel is a rendered vessel · revision, Code 1–4 workflow, transmittal, offline"}
            </p>
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={rtl ? "جستجو کد / عنوان / دیسپلین…" : "Search code / title / discipline…"}
            className="w-52 rounded-lg border b-line-soft bg-black/20 px-2 py-1 text-[10px] tx1 outline-none"
          />
        </div>
      </section>

      {!hideTabs && (
      <nav className="flex shrink-0 flex-wrap items-center gap-1 rounded-xl bg-black/15 p-1">
        {TABS.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`rounded-lg px-2.5 py-1.5 text-[10px] font-light transition ${
              tab === item.id ? "toggle-on tx1 shadow-sm" : "tx3 hover:tx2"
            }`}
          >
            {rtl ? item.fa : item.en}
          </button>
        ))}
      </nav>
      )}

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto pr-1">
        {tab === "overview" && (
          <div className="fade-rise grid gap-2 sm:grid-cols-4">
            {[
              { k: rtl ? "مدارک MDR" : "MDR docs", v: kpis.total, c: "#7FB2FF" },
              { k: rtl ? "تأییدشده" : "Approved", v: kpis.approved, c: "#34D399" },
              { k: rtl ? "نرخ رد" : "Rejection", v: `${kpis.rejectRate}%`, c: "#F87171" },
              { k: rtl ? "میانگین چرخه (ساعت)" : "Avg cycle (h)", v: kpis.cycle, c: "#FBBF24" },
            ].map((card) => (
              <div key={card.k} className="glass-dark rounded-2xl p-3">
                <div className="text-[8.5px] font-extralight tx3">{card.k}</div>
                <div className="mt-1 text-[18px] font-semibold tabular-nums" style={{ color: card.c }}>{card.v}</div>
              </div>
            ))}
            <div className="glass-dark sm:col-span-4 rounded-2xl p-3">
              <div className="text-[10.5px] font-normal tx1">{rtl ? "منحنی پیشرفت MDR (نمونه)" : "MDR S-curve (sample)"}</div>
              <div className="mt-2 flex h-16 items-end gap-1">
                {[22, 28, 35, 41, 48, 55, 61, 68].map((h, i) => (
                  <div key={i} className="flex-1 rounded-t-sm bg-sky-400/35" style={{ height: `${h}%` }} />
                ))}
              </div>
              <p className="mt-2 text-[8.5px] tx4">
                {rtl ? "KPI: Cycle Time · Rejection Rate · MDR S-Curve · SLA Breach" : "KPIs: Cycle Time · Rejection Rate · MDR S-Curve · SLA Breach"}
              </p>
            </div>
          </div>
        )}

        {tab === "mdr" && (
          <div className="fade-rise space-y-3">
            <div className="glass-dark flex flex-wrap items-center gap-2 rounded-xl p-2.5">
              <span className="text-[10px] font-normal tx1">{rtl ? "ثبت مدرک در MDR:" : "Register in MDR:"}</span>
              <input value={newDocCode} onChange={(e) => setNewDocCode(e.target.value)} placeholder="OG-2401-ELE-DS-002" dir="ltr" className="w-48 rounded-lg border b-line-soft bg-black/20 px-2 py-1 text-[10px] tx1 outline-none" />
              <input value={newDocTitle} onChange={(e) => setNewDocTitle(e.target.value)} placeholder={rtl ? "عنوان مدرک…" : "Title…"} className="w-56 rounded-lg border b-line-soft bg-black/20 px-2 py-1 text-[10px] tx1 outline-none" />
              <select value={newDocDiscipline} onChange={(e) => setNewDocDiscipline(e.target.value)} className="rounded-lg border b-line-soft bg-black/20 px-2 py-1 text-[10px] tx1 outline-none" style={{ colorScheme: "dark" }}>
                {["Civil", "Mechanical", "Piping", "Electrical", "Instrumentation", "Process"].map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <button onClick={addDocument} className="rounded-lg border border-sky-400/50 bg-sky-400/15 px-3 py-1 text-[10px] font-light text-sky-200 hover:bg-sky-400/25">+ {rtl ? "ثبت" : "Add"}</button>
            </div>
            <DocTable lang={lang} rtl={rtl} rows={filtered} />
          </div>
        )}

        {tab === "revision" && (
          <div className="fade-rise glass-dark rounded-2xl p-3 space-y-2">
            <div className="text-[11px] font-normal tx1">{rtl ? "تاریخچه نسخه — فایل اصلی به‌عنوان Evidence" : "Revision history — original file kept as evidence"}</div>
            <table className="w-full border-collapse text-[10px]">
              <thead>
                <tr className="border-b b-line-soft text-[9px] tx3">
                  <th className="px-2 py-2 text-start">{rtl ? "کد" : "Code"}</th>
                  <th className="px-2 py-2 text-center">{rtl ? "از" : "From"}</th>
                  <th className="px-2 py-2 text-center">{rtl ? "به" : "To"}</th>
                  <th className="px-2 py-2 text-start">{rtl ? "تغییر" : "Change"}</th>
                </tr>
              </thead>
              <tbody className="divide-y b-line-soft">
                <tr>
                  <td className="px-2 py-1.5 font-mono tx2" dir="ltr">OG-2401-CIV-DR-001</td>
                  <td className="px-2 py-1.5 text-center text-sky-300">Rev-01</td>
                  <td className="px-2 py-1.5 text-center text-emerald-300">Rev-02</td>
                  <td className="px-2 py-1.5 tx1">{rtl ? "اصلاح تراز فونداسیون پس از Code 2" : "Foundation level after Code 2"}</td>
                </tr>
                <tr>
                  <td className="px-2 py-1.5 font-mono tx2" dir="ltr">OG-2401-ELE-SLD-007</td>
                  <td className="px-2 py-1.5 text-center text-sky-300">Rev-02</td>
                  <td className="px-2 py-1.5 text-center text-amber-300">Rev-03</td>
                  <td className="px-2 py-1.5 tx1">{rtl ? "بازگشت Code 3 — مسیر کابل" : "Code 3 return — cable route"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {tab === "workflow" && (
          <div className="fade-rise space-y-2">
            <div className="glass-dark rounded-2xl p-3 text-[10px] tx2">
              {rtl ? "ماشین وضعیت: Draft → Issued → C1/C2/C3/C4 → Approved / IFC · SLA و تشدید پیکربندی‌پذیر" : "State: Draft → Issued → C1/C2/C3/C4 → Approved / IFC · configurable SLA & escalation"}
            </div>
            {wfTasks.map((w) => (
              <div key={w.id} className="glass-dark flex flex-wrap items-center gap-3 rounded-xl p-3">
                <span className="font-mono text-[10px] text-sky-300" dir="ltr">{w.doc}</span>
                <span className="text-[10.5px] tx1">{t(w.step, lang)}</span>
                <span className="text-[9.5px] tx3">{t(w.owner, lang)}</span>
                <span className="ms-auto rounded bg-amber-400/15 px-2 py-0.5 text-[8.5px] text-amber-300">{w.sla}</span>
                <span className="rounded bg-sky-400/15 px-2 py-0.5 text-[8.5px] text-sky-200">{w.code}</span>
              </div>
            ))}
          </div>
        )}

        {tab === "excel" && (
          <div className="fade-rise grid gap-2 md:grid-cols-3">
            {[
              { id: "A", fa: "A · ورود قالب", en: "A · Template onboarding", d: { fa: "قالب Excel → FormTemplate + MappingSchema. شیت مخفی _META.", en: "Excel template → FormTemplate + MappingSchema. Hidden _META sheet." } },
              { id: "B", fa: "B · ورود انبوه", en: "B · Bulk import", d: { fa: "اعتبارسنجی سلول‌محور. خطا در Import_Error. فایل اصلی Evidence.", en: "Cell-level validation. Errors in Import_Error. Original kept as evidence." } },
              { id: "C", fa: "C · بازتولید", en: "C · Render / export", d: { fa: "داده از DB رندر می‌شود. Round-Trip بدون از دست رفتن فرمت.", en: "Data rendered from DB. Round-trip keeps formatting." } },
            ].map((s) => (
              <div key={s.id} className="glass-dark rounded-2xl p-3">
                <div className="text-[11px] font-medium text-sky-300">{rtl ? s.fa : s.en}</div>
                <p className="mt-2 text-[10px] font-light leading-5 tx2">{t(s.d, lang)}</p>
              </div>
            ))}
          </div>
        )}

        {tab === "numbering" && (
          <div className="fade-rise glass-dark rounded-2xl p-3 space-y-3">
            <div className="text-[11px] tx1">{rtl ? "قانون: {PROJ}-{DISC}-{TYPE}-{SEQ:3}" : "Rule: {PROJ}-{DISC}-{TYPE}-{SEQ:3}"}</div>
            <p className="text-[10px] tx3" dir="ltr">PROJ=OG-2401 · DISC=CIV · TYPE=DR · SEQ locked (no race)</p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg border b-line-soft px-3 py-1.5 font-mono text-[12px] text-sky-200" dir="ltr">{reserved}</span>
              <button
                onClick={() => setReserved((c) => {
                  const n = Number(c.slice(-3)) + 1;
                  return `OG-2401-CIV-DR-${String(n).padStart(3, "0")}`;
                })}
                className="rounded-lg border border-sky-400/50 bg-sky-400/15 px-3 py-1 text-[10px] text-sky-200"
              >
                {rtl ? "رزرو شماره بعدی" : "Reserve next"}
              </button>
            </div>
          </div>
        )}

        {tab === "correspondence" && (
          <div className="fade-rise glass-dark overflow-x-auto rounded-2xl p-3">
            <table className="w-full min-w-[720px] border-collapse text-[10px]">
              <thead>
                <tr className="border-b b-line-soft bg-black/25 text-[9px] tx3">
                  <th className="px-2 py-2 text-start">{rtl ? "شماره" : "No"}</th>
                  <th className="px-2 py-2 text-start">{rtl ? "موضوع" : "Subject"}</th>
                  <th className="px-2 py-2 text-center">{rtl ? "از / به" : "From / To"}</th>
                  <th className="px-2 py-2 text-center">{rtl ? "اقدام" : "Action"}</th>
                </tr>
              </thead>
              <tbody className="divide-y b-line-soft">
                {sampleLetters.map((row) => (
                  <tr key={row.id}>
                    <td className="px-2 py-1.5 font-mono tx2" dir="ltr">{row.letterNo}</td>
                    <td className="px-2 py-1.5 tx1">{t(row.subject, lang)}</td>
                    <td className="px-2 py-1.5 text-center tx3">{t(row.sender, lang)} → {t(row.receiver, lang)}</td>
                    <td className="px-2 py-1.5 text-center">
                      {row.actionRequired
                        ? <span className="text-amber-300">{rtl ? "مهلت" : "Due"} {row.dueDate}</span>
                        : <span className="tx4">{rtl ? "اطلاعی" : "Info"}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "transmittal" && (
          <div className="fade-rise glass-dark overflow-x-auto rounded-2xl p-3">
            <table className="w-full min-w-[640px] border-collapse text-[10px]">
              <thead>
                <tr className="border-b b-line-soft bg-black/25 text-[9px] tx3">
                  <th className="px-2 py-2 text-start">{rtl ? "ترانسمیتال" : "Transmittal"}</th>
                  <th className="px-2 py-2 text-start">{rtl ? "هدف" : "Purpose"}</th>
                  <th className="px-2 py-2 text-center">{rtl ? "تعداد" : "Count"}</th>
                  <th className="px-2 py-2 text-center">{rtl ? "وضعیت" : "Status"}</th>
                </tr>
              </thead>
              <tbody className="divide-y b-line-soft">
                {sampleTransmittals.map((tr) => (
                  <tr key={tr.id}>
                    <td className="px-2 py-1.5 font-mono tx2" dir="ltr">{tr.transmittalNo}</td>
                    <td className="px-2 py-1.5 tx1">{t(tr.purpose, lang)}</td>
                    <td className="px-2 py-1.5 text-center text-sky-300">{tr.docCount}</td>
                    <td className="px-2 py-1.5 text-center">
                      <span className={tr.status === "ack" ? "text-emerald-300" : "text-sky-300"}>
                        {tr.status === "ack" ? (rtl ? "رسید" : "Ack") : (rtl ? "ارسال" : "Sent")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "lessons" && (
          <div className="fade-rise space-y-2.5">
            {sampleLessons.map((ls) => (
              <div key={ls.id} className="glass-dark rounded-2xl p-3.5 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11.5px] font-medium text-sky-300">{t(ls.title, lang)}</span>
                  <span className="rounded bg-sky-400/10 px-2 py-0.5 text-[8.5px] text-sky-200">{t(ls.category, lang)}</span>
                </div>
                <div className="text-[10px] tx3">{rtl ? "اثر:" : "Impact:"} {t(ls.impact, lang)}</div>
                <div className="rounded-xl border b-line-soft bg-black/15 p-2.5 text-[10.5px] font-light tx1 leading-5">
                  {t(ls.lesson, lang)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DocTable({ lang, rtl, rows }: { lang: Lang; rtl: boolean; rows: DocumentRow[] }) {
  return (
    <div className="glass-dark overflow-x-auto rounded-2xl p-3">
      <table className="w-full min-w-[780px] border-collapse text-[10px]">
        <thead>
          <tr className="border-b b-line-soft bg-black/25 text-[9px] font-extralight tx3">
            <th className="px-2 py-2 text-start">{rtl ? "کد مدرک" : "Doc Code"}</th>
            <th className="px-2 py-2 text-start">{rtl ? "عنوان" : "Title"}</th>
            <th className="px-2 py-2 text-center">{rtl ? "دیسپلین" : "Disc."}</th>
            <th className="px-2 py-2 text-center">{rtl ? "نسخه" : "Rev"}</th>
            <th className="px-2 py-2 text-center">Code</th>
            <th className="px-2 py-2 text-center">{rtl ? "وضعیت" : "Status"}</th>
          </tr>
        </thead>
        <tbody className="divide-y b-line-soft">
          {rows.map((doc) => {
            const st = statusMetaDoc[doc.status];
            return (
              <tr key={doc.id} className="hover:bg-white/[0.02]">
                <td className="px-2 py-1.5 font-mono text-[9.5px] tx2" dir="ltr">{doc.code}</td>
                <td className="px-2 py-1.5 tx1">{t(doc.title, lang)}</td>
                <td className="px-2 py-1.5 text-center tx3">{doc.discipline}</td>
                <td className="px-2 py-1.5 text-center font-mono text-sky-300" dir="ltr">{doc.revision}</td>
                <td className="px-2 py-1.5 text-center font-mono text-[9px] tx2">{doc.reviewCode}</td>
                <td className="px-2 py-1.5 text-center">
                  <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[8.5px]" style={{ background: `${st.color}18`, color: st.color }}>
                    {t({ fa: st.fa, en: st.en }, lang)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
