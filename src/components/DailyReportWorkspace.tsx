import { useEffect, useState } from "react";
import { type Lang } from "../data/framework";
import { pmisApiClient } from "../services/pmisApiClient";
import { useSystem } from "../context/SystemContext";
import { useAuth } from "../context/AuthContext";
import ReportWorkflowPanel from "./ReportWorkflowPanel";

type TemplateKind = "internal" | "mandated";
type FormatInfo = { label: string; icon: string; color: string; previewable: "pdf" | "image" | "text" | "none" };
type StoredTemplate = {
  fileName: string;
  format: FormatInfo;
  size: string;
  importedAt: string;
  dataUrl?: string;
  textPreview?: string;
  remoteTemplateId?: string;
  fileId?: string;
  downloadUrl?: string;
  syncStatus?: "syncing" | "synced" | "local";
};

const TEMPLATE_STORE = "pms:daily-report-master-templates:v1";

const guessFormat = (name: string): FormatInfo => {
  const n = name.toLowerCase();
  if (n.endsWith(".docx") || n.endsWith(".doc")) return { label: "Word", icon: "📄", color: "#2B5AA8", previewable: "none" };
  if (n.endsWith(".xlsx") || n.endsWith(".xls")) return { label: "Excel", icon: "📊", color: "#217346", previewable: "none" };
  if (n.endsWith(".csv")) return { label: "CSV", icon: "📋", color: "#0EA5E9", previewable: "text" };
  if (n.endsWith(".pdf")) return { label: "PDF", icon: "📕", color: "#DC2626", previewable: "pdf" };
  if (n.match(/\.(png|jpe?g|webp|gif|bmp)$/)) return { label: "Image", icon: "🖼", color: "#10B981", previewable: "image" };
  return { label: "File", icon: "📎", color: "#94A3B8", previewable: "none" };
};

const loadTemplates = (): Partial<Record<TemplateKind, StoredTemplate>> => {
  try {
    const raw = JSON.parse(window.localStorage.getItem(TEMPLATE_STORE) ?? "{}") as Partial<Record<TemplateKind, StoredTemplate>>;
    (Object.keys(raw) as TemplateKind[]).forEach((key) => {
      const template = raw[key];
      if (template && !template.format.previewable) template.format = guessFormat(template.fileName);
    });
    return raw;
  } catch {
    return {};
  }
};

