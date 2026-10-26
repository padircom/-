/* فاز ۵ ADR-CNT-IPC-UNIFY — موتور خالص امضای دیجیتال X.509.
 *
 * گواهیها اینجا **واقعی**اند: یک CA و یک leaf با openssl ساخته میشوند،
 * سپس امضا و زنجیرهٔ اعتماد راستیآزمایی میگردد. هیچ گواهی خودامضای
 * ساختگی به نام PKI پذیرفته نمیشود، مگر با پرچم صریح توسعه.
 */
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import {
  IPC_SIGNATURE_METHOD,
  IPC_PKI_SIGNATURE_METHOD,
  IPC_PKI_VERSION,
  ipcStepCanonical,
  ipcPkiCanonical,
  ipcPkiAttestationFa,
  verifyIpcPkiSignatures,
  verifyIpcSnapshotChain,
  computeIpc,
  ipcDocumentCanonical,
} from "./cntLogic.js";
import { loadPkiSigner, verifyPkiSignature, pkiStatus, certSha256 } from "./cntPki.js";

const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
let dir;
let CA_PEM, LEAF_PEM, KEY_PEM, OTHER_CA_PEM;
let EXPIRED_LEAF_PEM, EXPIRED_KEY_PEM;

/* گواهیها «الآن» ساخته میشوند؛ پس زمان امضای fixture هم بعد از ساخت
 * تنظیم میگردد تا تست وابسته به ترتیب اجرا/ساعت نشود. */
let SIGN_AT = "2026-10-26T10:00:00.000Z";
const step = {
  documentSha256: "a".repeat(64), prevHash: null, stepNo: 1,
  actor: "employer", actorUserId: "u-client", action: "approve",
  actedAt: SIGN_AT, commentFa: null,
};

before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "cnt-pki-unit-"));
  const openssl = (args) => execFileSync("openssl", args, { cwd: dir, stdio: ["ignore", "pipe", "pipe"] });
  /* CA ریشه */
  openssl(["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", "ca.key", "-out", "ca.pem",
    "-days", "3650", "-subj", "/CN=Arena PMIS Test Root CA/O=Arena/C=IR",
    "-addext", "basicConstraints=critical,CA:TRUE", "-addext", "keyUsage=critical,keyCertSign,cRLSign"]);
  /* گواهی نهایی (leaf) — فقط digitalSignature */
  openssl(["req", "-newkey", "rsa:2048", "-nodes", "-keyout", "leaf.key", "-out", "leaf.csr",
    "-subj", "/CN=Arena CNT IPC Signer/O=Arena/C=IR"]);
  await writeFile(path.join(dir, "leaf.ext"), "basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature\nextendedKeyUsage=emailProtection\n");
  openssl(["x509", "-req", "-in", "leaf.csr", "-CA", "ca.pem", "-CAkey", "ca.key",
    "-CAcreateserial", "-out", "leaf.pem", "-days", "1825", "-extfile", "leaf.ext"]);
  /* CA دوم برای تست زنجیرهٔ نادرست */
  openssl(["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", "other.key", "-out", "other.pem",
    "-days", "3650", "-subj", "/CN=Unrelated Test CA", "-addext", "basicConstraints=critical,CA:TRUE"]);
  /* گواهی منقضی: -days 0 روی برخی نسخهها کار نمیکند، پس با startdate/enddate
   * صریح ساخته میشود (openssl x509 از 3.0 این گزینهها را دارد). */
  openssl(["req", "-newkey", "rsa:2048", "-nodes", "-keyout", "expired.key", "-out", "expired.csr",
    "-subj", "/CN=Expired Signer"]);
  let expiredMade = false;
  try {
    openssl(["x509", "-req", "-in", "expired.csr", "-CA", "ca.pem", "-CAkey", "ca.key",
      "-CAcreateserial", "-out", "expired.pem", "-extfile", "leaf.ext",
      "-startdate", "20200101000000Z", "-enddate", "20210101000000Z"]);
    expiredMade = true;
  } catch { /* نسخهٔ قدیمی openssl — تست انقضا با now تزریقی سنجیده میشود */ }
  const read = async (f) => (await import("node:fs/promises")).readFile(path.join(dir, f), "utf8");
  CA_PEM = await read("ca.pem");
  LEAF_PEM = await read("leaf.pem");
  KEY_PEM = await read("leaf.key");
  OTHER_CA_PEM = await read("other.pem");
  if (expiredMade) { EXPIRED_LEAF_PEM = await read("expired.pem"); EXPIRED_KEY_PEM = await read("expired.key"); }
  SIGN_AT = freshSignAt();
  step.actedAt = SIGN_AT;
});

