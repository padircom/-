import { useCallback, useEffect, useMemo, useState } from "react";
import type { Lang } from "../data/framework";

const INPUT = "w-full rounded-lg border b-line-soft bg-black/25 px-2 py-1.5 text-[10px] tx1 outline-none transition focus:border-sky-400/50";
const BTN = "rounded-lg border b-line-soft px-3 py-1.5 text-[9.5px] tx2 transition hover:tx1 disabled:opacity-40";
const PRIMARY = "rounded-lg border border-sky-400/40 bg-sky-400/10 px-3 py-1.5 text-[9.5px] text-sky-200 transition hover:bg-sky-400/20 disabled:opacity-40";

type Row = Record<string, any>;
type ApiResult<T> = { ok: true; data: T } | { ok: false; message: string; code: string; status: number };

async function request<T>(url: string, userId: string, body?: Row): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      method: body ? "POST" : "GET",
      headers: { accept: "application/json", ...(body ? { "content-type": "application/json" } : {}), ...(userId ? { "x-user-id": userId } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const json = await response.json().catch(() => null);
    if (json === null) {
      console.error("[API] Non-JSON response", { url: response.url, status: response.status, contentType: response.headers.get("content-type") || "(missing)" });
      return { ok: false, status: response.status, code: "E-API-NO-JSON", message: "" };
    }
    if (response.ok && json?.ok) return { ok: true, data: json.data as T };
    return { ok: false, status: response.status, code: String(json?.error?.code ?? "E-API"), message: String(json?.error?.message ?? "خطای API") };
  } catch {
    return { ok: false, status: 0, code: "E-NETWORK", message: "اتصال به سرور برقرار نشد" };
  }
}

function Field({ label, value, onChange, type = "text", required = false, testId }: {
  label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; testId: string;
}) {
  return <label className="block min-w-0"><span className="mb-1 block text-[8.5px] tx3">{label}{required ? " *" : ""}</span>
    <input data-testid={testId} className={INPUT} type={type} value={value} required={required} onChange={e => onChange(e.target.value)} /></label>;
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return <section className="glass-dark rounded-2xl p-3"><div className="mb-2 flex flex-wrap items-baseline gap-2"><h4 className="text-[11px] font-semibold tx1">{title}</h4>{note && <span className="text-[8.5px] tx3">{note}</span>}</div>{children}</section>;
}

