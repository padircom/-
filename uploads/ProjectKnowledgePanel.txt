import { useEffect, useRef, useState } from "react";
import { useSystem } from "../context/SystemContext";
import { useAuth } from "../context/AuthContext";
import { pmisApiClient } from "../services/pmisApiClient";
import { type KnowledgeDocumentDto, type OcrJobDto, type RagAnswerDto } from "../services/pmisContract";
import { t, type Lang } from "../data/framework";

export default function ProjectKnowledgePanel({ lang }: { lang: Lang }) {
  const rtl = lang === "fa";
  const { projectScope, projectsByCluster, clusters } = useSystem();
  const { can, audit } = useAuth();
  const [documents, setDocuments] = useState<KnowledgeDocumentDto[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<RagAnswerDto | null>(null);
  const [busy, setBusy] = useState<"load" | "upload" | "ask" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [documentType, setDocumentType] = useState("contract");
  const [ocrLanguage, setOcrLanguage] = useState("fas+eng");
  const [ocrJobs, setOcrJobs] = useState<OcrJobDto[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const ocrRef = useRef<HTMLInputElement | null>(null);

  const cluster = clusters.find((row) => row.id === projectScope?.clusterId);
  const project = projectScope ? projectsByCluster[projectScope.clusterId]?.find((row) => row.id === projectScope.projectId) : undefined;
  const projectCode = project?.code ?? projectScope?.projectId ?? "";
  const allowed = can("ai.run", projectScope?.projectId);

  const load = async () => {
    if (!projectCode) return;
    setBusy("load"); setError(null);
    try {
      setDocuments(await pmisApiClient.getKnowledgeDocuments(projectCode));
      setOcrJobs(await pmisApiClient.getOcrJobs(projectCode));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const uploadOcr = async (files: FileList | null) => {
    if (!files?.length || !projectCode || !allowed) return;
    setBusy("upload"); setError(null); setAnswer(null);
    try {
      const job = await pmisApiClient.ingestOcrDocument(projectCode, { file: files[0], documentType: "ocr_scan", languageCode: ocrLanguage });
      setOcrJobs((current) => [job, ...current.filter((item) => item.id !== job.id)]);
      await load();
      audit("OCR_INGEST_DOCUMENT", { projectId: projectScope?.projectId, entity: "OCR_Job", entityId: job.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
      if (ocrRef.current) ocrRef.current.value = "";
    }
  };

  useEffect(() => { void load(); }, [projectCode]);

  const upload = async (files: FileList | null) => {
    if (!files?.length || !projectCode || !allowed) return;
    setBusy("upload"); setError(null); setAnswer(null);
    try {
      const document = await pmisApiClient.ingestKnowledgeDocument(projectCode, { file: files[0], documentType });
      setDocuments((current) => [document, ...current.filter((item) => item.id !== document.id)]);
      audit("INGEST_KNOWLEDGE_DOCUMENT", { projectId: projectScope?.projectId, entity: "Knowledge_Document", entityId: document.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const ask = async () => {
    if (!question.trim() || !projectCode || !allowed) return;
    setBusy("ask"); setError(null); setAnswer(null);
    try {
      const response = await pmisApiClient.askProjectKnowledge(projectCode, question.trim());
      setAnswer(response);
      audit("ASK_PROJECT_KNOWLEDGE", { projectId: projectScope?.projectId, entity: "Document_Chunk", entityId: "rag" });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="glass-dark rounded-2xl p-4" dir={rtl ? "rtl" : "ltr"}>
      <div className="flex flex-wrap items-center gap-2 border-b b-line-soft pb-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl border border-fuchsia-400/40 bg-fuchsia-400/10 text-[16px]">🧠</span>
        <div>
          <h3 className="text-[12px] font-medium tx1">{rtl ? "دانش پروژه و مشاور مستند AI" : "Project Knowledge & Grounded AI Advisor"}</h3>
          <p className="text-[8.5px] font-extralight tx3">{rtl ? "پاسخ فقط با استناد به اسناد همان پروژه" : "Answers are grounded only in the active project's documents"}</p>
          {cluster && project && <p className="mt-0.5 text-[8px] text-fuchsia-200">{t(cluster.title, lang)} · <span dir="ltr">{project.code}</span> · {t(project.name, lang)}</p>}
        </div>
        <button onClick={() => void load()} disabled={busy === "load" || !projectCode} className="ms-auto rounded-lg border b-line-soft px-2.5 py-1 text-[9px] tx2 disabled:opacity-40">↻ {rtl ? "بازخوانی" : "Refresh"}</button>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(280px,.85fr)_minmax(0,1.4fr)]">
        <div className="rounded-xl border b-line-soft bg-black/10 p-3">
          <div className="flex items-center gap-2">
            <select value={documentType} onChange={(e) => setDocumentType(e.target.value)} className="min-w-0 flex-1 rounded-lg border b-line-soft bg-[var(--row)] px-2 py-1.5 text-[9.5px] tx1 outline-none" style={{ colorScheme: "dark" }}>
              <option value="contract">{rtl ? "قرارداد و شرایط پیمان" : "Contract conditions"}</option>
              <option value="correspondence">{rtl ? "مکاتبات" : "Correspondence"}</option>
              <option value="engineering">{rtl ? "مدرک مهندسی" : "Engineering document"}</option>
              <option value="daily_report">{rtl ? "گزارش روزانه" : "Daily report"}</option>
              <option value="regulation">{rtl ? "بخشنامه / مقررات" : "Regulation / bulletin"}</option>
            </select>
            <input ref={fileRef} type="file" hidden accept=".pdf,.docx,.txt,.csv,.json,.xml" onChange={(e) => void upload(e.target.files)} />
            <button onClick={() => fileRef.current?.click()} disabled={!allowed || !projectCode || busy === "upload"} className="rounded-lg border border-fuchsia-400/50 bg-fuchsia-400/10 px-2.5 py-1.5 text-[9.5px] text-fuchsia-200 disabled:opacity-40">
              {busy === "upload" ? (rtl ? "در حال استخراج…" : "Extracting…") : (rtl ? "بارگذاری و ایندکس" : "Upload & index")}
            </button>
          </div>
          <p className="mt-2 text-[8px] font-extralight tx4">PDF · DOCX · TXT · CSV · JSON · XML · max 25 MB</p>
          <div className="mt-2 rounded-xl border border-amber-400/30 bg-amber-400/7 p-2">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[9.5px] font-medium text-amber-200">OCR {rtl ? "اسناد اسکن‌شده" : "scanned documents"}</span>
              <select value={ocrLanguage} onChange={(e) => setOcrLanguage(e.target.value)} className="ms-auto rounded-lg border b-line-soft bg-[var(--row)] px-2 py-1 text-[8.5px] tx1 outline-none" style={{ colorScheme: "dark" }}>
                <option value="fas+eng">FA + EN</option>
                <option value="fas">فارسی</option>
                <option value="eng">English</option>
              </select>
              <input ref={ocrRef} type="file" hidden accept=".png,.jpg,.jpeg,.webp,.bmp,.tif,.tiff,.pdf" onChange={(e) => void uploadOcr(e.target.files)} />
              <button onClick={() => ocrRef.current?.click()} disabled={!allowed || !projectCode || busy === "upload"} className="rounded-lg border border-amber-400/50 bg-amber-400/10 px-2 py-1 text-[8.5px] text-amber-200 disabled:opacity-40">
                {rtl ? "OCR و ایندکس" : "OCR & index"}
              </button>
            </div>
            <div className="space-y-1">
              {ocrJobs.slice(0, 3).map((job) => (
                <div key={job.id} className="flex items-center gap-2 text-[7.5px] tx3" dir="ltr">
                  <span className="truncate">{job.fileName}</span><span>·</span><span>{job.status}</span><span>·</span><span>{job.characterCount} chars</span>{job.confidence != null && <span>· {Math.round(job.confidence)}%</span>}
                </div>
              ))}
              {!ocrJobs.length && <div className="text-[7.5px] tx4">{rtl ? "تصویر اسکن‌شده‌ای OCR نشده است." : "No OCR scans indexed yet."}</div>}
            </div>
          </div>
          <div className="thin-scroll mt-3 max-h-52 space-y-1.5 overflow-y-auto">
            {documents.length === 0 ? (
              <div className="py-7 text-center text-[9px] tx4">{busy === "load" ? (rtl ? "در حال خواندن…" : "Loading…") : (rtl ? "سندی برای پروژه ایندکس نشده است." : "No indexed documents for this project.")}</div>
            ) : documents.map((document) => (
              <div key={document.id} className="glass-row rounded-xl px-2.5 py-2">
                <div className="flex items-center gap-2"><span>📄</span><span className="min-w-0 flex-1 truncate text-[9.5px] font-light tx1">{document.title}</span><span className="rounded bg-emerald-400/10 px-1.5 py-0.5 text-[7.5px] text-emerald-300">{document.status}</span></div>
                <div className="mt-1 flex gap-2 text-[7.5px] tx4" dir="ltr"><span>{document.documentType}</span><span>·</span><span>{document.languageCode}</span><span>·</span><span>{document.chunkCount} chunks</span><span>·</span><span>{document.characterCount} chars</span></div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex min-h-[260px] flex-col rounded-xl border border-fuchsia-400/25 bg-fuchsia-400/5 p-3">
          <div className="flex gap-2">
            <textarea value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={rtl ? "سوال مستند درباره قرارداد، مکاتبات یا مدارک پروژه…" : "Ask a grounded question about project contracts, correspondence, or documents…"} className="h-16 min-w-0 flex-1 resize-none rounded-xl border b-line-soft bg-black/15 px-3 py-2 text-[10px] tx1 outline-none focus:border-fuchsia-400" />
            <button onClick={() => void ask()} disabled={!allowed || !question.trim() || busy === "ask"} className="rounded-xl border border-fuchsia-400/50 bg-fuchsia-400/12 px-3 text-[10px] text-fuchsia-200 disabled:opacity-40">{busy === "ask" ? (rtl ? "تحلیل…" : "Analyzing…") : (rtl ? "پرسش از اسناد" : "Ask documents")}</button>
          </div>
          <div className="thin-scroll mt-3 min-h-0 flex-1 overflow-y-auto rounded-xl bg-black/15 p-3">
            {!answer ? <div className="grid h-full min-h-28 place-items-center text-[9px] tx4">{rtl ? "پاسخ و منابع استنادی اینجا نمایش داده می‌شوند." : "The answer and cited sources appear here."}</div> : (
              <div>
                <div className="flex items-center gap-2"><span className="text-[10px] font-medium text-fuchsia-200">AI</span><span className="rounded bg-white/5 px-1.5 py-0.5 text-[7.5px] tx3">{answer.mode}{answer.model ? ` · ${answer.model}` : ""}</span></div>
                <p className="mt-2 whitespace-pre-wrap text-[10px] font-light leading-6 tx1">{answer.answer}</p>
                <div className="mt-3 space-y-1.5"><div className="text-[9px] font-medium tx2">{rtl ? "منابع" : "Sources"}</div>{answer.sources.map((source, index) => (
                  <div key={`${source.documentId}-${source.chunkIndex}`} className="rounded-lg border b-line-soft bg-black/10 px-2.5 py-2"><div className="text-[8.5px] font-medium text-sky-200">[S{index + 1}] {source.documentTitle} · chunk {source.chunkIndex}</div><p className="mt-1 text-[8.5px] leading-5 tx3">{source.excerpt}</p></div>
                ))}</div>
              </div>
            )}
          </div>
        </div>
      </div>
      {error && <div className="mt-2 rounded-lg border border-rose-400/40 bg-rose-400/10 px-3 py-2 text-[9px] text-rose-300">✕ {error}</div>}
      {!allowed && <div className="mt-2 text-[8.5px] text-amber-300">{rtl ? "نقش فعلی مجوز ai.run ندارد." : "Current role does not have ai.run permission."}</div>}
    </section>
  );
}