after(async () => { if (dir) await rm(dir, { recursive: true, force: true }); });

/* بعد از ساخت گواهیها، یک دقیقه جلوتر از لحظهٔ ساخت = درون بازهٔ اعتبار. */
function freshSignAt() { return new Date(Date.now() + 60_000).toISOString(); }

const env = (extra = {}) => ({
  CNT_IPC_PKI_CERT: LEAF_PEM, CNT_IPC_PKI_KEY: KEY_PEM,
  CNT_IPC_PKI_CA: CA_PEM, CNT_IPC_PKI_KEY_ID: "unit-key-1", ...extra,
});

/* ───────────────────────── پیکربندی صادقانه ───────────────────────── */

test("بدون پیکربندی: ok=false و دلیل فارسی — هیچ امضایی ادعا نمیشود", () => {
  const r = loadPkiSigner({});
  assert.equal(r.configured, false);
  assert.equal(r.ok, false);
  assert.equal(r.signer, null);
  assert.ok(r.issuesFa.some((x) => x.includes("پیکربندی نشده")));
  const st = pkiStatus({});
  assert.equal(st.ok, false);
  assert.equal(st.certificate, null);
  assert.ok(!JSON.stringify(st).includes("PRIVATE KEY"), "کلید خصوصی نباید افشا شود");
});

test("گواهی و کلید نامتناظر پذیرفته نمیشود", () => {
  const other = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey
    .export({ type: "pkcs8", format: "pem" });
  const r = loadPkiSigner(env({ CNT_IPC_PKI_KEY: other }));
  assert.equal(r.ok, false);
  assert.ok(r.issuesFa.some((x) => x.includes("همخوانی ندارد")));
});

test("PEM ناقص با خطای فارسی رد میشود، بدون استثنا", () => {
  const r = loadPkiSigner(env({ CNT_IPC_PKI_CERT: "-----BEGIN CERTIFICATE-----\nbogus\n" }));
  assert.equal(r.ok, false);
  assert.ok(r.issuesFa.some((x) => x.includes("قابل خواندن نیست")));
});

test("نبود CA و نبود اجازهٔ self-signed یعنی رد صریح (نه پذیرش خاموش)", () => {
  const r = loadPkiSigner({ CNT_IPC_PKI_CERT: LEAF_PEM, CNT_IPC_PKI_KEY: KEY_PEM });
  assert.equal(r.ok, false);
  assert.ok(r.issuesFa.some((x) => x.includes("لنگر اعتماد")));
});

test("CA نامرتبط زنجیره را رد میکند", () => {
  const r = loadPkiSigner(env({ CNT_IPC_PKI_CA: OTHER_CA_PEM }));
  assert.equal(r.ok, false);
  assert.ok(r.issuesFa.some((x) => x.includes("صادر نشده")));
});

test("گواهی منقضی حتی با CA درست رد میشود", () => {
  const r = loadPkiSigner(env(), { now: new Date("2040-01-01T00:00:00Z") });
  assert.equal(r.ok, false);
  assert.ok(r.issuesFa.some((x) => x.includes("منقضی")));
});

