import { useEffect, useMemo, useState } from "react";
import { t, type Bi, type Lang } from "../data/framework";
import { logAudit } from "../services/auditLogger";
import { qmsApi } from "../services/qmsApiClient";
import {
  QMS_FORMULA_VERSION,
  canProceed,
  capaRequired,
  certificationRisk,
  complianceScore,
  concreteAcceptance,
  controlLimits,
  costOfQuality,
  dispositionAllowed,
  dossierCompleteness,
  dpmo,
  firstPassYield,
  irNoticeCheck,
  irOutcome,
  itpBlocking,
  itpCoverage,
  mechanicalCompletionGate,
  ncrAgeDays,
  ncrClosureRate,
  ncrOverdue,
  ncrSeverity,
  outOfControl,
  pareto,
  punchSummary,
  qmsEws,
  samplingPlan,
  sigmaLevel,
  signRecord,
  traceChain,
  verifyCertificate,
  verifySignature,
  weldRepairRate,
  type ItpPoint,
  type MaterialCert,
  type NcrRow,
  type PunchItem,
} from "../services/quality";

/* شش تب = دقیقاً شش زیرماژول d8 */
export type QmsTab = "plan" | "inspection" | "ncr" | "material" | "audit" | "handover";

const TABS: { id: QmsTab; fa: string; en: string; icon: string; proc: string }[] = [
  { id: "plan", fa: "برنامه‌ریزی کیفیت و ITP", en: "Quality Planning & ITP", icon: "📐", proc: "d8-p1" },
  { id: "inspection", fa: "بازرسی و آزمون", en: "Inspection & Testing", icon: "🔎", proc: "d8-p2" },
  { id: "ncr", fa: "عدم انطباق و اقدام اصلاحی", en: "NCR & CAPA", icon: "⚠️", proc: "d8-p3" },
  { id: "material", fa: "کنترل مواد و گواهی‌ها", en: "Material & Certificates", icon: "🧾", proc: "d8-p4" },
  { id: "audit", fa: "ممیزی کیفیت و انطباق", en: "Audit & Compliance", icon: "🗂", proc: "d8-p5" },
  { id: "handover", fa: "تحویل، پانچ و راه‌اندازی", en: "Handover & Punch", icon: "✅", proc: "d8-p6" },
];

const TODAY = "2026-09-08";
const now = new Date(TODAY + "T00:00:00Z");

/* ─────────────── داده نمونه ─────────────── */

const ACTIVITIES = ["A-1100", "A-1200", "A-1300", "A-1400", "A-1500", "A-1600"];

const SAMPLE_ITP: (ItpPoint & { titleFa: string })[] = [
  { id: "ITP-01-H", activityId: "A-1100", type: "H", party: "consultant", titleFa: "تأیید آرماتوربندی پیش از بتن‌ریزی", signedAt: "2026-09-02" },
  { id: "ITP-02-W", activityId: "A-1200", type: "W", party: "client", titleFa: "شاهد آزمون اسلامپ بتن" },
  { id: "ITP-03-H", activityId: "A-1300", type: "H", party: "tpi", titleFa: "توقف پیش از پوشش جوش خط ۱۴ اینچ" },
  { id: "ITP-04-R", activityId: "A-1400", type: "R", party: "consultant", titleFa: "بازبینی دستورالعمل جوشکاری WPS" },
  { id: "ITP-05-H", activityId: "A-1500", type: "H", party: "client", titleFa: "تأیید تست هیدرواستاتیک", waivedBy: "مدیر کیفیت" },
  { id: "ITP-06-M", activityId: "A-1100", type: "M", party: "contractor", titleFa: "پایش دمای عمل‌آوری بتن" },
];

type IrRow = { id: string; titleFa: string; requestedAt: string; inspectionAt: string; noticeHours: number; defects: { severity: "critical" | "major" | "minor" }[] };
const SAMPLE_IRS: IrRow[] = [
  { id: "IR-4410", titleFa: "بازرسی ابعادی اسپول SP-14", requestedAt: "2026-09-01T08:00:00Z", inspectionAt: "2026-09-04T08:00:00Z", noticeHours: 48, defects: [] },
  { id: "IR-4411", titleFa: "بازرسی چشمی جوش W-221", requestedAt: "2026-09-03T09:00:00Z", inspectionAt: "2026-09-04T09:00:00Z", noticeHours: 48, defects: [{ severity: "minor" }] },
  { id: "IR-4412", titleFa: "آزمون رادیوگرافی خط ۱۴ اینچ", requestedAt: "2026-09-02T07:00:00Z", inspectionAt: "2026-09-06T07:00:00Z", noticeHours: 48, defects: [{ severity: "critical" }] },
  { id: "IR-4413", titleFa: "بازرسی رنگ و پوشش مخزن T-02", requestedAt: "2026-09-04T10:00:00Z", inspectionAt: "2026-09-07T10:00:00Z", noticeHours: 48, defects: [{ severity: "major" }, { severity: "minor" }] },
];

const SAMPLE_NCRS: (NcrRow & { titleFa: string; cause: string; disposition: "rework" | "repair" | "use_as_is" | "reject" | "scrap"; concessionBy?: string; recurrence: number })[] = [
  { id: "NCR-2026-018", severity: "critical", openedAt: "2026-08-25", titleFa: "ترک در جوش محیطی خط ۱۴ اینچ", cause: "جوشکاری", disposition: "rework", recurrence: 4, capaId: "CAPA-07" },
  { id: "NCR-2026-021", severity: "major", openedAt: "2026-08-30", closedAt: "2026-09-05", titleFa: "انحراف ابعادی صفحه کف ستون", cause: "ابعاد", disposition: "repair", concessionBy: "مهندس ارشد سازه", recurrence: 2 },
  { id: "NCR-2026-024", severity: "minor", openedAt: "2026-09-01", titleFa: "ضخامت رنگ کمتر از مشخصات", cause: "رنگ", disposition: "rework", recurrence: 1 },
  { id: "NCR-2026-025", severity: "major", openedAt: "2026-09-03", titleFa: "نبود گواهی مواد برای شیر ۸ اینچ", cause: "مستندات", disposition: "use_as_is", recurrence: 1 },
];

