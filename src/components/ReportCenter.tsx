import { useMemo, useState } from "react";
import { type Lang } from "../data/framework";
import { logAudit } from "../services/auditLogger";
import { useAccess } from "../hooks/useAccess";
import {
  A4,
  REPORT_CATALOG,
  REPORT_ENGINE_VERSION,
  documentNumber,
  estimatePages,
  exportFileName,
  formatValue,
  primaveraColor,
  publishGate,
  statusLabel,
  toCsv,
  toExcelHtml,
  toPrintHtml,
  toWordHtml,
  totalRows,
  validateLetterhead,
  type Audience,
  type Letterhead,
  type ScheduleStatus,
} from "../services/reporting";

const TODAY = "2026-09-08";

const DEFAULT_LETTERHEAD: Letterhead = {
  projectName: "احداث واحد فرآورش گاز — فاز ۲",
  projectCode: "OG-2401",
  contractNo: "C-1403/2291",
  contractor: { name: "شرکت مهندسی و ساخت آرنا", logoText: "ARENA", role: { fa: "پیمانکار", en: "Contractor" } },
  client: { name: "شرکت ملی نفت ایران — مدیریت طرح", logoText: "NIOC", role: { fa: "کارفرما", en: "Client" } },
  consultant: { name: "مهندسان مشاور پارس طرح", logoText: "PARS", role: { fa: "مشاور", en: "Consultant" } },
  docNo: documentNumber("OG-2401", "RPT-M", 7, 1),
  revision: "R01",
  issueDate: TODAY,
  periodLabel: "1405-06",
  classification: "confidential",
  distribution: ["کارفرما", "مشاور", "مدیر پروژه", "دفتر فنی", "بایگانی"],
  preparedBy: "دفتر کنترل پروژه",
  approvedBy: "مدیر پروژه",
};

/* ─────────────── دانلود بدون کتابخانه ─────────────── */

