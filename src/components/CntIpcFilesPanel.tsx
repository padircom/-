/**
 * فاز ۵ ADR-CNT-IPC-UNIFY — اسناد و تبادل فایل صورتوضعیت.
 * ---------------------------------------------------------------------------
 * APIهای PDF رسمی و Excel اختصاصی در فاز ۴ ساخته شدند ولی هیچ دکمهای در
 * رابط نداشتند. این پنل همان مسیرها را صدا میزند. قواعد عمدی:
 *   · ورود Excel همیشه نخست «پیشنمایش» است؛ تا دکمهٔ «ثبت» زده نشود
 *     `commit=1` فرستاده نمیشود (هیچ نوشتهای پنهانی نیست).
 *   · خروجیها باینریاند؛ خطا (۴۲۲ سربرگ، ۵۰۱ نبود Chromium، ۴۰۳ مجوز)
 *     بهصورت پیام فارسی نشان داده میشود، نه فایل خراب.
 *   · وضعیت امضا: «تأیید ثبتشده» در برابر «امضای دیجیتال X.509» صریحاً
 *     جدا نمایش داده میشود تا کسی هش ساده را امضای PKI نپندارد.
 *
 * این فایل فقط از کلاسهای موجود طراحی استفاده میکند؛ `src/index.css`،
 * فونت و ساختار سایدبار اصلی دستنخورده میماند.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCurrentProjectId } from "../context/SystemContext";
import { logAudit } from "../services/auditLogger";
import {
  CntIpcFilesClient, saveBlob, cntIpcPkiStatus, cntIpcVerifySignatures,
  type CntExcelPreview, type CntFileKind, type CntIpcSignatureVerification, type CntPkiStatus,
} from "../services/cntIpcFiles";

const BTN = "rounded-lg border b-line-soft px-2.5 py-1 text-[9px] tx2 transition hover:tx1 disabled:opacity-40";
const BTN_PRIMARY = "rounded-lg border border-sky-400/40 bg-sky-400/10 px-2.5 py-1 text-[9px] text-sky-200 transition hover:bg-sky-400/20 disabled:opacity-40";
const INPUT = "w-full rounded-lg border b-line-soft bg-black/25 px-2 py-1.5 text-[10px] tx1 outline-none transition focus:border-sky-400/50";

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="glass-dark rounded-2xl p-3">
      <div className="mb-2 flex flex-wrap items-baseline gap-2">
        <h4 className="text-[11px] font-semibold tx1">{title}</h4>
        {note && <span className="text-[8.5px] font-extralight tx3">{note}</span>}
      </div>
      {children}
    </section>
  );
}

export default function CntIpcFilesPanel({ contractId, ipcId, userId }: {
  contractId: string; ipcId: string; userId: string;
}) {
  const projectId = useCurrentProjectId();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [kind, setKind] = useState<CntFileKind>("templates");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CntExcelPreview | null>(null);
  const [verification, setVerification] = useState<CntIpcSignatureVerification | null>(null);
  const [pki, setPki] = useState<CntPkiStatus | null>(null);
  const [docSha, setDocSha] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const client = useMemo(() => new CntIpcFilesClient(projectId, ipcId, userId), [projectId, ipcId, userId]);

  useEffect(() => {
    setPreview(null); setVerification(null); setDocSha(null); setMsg(null);
    void cntIpcPkiStatus(userId).then((r) => setPki(r.ok ? r.data : null));
  }, [projectId, ipcId, userId]);

  const download = useCallback(async (what: "pdf" | "print" | CntFileKind) => {
    setBusy(true); setMsg(null);
    const r = what === "pdf" ? await client.pdf()
      : what === "print" ? await client.pdf({ engine: "print" })
        : await client.excel(what, contractId);
    setBusy(false);
    if (!r.ok) { setMsg({ kind: "err", text: `${r.code}: ${r.message}` }); return; }
    const name = what === "print"
      ? `ipc-${ipcId || "draft"}-print.html`
      : r.fileName || (what === "pdf" ? `ipc-${ipcId}.pdf` : `cnt-${what}.xlsx`);
    saveBlob(r.blob, name);
    if (what === "pdf" && r.docSha256) setDocSha(r.docSha256);
    setMsg({ kind: "ok", text: `فایل «${name}» آماده شد${what === "print" ? " (نسخهٔ چاپی؛ PDF باینری نیست)" : ""}` });
  }, [client, contractId, ipcId]);

  const runImport = async (commit: boolean) => {
    if (!file) { setMsg({ kind: "err", text: "اول فایل XLSX را انتخاب کنید" }); return; }
    setBusy(true); setMsg(null);
    const r = await client.importExcel(kind, file, commit, contractId);
    setBusy(false);
    if (!r.ok) { setMsg({ kind: "err", text: r.message }); return; }
    setPreview(r.data);
    if (commit) {
      setMsg({ kind: "ok", text: `${r.data.written ?? r.data.count} ردیف ثبت شد (جدید: ${r.data.inserted ?? 0}، بهروزشده: ${r.data.updated ?? 0})` });
      logAudit("CNT_IPC_EXCEL_COMMIT", "Contracts", `ورود ${kind}: ${r.data.written ?? r.data.count} ردیف`);
    } else {
      setMsg({ kind: "ok", text: `پیشنمایش ${r.data.count} ردیف — هنوز چیزی ثبت نشده است` });
    }
  };

  const verify = async () => {
    setBusy(true); setMsg(null);
    const r = await cntIpcVerifySignatures(projectId, ipcId, userId);
    setBusy(false);
    if (!r.ok) { setMsg({ kind: "err", text: r.message }); return; }
    setVerification(r.data);
    logAudit("CNT_IPC_SIGNATURE_VERIFY", "Contracts", `راستیآزمایی ${ipcId}: ${r.data.ok ? "معتبر" : "نامعتبر"}`);
    setMsg({ kind: r.data.ok ? "ok" : "err", text: r.data.ok
      ? `زنجیرهٔ هش و ${r.data.pki.checked} امضای دیجیتال معتبر است`
      : `راستیآزمایی ناموفق: ${r.data.issuesFa.join("؛ ")}` });
  };

  const pkiLabel = pki?.ok
    ? (pki.trustLevel === "ca-verified" ? "امضای دیجیتال X.509 (زنجیرهٔ اعتماد تأییدشده)" : "امضای دیجیتال X.509 (گواهی خودامضا — فقط توسعه)")
    : "فقط تأیید ثبتشده — PKI پیکربندی نشده است";

  return (
    <Section title="اسناد، امضا و تبادل فایل" note="PDF رسمی و Excel اختصاصی ماژول پیمان؛ ورود دومرحلهای (پیشنمایش ← ثبت)">
      <div className="space-y-2" dir="rtl">
        {msg && (
          <p role="status" data-testid="cnt-ipc-files-msg" className={`rounded-lg px-2 py-1 text-[9px] ${msg.kind === "ok" ? "bg-emerald-400/10 text-emerald-300" : "bg-rose-400/10 text-rose-300"}`}>{msg.text}</p>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[8.5px] tx3">وضعیت امضا:</span>
          <span data-testid="cnt-ipc-pki-status" className={`rounded border px-1.5 py-0.5 text-[8.5px] ${pki?.ok ? "border-emerald-400/30 text-emerald-300" : "b-line-soft text-amber-200"}`}>{pkiLabel}</span>
          {pki?.certificate && <span className="font-mono text-[8px] tx4" dir="ltr">{String(pki.certificate.KeyId)}</span>}
          {!pki?.ok && pki?.issuesFa?.[0] && <span className="text-[8px] tx4">{pki.issuesFa[0]}</span>}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 border-t b-line-soft pt-2">
          <span className="ml-1 text-[8.5px] tx3">سند رسمی:</span>
          <button type="button" data-testid="cnt-ipc-pdf" disabled={busy || !ipcId} className={BTN_PRIMARY} onClick={() => void download("pdf")}>⬇ PDF رسمی</button>
          <button type="button" disabled={busy || !ipcId} className={BTN} onClick={() => void download("print")}>نسخهٔ چاپی HTML</button>
          <button type="button" data-testid="cnt-ipc-verify" disabled={busy || !ipcId} className={BTN} onClick={() => void verify()}>راستیآزمایی امضا</button>
          {docSha && <span className="font-mono text-[8px] tx4" dir="ltr">SHA-256: {docSha.slice(0, 16)}…</span>}
        </div>
        {!ipcId && <div className="text-[8px] tx4">برای دریافت PDF یا راستیآزمایی، یک صورتوضعیت را از جدول بالا باز کنید.</div>}

        {verification && (
          <div data-testid="cnt-ipc-verification" className="rounded-lg border b-line-soft bg-black/15 p-2 text-[8.5px] tx2">
            <div className="flex flex-wrap gap-3">
              <span>زنجیرهٔ هش: <b className={verification.chain.ok ? "text-emerald-300" : "text-rose-300"}>{verification.chain.ok ? "معتبر" : "نامعتبر"}</b> ({verification.chain.checked} گام)</span>
              <span>امضای دیجیتال: <b className={verification.pki.ok ? "text-emerald-300" : "text-rose-300"}>{verification.pki.ok ? "معتبر" : "نامعتبر"}</b> ({verification.pki.checked} گام)</span>
              <span>گواهیها: {verification.certificates.length}</span>
            </div>
            {verification.issuesFa.length > 0 && <div className="mt-1 text-rose-300">{verification.issuesFa.join("؛ ")}</div>}
            {verification.certificates.map((c) => (
              <div key={String(c.CertSha256)} className="mt-1 font-mono text-[8px] tx4" dir="ltr">
                {String(c.Subject)} · {String(c.CertSha256).slice(0, 16)}… · {String(c.TrustLevel)}
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5 border-t b-line-soft pt-2">
          <span className="ml-1 text-[8.5px] tx3">خروجی Excel:</span>
          <button type="button" data-testid="cnt-ipc-excel-templates" disabled={busy} className={BTN} onClick={() => void download("templates")}>⬇ قالبها (XLSX)</button>
          <button type="button" data-testid="cnt-ipc-excel-measurements" disabled={busy || !contractId} className={BTN} onClick={() => void download("measurements")}>⬇ ریزمتره (XLSX)</button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="ml-1 text-[8.5px] tx3">ورود Excel:</span>
          <select data-testid="cnt-ipc-import-kind" className={`${INPUT} max-w-32`} value={kind} onChange={(ev) => { setKind(ev.target.value as CntFileKind); setPreview(null); }}>
            <option value="templates">قالبها</option>
            <option value="measurements">ریزمتره</option>
          </select>
          <input ref={inputRef} data-testid="cnt-ipc-import-file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="max-w-44 text-[8.5px] tx3"
            onChange={(ev) => { setFile(ev.target.files?.[0] ?? null); setPreview(null); setMsg(null); }} />
          <button type="button" data-testid="cnt-ipc-import-preview" disabled={busy || !file} className={BTN} onClick={() => void runImport(false)}>🔍 پیشنمایش</button>
          <button type="button" data-testid="cnt-ipc-import-commit" disabled={busy || !file || !preview || (preview.issues?.length ?? 0) > 0}
            className={BTN_PRIMARY} onClick={() => void runImport(true)}>ثبت نهایی</button>
        </div>

        {preview && (
          <div data-testid="cnt-ipc-import-preview-result" className="rounded-lg border b-line-soft bg-black/15 p-2 text-[8.5px] tx2">
            <div className="flex flex-wrap gap-3">
              <span>ردیفها: <b className="tx1">{preview.count}</b></span>
              <span>وضعیت: <b className={preview.committed ? "text-emerald-300" : "text-amber-200"}>{preview.committed ? "ثبت شد" : "فقط پیشنمایش"}</b></span>
              <span>ایرادها: <b className={(preview.issues?.length ?? 0) ? "text-rose-300" : "tx1"}>{preview.issues?.length ?? 0}</b></span>
            </div>
            {(preview.issues ?? []).slice(0, 5).map((x, i) => (
              <div key={i} className="mt-0.5 text-rose-300">{String(x.messageFa ?? JSON.stringify(x))}</div>
            ))}
            {!preview.committed && <div className="mt-1 text-[8px] tx4">تا دکمهٔ «ثبت نهایی» زده نشود هیچ رکوردی نوشته نمیشود.</div>}
          </div>
        )}
      </div>
    </Section>
  );
}
