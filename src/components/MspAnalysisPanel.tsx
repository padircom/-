import { useMemo, useRef, useState } from "react";
import { type Lang } from "../data/framework";
import { type ImportedTask, MSP_TASKS_SEED, mspAnalysis } from "../services/scheduleInsights";
import { parseScheduleFile } from "../services/mspImport";

/* ══════════════════════════════════════════════════════════════════════
   داشبورد «تحلیل برنامهٔ وارداتی (MSP / P6)» — دامنهٔ d2
   هفت شاخصِ سبک‌شدهٔ DCMA + نمرهٔ سلامت. خروجی برای اصلاحِ شبکه است،
   نه برای رتبه‌دادن به برنامه.
   ══════════════════════════════════════════════════════════════════════ */

const tone: Record<"ok" | "warn" | "bad", string> = { ok: "#34D399", warn: "#FBBF24", bad: "#F87171" };
const gradeColor: Record<string, string> = { A: "#34D399", B: "#7FB2FF", C: "#FBBF24", D: "#F87171" };

export default function MspAnalysisPanel({ lang }: { lang: Lang }) {
  const rtl = lang === "fa";
  const [tasks, setTasks] = useState<ImportedTask[] | null>(null);
  const [sourceLabel, setSourceLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const res = useMemo(() => mspAnalysis(tasks ?? MSP_TASKS_SEED), [tasks]);

  const onFile = async (file: File) => {
    setError(null);
    try {
      const text = await file.text();
      const parsed = parseScheduleFile(file.name, text);
      if (!parsed.length) throw new Error("EMPTY");
      setTasks(parsed);
      setSourceLabel(file.name);
    } catch {
      setError(
        rtl
          ? "فایل خوانده نشد. قالبِ پشتیبانی‌شده: XML یا CSVِ صادرشده از MSP/P6 (خروجیِ .mpp باینری است و در مرورگر خوانده نمی‌شود)."
          : "Could not read the file. Supported: MS Project/P6 XML or CSV export (the .mpp binary cannot be read in the browser).",
      );
    }
  };
  const num = (n: number) => Math.round(n).toLocaleString(rtl ? "fa-IR" : "en-US");
  const pct = (n: number) => `${(n * 100).toLocaleString(rtl ? "fa-IR" : "en-US", { maximumFractionDigits: 1 })}%`;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden" dir={rtl ? "rtl" : "ltr"}>
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        <div className="rounded-xl border b-line-soft bg-[var(--row)] p-3">
          <div className="text-[8.5px] font-extralight tx4">{rtl ? "تعداد فعالیت‌ها" : "Activity count"}</div>
          <div className="mt-1 text-[13px] font-light tx1">{num(res.taskCount)}</div>
          <div className="mt-0.5 text-[9px] font-extralight tx3">
            {sourceLabel ? (rtl ? `منبع: ${sourceLabel}` : `source: ${sourceLabel}`) : (rtl ? "دادهٔ نمونه" : "seed data")}
          </div>
        </div>
        <div className="rounded-xl border b-line-soft bg-[var(--row)] p-3">
          <div className="text-[8.5px] font-extralight tx4">{rtl ? "نمرهٔ سلامت شبکه" : "Network health"}</div>
          <div className="mt-1 text-[16px] font-light" style={{ color: gradeColor[res.grade] }}>
            {num(res.health)}<span className="text-[10px] tx4"> / 100</span>
          </div>
        </div>
        <div className="rounded-xl border b-line-soft bg-[var(--row)] p-3">
          <div className="text-[8.5px] font-extralight tx4">{rtl ? "رتبه" : "Grade"}</div>
          <div className="mt-1 text-[16px] font-light" style={{ color: gradeColor[res.grade] }}>{res.grade}</div>
        </div>
        <div className="rounded-xl border b-line-soft bg-[var(--row)] p-3">
          <div className="text-[8.5px] font-extralight tx4">{rtl ? "شاخص‌های خارج از آستانه" : "Metrics over threshold"}</div>
          <div className="mt-1 text-[13px] font-light" style={{ color: res.findings.some((f) => f.severity === "bad") ? "#F87171" : "#34D399" }}>
            {num(res.findings.filter((f) => f.severity !== "ok").length)}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".xml,.csv,.json,.txt,text/xml,text/csv,application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="rounded-lg border b-line-soft bg-[var(--row)] px-2.5 py-1 text-[10px] font-light tx2 transition hover:tx1"
        >
          {rtl ? "بارگذاری فایل (XML/CSV/JSON)" : "Load file (XML/CSV/JSON)"}
        </button>
        {tasks && (
          <button
            type="button"
            onClick={() => {
              setTasks(null);
              setSourceLabel(null);
            }}
            className="rounded-lg border b-line-soft px-2.5 py-1 text-[10px] font-light tx3 transition hover:tx2"
          >
            {rtl ? "بازگشت به دادهٔ نمونه" : "Back to seed data"}
          </button>
        )}
        {error && <span className="text-[9.5px] text-rose-300">{error}</span>}
      </div>

      <div className="thin-scroll min-h-0 flex-1 overflow-auto rounded-xl border b-line-soft">
        <table className="w-full border-collapse text-[10px]">
          <thead className="sticky top-0 bg-[var(--panel2)]">
            <tr className="tx4">
              <th className="px-2 py-2 text-start font-light">{rtl ? "شاخص" : "Metric"}</th>
              <th className="px-2 py-2 text-end font-light">{rtl ? "تعداد" : "Count"}</th>
              <th className="px-2 py-2 text-end font-light">{rtl ? "سهم" : "Share"}</th>
              <th className="px-2 py-2 text-end font-light">{rtl ? "آستانه" : "Threshold"}</th>
              <th className="px-2 py-2 text-start font-light">{rtl ? "توضیح" : "Why it matters"}</th>
            </tr>
          </thead>
          <tbody>
            {res.findings.map((f) => (
              <tr key={f.code} className="border-t border-[var(--line-soft)]">
                <td className="px-2 py-1.5 tx1">{f.label[rtl ? "fa" : "en"]}</td>
                <td className="px-2 py-1.5 text-end tx2" dir="ltr">{num(f.count)}</td>
                <td className="px-2 py-1.5 text-end" dir="ltr" style={{ color: tone[f.severity] }}>{pct(f.count / Math.max(1, res.taskCount))}</td>
                <td className="px-2 py-1.5 text-end tx3" dir="ltr">{pct(f.threshold)}</td>
                <td className="px-2 py-1.5 tx3">{f.hint[rtl ? "fa" : "en"]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[9px] font-extralight tx4">
        {rtl
          ? "آستانه‌ها بر پایهٔ رویهٔ مرسومِ DCMA (۵٪ برای نقص‌های منطقی، ۱۰٪ برای فعالیت‌های بلند) تنظیم شده‌اند و در تنظیمات سامانه قابل تغییرند."
          : "Thresholds follow common DCMA practice (5% for logic defects, 10% for long durations) and are configurable in system settings."}
      </p>
    </div>
  );
}
