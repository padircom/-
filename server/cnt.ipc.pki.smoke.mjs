/* دودتست زندهٔ فاز ۵ — c1-p1 (دامنهٔ واقعی RBAC).
 * اجرا: node server/cnt.ipc.pki.smoke.mjs
 * سرور جداگانه با DATA_DIR موقت و گواهی واقعی ساختهشده با openssl.
 */
import { spawn, execFileSync } from "node:child_process";
import { mkdtemp, rm, writeFile, readFile, cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const PORT = 4811;
const BASE = `http://localhost:${PORT}`;
const P = "c1-p1";
const U = { contracts: "u-contracts", consultant: "u-consultant", client: "u-client", pm: "u-pm", site: "u-site" };
const LETTERHEAD = [
  "projectName=پروژهٔ آزمون", "projectCode=PRJ", "consultantName=مشاور",
  "contractorLogo=آلفا", "clientLogo=گاما", "consultantLogo=بتا",
  "distribution=کارفرما,مشاور", "preparedBy=u-contracts", "approvedBy=u-client",
].join("&");
let child, certDir, dataDir;

async function call(method, p, body, user, binary = false) {
  const res = await fetch(`${BASE}${p}`, {
    method,
    headers: { "content-type": "application/json", ...(user ? { "x-user-id": user } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (binary) return { status: res.status, headers: res.headers, buf: Buffer.from(await res.arrayBuffer()), ct: res.headers.get("content-type") };
  const text = await res.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text, headers: res.headers };
}
const post = (p, b, u) => call("POST", p, b, u);
const get = (p, u) => call("GET", p, undefined, u);
const tag = () => `S${Date.now().toString(36).slice(-6)}`;

async function boot() {
  certDir = await mkdtemp(path.join(tmpdir(), "cnt-smoke-certs-"));
  const ossl = (a) => execFileSync("openssl", a, { cwd: certDir, stdio: "ignore" });
  ossl(["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", "ca.key", "-out", "ca.pem",
    "-days", "3650", "-subj", "/CN=Arena Smoke Root CA", "-addext", "basicConstraints=critical,CA:TRUE"]);
  ossl(["req", "-newkey", "rsa:2048", "-nodes", "-keyout", "leaf.key", "-out", "leaf.csr",
    "-subj", "/CN=Arena Smoke IPC Signer"]);
  await writeFile(path.join(certDir, "leaf.ext"),
    "basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature\nextendedKeyUsage=emailProtection\n");
  ossl(["x509", "-req", "-in", "leaf.csr", "-CA", "ca.pem", "-CAkey", "ca.key",
    "-CAcreateserial", "-out", "leaf.pem", "-days", "1825", "-extfile", "leaf.ext"]);
  const [ca, leaf, key] = await Promise.all(["ca.pem", "leaf.pem", "leaf.key"].map((f) => readFile(path.join(certDir, f), "utf8")));
  dataDir = await mkdtemp(path.join(tmpdir(), "cnt-smoke-data-"));
  await cp("server/data", dataDir, { recursive: true }).catch(() => {});
  child = spawn(process.execPath, ["server/index.js"], {
    env: {
      ...process.env, PORT: String(PORT), PERSIST_DRIVER: "json", DATA_DIR: dataDir,
      CNT_IPC_PKI_CERT: leaf, CNT_IPC_PKI_KEY: key, CNT_IPC_PKI_CA: ca,
      CNT_IPC_PKI_KEY_ID: "smoke-signer",
    }, stdio: "ignore",
  });
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`${BASE}/api/cnt/status`, { signal: AbortSignal.timeout(1000) })).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("سرور دودتست بالا نیامد");
}

const check = (cond, label, extra = "") => {
  console.log(`${cond ? "✅" : "❌"} ${label}${extra ? ` — ${extra}` : ""}`);
  if (!cond) process.exitCode = 1;
};

try {
  await boot();
  const c = await post(`/api/cnt/contracts?projectId=${P}`, {
    code: `SM-${tag()}`, titleFa: "پیمان دودتست فاز ۵", contractType: "unit_price",
    employerName: "کارفرما", contractorName: "پیمانکار", consultantName: "مشاور",
    initialAmount: 1_000_000_000, signDate: "2026-01-01", startDate: "2026-01-05", durationDays: 360,
  }, U.contracts);
  check(c.status === 201, "ساخت پیمان", `status ${c.status}`);
  const contractId = c.json?.data?.item?.Id;
  const boq = await post(`/api/cnt/boq?projectId=${P}`, {
    contractId, itemNo: `01${Math.floor(Math.random() * 9000 + 1000)}`, titleFa: "بتنریزی",
    pricingBasis: "unit_price", unit: "مترمکعب", contractQty: 1000, unitRate: 500_000,
  }, U.contracts);
  check(boq.status === 201, "ساخت ردیف فهرستبها", `status ${boq.status}`);
  const ipc = await post(`/api/cnt/ipc?projectId=${P}`, {
    contractId, periodCode: `W-${tag()}`, periodFrom: "2026-07-01", periodTo: "2026-07-31",
    lines: [{ boqItemId: boq.json.data.item.Id, cumQty: 100 }],
    deductions: { insurancePct: 5, retainagePct: 10 },
  }, U.contracts);
  check(ipc.status === 201, "ساخت صورتوضعیت", `status ${ipc.status}`);
  const id = ipc.json.data.id;

  for (const [action, user] of [["submit", U.contracts], ["approve", U.consultant], ["approve", U.client]]) {
    const r = await post(`/api/cnt/ipc/${id}/action?projectId=${P}`, { action }, user);
    check(r.status === 200 && r.json?.data?.signature?.pkiApplied === true,
      `گردش «${action}» با امضای دیجیتال`, `method=${r.json?.data?.signature?.method}`);
  }

  const v = await get(`/api/cnt/ipc/${id}/signature/verify?projectId=${P}`, U.pm);
  check(v.json?.data?.ok === true && v.json?.data?.pki?.checked === 3,
    "راستیآزمایی زنجیره و امضاها", `chain=${v.json?.data?.chain?.ok} pki=${v.json?.data?.pki?.ok}`);

  const st = await get(`/api/cnt/ipc/pki/status`, U.pm);
  check(st.json?.data?.ok === true && st.json?.data?.trustLevel === "ca-verified",
    "وضعیت PKI", `trust=${st.json?.data?.trustLevel}`);

  const j = await get(`/api/cnt/ipc/${id}/pdf?projectId=${P}&format=json&${LETTERHEAD}`, U.pm);
  const titles = (j.json?.data?.report?.sections ?? []).map((s) => s.title.fa);
  check(j.status === 200 && j.json?.data?.pkiApplied === true && titles.some((t) => t.includes("X.509")),
    "PDF رسمی (JSON) با جدول امضای دیجیتال", `${titles.length} بخش`);

  const pdf = await call("GET", `/api/cnt/ipc/${id}/pdf?projectId=${P}&${LETTERHEAD}`, undefined, U.pm, true);
  check(pdf.status === 200 && pdf.buf.subarray(0, 5).toString() === "%PDF-",
    "PDF باینری واقعی", `bytes=${pdf.buf.length} magic=${pdf.buf.subarray(0, 5).toString()}`);

  for (const kind of ["templates", "measurements"]) {
    const q = kind === "measurements" ? `?contractId=${encodeURIComponent(contractId)}` : "";
    const r = await call("GET", `/api/cnt/excel/${P}/${kind}${q}`, undefined, U.pm, true);
    check(r.status === 200 && r.buf.subarray(0, 2).toString() === "PK", `خروجی XLSX ${kind}`, `bytes=${r.buf.length}`);
  }

  const noUser = await get(`/api/cnt/ipc/${id}/signature/verify?projectId=${P}`);
  check(noUser.status === 401, "گیت هویت ۴۰۱", `status ${noUser.status}`);
  const forbidden = await get(`/api/cnt/ipc/${id}/pdf?projectId=${P}&format=json&${LETTERHEAD}`, U.contracts);
  check(forbidden.status === 403, "گیت مجوز PDF ۴۰۳", `status ${forbidden.status}`);
} catch (e) {
  console.error("❌ خطای دودتست:", e);
  process.exitCode = 1;
} finally {
  if (child) child.kill("SIGTERM");
  if (certDir) await rm(certDir, { recursive: true, force: true });
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
}