export default function DailyReportWorkspace({ lang }: { lang: Lang }) {
  const rtl = lang === "fa";
  const { projectScope, projectsByCluster } = useSystem();
  const { can, audit } = useAuth();

  const [templates, setTemplates] = useState(loadTemplates);
  const [activeTemplate, setActiveTemplate] = useState<TemplateKind>("internal");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [reportSyncStatus, setReportSyncStatus] = useState<"idle" | "syncing" | "synced" | "local">("idle");
  const [savedReportId, setSavedReportId] = useState<string | null>(null);
  const [logos, setLogos] = useState<{ client: string | null; consultant: string | null; contractor: string | null }>({
    client: null,
    consultant: null,
    contractor: null,
  });

  const [header, setHeader] = useState({
    projectNo: "-",
    projectName: "نام پروژه",
    contractNo: "-",
    reportNo: "۱",
    page: "۱",
    date: new Date().toLocaleDateString(rtl ? "fa-IR" : "en-GB"),
    startDate: "-",
    endDate: "-",
    contractor: "نام پیمانکار",
    consultant: "نام مشاور",
    client: "نام کارفرما",
    location: "محل اجرا",
    weather: "-",
    maxTemp: "-",
    minTemp: "-",
    humidity: "-",
    siteActive: true,
  });

  const scopeProject = projectScope
    ? projectsByCluster[projectScope.clusterId]?.find((project) => project.id === projectScope.projectId)
    : undefined;
  const activeProjectCode = scopeProject?.code ?? projectScope?.projectId ?? "";
  const canManageTemplates = can("report.daily.edit", projectScope?.projectId);

  useEffect(() => {
    try {
      window.localStorage.setItem(TEMPLATE_STORE, JSON.stringify(templates));
    } catch {
      /* ignore */
    }
  }, [templates]);

  useEffect(() => {
    if (!activeProjectCode || !canManageTemplates) return;
    void pmisApiClient.getTemplates(activeProjectCode, "d2-p4-s1")
      .then((remoteTemplates) => {
        if (!remoteTemplates.length) return;
        setTemplates((previous) => {
          const next = { ...previous };
          remoteTemplates.forEach((remote) => {
            const kind: TemplateKind = remote.kind === "mandated" ? "mandated" : "internal";
            next[kind] = {
              fileName: remote.fileName,
              format: guessFormat(remote.fileName),
              size: "Backend file",
              importedAt: remote.version,
              remoteTemplateId: remote.id,
              fileId: remote.fileId,
              downloadUrl: remote.downloadUrl,
              syncStatus: "synced",
            };
          });
          return next;
        });
      })
      .catch(() => {});
  }, [activeProjectCode, canManageTemplates]);

  const importTemplate = (kind: TemplateKind, files: FileList | null) => {
    if (!files?.length) return;
    const f = files[0];
    const format = guessFormat(f.name);
    const base: StoredTemplate = {
      fileName: f.name,
      format,
      size: `${Math.max(1, Math.round(f.size / 1024))} KB`,
      importedAt: new Date().toLocaleDateString(rtl ? "fa-IR" : "en-GB"),
      syncStatus: activeProjectCode && canManageTemplates ? "syncing" : "local",
    };

    setTemplates((prev) => ({ ...prev, [kind]: base }));
    setActiveTemplate(kind);
    setPreviewOpen(true);
    audit("IMPORT_REPORT_TEMPLATE", { projectId: projectScope?.projectId, entity: "Report_Template", entityId: kind });

    if (format.previewable === "pdf" || format.previewable === "image") {
      const reader = new FileReader();
      reader.onload = () => setTemplates((prev) => ({ ...prev, [kind]: { ...(prev[kind] ?? base), dataUrl: String(reader.result) } }));
      reader.readAsDataURL(f);
    }

    if (format.previewable === "text") {
      const reader = new FileReader();
      reader.onload = () => setTemplates((prev) => ({ ...prev, [kind]: { ...(prev[kind] ?? base), textPreview: String(reader.result).slice(0, 20000) } }));
      reader.readAsText(f);
    }

    if (!activeProjectCode || !canManageTemplates) return;
    void pmisApiClient.uploadTemplate(activeProjectCode, { file: f, kind, moduleCode: "d2-p4-s1" })
      .then((remote) => {
        setTemplates((prev) => ({
          ...prev,
          [kind]: {
            ...(prev[kind] ?? base),
            remoteTemplateId: remote.id,
            fileId: remote.fileId,
            downloadUrl: remote.downloadUrl,
            syncStatus: "synced",
          },
        }));
        audit("SYNC_REPORT_TEMPLATE", { projectId: projectScope?.projectId, entity: "Report_Template", entityId: remote.id });
      })
      .catch(() => {
        setTemplates((prev) => ({ ...prev, [kind]: { ...(prev[kind] ?? base), syncStatus: "local" } }));
      });
  };

  const removeTemplate = (kind: TemplateKind) => {
    const current = templates[kind];
    setTemplates((prev) => {
      const next = { ...prev };
      delete next[kind];
      return next;
    });
    if (current?.remoteTemplateId && activeProjectCode) {
      void pmisApiClient.archiveTemplate(activeProjectCode, current.remoteTemplateId).catch(() => {});
    }
    audit("REMOVE_LOCAL_REPORT_TEMPLATE", { projectId: projectScope?.projectId, entity: "Report_Template", entityId: kind });
  };

  const importLogo = (who: "client" | "consultant" | "contractor", files: FileList | null) => {
    if (!files?.length) return;
    const reader = new FileReader();
    reader.onload = () => setLogos((prev) => ({ ...prev, [who]: String(reader.result) }));
    reader.readAsDataURL(files[0]);
  };

  const set = <K extends keyof typeof header>(key: K, val: (typeof header)[K]) =>
    setHeader((prev) => ({ ...prev, [key]: val }));

  const field = (label: string, key: keyof typeof header, dir?: "ltr") => (
    <label className="flex flex-col gap-1">
      <span className="text-[9px] font-extralight tx3">{label}</span>
      <input
        value={String(header[key])}
        onChange={(e) => set(key, e.target.value as never)}
        dir={dir}
        className="w-full rounded-lg border b-line-soft bg-black/15 px-2.5 py-1.5 text-[11px] tx1 outline-none focus:border-[var(--accent)]"
      />
    </label>
  );

  const logoBox = (who: "client" | "consultant" | "contractor", caption: string) => (
    <div className="flex flex-col items-center gap-1">
      <input type="file" hidden accept="image/*" id={`logo-${who}`} onChange={(e) => importLogo(who, e.target.files)} />
      <button
        onClick={() => document.getElementById(`logo-${who}`)?.click()}
        className="grid h-14 w-24 place-items-center overflow-hidden rounded-lg border border-dashed b-line-soft bg-black/10 text-[9px] tx3 transition hover:border-[var(--accent)]"
      >
        {logos[who] ? <img src={logos[who]!} alt={caption} className="h-full w-full object-contain" /> : `+ ${caption}`}
      </button>
      <span className="text-[8.5px] font-extralight tx4">{caption}</span>
    </div>
  );

  const syncLabel = (status?: StoredTemplate["syncStatus"]) => {
    if (status === "synced") return rtl ? "در SQL ثبت شد" : "Stored in SQL";
    if (status === "syncing") return rtl ? "در حال همگام‌سازی" : "Syncing";
    return rtl ? "فقط محلی" : "Local only";
  };

  return (
    <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto" dir={rtl ? "rtl" : "ltr"}>
      {/* ── Template selection: Internal vs Mandated ── */}
      <section className="glass-dark shrink-0 rounded-2xl p-3">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-emerald-400/40 bg-emerald-400/10 text-[15px]">📋</span>
          <div>
            <h3 className="text-[12px] font-semibold tx1">{rtl ? "گزارش روزانه — انتخاب قالب" : "Daily Report — Template Selection"}</h3>
            <p className="text-[8.5px] font-extralight tx3">
              {rtl ? "قالب سازمانی یا قالب ابلاغی کارفرما / مشاور را انتخاب و بارگذاری کنید" : "Choose and upload the internal or client/consultant mandated template"}
            </p>
            <p className="mt-0.5 text-[8px] font-light text-sky-200" dir="ltr">
              {activeProjectCode ? `Project scope: ${activeProjectCode}` : "No active project scope"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
          {(["internal", "mandated"] as TemplateKind[]).map((kind) => {
            const on = activeTemplate === kind;
            const tpl = templates[kind];
            const accent = kind === "internal" ? "#7FB2FF" : "#F59E0B";
            return (
              <div
                key={kind}
                onClick={() => setActiveTemplate(kind)}
                className={`cursor-pointer rounded-2xl border p-3 transition ${on ? "ring-1" : ""}`}
                style={{
                  borderColor: on ? accent : "var(--line-soft)",
                  background: on ? `${accent}14` : "var(--row)",
                  ["--tw-ring-color" as string]: `${accent}77`,
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[14px]">{kind === "internal" ? "🏢" : "📌"}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11.5px] font-medium" style={{ color: accent }}>
                      {kind === "internal"
                        ? rtl ? "قالب سازمانی (داخلی)" : "Internal Organizational Template"
                        : rtl ? "قالب ابلاغی کارفرما / مشاور" : "Client / Consultant Mandated Template"}
                    </div>
                    <div className="text-[8.5px] font-extralight tx3">
                      {kind === "internal"
                        ? rtl ? "قابل ویرایش توسط سازمان" : "Editable by organization"
                        : rtl ? "قفل‌شده — مطابق ابلاغیه" : "Locked — per client brief"}
                    </div>
                  </div>
                  {on && <span className="text-[10px] text-emerald-300">✓</span>}
                </div>

                <input
                  type="file"
                  hidden
                  id={`tpl-${kind}`}
                  accept=".xlsx,.xls,.docx,.doc,.pdf,.csv,.png,.jpg,.jpeg,.webp"
                  onChange={(e) => importTemplate(kind, e.target.files)}
                />

                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); document.getElementById(`tpl-${kind}`)?.click(); }}
                    disabled={!canManageTemplates}
                    className="rounded-lg border b-line-soft bg-black/15 px-2.5 py-1 text-[9.5px] font-light tx1 transition hover:border-[var(--accent)]"
                  >
                    ⬆ {rtl ? "بارگذاری قالب" : "Upload template"}
                  </button>
                  {tpl && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setActiveTemplate(kind); setPreviewOpen(true); }}
                      className="rounded-lg border border-amber-400/50 bg-amber-400/12 px-2.5 py-1 text-[9.5px] font-light text-amber-200"
                    >
                      👁 {rtl ? "پیش‌نمایش قالب" : "Preview template"}
                    </button>
                  )}
                  {tpl && (
                    <button
                      onClick={(e) => { e.stopPropagation(); removeTemplate(kind); }}
                      className="rounded-lg border border-rose-400/40 bg-rose-400/10 px-2.5 py-1 text-[9.5px] font-light text-rose-300"
                    >
                      ✕ {rtl ? "حذف" : "Remove"}
                    </button>
                  )}
                  {tpl && (
                    <span className="flex items-center gap-1.5 text-[9px] font-light tx2" dir="ltr">
                      <span className="rounded px-1.5 py-0.5 text-[8px]" style={{ background: `${tpl.format.color}22`, color: tpl.format.color }}>
                        {tpl.format.icon} {tpl.format.label}
                      </span>
                      {tpl.fileName} · {tpl.size} · {tpl.importedAt}
                    </span>
                  )}
                  {tpl && (
                    <span className="rounded px-1.5 py-0.5 text-[8px] font-light" style={{ background: tpl.syncStatus === "synced" ? "#34D39918" : tpl.syncStatus === "syncing" ? "#FBBF2418" : "rgba(148,163,184,.14)", color: tpl.syncStatus === "synced" ? "#34D399" : tpl.syncStatus === "syncing" ? "#FBBF24" : "#94A3B8" }}>
                      {syncLabel(tpl.syncStatus)}
                    </span>
                  )}
                  {!tpl && <span className="text-[9px] font-extralight tx4">{rtl ? "هنوز فایلی بارگذاری نشده" : "No file uploaded yet"}</span>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Official Letterhead / Header only ── */}
      <section className="glass-dark shrink-0 rounded-2xl border-2 border-dashed border-sky-400/30 bg-black/20 p-3">
        <div className="mb-3 grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b b-line-soft pb-3">
          {logoBox("client", rtl ? "لوگو کارفرما" : "Client Logo")}
          <div className="text-center">
            <div className="text-[10px] font-medium tx1">{rtl ? "جمهوری اسلامی ایران — وزارت راه و شهرسازی" : "Ministry of Roads & Urban Development"}</div>
            <h2 className="mt-1 text-[16px] font-bold tx1">{rtl ? "گزارش روزانه عملیات اجرایی" : "Daily Site Construction Report"}</h2>
            <div className="mt-1 text-[8.5px] font-extralight tx3">
              {rtl ? "قالب فعال:" : "Active template:"}{" "}
              <b style={{ color: activeTemplate === "internal" ? "#7FB2FF" : "#F59E0B" }}>
                {activeTemplate === "internal" ? (rtl ? "سازمانی" : "Internal") : (rtl ? "ابلاغی" : "Mandated")}
              </b>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {logoBox("consultant", rtl ? "لوگو مشاور" : "Consultant")}
            {logoBox("contractor", rtl ? "لوگو پیمانکار" : "Contractor")}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {field(rtl ? "شماره پروژه" : "Project No", "projectNo", "ltr")}
          {field(rtl ? "شماره قرارداد" : "Contract No", "contractNo", "ltr")}
          {field(rtl ? "شماره گزارش" : "Report No", "reportNo")}
          {field(rtl ? "شماره صفحه" : "Page", "page")}

          <div className="sm:col-span-2 lg:col-span-4">{field(rtl ? "نام پروژه" : "Project Name", "projectName")}</div>

          {field(rtl ? "کارفرما" : "Client", "client")}
          {field(rtl ? "مشاور" : "Consultant", "consultant")}
          {field(rtl ? "پیمانکار" : "Contractor", "contractor")}
          {field(rtl ? "محل اجرا" : "Location", "location")}

          {field(rtl ? "تاریخ گزارش" : "Report Date", "date", "ltr")}
          {field(rtl ? "تاریخ شروع پروژه" : "Start Date", "startDate", "ltr")}
          {field(rtl ? "تاریخ پایان پروژه" : "End Date", "endDate", "ltr")}

          <label className="flex flex-col gap-1">
            <span className="text-[9px] font-extralight tx3">{rtl ? "وضعیت کارگاه" : "Site Status"}</span>
            <select
              value={header.siteActive ? "active" : "inactive"}
              onChange={(e) => set("siteActive", e.target.value === "active")}
              className="w-full rounded-lg border b-line-soft bg-black/15 px-2.5 py-1.5 text-[11px] tx1 outline-none"
              style={{ colorScheme: "dark" }}
            >
              <option value="active">{rtl ? "فعال" : "Active"}</option>
              <option value="inactive">{rtl ? "غیرفعال" : "Inactive"}</option>
            </select>
          </label>

          {field(rtl ? "وضعیت آب‌وهوا" : "Weather", "weather")}
          {field(rtl ? "حداکثر دما" : "Max Temp", "maxTemp", "ltr")}
          {field(rtl ? "حداقل دما" : "Min Temp", "minTemp", "ltr")}
          {field(rtl ? "درصد رطوبت" : "Humidity", "humidity", "ltr")}
        </div>

        <div className="mt-3 flex items-center gap-2 border-t b-line-soft pt-2">
          <span className="pulse-dot h-[7px] w-[7px] rounded-full bg-emerald-400" />
          <span className="text-[9px] font-extralight tx3">{rtl ? "محل ذخیره‌سازی:" : "Storage:"}</span>
          <span className="text-[9px] font-light ok-dim-t" dir="ltr">SQL Server (.\SQL2008EXPRESS) · Daily_Report</span>
          {reportSyncStatus !== "idle" && (
            <span className="text-[8.5px] font-light" style={{ color: reportSyncStatus === "synced" ? "#34D399" : reportSyncStatus === "syncing" ? "#FBBF24" : "#94A3B8" }}>
              {reportSyncStatus === "syncing" ? (rtl ? "در حال ثبت…" : "Saving…") : reportSyncStatus === "synced" ? (rtl ? "ثبت شد" : "Saved") : (rtl ? "فقط محلی" : "Local only")}
            </span>
          )}
          <button
            disabled={!canManageTemplates || !activeProjectCode || reportSyncStatus === "syncing"}
            onClick={() => {
              const localRecord = { id: `${header.date}-${Date.now()}`, projectCode: activeProjectCode, header, status: "submitted", savedAt: new Date().toISOString() };
              const stored = JSON.parse(localStorage.getItem("pms:daily-reports") ?? "[]") as unknown[];
              localStorage.setItem("pms:daily-reports", JSON.stringify([localRecord, ...stored].slice(0, 50)));
              setReportSyncStatus("syncing");
              void pmisApiClient.createDailyReport(activeProjectCode, {
                reportNo: header.reportNo,
                reportDate: header.date,
                header,
                status: "draft",
              }).then((savedReport) => {
                setSavedReportId(String(savedReport.id));
                setReportSyncStatus("synced");
                audit("SAVE_DAILY_REPORT", { projectId: projectScope?.projectId, entity: "Daily_Report", entityId: header.reportNo });
              }).catch(() => setReportSyncStatus("local"));
            }}
            className="ms-auto rounded-lg border border-emerald-400/50 bg-emerald-400/15 px-3 py-1 text-[9.5px] font-medium text-emerald-300 transition hover:bg-emerald-400/25 disabled:cursor-not-allowed disabled:opacity-40"
          >
            💾 {rtl ? "ذخیره در دیتابیس SQL Server" : "Save to SQL Server DB"}
          </button>
        </div>
      </section>

      {savedReportId && (
        <ReportWorkflowPanel lang={lang} reportId={savedReportId} reportNo={header.reportNo} />
      )}

      {/* ── Bottom: template intake + inline preview ── */}
      <section className="glass-dark shrink-0 rounded-2xl p-3">
        <div className="mb-3 flex flex-wrap items-center gap-2 border-b b-line-soft pb-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-amber-400/40 bg-amber-400/10 text-[15px]">📥</span>
          <div>
            <h3 className="text-[12px] font-semibold tx1">
              {rtl ? "ورود فرمت گزارش روزانه عملیات اجرایی" : "Daily Site Report Format Intake"}
            </h3>
            <p className="text-[8.5px] font-extralight tx3">
              {rtl
                ? "فرمت سازمانی خود یا فرمت ابلاغی کارفرما / مشاور را وارد کنید تا پیش‌نمایش شود"
                : "Upload your internal format or the client/consultant mandated format to preview it"}
            </p>
          </div>
          <div className="ms-auto flex items-center gap-1.5">
            <button
              onClick={() => setActiveTemplate("internal")}
              className={`rounded-lg border px-2.5 py-1 text-[9.5px] font-light transition ${activeTemplate === "internal" ? "border-sky-400 bg-sky-400/15 text-sky-200" : "b-line-soft tx3"}`}
            >
              🏢 {rtl ? "فرمت سازمانی" : "Internal Format"}
            </button>
            <button
              onClick={() => setActiveTemplate("mandated")}
              className={`rounded-lg border px-2.5 py-1 text-[9.5px] font-light transition ${activeTemplate === "mandated" ? "border-amber-400 bg-amber-400/15 text-amber-200" : "b-line-soft tx3"}`}
            >
              📌 {rtl ? "فرمت ابلاغی کارفرما / مشاور" : "Mandated Format"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
          {/* Upload zone */}
          <div className="flex flex-col gap-2">
            {(["internal", "mandated"] as TemplateKind[]).map((kind) => {
              const tpl = templates[kind];
              const accent = kind === "internal" ? "#7FB2FF" : "#F59E0B";
              const on = activeTemplate === kind;
              return (
                <div
                  key={kind}
                  onClick={() => setActiveTemplate(kind)}
                  className={`cursor-pointer rounded-xl border p-2.5 transition ${on ? "ring-1" : ""}`}
                  style={{
                    borderColor: on ? accent : "var(--line-soft)",
                    background: on ? `${accent}12` : "var(--row)",
                    ["--tw-ring-color" as string]: `${accent}66`,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[13px]">{kind === "internal" ? "🏢" : "📌"}</span>
                    <span className="flex-1 text-[10.5px] font-medium" style={{ color: accent }}>
                      {kind === "internal"
                        ? rtl ? "فرمت سازمانی (داخلی)" : "Internal Format"
                        : rtl ? "فرمت ابلاغی کارفرما / مشاور" : "Client / Consultant Format"}
                    </span>
                    {tpl && <span className="text-[9px] text-emerald-300">✓</span>}
                  </div>

                  <input
                    type="file"
                    hidden
                    id={`bottom-tpl-${kind}`}
                    accept=".xlsx,.xls,.docx,.doc,.pdf,.csv,.png,.jpg,.jpeg,.webp"
                    onChange={(e) => importTemplate(kind, e.target.files)}
                  />

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); document.getElementById(`bottom-tpl-${kind}`)?.click(); }}
                      className="rounded-lg border b-line-soft bg-black/15 px-2 py-1 text-[9px] font-light tx1 transition hover:border-[var(--accent)]"
                    >
                      ⬆ {rtl ? "ورود فرمت" : "Upload"}
                    </button>
                    {tpl && (
                      <button
                        onClick={(e) => { e.stopPropagation(); removeTemplate(kind); }}
                        className="rounded-lg border border-rose-400/40 bg-rose-400/10 px-2 py-1 text-[9px] font-light text-rose-300"
                      >
                        ✕ {rtl ? "حذف" : "Remove"}
                      </button>
                    )}
                  </div>

                  {tpl ? (
                    <div className="mt-1.5 truncate text-[8.5px] font-extralight tx3" dir="ltr">
                      {tpl.format.icon} {tpl.format.label} · {tpl.fileName} · {tpl.size}
                    </div>
                  ) : (
                    <div className="mt-1.5 text-[8.5px] font-extralight tx4">
                      {rtl ? "فایلی وارد نشده" : "No file uploaded"}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Inline preview */}
          <div className="rounded-xl border b-line-soft bg-black/15 p-2">
            <div className="mb-2 flex items-center gap-2 px-1">
              <span className="text-[10px] font-normal tx1">👁 {rtl ? "پیش‌نمایش فرمت واردشده" : "Uploaded Format Preview"}</span>
              {templates[activeTemplate] && (
                <button
                  onClick={() => setPreviewOpen(true)}
                  className="ms-auto rounded-lg border b-line-soft px-2 py-0.5 text-[9px] tx2 hover:tx1"
                >
                  ⛶ {rtl ? "تمام‌صفحه" : "Fullscreen"}
                </button>
              )}
            </div>

            <div className="max-h-[46vh] min-h-[220px] overflow-auto rounded-lg bg-[#5b6470] p-2">
              {(() => {
                const tpl = templates[activeTemplate];
                if (!tpl) {
                  return (
                    <div className="grid h-[200px] place-items-center text-center text-[10.5px] font-light text-white/80">
                      {rtl
                        ? "برای مشاهده پیش‌نمایش، ابتدا فرمت سازمانی یا ابلاغی را وارد کنید."
                        : "Upload an internal or mandated format to see the preview."}
                    </div>
                  );
                }
                if (tpl.format.previewable === "pdf" && (tpl.dataUrl || tpl.downloadUrl)) {
                  return <iframe title="inline-pdf" src={tpl.dataUrl || tpl.downloadUrl} className="mx-auto block h-[42vh] w-full max-w-[210mm] bg-white shadow-xl" />;
                }
                if (tpl.format.previewable === "image" && (tpl.dataUrl || tpl.downloadUrl)) {
                  return <img src={tpl.dataUrl || tpl.downloadUrl} alt={tpl.fileName} className="mx-auto block max-h-[42vh] max-w-full bg-white object-contain shadow-xl" />;
                }
                if (tpl.format.previewable === "text" && tpl.textPreview) {
                  return (
                    <pre className="mx-auto block max-h-[42vh] w-full max-w-[210mm] overflow-auto bg-white p-4 text-[10px] leading-5 text-black shadow-xl" dir="ltr">
                      {tpl.textPreview}
                    </pre>
                  );
                }
                return (
                  <div className="mx-auto flex min-h-[200px] w-full max-w-[210mm] flex-col items-center justify-center gap-2 bg-white p-6 text-center shadow-xl">
                    <div className="text-[34px]">{tpl.format.icon}</div>
                    <div className="text-[13px] font-semibold text-black" dir="ltr">{tpl.fileName}</div>
                    <div className="text-[10px] text-black/70" dir="ltr">{tpl.format.label} · {tpl.size} · {tpl.importedAt}</div>
                    <div className="mt-1 max-w-md text-[10px] leading-5 text-black/70">
                      {rtl
                        ? "پیش‌نمایش مستقیم Word و Excel در مرورگر ممکن نیست. فایل ثبت شد و به‌عنوان فرمت فعال گزارش روزانه انتخاب گردید."
                        : "Word/Excel cannot render inline in the browser. The file is registered as the active daily report format."}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </section>

      {/* ── Uploaded template preview modal ── */}
      {previewOpen && (() => {
        const tpl = templates[activeTemplate];
        const accent = activeTemplate === "internal" ? "#7FB2FF" : "#F59E0B";
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3" onClick={() => setPreviewOpen(false)}>
            <div
              className="glass-dark fade-rise flex max-h-[94vh] w-full max-w-5xl flex-col rounded-2xl p-3"
              onClick={(e) => e.stopPropagation()}
              dir={rtl ? "rtl" : "ltr"}
            >
              <div className="mb-2 flex flex-wrap items-center gap-2 border-b b-line-soft pb-2">
                <span className="text-[13px] font-normal tx1">👁 {rtl ? "پیش‌نمایش قالب ورودی" : "Uploaded Template Preview"}</span>
                <span className="rounded-md px-2 py-0.5 text-[9px] font-light" style={{ background: `${accent}22`, color: accent }}>
                  {activeTemplate === "internal"
                    ? rtl ? "قالب سازمانی" : "Internal"
                    : rtl ? "قالب ابلاغی کارفرما / مشاور" : "Client / Consultant Mandated"}
                </span>
                {tpl && (
                  <span className="truncate text-[9px] font-extralight tx3" dir="ltr">
                    {tpl.format.icon} {tpl.format.label} · {tpl.fileName} · {tpl.size} · {tpl.importedAt}
                  </span>
                )}
                <div className="ms-auto flex items-center gap-1.5">
                  {(tpl?.dataUrl || tpl?.downloadUrl) && (
                    <a
                      href={tpl.dataUrl || tpl.downloadUrl}
                      download={tpl.fileName}
                      className="rounded-lg border b-line-soft px-2.5 py-1 text-[9.5px] tx2 hover:tx1"
                    >
                      ⬇ {rtl ? "دانلود" : "Download"}
                    </a>
                  )}
                  <button onClick={() => document.getElementById(`tpl-${activeTemplate}`)?.click()} className="rounded-lg border b-line-soft px-2.5 py-1 text-[9.5px] tx2 hover:tx1">
                    ⬆ {rtl ? "جایگزینی فایل" : "Replace file"}
                  </button>
                  <button onClick={() => setPreviewOpen(false)} className="rounded-lg border b-line-soft px-2.5 py-1 text-[9.5px] tx2 hover:tx1">
                    {rtl ? "بستن" : "Close"}
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-auto rounded-xl bg-[#5b6470] p-3">
                {!tpl ? (
                  <div className="grid h-[60vh] place-items-center text-[11px] font-light text-white/80">
                    {rtl ? "هنوز قالبی برای این گزینه بارگذاری نشده است." : "No template uploaded for this option yet."}
                  </div>
                ) : tpl.format.previewable === "pdf" && (tpl.dataUrl || tpl.downloadUrl) ? (
                  <iframe title="pdf-preview" src={tpl.dataUrl || tpl.downloadUrl} className="mx-auto block h-[80vh] w-[210mm] max-w-full bg-white shadow-2xl" />
                ) : tpl.format.previewable === "image" && (tpl.dataUrl || tpl.downloadUrl) ? (
                  <img src={tpl.dataUrl || tpl.downloadUrl} alt={tpl.fileName} className="mx-auto block max-h-[80vh] max-w-full bg-white object-contain shadow-2xl" />
                ) : tpl.format.previewable === "text" && tpl.textPreview ? (
                  <pre className="mx-auto block min-h-[60vh] w-[210mm] max-w-full overflow-auto bg-white p-6 text-[11px] leading-5 text-black shadow-2xl" dir="ltr">
                    {tpl.textPreview}
                  </pre>
                ) : (
                  <div className="mx-auto flex h-[60vh] w-[210mm] max-w-full flex-col items-center justify-center gap-3 bg-white p-8 text-center shadow-2xl">
                    <div className="text-[42px]">{tpl.format.icon}</div>
                    <div className="text-[15px] font-semibold text-black" dir="ltr">{tpl.fileName}</div>
                    <div className="text-[11px] text-black/70" dir="ltr">
                      {tpl.format.label} · {tpl.size} · {tpl.importedAt}
                    </div>
                    <div className="mt-2 max-w-md text-[11px] leading-6 text-black/70">
                      {rtl
                        ? "پیش‌نمایش داخلی برای فایل‌های Word و Excel در مرورگر امکان‌پذیر نیست. فایل ثبت و به‌عنوان قالب فعال انتخاب شد؛ برای مشاهده کامل آن را دانلود کنید."
                        : "Inline preview is not available for Word/Excel in the browser. The file is registered as the active template; download it to view fully."}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
