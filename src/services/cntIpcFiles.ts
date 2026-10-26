/**
 * کلاینت اختصاصی اسناد صورتوضعیت (فاز ۵ ADR-CNT-IPC-UNIFY).
 * ---------------------------------------------------------------------------
 * تا پیش از این، PDF رسمی و Excel قالبها/ریزمتره فقط API بودند و هیچ
 * دکمهای در رابط کاربری نداشتند. این کلاینت فقط همان **مسیرهای اختصاصی
 * ماژول CNT** را صدا میزند (`/api/cnt/ipc/:id/pdf` و
 * `/api/cnt/excel/:projectId/...`)؛ از موتور عمومی فایل (`/api/integration/*`
 * و CRUD عمومی) استفاده نمیکند چون آن مسیرها قواعد محاسبه/دروازهٔ کیفی
 * ریزمتره را دور میزنند.
 *
 * خروجیها باینریاند (PDF/XLSX)، پس `jsonRequest` به درد نمیخورد: پاسخ
 * خطا همچنان JSON است و باید پیش از ساختن Blob خوانده شود تا پیام فارسی
 * سرور (مثلاً «سربرگ رسمی ناقص است» یا «موتور PDF در دسترس نیست») به
 * کاربر برسد، نه یک فایل خراب.
 */
import type { ApiResult } from "./apiClient";

const e = encodeURIComponent;

export type CntFileKind = "templates" | "measurements";

/** نتیجهٔ دانلود باینری؛ `blob` فقط وقتی ok است وجود دارد. */
export type BinaryResult =
  | { ok: true; blob: Blob; fileName: string; contentType: string; docSha256: string | null }
  | { ok: false; status: number; code: string; message: string };

export type CntExcelPreview = {
  committed: boolean;
  count: number;
  written?: number;
  inserted?: number;
  updated?: number;
  preview: Record<string, unknown>[];
  issues: Record<string, unknown>[];
};

export type CntIpcSignatureVerification = {
  ok: boolean;
  documentSha256: string;
  chain: { ok: boolean; checked: number; issuesFa: string[] };
  pki: { ok: boolean; checked: number; issuesFa: string[]; steps: Record<string, unknown>[] };
  certificates: Record<string, unknown>[];
  issuesFa: string[];
};

export type CntPkiStatus = {
  configured: boolean;
  ok: boolean;
  required: boolean;
  trustLevel: "ca-verified" | "self-signed" | null;
  issuesFa: string[];
  certificate: Record<string, unknown> | null;
};

/** نام فایل از `content-disposition` (ASCII یا filename*=UTF-8''...). */
export function fileNameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const utf = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(header);
  if (utf?.[1]) {
    try { return decodeURIComponent(utf[1].trim().replace(/^"|"$/g, "")); } catch { /* زیر را امتحان میکند */ }
  }
  const plain = /filename\s*=\s*"([^"]+)"/i.exec(header) ?? /filename\s*=\s*([^;]+)/i.exec(header);
  const name = plain?.[1]?.trim().replace(/^"|"$/g, "");
  /* نام فایل نباید مسیر بسازد: فقط بخش آخر و بدون نویسههای کنترلی. */
  const safe = name ? name.split(/[\\/]/).pop() : null;
  return safe && !/[\x00-\x1f]/.test(safe) ? safe : fallback;
}

async function binaryRequest(
  url: string, userId: string | null, init: RequestInit, fallbackName: string,
): Promise<BinaryResult> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        accept: "application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/json;q=0.9,*/*;q=0.8",
        ...(userId ? { "x-user-id": userId } : {}),
        ...(init.headers ?? {}),
      },
    });
    const ct = res.headers.get("content-type") ?? "";
    if (!res.ok || ct.includes("application/json")) {
      let code = `E-CNT-FILE-${res.status}`;
      let message = `دریافت فایل ناموفق بود (${res.status})`;
      try {
        const j = await res.json();
        code = String(j?.error?.code ?? code);
        message = String(j?.error?.message ?? message);
      } catch { /* بدنهٔ غیرJSON */ }
      return { ok: false, status: res.status, code, message };
    }
    const blob = await res.blob();
    return {
      ok: true,
      blob,
      fileName: fileNameFromDisposition(res.headers.get("content-disposition"), fallbackName),
      contentType: ct,
      docSha256: res.headers.get("x-cnt-ipc-doc-sha256"),
    };
  } catch {
    return { ok: false, status: 0, code: "E-API-NETWORK", message: "اتصال به سرور برقرار نشد" };
  }
}