test("پیکربندی معتبر: ok=true، trustLevel=ca-verified، اطلاعات عمومی کامل", () => {
  const r = loadPkiSigner(env());
  assert.equal(r.ok, true, r.issuesFa.join(" | "));
  assert.equal(r.trustLevel, "ca-verified");
  assert.equal(r.publicInfo.KeyId, "unit-key-1");
  assert.equal(r.publicInfo.CertSha256, certSha256(LEAF_PEM));
  assert.match(r.publicInfo.Algorithm, /SHA256-RSA/);
  assert.ok(r.publicInfo.Subject.includes("CNT IPC Signer"));
  assert.ok(r.publicInfo.ValidTo);
  assert.ok(!JSON.stringify(r.publicInfo).includes("PRIVATE KEY"));
});

test("حالت self-signed فقط با پرچم صریح و با برچسب صادقانه پذیرفته میشود", () => {
  const selfPem = execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes",
    "-keyout", path.join(dir, "self.key"), "-out", path.join(dir, "self.pem"), "-days", "3650",
    "-subj", "/CN=Dev Only Self Signed", "-addext", "basicConstraints=critical,CA:FALSE",
    "-addext", "keyUsage=critical,digitalSignature"], { stdio: "ignore" });
  const selfCert = execFileSync("cat", [path.join(dir, "self.pem")]).toString();
  const selfKey = execFileSync("cat", [path.join(dir, "self.key")]).toString();
  const cfg = { CNT_IPC_PKI_CERT: selfCert, CNT_IPC_PKI_KEY: selfKey };
  assert.equal(loadPkiSigner(cfg).ok, false, "بدون اجازه نباید پذیرفته شود");
  const r = loadPkiSigner({ ...cfg, CNT_IPC_PKI_ALLOW_SELF_SIGNED: "1" });
  assert.equal(r.ok, true, r.issuesFa.join(" | "));
  assert.equal(r.trustLevel, "self-signed");
  assert.notEqual(r.trustLevel, "ca-verified");
});

/* ───────────────────────── امضا و راستیآزمایی ───────────────────────── */

test("امضای X.509 روی canonical راستیآزمایی میشود", () => {
  const r = loadPkiSigner(env());
  const canonical = ipcPkiCanonical({
    ...step, certSha256: r.publicInfo.CertSha256, keyId: r.publicInfo.KeyId,
    algorithm: r.signer.algorithm, signedAt: step.actedAt,
  });
  const sig = r.signer.sign(canonical, new Date(SIGN_AT));
  assert.ok(sig.length > 100);
  const v = verifyPkiSignature(canonical, sig, r.signer.certPem, {
    caPem: CA_PEM, now: new Date(SIGN_AT),
  });
  assert.equal(v.ok, true, v.issuesFa.join(" | "));
  assert.equal(v.trustLevel, "ca-verified");
  assert.equal(v.certSha256, r.publicInfo.CertSha256);
});

test("کوچکترین دستکاری در سند، امضا را میشکند", () => {
  const r = loadPkiSigner(env());
  const canonical = ipcPkiCanonical({
    ...step, certSha256: r.publicInfo.CertSha256, keyId: r.publicInfo.KeyId,
    algorithm: r.signer.algorithm, signedAt: step.actedAt,
  });
  const sig = r.signer.sign(canonical, new Date(SIGN_AT));
  const tampered = canonical.replace("aaaaaaaaaaaa", "bbbbbbbbbbbb");
  assert.notEqual(tampered, canonical, "دستکاری هش سند باید رشتهٔ کانونی را عوض کند");
  const v = verifyPkiSignature(tampered, sig, r.signer.certPem, { caPem: CA_PEM, now: new Date(SIGN_AT) });
  assert.equal(v.ok, false);
  assert.ok(v.issuesFa.some((x) => x.includes("تأیید نشد")));
});

