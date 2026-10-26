/**
 * CNT — گام دوم امضا (فاز ۵ ADR-CNT-IPC-UNIFY): امضای دیجیتال X.509
 * ---------------------------------------------------------------------------
 * این ماژول **هیچ گواهیهای نمیسازد**. فقط کلید خصوصی و گواهیای را که
 * سازمان از پیش پیکربندی کرده میخواند، اعتبارشان را میسنجد و هش کانونی
 * سند را امضا/راستیآزمایی میکند. اگر پیکربندی ناقص/منقضی/بیکیفرمان باشد،
 * `ok:false` و دلیل فارسی برمیگرداند تا سرور صادقانه بگوید PKI اعمال نشد.
 *
 * پیکربندی (همه از متغیر محیط؛ مقدار میتواند خودِ PEM یا مسیر فایل باشد):
 *   CNT_IPC_PKI_CERT              گواهی امضا (leaf) — الزامی
 *   CNT_IPC_PKI_KEY               کلید خصوصی متناظر — الزامی
 *   CNT_IPC_PKI_KEY_PASSPHRASE    گذرواژهٔ کلید (اختیاری)
 *   CNT_IPC_PKI_CA                گواهی مرجع صادرکننده/لنگر اعتماد (CA)
 *   CNT_IPC_PKI_KEY_ID            شناسهٔ دلخواه کلید (پیشفرض: اثرانگشت کوتاه)
 *   CNT_IPC_PKI_ALLOW_SELF_SIGNED اجازهٔ گواهی خودامضا **فقط** با =1 صریح
 *   CNT_IPC_PKI_REQUIRED          =1 یعنی نبود امضا، اقدام گردش را متوقف کند
 *
 * چرا CA الزامی است: گواهی خودامضای ساختگی که سرور خودش بسازد، «امضای
 * دیجیتال» هست ولی **زنجیرهٔ اعتماد** نیست؛ تحویل آن به نام PKI دروغ است.
 * حالت self-signed فقط برای محیط توسعه و با پرچم صریح، و با `trustLevel`
 * مشخص («self-signed») گزارش میشود تا با «ca-verified» اشتباه نشود.
 */
import crypto from "node:crypto";
import fs from "node:fs";

const ENV_KEYS = [
  "CNT_IPC_PKI_CERT", "CNT_IPC_PKI_KEY", "CNT_IPC_PKI_KEY_PASSPHRASE",
  "CNT_IPC_PKI_CA", "CNT_IPC_PKI_KEY_ID", "CNT_IPC_PKI_ALLOW_SELF_SIGNED",
  "CNT_IPC_PKI_REQUIRED",
];

/** مقدار env: یا خود PEM (با `\\n` فرار داده شده) یا مسیر فایل قابلخواندن. */
function readPem(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (s.includes("-----BEGIN")) return s.replace(/\\n/g, "\n") + "\n";
  try { return fs.readFileSync(s, "utf8"); } catch { return null; }
}

function certOf(pem, issuesFa, label) {
  if (!pem) { issuesFa.push(`${label}: مقدار گواهی یافت نشد (PEM یا مسیر فایل بدهید)`); return null; }
  try { return new crypto.X509Certificate(pem); }
  catch (e) { issuesFa.push(`${label}: گواهی X.509 قابل خواندن نیست (${String(e?.message ?? e)})`); return null; }
}

/** اثرانگشت SHA-256 از DER گواهی — همان چیزی که در canonical امضا میشود. */
export function certSha256(pemOrCert) {
  const c = typeof pemOrCert === "string" ? new crypto.X509Certificate(pemOrCert) : pemOrCert;
  return crypto.createHash("sha256").update(c.raw).digest("hex");
}

function withinValidity(cert, now, issuesFa, label) {
  const from = cert.validFromDate ? new Date(cert.validFromDate) : new Date(cert.validFrom);
  const to = cert.validToDate ? new Date(cert.validToDate) : new Date(cert.validTo);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())) {
    issuesFa.push(`${label}: بازهٔ اعتبار گواهی قابل خواندن نیست`); return;
  }
  if (now.getTime() < from.getTime()) issuesFa.push(`${label}: گواهی هنوز معتبر نشده (از ${from.toISOString()})`);
  if (now.getTime() > to.getTime()) issuesFa.push(`${label}: گواهی منقضی شده (تا ${to.toISOString()})`);
}

