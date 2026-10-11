/**
 * پنل RCFA تعاملی — تحلیل ریشه‌ای با ۵ چرا، استخوان‌ماهی (۶M)، پارتو و CAPA.
 *
 * این پنل هیچ قاعدهٔ کسب‌وکاری ندارد: زنجیرهٔ چرا را جمع می‌کند، آمادگی پرونده
 * را از سرور می‌خواند و اجازه نمی‌دهد چیزی خارج از دروازه‌های سرور انجام شود.
 * دکمه‌های خارج از مجوز کاربر غیرفعال‌اند، اما تصمیم نهایی همیشه با سرور است.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Lang } from "../data/framework";
import { canCmmsAccess, CmmsClient, CmmsRequestError } from "../services/cmmsApi";

interface Props {
  siteId: string;
  userId: string;
  lang: Lang;
}

type CaseRow = {
  Id: string;
  CaseNo: string;
  Status: string;
  Method: string;
  OpenedOn: string;
  AssetId: string;
  WhyDepth: number;
  ProblemStatementFa: string;
  RootCauseFa?: string | null;
};

const CAPA_ACTION_TYPES = ["containment", "corrective", "preventive", "detection", "systemic"] as const;
const CAPA_RESULTS = ["effective", "partially-effective", "ineffective"] as const;
const FISHBONE_CATEGORIES = ["man", "machine", "method", "material", "measurement", "environment"] as const;

const errorText = (error: unknown): string =>
  error instanceof CmmsRequestError
    ? `${error.message} (${error.code})`
    : error instanceof Error ? error.message : "خطای ناشناخته";

export default function CmmsRcfaPanel({ siteId, userId, lang }: Props) {
  const fa = lang === "fa";
  const tr = (faText: string, enText: string) => (fa ? faText : enText);

  const canEdit = canCmmsAccess(userId, "cmms.rca.edit", siteId);
  const canClose = canCmmsAccess(userId, "cmms.rca.close", siteId);
  const canCapa = canCmmsAccess(userId, "cmms.capa.create", siteId);
  const canVerify = canCmmsAccess(userId, "cmms.capa.verify", siteId);

  const [cases, setCases] = useState<CaseRow[]>([]);
  const [assets, setAssets] = useState<Array<{ Id: string; AssetTag: string; NameFa: string }>>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce((value) => value + 1), []);

  /* فرم‌ها */
  const [newCase, setNewCase] = useState({ AssetId: "", CaseNo: "", ProblemStatementFa: "" });
  const [newWhy, setNewWhy] = useState({ StatementFa: "", IsRootCause: false, EvidencePath: "" });
  const [newCause, setNewCause] = useState({ Category: "machine", StatementFa: "", OccurrenceCount: "1", ImpactScore: "5", IsRootCause: false, EvidenceRef: "" });
  const [newCapa, setNewCapa] = useState({ ActionType: "corrective", StatementFa: "", Priority: "3", OwnerUserId: "" });
  const [capaEvidence, setCapaEvidence] = useState<Record<string, string>>({});
  const [capaResult, setCapaResult] = useState<Record<string, string>>({});
  const [closeForm, setCloseForm] = useState({ RootCauseFa: "" });

  useEffect(() => {
    let cancelled = false;
    CmmsClient.listRcaCases(siteId, userId, { limit: 100 })
      .then((data) => { if (!cancelled) setCases(data.cases); })
      .catch((err: unknown) => { if (!cancelled) setError(errorText(err)); });
    return () => { cancelled = true; };
  }, [siteId, userId, nonce]);

  useEffect(() => {
    let cancelled = false;
    CmmsClient.listAssets(siteId, userId, { limit: 200 })
      .then((data) => { if (!cancelled) setAssets(data.assets); })
      .catch(() => { if (!cancelled) setAssets([]); });
    return () => { cancelled = true; };
  }, [siteId, userId]);

  useEffect(() => {
    if (!selected) { setDetail(null); return; }
    let cancelled = false;
    CmmsClient.getRcaCase(siteId, userId, selected)
      .then((data) => {
        if (cancelled) return;
        setDetail(data);
        setCloseForm((previous) => ({ RootCauseFa: previous.RootCauseFa || data.case?.RootCauseFa || "" }));
      })
      .catch((err: unknown) => { if (!cancelled) setError(errorText(err)); });
    return () => { cancelled = true; };
  }, [siteId, userId, selected, nonce]);

  const run = async (key: string, work: () => Promise<unknown>, doneFa: string, doneEn: string) => {
    setBusy(key);
    setError(null);
    setNote(null);
    try {
      await work();
      setNote(tr(doneFa, doneEn));
      refresh();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  };

  const nextWhyLevel = useMemo(() => Number(detail?.analysis?.whyChain?.depth ?? 0) + 1, [detail]);

  const chain = detail?.whys ?? [];
  const capas = detail?.capas ?? [];
  const analysis = detail?.analysis ?? null;

  return (
    <div className="space-y-4">
      {(error || note) && (
        <div className={`rounded-xl border p-3 text-[11px] ${error ? "border-rose-500/30 bg-rose-500/10 tx1" : "border-emerald-500/30 bg-emerald-500/10 tx1"}`}>
          {error ?? note}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* فهرست پرونده‌ها */}
        <div className="rounded-xl border b-line-soft bg-black/15 p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="tx2 text-xs font-medium">{tr("پرونده‌های تحلیل ریشه‌ای", "RCA cases")}</h4>
            <button type="button" onClick={refresh} className="rounded-lg border b-line-soft px-2 py-0.5 text-[11px] tx2 hover:tx1">
              {tr("به‌روزرسانی", "Refresh")}
            </button>
          </div>
          {cases.length === 0 && <p className="tx3 text-[11px]">{tr("پرونده‌ای ثبت نشده است.", "No cases yet.")}</p>}
          <div className="space-y-1.5">
            {cases.map((row) => (
              <button
                key={row.Id}
                type="button"
                onClick={() => setSelected(row.Id)}
                className={`w-full rounded-lg border b-line-soft px-2.5 py-1.5 text-start text-[11px] ${selected === row.Id ? "toggle-on tx1" : "tx2 hover:tx1"}`}
              >
                <span className="font-mono" dir="ltr">{row.CaseNo}</span>
                <span className="mx-1.5 tx3">·</span>
                <span>{row.Status}</span>
                <span className="mx-1.5 tx3">·</span>
                <span dir="ltr">{tr("عمق", "depth")} {row.WhyDepth}</span>
                <div className="tx3 mt-0.5 truncate">{row.ProblemStatementFa}</div>
              </button>
            ))}
          </div>

          {canEdit && (
            <div className="border-t b-line-soft pt-2 space-y-1.5">
              <div className="tx3 text-[11px]">{tr("پروندهٔ جدید", "New case")}</div>
              <select
                value={newCase.AssetId}
                onChange={(event) => setNewCase({ ...newCase, AssetId: event.target.value })}
                className="w-full rounded-lg border b-line-soft bg-black/25 px-2 py-1 text-[11px] tx1"
              >
                <option value="">{tr("— انتخاب تجهیز —", "— pick asset —")}</option>
                {assets.map((asset) => (
                  <option key={asset.Id} value={asset.Id}>{asset.AssetTag} — {asset.NameFa}</option>
                ))}
              </select>
              <input
                value={newCase.CaseNo}
                onChange={(event) => setNewCase({ ...newCase, CaseNo: event.target.value })}
                placeholder={tr("شمارهٔ پرونده (مثلاً RCA-14)", "Case no. (RCA-14)")}
                className="w-full rounded-lg border b-line-soft bg-black/25 px-2 py-1 text-[11px] tx1"
                dir="ltr"
              />
              <textarea
                value={newCase.ProblemStatementFa}
                onChange={(event) => setNewCase({ ...newCase, ProblemStatementFa: event.target.value })}
                placeholder={tr("شرح مسئله / رویداد", "Problem statement")}
                rows={2}
                className="w-full rounded-lg border b-line-soft bg-black/25 px-2 py-1 text-[11px] tx1"
              />
              <button
                type="button"
                disabled={busy !== null || !newCase.AssetId || !newCase.CaseNo.trim() || newCase.ProblemStatementFa.trim().length < 5}
                onClick={() => run("case", () => CmmsClient.createRcaCase(siteId, userId, { ...newCase, Method: "combined" }), "پرونده ساخته شد", "Case created")}
                className="w-full rounded-lg border b-line-soft px-2 py-1 text-[11px] tx2 hover:tx1 disabled:opacity-40"
              >
                {busy === "case" ? tr("در حال ثبت…", "Saving…") : tr("ایجاد پرونده", "Create case")}
              </button>
            </div>
          )}
        </div>

        {/* جزئیات پرونده */}
        <div className="lg:col-span-2 space-y-3">
          {!detail && <p className="tx3 text-[11px]">{tr("یک پرونده را انتخاب کنید تا زنجیرهٔ چرا و CAPA نمایش داده شود.", "Pick a case to open its why-chain and CAPA.")}</p>}
          {detail && (
            <>
              <div className="rounded-xl border b-line-soft bg-black/15 p-3.5 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="tx1 text-xs font-medium">
                    <span className="font-mono" dir="ltr">{detail.case.CaseNo}</span> · {detail.case.ProblemStatementFa}
                  </h4>
                  <span className="rounded border b-line-soft bg-black/25 px-2 py-0.5 text-[11px] tx2" dir="ltr">
                    {detail.case.Status} · {detail.case.Method}
                  </span>
                </div>
                {analysis && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] tx2">
                    <div>{tr("عمق زنجیره", "Chain depth")}: <span dir="ltr">{analysis.whyChain.depth}</span></div>
                    <div>{tr("ریشه در سطح", "Root at level")}: <span dir="ltr">{analysis.whyChain.rootCauseLevel ?? "—"}</span></div>
                    <div>{tr("مدارک", "Evidence")}: <span dir="ltr">{analysis.whyChain.evidencedCount}</span></div>
                    <div>{tr("امتیاز آمادگی", "Readiness score")}: <span dir="ltr">{Math.round((analysis.readiness.score ?? 0) * 100)}%</span></div>
                  </div>
                )}
                {analysis && (
                  <p className="tx3 text-[11px] leading-5">{analysis.whyChain.summaryFa}</p>
                )}
                {analysis?.readiness?.blockers?.length > 0 && (
                  <ul className="list-disc ps-4 tx3 text-[11px] space-y-0.5">
                    {analysis.readiness.blockers.map((item: string) => <li key={item}>{item}</li>)}
                  </ul>
                )}
                {analysis?.readiness?.warnings?.length > 0 && (
                  <ul className="list-disc ps-4 text-[11px] text-amber-300/90 space-y-0.5">
                    {analysis.readiness.warnings.map((item: string) => <li key={item}>{item}</li>)}
                  </ul>
                )}
              </div>

              {/* ۵ چرا */}
              <div className="rounded-xl border b-line-soft bg-black/15 p-3.5 space-y-2">
                <h4 className="tx2 text-xs font-medium">{tr("زنجیرهٔ ۵ چرا", "5-Why chain")}</h4>
                {chain.length === 0 && <p className="tx3 text-[11px]">{tr("زنجیره هنوز آغاز نشده است.", "The chain has not started yet.")}</p>}
                <ol className="space-y-1">
                  {chain.map((row: any) => (
                    <li key={row.Id} className="flex items-start gap-2 rounded-lg border b-line-soft bg-black/20 px-2.5 py-1.5">
                      <span className="font-mono text-[11px] tx3" dir="ltr">#{row.Sequence}</span>
                      <span className="tx2 text-[11px] flex-1">{row.StatementFa}</span>
                      {row.IsRootCause && (
                        <span className="rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-300">
                          {tr("ریشه", "root")}
                        </span>
                      )}
                      {row.EvidencePath && <span className="tx3 text-[10px]" dir="ltr">{row.EvidencePath}</span>}
                    </li>
                  ))}
                </ol>
                {analysis?.nextWhy && (
                  <p className="tx3 text-[11px]">{tr("پرسش بعدی: ", "Next question: ")}<span className="tx2">{analysis.nextWhy}</span></p>
                )}
                {canEdit && (
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] gap-2 border-t b-line-soft pt-2">
                    <input
                      value={newWhy.StatementFa}
                      onChange={(event) => setNewWhy({ ...newWhy, StatementFa: event.target.value })}
                      placeholder={tr(`پاسخ سطح ${nextWhyLevel}`, `Answer for level ${nextWhyLevel}`)}
                      className="rounded-lg border b-line-soft bg-black/25 px-2 py-1 text-[11px] tx1"
                    />
                    <input
                      value={newWhy.EvidencePath}
                      onChange={(event) => setNewWhy({ ...newWhy, EvidencePath: event.target.value })}
                      placeholder={tr("مدرک", "Evidence")}
                      className="rounded-lg border b-line-soft bg-black/25 px-2 py-1 text-[11px] tx1"
                      dir="ltr"
                    />
                    <label className="flex items-center gap-1.5 tx3 text-[11px]">
                      <input
                        type="checkbox"
                        checked={newWhy.IsRootCause}
                        onChange={(event) => setNewWhy({ ...newWhy, IsRootCause: event.target.checked })}
                      />
                      {tr("ریشه", "Root")}
                    </label>
                    <button
                      type="button"
                      disabled={busy !== null || newWhy.StatementFa.trim().length < 5}
                      onClick={() => run("why", async () => {
                        await CmmsClient.addRcaEntry(siteId, userId, detail.case.Id, {
                          EntryType: "why", Sequence: nextWhyLevel, StatementFa: newWhy.StatementFa,
                          IsRootCause: newWhy.IsRootCause, EvidencePath: newWhy.EvidencePath || null,
                        });
                        setNewWhy({ StatementFa: "", IsRootCause: false, EvidencePath: "" });
                      }, "سطح زنجیره ثبت شد", "Why level added")}
                      className="rounded-lg border b-line-soft px-2.5 py-1 text-[11px] tx2 hover:tx1 disabled:opacity-40"
                    >
                      {busy === "why" ? "…" : tr("افزودن", "Add")}
                    </button>
                  </div>
                )}
              </div>

              {/* استخوان‌ماهی و پارتو */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-xl border b-line-soft bg-black/15 p-3.5 space-y-2">
                  <h4 className="tx2 text-xs font-medium">{tr("استخوان‌ماهی (۶M)", "Fishbone (6M)")}</h4>
                  <div className="space-y-1">
                    {(analysis?.fishbone?.byCategory ?? []).filter((row: any) => row.count > 0).map((row: any) => (
                      <div key={row.category} className="flex items-center justify-between rounded-lg border b-line-soft bg-black/20 px-2 py-1 text-[11px]">
                        <span className="tx2">{row.labelFa}</span>
                        <span className="tx3" dir="ltr">{row.count} · {tr("ریشه", "root")} {row.rootCauseCount}</span>
                      </div>
                    ))}
                    {(analysis?.fishbone?.byCategory ?? []).every((row: any) => row.count === 0) && (
                      <p className="tx3 text-[11px]">{tr("علتی دسته‌بندی نشده است.", "No classified causes yet.")}</p>
                    )}
                  </div>
                  {(analysis?.fishbone?.missingCategories?.length ?? 0) > 0 && (
                    <p className="tx3 text-[10px]">
                      {tr("شاخه‌های بی‌گزارش: ", "Missing branches: ")}
                      <span dir="ltr">{analysis.fishbone.missingCategories.join(", ")}</span>
                    </p>
                  )}
                  {canEdit && (
                    <div className="space-y-1.5 border-t b-line-soft pt-2">
                      <div className="grid grid-cols-2 gap-1.5">
                        <select
                          value={newCause.Category}
                          onChange={(event) => setNewCause({ ...newCause, Category: event.target.value })}
                          className="rounded-lg border b-line-soft bg-black/25 px-2 py-1 text-[11px] tx1"
                          dir="ltr"
                        >
                          {FISHBONE_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                        </select>
                        <div className="grid grid-cols-2 gap-1.5">
                          <input
                            value={newCause.OccurrenceCount}
                            onChange={(event) => setNewCause({ ...newCause, OccurrenceCount: event.target.value })}
                            placeholder={tr("وقوع", "Count")}
                            className="rounded-lg border b-line-soft bg-black/25 px-2 py-1 text-[11px] tx1"
                            dir="ltr"
                          />
                          <input
                            value={newCause.ImpactScore}
                            onChange={(event) => setNewCause({ ...newCause, ImpactScore: event.target.value })}
                            placeholder={tr("شدت", "Impact")}
                            className="rounded-lg border b-line-soft bg-black/25 px-2 py-1 text-[11px] tx1"
                            dir="ltr"
                          />
                        </div>
                      </div>
                      <input
                        value={newCause.StatementFa}
                        onChange={(event) => setNewCause({ ...newCause, StatementFa: event.target.value })}
                        placeholder={tr("شرح علت", "Cause statement")}
                        className="w-full rounded-lg border b-line-soft bg-black/25 px-2 py-1 text-[11px] tx1"
                      />
                      <div className="grid grid-cols-[1fr_auto_auto] gap-1.5 items-center">
                        <input
                          value={newCause.EvidenceRef}
                          onChange={(event) => setNewCause({ ...newCause, EvidenceRef: event.target.value })}
                          placeholder={tr("مدرک (برای ریشه الزامی)", "Evidence (required for root)")}
                          className="rounded-lg border b-line-soft bg-black/25 px-2 py-1 text-[11px] tx1"
                          dir="ltr"
                        />
                        <label className="flex items-center gap-1.5 tx3 text-[11px]">
                          <input
                            type="checkbox"
                            checked={newCause.IsRootCause}
                            onChange={(event) => setNewCause({ ...newCause, IsRootCause: event.target.checked })}
                          />
                          {tr("ریشه", "Root")}
                        </label>
                        <button
                          type="button"
                          disabled={busy !== null || newCause.StatementFa.trim().length < 5}
                          onClick={() => run("cause", async () => {
                            await CmmsClient.addRcaCause(siteId, userId, detail.case.Id, {
                              Category: newCause.Category, StatementFa: newCause.StatementFa,
                              OccurrenceCount: Number(newCause.OccurrenceCount) || 0,
                              ImpactScore: Number(newCause.ImpactScore) || 5,
                              IsRootCause: newCause.IsRootCause, EvidenceRef: newCause.EvidenceRef || null,
                            });
                            setNewCause({ ...newCause, StatementFa: "", EvidenceRef: "", IsRootCause: false });
                          }, "علت ثبت شد", "Cause added")}
                          className="rounded-lg border b-line-soft px-2.5 py-1 text-[11px] tx2 hover:tx1 disabled:opacity-40"
                        >
                          {busy === "cause" ? "…" : tr("افزودن علت", "Add")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border b-line-soft bg-black/15 p-3.5 space-y-2">
                  <h4 className="tx2 text-xs font-medium">{tr("پارتو وزنی (فراوانی × شدت)", "Weighted Pareto (frequency × impact)")}</h4>
                  {(analysis?.pareto?.rows?.length ?? 0) === 0 && (
                    <p className="tx3 text-[11px]">{tr("برای پارتو حداقل یک علت با فراوانی لازم است.", "Pareto needs at least one cause with occurrences.")}</p>
                  )}
                  <div className="space-y-1.5">
                    {(analysis?.pareto?.rows ?? []).map((row: any) => (
                      <div key={row.key} className="space-y-0.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="tx2 truncate">{row.labelFa}</span>
                          <span className="tx3" dir="ltr">{row.sharePct}% · {row.cumulativePct}%</span>
                        </div>
                        <div className="h-1.5 w-full rounded bg-black/30">
                          <div
                            className={`h-1.5 rounded ${row.classification === "vital-few" ? "bg-amber-400/80" : "bg-slate-500/60"}`}
                            style={{ width: `${Math.min(100, row.sharePct)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  {analysis?.pareto?.interpretationFa && (
                    <p className="tx3 text-[10px] leading-4">{analysis.pareto.interpretationFa}</p>
                  )}
                </div>
              </div>

              {/* CAPA */}
              <div className="rounded-xl border b-line-soft bg-black/15 p-3.5 space-y-2">
                <h4 className="tx2 text-xs font-medium">
                  {tr("اقدام اصلاحی و پیشگیرانه (CAPA)", "Corrective & preventive actions")}
                  <span className="tx3"> · {capas.length}</span>
                </h4>
                {capas.length === 0 && <p className="tx3 text-[11px]">{tr("اقدامی ثبت نشده است؛ بستن پرونده ممکن نیست.", "No actions yet; the case cannot be closed.")}</p>}
                <div className="space-y-2">
                  {capas.map((row: any) => (
                    <div key={row.Id} className="rounded-lg border b-line-soft bg-black/20 p-2 space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                        <span className="tx2">{row.StatementFa}</span>
                        <span className="tx3" dir="ltr">
                          {row.ActionType} · {row.Status} · P{row.Priority} · {row.DueOn}
                          {row.VerificationResult ? ` · ${row.VerificationResult}` : ""}
                          {row.WorkOrderId ? " · WO" : ""}
                        </span>
                      </div>
                      {row.OwnerNameFa && <div className="tx3 text-[10px]">{tr("مالک: ", "Owner: ")}{row.OwnerNameFa}</div>}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {canCapa && (row.Status === "draft" || row.Status === "assigned" || row.Status === "in-progress") && (
                          <>
                            <input
                              value={capaEvidence[row.Id] ?? ""}
                              onChange={(event) => setCapaEvidence({ ...capaEvidence, [row.Id]: event.target.value })}
                              placeholder={tr("شاهد اجرا", "Evidence")}
                              className="rounded-lg border b-line-soft bg-black/25 px-2 py-1 text-[11px] tx1"
                              dir="ltr"
                            />
                            <button
                              type="button"
                              disabled={busy !== null || !(capaEvidence[row.Id] ?? "").trim()}
                              onClick={() => run(`impl-${row.Id}`, () => CmmsClient.implementCapa(siteId, userId, detail.case.Id, row.Id, {
                                ImplementationEvidenceRef: capaEvidence[row.Id],
                              }), "اجرا ثبت شد", "Implementation recorded")}
                              className="rounded-lg border b-line-soft px-2 py-0.5 text-[11px] tx2 hover:tx1 disabled:opacity-40"
                            >
                              {tr("ثبت اجرا", "Implement")}
                            </button>
                            <button
                              type="button"
                              disabled={busy !== null}
                              onClick={() => run(`ref-${row.Id}`, () => CmmsClient.referCapa(siteId, userId, detail.case.Id, row.Id, { ReferralKind: "work-order" }),
                                "دستورکار ساخته شد", "Work order created")}
                              className="rounded-lg border b-line-soft px-2 py-0.5 text-[11px] tx2 hover:tx1 disabled:opacity-40"
                            >
                              {tr("تبدیل به دستورکار", "To work order")}
                            </button>
                          </>
                        )}
                        {canVerify && (row.Status === "implemented" || row.Status === "verified") && (
                          <>
                            <select
                              value={capaResult[row.Id] ?? "effective"}
                              onChange={(event) => setCapaResult({ ...capaResult, [row.Id]: event.target.value })}
                              className="rounded-lg border b-line-soft bg-black/25 px-2 py-1 text-[11px] tx1"
                              dir="ltr"
                            >
                              {CAPA_RESULTS.map((result) => <option key={result} value={result}>{result}</option>)}
                            </select>
                            <button
                              type="button"
                              disabled={busy !== null}
                              onClick={() => run(`ver-${row.Id}`, () => CmmsClient.verifyCapa(siteId, userId, detail.case.Id, row.Id, {
                                VerificationResult: capaResult[row.Id] ?? "effective",
                              }), "اثربخشی ثبت شد", "Verification recorded")}
                              className="rounded-lg border b-line-soft px-2 py-0.5 text-[11px] tx2 hover:tx1 disabled:opacity-40"
                            >
                              {tr("تأیید اثربخشی", "Verify")}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {canCapa && detail.case.Status !== "verified" && (
                  <div className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto_auto] gap-2 border-t b-line-soft pt-2">
                    <select
                      value={newCapa.ActionType}
                      onChange={(event) => setNewCapa({ ...newCapa, ActionType: event.target.value })}
                      className="rounded-lg border b-line-soft bg-black/25 px-2 py-1 text-[11px] tx1"
                      dir="ltr"
                    >
                      {CAPA_ACTION_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                    </select>
                    <input
                      value={newCapa.StatementFa}
                      onChange={(event) => setNewCapa({ ...newCapa, StatementFa: event.target.value })}
                      placeholder={tr("شرح اقدام", "Action statement")}
                      className="rounded-lg border b-line-soft bg-black/25 px-2 py-1 text-[11px] tx1"
                    />
                    <input
                      value={newCapa.OwnerUserId}
                      onChange={(event) => setNewCapa({ ...newCapa, OwnerUserId: event.target.value })}
                      placeholder={tr("مسئول", "Owner id")}
                      className="rounded-lg border b-line-soft bg-black/25 px-2 py-1 text-[11px] tx1"
                      dir="ltr"
                    />
                    <button
                      type="button"
                      disabled={busy !== null || newCapa.StatementFa.trim().length < 5}
                      onClick={() => run("capa", async () => {
                        await CmmsClient.createCapa(siteId, userId, detail.case.Id, {
                          ActionType: newCapa.ActionType, StatementFa: newCapa.StatementFa,
                          Priority: Number(newCapa.Priority) || 3,
                          OwnerUserId: newCapa.OwnerUserId.trim() || null,
                        });
                        setNewCapa({ ...newCapa, StatementFa: "" });
                      }, "اقدام ثبت شد", "Action created")}
                      className="rounded-lg border b-line-soft px-2.5 py-1 text-[11px] tx2 hover:tx1 disabled:opacity-40"
                    >
                      {busy === "capa" ? "…" : tr("ثبت اقدام", "Add action")}
                    </button>
                  </div>
                )}
              </div>

              {/* بستن پرونده */}
              {canClose && detail.case.Status !== "verified" && (
                <div className="rounded-xl border b-line-soft bg-black/15 p-3.5 space-y-2">
                  <h4 className="tx2 text-xs font-medium">{tr("بستن / تأیید پرونده", "Close / verify case")}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
                    <input
                      value={closeForm.RootCauseFa}
                      onChange={(event) => setCloseForm({ RootCauseFa: event.target.value })}
                      placeholder={tr("ریشهٔ تأییدشده", "Confirmed root cause")}
                      className="rounded-lg border b-line-soft bg-black/25 px-2 py-1 text-[11px] tx1"
                    />
                    <button
                      type="button"
                      disabled={busy !== null || closeForm.RootCauseFa.trim().length < 5}
                      onClick={() => run("close", () => CmmsClient.closeRcaCase(siteId, userId, detail.case.Id, { RootCauseFa: closeForm.RootCauseFa }),
                        "وضعیت پرونده به‌روز شد", "Case status updated")}
                      className="rounded-lg border b-line-soft px-3 py-1 text-[11px] tx2 hover:tx1 disabled:opacity-40"
                    >
                      {busy === "close" ? "…" : tr("بستن", "Close")}
                    </button>
                  </div>
                  <p className="tx3 text-[10px]">
                    {tr(
                      "پرونده فقط با ریشهٔ مستند، علت علامت‌خورده و CAPA اجرا/تأییدشده بسته می‌شود؛ سرور موانع را فهرست می‌کند.",
                      "A case closes only with a documented root cause, a flagged cause and implemented/verified CAPA; the server lists blockers.",
                    )}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