/** ذخیرهٔ Blob در مرورگر (بدون وابستگی به کتابخانهٔ بیرونی). */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export class CntIpcFilesClient {
  constructor(private readonly projectId: string, private readonly ipcId: string, private readonly userId: string | null) {}

  /**
   * PDF رسمی. `engine=print` همان HTML چاپی قدیمی است (تنزل آگاهانه
   * وقتی Chromium سرور در دسترس نیست)؛ `format=json` پیشنمایش داده.
   */
  pdf = (opts: { engine?: "print"; format?: "json" } = {}): Promise<BinaryResult> => {
    const q = new URLSearchParams({ projectId: this.projectId });
    if (opts.engine) q.set("engine", opts.engine);
    if (opts.format) q.set("format", opts.format);
    return binaryRequest(
      `/api/cnt/ipc/${e(this.ipcId)}/pdf?${q.toString()}`,
      this.userId, { method: "GET" }, `ipc-${this.ipcId}.pdf`,
    );
  };

  /** خروجی XLSX اختصاصی (قالبها یا ریزمتره). */
  excel = (kind: CntFileKind, contractId?: string): Promise<BinaryResult> => {
    const q = new URLSearchParams();
    if (kind === "measurements" && contractId) q.set("contractId", contractId);
    const qs = q.toString();
    return binaryRequest(
      `/api/cnt/excel/${e(this.projectId)}/${kind}${qs ? `?${qs}` : ""}`,
      this.userId, { method: "GET" }, `cnt-${kind}-${this.projectId}.xlsx`,
    );
  };

  /**
   * ورود XLSX. پیشفرض فقط **پیشنمایش** است؛ تا `commit:true` نیاید هیچ
   * نوشتهای انجام نمیشود (همان قرارداد سرور).
   */
  importExcel = async (kind: CntFileKind, file: File, commit: boolean, contractId?: string): Promise<ApiResult<CntExcelPreview>> => {
    const q = new URLSearchParams();
    if (commit) q.set("commit", "1");
    if (kind === "measurements" && contractId) q.set("contractId", contractId);
    const qs = q.toString();
    const form = new FormData();
    form.append("file", file, file.name);
    try {
      const res = await fetch(`/api/cnt/excel/${e(this.projectId)}/${kind}${qs ? `?${qs}` : ""}`, {
        method: "POST",
        headers: this.userId ? { "x-user-id": this.userId } : {},
        body: form,
      });
      let json: Record<string, unknown> | null = null;
      try { json = await res.json(); } catch { /* پاسخ غیرJSON */ }
      if (json?.ok) return { ok: true, data: json.data as CntExcelPreview };
      const { code, message, ...details } = (json?.error ?? {}) as Record<string, unknown>;
      return {
        ok: false, status: res.status,
        code: String(code ?? "E-API-UNKNOWN"),
        message: String(message ?? "ورود فایل ناموفق بود"),
        details,
      };
    } catch {
      return { ok: false, status: 0, code: "E-API-NETWORK", message: "اتصال به سرور برقرار نشد" };
    }
  };
}

/** وضعیت پیکربندی PKI (اطلاعات عمومی؛ بدون کلید خصوصی). */
export async function cntIpcPkiStatus(userId: string | null): Promise<ApiResult<CntPkiStatus>> {
  try {
    const res = await fetch("/api/cnt/ipc/pki/status", {
      headers: { accept: "application/json", ...(userId ? { "x-user-id": userId } : {}) },
    });
    const json = await res.json();
    if (json?.ok) return { ok: true, data: json.data as CntPkiStatus };
    const { code, message } = json?.error ?? {};
    return { ok: false, status: res.status, code: String(code ?? "E-API-UNKNOWN"), message: String(message ?? "خطای ناشناخته") };
  } catch {
    return { ok: false, status: 0, code: "E-API-NETWORK", message: "اتصال به سرور برقرار نشد" };
  }
}

/** راستیآزمایی زنجیرهٔ هش و امضاهای دیجیتال یک صورتوضعیت. */
export async function cntIpcVerifySignatures(
  projectId: string, ipcId: string, userId: string | null,
): Promise<ApiResult<CntIpcSignatureVerification>> {
  try {
    const res = await fetch(`/api/cnt/ipc/${e(ipcId)}/signature/verify?projectId=${e(projectId)}`, {
      headers: { accept: "application/json", ...(userId ? { "x-user-id": userId } : {}) },
    });
    const json = await res.json();
    if (json?.ok) return { ok: true, data: json.data as CntIpcSignatureVerification };
    const { code, message } = json?.error ?? {};
    return { ok: false, status: res.status, code: String(code ?? "E-API-UNKNOWN"), message: String(message ?? "خطای ناشناخته") };
  } catch {
    return { ok: false, status: 0, code: "E-API-NETWORK", message: "اتصال به سرور برقرار نشد" };
  }
}