test("امضای جعلی (همه صفر) رد میشود", () => {
  const r = loadPkiSigner(env());
  const canonical = ipcPkiCanonical({
    ...step, certSha256: r.publicInfo.CertSha256, keyId: r.publicInfo.KeyId,
    algorithm: r.signer.algorithm, signedAt: step.actedAt,
  });
  const v = verifyPkiSignature(canonical, Buffer.alloc(256).toString("base64"), r.signer.certPem,
    { caPem: CA_PEM, now: new Date(SIGN_AT) });
  assert.equal(v.ok, false);
});

test("canonical فاز ۵ پایدار و وابسته به method است (گام ۱ تغییر نکرده)", () => {
  const a = ipcPkiCanonical({ ...step, certSha256: "c".repeat(64), keyId: "k", algorithm: "A", signedAt: "t" });
  const b = ipcPkiCanonical({ signedAt: "t", algorithm: "A", keyId: "k", certSha256: "c".repeat(64), ...step });
  assert.equal(a, b);
  assert.ok(a.includes(IPC_PKI_VERSION));
  assert.ok(a.includes(IPC_PKI_SIGNATURE_METHOD));
  /* method گام ۱ همچنان recorded است، ولی canonical گام PKI متفاوت است. */
  const phase1 = ipcStepCanonical(step);
  assert.ok(phase1.includes(IPC_SIGNATURE_METHOD));
  assert.ok(!phase1.includes(IPC_PKI_SIGNATURE_METHOD));
  const phase2 = ipcStepCanonical({ ...step, method: IPC_PKI_SIGNATURE_METHOD });
  assert.notEqual(phase1, phase2);
});

test("متن گواهی امضای دیجیتال صریحاً محدودیتها را میگوید", () => {
  const s = ipcPkiAttestationFa({
    actorFa: "کارفرما", actionFa: "تصویب", signedAt: "2026-10-26",
    snapshotSha256: "b".repeat(64), certSubject: "CN=Signer", certSha256: "c".repeat(64),
  });
  assert.ok(s.includes("امضای دیجیتال"));
  assert.ok(s.includes("X.509"));
  assert.ok(s.includes("OCSP"), "نبود بررسی ابطال باید اعلام شود");
  assert.ok(s.includes("bbbbbbbbbbbbbbbb"));
});

test("راستیآزمایی زنجیرهٔ امضاشده: گامهای فاز ۴ نادیده و گامهای PKI سنجیده میشوند", () => {
  const r = loadPkiSigner(env());
  const mk = (n, withPki) => {
    const core = { ...step, stepNo: n, prevHash: n === 1 ? null : "d".repeat(64) };
    const method = withPki ? IPC_PKI_SIGNATURE_METHOD : IPC_SIGNATURE_METHOD;
    const canonical = ipcPkiCanonical({ ...core, certSha256: r.publicInfo.CertSha256,
      keyId: r.publicInfo.KeyId, algorithm: r.signer.algorithm, signedAt: core.actedAt });
    const snap = sha(ipcStepCanonical({ ...core, method }));
    /* ردیف **بهمان شکلی** که در IPC_WorkflowStep ذخیره میشود (PascalCase). */
    return {
      StepNo: n, Actor: core.actor, ActorUserId: core.actorUserId, Action: core.action,
      ActedAt: core.actedAt, CommentFa: null, DocumentSha256: core.documentSha256,
      PrevHash: core.prevHash, SnapshotSha256: snap, SignatureMethod: method,
      ...(withPki ? {
        PkiSignature: r.signer.sign(canonical, new Date(SIGN_AT)),
        PkiCertPem: r.signer.certPem, PkiCertSha256: r.publicInfo.CertSha256,
        PkiKeyId: r.publicInfo.KeyId, PkiAlgorithm: r.signer.algorithm,
        PkiSignedAt: core.actedAt,
      } : {}),
    };
  };
  const rows = [mk(1, false), mk(2, true), mk(3, true)];
  const verifyFn = (canonical, s) => verifyPkiSignature(canonical, s.PkiSignature, s.PkiCertPem,
    { caPem: CA_PEM, now: new Date(s.PkiSignedAt) });
  const v = verifyIpcPkiSignatures(rows, verifyFn);
  assert.equal(v.ok, true, v.issuesFa.join(" | "));
  assert.equal(v.checked, 2, "گام بدون PkiSignature نباید شمرده شود");
  assert.equal(v.steps.length, 2);

  const tampered = rows.map((x) => x.StepNo === 3 ? { ...x, Actor: "contractor" } : x);
  const bad = verifyIpcPkiSignatures(tampered, verifyFn);
  assert.equal(bad.ok, false);
  assert.ok(bad.issuesFa.length >= 1);
});