/**
 * `X509Certificate.keyUsage` در Node فقط **OIDهای Extended Key Usage** را
 * میدهد (مثلاً 1.3.6.1.5.5.7.3.4 = emailProtection)؛ Key Usage پایه
 * (digitalSignature) را `undefined` برمیگرداند. پس نمیتوان با نام
 * `digitalSignature` چک کرد — اگر EKU وجود داشت، باید OID مجاز امضای سند
 * یا «هر کاربردی» داشته باشد؛ serverAuth/thread خالص برای امضای سند کافی
 * نیست. نبود EKU یعنی گواهی محدود نشده و قابل قبول است. محدودیت صریحاً
 * اعلام میشود: بررسی بیت digitalSignature پایه توسط Node در دسترس نیست.
 */
const EKU_OID_ACCEPTED = new Set([
  "1.3.6.1.5.5.7.3.4",       /* emailProtection — رایج برای امضای اسناد */
  "1.3.6.1.4.1.311.10.3.12", /* Microsoft document signing */
  "2.5.29.37.0",              /* anyExtendedKeyUsage */
  "2.16.840.1.101.3.4.3.2",  /* id-kp-documentSigning (برخی CAها) */
]);
function checkExtendedKeyUsage(leaf, issuesFa) {
  const ekus = Array.isArray(leaf.keyUsage) ? leaf.keyUsage : [];
  if (!ekus.length) return;
  if (!ekus.some((o) => EKU_OID_ACCEPTED.has(String(o)))) {
    issuesFa.push(`CERT: کاربرد گسترشیافتهٔ گواهی برای امضای سند مجاز نیست (${ekus.join(",")})`);
  }
}

function checkChain(leaf, caPem, now, allowSelfSigned, issuesFa) {
  if (caPem) {
    // A server-managed trust bundle permits explicit overlap during CA rotation.
    // Never trust a CA supplied by a workflow row or detached verification caller.
    const blocks = caPem.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g) ?? [];
    if (blocks.length > 1) {
      for (const pem of blocks) {
        const candidateIssues = [];
        const level = checkChain(leaf, pem, now, false, candidateIssues);
        if (level && candidateIssues.length === 0) return level;
      }
      issuesFa.push("هیچ CA معتبری در بستهٔ اعتماد، صادرکنندهٔ این گواهی نیست");
      return null;
    }
    const ca = certOf(caPem, issuesFa, "CA");
    if (!ca) return null;
    if (ca.ca !== true) issuesFa.push("CA: گواهی مرجع BasicConstraints=CA:TRUE ندارد");
    withinValidity(ca, now, issuesFa, "CA");
    try {
      if (!leaf.checkIssued(ca)) issuesFa.push("گواهی امضا توسط CAی پیکربندیشده صادر نشده است");
      if (!leaf.verify(ca.publicKey)) issuesFa.push("امضای گواهی توسط کلید عمومی CA تأیید نشد");
    } catch (e) { issuesFa.push(`بررسی زنجیرهٔ اعتماد ناموفق بود (${String(e?.message ?? e)})`); }
    return "ca-verified";
  }
  if (allowSelfSigned) {
    /* `checkIssued` روی گواهی self-signed با BasicConstraints=CA:FALSE
     * false میدهد (چون صادرکننده CA نیست). معیار درست برای خودامضا،
     * برابری subject/issuer و درستی امضای درونی با کلید خود گواهی است. */
    try {
      if (String(leaf.subject) !== String(leaf.issuer) || !leaf.verify(leaf.publicKey)) {
        issuesFa.push("گواهی خودامضا امضای درونی معتبری ندارد");
      }
    } catch (e) { issuesFa.push(`بررسی گواهی خودامضا ناموفق بود (${String(e?.message ?? e)})`); }
    return "self-signed";
  }
  issuesFa.push("لنگر اعتماد (CNT_IPC_PKI_CA) پیکربندی نشده؛ برای توسعه فقط با CNT_IPC_PKI_ALLOW_SELF_SIGNED=1 میتوان گواهی خودامضا پذیرفت");
  return null;
}