/** Dedicated d14-p4 adjustment and material-differential workspace. */
export default function CntAdjustmentPanel({ projectId, contractId, userId, lang, mode }: {
  projectId: string; contractId: string; userId: string; lang: Lang; mode: "index" | "material";
}) {
  const en = lang === "en";
  const [ipcs, setIpcs] = useState<Row[]>([]);
  const [indices, setIndices] = useState<Row[]>([]);
  const [materialRows, setMaterialRows] = useState<Row[]>([]);
  const [ipcId, setIpcId] = useState("");
  const [indexPeriod, setIndexPeriod] = useState("");
  const [calculationPeriod, setCalculationPeriod] = useState("");
  const [basePeriod, setBasePeriod] = useState("");
  const [appliedRatePct, setAppliedRatePct] = useState("100");
  const [chapterCode, setChapterCode] = useState("");
  const [indexValue, setIndexValue] = useState("");
  const [source, setSource] = useState("");
  const [preview, setPreview] = useState<Row | null>(null);
  const [material, setMaterial] = useState({ code: "", name: "", quantity: "", unit: "", baseRate: "", periodRate: "", evidence: "" });
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const selectedIpc = ipcs.find(row => String(row.id) === ipcId);
  const unlocked = selectedIpc && !selectedIpc.locked && !["approved", "paid", "rejected"].includes(String(selectedIpc.workflowState));

  const load = useCallback(async () => {
    const [ipcResult, indexResult] = await Promise.all([
      request<{ items: Row[] }>(`/api/cnt/ipc?projectId=${encodeURIComponent(projectId)}&contractId=${encodeURIComponent(contractId)}`, userId),
      request<{ items: Row[] }>(`/api/cnt/index?projectId=${encodeURIComponent(projectId)}`, userId),
    ]);
    if (ipcResult.ok) {
      const rows = ipcResult.data.items ?? [];
      setIpcs(rows);
      setIpcId(current => rows.some(row => String(row.id) === current) ? current : String(rows.find(row => !row.locked)?.id ?? rows[0]?.id ?? ""));
    }
    if (indexResult.ok) setIndices(indexResult.data.items ?? []);
  }, [projectId, contractId, userId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    let active = true;
    if (mode !== "material" || !ipcId) { setMaterialRows([]); return () => { active = false; }; }
    void request<{ items: Row[] }>(`/api/cnt/material-diff?projectId=${encodeURIComponent(projectId)}&contractId=${encodeURIComponent(contractId)}&ipcId=${encodeURIComponent(ipcId)}`, userId)
      .then(result => { if (active && result.ok) setMaterialRows(result.data.items ?? []); });
    return () => { active = false; };
  }, [mode, projectId, contractId, ipcId, userId]);
  const published = useMemo(() => indices.filter(row => row.Status === "published"), [indices]);
  const amountPreview = Number(material.quantity || 0) * (Number(material.periodRate || 0) - Number(material.baseRate || 0));

  const saveIndex = async (status: "draft" | "published") => {
    setBusy(true); setMessage(null);
    const result = await request<Row>(`/api/cnt/index?projectId=${encodeURIComponent(projectId)}`, userId, {
      projectId, indexPeriod: indexPeriod.trim(), chapterCode: chapterCode.trim(), indexValue: Number(indexValue), sourceFa: source.trim() || undefined,
      publishedAt: status === "published" ? new Date().toISOString().slice(0, 10) : undefined, status,
    });
    setBusy(false);
    if (!result.ok) { if (result.code !== "E-API-NO-JSON") setMessage({ error: true, text: `${result.code}: ${result.message}` }); return; }
    setMessage({ error: false, text: en ? `Index ${status} saved.` : `شاخص ${status === "published" ? "منتشر" : "ذخیره"} شد.` });
    await load();
  };

  const runAdjustment = async (dryRun: boolean) => {
    if (!selectedIpc) return;
    setBusy(true); setMessage(null);
    const result = await request<Row>(`/api/cnt/ipc/${encodeURIComponent(ipcId)}/adjustment?projectId=${encodeURIComponent(projectId)}`, userId, {
      indexPeriod: calculationPeriod.trim(), baseIndexPeriod: basePeriod.trim(), appliedRatePct: Number(appliedRatePct), ...(dryRun ? { dryRun: true } : {}),
    });
    setBusy(false);
    if (!result.ok) { if (result.code !== "E-API-NO-JSON") setMessage({ error: true, text: `${result.code}: ${result.message}` }); if (!dryRun) setPreview(null); return; }
    setPreview(result.data);
    if (!dryRun) {
      setMessage({ error: false, text: en ? `Adjustment posted: ${Number(result.data.totalAdjustment ?? 0).toLocaleString()} (saved ${result.data.saved?.length ?? 0}, skipped ${result.data.skipped ?? 0}).` : `تعدیل ثبت شد: ${Number(result.data.totalAdjustment ?? 0).toLocaleString("fa-IR")} · ثبت ${result.data.saved?.length ?? 0} · تکراری ${result.data.skipped ?? 0}` });
      await load();
    }
  };

  const saveMaterial = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedIpc) return;
    setBusy(true); setMessage(null);
    const result = await request<Row>(`/api/cnt/material-diff?projectId=${encodeURIComponent(projectId)}`, userId, {
      projectId, contractId, ipcId, materialCode: material.code.trim(), materialNameFa: material.name.trim(),
      quantity: Number(material.quantity), unit: material.unit.trim() || undefined, baseRate: Number(material.baseRate), periodRate: Number(material.periodRate), evidenceDocNo: material.evidence.trim() || undefined,
    });
    setBusy(false);
    if (!result.ok) { if (result.code !== "E-API-NO-JSON") setMessage({ error: true, text: `${result.code}: ${result.message}` }); return; }
    setMessage({ error: false, text: en ? `Differential recorded: ${Number(result.data.diffAmount).toLocaleString()}.` : `مابه‌التفاوت ${Number(result.data.diffAmount).toLocaleString("fa-IR")} ریال ثبت شد.` });
    setMaterialRows(rows => [...rows, { Id: result.data.id, IpcId: ipcId, MaterialCode: result.data.materialCode, MaterialNameFa: result.data.materialNameFa, Quantity: result.data.quantity, Unit: result.data.unit, BaseRate: result.data.baseRate, PeriodRate: result.data.periodRate, DiffAmount: result.data.diffAmount, EvidenceDocNo: material.evidence, Status: "draft" }]);
    setMaterial({ code: "", name: "", quantity: "", unit: "", baseRate: "", periodRate: "", evidence: "" });
    await load();
  };

  return <div className="space-y-3" data-testid="cnt-adjustment-workspace">
    <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-[9px] tx2" role="note">
      {en ? "Use officially published indices only. Preview first; calculations are period-work based, negative adjustments are allowed, and locked IPCs cannot be changed." : "فقط شاخص رسمیِ منتشرشده مبنای محاسبه است. ابتدا پیش‌نمایش بگیرید؛ تعدیل بر کارکرد همین دوره است، کاهش شاخص مجاز است و صورت‌وضعیت قفل‌شده تغییر نمی‌کند."}
    </div>
    {message && <p role="status" className={`rounded-lg px-2 py-1 text-[9px] ${message.error ? "bg-rose-400/10 text-rose-300" : "bg-emerald-400/10 text-emerald-300"}`}>{message.text}</p>}

    {mode === "index" && <Section title={en ? "Index catalog" : "کاتالوگ شاخص تعدیل"} note={en ? "Draft indices are not eligible for official calculations." : "شاخص پیش‌نویس برای محاسبه رسمی پذیرفته نمی‌شود."}>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Field label={en ? "Index period" : "دوره شاخص"} testId="cnt-adjustment-index-period" value={indexPeriod} onChange={setIndexPeriod} required />
        <Field label={en ? "Chapter code" : "کد فصل"} testId="cnt-adjustment-index-chapter" value={chapterCode} onChange={setChapterCode} required />
        <Field label={en ? "Index value" : "مقدار شاخص"} testId="cnt-adjustment-index-value" value={indexValue} onChange={setIndexValue} type="number" required />
        <Field label={en ? "Source / circular" : "منبع / شماره بخشنامه"} testId="cnt-adjustment-index-source" value={source} onChange={setSource} />
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button data-testid="cnt-adjustment-index-draft" className={BTN} disabled={busy || !userId || !indexPeriod.trim() || !chapterCode.trim() || !indexValue || Number(indexValue) < 0} onClick={() => void saveIndex("draft")}>{en ? "Save draft" : "ذخیره پیش‌نویس"}</button>
        <button data-testid="cnt-adjustment-index-publish" className={PRIMARY} disabled={busy || !userId || !indexPeriod.trim() || !chapterCode.trim() || !indexValue || Number(indexValue) < 0 || !source.trim()} onClick={() => void saveIndex("published")}>{en ? "Publish index" : "انتشار شاخص رسمی"}</button>
      </div>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-[9px]"><thead className="tx3"><tr className="border-b b-line-soft"><th className="px-2 py-1 text-start">{en ? "Period" : "دوره"}</th><th className="px-2 py-1 text-start">{en ? "Chapter" : "فصل"}</th><th className="px-2 py-1 text-start">{en ? "Value" : "شاخص"}</th><th className="px-2 py-1 text-start">{en ? "Status" : "وضعیت"}</th><th className="px-2 py-1 text-start">{en ? "Source" : "منبع"}</th></tr></thead>
          <tbody>{indices.map((row, i) => <tr key={row.Id ?? `${row.IndexPeriod}-${row.ChapterCode}-${i}`} className="border-b b-line-soft/50"><td className="px-2 py-1" dir="ltr">{row.IndexPeriod}</td><td className="px-2 py-1" dir="ltr">{row.ChapterCode}</td><td className="px-2 py-1 tabular-nums" dir="ltr">{row.IndexValue}</td><td className="px-2 py-1">{row.statusFa ?? row.Status}</td><td className="px-2 py-1">{row.SourceFa || "—"}</td></tr>)}
          {!indices.length && <tr><td colSpan={5} className="px-2 py-3 text-center tx3">{en ? "No index entries yet." : "شاخصی ثبت نشده است."}</td></tr>}</tbody></table>
      </div>
    </Section>}

    {mode === "index" && <Section title={en ? "Index-based adjustment" : "محاسبه تعدیل بر پایه شاخص"} note={en ? "Server-derived from the selected IPC's period work and BOQ chapter codes." : "محاسبه سمت سرور از کارکرد دوره و کد فصل ردیف‌های همین صورت‌وضعیت."}>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
        <label className="block"><span className="mb-1 block text-[8.5px] tx3">{en ? "IPC" : "صورت‌وضعیت"}</span><select data-testid="cnt-adjustment-ipc" className={INPUT} value={ipcId} onChange={e => { setIpcId(e.target.value); setPreview(null); }}>
          {!ipcs.length && <option value="">{en ? "No IPCs" : "صورت‌وضعیتی نیست"}</option>}
          {ipcs.map(row => <option key={row.id} value={row.id} disabled={row.locked}>{en ? `#${row.serialNo} · ${row.periodCode} · ${row.workflowState}` : `شماره ${row.serialNo} · ${row.periodCode} · ${row.workflowStateFa}${row.locked ? " (قفل)" : ""}`}</option>)}
        </select></label>
        <Field label={en ? "Published index period" : "دوره شاخص منتشرشده"} testId="cnt-adjustment-period" value={calculationPeriod} onChange={value => { setCalculationPeriod(value); setPreview(null); }} required />
        <Field label={en ? "Base index period" : "دوره شاخص مبنا"} testId="cnt-adjustment-base-period" value={basePeriod} onChange={value => { setBasePeriod(value); setPreview(null); }} required />
        <Field label={en ? "Applied contract rate (%)" : "ضریب اعمال پیمان ٪"} testId="cnt-adjustment-applied-rate" value={appliedRatePct} onChange={value => { setAppliedRatePct(value); setPreview(null); }} type="number" required />
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button data-testid="cnt-adjustment-preview" className={BTN} disabled={busy || !userId || !unlocked || !calculationPeriod.trim() || !basePeriod.trim()} onClick={() => void runAdjustment(true)}>{en ? "Preview calculation" : "پیش‌نمایش محاسبه"}</button>
        <button data-testid="cnt-adjustment-apply" className={PRIMARY} disabled={busy || !userId || !unlocked || !preview?.usable || !preview?.rows?.length} onClick={() => void runAdjustment(false)}>{en ? "Record adjustment" : "ثبت تعدیل در صورت‌وضعیت"}</button>
      </div>
      {preview && <div data-testid="cnt-adjustment-preview-result" className="mt-2 rounded-xl border b-line-soft p-2 text-[9px]">
        {preview.blocked?.length > 0 && <ul className="mb-2 text-amber-200">{preview.blocked.map((row: Row, i: number) => <li key={`${row.chapterCode}-${i}`}>{row.chapterCode}: {row.messageFa}</li>)}</ul>}
        <div className="overflow-x-auto"><table className="w-full"><thead className="tx3"><tr className="border-b b-line-soft"><th className="px-2 py-1 text-start">{en ? "Chapter" : "فصل"}</th><th className="px-2 py-1 text-end">{en ? "Period work" : "کارکرد دوره"}</th><th className="px-2 py-1 text-end">{en ? "Factor" : "ضریب"}</th><th className="px-2 py-1 text-end">{en ? "Adjustment" : "مبلغ تعدیل"}</th></tr></thead>
          <tbody>{(preview.rows ?? []).map((row: Row) => <tr key={row.chapterCode} className="border-b b-line-soft/50"><td className="px-2 py-1" dir="ltr">{row.chapterCode}</td><td className="px-2 py-1 text-end tabular-nums" dir="ltr">{Number(row.workAmount).toLocaleString()}</td><td className="px-2 py-1 text-end tabular-nums" dir="ltr">{row.adjustmentFactor}</td><td className="px-2 py-1 text-end tabular-nums" dir="ltr">{Number(row.adjustmentAmount).toLocaleString()}</td></tr>)}</tbody></table></div>
        <p className="mt-2 text-end font-semibold tx1">{en ? "Total adjustment" : "جمع تعدیل"}: <span dir="ltr">{Number(preview.totalAdjustment ?? 0).toLocaleString(en ? "en-US" : "fa-IR")}</span></p>
      </div>}
      {selectedIpc && !unlocked && <p role="status" className="mt-2 text-[9px] text-amber-200">{en ? "This IPC is locked; create or select a draft IPC to apply adjustments." : "این صورت‌وضعیت قفل است؛ برای ثبت تعدیل یک پیش‌نویس انتخاب کنید."}</p>}
      {!published.length && <p role="status" className="mt-2 text-[9px] text-amber-200">{en ? "No published indices. Drafts cannot be used for an official adjustment." : "شاخص منتشرشده ندارید؛ شاخص پیش‌نویس برای تعدیل رسمی پذیرفته نیست."}</p>}
    </Section>}

    {mode === "material" && <Section title={en ? "Material price differential" : "مابه‌التفاوت مصالح"} note={en ? "Record each evidenced material once per IPC. The server enforces duplicate and workflow locks." : "هر قلم مستند را برای هر صورت‌وضعیت یک‌بار ثبت کنید؛ سرور تکرار و قفل گردش را کنترل می‌کند."}>
      <form onSubmit={saveMaterial}>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Field label={en ? "Material code" : "کد مصالح"} testId="cnt-material-code" value={material.code} onChange={code => setMaterial(m => ({ ...m, code }))} required />
          <Field label={en ? "Material name" : "نام مصالح"} testId="cnt-material-name" value={material.name} onChange={name => setMaterial(m => ({ ...m, name }))} required />
          <Field label={en ? "Quantity" : "مقدار"} testId="cnt-material-quantity" value={material.quantity} onChange={quantity => setMaterial(m => ({ ...m, quantity }))} type="number" required />
          <Field label={en ? "Unit" : "واحد"} testId="cnt-material-unit" value={material.unit} onChange={unit => setMaterial(m => ({ ...m, unit }))} />
          <Field label={en ? "Base rate" : "نرخ مبنا"} testId="cnt-material-base-rate" value={material.baseRate} onChange={baseRate => setMaterial(m => ({ ...m, baseRate }))} type="number" required />
          <Field label={en ? "Period rate" : "نرخ دوره"} testId="cnt-material-period-rate" value={material.periodRate} onChange={periodRate => setMaterial(m => ({ ...m, periodRate }))} type="number" required />
          <Field label={en ? "Invoice / evidence ref" : "شماره فاکتور / مستند"} testId="cnt-material-evidence" value={material.evidence} onChange={evidence => setMaterial(m => ({ ...m, evidence }))} />
          <label className="block"><span className="mb-1 block text-[8.5px] tx3">{en ? "Selected IPC" : "صورت‌وضعیت منتخب"}</span><select className={INPUT} value={ipcId} onChange={e => setIpcId(e.target.value)} disabled={!ipcs.length}>{ipcs.map(row => <option key={row.id} value={row.id} disabled={row.locked}>{en ? `#${row.serialNo} ${row.periodCode}` : `شماره ${row.serialNo} ${row.periodCode}`}</option>)}</select></label>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2"><p data-testid="cnt-material-diff-estimate" className="text-[9px] tx2">{en ? "Estimated differential" : "برآورد مابه‌التفاوت"}: <b dir="ltr">{Number.isFinite(amountPreview) ? amountPreview.toLocaleString(en ? "en-US" : "fa-IR") : "—"}</b></p>
          <button data-testid="cnt-material-diff-submit" className={PRIMARY} disabled={busy || !userId || !unlocked || !material.code.trim() || !material.name.trim() || !material.quantity || !material.baseRate || !material.periodRate || Number(material.quantity) < 0 || Number(material.baseRate) < 0 || Number(material.periodRate) < 0} type="submit">{en ? "Record differential" : "ثبت مابه‌التفاوت"}</button></div>
      </form>
      <div className="mt-3 overflow-x-auto" data-testid="cnt-material-diff-ledger">
        <table className="w-full text-[9px]"><thead className="tx3"><tr className="border-b b-line-soft"><th className="px-2 py-1 text-start">{en ? "Code / material" : "کد / مصالح"}</th><th className="px-2 py-1 text-end">{en ? "Quantity" : "مقدار"}</th><th className="px-2 py-1 text-end">{en ? "Base → period rate" : "نرخ مبنا ← دوره"}</th><th className="px-2 py-1 text-end">{en ? "Differential" : "مابه‌التفاوت"}</th><th className="px-2 py-1 text-start">{en ? "Evidence" : "مستند"}</th></tr></thead>
          <tbody>{materialRows.map((row, i) => <tr key={row.Id ?? `${row.MaterialCode}-${i}`} className="border-b b-line-soft/50"><td className="px-2 py-1">{row.MaterialCode} · {row.MaterialNameFa}</td><td className="px-2 py-1 text-end tabular-nums" dir="ltr">{Number(row.Quantity).toLocaleString()} {row.Unit ?? ""}</td><td className="px-2 py-1 text-end tabular-nums" dir="ltr">{Number(row.BaseRate).toLocaleString()} → {Number(row.PeriodRate).toLocaleString()}</td><td className="px-2 py-1 text-end tabular-nums" dir="ltr">{Number(row.DiffAmount).toLocaleString()}</td><td className="px-2 py-1">{row.EvidenceDocNo || "—"}</td></tr>)}
          {!materialRows.length && <tr><td colSpan={5} className="px-2 py-3 text-center tx3">{en ? "No material differentials recorded for this IPC." : "برای این صورت‌وضعیت مابه‌التفاوت مصالح ثبت نشده است."}</td></tr>}</tbody></table>
      </div>
    </Section>}
  </div>;
}