test("زنجیرهٔ هش گامهای PKI با method درست راستیآزمایی میشود", () => {
  let prev = null;
  const rows = [1, 2, 3].map((n) => {
    const doc = sha(ipcDocumentCanonical({ ipc: { NetPayable: 91_000_000 }, lines: [], deductions: [] }));
    const canonical = ipcStepCanonical({ ...step, stepNo: n, documentSha256: doc,
      prevHash: prev, method: IPC_PKI_SIGNATURE_METHOD });
    const snap = sha(canonical);
    const row = { ...step, StepNo: n, DocumentSha256: doc, PrevHash: prev,
      SnapshotSha256: snap, SignatureMethod: IPC_PKI_SIGNATURE_METHOD, ActorUserId: step.actorUserId,
      ActedAt: step.actedAt, Actor: step.actor, Action: step.action };
    prev = snap;
    return row;
  });
  assert.equal(verifyIpcSnapshotChain(rows, sha).ok, true);
  rows[1].SnapshotSha256 = "0".repeat(64);
  assert.equal(verifyIpcSnapshotChain(rows, sha).ok, false);
});

/* ───────────────────────── اعداد طلایی ───────────────────────── */

test("عدد طلایی D4 دستنخورده ماند: ۱۰۰٬۰۰۰٬۰۰۰ ← ۹۱٬۰۰۰٬۰۰۰", () => {
  const r = computeIpc({
    lines: [{ BoqItemId: "b1", PricingBasis: "unit_price", UnitRate: 1_000_000,
      prevQty: 0, cumQty: 100, QualityGateStatus: "passed" }],
    deductions: { insurancePct: 5, taxPct: 4 },
  });
  assert.equal(r.subtotal, 100_000_000);
  assert.equal(r.netPayable, 91_000_000);
});

test("عدد طلایی CNT-1 دستنخورده ماند: ۱۶٬۰۰۰ ← ۱۳٬۶۸۰", async () => {
  const { computeTemplateIpc, normalizeIpcTemplate, normalizeIpcInputs } = await import("./cntIpcLogic.js");
  const template = normalizeIpcTemplate({
    Code: "TPLX", TitleFa: "قالب آزمون نگاشت", ContractCode: "CON1",
    Items: [
      { Code: "R01", TitleFa: "ردیف اندازهگیری‌شده", Unit: "m3", Basis: "measured", Sign: "+" },
      { Code: "R02", TitleFa: "ردیف مقطوع", Unit: "ls", Basis: "lump", Sign: "+" },
      { Code: "R03", TitleFa: "سهم تجهیزات", Unit: "%", Basis: "percent", PercentOf: "R02", Sign: "+" },
    ],
    Deductions: [
      { Code: "D01", TitleFa: "حسن انجام کار", Kind: "retention", Mode: "percent", Rate: 5, Base: "gross" },
      { Code: "D02", TitleFa: "بازیافت پیشپرداخت", Kind: "advance", Mode: "percent", Rate: 10, Base: "running" },
    ],
    NoteFa: null,
  });
  const inputs = normalizeIpcInputs([
    { ItemCode: "R01", Quantity: 10, UnitRate: 1000 },
    { ItemCode: "R02", Amount: 5000 },
    { ItemCode: "R03", Percent: 20 },
  ]);
  const c = computeTemplateIpc(template, inputs);
  assert.equal(c.grossAmount, 16_000);
  assert.equal(c.netAmount, 13_680);
});