/** الگوریتم امضا بر اساس نوع کلید — verify دقیقاً همان را بهکار میبرد. */
function signerFor(key) {
  const type = String(key?.asymmetricKeyType ?? "");
  if (type === "ed25519" || type === "ed448") {
    return {
      name: type.toUpperCase(),
      sign: (data) => crypto.sign(null, data, key),
      verify: (data, pub, sig) => crypto.verify(null, data, pub, sig),
    };
  }
  if (type === "rsa" || type === "rsa-pss" || type === "ec") {
    return {
      name: `SHA256-${type.toUpperCase()}`,
      sign: (data) => crypto.sign("sha256", data, key),
      verify: (data, pub, sig) => crypto.verify("sha256", data, pub, sig),
    };
  }
  return null;
}

/**
 * خواندن و اعتبارسنجی پیکربندی. هیچ استثنایی بیرون نمیدهد؛ نتیجه همیشه
 * آبژهای است با `ok` و `issuesFa`. `now` تزریقپذیر است تا آزمون انقضا
 * وابسته به ساعت واقعی نباشد.
 */
export function loadPkiSigner(env = process.env, { now = new Date() } = {}) {
  const cfg = Object.fromEntries(ENV_KEYS.map((k) => [k, env[k]]));
  const configured = !!(cfg.CNT_IPC_PKI_CERT || cfg.CNT_IPC_PKI_KEY || cfg.CNT_IPC_PKI_CA || cfg.CNT_IPC_PKI_KEY_ID);
  const required = String(cfg.CNT_IPC_PKI_REQUIRED ?? "0") === "1";
  const base = { configured, required, ok: false, issuesFa: [], trustLevel: null, signer: null, publicInfo: null };
  if (!configured) {
    base.issuesFa.push("گواهی دیجیتال پیکربندی نشده است؛ فقط تأیید ثبتشده (گام ۱) اعمال میشود");
    return base;
  }
  const issuesFa = [];
  const leafPem = readPem(cfg.CNT_IPC_PKI_CERT);
  const keyPem = readPem(cfg.CNT_IPC_PKI_KEY);
  const caPem = readPem(cfg.CNT_IPC_PKI_CA);
  const leaf = certOf(leafPem, issuesFa, "CERT");
  if (!keyPem) issuesFa.push("KEY: کلید خصوصی یافت نشد (PEM یا مسیر فایل بدهید)");
  if (!leaf) { base.issuesFa = issuesFa; return base; }

  let key = null;
  if (keyPem) {
    try {
      key = crypto.createPrivateKey({
        key: keyPem,
        ...(cfg.CNT_IPC_PKI_KEY_PASSPHRASE ? { passphrase: String(cfg.CNT_IPC_PKI_KEY_PASSPHRASE) } : {}),
      });
    } catch (e) { issuesFa.push(`KEY: کلید خصوصی قابل خواندن نیست (${String(e?.message ?? e)})`); }
  }
  if (key) {
    try { if (!leaf.checkPrivateKey(key)) issuesFa.push("KEY: کلید خصوصی با کلید عمومی گواهی همخوانی ندارد"); }
    catch (e) { issuesFa.push(`KEY: بررسی تناظر کلید ناموفق بود (${String(e?.message ?? e)})`); }
  }

  withinValidity(leaf, now, issuesFa, "CERT");
  checkExtendedKeyUsage(leaf, issuesFa);
  if (leaf.ca === true) issuesFa.push("CERT: از گواهی CA برای امضای سند استفاده نشود؛ گواهی نهایی (leaf) بدهید");

  const trustLevel = checkChain(leaf, caPem, now, String(cfg.CNT_IPC_PKI_ALLOW_SELF_SIGNED ?? "0") === "1", issuesFa);
  const algo = key ? signerFor(key) : null;
  if (key && !algo) issuesFa.push(`KEY: نوع کلید (${key.asymmetricKeyType}) پشتیبانی نمیشود`);

  const fingerprint = certSha256(leaf);
  const publicInfo = {
    KeyId: String(cfg.CNT_IPC_PKI_KEY_ID || fingerprint.slice(0, 16)),
    Subject: String(leaf.subject ?? "").replace(/\n/g, " · "),
    Issuer: String(leaf.issuer ?? "").replace(/\n/g, " · "),
    Serial: String(leaf.serialNumber ?? ""),
    CertSha256: fingerprint,
    ValidFrom: leaf.validFromDate ? new Date(leaf.validFromDate).toISOString() : String(leaf.validFrom),
    ValidTo: leaf.validToDate ? new Date(leaf.validToDate).toISOString() : String(leaf.validTo),
    TrustLevel: trustLevel,
    Algorithm: algo?.name ?? null,
  };

  base.issuesFa = issuesFa;
  base.trustLevel = trustLevel;
  base.publicInfo = publicInfo;
  if (issuesFa.length || !algo || !key) return base;

  base.ok = true;
  base.signer = {
    info: publicInfo,
    certPem: leafPem,
    algorithm: algo.name,
    /** امضای رشتهٔ کانونی؛ خروجی base64. اعتبار گواهی دوباره در لحظه چک میشود. */
    sign(canonical, at = new Date()) {
      const fresh = [];
      withinValidity(leaf, at, fresh, "CERT");
      if (fresh.length) throw new Error(fresh.join("؛ "));
      return algo.sign(Buffer.from(canonical, "utf8")).toString("base64");
    },
  };
  return base;
}