const SAMPLE_CERTS: (MaterialCert & { itemFa: string })[] = [
  { itemFa: "لوله بدون درز ۱۴ اینچ", heatNo: "H-99312", certType: "3.1", issuedAt: "2026-05-11", declaredGrade: "A106-B", requiredGrade: "A106-B", labVerified: true },
  { itemFa: "میلگرد A3 قطر ۱۸", heatNo: "H-88120", certType: "2.2", issuedAt: "2026-06-02", declaredGrade: "AIII", requiredGrade: "AIII", labVerified: true },
  { itemFa: "شیر پروانه‌ای ۸ اینچ", heatNo: "H-77045", certType: "3.1", issuedAt: "2025-08-01", expiresAt: "2026-08-01", declaredGrade: "WCB", requiredGrade: "WCB", labVerified: false },
  { itemFa: "ورق مخزن ۱۲ میلی‌متر", heatNo: "H-66190", certType: "3.2", issuedAt: "2026-07-19", declaredGrade: "A283-C", requiredGrade: "A516-70", labVerified: true },
];

const FINDINGS: { clause: string; titleFa: string; severity: "major" | "minor" | "observation"; closed?: boolean }[] = [
  { clause: "8.5.1", titleFa: "نبود شواهد کنترل عملیات جوشکاری", severity: "major" },
  { clause: "7.5.3", titleFa: "نسخه منسوخ نقشه در کارگاه", severity: "minor" },
  { clause: "9.2.2", titleFa: "تأخیر در برنامه ممیزی داخلی", severity: "observation", closed: true },
  { clause: "8.7", titleFa: "پیگیری ناقص خروجی نامنطبق", severity: "minor", closed: true },
];

const SAMPLE_PUNCH: (PunchItem & { titleFa: string })[] = [
  { id: "PL-101", category: "A", systemId: "SYS-01", titleFa: "نصب نشدن شیر اطمینان PSV-3" },
  { id: "PL-102", category: "A", systemId: "SYS-01", titleFa: "نقص ارت تجهیز E-11", closed: true },
  { id: "PL-103", category: "B", systemId: "SYS-02", titleFa: "رنگ‌آمیزی نهایی سکوی دسترسی" },
  { id: "PL-104", category: "B", systemId: "SYS-02", titleFa: "برچسب‌گذاری خطوط", closed: true },
  { id: "PL-105", category: "B", systemId: "SYS-01", titleFa: "تکمیل عایق‌کاری", closed: true },
];

const DOSSIER_REQUIRED = ["ITP امضاشده", "گزارش بازرسی", "گواهی مواد", "نتایج NDT", "نقشه چون‌ساخت", "گزارش تست هیدرواستاتیک", "لیست پانچ", "گواهی کالیبراسیون"];
const DOSSIER_DELIVERED = ["ITP امضاشده", "گزارش بازرسی", "گواهی مواد", "نتایج NDT", "لیست پانچ", "گواهی کالیبراسیون"];

const WELD_SERIES = [2.1, 2.4, 2.2, 2.6, 2.5, 2.8, 3.1, 3.4, 4.2];
const CONCRETE_TESTS = [32.5, 31.8, 30.2, 29.6, 33.1, 34.0];

/* ─────────────── اجزای کوچک ─────────────── */

function Kpi({ label, value, hint, tone = "tx1" }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="rounded-xl border b-line-soft bg-black/15 px-2.5 py-2">
      <div className="text-[8.5px] font-extralight tx3">{label}</div>
      <div className={`text-[13px] font-semibold tabular-nums ${tone}`} dir="ltr">{value}</div>
      {hint && <div className="text-[8px] font-extralight tx4">{hint}</div>}
    </div>
  );
}

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

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-2 py-1 text-start font-normal">{children}</th>;
}

const POINT_LABEL: Record<string, Bi> = {
  H: { fa: "توقف (Hold)", en: "Hold" },
  W: { fa: "شاهد (Witness)", en: "Witness" },
  R: { fa: "بازبینی مدرک", en: "Review" },
  M: { fa: "پایش", en: "Monitor" },
};

/* ══════════════════════════ کامپوننت اصلی ══════════════════════════ */

