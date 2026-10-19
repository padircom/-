/**
 * کارگاه برنامه‌ریزی — از قرارداد تا برنامهٔ زمان‌بندی.
 *
 * چیدمان مطابق طرحی است که کارفرما داد:
 *
 *   نوار ابزار بالا: بارگذاری مدارک · استخراج WBS · کشوی خروجی · کشوی قالب ورود
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

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Lang } from "../data/framework";
import { parseClauses, sourceRefFa, type ParsedClause } from "../services/clauseParser";
import {
  detectGlossaryTerms,
  detectLanguage,
  offlineGlossaryTranslate,
  seedFromTemplate,
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

/** Render above the scrollable planning workspace instead of beneath its glass layer. */
function WorkshopMenu({ anchor, width, rtl, onClose, children }: {
  anchor: React.RefObject<HTMLButtonElement | null>;
  width: number;
  rtl: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const place = () => {
    const rect = anchor.current?.getBoundingClientRect();
    if (!rect) return { top: 0, left: 0 };
    const left = Math.max(8, Math.min(window.innerWidth - width - 8, rtl ? rect.right - width : rect.left));
    const menuHeight = width === 280 ? 270 : 150;
    const top = rect.bottom + menuHeight + 8 > window.innerHeight
      ? Math.max(8, rect.top - menuHeight - 4)
      : rect.bottom + 4;
    return { top, left };
  };
  const [position, setPosition] = useState(place);
  useEffect(() => {
    const reposition = () => setPosition(place());
    reposition();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => { window.removeEventListener("scroll", reposition, true); window.removeEventListener("resize", reposition); };
  }, [anchor, width, rtl]);
  return createPortal(<>
    <div className="fixed inset-0 z-[80]" onClick={onClose} aria-hidden="true" />
    <div dir={rtl ? "rtl" : "ltr"} className="fixed z-[81] max-h-[min(60vh,400px)] overflow-y-auto rounded-xl border p-2 shadow-2xl" style={{ ...position, width, background: "var(--bg-b)", color: "var(--ink)", borderColor: "var(--accent)", boxShadow: "0 18px 46px rgba(0,0,0,.55)" }}>
      {children}
    </div>
  </>, document.body);
}

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
  const [templateId] = useState<string>(seed.templateId);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportId, setExportId] = useState("pdf");
  const [, setTemplateOpen] = useState(false);
  const exportAnchor = useRef<HTMLButtonElement>(null);
  const [command, setCommand] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

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
      runExtract(text);
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
        runExtract(text);
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

  const runExtract = (sourceText: string) => {
    const source = sourceText.trim();
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

  /* خروجی JSON مدل را به گره‌های WBS تبدیل می‌کند؛ عمق از زنجیرهٔ والد
   * حساب می‌شود (تا ۸). هر خروجی ناقص/نامعتبر null برمی‌گرداند تا
   * کف قاعده‌محور بی‌صدا جای آن بنشیند. */
  const parseAiNodes = (out: string): ExportNode[] | null => {
    try {
      const start = out.indexOf("[");
      const end = out.lastIndexOf("]");
      if (start < 0 || end <= start) return null;
      const arr = JSON.parse(out.slice(start, end + 1)) as Record<string, unknown>[];
      if (!Array.isArray(arr) || !arr.length) return null;
      const byCode = new Map<string, Record<string, unknown>>();
      for (const n of arr) if (n && typeof n.code === "string") byCode.set(n.code, n);
      const depthOf = (code: string, guard = 0): number => {
        const n = byCode.get(code);
        const p = n && typeof n.parentCode === "string" ? n.parentCode : null;
        if (!p || !byCode.has(p) || guard > 8) return 1;
        return Math.min(8, depthOf(p, guard + 1) + 1);
      };
      return arr
        .filter((n) => n && typeof n.code === "string")
        .map((n) => ({
          code: String(n.code),
          parentCode: typeof n.parentCode === "string" && byCode.has(n.parentCode) ? n.parentCode : null,
          titleFa: typeof n.titleFa === "string" ? n.titleFa : String(n.code),
          titleEn: typeof n.titleEn === "string" ? n.titleEn : undefined,
          depth: depthOf(String(n.code)),
          weightFactor: typeof n.weightPct === "number" ? n.weightPct : null,
          weightValue: null,
          amount: null,
          sourceRefFa: typeof n.sourceRef === "string" ? n.sourceRef : null,
          actualPct: null,
          plannedPct: null,
        }));
    } catch {
      return null;
    }
  };

  /* استخراج اصلی: اگر ارائه‌دهندهٔ AI و کلید تنظیم شده باشد، ساختار از
   * مدل ساخته می‌شود (همان کاری که کاربر از Claude می‌گیرد)؛ وگرنه
   * موتور قاعده‌محور. نتیجه صریح می‌گوید کدام موتور ساخته است. */
  const onExtractWbs = async () => {
    const source = rawText.trim();
    if (!source) {
      setNote({ kind: "err", text: rtl ? "متنی برای استخراج نیست." : "Nothing to extract." });
      return;
    }
    /* «rule» در این لایه ارائه‌دهنده نیست (ارائه‌دهندگان: arena/openai/deepseek/local/mock
     * و «local» سمت سرور به موتور قاعده‌محور نگاشت می‌شود) ⇒ این شاخه همان
     * مسیر «mock» یا نبودِ کلید API است. */
    if (provider === "mock" || !secret.trim()) {
      runExtract(source);
      setNote({
        kind: "warn",
        text: rtl
          ? "ساختار با موتور قاعده‌محور ساخته شد. برای ساختار هوشمند شبیه Claude، ارائه‌دهنده و کلید AI را در «مدیریت سامانه ← هوش مصنوعی و یکپارچگی» تنظیم کنید."
          : "Built with the rule engine. For Claude-like AI structure, configure an AI provider and key under System Management → AI & Integrations.",
      });
      return;
    }
    setBusy("wbs");
    setNote(null);
    try {
      const res = await fetch("/api/ai/run", {
        method: "POST",
        headers: { "content-type": "application/json", "x-ai-key": secret },
        body: JSON.stringify({ prompt: "wbs", context: { provider, templateId, text: source.slice(0, 24000) } }),
      });
      const json = await res.json().catch(() => null);
      const aiNodes = typeof json?.data?.translated === "string" ? parseAiNodes(json.data.translated) : null;
      if (aiNodes?.length) {
        setNodes(aiNodes);
        setNote({ kind: "ok", text: rtl ? `${aiNodes.length} گره با هوش مصنوعی از متن قرارداد ساخته شد.` : `${aiNodes.length} nodes built by AI from the contract text.` });
      } else {
        runExtract(source);
        setNote({ kind: "warn", text: rtl ? "پاسخ AI قابل استفاده نبود؛ ساختار با موتور قاعده‌محور ساخته شد." : "AI response unusable; built with the rule engine instead." });
      }
    } catch {
      runExtract(source);
      setNote({ kind: "warn", text: rtl ? "اتصال به AI برقرار نشد؛ ساختار با موتور قاعده‌محور ساخته شد." : "AI unreachable; built with the rule engine instead." });
    } finally {
      setBusy(null);
    }
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

  /* ── دانلود واقعی از سرور: انتخاب قالب جدا، اجرا جدا ── */
  const runExportDownload = async () => {
    if (!nodes.length) return setNote({ kind: "err", text: rtl ? "ابتدا ساختار را بسازید." : "Build the structure first." });
    try {
      if (exportId === "pdf") { window.print(); return; }

      const payload = exportId === "excel"
        ? {
            format: "excel",
            fileName: exportFileName(letterhead, "wbs", "xlsx"),
            rows: buildSheet("wbs", nodes, letterhead, [], lang).rows,
          }
        : exportId === "xer"
          ? {
              format: "xer",
              fileName: exportFileName(letterhead, "wbs", "xer"),
              text: buildXer(nodes, letterhead),
            }
          : {
              format: "xml",
              fileName: exportFileName(letterhead, "wbs", "xml"),
              text: buildMspXml(nodes, letterhead),
            };

      const res = await fetch("/api/contract-workshop/export-download", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      const downloadUrl = typeof json?.data?.downloadUrl === "string" ? json.data.downloadUrl : "";
      if (!res.ok || !downloadUrl) throw new Error("Export download was not created.");

      const a = document.createElement("a");
      a.href = downloadUrl;
      a.target = "_blank";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();

      setNote({ kind: "ok", text: rtl ? `دانلود خروجی «${rtl ? selectedFormat.fa : selectedFormat.en}» آغاز شد.` : "Export download started." });
    } catch {
      setNote({ kind: "err", text: rtl ? "ساخت فایل خروجی ناموفق بود." : "Export failed." });
    }
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
  const selectedFormat = EXPORT_FORMATS.find((f) => f.id === exportId) ?? EXPORT_FORMATS[1];

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
      <style>{`
        .contract-print-only { display: none; }
        @page { size: A4 portrait; margin: 6mm; }
        @media print {
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          body * { visibility: hidden !important; }
          #contract-wbs-print-root, #contract-wbs-print-root * { visibility: visible !important; }
          #contract-wbs-print-root {
            position: fixed !important; inset: 0 auto auto 0 !important; box-sizing: border-box !important;
            width: 198mm !important; margin: 0 !important; box-shadow: none !important; background: #fff !important;
            print-color-adjust: exact !important; -webkit-print-color-adjust: exact !important;
          }
          #contract-wbs-print-root .thin-scroll { max-height: none !important; overflow: visible !important; }
          #contract-wbs-print-root thead { position: static !important; }
          .contract-print-only { display: block !important; }
          .contract-no-print { display: none !important; }
        }
      `}</style>
      {/* ترتیب کار: آماده‌سازی قرارداد و ساختار شکست، سپس دریافت برنامه.
          واردات فایل برنامه مستقلاً مجاز است؛ گام دوم را قفل نمی‌کنیم. */}
      <nav aria-label={rtl ? "مراحل کارگاه برنامه‌ریزی" : "Planning workshop steps"} className="flex items-stretch gap-2">
        <button type="button" onClick={() => setStep("contract")} aria-current={step === "contract" ? "step" : undefined}
          className={`flex min-w-0 flex-1 items-center gap-2 rounded-xl border px-3 py-2 text-start transition hover:border-amber-300/60 ${step === "contract" ? "border-amber-300/60 bg-amber-400/12 tx1" : "b-line-soft glass-row tx2"}`}>
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-amber-300/50 text-[11px] font-semibold">۱</span>
          <span className="min-w-0"><strong className="block text-[10.5px]">{rtl ? "قرارداد و ساختار شکست" : "Contract & breakdown"}</strong>
            <small className="block truncate text-[9px] tx3">{nodes.length ? (rtl ? "ساختار آماده است" : "Breakdown ready") : fileName ? (rtl ? "قرارداد بارگذاری شد" : "Contract loaded") : (rtl ? "بارگذاری و استخراج WBS" : "Upload & extract WBS")}</small></span>
        </button>
        <span className="self-center text-[16px] tx3" aria-hidden="true">{rtl ? "←" : "→"}</span>
        <button type="button" onClick={() => setStep("import")} aria-current={step === "import" ? "step" : undefined}
          className={`flex min-w-0 flex-1 items-center gap-2 rounded-xl border px-3 py-2 text-start transition hover:border-sky-300/60 ${step === "import" ? "border-sky-300/60 bg-sky-400/12 tx1" : "b-line-soft glass-row tx2"}`}>
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-sky-300/50 text-[11px] font-semibold">۲</span>
          <span className="min-w-0"><strong className="block text-[10.5px]">{rtl ? "برنامهٔ زمان‌بندی" : "Schedule import"}</strong>
            <small className="block truncate text-[9px] tx3">{rtl ? "واردات Primavera P6 / MSP" : "Import Primavera P6 / MSP"}</small></span>
        </button>
      </nav>

      {/* ابزارهای قرارداد فقط در گام اول نشان داده می‌شوند. */}
      {step === "contract" && <div className="glass-dark flex flex-nowrap items-center gap-1.5 rounded-2xl p-2 text-[9px]">
        <button
          onClick={() => fileRef.current?.click()}
          className="shrink-0 whitespace-nowrap rounded-lg border px-2 py-1 tx1 transition hover:-translate-y-px"
          style={{ borderColor: "rgba(245,197,110,.5)", background: "rgba(245,197,110,.1)" }}
        >
          📄 {rtl ? "بارگذاری مدارک قراردادی" : "Upload contract"}
        </button>
        <input ref={fileRef} type="file" accept=".pdf,.docx,.txt" hidden onChange={(e) => onPickFile(e.target.files?.[0] ?? null)} />
        {fileInfo.hasFile && <span className="flex min-w-[96px] flex-[0_1_168px] items-center gap-1 rounded-lg border b-line-soft px-1.5 py-1 text-[8.5px] tx2">
          <span className="min-w-0 flex-1 truncate" title={fileName}>✓ {fileName}</span>
          <span className="shrink-0 tx4">{fileInfo.sizeLabel}</span>
          <button type="button" onClick={onClearFile} title={rtl ? "حذف فایل و ساختار" : "Remove file and structure"} className="shrink-0 rounded px-0.5 text-rose-300 hover:text-rose-200">✕</button>
        </span>}

        <div className="h-5 w-px shrink-0" style={{ background: "var(--line)" }} />

        {/* پیش از این یک برچسب بی‌کار بود که هیچ کاری نمی‌کرد.
          * دکمه‌ای که کلیک می‌شود و هیچ اتفاقی نمی‌افتد بدتر از نبودنش
          * است، پس به همان کار واقعی این صفحه وصل شد. */}
        <button
          onClick={() => void onExtractWbs()}
          /* فقط وقتی خودِ استخراج در جریان است غیرفعال می‌شود.
           * پیش از این هر کار دیگری (ترجمه، بارگذاری) دکمه را خاموش
           * می‌کرد و اگر آن کار در میانه رها می‌شد، دکمه خاموش
           * می‌ماند. */
          disabled={busy === "wbs"}
          className="shrink-0 whitespace-nowrap rounded-lg border px-2 py-1 tx1 transition hover:-translate-y-px disabled:opacity-50"
          style={{ borderColor: "rgba(216,180,254,.5)", background: "rgba(216,180,254,.1)" }}
        >
          ✨ {rtl ? "استخراج WBS با AI" : "Extract WBS with AI"}
        </button>

        {/* خروجی‌ها در یک خوشهٔ مستقل و یکپارچه می‌مانند تا هنگام
          * کمبود عرض، کل خوشه با هم جابه‌جا شود و «پیش‌نمایش» تنها
          * در ردیف بعد نیفتد. */}
        <div className="ms-auto flex min-w-[278px] flex-[0_1_348px] flex-nowrap items-center gap-1 rounded-xl border b-line-soft bg-[var(--row)] p-1" aria-label={rtl ? "خروجی ساختار شکست" : "Breakdown export"}>
        <span className="shrink-0 px-0.5 tx3">{rtl ? "خروجی:" : "Export:"}</span>
        <div className="relative min-w-[104px] flex-1">
          <button
            ref={exportAnchor}
            onClick={() => { setTemplateOpen(false); setExportOpen((v) => !v); }}
            aria-expanded={exportOpen}
            className="flex w-full items-center gap-1 rounded-lg border border-sky-400/40 bg-sky-400/10 px-1.5 py-1 text-start transition hover:bg-sky-400/15"
            title={rtl ? "انتخاب قالب خروجی" : "Choose an export format"}
          >
            <span className="shrink-0 text-[11px]">{selectedFormat.icon}</span>
            <span className="min-w-0 flex-1 truncate text-[9.5px] font-medium tx1">{rtl ? selectedFormat.fa : selectedFormat.en}</span>
            <span className="shrink-0 rounded border b-line-soft px-1 py-px font-mono text-[7.5px] tx3" dir="ltr">{selectedFormat.ext}</span>
            <span className="shrink-0 text-[7px] tx4">{exportOpen ? "▲" : "▼"}</span>
          </button>

          {exportOpen && (
            <WorkshopMenu anchor={exportAnchor} width={240} rtl={rtl} onClose={() => setExportOpen(false)}>
                {EXPORT_FORMATS.map((f) => {
                  const active = f.id === exportId;
                  return (
                    <button
                      key={f.id}
                      onClick={() => { setExportId(f.id); setExportOpen(false); }}
                      aria-pressed={active}
                      className={`flex w-full items-center gap-1.5 rounded-lg border px-2.5 py-2 text-start transition ${active ? "border-sky-400/60 bg-sky-400/12" : "b-line-soft bg-[var(--bg-c)] hover:bg-[var(--row-hover)]"}`}
                    >
                      <span className="w-4 shrink-0 text-center text-[13px]">{f.icon}</span>
                      <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-[var(--ink)]">{rtl ? f.fa : f.en}</span>
                      <span className="rounded border b-line-soft px-1 py-0.5 font-mono text-[9px] text-[var(--ink2)]" dir="ltr">{f.ext}</span>
                      {active && <span className="text-[11px] text-sky-300">✓</span>}
                    </button>
                  );
                })}
            </WorkshopMenu>
          )}
        </div>
        <button
          onClick={runExportDownload}
          disabled={!nodes.length}
          className="shrink-0 whitespace-nowrap rounded-lg border border-emerald-400/50 bg-emerald-400/15 px-2 py-1 text-[9.5px] font-medium text-emerald-200 transition hover:bg-emerald-400/25 disabled:opacity-40"
          title={rtl ? "تولید و دانلود قالب انتخاب‌شده" : "Generate and download the selected format"}
        >
          ⬇ {rtl ? "دریافت خروجی" : "Download"}
        </button>
        <button
          onClick={() => selectedFormat.run()}
          disabled={!nodes.length}
          className="shrink-0 whitespace-nowrap rounded-lg border b-line-soft px-2 py-1 text-[9.5px] tx2 transition hover:tx1 disabled:opacity-40"
          title={rtl ? "پیش‌نمایش قالب انتخاب‌شده" : "Preview the selected format"}
        >
          👁 {rtl ? "پیش‌نمایش" : "Preview"}
        </button>
        </div>

      </div>}

      <div className="glass-dark rounded-2xl p-3">
        {/* ══════════ گام ۱ ══════════ */}
        {step === "contract" && (
          <div className="mt-3">
            <div className="space-y-2">
          {/* وضعیت سند و کنترل زبان در یک نوار فشرده؛ کنترل‌ها در
            * انتهای همان نوار می‌نشینند و ردیف جدا اشغال نمی‌کنند. */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-xl border b-line-soft bg-[var(--row)] px-2 py-1.5 text-[8.5px] tx4">
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
            <div className="ms-auto flex shrink-0 flex-wrap items-center gap-1.5">
            <span className="text-[8.5px] tx4">{rtl ? "زبان مقصد:" : "Target language:"}</span>
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
              className="rounded-lg border px-2.5 py-1 text-[9px] tx1 transition hover:-translate-y-px disabled:opacity-50"
              style={{ borderColor: "rgba(245,197,110,.5)", background: "rgba(245,197,110,.16)" }}
            >
              {busy === "translate" ? (rtl ? "در حال ترجمه…" : "Translating…") : (rtl ? "ترجمه تخصصی" : "Translate")}
            </button>
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

          {/* ══ نتیجه: درخت ساختار شکست + نوار فرمان ══
            *
            * نوار فرمان عمداً چسبیده به پایین درخت است: دستور و چیزی که
            * تغییرش می‌دهد باید در یک نگاه باشند. پنجرهٔ چت جدا، کاربر
            * را وادار می‌کند بین دو جا نگاه کند و ربط دستور به نتیجه گم
            * می‌شود. */}
          <div id="contract-wbs-print-root" className="glass-dark rounded-2xl p-2">
            <div className="contract-print-only" style={{ marginBottom: 8 }}>
              {(() => {
                const sheet = buildSheet("wbs", nodes, letterhead, [], lang);
                const head = sheet.rows.slice(0, sheet.headerRowIndex);
                const titles = sheet.rows[sheet.headerRowIndex];
                const body = sheet.rows.slice(sheet.headerRowIndex + 2);
                return (
                  <table className="w-full border-collapse" style={{ fontSize: 9 }}>
                    <tbody>
                      {head.map((r, i) => (
                        <tr key={`h-${i}`}>
                          {r.map((c, j) => (
                            <td key={j} style={{ padding: "1px 4px", fontWeight: j % 2 === 0 ? 700 : 400 }}>{c === null || c === undefined || c === "" ? "" : String(c)}</td>
                          ))}
                        </tr>
                      ))}
                      <tr>
                        {titles.map((t, i) => (
                          <th key={i} style={{ border: "1px solid #999", background: "#dbe5f0", padding: "2px 4px", textAlign: "start" }}>{t === null ? "" : String(t)}</th>
                        ))}
                      </tr>
                      {body.map((r, i) => (
                        <tr key={`b-${i}`}>
                          {r.map((c, j) => (
                            <td key={j} style={{ border: "1px solid #bbb", padding: "1px 4px" }}>{c === null || c === undefined || c === "" ? "—" : String(c)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}
            </div>
            <div className="contract-no-print mb-2 flex flex-wrap items-center gap-1.5 border-b b-line-soft px-1 pb-2 text-[9.5px]">
              <span className="text-[11px]">🌲</span>
              <span className="font-semibold tx1">{rtl ? "ساختار شکست تولیدشده" : "Generated breakdown"}</span>
              {nodes.length > 0 && (
                <>
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2 py-0.5 text-[8.5px] text-emerald-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                    {rtl ? "آمادهٔ خروجی" : "Ready to export"}
                  </span>
                  <span className="rounded-full border b-line-soft px-2 py-0.5 text-[8.5px] tx3">
                    {rtl ? `${nodes.length} گره` : `${nodes.length} nodes`}
                  </span>
                  <span className="rounded-full border b-line-soft px-2 py-0.5 text-[8.5px] tx3">
                    {rtl ? `حداکثر سطح ${Math.max(...nodes.map((n) => n.depth))}` : `Max level ${Math.max(...nodes.map((n) => n.depth))}`}
                  </span>
                  {clauses.length > 0 && (
                    <span className="rounded-full border b-line-soft px-2 py-0.5 text-[8.5px] tx3">
                      {rtl ? `از ${clauses.length} بند قرارداد` : `From ${clauses.length} clauses`}
                    </span>
                  )}
                </>
              )}
              {history.length > 0 && (
                <button
                  onClick={onUndo}
                  className="contract-no-print ms-auto rounded-lg border b-line-soft px-2 py-0.5 text-[9px] tx3 transition hover:tx1"
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
              <div className="contract-no-print thin-scroll max-h-[340px] overflow-auto rounded-xl border b-line-soft bg-[var(--bg-c)]">
                <table className="w-full min-w-[520px] table-fixed border-collapse text-[9px]">
                  <colgroup>
                    <col style={{ width: "23%" }} />
                    <col style={{ width: "42%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "25%" }} />
                  </colgroup>
                  <thead className="sticky top-0 z-10" style={{ background: "var(--bg-c)" }}>
                    <tr className="border-b b-line-soft text-[8.5px] tx3">
                      <th className="px-2 py-2 text-start font-semibold">{rtl ? "کد" : "Code"}</th>
                      <th className="px-2 py-2 text-start font-semibold">{rtl ? "شرح" : "Description"}</th>
                      <th className="px-2 py-2 text-center font-semibold">{rtl ? "سطح" : "Lvl"}</th>
                      <th className="px-2 py-2 text-start font-semibold">{rtl ? "مرجع در قرارداد" : "Source"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nodes.slice(0, 300).map((n) => (
                      <tr key={n.code} className={`border-b b-line-soft last:border-0 glass-row ${n.depth === 1 ? "bg-[var(--row)]" : ""}`}>
                        <td className="px-2 py-1.5 tx2" style={{ paddingInlineStart: `${(n.depth - 1) * 12 + 8}px` }}>
                          <span className="inline-block font-mono" dir="ltr">{n.code}</span>
                        </td>
                        <td className={`px-2 py-1.5 tx1 ${n.depth === 1 ? "font-semibold" : ""}`}>{n.titleFa}</td>
                        <td className="px-2 py-1.5 text-center">
                          <span className="inline-grid h-5 min-w-5 place-items-center rounded-full border b-line-soft px-1 text-[8px] tx3">{n.depth}</span>
                        </td>
                        <td className="px-2 py-1.5 tx4">{n.sourceRefFa ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {nodes.length > 300 && (
                  <div className="border-t b-line-soft px-2 py-1.5 text-center text-[8.5px] tx4">
                    {rtl ? `نمایش ۳۰۰ گرهٔ نخست از ${nodes.length} گره` : `Showing the first 300 of ${nodes.length} nodes`}
                  </div>
                )}
              </div>
            )}

            {/* سه پیام آخر — نه پنجرهٔ چت کامل. این ابزار مهندسی است
              * نه پیام‌رسان. */}
            {history.length > 0 && (
              <div className="contract-no-print mt-1.5 space-y-0.5 px-1">
                {history.slice(-3).map((h, i) => (
                  <div key={i} className="flex flex-wrap items-start gap-1.5 text-[8.5px]">
                    <span className="inline-block tx4 rtl:rotate-180">›</span>
                    <span className="tx2">{h.command}</span>
                    <span className="tx4">—</span>
                    <span className="tx3">{h.messageFa}</span>
                  </div>
                ))}
              </div>
            )}

            {/* نوار فرمان */}
            <div className="contract-no-print mt-1.5 flex flex-wrap items-center gap-1.5">
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
            <div className="contract-no-print mt-1 flex flex-wrap gap-1 px-1">
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
            {preview.kind === "table" && preview.title.endsWith(".pdf") && (
              <button onClick={() => window.print()} className="rounded-lg border border-sky-400/40 bg-sky-400/10 px-2 py-0.5 text-[9px] text-sky-200 hover:bg-sky-400/20">
                🖨 {rtl ? "چاپ / PDF" : "Print / PDF"}
              </button>
            )}
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