/**
 * راستیآزمایی یک امضای ذخیرهشده. گواهی از **رکورد گام** میآید (نه از
 * پیکربندی فعلی) تا چرخش کلید، امضاهای قدیمی را باطل نکند. CA همچنان
 * از پیکربندی/پارامتر میآید تا لنگر اعتماد قابل کنترل باشد.
 */
export function verifyPkiSignature(canonical, signatureB64, certPem, { caPem = null, allowSelfSigned = false, now = null } = {}) {
  const issuesFa = [];
  if (!signatureB64) return { ok: false, issuesFa: ["امضای دیجیتال روی گام ثبت نشده است"] };
  if (!certPem) return { ok: false, issuesFa: ["گواهی امضا روی گام ثبت نشده است"] };
  const leaf = certOf(certPem, issuesFa, "CERT");
  if (!leaf) return { ok: false, issuesFa };
  /* زمان راستیآزمایی پیشفرض «الآن» است؛ برای گواهی منقضیشدهٔ قدیمی،
   * مصرفکننده میتواند زمان امضا بدهد تا فقط انقضای پس از امضا سنجیده شود. */
  withinValidity(leaf, now ?? new Date(), issuesFa, "CERT");
  const trustLevel = checkChain(leaf, readPem(caPem), now ?? new Date(), allowSelfSigned, issuesFa);
  if (!trustLevel) return { ok: false, issuesFa, trustLevel: null };
  let sig;
  try { sig = Buffer.from(String(signatureB64), "base64"); }
  catch { return { ok: false, issuesFa: [...issuesFa, "امضا base64 معتبر نیست"], trustLevel }; }
  if (!sig.length) return { ok: false, issuesFa: [...issuesFa, "امضا تهی است"], trustLevel };
  const algo = signerFor(leaf.publicKey);
  if (!algo) return { ok: false, issuesFa: [...issuesFa, "الگوریتم گواهی پشتیبانی نمیشود"], trustLevel };
  let verified = false;
  try { verified = algo.verify(Buffer.from(canonical, "utf8"), leaf.publicKey, sig); }
  catch (e) { issuesFa.push(`راستیآزمایی رمزنگاری ناموفق بود (${String(e?.message ?? e)})`); }
  if (!verified) issuesFa.push("امضا با کلید عمومی گواهی تأیید نشد؛ سند یا تاریخچه دستکاری شده است");
  return { ok: issuesFa.length === 0, issuesFa, trustLevel, certSha256: certSha256(leaf) };
}

/** وضعیت قابل افشا (بدون کلید خصوصی) — برای API وضعیت و UI. */
export function pkiStatus(env = process.env, opts = {}) {
  const r = loadPkiSigner(env, opts);
  return {
    configured: r.configured,
    ok: r.ok,
    required: r.required,
    trustLevel: r.trustLevel,
    issuesFa: r.issuesFa,
    certificate: r.publicInfo,
  };
}
