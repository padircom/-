/**
 * کارگاه برنامه‌ریزی — از قرارداد تا برنامهٔ زمان‌بندی.
 *
 * چیدمان مطابق طرحی است که کارفرما داد:
 *
 *   نوار ابزار بالا: بارگذاری مدارک · استخراج WBS · کشوی خروجی · کشوی قالب ورود · قفل چیدمان
 *   گام ۱: بارگذاری قرارداد و طراحی WBS با هوش مصنوعی
 *   گام ۲: واردات برنامه از Primavera P6 / MSP
 *
 * سه قاعده که در پیاده‌سازی رعایت شده:
 *
 * ۱. **هیچ فایلی بدون پیش‌نمایش** — قید صریح کارفرما. چه ورودی چه
 *    خروجی، به‌محض فراخوانی نمایش داده می‌شود.
 *
 * ۲. **متن اصلی حذف نمی‌شود.** در دعوای قراردادی مرجع همان نسخه‌ای
 *    است که طرفین امضا کرده‌اند، نه ترجمه. هر دو نگه داشته می‌شوند.
 *
 * ۳. **AI عدد نمی‌سازد.** خروجی استخراج مستقیم وارد محاسبهٔ هزینه
 *    می‌شود، پس هر گره باید به بند قرارداد ارجاع بدهد و مقدار نامعلوم
 *    خالی بماند نه صفر.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { Lang } from "../data/framework";
import LayoutShell from "./LayoutShell";
import { parseClauses, sourceRefFa, type ParsedClause } from "../services/clauseParser";
import {
  OG_TEMPLATES,
  TEMPLATE_PROFILES,
  detectGlossaryTerms,
  detectLanguage,
  offlineGlossaryTranslate,
  seedFromTemplate,
  type TemplateKind,
} from "../services/ogWbs";
import { useSystem } from "../context/SystemContext";
import {
  loadSession,
  saveSession,
  clearSession,
  summarise,
  type WorkshopSession,
} from "../services/workshopSession";
import {
  parseCommand,
  applyCommand,
  pushHistory,
  undo,
  COMMAND_HINTS,
  type HistoryEntry,
} from "../services/wbsCommands";
import {
  buildSheet,
  buildXer,
  buildMspXml,
  exportFileName,
  columnsFor,
  type ExportNode,
  type Letterhead,
} from "../services/breakdownExport";

type Props = { lang: Lang; projectCode?: string; projectTitleFa?: string };

type Step = "contract" | "import";

type Preview =
  | { kind: "table"; title: string; head: string[]; body: (string | number | null)[][] }
  | { kind: "text"; title: string; text: string }
  | null;

export default function ContractWorkshop({ lang, projectCode = "PRJ", projectTitleFa = "پروژه" }: Props) {
  const rtl = lang === "fa";
  const [step, setStep] = useState<Step>("contract");

  /* ── وضعیت قرارداد ── */
  /* نشست ذخیره‌شده در نخستین رندر خوانده می‌شود.
   *
   * پیش از این همهٔ این‌ها useState خالی بودند، پس با ترک ماژول
   * کامپوننت unmount می‌شد و فایل، متن، ترجمه و کل درخت از بین
   * می‌رفت. */
  const restored = useRef<WorkshopSession | null>(null);
  if (restored.current === null) restored.current = loadSession(projectCode);
  const seed = restored.current;

  const [fileName, setFileName] = useState<string>(seed.fileName);
  const [fileSize, setFileSize] = useState<number>(seed.fileSize);
  const [loadedAt, setLoadedAt] = useState<string | null>(seed.loadedAt);
  const [rawText, setRawText] = useState<string>(seed.rawText);
  const [targetLang, setTargetLang] = useState<"fa" | "en">(seed.targetLang);
  const [translated, setTranslated] = useState<string>(seed.translated);
  const [saveWarn, setSaveWarn] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ kind: "ok" | "warn" | "err"; text: string } | null>(null);

  /* ── AI ──
   *
   * ارائه‌دهنده و کلید از «مدیریت سامانه ← هوش مصنوعی» خوانده می‌شوند.
   * پیش از این همین‌جا هم یک انتخابگر بود، یعنی دو جا برای یک تنظیم؛
   * کاربری که کلید را در مدیریت سامانه گذاشته بود، اینجا با یک موتور
   * خالی روبه‌رو می‌شد و دلیلش پیدا نبود. */
  const { settings } = useSystem();
  const provider = settings.aiProvider;
  const secret = settings.aiApiKey;
  const [templateId, setTemplateId] = useState<string>(seed.templateId);
  /* قفل چیدمان از نوار ابزار بالا کنترل می‌شود، کنار کشوی قالب ورود. */
  const [layoutLocked, setLayoutLocked] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [showRawText, setShowRawText] = useState(false);
  /* نمای کشوی متن: اصلی · ترجمه · دوستونی. */
  const [textView, setTextView] = useState<"original" | "translated" | "split">("original");
  const [command, setCommand] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [templateKind, setTemplateKind] = useState<TemplateKind>("internal");

  /* ── خروجی استخراج ── */
  const [nodes, setNodes] = useState<ExportNode[]>(seed.nodes as ExportNode[]);
  const [clauses, setClauses] = useState<ParsedClause[]>([]);
  const [preview, setPreview] = useState<Preview>(null);

  const fileRef = useRef<HTMLInputElement | null>(null);
  const importRef = useRef<HTMLInputElement | null>(null);

  /* ذخیرهٔ خودکار.
   *
   * دکمهٔ ذخیرهٔ دستی نگذاشتم چون کاربری که یادش برود بزند، دقیقاً
   * همان کار را از دست می‌دهد که این لایه قرار بود نجاتش دهد. */
  useEffect(() => {
    const out = saveSession(projectCode, {
      version: "wsess-v1",
      fileName,
      fileSize,
      loadedAt,
      rawText,
      translated,
      targetLang,
      templateId,
      nodes: nodes as never,
      textTruncated: false,
    });
    setSaveWarn(out.ok ? (out.reasonFa ?? null) : (out.reasonFa ?? "ذخیره نشد."));
  }, [projectCode, fileName, fileSize, loadedAt, rawText, translated, targetLang, templateId, nodes]);

  const fileInfo = useMemo(
    () => summarise(
      {
        version: "wsess-v1",
        fileName, fileSize, loadedAt, rawText, translated,
        targetLang, templateId, nodes: nodes as never, textTruncated: false,
      },
      lang,
    ),
    [fileName, fileSize, loadedAt, rawText, translated, targetLang, templateId, nodes, lang],
  );

  /** پاک کردن کامل نشست — با تأیید، چون برگشت‌پذیر نیست. */
  const onClearFile = () => {
    const ok = window.confirm(
      rtl
        ? "فایل قرارداد، متن، ترجمه و ساختار استخراج‌شده پاک شوند؟ این کار برگشت‌پذیر نیست."
        : "Remove the contract, its text, translation and extracted structure? This cannot be undone.",
    );
    if (!ok) return;
    clearSession(projectCode);
    setFileName("");
    setFileSize(0);
    setLoadedAt(null);
    setRawText("");
    setTranslated("");
    setNodes([]);
    setClauses([]);
    setHistory([]);
    setShowRawText(false);
    setTextView("original");
    setNote({ kind: "ok", text: rtl ? "نشست پاک شد." : "Session cleared." });
  };

  const detected = useMemo(() => detectLanguage(rawText), [rawText]);
  const terms = useMemo(() => detectGlossaryTerms(rawText).slice(0, 8), [rawText]);

  const letterhead: Letterhead = {
    projectCode,
    projectTitleFa,
    contractNo: fileName || null,
    contractType: null,
    contractAmount: null,
    currency: null,
    dataDate: new Date().toISOString().slice(0, 10),
    revision: "1",
    preparedBy: null,
  };

  /* ══════════ بارگذاری ══════════ */

  const onPickFile = async (f: File | null) => {
    if (!f) return;
    setFileName(f.name);
    setFileSize(f.size);
    setLoadedAt(new Date().toISOString());
    setNote(null);
    const ext = f.name.toLowerCase().split(".").pop() ?? "";

    if (ext === "txt") {
      const text = await f.text();
      setRawText(text);
      setNote({ kind: "ok", text: rtl ? "متن خوانده شد." : "Text loaded." });
      return;
    }

    /* PDF و DOCX سمت سرور استخراج می‌شوند؛ اینجا فقط اعلام می‌کنیم
     * تا کاربر منتظر چیزی که نمی‌آید نماند. */
    setBusy("extract");
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch(`/api/projects/${encodeURIComponent(projectCode)}/knowledge/ingest`, { method: "POST", body: fd });
      const json = await res.json().catch(() => null);
      const text = json?.data?.text ?? json?.data?.content ?? "";
      const archiveWarn = json?.data?.archiveErrorFa as string | undefined;
      if (text) {
        setRawText(text);
        setNote({
          kind: archiveWarn ? "warn" : "ok",
          text: archiveWarn
            ? `${rtl ? "متن از فایل استخراج شد" : "Text extracted"} — ${archiveWarn}`
            : (rtl ? "متن از فایل استخراج شد." : "Text extracted."),
        });
      } else {
        setNote({
          kind: "warn",
          text: rtl
            ? "متنی استخراج نشد. اگر PDF اسکن‌شده است، نیاز به OCR دارد — فعلاً متن را در کادر زیر بچسبانید."
            : "No text extracted. If the PDF is scanned it needs OCR; paste the text below for now.",
        });
      }
    } catch {
      setNote({
        kind: "warn",
        text: rtl ? "استخراج سمت سرور در دسترس نیست. متن را در کادر زیر بچسبانید." : "Server extraction unavailable; paste the text below.",
      });
    } finally {
      setBusy(null);
    }
  };

  /**
   * ترجمهٔ آفلاین با واژه‌نامه.
   *
   * وقتی سرویسی در دسترس نیست، به‌جای رها کردن کاربر با دکمه‌های
   * همیشه‌خاموش، اصطلاحات تخصصی جایگزین می‌شوند و صریح گفته می‌شود
   * که این ترجمهٔ کامل نیست. نرخ پوشش نشان داده می‌شود تا کسی آن را
   * با ترجمهٔ واقعی اشتباه نگیرد.
   */
  const runOfflineTranslate = (reasonFa: string) => {
    const src = rawText.trim();
    if (!src) {
      setNote({ kind: "err", text: rtl ? "متنی برای ترجمه نیست." : "No text to translate." });
      return;
    }
    const r = offlineGlossaryTranslate(src);
    setTranslated(r.text);
    setShowRawText(true);
    setTextView("split");
    setNote({
      kind: "warn",
      text: rtl
        ? `${reasonFa} ترجمهٔ واژه‌نامه‌ای آفلاین انجام شد: ${r.replaced} اصطلاح تخصصی جایگزین شد (پوشش ${r.coveragePct}٪). این ترجمهٔ کامل نیست.`
        : `${reasonFa} Offline glossary translation applied: ${r.replaced} terms (${r.coveragePct}% coverage). This is not a full translation.`,
    });
  };

  /* ══════════ ترجمه ══════════ */

  const onTranslate = async () => {
    if (!rawText.trim()) {
      setNote({ kind: "err", text: rtl ? "ابتدا متن قرارداد را بارگذاری یا پیست کنید." : "Load or paste the contract text first." });
      return;
    }
    /* پیش‌فرض سامانه «شبیه‌سازی‌شده» است و ترجمه نمی‌کند. پیش از این
     * درخواست فرستاده می‌شد، سرور مؤدبانه رد می‌کرد و کاربر فقط
     * می‌دید که هیچ ترجمه‌ای نیامد. حالا همان‌جا صریح گفته می‌شود
     * کجا باید عوض شود. */
    if (provider === "arena") {
      runOfflineTranslate(
        rtl ? "نشست Arena.ai به این سامانه نمی‌رسد." : "No Arena.ai session reaches this system.",
      );
      return;
    }
    if (provider === "mock" || provider === "local") {
      runOfflineTranslate(
        rtl
          ? "سرویس روی حالت شبیه‌سازی است."
          : "The service is in simulator mode.",
      );
      return;
    }
    if (!secret.trim()) {
      /* نام سرویس در پیام می‌آید. «کلید تنظیم نشده» بدون گفتن کدام
       * سرویس، کاربری را که تازه DeepSeek را انتخاب کرده سردرگم
       * می‌کند: او فکر می‌کند کلید را گذاشته، ولی آن کلید برای سرویس
       * قبلی بود. */
      const name = provider === "deepseek" ? "DeepSeek" : provider === "openai" ? "OpenAI" : provider;
      runOfflineTranslate(
        rtl
          ? `کلید ${name} وارد نشده است (مدیریت سامانه ← ۵. هوش مصنوعی).`
          : `No ${name} key entered.`,
      );
      return;
    }
    setBusy("translate");
    setNote(null);
    try {
      const res = await fetch("/api/ai/run", {
        method: "POST",
        headers: { "content-type": "application/json", ...(secret ? { "x-ai-key": secret } : {}) },
        body: JSON.stringify({ prompt: "translate", context: { provider, targetLang, text: rawText.slice(0, 20000) } }),
      });
      const json = await res.json().catch(() => null);
      const out = json?.data?.translated ?? json?.data?.message ?? "";
      if (out && out !== rawText) {
        setTranslated(String(out));
        /* کشو باز و روی نمای دوستونی می‌رود: کاربر ترجمه را خواسته،
         * پس باید ببیندش بدون اینکه دنبال دکمه بگردد. */
        setShowRawText(true);
        setTextView("split");
        setNote({ kind: "ok", text: rtl ? "ترجمه آماده شد. متن اصلی هم نگه داشته شد." : "Translation ready; the original is kept." });
      } else {
        const why = String(json?.error?.message ?? "").slice(0, 120);
        runOfflineTranslate(
          rtl ? `سرویس ترجمه پاسخ نداد${why ? ` (${why})` : ""}.` : `The service did not respond${why ? ` (${why})` : ""}.`,
        );
      }
    } catch {
      runOfflineTranslate(rtl ? "اتصال به سرویس ترجمه برقرار نشد." : "Could not reach the translation service.");
    } finally {
      setBusy(null);
    }
  };

  /* ══════════ استخراج WBS ══════════ */

  const onExtract = () => {
    const source = rawText.trim();
    if (!source) {
      setNote({ kind: "err", text: rtl ? "متنی برای استخراج نیست." : "Nothing to extract." });
      return;
    }
    setBusy("wbs");
    setNote(null);

    /* موتور قاعده‌محور همیشه اجرا می‌شود و کف نتیجه را می‌سازد. اگر
     * سرویس AI در دسترس باشد بعداً روی همین سوار می‌شود — ولی نبودنش
     * نباید کار را متوقف کند. */
    const parsed = parseClauses(source);
    setClauses(parsed.clauses);

    const fromClauses: ExportNode[] = parsed.clauses.map((c) => ({
      code: c.clauseNo,
      parentCode: c.parentClauseNo,
      titleFa: c.titleFa ?? c.bodyText.split("\n")[0]?.slice(0, 70) ?? c.clauseNo,
      depth: c.depth,
      weightFactor: null,
      weightValue: null,
      amount: null,
      sourceRefFa: sourceRefFa(c),
      actualPct: null,
      plannedPct: null,
    }));

    /* اگر متن ساختار بنددار نداشت، اسکلت صنعتی جایگزین می‌شود تا
     * کاربر با صفحهٔ خالی روبه‌رو نشود. */
    const result = fromClauses.length
      ? fromClauses
      : seedFromTemplate(templateId).map((n) => ({
          code: n.code,
          parentCode: n.parentCode,
          titleFa: n.titleFa,
          titleEn: n.titleEn,
          depth: n.parentCode ? 2 : 1,
          weightFactor: n.weightPct,
          weightValue: null,
          amount: null,
          sourceRefFa: null,
          actualPct: null,
          plannedPct: null,
        }));

    setNodes(result);
    setBusy(null);
    setNote({
      kind: fromClauses.length ? "ok" : "warn",
      text: fromClauses.length
        ? (rtl ? `${result.length} گره از ${parsed.clauses.length} بند استخراج شد.` : `${result.length} nodes from ${parsed.clauses.length} clauses.`)
        : (rtl ? "ساختار بنددار پیدا نشد؛ اسکلت صنعتی بارگذاری شد." : "No clause structure found; industry skeleton loaded."),
    });
  };

  /* ══════════ خروجی ══════════ */

  const showExcel = () => {
    if (!nodes.length) return setNote({ kind: "err", text: rtl ? "ابتدا ساختار را بسازید." : "Build the structure first." });
    const sheet = buildSheet("wbs", nodes, letterhead, [], lang);
    setPreview({
      kind: "table",
      title: exportFileName(letterhead, "wbs", "xlsx"),
      head: columnsFor("wbs").map((c) => (rtl ? c.titleFa : c.titleEn)),
      body: sheet.rows.slice(sheet.headerRowIndex + 2),
    });
  };

  const showText = (kind: "xer" | "xml") => {
    if (!nodes.length) return setNote({ kind: "err", text: rtl ? "ابتدا ساختار را بسازید." : "Build the structure first." });
    setPreview({
      kind: "text",
      title: exportFileName(letterhead, "wbs", kind),
      text: kind === "xer" ? buildXer(nodes, letterhead) : buildMspXml(nodes, letterhead),
    });
  };

  const showPdf = () => {
    if (!nodes.length) return setNote({ kind: "err", text: rtl ? "ابتدا ساختار را بسازید." : "Build the structure first." });
    /* PDF واقعی سمت سرور تولید می‌شود؛ اینجا همان محتوای چاپی
     * پیش‌نمایش می‌شود تا کاربر پیش از دانلود ببیند چه می‌گیرد. */
    setPreview({
      kind: "table",
      title: exportFileName(letterhead, "wbs", "pdf"),
      head: [rtl ? "کد" : "Code", rtl ? "شرح" : "Description", rtl ? "سطح" : "Level", rtl ? "مرجع" : "Source"],
      body: nodes.map((n) => [n.code, n.titleFa, n.depth, n.sourceRefFa ?? null]),
    });
  };

  /* ══════════ نوار فرمان ══════════ */

  /**
   * اجرای یک دستور روی درخت.
   *
   * مسیر قاعده‌محور اول تلاش می‌کند؛ فقط آنچه نفهمید به مدل می‌رود.
   * «تا سطح ۳ نگه دار» یک عملیات قطعی است و فرستادنش به سرویس یعنی
   * پرداخت هزینه و پذیرش عدم قطعیت برای کاری که با یک شرط انجام
   * می‌شود.
   */
  const runCommand = async (text: string) => {
    const input = text.trim();
    if (!input) return;
    if (!nodes.length) {
      setNote({ kind: "err", text: rtl ? "ابتدا ساختار را استخراج کنید." : "Extract a structure first." });
      return;
    }

    const before = nodes;
    const cmd = parseCommand(input);

    if (cmd.kind !== "ai") {
      const res = applyCommand(nodes, cmd);
      if (res.changed) setNodes(res.nodes as ExportNode[]);
      setHistory((h) => pushHistory(h, { command: input, messageFa: res.messageFa, at: new Date().toISOString(), before }));
      setCommand("");
      setNote({ kind: res.changed ? "ok" : "warn", text: res.messageFa });
      return;
    }

    /* دستور آزاد — به مدل سپرده می‌شود. */
    if (provider !== "mock" && !secret.trim()) {
      setNote({
        kind: "err",
        text: rtl
          ? "کلید هوش مصنوعی تنظیم نشده است. مدیریت سامانه ← هوش مصنوعی و یکپارچگی."
          : "No AI key configured. System Management → AI & Integrations.",
      });
      return;
    }

    setBusy("cmd");
    try {
      const res = await fetch("/api/ai/run", {
        method: "POST",
        headers: { "content-type": "application/json", ...(secret ? { "x-ai-key": secret } : {}) },
        body: JSON.stringify({
          prompt: "wbs",
          context: {
            provider,
            templateId,
            text: `${input}\n\nCurrent structure:\n${nodes.map((n) => `${n.code} ${n.titleFa}`).join("\n")}`,
          },
        }),
      });
      const json = await res.json().catch(() => null);
      const msg = json?.data?.translated ?? json?.data?.message ?? json?.error?.message ?? "";
      setHistory((h) => pushHistory(h, {
        command: input,
        messageFa: String(msg || (rtl ? "پاسخی دریافت نشد." : "No response.")),
        at: new Date().toISOString(),
        before,
      }));
      setCommand("");
      setNote({
        kind: json?.ok ? "ok" : "warn",
        text: String(msg || (rtl ? "سرویس پاسخی برنگرداند." : "No response.")),
      });
    } catch {
      setNote({ kind: "err", text: rtl ? "اجرای دستور انجام نشد." : "Command failed." });
    } finally {
      setBusy(null);
    }
  };

  const onUndo = () => {
    const { nodes: prev, history: rest } = undo(history);
    if (!prev) return;
    setNodes(prev as ExportNode[]);
    setHistory(rest);
    setNote({ kind: "ok", text: rtl ? "یک گام بازگشت." : "Reverted one step." });
  };

  /** فهرست قالب‌های خروجی — یک جا، تا نوار ابزار و کشو واگرا نشوند. */
  const EXPORT_FORMATS: { id: string; fa: string; en: string; ext: string; icon: string; run: () => void }[] = [
    { id: "excel", fa: "اکسل — جدول ساختار", en: "Excel — structure table", ext: ".xlsx", icon: "▦", run: showExcel },
    { id: "pdf", fa: "پی‌دی‌اف — گزارش چاپی", en: "PDF — printable report", ext: ".pdf", icon: "▮", run: showPdf },
    { id: "xer", fa: "پریماورا P6", en: "Primavera P6", ext: ".xer", icon: "▤", run: () => showText("xer") },
    { id: "msp", fa: "ام‌اس پراجکت", en: "MS Project", ext: ".xml", icon: "▣", run: () => showText("xml") },
    { id: "xml", fa: "ایکس‌ام‌ال خام", en: "Raw XML", ext: ".xml", icon: "⇗", run: () => showText("xml") },
  ];

  /* ══════════ واردات ══════════ */

  const onImportSchedule = async (f: File | null) => {
    if (!f) return;
    setBusy("import");
    setNote(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch(`/api/projects/${encodeURIComponent(projectCode)}/schedule/import`, { method: "POST", body: fd });
      const json = await res.json().catch(() => null);
      const rows = json?.data?.activities ?? json?.data?.rows ?? [];
      if (Array.isArray(rows) && rows.length) {
        setPreview({
          kind: "table",
          title: f.name,
          head: ["Code", "Name", "Start", "Finish", "Dur", "%", "WBS"],
          body: rows.slice(0, 400).map((r: Record<string, unknown>) => [
            String(r.code ?? ""), String(r.name ?? ""), String(r.startDate ?? ""),
            String(r.finishDate ?? ""), Number(r.durationDays ?? 0), Number(r.progress ?? 0), String(r.wbsCode ?? ""),
          ]),
        });
        setNote({ kind: "ok", text: rtl ? `${rows.length} فعالیت خوانده شد.` : `${rows.length} activities read.` });
      } else {
        const msg = json?.error?.message ?? (rtl ? "فعالیتی خوانده نشد." : "No activities read.");
        setNote({ kind: "warn", text: msg });
      }
    } catch {
      setNote({ kind: "err", text: rtl ? "واردات انجام نشد." : "Import failed." });
    } finally {
      setBusy(null);
    }
  };

  /* ══════════ نما ══════════ */

  return (
    <div dir={rtl ? "rtl" : "ltr"} className="fade-rise space-y-2">
      {/* ── نوار ابزار ── */}
      <div className="glass-dark flex flex-wrap items-center gap-2 rounded-2xl p-2.5 text-[9.5px]">
        <button
          onClick={() => fileRef.current?.click()}
          className="rounded-xl border px-2.5 py-1.5 tx1 transition hover:-translate-y-px"
          style={{ borderColor: "rgba(245,197,110,.5)", background: "rgba(245,197,110,.1)" }}
        >
          📄 {rtl ? "بارگذاری مدارک قراردادی" : "Upload contract"}
        </button>
        <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" hidden onChange={(e) => onPickFile(e.target.files?.[0] ?? null)} />

        <div className="mx-1 h-5 w-px" style={{ background: "var(--line)" }} />

        {/* پیش از این یک برچسب بی‌کار بود که هیچ کاری نمی‌کرد.
          * دکمه‌ای که کلیک می‌شود و هیچ اتفاقی نمی‌افتد بدتر از نبودنش
          * است، پس به همان کار واقعی این صفحه وصل شد. */}
        <button
          onClick={onExtract}
          /* فقط وقتی خودِ استخراج در جریان است غیرفعال می‌شود.
           * پیش از این هر کار دیگری (ترجمه، بارگذاری) دکمه را خاموش
           * می‌کرد و اگر آن کار در میانه رها می‌شد، دکمه خاموش
           * می‌ماند. */
          disabled={busy === "wbs"}
          className="rounded-xl border px-2.5 py-1.5 tx1 transition hover:-translate-y-px disabled:opacity-50"
          style={{ borderColor: "rgba(216,180,254,.5)", background: "rgba(216,180,254,.1)" }}
        >
          ✨ {rtl ? "استخراج WBS با AI" : "Extract WBS with AI"}
        </button>

        <div className="mx-1 h-5 w-px" style={{ background: "var(--line)" }} />

        {/* خروجی‌ها در یک کشو.
          *
          * پنج دکمهٔ کنار هم نیمی از نوار ابزار را می‌گرفتند، در حالی
          * که کاربر هر بار فقط یکی را می‌خواهد. ضمناً دو دکمه (XML و
          * MS Project) عملاً یک کار می‌کردند؛ در فهرست، هر قالب یک
          * ردیف با توضیح خودش دارد و آن هم‌پوشانی دیده می‌شود. */}
        <span className="tx3">{rtl ? "خروجی:" : "Export:"}</span>
        <div className="relative">
          <button
            onClick={() => setExportOpen((v) => !v)}
            className="connect-btn flex items-center gap-1.5 rounded-lg px-2.5 py-1"
            title={rtl ? "انتخاب قالب خروجی" : "Choose an export format"}
          >
            <span>{rtl ? "انتخاب قالب" : "Choose format"}</span>
            <span className="text-[8px] tx4">{exportOpen ? "▲" : "▼"}</span>
          </button>

          {exportOpen && (
            <>
              {/* پوشش نامرئی: کلیک بیرون، کشو را می‌بندد. بدون آن کشو
                * باز می‌ماند و روی محتوای زیرش می‌نشیند. */}
              <div className="fixed inset-0 z-20" onClick={() => setExportOpen(false)} />
              <div
                className="glass absolute z-30 mt-1 min-w-[190px] overflow-hidden rounded-xl border p-1"
                style={{ borderColor: "var(--line)", [rtl ? "right" : "left"]: 0 } as React.CSSProperties}
              >
                {EXPORT_FORMATS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => { setExportOpen(false); f.run(); }}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-[9.5px] transition glass-row"
                  >
                    <span className="w-4 text-center">{f.icon}</span>
                    <span className="flex-1 tx1">{rtl ? f.fa : f.en}</span>
                    <span className="font-mono text-[8px] tx4" dir="ltr">{f.ext}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="mx-1 h-5 w-px" style={{ background: "var(--line)" }} />

        {/* دو دکمهٔ قالب در یک کشو.
          *
          * این دو گزینه‌های یک انتخاب‌اند نه دو فرمان جدا، پس کنار هم
          * بودنشان القا می‌کرد که دو کار متفاوت انجام می‌دهند. در کشو،
          * قالب فعال روی خود دکمه دیده می‌شود و توضیح هر گزینه هم جا
          * می‌گیرد — به‌ویژه قفل بودن ستون‌های قالب ابلاغی که پیش از
          * این فقط در tooltip بود. */}
        <div className="relative">
          <button
            onClick={() => setTemplateOpen((v) => !v)}
            className="connect-btn flex items-center gap-1.5 rounded-lg px-2.5 py-1"
            title={rtl ? "انتخاب قالب ورود اطلاعات" : "Choose the import template"}
          >
            <span>⇧ {rtl ? "ورود به قالب" : "Import template"}</span>
            <span className="tx2">
              {rtl
                ? (templateKind === "internal" ? "داخلی" : "ابلاغی")
                : (templateKind === "internal" ? "internal" : "client")}
            </span>
            <span className="text-[8px] tx4">{templateOpen ? "▲" : "▼"}</span>
          </button>

          {templateOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setTemplateOpen(false)} />
              <div
                className="glass absolute z-30 mt-1 min-w-[230px] overflow-hidden rounded-xl border p-1"
                style={{ borderColor: "var(--line)", [rtl ? "right" : "left"]: 0 } as React.CSSProperties}
              >
                {TEMPLATE_PROFILES.map((tp) => (
                  <button
                    key={tp.kind}
                    onClick={() => { setTemplateKind(tp.kind); setTemplateOpen(false); }}
                    className={`flex w-full flex-col gap-0.5 rounded-lg px-2 py-1.5 text-start transition glass-row ${
                      templateKind === tp.kind ? "row-on" : ""
                    }`}
                  >
                    <span className="flex items-center gap-1.5 text-[9.5px] tx1">
                      <span className="w-3 text-center ok-t">{templateKind === tp.kind ? "✓" : ""}</span>
                      {rtl
                        ? (tp.kind === "internal" ? "ورود به قالب داخلی" : "ورود قالب ابلاغی")
                        : tp.title.en}
                      {!tp.editableColumns && <span className="text-[8px] tx4">🔒</span>}
                    </span>
                    <span className="ps-[18px] text-[8px] tx4">{rtl ? tp.note.fa : tp.note.en}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* زبان مقصد و ترجمهٔ تخصصی از داخل کارت به نوار ابزار آمدند.
          * هر سه به همان مدرک بالا مربوط‌اند، پس کنار دکمهٔ بارگذاری و
          * قالب ورود جای درست‌ترشان است. */}
        <div className="flex items-center gap-1 rounded-lg border b-line-soft px-1 py-0.5">
          {(["fa", "en"] as const).map((l) => (
            <button
              key={l}
              onClick={() => setTargetLang(l)}
              className={`rounded px-1.5 py-0.5 text-[9px] transition ${targetLang === l ? "toggle-on tx1" : "tx3 hover:tx1"}`}
            >
              {l === "fa" ? "فارسی" : "English"}
            </button>
          ))}
        </div>

        <button
          onClick={onTranslate}
          disabled={busy === "translate"}
          className="rounded-lg border px-2.5 py-1 tx1 transition hover:-translate-y-px disabled:opacity-50"
          style={{ borderColor: "rgba(245,197,110,.5)", background: "rgba(245,197,110,.16)" }}
        >
          {busy === "translate" ? (rtl ? "در حال ترجمه…" : "Translating…") : (rtl ? "ترجمه تخصصی" : "Translate")}
        </button>

        <button
          onClick={() => setLayoutLocked((v) => !v)}
          className={`rounded-lg px-2 py-1 transition ${layoutLocked ? "border b-line-soft tx3" : "toggle-on tx1"}`}
          title={rtl ? "قفل یا باز کردن چیدمان کارت‌ها" : "Lock or unlock the card layout"}
        >
          {layoutLocked ? (rtl ? "🔒 چیدمان قفل" : "🔒 Layout locked") : (rtl ? "🔓 چیدمان باز" : "🔓 Layout open")}
        </button>
      </div>

      {/* ── سربرگ و گام‌ها ── */}
      <div className="glass-dark rounded-2xl p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] tx1">ⓘ {rtl ? "کارگاه برنامه‌ریزی" : "Planning workshop"}</span>
          <div className="ms-auto flex flex-wrap gap-1">
            <button
              onClick={() => setStep("contract")}
              className={`rounded-lg px-2.5 py-1 text-[9px] transition ${step === "contract" ? "toggle-on tx1" : "border b-line-soft tx3"}`}
            >
              {rtl ? "۱. بارگذاری قرارداد و طراحی WBS با هوش مصنوعی" : "1. Contract & AI-assisted WBS"}
            </button>
            <button
              onClick={() => setStep("import")}
              className={`rounded-lg px-2.5 py-1 text-[9px] transition ${step === "import" ? "toggle-on tx1" : "border b-line-soft tx3"}`}
            >
              {rtl ? "۲. واردات برنامه از Primavera P6 / MSP" : "2. Import from P6 / MSP"}
            </button>
          </div>
        </div>

        {/* ══════════ گام ۱ ══════════ */}
        {step === "contract" && (
          <div className="mt-3">
            <LayoutShell
              scope="workshop-step1"
              rtl={rtl}
              titleFa="چیدمان کارگاه"
              titleEn="Workshop layout"
              externalLock={layoutLocked}
              onLockChange={setLayoutLocked}
              panels={[
                {
                  /* کارت اصلی: بارگذاری، ترجمه، استخراج و متن قرارداد.
                   * اجباری است چون بدون آن صفحه هیچ ورودی‌ای ندارد. */
                  id: "upload",
                  titleFa: "مدارک قراردادی",
                  titleEn: "Contract documents",
                  required: true,
                  defaultWidth: "full",
                  node: (
                    <div className="space-y-2">
          {/* نوار مدرک — فقط نام فایل.
            *
            * زبان مقصد، ترجمهٔ تخصصی و استخراج WBS به نوار ابزار بالا
            * منتقل شدند؛ آنجا کنار بارگذاری و قالب ورود می‌نشینند که
            * همگی به همین مدرک مربوط‌اند. اینجا فقط نشان می‌دهد چه
            * فایلی سوار است. */}
          <div
            className="flex flex-wrap items-center gap-2 rounded-xl border px-2.5 py-2"
            style={{ borderColor: "rgba(245,197,110,.35)", background: "rgba(245,197,110,.06)" }}
          >
            <span className="text-[13px]">🗎</span>
            <span className="text-[10px] tx1">{rtl ? "مدارک قراردادی" : "Contract docs"}</span>

            {/* نام مدرک به‌محض بارگذاری سبز می‌شود.
              *
              * پیش از این با همان رنگ خاکستریِ متنِ راهنما می‌ماند و
              * کاربر نمی‌فهمید فایل واقعاً سوار شده یا نه — تنها
              * بازخورد، خواندن خودِ نام بود. */}
            <div
              onClick={() => fileRef.current?.click()}
              className={`min-w-[140px] flex-1 cursor-pointer truncate rounded-lg border px-2 py-1 text-[9px] transition ${
                fileName ? "ok-t" : "b-line-soft tx3 hover:tx1"
              }`}
              style={{
                background: fileName ? "rgba(110,231,183,.10)" : "var(--row)",
                borderColor: fileName ? "rgba(110,231,183,.45)" : undefined,
              }}
              title={fileName || undefined}
            >
              {fileName ? `✓ ${fileName}` : (rtl ? "انتخاب فایل PDF / DOCX…" : "Choose PDF / DOCX…")}
            </div>

            {/* وضعیت فایل و دکمهٔ حذف.
              *
              * پیش از این هیچ نشانه‌ای از اندازه، زمان بارگذاری یا
              * تعداد گره نبود و راهی هم برای پاک کردن وجود نداشت —
              * کاربر نمی‌دانست چه چیزی سوار است و چطور عوضش کند. */}
            {fileInfo.hasFile && (
              <>
                <span className="text-[8px] tx4" dir="ltr">
                  {fileInfo.sizeLabel} · {fileInfo.charLabel} {rtl ? "نویسه" : "chars"}
                  {fileInfo.nodeCount > 0 ? ` · ${fileInfo.nodeCount} ${rtl ? "گره" : "nodes"}` : ""}
                </span>
                <span className="text-[8px] tx4">{fileInfo.loadedLabel}</span>
                {fileInfo.hasTranslation && (
                  <span className="rounded bg-emerald-400/10 px-1 py-[1px] text-[8px] ok-t">
                    {rtl ? "ترجمه دارد" : "translated"}
                  </span>
                )}
                {fileInfo.truncated && (
                  <span className="rounded bg-amber-400/10 px-1 py-[1px] text-[8px] text-amber-300">
                    {rtl ? "متن بریده شد" : "text truncated"}
                  </span>
                )}
                <button
                  onClick={onClearFile}
                  title={rtl ? "حذف فایل و ساختار" : "Remove file and structure"}
                  className="rounded-lg border b-line-soft px-1.5 py-1 text-[9px] tx3 transition hover:text-rose-300"
                >
                  ✕
                </button>
              </>
            )}


          </div>
          {/* خط وضعیت نازک */}
          <div className="flex flex-wrap items-center gap-2 px-1 text-[8.5px] tx4">
            {saveWarn && <span className="text-amber-300">⚠ {saveWarn}</span>}
            <span className="ok-dim-t">●</span>
            <span dir="ltr">SQL Server (.\SQL2008EXPRESS)</span>
            <span>·</span>
            <span>{rtl ? "مقصد:" : "Target:"} <b className="tx2">{targetLang === "fa" ? "فارسی" : "English"}</b></span>
            {detected.lang !== "unknown" && (
              <>
                <span>·</span>
                <span>
                  {rtl ? "زبان سند:" : "Detected:"}{" "}
                  <b className="tx2">
                    {detected.lang === "fa" ? (rtl ? "فارسی" : "Persian")
                      : detected.lang === "en" ? (rtl ? "انگلیسی" : "English")
                      : (rtl ? "دوزبانه" : "mixed")}
                  </b>
                </span>
              </>
            )}
            {terms.length > 0 && (
              <>
                <span>·</span>
                <span>
                  {rtl ? "اصطلاح تخصصی:" : "Terms:"}{" "}
                  {terms.slice(0, 5).map((tm) => (
                    <span key={tm.term} className="me-1 inline-block rounded bg-sky-400/10 px-1 py-[1px] text-sky-300">
                      {tm.term} ×{tm.count}
                    </span>
                  ))}
                </span>
              </>
            )}
          </div>

          {/* متن خام در یک کشو.
            *
            * فایلِ سبز یعنی سند داخل برنامه نشسته؛ دیگر لازم نیست متن
            * تمام‌وقت دیده شود. لازم است ولی هر روز نگاهش نمی‌کنند، پس
            * پشت یک دکمه رفت و جای بزرگ به نتیجه رسید. */}
          <div className="flex flex-wrap items-center gap-2 text-[9px]">
            <button
              onClick={() => setShowRawText((v) => !v)}
              className="rounded-lg border b-line-soft px-2 py-1 tx3 transition hover:tx1"
            >
              {showRawText ? "▲" : "▼"} {rtl ? "متن قرارداد" : "Contract text"}
              {rawText ? <span className="ms-1 tx4">({rawText.length.toLocaleString(rtl ? "fa-IR" : "en-US")})</span> : null}
            </button>

            {/* کلید نما فقط وقتی کشو باز است معنا دارد و فقط وقتی
              * ترجمه‌ای هست، گزینهٔ ترجمه را نشان می‌دهد. گزینه‌ای که
              * کلیک شود و چیزی نشان ندهد، کاربر را به شک می‌اندازد که
              * ترجمه گم شده است. */}
            {showRawText && (
              <div className="flex items-center gap-1 rounded-lg border b-line-soft px-1 py-0.5">
                {([
                  { id: "original" as const, fa: "اصلی", en: "Original" },
                  { id: "translated" as const, fa: "ترجمه", en: "Translation" },
                  { id: "split" as const, fa: "دوستونی", en: "Side by side" },
                ]).map((v) => {
                  /* دکمه غیرفعال نمی‌شود.
                   *
                   * کاربر گزارش داد «دوستونی و ترجمه غیرفعال‌اند» و حق
                   * داشت: دکمهٔ خاکستری نمی‌گوید چرا خاموش است. حالا
                   * کلیک می‌شود و دلیل را صریح اعلام می‌کند. */
                  const needsTranslation = v.id !== "original";
                  const blocked = needsTranslation && !translated;
                  return (
                    <button
                      key={v.id}
                      onClick={() => {
                        if (blocked) {
                          setNote({
                            kind: "warn",
                            text: rtl
                              ? "هنوز ترجمه‌ای انجام نشده. ابتدا دکمهٔ «ترجمه تخصصی» را در نوار بالا بزنید."
                              : "No translation yet — use the Translate button in the toolbar first.",
                          });
                          return;
                        }
                        setTextView(v.id);
                      }}
                      className={`rounded px-1.5 py-0.5 text-[8.5px] transition ${
                        textView === v.id ? "toggle-on tx1" : blocked ? "tx4" : "tx3 hover:tx1"
                      }`}
                    >
                      {rtl ? v.fa : v.en}
                    </button>
                  );
                })}
              </div>
            )}
            <span className="tx3">{rtl ? "اسکلت صنعتی:" : "Industry skeleton:"}</span>
            {OG_TEMPLATES.map((tp) => (
              <button
                key={tp.id}
                onClick={() => setTemplateId(tp.id)}
                title={rtl ? tp.note.fa : tp.note.en}
                className={`rounded-lg px-2 py-1 transition ${templateId === tp.id ? "toggle-on tx1" : "border b-line-soft tx3"}`}
              >
                {rtl ? tp.title.fa : tp.title.en}
              </button>
            ))}
          </div>

          {showRawText && (
            <div className="flex flex-wrap gap-2">
              {(textView === "original" || textView === "split") && (
                <div className={textView === "split" ? "min-w-[220px] flex-1" : "w-full"}>
                  {textView === "split" && (
                    <div className="mb-0.5 px-1 text-[8px] tx4" dir="ltr">{rtl ? "متن اصلی" : "Original"}</div>
                  )}
                  <textarea
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder={rtl
                      ? "متن قرارداد به هر زبانی (انگلیسی یا فارسی) را اینجا بچسبانید یا فایل را بارگذاری کنید…"
                      : "Paste the contract text in any language, or upload a file…"}
                    className="thin-scroll min-h-[130px] w-full rounded-2xl border b-line-soft bg-[var(--row)] p-2.5 text-[9.5px] tx1 outline-none focus:border-[var(--accent)]"
                  />
                </div>
              )}

              {(textView === "translated" || textView === "split") && translated && (
                <div className={textView === "split" ? "min-w-[220px] flex-1" : "w-full"}>
                  {textView === "split" && (
                    <div className="mb-0.5 px-1 text-[8px] tx4">{rtl ? "ترجمه" : "Translation"}</div>
                  )}
                  {/* ترجمه فقط خواندنی است. متن اصلی مرجع حقوقی است و
                    * ویرایش ترجمه این توهم را می‌سازد که سند عوض شده. */}
                  <textarea
                    value={translated}
                    readOnly
                    className="thin-scroll min-h-[130px] w-full rounded-2xl border p-2.5 text-[9.5px] tx1 outline-none"
                    style={{ borderColor: "rgba(110,231,183,.35)", background: "rgba(110,231,183,.05)" }}
                  />
                </div>
              )}
            </div>
          )}

          {note && (
            <div
              className="rounded-2xl px-3 py-2 text-[9.5px]"
              style={{
                background: note.kind === "ok" ? "rgba(110,231,183,.1)" : note.kind === "warn" ? "rgba(245,197,110,.1)" : "rgba(255,159,159,.1)",
                color: note.kind === "ok" ? "#8FE3C8" : note.kind === "warn" ? "#FFD48A" : "#FF9F9F",
              }}
            >
              {note.kind === "ok" ? "✓" : "⚠"} {note.text}
            </div>
          )}

          {/* کارت جداگانهٔ ترجمه حذف شد.
            *
            * ترجمه حالا داخل همان کشوی متن است، پس فضای اصلی صفحه
            * دست‌نخورده به ساختار شکست می‌رسد — چیزی که همیشه جلوی
            * چشم لازم است، برخلاف متن که گاهی مرور می‌شود. */}

          {/* ══ نتیجه: درخت ساختار شکست + نوار فرمان ══
            *
            * نوار فرمان عمداً چسبیده به پایین درخت است: دستور و چیزی که
            * تغییرش می‌دهد باید در یک نگاه باشند. پنجرهٔ چت جدا، کاربر
            * را وادار می‌کند بین دو جا نگاه کند و ربط دستور به نتیجه گم
            * می‌شود. */}
          <div className="glass-dark rounded-2xl p-2">
            <div className="mb-1.5 flex flex-wrap items-center gap-2 px-1 text-[9.5px]">
              <span className="tx1">{rtl ? "ساختار شکست تولیدشده" : "Generated breakdown"}</span>
              {nodes.length > 0 && (
                <span className="tx4">
                  {rtl
                    ? `${nodes.length} گره${clauses.length ? ` از ${clauses.length} بند` : ""}`
                    : `${nodes.length} nodes`}
                </span>
              )}
              {history.length > 0 && (
                <button
                  onClick={onUndo}
                  className="ms-auto rounded-lg border b-line-soft px-2 py-0.5 text-[9px] tx3 transition hover:tx1"
                  title={rtl ? "بازگشت یک گام" : "Undo one step"}
                >
                  ↶ {rtl ? "بازگشت" : "Undo"}
                </button>
              )}
            </div>

            {nodes.length === 0 ? (
              <div className="flex min-h-[190px] flex-col items-center justify-center gap-1 rounded-xl border border-dashed b-line-soft text-[9.5px] tx4">
                <span className="text-[20px] opacity-50">🌲</span>
                <span>{rtl ? "هنوز ساختاری ساخته نشده" : "No structure yet"}</span>
                <span className="text-[8.5px]">
                  {rtl ? "قرارداد را بارگذاری کنید و «استخراج WBS با AI» را بزنید" : "Upload a contract, then Extract WBS"}
                </span>
              </div>
            ) : (
              <div className="thin-scroll max-h-[320px] overflow-auto rounded-xl border b-line-soft">
                <table className="w-full min-w-[520px] border-collapse text-[9px]">
                  <thead className="sticky top-0" style={{ background: "var(--bg-c)" }}>
                    <tr className="border-b b-line-soft text-[8.5px] tx3">
                      <th className="px-2 py-1.5 text-start">{rtl ? "کد" : "Code"}</th>
                      <th className="px-2 py-1.5 text-start">{rtl ? "شرح" : "Description"}</th>
                      <th className="px-2 py-1.5 text-center">{rtl ? "سطح" : "Lvl"}</th>
                      <th className="px-2 py-1.5 text-start">{rtl ? "مرجع در قرارداد" : "Source"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nodes.slice(0, 300).map((n) => (
                      <tr key={n.code} className="border-b b-line-soft last:border-0 glass-row">
                        <td className="px-2 py-1 font-mono tx2" dir="ltr" style={{ paddingInlineStart: `${(n.depth - 1) * 12 + 8}px` }}>{n.code}</td>
                        <td className="px-2 py-1 tx1">{n.titleFa}</td>
                        <td className="px-2 py-1 text-center tx3">{n.depth}</td>
                        <td className="px-2 py-1 tx4">{n.sourceRefFa ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* سه پیام آخر — نه پنجرهٔ چت کامل. این ابزار مهندسی است
              * نه پیام‌رسان. */}
            {history.length > 0 && (
              <div className="mt-1.5 space-y-0.5 px-1">
                {history.slice(-3).map((h, i) => (
                  <div key={i} className="flex flex-wrap items-start gap-1.5 text-[8.5px]">
                    <span className="tx4">›</span>
                    <span className="tx2">{h.command}</span>
                    <span className="tx4">—</span>
                    <span className="tx3">{h.messageFa}</span>
                  </div>
                ))}
              </div>
            )}

            {/* نوار فرمان */}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="text-[12px]">💬</span>
              <input
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) runCommand(command); }}
                placeholder={rtl
                  ? "دستور بدهید… مثلاً: تا سطح ۳ نگه دار"
                  : "Give an instruction… e.g. keep to level 3"}
                className="min-w-[180px] flex-1 rounded-xl border b-line-soft bg-[var(--row)] px-2.5 py-1.5 text-[9.5px] tx1 outline-none focus:border-[var(--accent)]"
              />
              <button
                onClick={() => runCommand(command)}
                disabled={busy !== null || !command.trim()}
                className="rounded-xl border px-3 py-1.5 text-[9.5px] tx1 transition hover:-translate-y-px disabled:opacity-40"
                style={{ borderColor: "rgba(216,180,254,.5)", background: "rgba(216,180,254,.14)" }}
              >
                {busy === "cmd" ? (rtl ? "…" : "…") : "↵"}
              </button>
            </div>

            {/* نمونه‌فرمان‌ها — کاربر باید بداند چه چیزی می‌تواند بگوید. */}
            <div className="mt-1 flex flex-wrap gap-1 px-1">
              {COMMAND_HINTS.map((h) => (
                <button
                  key={h.en}
                  onClick={() => runCommand(rtl ? h.fa : h.en)}
                  disabled={busy !== null}
                  className="rounded-lg border b-line-soft px-1.5 py-0.5 text-[8px] tx4 transition hover:tx2 disabled:opacity-40"
                >
                  {rtl ? h.fa : h.en}
                </button>
              ))}
            </div>
          </div>
                    </div>
                  ),
                },
              ]}
            />
          </div>
        )}

        {/* ══════════ گام ۲ ══════════ */}
        {step === "import" && (
          <div className="mt-3 space-y-2">
            <div
              className="rounded-2xl border p-4 text-center"
              style={{ borderColor: "rgba(127,178,255,.4)", background: "rgba(127,178,255,.06)" }}
            >
              <div className="text-[11px] tx1">{rtl ? "واردات برنامهٔ زمان‌بندی" : "Import schedule"}</div>
              <div className="mt-1 text-[9px] tx3">
                {rtl ? "Primavera P6 (XER) · MS Project (XML) · اکسل (XLSX)" : "Primavera P6 (XER) · MS Project (XML) · Excel (XLSX)"}
              </div>
              <button
                onClick={() => importRef.current?.click()}
                disabled={busy !== null}
                className="mt-3 rounded-xl border px-4 py-2 text-[10px] tx1 transition hover:-translate-y-px disabled:opacity-50"
                style={{ borderColor: "rgba(127,178,255,.5)", background: "rgba(127,178,255,.14)" }}
              >
                {busy === "import" ? (rtl ? "در حال خواندن…" : "Reading…") : (rtl ? "انتخاب فایل برنامه" : "Choose schedule file")}
              </button>
              <input ref={importRef} type="file" accept=".xer,.xml,.xlsx,.xls,.csv" hidden onChange={(e) => onImportSchedule(e.target.files?.[0] ?? null)} />
              <div className="mt-2 text-[8.5px] tx4">
                {rtl
                  ? "فرمت MPP پشتیبانی نمی‌شود — از MSP خروجی XML بگیرید."
                  : "MPP is not supported; export XML from MSP."}
              </div>
            </div>

            {note && (
              <div
                className="rounded-2xl px-3 py-2 text-[9.5px]"
                style={{
                  background: note.kind === "ok" ? "rgba(110,231,183,.1)" : note.kind === "warn" ? "rgba(245,197,110,.1)" : "rgba(255,159,159,.1)",
                  color: note.kind === "ok" ? "#8FE3C8" : note.kind === "warn" ? "#FFD48A" : "#FF9F9F",
                }}
              >
                {note.kind === "ok" ? "✓" : "⚠"} {note.text}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══════════ پیش‌نمایش ══════════ */}
      {preview !== null && (
        <div className="glass rounded-2xl p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-[10.5px] tx1">{rtl ? "پیش‌نمایش" : "Preview"}</span>
            <span className="font-mono text-[9px] tx3" dir="ltr">{preview.title}</span>
            <button onClick={() => setPreview(null)} className="ms-auto rounded-lg border b-line-soft px-2 py-0.5 text-[9px] tx3 hover:tx1">
              {rtl ? "بستن" : "Close"}
            </button>
          </div>

          {preview.kind === "table" ? (
            <div className="thin-scroll max-h-72 overflow-auto rounded-xl border b-line-soft bg-black/10 p-2">
              <table className="w-full border-collapse text-[9px]">
                <thead>
                  <tr className="border-b b-line-soft tx3">
                    {preview.head.map((h, i) => <th key={i} className="whitespace-nowrap px-1.5 py-1 text-start">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {preview.body.map((r, i) => (
                    <tr key={i} className="border-b b-line-soft last:border-0">
                      {r.map((c, j) => (
                        <td key={j} className="whitespace-nowrap px-1.5 py-1 tx2" dir={typeof c === "number" ? "ltr" : undefined}>
                          {c === null || c === undefined || c === "" ? <span className="tx4">—</span> : String(c)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <pre className="thin-scroll max-h-72 overflow-auto rounded-xl border b-line-soft bg-black/10 p-2 text-[8.5px] tx2" dir="ltr">
              {preview.text}
            </pre>
          )}

          <p className="mt-2 text-[8.5px] tx4">
            {rtl
              ? `${preview.kind === "table" ? preview.body.length : preview.text.split("\n").length} سطر · هیچ فایلی بدون پیش‌نمایش خارج نمی‌شود.`
              : `${preview.kind === "table" ? preview.body.length : preview.text.split("\n").length} rows`}
          </p>
        </div>
      )}
    </div>
  );
}
