import { useMemo, useState } from "react";
import { type Lang } from "../data/framework";
import { logAudit } from "../services/auditLogger";
import { useAccess } from "../hooks/useAccess";
import AccessControlPanel from "./AccessControlPanel";
import {
  CLASSIFICATION_LABEL,
  DEFAULT_LOCKOUT,
  DEFAULT_PASSWORD_POLICY,
  DEMO_DELEGATIONS,
  DEMO_SUBJECTS,
  MASK_RULES,
  PERMISSION_CATALOG,
  RBAC_ENGINE_VERSION,
  ROLE_CATALOG,
  SOD_RULES,
  buildAuditRecord,
  checkPassword,
  danglingGrants,
  delegatedPermissions,
  effectivePermissions,
  evaluate,
  hasInheritanceCycle,
  isDelegationActive,
  loginThrottle,
  maskRecord,
  orphanPermissions,
  roleTitle,
  scorePosture,
  sessionPolicyFor,
  sodViolations,
  subjectClearance,
  subjectPermissions,
  validateDelegation,
  type Classification,
  type Delegation,
  type Subject,
} from "../services/accessControl";

const TODAY = "2026-09-08";

type Pane = "posture" | "simulator" | "matrix" | "sod" | "delegation" | "policy" | "users";

const PANES: { key: Pane; label: { fa: string; en: string }; icon: string }[] = [
  { key: "posture", label: { fa: "وضعیت امنیتی", en: "Security posture" }, icon: "🛡" },
  { key: "simulator", label: { fa: "آزمون دسترسی", en: "Access simulator" }, icon: "🎯" },
  { key: "matrix", label: { fa: "ماتریس نقش/مجوز", en: "Role matrix" }, icon: "▦" },
  { key: "sod", label: { fa: "تفکیک وظایف", en: "Segregation of duties" }, icon: "⚖" },
  { key: "delegation", label: { fa: "تفویض اختیار", en: "Delegation" }, icon: "🔁" },
  { key: "policy", label: { fa: "سیاست‌های امنیتی", en: "Security policies" }, icon: "🔐" },
  { key: "users", label: { fa: "کاربران سامانه", en: "System users" }, icon: "👥" },
];

const MODULES = ["core", "d1", "d2", "d3", "d4", "d5", "d6", "d7", "d8", "d10", "d11"];

const SEV_STYLE: Record<string, string> = {
  critical: "bg-rose-400/15 text-rose-300 border-rose-400/30",
  high: "bg-orange-400/15 text-orange-300 border-orange-400/30",
  medium: "bg-amber-400/15 text-amber-200 border-amber-400/30",
  low: "bg-sky-400/15 text-sky-300 border-sky-400/30",
};

const GRADE_COLOR: Record<string, string> = { A: "#2E9E4F", B: "#7FB2FF", C: "#F5A623", D: "#FB923C", E: "#D0021B" };

function Card({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="glass-dark rounded-2xl p-3">
      <div className="mb-2 flex items-center gap-2 border-b b-line-soft pb-1.5">
        <h4 className="text-[10.5px] font-semibold tx1">{title}</h4>
        {right && <div className="ms-auto">{right}</div>}
      </div>
      {children}
    </section>
  );
}

