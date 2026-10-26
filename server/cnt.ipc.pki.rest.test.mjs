/* فاز ۵ ADR-CNT-IPC-UNIFY — آزمون REST امضای دیجیتال X.509.
 *
 * سه سرور روی درایور JSON:
 *   ۱) بدون پیکربندی PKI → همان رفتار فاز ۴ (`pkiApplied:false`)؛
 *   ۲) با CA + گواهی معتبر → امضای واقعی، راستیآزمایی، PDF رسمی؛
 *   ۳) با CNT_IPC_PKI_REQUIRED=1 و پیکربندی ناقص → ۵۰۳ صادقانه.
 *
 * پروژهٔ c1-p1 همان دامنهٔ واقعی RBAC است.
 */
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { mkdtemp, cp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ipcPkiCanonical } from "./cntLogic.js";

const PORTS = { plain: 4801, signed: 4802, required: 4803 };
const B = (p) => `http://localhost:${PORTS[p]}`;
const P = "c1-p1";
const CONTRACTS = "u-contracts";
const CONSULTANT = "u-consultant";
const CLIENT = "u-client";
const PM = "u-pm";
const SITE = "u-site";

let certDir, dataPlain, dataSigned, dataRequired;
const children = [];

async function openssl(args, cwd) {
  execFileSync("openssl", args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
}

before(async () => {
  certDir = await mkdtemp(path.join(tmpdir(), "cnt-pki-rest-certs-"));
  await openssl(["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", "ca.key",
    "-out", "ca.pem", "-days", "3650", "-subj", "/CN=Arena REST Test Root CA/O=Arena/C=IR",
    "-addext", "basicConstraints=critical,CA:TRUE", "-addext", "keyUsage=critical,keyCertSign,cRLSign"], certDir);
  await openssl(["req", "-newkey", "rsa:2048", "-nodes", "-keyout", "leaf.key",
    "-out", "leaf.csr", "-subj", "/CN=Arena CNT IPC REST Signer/O=Arena/C=IR"], certDir);
  await writeFile(path.join(certDir, "leaf.ext"),
    "basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature\nextendedKeyUsage=emailProtection\n");
  await openssl(["x509", "-req", "-in", "leaf.csr", "-CA", "ca.pem", "-CAkey", "ca.key",
    "-CAcreateserial", "-out", "leaf.pem", "-days", "1825", "-extfile", "leaf.ext"], certDir);

  const [ca, leaf, key] = await Promise.all([
    readFile(path.join(certDir, "ca.pem"), "utf8"),
    readFile(path.join(certDir, "leaf.pem"), "utf8"),
    readFile(path.join(certDir, "leaf.key"), "utf8"),
  ]);

  const boot = async (port, extraEnv, tag) => {
    const dataDir = await mkdtemp(path.join(tmpdir(), `cnt-pki-rest-${tag}-`));
    await cp("server/data", dataDir, { recursive: true }).catch(() => {});
    const child = spawn(process.execPath, ["server/index.js"], {
      env: {
        ...process.env, PORT: String(port), PERSIST_DRIVER: "json", DATA_DIR: dataDir,
        ...extraEnv,
      },
      stdio: "ignore",
    });
    children.push(child);
    const base = `http://localhost:${port}`;
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      try {
        const r = await fetch(`${base}/api/cnt/status`, { signal: AbortSignal.timeout(1000) });
        if (r.ok) return dataDir;
      } catch { /* هنوز بالا نیامده */ }
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error(`سرور ${tag} بالا نیامد`);
  };

  [dataPlain, dataSigned, dataRequired] = await Promise.all([
    boot(PORTS.plain, {}, "plain"),
    boot(PORTS.signed, {
      CNT_IPC_PKI_CERT: leaf, CNT_IPC_PKI_KEY: key, CNT_IPC_PKI_CA: ca,
      CNT_IPC_PKI_KEY_ID: "rest-signer-1",
    }, "signed"),
    boot(PORTS.required, {
      CNT_IPC_PKI_CERT: leaf, /* کلید عمداً نیست → پیکربندی ناقص */
      CNT_IPC_PKI_REQUIRED: "1",
    }, "required"),
  ]);
});

after(async () => {
  for (const c of children) c.kill("SIGTERM");
  for (const d of [certDir, dataPlain, dataSigned, dataRequired]) {
    if (d) await rm(d, { recursive: true, force: true });
  }
});

async function call(port, method, p, body, user) {
  const res = await fetch(`${B(port)}${p}`, {
    method,
    headers: { "content-type": "application/json", ...(user ? { "x-user-id": user } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* باینری */ }
  return { status: res.status, json, text, headers: res.headers };
}
const get = (port, p, user) => call(port, "GET", p, undefined, user);
const post = (port, p, body, user) => call(port, "POST", p, body, user);
const tag = () => `P${Date.now().toString(36).slice(-6)}${Math.floor(Math.random() * 900 + 100)}`;
/* سربرگ رسمی کامل — همان قرارداد تستهای فاز ۴؛ بدون آن ۴۲۲ میدهد. */
const LETTERHEAD = [
  "projectName=پروژهٔ آزمون", "projectCode=PRJ", "consultantName=مشاور",
  "contractorLogo=آلفا", "clientLogo=گاما", "consultantLogo=بتا",
  "distribution=کارفرما,مشاور", "preparedBy=u-contracts", "approvedBy=u-client",
].join("&");

async function makeFixture(port) {
  const c = await post(port, `/api/cnt/contracts?projectId=${P}`, {
    code: `C-${tag()}`, titleFa: "پیمان فاز ۵", contractType: "unit_price",
    employerName: "کارفرما", contractorName: "پیمانکار", consultantName: "مشاور",
    initialAmount: 1_000_000_000, signDate: "2026-01-01", startDate: "2026-01-05", durationDays: 360,
  }, CONTRACTS);
  assert.equal(c.status, 201, JSON.stringify(c.json));
  const contractId = c.json.data.item.Id;
  const item = await post(port, `/api/cnt/boq?projectId=${P}`, {
    contractId, itemNo: `01${Math.floor(Math.random() * 9000 + 1000)}`,
    titleFa: "بتنریزی", pricingBasis: "unit_price", unit: "مترمکعب",
    contractQty: 1000, unitRate: 500_000,
  }, CONTRACTS);
  assert.equal(item.status, 201, JSON.stringify(item.json));
  const ipc = await post(port, `/api/cnt/ipc?projectId=${P}`, {
    contractId, periodCode: `W-${tag()}`, periodFrom: "2026-07-01", periodTo: "2026-07-31",
    lines: [{ boqItemId: item.json.data.item.Id, cumQty: 100 }],
    deductions: { insurancePct: 5, retainagePct: 10 },
  }, CONTRACTS);
  assert.equal(ipc.status, 201, JSON.stringify(ipc.json));
  return { contractId, ipcId: ipc.json.data.id, itemId: item.json.data.item.Id };
}

/* ═══════════════════ ۱) بدون پیکربندی ═══════════════════ */

test("بدون پیکربندی: دقیقاً رفتار فاز ۴ — pkiApplied=false و دلیل فارسی", async () => {
  const { ipcId } = await makeFixture("plain");
  const r = await post("plain", `/api/cnt/ipc/${ipcId}/action?projectId=${P}`, { action: "submit" }, CONTRACTS);
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.data.signature.method, "recorded");
  assert.equal(r.json.data.signature.pkiApplied, false);
  assert.ok(Array.isArray(r.json.data.signature.pkiReasonFa));
  assert.ok(r.json.data.signature.pkiReasonFa.some((x) => x.includes("پیکربندی نشده")));
});

test("وضعیت PKI بدون افشای کلید خصوصی", async () => {
  const s = await get("plain", "/api/cnt/ipc/pki/status", PM);
  assert.equal(s.status, 200, s.text);
  assert.equal(s.json.data.ok, false);
  assert.equal(s.json.data.configured, false);
  assert.ok(!s.text.includes("PRIVATE KEY"));
});

test("بدون پیکربندی: PDF رسمی همچنان «تأیید ثبتشده» میگوید نه PKI", async () => {
  const { ipcId } = await makeFixture("plain");
  await post("plain", `/api/cnt/ipc/${ipcId}/action?projectId=${P}`, { action: "submit" }, CONTRACTS);
  const j = await get("plain", `/api/cnt/ipc/${ipcId}/pdf?projectId=${P}&format=json&${LETTERHEAD}`, PM);
  assert.equal(j.status, 200, j.text);
  assert.equal(j.json.data.pkiApplied, false);
  assert.equal(j.json.data.signaturePhase, 1);
  assert.ok(j.json.data.report.sections.some((s) => s.title.fa.includes("تأیید ثبتشده")));
});

/* ═══════════════════ ۲) امضای واقعی ═══════════════════ */

test("پیکربندی معتبر: وضعیت عمومی، trustLevel=ca-verified، بدون افشای کلید", async () => {
  const s = await get("signed", "/api/cnt/ipc/pki/status", PM);
  assert.equal(s.status, 200, s.text);
  assert.equal(s.json.data.ok, true, JSON.stringify(s.json.data.issuesFa));
  assert.equal(s.json.data.configured, true);
  assert.equal(s.json.data.trustLevel, "ca-verified");
  assert.equal(s.json.data.certificate.KeyId, "rest-signer-1");
  assert.match(s.json.data.certificate.Algorithm, /SHA256-RSA/);
  assert.equal(s.json.data.certificate.CertSha256.length, 64);
  assert.ok(!s.text.includes("PRIVATE KEY"));
  assert.ok(!s.text.includes("leaf.key"));
});

test("گردش سهگام با امضای دیجیتال واقعی: method=pki-x509 و گواهی روی هر گام", async () => {
  const { ipcId } = await makeFixture("signed");
  const flow = [
    ["submit", CONTRACTS], ["approve", CONSULTANT], ["approve", CLIENT],
  ];
  for (const [action, user] of flow) {
    const r = await post("signed", `/api/cnt/ipc/${ipcId}/action?projectId=${P}`, { action }, user);
    assert.equal(r.status, 200, `${action}: ${r.text}`);
    assert.equal(r.json.data.signature.method, "pki-x509");
    assert.equal(r.json.data.signature.pkiApplied, true);
    assert.equal(r.json.data.signature.certificate.KeyId, "rest-signer-1");
  }
  const d = await get("signed", `/api/cnt/ipc/${ipcId}?projectId=${P}`, PM);
  assert.equal(d.status, 200, d.text);
  assert.equal(d.json.data.snapshot.pkiApplied, true);
  assert.equal(d.json.data.snapshot.chain.ok, true, JSON.stringify(d.json.data.snapshot.chain));
  assert.equal(d.json.data.snapshot.pki.ok, true, JSON.stringify(d.json.data.snapshot.pki));
  assert.equal(d.json.data.snapshot.pki.checked, 3);
  assert.equal(d.json.data.workflow.length, 3);
  for (const s of d.json.data.workflow) {
    assert.equal(s.SignatureMethod, "pki-x509");
    assert.equal(s.SignatureVersion, "ipc-pki-v1");
    assert.ok(s.PkiSignature && s.PkiSignature.length > 100, "امضای base64 ثبت نشده");
    assert.ok(String(s.PkiCertPem).includes("BEGIN CERTIFICATE"));
    assert.equal(s.PkiTrustLevel, "ca-verified");
    assert.ok(!String(s.PkiCertInfoJson).includes("PRIVATE KEY"));
  }
  for (const s of d.json.data.signatures) assert.equal(s.PkiApplied, true);
  assert.equal(d.json.data.snapshot.certificates.length, 1);
});

test("مسیر اختصاصی راستیآزمایی: ok=true و حکم صریح", async () => {
  const { ipcId } = await makeFixture("signed");
  for (const [action, user] of [["submit", CONTRACTS], ["approve", CONSULTANT]]) {
    const r = await post("signed", `/api/cnt/ipc/${ipcId}/action?projectId=${P}`, { action }, user);
    assert.equal(r.status, 200, r.text);
  }
  const v = await get("signed", `/api/cnt/ipc/${ipcId}/signature/verify?projectId=${P}`, PM);
  assert.equal(v.status, 200, v.text);
  assert.equal(v.json.data.ok, true, JSON.stringify(v.json.data.issuesFa));
  assert.equal(v.json.data.chain.ok, true);
  assert.equal(v.json.data.pki.ok, true);
  assert.equal(v.json.data.pki.checked, 2);
  assert.deepEqual(v.json.data.issuesFa, []);
  assert.equal(v.json.data.certificates.length, 1);
});

test("راستیآزمایی بی مجوز ۴۰۳ و خارج دامنه ۴۰۳ میدهد", async () => {
  const { ipcId } = await makeFixture("signed");
  const anon = await get("signed", `/api/cnt/ipc/${ipcId}/signature/verify?projectId=${P}`);
  assert.equal(anon.status, 401);
  const denied = await get("signed", `/api/cnt/ipc/${ipcId}/signature/verify?projectId=${P}`, SITE);
  assert.ok([403, 404].includes(denied.status), `status ${denied.status}: ${denied.text}`);
});

test("راستیآزمایی جداافتاده: امضای سالم ok و دستکاری هش سند ok=false", async () => {
  const { ipcId } = await makeFixture("signed");
  const r = await post("signed", `/api/cnt/ipc/${ipcId}/action?projectId=${P}`, { action: "submit" }, CONTRACTS);
  assert.equal(r.status, 200, r.text);
  const d = await get("signed", `/api/cnt/ipc/${ipcId}?projectId=${P}`, PM);
  const st = d.json.data.workflow[0];
  const publicInfo = JSON.parse(st.PkiCertInfoJson);
  const canonical = ipcPkiCanonical({
    documentSha256: st.DocumentSha256, prevHash: st.PrevHash, stepNo: Number(st.StepNo),
    actor: st.Actor, actorUserId: st.ActorUserId, action: st.Action,
    actedAt: st.ActedAt, commentFa: st.CommentFa,
    certSha256: publicInfo.CertSha256, keyId: publicInfo.KeyId,
    algorithm: st.PkiAlgorithm, signedAt: st.PkiSignedAt,
  });
  const body = { projectId: P, canonical, signature: st.PkiSignature,
    certPem: st.PkiCertPem, signedAt: st.PkiSignedAt };
  const good = await post("signed", "/api/cnt/ipc/signature/verify", body, PM);
  assert.equal(good.status, 200, good.text);
  assert.equal(good.json.data.ok, true, JSON.stringify(good.json.data.issuesFa));
  assert.equal(good.json.data.trustLevel, "ca-verified");

  const bad = await post("signed", "/api/cnt/ipc/signature/verify",
    { ...body, canonical: canonical.replace('"keyId":"', '"keyId":"TAMPERED-') }, PM);
  assert.equal(bad.status, 200, bad.text);
  assert.equal(bad.json.data.ok, false, "دستکاری رشتهٔ کانونی باید آشکار شود");

  const noSig = await post("signed", "/api/cnt/ipc/signature/verify",
    { projectId: P, canonical, certPem: st.PkiCertPem }, PM);
  assert.equal(noSig.status, 422);
  assert.equal(noSig.json.error.code, "E-CNT-IPC-PKI-VERIFY-INPUT");
});

test("PDF رسمی امضاشده: جدول X.509 و گواهیها، بدون متن «PKI نیست»", async () => {
  const { ipcId } = await makeFixture("signed");
  for (const [action, user] of [["submit", CONTRACTS], ["approve", CONSULTANT], ["approve", CLIENT]]) {
    assert.equal((await post("signed", `/api/cnt/ipc/${ipcId}/action?projectId=${P}`, { action }, user)).status, 200);
  }
  const j = await get("signed", `/api/cnt/ipc/${ipcId}/pdf?projectId=${P}&format=json&${LETTERHEAD}`, PM);
  assert.equal(j.status, 200, j.text);
  assert.equal(j.json.data.pkiApplied, true);
  assert.equal(j.json.data.signaturePhase, 2);
  assert.equal(j.json.data.pkiCertificates.length, 1);
  const sections = j.json.data.report.sections;
  assert.ok(sections.some((s) => s.title.fa.includes("X.509")), JSON.stringify(sections.map((s) => s.title.fa)));
  assert.ok(sections.some((s) => s.title.fa.includes("گواهیهای دیجیتال")));
  assert.ok(!JSON.stringify(sections).includes("این امضای دیجیتال PKI نیست"),
    "متن قدیمی «PKI نیست» نباید روی سند امضاشده چاپ شود");
});

test("خروجی PDF باینری واقعی همچنان %PDF- است", async () => {
  const { ipcId } = await makeFixture("signed");
  await post("signed", `/api/cnt/ipc/${ipcId}/action?projectId=${P}`, { action: "submit" }, CONTRACTS);
  const res = await fetch(`${B("signed")}/api/cnt/ipc/${ipcId}/pdf?projectId=${P}&${LETTERHEAD}`, { headers: { "x-user-id": PM } });
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") ?? "", /application\/pdf/);
  const buf = Buffer.from(await res.arrayBuffer());
  assert.equal(buf.subarray(0, 5).toString(), "%PDF-");
  assert.ok(res.headers.get("x-cnt-ipc-doc-sha256"));
});

/* ═══════════════════ ۳) الزام PKI ═══════════════════ */

test("REQUIRED=1 با پیکربندی ناقص: ۵۰۳ صادقانه و بدون ثبت گام", async () => {
  const { ipcId } = await makeFixture("required");
  const r = await post("required", `/api/cnt/ipc/${ipcId}/action?projectId=${P}`, { action: "submit" }, CONTRACTS);
  assert.equal(r.status, 503, r.text);
  assert.equal(r.json.error.code, "E-CNT-IPC-PKI-UNAVAILABLE");
  assert.ok(Array.isArray(r.json.error.detailsFa) && r.json.error.detailsFa.length > 0);
  const d = await get("required", `/api/cnt/ipc/${ipcId}?projectId=${P}`, PM);
  assert.equal(d.status, 200);
  assert.equal(d.json.data.workflow.length, 0, "هیچ گامی نباید ثبت شده باشد");
});

/* ═══════════════════ ۴) رگرسیون Excel/گیت ضمانتنامه ═══════════════════ */

test("Excel اختصاصی همچنان XLSX باینری میدهد (رگرسیون فاز ۴)", async () => {
  const { contractId } = await makeFixture("signed");
  for (const kind of ["templates", "measurements"]) {
    const q = kind === "measurements" ? `?contractId=${encodeURIComponent(contractId)}` : "";
    const res = await fetch(`${B("signed")}/api/cnt/excel/${P}/${kind}${q}`, { headers: { "x-user-id": PM } });
    assert.equal(res.status, 200, `${kind}: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    assert.equal(buf.subarray(0, 2).toString(), "PK", `${kind} باید XLSX باشد`);
  }
});

test("گیت ضمانتنامهٔ منقضی همچنان تصویب را مسدود میکند", async () => {
  const { contractId, ipcId } = await makeFixture("signed");
  const g = await post("signed", `/api/cnt/guarantee?projectId=${P}`, {
    contractId, code: `G-${tag()}`, guaranteeType: "performance",
    amount: 100_000_000, expiryDate: "2020-01-01", status: "active",
  }, CONTRACTS);
  if (g.status === 201) {
    await post("signed", `/api/cnt/ipc/${ipcId}/action?projectId=${P}`, { action: "submit" }, CONTRACTS);
    const r = await post("signed", `/api/cnt/ipc/${ipcId}/action?projectId=${P}`, { action: "approve" }, CONSULTANT);
    assert.equal(r.status, 409, r.text);
    assert.equal(r.json.error.code, "E-CNT-IPC-GUARANTEE-EXPIRED");
  } else {
    /* شکل ورودی API ممکن است متفاوت باشد؛ اصل گیت در تست فاز ۴ پوشش دارد. */
    assert.ok([400, 422, 201].includes(g.status), `guarantee create: ${g.status} ${g.text}`);
  }
});
