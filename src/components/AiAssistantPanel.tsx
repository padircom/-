/**
 * P10 — دستیار هوشمند پروژه (AI-1..AI-4).
 *
 * کاربر به فارسی می‌پرسد؛ سرور پرسش را به یکی از ابزارهای بستهٔ فقط‌خواندنی
 * نگاشت می‌کند، عدد را از دادهٔ زندهٔ همان پروژه می‌سازد و منبع هر عدد را
 * می‌گوید. بخشی که مجوزش نیست «بسته» اعلام می‌شود، نه صفر. هیچ محاسبه‌ای
 * در مرورگر انجام نمی‌شود و متن بازنویسی‌شده (در صورت وجود) جدا از متن
 * محاسبه‌شده نمایش داده می‌شود.
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Lang } from "../data/framework";
import { useAuth } from "../context/AuthContext";
import { useSystem } from "../context/SystemContext";
import {
  AiAssistantClient, type AiAskResult, type AiHistoryItem, type AiSection, type AiStoredAnswer, type AiWorkspace,
} from "../services/aiApi";

const inputCls = "glass-row w-full rounded-lg border b-line-soft px-2.5 py-1.5 text-[10.5px] font-light tx1 outline-none focus:b-line";
const chipCls = "rounded-lg border b-line-soft px-2.5 py-1 text-[9.5px] font-light transition disabled:opacity-40";
const fx = (n: number | null | undefined, digits = 0) => (n === null || n === undefined ? "—" : Number(n).toLocaleString("en-US", { maximumFractionDigits: digits }));
const STATE_TONE: Record<string, string> = { answered: "text-emerald-300", empty: "tx4", insufficient: "text-amber-300", restricted: "text-rose-300", no_match: "text-amber-300" };
const STATE_LABEL: Record<string, [string, string]> = {
  answered: ["پاسخ محاسبه شد", "Answered"],
  empty: ["موردی یافت نشد", "Empty"],
  insufficient: ["داده نابسنده — عددی ساخته نشد", "Insufficient data"],
  restricted: ["بسته (بی‌مجوز) — صفر فرض نشد", "Restricted (not zero)"],
  no_match: ["به ابزاری نگاشت نشد", "No tool matched"],
};

function Card({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="glass-dark rounded-2xl p-3 space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-[11px] font-normal tx1">{title}</h4>
        {hint && <span className="text-[8.5px] font-extralight tx3">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function SectionView({ section, rtl }: { section: AiSection; rtl: boolean }) {
  const T = (fa: string, en: string) => (rtl ? fa : en);
  const text = rtl ? section.textFa : section.textEn;
  const [stateFa, stateEn] = STATE_LABEL[section.state] ?? [section.state, section.state];
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-[11px] tx1 font-normal">{rtl ? section.label.fa : section.label.en}</span>
        <span className={`text-[9.5px] ${STATE_TONE[section.state] ?? "tx3"}`}>{rtl ? stateFa : stateEn}</span>
      </div>
      <p className="whitespace-pre-line text-[10.5px] font-light tx1 leading-6">{text}</p>
      {section.facts.length > 0 && (
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {section.facts.map((f, i) => (
            <div key={`${f.label.fa}-${i}`} className="rounded-lg border b-line-soft p-2">
              <div className="text-[9px] tx3">{rtl ? f.label.fa : f.label.en}</div>
              <div className="text-lg tx1 tabular-nums" dir="ltr">{f.value === null || f.value === undefined ? "—" : typeof f.value === "number" ? fx(f.value) : String(f.value)}</div>
            </div>
          ))}
        </div>
      )}
      {section.table && (
        <div className="overflow-x-auto">
          <table className="w-full text-[10px] font-light">
            <thead className="tx3">
              <tr>{section.table.columns.map((c) => <th key={c.key} className="whitespace-nowrap px-1.5 py-1 text-start">{rtl ? c.label.fa : c.label.en}</th>)}</tr>
            </thead>
            <tbody>
              {section.table.rows.map((row, ri) => (
                <tr key={ri} className="border-t b-line-soft">
                  {row.map((cell, ci) => (
                    <td key={ci} className="whitespace-nowrap px-1.5 py-1 tx2 tabular-nums">{cell === null || cell === undefined ? "—" : typeof cell === "number" ? fx(cell, 2) : String(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {section.table.truncated && <p className="text-[9px] tx3 mt-1">{T("جدول بریده شده است؛ این فهرست کامل نیست.", "Table is truncated; this list is not complete.")}</p>}
        </div>
      )}
      {section.chart && section.chart.points.length > 0 && (
        <div className="space-y-1" aria-label={rtl ? "نمودار" : "chart"}>
          <div className="text-[9px] tx3">{rtl ? section.chart.measure.fa : section.chart.measure.en} / {rtl ? section.chart.category.fa : section.chart.category.en}</div>
          {section.chart.points.slice(0, 12).map((p, i) => {
            const max = Math.max(...section.chart!.points.map((x) => x.value ?? 0), 1);
            const width = Math.max(2, Math.round(((p.value ?? 0) / max) * 100));
            return (
              <div key={i} className="flex items-center gap-2 text-[9.5px] tx2">
                <span className="w-28 truncate" title={p.label}>{p.label}</span>
                <span className="h-2 rounded bg-sky-400/50" style={{ width: `${Math.round(width * 0.6)}%` }} />
                <span className="tabular-nums" dir="ltr">{fx(p.value)}</span>
              </div>
            );
          })}
        </div>
      )}
      {section.sources.length > 0 && (
        <div className="text-[9.5px] tx3 space-y-0.5">
          <div>{T("منبع داده:", "Data sources:")}</div>
          {section.sources.map((s) => (
            <div key={`${s.table}-${s.key}`} className={s.restricted ? "text-amber-300" : ""}>
              {s.table} · {s.restricted ? T("بسته (بی‌مجوز)", "restricted") : T(`${fx(s.rows)} ردیف خوانده شد`, `${fx(s.rows)} rows read`)}
            </div>
          ))}
        </div>
      )}
      {section.limits.length > 0 && (
        <ul className="list-disc ps-4 text-[9px] tx3 space-y-0.5">
          {section.limits.map((l, i) => <li key={i}>{rtl ? l.fa : l.en}</li>)}
        </ul>
      )}
    </div>
  );
}

export default function AiAssistantPanel({ lang }: { lang: Lang }) {
  const rtl = lang === "fa";
  const T = (fa: string, en: string) => (rtl ? fa : en);
  const { projectScope } = useSystem();
  const { user, audit } = useAuth();
  const projectId = projectScope?.projectId ?? "";
  const client = useMemo(() => new AiAssistantClient(projectId, user?.id ?? null), [projectId, user?.id]);

  const [ws, setWs] = useState<AiWorkspace | null>(null);
  const [question, setQuestion] = useState("");
  const [tool, setTool] = useState("");
  const [answer, setAnswer] = useState<AiAskResult | null>(null);
  const [insight, setInsight] = useState<{ code: string; sections: AiSection[]; dataDate: string } | null>(null);
  const [stored, setStored] = useState<AiStoredAnswer | null>(null);
  const [history, setHistory] = useState<AiHistoryItem[] | null>(null);
  const [busy, setBusy] = useState<"" | "ask" | "insight" | "history" | "export" | "template">("");
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const loadWs = useCallback(async () => {
    if (!projectId) return;
    const r = await client.workspace();
    if (r.ok) { setWs(r.data); setErr(null); }
    else setErr(`${r.message} (${r.code})`);
  }, [client, projectId]);
  useEffect(() => { void loadWs(); }, [loadWs]);

  const ask = useCallback(async () => {
    if (!projectId) return;
    if (!question.trim() && !tool) { setErr(T("متن پرسش یا انتخاب ابزار لازم است.", "Enter a question or pick a tool.")); return; }
    setBusy("ask"); setErr(null); setNote(null); setStored(null);
    const r = await client.ask({ question: question.trim(), ...(tool ? { tool } : {}) });
    setBusy("");
    if (!r.ok) { setErr(`${r.message} (${r.code})`); return; }
    setAnswer(r.data);
    audit("AI_ASK", { projectId, entity: "AiInteraction", entityId: r.data.code });
    void loadWs();
  }, [audit, client, loadWs, projectId, question, tool, T]);

  const runInsights = useCallback(async () => {
    if (!projectId) return;
    setBusy("insight"); setErr(null); setAnswer(null); setStored(null);
    const r = await client.insights();
    setBusy("");
    if (!r.ok) { setErr(`${r.message} (${r.code})`); return; }
    setInsight({ code: r.data.code, sections: r.data.sections, dataDate: r.data.dataDate });
    void loadWs();
  }, [client, loadWs, projectId]);

  const loadHistory = useCallback(async () => {
    if (!projectId) return;
    setBusy("history"); setErr(null);
    const r = await client.history(30);
    setBusy("");
    if (!r.ok) { setErr(`${r.message} (${r.code})`); return; }
    setHistory(r.data.items);
  }, [client, projectId]);

  const openStored = useCallback(async (code: string) => {
    setErr(null);
    const r = await client.answer(code);
    if (!r.ok) { setErr(`${r.message} (${r.code})`); return; }
    setStored(r.data); setAnswer(null); setInsight(null);
  }, [client]);

  const exportAnswer = useCallback(async (code: string, format: "csv" | "md") => {
    setBusy("export"); setErr(null); setNote(null);
    const r = await client.exportDoc(code, format);
    setBusy("");
    if (!r.ok) { setErr(r.message); return; }
    const url = URL.createObjectURL(new Blob([r.text], { type: format === "csv" ? "text/csv;charset=utf-8" : "text/markdown;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `${code}.${format === "csv" ? "csv" : "md"}`; a.click(); URL.revokeObjectURL(url);
    audit("AI_EXPORT", { projectId, entity: "AiInteraction", entityId: code });
  }, [audit, client, projectId]);

  const toTemplate = useCallback(async (code: string) => {
    setBusy("template"); setErr(null); setNote(null);
    const r = await client.toTemplate(code);
    setBusy("");
    if (!r.ok) { setErr(`${r.message} (${r.code})`); return; }
    setNote(T(`قالب گزارش «${r.data.template.code}» پیش‌نویس ساخته شد؛ انتشار با نقش دیگری است (SOD-31).`, `Draft report template "${r.data.template.code}" created; publishing belongs to a different role (SOD-31).`));
    audit("AI_TO_TEMPLATE", { projectId, entity: "RptTemplate", entityId: r.data.template.code });
  }, [audit, client, projectId, T]);

  if (!projectId) {
    return <Card title={T("دستیار هوشمند", "AI assistant")}><p className="text-[10.5px] tx3">{T("ابتدا پروژه را از سبد انتخاب کنید.", "Select a project first.")}</p></Card>;
  }

  const examples = ws?.tools.flatMap((t) => t.examples.slice(0, 1)) ?? [];

  return (
    <div className="space-y-3">
      <Card
        title={T("دستیار هوشمند پروژه", "AI project assistant")}
        hint={ws ? `${ws.metrics.modelVersion} · ${T(`${ws.metrics.interactions} پرسش ثبت‌شده`, `${ws.metrics.interactions} logged questions`)}` : undefined}
      >
        <p className="text-[9.5px] tx3">
          {T(
            "پاسخ را سرور از دادهٔ زندهٔ همین پروژه می‌سازد؛ سرویس هوش مصنوعی بیرونی فقط متن را بازنویسی می‌کند و اگر نباشد پاسخ محاسبه‌شده می‌ماند. بخش بی‌مجوز «بسته» اعلام می‌شود، نه صفر.",
            "The server computes answers from this project's live data; an external AI service only rewrites the text, and when absent the computed answer stands. Restricted parts are declared, not zeroed.",
          )}
        </p>
        {ws && (
          <div className="flex flex-wrap gap-1.5 text-[9px] tx3">
            <span className="rounded-md border b-line-soft px-1.5 py-0.5">{T(`ابزار مجاز: ${ws.tools.length}`, `Allowed tools: ${ws.tools.length}`)}</span>
            <span className="rounded-md border b-line-soft px-1.5 py-0.5">{T(`مجموعه‌داده در دسترس: ${ws.datasets.length}`, `Datasets visible: ${ws.datasets.length}`)}</span>
            {ws.restrictedTools > 0 && <span className="rounded-md border b-line-soft px-1.5 py-0.5 text-amber-300">{T(`ابزار بسته: ${ws.restrictedTools}`, `Restricted tools: ${ws.restrictedTools}`)}</span>}
            {ws.provider.serverKeyConfigured
              ? <span className="rounded-md border b-line-soft px-1.5 py-0.5">{T("بازنویسی سرویس: کلید تنظیم است", "Rewrite service: key configured")}</span>
              : <span className="rounded-md border b-line-soft px-1.5 py-0.5">{T("بازنویسی سرویس: بدون کلید (متن سرور)", "Rewrite service: no key (server text)")}</span>}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <input
            className={`${inputCls} flex-1 min-w-[220px]`}
            placeholder={T("مثلاً: بالاترین ریسک‌های پروژه کدام‌اند؟", "e.g. What are the top risks?")}
            value={question}
            disabled={!ws?.can.ask}
            onChange={(ev) => setQuestion(ev.target.value)}
            onKeyDown={(ev) => { if (ev.key === "Enter") void ask(); }}
          />
          <select className={inputCls} value={tool} disabled={!ws?.can.ask} onChange={(ev) => setTool(ev.target.value)}>
            <option value="">{T("مسیریابی خودکار", "Route automatically")}</option>
            {(ws?.tools ?? []).map((t) => <option key={t.key} value={t.key}>{rtl ? t.label.fa : t.label.en}</option>)}
          </select>
          <button className={`${chipCls} px-3 py-1.5`} disabled={busy === "ask" || !ws?.can.ask} onClick={() => void ask()}>{busy === "ask" ? T("در حال پرسش…", "Asking…") : T("بپرس", "Ask")}</button>
        </div>
        {examples.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {examples.map((ex, i) => (
              <button key={i} className={chipCls} disabled={!ws?.can.ask} onClick={() => setQuestion(rtl ? ex.fa : ex.en)}>{rtl ? ex.fa : ex.en}</button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button className={chipCls} disabled={busy === "insight" || !ws?.can.insight} onClick={() => void runInsights()}>{busy === "insight" ? T("در حال محاسبه…", "Computing…") : T("خلاصهٔ وضعیت (ریسک/تأخیر/پیشرفت/گلوگاه)", "Briefing (risks/delays/forecast/bottlenecks)")}</button>
          <button className={chipCls} disabled={busy === "history" || !ws?.can.history} onClick={() => void loadHistory()}>{T("تاریخچهٔ پرسش و پاسخ", "Q&A history")}</button>
        </div>
        {err && <p role="alert" className="text-[10px] text-rose-400">{err}</p>}
        {note && <p role="status" className="text-[10px] text-emerald-300">{note}</p>}
        {busy && <p role="status" className="text-[9.5px] tx3">{T("در حال دریافت از سرور…", "Fetching from server…")}</p>}
      </Card>

      {answer && (
        <Card title={T(`پاسخ ${answer.code}`, `Answer ${answer.code}`)} hint={answer.toolLabel ? (rtl ? answer.toolLabel.fa : answer.toolLabel.en) : undefined}>
          {answer.matched && answer.section ? (
            <>
              <SectionView section={answer.section} rtl={rtl} />
              {answer.narration && (
                <div className="rounded-lg border b-line-soft p-2 space-y-1">
                  <div className="text-[9px] tx3">{T(`بازنویسی ${answer.narratedBy ?? ""} (اختیاری — عدد از سرور است)`, `Rewrite by ${answer.narratedBy ?? ""} (optional — numbers come from the server)`)}</div>
                  <p className="whitespace-pre-line text-[10.5px] font-light tx2 leading-6">{answer.narration}</p>
                </div>
              )}
              {answer.narrationNote && <p className="text-[9px] tx3">{answer.narrationNote}</p>}
              <div className="flex flex-wrap gap-2">
                <button className={chipCls} disabled={!ws?.can.export || busy === "export"} onClick={() => void exportAnswer(answer.code, "csv")}>{T("خروجی CSV", "Export CSV")}</button>
                <button className={chipCls} disabled={!ws?.can.export || busy === "export"} onClick={() => void exportAnswer(answer.code, "md")}>{T("سند Markdown", "Markdown document")}</button>
                {answer.tool === "dataset_query" && (
                  <button className={chipCls} disabled={!ws?.can.export || busy === "template"} onClick={() => void toTemplate(answer.code)}>{T("تبدیل به قالب گزارش", "Make report template")}</button>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <p className="text-[10.5px] text-amber-300">{rtl ? answer.detailFa : answer.detailEn}</p>
              {answer.reason === "restricted" && answer.dataset && <p className="text-[9.5px] tx3">{T(`مجموعه‌داده: ${answer.dataset}`, `Dataset: ${answer.dataset}`)}</p>}
              {answer.suggestions && answer.suggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {answer.suggestions.map((s) => {
                    const t = ws?.tools.find((x) => x.key === s);
                    return (
                      <button key={s} className={chipCls} disabled={!t} onClick={() => { setTool(s); setQuestion(""); }}>{t ? (rtl ? t.label.fa : t.label.en) : s}</button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {insight && (
        <Card title={T(`خلاصهٔ وضعیت ${insight.code}`, `Briefing ${insight.code}`)} hint={T(`تاریخ داده: ${insight.dataDate}`, `Data date: ${insight.dataDate}`)}>
          <div className="space-y-3">
            {insight.sections.map((s) => <div key={s.key} className="rounded-xl border b-line-soft p-2"><SectionView section={s} rtl={rtl} /></div>)}
          </div>
        </Card>
      )}

      {stored && (
        <Card title={T(`پرسش ${stored.code}`, `Question ${stored.code}`)} hint={T(`ثبت‌شده: ${stored.at} · ${stored.actor}`, `Logged: ${stored.at} · ${stored.actor}`)}>
          <p className="text-[10.5px] tx2">{stored.question}</p>
          <SectionView
            section={{ key: stored.tool, label: { fa: stored.tool, en: stored.tool }, state: stored.state as AiSection["state"], textFa: stored.answerFa, textEn: stored.answerFa, facts: stored.facts, table: stored.table, chart: stored.chart, sources: stored.sources, limits: [] }}
            rtl={rtl}
          />
          <p className="text-[9px] tx3">{stored.note}</p>
          <div className="flex flex-wrap gap-2">
            <button className={chipCls} disabled={!ws?.can.export} onClick={() => void exportAnswer(stored.code, "csv")}>{T("خروجی CSV", "Export CSV")}</button>
            <button className={chipCls} disabled={!ws?.can.export} onClick={() => void exportAnswer(stored.code, "md")}>{T("سند Markdown", "Markdown document")}</button>
          </div>
        </Card>
      )}

      {history && (
        <Card title={T("تاریخچهٔ پرسش و پاسخ", "Q&A history")} hint={T("این دفتر منبع دادهٔ هر پاسخ را نگه می‌دارد؛ snapshot همان لحظه است.", "The log keeps each answer's data source; it is a point-in-time snapshot.")}>
          {history.length === 0 && <p className="text-[10px] tx3">{T("هنوز پرسشی ثبت نشده است.", "No question logged yet.")}</p>}
          <div className="space-y-1">
            {history.map((h) => (
              <button key={h.code} className="w-full rounded-lg border b-line-soft px-2 py-1.5 text-start hover:opacity-80" onClick={() => void openStored(h.code)}>
                <div className="flex flex-wrap items-baseline gap-2 text-[9.5px]">
                  <span className="tx1">{h.code}</span>
                  <span className={STATE_TONE[h.state] ?? "tx3"}>{h.state}</span>
                  <span className="tx3">{h.tool}</span>
                  <span className="tx3">{h.actor}</span>
                  <span className="tx3" dir="ltr">{h.at}</span>
                  <span className="tx3">{h.sources.map((s) => `${s.table}${s.restricted ? T(" (بسته)", " (restricted)") : `×${fx(s.rows)}`}`).join(" · ")}</span>
                </div>
                <div className="text-[10px] tx2 truncate">{h.question}</div>
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