function download(content: string, filename: string, mime: string, withBom = false) {
  // BOM برای اینکه اکسل فارسی را UTF-8 بخواند و حروف به‌هم‌ریخته نشود.
  const parts = withBom ? ["\uFEFF", content] : [content];
  const blob = new Blob(parts, { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function printHtml(html: string) {
  const w = window.open("", "_blank", "width=900,height=1200");
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 350);
  return true;
}

/* ─────────────── اجزای نمایشی ─────────────── */

function Field({ label, value, onChange, wide = false }: { label: string; value: string; onChange: (v: string) => void; wide?: boolean }) {
  return (
    <label className={`block ${wide ? "sm:col-span-2" : ""}`}>
      <span className="text-[8px] font-extralight tx3">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-0.5 w-full rounded-lg border b-line-soft bg-black/25 px-2 py-1 text-[9.5px] tx1 outline-none focus:border-sky-400/50"
      />
    </label>
  );
}

/* ══════════════════════════ کامپوننت اصلی ══════════════════════════ */

export default function ReportCenter({
  lang,
  blockers = { openMajorNcr: 0, unapprovedPeriod: false, timeBarBreach: 2 },
}: {
  lang: Lang;
  blockers?: { openMajorNcr?: number; unapprovedPeriod?: boolean; timeBarBreach?: number };
}) {
  const rtl = lang === "fa";
  const [code, setCode] = useState("RPT-M");
  const [audience, setAudience] = useState<Audience>("internal");
  const [lh, setLh] = useState<Letterhead>(DEFAULT_LETTERHEAD);
  const [note, setNote] = useState<string | null>(null);

  // RBAC: انتشار نسخهٔ ابلاغی مجوز مستقل می‌خواهد (شکاف RPT R-06).
  const { can, explain } = useAccess();
  const permission = audience === "official" ? "report.official.publish" : "report.internal.generate";
  const rbac = explain(permission);

  const report = useMemo(() => REPORT_CATALOG.find((r) => r.code === code)!, [code]);
  const issues = useMemo(() => validateLetterhead(lh, audience), [lh, audience]);
  const gate = useMemo(() => publishGate(audience, blockers), [audience, blockers]);
  const errors = issues.filter((i) => i.severity === "error");
  const canExport = errors.length === 0 && gate.ok && rbac.allow;
  // خروجی انبوه CSV/Excel مجوز جداگانه دارد.
  const canBulk = can("report.export.bulk");

  const T = (b: { fa: string; en: string }) => (rtl ? b.fa : b.en);
  const set = (patch: Partial<Letterhead>) => setLh((p) => ({ ...p, ...patch }));

  const doExport = (kind: "pdf" | "doc" | "xls" | "csv") => {
    if (!rbac.allow) {
      setNote(`${rtl ? "دسترسی رد شد — " : "Access denied — "}${rtl ? rbac.reason.fa : rbac.reason.en}`);
      logAudit("RPT_EXPORT_DENIED", "Reporting", `${report.code} · ${permission} · ${rbac.code}`, "security");
      return;
    }
    if (!canExport) {
      setNote(rtl ? "خروجی مسدود است — ایرادهای سربرگ یا دروازه انتشار را برطرف کنید" : "Export blocked — resolve letterhead or gate issues");
      return;
    }
    if ((kind === "csv" || kind === "xls") && !canBulk) {
      setNote(rtl ? "خروجی انبوه داده نیازمند مجوز report.export.bulk است" : "Bulk data export requires report.export.bulk");
      logAudit("RPT_EXPORT_DENIED", "Reporting", `${report.code} · report.export.bulk`, "security");
      return;
    }
    const name = exportFileName(report, lh, kind);
    if (kind === "pdf") {
      const ok = printHtml(toPrintHtml(report, lh, audience, lang));
      setNote(ok ? (rtl ? "پنجره چاپ باز شد — مقصد را «ذخیره به PDF» انتخاب کنید" : "Print dialog opened — choose Save as PDF") : rtl ? "مرورگر پنجره را مسدود کرد" : "Popup blocked");
    } else if (kind === "doc") {
      download(toWordHtml(report, lh, audience, lang), name, "application/msword");
      setNote(`${rtl ? "فایل Word ساخته شد: " : "Word file created: "}${name}`);
    } else if (kind === "xls") {
      download(toExcelHtml(report, lh, lang), name, "application/vnd.ms-excel", true);
      setNote(`${rtl ? "فایل Excel ساخته شد: " : "Excel file created: "}${name}`);
    } else {
      download(toCsv(report, lang), name, "text/csv;charset=utf-8", true);
      setNote(`${rtl ? "فایل CSV ساخته شد: " : "CSV file created: "}${name}`);
    }
    logAudit("RPT_EXPORT", "Reporting", `${report.code} · ${audience} · ${kind} · ${lh.docNo}`);
  };

  return (
    <div className="fade-rise flex min-h-0 flex-col gap-3" dir={rtl ? "rtl" : "ltr"}>
      {/* نوار وضعیت */}
      <div className="glass-dark flex flex-wrap items-center gap-2 rounded-2xl p-2.5">
        <span className="grid h-7 w-7 place-items-center rounded-lg border border-sky-400/40 bg-sky-400/10 text-[13px]">🖨</span>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold tx1">{rtl ? "مرکز گزارش‌ساز A4 سه‌لوگو" : "A4 Three-Logo Report Centre"}</div>
          <div className="text-[8px] font-extralight tx3">
            {rtl
              ? "دو قالب داخلی و ابلاغی · خروجی PDF، Word، Excel و CSV · رنگ‌بندی پریماورا · بدون کتابخانه بیرونی"
              : "internal & official templates · PDF, Word, Excel, CSV · Primavera colouring · no external library"}
          </div>
        </div>
        <span className="rounded-lg border b-line-soft px-2 py-1 text-[9px] tx3" dir="ltr">{REPORT_CATALOG.length} reports</span>
        <span className="rounded-lg border b-line-soft px-2 py-1 font-mono text-[9px] tx3" dir="ltr">{REPORT_ENGINE_VERSION}</span>
      </div>

      <div className="grid gap-3 xl:grid-cols-[220px_270px_1fr]">
        {/* ستون ۱: کاتالوگ */}
        <section className="glass-dark rounded-2xl p-2.5">
          <h4 className="mb-2 text-[10px] font-semibold tx1">{rtl ? "کاتالوگ گزارش" : "Report catalogue"}</h4>
          <div className="thin-scroll max-h-[520px] space-y-1 overflow-y-auto pr-0.5">
            {REPORT_CATALOG.map((r) => {
              const allowed = r.audiences.includes(audience);
              return (
                <button
                  key={r.code}
                  onClick={() => setCode(r.code)}
                  className={`glass-row w-full rounded-lg px-2 py-1.5 text-start transition ${code === r.code ? "row-on" : ""} ${allowed ? "" : "opacity-40"}`}
                  title={allowed ? r.sourceModule : rtl ? "برای این قالب مجاز نیست" : "not available for this template"}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[8px] tx4" dir="ltr">{r.code}</span>
                    {!allowed && <span className="text-[7.5px] text-amber-300">✕</span>}
                  </div>
                  <div className="truncate text-[9.5px] font-light tx1">{T(r.title)}</div>
                  <div className="text-[7.5px] tx4">{r.periodicity} · {r.sourceModule}</div>
                </button>
              );
            })}
          </div>
        </section>

        {/* ستون ۲: تنظیمات */}
        <section className="glass-dark rounded-2xl p-2.5">
          <h4 className="mb-2 text-[10px] font-semibold tx1">{rtl ? "قالب و سربرگ" : "Template & letterhead"}</h4>

          <div className="mb-2 flex gap-1 rounded-xl bg-black/20 p-1">
            {(["internal", "official"] as Audience[]).map((a) => (
              <button
                key={a}
                onClick={() => setAudience(a)}
                className={`flex-1 rounded-lg px-2 py-1.5 text-[9px] font-light transition ${audience === a ? "toggle-on tx1" : "tx3 hover:tx2"}`}
              >
                {a === "internal" ? (rtl ? "داخلی / کاربر" : "Internal") : rtl ? "ابلاغی / رسمی" : "Official"}
              </button>
            ))}
          </div>

          <div className="thin-scroll max-h-[440px] space-y-2 overflow-y-auto pr-0.5">
            <div className="grid grid-cols-2 gap-1.5">
              <Field label={rtl ? "نام پروژه" : "Project"} value={lh.projectName} onChange={(v) => set({ projectName: v })} wide />
              <Field label={rtl ? "کد پروژه" : "Code"} value={lh.projectCode} onChange={(v) => set({ projectCode: v })} />
              <Field label={rtl ? "شماره پیمان" : "Contract"} value={lh.contractNo} onChange={(v) => set({ contractNo: v })} />
            </div>

            <div className="rounded-xl border b-line-soft bg-black/10 p-2">
              <div className="mb-1 text-[8.5px] font-semibold tx2">{rtl ? "سه لوگو" : "Three logos"}</div>
              <div className="grid grid-cols-2 gap-1.5">
                <Field label={rtl ? "لوگوی پیمانکار" : "Contractor logo"} value={lh.contractor.logoText} onChange={(v) => set({ contractor: { ...lh.contractor, logoText: v } })} />
                <Field label={rtl ? "نام پیمانکار" : "Contractor"} value={lh.contractor.name} onChange={(v) => set({ contractor: { ...lh.contractor, name: v } })} />
                <Field label={rtl ? "لوگوی کارفرما" : "Client logo"} value={lh.client.logoText} onChange={(v) => set({ client: { ...lh.client, logoText: v } })} />
                <Field label={rtl ? "نام کارفرما" : "Client"} value={lh.client.name} onChange={(v) => set({ client: { ...lh.client, name: v } })} />
                <Field label={rtl ? "لوگوی مشاور" : "Consultant logo"} value={lh.consultant.logoText} onChange={(v) => set({ consultant: { ...lh.consultant, logoText: v } })} />
                <Field label={rtl ? "نام مشاور" : "Consultant"} value={lh.consultant.name} onChange={(v) => set({ consultant: { ...lh.consultant, name: v } })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <Field label={rtl ? "شماره سند" : "Doc no"} value={lh.docNo} onChange={(v) => set({ docNo: v })} wide />
              <Field label={rtl ? "نسخه" : "Revision"} value={lh.revision} onChange={(v) => set({ revision: v })} />
              <Field label={rtl ? "دوره" : "Period"} value={lh.periodLabel} onChange={(v) => set({ periodLabel: v })} />
              <Field label={rtl ? "تهیه‌کننده" : "Prepared by"} value={lh.preparedBy} onChange={(v) => set({ preparedBy: v })} />
              <Field label={rtl ? "تأییدکننده" : "Approved by"} value={lh.approvedBy} onChange={(v) => set({ approvedBy: v })} />
              <Field label={rtl ? "فهرست توزیع (با کاما)" : "Distribution (comma)"} value={lh.distribution.join("،")} onChange={(v) => set({ distribution: v.split(/[,،]/).map((s) => s.trim()).filter(Boolean) })} wide />
            </div>

            <button
              onClick={() => set({ docNo: documentNumber(lh.projectCode, report.code, 7, Number(lh.revision.replace(/\D/g, "")) || 1) })}
              className="glass-row w-full rounded-lg px-2 py-1.5 text-[9px] font-light tx2 transition hover:tx1"
            >
              {rtl ? "تولید خودکار شماره سند" : "Generate document number"}
            </button>
          </div>
        </section>

        {/* ستون ۳: پیش‌نمای A4 و خروجی */}
        <section className="glass-dark flex min-w-0 flex-col rounded-2xl p-2.5">
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <h4 className="text-[10px] font-semibold tx1">{rtl ? "پیش‌نمای A4" : "A4 preview"}</h4>
            <span className="rounded border b-line-soft px-1.5 py-[1px] text-[8px] tx4" dir="ltr">
              {A4.widthMm}×{A4.heightMm}mm
            </span>
            <span className="rounded border b-line-soft px-1.5 py-[1px] text-[8px] tx4" dir="ltr">
              ~{estimatePages(report)}p · {totalRows(report)} rows
            </span>
            <div className="ms-auto flex flex-wrap gap-1">
              {([
                ["pdf", "PDF"],
                ["doc", "Word"],
                ["xls", "Excel"],
                ["csv", "CSV"],
              ] as const).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => doExport(k)}
                  disabled={!canExport || ((k === "csv" || k === "xls") && !canBulk)}
                  title={(k === "csv" || k === "xls") && !canBulk ? "report.export.bulk" : permission}
                  className={`rounded-lg px-2.5 py-1 text-[9px] font-light transition ${
                    canExport && !((k === "csv" || k === "xls") && !canBulk) ? "glass-row tx2 hover:tx1" : "cursor-not-allowed border b-line-soft tx4 opacity-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* دروازه و ایرادها */}
          {!rbac.allow && (
            <div className="mb-2 rounded-lg bg-rose-400/10 px-2 py-1 text-[8.5px] text-rose-300">
              {rtl ? "کنترل دسترسی: " : "Access control: "}
              {rtl ? rbac.reason.fa : rbac.reason.en} · <span dir="ltr">{permission}</span> · <span dir="ltr">{rbac.code}</span>
            </div>
          )}
          {(errors.length > 0 || !gate.ok || issues.some((i) => i.severity === "warning")) && (
            <div className="mb-2 space-y-1">
              {!gate.ok && (
                <div className="rounded-lg bg-rose-400/10 px-2 py-1 text-[8.5px] text-rose-300">
                  {rtl ? "دروازه انتشار رسمی بسته است: " : "Official publish gate closed: "}
                  {gate.reasons.join(" · ")}
                </div>
              )}
              {issues.map((i, k) => (
                <div key={k} className={`rounded-lg px-2 py-1 text-[8.5px] ${i.severity === "error" ? "bg-rose-400/10 text-rose-300" : "bg-amber-400/10 text-amber-200"}`}>
                  <span dir="ltr">{i.code}</span> · {i.message}
                </div>
              ))}
            </div>
          )}
          {note && <div className="mb-2 rounded-lg bg-sky-400/10 px-2 py-1 text-[8.5px] text-sky-300">{note}</div>}

          {/* برگه A4 — نسبت ابعاد واقعی */}
          <div className="thin-scroll min-h-0 flex-1 overflow-auto rounded-xl bg-neutral-200/95 p-3">
            <div
              className="mx-auto bg-white text-black shadow-lg"
              style={{ width: "210mm", minHeight: "297mm", padding: `${A4.marginTopMm / 2}mm ${A4.marginSideMm}mm ${A4.marginBottomMm}mm`, transform: "scale(0.62)", transformOrigin: rtl ? "top right" : "top left" }}
              dir={rtl ? "rtl" : "ltr"}
            >
              {/* سربرگ سه‌لوگو */}
              <div className="flex items-start gap-3 border-b-2 pb-2" style={{ borderColor: "#1F6FB2" }}>
                {[lh.contractor, lh.consultant, lh.client].map((p, i) => (
                  <div key={i} className={`w-[22%] ${i === 1 ? "order-last" : ""} text-center`}>
                    <div className="mx-auto inline-block min-w-[22mm] rounded border border-neutral-400 px-2 py-1 text-[11pt] font-bold">{p.logoText || "—"}</div>
                    <div className="mt-0.5 text-[7.5pt] leading-tight">{p.name}</div>
                    <div className="text-[6.5pt] text-neutral-500">{T(p.role)}</div>
                  </div>
                ))}
                <div className="flex-1 text-center">
                  <div className="text-[13pt] font-bold leading-tight">{lh.projectName}</div>
                  <div className="text-[8pt] text-neutral-600">{lh.projectCode} · {lh.contractNo}</div>
                  <div
                    className={`mt-1 inline-block rounded px-2 py-0.5 text-[8pt] ${audience === "official" ? "text-white" : "border border-dashed border-neutral-400 text-neutral-600"}`}
                    style={audience === "official" ? { background: "#1F6FB2" } : undefined}
                  >
                    {audience === "official" ? (rtl ? "نسخه ابلاغی — رسمی" : "OFFICIAL ISSUE") : rtl ? "نسخه داخلی — کاری" : "INTERNAL — WORKING COPY"}
                  </div>
                </div>
              </div>

              {/* نوار سند */}
              <table className="mt-2 w-full border-collapse text-[8pt]">
                <tbody>
                  <tr>
                    {[
                      [rtl ? "شماره سند" : "Doc no", lh.docNo || "—"],
                      [rtl ? "نسخه" : "Rev", lh.revision || "—"],
                      [rtl ? "دوره" : "Period", lh.periodLabel],
                      [rtl ? "تاریخ" : "Issued", lh.issueDate],
                    ].map(([k, v]) => (
                      <td key={k} className="border border-neutral-300 px-1.5 py-0.5">
                        {k}: <b>{v}</b>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>

              <h2 className="mt-3 text-[12pt] font-bold">{T(report.title)}</h2>

              {/* بخش‌ها */}
              {report.sections.map((sec, si) => (
                <div key={si} className="mt-4" style={{ pageBreakInside: "avoid" }}>
                  <h3 className="mb-1 border-s-4 ps-2 text-[10.5pt] font-semibold" style={{ borderColor: "#1F6FB2" }}>
                    {T(sec.title)}
                  </h3>
                  {sec.kind === "kpi" && (
                    <table className="w-full border-collapse">
                      <tbody>
                        <tr>
                          {sec.cells.map((c, ci) => (
                            <td key={ci} className="border border-neutral-300 p-2 text-center">
                              <span className="block text-[7.5pt] text-neutral-600">{T(c.label)}</span>
                              <span
                                className="block text-[12pt] font-bold"
                                style={{ color: c.tone === "good" ? "#2E9E4F" : c.tone === "warn" ? "#F5A623" : c.tone === "bad" ? "#D0021B" : undefined }}
                              >
                                {c.value}
                              </span>
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  )}
                  {sec.kind === "text" && <p className="text-[9pt] leading-relaxed">{T(sec.body)}</p>}
                  {sec.kind === "table" && (
                    <>
                      {sec.note && <p className="mb-1 text-[8pt] text-neutral-500">{T(sec.note)}</p>}
                      <table className="w-full border-collapse text-[8.5pt]">
                        <thead>
                          <tr>
                            {sec.columns.map((c) => (
                              <th key={c.key} className="border border-neutral-400 px-1.5 py-1 text-start font-semibold" style={{ background: "#EDF2F7" }}>
                                {T(c.title)}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sec.rows.map((r, ri) => (
                            <tr key={ri} style={{ background: ri % 2 ? "#F7FAFC" : undefined }}>
                              {sec.columns.map((c) => {
                                const raw = r[c.key];
                                if (c.format === "status") {
                                  const st = String(raw) as ScheduleStatus;
                                  return (
                                    <td key={c.key} className="border border-neutral-300 px-1.5 py-1 text-center text-white" style={{ background: primaveraColor(st) }}>
                                      {statusLabel(st, lang)}
                                    </td>
                                  );
                                }
                                return (
                                  <td key={c.key} className="border border-neutral-300 px-1.5 py-1" style={{ textAlign: c.align ?? "start" }}>
                                    {formatValue(raw, c.format, lang)}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}
                </div>
              ))}

              {/* امضا و توزیع فقط در نسخه رسمی */}
              {audience === "official" && (
                <>
                  <table className="mt-6 w-full border-collapse text-[8.5pt]">
                    <tbody>
                      <tr>
                        {[
                          [rtl ? "تهیه‌کننده" : "Prepared by", lh.preparedBy],
                          [rtl ? "تأییدکننده" : "Approved by", lh.approvedBy],
                          [rtl ? "مهر و امضای کارفرما" : "Client stamp", ""],
                        ].map(([k, v]) => (
                          <td key={k} className="h-[18mm] w-1/3 border border-neutral-300 p-1.5 align-top">
                            {k}
                            <br />
                            <b>{v}</b>
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                  <div className="mt-2 text-[8pt] text-neutral-700">
                    <b>{rtl ? "فهرست توزیع: " : "Distribution: "}</b>
                    {lh.distribution.join(rtl ? "، " : ", ")}
                  </div>
                </>
              )}

              <div className="mt-4 flex justify-between border-t border-neutral-300 pt-1 text-[7.5pt] text-neutral-500">
                <span>{lh.projectCode} · {lh.docNo || "—"}</span>
                <span>{REPORT_ENGINE_VERSION} · {lh.issueDate}</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