export default function QualityWorkspace({
  lang,
  initialTab = "plan",
  hideTabs = false,
}: {
  lang: Lang;
  initialTab?: QmsTab;
  hideTabs?: boolean;
}) {
  const rtl = lang === "fa";
  const [tab, setTab] = useState<QmsTab>(initialTab);
  const [signed, setSigned] = useState<Record<string, { signer: string; at: string; hash: string }>>({});
  const [itp, setItp] = useState(SAMPLE_ITP);
  const [irs, setIrs] = useState(SAMPLE_IRS);
  const [ncrs, setNcrs] = useState(SAMPLE_NCRS);
  const [certs] = useState(SAMPLE_CERTS);
  const [punchItems, setPunchItems] = useState(SAMPLE_PUNCH);
  const [source, setSource] = useState<"sample" | "api">("sample");
  const [mcNote, setMcNote] = useState<string | null>(null);
  useEffect(() => setTab(initialTab), [initialTab]);

  /* داده زنده در صورت در دسترس بودن سرویس؛ در غیر این‌صورت همان داده نمونه می‌ماند. */
  useEffect(() => {
    let alive = true;
    (async () => {
      const [itpRes, irRes, ncrRes, hoRes] = await Promise.all([qmsApi.itp(), qmsApi.inspections(), qmsApi.ncr(), qmsApi.handover()]);
      if (!alive || !itpRes) return;
      setItp(itpRes.points as typeof SAMPLE_ITP);
      if (irRes?.items?.length) setIrs(irRes.items as unknown as typeof SAMPLE_IRS);
      if (ncrRes?.items?.length) setNcrs(ncrRes.items as unknown as typeof SAMPLE_NCRS);
      if (hoRes?.punch?.length) setPunchItems(hoRes.punch as typeof SAMPLE_PUNCH);
      setSource("api");
    })();
    return () => {
      alive = false;
    };
  }, []);

  const blocking = useMemo(() => itpBlocking(itp), [itp]);
  const gate = useMemo(() => canProceed(itp), [itp]);
  const coverage = useMemo(() => itpCoverage(ACTIVITIES, itp), [itp]);

  const irEval = useMemo(
    () => irs.map((ir) => ({ ir, notice: irNoticeCheck(ir), outcome: irOutcome(ir.defects) })),
    [irs]
  );
  const fpy = firstPassYield(irEval.filter((x) => x.outcome === "accepted").length, irs.length);

  const ncrOpenCritical = ncrs.filter((n) => n.severity === "critical" && !n.closedAt).length;
  const ncrOverdueCount = ncrs.filter((n) => ncrOverdue(n, now)).length;
  const closure = ncrClosureRate(ncrs);
  const paretoRows = useMemo(() => {
    const map: Record<string, number> = {};
    for (const n of ncrs) map[n.cause] = (map[n.cause] ?? 0) + 1;
    return pareto(Object.entries(map).map(([cause, count]) => ({ cause, count })));
  }, [ncrs]);

  const certEval = useMemo(() => certs.map((c) => ({ c, v: verifyCertificate(c, "3.1", now) })), [certs]);
  const certRejections = certEval.filter((x) => !x.v.ok).length;
  const chain = useMemo(
    () =>
      traceChain("H-99312", [
        { from: "H-99312", to: "SPOOL-14" },
        { from: "SPOOL-14", to: "WELD-221" },
        { from: "WELD-221", to: "RT-556" },
        { from: "RT-556", to: "DOSSIER-SYS01" },
      ]),
    []
  );

  const auditScore = complianceScore(FINDINGS);
  const certRisk = certificationRisk(FINDINGS);
  const coq = costOfQuality({ prevention: 8_400_000_000, appraisal: 12_600_000_000, internalFailure: 9_800_000_000, externalFailure: 2_300_000_000 }, 620_000_000_000);
  const dpmoValue = dpmo(37, 4200, 5);
  const sigma = sigmaLevel(dpmoValue);
  const weld = weldRepairRate(11, 320);
  const limits = controlLimits(WELD_SERIES);
  const ooc = outOfControl(WELD_SERIES);
  const concrete = concreteAcceptance(CONCRETE_TESTS, 30);
  const plan = samplingPlan(420);

  const punch = punchSummary(punchItems);
  const dossier = dossierCompleteness(DOSSIER_REQUIRED, DOSSIER_DELIVERED);
  const mc = mechanicalCompletionGate({
    punch: punchItems,
    ncrs: ncrs,
    itp: itp,
    dossierCompletenessPct: dossier.pct,
    preCommissioningDone: true,
  });

  const alerts = qmsEws({
    openCriticalNcr: ncrOpenCritical,
    ncrOverdueCount,
    fpyPct: fpy,
    weldRepairPct: weld.ratePct,
    copqPct: coq.copqPct,
    openMajorAuditFindings: FINDINGS.filter((f) => f.severity === "major" && !f.closed).length,
    certRejections,
    openPunchA: punch.openA,
    unsignedHoldPoints: blocking.length,
    outOfControlTrend: ooc.trend || ooc.shift,
  });

  const actor = rtl ? "بازرس ارشد کیفیت" : "Lead QC Inspector";

  const signIr = async (id: string) => {
    const row = irs.find((x) => x.id === id)!;
    const local = signRecord({ id: row.id, defects: row.defects }, actor, new Date().toISOString());
    setSigned((prev) => ({ ...prev, [id]: local }));
    logAudit("QMS_IR_SIGN", "Quality", `Inspection record ${id} signed · hash ${local.hash} · ${local.version}`);
    if (source === "api") {
      const res = await qmsApi.signInspection(id, actor);
      if (res?.signature) setSigned((prev) => ({ ...prev, [id]: res.signature }));
    }
  };

  /** امضای نقطه توقف — تنها راه رفع انسداد کار. */
  const signHoldPoint = async (pointId: string) => {
    const today = new Date().toISOString().slice(0, 10);
    setItp((prev) => prev.map((p) => (p.id === pointId ? { ...p, signedAt: today } : p)));
    logAudit("QMS_HOLD_SIGN", "Quality", `Hold point ${pointId} signed by ${actor}`);
    if (source === "api") {
      const res = await qmsApi.signItpPoint(pointId, actor);
      if (res?.point) setItp((prev) => prev.map((p) => (p.id === pointId ? { ...p, ...res.point } : p)));
    }
  };

  /** صدور گواهی تحویل مکانیکی — سرور با هر مسدودکننده باز آن را رد می‌کند. */
  const issueMc = async () => {
    if (!mc.ok) {
      setMcNote(rtl ? "صدور ممکن نیست — مسدودکننده باز دارید" : "Blocked — open blockers remain");
      return;
    }
    const res = source === "api" ? await qmsApi.issueMc("SYS-01") : { certificate: `MC-SYS-01-${TODAY}`, state: "issued" };
    setMcNote(res ? `${rtl ? "گواهی صادر شد:" : "Certificate issued:"} ${res.certificate}` : rtl ? "سرویس گواهی را رد کرد" : "Service rejected issuance");
    logAudit("QMS_MC_ISSUE", "Quality", `Mechanical completion certificate requested for SYS-01`);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden" dir={rtl ? "rtl" : "ltr"}>
      {/* هدر */}
      <section className="glass-dark shrink-0 rounded-2xl p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-emerald-400/40 bg-emerald-400/10 text-[15px]">🔬</span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[12px] font-semibold tx1">{rtl ? "مدیریت کیفیت و بازرسی" : "Quality & Inspection Management"}</h3>
            <p className="text-[8.5px] font-extralight tx3">
              {rtl
                ? "نقطه توقف مسدودکننده · هر NCR با مالک و اقدام اصلاحی · گواهی پیش از نصب · تحویل بدون پانچ کلاس A"
                : "Hold points block work · every NCR owned with CAPA · certificate before installation · no MC with open class-A punch"}
            </p>
          </div>
          <span className={`rounded-lg px-2 py-1 text-[10px] font-semibold tabular-nums ${gate.ok ? "bg-emerald-400/15 text-emerald-300" : "bg-rose-400/15 text-rose-300"}`}>
            {gate.ok ? (rtl ? "بدون توقف باز" : "No open hold") : `${rtl ? "توقف باز" : "Hold open"} ${blocking.length.toLocaleString(rtl ? "fa-IR" : "en-US")}`}
          </span>
          <span className="rounded-lg border b-line-soft px-2 py-1 text-[9px] tx3" dir="ltr">FPY {fpy.toFixed(0)}%</span>
          <span className="rounded-lg border b-line-soft px-2 py-1 text-[9px] tx3" dir="ltr">σ {sigma.toFixed(2)}</span>
          <span
            className={`rounded-lg px-2 py-1 text-[9px] ${source === "api" ? "bg-emerald-400/15 text-emerald-300" : "border b-line-soft tx3"}`}
            title={source === "api" ? "/api/qms" : "mock"}
          >
            {source === "api" ? (rtl ? "داده زنده" : "Live data") : rtl ? "داده نمونه" : "Sample data"}
          </span>
          <span className="rounded-lg border b-line-soft px-2 py-1 font-mono text-[9px] tx3" dir="ltr">{QMS_FORMULA_VERSION} · {TODAY}</span>
        </div>
        {alerts.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {alerts.map((a) => (
              <span
                key={a.code}
                className={`rounded-lg px-2 py-0.5 text-[8.5px] ${
                  a.severity === "critical" ? "bg-rose-400/15 text-rose-300" : a.severity === "high" ? "bg-amber-400/15 text-amber-200" : "border b-line-soft tx3"
                }`}
              >
                <span dir="ltr">{a.code}</span> · {a.message}
              </span>
            ))}
          </div>
        )}
      </section>

      {!hideTabs && (
        <nav className="flex shrink-0 flex-wrap items-center gap-1.5 rounded-xl bg-black/15 p-1">
          {TABS.map((it) => (
            <button
              key={it.id}
              onClick={() => setTab(it.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[10px] font-light transition ${tab === it.id ? "toggle-on tx1 shadow-sm" : "tx3 hover:tx2"}`}
              title={it.proc}
            >
              <span>{it.icon}</span>
              <span>{rtl ? it.fa : it.en}</span>
            </button>
          ))}
        </nav>
      )}

      <div className="thin-scroll min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {/* ═══ تب ۱: برنامه‌ریزی کیفیت و ITP ═══ */}
        {tab === "plan" && (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Kpi label={rtl ? "پوشش ITP" : "ITP coverage"} value={`${coverage.toFixed(0)}%`} hint={`${ACTIVITIES.length} ${rtl ? "فعالیت" : "activities"}`} />
              <Kpi label={rtl ? "نقاط توقف باز" : "Open hold points"} value={String(blocking.length)} tone={blocking.length ? "text-rose-300" : "text-emerald-300"} />
              <Kpi label={rtl ? "کل نقاط کنترل" : "Control points"} value={String(itp.length)} />
              <Kpi label={rtl ? "طرح نمونه‌برداری (محموله ۴۲۰)" : "Sampling (lot 420)"} value={`n=${plan.sampleSize} · Ac=${plan.accept}`} hint="ISO 2859-1 · AQL 2.5" />
            </div>

            <Section title={rtl ? "برنامه بازرسی و آزمون (ITP)" : "Inspection & Test Plan"} note={rtl ? "فقط نقطه توقف امضانشده کار را متوقف می‌کند" : "only unsigned hold points block work"}>
              <table className="w-full text-[9.5px]">
                <thead className="tx3">
                  <tr className="border-b b-line-soft">
                    <Th>{rtl ? "شناسه" : "ID"}</Th>
                    <Th>{rtl ? "فعالیت" : "Activity"}</Th>
                    <Th>{rtl ? "عنوان" : "Title"}</Th>
                    <Th>{rtl ? "نوع نقطه" : "Point"}</Th>
                    <Th>{rtl ? "مرجع" : "Party"}</Th>
                    <Th>{rtl ? "وضعیت" : "Status"}</Th>
                  </tr>
                </thead>
                <tbody>
                  {itp.map((p) => {
                    const blocked = p.type === "H" && !p.signedAt && !p.waivedBy;
                    return (
                      <tr key={p.id} className="border-b b-line-soft/50">
                        <td className="px-2 py-1 font-mono tx2" dir="ltr">{p.id}</td>
                        <td className="px-2 py-1 font-mono tx3" dir="ltr">{p.activityId}</td>
                        <td className="px-2 py-1 tx1">{p.titleFa}</td>
                        <td className="px-2 py-1 tx2">{t(POINT_LABEL[p.type], lang)}</td>
                        <td className="px-2 py-1 tx3" dir="ltr">{p.party}</td>
                        <td className="px-2 py-1">
                          {blocked ? (
                            <span className="rounded bg-rose-400/15 px-1.5 py-0.5 text-[8.5px] text-rose-300">{rtl ? "کار متوقف" : "work blocked"}</span>
                          ) : p.signedAt ? (
                            <span className="rounded bg-emerald-400/15 px-1.5 py-0.5 text-[8.5px] text-emerald-300">{rtl ? "امضاشده" : "signed"} <span dir="ltr">{p.signedAt}</span></span>
                          ) : p.waivedBy ? (
                            <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[8.5px] text-amber-200">{rtl ? "صرف‌نظر:" : "waived:"} {p.waivedBy}</span>
                          ) : (
                            <span className="rounded border b-line-soft px-1.5 py-0.5 text-[8.5px] tx3">{rtl ? "در انتظار" : "pending"}</span>
                          )}
                          {blocked && (
                            <button
                              onClick={() => signHoldPoint(p.id)}
                              className="ms-1 rounded border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 text-[8.5px] text-emerald-300 transition hover:bg-emerald-400/20"
                            >
                              {rtl ? "امضا و رفع انسداد" : "sign & release"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!gate.ok && (
                <div className="mt-2 rounded-xl border border-rose-400/40 bg-rose-400/10 px-3 py-2 text-[9.5px] text-rose-200">
                  {rtl ? "ادامه کار مجاز نیست — نقاط توقف باز:" : "Work cannot proceed — open hold points:"} <span dir="ltr">{gate.blockedBy.join(" · ")}</span>
                </div>
              )}
            </Section>
          </>
        )}

        {/* ═══ تب ۲: بازرسی و آزمون ═══ */}
        {tab === "inspection" && (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Kpi label={rtl ? "قبولی بار اول" : "First pass yield"} value={`${fpy.toFixed(0)}%`} tone={fpy < 85 ? "text-amber-200" : "text-emerald-300"} />
              <Kpi label="DPMO" value={dpmoValue.toFixed(0)} hint={`${rtl ? "سطح سیگما" : "sigma"} ${sigma.toFixed(2)}`} />
              <Kpi label={rtl ? "نرخ تعمیر جوش" : "Weld repair rate"} value={`${weld.ratePct.toFixed(1)}%`} tone={weld.welderSuspended ? "text-rose-300" : "text-emerald-300"} hint={weld.welderSuspended ? (rtl ? "تعلیق صلاحیت جوشکار" : "welder suspended") : undefined} />
              <Kpi label={rtl ? "پذیرش بتن (ACI)" : "Concrete acceptance"} value={concrete.ok ? (rtl ? "قبول" : "pass") : (rtl ? "مردود" : "fail")} tone={concrete.ok ? "text-emerald-300" : "text-rose-300"} hint={concrete.reasons.join(" · ") || `f'c=30MPa`} />
            </div>

            <Section title={rtl ? "درخواست‌های بازرسی و نتیجه" : "Inspection requests"} note={rtl ? "اعلان کمتر از ۴۸ ساعت نقض قرارداد است" : "notice under 48h breaches contract"}>
              <table className="w-full text-[9.5px]">
                <thead className="tx3">
                  <tr className="border-b b-line-soft">
                    <Th>IR</Th>
                    <Th>{rtl ? "موضوع" : "Subject"}</Th>
                    <Th>{rtl ? "اعلان" : "Notice"}</Th>
                    <Th>{rtl ? "نتیجه" : "Result"}</Th>
                    <Th>{rtl ? "امضای غیرقابل انکار" : "Signature"}</Th>
                  </tr>
                </thead>
                <tbody>
                  {irEval.map(({ ir, notice, outcome }) => {
                    const sig = signed[ir.id];
                    return (
                      <tr key={ir.id} className="border-b b-line-soft/50">
                        <td className="px-2 py-1 font-mono tx2" dir="ltr">{ir.id}</td>
                        <td className="px-2 py-1 tx1">{ir.titleFa}</td>
                        <td className="px-2 py-1">
                          <span className={`rounded px-1.5 py-0.5 text-[8.5px] ${notice.ok ? "border b-line-soft tx3" : "bg-amber-400/15 text-amber-200"}`} dir="ltr">
                            {notice.leadHours}h {notice.ok ? "" : rtl ? "· دیرهنگام" : "· late"}
                          </span>
                        </td>
                        <td className="px-2 py-1">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[8.5px] ${
                              outcome === "accepted" ? "bg-emerald-400/15 text-emerald-300" : outcome === "conditional" ? "bg-amber-400/15 text-amber-200" : "bg-rose-400/15 text-rose-300"
                            }`}
                          >
                            {outcome === "accepted" ? (rtl ? "پذیرش" : "accepted") : outcome === "conditional" ? (rtl ? "مشروط" : "conditional") : rtl ? "مردود" : "rejected"}
                          </span>
                        </td>
                        <td className="px-2 py-1">
                          {sig ? (
                            <span className={`rounded px-1.5 py-0.5 font-mono text-[8.5px] ${verifySignature({ id: ir.id, defects: ir.defects }, sig) ? "bg-emerald-400/15 text-emerald-300" : "bg-rose-400/15 text-rose-300"}`} dir="ltr">
                              #{sig.hash}
                            </span>
                          ) : (
                            <button onClick={() => signIr(ir.id)} className="rounded border border-sky-400/40 bg-sky-400/10 px-2 py-0.5 text-[8.5px] text-sky-200 transition hover:bg-sky-400/20">
                              {rtl ? "امضای بازرس" : "sign"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Section>

            <Section title={rtl ? "نمودار پایش نرخ تعمیر جوش (I-MR)" : "Weld repair control chart"} note={`UCL ${limits.ucl.toFixed(2)} · x̄ ${limits.mean.toFixed(2)} · LCL ${Math.max(0, limits.lcl).toFixed(2)}`}>
              <div className="flex h-24 items-end gap-1">
                {WELD_SERIES.map((v, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t"
                    style={{
                      height: `${Math.max(4, (v / Math.max(...WELD_SERIES, limits.ucl)) * 100)}%`,
                      background: ooc.violating.includes(i) ? "rgba(244,63,94,0.6)" : v > 3 ? "rgba(251,191,36,0.55)" : "rgba(52,211,153,0.5)",
                    }}
                    title={`${v}%`}
                  />
                ))}
              </div>
              <div className="mt-1 flex flex-wrap gap-2 text-[8.5px] tx4">
                <span dir="ltr">{WELD_SERIES.length} periods</span>
                {ooc.trend && <span className="text-amber-200">{rtl ? "روند صعودی شش‌نقطه‌ای" : "6-point trend"}</span>}
                {ooc.shift && <span className="text-amber-200">{rtl ? "شیفت هفت‌نقطه‌ای" : "7-point shift"}</span>}
                {ooc.violating.length > 0 && <span className="text-rose-300">{rtl ? "نقطه خارج از حد کنترل" : "point beyond control limit"}</span>}
              </div>
            </Section>
          </>
        )}

        {/* ═══ تب ۳: عدم انطباق و اقدام اصلاحی ═══ */}
        {tab === "ncr" && (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Kpi label={rtl ? "NCR بحرانی باز" : "Open critical NCR"} value={String(ncrOpenCritical)} tone={ncrOpenCritical ? "text-rose-300" : "text-emerald-300"} />
              <Kpi label={rtl ? "فراتر از مهلت" : "Overdue"} value={String(ncrOverdueCount)} tone={ncrOverdueCount ? "text-amber-200" : "tx1"} />
              <Kpi label={rtl ? "نرخ بسته‌شدن" : "Closure rate"} value={`${closure.toFixed(0)}%`} />
              <Kpi label={rtl ? "هزینه عدم کیفیت" : "COPQ"} value={`${coq.copqPct.toFixed(2)}%`} hint={rtl ? "از هزینه پروژه" : "of project cost"} tone={coq.copqPct > 2 ? "text-amber-200" : "tx1"} />
            </div>

            <Section title={rtl ? "دفتر عدم انطباق" : "NCR register"} note={rtl ? "مهلت: بحرانی ۷ روز · عمده ۱۴ روز · جزئی ۳۰ روز" : "due: critical 7d · major 14d · minor 30d"}>
              <table className="w-full text-[9.5px]">
                <thead className="tx3">
                  <tr className="border-b b-line-soft">
                    <Th>NCR</Th>
                    <Th>{rtl ? "شرح" : "Description"}</Th>
                    <Th>{rtl ? "شدت" : "Severity"}</Th>
                    <Th>{rtl ? "سن" : "Age"}</Th>
                    <Th>{rtl ? "تعیین تکلیف" : "Disposition"}</Th>
                    <Th>CAPA</Th>
                  </tr>
                </thead>
                <tbody>
                  {ncrs.map((n) => {
                    const disp = dispositionAllowed(n.disposition, n.concessionBy);
                    const needsCapa = capaRequired(n.severity, n.recurrence);
                    return (
                      <tr key={n.id} className="border-b b-line-soft/50">
                        <td className="px-2 py-1 font-mono tx2" dir="ltr">{n.id}</td>
                        <td className="px-2 py-1 tx1">{n.titleFa}</td>
                        <td className="px-2 py-1">
                          <span className={`rounded px-1.5 py-0.5 text-[8.5px] ${n.severity === "critical" ? "bg-rose-400/15 text-rose-300" : n.severity === "major" ? "bg-amber-400/15 text-amber-200" : "border b-line-soft tx3"}`}>
                            {n.severity === "critical" ? (rtl ? "بحرانی" : "critical") : n.severity === "major" ? (rtl ? "عمده" : "major") : rtl ? "جزئی" : "minor"}
                          </span>
                        </td>
                        <td className={`px-2 py-1 tabular-nums ${ncrOverdue(n, now) ? "text-rose-300" : "tx3"}`} dir="ltr">
                          {ncrAgeDays(n, now)}d{n.closedAt ? " ✓" : ""}
                        </td>
                        <td className="px-2 py-1">
                          <span className={`rounded px-1.5 py-0.5 text-[8.5px] ${disp.ok ? "border b-line-soft tx3" : "bg-rose-400/15 text-rose-300"}`} dir="ltr">
                            {n.disposition}
                            {!disp.ok && ` · ${rtl ? "نیازمند ارفاق" : "concession required"}`}
                          </span>
                        </td>
                        <td className="px-2 py-1">
                          {n.capaId ? (
                            <span className="rounded bg-emerald-400/15 px-1.5 py-0.5 font-mono text-[8.5px] text-emerald-300" dir="ltr">{n.capaId}</span>
                          ) : needsCapa ? (
                            <span className="rounded bg-rose-400/15 px-1.5 py-0.5 text-[8.5px] text-rose-300">{rtl ? "الزامی — تخصیص نشده" : "required"}</span>
                          ) : (
                            <span className="tx4">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Section>

            <Section title={rtl ? "طبقه‌بندی خودکار عدم انطباق تازه" : "Auto-classification of a new finding"} note={rtl ? "ایمنی/سازه‌ای ⇐ بحرانی · عملکردی یا دوباره‌کاری بالای ۵۰۰ میلیون ⇐ عمده" : "safety/structural ⇒ critical · functional or rework ≥ 500M ⇒ major"}>
              <div className="grid gap-2 md:grid-cols-3">
                {[
                  { fa: "نشتی در اتصال فلنجی خط آتش‌نشانی", input: { safetyImpact: true, structuralImpact: false, reworkCost: 40_000_000, functionalImpact: true } },
                  { fa: "لقی بولت‌های پایه پمپ P-03", input: { safetyImpact: false, structuralImpact: false, reworkCost: 620_000_000, functionalImpact: true } },
                  { fa: "خش سطحی روی نرده دسترسی", input: { safetyImpact: false, structuralImpact: false, reworkCost: 12_000_000, functionalImpact: false } },
                ].map((c) => {
                  const sev = ncrSeverity(c.input);
                  return (
                    <div key={c.fa} className="rounded-xl border b-line-soft bg-black/15 p-2">
                      <div className="text-[9.5px] tx1">{c.fa}</div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className={`rounded px-1.5 py-0.5 text-[8.5px] ${sev === "critical" ? "bg-rose-400/15 text-rose-300" : sev === "major" ? "bg-amber-400/15 text-amber-200" : "border b-line-soft tx3"}`}>
                          {sev === "critical" ? (rtl ? "بحرانی" : "critical") : sev === "major" ? (rtl ? "عمده" : "major") : rtl ? "جزئی" : "minor"}
                        </span>
                        <span className="text-[8.5px] tx4">{rtl ? "مهلت" : "due"} {sev === "critical" ? 7 : sev === "major" ? 14 : 30}{rtl ? " روز" : "d"}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Section>

            <Section title={rtl ? "تحلیل پارتو علل عدم انطباق" : "Pareto of causes"} note={rtl ? "علل حیاتی = پوشش‌دهنده ۸۰٪ نخست" : "vital few = first 80%"}>
              <div className="space-y-1">
                {paretoRows.map((r) => (
                  <div key={r.cause} className="flex items-center gap-2">
                    <span className="w-24 shrink-0 text-[9.5px] tx1">{r.cause}</span>
                    <div className="h-3 flex-1 overflow-hidden rounded bg-black/25">
                      <div className="h-full rounded" style={{ width: `${r.cumPct}%`, background: r.vital ? "rgba(244,63,94,0.5)" : "rgba(148,163,184,0.35)" }} />
                    </div>
                    <span className="w-24 shrink-0 text-end text-[8.5px] tabular-nums tx3" dir="ltr">
                      {r.count} · {r.cumPct.toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </Section>

            <Section title={rtl ? "هزینه کیفیت (CoQ)" : "Cost of quality"} note={rtl ? "نسبت انطباق به عدم انطباق هرچه بزرگ‌تر، بالغ‌تر" : "higher conformance ratio = more mature"}>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                <Kpi label={rtl ? "پیشگیری" : "Prevention"} value={`${(8.4).toFixed(1)}B`} />
                <Kpi label={rtl ? "ارزیابی" : "Appraisal"} value={`${(12.6).toFixed(1)}B`} />
                <Kpi label={rtl ? "شکست داخلی" : "Internal failure"} value={`${(9.8).toFixed(1)}B`} tone="text-amber-200" />
                <Kpi label={rtl ? "شکست خارجی" : "External failure"} value={`${(2.3).toFixed(1)}B`} tone="text-rose-300" />
                <Kpi label={rtl ? "نسبت انطباق" : "Conformance ratio"} value={coq.ratio.toFixed(2)} />
              </div>
            </Section>
          </>
        )}

        {/* ═══ تب ۴: کنترل مواد و گواهی‌ها ═══ */}
        {tab === "material" && (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Kpi label={rtl ? "گواهی بررسی‌شده" : "Certificates checked"} value={String(certs.length)} />
              <Kpi label={rtl ? "مردود" : "Rejected"} value={String(certRejections)} tone={certRejections ? "text-rose-300" : "text-emerald-300"} />
              <Kpi label={rtl ? "حداقل نوع گواهی" : "Min cert type"} value="EN 10204 · 3.1" />
              <Kpi label={rtl ? "طول زنجیره ردیابی" : "Trace chain"} value={String(chain.length)} hint={rtl ? "ذوب تا داکیومنت" : "heat → dossier"} />
            </div>

            <Section title={rtl ? "کنترل گواهی مواد ورودی" : "Incoming material certificates"} note={rtl ? "نصب پیش از تأیید گواهی ممنوع است" : "no installation before certificate approval"}>
              <table className="w-full text-[9.5px]">
                <thead className="tx3">
                  <tr className="border-b b-line-soft">
                    <Th>{rtl ? "شماره ذوب" : "Heat no."}</Th>
                    <Th>{rtl ? "کالا" : "Item"}</Th>
                    <Th>{rtl ? "نوع گواهی" : "Cert"}</Th>
                    <Th>{rtl ? "گرید اعلامی / مورد نیاز" : "Grade decl./req."}</Th>
                    <Th>{rtl ? "نتیجه" : "Verdict"}</Th>
                  </tr>
                </thead>
                <tbody>
                  {certEval.map(({ c, v }) => (
                    <tr key={c.heatNo} className="border-b b-line-soft/50">
                      <td className="px-2 py-1 font-mono tx2" dir="ltr">{c.heatNo}</td>
                      <td className="px-2 py-1 tx1">{c.itemFa}</td>
                      <td className="px-2 py-1 font-mono tx3" dir="ltr">{c.certType}</td>
                      <td className="px-2 py-1 font-mono tx3" dir="ltr">{c.declaredGrade} / {c.requiredGrade}</td>
                      <td className="px-2 py-1">
                        {v.ok ? (
                          <span className="rounded bg-emerald-400/15 px-1.5 py-0.5 text-[8.5px] text-emerald-300">{rtl ? "آزادسازی" : "released"}</span>
                        ) : (
                          <span className="flex flex-wrap gap-1">
                            {v.reasons.map((r) => (
                              <span key={r} className="rounded bg-rose-400/15 px-1.5 py-0.5 text-[8px] text-rose-300" dir="ltr">{r}</span>
                            ))}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            <Section title={rtl ? "زنجیره ردیابی (Heat → Dossier)" : "Traceability chain"}>
              <div className="flex flex-wrap items-center gap-1.5">
                {chain.map((node, i) => (
                  <span key={node} className="flex items-center gap-1.5">
                    <span className="rounded-lg border b-line-soft bg-black/15 px-2 py-1 font-mono text-[9px] tx1" dir="ltr">{node}</span>
                    {i < chain.length - 1 && <span className="tx4">{rtl ? "←" : "→"}</span>}
                  </span>
                ))}
              </div>
            </Section>
          </>
        )}

        {/* ═══ تب ۵: ممیزی کیفیت و انطباق ═══ */}
        {tab === "audit" && (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Kpi label={rtl ? "امتیاز انطباق" : "Compliance score"} value={`${auditScore}`} tone={auditScore >= 85 ? "text-emerald-300" : auditScore >= 70 ? "text-amber-200" : "text-rose-300"} />
              <Kpi
                label={rtl ? "ریسک گواهینامه" : "Certification risk"}
                value={certRisk === "none" ? (rtl ? "بدون ریسک" : "none") : certRisk === "watch" ? (rtl ? "تحت پایش" : "watch") : rtl ? "تعلیق" : "suspension"}
                tone={certRisk === "none" ? "text-emerald-300" : certRisk === "watch" ? "text-amber-200" : "text-rose-300"}
              />
              <Kpi label={rtl ? "یافته عمده باز" : "Open major"} value={String(FINDINGS.filter((f) => f.severity === "major" && !f.closed).length)} />
              <Kpi label={rtl ? "کل یافته‌ها" : "Findings"} value={String(FINDINGS.length)} />
            </div>

            <Section title={rtl ? "یافته‌های ممیزی داخلی (ISO 9001)" : "Internal audit findings"} note={rtl ? "عمده −۱۰ · جزئی −۳ · مشاهده −۱ امتیاز" : "major −10 · minor −3 · observation −1"}>
              <table className="w-full text-[9.5px]">
                <thead className="tx3">
                  <tr className="border-b b-line-soft">
                    <Th>{rtl ? "بند" : "Clause"}</Th>
                    <Th>{rtl ? "یافته" : "Finding"}</Th>
                    <Th>{rtl ? "شدت" : "Severity"}</Th>
                    <Th>{rtl ? "وضعیت" : "Status"}</Th>
                  </tr>
                </thead>
                <tbody>
                  {FINDINGS.map((f) => (
                    <tr key={f.clause} className="border-b b-line-soft/50">
                      <td className="px-2 py-1 font-mono tx2" dir="ltr">{f.clause}</td>
                      <td className="px-2 py-1 tx1">{f.titleFa}</td>
                      <td className="px-2 py-1">
                        <span className={`rounded px-1.5 py-0.5 text-[8.5px] ${f.severity === "major" ? "bg-rose-400/15 text-rose-300" : f.severity === "minor" ? "bg-amber-400/15 text-amber-200" : "border b-line-soft tx3"}`}>
                          {f.severity === "major" ? (rtl ? "عمده" : "major") : f.severity === "minor" ? (rtl ? "جزئی" : "minor") : rtl ? "مشاهده" : "observation"}
                        </span>
                      </td>
                      <td className="px-2 py-1 tx3">{f.closed ? (rtl ? "بسته" : "closed") : rtl ? "باز" : "open"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            <Section title={rtl ? "پیوند با حاکمیت" : "Governance linkage"} note={rtl ? "کیفیت داده‌های مالکیت‌دار را بازنویسی نمی‌کند" : "QMS never rewrites owned data"}>
              <ul className="space-y-1 text-[9.5px] tx2">
                <li className="rounded-lg border b-line-soft bg-black/15 px-2 py-1">{rtl ? "یافته عمده باز ⇐ اقدام اصلاحی در دفتر CAPA حاکمیت (d6-p4)" : "Open major → CAPA in governance audit register (d6-p4)"}</li>
                <li className="rounded-lg border b-line-soft bg-black/15 px-2 py-1">{rtl ? "NCR بحرانی ⇐ پیشنهاد خودکار درخواست تغییر در d4" : "Critical NCR → auto-suggest change request in d4"}</li>
                <li className="rounded-lg border b-line-soft bg-black/15 px-2 py-1">{rtl ? "هزینه دوباره‌کاری ⇐ ثبت به‌عنوان هزینه واقعی در d5 (مالک AC)" : "Rework cost → actual cost in d5 (AC owner)"}</li>
              </ul>
            </Section>
          </>
        )}

        {/* ═══ تب ۶: تحویل، پانچ و راه‌اندازی ═══ */}
        {tab === "handover" && (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Kpi label={rtl ? "پانچ کلاس A باز" : "Open class A"} value={String(punch.openA)} tone={punch.openA ? "text-rose-300" : "text-emerald-300"} />
              <Kpi label={rtl ? "پانچ کلاس B باز" : "Open class B"} value={String(punch.openB)} />
              <Kpi label={rtl ? "نرخ بستن پانچ" : "Punch closure"} value={`${punch.closureRate.toFixed(0)}%`} />
              <Kpi label={rtl ? "کامل‌بودن داکیومنت" : "Dossier completeness"} value={`${dossier.pct.toFixed(0)}%`} tone={dossier.pct < 95 ? "text-amber-200" : "text-emerald-300"} />
            </div>

            <Section title={rtl ? "دروازه تحویل مکانیکی (MC)" : "Mechanical completion gate"} note={rtl ? "پنج شرط هم‌زمان" : "five simultaneous conditions"}>
              {mc.ok ? (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-3 py-2 text-[10px] text-emerald-200">
                    {rtl ? "همه شرایط برقرار است — صدور گواهی تحویل مکانیکی مجاز" : "All conditions met — MC certificate can be issued"}
                  </div>
                  <button onClick={issueMc} className="rounded-lg border border-sky-400/40 bg-sky-400/10 px-3 py-1.5 text-[9.5px] text-sky-200 transition hover:bg-sky-400/20">
                    {rtl ? "صدور گواهی MC" : "Issue MC certificate"}
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="rounded-xl border border-rose-400/40 bg-rose-400/10 px-3 py-2 text-[10px] text-rose-200">
                    {rtl ? "تحویل مکانیکی مسدود است" : "Mechanical completion blocked"}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {mc.blockers.map((b) => (
                      <span key={b} className="rounded-lg bg-rose-400/10 px-2 py-0.5 text-[8.5px] text-rose-200" dir="ltr">{b}</span>
                    ))}
                  </div>
                </div>
              )}
            </Section>

            {mcNote && (
              <div className="rounded-xl border b-line-soft bg-black/15 px-3 py-2 text-[9.5px] tx1">{mcNote}</div>
            )}

            <Section title={rtl ? "پانچ‌لیست" : "Punch list"} note={rtl ? "کلاس A پیش از MC · کلاس B پیش از تحویل نهایی" : "class A before MC · class B before final acceptance"}>
              <table className="w-full text-[9.5px]">
                <thead className="tx3">
                  <tr className="border-b b-line-soft">
                    <Th>{rtl ? "شناسه" : "ID"}</Th>
                    <Th>{rtl ? "سیستم" : "System"}</Th>
                    <Th>{rtl ? "شرح" : "Description"}</Th>
                    <Th>{rtl ? "کلاس" : "Class"}</Th>
                    <Th>{rtl ? "وضعیت" : "Status"}</Th>
                  </tr>
                </thead>
                <tbody>
                  {punchItems.map((p) => (
                    <tr key={p.id} className="border-b b-line-soft/50">
                      <td className="px-2 py-1 font-mono tx2" dir="ltr">{p.id}</td>
                      <td className="px-2 py-1 font-mono tx3" dir="ltr">{p.systemId}</td>
                      <td className="px-2 py-1 tx1">{p.titleFa}</td>
                      <td className="px-2 py-1">
                        <span className={`rounded px-1.5 py-0.5 text-[8.5px] ${p.category === "A" ? "bg-rose-400/15 text-rose-300" : "border b-line-soft tx3"}`} dir="ltr">{p.category}</span>
                      </td>
                      <td className="px-2 py-1 tx3">{p.closed ? (rtl ? "بسته" : "closed") : rtl ? "باز" : "open"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            <Section title={rtl ? "داکیومنت کیفیت تحویل" : "Quality dossier"} note={rtl ? `${dossier.missing.length} قلم ناقص` : `${dossier.missing.length} missing`}>
              <div className="flex flex-wrap gap-1.5">
                {DOSSIER_REQUIRED.map((d) => {
                  const has = DOSSIER_DELIVERED.includes(d);
                  return (
                    <span key={d} className={`rounded-lg px-2 py-1 text-[9px] ${has ? "bg-emerald-400/10 text-emerald-300" : "bg-rose-400/10 text-rose-300"}`}>
                      {has ? "✓" : "✕"} {d}
                    </span>
                  );
                })}
              </div>
            </Section>
          </>
        )}
      </div>
    </div>
  );
}