export default function SecurityCenter({ lang }: { lang: Lang }) {
  const rtl = lang === "fa";
  const T = (b: { fa: string; en: string }) => (rtl ? b.fa : b.en);
  const { subject: me } = useAccess();

  const [pane, setPane] = useState<Pane>("posture");

  /* ── وضعیت امنیتی ── */
  const [httpsEnforced, setHttps] = useState(true);
  const [mfaEnabled, setMfa] = useState(false);
  const [sqlEncrypted, setSqlEnc] = useState(false);
  const [retention, setRetention] = useState(180);
  const [backupAge, setBackupAge] = useState<number | null>(3);

  const [delegations, setDelegations] = useState<Delegation[]>(DEMO_DELEGATIONS);

  const posture = useMemo(
    () => scorePosture({ subjects: DEMO_SUBJECTS, delegations, onDate: TODAY, httpsEnforced, mfaEnabled, auditRetentionDays: retention, backupAgeDays: backupAge, sqlEncrypted }),
    [delegations, httpsEnforced, mfaEnabled, retention, backupAge, sqlEncrypted]
  );

  /* ── آزمون دسترسی ── */
  const [simUser, setSimUser] = useState("u-pm");
  const [simPerm, setSimPerm] = useState("fin.ipc.approve");
  const [simProject, setSimProject] = useState("c1-p1");
  const [simDiscipline, setSimDiscipline] = useState("");
  const [simPreparer, setSimPreparer] = useState("u-cost");

  const simSubject = DEMO_SUBJECTS.find((s) => s.id === simUser) as Subject;
  const simDecision = useMemo(
    () =>
      evaluate(simSubject, simPerm, {
        projectId: simProject || null,
        discipline: simDiscipline || null,
        record: simPreparer ? { preparedBy: simPreparer, raisedBy: simPreparer, enteredBy: simPreparer } : undefined,
        delegations,
        onDate: TODAY,
      }),
    [simSubject, simPerm, simProject, simDiscipline, simPreparer, delegations]
  );
  const simAudit = buildAuditRecord(simSubject, simPerm, simDecision, new Date().toISOString(), simProject || null);

  /* ── ماتریس ── */
  const [matrixModule, setMatrixModule] = useState("d5");
  const matrixPerms = PERMISSION_CATALOG.filter((p) => p.module === matrixModule);

  /* ── تفویض ── */
  const [dFrom, setDFrom] = useState("u-pm");
  const [dTo, setDTo] = useState("u-planner");
  const [dPerm, setDPerm] = useState("plan.progress.approve");
  const [dStart, setDStart] = useState("2026-09-10");
  const [dEnd, setDEnd] = useState("2026-09-25");
  const [dReason, setDReason] = useState("مرخصی استحقاقی");

  const draftDelegation: Delegation = { id: "draft", fromUserId: dFrom, toUserId: dTo, permissions: [dPerm], from: dStart, to: dEnd, reason: dReason };
  const granter = DEMO_SUBJECTS.find((s) => s.id === dFrom);
  const dIssues = validateDelegation(draftDelegation, granter ? subjectPermissions(granter) : []);
  const dErrors = dIssues.filter((i) => i.code.startsWith("E-"));

  const addDelegation = () => {
    if (dErrors.length) return;
    const created = { ...draftDelegation, id: `dlg-${Date.now()}` };
    setDelegations((prev) => [created, ...prev]);
    logAudit("RBAC_DELEGATION_CREATE", "Security", `${dFrom} → ${dTo} · ${dPerm} · ${dStart}..${dEnd}`, "security");
  };

  const revoke = (id: string) => {
    setDelegations((prev) => prev.map((d) => (d.id === id ? { ...d, revoked: true } : d)));
    logAudit("RBAC_DELEGATION_REVOKE", "Security", id, "security");
  };

  /* ── سیاست‌ها ── */
  const [pw, setPw] = useState("Arena#2026");
  const pwCheck = checkPassword(pw);
  const [attempts, setAttempts] = useState(3);
  const lock = loginThrottle(attempts, 5);

  const catalogueHealthy = orphanPermissions().length === 0 && danglingGrants().length === 0 && hasInheritanceCycle().length === 0;

  return (
    <div className="fade-rise space-y-3" dir={rtl ? "rtl" : "ltr"}>
      {/* نوار عنوان */}
      <div className="glass-dark flex flex-wrap items-center gap-2 rounded-2xl p-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-lg border border-emerald-400/40 bg-emerald-400/10 text-[15px]">🛡</span>
        <div className="min-w-0 flex-1">
          <div className="text-[11.5px] font-semibold tx1">{rtl ? "مرکز RBAC و امنیت یکپارچه" : "Unified RBAC & Security Centre"}</div>
          <div className="text-[8.5px] font-extralight tx3">
            {rtl
              ? `${PERMISSION_CATALOG.length} مجوز · ${ROLE_CATALOG.length} نقش · ${SOD_RULES.length} قاعده تفکیک وظیفه · وراثت نقش، تفویض زمان‌دار، پوشاندن میدان حساس`
              : `${PERMISSION_CATALOG.length} permissions · ${ROLE_CATALOG.length} roles · ${SOD_RULES.length} SoD rules · inheritance, time-boxed delegation, field masking`}
          </div>
        </div>
        <span className={`rounded-lg border px-2 py-1 text-[8.5px] ${catalogueHealthy ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-rose-400/30 bg-rose-400/10 text-rose-300"}`}>
          {catalogueHealthy ? (rtl ? "کاتالوگ سالم" : "Catalogue healthy") : rtl ? "کاتالوگ ناسازگار" : "Catalogue inconsistent"}
        </span>
        <span className="rounded-lg border b-line-soft px-2 py-1 font-mono text-[8.5px] tx3" dir="ltr">{RBAC_ENGINE_VERSION}</span>
      </div>

      {/* زیرتب‌ها */}
      <nav className="flex flex-wrap gap-1 rounded-xl bg-black/15 p-1">
        {PANES.map((p) => (
          <button
            key={p.key}
            onClick={() => setPane(p.key)}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-light transition ${pane === p.key ? "toggle-on tx1 shadow-sm" : "tx3 hover:tx2"}`}
          >
            <span>{p.icon}</span>
            <span>{T(p.label)}</span>
          </button>
        ))}
      </nav>

      {/* ═══════════ وضعیت امنیتی ═══════════ */}
      {pane === "posture" && (
        <div className="grid gap-3 lg:grid-cols-[260px_1fr]">
          <div className="space-y-3">
            <Card title={rtl ? "امتیاز آمادگی امنیتی" : "Security readiness score"}>
              <div className="flex flex-col items-center py-2">
                <div className="grid h-24 w-24 place-items-center rounded-full border-4" style={{ borderColor: GRADE_COLOR[posture.grade] }}>
                  <div className="text-center">
                    <div className="text-[26px] font-bold leading-none" style={{ color: GRADE_COLOR[posture.grade] }}>{posture.score}</div>
                    <div className="text-[9px] tx3">{rtl ? "از ۱۰۰" : "of 100"}</div>
                  </div>
                </div>
                <div className="mt-2 text-[13px] font-bold" style={{ color: GRADE_COLOR[posture.grade] }}>
                  {rtl ? "درجه" : "Grade"} {posture.grade}
                </div>
                <div className="text-[9px] tx3">{posture.findings.length} {rtl ? "یافته باز" : "open findings"}</div>
              </div>
            </Card>

            <Card title={rtl ? "پیکربندی زیرساخت" : "Infrastructure config"}>
              <div className="space-y-1.5">
                {([
                  [rtl ? "HTTPS اجباری" : "HTTPS enforced", httpsEnforced, setHttps],
                  [rtl ? "احراز دومرحله‌ای (MFA)" : "MFA enabled", mfaEnabled, setMfa],
                  [rtl ? "رمزنگاری پایگاه داده" : "DB encryption", sqlEncrypted, setSqlEnc],
                ] as const).map(([label, val, set]) => (
                  <label key={label} className="glass-row flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5">
                    <input type="checkbox" checked={val} onChange={(e) => set(e.target.checked)} className="h-3 w-3 accent-emerald-400" />
                    <span className="text-[9.5px] font-light tx2">{label}</span>
                    <span className={`ms-auto text-[8px] ${val ? "text-emerald-300" : "text-rose-300"}`}>{val ? "ON" : "OFF"}</span>
                  </label>
                ))}
                <label className="block px-1">
                  <span className="text-[8.5px] tx3">{rtl ? "نگهداشت لاگ ممیزی (روز)" : "Audit retention (days)"}: {retention}</span>
                  <input type="range" min={30} max={1095} step={30} value={retention} onChange={(e) => setRetention(Number(e.target.value))} className="w-full accent-sky-400" />
                </label>
                <label className="block px-1">
                  <span className="text-[8.5px] tx3">{rtl ? "عمر آخرین پشتیبان (روز)" : "Backup age (days)"}: {backupAge ?? (rtl ? "بدون پشتیبان" : "none")}</span>
                  <input type="range" min={-1} max={60} value={backupAge ?? -1} onChange={(e) => setBackupAge(Number(e.target.value) < 0 ? null : Number(e.target.value))} className="w-full accent-sky-400" />
                </label>
              </div>
            </Card>
          </div>

          <Card title={rtl ? "یافته‌ها به ترتیب اثر بر نمره" : "Findings by score impact"}>
            {posture.findings.length === 0 ? (
              <div className="py-10 text-center text-[10px] text-emerald-300">{rtl ? "هیچ یافتهٔ بازی وجود ندارد — پیکربندی سالم است" : "No open findings — configuration is clean"}</div>
            ) : (
              <div className="thin-scroll max-h-[460px] space-y-1.5 overflow-y-auto pr-1">
                {posture.findings.map((f, i) => (
                  <div key={`${f.code}-${i}`} className={`rounded-xl border p-2 ${SEV_STYLE[f.severity]}`}>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-[8px] opacity-80" dir="ltr">{f.code}</span>
                      <span className="rounded bg-black/25 px-1.5 py-[1px] text-[7.5px] uppercase">{f.severity}</span>
                      <span className="text-[10px] font-medium">{T(f.title)}</span>
                      <span className="ms-auto text-[8.5px] opacity-75">−{f.weight}</span>
                    </div>
                    <p className="mt-0.5 text-[9px] font-light opacity-90">{T(f.detail)}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ═══════════ آزمون دسترسی ═══════════ */}
      {pane === "simulator" && (
        <div className="grid gap-3 lg:grid-cols-[300px_1fr]">
          <Card title={rtl ? "سناریو" : "Scenario"}>
            <div className="space-y-2">
              <label className="block">
                <span className="text-[8.5px] tx3">{rtl ? "کاربر" : "User"}</span>
                <select value={simUser} onChange={(e) => setSimUser(e.target.value)} className="mt-0.5 w-full rounded-lg border b-line-soft bg-black/30 px-2 py-1 text-[10px] tx1 outline-none">
                  {DEMO_SUBJECTS.map((s) => (
                    <option key={s.id} value={s.id} className="bg-neutral-900">
                      {s.displayName} {s.active ? "" : rtl ? "(غیرفعال)" : "(inactive)"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-[8.5px] tx3">{rtl ? "مجوز" : "Permission"}</span>
                <select value={simPerm} onChange={(e) => setSimPerm(e.target.value)} className="mt-0.5 w-full rounded-lg border b-line-soft bg-black/30 px-2 py-1 font-mono text-[9.5px] tx1 outline-none" dir="ltr">
                  {PERMISSION_CATALOG.map((p) => (
                    <option key={p.code} value={p.code} className="bg-neutral-900">{p.code}</option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <label className="block">
                  <span className="text-[8.5px] tx3">{rtl ? "پروژه" : "Project"}</span>
                  <input value={simProject} onChange={(e) => setSimProject(e.target.value)} dir="ltr" className="mt-0.5 w-full rounded-lg border b-line-soft bg-black/25 px-2 py-1 text-[9.5px] tx1 outline-none" />
                </label>
                <label className="block">
                  <span className="text-[8.5px] tx3">{rtl ? "دیسیپلین" : "Discipline"}</span>
                  <input value={simDiscipline} onChange={(e) => setSimDiscipline(e.target.value)} dir="ltr" placeholder="civil…" className="mt-0.5 w-full rounded-lg border b-line-soft bg-black/25 px-2 py-1 text-[9.5px] tx1 outline-none" />
                </label>
              </div>
              <label className="block">
                <span className="text-[8.5px] tx3">{rtl ? "تهیه‌کنندهٔ رکورد (برای تفکیک وظیفه)" : "Record preparer (for SoD)"}</span>
                <select value={simPreparer} onChange={(e) => setSimPreparer(e.target.value)} className="mt-0.5 w-full rounded-lg border b-line-soft bg-black/30 px-2 py-1 text-[10px] tx1 outline-none">
                  <option value="" className="bg-neutral-900">{rtl ? "— بدون رکورد —" : "— no record —"}</option>
                  {DEMO_SUBJECTS.map((s) => (
                    <option key={s.id} value={s.id} className="bg-neutral-900">{s.displayName}</option>
                  ))}
                </select>
              </label>
            </div>
          </Card>

          <div className="space-y-3">
            <Card title={rtl ? "تصمیم موتور" : "Engine decision"}>
              <div className={`rounded-xl border p-3 ${simDecision.allow ? "border-emerald-400/30 bg-emerald-400/10" : "border-rose-400/30 bg-rose-400/10"}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[18px]">{simDecision.allow ? "✔" : "✖"}</span>
                  <span className={`text-[13px] font-bold ${simDecision.allow ? "text-emerald-300" : "text-rose-300"}`}>
                    {simDecision.allow ? (rtl ? "مجاز" : "ALLOW") : rtl ? "رد" : "DENY"}
                  </span>
                  <span className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-[8.5px] tx2" dir="ltr">{simDecision.code}</span>
                  {simDecision.audit && <span className="rounded bg-fuchsia-400/15 px-1.5 py-0.5 text-[8px] text-fuchsia-200">{rtl ? "ثبت در ممیزی" : "audited"}</span>}
                </div>
                <p className="mt-1.5 text-[10px] font-light tx1">{T(simDecision.reason)}</p>
              </div>

              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border b-line-soft bg-black/15 p-2">
                  <div className="mb-1 text-[9px] font-semibold tx2">{rtl ? "پروفایل کاربر" : "Subject profile"}</div>
                  <div className="space-y-0.5 text-[8.5px] font-light tx3">
                    <div>{rtl ? "نقش‌ها: " : "Roles: "}{simSubject.roles.map((r) => roleTitle(r, lang)).join("، ")}</div>
                    <div>{rtl ? "سطح دسترسی: " : "Clearance: "}{T(CLASSIFICATION_LABEL[subjectClearance(simSubject)])}</div>
                    <div dir="ltr">{rtl ? "پروژه‌ها: " : "Projects: "}{simSubject.projectIds.join(", ")}</div>
                    <div dir="ltr">{rtl ? "دیسیپلین‌ها: " : "Disciplines: "}{simSubject.disciplines?.join(", ") ?? "*"}</div>
                    <div>{rtl ? "تعداد مجوز مؤثر: " : "Effective permissions: "}{subjectPermissions(simSubject).length}</div>
                    <div>{rtl ? "تفویض دریافتی امروز: " : "Delegated today: "}{delegatedPermissions(delegations, simSubject.id, TODAY).length}</div>
                  </div>
                </div>
                <div className="rounded-xl border b-line-soft bg-black/15 p-2">
                  <div className="mb-1 text-[9px] font-semibold tx2">{rtl ? "رکورد ممیزی تولیدشده" : "Generated audit record"}</div>
                  <pre className="thin-scroll overflow-x-auto text-[8px] leading-relaxed tx3" dir="ltr">{JSON.stringify({ ...simAudit, at: simAudit.at.slice(0, 19) + "Z" }, null, 1)}</pre>
                </div>
              </div>
            </Card>

            <Card title={rtl ? "نمونهٔ پوشاندن میدان حساس" : "Field masking preview"}>
              <div className="thin-scroll overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse text-[9px]">
                  <thead>
                    <tr className="border-b b-line-soft bg-black/20">
                      <th className="px-2 py-1 text-start tx3">{rtl ? "میدان" : "Field"}</th>
                      <th className="px-2 py-1 text-start tx3">{rtl ? "مجوز لازم" : "Required permission"}</th>
                      <th className="px-2 py-1 text-start tx3">{rtl ? "مقدار واقعی" : "Raw"}</th>
                      <th className="px-2 py-1 text-start tx3">{rtl ? "آنچه این کاربر می‌بیند" : "What this user sees"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y b-line-soft">
                    {MASK_RULES.map((r) => {
                      const raw = r.field === "nationalId" ? "0012345678" : r.field === "mobile" ? "09121234567" : r.field === "claimStrategy" ? "تمدید ۴۵ روزه" : 4_200_000;
                      const shown = (maskRecord(simSubject, { [r.field]: raw }, { projectId: simProject || null, delegations, onDate: TODAY }) as Record<string, unknown>)[r.field];
                      const masked = shown !== raw;
                      return (
                        <tr key={r.field}>
                          <td className="px-2 py-1 font-mono tx1" dir="ltr">{r.field}</td>
                          <td className="px-2 py-1 font-mono text-[8px] tx3" dir="ltr">{r.permission}</td>
                          <td className="px-2 py-1 tx3" dir="ltr">{String(raw)}</td>
                          <td className={`px-2 py-1 ${masked ? "text-rose-300" : "text-emerald-300"}`} dir="ltr">{String(shown)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ═══════════ ماتریس ═══════════ */}
      {pane === "matrix" && (
        <Card
          title={rtl ? "ماتریس نقش × مجوز (پس از اعمال وراثت)" : "Role × permission matrix (inheritance resolved)"}
          right={
            <select value={matrixModule} onChange={(e) => setMatrixModule(e.target.value)} className="rounded-lg border b-line-soft bg-black/30 px-2 py-1 text-[9.5px] tx1 outline-none">
              {MODULES.map((m) => (
                <option key={m} value={m} className="bg-neutral-900">{m}</option>
              ))}
            </select>
          }
        >
          <div className="thin-scroll max-h-[520px] overflow-auto rounded-xl border b-line-soft">
            <table className="w-full border-collapse text-[9px]">
              <thead className="sticky top-0 z-10">
                <tr className="bg-neutral-900">
                  <th className="sticky start-0 z-20 min-w-[130px] bg-neutral-900 px-2 py-2 text-start tx3">{rtl ? "نقش" : "Role"}</th>
                  {matrixPerms.map((p) => (
                    <th key={p.code} className="px-1 py-2 text-center align-bottom tx4" title={`${p.code} — ${T(p.title)}`}>
                      <span className="inline-block whitespace-nowrap text-[8px]" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }} dir="ltr">
                        {p.code.split(".").slice(1).join(".")}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y b-line-soft">
                {ROLE_CATALOG.map((r) => {
                  const eff = new Set(effectivePermissions(r.code));
                  const direct = new Set(r.grants);
                  return (
                    <tr key={r.code} className="hover:bg-white/5">
                      <td className="sticky start-0 bg-neutral-950/90 px-2 py-1.5 tx1">
                        <div className="text-[9.5px] font-light">{T(r.title)}</div>
                        <div className="text-[7.5px] tx4">{T(CLASSIFICATION_LABEL[r.clearance])}</div>
                      </td>
                      {matrixPerms.map((p) => (
                        <td key={p.code} className="px-1 py-1.5 text-center">
                          {eff.has(p.code) ? (
                            <span className={direct.has(p.code) ? "text-emerald-300" : "text-sky-400/70"} title={direct.has(p.code) ? (rtl ? "مستقیم" : "direct") : rtl ? "ارثی" : "inherited"}>
                              {direct.has(p.code) ? "●" : "○"}
                            </span>
                          ) : (
                            <span className="tx4 opacity-30">·</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-3 text-[8.5px] tx3">
            <span><span className="text-emerald-300">●</span> {rtl ? "اعطای مستقیم" : "direct grant"}</span>
            <span><span className="text-sky-400/70">○</span> {rtl ? "ارث‌برده از نقش والد" : "inherited"}</span>
            <span className="tx4">· {rtl ? "بدون دسترسی" : "no access"}</span>
          </div>
        </Card>
      )}

      {/* ═══════════ تفکیک وظایف ═══════════ */}
      {pane === "sod" && (
        <div className="grid gap-3 lg:grid-cols-2">
          <Card title={rtl ? "قواعد تفکیک وظایف" : "SoD rule set"}>
            <div className="space-y-1.5">
              {SOD_RULES.map((r) => (
                <div key={r.id} className={`rounded-xl border p-2 ${SEV_STYLE[r.severity === "critical" ? "critical" : "high"]}`}>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[8.5px]" dir="ltr">{r.id}</span>
                    <span className="rounded bg-black/25 px-1.5 py-[1px] text-[7.5px] uppercase">{r.severity}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1 font-mono text-[8.5px] opacity-90" dir="ltr">
                    <span>{r.a}</span><span className="opacity-60">⇄</span><span>{r.b}</span>
                  </div>
                  <p className="mt-0.5 text-[9px] font-light opacity-90">{T(r.reason)}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card title={rtl ? "پویش کاربران" : "User scan"}>
            <div className="space-y-1.5">
              {DEMO_SUBJECTS.map((s) => {
                const v = sodViolations(subjectPermissions(s));
                return (
                  <div key={s.id} className="glass-row flex flex-wrap items-center gap-1.5 rounded-lg px-2 py-1.5">
                    <span className="text-[9.5px] font-light tx1">{s.displayName}</span>
                    <span className="text-[8px] tx4">{s.roles.map((r) => roleTitle(r, lang)).join(" + ")}</span>
                    {v.length === 0 ? (
                      <span className="ms-auto rounded bg-emerald-400/10 px-1.5 py-0.5 text-[8px] text-emerald-300">{rtl ? "پاک" : "clean"}</span>
                    ) : (
                      <span className="ms-auto flex gap-1">
                        {v.map((x) => (
                          <span key={x.id} className="rounded bg-rose-400/15 px-1.5 py-0.5 font-mono text-[8px] text-rose-300" title={T(x.reason)} dir="ltr">{x.id}</span>
                        ))}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="mt-2 rounded-lg bg-sky-400/10 px-2 py-1.5 text-[8.5px] text-sky-200">
              {rtl
                ? "تفکیک وظیفه در سطح نقش کافی نیست: حتی وقتی کاربر هر دو مجوز را قانوناً دارد، موتور در لحظهٔ تأیید بررسی می‌کند که تهیه‌کنندهٔ همان رکورد نباشد."
                : "Role-level SoD is not enough: even when a user legitimately holds both permissions, the engine checks at approval time that they did not prepare that very record."}
            </p>
          </Card>
        </div>
      )}

      {/* ═══════════ تفویض ═══════════ */}
      {pane === "delegation" && (
        <div className="grid gap-3 lg:grid-cols-[320px_1fr]">
          <Card title={rtl ? "تفویض جدید" : "New delegation"}>
            <div className="space-y-2">
              {([
                [rtl ? "از" : "From", dFrom, setDFrom],
                [rtl ? "به" : "To", dTo, setDTo],
              ] as const).map(([label, val, set]) => (
                <label key={label} className="block">
                  <span className="text-[8.5px] tx3">{label}</span>
                  <select value={val} onChange={(e) => set(e.target.value)} className="mt-0.5 w-full rounded-lg border b-line-soft bg-black/30 px-2 py-1 text-[10px] tx1 outline-none">
                    {DEMO_SUBJECTS.map((s) => (
                      <option key={s.id} value={s.id} className="bg-neutral-900">{s.displayName}</option>
                    ))}
                  </select>
                </label>
              ))}
              <label className="block">
                <span className="text-[8.5px] tx3">{rtl ? "مجوز" : "Permission"}</span>
                <select value={dPerm} onChange={(e) => setDPerm(e.target.value)} className="mt-0.5 w-full rounded-lg border b-line-soft bg-black/30 px-2 py-1 font-mono text-[9.5px] tx1 outline-none" dir="ltr">
                  {PERMISSION_CATALOG.map((p) => (
                    <option key={p.code} value={p.code} className="bg-neutral-900">{p.code}</option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <label className="block">
                  <span className="text-[8.5px] tx3">{rtl ? "از تاریخ" : "From date"}</span>
                  <input value={dStart} onChange={(e) => setDStart(e.target.value)} dir="ltr" className="mt-0.5 w-full rounded-lg border b-line-soft bg-black/25 px-2 py-1 text-[9.5px] tx1 outline-none" />
                </label>
                <label className="block">
                  <span className="text-[8.5px] tx3">{rtl ? "تا تاریخ" : "To date"}</span>
                  <input value={dEnd} onChange={(e) => setDEnd(e.target.value)} dir="ltr" className="mt-0.5 w-full rounded-lg border b-line-soft bg-black/25 px-2 py-1 text-[9.5px] tx1 outline-none" />
                </label>
              </div>
              <label className="block">
                <span className="text-[8.5px] tx3">{rtl ? "دلیل (الزامی)" : "Reason (mandatory)"}</span>
                <input value={dReason} onChange={(e) => setDReason(e.target.value)} className="mt-0.5 w-full rounded-lg border b-line-soft bg-black/25 px-2 py-1 text-[9.5px] tx1 outline-none" />
              </label>

              {dIssues.map((i) => (
                <div key={i.code} className={`rounded-lg px-2 py-1 text-[8.5px] ${i.code.startsWith("E-") ? "bg-rose-400/10 text-rose-300" : "bg-amber-400/10 text-amber-200"}`}>
                  <span dir="ltr">{i.code}</span> · {T(i.message)}
                </div>
              ))}

              <button
                onClick={addDelegation}
                disabled={dErrors.length > 0}
                className={`w-full rounded-lg px-3 py-1.5 text-[10px] font-light transition ${dErrors.length ? "cursor-not-allowed border b-line-soft tx4 opacity-50" : "glass-row tx2 hover:tx1"}`}
              >
                {rtl ? "ثبت تفویض" : "Create delegation"}
              </button>
            </div>
          </Card>

          <Card title={rtl ? "تفویض‌های ثبت‌شده" : "Registered delegations"}>
            <div className="space-y-1.5">
              {delegations.map((d) => {
                const active = isDelegationActive(d, TODAY);
                const from = DEMO_SUBJECTS.find((s) => s.id === d.fromUserId)?.displayName ?? d.fromUserId;
                const to = DEMO_SUBJECTS.find((s) => s.id === d.toUserId)?.displayName ?? d.toUserId;
                return (
                  <div key={d.id} className="glass-row rounded-xl px-2.5 py-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[9.5px] font-light tx1">{from}</span>
                      <span className="tx4">→</span>
                      <span className="text-[9.5px] font-light tx1">{to}</span>
                      <span className={`rounded px-1.5 py-0.5 text-[8px] ${d.revoked ? "bg-neutral-500/20 tx3" : active ? "bg-emerald-400/15 text-emerald-300" : "bg-amber-400/15 text-amber-200"}`}>
                        {d.revoked ? (rtl ? "باطل‌شده" : "revoked") : active ? (rtl ? "فعال" : "active") : rtl ? "خارج از بازه" : "out of window"}
                      </span>
                      {!d.revoked && (
                        <button onClick={() => revoke(d.id)} className="ms-auto rounded-lg border border-rose-400/30 bg-rose-400/10 px-2 py-0.5 text-[8.5px] text-rose-300">
                          {rtl ? "ابطال" : "Revoke"}
                        </button>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {d.permissions.map((p) => (
                        <span key={p} className="rounded bg-fuchsia-400/10 px-1.5 py-0.5 font-mono text-[8px] text-fuchsia-200" dir="ltr">{p}</span>
                      ))}
                    </div>
                    <div className="mt-0.5 text-[8.5px] font-extralight tx4">
                      <span dir="ltr">{d.from} … {d.to}</span> · {d.reason}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* ═══════════ سیاست‌ها ═══════════ */}
      {pane === "policy" && (
        <div className="grid gap-3 lg:grid-cols-3">
          <Card title={rtl ? "سیاست گذرواژه" : "Password policy"}>
            <input
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              dir="ltr"
              className="w-full rounded-lg border b-line-soft bg-black/25 px-2 py-1.5 font-mono text-[10px] tx1 outline-none focus:border-sky-400/50"
            />
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/40">
              <div className="h-full transition-all" style={{ width: `${pwCheck.score}%`, background: pwCheck.score >= 80 ? "#2E9E4F" : pwCheck.score >= 50 ? "#F5A623" : "#D0021B" }} />
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[9px]">
              <span className={pwCheck.ok ? "text-emerald-300" : "text-rose-300"}>{pwCheck.ok ? (rtl ? "قابل قبول" : "Acceptable") : rtl ? "مردود" : "Rejected"}</span>
              <span className="tx4">·</span>
              <span className="tx3">{rtl ? "قدرت" : "Strength"} {pwCheck.score}/100</span>
            </div>
            <div className="mt-1.5 space-y-0.5">
              {pwCheck.issues.map((i, k) => (
                <div key={k} className="rounded bg-rose-400/10 px-1.5 py-0.5 text-[8.5px] text-rose-300">{T(i)}</div>
              ))}
            </div>
            <div className="mt-2 space-y-0.5 border-t b-line-soft pt-1.5 text-[8.5px] font-extralight tx3">
              <div>{rtl ? "حداقل طول: " : "Min length: "}{DEFAULT_PASSWORD_POLICY.minLength}</div>
              <div>{rtl ? "بیشینه عمر: " : "Max age: "}{DEFAULT_PASSWORD_POLICY.maxAgeDays} {rtl ? "روز" : "days"}</div>
              <div>{rtl ? "عمق تاریخچه: " : "History depth: "}{DEFAULT_PASSWORD_POLICY.historyDepth}</div>
            </div>
          </Card>

          <Card title={rtl ? "سیاست نشست بر پایه سطح دسترسی" : "Clearance-based session policy"}>
            <table className="w-full border-collapse text-[9px]">
              <thead>
                <tr className="border-b b-line-soft">
                  <th className="px-1.5 py-1 text-start tx3">{rtl ? "سطح" : "Clearance"}</th>
                  <th className="px-1.5 py-1 text-center tx3">{rtl ? "بی‌کاری" : "Idle"}</th>
                  <th className="px-1.5 py-1 text-center tx3">{rtl ? "مطلق" : "Absolute"}</th>
                  <th className="px-1.5 py-1 text-center tx3">MFA</th>
                </tr>
              </thead>
              <tbody className="divide-y b-line-soft">
                {(["internal", "confidential", "restricted"] as Classification[]).map((c) => {
                  const p = sessionPolicyFor(c);
                  return (
                    <tr key={c}>
                      <td className="px-1.5 py-1.5 tx1">{T(CLASSIFICATION_LABEL[c])}</td>
                      <td className="px-1.5 py-1.5 text-center tx2">{p.idleMinutes}′</td>
                      <td className="px-1.5 py-1.5 text-center tx2">{p.absoluteHours}h</td>
                      <td className="px-1.5 py-1.5 text-center">
                        <span className={p.mfaRequired ? "text-emerald-300" : "tx4"}>{p.mfaRequired ? "✔" : "—"}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-2 text-[8.5px] font-extralight tx3">
              {rtl ? `سطح دسترسی کاربر جاری: ${me ? T(CLASSIFICATION_LABEL[subjectClearance(me)]) : "—"}` : `Current user clearance: ${me ? T(CLASSIFICATION_LABEL[subjectClearance(me)]) : "—"}`}
            </p>
          </Card>

          <Card title={rtl ? "قفل پس از تلاش ناموفق" : "Failed-login lockout"}>
            <label className="block">
              <span className="text-[8.5px] tx3">{rtl ? "تعداد تلاش ناموفق در پنجرهٔ ۱۵ دقیقه" : "Failed attempts in 15-minute window"}: {attempts}</span>
              <input type="range" min={0} max={8} value={attempts} onChange={(e) => setAttempts(Number(e.target.value))} className="w-full accent-sky-400" />
            </label>
            <div className={`mt-2 rounded-xl border p-2.5 ${lock.locked ? "border-rose-400/30 bg-rose-400/10" : "border-emerald-400/30 bg-emerald-400/10"}`}>
              <div className={`text-[11px] font-bold ${lock.locked ? "text-rose-300" : "text-emerald-300"}`}>
                {lock.locked ? (rtl ? "حساب قفل شد" : "Account locked") : rtl ? "باز" : "Open"}
              </div>
              <div className="mt-0.5 text-[9px] tx2">
                {lock.locked
                  ? rtl
                    ? `آزادسازی پس از ${lock.unlockAfterMinutes} دقیقه`
                    : `Unlocks in ${lock.unlockAfterMinutes} minutes`
                  : rtl
                  ? `${lock.remainingAttempts} تلاش باقی مانده`
                  : `${lock.remainingAttempts} attempts remaining`}
              </div>
            </div>
            <div className="mt-2 space-y-0.5 text-[8.5px] font-extralight tx3">
              <div>{rtl ? "سقف تلاش: " : "Max attempts: "}{DEFAULT_LOCKOUT.maxAttempts}</div>
              <div>{rtl ? "پنجره: " : "Window: "}{DEFAULT_LOCKOUT.windowMinutes} {rtl ? "دقیقه" : "min"}</div>
              <div>{rtl ? "مدت قفل: " : "Lock duration: "}{DEFAULT_LOCKOUT.lockMinutes} {rtl ? "دقیقه" : "min"}</div>
            </div>
          </Card>
        </div>
      )}

      {/* ═══════════ کاربران ═══════════ */}
      {pane === "users" && <AccessControlPanel lang={lang} />}
    </div>
  );
}
