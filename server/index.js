import "dotenv/config";
import express from "express";
import cors from "cors";
import sql from "mssql";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import XLSX from "xlsx";
import * as aiLogic from "./aiLogic.js";
import * as ogwLogic from "./ogwLogic.js";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import * as fallbackStore from "./fallbackStore.mjs";
import * as jalaaliNs from "jalaali-js";
import nodemailer from "nodemailer";
import { createWorker } from "tesseract.js";
import { applyGuardian } from "./rccLogic.js";
import { registerDprDocRoutes } from "./dprDocApi.js";
import { canDprTransition, openDprBlocked, validateDpr } from "./pexDprLogic.js";
import { inspectionBand, inspectionScore, nextInspectionDue, ptwCanTransition, ptwMissing, severityWeight, validateIncident, validateInspection, validatePermit, woPermitGate } from "./hseFieldLogic.js";
import {
  appendTrail,
  auditCloseBlocked,
  authorityFor,
  complianceBand,
  complianceScore,
  connectorHealth,
  decisionGate,
  verifyTrail,
  workflowTick,
} from "./govLogic.js";
import {
  canProceed,
  capaRequired,
  certificationRisk,
  complianceScore as qmsComplianceScore,
  costOfQuality,
  dispositionAllowed,
  dossierCompleteness,
  firstPassYield,
  irNoticeCheck,
  irOutcome,
  itpBlocking,
  itpCoverage,
  mechanicalCompletionGate,
  ncrClosureRate,
  ncrOverdue,
  ncrSeverity,
  pareto,
  punchSummary,
  qmsEws,
  signRecord,
  verifyCertificate,
} from "./qmsLogic.js";
import { buildPexModel } from "./pexModelBundle.js";
import { activityProgress, canPostProgress, validateRoc } from "./pexLogic.js";
import { createPersistence } from "./persistence/driver.mjs";
import { MIGRATIONS, SCHEMA, allColumns, checksumOf, generateDdl, migrationPlan, schemaStats, tableDef } from "./sqlLogic.js";
import {
  documentNumber,
  estimatePages,
  exportFileName,
  toCsv,
  toExcelHtml,
  toPrintHtml,
  toWordHtml,
  validateLetterhead,
} from "./rptLogic.js";
import {
  ACTIVITY_COMPARE_FIELDS,
  CONNECTORS,
  INTEGRATION_VERSION,
  TEMPLATE_CATALOG,
  diffRows,
  extractXer,
  generateOpenApi,
  integrationStats,
  parseImport,
  parseXer as parseXerTables,
  templateByCode,
  templateCsv,
  templateGuide,
  toYaml,
} from "./itgLogic.js";
import {
  CATEGORY_BY_CODE,
  EQM_DOMAIN_ID,
  EQM_VERSION,
  availability,
  daysBetween,
  downtimeHours,
  equipmentAge,
  equipmentCostPerHour,
  eqmEws,
  fleetSummary,
  maintenanceBacklog,
  mttr,
  nextPmDue,
  rentalCostAccrued,
  straightLineDepreciation,
  utilization,
  workHoursSum,
  EQP_VERSION,
  EQP_KPI_CATALOG,
  EWS_EQP_RULES,
  ISO14224_TAXONOMY,
  buyVsRent,
  canAdvanceDispatch,
  dispatchPrecheck,
  equipmentHealthScore,
  equipmentQrPayload,
  ewsEqp,
  fleetKpiBoard,
  fuelSummary,
  iso14224Code,
  maintenanceCostRatio,
  oee,
  partsToRequisition,
  pmCompliance,
  pmDueByBasis,
  rcaPareto,
  specificFuelConsumption,
  tco,
  validateDispatch,
  validateFuelLog,
  validatePmSchedule,
  validateSparePart,
  EQP_REPORT_BY_CODE,
  EQP_REPORT_CATALOG,
  EQP_REPORT_VERSION,
  buildCostAllocationReport,
  buildDispatchSheetReport,
  buildEquipmentIdCardReport,
  buildExecutiveOnePager,
  applyPostingToActual,
  buildCostPostings,
  isBlockingOrder,
  planActivityLocks,
  buildFleetPerformanceReport,
  buildMaintenanceReport,
  buildSparePartsReport,
  eqpPublishGate,
  eqpReportRows,
} from "./eqmLogic.js";

import {
  DEFAULT_CONTRACT_REVIEW_DAYS,
  DISCIPLINES,
  DISCIPLINE_FA,
  DOC_TYPE_FA,
  ENG_DOMAIN_ID,
  ENG_KPI_TARGETS,
  ENG_REPORT_CATALOG,
  ENG_VERSION,
  PURPOSE_FA,
  REVIEW_CODE_FA,
  ROC_STEPS,
  asBuiltStatus,
  clashSummary,
  crsGate,
  crsSummary,
  deliverableProgress,
  engineeringAlerts,
  engineeringKpis,
  engineeringOverview,
  engineeringProgress,
  getEngReport,
  idcStatus,
  isAudienceAllowed,
  planChangeRequests,
  planIfcLocks,
  reviewAging,
  reviewDaysFor,
  tqAging,
  validateMdr,
  vprSummary,
  buildEngReport,
  engReportMeta,
  ifcLockCoverage,
  engKpiSnapshots,
  periodCodeOf,
  engProgressSnapshots,
  planEotClaims,
  planDesignNcrActions,
  auditVendorPoRefs,
  planRocBackfill,
  planMaterialRequests,
  planPurchaseRequisitions,
  procurementAlerts,
  poRegistry,
} from "./engLogic.js";
import { DEMO_SUBJECTS as ENG_RBAC_SUBJECTS, evaluate as rbacEvaluate } from "./rbacLogic.js";
import {
  CNT_VERSION,
  CONTRACT_TYPE_FA,
  DEDUCTION_TYPE_FA,
  IPC_WORKFLOW_FA,
  PRICING_BASIS_FA,
  RATE_STATUS_FA,
  boqRollup,
  CERTIFICATE_TYPE_FA,
  INDEX_STATUS_FA,
  PUNCH_CATEGORY_FA,
  RETAINAGE_ENTRY_FA,
  adjustmentBatch,
  certificateGate,
  planRetainageRelease,
  /* ماژول کیفیت تابع هم‌نامی دارد با قرارداد متفاوت (category:"A" و
   * closed منطقی). نام مستعار می‌گیرد تا هیچ‌کدام سایهٔ دیگری نشود. */
  punchSummary as comPunchSummary,
  retainageBalance,
  warrantyEnd,
  computeIpc,
  cumulativeAdjustment,
  ipcNextActions,
  materialDiff,
  ipcTransition,
  isIpcLocked,
  nextIpcSerial,
  contractCeiling,
  contractSummary,
  lineAmount,
  mappingCoverage,
  measurementQuantity,
  measurementTotal,
  milestoneProgress,
  qualityGate,
  validateBoq,
  validateBoqItem,
  /* ── ضمانت‌نامه و پیش‌پرداخت (D7) ── */
  GUARANTEE_TYPES,
  GUARANTEE_TYPE_FA,
  GUARANTEE_STATUS_FA,
  GUARANTEE_ALERT_FA,
  GUARANTEE_CUSTOMARY_PCT,
  ADVANCE_STATUS_FA,
  ADVANCE_DEFAULT_RECOVERY_PCT,
  ADVANCE_CUSTOMARY_CAP_PCT,
  guaranteeState,
  guaranteeRegister,
  validateGuaranteeInput,
  canActOnGuarantee,
  advanceLedger,
  advanceRecovery,
  validateAdvanceInput,
  guaranteeHealth,
  /* ── صورت‌وضعیت پیمانکار جزء (D8) ── */
  SUB_IPC_STATES,
  SUB_IPC_STATE_FA,
  SUB_IPC_TRANSITIONS,
  VARIANCE_FLAG_FA,
  BACK_TO_BACK_SOURCES,
  BACK_TO_BACK_SOURCE_FA,
  BACK_TO_BACK_STATUS_FA,
  subIpcTotals,
  canTransitionSubIpc,
  isSubIpcLocked,
  subIpcRegister,
  validateBackToBack,
  /* ── پیشرفت پیمان (D9) ── */
  progressBreakdown,
  financialProgress,
  progressGap,
  PROGRESS_GAP_FA,
  sCurve,
  milestoneRollup,
  MILESTONE_STATUS_FA,
  MILESTONE_EFFECTIVE_STATUS,
  progressSnapshot,
  /* کمک‌تابع‌های عددی موتور: در server/index.js معادلی ندارند و
   * بدون import، ReferenceError خاموش می‌شود. */
  num,
  round,
  /* ── سنجه و هشدار زودهنگام (D10) ── */
  CONTRACT_KPI_CATALOG,
  ipcCycle,
  extraWorkRatio,
  contractKpis,
  ALERT_SEVERITY_FA,
  DEFAULT_ALERT_RULES,
  HEALTH_BAND_FA,
  kpiTrend,
  contractScorecard,
  FIN_POSTABLE_STATES,
  ipcPostability,
  buildFinPosting,
  budgetImpact,
  reconcileFinPostings,
  contractFinSummary,
  CNT_REPORT_CATALOG,
  getCntReport,
  isCntAudienceAllowed,
  buildCntReport,
} from "./cntLogic.js";

import {
  TS_STATE_FA,
  TS_STATE_RANK,
  tsNextStates,
  canTransition,
  isTsEditable,
  validateTsEntry,
  hasBlockingIssue,
  ATTENDANCE_FA,
  timesheetId,
  computeTsEntries,
  tsTotals,
  buildTsCostLines,
  tsCostSummary,
  resolveSyncConflict,
  isDateLocked,
  periodOf,
  canLockPeriod,
  validateAdjustment,
  effectiveHours,
  ADJUSTMENT_TYPE_FA,
  dailySummary,
  IRAN_LABOR_LAW,
  /* D5 — بهره‌وری و ریشه‌یابی */
  RCA_CATALOG,
  RCA_BY_CODE,
  RCA_CATEGORIES,
  RCA_CATEGORY_FA,
  METRIC_CODES,
  METRIC_FA,
  PI_THRESHOLD,
  CALIBRATION_MIN_PERIODS,
  computeProductivity,
  productivitySummary,
  productivityByTrade,
  validateRca,
  canRaiseClaim,
  rcaRollup,
  calibrateStdRate,
  buildMetricSnapshots as hrmBuildMetricSnapshots,
  canFinalizeProductivity,
  canOverwriteSnapshot,
  /* D6 — اکیپ و نیروی پیمانکاری */
  CREW_ROLES,
  CREW_ROLE_FA,
  CREW_STATUSES,
  CREW_STATUS_FA,
  CREW_SKILL_RATIO,
  CREW_MAX_SPAN,
  PRICING_MODELS,
  PRICING_MODEL_FA,
  SUB_ATT_STATES,
  SUB_ATT_STATE_FA,
  crewComposition,
  isMemberActiveOn,
  validateMembership,
  canActivateCrew,
  canDisbandCrew,
  validateSubAttendance,
  assertNoDoubleCount,
  buildSubIpc,
  canApproveSubIpc,
  crewUtilization,
  crewBoardSummary,
  /* D7 — پذیرش، احکام و انطباق */
  PERSON_STATUSES,
  PERSON_STATUS_FA,
  EMPLOYMENT_TYPES,
  EMPLOYMENT_TYPE_FA,
  /* نام مستعار: `DOC_TYPE_FA` از ماژول مدارک (d1) قبلاً وارد شده و
   * معنایش «نوع مدرک پروژه» است؛ این یکی «نوع مدرک پرسنلی» است. دو
   * مفهوم متفاوت با یک نام، دیر یا زود به اشتباه استفاده می‌شوند. */
  DOC_TYPES as HRM_DOC_TYPES,
  DOC_TYPE_FA as HRM_DOC_TYPE_FA,
  DOC_EXPIRY_WARN_DAYS,
  MOB_GATES,
  MOB_GATE_FA,
  MOB_REQ_STATES,
  MOB_REQ_STATE_FA,
  MOB_REQUEST_TYPES,
  MOB_REQUEST_TYPE_FA,
  DEMOB_ITEMS,
  DEMOB_ITEM_FA,
  DEMOB_OPTIONAL,
  personNextStates,
  docState,
  docCompliance,
  skillMatrix,
  evaluateMobGates,
  canTransitionPerson,
  demobProgress,
  validateMobRequest,
  canTransitionMobRequest,
  compliancePanel,
  expiryWatch,
  /* D8 — تحلیل، هیستوگرام و گزارش */
  HR_KPI_CODES,
  HR_KPI_FA,
  HR_KPI_TARGETS,
  HISTOGRAM_VARIANCE_THRESHOLD,
  TRADE_BY_CODE,
  manpowerHistogram,
  manpowerSCurve,
  hrKpiSet,
  mhBreakdown,
  hrAnalyticsAlerts,
  hrHeadlineFa,
  capacityMh,
  /* D9 — همگام‌سازی میدانی و کارتابل تعارض */
  SYNC_BATCH_MAX,
  SIGNATURE_ROLES,
  SIGNATURE_ROLE_FA,
  CONFLICT_RESOLUTIONS,
  CONFLICT_RESOLUTION_FA,
  DEVICE_STALE_WARN_DAYS,
  DEVICE_STALE_CRIT_DAYS,
  batchFingerprint,
  validateSyncBatch,
  summarizeSyncBatch,
  verifySignatureChain,
  canCloseConflict,
  deviceHealth,
  /* D11 — گزارش‌های رسمی و خروجی چندقالبی */
  HRM_REPORT_CATALOG,
  HRM_DEFAULT_LETTERHEAD,
  hrmReportByCode,
  hrmPublishGate,
  buildManpowerReport,
  buildTimesheetCertificate,
  buildComplianceReport,
  hrmReportRows,
  /* D12 — ارسال هزینهٔ نیرو به مالی */
  rateCardFor,
  rateLookupFrom,
  buildLaborPostings,
  laborPostingGate,
  applyLaborPosting,
  laborEventKey,
  /* D13 — قرارداد رویداد و یکپارچه‌سازی */
  EVENT_SCHEMA_VERSION,
  EVENT_STATE_FA,
  EVENT_MAX_ATTEMPTS,
  HRM_EVENT_CATALOG,
  buildEvent,
  nextDeliveryState,
  isDueForRetry,
  outboxHealth,
  reconcilePostings,
} from "./hrmLogic.js";

import {
  SYSTEM_TYPE_FA,
  SYSTEM_STATUS_FA,
  GATE_TYPE_FA as COM_GATE_TYPE_FA,
  BOUNDARY_KIND_FA,
  CRITICALITY_FA,
  GATE_ORDER as COM_GATE_ORDER,
  validateSystemInput,
  detectCycle,
  buildSystemTree,
  flattenTree,
  validateBoundary,
  assertSinglePrimary,
  boundaryCoverage,
  priorityMatrix,
  validateMilestone,
  validateGateSequence,
  gateSlip,
  completionPlan,
  systemizationSummary,
  systemizationMatrix,
  PACK_TYPE_FA,
  PACK_STATUS_FA,
  TEST_KIND_FA,
  SHEET_RESULT_FA,
  TEST_KINDS_BY_TYPE,
  validatePackInput,
  validateSheetInput,
  validateSheetLines,
  sheetVerdict,
  canSignSheet,
  packProgress,
  coldTestClearance,
  preCommSummary,
} from "./comLogic.js";

import {
  CONTROL_LEVELS, CONTROL_LEVEL_FA, HAZARD_CATEGORIES, HAZARD_CATEGORY_FA,
  JSA_STATUS_FA, RISK_BANDS, MAX_APPROVABLE_RESIDUAL, PPE_ONLY_RISK_THRESHOLD,
  riskBand, riskScore,
  validateJsaInput, validateHazardInput, validateControlInput,
  evaluateHazard, jsaSummary, canApproveJsa, jsaState, jsaSupportsPermit,
  PERMIT_TYPES, PERMIT_TYPE_FA, PERMIT_STATUS_FA, HIGH_RISK_PERMITS,
  GAS_LIMITS, GAS_TEST_VALIDITY_MINUTES, GAS_TEST_REQUIRED_PERMITS,
  ISOLATION_REQUIRED_PERMITS, ISOLATION_TYPES, ISOLATION_TYPE_FA, ISOLATION_STATUS_FA,
  APPROVAL_LEVELS, APPROVAL_LEVEL_FA,
  validatePermitInput, permitState, rfsuSafetyClearance,
  evaluateGasTest, latestGasTest, isolationState, approvalChain, canSignPermit,
  precautionState, canIssuePermit, canClosePermit, canSuspendPermit, canResumePermit,
  ptwSummary,
  INCIDENT_TYPES, INCIDENT_TYPE_FA, SEVERITIES, SEVERITY_FA,
  INJURY_TYPES, INJURY_TYPE_FA, BODY_PARTS, BODY_PART_FA,
  CAUSE_LEVELS, CAUSE_LEVEL_FA, CAUSE_CATEGORIES, CAUSE_CATEGORY_FA,
  CAPA_TYPES, CAPA_TYPE_FA, CAPA_STATUS_FA, INVESTIGATION_STATUS_FA,
  FLASH_REPORT_SLA_MINUTES, MIN_ROOT_CAUSE_DEPTH,
  validateIncidentInput, suggestSeverity,
  validateInjuredPersonInput, validateRootCauseInput, validateCapaInput,
  flashReportStatus, injurySummary, rootCauseTree, capaSummary,
  requiresInvestigation, canCloseInvestigation, canCloseIncidentFull,
  manHourTotal, safetyMetricsFull,
  FINDING_CATEGORIES, FINDING_CATEGORY_FA, FINDING_STATUSES, FINDING_STATUS_FA,
  VIOLATION_TYPES, VIOLATION_TYPE_FA, STOP_WORK_SCOPES, STOP_WORK_SCOPE_FA,
  VIOLATION_STATUSES, VIOLATION_STATUS_FA,
  MANDATORY_STOP_WORK_TYPES, VIOLATION_SLA_DAYS, INSPECTION_PASS_SCORE,
  validateFindingInput, validateViolationInput,
  stopWorkRequirement, suggestViolationDueDate,
  findingSummary, violationState, activityStopWorkState,
  canReleaseViolation, canCloseInspection, violationSummary,
  /* بخش ۶ — آموزش، بهداشت شغلی و محیط‌زیست */
  TRAINING_TYPES, TRAINING_TYPE_FA, SESSION_STATUS_FA,
  PPE_TYPES, PPE_TYPE_FA, CRITICAL_PPE, PPE_STATUS_FA,
  HAZARD_TYPES, HAZARD_TYPE_FA,
  EXAM_TYPES, EXAM_TYPE_FA, FITNESS_RESULTS, FITNESS_FA,
  WASTE_TYPES, WASTE_TYPE_FA, MANIFEST_REQUIRED_WASTE,
  DISPOSAL_METHODS, DISPOSAL_METHOD_FA, WASTE_STATUS_FA,
  MONITORING_MEDIA, MEDIUM_FA, EXPIRY_WARNING_DAYS, INDUCTION_COURSE_CODE,
  trainingSessionState, personTrainingMatrix, personPpeState, personHealthState,
  personSiteClearance, nextExamDate,
  wasteLogState, wasteSummary, monitoringState, monitoringSummary,
  trainingSummary, healthPpeSummary,
  validateTrainingSessionInput, validatePpeInput, validateHealthExamInput,
  validateWasteInput, validateMonitoringInput,
  /* بخش ۷ — شاخص، نمره و هشدار زودهنگام */
  HSE_METRIC_CODES, HSE_METRIC_FA, HSE_METRIC_UNIT, HSE_METRIC_DIRECTION,
  HSE_METRIC_DEFAULT_TARGET, HSE_ALERT_RULES, HSE_ALERT_RULE_FA,
  HSE_ALERT_DEFAULTS, HSE_SCORE_WEIGHTS, HSE_SCORE_BLOCKED_CAP,
  /* `periodCodeOf` در engLogic هم هست؛ alias می‌گیرد تا تعریف
   * ماژول مهندسی دست‌نخورده بماند. */
  periodCodeOf as hsePeriodCodeOf, periodRange, hseDashboard, buildMetricSnapshots,
  metricTrend, hseHealthContribution, validateAlertRuleInput,
} from "./hseLogic.js";

/** jalaali-js فقط CJS دارد؛ interop امن برای ESM */
const jalaali = (jalaaliNs.default ?? jalaaliNs);

const app = express();
registerDprDocRoutes(app);
const PORT = Number(process.env.PORT || 4000);
const startedAt = Date.now();

/* ─────────────── لایه ماندگاری (sql-v1) ───────────────
 * اگر SQL Server در دسترس باشد از آن استفاده می‌شود، وگرنه درایور فایلی.
 * تنزل آرام است تا نبود پایگاه داده کل API را از کار نیندازد. */
let persistence = null;
const persistenceReady = createPersistence({
  getPool: async () => (process.env.SQL_SERVER ? getPool({ headers: {} }) : null),
  sqlModule: sql,
  dataDir: path.resolve(process.cwd(), process.env.DATA_DIR || "server/data"),
  preferSql: process.env.PERSIST_DRIVER !== "json",
})
  .then((p) => {
    persistence = p;
    return p;
  })
  .catch((err) => {
    console.error("[persistence] bootstrap failed:", err.message);
    return null;
  });

async function repo() {
  if (!persistence) await persistenceReady;
  if (!persistence) throw Object.assign(new Error("لایه ماندگاری در دسترس نیست"), { code: "PERSISTENCE_UNAVAILABLE" });
  return persistence.repo;
}

/** جدول‌هایی که از راه REST عمومی قابل دسترسی‌اند — بقیه فقط از مسیر اختصاصی خودشان. */
const PUBLIC_TABLES = new Set([
  "Industry", "Project", "Document", "Transmittal", "WbsNode", "Activity", "ActivityRelation",
  "Baseline", "Period", "ProgressEntry", "EvmSnapshot", "KpiSnapshot", "Risk", "ChangeRequest",
  "Claim", "CostAccount", "PaymentCertificate", "Ncr", "InspectionRecord", "WorkforceMember",
  "Timesheet", "Correspondence", "MeetingMinute", "LessonLearned", "ReportIssue",
  "Equipment", "EquipmentMeter", "EquipmentRental", "MaintenanceOrder",
  "EquipmentDispatch", "EquipmentFuelLog", "PmSchedule", "SparePart", "PartTransaction",
  "ProcessTree",
]);

const EDITABLE_TAXONOMY_DOMAINS = new Set(["d6", "d20"]);

const taxonomyText = (value, max = 1200) => String(value ?? "").trim().slice(0, max);
const taxonomyBi = (value, fallback = "") => ({
  fa: taxonomyText(value?.fa ?? fallback),
  en: taxonomyText(value?.en ?? value?.fa ?? fallback),
});

/**
 * ورودیِ ویرایش ساختار را محدود می‌کنیم تا Payload پایگاه محلِ اجرای کد
 * یا رکوردهای بی‌نهایت بزرگ نشود. این endpoint فقط برای d6/d20 است.
 */
function normalizeTaxonomyProcesses(input) {
  if (!Array.isArray(input) || input.length > 60) throw Object.assign(new Error("فهرست فرآیندها نامعتبر است"), { code: "INVALID_TAXONOMY" });
  return input.map((raw, processIndex) => {
    const id = taxonomyText(raw?.id, 80);
    if (!/^[A-Za-z0-9_-]+$/.test(id)) throw Object.assign(new Error(`شناسه فرآیند ${processIndex + 1} نامعتبر است`), { code: "INVALID_TAXONOMY" });
    const subs = Array.isArray(raw?.subs) ? raw.subs : [];
    if (subs.length > 120) throw Object.assign(new Error("تعداد زیرفرآیندها بیش از حد مجاز است"), { code: "INVALID_TAXONOMY" });
    return {
      id,
      title: taxonomyBi(raw?.title, `Process ${processIndex + 1}`),
      subs: subs.map((sub, subIndex) => {
        const subId = taxonomyText(sub?.id, 100);
        if (!/^[A-Za-z0-9_-]+$/.test(subId)) throw Object.assign(new Error(`شناسه زیرفرآیند ${processIndex + 1}.${subIndex + 1} نامعتبر است`), { code: "INVALID_TAXONOMY" });
        const links = Array.isArray(sub?.links)
          ? sub.links.slice(0, 20).map((link) => ({ to: taxonomyText(link?.to, 100), label: taxonomyBi(link?.label) }))
          : undefined;
        return {
          id: subId,
          title: taxonomyBi(sub?.title, `Sub-process ${processIndex + 1}.${subIndex + 1}`),
          activity: taxonomyBi(sub?.activity),
          source: taxonomyText(sub?.source, 200),
          sql: Array.isArray(sub?.sql) ? sub.sql.slice(0, 30).map((x) => taxonomyText(x, 100)).filter(Boolean) : [],
          output: taxonomyText(sub?.output, 200),
          connectsTo: taxonomyText(sub?.connectsTo, 200),
          ai: taxonomyText(sub?.ai, 200),
          ...(links?.length ? { links } : {}),
        };
      }),
    };
  });
}

function taxonomyResponse(req, data, status = 200) {
  return {
    status,
    body: { ok: true, data, meta: { traceId: req.requestId, timestamp: new Date().toISOString(), driver: persistence?.driver?.kind ?? "pending" } },
  };
}

/** ?where=Col:op:value&order=Col:desc&limit=&offset= → SelectSpec امن */
function parseSelectSpec(table, query) {
  const known = new Set([...table.columns, ...[{ name: "CreatedAt" }, { name: "UpdatedAt" }, { name: "RowVersion" }]].map((c) => c.name));
  const where = [];
  const raw = query.where ? (Array.isArray(query.where) ? query.where : [query.where]) : [];
  for (const item of raw) {
    const [column, op = "eq", ...rest] = String(item).split(":");
    if (!known.has(column)) throw Object.assign(new Error(`ستون ناشناخته: ${column}`), { code: "UNKNOWN_COLUMN" });
    const value = rest.join(":");
    if (op === "in") where.push({ column, op, value: value.split(",") });
    else if (op === "isnull" || op === "notnull") where.push({ column, op });
    else where.push({ column, op, value: /^-?\d+(\.\d+)?$/.test(value) ? Number(value) : value === "true" ? true : value === "false" ? false : value });
  }
  const orderBy = [];
  if (query.order) {
    const [column, dir = "asc"] = String(query.order).split(":");
    if (!known.has(column)) throw Object.assign(new Error(`ستون ناشناخته: ${column}`), { code: "UNKNOWN_COLUMN" });
    orderBy.push({ column, dir: dir === "desc" ? "desc" : "asc" });
  }
  return {
    where,
    orderBy,
    limit: Math.min(1000, Math.max(1, Number(query.limit) || 200)),
    offset: Math.max(0, Number(query.offset) || 0),
  };
}
const storageRoot = path.resolve(process.cwd(), process.env.FILE_STORAGE_PATH || "server/storage");
const maxFileBytes = Number(process.env.MAX_FILE_MB || 25) * 1024 * 1024;
const acceptedMimeTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/plain",
  "application/json",
  "application/xml",
  "text/xml",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/bmp",
  "image/tiff",
]);

fs.mkdirSync(storageRoot, { recursive: true });

app.disable("x-powered-by");
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : true,
  credentials: false,
}));
app.use(rateLimit({
  windowMs: 60 * 1000,
  limit: Number(process.env.RATE_LIMIT_PER_MINUTE || 300),
  standardHeaders: "draft-7",
  legacyHeaders: false,
}));
app.use(express.json({ limit: "15mb" }));
/* ─────────────────────────────────────────────────────────────────────
   تنزّلِ آرام به فروشگاهِ JSON هنگامِ نبودِ SQL Server

   حدود ۵۰ مسیر مستقیماً mssql صدا می‌زنند. تا پیش از این، نبودِ پایگاه
   یعنی ۵۰۰ و بازگشتِ کلاینت به داده‌ی نمونه — یعنی هیچ چیز ذخیره نمی‌شد.
   این میان‌افزار فقط خطاهایِ «اتصال» را می‌گیرد (نه خطایِ دستورِ SQL را تا
   اشتباهِ واقعی پنهان نماند) و پاسخ را از فروشگاهِ JSON می‌سازد، با نشانهٔ
   degraded در meta تا بعداً معلوم باشد داده از پایگاه نیامده است.
   ───────────────────────────────────────────────────────────────────── */
const SQL_CONNECTION_ERROR = /(ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|EHOSTUNREACH|ESOCKET|getaddrinfo|Login failed|Cannot open database|ConnectionError|socket hang up|Failed to connect|connect E)/i;

app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    try {
      const message = String(body?.error?.message ?? "");
      const isConn = res.statusCode >= 500 && body && body.ok === false && SQL_CONNECTION_ERROR.test(message);
      if (!isConn) return originalJson(body);
      const degraded = buildDegradedResponse(req, message);
      if (!degraded) return originalJson(body);
      res.status(200);
      return originalJson(degraded);
    } catch {
      return originalJson(body);
    }
  };
  next();
});

function buildDegradedResponse(req, reason) {
  const routePath = req.route?.path || req.baseUrl + (req.route?.path ?? "") || req.path;
  const table = fallbackStore.tableForRoute(routePath, req.method);
  const projectCode = req.params?.projectId || req.query?.projectCode || req.body?.ProjectCode || null;
  const meta = {
    traceId: req.requestId,
    timestamp: new Date().toISOString(),
    degraded: true,
    driver: "json",
    reason,
  };

  /* این دو مسیر شکلِ پاسخِ اختصاصی دارند */
  if (req.method === "GET" && (routePath === "/api/health" || routePath === "/api/diagnostics/readiness")) {
    return {
      ok: true,
      data: {
        status: "degraded",
        api: true,
        sql: false,
        driver: "json",
        persistence: "json",
        reason,
      },
      meta,
    };
  }

  if (req.method === "GET") {
    const items = fallbackStore.select(table, { projectCode });
    return {
      ok: true,
      data: { items, page: 1, pageSize: items.length, total: items.length, table: table ?? null },
      meta,
    };
  }

  /* نوشتن: در صورت امکان واقعاً در فروشگاهِ JSON ذخیره می‌شود */
  let data = req.body ?? {};
  if (table && req.method === "POST") {
    const saved = fallbackStore.insert(table, req.body ?? {});
    if (saved) data = saved;
  } else if (table && (req.method === "PATCH" || req.method === "PUT")) {
    const id = req.params?.id ?? req.params?.projectId ?? (req.body ?? {}).Id;
    const saved = fallbackStore.patch(table, id, req.body ?? {});
    if (saved) data = saved;
  } else if (table && req.method === "DELETE") {
    const id = req.params?.id ?? req.params?.projectId;
    data = { deleted: fallbackStore.remove(table, id) };
  }
  return { ok: true, data, meta };
}


app.use((req, res, next) => {
  const requestId = req.headers["x-request-id"] || `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  next();
});

const sanitizeFileName = (name) => path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "_").slice(-180) || "upload.bin";
const uploadStorage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, storageRoot),
  filename: (_req, file, callback) => callback(null, `${Date.now()}-${crypto.randomUUID()}-${sanitizeFileName(file.originalname)}`),
});
const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: maxFileBytes, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (acceptedMimeTypes.has(file.mimetype)) return callback(null, true);
    const error = new Error(`Unsupported file type: ${file.mimetype}`);
    error.code = "UNSUPPORTED_FILE_TYPE";
    callback(error);
  },
});

const sha256 = (filePath) => crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");

const toIsoDate = (value) => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const s = String(value).trim();
  if (!s) return null;
  const match = s.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (match) return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
};

const normalizeDigits = (value) => String(value ?? "")
  .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
  .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));

function toSqlDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const normalized = normalizeDigits(value).trim();
  const match = normalized.match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (year < 1700 && jalaali.isValidJalaaliDate(year, month, day)) {
      const gregorian = jalaali.toGregorian(year, month, day);
      return new Date(Date.UTC(gregorian.gy, gregorian.gm - 1, gregorian.gd));
    }
    const date = new Date(Date.UTC(year, month - 1, day));
    if (!Number.isNaN(date.getTime())) return date;
  }
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

const normaliseActivity = (row, index) => {
  const get = (...keys) => keys.map((key) => row[key]).find((value) => value !== undefined && value !== null && String(value).trim() !== "");
  const code = String(get("Activity ID", "ActivityID", "activity_id", "task_code", "Code", "کد فعالیت") || `ACT-${String(index + 1).padStart(4, "0")}`);
  const name = String(get("Activity Name", "Name", "task_name", "Task Name", "نام فعالیت") || code);
  const startDate = toIsoDate(get("Start", "start", "Start Date", "Planned Start", "شروع"));
  const finishDate = toIsoDate(get("Finish", "finish", "Finish Date", "Planned Finish", "پایان"));
  const durationDays = Number(get("Duration", "duration", "Original Duration", "مدت") || 0) || null;
  const progress = Number(String(get("Progress", "% Complete", "Physical % Complete", "درصد پیشرفت") || "0").replace("%", "")) || 0;
  const isCritical = ["y", "yes", "true", "1", "critical", "بله"].includes(String(get("Critical", "critical", "Is Critical", "بحرانی") || "").toLowerCase());
  const wbsCode = String(get("WBS", "WBS Code", "wbs_code", "کد WBS") || "");
  return { code, name, startDate, finishDate, durationDays, progress, isCritical, wbsCode };
};

/** تجزیه XER با موتور itg-v1 (چندجدولی: TASK + TASKPRED + PROJWBS + CALENDAR). */
function parseXer(content, projectId = "import") {
  const extracted = extractXer(parseXerTables(content), projectId, jalaali.toGregorian);
  return extracted.activities.map((a) => ({
    code: a.Code,
    name: a.NameFa,
    startDate: a.ActualStart ?? a.PlannedStart,
    finishDate: a.ActualFinish ?? a.PlannedFinish,
    durationDays: a.DurationDays,
    progress: a.PhysicalPct ?? 0,
    isCritical: Boolean(a.IsCritical),
    wbsCode: extracted.wbs.find((w) => w.Id === a.WbsId)?.Code ?? "",
  }));
}

function parseSpreadsheet(filePath, ext) {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });
  return rows.map(normaliseActivity);
}

function parseScheduleFile(filePath, originalName) {
  const ext = path.extname(originalName).toLowerCase();
  if (ext === ".xer") return parseXer(fs.readFileSync(filePath, "utf8"));
  if ([".xlsx", ".xls", ".csv"].includes(ext)) return parseSpreadsheet(filePath, ext);
  if (ext === ".mpp") {
    const error = new Error("MPP parsing requires an external MPXJ/Project conversion service. Upload XML/XER/XLSX or configure MSP_PARSER_URL.");
    error.code = "MPP_PARSER_REQUIRED";
    throw error;
  }
  const error = new Error(`Unsupported schedule import format: ${ext}`);
  error.code = "UNSUPPORTED_SCHEDULE_FORMAT";
  throw error;
}

async function extractKnowledgeText(file) {
  const extension = path.extname(file.originalname).toLowerCase();
  if (extension === ".pdf") {
    const parser = new PDFParse({ data: fs.readFileSync(file.path) });
    try {
      const result = await parser.getText();
      return result.text || "";
    } finally {
      await parser.destroy();
    }
  }
  if (extension === ".docx") {
    const result = await mammoth.extractRawText({ buffer: fs.readFileSync(file.path) });
    return result.value || "";
  }
  if ([".txt", ".csv", ".json", ".xml"].includes(extension)) {
    return fs.readFileSync(file.path, "utf8");
  }
  const error = new Error(`Text extraction is not supported for ${extension}. Use PDF, DOCX, TXT, CSV, JSON or XML.`);
  error.code = "UNSUPPORTED_KNOWLEDGE_FORMAT";
  throw error;
}

async function extractOcrText(file, languageCode = "fas+eng") {
  const extension = path.extname(file.originalname).toLowerCase();
  if ([".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tif", ".tiff"].includes(extension)) {
    const langs = String(languageCode).includes("+") ? String(languageCode).split("+") : languageCode;
    const worker = await createWorker(langs);
    try {
      const result = await worker.recognize(file.path);
      return { text: result.data.text || "", confidence: Number(result.data.confidence || 0), engine: "tesseract.js" };
    } finally {
      await worker.terminate();
    }
  }
  if (extension === ".pdf" && process.env.OCR_PDF_SERVICE_URL) {
    const form = new FormData();
    form.append("language", languageCode);
    form.append("file", new Blob([fs.readFileSync(file.path)], { type: file.mimetype }), file.originalname);
    const response = await fetch(process.env.OCR_PDF_SERVICE_URL, { method: "POST", body: form });
    if (!response.ok) throw new Error(`OCR PDF service returned HTTP ${response.status}`);
    const payload = await response.json();
    return { text: payload.text || "", confidence: Number(payload.confidence || 0), engine: "external-pdf-ocr" };
  }
  if (extension === ".pdf") {
    const error = new Error("Scanned PDF OCR requires OCR_PDF_SERVICE_URL or conversion to page images. Upload image scans or configure OCR service.");
    error.code = "OCR_PDF_SERVICE_REQUIRED";
    throw error;
  }
  const error = new Error(`OCR is not supported for ${extension}. Upload PNG/JPG/WebP/BMP/TIFF or configure PDF OCR service.`);
  error.code = "UNSUPPORTED_OCR_FORMAT";
  throw error;
}

function chunkText(text, maxChars = 1400, overlap = 180) {
  const normalized = text.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (!normalized) return [];
  const paragraphs = normalized.split(/\n\n+/).filter(Boolean);
  const chunks = [];
  let current = "";
  for (const paragraph of paragraphs) {
    if ((current + "\n\n" + paragraph).length <= maxChars) {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
      continue;
    }
    if (current) chunks.push(current);
    if (paragraph.length <= maxChars) {
      current = paragraph;
      continue;
    }
    for (let start = 0; start < paragraph.length; start += maxChars - overlap) {
      chunks.push(paragraph.slice(start, start + maxChars));
    }
    current = "";
  }
  if (current) chunks.push(current);
  return chunks;
}

const tokenizeQuestion = (question) => [...new Set(String(question).toLowerCase().match(/[\p{L}\p{N}_-]{3,}/gu) || [])].slice(0, 16);

function rankChunks(rows, question) {
  const terms = tokenizeQuestion(question);
  return rows.map((row) => {
    const content = String(row.Content || "").toLowerCase();
    const score = terms.reduce((sum, term) => sum + (content.includes(term) ? 1 : 0), 0);
    return { ...row, score };
  }).filter((row) => row.score > 0).sort((a, b) => b.score - a.score || a.ChunkIndex - b.ChunkIndex).slice(0, 6);
}

async function callGroundedAi(question, sources) {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey || !sources.length) return null;
  const context = sources.map((source, index) => `[S${index + 1}] ${source.DocumentTitle}\n${source.Content}`).join("\n\n");
  const response = await fetch(process.env.AI_RESPONSES_URL || "https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.AI_MODEL || "gpt-4.1-mini",
      instructions: "Answer only from the supplied project sources. Cite claims with [S1], [S2]. If evidence is insufficient, state that clearly. Keep contract and engineering terminology precise.",
      input: `Question: ${question}\n\nProject sources:\n${context}`,
      max_output_tokens: 900,
    }),
  });
  if (!response.ok) throw new Error(`AI provider returned HTTP ${response.status}`);
  const payload = await response.json();
  return payload.output_text || payload.output?.flatMap((item) => item.content || []).find((item) => item.type === "output_text")?.text || null;
}

async function writeAudit(pool, req, actionCode, details = {}) {
  try {
    await pool.request()
      .input("ProjectCode", sql.NVarChar(50), details.projectCode || null)
      .input("ActionCode", sql.NVarChar(80), actionCode)
      .input("EntityName", sql.NVarChar(100), details.entityName || null)
      .input("EntityId", sql.NVarChar(100), details.entityId || null)
      .input("AfterJson", sql.NVarChar(sql.MAX), JSON.stringify({ requestId: req.requestId, ...details }))
      .input("IpAddress", sql.NVarChar(60), req.ip || null)
      .query("INSERT INTO dbo.Audit_Log (ProjectCode, ActionCode, EntityName, EntityId, AfterJson, IpAddress) VALUES (@ProjectCode, @ActionCode, @EntityName, @EntityId, @AfterJson, @IpAddress)");
  } catch {
    // Audit failure must not block business data, but is visible through readiness/audit review.
  }
}

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

function smsConfigured() {
  return Boolean(process.env.SMS_WEBHOOK_URL);
}

async function sendEmail(notification) {
  if (!smtpConfigured()) throw new Error("SMTP is not configured");
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD || "" } : undefined,
  });
  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: notification.Recipient,
    subject: notification.Subject || "PMIS Notification",
    text: notification.Body,
  });
  return `SMTP accepted: ${info.messageId || "ok"}`;
}

async function sendSms(notification) {
  if (!smsConfigured()) throw new Error("SMS_WEBHOOK_URL is not configured");
  const response = await fetch(process.env.SMS_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(process.env.SMS_WEBHOOK_TOKEN ? { Authorization: `Bearer ${process.env.SMS_WEBHOOK_TOKEN}` } : {}) },
    body: JSON.stringify({ to: notification.Recipient, message: notification.Body, subject: notification.Subject, projectCode: notification.ProjectCode }),
  });
  if (!response.ok) throw new Error(`SMS webhook returned HTTP ${response.status}`);
  return await response.text();
}

async function createNotification(pool, req, input) {
  const result = await pool.request()
    .input("ProjectCode", sql.NVarChar(50), input.projectCode || null)
    .input("Channel", sql.NVarChar(20), input.channel || "in_app")
    .input("Recipient", sql.NVarChar(300), input.recipient || "system")
    .input("Subject", sql.NVarChar(300), input.subject || null)
    .input("Body", sql.NVarChar(sql.MAX), input.body || "PMIS notification")
    .input("Priority", sql.NVarChar(20), input.priority || "normal")
    .input("RelatedEntity", sql.NVarChar(100), input.relatedEntity || null)
    .input("RelatedEntityId", sql.NVarChar(100), input.relatedEntityId || null)
    .query(`INSERT INTO dbo.Notification_Queue (ProjectCode, Channel, Recipient, Subject, Body, Priority, RelatedEntity, RelatedEntityId) VALUES (@ProjectCode, @Channel, @Recipient, @Subject, @Body, @Priority, @RelatedEntity, @RelatedEntityId); SELECT SCOPE_IDENTITY() AS id;`);
  const id = Number(result.recordset[0].id);
  await writeAudit(pool, req, "CREATE_NOTIFICATION", { projectCode: input.projectCode, entityName: "Notification_Queue", entityId: String(id), channel: input.channel });
  return id;
}

async function deliverNotification(pool, req, id) {
  const q = await pool.request().input("Id", sql.BigInt, Number(id)).query("SELECT TOP 1 * FROM dbo.Notification_Queue WHERE Id = @Id");
  const notification = q.recordset[0];
  if (!notification) throw new Error("Notification was not found");
  let status = "sent";
  let responseText = "in-app queued";
  let provider = notification.Channel;
  try {
    if (notification.Channel === "email") {
      provider = "smtp";
      responseText = await sendEmail(notification);
    } else if (notification.Channel === "sms") {
      provider = "sms-webhook";
      responseText = await sendSms(notification);
    }
    await pool.request().input("Id", sql.BigInt, Number(id)).query("UPDATE dbo.Notification_Queue SET Status = 'sent', Attempts = Attempts + 1, LastError = NULL, SentAt = GETUTCDATE() WHERE Id = @Id");
  } catch (error) {
    status = "failed";
    responseText = error.message;
    await pool.request().input("Id", sql.BigInt, Number(id)).input("LastError", sql.NVarChar(1000), error.message).query("UPDATE dbo.Notification_Queue SET Status = 'failed', Attempts = Attempts + 1, LastError = @LastError WHERE Id = @Id");
  }
  await pool.request().input("NotificationId", sql.BigInt, Number(id)).input("Channel", sql.NVarChar(20), notification.Channel).input("Provider", sql.NVarChar(80), provider).input("Status", sql.NVarChar(30), status).input("ResponseText", sql.NVarChar(sql.MAX), responseText).query("INSERT INTO dbo.Notification_Delivery_Log (NotificationId, Channel, Provider, Status, ResponseText) VALUES (@NotificationId, @Channel, @Provider, @Status, @ResponseText)");
  await writeAudit(pool, req, "DELIVER_NOTIFICATION", { projectCode: notification.ProjectCode, entityName: "Notification_Queue", entityId: String(id), channel: notification.Channel, status });
  return { id: String(id), channel: notification.Channel, status, responseText };
}

function getSqlConfig(req) {
  const serverHeader = req.headers["x-sql-server"] || process.env.SQL_SERVER || ".\\SQL2008EXPRESS";
  const databaseHeader = req.headers["x-sql-database"] || process.env.SQL_DATABASE || "PMIS_MASTER_DB";
  const parts = String(serverHeader).split("\\");
  const serverName = parts[0] || "localhost";
  const instanceName = parts[1] || undefined;

  const config = {
    server: serverName,
    database: databaseHeader,
    options: {
      instanceName,
      encrypt: process.env.SQL_ENCRYPT === "true",
      trustServerCertificate: process.env.SQL_TRUST_CERT !== "false",
    },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
    connectionTimeout: 15000,
  };

  if (process.env.SQL_USER) {
    config.user = process.env.SQL_USER;
    config.password = process.env.SQL_PASSWORD || "";
  }
  return config;
}

let poolCache = null;
async function getPool(req) {
  if (!poolCache) {
    const config = getSqlConfig(req);
    poolCache = await new sql.ConnectionPool(config).connect();
  }
  return poolCache;
}

const rolePermissions = {
  admin: ["system.manage", "portfolio.view", "project.view", "project.edit", "report.daily.edit", "report.approve", "schedule.edit", "risk.edit", "claim.edit", "cost.view", "ai.run"],
  project_manager: ["portfolio.view", "project.view", "project.edit", "report.daily.edit", "report.approve", "schedule.edit", "risk.edit", "claim.edit", "cost.view", "ai.run"],
  planner: ["portfolio.view", "project.view", "schedule.edit", "report.daily.edit", "ai.run"],
  site_engineer: ["project.view", "report.daily.edit"],
  consultant: ["portfolio.view", "project.view", "report.approve", "risk.edit", "claim.edit"],
  client: ["portfolio.view", "project.view", "report.approve", "cost.view"],
  executive: ["portfolio.view", "project.view", "cost.view", "ai.run"],
};

/* ─────────────────── Health / Readiness / Integrations ─────────────────── */
app.get("/api/health", async (req, res) => {
  try {
    const pool = await getPool(req);
    const result = await pool.request().query("SELECT @@VERSION AS version, DB_NAME() AS [database]");
    res.json({
      ok: true,
      data: {
        status: "healthy",
        version: result.recordset[0].version,
        database: result.recordset[0].database,
        timestamp: new Date().toISOString(),
      },
      meta: { traceId: req.requestId, timestamp: new Date().toISOString() },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "DB_CONNECTION_ERROR", message: err.message, traceId: req.requestId } });
  }
});

app.post("/api/health", async (req, res) => {
  try {
    const inputServer = req.body.server || process.env.SQL_SERVER || ".\\SQL2008EXPRESS";
    const parts = String(inputServer).split("\\");
    const testConfig = {
      server: parts[0] || "localhost",
      database: req.body.database || process.env.SQL_DATABASE || "PMIS_MASTER_DB",
      options: {
        instanceName: parts[1] || undefined,
        encrypt: false,
        trustServerCertificate: true,
      },
      user: req.body.user || process.env.SQL_USER || undefined,
      password: req.body.password || process.env.SQL_PASSWORD || undefined,
    };
    const pool = await new sql.ConnectionPool(testConfig).connect();
    const result = await pool.request().query("SELECT @@VERSION AS version, DB_NAME() AS [database]");
    await pool.close();
    res.json({ ok: true, data: { version: result.recordset[0].version, database: result.recordset[0].database }, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "DB_TEST_FAILED", message: err.message, traceId: req.requestId } });
  }
});

app.get("/api/diagnostics/readiness", async (req, res) => {
  const checks = [];
  const configuredIntegrations = [
    ["Primavera P6", "P6_API_URL"],
    ["SAP / ERP", "SAP_API_URL"],
    ["Power BI", "POWERBI_WORKSPACE_ID"],
    ["CMMS", "CMMS_API_URL"],
    ["IoT / MQTT", "MQTT_BROKER_URL"],
    ["DMS", "DMS_API_URL"],
    ["AI Gateway", "AI_API_KEY"],
    ["PDF OCR Service", "OCR_PDF_SERVICE_URL"],
  ];

  checks.push({ key: "runtime", label: "Node API runtime", status: "pass", detail: `uptime ${Math.round(process.uptime())}s` });
  checks.push({ key: "cors", label: "CORS policy", status: process.env.CORS_ORIGIN ? "pass" : "warn", detail: process.env.CORS_ORIGIN || "development: reflected origin" });
  checks.push({ key: "sql-secret", label: "SQL credentials", status: process.env.SQL_USER ? "pass" : "warn", detail: process.env.SQL_USER ? "configured by environment" : "SQL_USER is not configured" });
  try {
    fs.accessSync(storageRoot, fs.constants.R_OK | fs.constants.W_OK);
    checks.push({ key: "file-storage", label: "File object storage", status: "pass", detail: storageRoot });
  } catch (error) {
    checks.push({ key: "file-storage", label: "File object storage", status: "fail", detail: error.message });
  }
  checks.push({ key: "backup", label: "Backup job", status: process.env.BACKUP_LAST_SUCCESS_AT ? "pass" : "warn", detail: process.env.BACKUP_LAST_SUCCESS_AT || "BACKUP_LAST_SUCCESS_AT not configured" });

  try {
    const pool = await getPool(req);
    const requiredObjects = [
      "Industry_Master", "Project_Master", "System_User", "Role_Master",
      "Project_User_Access", "Audit_Log", "File_Object", "Report_Template",
      "Knowledge_Document", "Document_Chunk", "OCR_Job",
      "Notification_Queue", "Notification_Delivery_Log",
      "Project_WBS", "Schedule_Activity", "Daily_Report", "KPI_Value",
      "EVM_Transaction", "Risk_Register", "Change_Request", "Claim_Register",
    ];
    const objectQuery = requiredObjects
      .map((name, index) => `SELECT '${name}' AS ObjectName, OBJECT_ID('dbo.${name}') AS ObjectId${index < requiredObjects.length - 1 ? " UNION ALL " : ""}`)
      .join("");
    const result = await pool.request().query(objectQuery);
    const missing = result.recordset.filter((row) => !row.ObjectId).map((row) => row.ObjectName);
    checks.push({ key: "database", label: "SQL Server connection", status: "pass", detail: getSqlConfig(req).database });
    checks.push({ key: "schema", label: "PMIS schema", status: missing.length ? "fail" : "pass", detail: missing.length ? `missing: ${missing.join(", ")}` : `${requiredObjects.length} required objects found` });
  } catch (error) {
    checks.push({ key: "database", label: "SQL Server connection", status: "fail", detail: error.message });
    checks.push({ key: "schema", label: "PMIS schema", status: "blocked", detail: "database unavailable" });
  }

  configuredIntegrations.forEach(([label, envKey]) => {
    const value = process.env[envKey];
    checks.push({ key: `integration-${envKey.toLowerCase()}`, label, status: value ? "pass" : "warn", detail: value ? "configured" : `${envKey} not configured` });
  });

  const failures = checks.filter((check) => check.status === "fail").length;
  const warnings = checks.filter((check) => check.status === "warn" || check.status === "blocked").length;
  res.status(failures ? 503 : 200).json({
    ok: failures === 0,
    data: {
      status: failures ? "not-ready" : warnings ? "ready-with-warnings" : "ready",
      service: "pmis-api",
      version: "1.1.0",
      startedAt: new Date(startedAt).toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      checks,
      summary: { total: checks.length, passed: checks.filter((check) => check.status === "pass").length, warnings, failures },
    },
    meta: { traceId: req.requestId, timestamp: new Date().toISOString() },
  });
});

app.get("/api/integrations/status", (req, res) => {
  const items = [
    { id: "p6", name: "Primavera P6", configured: Boolean(process.env.P6_API_URL), mode: process.env.P6_API_URL ? "api" : "file-import" },
    { id: "msp", name: "Microsoft Project", configured: true, mode: "file-import" },
    { id: "sap", name: "ERP / SAP", configured: Boolean(process.env.SAP_API_URL), mode: "rest-odata" },
    { id: "powerbi", name: "Power BI", configured: Boolean(process.env.POWERBI_WORKSPACE_ID), mode: "embedded" },
    { id: "cmms", name: "CMMS", configured: Boolean(process.env.CMMS_API_URL), mode: "rest" },
    { id: "iot", name: "IoT Sensors", configured: Boolean(process.env.MQTT_BROKER_URL), mode: "mqtt" },
    { id: "dms", name: "DMS", configured: Boolean(process.env.DMS_API_URL), mode: "rest" },
  ];
  res.json({ ok: true, data: items, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
});

/* ──────────────────────── Auth / RBAC / Audit ──────────────────────── */
app.post("/api/auth/login", async (req, res) => {
  const username = req.body.username || "admin";
  const roleCode = req.body.roleCode || "admin";
  res.json({ ok: true, data: { token: `demo-token-${Date.now()}`, user: { id: username, username, displayName: username === "admin" ? "Mohammadreza Hashemipour" : username, roleCode, projectCodes: ["*"] } }, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
});
app.get("/api/auth/me", async (req, res) => res.json({ ok: true, data: { id: "admin", username: "admin", displayName: "Mohammadreza Hashemipour", roleCode: "admin", projectCodes: ["*"] }, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } }));
app.get("/api/roles", async (req, res) => res.json({ ok: true, data: Object.entries(rolePermissions).map(([code, permissions]) => ({ code, titleFa: code, titleEn: code, permissions })), meta: { traceId: req.requestId, timestamp: new Date().toISOString() } }));
app.get("/api/users", async (req, res) => {
  try {
    const pool = await getPool(req);
    const result = await pool.request().query(`SELECT CAST(Id AS NVARCHAR(20)) AS id, UserName AS username, DisplayName AS displayName, Email AS email, 'project_manager' AS roleCode FROM dbo.System_User WHERE IsActive = 1 ORDER BY Id DESC`);
    res.json({ ok: true, data: result.recordset, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch {
    res.json({ ok: true, data: [], meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  }
});
app.get("/api/audit", async (req, res) => {
  try {
    const pool = await getPool(req);
    const result = await pool.request().query(`SELECT TOP 200 CAST(Id AS NVARCHAR(30)) AS id, CAST(UserId AS NVARCHAR(30)) AS userId, ProjectCode AS projectCode, ActionCode AS actionCode, EntityName AS entityName, EntityId AS entityId, CreatedAt AS createdAt FROM dbo.Audit_Log ORDER BY Id DESC`);
    res.json({ ok: true, data: result.recordset, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch {
    res.json({ ok: true, data: [], meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  }
});

/* ──────────────────────── Notifications ──────────────────────── */
app.get("/api/notifications", async (req, res) => {
  try {
    const pool = await getPool(req);
    const status = req.query.status;
    const projectCode = req.query.projectCode;
    const request = pool.request();
    let query = `SELECT TOP 200 CAST(Id AS NVARCHAR(30)) AS id, ProjectCode AS projectCode, Channel AS channel, Recipient AS recipient, Subject AS subject, Body AS body, Priority AS priority, Status AS status, RelatedEntity AS relatedEntity, RelatedEntityId AS relatedEntityId, Attempts AS attempts, LastError AS lastError, CONVERT(NVARCHAR(30), CreatedAt, 126) AS createdAt, CONVERT(NVARCHAR(30), SentAt, 126) AS sentAt FROM dbo.Notification_Queue WHERE 1=1`;
    if (status) { query += " AND Status = @Status"; request.input("Status", sql.NVarChar(30), status); }
    if (projectCode) { query += " AND ProjectCode = @ProjectCode"; request.input("ProjectCode", sql.NVarChar(50), projectCode); }
    query += " ORDER BY Id DESC";
    const result = await request.query(query);
    res.json({ ok: true, data: result.recordset, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "NOTIFICATION_LIST_ERROR", message: err.message, traceId: req.requestId } });
  }
});

app.post("/api/notifications", async (req, res) => {
  try {
    const pool = await getPool(req);
    const id = await createNotification(pool, req, req.body);
    res.status(201).json({ ok: true, data: { id: String(id), status: "pending" }, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "NOTIFICATION_CREATE_ERROR", message: err.message, traceId: req.requestId } });
  }
});

app.post("/api/notifications/:id/send", async (req, res) => {
  try {
    const pool = await getPool(req);
    const delivery = await deliverNotification(pool, req, req.params.id);
    res.json({ ok: true, data: delivery, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "NOTIFICATION_SEND_ERROR", message: err.message, traceId: req.requestId } });
  }
});

app.post("/api/notifications/test", async (req, res) => {
  try {
    const pool = await getPool(req);
    const id = await createNotification(pool, req, {
      projectCode: req.body.projectCode,
      channel: req.body.channel || "in_app",
      recipient: req.body.recipient || "system",
      subject: "PMIS test notification",
      body: req.body.body || "This is a PMIS delivery test.",
      priority: "normal",
      relatedEntity: "System",
      relatedEntityId: "test",
    });
    const delivery = await deliverNotification(pool, req, id);
    res.json({ ok: true, data: delivery, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "NOTIFICATION_TEST_ERROR", message: err.message, traceId: req.requestId } });
  }
});

/* ──────────────────────── File Object Storage ──────────────────────── */
app.post("/api/files", upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ ok: false, error: { code: "FILE_REQUIRED", message: "Upload a file in the file field", traceId: req.requestId } });

  try {
    const fileId = crypto.randomUUID();
    const checksum = sha256(file.path);
    const pool = await getPool(req);
    await pool.request()
      .input("Id", sql.UniqueIdentifier, fileId)
      .input("FileName", sql.NVarChar(300), file.originalname)
      .input("MimeType", sql.NVarChar(150), file.mimetype)
      .input("SizeBytes", sql.BigInt, file.size)
      .input("StorageKey", sql.NVarChar(600), file.filename)
      .input("ChecksumSha256", sql.NVarChar(128), checksum)
      .query("INSERT INTO dbo.File_Object (Id, FileName, MimeType, SizeBytes, StorageKey, ChecksumSha256) VALUES (@Id, @FileName, @MimeType, @SizeBytes, @StorageKey, @ChecksumSha256)");
    await writeAudit(pool, req, "UPLOAD_FILE", { entityName: "File_Object", entityId: fileId, projectCode: req.body.projectCode || null, fileName: file.originalname });
    res.status(201).json({ ok: true, data: { id: fileId, fileName: file.originalname, mimeType: file.mimetype, sizeBytes: file.size, checksum, downloadUrl: `/api/files/${fileId}/download` }, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    fs.unlink(file.path, () => {});
    res.status(500).json({ ok: false, error: { code: "FILE_STORE_ERROR", message: err.message, traceId: req.requestId } });
  }
});

app.get("/api/files/:id", async (req, res) => {
  try {
    const pool = await getPool(req);
    const result = await pool.request().input("Id", sql.UniqueIdentifier, req.params.id).query("SELECT CAST(Id AS NVARCHAR(36)) AS id, FileName AS fileName, MimeType AS mimeType, SizeBytes AS sizeBytes, ChecksumSha256 AS checksum FROM dbo.File_Object WHERE Id = @Id AND IsDeleted = 0");
    const record = result.recordset[0];
    if (!record) return res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "File was not found", traceId: req.requestId } });
    res.json({ ok: true, data: { ...record, downloadUrl: `/api/files/${record.id}/download` }, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "FILE_LOOKUP_ERROR", message: err.message, traceId: req.requestId } });
  }
});

app.get("/api/files/:id/download", async (req, res) => {
  try {
    const pool = await getPool(req);
    const result = await pool.request().input("Id", sql.UniqueIdentifier, req.params.id).query("SELECT FileName, MimeType, StorageKey FROM dbo.File_Object WHERE Id = @Id AND IsDeleted = 0");
    const record = result.recordset[0];
    if (!record) return res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "File was not found", traceId: req.requestId } });
    const filePath = path.resolve(storageRoot, path.basename(record.StorageKey));
    if (!filePath.startsWith(storageRoot) || !fs.existsSync(filePath)) return res.status(404).json({ ok: false, error: { code: "FILE_MISSING", message: "File object metadata exists but content is unavailable", traceId: req.requestId } });
    res.type(record.MimeType);
    res.download(filePath, sanitizeFileName(record.FileName));
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "FILE_DOWNLOAD_ERROR", message: err.message, traceId: req.requestId } });
  }
});

/* ──────────────────────── Project Knowledge / RAG ──────────────────────── */
app.post("/api/projects/:projectId/knowledge/ingest", upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ ok: false, error: { code: "FILE_REQUIRED", message: "Upload a knowledge document in the file field", traceId: req.requestId } });
  const projectCode = req.params.projectId;
  const knowledgeId = crypto.randomUUID();
  const fileId = crypto.randomUUID();
  /* استخراج متن پیش از هر کار پایگاه‌داده‌ای انجام می‌شود و جدا
   * نگه داشته می‌شود.
   *
   * علت: این مسیر متن را درست بیرون می‌کشید، بعد هنگام نوشتن در
   * SQL Server شکست می‌خورد و کل پاسخ خطا می‌شد — یعنی متنِ
   * استخراج‌شده دور ریخته می‌شد. کارگاه قرارداد فقط همان متن را
   * می‌خواهد و به ذخیرهٔ RAG کاری ندارد، پس بایگانی نشدن نباید
   * استخراج را از کار بیندازد. */
  let extractedText = "";
  try {
    extractedText = await extractKnowledgeText(file);
  } catch (err) {
    return res.status(422).json({
      ok: false,
      error: { code: "EXTRACT_FAILED", message: err.message, traceId: req.requestId },
    });
  }
  if (!chunkText(extractedText).length) {
    return res.status(422).json({
      ok: false,
      error: {
        code: "NO_TEXT_FOUND",
        message: "No extractable text was found. Scanned PDFs require an OCR service.",
        traceId: req.requestId,
      },
    });
  }

  try {
    const text = extractedText;
    const chunks = chunkText(text);
    const checksum = sha256(file.path);
    const languageCode = /[\u0600-\u06FF]/.test(text.slice(0, 4000)) ? "fa" : "en";
    const pool = await getPool(req);
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      await new sql.Request(transaction)
        .input("Id", sql.UniqueIdentifier, fileId)
        .input("FileName", sql.NVarChar(300), file.originalname)
        .input("MimeType", sql.NVarChar(150), file.mimetype)
        .input("SizeBytes", sql.BigInt, file.size)
        .input("StorageKey", sql.NVarChar(600), file.filename)
        .input("ChecksumSha256", sql.NVarChar(128), checksum)
        .query("INSERT INTO dbo.File_Object (Id, FileName, MimeType, SizeBytes, StorageKey, ChecksumSha256) VALUES (@Id, @FileName, @MimeType, @SizeBytes, @StorageKey, @ChecksumSha256)");
      await new sql.Request(transaction)
        .input("Id", sql.UniqueIdentifier, knowledgeId)
        .input("ProjectCode", sql.NVarChar(50), projectCode)
        .input("FileId", sql.UniqueIdentifier, fileId)
        .input("DocumentType", sql.NVarChar(50), req.body.documentType || "project_document")
        .input("Title", sql.NVarChar(400), req.body.title || file.originalname.replace(/\.[^.]+$/, ""))
        .input("LanguageCode", sql.NVarChar(10), languageCode)
        .input("CharacterCount", sql.Int, text.length)
        .input("ChunkCount", sql.Int, chunks.length)
        .query("INSERT INTO dbo.Knowledge_Document (Id, ProjectCode, FileId, DocumentType, Title, LanguageCode, ExtractionStatus, CharacterCount, ChunkCount) VALUES (@Id, @ProjectCode, @FileId, @DocumentType, @Title, @LanguageCode, 'ready', @CharacterCount, @ChunkCount)");
      for (let index = 0; index < chunks.length; index += 1) {
        const content = chunks[index];
        await new sql.Request(transaction)
          .input("KnowledgeDocumentId", sql.UniqueIdentifier, knowledgeId)
          .input("ProjectCode", sql.NVarChar(50), projectCode)
          .input("ChunkIndex", sql.Int, index)
          .input("Content", sql.NVarChar(sql.MAX), content)
          .input("SearchText", sql.NVarChar(2000), content.slice(0, 2000).toLowerCase())
          .input("TokenEstimate", sql.Int, Math.ceil(content.length / 4))
          .query("INSERT INTO dbo.Document_Chunk (KnowledgeDocumentId, ProjectCode, ChunkIndex, Content, SearchText, TokenEstimate) VALUES (@KnowledgeDocumentId, @ProjectCode, @ChunkIndex, @Content, @SearchText, @TokenEstimate)");
      }
      await transaction.commit();
      await writeAudit(pool, req, "INGEST_KNOWLEDGE_DOCUMENT", { projectCode, entityName: "Knowledge_Document", entityId: knowledgeId, fileName: file.originalname, chunks: chunks.length });
      res.status(201).json({ ok: true, data: { id: knowledgeId, projectId: projectCode, fileId, title: req.body.title || file.originalname, documentType: req.body.documentType || "project_document", languageCode, characterCount: text.length, chunkCount: chunks.length, status: "ready", fileName: file.originalname, text }, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
    } catch (error) {
      await transaction.rollback().catch(() => {});
      throw error;
    }
  } catch (err) {
    fs.unlink(file.path, () => {});
    /* بایگانی در پایگاه دانش شکست خورد، ولی متن استخراج شده است.
     * برگرداندن خطا یعنی دور ریختن کاری که درست انجام شده — کاربر
     * فایل را می‌داد و هیچ متنی نمی‌گرفت. وضعیت صریح اعلام می‌شود تا
     * کسی گمان نکند سند بایگانی شده است. */
    res.status(200).json({
      ok: true,
      data: {
        projectId: projectCode,
        fileName: file.originalname,
        characterCount: extractedText.length,
        status: "extracted_not_archived",
        archiveErrorFa: "متن استخراج شد ولی در پایگاه دانش ذخیره نشد.",
        archiveErrorCode: err.code || "KNOWLEDGE_INGEST_ERROR",
        text: extractedText,
      },
      meta: { traceId: req.requestId, timestamp: new Date().toISOString() },
    });
  }
});

app.get("/api/projects/:projectId/knowledge/documents", async (req, res) => {
  try {
    const pool = await getPool(req);
    const result = await pool.request().input("ProjectCode", sql.NVarChar(50), req.params.projectId).query(`
      SELECT CAST(kd.Id AS NVARCHAR(36)) AS id, kd.ProjectCode AS projectId, CAST(kd.FileId AS NVARCHAR(36)) AS fileId,
        kd.Title AS title, kd.DocumentType AS documentType, kd.LanguageCode AS languageCode,
        kd.CharacterCount AS characterCount, kd.ChunkCount AS chunkCount, kd.ExtractionStatus AS status,
        fo.FileName AS fileName
      FROM dbo.Knowledge_Document kd
      INNER JOIN dbo.File_Object fo ON fo.Id = kd.FileId AND fo.IsDeleted = 0
      WHERE kd.ProjectCode = @ProjectCode ORDER BY kd.CreatedAt DESC
    `);
    res.json({ ok: true, data: result.recordset, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "KNOWLEDGE_LIST_ERROR", message: err.message, traceId: req.requestId } });
  }
});

app.post("/api/projects/:projectId/knowledge/ask", async (req, res) => {
  const question = String(req.body.question || "").trim();
  if (question.length < 3) return res.status(400).json({ ok: false, error: { code: "QUESTION_REQUIRED", message: "Enter a valid question", traceId: req.requestId } });
  try {
    const pool = await getPool(req);
    const result = await pool.request().input("ProjectCode", sql.NVarChar(50), req.params.projectId).query(`
      SELECT TOP 500 dc.ChunkIndex, dc.Content, CAST(kd.Id AS NVARCHAR(36)) AS DocumentId,
        kd.Title AS DocumentTitle, fo.FileName
      FROM dbo.Document_Chunk dc
      INNER JOIN dbo.Knowledge_Document kd ON kd.Id = dc.KnowledgeDocumentId
      INNER JOIN dbo.File_Object fo ON fo.Id = kd.FileId AND fo.IsDeleted = 0
      WHERE dc.ProjectCode = @ProjectCode AND kd.ExtractionStatus = 'ready'
      ORDER BY kd.CreatedAt DESC, dc.ChunkIndex ASC
    `);
    const ranked = rankChunks(result.recordset, question);
    const sources = ranked.map((row) => ({ documentId: row.DocumentId, documentTitle: row.DocumentTitle, fileName: row.FileName, chunkIndex: row.ChunkIndex, excerpt: String(row.Content).slice(0, 500), score: row.score }));
    let answer = ranked.length
      ? `Relevant evidence was found in ${new Set(ranked.map((row) => row.DocumentId)).size} document(s). Review the cited excerpts before making a contractual or engineering decision.`
      : "No relevant evidence was found in the indexed project documents.";
    let mode = "extractive";
    let model;
    try {
      const aiAnswer = await callGroundedAi(question, ranked);
      if (aiAnswer) {
        answer = aiAnswer;
        mode = "ai";
        model = process.env.AI_MODEL || "gpt-4.1-mini";
      }
    } catch (error) {
      answer += ` AI provider was unavailable: ${error.message}`;
    }
    await writeAudit(pool, req, "ASK_PROJECT_KNOWLEDGE", { projectCode: req.params.projectId, entityName: "Document_Chunk", question, sources: sources.map((source) => source.documentId) });
    res.json({ ok: true, data: { answer, mode, model, sources }, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "RAG_QUERY_ERROR", message: err.message, traceId: req.requestId } });
  }
});

app.post("/api/projects/:projectId/ocr/ingest", upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ ok: false, error: { code: "FILE_REQUIRED", message: "Upload a scanned image or PDF in the file field", traceId: req.requestId } });
  const projectCode = req.params.projectId;
  const jobId = crypto.randomUUID();
  const fileId = crypto.randomUUID();
  const languageCode = req.body.languageCode || "fas+eng";
  const title = req.body.title || file.originalname.replace(/\.[^.]+$/, "");

  try {
    const pool = await getPool(req);
    const checksum = sha256(file.path);
    await pool.request()
      .input("Id", sql.UniqueIdentifier, fileId)
      .input("FileName", sql.NVarChar(300), file.originalname)
      .input("MimeType", sql.NVarChar(150), file.mimetype)
      .input("SizeBytes", sql.BigInt, file.size)
      .input("StorageKey", sql.NVarChar(600), file.filename)
      .input("ChecksumSha256", sql.NVarChar(128), checksum)
      .query("INSERT INTO dbo.File_Object (Id, FileName, MimeType, SizeBytes, StorageKey, ChecksumSha256) VALUES (@Id, @FileName, @MimeType, @SizeBytes, @StorageKey, @ChecksumSha256)");
    await pool.request()
      .input("Id", sql.UniqueIdentifier, jobId)
      .input("ProjectCode", sql.NVarChar(50), projectCode)
      .input("FileId", sql.UniqueIdentifier, fileId)
      .input("Engine", sql.NVarChar(80), "pending")
      .input("LanguageCode", sql.NVarChar(50), languageCode)
      .query("INSERT INTO dbo.OCR_Job (Id, ProjectCode, FileId, Engine, LanguageCode, Status) VALUES (@Id, @ProjectCode, @FileId, @Engine, @LanguageCode, 'running')");

    const ocr = await extractOcrText(file, languageCode);
    const chunks = chunkText(ocr.text);
    if (!chunks.length) throw new Error("OCR completed but no readable text was detected.");
    const knowledgeId = crypto.randomUUID();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      await new sql.Request(transaction)
        .input("Id", sql.UniqueIdentifier, knowledgeId)
        .input("ProjectCode", sql.NVarChar(50), projectCode)
        .input("FileId", sql.UniqueIdentifier, fileId)
        .input("DocumentType", sql.NVarChar(50), req.body.documentType || "ocr_scan")
        .input("Title", sql.NVarChar(400), title)
        .input("LanguageCode", sql.NVarChar(10), /[\u0600-\u06FF]/.test(ocr.text.slice(0, 4000)) ? "fa" : "en")
        .input("CharacterCount", sql.Int, ocr.text.length)
        .input("ChunkCount", sql.Int, chunks.length)
        .query("INSERT INTO dbo.Knowledge_Document (Id, ProjectCode, FileId, DocumentType, Title, LanguageCode, ExtractionStatus, CharacterCount, ChunkCount) VALUES (@Id, @ProjectCode, @FileId, @DocumentType, @Title, @LanguageCode, 'ready', @CharacterCount, @ChunkCount)");
      for (let index = 0; index < chunks.length; index += 1) {
        const content = chunks[index];
        await new sql.Request(transaction)
          .input("KnowledgeDocumentId", sql.UniqueIdentifier, knowledgeId)
          .input("ProjectCode", sql.NVarChar(50), projectCode)
          .input("ChunkIndex", sql.Int, index)
          .input("Content", sql.NVarChar(sql.MAX), content)
          .input("SearchText", sql.NVarChar(2000), content.slice(0, 2000).toLowerCase())
          .input("TokenEstimate", sql.Int, Math.ceil(content.length / 4))
          .query("INSERT INTO dbo.Document_Chunk (KnowledgeDocumentId, ProjectCode, ChunkIndex, Content, SearchText, TokenEstimate) VALUES (@KnowledgeDocumentId, @ProjectCode, @ChunkIndex, @Content, @SearchText, @TokenEstimate)");
      }
      await new sql.Request(transaction)
        .input("Id", sql.UniqueIdentifier, jobId)
        .input("Engine", sql.NVarChar(80), ocr.engine)
        .input("CharacterCount", sql.Int, ocr.text.length)
        .input("Confidence", sql.Decimal(5, 2), ocr.confidence)
        .input("KnowledgeDocumentId", sql.UniqueIdentifier, knowledgeId)
        .query("UPDATE dbo.OCR_Job SET Status = 'completed', Engine = @Engine, CharacterCount = @CharacterCount, Confidence = @Confidence, KnowledgeDocumentId = @KnowledgeDocumentId, CompletedAt = GETUTCDATE() WHERE Id = @Id");
      await transaction.commit();
      await writeAudit(pool, req, "OCR_INGEST_DOCUMENT", { projectCode, entityName: "OCR_Job", entityId: jobId, fileName: file.originalname, chunks: chunks.length });
      res.status(201).json({ ok: true, data: { id: jobId, projectId: projectCode, fileId, engine: ocr.engine, languageCode, status: "completed", characterCount: ocr.text.length, confidence: ocr.confidence, knowledgeDocumentId: knowledgeId, fileName: file.originalname }, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
    } catch (error) {
      await transaction.rollback().catch(() => {});
      throw error;
    }
  } catch (err) {
    try {
      const pool = await getPool(req);
      await pool.request().input("Id", sql.UniqueIdentifier, jobId).input("ErrorMessage", sql.NVarChar(1000), err.message).query("UPDATE dbo.OCR_Job SET Status = 'failed', ErrorMessage = @ErrorMessage, CompletedAt = GETUTCDATE() WHERE Id = @Id");
    } catch { /* ignore */ }
    fs.unlink(file.path, () => {});
    res.status(500).json({ ok: false, error: { code: err.code || "OCR_INGEST_ERROR", message: err.message, traceId: req.requestId } });
  }
});

app.get("/api/projects/:projectId/ocr/jobs", async (req, res) => {
  try {
    const pool = await getPool(req);
    const result = await pool.request().input("ProjectCode", sql.NVarChar(50), req.params.projectId).query(`
      SELECT TOP 100 CAST(oj.Id AS NVARCHAR(36)) AS id, oj.ProjectCode AS projectId, CAST(oj.FileId AS NVARCHAR(36)) AS fileId,
        oj.Engine AS engine, oj.LanguageCode AS languageCode, oj.Status AS status,
        oj.CharacterCount AS characterCount, oj.Confidence AS confidence, oj.ErrorMessage AS errorMessage,
        CAST(oj.KnowledgeDocumentId AS NVARCHAR(36)) AS knowledgeDocumentId, fo.FileName AS fileName
      FROM dbo.OCR_Job oj
      INNER JOIN dbo.File_Object fo ON fo.Id = oj.FileId AND fo.IsDeleted = 0
      WHERE oj.ProjectCode = @ProjectCode
      ORDER BY oj.CreatedAt DESC
    `);
    res.json({ ok: true, data: result.recordset, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "OCR_JOBS_ERROR", message: err.message, traceId: req.requestId } });
  }
});

/* ──────────────────────── Report Templates ──────────────────────── */
app.get("/api/projects/:projectId/templates", async (req, res) => {
  try {
    const pool = await getPool(req);
    const request = pool.request().input("ProjectCode", sql.NVarChar(50), req.params.projectId);
    let query = `
      SELECT CAST(rt.Id AS NVARCHAR(30)) AS id, rt.ProjectCode AS projectId, rt.ModuleCode AS moduleCode,
        rt.TemplateKind AS kind, rt.Name AS name, fo.FileName AS fileName, fo.MimeType AS mimeType,
        rt.VersionNo AS version, rt.IsLocked AS isLocked, rt.IsActive AS isActive,
        CAST(fo.Id AS NVARCHAR(36)) AS fileId
      FROM dbo.Report_Template rt
      LEFT JOIN dbo.File_Object fo ON fo.Id = rt.FileId AND fo.IsDeleted = 0
      WHERE rt.ProjectCode = @ProjectCode AND rt.IsActive = 1`;
    if (req.query.moduleCode) {
      query += " AND rt.ModuleCode = @ModuleCode";
      request.input("ModuleCode", sql.NVarChar(60), req.query.moduleCode);
    }
    query += " ORDER BY rt.Id DESC";
    const result = await request.query(query);
    const items = result.recordset.map((row) => ({ ...row, downloadUrl: row.fileId ? `/api/files/${row.fileId}/download` : undefined }));
    res.json({ ok: true, data: items, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "TEMPLATE_LIST_ERROR", message: err.message, traceId: req.requestId } });
  }
});

app.post("/api/projects/:projectId/templates", upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ ok: false, error: { code: "FILE_REQUIRED", message: "Upload a template in the file field", traceId: req.requestId } });
  const projectCode = req.params.projectId;
  const moduleCode = req.body.moduleCode || "d2-p4-s1";
  const kind = req.body.kind === "mandated" ? "mandated" : "internal";
  const fileId = crypto.randomUUID();
  const templateName = req.body.name || file.originalname.replace(/\.[^.]+$/, "");
  const version = req.body.version || "v1.0";
  const isLocked = kind === "mandated" || req.body.isLocked === "true";

  try {
    const checksum = sha256(file.path);
    const pool = await getPool(req);
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      await new sql.Request(transaction)
        .input("Id", sql.UniqueIdentifier, fileId)
        .input("FileName", sql.NVarChar(300), file.originalname)
        .input("MimeType", sql.NVarChar(150), file.mimetype)
        .input("SizeBytes", sql.BigInt, file.size)
        .input("StorageKey", sql.NVarChar(600), file.filename)
        .input("ChecksumSha256", sql.NVarChar(128), checksum)
        .query("INSERT INTO dbo.File_Object (Id, FileName, MimeType, SizeBytes, StorageKey, ChecksumSha256) VALUES (@Id, @FileName, @MimeType, @SizeBytes, @StorageKey, @ChecksumSha256)");
      const templateResult = await new sql.Request(transaction)
        .input("ProjectCode", sql.NVarChar(50), projectCode)
        .input("ModuleCode", sql.NVarChar(60), moduleCode)
        .input("TemplateKind", sql.NVarChar(20), kind)
        .input("Name", sql.NVarChar(250), templateName)
        .input("VersionNo", sql.NVarChar(50), version)
        .input("FileId", sql.UniqueIdentifier, fileId)
        .input("IsLocked", sql.Bit, isLocked)
        .query(`
          UPDATE dbo.Report_Template SET IsActive = 0 WHERE ProjectCode = @ProjectCode AND ModuleCode = @ModuleCode AND TemplateKind = @TemplateKind AND IsActive = 1;
          INSERT INTO dbo.Report_Template (ProjectCode, ModuleCode, TemplateKind, Name, VersionNo, FileId, IsLocked, IsActive)
          VALUES (@ProjectCode, @ModuleCode, @TemplateKind, @Name, @VersionNo, @FileId, @IsLocked, 1);
          SELECT SCOPE_IDENTITY() AS id;
        `);
      await transaction.commit();
      await writeAudit(pool, req, "UPLOAD_REPORT_TEMPLATE", { projectCode, entityName: "Report_Template", entityId: String(templateResult.recordset[0].id), moduleCode, kind, fileName: file.originalname });
      res.status(201).json({ ok: true, data: { id: String(templateResult.recordset[0].id), projectId: projectCode, moduleCode, kind, name: templateName, fileName: file.originalname, mimeType: file.mimetype, version, isLocked, isActive: true, fileId, downloadUrl: `/api/files/${fileId}/download` }, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
    } catch (error) {
      await transaction.rollback().catch(() => {});
      throw error;
    }
  } catch (err) {
    fs.unlink(file.path, () => {});
    res.status(500).json({ ok: false, error: { code: "TEMPLATE_UPLOAD_ERROR", message: err.message, traceId: req.requestId } });
  }
});

app.delete("/api/projects/:projectId/templates/:templateId", async (req, res) => {
  try {
    const pool = await getPool(req);
    const result = await pool.request()
      .input("ProjectCode", sql.NVarChar(50), req.params.projectId)
      .input("Id", sql.Int, Number(req.params.templateId))
      .query("UPDATE dbo.Report_Template SET IsActive = 0 WHERE Id = @Id AND ProjectCode = @ProjectCode; SELECT @@ROWCOUNT AS affected;");
    const affected = Number(result.recordset[0]?.affected || 0);
    if (!affected) return res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "Template was not found", traceId: req.requestId } });
    await writeAudit(pool, req, "ARCHIVE_REPORT_TEMPLATE", { projectCode: req.params.projectId, entityName: "Report_Template", entityId: req.params.templateId });
    res.json({ ok: true, data: { success: true }, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "TEMPLATE_ARCHIVE_ERROR", message: err.message, traceId: req.requestId } });
  }
});

/* ──────────────────────── External Integrations & AI ──────────────────────── */
app.post("/api/projects/:projectId/schedule/import", upload.single("file"), async (req, res) => {
  try {
    const { projectId } = req.params;
    const fileName = req.file?.originalname || req.body.fileName || "schedule.xer";
    const sourceSystem = req.body.sourceSystem || (fileName.toLowerCase().endsWith(".mpp") ? "msp" : fileName.toLowerCase().endsWith(".xer") ? "primavera" : "excel");
    const activities = req.file ? parseScheduleFile(req.file.path, req.file.originalname) : [];
    const pool = await getPool(req);
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      const master = await new sql.Request(transaction)
        .input("ProjectCode", sql.NVarChar(50), projectId)
        .input("ScheduleName", sql.NVarChar(250), fileName)
        .input("SourceSystem", sql.NVarChar(30), sourceSystem)
        .query(`INSERT INTO dbo.Schedule_Master (ProjectCode, ScheduleName, SourceSystem) VALUES (@ProjectCode, @ScheduleName, @SourceSystem); SELECT SCOPE_IDENTITY() AS scheduleId;`);
      const scheduleId = Number(master.recordset[0].scheduleId);
      for (const activity of activities) {
        await new sql.Request(transaction)
          .input("ScheduleId", sql.Int, scheduleId)
          .input("ActivityCode", sql.NVarChar(100), activity.code)
          .input("ActivityName", sql.NVarChar(400), activity.name)
          .input("StartDate", sql.Date, activity.startDate)
          .input("FinishDate", sql.Date, activity.finishDate)
          .input("DurationDays", sql.Int, activity.durationDays)
          .input("Progress", sql.Decimal(5, 2), activity.progress)
          .input("IsCritical", sql.Bit, activity.isCritical)
          .query(`INSERT INTO dbo.Schedule_Activity (ScheduleId, ActivityCode, ActivityName, StartDate, FinishDate, DurationDays, Progress, IsCritical) VALUES (@ScheduleId, @ActivityCode, @ActivityName, @StartDate, @FinishDate, @DurationDays, @Progress, @IsCritical);`);
      }
      const insertLog = await new sql.Request(transaction)
        .input("ProjectCode", sql.NVarChar(50), projectId)
        .input("SourceSystem", sql.NVarChar(30), sourceSystem)
        .input("Status", sql.NVarChar(30), "success")
        .input("Details", sql.NVarChar(sql.MAX), JSON.stringify({ fileName, activities: activities.length, scheduleId }))
        .query(`INSERT INTO dbo.Schedule_Import_Log (ProjectCode, SourceSystem, FileId, Status, Details) VALUES (@ProjectCode, @SourceSystem, NEWID(), @Status, @Details); SELECT SCOPE_IDENTITY() AS logId;`);
      await transaction.commit();
      await writeAudit(pool, req, "IMPORT_SCHEDULE", { projectCode: projectId, entityName: "Schedule_Master", entityId: String(scheduleId), sourceSystem, fileName, activities: activities.length });
      res.json({ ok: true, data: { logId: insertLog.recordset[0].logId, scheduleId, projectId, sourceSystem, fileName, importedActivities: activities.length, preview: activities.slice(0, 20), importedAt: new Date().toISOString(), message: "Schedule imported successfully." }, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
    } catch (error) {
      await transaction.rollback().catch(() => {});
      throw error;
    }
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "IMPORT_ERROR", message: err.message, traceId: req.requestId } });
  } finally {
    if (req.file) fs.unlink(req.file.path, () => {});
  }
});

app.get("/api/projects/:projectId/schedule/activities", async (req, res) => {
  try {
    const pool = await getPool(req);
    const result = await pool.request()
      .input("ProjectCode", sql.NVarChar(50), req.params.projectId)
      .query(`SELECT TOP 100 CAST(sa.Id AS NVARCHAR(30)) AS id, sm.ProjectCode AS projectId, CAST(sa.WbsId AS NVARCHAR(30)) AS wbsId, sa.ActivityCode AS activityCode, sa.ActivityName AS name, CONVERT(NVARCHAR(20), sa.StartDate, 23) AS startDate, CONVERT(NVARCHAR(20), sa.FinishDate, 23) AS finishDate, ISNULL(sa.DurationDays, 0) AS durationDays, sa.Progress AS progress, sa.IsCritical AS isCritical FROM dbo.Schedule_Activity sa INNER JOIN dbo.Schedule_Master sm ON sm.Id = sa.ScheduleId WHERE sm.ProjectCode = @ProjectCode ORDER BY sa.Id DESC`);
    res.json({ ok: true, data: result.recordset, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "SCHEDULE_QUERY_ERROR", message: err.message, traceId: req.requestId } });
  }
});
/**
 * دروازهٔ هوش مصنوعی.
 *
 * پیش از این، این مسیر همیشه یک پاسخ ساختگی برمی‌گرداند و هرگز به
 * هیچ سرویسی وصل نمی‌شد — یعنی دکمهٔ ترجمه در رابط کاربری کار
 * می‌کرد ولی هیچ ترجمه‌ای اتفاق نمی‌افتاد.
 *
 * حالا سه ارائه‌دهنده پشتیبانی می‌شوند و نبود کلید **صریح** اعلام
 * می‌شود، نه اینکه با پاسخ ساختگی پوشانده شود. کاربری که فکر کند
 * ترجمه انجام شده ولی نشده، متن اصلی را به‌جای ترجمه امضا می‌کند.
 */
app.post("/api/ai/run", async (req, res) => {
  try {
    const { prompt, context = {} } = req.body ?? {};
    /* نام‌های «مدیریت سامانه ← هوش مصنوعی» به شناسه‌های لایهٔ
     * ارائه‌دهنده نگاشت می‌شوند. بدون این، انتخاب کاربر در تنظیمات
     * سامانه به سرور می‌رسید و به‌عنوان ارائه‌دهندهٔ ناشناخته رد
     * می‌شد — تنظیمی که کار نمی‌کند و دلیلش پیدا نیست. */
    const PROVIDER_ALIAS = { mock: "rule", local: "rule" };
    const rawProvider = String(context.provider || "rule");
    const providerId = PROVIDER_ALIAS[rawProvider] || rawProvider;

    /* DeepSeek قالب سیمی سازگار با OpenAI دارد، ولی **آدرس و مدل
     * خودش** را می‌خواهد. نگاشتن آن به `openai` بدون عوض کردن آدرس
     * یعنی فرستادن کلید DeepSeek به سرور OpenAI — که همیشه ۴۰۱
     * برمی‌گرداند و کاربر فکر می‌کند کلیدش خراب است. */
    const PROVIDER_WIRE = {
      deepseek: { url: "https://api.deepseek.com/chat/completions", model: "deepseek-chat" },
    };
    const wireOverride = PROVIDER_WIRE[rawProvider] ?? {};

    const secret = String(req.headers["x-ai-key"] || process.env.AI_API_KEY || "");
    /* Arena با حساب کاربری کار می‌کند، نه با کلید ماشین. تا وقتی
     * جریان ورود، نشست را به این سامانه تحویل ندهد، درخواست سمت
     * سرور اجرا نمی‌شود.
     *
     * خطای صریح داده می‌شود نه پاسخ خالی: کاربری که «متصل» می‌بیند و
     * ترجمه‌ای نمی‌گیرد، فکر می‌کند سرویس خراب است و دنبال اشکالی
     * می‌گردد که وجود ندارد. */
    if (providerId === "arena" && !secret) {
      return res.status(400).json({
        ok: false,
        error: {
          code: "E-AI-ARENA-NO-SESSION",
          message: "ورود با حساب Arena.ai در مرورگر انجام می‌شود و نشست آن هنوز به این سامانه تحویل داده نشده است. تا آن زمان از OpenAI با کلید، یا از موتور قاعده‌محور برای استخراج ساختار استفاده کنید.",
          traceId: req.requestId,
        },
      });
    }

    /* موتور قاعده‌محور هیچ سرویسی صدا نمی‌زند. برای ترجمه کاری از آن
     * برنمی‌آید، پس به‌جای متن ساختگی، صریح می‌گوید. */
    if (providerId === "rule") {
      return res.json({
        ok: true,
        data: {
          translated: null,
          message: "موتور قاعده‌محور ترجمه نمی‌کند. برای ترجمه یکی از سرویس‌ها را انتخاب کنید؛ استخراج ساختار بدون ترجمه هم کار می‌کند.",
          provider: "rule",
        },
        meta: { traceId: req.requestId, engine: "ai-v1" },
      });
    }

    const check = aiLogic.checkCredential({ provider: providerId, mode: context.mode || "api_key", secret });
    if (!check.ok) {
      return res.status(400).json({
        ok: false,
        error: { code: check.code || "E-AI-CRED", message: check.messageFa || "اعتبار نامعتبر", traceId: req.requestId },
      });
    }

    const text = String(context.text || "");
    if (!text.trim()) {
      return res.status(400).json({
        ok: false,
        error: { code: "E-AI-NO-INPUT", message: "متنی برای پردازش ارسال نشده است.", traceId: req.requestId },
      });
    }

    const instructions = prompt === "translate"
      ? ogwLogic.translationInstructions(context.targetLang === "en" ? "en" : "fa")
      : ogwLogic.wbsInstructions(context.templateId || null);

    const wire = aiLogic.buildWireRequest(
      { provider: providerId, mode: context.mode || "api_key", secret },
      { instructions, input: text, maxOutputTokens: 4000 },
      {
        url: process.env.AI_RESPONSES_URL || wireOverride.url,
        model: process.env.AI_MODEL || wireOverride.model,
      },
    );

    /* خطای شبکه از خطای سرویس جدا می‌شود. پیام خام `fetch failed`
     * به کاربر نمی‌گوید مشکل از نبودِ اینترنت است یا از کلید، و او
     * ساعت‌ها دنبال کلید سالم می‌گردد. */
    let upstream;
    try {
      upstream = await fetch(wire.url, { method: "POST", headers: wire.headers, body: wire.body });
    } catch (netErr) {
      return res.status(502).json({
        ok: false,
        error: {
          code: "E-AI-UNREACHABLE",
          message: `اتصال به ${new URL(wire.url).host} برقرار نشد. دسترسی اینترنت سرور یا آدرس سرویس را بررسی کنید. (${netErr.message})`,
          traceId: req.requestId,
        },
      });
    }
    if (!upstream.ok) {
      const kind = aiLogic.classifyHttpFailure(upstream.status);
      /* خطای اعتبار بی‌صدا به کف نمی‌افتد — کاربر باید بداند کلیدش
       * کار نمی‌کند، وگرنه خروجی ضعیف را می‌پذیرد. */
      return res.status(aiLogic.shouldFallbackToRule(kind) ? 200 : 401).json({
        ok: aiLogic.shouldFallbackToRule(kind),
        data: aiLogic.shouldFallbackToRule(kind) ? { translated: null, message: aiLogic.failureMessageFa(kind, providerId) } : undefined,
        error: aiLogic.shouldFallbackToRule(kind) ? undefined : { code: "E-AI-AUTH", message: aiLogic.failureMessageFa(kind, providerId), traceId: req.requestId },
        meta: { traceId: req.requestId, engine: "ai-v1" },
      });
    }

    const payload = await upstream.json();
    const out = aiLogic.extractText(providerId, payload);
    res.json({
      ok: true,
      data: { translated: out, message: out ? null : "سرویس پاسخ متنی برنگرداند.", provider: providerId },
      meta: { traceId: req.requestId, engine: "ai-v1" },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "AI_ERROR", message: err.message, traceId: req.requestId } });
  }
});

/* ──────────────────────── Industries ──────────────────────── */
app.get("/api/industries", async (req, res) => {
  try {
    const pool = await getPool(req);
    const result = await pool.request().query(`SELECT Code AS id, Code AS code, TitleFa AS titleFa, TitleEn AS titleEn, Icon AS icon, Color AS color, IsActive AS isActive FROM dbo.Industry_Master WHERE IsActive = 1 ORDER BY Id ASC`);
    res.json({ ok: true, data: { items: result.recordset, page: 1, pageSize: result.recordset.length, total: result.recordset.length }, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "QUERY_ERROR", message: err.message, traceId: req.requestId } });
  }
});
app.post("/api/industries", async (req, res) => {
  try {
    const { code, titleFa, titleEn, icon, color } = req.body;
    const pool = await getPool(req);
    const result = await pool.request().input("Code", sql.NVarChar(20), code).input("TitleFa", sql.NVarChar(200), titleFa).input("TitleEn", sql.NVarChar(200), titleEn || null).input("Icon", sql.NVarChar(30), icon || "🏗").input("Color", sql.NVarChar(20), color || "#38BDF8").query(`INSERT INTO dbo.Industry_Master (Code, TitleFa, TitleEn, Icon, Color) VALUES (@Code, @TitleFa, @TitleEn, @Icon, @Color); SELECT Code AS id, Code AS code, TitleFa AS titleFa, TitleEn AS titleEn, Icon AS icon, Color AS color, IsActive AS isActive FROM dbo.Industry_Master WHERE Code = @Code;`);
    res.json({ ok: true, data: result.recordset[0], meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "INSERT_ERROR", message: err.message, traceId: req.requestId } });
  }
});
app.patch("/api/industries/:id", async (req, res) => {
  try {
    const pool = await getPool(req);
    const { titleFa, titleEn, icon, color, isActive } = req.body;
    const result = await pool.request().input("Code", sql.NVarChar(20), req.params.id).input("TitleFa", sql.NVarChar(200), titleFa || null).input("TitleEn", sql.NVarChar(200), titleEn || null).input("Icon", sql.NVarChar(30), icon || null).input("Color", sql.NVarChar(20), color || null).input("IsActive", sql.Bit, isActive == null ? null : Boolean(isActive)).query(`UPDATE dbo.Industry_Master SET TitleFa = COALESCE(@TitleFa, TitleFa), TitleEn = COALESCE(@TitleEn, TitleEn), Icon = COALESCE(@Icon, Icon), Color = COALESCE(@Color, Color), IsActive = COALESCE(@IsActive, IsActive), UpdatedAt = GETDATE() WHERE Code = @Code; SELECT Code AS id, Code AS code, TitleFa AS titleFa, TitleEn AS titleEn, Icon AS icon, Color AS color, IsActive AS isActive FROM dbo.Industry_Master WHERE Code = @Code;`);
    if (!result.recordset[0]) return res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "Industry was not found", traceId: req.requestId } });
    res.json({ ok: true, data: result.recordset[0], meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "UPDATE_ERROR", message: err.message, traceId: req.requestId } });
  }
});
app.delete("/api/industries/:id", async (req, res) => {
  try {
    const pool = await getPool(req);
    await pool.request().input("Code", sql.NVarChar(20), req.params.id).query("UPDATE dbo.Industry_Master SET IsActive = 0, UpdatedAt = GETDATE() WHERE Code = @Code");
    res.json({ ok: true, data: { success: true }, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "DELETE_ERROR", message: err.message, traceId: req.requestId } });
  }
});

/* ──────────────────────── Projects ──────────────────────── */
app.get("/api/projects", async (req, res) => {
  try {
    const pool = await getPool(req);
    const industryId = req.query.industryId;
    let query = `SELECT ProjectCode AS id, IndustryCode AS industryId, ProjectCode AS code, NameFa AS nameFa, NameEn AS nameEn, ClientFa AS clientFa, LocationFa AS locationFa, Budget, Status AS status, Progress AS progress FROM dbo.Project_Master WHERE IsArchived = 0`;
    const request = pool.request();
    if (industryId) { query += ` AND IndustryCode = @IndustryCode`; request.input("IndustryCode", sql.NVarChar(20), industryId); }
    query += ` ORDER BY Id DESC`;
    const result = await request.query(query);
    res.json({ ok: true, data: { items: result.recordset, page: 1, pageSize: result.recordset.length, total: result.recordset.length }, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "QUERY_ERROR", message: err.message, traceId: req.requestId } });
  }
});
app.post("/api/projects", async (req, res) => {
  try {
    const { industryId, code, nameFa, nameEn, clientFa, locationFa, budget, status, progress } = req.body;
    const pool = await getPool(req);
    const result = await pool.request().input("IndustryCode", sql.NVarChar(20), industryId).input("ProjectCode", sql.NVarChar(50), code).input("NameFa", sql.NVarChar(400), nameFa).input("NameEn", sql.NVarChar(400), nameEn || null).input("ClientFa", sql.NVarChar(200), clientFa || null).input("LocationFa", sql.NVarChar(250), locationFa || null).input("Budget", sql.Decimal(18, 2), parseFloat(String(budget || "0").replace(/[^0-9.]/g, "")) || 0).input("Status", sql.NVarChar(20), status || "active").input("Progress", sql.Decimal(5, 2), progress || 0).query(`INSERT INTO dbo.Project_Master (IndustryCode, ProjectCode, NameFa, NameEn, ClientFa, LocationFa, Budget, Status, Progress) VALUES (@IndustryCode, @ProjectCode, @NameFa, @NameEn, @ClientFa, @LocationFa, @Budget, @Status, @Progress); SELECT ProjectCode AS id, IndustryCode AS industryId, ProjectCode AS code, NameFa AS nameFa, Status AS status, Progress AS progress FROM dbo.Project_Master WHERE ProjectCode = @ProjectCode;`);
    res.json({ ok: true, data: result.recordset[0], meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "INSERT_ERROR", message: err.message, traceId: req.requestId } });
  }
});
app.patch("/api/projects/:id", async (req, res) => {
  try {
    const pool = await getPool(req);
    const { nameFa, nameEn, clientFa, locationFa, budget, status, progress } = req.body;
    const result = await pool.request().input("ProjectCode", sql.NVarChar(50), req.params.id).input("NameFa", sql.NVarChar(400), nameFa || null).input("NameEn", sql.NVarChar(400), nameEn || null).input("ClientFa", sql.NVarChar(200), clientFa || null).input("LocationFa", sql.NVarChar(250), locationFa || null).input("Budget", sql.Decimal(18, 2), budget == null ? null : Number(budget)).input("Status", sql.NVarChar(20), status || null).input("Progress", sql.Decimal(5, 2), progress == null ? null : Number(progress)).query(`UPDATE dbo.Project_Master SET NameFa = COALESCE(@NameFa, NameFa), NameEn = COALESCE(@NameEn, NameEn), ClientFa = COALESCE(@ClientFa, ClientFa), LocationFa = COALESCE(@LocationFa, LocationFa), Budget = COALESCE(@Budget, Budget), Status = COALESCE(@Status, Status), Progress = COALESCE(@Progress, Progress), UpdatedAt = GETDATE() WHERE ProjectCode = @ProjectCode; SELECT ProjectCode AS id, IndustryCode AS industryId, ProjectCode AS code, NameFa AS nameFa, NameEn AS nameEn, ClientFa AS clientFa, LocationFa AS locationFa, Budget AS budget, Status AS status, Progress AS progress FROM dbo.Project_Master WHERE ProjectCode = @ProjectCode;`);
    if (!result.recordset[0]) return res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "Project was not found", traceId: req.requestId } });
    res.json({ ok: true, data: result.recordset[0], meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "UPDATE_ERROR", message: err.message, traceId: req.requestId } });
  }
});

/* ──────────────────────── Daily Reports ──────────────────────── */
app.get("/api/projects/:projectId/daily-reports", async (req, res) => {
  try {
    const { projectId } = req.params;
    const pool = await getPool(req);
    const result = await pool.request().input("ProjectCode", sql.NVarChar(50), projectId).query(`SELECT CAST(Id AS NVARCHAR(30)) AS id, ProjectCode AS projectId, ReportNo AS reportNo, CONVERT(NVARCHAR(20), ReportDate, 23) AS reportDate, NULL AS templateId, HeaderJson AS header, Status AS status FROM dbo.Daily_Report WHERE ProjectCode = @ProjectCode ORDER BY Id DESC`);
    res.json({ ok: true, data: result.recordset, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "QUERY_ERROR", message: err.message, traceId: req.requestId } });
  }
});
app.post("/api/projects/:projectId/daily-reports", async (req, res) => {
  try {
    const { projectId } = req.params;
    const { reportNo, reportDate, header, status } = req.body;
    const sqlReportDate = toSqlDate(reportDate);
    const pool = await getPool(req);
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      const result = await new sql.Request(transaction).input("ProjectCode", sql.NVarChar(50), projectId).input("ReportNo", sql.NVarChar(30), normalizeDigits(reportNo || `DPR-${Date.now()}`)).input("ReportDate", sql.Date, sqlReportDate).input("HeaderJson", sql.NVarChar(sql.MAX), JSON.stringify(header || {})).input("Status", sql.NVarChar(30), status || "draft").query(`INSERT INTO dbo.Daily_Report (ProjectCode, ReportNo, ReportDate, HeaderJson, Status) VALUES (@ProjectCode, @ReportNo, @ReportDate, @HeaderJson, @Status); DECLARE @ReportId INT = SCOPE_IDENTITY(); INSERT INTO dbo.Report_Workflow (DailyReportId, CurrentStatus, CurrentAssigneeRole) VALUES (@ReportId, @Status, CASE WHEN @Status = 'submitted' THEN 'consultant' ELSE 'site_engineer' END); SELECT @ReportId AS id, @ProjectCode AS projectId, @ReportNo AS reportNo, CONVERT(NVARCHAR(20), @ReportDate, 23) AS reportDate, @Status AS status;`);
      await transaction.commit();
      res.json({ ok: true, data: result.recordset[0], meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
    } catch (error) {
      await transaction.rollback().catch(() => {});
      throw error;
    }
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "INSERT_ERROR", message: err.message, traceId: req.requestId } });
  }
});

const workflowTransitions = {
  submit: { from: ["draft", "revision_required", "rejected"], to: "submitted", roles: ["admin", "project_manager", "site_engineer", "planner"], assignee: "consultant" },
  start_consultant_review: { from: ["submitted"], to: "consultant_review", roles: ["admin", "consultant"], assignee: "consultant" },
  consultant_accept: { from: ["submitted", "consultant_review"], to: "client_review", roles: ["admin", "consultant"], assignee: "client" },
  request_revision: { from: ["submitted", "consultant_review", "client_review"], to: "revision_required", roles: ["admin", "consultant", "client", "project_manager"], assignee: "site_engineer" },
  approve: { from: ["client_review"], to: "approved", roles: ["admin", "client"], assignee: null },
  reject: { from: ["submitted", "consultant_review", "client_review"], to: "rejected", roles: ["admin", "consultant", "client"], assignee: "project_manager" },
};

app.get("/api/daily-reports/:id/workflow", async (req, res) => {
  try {
    const pool = await getPool(req);
    const workflow = await pool.request().input("DailyReportId", sql.Int, Number(req.params.id)).query(`SELECT CAST(Id AS NVARCHAR(30)) AS id, CAST(DailyReportId AS NVARCHAR(30)) AS dailyReportId, CurrentStatus AS currentStatus, CurrentAssigneeRole AS currentAssigneeRole FROM dbo.Report_Workflow WHERE DailyReportId = @DailyReportId`);
    const record = workflow.recordset[0];
    if (!record) return res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "Report workflow was not found", traceId: req.requestId } });
    const actions = await pool.request().input("WorkflowId", sql.Int, Number(record.id)).query(`SELECT CAST(Id AS NVARCHAR(30)) AS id, ActionCode AS actionCode, FromStatus AS fromStatus, ToStatus AS toStatus, ActorRole AS actorRole, Comment AS comment, CONVERT(NVARCHAR(30), CreatedAt, 126) AS createdAt FROM dbo.Report_Workflow_Action WHERE WorkflowId = @WorkflowId ORDER BY Id DESC`);
    res.json({ ok: true, data: { ...record, actions: actions.recordset }, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "WORKFLOW_QUERY_ERROR", message: err.message, traceId: req.requestId } });
  }
});

app.post("/api/daily-reports/:id/workflow/actions", async (req, res) => {
  const actionCode = String(req.body.actionCode || "");
  const actorRole = String(req.body.actorRole || "");
  const transition = workflowTransitions[actionCode];
  if (!transition) return res.status(400).json({ ok: false, error: { code: "INVALID_ACTION", message: "Unknown workflow action", traceId: req.requestId } });
  if (!transition.roles.includes(actorRole)) return res.status(403).json({ ok: false, error: { code: "ROLE_NOT_ALLOWED", message: `Role ${actorRole} cannot perform ${actionCode}`, traceId: req.requestId } });
  try {
    const pool = await getPool(req);
    const currentResult = await pool.request().input("DailyReportId", sql.Int, Number(req.params.id)).query(`SELECT Id, CurrentStatus FROM dbo.Report_Workflow WHERE DailyReportId = @DailyReportId`);
    const current = currentResult.recordset[0];
    if (!current) return res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "Report workflow was not found", traceId: req.requestId } });
    if (!transition.from.includes(current.CurrentStatus)) return res.status(409).json({ ok: false, error: { code: "INVALID_TRANSITION", message: `Cannot ${actionCode} from ${current.CurrentStatus}`, traceId: req.requestId } });
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      await new sql.Request(transaction)
        .input("WorkflowId", sql.Int, current.Id)
        .input("ActionCode", sql.NVarChar(40), actionCode)
        .input("FromStatus", sql.NVarChar(30), current.CurrentStatus)
        .input("ToStatus", sql.NVarChar(30), transition.to)
        .input("ActorRole", sql.NVarChar(60), actorRole)
        .input("AssigneeRole", sql.NVarChar(60), transition.assignee)
        .input("Comment", sql.NVarChar(2000), req.body.comment || null)
        .query(`INSERT INTO dbo.Report_Workflow_Action (WorkflowId, ActionCode, FromStatus, ToStatus, ActorRole, Comment) VALUES (@WorkflowId, @ActionCode, @FromStatus, @ToStatus, @ActorRole, @Comment); UPDATE dbo.Report_Workflow SET CurrentStatus = @ToStatus, CurrentAssigneeRole = @AssigneeRole, UpdatedAt = GETUTCDATE(), SubmittedAt = CASE WHEN @ToStatus = 'submitted' THEN GETUTCDATE() ELSE SubmittedAt END, ReviewedAt = CASE WHEN @ToStatus IN ('consultant_review','client_review') THEN GETUTCDATE() ELSE ReviewedAt END, ApprovedAt = CASE WHEN @ToStatus = 'approved' THEN GETUTCDATE() ELSE ApprovedAt END WHERE Id = @WorkflowId; UPDATE dbo.Daily_Report SET Status = @ToStatus, UpdatedAt = GETUTCDATE() WHERE Id = @DailyReportId;`);
      await transaction.commit();
      await writeAudit(pool, req, "REPORT_WORKFLOW_ACTION", { entityName: "Daily_Report", entityId: req.params.id, actionCode, actorRole, toStatus: transition.to });
      const notificationId = await createNotification(pool, req, {
        channel: process.env.WORKFLOW_NOTIFICATION_CHANNEL || "in_app",
        recipient: process.env.WORKFLOW_NOTIFICATION_RECIPIENT || transition.assignee || "project-team",
        subject: `Daily report workflow: ${transition.to}`,
        body: `Daily report ${req.params.id} moved from ${current.CurrentStatus} to ${transition.to} by ${actorRole}.${req.body.comment ? ` Comment: ${req.body.comment}` : ""}`,
        priority: transition.to === "approved" ? "normal" : transition.to === "revision_required" || transition.to === "rejected" ? "high" : "normal",
        relatedEntity: "Daily_Report",
        relatedEntityId: req.params.id,
      });
      if (process.env.WORKFLOW_NOTIFICATION_AUTO_SEND === "true") await deliverNotification(pool, req, notificationId);
      const actions = await pool.request().input("WorkflowId", sql.Int, current.Id).query(`SELECT CAST(Id AS NVARCHAR(30)) AS id, ActionCode AS actionCode, FromStatus AS fromStatus, ToStatus AS toStatus, ActorRole AS actorRole, Comment AS comment, CONVERT(NVARCHAR(30), CreatedAt, 126) AS createdAt FROM dbo.Report_Workflow_Action WHERE WorkflowId = @WorkflowId ORDER BY Id DESC`);
      res.json({ ok: true, data: { id: String(current.Id), dailyReportId: req.params.id, currentStatus: transition.to, currentAssigneeRole: transition.assignee, actions: actions.recordset }, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
    } catch (error) {
      await transaction.rollback().catch(() => {});
      throw error;
    }
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "WORKFLOW_ACTION_ERROR", message: err.message, traceId: req.requestId } });
  }
});

/* ─────────────────── PEX Planning & Execution (F5) ─────────────────── */

async function pexActivityCtx(pool, projectCode) {
  const rs = await pool.request().input("ProjectCode", sql.NVarChar(50), projectCode).query(
    `SELECT a.Code AS code, a.IsLocked AS locked, s.StepSeq AS seq, s.TargetQty AS targetQty
     FROM dbo.pex_activity a LEFT JOIN dbo.pex_activity_step s ON s.ActivityId = a.Id
     WHERE a.ProjectCode = @ProjectCode`
  );
  const activities = {};
  for (const r of rs.recordset) {
    if (!activities[r.code]) activities[r.code] = { locked: !!r.locked, steps: [] };
    if (r.seq != null) activities[r.code].steps.push({ seq: r.seq, targetQty: Number(r.targetQty) });
  }
  return { activities };
}

async function fetchDprDetail(pool, id) {
  const head = await pool.request().input("Id", sql.Int, Number(id)).query(
    `SELECT CAST(Id AS NVARCHAR(30)) AS id, ProjectCode AS projectCode, ReportNo AS reportNo,
     CONVERT(NVARCHAR(20), ReportDate, 23) AS reportDate, Shift AS shift, Weather AS weather,
     Status AS status, CONVERT(NVARCHAR(30), CreatedAt, 126) AS createdAt
     FROM dbo.pex_dpr WHERE Id = @Id`
  );
  const dpr = head.recordset[0];
  if (!dpr) return null;
  const lines = await pool.request().input("Id", sql.Int, Number(id)).input("ProjectCode", sql.NVarChar(50), dpr.projectCode).query(
    `SELECT CAST(l.Id AS NVARCHAR(30)) AS id, CAST(l.DprId AS NVARCHAR(30)) AS dprId,
     l.ActivityCode AS activityCode, a.NameFa AS activityNameFa, l.LocationCode AS locationCode,
     l.StepSeq AS stepSeq, s.NameFa AS stepNameFa, l.Qty AS qty, l.Uom AS uom,
     l.LineStatus AS lineStatus, l.ApprovedQty AS approvedQty, l.Note AS note
     FROM dbo.pex_progress_line l
     LEFT JOIN dbo.pex_activity a ON a.Code = l.ActivityCode AND a.ProjectCode = @ProjectCode
     LEFT JOIN dbo.pex_activity_step s ON s.ActivityId = a.Id AND s.StepSeq = l.StepSeq
     WHERE l.DprId = @Id ORDER BY l.Id`
  );
  const events = await pool.request().input("Id", sql.Int, Number(id)).query(
    `SELECT CAST(Id AS NVARCHAR(30)) AS id, ActionCode AS actionCode, FromStatus AS fromStatus,
     ToStatus AS toStatus, ActorRole AS actorRole, Comment AS comment,
     CONVERT(NVARCHAR(30), CreatedAt, 126) AS createdAt
     FROM dbo.pex_dpr_event WHERE DprId = @Id ORDER BY Id DESC`
  );
  return {
    ...dpr,
    lines: lines.recordset.map((r) => ({ ...r, qty: Number(r.qty), approvedQty: r.approvedQty == null ? null : Number(r.approvedQty) })),
    events: events.recordset,
  };
}

app.get("/api/pex/projects/:code/wbs", async (req, res) => {
  try {
    const pool = await getPool(req);
    const rs = await pool.request().input("ProjectCode", sql.NVarChar(50), req.params.code).query(
      `SELECT w.Code AS code, p.Code AS parentCode, w.NameFa AS nameFa, w.NameEn AS nameEn,
       w.NodeLevel AS [level], w.NodeType AS nodeType, w.Weight AS weight, w.IsLocked AS isLocked
       FROM dbo.pex_wbs w LEFT JOIN dbo.pex_wbs p ON p.Id = w.ParentId
       WHERE w.ProjectCode = @ProjectCode ORDER BY w.Code`
    );
    res.json({ ok: true, data: rs.recordset.map((r) => ({ ...r, weight: Number(r.weight), isLocked: !!r.isLocked })), meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "PEX_WBS_ERROR", message: err.message, traceId: req.requestId } });
  }
});

app.get("/api/pex/projects/:code/activities", async (req, res) => {
  try {
    const pool = await getPool(req);
    const acts = await pool.request().input("ProjectCode", sql.NVarChar(50), req.params.code).query(
      `SELECT a.Code AS code, w.Code AS wbsCode, a.NameFa AS nameFa, a.NameEn AS nameEn,
       a.Bac AS bac, a.DurationHours AS durH, a.TotalFloatH AS tfH,
       a.PctApproved AS pctApproved, a.PctPhysicalDraft AS pctPhysicalDraft,
       a.IsLocked AS locked, a.RocCode AS rocCode
       FROM dbo.pex_activity a LEFT JOIN dbo.pex_wbs w ON w.Id = a.WbsId
       WHERE a.ProjectCode = @ProjectCode ORDER BY a.Code`
    );
    const steps = await pool.request().input("ProjectCode", sql.NVarChar(50), req.params.code).query(
      `SELECT a.Code AS activityCode, s.StepSeq AS seq, s.NameFa AS nameFa, s.NameEn AS nameEn,
       s.Weight AS weight, s.TargetQty AS targetQty, s.Uom AS uom, s.ApprovedQty AS approvedQty
       FROM dbo.pex_activity_step s INNER JOIN dbo.pex_activity a ON a.Id = s.ActivityId
       WHERE a.ProjectCode = @ProjectCode ORDER BY a.Code, s.StepSeq`
    );
    const byAct = {};
    for (const s of steps.recordset) {
      (byAct[s.activityCode] = byAct[s.activityCode] || []).push({
        seq: s.seq, nameFa: s.nameFa, nameEn: s.nameEn, weight: Number(s.weight),
        targetQty: Number(s.targetQty), uom: s.uom, approvedQty: Number(s.approvedQty),
      });
    }
    const data = acts.recordset.map((a) => ({
      ...a, bac: Number(a.bac), durH: Number(a.durH), tfH: Number(a.tfH),
      pctApproved: Number(a.pctApproved), pctPhysicalDraft: Number(a.pctPhysicalDraft),
      locked: !!a.locked, steps: byAct[a.code] || [],
    }));
    res.json({ ok: true, data, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "PEX_ACTIVITIES_ERROR", message: err.message, traceId: req.requestId } });
  }
});

app.get("/api/pex/projects/:code/milestones", async (req, res) => {
  try {
    const pool = await getPool(req);
    const rs = await pool.request().input("ProjectCode", sql.NVarChar(50), req.params.code).query(
      `SELECT m.Code AS code, a.Code AS activityCode, m.MsType AS msType, m.Status AS status,
       m.ContractualFa AS contractualFa, m.ForecastFa AS forecastFa,
       CONVERT(NVARCHAR(20), m.ContractualDate, 23) AS contractualIso,
       CONVERT(NVARCHAR(20), m.ForecastDate, 23) AS forecastIso,
       m.PenaltyPerDay AS penaltyPerDay, m.OwnerOrg AS ownerOrg, m.Priority AS priority
       FROM dbo.pex_milestone m LEFT JOIN dbo.pex_activity a ON a.Id = m.ActivityId
       WHERE m.ProjectCode = @ProjectCode ORDER BY m.ContractualDate`
    );
    res.json({ ok: true, data: rs.recordset.map((r) => ({ ...r, penaltyPerDay: Number(r.penaltyPerDay) })), meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "PEX_MILESTONES_ERROR", message: err.message, traceId: req.requestId } });
  }
});

app.get("/api/pex/projects/:code/roc", async (req, res) => {
  try {
    const pool = await getPool(req);
    const rs = await pool.request().query(
      `SELECT RocCode AS code, NameFa AS nameFa, NameEn AS nameEn, Discipline AS discipline, StepsJson AS stepsJson FROM dbo.pex_roc ORDER BY RocCode`
    );
    const data = rs.recordset.map((r) => {
      let steps = [];
      try { steps = JSON.parse(r.stepsJson || "[]"); } catch { steps = []; }
      return { code: r.code, nameFa: r.nameFa, nameEn: r.nameEn, discipline: r.discipline, steps };
    });
    res.json({ ok: true, data, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "PEX_ROC_ERROR", message: err.message, traceId: req.requestId } });
  }
});

app.post("/api/pex/projects/:code/dpr", async (req, res) => {
  try {
    const projectCode = req.params.code;
    const body = req.body || {};
    const pool = await getPool(req);
    const ctx = await pexActivityCtx(pool, projectCode);
    const dpr = {
      reportDate: normalizeDigits(body.reportDate).trim(),
      shift: String(body.shift || "").toUpperCase(),
      weather: body.weather ? String(body.weather).slice(0, 100) : null,
      lines: Array.isArray(body.lines) ? body.lines : [],
    };
    const errors = validateDpr(dpr, ctx);
    if (errors.length) return res.status(400).json({ ok: false, error: { code: "VALIDATION", message: errors.join(", "), traceId: req.requestId } });
    const open = await pool.request().input("ProjectCode", sql.NVarChar(50), projectCode).query(
      `SELECT CONVERT(NVARCHAR(20), ReportDate, 23) AS reportDate, Shift AS shift, Status AS status FROM dbo.pex_dpr WHERE ProjectCode = @ProjectCode`
    );
    if (openDprBlocked(open.recordset, dpr.reportDate, dpr.shift)) {
      return res.status(409).json({ ok: false, error: { code: "DPR_OPEN_EXISTS", message: "An open DPR already exists for this date/shift", traceId: req.requestId } });
    }
    const stamp = dpr.reportDate.replace(/-/g, "");
    const reportNo = normalizeDigits(body.reportNo).trim() || `DPR-${stamp}-${dpr.shift}-${open.recordset.filter((r) => r.reportDate === dpr.reportDate).length + 1}`;
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      const head = await new sql.Request(transaction)
        .input("ProjectCode", sql.NVarChar(50), projectCode)
        .input("ReportNo", sql.NVarChar(30), reportNo)
        .input("ReportDate", sql.Date, toSqlDate(dpr.reportDate))
        .input("Shift", sql.NVarChar(10), dpr.shift)
        .input("Weather", sql.NVarChar(100), dpr.weather)
        .input("CreatedBy", sql.NVarChar(100), body.createdBy ? String(body.createdBy).slice(0, 100) : null)
        .query(`INSERT INTO dbo.pex_dpr (ProjectCode, ReportNo, ReportDate, Shift, Weather, Status, CreatedBy) VALUES (@ProjectCode, @ReportNo, @ReportDate, @Shift, @Weather, N'draft', @CreatedBy); SELECT CAST(SCOPE_IDENTITY() AS INT) AS id;`);
      const dprId = head.recordset[0].id;
      for (const ln of dpr.lines) {
        await new sql.Request(transaction)
          .input("DprId", sql.Int, dprId)
          .input("ActivityCode", sql.NVarChar(50), String(ln.activityCode))
          .input("LocationCode", sql.NVarChar(50), ln.locationCode ? String(ln.locationCode).slice(0, 50) : null)
          .input("StepSeq", sql.Int, Number(ln.stepSeq))
          .input("Qty", sql.Decimal(18, 4), Number(ln.qty))
          .input("Uom", sql.NVarChar(20), ln.uom ? String(ln.uom).slice(0, 20) : null)
          .input("CrId", sql.NVarChar(50), ln.crId ? String(ln.crId).slice(0, 50) : null)
          .input("Note", sql.NVarChar(500), ln.note ? String(ln.note).slice(0, 500) : null)
          .query(`INSERT INTO dbo.pex_progress_line (DprId, ActivityCode, LocationCode, StepSeq, Qty, Uom, CrId, Note) VALUES (@DprId, @ActivityCode, @LocationCode, @StepSeq, @Qty, @Uom, @CrId, @Note);`);
      }
      await transaction.commit();
      const detail = await fetchDprDetail(pool, dprId);
      res.status(201).json({ ok: true, data: detail, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
    } catch (error) {
      await transaction.rollback().catch(() => {});
      throw error;
    }
  } catch (err) {
    const code = err && err.number === 2627 ? 409 : 500;
    res.status(code).json({ ok: false, error: { code: code === 409 ? "DPR_DUPLICATE" : "DPR_INSERT_ERROR", message: err.message, traceId: req.requestId } });
  }
});

app.get("/api/pex/projects/:code/dpr", async (req, res) => {
  try {
    const pool = await getPool(req);
    const rq = pool.request().input("ProjectCode", sql.NVarChar(50), req.params.code);
    const statusFilter = req.query.status ? String(req.query.status) : "";
    if (statusFilter) rq.input("Status", sql.NVarChar(30), statusFilter);
    const rs = await rq.query(
      `SELECT TOP 200 CAST(d.Id AS NVARCHAR(30)) AS id, d.ProjectCode AS projectCode, d.ReportNo AS reportNo,
       CONVERT(NVARCHAR(20), d.ReportDate, 23) AS reportDate, d.Shift AS shift, d.Weather AS weather,
       d.Status AS status, CONVERT(NVARCHAR(30), d.CreatedAt, 126) AS createdAt,
       (SELECT COUNT(*) FROM dbo.pex_progress_line l WHERE l.DprId = d.Id) AS lineCount
       FROM dbo.pex_dpr d WHERE d.ProjectCode = @ProjectCode${statusFilter ? " AND d.Status = @Status" : ""}
       ORDER BY d.ReportDate DESC, d.Id DESC`
    );
    res.json({ ok: true, data: rs.recordset, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "DPR_LIST_ERROR", message: err.message, traceId: req.requestId } });
  }
});

app.get("/api/pex/projects/:code/dpr/conflicts", async (req, res) => {
  try {
    const pool = await getPool(req);
    const rs = await pool.request().input("ProjectCode", sql.NVarChar(50), req.params.code).query(
      `SELECT CAST(l.DprId AS NVARCHAR(30)) AS dprId, d.ReportNo AS reportNo, l.ActivityCode AS activityCode,
       CONVERT(NVARCHAR(20), d.ReportDate, 23) AS reportDate, l.StepSeq AS stepSeq, l.Qty AS qty
       FROM dbo.pex_progress_line l INNER JOIN dbo.pex_dpr d ON d.Id = l.DprId
       WHERE d.ProjectCode = @ProjectCode AND d.Status <> N'rejected' AND l.LineStatus <> N'void'`
    );
    const groups = new Map();
    for (const r of rs.recordset) {
      const key = `${r.activityCode}|${r.reportDate}|${r.stepSeq}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ dprId: r.dprId, reportNo: r.reportNo, qty: Number(r.qty) });
    }
    const out = [];
    for (const [key, lines] of groups) {
      if (new Set(lines.map((x) => x.qty)).size > 1) {
        const [activityCode, reportDate, stepSeq] = key.split("|");
        out.push({ activityCode, reportDate, stepSeq: Number(stepSeq), lines });
      }
    }
    res.json({ ok: true, data: out, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "DPR_CONFLICTS_ERROR", message: err.message, traceId: req.requestId } });
  }
});

app.get("/api/pex/dpr/:id", async (req, res) => {
  try {
    const pool = await getPool(req);
    // نام فعالیت/گام نیاز به ProjectCode دارد
    const head = await pool.request().input("Id", sql.Int, Number(req.params.id)).query(
      `SELECT ProjectCode FROM dbo.pex_dpr WHERE Id = @Id`
    );
    if (!head.recordset[0]) return res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "DPR not found", traceId: req.requestId } });
    const projectCode = head.recordset[0].ProjectCode;
    const detail = await pool.request().input("Id", sql.Int, Number(req.params.id)).input("ProjectCode", sql.NVarChar(50), projectCode).query(
      `SELECT CAST(Id AS NVARCHAR(30)) AS id, ProjectCode AS projectCode, ReportNo AS reportNo,
       CONVERT(NVARCHAR(20), ReportDate, 23) AS reportDate, Shift AS shift, Weather AS weather,
       Status AS status, CONVERT(NVARCHAR(30), CreatedAt, 126) AS createdAt
       FROM dbo.pex_dpr WHERE Id = @Id`
    );
    const lines = await pool.request().input("Id", sql.Int, Number(req.params.id)).input("ProjectCode", sql.NVarChar(50), projectCode).query(
      `SELECT CAST(l.Id AS NVARCHAR(30)) AS id, CAST(l.DprId AS NVARCHAR(30)) AS dprId,
       l.ActivityCode AS activityCode, a.NameFa AS activityNameFa, l.LocationCode AS locationCode,
       l.StepSeq AS stepSeq, s.NameFa AS stepNameFa, l.Qty AS qty, l.Uom AS uom,
       l.LineStatus AS lineStatus, l.ApprovedQty AS approvedQty, l.Note AS note
       FROM dbo.pex_progress_line l
       LEFT JOIN dbo.pex_activity a ON a.Code = l.ActivityCode AND a.ProjectCode = @ProjectCode
       LEFT JOIN dbo.pex_activity_step s ON s.ActivityId = a.Id AND s.StepSeq = l.StepSeq
       WHERE l.DprId = @Id ORDER BY l.Id`
    );
    const events = await pool.request().input("Id", sql.Int, Number(req.params.id)).query(
      `SELECT CAST(Id AS NVARCHAR(30)) AS id, ActionCode AS actionCode, FromStatus AS fromStatus,
       ToStatus AS toStatus, ActorRole AS actorRole, Comment AS comment,
       CONVERT(NVARCHAR(30), CreatedAt, 126) AS createdAt
       FROM dbo.pex_dpr_event WHERE DprId = @Id ORDER BY Id DESC`
    );
    res.json({ ok: true, data: { ...detail.recordset[0], lines: lines.recordset.map((r) => ({ ...r, qty: Number(r.qty), approvedQty: r.approvedQty == null ? null : Number(r.approvedQty) })), events: events.recordset }, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "DPR_GET_ERROR", message: err.message, traceId: req.requestId } });
  }
});

app.post("/api/pex/dpr/:id/actions", async (req, res) => {
  const actionCode = String(req.body.actionCode || "");
  const actorRole = String(req.body.actorRole || "");
  try {
    const pool = await getPool(req);
    const cur = await pool.request().input("Id", sql.Int, Number(req.params.id)).query(
      `SELECT Id, ProjectCode, Status FROM dbo.pex_dpr WHERE Id = @Id`
    );
    const dpr = cur.recordset[0];
    if (!dpr) return res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "DPR not found", traceId: req.requestId } });
    const check = canDprTransition(dpr.Status, actionCode, actorRole);
    if (!check.ok) {
      const http = check.code === "ROLE_NOT_ALLOWED" ? 403 : check.code === "INVALID_TRANSITION" ? 409 : 400;
      return res.status(http).json({ ok: false, error: { code: check.code, message: `${actionCode} not allowed`, traceId: req.requestId } });
    }
    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      await new sql.Request(transaction)
        .input("DprId", sql.Int, dpr.Id)
        .input("ActionCode", sql.NVarChar(40), actionCode)
        .input("FromStatus", sql.NVarChar(30), dpr.Status)
        .input("ToStatus", sql.NVarChar(30), check.to)
        .input("ActorRole", sql.NVarChar(60), actorRole)
        .input("AssigneeRole", sql.NVarChar(60), check.assignee)
        .input("Comment", sql.NVarChar(2000), req.body.comment ? String(req.body.comment).slice(0, 2000) : null)
        .query(`INSERT INTO dbo.pex_dpr_event (DprId, ActionCode, FromStatus, ToStatus, ActorRole, Comment) VALUES (@DprId, @ActionCode, @FromStatus, @ToStatus, @ActorRole, @Comment);
                UPDATE dbo.pex_dpr SET Status = @ToStatus, AssigneeRole = @AssigneeRole, UpdatedAt = GETUTCDATE() WHERE Id = @DprId;`);
      if (check.to === "approved") {
        // فقط Approved وارد PMS می‌شود: خطوط ← گام‌ها ← درصد فعالیت
        await new sql.Request(transaction)
          .input("DprId", sql.Int, dpr.Id)
          .input("Actor", sql.NVarChar(100), actorRole.slice(0, 100))
          .query(`UPDATE dbo.pex_progress_line SET LineStatus = N'approved', ApprovedQty = Qty, ApprovedBy = @Actor, ApprovedAt = GETUTCDATE() WHERE DprId = @DprId AND LineStatus = N'draft';`);
        await new sql.Request(transaction)
          .input("DprId", sql.Int, dpr.Id)
          .input("ProjectCode", sql.NVarChar(50), dpr.ProjectCode)
          .query(`UPDATE s SET s.ApprovedQty = s.ApprovedQty + l.Qty
                  FROM dbo.pex_activity_step s
                  INNER JOIN dbo.pex_activity a ON a.Id = s.ActivityId
                  INNER JOIN dbo.pex_progress_line l ON l.ActivityCode = a.Code AND l.StepSeq = s.StepSeq
                  WHERE l.DprId = @DprId AND l.LineStatus = N'approved' AND a.ProjectCode = @ProjectCode;`);
        await new sql.Request(transaction)
          .input("DprId", sql.Int, dpr.Id)
          .input("ProjectCode", sql.NVarChar(50), dpr.ProjectCode)
          .query(`UPDATE a SET a.PctApproved = ISNULL((SELECT SUM(s.Weight * CASE WHEN s.TargetQty > 0 THEN CASE WHEN s.ApprovedQty > s.TargetQty THEN 1 ELSE s.ApprovedQty / s.TargetQty END ELSE 0 END) FROM dbo.pex_activity_step s WHERE s.ActivityId = a.Id), 0)
                  FROM dbo.pex_activity a
                  WHERE a.ProjectCode = @ProjectCode AND EXISTS (SELECT 1 FROM dbo.pex_progress_line l WHERE l.DprId = @DprId AND l.ActivityCode = a.Code);`);
      }
      await transaction.commit();
      await writeAudit(pool, req, "PEX_DPR_ACTION", { entityName: "pex_dpr", entityId: req.params.id, actionCode, actorRole, toStatus: check.to });
      const detail = await fetchDprDetail(pool, dpr.Id);
      res.json({ ok: true, data: detail, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
    } catch (error) {
      await transaction.rollback().catch(() => {});
      throw error;
    }
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "DPR_ACTION_ERROR", message: err.message, traceId: req.requestId } });
  }
});

/* ─────────────────────────── HSE Safety/Health/Env (D3) ─────────────────────────── */

const HSE_INCIDENT_SELECT = `SELECT CAST(Id AS NVARCHAR(30)) AS id, ProjectCode AS projectCode, Code AS code, CONVERT(NVARCHAR(20), IncidentDate, 23) AS dateISO, Type AS type, SeverityW AS severityW, LostDays AS lostDays, Area AS area, DescFa AS descFa, Status AS status, VolumeL AS volumeL FROM dbo.hse_incident`;
const HSE_PERMIT_SELECT = `SELECT CAST(Id AS NVARCHAR(30)) AS id, ProjectCode AS projectCode, No AS no, Type AS type, Status AS status, CONVERT(NVARCHAR(20), WorkDate, 23) AS workDate, Area AS area, RiskLevel AS riskLevel, FlagsJson AS flagsJson FROM dbo.hse_permit`;

app.get("/api/hse/projects/:code/incidents", async (req, res) => {
  try {
    const pool = await getPool(req);
    const rq = pool.request().input("ProjectCode", sql.NVarChar(50), req.params.code);
    let extra = "";
    if (req.query.status) { rq.input("Status", sql.NVarChar(20), String(req.query.status)); extra += " AND Status = @Status"; }
    if (req.query.type) { rq.input("Type", sql.NVarChar(20), String(req.query.type)); extra += " AND Type = @Type"; }
    const rs = await rq.query(`${HSE_INCIDENT_SELECT.replace("SELECT", "SELECT TOP 200")} WHERE ProjectCode = @ProjectCode${extra} ORDER BY IncidentDate DESC, Id DESC`);
    res.json({ ok: true, data: rs.recordset.map((r) => ({ ...r, severityW: Number(r.severityW), volumeL: r.volumeL == null ? null : Number(r.volumeL) })), meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "HSE_INCIDENTS_ERROR", message: err.message, traceId: req.requestId } });
  }
});

app.post("/api/hse/projects/:code/incidents", async (req, res) => {
  try {
    const b = req.body || {};
    const input = {
      code: b.code ? normalizeDigits(b.code).trim() : undefined,
      dateISO: normalizeDigits(b.dateISO).trim(),
      type: String(b.type || ""),
      lostDays: b.lostDays == null ? 0 : Number(b.lostDays),
      area: b.area ? String(b.area).slice(0, 200) : "",
      descFa: b.descFa ? String(b.descFa).slice(0, 1000) : "",
      status: b.status ? String(b.status) : "open",
      volumeL: b.volumeL == null ? undefined : Number(b.volumeL),
    };
    const errors = validateIncident(input);
    if (errors.length) return res.status(400).json({ ok: false, error: { code: "VALIDATION", message: errors.join(", "), traceId: req.requestId } });
    const code = input.code || `INC-${input.dateISO.replace(/-/g, "")}-${Date.now().toString(36).toUpperCase()}`;
    const pool = await getPool(req);
    const rs = await pool.request()
      .input("ProjectCode", sql.NVarChar(50), req.params.code)
      .input("Code", sql.NVarChar(50), code)
      .input("IncidentDate", sql.Date, toSqlDate(input.dateISO))
      .input("Type", sql.NVarChar(20), input.type)
      .input("SeverityW", sql.Decimal(8, 2), severityWeight(input.type))
      .input("LostDays", sql.Int, input.lostDays)
      .input("Area", sql.NVarChar(200), input.area)
      .input("DescFa", sql.NVarChar(1000), input.descFa)
      .input("Status", sql.NVarChar(20), input.status)
      .input("VolumeL", sql.Decimal(18, 2), input.volumeL ?? null)
      .query(`INSERT INTO dbo.hse_incident (ProjectCode, Code, IncidentDate, Type, SeverityW, LostDays, Area, DescFa, Status, VolumeL) VALUES (@ProjectCode, @Code, @IncidentDate, @Type, @SeverityW, @LostDays, @Area, @DescFa, @Status, @VolumeL); ${HSE_INCIDENT_SELECT} WHERE Id = SCOPE_IDENTITY();`);
    const row = rs.recordset[0];
    res.status(201).json({ ok: true, data: { ...row, severityW: Number(row.severityW), volumeL: row.volumeL == null ? null : Number(row.volumeL) }, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    const dup = err && err.number === 2627;
    res.status(dup ? 409 : 500).json({ ok: false, error: { code: dup ? "HSE_DUPLICATE" : "HSE_INCIDENT_INSERT_ERROR", message: err.message, traceId: req.requestId } });
  }
});

app.get("/api/hse/projects/:code/permits", async (req, res) => {
  try {
    const pool = await getPool(req);
    const rq = pool.request().input("ProjectCode", sql.NVarChar(50), req.params.code);
    let extra = "";
    if (req.query.status) { rq.input("Status", sql.NVarChar(20), String(req.query.status)); extra += " AND Status = @Status"; }
    const rs = await rq.query(`${HSE_PERMIT_SELECT.replace("SELECT", "SELECT TOP 200")} WHERE ProjectCode = @ProjectCode${extra} ORDER BY WorkDate DESC, Id DESC`);
    res.json({ ok: true, data: rs.recordset, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "HSE_PERMITS_ERROR", message: err.message, traceId: req.requestId } });
  }
});

app.post("/api/hse/projects/:code/permits", async (req, res) => {
  try {
    const b = req.body || {};
    const input = {
      no: b.no ? normalizeDigits(b.no).trim() : undefined,
      type: String(b.type || ""),
      workDate: normalizeDigits(b.workDate).trim(),
      area: b.area ? String(b.area).slice(0, 200) : "",
      riskLevel: String(b.riskLevel || ""),
      flags: b.flags && typeof b.flags === "object" ? b.flags : {},
    };
    const errors = validatePermit(input);
    if (errors.length) return res.status(400).json({ ok: false, error: { code: "VALIDATION", message: errors.join(", "), traceId: req.requestId } });
    const warnings = ptwMissing(input.type, input.flags);
    const no = input.no || `PTW-${input.workDate.replace(/-/g, "")}-${Date.now().toString(36).toUpperCase()}`;
    const flagsJson = Object.keys(input.flags).length ? JSON.stringify(input.flags) : null;
    const pool = await getPool(req);
    const rs = await pool.request()
      .input("ProjectCode", sql.NVarChar(50), req.params.code)
      .input("No", sql.NVarChar(50), no)
      .input("Type", sql.NVarChar(20), input.type)
      .input("WorkDate", sql.Date, toSqlDate(input.workDate))
      .input("Area", sql.NVarChar(200), input.area)
      .input("RiskLevel", sql.NVarChar(20), input.riskLevel)
      .input("FlagsJson", sql.NVarChar(sql.MAX), flagsJson)
      .query(`INSERT INTO dbo.hse_permit (ProjectCode, No, Type, Status, WorkDate, Area, RiskLevel, FlagsJson) VALUES (@ProjectCode, @No, @Type, N'draft', @WorkDate, @Area, @RiskLevel, @FlagsJson); ${HSE_PERMIT_SELECT} WHERE Id = SCOPE_IDENTITY();`);
    res.status(201).json({ ok: true, data: { ...rs.recordset[0], warnings }, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    const dup = err && err.number === 2627;
    res.status(dup ? 409 : 500).json({ ok: false, error: { code: dup ? "HSE_DUPLICATE" : "HSE_PERMIT_INSERT_ERROR", message: err.message, traceId: req.requestId } });
  }
});

app.post("/api/hse/permits/:id/actions", async (req, res) => {
  const action = String(req.body.action || "");
  const role = String(req.body.role || "");
  try {
    const pool = await getPool(req);
    const cur = await pool.request().input("Id", sql.Int, Number(req.params.id)).query(`SELECT Id, Status FROM dbo.hse_permit WHERE Id = @Id`);
    const pmt = cur.recordset[0];
    if (!pmt) return res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "Permit not found", traceId: req.requestId } });
    const check = ptwCanTransition(pmt.Status, action, role);
    if (!check.ok) {
      const http = check.code === "ROLE_NOT_ALLOWED" ? 403 : check.code === "INVALID_TRANSITION" ? 409 : 400;
      return res.status(http).json({ ok: false, error: { code: check.code, message: `${action} not allowed`, traceId: req.requestId } });
    }
    await pool.request().input("Id", sql.Int, pmt.Id).input("ToStatus", sql.NVarChar(20), check.to)
      .query(`UPDATE dbo.hse_permit SET Status = @ToStatus, UpdatedAt = GETUTCDATE() WHERE Id = @Id;`);
    await writeAudit(pool, req, "HSE_PERMIT_ACTION", { entityName: "hse_permit", entityId: req.params.id, action, role, toStatus: check.to });
    const rs = await pool.request().input("Id", sql.Int, pmt.Id).query(`${HSE_PERMIT_SELECT} WHERE Id = @Id`);
    res.json({ ok: true, data: rs.recordset[0], meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "HSE_PERMIT_ACTION_ERROR", message: err.message, traceId: req.requestId } });
  }
});

app.get("/api/hse/projects/:code/inspections", async (req, res) => {
  try {
    const pool = await getPool(req);
    const rs = await pool.request().input("ProjectCode", sql.NVarChar(50), req.params.code).query(
      `SELECT TOP 200 CAST(Id AS NVARCHAR(30)) AS id, ProjectCode AS projectCode, Area AS area, CONVERT(NVARCHAR(20), InspectDate, 23) AS dateISO, Score AS score, Band AS band, ItemsJson AS itemsJson, CONVERT(NVARCHAR(20), NextDue, 23) AS nextDue FROM dbo.hse_inspection WHERE ProjectCode = @ProjectCode ORDER BY InspectDate DESC, Id DESC`
    );
    const data = rs.recordset.map((r) => {
      let items = [];
      try { items = JSON.parse(r.itemsJson || "[]").map((x) => ({ item: x.item, ok: !!x.ok, na: !!x.na })); } catch { items = []; }
      return { id: r.id, projectCode: r.projectCode, area: r.area, dateISO: r.dateISO, items, score: r.score, band: r.band, nextDue: r.nextDue };
    });
    res.json({ ok: true, data, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "HSE_INSPECTIONS_ERROR", message: err.message, traceId: req.requestId } });
  }
});

app.post("/api/hse/projects/:code/inspections", async (req, res) => {
  try {
    const b = req.body || {};
    const input = {
      area: b.area ? String(b.area).slice(0, 200) : "",
      dateISO: normalizeDigits(b.dateISO).trim(),
      items: Array.isArray(b.items) ? b.items.map((x) => ({ item: String(x.item || "").slice(0, 500), ok: !!x.ok, na: !!x.na })) : [],
    };
    const errors = validateInspection(input);
    if (errors.length) return res.status(400).json({ ok: false, error: { code: "VALIDATION", message: errors.join(", "), traceId: req.requestId } });
    const score = inspectionScore(input.items);
    const band = inspectionBand(score);
    const pool = await getPool(req);
    const rs = await pool.request()
      .input("ProjectCode", sql.NVarChar(50), req.params.code)
      .input("Area", sql.NVarChar(200), input.area)
      .input("InspectDate", sql.Date, toSqlDate(input.dateISO))
      .input("Score", sql.Int, score)
      .input("Band", sql.Char(1), band)
      .input("ItemsJson", sql.NVarChar(sql.MAX), JSON.stringify(input.items.map((x) => ({ item: x.item, ok: x.ok ? 1 : 0, ...(x.na ? { na: 1 } : {}) }))))
      .input("NextDue", sql.Date, toSqlDate(nextInspectionDue(input.dateISO, band)))
      .query(`INSERT INTO dbo.hse_inspection (ProjectCode, Area, InspectDate, Score, Band, ItemsJson, NextDue) VALUES (@ProjectCode, @Area, @InspectDate, @Score, @Band, @ItemsJson, @NextDue); SELECT CAST(SCOPE_IDENTITY() AS INT) AS id;`);
    res.status(201).json({ ok: true, data: { id: String(rs.recordset[0].id), projectCode: req.params.code, area: input.area, dateISO: input.dateISO, items: input.items, score, band, nextDue: nextInspectionDue(input.dateISO, band) }, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "HSE_INSPECTION_INSERT_ERROR", message: err.message, traceId: req.requestId } });
  }
});

app.get("/api/hse/projects/:code/wo-gate", async (req, res) => {
  try {
    const pool = await getPool(req);
    const rs = await pool.request().input("ProjectCode", sql.NVarChar(50), req.params.code).query(
      `SELECT No AS no, Type AS type, Status AS status, CONVERT(NVARCHAR(20), WorkDate, 23) AS workDate, Area AS area FROM dbo.hse_permit WHERE ProjectCode = @ProjectCode`
    );
    const verdict = woPermitGate({
      workType: String(req.query.workType || "general"),
      area: req.query.area ? String(req.query.area) : undefined,
      workDate: normalizeDigits(req.query.workDate).trim() || new Date().toISOString().slice(0, 10),
    }, rs.recordset, "advisory");
    res.json({ ok: true, data: verdict, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "HSE_WO_GATE_ERROR", message: err.message, traceId: req.requestId } });
  }
});

/* ──────────────────────── Portfolio Summary ──────────────────────── */
app.get("/api/portfolio/summary", async (req, res) => {
  try {
    const pool = await getPool(req);
    const result = await pool.request().query(`SELECT SUM(ActiveProjects) AS activeProjects, SUM(TenderProjects) AS tenderProjects, SUM(StoppedProjects) AS stoppedProjects, SUM(CompletedProjects) AS completedProjects FROM dbo.Portfolio_Snapshot`);
    const summary = result.recordset[0] || { activeProjects: 0, tenderProjects: 0, stoppedProjects: 0, completedProjects: 0 };
    res.json({ ok: true, data: { ...summary, spi: 0.97, cpi: 1.03, criticalRisks: 11 }, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    res.status(500).json({ ok: false, error: { code: "SUMMARY_ERROR", message: err.message, traceId: req.requestId } });
  }
});

/* ──────────────────────── RCC guardian (in-memory job; SQL optional) ──────────────────────── */
const rccNotices = [
  { id: "n1", claimId: "CLM-01", title: "EOT Long Lead", dueAt: new Date(Date.now() + 12 * 86400000).toISOString().slice(0, 10) },
  { id: "n2", claimId: "CLM-02", title: "Access delay", dueAt: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10) },
  { id: "n3", claimId: "CLM-03", title: "Weather window", dueAt: new Date(Date.now() - 86400000).toISOString().slice(0, 10) },
];

app.get("/api/rcc/notices", (_req, res) => {
  res.json({ ok: true, data: rccNotices });
});

app.post("/api/rcc/guardian/tick", (req, res) => {
  const result = applyGuardian(rccNotices, new Date());
  rccNotices.splice(0, rccNotices.length, ...result.notices);
  res.json({ ok: true, data: result, meta: { writesSpi: false } });
});

app.get("/api/rcc/suggests", (_req, res) => {
  res.json({
    ok: true,
    data: {
      rules: ["TF0→risk", "High occurred→issue", "CCB approve→PEX snapshot suggest"],
      note: "RCC never writes pctApproved/SPI",
    },
  });
});

const guardianMs = Number(process.env.RCC_GUARDIAN_MS || 0);
if (guardianMs > 0) {
  setInterval(() => {
    const result = applyGuardian(rccNotices, new Date());
    rccNotices.splice(0, rccNotices.length, ...result.notices);
    if (result.events.length) console.log("[rcc-guardian]", result.events.map((e) => e.ews).join(","));
  }, guardianMs).unref();
}

/* ──────────────────────── GOV governance (d6) — in-memory; SQL optional ──────────────────────── */
const isoIn = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

const govTasks = [
  { id: "wf1", code: "WF-MDR-084", processFa: "تأیید نقشه شاپ فونداسیون", assignee: "مهندس ناظر مقیم", dueAt: isoIn(6) },
  { id: "wf2", code: "WF-CR-012", processFa: "درخواست تغییر قیمت الحاقیه", assignee: "مدیر پروژه کارفرما", dueAt: isoIn(-5) },
  { id: "wf3", code: "WF-CLM-007", processFa: "دروازه ادعا (Notice / Time-Bar)", assignee: "کمیته ادعا", dueAt: isoIn(1) },
];

const govConnectors = [
  { id: "in1", system: "Primavera P6", owningDomain: "d2", direction: "pull", lastSync: new Date(Date.now() - 4 * 3600000).toISOString().slice(0, 16).replace("T", " "), slaHours: 24, records: 4820 },
  { id: "in2", system: "ERP / SAP", owningDomain: "d5", direction: "pull", lastSync: new Date(Date.now() - 6 * 3600000).toISOString().slice(0, 16).replace("T", " "), slaHours: 24, records: 1290 },
  { id: "in3", system: "EDMS", owningDomain: "d1", direction: "two_way", lastSync: new Date(Date.now() - 30 * 3600000).toISOString().slice(0, 16).replace("T", " "), slaHours: 24, records: 7315 },
  { id: "in4", system: "Power BI Gateway", owningDomain: "d3", direction: "push", lastSync: new Date(Date.now() - 8 * 86400000).toISOString().slice(0, 16).replace("T", " "), slaHours: 24, records: 0 },
];

const govFindings = [
  { id: "au1", code: "AUD-PMBOK-01", itemFa: "انطباق فرآیند کنترل تغییرات با PMBOK", standard: "PMBOK 7th Ed.", weight: 2, compliance: 92, severity: "minor", capaId: null },
  { id: "au2", code: "AUD-HSE-04", itemFa: "ممیزی چک‌لیست‌های HSE کارگاه", standard: "ISO 45001", weight: 1, compliance: 85, severity: "major", capaId: "CAPA-118" },
  { id: "au3", code: "AUD-DOC-11", itemFa: "انطباق شماره‌گذاری و گردش مدارک", standard: "ISO 9001 / EDMS", weight: 1, compliance: 68, severity: "critical", capaId: null },
];

const govDecisions = [
  { id: "de1", code: "DEC-2026-041", subjectFa: "تخصیص ذخیره احتیاطی به بسته سیویل", authority: "PM", evidenceRef: "PMA:EVM#1405-06", cost: 180000, days: 10, dueAt: isoIn(12), state: "open" },
  { id: "de2", code: "DEC-2026-038", subjectFa: "تمدید زمان ۱۴ روزه ناشی از تأخیر کارفرما", authority: "PMO", evidenceRef: "RCC:CLM-007", cost: 0, days: 14, dueAt: isoIn(-3), state: "open" },
  { id: "de3", code: "DEC-2026-035", subjectFa: "تأیید بازنگری برنامه پایه (Rebaseline)", authority: "STEERING", evidenceRef: "PEX:BL#3", cost: 0, days: 45, dueAt: isoIn(-15), rewritesBaseline: true, crId: "CR-2026-19", state: "approved" },
];

let govTrail = [];

const govOk = (req, data, meta = {}) =>
  ({ ok: true, data, meta: { traceId: req.requestId, timestamp: new Date().toISOString(), ...meta } });

app.get("/api/gov/workflow-tasks", (req, res) => {
  const events = workflowTick(govTasks, new Date());
  const data = govTasks.map((t) => {
    const e = events.find((x) => x.taskId === t.id);
    return { ...t, daysLeft: e?.daysLeft ?? null, slaLevel: e?.level ?? "ok", escalation: e?.escalation ?? "L0", action: e?.action ?? "none" };
  });
  res.json(govOk(req, data, { writesOwnedFigures: false }));
});

app.post("/api/gov/workflow-tasks/:taskId/approve", (req, res) => {
  const task = govTasks.find((t) => t.id === req.params.taskId);
  if (!task) return res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "task", traceId: req.requestId } });
  if (task.closedAt) return res.json(govOk(req, { idempotent: true, entry: govTrail[govTrail.length - 1] }));
  task.closedAt = new Date().toISOString().slice(0, 10);
  govTrail = appendTrail(govTrail, `APPROVE:${task.id}:${req.body?.actor || "system"}`);
  res.json(govOk(req, { entry: govTrail[govTrail.length - 1] }));
});

app.get("/api/gov/connectors", (req, res) => {
  res.json(govOk(req, govConnectors.map((c) => ({ ...c, health: connectorHealth(c.lastSync, c.slaHours) }))));
});

app.get("/api/gov/audit/findings", (req, res) => {
  const score = complianceScore(govFindings);
  res.json(govOk(req, { score, band: complianceBand(score), closeBlocked: auditCloseBlocked(govFindings), items: govFindings }));
});

app.post("/api/gov/audit/plans/:planId/close", (req, res) => {
  if (auditCloseBlocked(govFindings)) {
    return res.status(409).json({ ok: false, error: { code: "GOV-409-CAPA", message: "major/critical finding without CAPA", traceId: req.requestId } });
  }
  res.json(govOk(req, { planId: req.params.planId, state: "closed" }));
});

app.get("/api/gov/decisions", (req, res) => {
  res.json(govOk(req, govDecisions.map((d) => ({ ...d, requiredAuthority: authorityFor(d.cost || 0, d.days || 0), gate: decisionGate(d) }))));
});

app.post("/api/gov/decisions", (req, res) => {
  const d = req.body || {};
  const gate = decisionGate(d);
  if (!gate.ok) {
    const code = gate.reasons.includes("authority_insufficient")
      ? "GOV-403-DOA"
      : gate.reasons.includes("baseline_rewrite_without_cr")
      ? "GOV-409-BASELINE"
      : "GOV-409-EVIDENCE";
    const status = code === "GOV-403-DOA" ? 403 : 409;
    return res.status(status).json({ ok: false, error: { code, message: "decision gate rejected", reasons: gate.reasons, traceId: req.requestId } });
  }
  const row = { ...d, id: d.id || `de${govDecisions.length + 1}`, state: "open", requiredAuthority: authorityFor(d.cost || 0, d.days || 0) };
  govDecisions.push(row);
  govTrail = appendTrail(govTrail, `DECISION:${row.code || row.id}`);
  res.status(201).json(govOk(req, row));
});

/* ──────────────────────── QMS quality & inspection (d8) — in-memory; SQL optional ──────────────────────── */

const qmsItp = [
  { id: "ITP-01-H", activityId: "A-1100", type: "H", party: "consultant", titleFa: "تأیید آرماتوربندی پیش از بتن‌ریزی", signedAt: isoIn(-6) },
  { id: "ITP-02-W", activityId: "A-1200", type: "W", party: "client", titleFa: "شاهد آزمون اسلامپ بتن" },
  { id: "ITP-03-H", activityId: "A-1300", type: "H", party: "tpi", titleFa: "توقف پیش از پوشش جوش خط ۱۴ اینچ" },
  { id: "ITP-04-R", activityId: "A-1400", type: "R", party: "consultant", titleFa: "بازبینی دستورالعمل جوشکاری WPS" },
  { id: "ITP-05-H", activityId: "A-1500", type: "H", party: "client", titleFa: "تأیید تست هیدرواستاتیک", waivedBy: "مدیر کیفیت" },
  { id: "ITP-06-M", activityId: "A-1100", type: "M", party: "contractor", titleFa: "پایش دمای عمل‌آوری بتن" },
];
const qmsActivities = ["A-1100", "A-1200", "A-1300", "A-1400", "A-1500", "A-1600"];

const qmsIrs = [
  { id: "IR-4410", titleFa: "بازرسی ابعادی اسپول SP-14", requestedAt: "2026-09-01T08:00:00Z", inspectionAt: "2026-09-04T08:00:00Z", noticeHours: 48, defects: [] },
  { id: "IR-4411", titleFa: "بازرسی چشمی جوش W-221", requestedAt: "2026-09-03T09:00:00Z", inspectionAt: "2026-09-04T09:00:00Z", noticeHours: 48, defects: [{ severity: "minor" }] },
  { id: "IR-4412", titleFa: "آزمون رادیوگرافی خط ۱۴ اینچ", requestedAt: "2026-09-02T07:00:00Z", inspectionAt: "2026-09-06T07:00:00Z", noticeHours: 48, defects: [{ severity: "critical" }] },
  { id: "IR-4413", titleFa: "بازرسی رنگ و پوشش مخزن T-02", requestedAt: "2026-09-04T10:00:00Z", inspectionAt: "2026-09-07T10:00:00Z", noticeHours: 48, defects: [{ severity: "major" }, { severity: "minor" }] },
];

const qmsNcrs = [
  { id: "NCR-2026-018", severity: "critical", openedAt: isoIn(-14), titleFa: "ترک در جوش محیطی خط ۱۴ اینچ", cause: "جوشکاری", disposition: "rework", recurrence: 4, capaId: "CAPA-07" },
  { id: "NCR-2026-021", severity: "major", openedAt: isoIn(-9), closedAt: isoIn(-3), titleFa: "انحراف ابعادی صفحه کف ستون", cause: "ابعاد", disposition: "repair", concessionBy: "مهندس ارشد سازه", recurrence: 2 },
  { id: "NCR-2026-024", severity: "minor", openedAt: isoIn(-7), titleFa: "ضخامت رنگ کمتر از مشخصات", cause: "رنگ", disposition: "rework", recurrence: 1 },
  { id: "NCR-2026-025", severity: "major", openedAt: isoIn(-5), titleFa: "نبود گواهی مواد برای شیر ۸ اینچ", cause: "مستندات", disposition: "use_as_is", recurrence: 1 },
];

const qmsCerts = [
  { itemFa: "لوله بدون درز ۱۴ اینچ", heatNo: "H-99312", certType: "3.1", issuedAt: "2026-05-11", declaredGrade: "A106-B", requiredGrade: "A106-B", labVerified: true },
  { itemFa: "میلگرد A3 قطر ۱۸", heatNo: "H-88120", certType: "2.2", issuedAt: "2026-06-02", declaredGrade: "AIII", requiredGrade: "AIII", labVerified: true },
  { itemFa: "شیر پروانه‌ای ۸ اینچ", heatNo: "H-77045", certType: "3.1", issuedAt: "2025-08-01", expiresAt: "2026-08-01", declaredGrade: "WCB", requiredGrade: "WCB", labVerified: false },
  { itemFa: "ورق مخزن ۱۲ میلی‌متر", heatNo: "H-66190", certType: "3.2", issuedAt: "2026-07-19", declaredGrade: "A283-C", requiredGrade: "A516-70", labVerified: true },
];

const qmsFindings = [
  { clause: "8.5.1", titleFa: "نبود شواهد کنترل عملیات جوشکاری", severity: "major" },
  { clause: "7.5.3", titleFa: "نسخه منسوخ نقشه در کارگاه", severity: "minor" },
  { clause: "9.2.2", titleFa: "تأخیر در برنامه ممیزی داخلی", severity: "observation", closed: true },
  { clause: "8.7", titleFa: "پیگیری ناقص خروجی نامنطبق", severity: "minor", closed: true },
];

const qmsPunch = [
  { id: "PL-101", category: "A", systemId: "SYS-01", titleFa: "نصب نشدن شیر اطمینان PSV-3" },
  { id: "PL-102", category: "A", systemId: "SYS-01", titleFa: "نقص ارت تجهیز E-11", closed: true },
  { id: "PL-103", category: "B", systemId: "SYS-02", titleFa: "رنگ‌آمیزی نهایی سکوی دسترسی" },
  { id: "PL-104", category: "B", systemId: "SYS-02", titleFa: "برچسب‌گذاری خطوط", closed: true },
  { id: "PL-105", category: "B", systemId: "SYS-01", titleFa: "تکمیل عایق‌کاری", closed: true },
];

const qmsDossierRequired = ["ITP امضاشده", "گزارش بازرسی", "گواهی مواد", "نتایج NDT", "نقشه چون‌ساخت", "گزارش تست هیدرواستاتیک", "لیست پانچ", "گواهی کالیبراسیون"];
const qmsDossierDelivered = ["ITP امضاشده", "گزارش بازرسی", "گواهی مواد", "نتایج NDT", "لیست پانچ", "گواهی کالیبراسیون"];
const qmsSignatures = {};

const qmsOk = (req, data, meta = {}) =>
  ({ ok: true, data, meta: { traceId: req.requestId, timestamp: new Date().toISOString(), writesOwnedFigures: false, ...meta } });

app.get("/api/qms/itp", (req, res) => {
  const gate = canProceed(qmsItp);
  res.json(qmsOk(req, {
    points: qmsItp,
    blocking: itpBlocking(qmsItp).map((p) => p.id),
    canProceed: gate.ok,
    coveragePct: itpCoverage(qmsActivities, qmsItp),
  }));
});

/** امضای نقطه توقف — تنها راه رفع انسداد کار. */
app.post("/api/qms/itp/:pointId/sign", (req, res) => {
  const point = qmsItp.find((p) => p.id === req.params.pointId);
  if (!point) return res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "itp point", traceId: req.requestId } });
  if (point.signedAt) return res.json(qmsOk(req, { idempotent: true, point }));
  point.signedAt = new Date().toISOString().slice(0, 10);
  point.signedBy = req.body?.actor || "system";
  res.json(qmsOk(req, { point, canProceed: canProceed(qmsItp).ok }));
});

app.get("/api/qms/inspections", (req, res) => {
  const rows = qmsIrs.map((ir) => ({ ...ir, notice: irNoticeCheck(ir), outcome: irOutcome(ir.defects), signature: qmsSignatures[ir.id] ?? null }));
  res.json(qmsOk(req, {
    items: rows,
    firstPassYieldPct: firstPassYield(rows.filter((r) => r.outcome === "accepted").length, rows.length),
  }));
});

/** ثبت نتیجه بازرسی همراه امضای هش‌دار غیرقابل انکار. */
app.post("/api/qms/inspections/:irId/sign", (req, res) => {
  const ir = qmsIrs.find((x) => x.id === req.params.irId);
  if (!ir) return res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "inspection request", traceId: req.requestId } });
  const sig = signRecord({ id: ir.id, defects: ir.defects }, req.body?.actor || "system", new Date().toISOString());
  qmsSignatures[ir.id] = sig;
  res.json(qmsOk(req, { irId: ir.id, outcome: irOutcome(ir.defects), signature: sig }));
});

app.get("/api/qms/ncr", (req, res) => {
  const now = new Date();
  const items = qmsNcrs.map((n) => ({
    ...n,
    overdue: ncrOverdue(n, now),
    capaRequired: capaRequired(n.severity, n.recurrence),
    dispositionCheck: dispositionAllowed(n.disposition, n.concessionBy),
  }));
  const causes = {};
  for (const n of qmsNcrs) causes[n.cause] = (causes[n.cause] ?? 0) + 1;
  res.json(qmsOk(req, {
    items,
    closureRatePct: ncrClosureRate(qmsNcrs),
    pareto: pareto(Object.entries(causes).map(([cause, count]) => ({ cause, count }))),
  }));
});

/** ثبت عدم انطباق جدید — شدت و مهلت خودکار تعیین می‌شود؛ تعیین تکلیف غیرمجاز رد می‌شود. */
app.post("/api/qms/ncr", (req, res) => {
  const b = req.body || {};
  const severity = b.severity || ncrSeverity({
    safetyImpact: Boolean(b.safetyImpact),
    structuralImpact: Boolean(b.structuralImpact),
    reworkCost: Number(b.reworkCost || 0),
    functionalImpact: Boolean(b.functionalImpact),
  });
  const disposition = b.disposition || "rework";
  const check = dispositionAllowed(disposition, b.concessionBy);
  if (!check.ok) {
    return res.status(409).json({ ok: false, error: { code: "QMS-409-CONCESSION", message: check.reason, traceId: req.requestId } });
  }
  const row = {
    id: b.id || `NCR-${new Date().getFullYear()}-${String(qmsNcrs.length + 1).padStart(3, "0")}`,
    titleFa: b.titleFa || "عدم انطباق ثبت‌شده از API",
    severity,
    openedAt: new Date().toISOString().slice(0, 10),
    cause: b.cause || "نامشخص",
    disposition,
    concessionBy: b.concessionBy,
    recurrence: Number(b.recurrence || 1),
  };
  qmsNcrs.push(row);
  res.status(201).json(qmsOk(req, { ...row, capaRequired: capaRequired(severity, row.recurrence) }));
});

app.get("/api/qms/certificates", (req, res) => {
  const now = new Date();
  const items = qmsCerts.map((c) => ({ ...c, verdict: verifyCertificate(c, req.query.minType === "3.2" ? "3.2" : "3.1", now) }));
  res.json(qmsOk(req, { items, rejected: items.filter((i) => !i.verdict.ok).length }));
});

app.get("/api/qms/audit", (req, res) => {
  res.json(qmsOk(req, {
    findings: qmsFindings,
    score: qmsComplianceScore(qmsFindings),
    certificationRisk: certificationRisk(qmsFindings),
  }));
});

app.get("/api/qms/handover", (req, res) => {
  const dossier = dossierCompleteness(qmsDossierRequired, qmsDossierDelivered);
  const gate = mechanicalCompletionGate({
    punch: qmsPunch,
    ncrs: qmsNcrs,
    itp: qmsItp,
    dossierCompletenessPct: dossier.pct,
    preCommissioningDone: true,
  });
  res.json(qmsOk(req, { punch: qmsPunch, summary: punchSummary(qmsPunch), dossier, gate }));
});

/** صدور گواهی تحویل مکانیکی — با هر مسدودکننده باز، ۴۰۹ برمی‌گرداند. */
app.post("/api/qms/handover/mc", (req, res) => {
  const dossier = dossierCompleteness(qmsDossierRequired, qmsDossierDelivered);
  const gate = mechanicalCompletionGate({
    punch: qmsPunch,
    ncrs: qmsNcrs,
    itp: qmsItp,
    dossierCompletenessPct: dossier.pct,
    preCommissioningDone: Boolean(req.body?.preCommissioningDone ?? true),
  });
  if (!gate.ok) {
    return res.status(409).json({ ok: false, error: { code: "QMS-409-MC-GATE", message: gate.blockers.join(","), traceId: req.requestId } });
  }
  res.json(qmsOk(req, { certificate: `MC-${req.body?.systemId || "SYS-01"}-${new Date().toISOString().slice(0, 10)}`, state: "issued" }));
});

app.get("/api/qms/dashboard", (req, res) => {
  const now = new Date();
  const irRows = qmsIrs.map((ir) => irOutcome(ir.defects));
  const dossier = dossierCompleteness(qmsDossierRequired, qmsDossierDelivered);
  const summary = punchSummary(qmsPunch);
  const coq = costOfQuality(
    { prevention: 8_400_000_000, appraisal: 12_600_000_000, internalFailure: 9_800_000_000, externalFailure: 2_300_000_000 },
    620_000_000_000
  );
  const alerts = qmsEws({
    openCriticalNcr: qmsNcrs.filter((n) => n.severity === "critical" && !n.closedAt).length,
    ncrOverdueCount: qmsNcrs.filter((n) => ncrOverdue(n, now)).length,
    fpyPct: firstPassYield(irRows.filter((r) => r === "accepted").length, irRows.length),
    copqPct: coq.copqPct,
    openMajorAuditFindings: qmsFindings.filter((f) => f.severity === "major" && !f.closed).length,
    certRejections: qmsCerts.filter((c) => !verifyCertificate(c, "3.1", now).ok).length,
    openPunchA: summary.openA,
    unsignedHoldPoints: itpBlocking(qmsItp).length,
  });
  res.json(qmsOk(req, {
    itpCoveragePct: itpCoverage(qmsActivities, qmsItp),
    firstPassYieldPct: firstPassYield(irRows.filter((r) => r === "accepted").length, irRows.length),
    ncrClosureRatePct: ncrClosureRate(qmsNcrs),
    copqPct: coq.copqPct,
    complianceScore: qmsComplianceScore(qmsFindings),
    dossierPct: dossier.pct,
    alerts,
  }));
});

app.get("/api/gov/audit-trail", (req, res) => {
  res.json(govOk(req, { valid: verifyTrail(govTrail), entries: govTrail }));
});

const govTickMs = Number(process.env.GOV_SLA_TICK_MS || 0);
if (govTickMs > 0) {
  setInterval(() => {
    const events = workflowTick(govTasks, new Date()).filter((e) => e.action !== "none");
    if (events.length) console.log("[gov-sla]", events.map((e) => `${e.taskId}:${e.escalation}`).join(","));
  }, govTickMs).unref();
}


/* ═══════════════════════ PEX (d2) — برنامه‌ریزی و اجرای عملیات ═══════════════════════ */

/** PEX مالک ارقام «پیشرفت» و «برنامه پایه» است (DATA_OWNER در حاکمیت). */
const pexOk = (req, data, meta = {}) =>
  ({ ok: true, data, meta: { traceId: req.requestId, timestamp: new Date().toISOString(), writesOwnedFigures: true, ownedFields: ["progress", "baseline"], ...meta } });

const pexModel = (req) => {
  const mode = ["Cost", "MH", "Hybrid", "BOQ", "Manual"].includes(req.query.mode) ? req.query.mode : "Cost";
  const alpha = req.query.alpha == null ? 1 : Math.max(0, Math.min(1, Number(req.query.alpha)));
  return buildPexModel(mode, Number.isFinite(alpha) ? alpha : 1);
};

app.get("/api/pex/schedule", (req, res) => {
  const m = pexModel(req);
  res.json(pexOk(req, {
    project: m.project,
    dataDate: m.dataDate,
    formulaVersion: m.cpm.formulaVersion,
    projectStart: m.cpm.projectStart,
    projectFinish: m.cpm.projectFinish,
    baseline: { start: m.baseline.projectStart, finish: m.baseline.projectFinish, lengthDays: m.baseline.cpLengthDays },
    activities: m.rows.map((r) => ({
      id: r.id, wbs: r.wbs, nameFa: r.nameFa, duration: r.duration, es: r.es, ef: r.ef, ls: r.ls, lf: r.lf,
      totalFloat: r.totalFloat, freeFloat: r.freeFloat, critical: r.critical,
      baselineStart: r.baselineStart, baselineFinish: r.baselineFinish,
      physicalPct: r.physicalPct, plannedPct: r.plannedPct, weight: r.weight, blockedSteps: r.blockedSteps,
    })),
  }));
});

app.get("/api/pex/critical-path", (req, res) => {
  const m = pexModel(req);
  res.json(pexOk(req, {
    criticalPath: m.cpm.criticalPath,
    lengthDays: m.cpm.cpLengthDays,
    snapshot: m.snapshot,
    nearCritical: m.nearCritical.map((r) => ({ id: r.id, nameFa: r.nameFa, totalFloat: r.totalFloat })),
    dcma: m.dcma,
  }));
});

app.get("/api/pex/milestones", (req, res) => {
  const m = pexModel(req);
  res.json(pexOk(req, { dataDate: m.dataDate, items: m.milestones, totalPenalty: m.totalPenalty }));
});

app.get("/api/pex/progress", (req, res) => {
  const m = pexModel(req);
  res.json(pexOk(req, {
    weightMode: m.weightMode,
    overallPct: m.overallPct,
    plannedPct: m.plannedPct,
    variance: m.variance,
    ppcPct: m.ppcPct,
    wbs: m.wbsRollup,
    openPeriod: m.openPeriod,
    periods: m.periods,
    blockedCount: m.blockedCount,
  }));
});

app.get("/api/pex/alerts", (req, res) => {
  const m = pexModel(req);
  res.json(pexOk(req, { items: m.alerts, counts: m.alerts.reduce((o, a) => ({ ...o, [a.severity]: (o[a.severity] ?? 0) + 1 }), {}) }));
});

app.get("/api/pex/roc", (req, res) => {
  const m = pexModel(req);
  res.json(pexOk(req, {
    items: Object.entries(m.roc).map(([code, r]) => ({ code, nameFa: r.nameFa, ref: r.ref, steps: r.steps, ...validateRoc(r.steps) })),
  }));
});

/** ثبت پیشرفت روزانه: قفل دوره + گیت بازرسی پیش از ورود به EV. */
/**
 * ثبت پیشرفت روزانه: قفل دوره + گیت بازرسی + **ماندگاری واقعی** (شکاف PEX-G2).
 * پیش از این نتیجه فقط محاسبه و برگردانده می‌شد و هیچ‌جا نوشته نمی‌شد.
 */
app.post("/api/pex/progress", async (req, res, next) => {
  try {
    const b = req.body ?? {};
    const m = buildPexModel();
    const activity = m.rows.find((r) => r.id === b.activityId);
    if (!activity) {
      return res.status(404).json({ ok: false, error: { code: "ACTIVITY_NOT_FOUND", message: `فعالیت ${b.activityId} یافت نشد`, traceId: req.requestId } });
    }
    const gate = canPostProgress(m.openPeriod, b.date ?? m.dataDate);
    if (!gate.ok) {
      return res.status(409).json({ ok: false, error: { code: gate.reason === "period_closed" ? "PERIOD_CLOSED" : "OUT_OF_PERIOD", message: "ثبت پیشرفت در این تاریخ مجاز نیست", traceId: req.requestId } });
    }
    const steps = m.roc[activity.roc]?.steps ?? [];
    const result = activityProgress(steps, Array.isArray(b.steps) ? b.steps : []);
    const entryDate = b.date ?? m.dataDate;
    const acceptedIntoEv = result.blockedSteps.length === 0;

    const r = await repo();
    const saved = await r.create(
      "ProgressEntry",
      {
        ProjectId: String(b.projectId ?? "prj-default"),
        ActivityId: activity.id,
        PeriodCode: m.openPeriod.code,
        EntryDate: entryDate,
        PhysicalPct: result.physicalPct,
        Steps: Array.isArray(b.steps) ? b.steps : [],
        BlockedSteps: result.blockedSteps,
        AcceptedIntoEv: acceptedIntoEv,
        Note: b.note ? String(b.note).slice(0, 500) : null,
        EnteredBy: String(b.enteredBy ?? req.headers["x-user-id"] ?? "anonymous"),
      },
      String(b.enteredBy ?? req.headers["x-user-id"] ?? "anonymous"),
      "progress"
    );

    res.status(201).json(pexOk(req, {
      id: saved.Id,
      persisted: true,
      driver: persistence?.driver?.kind ?? "unknown",
      activityId: activity.id,
      date: entryDate,
      period: m.openPeriod.code,
      physicalPct: result.physicalPct,
      blockedSteps: result.blockedSteps,
      acceptedIntoEv,
    }, { note: "فقط پیشرفت دارای IR تأییدشده وارد EV می‌شود" }));
  } catch (err) {
    next(err);
  }
});

/** تاریخچهٔ ثبت‌های پیشرفت — روی ماندگاری واقعی. */
app.get("/api/pex/progress/entries", async (req, res, next) => {
  try {
    const r = await repo();
    const where = [];
    if (req.query.activityId) where.push({ column: "ActivityId", op: "eq", value: String(req.query.activityId) });
    if (req.query.period) where.push({ column: "PeriodCode", op: "eq", value: String(req.query.period) });
    const items = await r.list("ProgressEntry", { where, orderBy: [{ column: "EntryDate", dir: "desc" }], limit: Math.min(500, Number(req.query.limit) || 100) });
    res.json(pexOk(req, { items, total: items.length, driver: persistence?.driver?.kind ?? "unknown" }));
  } catch (err) {
    next(err);
  }
});

/* ═══════════════════ لایه ماندگاری داده (sql-v1) ═══════════════════ */

app.get("/api/data/schema", (req, res) => {
  res.json({
    ok: true,
    data: {
      version: "sql-v1",
      driver: persistence?.driver?.kind ?? "pending",
      stats: schemaStats(),
      tables: SCHEMA.map((t) => ({
        name: t.name,
        module: t.module,
        title: t.title,
        pk: t.pk,
        columns: t.columns.length,
        indexes: (t.indexes ?? []).length,
        foreignKeys: (t.foreignKeys ?? []).length,
        exposed: PUBLIC_TABLES.has(t.name),
      })),
    },
    meta: { traceId: req.requestId, timestamp: new Date().toISOString() },
  });
});

app.get("/api/data/ddl", (req, res) => {
  const dialect = req.query.dialect === "sqlite" ? "sqlite" : "mssql";
  res.type("text/plain; charset=utf-8").send(generateDdl(dialect));
});

app.get("/api/data/migrations", async (req, res, next) => {
  try {
    let applied = [];
    try {
      const r = await repo();
      applied = (await r.list("SchemaMigration", { orderBy: [{ column: "Version", dir: "asc" }] })).map((m) => ({
        version: m.Version,
        name: m.Name,
        checksum: m.Checksum,
        appliedAt: m.AppliedAt,
      }));
    } catch {
      applied = [];
    }
    res.json({
      ok: true,
      data: { applied, plan: migrationPlan(applied), catalogue: MIGRATIONS.map((m) => ({ version: m.version, name: m.name, statements: m.statements.length, checksum: checksumOf(m.statements) })) },
      meta: { traceId: req.requestId, timestamp: new Date().toISOString() },
    });
  } catch (err) {
    next(err);
  }
});

/** اجرای مهاجرت‌های معلق. روی درایور فایلی فقط ثبت می‌شود چون جدولی ساخته نمی‌شود. */
app.post("/api/data/migrate", async (req, res, next) => {
  try {
    const r = await repo();
    const applied = (await r.list("SchemaMigration", {})).map((m) => ({ version: m.Version, name: m.Name, checksum: m.Checksum, appliedAt: m.AppliedAt }));
    const plan = migrationPlan(applied);
    if (plan.drift.length) {
      return res.status(409).json({ ok: false, error: { code: "MIGRATION_DRIFT", message: "چک‌سام مهاجرت اجراشده تغییر کرده است", details: plan.drift, traceId: req.requestId } });
    }
    const executed = [];
    for (const version of plan.pending.map((p) => p.version)) {
      const migration = MIGRATIONS.find((m) => m.version === version);
      const startedMs = Date.now();
      if (persistence?.driver?.kind === "mssql") {
        for (const stmt of migration.statements) await persistence.driver.pool.request().query(stmt);
      }
      await r.create("SchemaMigration", {
        Version: migration.version,
        Name: migration.name,
        Checksum: checksumOf(migration.statements),
        AppliedAt: new Date().toISOString(),
        DurationMs: Date.now() - startedMs,
      }, "system");
      executed.push(migration.version);
    }
    res.json({ ok: true, data: { executed, driver: persistence?.driver?.kind }, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    next(err);
  }
});

/* ═══════════════ ویرایشِ ساختارِ d6/d20 ═══════════════
 * یک ردیف برای هر پروژه/حوزه؛ در SQL و JSON هر دو از همان repository
 * استفاده می‌شود. نبودِ ردیف یعنی استفاده از framework.ts در کلاینت.
 */
app.get("/api/framework/process-tree", async (req, res, next) => {
  try {
    const projectId = taxonomyText(req.query.projectId, 60);
    const domainId = taxonomyText(req.query.domainId, 20);
    if (!projectId || !EDITABLE_TAXONOMY_DOMAINS.has(domainId)) {
      return res.status(400).json({ ok: false, error: { code: "INVALID_TAXONOMY_SCOPE", message: "پروژه یا حوزهٔ قابل ویرایش نامعتبر است", traceId: req.requestId } });
    }
    const r = await repo();
    const row = await r.findOne("ProcessTree", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "DomainId", op: "eq", value: domainId },
    ]);
    let processes = null;
    if (row?.Payload) {
      try {
        const payload = typeof row.Payload === "string" ? JSON.parse(row.Payload) : row.Payload;
        if (Array.isArray(payload?.processes)) processes = normalizeTaxonomyProcesses(payload.processes);
      } catch {
        processes = null;
      }
    }
    const result = taxonomyResponse(req, { projectId, domainId, processes, source: processes ? "database" : "framework" });
    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
});

app.post("/api/framework/process-tree", async (req, res, next) => {
  try {
    const projectId = taxonomyText(req.body?.projectId, 60);
    const domainId = taxonomyText(req.body?.domainId, 20);
    if (!projectId || !EDITABLE_TAXONOMY_DOMAINS.has(domainId)) {
      return res.status(400).json({ ok: false, error: { code: "INVALID_TAXONOMY_SCOPE", message: "پروژه یا حوزهٔ قابل ویرایش نامعتبر است", traceId: req.requestId } });
    }
    const processes = normalizeTaxonomyProcesses(req.body?.processes);
    const payload = JSON.stringify({ version: 1, processes });
    const r = await repo();
    const actor = String(req.headers["x-user-id"] ?? "anonymous");
    await r.upsert("ProcessTree", { ProjectId: projectId, DomainId: domainId }, { Payload: payload, IsActive: true }, actor);
    const result = taxonomyResponse(req, { projectId, domainId, processes, source: "database" }, 200);
    return res.status(result.status).json(result.body);
  } catch (err) {
    return next(err);
  }
});

app.delete("/api/framework/process-tree", async (req, res, next) => {
  try {
    const projectId = taxonomyText(req.query.projectId, 60);
    const domainId = taxonomyText(req.query.domainId, 20);
    if (!projectId || !EDITABLE_TAXONOMY_DOMAINS.has(domainId)) {
      return res.status(400).json({ ok: false, error: { code: "INVALID_TAXONOMY_SCOPE", message: "پروژه یا حوزهٔ قابل ویرایش نامعتبر است", traceId: req.requestId } });
    }
    const r = await repo();
    const row = await r.findOne("ProcessTree", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "DomainId", op: "eq", value: domainId },
    ]);
    if (row) await r.remove("ProcessTree", row.Id);
    return res.json({ ok: true, data: { projectId, domainId, reset: true }, meta: { traceId: req.requestId, timestamp: new Date().toISOString(), driver: persistence?.driver?.kind ?? "pending" } });
  } catch (err) {
    return next(err);
  }
});

/** CRUD عمومی روی جدول‌های مجاز — همه از راه سازندهٔ پارامتری. */
app.get("/api/data/:table", async (req, res, next) => {
  try {
    const t = tableDef(req.params.table);
    if (!t || !PUBLIC_TABLES.has(t.name)) return res.status(404).json({ ok: false, error: { code: "UNKNOWN_TABLE", message: `جدول ${req.params.table} در دسترس نیست`, traceId: req.requestId } });
    const r = await repo();
    const spec = parseSelectSpec(t, req.query);
    const [items, total] = await Promise.all([r.list(t.name, spec), r.count(t.name, spec.where)]);
    res.json({ ok: true, data: { items, total, limit: spec.limit, offset: spec.offset }, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    next(err);
  }
});

app.get("/api/data/:table/:id", async (req, res, next) => {
  try {
    const t = tableDef(req.params.table);
    if (!t || !PUBLIC_TABLES.has(t.name)) return res.status(404).json({ ok: false, error: { code: "UNKNOWN_TABLE", message: `جدول ${req.params.table} در دسترس نیست`, traceId: req.requestId } });
    const r = await repo();
    const row = await r.get(t.name, req.params.id);
    if (!row) return res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "رکورد یافت نشد", traceId: req.requestId } });
    res.json({ ok: true, data: row, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    next(err);
  }
});

app.post("/api/data/:table", async (req, res, next) => {
  try {
    const t = tableDef(req.params.table);
    if (!t || !PUBLIC_TABLES.has(t.name)) return res.status(404).json({ ok: false, error: { code: "UNKNOWN_TABLE", message: `جدول ${req.params.table} در دسترس نیست`, traceId: req.requestId } });
    const r = await repo();
    const userId = String(req.headers["x-user-id"] ?? "anonymous");
    const row = await r.create(t.name, r.pickWritable(t.name, req.body), userId, t.name.toLowerCase());
    res.status(201).json({ ok: true, data: row, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    next(err);
  }
});

app.patch("/api/data/:table/:id", async (req, res, next) => {
  try {
    const t = tableDef(req.params.table);
    if (!t || !PUBLIC_TABLES.has(t.name)) return res.status(404).json({ ok: false, error: { code: "UNKNOWN_TABLE", message: `جدول ${req.params.table} در دسترس نیست`, traceId: req.requestId } });
    const r = await repo();
    const userId = String(req.headers["x-user-id"] ?? "anonymous");
    const expected = req.headers["if-match"] ? Number(req.headers["if-match"]) : undefined;
    const result = await r.patch(t.name, req.params.id, r.pickWritable(t.name, req.body), userId, expected);
    if (!result.ok) {
      return res.status(result.code === "NOT_FOUND" ? 404 : 409).json({ ok: false, error: { code: result.code, message: result.message, traceId: req.requestId } });
    }
    res.json({ ok: true, data: await r.get(t.name, req.params.id), meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    next(err);
  }
});

app.delete("/api/data/:table/:id", async (req, res, next) => {
  try {
    const t = tableDef(req.params.table);
    if (!t || !PUBLIC_TABLES.has(t.name)) return res.status(404).json({ ok: false, error: { code: "UNKNOWN_TABLE", message: `جدول ${req.params.table} در دسترس نیست`, traceId: req.requestId } });
    const r = await repo();
    const result = await r.remove(t.name, req.params.id);
    if (!result.affected) return res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "رکورد یافت نشد", traceId: req.requestId } });
    res.json({ ok: true, data: { deleted: result.affected }, meta: { traceId: req.requestId, timestamp: new Date().toISOString() } });
  } catch (err) {
    next(err);
  }
});

/* ═══════════════ ماشین‌آلات و تجهیزات (eqm-v1) ═══════════════
 * ذخیره‌سازی از راه CRUD عمومی `/api/data/*` (چهار جدول d9) انجام می‌شود؛
 * این مسیرها فقط KPI و هشدار را روی موتور خالص server/eqmLogic.js محاسبه می‌کنند. */

const eqmOk = (req, data, meta = {}) =>
  ({ ok: true, data, meta: { traceId: req.requestId, engine: EQM_VERSION, timestamp: new Date().toISOString(), ...meta } });

const EQM_WINDOW_DAYS = 30;
const eqmNowIso = () => new Date().toISOString().slice(0, 10);
const eqmWindowFrom = () => {
  const d = new Date();
  d.setDate(d.getDate() - EQM_WINDOW_DAYS);
  return d.toISOString().slice(0, 10);
};

async function eqmProjectRows(projectId) {
  const r = await repo();
  const [equipment, meters, rentals, orders] = await Promise.all([
    r.list("Equipment", { where: [{ column: "ProjectId", op: "eq", value: projectId }], limit: 1000 }),
    r.list("EquipmentMeter", { where: [{ column: "ProjectId", op: "eq", value: projectId }], limit: 1000 }),
    r.list("EquipmentRental", { where: [{ column: "ProjectId", op: "eq", value: projectId }], limit: 1000 }),
    r.list("MaintenanceOrder", { where: [{ column: "ProjectId", op: "eq", value: projectId }], limit: 1000 }),
  ]);
  return { equipment, meters, rentals, orders };
}

app.get("/api/eqm/status", (req, res) => {
  res.json(eqmOk(req, {
    version: EQM_VERSION,
    domain: EQM_DOMAIN_ID,
    categoryCount: Object.keys(CATEGORY_BY_CODE).length,
    tables: ["Equipment", "EquipmentMeter", "EquipmentRental", "MaintenanceOrder"],
  }));
});

/** خلاصهٔ ناوگان: شمارش، میانگین بهره‌برداری/دسترس‌پذیری، معوقات و اجارهٔ تعهدشده. */
app.get("/api/eqm/summary", async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return res.status(400).json({ ok: false, error: { code: "NO_PROJECT", message: "پارامتر projectId الزامی است", traceId: req.requestId } });
    const { equipment, meters, rentals, orders } = await eqmProjectRows(projectId);
    const nowIso = eqmNowIso();
    const fromIso = eqmWindowFrom();
    const metrics = equipment.map((e) => {
      const em = meters.filter((m) => m.EquipmentId === e.Id);
      const eo = orders.filter((o) => o.EquipmentId === e.Id);
      return { workHours: workHoursSum(em), downtimeHrs: downtimeHours(eo, fromIso, nowIso), periodDays: EQM_WINDOW_DAYS };
    });
    const openMaintenance = orders.filter((o) => o.Status === "open" || o.Status === "in_progress").length;
    const accruedRent = rentals.reduce((s, rl) => s + rentalCostAccrued(rl, nowIso).accrued, 0);
    let warnings = 0;
    for (const e of equipment) {
      const cat = CATEGORY_BY_CODE[e.Category] ?? CATEGORY_BY_CODE["OTH"];
      const eo = orders.filter((o) => o.EquipmentId === e.Id);
      const lastPm = [...eo].filter((o) => (o.Kind === "preventive" || o.Kind === "inspection") && (o.Status === "done" || o.Status === "closed")).sort((a, b) => String(b.ReportedAt).localeCompare(String(a.ReportedAt)))[0];
      const age = equipmentAge(e.CommissionedAt, nowIso);
      const rental = rentals.find((rl) => rl.EquipmentId === e.Id && rl.Status === "active");
      const em = meters.filter((m) => m.EquipmentId === e.Id);
      warnings += eqmEws(e, {
        nowIso, periodDays: EQM_WINDOW_DAYS, workHours: workHoursSum(em),
        downtimeHrs: downtimeHours(eo, fromIso, nowIso), orders: eo, rental,
        lastPmIso: lastPm?.ReportedAt, pmIntervalDays: 90,
        ageYears: age.years, economicLifeYears: cat.economicLifeYears, utilLowPct: cat.utilLowPct,
      }).length;
    }
    res.json(eqmOk(req, fleetSummary(equipment, metrics, openMaintenance, accruedRent, warnings)));
  } catch (err) {
    next(err);
  }
});

/** KPI یک ماشین مشخص: سن، استهلاک، بهره‌برداری، دسترس‌پذیری، هزینه/ساعت و هشدارها. */
app.get("/api/eqm/equipment/:id/kpi", async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    const r = await repo();
    const [equipment] = await r.list("Equipment", { where: [{ column: "Id", op: "eq", value: req.params.id }], limit: 1 });
    if (!equipment) return res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "ماشین یافت نشد", traceId: req.requestId } });
    const [meters, rentals, orders] = await Promise.all([
      r.list("EquipmentMeter", { where: [{ column: "EquipmentId", op: "eq", value: req.params.id }], limit: 1000 }),
      r.list("EquipmentRental", { where: [{ column: "EquipmentId", op: "eq", value: req.params.id }], limit: 1000 }),
      r.list("MaintenanceOrder", { where: [{ column: "EquipmentId", op: "eq", value: req.params.id }], limit: 1000 }),
    ]);
    const nowIso = eqmNowIso();
    const fromIso = eqmWindowFrom();
    const cat = CATEGORY_BY_CODE[equipment.Category] ?? CATEGORY_BY_CODE["OTH"];
    const workHours = workHoursSum(meters);
    const down = downtimeHours(orders, fromIso, nowIso);
    const age = equipmentAge(equipment.CommissionedAt, nowIso);
    const rental = rentals.find((rl) => rl.Status === "active");
    const dep = equipment.PurchaseValue !== undefined && equipment.PurchaseValue !== null
      ? straightLineDepreciation(Number(equipment.PurchaseValue), Number(equipment.SalvageValue ?? 0), cat.economicLifeYears, age.years)
      : null;
    const lastPm = [...orders].filter((o) => (o.Kind === "preventive" || o.Kind === "inspection") && (o.Status === "done" || o.Status === "closed")).sort((a, b) => String(b.ReportedAt).localeCompare(String(a.ReportedAt)))[0];
    const warnings = eqmEws(equipment, {
      nowIso, periodDays: EQM_WINDOW_DAYS, workHours, downtimeHrs: down, orders,
      rental, lastPmIso: lastPm?.ReportedAt, pmIntervalDays: 90,
      ageYears: age.years, economicLifeYears: cat.economicLifeYears, utilLowPct: cat.utilLowPct,
    });
    const costPerHour = equipmentCostPerHour(workHours, {
      rentalCost: rental ? rentalCostAccrued(rental, nowIso).accrued : 0,
      maintenanceCost: orders.reduce((s, o) => s + (Number(o.Cost) || 0), 0),
    });
    res.json(eqmOk(req, {
      equipment,
      age,
      utilization: utilization(workHours, EQM_WINDOW_DAYS, 8, { lowPct: cat.utilLowPct, highPct: cat.utilHighPct }),
      availability: availability(down, EQM_WINDOW_DAYS * 24),
      depreciation: dep,
      costPerHour,
      maintenance: { backlog: maintenanceBacklog(orders).total, mttr: mttr(orders), nextPm: nextPmDue(lastPm?.ReportedAt, 90, nowIso) },
      rental: rental ? rentalCostAccrued(rental, nowIso) : null,
      warnings,
    }));
  } catch (err) {
    next(err);
  }
});


/* ═══════════════ توسعهٔ EQP: دیسپچ، سوخت، PM، قطعات، شاخص‌ها (eqp-v1) ═══════════════
 * پراممپت «MACHINERY & EQUIPMENT MANAGEMENT v1.0» — تحویلی‌های ۵، ۶، ۷، ۸، ۹، ۱۰.
 * ذخیره‌سازی از راه CRUD عمومی `/api/data/*` (پنج جدول جدید d9). */

const eqpOk = (req, data, meta = {}) =>
  ({ ok: true, data, meta: { traceId: req.requestId, engine: EQP_VERSION, timestamp: new Date().toISOString(), ...meta } });

const eqpBad = (req, res, code, message, status = 400) =>
  res.status(status).json({ ok: false, error: { code, message, traceId: req.requestId } });

async function eqpProjectRows(projectId) {
  const r = await repo();
  const w = [{ column: "ProjectId", op: "eq", value: projectId }];
  const [dispatches, fuel, pm, parts] = await Promise.all([
    r.list("EquipmentDispatch", { where: w, limit: 1000 }),
    r.list("EquipmentFuelLog", { where: w, limit: 1000 }),
    r.list("PmSchedule", { where: w, limit: 1000 }),
    r.list("SparePart", { where: w, limit: 1000 }),
  ]);
  return { dispatches, fuel, pm, parts };
}

/** کاتالوگ‌های مرجع ماژول: تاکسونومی ISO 14224، هشت شاخص، شش قاعدهٔ هشدار. */
app.get("/api/eqp/catalog", (req, res) => {
  res.json(eqpOk(req, {
    version: EQP_VERSION,
    domain: EQM_DOMAIN_ID,
    iso14224: ISO14224_TAXONOMY,
    kpis: EQP_KPI_CATALOG,
    ewsRules: EWS_EQP_RULES,
    tables: ["EquipmentDispatch", "EquipmentFuelLog", "PmSchedule", "SparePart", "PartTransaction"],
  }));
});

/** شناسنامهٔ اسکن‌پذیر ماشین (payload بارکد/QR + کد تاکسونومی). */
app.get("/api/eqp/equipment/:id/idcard", async (req, res, next) => {
  try {
    const r = await repo();
    const [equipment] = await r.list("Equipment", { where: [{ column: "Id", op: "eq", value: req.params.id }], limit: 1 });
    if (!equipment) return eqpBad(req, res, "NOT_FOUND", "ماشین یافت نشد", 404);
    const cat = CATEGORY_BY_CODE[equipment.Category] ?? CATEGORY_BY_CODE["OTH"];
    const nowIso = eqmNowIso();
    const age = equipmentAge(equipment.CommissionedAt, nowIso);
    res.json(eqpOk(req, {
      equipment,
      category: cat,
      iso14224: iso14224Code(equipment.Category),
      qr: equipmentQrPayload(equipment),
      age,
      depreciation: equipment.PurchaseValue != null
        ? straightLineDepreciation(Number(equipment.PurchaseValue), Number(equipment.SalvageValue ?? 0), cat.economicLifeYears, age.years)
        : null,
    }));
  } catch (err) { next(err); }
});

/**
 * G-03 — گواهی‌نامهٔ اپراتور از HRM خوانده می‌شود، نه از بدنهٔ درخواست.
 *
 * پیش‌تر `operatorLicenseExpiry` پارامتر ورودی بود؛ یعنی هر فراخوان می‌توانست
 * تاریخ دلخواه بفرستد و دروازه را دور بزند — امنیت کاذب. اکنون مرجع، رکورد
 * `WorkforceMember` است (ستون‌های `LicenseType`/`LicenseExpiry` در مهاجرت 0007).
 *
 * بازگشتی: `{ assigned, licenseExpiry, licenseType, found }`.
 * اگر اپراتور در HRM نباشد، `licenseExpiry` تعریف‌نشده می‌ماند و دروازهٔ
 * گواهی‌نامه ساکت می‌شود — ولی `G-EQP-OPERATOR` همچنان تخصیص را می‌سنجد.
 */
async function eqpOperatorLicense(operatorId) {
  const id = String(operatorId || "");
  if (!id) return { assigned: false, found: false };
  const r = await repo();
  const [byId] = await r.list("WorkforceMember", { where: [{ column: "Id", op: "eq", value: id }], limit: 1 });
  let member = byId;
  if (!member) {
    const [byNo] = await r.list("WorkforceMember", { where: [{ column: "PersonnelNo", op: "eq", value: id }], limit: 1 });
    member = byNo;
  }
  if (!member) return { assigned: true, found: false };
  return {
    assigned: true,
    found: true,
    licenseType: member.LicenseType || undefined,
    licenseExpiry: member.LicenseExpiry || undefined,
    memberName: member.FullName,
  };
}

/** دروازه‌های پیش‌نیاز دیسپچ روزانه — تحویلی ۵. */
app.post("/api/eqp/dispatch/precheck", async (req, res, next) => {
  try {
    const body = req.body ?? {};
    const equipmentId = String(body.equipmentId || "");
    if (!equipmentId) return eqpBad(req, res, "NO_EQUIPMENT", "شناسه ماشین الزامی است");
    const r = await repo();
    const [equipment] = await r.list("Equipment", { where: [{ column: "Id", op: "eq", value: equipmentId }], limit: 1 });
    if (!equipment) return eqpBad(req, res, "NOT_FOUND", "ماشین یافت نشد", 404);
    const [orders, rentals, schedules, meters] = await Promise.all([
      r.list("MaintenanceOrder", { where: [{ column: "EquipmentId", op: "eq", value: equipmentId }], limit: 1000 }),
      r.list("EquipmentRental", { where: [{ column: "EquipmentId", op: "eq", value: equipmentId }], limit: 100 }),
      r.list("PmSchedule", { where: [{ column: "EquipmentId", op: "eq", value: equipmentId }], limit: 100 }),
      r.list("EquipmentMeter", { where: [{ column: "EquipmentId", op: "eq", value: equipmentId }], limit: 1000 }),
    ]);
    const nowIso = eqmNowIso();
    const lastMeter = [...meters].sort((a, b) => String(b.ReadAt).localeCompare(String(a.ReadAt)))[0];
    let pmOverdueDays = 0;
    for (const sc of schedules.filter((x) => x.Active !== false && x.Active !== 0)) {
      const due = pmDueByBasis(sc, nowIso, Number(lastMeter?.HourMeter ?? 0));
      if (due.overdue) {
        pmOverdueDays = Math.max(pmOverdueDays, sc.Basis === "calendar_days" ? Math.abs(due.remaining) : Math.ceil(Math.abs(due.remaining) / 8));
      }
    }
    const operator = await eqpOperatorLicense(body.operatorId);
    const check = dispatchPrecheck({
      nowIso,
      equipment,
      openCriticalOrders: orders.filter((o) => o.Priority === "critical" && (o.Status === "open" || o.Status === "in_progress")).length,
      pmOverdueDays,
      operatorLicenseExpiry: operator.licenseExpiry,
      operatorAssigned: operator.assigned,
      safetyCheckDone: body.safetyCheck === true,
      rentalActive: rentals.some((x) => x.Status === "active"),
    });
    res.json(eqpOk(req, { ...check, operator }));
  } catch (err) { next(err); }
});

/** برگهٔ دیسپچ یک روز مشخص با نتیجهٔ دروازه‌ها. */
app.get("/api/eqp/dispatch/board", async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return eqpBad(req, res, "NO_PROJECT", "پارامتر projectId الزامی است");
    const date = String(req.query.date || eqmNowIso());
    const r = await repo();
    const rows = await r.list("EquipmentDispatch", {
      where: [{ column: "ProjectId", op: "eq", value: projectId }, { column: "DispatchDate", op: "eq", value: date }],
      limit: 1000,
    });
    const byStatus = {};
    let plannedHours = 0;
    for (const d of rows) {
      byStatus[d.Status] = (byStatus[d.Status] ?? 0) + 1;
      plannedHours += Number(d.PlannedHours) || 0;
    }
    res.json(eqpOk(req, { date, total: rows.length, byStatus, plannedHours: Math.round(plannedHours * 100) / 100, rows }));
  } catch (err) { next(err); }
});

/** پیشبرد وضعیت دیسپچ با گارد گذار مجاز. */
app.post("/api/eqp/dispatch/:id/advance", async (req, res, next) => {
  try {
    const to = String((req.body ?? {}).to || "");
    const r = await repo();
    const [row] = await r.list("EquipmentDispatch", { where: [{ column: "Id", op: "eq", value: req.params.id }], limit: 1 });
    if (!row) return eqpBad(req, res, "NOT_FOUND", "دیسپچ یافت نشد", 404);
    if (!canAdvanceDispatch(row.Status, to)) {
      return eqpBad(req, res, "E-EQP-FLOW", `گذار از «${row.Status}» به «${to}» مجاز نیست`, 409);
    }
    const userId = String(req.headers["x-user-id"] ?? "anonymous");
    const patch = to === "approved" ? { Status: to, ApprovedBy: userId } : { Status: to };
    const result = await r.patch("EquipmentDispatch", req.params.id, patch, userId);
    if (!result.ok) return eqpBad(req, res, result.code, result.message, result.code === "NOT_FOUND" ? 404 : 409);
    res.json(eqpOk(req, await r.get("EquipmentDispatch", req.params.id)));
  } catch (err) { next(err); }
});

/** سررسید برنامه‌های نگهداری پیشگیرانه بر چهار پایه — تحویلی ۷. */
app.get("/api/eqp/pm/due", async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return eqpBad(req, res, "NO_PROJECT", "پارامتر projectId الزامی است");
    const r = await repo();
    const [schedules, meters, equipment] = await Promise.all([
      r.list("PmSchedule", { where: [{ column: "ProjectId", op: "eq", value: projectId }], limit: 1000 }),
      r.list("EquipmentMeter", { where: [{ column: "ProjectId", op: "eq", value: projectId }], limit: 1000 }),
      r.list("Equipment", { where: [{ column: "ProjectId", op: "eq", value: projectId }], limit: 1000 }),
    ]);
    const nowIso = eqmNowIso();
    const nameOf = new Map(equipment.map((e) => [e.Id, e.NameFa]));
    const rows = schedules.map((sc) => {
      const em = meters.filter((m) => m.EquipmentId === sc.EquipmentId);
      const last = [...em].sort((a, b) => String(b.ReadAt).localeCompare(String(a.ReadAt)))[0];
      const avgPerDay = em.length ? workHoursSum(em) / Math.max(1, EQM_WINDOW_DAYS) : 0;
      const due = pmDueByBasis(sc, nowIso, Number(last?.HourMeter ?? 0), avgPerDay);
      return { schedule: sc, equipmentName: nameOf.get(sc.EquipmentId) ?? sc.EquipmentId, due };
    });
    const order = { overdue: 0, due: 1, soon: 2, ok: 3 };
    rows.sort((a, b) => order[a.due.severity] - order[b.due.severity]);
    res.json(eqpOk(req, {
      total: rows.length,
      overdue: rows.filter((x) => x.due.severity === "overdue").length,
      soon: rows.filter((x) => x.due.severity === "soon" || x.due.severity === "due").length,
      rows,
    }));
  } catch (err) { next(err); }
});

/** قطعات نیازمند سفارش مجدد (ورودی PR در FIN) — تحویلی ۹. */
app.get("/api/eqp/parts/reorder", async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return eqpBad(req, res, "NO_PROJECT", "پارامتر projectId الزامی است");
    const coverDays = Number(req.query.coverDays) > 0 ? Number(req.query.coverDays) : 30;
    const r = await repo();
    const parts = await r.list("SparePart", { where: [{ column: "ProjectId", op: "eq", value: projectId }], limit: 1000 });
    const rows = partsToRequisition(parts, coverDays);
    const estimatedValue = rows.reduce((s, x) => s + x.stock.suggestedQty * (Number(x.part.UnitCost) || 0), 0);
    res.json(eqpOk(req, {
      total: parts.length,
      toRequisition: rows.length,
      criticalShortage: rows.filter((x) => x.stock.critical && x.stock.status !== "reorder").length,
      estimatedValue: Math.round(estimatedValue * 100) / 100,
      rows,
    }));
  } catch (err) { next(err); }
});

/** تابلوی هشت شاخص ناوگان + OEE + پارتو علل خرابی — تحویلی ۱۰. */
app.get("/api/eqp/kpi", async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return eqpBad(req, res, "NO_PROJECT", "پارامتر projectId الزامی است");
    const { equipment, meters, orders } = await eqmProjectRows(projectId);
    const { dispatches, fuel, pm } = await eqpProjectRows(projectId);
    const nowIso = eqmNowIso();
    const fromIso = eqmWindowFrom();
    const metrics = equipment.map((e) => ({
      workHours: workHoursSum(meters.filter((m) => m.EquipmentId === e.Id)),
      downtimeHrs: downtimeHours(orders.filter((o) => o.EquipmentId === e.Id), fromIso, nowIso),
      periodDays: EQM_WINDOW_DAYS,
    }));
    const fuelStats = fuelSummary(fuel);
    const assetValue = equipment.reduce((s, e) => s + (Number(e.PurchaseValue) || 0), 0);
    const maintenanceCost = orders.reduce((s, o) => s + (Number(o.Cost) || 0), 0);
    const totalWork = metrics.reduce((s, m) => s + m.workHours, 0);
    const totalDown = metrics.reduce((s, m) => s + m.downtimeHrs, 0);
    /* تولید واقعی از برگه‌های دیسپچ اجراشده می‌آید؛ نبودش یعنی OEE سنجش‌ناپذیر است
     * و مؤلفهٔ «عملکرد» را نباید ۱۰۰٪ فرض کرد. */
    const executed = dispatches.filter((x) => x.Status === "executed" && Number(x.PlannedQty) > 0);
    const actualOutput = executed.reduce((s, x) => s + (Number(x.PlannedQty) || 0), 0);
    const executedHours = executed.reduce((s, x) => s + (Number(x.PlannedHours) || 0), 0);
    const ratedOutputPerHour = executedHours > 0 ? actualOutput / executedHours : 0;
    const oeeMeasured = executed.length > 0 && ratedOutputPerHour > 0;
    const activePm = pm.filter((x) => x.Active !== false && x.Active !== 0);
    const board = fleetKpiBoard({
      equipment,
      metrics,
      orders,
      plannedPmCount: activePm.length,
      maintenanceCost,
      assetValue,
      fuelLitres: fuelStats.quantity,
      actualOutput: oeeMeasured ? actualOutput : undefined,
      ratedOutputPerHour: oeeMeasured ? ratedOutputPerHour : undefined,
      periodDays: EQM_WINDOW_DAYS,
    });
    /* بیشترین روز تأخیر در میان برنامه‌های PM فعال — ورودی قاعدهٔ EWS-EQP-03. */
    let pmOverdueDays = 0;
    for (const sc of activePm) {
      const em = meters.filter((m) => m.EquipmentId === sc.EquipmentId);
      const last = [...em].sort((a, b) => String(b.ReadAt).localeCompare(String(a.ReadAt)))[0];
      const due = pmDueByBasis(sc, nowIso, Number(last?.HourMeter ?? 0));
      if (due.overdue) {
        pmOverdueDays = Math.max(pmOverdueDays, sc.Basis === "calendar_days" ? Math.abs(due.remaining) : Math.ceil(Math.abs(due.remaining) / 8));
      }
    }
    const alerts = ewsEqp({
      availabilityPct: board.availability,
      utilizationPct: board.utilization,
      utilLowPct: 40,
      pmOverdueDays,
      criticalBacklog: maintenanceBacklog(orders).byPriority.critical,
      sfc: board.sfc,
      sfcBenchmark: 18,
    });
    res.json(eqpOk(req, {
      window: { fromIso, toIso: nowIso, days: EQM_WINDOW_DAYS },
      board,
      catalog: EQP_KPI_CATALOG,
      fuel: fuelStats,
      sfc: specificFuelConsumption(fuelStats.quantity, totalWork, 18),
      maintenanceCostRatio: maintenanceCostRatio(maintenanceCost, assetValue),
      pmCompliance: pmCompliance(orders, activePm.length),
      oee: oeeMeasured
        ? { measured: true, ...oee({ downtimeHours: totalDown, periodHours: Math.max(1, EQM_WINDOW_DAYS * 24 * Math.max(1, equipment.length)), workHours: totalWork, actualOutput, ratedOutputPerHour }) }
        : { measured: false, reason: "تولید واقعی ثبت نشده — برگه دیسپچ اجراشده با حجم لازم است" },
      rcaPareto: rcaPareto(orders),
      health: equipmentHealthScore({
        availabilityPct: board.availability,
        utilizationPct: board.utilization,
        pmCompliancePct: board.pmCompliance,
        criticalBacklog: maintenanceBacklog(orders).byPriority.critical,
        agingRatio: 0.3,
      }),
      pmOverdueDays,
      alerts,
    }));
  } catch (err) { next(err); }
});

/** TCO و تحلیل خرید در برابر اجاره — تحویلی ۴. */
app.post("/api/eqp/tco", (req, res) => {
  const b = req.body ?? {};
  const input = {
    purchaseValue: Number(b.purchaseValue) || 0,
    salvageValue: Number(b.salvageValue) || 0,
    lifeYears: Number(b.lifeYears) || 10,
    annualOperatingCost: Number(b.annualOperatingCost) || 0,
    annualMaintenanceCost: Number(b.annualMaintenanceCost) || 0,
    annualInsuranceCost: Number(b.annualInsuranceCost) || 0,
    mobilizationCost: Number(b.mobilizationCost) || 0,
    demobilizationCost: Number(b.demobilizationCost) || 0,
    annualWorkHours: Number(b.annualWorkHours) || 1,
  };
  const rentalRate = Number(b.rentalHourlyRate) || 0;
  res.json(eqpOk(req, {
    tco: tco(input),
    comparison: rentalRate > 0 ? buyVsRent(input, rentalRate, Number(b.variableOwnCostPerHour) || 0) : null,
  }));
});

/** اعتبارسنجی دسته‌ای ردیف‌های ورودی پیش از ذخیره (پنج جدول جدید). */
app.post("/api/eqp/validate", (req, res) => {
  const b = req.body ?? {};
  const kind = String(b.kind || "");
  const rows = Array.isArray(b.rows) ? b.rows : [];
  const fn = { dispatch: validateDispatch, fuel: validateFuelLog, pm: validatePmSchedule, part: validateSparePart }[kind];
  if (!fn) return eqpBad(req, res, "E-EQP-KIND", "نوع اعتبارسنجی نامعتبر است (dispatch|fuel|pm|part)");
  const results = rows.map((row, index) => ({ index, ...fn(row) }));
  res.json(eqpOk(req, { kind, total: results.length, invalid: results.filter((x) => !x.ok).length, results }));
});


/* ═══════════════ گزارش‌های رسمی ماشین‌آلات (eqp-rpt-v1) ═══════════════
 * تحویلی ۱۱ و ۱۲ پراممپت EQP. موتور A4 سه‌لوگو (rpt-v1) بازنویسی نشد؛
 * فقط سازندهٔ داده در eqmLogic و سریال‌سازی در rptLogic به هم وصل شدند. */

const EQP_DEFAULT_LETTERHEAD = {
  projectName: "پروژه نمونه — واحد فرآورش گاز",
  projectCode: "OG-2401",
  contractNo: "C-1404-118",
  contractor: { name: "شرکت پیمانکار نمونه", logoText: "پیمانکار", role: { fa: "پیمانکار", en: "Contractor" } },
  client: { name: "شرکت کارفرمای نمونه", logoText: "کارفرما", role: { fa: "کارفرما", en: "Client" } },
  consultant: { name: "مهندسین مشاور نمونه", logoText: "مشاور", role: { fa: "مشاور", en: "Consultant" } },
  docNo: "",
  revision: "R00",
  issueDate: new Date().toISOString().slice(0, 10),
  periodLabel: "",
  classification: "confidential",
  distribution: ["مدیر پروژه", "مدیر ماشین‌آلات", "امور قراردادها"],
  preparedBy: "واحد ماشین‌آلات",
  approvedBy: "مدیر پروژه",
};

/** سربرگ از بدنهٔ درخواست با پیش‌فرض امن ادغام می‌شود. */
function eqpLetterhead(source = {}, reportCode = "RPT-EQP", seq = 1) {
  /* در querystring سربرگ رشتهٔ JSON است؛ spread کردن رشته کاراکترها را به
   * کلیدهای عددی تبدیل می‌کند و بازنویسی بی‌اثر می‌شود. پس ابتدا پارس می‌کنیم
   * و ورودی نامعتبر را بی‌صدا نادیده می‌گیریم تا گزارش با پیش‌فرض صادر شود. */
  let override = source.letterhead ?? {};
  if (typeof override === "string") {
    try {
      override = JSON.parse(override);
    } catch {
      override = {};
    }
  }
  if (typeof override !== "object" || override === null || Array.isArray(override)) override = {};

  const lh = { ...EQP_DEFAULT_LETTERHEAD, ...override };
  if (!lh.docNo) lh.docNo = documentNumber(lh.projectCode, reportCode, seq, Number(String(lh.revision).replace(/\D/g, "")) || 0);
  return lh;
}

/** دادهٔ خام یک پروژه برای همهٔ گزارش‌های ناوگان. */
async function eqpReportData(projectId) {
  const [{ equipment, meters, rentals, orders }, { dispatches, fuel, pm, parts }] = await Promise.all([
    eqmProjectRows(projectId),
    eqpProjectRows(projectId),
  ]);
  return { equipment, meters, rentals, orders, dispatches, fuel, pm, parts };
}

app.get("/api/eqp/reports", (req, res) => {
  res.json(eqpOk(req, {
    version: EQP_REPORT_VERSION,
    reports: EQP_REPORT_CATALOG,
    formats: ["json", "html", "pdf", "doc", "xls", "csv"],
    templates: TEMPLATE_CATALOG.filter((t) => t.module === EQM_DOMAIN_ID).map((t) => ({ code: t.code, title: t.title, targetTable: t.targetTable, fields: t.fields.length })),
  }));
});

/**
 * ساخت و تحویل یک گزارش ناوگان.
 * `format=json` ساختار خام، بقیه خروجی سریال‌شدهٔ موتور rpt-v1 است.
 */
app.get("/api/eqp/reports/:code", async (req, res, next) => {
  try {
    const code = String(req.params.code || "").toUpperCase();
    const def = EQP_REPORT_BY_CODE[code];
    if (!def) return eqpBad(req, res, "E-EQP-RPT-CODE", `گزارش ${code} تعریف نشده است`, 404);

    const projectId = String(req.query.projectId || "");
    if (!projectId) return eqpBad(req, res, "NO_PROJECT", "پارامتر projectId الزامی است");

    const audience = req.query.audience === "official" ? "official" : "internal";
    /* گزارش داخلی‌محور (مانند موجودی قطعات) نباید با سربرگ رسمی به کارفرما برود؛
     * دلیل رد باید صریح باشد نه پنهان‌شده پشت پیام عمومی دروازه. */
    if (!def.audiences.includes(audience)) {
      return eqpBad(req, res, "E-EQP-RPT-AUDIENCE", `گزارش ${code} فقط برای مخاطب ${def.audiences.join("/")} تعریف شده است`, 403);
    }
    const format = String(req.query.format || "json").toLowerCase();
    const lang = req.query.lang === "en" ? "en" : "fa";

    const data = await eqpReportData(projectId);
    const nowIso = eqmNowIso();
    const fromIso = eqmWindowFrom();
    const nameById = Object.fromEntries(data.equipment.map((e) => [e.Id, e.NameFa]));
    const codeById = Object.fromEntries(data.equipment.map((e) => [e.Id, e.Code]));

    const metricsOf = (e) => ({
      workHours: workHoursSum(data.meters.filter((m) => m.EquipmentId === e.Id)),
      downtimeHrs: downtimeHours(data.orders.filter((o) => o.EquipmentId === e.Id), fromIso, nowIso),
    });
    const activePm = data.pm.filter((x) => x.Active !== false && x.Active !== 0);

    let report;

    if (code === "RPT-EQP-DSP") {
      const date = String(req.query.date || nowIso);
      const rows = data.dispatches.filter((d) => d.DispatchDate === date).map((d) => {
        const e = data.equipment.find((x) => x.Id === d.EquipmentId);
        if (!e) return { dispatch: d, equipmentName: d.EquipmentId, equipmentCode: d.EquipmentId };
        const eo = data.orders.filter((o) => o.EquipmentId === e.Id);
        const lastMeter = [...data.meters.filter((m) => m.EquipmentId === e.Id)].sort((a, b) => String(b.ReadAt).localeCompare(String(a.ReadAt)))[0];
        let pmOverdueDays = 0;
        for (const sc of activePm.filter((x) => x.EquipmentId === e.Id)) {
          const due = pmDueByBasis(sc, nowIso, Number(lastMeter?.HourMeter ?? 0));
          if (due.overdue) pmOverdueDays = Math.max(pmOverdueDays, sc.Basis === "calendar_days" ? Math.abs(due.remaining) : Math.ceil(Math.abs(due.remaining) / 8));
        }
        return {
          dispatch: d,
          equipmentName: e.NameFa,
          equipmentCode: e.Code,
          check: dispatchPrecheck({
            nowIso,
            equipment: e,
            openCriticalOrders: eo.filter((o) => o.Priority === "critical" && (o.Status === "open" || o.Status === "in_progress")).length,
            pmOverdueDays,
            operatorAssigned: Boolean(d.OperatorId),
            safetyCheckDone: d.SafetyCheck === true || d.SafetyCheck === 1,
            rentalActive: data.rentals.some((r) => r.EquipmentId === e.Id && r.Status === "active"),
          }),
        };
      });
      report = buildDispatchSheetReport({ dateIso: date, rows });
    } else if (code === "RPT-EQP-CARD") {
      const equipmentId = String(req.query.equipmentId || "");
      const e = data.equipment.find((x) => x.Id === equipmentId || x.Code === equipmentId);
      if (!e) return eqpBad(req, res, "NOT_FOUND", "برای کارت شناسنامه باید equipmentId معتبر بدهید", 404);
      report = buildEquipmentIdCardReport({
        equipment: e,
        nowIso,
        orders: data.orders.filter((o) => o.EquipmentId === e.Id),
        meters: data.meters.filter((m) => m.EquipmentId === e.Id),
        rental: data.rentals.find((r) => r.EquipmentId === e.Id && r.Status === "active"),
      });
    } else if (code === "RPT-EQP-MNT") {
      const totalDown = data.equipment.reduce((s, e) => s + metricsOf(e).downtimeHrs, 0);
      report = buildMaintenanceReport({
        fromIso,
        toIso: nowIso,
        orders: data.orders,
        equipmentNameById: nameById,
        plannedPmCount: activePm.length,
        periodHours: Math.max(1, EQM_WINDOW_DAYS * 24 * Math.max(1, data.equipment.length)),
        downtimeHrs: totalDown,
      });
    } else if (code === "RPT-EQP-PERF") {
      const metrics = data.equipment.map((e) => ({ ...metricsOf(e), periodDays: EQM_WINDOW_DAYS }));
      const fuelStats = fuelSummary(data.fuel);
      /* ADR-13: OEE فقط با تولید واقعیِ ثبت‌شده معنا دارد. نرخ اسمی را نمی‌توان
       * از همان دیسپچی که خروجی را می‌دهد استخراج کرد — حاصلش performance ثابت
       * ۱۰۰٪ و OEE بی‌معناست. تا وقتی ActualQty و نرخ اسمی دسته ثبت نشود، OEE
       * سنجش‌ناپذیر (null) گزارش می‌شود. */
      const actualOutput = undefined;
      const rated = 0;
      const board = fleetKpiBoard({
        equipment: data.equipment,
        metrics,
        orders: data.orders,
        plannedPmCount: activePm.length,
        maintenanceCost: data.orders.reduce((s, o) => s + (Number(o.Cost) || 0), 0),
        assetValue: data.equipment.reduce((s, e) => s + (Number(e.PurchaseValue) || 0), 0),
        fuelLitres: fuelStats.quantity,
        actualOutput: rated > 0 ? actualOutput : undefined,
        ratedOutputPerHour: rated > 0 ? rated : undefined,
        periodDays: EQM_WINDOW_DAYS,
      });
      let pmOverdueDays = 0;
      for (const sc of activePm) {
        const em = data.meters.filter((m) => m.EquipmentId === sc.EquipmentId);
        const last = [...em].sort((a, b) => String(b.ReadAt).localeCompare(String(a.ReadAt)))[0];
        const due = pmDueByBasis(sc, nowIso, Number(last?.HourMeter ?? 0));
        if (due.overdue) pmOverdueDays = Math.max(pmOverdueDays, sc.Basis === "calendar_days" ? Math.abs(due.remaining) : Math.ceil(Math.abs(due.remaining) / 8));
      }
      const alerts = ewsEqp({
        availabilityPct: board.availability,
        utilizationPct: board.utilization,
        utilLowPct: 40,
        pmOverdueDays,
        criticalBacklog: maintenanceBacklog(data.orders).byPriority.critical,
        sfc: board.sfc,
        sfcBenchmark: 18,
      });
      const health = equipmentHealthScore({
        availabilityPct: board.availability,
        utilizationPct: board.utilization,
        pmCompliancePct: board.pmCompliance,
        criticalBacklog: maintenanceBacklog(data.orders).byPriority.critical,
        agingRatio: 0.3,
      });
      report = buildFleetPerformanceReport({
        fromIso,
        toIso: nowIso,
        board,
        perEquipment: data.equipment.map((e) => {
          const m = metricsOf(e);
          const cat = CATEGORY_BY_CODE[e.Category] ?? CATEGORY_BY_CODE["OTH"];
          const rental = data.rentals.find((r) => r.EquipmentId === e.Id && r.Status === "active");
          return {
            code: e.Code,
            name: e.NameFa,
            workHours: m.workHours,
            utilization: utilization(m.workHours, EQM_WINDOW_DAYS, 8, { lowPct: cat.utilLowPct, highPct: cat.utilHighPct }).rate,
            availability: availability(m.downtimeHrs, EQM_WINDOW_DAYS * 24).rate,
            downtimeHrs: m.downtimeHrs,
            costPerHour: equipmentCostPerHour(m.workHours, {
              rentalCost: rental ? rentalCostAccrued(rental, nowIso).accrued : 0,
              maintenanceCost: data.orders.filter((o) => o.EquipmentId === e.Id).reduce((s, o) => s + (Number(o.Cost) || 0), 0),
              fuelCost: fuelSummary(data.fuel.filter((f) => f.EquipmentId === e.Id)).cost,
            }).costPerHour,
          };
        }),
        alerts,
        healthScore: health.score,
        healthGrade: health.grade,
      });
    } else if (code === "RPT-EQP-COST") {
      report = buildCostAllocationReport({
        fromIso,
        toIso: nowIso,
        rows: data.equipment.map((e) => {
          const rental = data.rentals.find((r) => r.EquipmentId === e.Id && r.Status === "active");
          const dispatch = data.dispatches.find((d) => d.EquipmentId === e.Id && d.CostAccountId);
          return {
            code: e.Code,
            name: e.NameFa,
            costAccount: dispatch?.CostAccountId,
            workHours: metricsOf(e).workHours,
            rentalCost: rental ? rentalCostAccrued(rental, nowIso).accrued : 0,
            maintenanceCost: data.orders.filter((o) => o.EquipmentId === e.Id).reduce((s, o) => s + (Number(o.Cost) || 0), 0),
            fuelCost: fuelSummary(data.fuel.filter((f) => f.EquipmentId === e.Id)).cost,
          };
        }),
      });
    } else if (code === "RPT-EQP-EXEC") {
      const metrics = data.equipment.map((e) => ({ ...metricsOf(e), periodDays: EQM_WINDOW_DAYS }));
      const fuelStats = fuelSummary(data.fuel);
      const maintenanceCost = data.orders.reduce((s, o) => s + (Number(o.Cost) || 0), 0);
      const board = fleetKpiBoard({
        equipment: data.equipment,
        metrics,
        orders: data.orders,
        plannedPmCount: activePm.length,
        maintenanceCost,
        assetValue: data.equipment.reduce((s, e) => s + (Number(e.PurchaseValue) || 0), 0),
        fuelLitres: fuelStats.quantity,
        periodDays: EQM_WINDOW_DAYS,
      });
      let pmOverdueDays = 0;
      let pmOverdueCount = 0;
      for (const sc of activePm) {
        const em = data.meters.filter((m) => m.EquipmentId === sc.EquipmentId);
        const last = [...em].sort((a, b) => String(b.ReadAt).localeCompare(String(a.ReadAt)))[0];
        const due = pmDueByBasis(sc, nowIso, Number(last?.HourMeter ?? 0));
        if (due.overdue) {
          pmOverdueCount += 1;
          pmOverdueDays = Math.max(pmOverdueDays, sc.Basis === "calendar_days" ? Math.abs(due.remaining) : Math.ceil(Math.abs(due.remaining) / 8));
        }
      }
      const backlog = maintenanceBacklog(data.orders);
      const health = equipmentHealthScore({
        availabilityPct: board.availability,
        utilizationPct: board.utilization,
        pmCompliancePct: board.pmCompliance,
        criticalBacklog: backlog.byPriority.critical,
        agingRatio: 0.3,
      });
      /* بودجه از حساب‌های هزینهٔ مرتبط با دیسپچ‌ها می‌آید؛ اگر ثبت نشده باشد
       * انحراف «سنجش‌ناپذیر» گزارش می‌شود نه صفر. */
      const r = await repo();
      const caIds = [...new Set(data.dispatches.map((d) => d.CostAccountId).filter(Boolean))];
      let budget = 0;
      for (const id of caIds) {
        const [ca] = await r.list("CostAccount", { where: [{ column: "Id", op: "eq", value: id }], limit: 1 });
        budget += Number(ca?.Budget) || 0;
      }
      const rentalCost = data.rentals
        .filter((x) => x.Status === "active")
        .reduce((s, x) => s + rentalCostAccrued(x, nowIso).accrued, 0);
      report = buildExecutiveOnePager({
        fromIso, toIso: nowIso, board,
        fleetSize: data.equipment.length,
        activeCount: data.equipment.filter((e) => e.Status === "active").length,
        healthScore: health.score,
        healthGrade: health.grade,
        backlog,
        topCauses: rcaPareto(data.orders),
        cost: { budget, actual: maintenanceCost + fuelStats.cost + rentalCost },
        alerts: ewsEqp({
          availabilityPct: board.availability,
          utilizationPct: board.utilization,
          utilLowPct: 40,
          pmOverdueDays,
          criticalBacklog: backlog.byPriority.critical,
          sfc: board.sfc,
          sfcBenchmark: 18,
        }),
        pmOverdueCount,
      });
    } else {
      report = buildSparePartsReport({ parts: data.parts, coverDays: Number(req.query.coverDays) || 30 });
    }

    /* دروازهٔ انتشار: گزارش رسمی با دادهٔ ناقص یا بحران اعلام‌نشده صادر نمی‌شود. */
    const missingMeter = data.equipment.filter(
      (e) => e.Status !== "disposed" && !data.meters.some((m) => m.EquipmentId === e.Id && m.ReadAt >= fromIso)
    ).length;
    let pmOverdueCount = 0;
    for (const sc of activePm) {
      const em = data.meters.filter((m) => m.EquipmentId === sc.EquipmentId);
      const last = [...em].sort((a, b) => String(b.ReadAt).localeCompare(String(a.ReadAt)))[0];
      if (pmDueByBasis(sc, nowIso, Number(last?.HourMeter ?? 0)).overdue) pmOverdueCount += 1;
    }
    const gate = eqpPublishGate(audience, {
      blockedDispatch: data.dispatches.filter((d) => d.DispatchDate === nowIso && d.Status === "rejected").length,
      pmOverdue: pmOverdueCount,
      criticalOpen: maintenanceBacklog(data.orders).byPriority.critical,
      criticalPartsOut: data.parts.filter((p) => (p.Critical === true || p.Critical === 1) && Number(p.OnHand) <= 0).length,
      missingMeterReadings: missingMeter,
    });

    const lh = eqpLetterhead(req.query, code, Number(req.query.seq) || 1);
    lh.periodLabel = `${fromIso} … ${nowIso}`;
    const letterheadIssues = validateLetterhead(lh, audience);
    const blockingIssues = letterheadIssues.filter((i) => i.severity === "error");

    if (audience === "official" && (!gate.ok || blockingIssues.length > 0)) {
      return res.status(409).json({
        ok: false,
        error: {
          code: "E-EQP-RPT-GATE",
          message: "گزارش رسمی با شرایط فعلی قابل صدور نیست",
          reasons: gate.reasons,
          letterheadIssues: blockingIssues,
          traceId: req.requestId,
        },
      });
    }

    if (format === "json") {
      return res.json(eqpOk(req, {
        report,
        rows: eqpReportRows(report),
        pages: estimatePages({ ...report, sections: report.sections }),
        gate,
        letterheadIssues,
        audience,
      }, { reportCode: code }));
    }

    const fileName = exportFileName(report, lh, format === "html" || format === "pdf" ? "pdf" : format);
    if (format === "csv") {
      res.type("text/csv; charset=utf-8").set("content-disposition", `attachment; filename="${fileName}"`);
      return res.send(`\uFEFF${toCsv(report, lang)}`);
    }
    if (format === "doc") {
      res.type("application/msword; charset=utf-8").set("content-disposition", `attachment; filename="${fileName}"`);
      return res.send(toWordHtml(report, lh, audience, lang));
    }
    if (format === "xls") {
      res.type("application/vnd.ms-excel; charset=utf-8").set("content-disposition", `attachment; filename="${fileName}"`);
      return res.send(toExcelHtml(report, lh, lang));
    }
    /* html و pdf هر دو HTML آماده چاپ می‌دهند — PDF از مسیر چاپ مرورگر تولید می‌شود. */
    res.type("text/html; charset=utf-8").send(toPrintHtml(report, lh, audience, lang));
  } catch (err) {
    next(err);
  }
});


/* ═════════ اتصال‌های بین‌ماژولی ماشین‌آلات (G-01 و G-02) ═════════ */

/**
 * G-01 — همگام‌سازی قفل فعالیت‌های PEX با خرابی ماشین‌آلات.
 *
 * `?apply=1` تغییرات را می‌نویسد؛ بدون آن فقط پیش‌نمایش می‌دهد (dry-run پیش‌فرض
 * است تا فراخوان تصادفی برنامهٔ زمان‌بندی را دست نزند).
 * قفل «وضعیت مشتق‌شده» است: هر بار از صفر محاسبه می‌شود، پس اجرای مکرر امن است
 * و آزادسازی هرگز جا نمی‌ماند (ADR-20).
 */
app.post("/api/eqp/pex/sync-locks", async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || req.body?.projectId || "");
    if (!projectId) return eqpBad(req, res, "NO_PROJECT", "پارامتر projectId الزامی است");
    const apply = req.query.apply === "1" || req.body?.apply === true;

    const r = await repo();
    const w = [{ column: "ProjectId", op: "eq", value: projectId }];
    const [activities, dispatches, orders, equipment] = await Promise.all([
      r.list("Activity", { where: w, limit: 2000 }),
      r.list("EquipmentDispatch", { where: w, limit: 2000 }),
      r.list("MaintenanceOrder", { where: w, limit: 2000 }),
      r.list("Equipment", { where: w, limit: 500 }),
    ]);

    const plan = planActivityLocks({
      activities,
      dispatches,
      orders,
      equipmentNameById: Object.fromEntries(equipment.map((e) => [e.Id, e.Code])),
    });

    const applied = { locked: 0, released: 0, failed: [] };
    if (apply) {
      const userId = req.headers["x-user-id"] || "eqp-sync";
      for (const item of plan.lock) {
        try {
          await r.patch("Activity", item.activityId, { BlockedByEquipmentId: item.equipmentId }, userId);
          applied.locked += 1;
        } catch (e) {
          applied.failed.push({ activityId: item.activityId, error: String(e.message || e) });
        }
      }
      for (const item of plan.release) {
        try {
          await r.patch("Activity", item.activityId, { BlockedByEquipmentId: null }, userId);
          applied.released += 1;
        } catch (e) {
          applied.failed.push({ activityId: item.activityId, error: String(e.message || e) });
        }
      }
    }

    res.json(eqpOk(req, {
      mode: apply ? "applied" : "preview",
      plan,
      applied: apply ? applied : undefined,
      blockingOrders: orders.filter(isBlockingOrder).length,
    }));
  } catch (err) { next(err); }
});

/**
 * G-02 — ثبت هزینهٔ دورهٔ ماشین‌آلات روی حساب‌های هزینهٔ مالی.
 *
 * ایدمپوتنت با کلید `(CostAccountId, PeriodCode)` — سهم قبلی EQP در همان دوره
 * کسر و سهم تازه جایگزین می‌شود، پس اجرای دوباره جمع را دوبرابر نمی‌کند
 * (ADR-21). پیش‌فرض dry-run است.
 */
app.post("/api/eqp/fin/post-costs", async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || req.body?.projectId || "");
    if (!projectId) return eqpBad(req, res, "NO_PROJECT", "پارامتر projectId الزامی است");
    const apply = req.query.apply === "1" || req.body?.apply === true;
    const nowIso = eqmNowIso();
    const periodCode = String(req.query.periodCode || req.body?.periodCode || nowIso.slice(0, 7));

    const data = await eqpReportData(projectId);
    const fromIso = eqmWindowFrom();

    const rows = data.equipment.map((e) => {
      const rental = data.rentals.find((x) => x.EquipmentId === e.Id && x.Status === "active");
      const dispatch = data.dispatches.find((d) => d.EquipmentId === e.Id && d.CostAccountId);
      return {
        equipmentId: e.Id,
        code: e.Code,
        costAccountId: dispatch?.CostAccountId ?? null,
        workHours: workHoursSum(data.meters.filter((m) => m.EquipmentId === e.Id)),
        rentalCost: rental ? rentalCostAccrued(rental, nowIso).accrued : 0,
        maintenanceCost: data.orders.filter((o) => o.EquipmentId === e.Id).reduce((s, o) => s + (Number(o.Cost) || 0), 0),
        fuelCost: fuelSummary(data.fuel.filter((f) => f.EquipmentId === e.Id)).cost,
      };
    });

    const { postings, unallocated } = buildCostPostings({ periodCode, rows });

    const r = await repo();
    const results = [];
    for (const line of postings) {
      const [account] = await r.list("CostAccount", { where: [{ column: "Id", op: "eq", value: line.costAccountId }], limit: 1 });
      if (!account) {
        results.push({ costAccountId: line.costAccountId, status: "missing_account", amount: line.amount });
        continue;
      }
      /* سهم قبلی EQP از دفتر ثبت اختصاصی خوانده می‌شود، نه از متن یادداشت.
       * کلید یکتای (CostAccountId, PeriodCode) تضمین می‌کند هر دوره یک سطر
       * داشته باشد و اجرای دوباره جمع را متورم نکند. */
      const [prior] = await r.list("EquipmentCostPosting", {
        where: [
          { column: "CostAccountId", op: "eq", value: line.costAccountId },
          { column: "PeriodCode", op: "eq", value: periodCode },
        ],
        limit: 1,
      });
      const previousShare = Number(prior?.Amount) || 0;
      const nextActual = applyPostingToActual(Number(account.Actual) || 0, previousShare, line.amount);

      results.push({
        costAccountId: line.costAccountId,
        accountCode: account.Code,
        status: apply ? "posted" : "preview",
        previousActual: Number(account.Actual) || 0,
        previousEqpShare: previousShare,
        eqpShare: line.amount,
        nextActual,
        memoFa: line.memoFa,
      });

      if (apply) {
        const userId = req.headers["x-user-id"] || "eqp-post";
        await r.patch("CostAccount", line.costAccountId, { Actual: nextActual }, userId);
        await r.upsert(
          "EquipmentCostPosting",
          { CostAccountId: line.costAccountId, PeriodCode: periodCode },
          {
            ProjectId: projectId,
            CostAccountId: line.costAccountId,
            PeriodCode: periodCode,
            Amount: line.amount,
            RentalCost: line.rentalCost,
            MaintenanceCost: line.maintenanceCost,
            FuelCost: line.fuelCost,
            WorkHours: line.workHours,
            MemoFa: line.memoFa,
            PostedAt: new Date().toISOString(),
          },
          userId,
        );
      }
    }

    res.json(eqpOk(req, {
      mode: apply ? "applied" : "preview",
      periodCode,
      window: { fromIso, toIso: nowIso },
      postings: results,
      unallocated,
      note: unallocated.length > 0
        ? "هزینهٔ ماشین‌های بدون حساب هزینه ثبت نشد؛ ابتدا در دیسپچ حساب هزینه تعیین کنید"
        : undefined,
    }));
  } catch (err) { next(err); }
});

/* ═══════════════ مرکز یکپارچه‌سازی (itg-v1) ═══════════════
 * ورود XER پریماورا، قالب‌های Excel/CSV و مشخصات OpenAPI تولیدشده از اسکیما.
 * همه چیز روی موتور خالص server/itgLogic.js می‌نشیند تا منطق تست‌پذیر بماند. */

const INTEGRATION_EXT = new Set([".xer", ".csv", ".txt", ".xlsx", ".xls"]);
const integrationUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxFileBytes, files: 1 },
  fileFilter: (_req, file, callback) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (INTEGRATION_EXT.has(ext)) return callback(null, true);
    const error = new Error(`Unsupported integration file type: ${ext}`);
    error.code = "UNSUPPORTED_FILE_TYPE";
    callback(error);
  },
});

const itgFail = (req, res, status, code, message) =>
  res.status(status).json({ ok: false, error: { code, message, traceId: req.requestId } });

const itgOk = (req, res, data) =>
  res.json({ ok: true, data, meta: { traceId: req.requestId, engine: INTEGRATION_VERSION, timestamp: new Date().toISOString() } });

/** متن فایل را از multipart یا بدنهٔ JSON بیرون می‌کشد. */
const integrationText = (req) => {
  if (req.file?.buffer) return { text: req.file.buffer.toString("utf8"), name: req.file.originalname };
  if (typeof req.body?.content === "string" && req.body.content.trim()) return { text: req.body.content, name: req.body.fileName || "inline" };
  return null;
};

/** خلاصهٔ وضعیت مرکز یکپارچه‌سازی برای داشبورد. */
app.get("/api/integration/status", (req, res) => {
  itgOk(req, res, {
    stats: integrationStats(),
    connectors: CONNECTORS,
    templates: TEMPLATE_CATALOG.map((t) => ({ code: t.code, title: t.title, targetTable: t.targetTable, fields: t.fields.length })),
  });
});

/** ورود فایل XER پریماورا — پیش‌نمایش (پیش‌فرض) یا نوشتن با commit=1. */
app.post("/api/integration/xer", integrationUpload.single("file"), async (req, res, next) => {
  try {
    const source = integrationText(req);
    if (!source) return itgFail(req, res, 400, "NO_FILE", "فایل XER ارسال نشده است");
    const projectId = String(req.query.projectId || req.body?.projectId || "").trim();
    if (!projectId) return itgFail(req, res, 400, "NO_PROJECT", "شناسه پروژه (projectId) الزامی است");

    const parsedTables = parseXerTables(source.text);
    if (!parsedTables.tableNames.length) return itgFail(req, res, 422, "BAD_XER", "ساختار XER شناسایی نشد");
    const extracted = extractXer(parsedTables, projectId, jalaali.toGregorian);

    const r = await repo();
    const existing = await r.list("Activity", { where: [{ column: "ProjectId", op: "eq", value: projectId }], limit: 5000 });
    const diff = diffRows(existing, extracted.activities, "Code", ACTIVITY_COMPARE_FIELDS);
    const blocking = extracted.issues.filter((i) => i.severity === "error");
    const commit = req.query.commit === "1" || req.body?.commit === true;

    const payload = {
      fileName: source.name,
      header: parsedTables.header,
      projectName: extracted.projectName,
      dataDate: extracted.dataDate,
      counts: extracted.counts,
      calendars: extracted.calendars,
      issues: extracted.issues,
      diff: {
        added: diff.added.length,
        updated: diff.updated.length,
        removed: diff.removed.length,
        unchanged: diff.unchanged,
        sample: diff.updated.slice(0, 20),
      },
      committed: false,
    };

    if (!commit) return itgOk(req, res, payload);
    if (blocking.length) return itgFail(req, res, 422, "IMPORT_BLOCKED", `${blocking.length} خطای مسدودکننده؛ پیش از نوشتن اصلاح شود`);

    const actor = req.headers["x-user-id"] || "integration";
    const written = { wbs: 0, activities: 0, relations: 0 };
    /** شناسهٔ ردیف‌های XER قطعی است، پس upsert روی همان کلید تکرارپذیر می‌ماند. */
    const upsertById = async (table, row) => {
      const { Id, ...rest } = row;
      /** میدان‌های زیرخط‌دار فقط برای نمایش‌اند و ستون پایگاه داده نیستند. */
      for (const key of Object.keys(rest)) if (key.startsWith("_")) delete rest[key];
      await r.upsert(table, { Id }, rest, actor);
    };
    for (const row of extracted.wbs) { await upsertById("WbsNode", row); written.wbs += 1; }
    for (const row of extracted.activities) { await upsertById("Activity", row); written.activities += 1; }
    for (const row of extracted.relations) { await upsertById("ActivityRelation", row); written.relations += 1; }
    itgOk(req, res, { ...payload, committed: true, written });
  } catch (err) {
    next(err);
  }
});

/** فهرست قالب‌های ورود داده. */
app.get("/api/integration/templates", (req, res) => {
  itgOk(req, res, {
    templates: TEMPLATE_CATALOG.map((t) => ({
      code: t.code,
      title: t.title,
      targetTable: t.targetTable,
      keyFields: t.keyFields,
      guide: templateGuide(t),
    })),
  });
});

/** دانلود فایل نمونهٔ CSV یک قالب (با BOM تا اکسل فارسی درست باز کند). */
app.get("/api/integration/templates/:code.csv", (req, res) => {
  const template = templateByCode(req.params.code.toUpperCase());
  if (!template) return itgFail(req, res, 404, "UNKNOWN_TEMPLATE", `قالب ${req.params.code} تعریف نشده است`);
  const lang = req.query.lang === "en" ? "en" : "fa";
  res.setHeader("Content-Disposition", `attachment; filename="${template.code}-${lang}.csv"`);
  res.type("text/csv; charset=utf-8").send(`\uFEFF${templateCsv(template, lang)}`);
});

/** ورود داده بر پایهٔ قالب — پیش‌نمایش یا نوشتن با commit=1. */
app.post("/api/integration/import/:code", integrationUpload.single("file"), async (req, res, next) => {
  try {
    const template = templateByCode(req.params.code.toUpperCase());
    if (!template) return itgFail(req, res, 404, "UNKNOWN_TEMPLATE", `قالب ${req.params.code} تعریف نشده است`);
    const source = integrationText(req);
    if (!source) return itgFail(req, res, 400, "NO_FILE", "فایلی برای ورود ارسال نشده است");

    const result = parseImport(template, source.text, jalaali.toGregorian);
    const commit = req.query.commit === "1" || req.body?.commit === true;
    const projectId = String(req.query.projectId || req.body?.projectId || "").trim();

    const payload = {
      template: { code: template.code, title: template.title, targetTable: template.targetTable },
      fileName: source.name,
      counts: result.counts,
      issues: result.issues,
      preview: result.rows.slice(0, 25),
      committed: false,
    };
    if (!commit) return itgOk(req, res, payload);
    if (result.counts.errors) return itgFail(req, res, 422, "IMPORT_BLOCKED", `${result.counts.errors} خطا در فایل؛ پیش از نوشتن اصلاح شود`);
    if (!PUBLIC_TABLES.has(template.targetTable)) return itgFail(req, res, 403, "TABLE_NOT_EXPOSED", `نوشتن در ${template.targetTable} مجاز نیست`);

    const r = await repo();
    const actor = req.headers["x-user-id"] || "integration";
    const hasProject = allColumns(tableDef(template.targetTable)).some((c) => c.name === "ProjectId");
    let written = 0;
    let inserted = 0;
    for (const row of result.rows) {
      const record = { ...row };
      if (projectId && hasProject) record.ProjectId = projectId;
      /** کلید طبیعی قالب تعیین می‌کند ورود دوباره به‌روزرسانی است نه ردیف تکراری. */
      const naturalKey = Object.fromEntries(template.keyFields.map((k) => [k, record[k]]));
      if (projectId && hasProject) naturalKey.ProjectId = projectId;
      const data = { ...record };
      for (const k of Object.keys(naturalKey)) delete data[k];
      const outcome = await r.upsert(template.targetTable, naturalKey, data, actor);
      written += 1;
      if (outcome.action === "insert") inserted += 1;
    }
    itgOk(req, res, { ...payload, committed: true, written, inserted, updated: written - inserted });
  } catch (err) {
    next(err);
  }
});

/** مشخصات OpenAPI تولیدشده از اسکیمای sql-v1 — همیشه با کد همگام است. */
const openApiSpec = () => generateOpenApi(
  SCHEMA.filter((t) => PUBLIC_TABLES.has(t.name)).map((t) => ({
    name: t.name,
    title: t.title,
    pk: t.pk,
    columns: allColumns(t).map((c) => ({ name: c.name, kind: c.kind, len: c.len, nullable: c.nullable })),
  })),
);

app.get("/api/openapi.json", (req, res) => res.json(openApiSpec()));
app.get("/api/openapi.yaml", (req, res) => res.type("text/yaml; charset=utf-8").send(toYaml(openApiSpec())));

/* ═══════════════ ماژول مهندسی و طراحی (eng-v1، دامنهٔ d12) ═══════════════
 * پرامپت «ENGINEERING & DESIGN MANAGEMENT MODULE» — تحویلی‌های ۳ تا ۱۴.
 * منطق کامل در server/engLogic.js است؛ اینجا فقط داده خوانده و سرو می‌شود.
 * مبنا: docs/ENG_Architecture.md — ADR-ENG-01..10. */

const engOk = (req, data, meta = {}) =>
  ({ ok: true, data, meta: { traceId: req.requestId, engine: ENG_VERSION, timestamp: new Date().toISOString(), ...meta } });

const engBad = (req, res, code, message, status = 400) =>
  res.status(status).json({ ok: false, error: { code, message, traceId: req.requestId } });

const engToday = () => new Date().toISOString().slice(0, 10);

async function engProjectRows(projectId) {
  const r = await repo();
  const w = [{ column: "ProjectId", op: "eq", value: projectId }];
  const [deliverables, revisions, comments, checks, clashes, queries, vendorDocs] = await Promise.all([
    r.list("MdrDeliverable", { where: w, limit: 5000 }),
    r.list("EngineeringRevision", { where: w, limit: 5000 }),
    r.list("CrsComment", { where: w, limit: 5000 }),
    r.list("SquadCheck", { where: w, limit: 5000 }),
    r.list("InterfaceClashLog", { where: w, limit: 5000 }),
    r.list("TechnicalQuery", { where: w, limit: 5000 }),
    r.list("VendorPrintReview", { where: w, limit: 5000 }),
  ]);
  return { deliverables, revisions, comments, checks, clashes, queries, vendorDocs };
}

/** پیوند فعالیت به مدرک: از تطابق WbsId مشتق می‌شود (نگاشت صریح در فاز بعد). */
/** گروه‌بندی ریویژن‌ها بر پایهٔ مدرک — الگوی تکرارشونده در چند اندپوینت. */
function engRevisionsByDeliverable(revisions) {
  const byDel = new Map();
  for (const rv of revisions) {
    const arr = byDel.get(rv.DeliverableId) || [];
    arr.push(rv);
    byDel.set(rv.DeliverableId, arr);
  }
  return byDel;
}

function engActivityDocLinks(activities, deliverables) {
  const byWbs = new Map();
  for (const d of deliverables) {
    if (!d.WbsId) continue;
    if (!byWbs.has(d.WbsId)) byWbs.set(d.WbsId, d.Id);
  }
  const links = [];
  for (const a of activities) {
    const delId = a.WbsId ? byWbs.get(a.WbsId) : undefined;
    if (delId) links.push({ activityId: a.Id, deliverableId: delId });
  }
  return links;
}

/* ═══════════ کنترل دسترسی اندپوینت‌های مهندسی ═══════════
 * اقدام‌های نوشتاری ماژول اثر قراردادی دارند: آزادسازی ساخت، ادعای EOT
 * علیه کارفرما و تبدیل درخواست کالا به خرید. بدون محافظ، هر فراخوانی
 * می‌توانست این‌ها را اجرا کند.
 *
 * خواندن عمداً باز می‌ماند تا داشبورد و گزارش بدون اصطکاک کار کنند؛
 * محافظ روی نوشتن است، همان‌جا که خسارت جبران‌ناپذیر می‌شود. */

/** کاربر از هدر؛ در نبود آن «مهمان» با صفر مجوز فرض می‌شود. */
function engSubject(req) {
  const userId = String(req.headers["x-user-id"] || "").trim();
  if (!userId) return null;
  return ENG_RBAC_SUBJECTS.find((u) => u.id === userId) ?? null;
}

/**
 * میان‌افزار مجوز. وقتی ENG_RBAC_ENFORCE=0 باشد فقط هشدار می‌دهد و عبور
 * می‌کند — تا استقرار مرحله‌ای ممکن شود و سامانهٔ در حال کار یک‌شبه قفل نشود.
 */
function engRequire(permission) {
  return (req, res, next) => {
    const enforce = String(process.env.ENG_RBAC_ENFORCE ?? "1") !== "0";
    const subject = engSubject(req);
    const projectId = String(req.query.projectId || "");

    if (!subject) {
      if (!enforce) return next();
      return res.status(401).json({
        ok: false,
        error: {
          code: "E-ENG-AUTH-REQUIRED",
          message: "شناسهٔ کاربر برای این اقدام الزامی است",
          permission,
          traceId: req.requestId,
        },
      });
    }

    /* دامنهٔ پروژهٔ دادهٔ نمونه با شناسهٔ پروژه‌های RBAC یکی نیست؛ بررسی
     * دامنه به لایهٔ احراز هویت واقعی سپرده می‌شود و اینجا فقط مجوز
     * سنجیده می‌شود تا رد کاذب نسازیم. */
    /* موتور RBAC میدان `allow` برمی‌گرداند نه `allowed`؛ خواندن نام غلط
     * همه را رد می‌کرد. رفتار ایمن است (fail-closed) ولی مدیر پروژه را هم
     * می‌بست، پس آزمون صریح برای مسیر مجاز لازم است نه فقط مسیر رد. */
    const verdict = rbacEvaluate(subject, permission, { projectId: undefined });
    if (!verdict.allow) {
      if (!enforce) return next();
      return res.status(403).json({
        ok: false,
        error: {
          code: "E-ENG-FORBIDDEN",
          message: `کاربر ${subject.id} مجوز «${permission}» را ندارد`,
          permission,
          reason: verdict.code ?? null,
          detail: verdict.reason?.fa ?? null,
          traceId: req.requestId,
        },
      });
    }

    req.engSubject = subject;
    return next();
  };
}

app.get("/api/eng/status", (req, res) => {
  res.json(engOk(req, {
    engine: ENG_VERSION,
    domain: ENG_DOMAIN_ID,
    disciplines: DISCIPLINES.length,
    rocSteps: ROC_STEPS,
    reports: ENG_REPORT_CATALOG.length,
    kpiTargets: ENG_KPI_TARGETS,
    defaultReviewDays: DEFAULT_CONTRACT_REVIEW_DAYS,
  }));
});

app.get("/api/eng/overview", async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return engBad(req, res, "E-ENG-NO-PROJECT", "پارامتر projectId الزامی است");
    const asOf = String(req.query.asOf || engToday());
    const rows = await engProjectRows(projectId);
    const r = await repo();
    const activities = await r.list("Activity", { where: [{ column: "ProjectId", op: "eq", value: projectId }], limit: 5000 });
    const lockPlan = planIfcLocks({
      activities,
      activityDocLinks: engActivityDocLinks(activities, rows.deliverables),
      deliverables: rows.deliverables,
      revisions: rows.revisions,
    });
    res.json(engOk(req, engineeringOverview({ ...rows, lockPlan, asOf })));
  } catch (err) { next(err); }
});

app.get("/api/eng/mdr", async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return engBad(req, res, "E-ENG-NO-PROJECT", "پارامتر projectId الزامی است");
    const { deliverables, revisions } = await engProjectRows(projectId);
    const discipline = req.query.discipline ? String(req.query.discipline) : null;
    const rows = discipline ? deliverables.filter((d) => d.Discipline === discipline) : deliverables;
    const byDel = new Map();
    for (const rv of revisions) {
      const arr = byDel.get(rv.DeliverableId) || [];
      arr.push(rv);
      byDel.set(rv.DeliverableId, arr);
    }
    res.json(engOk(req, {
      validation: validateMdr(rows),
      items: rows.map((d) => {
        const p = deliverableProgress(byDel.get(d.Id) || []);
        return {
          id: d.Id, docNo: d.DocNo, titleFa: d.TitleFa,
          discipline: d.Discipline, disciplineFa: DISCIPLINE_FA[d.Discipline] || d.Discipline,
          docType: d.DocType, docTypeFa: DOC_TYPE_FA[d.DocType] || d.DocType,
          weight: Number(d.PlannedWeight) || 0,
          targetIfa: d.TargetIfaDate, targetIfc: d.TargetIfcDate,
          status: d.Status, pct: p.pct, step: p.step, trail: p.trail,
          reviewDays: reviewDaysFor(d),
        };
      }),
    }, { count: rows.length }));
  } catch (err) { next(err); }
});

app.get("/api/eng/progress", async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return engBad(req, res, "E-ENG-NO-PROJECT", "پارامتر projectId الزامی است");
    const asOf = String(req.query.asOf || engToday());
    const { deliverables, revisions } = await engProjectRows(projectId);
    const byDel = new Map();
    for (const rv of revisions) {
      const arr = byDel.get(rv.DeliverableId) || [];
      arr.push(rv);
      byDel.set(rv.DeliverableId, arr);
    }
    res.json(engOk(req, engineeringProgress(
      deliverables.map((d) => ({ deliverable: d, revisions: byDel.get(d.Id) || [] })),
      asOf,
    ), { asOf }));
  } catch (err) { next(err); }
});

app.get("/api/eng/review/aging", async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return engBad(req, res, "E-ENG-NO-PROJECT", "پارامتر projectId الزامی است");
    const asOf = String(req.query.asOf || engToday());
    const { deliverables, revisions } = await engProjectRows(projectId);
    const delById = new Map(deliverables.map((d) => [d.Id, d]));
    const rows = reviewAging(revisions.filter((r) => r.Purpose === "IFA"), asOf, delById);
    res.json(engOk(req, {
      rows,
      overdue: rows.filter((r) => r.status === "overdue").length,
      dueSoon: rows.filter((r) => r.status === "due_soon").length,
    }, { asOf, count: rows.length }));
  } catch (err) { next(err); }
});

app.get("/api/eng/crs", async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return engBad(req, res, "E-ENG-NO-PROJECT", "پارامتر projectId الزامی است");
    const { comments } = await engProjectRows(projectId);
    const revisionId = req.query.revisionId ? String(req.query.revisionId) : null;
    const rows = revisionId ? comments.filter((c) => c.RevisionId === revisionId) : comments;
    res.json(engOk(req, { summary: crsSummary(rows), gate: crsGate(rows), items: rows }, { count: rows.length }));
  } catch (err) { next(err); }
});

app.get("/api/eng/idc", async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return engBad(req, res, "E-ENG-NO-PROJECT", "پارامتر projectId الزامی است");
    const asOf = String(req.query.asOf || engToday());
    const { checks, clashes } = await engProjectRows(projectId);
    res.json(engOk(req, { squadChecks: idcStatus(checks, asOf), clashes: clashSummary(clashes) }, { asOf }));
  } catch (err) { next(err); }
});

app.get("/api/eng/tq", async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return engBad(req, res, "E-ENG-NO-PROJECT", "پارامتر projectId الزامی است");
    const asOf = String(req.query.asOf || engToday());
    const { queries } = await engProjectRows(projectId);
    const kind = req.query.kind ? String(req.query.kind) : null;
    const rows = kind ? queries.filter((q) => q.Kind === kind) : queries;
    res.json(engOk(req, {
      aging: tqAging(rows, asOf),
      asBuilt: asBuiltStatus(rows),
      crPlan: planChangeRequests(rows),
      items: rows,
    }, { asOf, count: rows.length }));
  } catch (err) { next(err); }
});

app.get("/api/eng/vpr", async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return engBad(req, res, "E-ENG-NO-PROJECT", "پارامتر projectId الزامی است");
    const asOf = String(req.query.asOf || engToday());
    const { vendorDocs } = await engProjectRows(projectId);
    res.json(engOk(req, { summary: vprSummary(vendorDocs, asOf), items: vendorDocs }, { asOf, count: vendorDocs.length }));
  } catch (err) { next(err); }
});

app.get("/api/eng/kpi", async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return engBad(req, res, "E-ENG-NO-PROJECT", "پارامتر projectId الزامی است");
    const asOf = String(req.query.asOf || engToday());
    const rows = await engProjectRows(projectId);
    const byDel = new Map();
    for (const rv of rows.revisions) {
      const arr = byDel.get(rv.DeliverableId) || [];
      arr.push(rv);
      byDel.set(rv.DeliverableId, arr);
    }
    const progress = engineeringProgress(
      rows.deliverables.map((d) => ({ deliverable: d, revisions: byDel.get(d.Id) || [] })),
      asOf,
    );
    const delById = new Map(rows.deliverables.map((d) => [d.Id, d]));
    const aging = reviewAging(rows.revisions.filter((r) => r.Purpose === "IFA"), asOf, delById);
    const kpis = engineeringKpis({ progress, revisions: rows.revisions, aging, queries: rows.queries, deliverables: rows.deliverables, asOf });
    const r = await repo();
    const activities = await r.list("Activity", { where: [{ column: "ProjectId", op: "eq", value: projectId }], limit: 5000 });
    const lockPlan = planIfcLocks({
      activities,
      activityDocLinks: engActivityDocLinks(activities, rows.deliverables),
      deliverables: rows.deliverables,
      revisions: rows.revisions,
    });
    res.json(engOk(req, {
      kpis,
      alerts: engineeringAlerts({ aging, revisionsByDeliverable: byDel, queries: rows.queries, lockPlan, kpis, asOf }),
    }, { asOf }));
  } catch (err) { next(err); }
});

app.get("/api/eng/reports", (req, res) => {
  res.json(engOk(req, ENG_REPORT_CATALOG, { count: ENG_REPORT_CATALOG.length }));
});

app.get("/api/eng/reports/:code", async (req, res, next) => {
  try {
    const code = String(req.params.code || "").toUpperCase();
    const def = getEngReport(code);
    if (!def) return engBad(req, res, "E-ENG-RPT-CODE", `گزارش ${code} تعریف نشده`, 404);
    const projectId = String(req.query.projectId || "");
    if (!projectId) return engBad(req, res, "E-ENG-NO-PROJECT", "پارامتر projectId الزامی است");
    const audience = String(req.query.audience || "internal");
    if (!isAudienceAllowed(code, audience)) {
      return engBad(req, res, "E-ENG-RPT-AUDIENCE", `گزارش ${code} برای مخاطب ${audience} مجاز نیست`, 403);
    }
    const asOf = String(req.query.asOf || engToday());
    const rows = await engProjectRows(projectId);
    const byDel = new Map();
    for (const rv of rows.revisions) {
      const arr = byDel.get(rv.DeliverableId) || [];
      arr.push(rv);
      byDel.set(rv.DeliverableId, arr);
    }
    let payload;
    switch (code) {
      case "RPT-ENG-MDR":
        payload = {
          validation: validateMdr(rows.deliverables),
          rows: rows.deliverables.map((d) => {
            const p = deliverableProgress(byDel.get(d.Id) || []);
            return { docNo: d.DocNo, titleFa: d.TitleFa, disciplineFa: DISCIPLINE_FA[d.Discipline] || d.Discipline, weight: Number(d.PlannedWeight) || 0, pct: p.pct, step: p.step, targetIfc: d.TargetIfcDate };
          }),
        };
        break;
      case "RPT-ENG-CRS":
        payload = { summary: crsSummary(rows.comments), gate: crsGate(rows.comments), rows: rows.comments };
        break;
      case "RPT-ENG-TQF":
        payload = { aging: tqAging(rows.queries, asOf), crPlan: planChangeRequests(rows.queries), rows: rows.queries };
        break;
      case "RPT-ENG-PRG":
        payload = engineeringProgress(rows.deliverables.map((d) => ({ deliverable: d, revisions: byDel.get(d.Id) || [] })), asOf);
        break;
      case "RPT-ENG-VPR":
        payload = { summary: vprSummary(rows.vendorDocs, asOf), rows: rows.vendorDocs };
        break;
      case "RPT-ENG-IDC":
        payload = { squadChecks: idcStatus(rows.checks, asOf), clashes: clashSummary(rows.clashes), rows: rows.clashes };
        break;
      case "RPT-ENG-TRN":
        payload = {
          rows: rows.revisions.filter((r) => !!r.TransmittalId).map((r) => ({
            revCode: r.RevCode, purpose: r.Purpose, purposeFa: PURPOSE_FA[r.Purpose] || r.Purpose,
            issuedAt: r.IssuedAt, transmittalId: r.TransmittalId, reviewCode: r.ReviewCode,
            reviewCodeFa: r.ReviewCode ? REVIEW_CODE_FA[r.ReviewCode] : null,
          })),
        };
        break;
      default:
        payload = {};
    }
    res.json(engOk(req, { definition: def, audience, asOf, payload }));
  } catch (err) { next(err); }
});

/* ═══════════ D15: رندر گزارش A4 سه‌لوگو (G-ENG-01) ═══════════
 * موتور rpt-v1 بدنه را به HTML چاپی، Word، Excel و CSV تبدیل می‌کند.
 * ENG هیچ عددی نمی‌سازد؛ فقط بدنهٔ ساخته‌شده را به سریال‌ساز می‌دهد. */

const ENG_DEFAULT_LETTERHEAD = {
  projectName: "پروژه نمونه — واحد فرآورش گاز",
  projectCode: "OG-2401",
  contractNo: "C-1404-118",
  contractor: { name: "شرکت پیمانکار نمونه", logoText: "پیمانکار", role: { fa: "پیمانکار", en: "Contractor" } },
  client: { name: "شرکت کارفرمای نمونه", logoText: "کارفرما", role: { fa: "کارفرما", en: "Client" } },
  consultant: { name: "مهندسین مشاور نمونه", logoText: "مشاور", role: { fa: "مشاور", en: "Consultant" } },
  docNo: "",
  revision: "R00",
  issueDate: new Date().toISOString().slice(0, 10),
  periodLabel: "",
  classification: "confidential",
  distribution: ["مدیر پروژه", "مدیر مهندسی", "دفتر فنی"],
  preparedBy: "واحد مهندسی و طراحی",
  approvedBy: "مدیر مهندسی",
};

/** سربرگ از querystring یا بدنه با پیش‌فرض امن ادغام می‌شود. */
function engLetterhead(source = {}, reportCode = "RPT-ENG", seq = 1) {
  /* پارامتر آبجکت در querystring رشته است؛ spread کردن رشته کلید عددی می‌سازد
   * و بازنویسی بی‌اثر می‌شود. پس ابتدا JSON.parse و سپس بررسی نوع. */
  let override = source.letterhead ?? {};
  if (typeof override === "string") {
    try { override = JSON.parse(override); } catch { override = {}; }
  }
  if (typeof override !== "object" || override === null || Array.isArray(override)) override = {};

  const lh = { ...ENG_DEFAULT_LETTERHEAD, ...override };
  if (!lh.docNo) lh.docNo = documentNumber(lh.projectCode, reportCode, seq, Number(String(lh.revision).replace(/\D/g, "")) || 0);
  return lh;
}

const ENG_RENDER_FORMATS = new Set(["json", "html", "pdf", "word", "excel", "csv"]);

app.get("/api/eng/reports/:code/render", async (req, res, next) => {
  try {
    const code = String(req.params.code || "").toUpperCase();
    const meta = engReportMeta(code);
    if (!meta) return engBad(req, res, "E-ENG-RPT-CODE", `گزارش ${code} تعریف نشده`, 404);

    const projectId = String(req.query.projectId || "");
    if (!projectId) return engBad(req, res, "E-ENG-NO-PROJECT", "پارامتر projectId الزامی است");

    const audience = String(req.query.audience || "internal");
    if (!isAudienceAllowed(code, audience)) {
      return engBad(req, res, "E-ENG-RPT-AUDIENCE", `گزارش ${code} برای مخاطب ${audience} مجاز نیست`, 403);
    }

    const format = String(req.query.format || "html").toLowerCase();
    if (!ENG_RENDER_FORMATS.has(format)) {
      return engBad(req, res, "E-ENG-RPT-FORMAT", `قالب ${format} پشتیبانی نمی‌شود`, 400);
    }

    const lang = String(req.query.lang || "fa") === "en" ? "en" : "fa";
    const asOf = String(req.query.asOf || engToday());
    const rows = await engProjectRows(projectId);
    const r0 = await repo();

    /* گزارش مدیریتی «فعالیت متوقف» را گزارش می‌کند، پس به فعالیت‌ها و
     * پیوندشان با مدارک نیاز دارد. بقیهٔ گزارش‌ها از آن‌ها استفاده نمی‌کنند
     * ولی خواندنش ارزان است و مسیر را یکدست نگه می‌دارد. */
    const activities = await r0.list("Activity", {
      where: [{ column: "ProjectId", op: "eq", value: projectId }],
      limit: 5000,
    });
    const activityDocLinks = engActivityDocLinks(activities, rows.deliverables);

    const body = buildEngReport(code, {
      ...rows,
      activities,
      activityDocLinks,
      asOf,
      revisionId: req.query.revisionId ? String(req.query.revisionId) : null,
      transmittalId: req.query.transmittalId ? String(req.query.transmittalId) : null,
      periodLabel: req.query.periodLabel ? String(req.query.periodLabel) : undefined,
    });
    if (!body) return engBad(req, res, "E-ENG-RPT-CODE", `سازندهٔ گزارش ${code} یافت نشد`, 404);

    const lh = engLetterhead(req.query, code, Number(req.query.seq) || 1);
    if (req.query.periodLabel) lh.periodLabel = String(req.query.periodLabel);

    /* گزارش رسمی بدون سه لوگو، شماره سند و فهرست توزیع تولید نمی‌شود. */
    const issues = validateLetterhead(lh, audience);
    const blocking = issues.filter((i) => i.severity === "error");
    if (blocking.length > 0) {
      return res.status(409).json({
        ok: false,
        error: {
          code: "E-ENG-RPT-LETTERHEAD",
          message: `سربرگ برای مخاطب ${audience} ناقص است`,
          issues: blocking,
          traceId: req.requestId,
        },
      });
    }

    const fileBase = `${lh.docNo}-${code}`;
    if (format === "json") {
      return res.json(engOk(req, { report: body, letterhead: lh, audience, warnings: issues }, { asOf, format }));
    }
    if (format === "csv") {
      res.type("text/csv; charset=utf-8").set("content-disposition", `attachment; filename="${fileBase}.csv"`);
      return res.send("\uFEFF" + toCsv(body, lang));
    }
    if (format === "word") {
      res.type("application/msword; charset=utf-8").set("content-disposition", `attachment; filename="${fileBase}.doc"`);
      return res.send(toWordHtml(body, lh, audience, lang));
    }
    if (format === "excel") {
      res.type("application/vnd.ms-excel; charset=utf-8").set("content-disposition", `attachment; filename="${fileBase}.xls"`);
      return res.send(toExcelHtml(body, lh, lang));
    }
    /* html و pdf یک خروجی‌اند؛ PDF از مسیر چاپ مرورگر گرفته می‌شود (بدون وابستگی npm). */
    res.type("text/html; charset=utf-8").send(toPrintHtml(body, lh, audience, lang));
  } catch (err) { next(err); }
});

/* ═══════════ بستن شکاف‌های شناسایی‌شدهٔ سند تحویل نهایی ═══════════ */

/* شکاف ۲ (High): پوشش نگاشت فعالیت↔مدرک.
 * فعالیت بدون WbsId بی‌صدا از محافظ IFC عبور می‌کرد؛ حالا شمرده می‌شود. */
app.get("/api/eng/pex/lock-coverage", async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return engBad(req, res, "E-ENG-NO-PROJECT", "پارامتر projectId الزامی است");
    const r = await repo();
    const { deliverables } = await engProjectRows(projectId);
    const activities = await r.list("Activity", { where: [{ column: "ProjectId", op: "eq", value: projectId }], limit: 5000 });
    const coverage = ifcLockCoverage({
      activities,
      activityDocLinks: engActivityDocLinks(activities, deliverables),
      onlyNotStarted: String(req.query.includeStarted || "") !== "1",
    });
    res.json(engOk(req, coverage));
  } catch (err) { next(err); }
});

/* شکاف ۱ (High): تزریق شاخص مهندسی به KpiSnapshot تا داشبورد حاکمیتی ببیند.
 * جدول مقصد با کلید یکتای (ProjectId, KpiCode, PeriodCode) از قبل وجود دارد. */
app.post("/api/eng/mon/publish-kpi", engRequire("eng.mdr.edit"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return engBad(req, res, "E-ENG-NO-PROJECT", "پارامتر projectId الزامی است");
    const apply = String(req.query.apply || "") === "1";
    const asOf = String(req.query.asOf || engToday());
    const period = String(req.query.periodCode || periodCodeOf(asOf));
    const r = await repo();
    const rows = await engProjectRows(projectId);

    const byDel = engRevisionsByDeliverable(rows.revisions);
    const progress = engineeringProgress(
      rows.deliverables.map((d) => ({ deliverable: d, revisions: byDel.get(d.Id) || [] })),
      asOf,
    );
    const delById = new Map(rows.deliverables.map((d) => [d.Id, d]));
    const aging = reviewAging(rows.revisions.filter((x) => x.Purpose === "IFA"), asOf, delById);
    const kpis = engineeringKpis({ progress, revisions: rows.revisions, aging, queries: rows.queries, deliverables: rows.deliverables, asOf });

    const snapshots = engKpiSnapshots(kpis, projectId, period);
    let written = 0;
    if (apply) {
      const userId = req.headers["x-user-id"] || "system";
      for (const row of snapshots) {
        await r.upsert("KpiSnapshot", { ProjectId: projectId, KpiCode: row.KpiCode, PeriodCode: row.PeriodCode }, row, userId);
        written++;
      }
    }
    res.json(engOk(req, { dryRun: !apply, periodCode: period, snapshots, written }, { asOf }));
  } catch (err) { next(err); }
});

/* شکاف ۹ (Medium): snapshot دوره‌ای پیشرفت — پیش‌نیاز S-Curve.
 * سری زمانی گذشته بازسازی‌شدنی نیست، پس ثبت باید از همین حالا شروع شود. */
app.post("/api/eng/snapshot/progress", engRequire("eng.mdr.edit"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return engBad(req, res, "E-ENG-NO-PROJECT", "پارامتر projectId الزامی است");
    const apply = String(req.query.apply || "") === "1";
    const asOf = String(req.query.asOf || engToday());
    const period = String(req.query.periodCode || periodCodeOf(asOf));
    const r = await repo();
    const rows = await engProjectRows(projectId);

    const byDel = engRevisionsByDeliverable(rows.revisions);
    const progress = engineeringProgress(
      rows.deliverables.map((d) => ({ deliverable: d, revisions: byDel.get(d.Id) || [] })),
      asOf,
    );
    const snapshots = engProgressSnapshots({
      projectId,
      progress,
      deliverables: rows.deliverables,
      revisions: rows.revisions,
      comments: rows.comments,
      asOf,
      periodCode: period,
    });

    let written = 0;
    if (apply) {
      const userId = req.headers["x-user-id"] || "system";
      for (const row of snapshots) {
        await r.upsert("EngineeringProgressSnapshot", { ProjectId: projectId, PeriodCode: row.PeriodCode, Discipline: row.Discipline }, row, userId);
        written++;
      }
    }
    res.json(engOk(req, { dryRun: !apply, periodCode: period, snapshots, written }, { asOf }));
  } catch (err) { next(err); }
});

/* شکاف ۹ ادامه: سری زمانی برای رسم S-Curve از snapshotهای ثبت‌شده. */
app.get("/api/eng/progress/series", async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return engBad(req, res, "E-ENG-NO-PROJECT", "پارامتر projectId الزامی است");
    const discipline = String(req.query.discipline || "ALL");
    const r = await repo();
    const all = await r.list("EngineeringProgressSnapshot", {
      where: [{ column: "ProjectId", op: "eq", value: projectId }],
      limit: 5000,
    });
    const series = all
      .filter((x) => x.Discipline === discipline)
      .sort((a, b) => String(a.PeriodCode).localeCompare(String(b.PeriodCode)))
      .map((x) => ({
        periodCode: x.PeriodCode,
        plannedPct: x.PlannedPct,
        actualPct: x.ActualPct,
        spiEng: x.SpiEng,
        ifcIssued: x.IfcIssuedCount,
        openComments: x.OpenCommentCount,
      }));
    res.json(engOk(req, { discipline, points: series.length, series }));
  } catch (err) { next(err); }
});

/* شکاف ۴ (High): تأخیر بررسی کارفرما → پیش‌نویس ادعای EOT.
 * ADR-ENG-11: فقط پیش‌نویس؛ ثبت ادعا علیه کارفرما تصمیم حقوقی است. */
app.post("/api/eng/rcc/draft-eot", engRequire("eng.ifc.release"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return engBad(req, res, "E-ENG-NO-PROJECT", "پارامتر projectId الزامی است");
    const apply = String(req.query.apply || "") === "1";
    const asOf = String(req.query.asOf || engToday());
    const minOverdueDays = Number(req.query.minOverdueDays) || undefined;
    const r = await repo();
    const rows = await engProjectRows(projectId);

    const delById = new Map(rows.deliverables.map((d) => [d.Id, d]));
    const aging = reviewAging(rows.revisions.filter((x) => x.Purpose === "IFA"), asOf, delById);
    const plan = planEotClaims({ aging, deliverableById: delById, minOverdueDays });

    const created = [];
    if (apply) {
      const userId = req.headers["x-user-id"] || "system";
      for (const d of plan.drafts) {
        const claim = await r.upsert("Claim", { ProjectId: projectId, Code: d.code }, {
          ProjectId: projectId,
          Code: d.code,
          TitleFa: d.titleFa,
          NoticeDate: d.noticeDate,
          ExtensionDays: d.extensionDays,
          Status: "draft",
          TimeBarred: false,
        }, userId);
        created.push({ code: d.code, id: claim?.Id ?? null });
      }
    }
    res.json(engOk(req, { dryRun: !apply, plan, created }, { asOf }));
  } catch (err) { next(err); }
});

/* شکاف ۵ (Medium): Design NCR از QMS → پیش‌نویس اصلاح مدرک (DCN).
 * ADR-ENG-12: منبع حقیقت عدم‌انطباق نزد QMS می‌ماند. */
app.post("/api/eng/qms/draft-dcn", engRequire("eng.crs.resolve"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return engBad(req, res, "E-ENG-NO-PROJECT", "پارامتر projectId الزامی است");
    const apply = String(req.query.apply || "") === "1";
    const r = await repo();
    const rows = await engProjectRows(projectId);
    const ncrs = await r.list("Ncr", { where: [{ column: "ProjectId", op: "eq", value: projectId }], limit: 5000 });

    const plan = planDesignNcrActions({ ncrs, deliverables: rows.deliverables, existingQueries: rows.queries });

    const created = [];
    if (apply) {
      const userId = req.headers["x-user-id"] || "system";
      for (const d of plan.drafts) {
        const tq = await r.upsert("TechnicalQuery", { ProjectId: projectId, Code: d.code }, {
          ProjectId: projectId,
          Code: d.code,
          Kind: "DCN",
          TitleFa: d.titleFa,
          Discipline: d.discipline,
          RaisedBy: userId,
          RaisedAt: d.raisedAt,
          DeliverableId: d.deliverableId,
          DueAt: d.dueAt,
          Status: "open",
        }, userId);
        created.push({ code: d.code, id: tq?.Id ?? null, deliverableId: d.deliverableId });
      }
    }
    res.json(engOk(req, { dryRun: !apply, plan, created }));
  } catch (err) { next(err); }
});

/* شکاف ۷ (Medium): اعتبارسنجی ارجاع PoNo — کلید نرم FK ندارد. */
app.get("/api/eng/vpr/po-audit", async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return engBad(req, res, "E-ENG-NO-PROJECT", "پارامتر projectId الزامی است");
    const r = await repo();
    const { vendorDocs } = await engProjectRows(projectId);

    /* هیچ دفتر سفارش خریدی در اسکیما وجود ندارد: d5 فقط CostAccount و
     * PaymentCertificate دارد و «کد حساب هزینه» شمارهٔ سفارش نیست. گرفتن آن
     * به‌جای دفتر PO هر ارجاع درست را «یتیم» نشان می‌داد — هشدار کاذبی که
     * کاربر را به بی‌اعتمادی به کل گزارش می‌کشاند.
     *
     * پس تا ساخته‌شدن دفتر سفارش در FIN، مرجع فقط از بیرون پذیرفته می‌شود
     * و در نبودش صرفاً «نبود ارجاع» گزارش می‌گردد. */
    /* دفتر سفارش خرید اکنون در d5 وجود دارد (مهاجرت 0009)، پس مرجع واقعی
     * خوانده می‌شود. پارامتر دستی برای آزمون و سناریوی مهاجرت باقی می‌ماند. */
    const poParam = req.query.knownPoNumbers;
    let knownPoNumbers = poParam
      ? String(poParam).split(",").map((x) => x.trim()).filter(Boolean)
      : null;
    if (!knownPoNumbers) {
      const orders = await r.list("PurchaseOrder", { where: [{ column: "ProjectId", op: "eq", value: projectId }], limit: 5000 });
      if (orders.length > 0) knownPoNumbers = poRegistry(orders);
    }

    res.json(engOk(req, {
      ...auditVendorPoRefs({ vendorDocs, knownPoNumbers }),
      registryAvailable: knownPoNumbers !== null,
      noteFa: knownPoNumbers === null
        ? "دفتر سفارش خرید در دسترس نیست؛ فقط نبود ارجاع بررسی شد و صحت شماره‌ها سنجیده نشده است"
        : `صحت ارجاع در برابر ${knownPoNumbers.length} سفارش معتبر سنجیده شد`,
    }));
  } catch (err) { next(err); }
});

/* شکاف ۱۱ (Medium): پرکردن Activity.RocCode تا پیشرفت به زمان‌بندی بچسبد. */
app.post("/api/eng/pex/backfill-roc", engRequire("eng.mdr.edit"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return engBad(req, res, "E-ENG-NO-PROJECT", "پارامتر projectId الزامی است");
    const apply = String(req.query.apply || "") === "1";
    const r = await repo();
    const { deliverables, revisions } = await engProjectRows(projectId);
    const activities = await r.list("Activity", { where: [{ column: "ProjectId", op: "eq", value: projectId }], limit: 5000 });

    const plan = planRocBackfill({
      activities,
      activityDocLinks: engActivityDocLinks(activities, deliverables),
      deliverables,
      revisions,
    });

    let written = 0;
    if (apply) {
      const userId = req.headers["x-user-id"] || "system";
      for (const row of plan.rows) {
        await r.patch("Activity", row.activityId, { RocCode: row.suggestedRocCode }, userId);
        written++;
      }
    }
    res.json(engOk(req, { dryRun: !apply, ...plan, written }));
  } catch (err) { next(err); }
});

/* ═══════════ ورود داده: چهار موجودیت اصلی ═══════════
 * تا پیش از این ثبت فقط از راه اکسل یا نوشتن مستقیم در پایگاه داده ممکن
 * بود. اعتبارسنجی اینجا انجام می‌شود نه در مرورگر: مرورگر قابل دور زدن
 * است و همین اندپوینت‌ها از اسکریپت و ابزار دیگر هم صدا زده می‌شوند. */

/** بدنهٔ درخواست را می‌خواند؛ رشتهٔ JSON را هم می‌پذیرد. */
function engBody(req) {
  const b = req.body;
  if (typeof b === "string") {
    try { return JSON.parse(b); } catch { return {}; }
  }
  return b && typeof b === "object" ? b : {};
}

/** خطای اعتبارسنجی با فهرست کامل ایرادها — نه فقط اولین مورد. */
function engInvalid(req, res, issues) {
  return res.status(422).json({
    ok: false,
    error: {
      code: "E-ENG-VALIDATION",
      message: `ورودی نامعتبر است (${issues.length} ایراد)`,
      issues,
      traceId: req.requestId,
    },
  });
}

const ENG_ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** بررسی‌های مشترک: اجباری بودن، عدد، تاریخ، فهرست مجاز. */
function engValidate(body, rules) {
  const issues = [];
  for (const r of rules) {
    const v = body[r.field];
    const empty = v === undefined || v === null || String(v).trim() === "";

    if (r.required && empty) {
      issues.push({ field: r.field, code: "REQUIRED", messageFa: `${r.titleFa} الزامی است` });
      continue;
    }
    if (empty) continue;

    if (r.type === "number") {
      const n = Number(v);
      if (!Number.isFinite(n)) {
        issues.push({ field: r.field, code: "NOT_NUMBER", messageFa: `${r.titleFa} باید عدد باشد` });
      } else if (r.min !== undefined && n < r.min) {
        issues.push({ field: r.field, code: "TOO_SMALL", messageFa: `${r.titleFa} نباید کمتر از ${r.min} باشد` });
      } else if (r.max !== undefined && n > r.max) {
        issues.push({ field: r.field, code: "TOO_LARGE", messageFa: `${r.titleFa} نباید بیشتر از ${r.max} باشد` });
      }
    }
    if (r.type === "date" && !ENG_ISO_DATE.test(String(v))) {
      issues.push({ field: r.field, code: "BAD_DATE", messageFa: `${r.titleFa} باید قالب ۱۴۰۵-۰۱-۰۱ میلادی داشته باشد` });
    }
    if (r.oneOf && !r.oneOf.includes(String(v))) {
      issues.push({ field: r.field, code: "NOT_ALLOWED", messageFa: `${r.titleFa} باید یکی از این‌ها باشد: ${r.oneOf.join("، ")}` });
    }
    if (r.maxLen && String(v).length > r.maxLen) {
      issues.push({ field: r.field, code: "TOO_LONG", messageFa: `${r.titleFa} از ${r.maxLen} نویسه بیشتر است` });
    }
  }
  return issues;
}

/* ── فرم ۱: ثبت مدرک در فهرست ── */
app.post("/api/eng/mdr", engRequire("eng.mdr.edit"), async (req, res, next) => {
  try {
    const b = engBody(req);
    const projectId = String(req.query.projectId || b.projectId || "");
    if (!projectId) return engBad(req, res, "E-ENG-NO-PROJECT", "پارامتر projectId الزامی است");

    const issues = engValidate(b, [
      { field: "docNo", titleFa: "شمارهٔ مدرک", required: true, maxLen: 80 },
      { field: "titleFa", titleFa: "عنوان مدرک", required: true, maxLen: 400 },
      { field: "discipline", titleFa: "دیسیپلین", required: true, oneOf: DISCIPLINES },
      { field: "docType", titleFa: "نوع مدرک", required: true, maxLen: 40 },
      { field: "plannedWeight", titleFa: "وزن برنامه‌ای", required: true, type: "number", min: 0, max: 100 },
      { field: "targetIfaDate", titleFa: "تاریخ هدف ارسال", type: "date" },
      { field: "targetIfcDate", titleFa: "تاریخ هدف صدور", type: "date" },
      { field: "estimatedManhours", titleFa: "نفرساعت برآوردی", type: "number", min: 0 },
    ]);

    /* تاریخ صدور پیش از تاریخ ارسال یعنی زنجیرهٔ مدرک وارونه است. */
    if (b.targetIfaDate && b.targetIfcDate && String(b.targetIfcDate) < String(b.targetIfaDate)) {
      issues.push({ field: "targetIfcDate", code: "BEFORE_IFA", messageFa: "تاریخ هدف صدور نمی‌تواند پیش از تاریخ ارسال باشد" });
    }
    if (issues.length) return engInvalid(req, res, issues);

    const r = await repo();
    const userId = req.headers["x-user-id"] || "system";
    const docNo = String(b.docNo).trim();

    const dup = await r.findOne("MdrDeliverable", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "DocNo", op: "eq", value: docNo },
    ]);
    if (dup && !b.allowUpdate) {
      return res.status(409).json({
        ok: false,
        error: { code: "E-ENG-DUP-DOCNO", message: `مدرک ${docNo} از قبل ثبت شده است`, traceId: req.requestId },
      });
    }

    const up = await r.upsert("MdrDeliverable", { ProjectId: projectId, DocNo: docNo }, {
      ProjectId: projectId,
      DocNo: docNo,
      TitleFa: String(b.titleFa).trim(),
      TitleEn: b.titleEn ? String(b.titleEn).trim() : null,
      Discipline: String(b.discipline),
      DocType: String(b.docType),
      PlannedWeight: Number(b.plannedWeight),
      EstimatedManhours: b.estimatedManhours != null ? Number(b.estimatedManhours) : null,
      WbsId: b.wbsId ? String(b.wbsId) : null,
      TargetIfaDate: b.targetIfaDate || null,
      TargetIfcDate: b.targetIfcDate || null,
      Status: b.status || "planned",
      CriticalityLevel: b.criticalityLevel || null,
      ContractReviewDays: b.contractReviewDays != null ? Number(b.contractReviewDays) : null,
      RemarksFa: b.remarksFa || null,
    }, userId);

    /* هشدار وزن: مانع ثبت نمی‌شود ولی کاربر باید بداند جمع از ۱۰۰ گذشت. */
    const all = await r.list("MdrDeliverable", { where: [{ column: "ProjectId", op: "eq", value: projectId }], limit: 5000 });
    const totalWeight = all.reduce((sum, d) => sum + Number(d.PlannedWeight || 0), 0);

    res.status(dup ? 200 : 201).json(engOk(req, {
      created: up.action === "insert",
      item: up.row,
      totalWeight: Math.round(totalWeight * 100) / 100,
      weightWarningFa: Math.abs(totalWeight - 100) > 0.01
        ? `جمع وزن مدارک ${Math.round(totalWeight * 100) / 100} است، نه ۱۰۰`
        : null,
    }));
  } catch (err) { next(err); }
});

/* ── فرم ۲: صدور ریویژن ── */
app.post("/api/eng/revision", engRequire("eng.revision.issue"), async (req, res, next) => {
  try {
    const b = engBody(req);
    const projectId = String(req.query.projectId || b.projectId || "");
    if (!projectId) return engBad(req, res, "E-ENG-NO-PROJECT", "پارامتر projectId الزامی است");

    const issues = engValidate(b, [
      { field: "deliverableId", titleFa: "مدرک", required: true },
      { field: "revCode", titleFa: "کد ریویژن", required: true, maxLen: 10 },
      { field: "purpose", titleFa: "هدف صدور", required: true, oneOf: ["DRAFT", "IDC", "IFA", "IFC", "ASBUILT"] },
      { field: "issuedAt", titleFa: "تاریخ صدور", required: true, type: "date" },
      { field: "idcCompletedAt", titleFa: "تاریخ اتمام بررسی گروهی", type: "date" },
    ]);
    if (issues.length) return engInvalid(req, res, issues);

    const r = await repo();
    const userId = req.headers["x-user-id"] || "system";
    const del = await r.get("MdrDeliverable", String(b.deliverableId));
    if (!del || del.ProjectId !== projectId) {
      return engBad(req, res, "E-ENG-NO-DELIVERABLE", `مدرک ${b.deliverableId} در این پروژه یافت نشد`, 404);
    }

    /* ADR-ENG-03: پلهٔ IFC و چون‌ساخت بدون فایل مدرک باز نمی‌شود. صدور
     * بدون DocumentId مجاز است ولی پیشرفت را جلو نمی‌برد، پس صریح هشدار
     * می‌دهیم تا کاربر گمان نکند ۹۵٪ گرفته است. */
    const purpose = String(b.purpose);
    const needsDoc = purpose === "IFC" || purpose === "ASBUILT";
    if (needsDoc && !b.documentId) {
      issues.push({ field: "documentId", code: "DOC_REQUIRED", messageFa: `صدور با هدف ${purpose} بدون شناسهٔ فایل مدرک، پیشرفت را باز نمی‌کند` });
      return engInvalid(req, res, issues);
    }

    const up = await r.upsert("EngineeringRevision", { DeliverableId: String(b.deliverableId), RevCode: String(b.revCode) }, {
      ProjectId: projectId,
      DeliverableId: String(b.deliverableId),
      RevCode: String(b.revCode),
      Purpose: purpose,
      IssuedAt: String(b.issuedAt),
      IdcCompletedAt: b.idcCompletedAt || null,
      DocumentId: b.documentId ? String(b.documentId) : null,
      IssuedBy: b.issuedBy ? String(b.issuedBy) : String(userId),
      TransmittalId: b.transmittalId ? String(b.transmittalId) : null,
      ReviewDueAt: b.reviewDueAt || null,
      Status: b.status || "issued",
    }, userId);

    const revs = await r.list("EngineeringRevision", { where: [{ column: "DeliverableId", op: "eq", value: String(b.deliverableId) }], limit: 500 });
    const prog = deliverableProgress(revs);

    res.status(201).json(engOk(req, {
      item: up.row,
      progress: { pct: prog.pct, step: prog.step },
      noteFa: `پیشرفت مدرک ${del.DocNo} اکنون ${prog.pct}٪ (پلهٔ ${prog.step}) است`,
    }));
  } catch (err) { next(err); }
});

/* ── فرم ۳: ثبت نظر در شیت بررسی ── */
app.post("/api/eng/crs", engRequire("eng.crs.comment"), async (req, res, next) => {
  try {
    const b = engBody(req);
    const projectId = String(req.query.projectId || b.projectId || "");
    if (!projectId) return engBad(req, res, "E-ENG-NO-PROJECT", "پارامتر projectId الزامی است");

    const issues = engValidate(b, [
      { field: "revisionId", titleFa: "ریویژن", required: true },
      { field: "commentText", titleFa: "متن نظر", required: true, maxLen: 2000 },
      { field: "severity", titleFa: "شدت", required: true, oneOf: ["editorial", "minor", "major", "critical"] },
      { field: "raisedAt", titleFa: "تاریخ ثبت", required: true, type: "date" },
      { field: "commentNo", titleFa: "شمارهٔ نظر", type: "number", min: 1 },
    ]);
    if (issues.length) return engInvalid(req, res, issues);

    const r = await repo();
    const userId = req.headers["x-user-id"] || "system";
    const rev = await r.get("EngineeringRevision", String(b.revisionId));
    if (!rev || rev.ProjectId !== projectId) {
      return engBad(req, res, "E-ENG-NO-REVISION", `ریویژن ${b.revisionId} یافت نشد`, 404);
    }

    /* شمارهٔ نظر در نبود ورودی خودکار تولید می‌شود تا کاربر مجبور به
     * شمردن دستی نباشد — منبع خطای رایج در شیت‌های اکسل. */
    const existing = await r.list("CrsComment", { where: [{ column: "RevisionId", op: "eq", value: String(b.revisionId) }], limit: 1000 });
    const commentNo = b.commentNo != null
      ? Number(b.commentNo)
      : existing.reduce((mx, c) => Math.max(mx, Number(c.CommentNo || 0)), 0) + 1;

    const up = await r.upsert("CrsComment", { RevisionId: String(b.revisionId), CommentNo: commentNo }, {
      ProjectId: projectId,
      RevisionId: String(b.revisionId),
      CommentNo: commentNo,
      RaisedBy: b.raisedBy ? String(b.raisedBy) : String(userId),
      RaisedAt: String(b.raisedAt),
      Severity: String(b.severity),
      CommentText: String(b.commentText).trim(),
      Discipline: b.discipline ? String(b.discipline) : null,
      ResponseStatus: "open",
    }, userId);

    const all = await r.list("CrsComment", { where: [{ column: "RevisionId", op: "eq", value: String(b.revisionId) }], limit: 1000 });
    const gate = crsGate(all);

    res.status(201).json(engOk(req, {
      item: up.row,
      commentNo,
      gate,
      noteFa: gate.passed
        ? "همهٔ نظرها بسته است"
        : `${gate.blockers.length} مانع برای صدور IFC: ${gate.blockers.map((x) => x.messageFa).join("، ")}`,
    }));
  } catch (err) { next(err); }
});

/* ── فرم ۴: ثبت استعلام فنی و تغییر کارگاهی ── */
app.post("/api/eng/tq", engRequire("eng.tq.raise"), async (req, res, next) => {
  try {
    const b = engBody(req);
    const projectId = String(req.query.projectId || b.projectId || "");
    if (!projectId) return engBad(req, res, "E-ENG-NO-PROJECT", "پارامتر projectId الزامی است");

    const issues = engValidate(b, [
      { field: "code", titleFa: "کد استعلام", required: true, maxLen: 40 },
      { field: "kind", titleFa: "نوع", required: true, oneOf: ["TQ", "FCR", "DCN"] },
      { field: "titleFa", titleFa: "عنوان", required: true, maxLen: 400 },
      { field: "discipline", titleFa: "دیسیپلین", required: true, oneOf: DISCIPLINES },
      { field: "raisedAt", titleFa: "تاریخ طرح", required: true, type: "date" },
      { field: "dueAt", titleFa: "مهلت پاسخ", type: "date" },
      { field: "costImpact", titleFa: "اثر هزینه", type: "number" },
      { field: "timeImpactDays", titleFa: "اثر زمان (روز)", type: "number" },
    ]);
    if (issues.length) return engInvalid(req, res, issues);

    const r = await repo();
    const userId = req.headers["x-user-id"] || "system";
    const code = String(b.code).trim();

    const dup = await r.findOne("TechnicalQuery", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "Code", op: "eq", value: code },
    ]);
    if (dup && !b.allowUpdate) {
      return res.status(409).json({
        ok: false,
        error: { code: "E-ENG-DUP-TQ", message: `استعلام ${code} از قبل ثبت شده است`, traceId: req.requestId },
      });
    }

    const costImpact = b.costImpact != null ? Number(b.costImpact) : null;
    const timeImpact = b.timeImpactDays != null ? Number(b.timeImpactDays) : null;

    const up = await r.upsert("TechnicalQuery", { ProjectId: projectId, Code: code }, {
      ProjectId: projectId,
      Code: code,
      Kind: String(b.kind),
      TitleFa: String(b.titleFa).trim(),
      Discipline: String(b.discipline),
      RaisedBy: b.raisedBy ? String(b.raisedBy) : String(userId),
      RaisedAt: String(b.raisedAt),
      DeliverableId: b.deliverableId ? String(b.deliverableId) : null,
      DueAt: b.dueAt || null,
      Status: b.status || "open",
      CostImpact: costImpact,
      TimeImpactDays: timeImpact,
    }, userId);

    /* استعلام دارای اثر زمان یا هزینه، نامزد درخواست تغییر است — ADR-ENG-06. */
    const hasImpact = (costImpact ?? 0) !== 0 || (timeImpact ?? 0) !== 0;

    res.status(dup ? 200 : 201).json(engOk(req, {
      created: up.action === "insert",
      item: up.row,
      hasImpact,
      noteFa: hasImpact
        ? "این استعلام اثر زمان یا هزینه دارد و نامزد پیش‌نویس درخواست تغییر است"
        : "بدون اثر زمان و هزینه؛ درخواست تغییر ساخته نمی‌شود",
    }));
  } catch (err) { next(err); }
});

/* ═══════════ شکاف ۳: چرخهٔ تدارکات MR → PR → PO ═══════════
 * ADR-ENG-14: MR نزد مهندسی (منشأ آن مدرک IFC است)، PR و PO نزد مالی
 * (کنترل بودجه و تعهد مالی آنجاست). پیوند با کلید نرم. */

/** درخواست‌های کالای پروژه به‌همراه فعالیت‌ها و پیوندشان. */
async function engProcurementRows(projectId) {
  const r = await repo();
  const [requests, deliverables, revisions, activities] = await Promise.all([
    r.list("MaterialRequest", { where: [{ column: "ProjectId", op: "eq", value: projectId }], limit: 5000 }),
    r.list("MdrDeliverable", { where: [{ column: "ProjectId", op: "eq", value: projectId }], limit: 5000 }),
    r.list("EngineeringRevision", { where: [{ column: "ProjectId", op: "eq", value: projectId }], limit: 5000 }),
    r.list("Activity", { where: [{ column: "ProjectId", op: "eq", value: projectId }], limit: 5000 }),
  ]);
  return { r, requests, deliverables, revisions, activities };
}

/* فهرست و وضعیت درخواست‌های کالا، با هشدار پنجرهٔ سفارش. */
app.get("/api/eng/mr", async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return engBad(req, res, "E-ENG-NO-PROJECT", "پارامتر projectId الزامی است");
    const asOf = String(req.query.asOf || engToday());
    const { requests } = await engProcurementRows(projectId);
    const alerts = procurementAlerts({ requests, asOf, warnDays: Number(req.query.warnDays) || undefined });

    const byStatus = {};
    for (const m of requests) byStatus[m.Status] = (byStatus[m.Status] || 0) + 1;

    res.json(engOk(req, {
      items: requests.map((m) => ({
        code: m.Code,
        titleFa: m.TitleFa,
        discipline: m.Discipline,
        docNo: m.DocNo,
        needByDate: m.NeedByDate,
        releaseByDate: m.ReleaseByDate,
        leadTimeDays: m.LeadTimeDays,
        status: m.Status,
        linkedPrCode: m.LinkedPrCode ?? null,
      })),
      summary: {
        total: requests.length,
        byStatus,
        awaitingPr: requests.filter((m) => !m.LinkedPrCode && m.Status !== "cancelled").length,
        windowClosed: alerts.filter((a) => a.slackDays < 0).length,
      },
      alerts,
    }, { asOf }));
  } catch (err) { next(err); }
});

/* از مدارک IFC-شده پیش‌نویس درخواست کالا می‌سازد — ADR-ENG-15. */
app.post("/api/eng/fin/draft-mr", engRequire("eng.mr.raise"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return engBad(req, res, "E-ENG-NO-PROJECT", "پارامتر projectId الزامی است");
    const apply = String(req.query.apply || "") === "1";
    const { r, requests, deliverables, revisions, activities } = await engProcurementRows(projectId);

    const plan = planMaterialRequests({
      deliverables,
      revisions,
      activities,
      activityDocLinks: engActivityDocLinks(activities, deliverables),
      existingRequests: requests,
      bufferDays: Number(req.query.bufferDays) || undefined,
    });

    const created = [];
    if (apply) {
      const userId = req.headers["x-user-id"] || "system";
      for (const d of plan.drafts) {
        const row = await r.upsert("MaterialRequest", { ProjectId: projectId, Code: d.code }, {
          ProjectId: projectId,
          Code: d.code,
          TitleFa: d.titleFa,
          Discipline: d.discipline,
          DeliverableId: d.deliverableId,
          DocNo: d.docNo,
          LeadTimeDays: d.leadTimeDays,
          NeedByDate: d.needByDate,
          ReleaseByDate: d.releaseByDate,
          RaisedBy: userId,
          RaisedAt: d.raisedAt,
          Status: "draft",
        }, userId);
        created.push({ code: d.code, id: row?.Id ?? null });
      }
    }
    res.json(engOk(req, { dryRun: !apply, plan, created }));
  } catch (err) { next(err); }
});

/* از درخواست‌های کالای تأییدشده، پیش‌نویس درخواست خرید در d5 می‌سازد.
 * کنترل بودجه مشورتی است: ENG مالک بودجه نیست و خرید را وتو نمی‌کند. */
app.post("/api/eng/fin/draft-pr", engRequire("eng.mr.approve"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return engBad(req, res, "E-ENG-NO-PROJECT", "پارامتر projectId الزامی است");
    const apply = String(req.query.apply || "") === "1";
    const r = await repo();
    const [requests, existingPrs, accounts] = await Promise.all([
      r.list("MaterialRequest", { where: [{ column: "ProjectId", op: "eq", value: projectId }], limit: 5000 }),
      r.list("PurchaseRequisition", { where: [{ column: "ProjectId", op: "eq", value: projectId }], limit: 5000 }),
      r.list("CostAccount", { where: [{ column: "ProjectId", op: "eq", value: projectId }], limit: 5000 }),
    ]);

    /* باقیماندهٔ بودجه از حساب‌های هزینهٔ d5؛ نبودش یعنی کنترل انجام نمی‌شود
     * و وضعیت unknown می‌ماند — نه ok جعلی. */
    const budgetRemaining = {};
    for (const a of accounts) {
      budgetRemaining[String(a.Code)] = Number(a.Budget || 0) - Number(a.Committed || 0) - Number(a.Actual || 0);
    }

    let estimates = {};
    if (req.query.estimates) {
      try { estimates = JSON.parse(String(req.query.estimates)); } catch { estimates = {}; }
    }
    let costAccountByDiscipline = {};
    if (req.query.costAccounts) {
      try { costAccountByDiscipline = JSON.parse(String(req.query.costAccounts)); } catch { costAccountByDiscipline = {}; }
    }

    const plan = planPurchaseRequisitions({
      requests,
      existingPrCodes: existingPrs.map((p) => p.Code),
      estimates,
      costAccountByDiscipline,
      budgetRemaining,
    });

    const created = [];
    if (apply) {
      const userId = req.headers["x-user-id"] || "system";
      for (const d of plan.drafts) {
        const row = await r.upsert("PurchaseRequisition", { ProjectId: projectId, Code: d.code }, {
          ProjectId: projectId,
          Code: d.code,
          MrCode: d.mrCode,
          TitleFa: d.titleFa,
          Discipline: d.discipline,
          RequestedBy: userId,
          RequestedAt: d.requestedAt,
          NeedByDate: d.needByDate,
          EstimatedAmount: d.estimatedAmount,
          CostAccountCode: d.costAccountCode,
          BudgetStatus: d.budgetStatus,
          Status: "draft",
        }, userId);
        /* پیوند برگشتی روی MR تا اجرای بعدی همان درخواست را دوباره نبرد. */
        const mr = requests.find((m) => m.Code === d.mrCode);
        if (mr) await r.patch("MaterialRequest", mr.Id, { LinkedPrCode: d.code }, userId);
        created.push({ code: d.code, id: row?.Id ?? null, mrCode: d.mrCode });
      }
    }
    res.json(engOk(req, { dryRun: !apply, plan, created }));
  } catch (err) { next(err); }
});

/* زنجیرهٔ کامل مدرک → کالا → خرید → سفارش، برای ردیابی سرتاسری. */
app.get("/api/eng/procurement/chain", async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return engBad(req, res, "E-ENG-NO-PROJECT", "پارامتر projectId الزامی است");
    const r = await repo();
    const [requests, prs, pos, vendorDocs] = await Promise.all([
      r.list("MaterialRequest", { where: [{ column: "ProjectId", op: "eq", value: projectId }], limit: 5000 }),
      r.list("PurchaseRequisition", { where: [{ column: "ProjectId", op: "eq", value: projectId }], limit: 5000 }),
      r.list("PurchaseOrder", { where: [{ column: "ProjectId", op: "eq", value: projectId }], limit: 5000 }),
      r.list("VendorPrintReview", { where: [{ column: "ProjectId", op: "eq", value: projectId }], limit: 5000 }),
    ]);

    const prByMr = new Map(prs.filter((p) => p.MrCode).map((p) => [p.MrCode, p]));
    const poByPr = new Map(pos.filter((o) => o.PrCode).map((o) => [o.PrCode, o]));
    const vprByPo = new Map();
    for (const v of vendorDocs) {
      if (!v.PoNo) continue;
      const arr = vprByPo.get(v.PoNo) || [];
      arr.push(v.VendorDocNo);
      vprByPo.set(v.PoNo, arr);
    }

    const chain = requests.map((m) => {
      const pr = prByMr.get(m.Code) ?? null;
      const po = pr ? poByPr.get(pr.Code) ?? null : null;
      return {
        docNo: m.DocNo,
        mrCode: m.Code,
        mrStatus: m.Status,
        prCode: pr?.Code ?? null,
        prStatus: pr?.Status ?? null,
        budgetStatus: pr?.BudgetStatus ?? null,
        poNo: po?.PoNo ?? null,
        poStatus: po?.Status ?? null,
        vendorDocs: po ? vprByPo.get(po.PoNo) ?? [] : [],
        /* حلقهٔ کامل: مدرک مهندسی → کالا → خرید → سفارش → مدرک سازنده. */
        closedLoop: !!(pr && po && (vprByPo.get(po.PoNo) ?? []).length > 0),
      };
    });

    res.json(engOk(req, {
      chain,
      summary: {
        materialRequests: requests.length,
        withPr: chain.filter((c) => c.prCode).length,
        withPo: chain.filter((c) => c.poNo).length,
        closedLoop: chain.filter((c) => c.closedLoop).length,
        purchaseOrders: pos.length,
      },
    }));
  } catch (err) { next(err); }
});

/* اتصال ENG ↔ PEX: قفل فعالیت ساخت تا صدور IFC — ADR-ENG-04/05.
 * پیش‌فرض dry-run؛ نوشتن فقط با apply=1 (الگوی اثبات‌شدهٔ G-01 در EQP). */
app.post("/api/eng/pex/sync-ifc-locks", engRequire("eng.ifc.release"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return engBad(req, res, "E-ENG-NO-PROJECT", "پارامتر projectId الزامی است");
    const apply = String(req.query.apply || "") === "1";
    const r = await repo();
    const { deliverables, revisions } = await engProjectRows(projectId);
    const activities = await r.list("Activity", { where: [{ column: "ProjectId", op: "eq", value: projectId }], limit: 5000 });
    const plan = planIfcLocks({
      activities,
      activityDocLinks: engActivityDocLinks(activities, deliverables),
      deliverables,
      revisions,
    });
    let locked = 0;
    let released = 0;
    if (apply) {
      const userId = req.headers["x-user-id"] || "system";
      for (const l of plan.lock) {
        await r.patch("Activity", l.activityId, { BlockedByDocumentId: l.documentId }, userId);
        locked++;
      }
      for (const rl of plan.release) {
        await r.patch("Activity", rl.activityId, { BlockedByDocumentId: null }, userId);
        released++;
      }
    }
    res.json(engOk(req, { dryRun: !apply, plan, locked, released }));
  } catch (err) { next(err); }
});

/* اتصال ENG ↔ RCC: پیش‌نویس CR از TQ/FCR اثرگذار — ADR-ENG-06.
 * ایدمپوتنت: استعلامی که LinkedCrCode دارد دوباره CR نمی‌سازد. */
app.post("/api/eng/rcc/draft-crs", engRequire("eng.tq.answer"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return engBad(req, res, "E-ENG-NO-PROJECT", "پارامتر projectId الزامی است");
    const apply = String(req.query.apply || "") === "1";
    const r = await repo();
    const { queries } = await engProjectRows(projectId);
    const plan = planChangeRequests(queries);
    const created = [];
    if (apply) {
      const userId = req.headers["x-user-id"] || "system";
      const byCode = new Map(queries.map((q) => [q.Code, q]));
      for (const d of plan.drafts) {
        const cr = await r.upsert("ChangeRequest", { ProjectId: projectId, Code: d.code }, {
          ProjectId: projectId,
          Code: d.code,
          TitleFa: d.titleFa,
          RaisedBy: userId,
          RaisedAt: d.raisedAt,
          CostImpact: d.costImpact,
          TimeImpactDays: d.timeImpactDays,
          Status: "draft",
        }, userId);
        const src = byCode.get(d.sourceCode);
        if (src) await r.patch("TechnicalQuery", src.Id, { LinkedCrCode: d.code }, userId);
        created.push(cr?.Code || d.code);
      }
    }
    res.json(engOk(req, { dryRun: !apply, plan, created }));
  } catch (err) { next(err); }
});


/* ═══════════════ ماژول پیمان و صورت‌وضعیت (cnt-v1، دامنهٔ d14) ═══════════════
 * پرامپت «CONTRACT & IPC MANAGEMENT MODULE» — تحویلی D3: شناسنامهٔ پیمان و
 * فهرست بها. منطق کامل در server/cntLogic.js است؛ اینجا فقط داده خوانده،
 * اعتبارسنجی و سرو می‌شود. مبنا: docs/CNT_Architecture.md و docs/CNT_DataModel.md.
 *
 * دو حالت ارزش‌گذاری (فهرست بهایی و مقطوع) روی «ردیف» تفکیک می‌شوند نه روی
 * پیمان (ADR-CNT-11)، پس یک پیمان EPC می‌تواند هر دو را با هم داشته باشد و
 * لایهٔ REST هیچ‌جا مجبور به شاخه‌بندی بر مبنای نوع پیمان نیست. */

const cntOk = (req, data, meta = {}) =>
  ({ ok: true, data, meta: { traceId: req.requestId, engine: CNT_VERSION, timestamp: new Date().toISOString(), ...meta } });

const cntBad = (req, res, code, message, status = 400, detailsFa = null) =>
  res.status(status).json({
    ok: false,
    error: {
      code, message, traceId: req.requestId,
      /* فهرست موانع را یک‌جا برمی‌گردانیم تا کاربر رفت‌وبرگشت نکند. */
      ...(detailsFa && detailsFa.length ? { detailsFa } : {}),
    },
  });

/** ایرادهای موتور خالص و ایرادهای لایهٔ فرم یک قالب دارند تا UI یک‌جور نشان دهد. */
function cntInvalid(req, res, issues) {
  return res.status(422).json({
    ok: false,
    error: {
      code: "E-CNT-VALIDATION",
      message: `ورودی نامعتبر است (${issues.length} ایراد)`,
      issues,
      traceId: req.requestId,
    },
  });
}

/** میان‌افزار مجوز ماژول پیمان — همان قرارداد ماژول مهندسی با کد خطای خودش. */
function cntRequire(permission) {
  return (req, res, next) => {
    const enforce = String(process.env.CNT_RBAC_ENFORCE ?? "1") !== "0";
    const subject = engSubject(req);

    if (!subject) {
      if (!enforce) return next();
      return res.status(401).json({
        ok: false,
        error: { code: "E-CNT-AUTH-REQUIRED", message: "شناسهٔ کاربر برای این اقدام الزامی است", permission, traceId: req.requestId },
      });
    }
    const verdict = rbacEvaluate(subject, permission, { projectId: undefined });
    if (!verdict.allow) {
      if (!enforce) return next();
      return res.status(403).json({
        ok: false,
        error: {
          code: "E-CNT-FORBIDDEN",
          message: `کاربر ${subject.displayName} مجوز «${permission}» را ندارد`,
          permission,
          reason: verdict.reasonFa ?? verdict.reason ?? null,
          traceId: req.requestId,
        },
      });
    }
    req.cntSubject = subject;
    return next();
  };
}

async function cntContractRows(projectId) {
  const r = await repo();
  const w = [{ column: "ProjectId", op: "eq", value: projectId }];
  const [contracts, items, amendments, milestones, ipcs] = await Promise.all([
    r.list("ContractMaster", { where: w, limit: 2000 }),
    r.list("ContractBOQ_Item", { where: w, limit: 20000 }),
    r.list("ContractAmendment", { where: w, limit: 2000 }),
    r.list("LumpSumMilestone", { where: w, limit: 5000 }),
    r.list("InterimPaymentCertificate", { where: w, limit: 5000 }),
  ]);
  return { contracts, items, amendments, milestones, ipcs };
}

/** کارکرد تجمعی پیمان ستون ذخیره‌شده نیست؛ از بزرگ‌ترین کارکرد تجمعی
 * صورت‌وضعیت‌های تأییدشده مشتق می‌شود تا هرگز با واقعیت اختلاف پیدا نکند. */
function cntExecutedAmount(contractId, ipcs) {
  const done = ipcs.filter(
    (i) => i.ContractId === contractId && ["approved", "paid"].includes(String(i.Status)),
  );
  return done.reduce((max, i) => Math.max(max, Number(i.GrossCumulative || 0)), 0);
}

/* ── ۱۴٫۱ فهرست پیمان‌ها ── */
app.get("/api/cnt/contracts", async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");

    const { contracts, items, amendments, ipcs } = await cntContractRows(projectId);
    const itemsByContract = new Map();
    for (const it of items) {
      const arr = itemsByContract.get(it.ContractId) || [];
      arr.push(it);
      itemsByContract.set(it.ContractId, arr);
    }

    const rows = contracts.map((c) => {
      const own = itemsByContract.get(c.Id) || [];
      const s = contractSummary({
        contract: c,
        items: own,
        amendments: amendments.filter((a) => a.ContractId === c.Id),
        executedAmount: cntExecutedAmount(c.Id, ipcs),
      });
      return {
        id: c.Id,
        code: c.Code,
        titleFa: c.TitleFa,
        contractType: c.ContractType,
        contractTypeFa: CONTRACT_TYPE_FA[c.ContractType] ?? c.ContractType,
        status: c.Status,
        initialAmount: s.initialAmount,
        currentAmount: s.currentAmount,
        boqTotal: s.boqTotal,
        itemCount: own.length,
        byBasis: s.byBasis,
        ceilingStatus: s.ceiling.status,
        ceilingUsedPct: s.ceiling.usedPct,
        boqVarianceFa: s.boqVarianceFa,
      };
    });

    res.json(cntOk(req, {
      projectId,
      count: rows.length,
      contracts: rows,
      totals: {
        initialAmount: rows.reduce((s, r2) => s + r2.initialAmount, 0),
        currentAmount: rows.reduce((s, r2) => s + r2.currentAmount, 0),
        atCeilingRisk: rows.filter((r2) => r2.ceilingStatus !== "ok").length,
      },
    }));
  } catch (err) { next(err); }
});

/* ── ۱۴٫۱ شناسنامهٔ یک پیمان با فهرست بها ── */
app.get("/api/cnt/contracts/:id", async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");

    const { contracts, items, amendments, milestones, ipcs } = await cntContractRows(projectId);
    const contract = contracts.find((c) => c.Id === req.params.id || c.Code === req.params.id);
    if (!contract) return cntBad(req, res, "E-CNT-NOT-FOUND", `پیمان ${req.params.id} یافت نشد`, 404);

    const own = items.filter((it) => it.ContractId === contract.Id);
    const ownAmend = amendments.filter((a) => a.ContractId === contract.Id);
    const summary = contractSummary({
      contract,
      items: own,
      amendments: ownAmend,
      executedAmount: cntExecutedAmount(contract.Id, ipcs),
    });

    /* مراحل مقطوع فقط برای ردیف‌هایی که واقعاً مقطوع‌اند معنا دارد. */
    const lumpSumRows = own.filter((it) => it.PricingBasis === "lump_sum");
    const milestoneView = lumpSumRows.map((it) => {
      const ms = milestones.filter((m) => m.BoqItemId === it.Id);
      const p = milestoneProgress(ms);
      return { boqItemId: it.Id, itemNo: it.ItemNo, titleFa: it.TitleFa, lumpSumAmount: Number(it.LumpSumAmount || 0), ...p };
    });

    res.json(cntOk(req, {
      contract: {
        ...contract,
        contractTypeFa: CONTRACT_TYPE_FA[contract.ContractType] ?? contract.ContractType,
      },
      summary,
      items: own.map((it) => ({
        ...it,
        pricingBasisFa: PRICING_BASIS_FA[it.PricingBasis] ?? it.PricingBasis,
        computedAmount: lineAmount(it),
      })),
      amendments: ownAmend,
      milestones: milestoneView,
      mapping: mappingCoverage(own),
    }));
  } catch (err) { next(err); }
});

/* ── فرم ۱: ثبت و ویرایش شناسنامهٔ پیمان ── */
app.post("/api/cnt/contracts", cntRequire("cnt.contract.edit"), async (req, res, next) => {
  try {
    const b = engBody(req);
    const projectId = String(req.query.projectId || b.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");

    const issues = engValidate(b, [
      { field: "code", titleFa: "شمارهٔ پیمان", required: true, maxLen: 80 },
      { field: "titleFa", titleFa: "موضوع پیمان", required: true, maxLen: 400 },
      { field: "contractType", titleFa: "نوع پیمان", required: true, oneOf: ["unit_price", "lump_sum", "mixed", "cost_plus", "epc"] },
      { field: "party", titleFa: "طرف پیمان", oneOf: ["main", "subcontract"] },
      { field: "employerName", titleFa: "نام کارفرما", required: true, maxLen: 200 },
      { field: "contractorName", titleFa: "نام پیمانکار", required: true, maxLen: 200 },
      { field: "initialAmount", titleFa: "مبلغ اولیه", required: true, type: "number", min: 0 },
      { field: "signDate", titleFa: "تاریخ انعقاد", required: true, type: "date" },
      { field: "startDate", titleFa: "تاریخ شروع", required: true, type: "date" },
      { field: "durationDays", titleFa: "مدت پیمان به روز", required: true, type: "number", min: 1 },
      { field: "ceilingPct", titleFa: "درصد سقف مجاز", type: "number", min: 0, max: 100 },
      { field: "retainagePct", titleFa: "درصد حسن انجام کار", type: "number", min: 0, max: 100 },
      { field: "advancePct", titleFa: "درصد پیش‌پرداخت", type: "number", min: 0, max: 100 },
      { field: "status", titleFa: "وضعیت", oneOf: ["draft", "active", "suspended", "completed", "terminated"] },
    ]);

    /* شروع پیش از انعقاد ممکن است (شروع به کار پیش از امضا) ولی برعکسش
     * یعنی تاریخ‌ها جابه‌جا وارد شده‌اند. */
    if (b.signDate && b.startDate && String(b.startDate) < String(b.signDate) && !b.allowEarlyStart) {
      issues.push({ field: "startDate", code: "BEFORE_SIGN", messageFa: "تاریخ شروع پیش از تاریخ انعقاد است؛ در صورت صحت allowEarlyStart بفرستید" });
    }
    if (issues.length) return cntInvalid(req, res, issues);

    const r = await repo();
    const userId = req.headers["x-user-id"] || "system";
    const code = String(b.code).trim();

    const dup = await r.findOne("ContractMaster", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "Code", op: "eq", value: code },
    ]);
    if (dup && !b.allowUpdate) {
      return res.status(409).json({
        ok: false,
        error: { code: "E-CNT-DUP-CODE", message: `پیمان ${code} از قبل ثبت شده است`, traceId: req.requestId },
      });
    }

    const initialAmount = Number(b.initialAmount);
    const up = await r.upsert("ContractMaster", { ProjectId: projectId, Code: code }, {
      ProjectId: projectId,
      Code: code,
      TitleFa: String(b.titleFa).trim(),
      ContractType: String(b.contractType),
      Party: b.party || "main",
      EmployerName: String(b.employerName).trim(),
      ConsultantName: b.consultantName ? String(b.consultantName).trim() : null,
      ContractorName: String(b.contractorName).trim(),
      SignDate: b.signDate,
      StartDate: b.startDate,
      DurationDays: Number(b.durationDays),
      Currency: b.currency || "IRR",
      InitialAmount: initialAmount,
      /* مبلغ جاری در بدو ثبت برابر اولیه است؛ فقط الحاقیهٔ مصوب تغییرش می‌دهد. */
      CurrentAmount: dup ? Number(dup.CurrentAmount ?? initialAmount) : initialAmount,
      CeilingPct: b.ceilingPct != null ? Number(b.ceilingPct) : 25,
      AdvancePct: b.advancePct != null ? Number(b.advancePct) : 0,
      AdvanceRecoveryPct: b.advanceRecoveryPct != null ? Number(b.advanceRecoveryPct) : null,
      RetainagePct: b.retainagePct != null ? Number(b.retainagePct) : 10,
      InsuranceRatePct: b.insuranceRatePct != null ? Number(b.insuranceRatePct) : null,
      WithholdingTaxPct: b.withholdingTaxPct != null ? Number(b.withholdingTaxPct) : null,
      VatPct: b.vatPct != null ? Number(b.vatPct) : null,
      AdjustmentEnabled: b.adjustmentEnabled != null ? Boolean(b.adjustmentEnabled) : false,
      BaseIndexPeriod: b.baseIndexPeriod ? String(b.baseIndexPeriod) : null,
      ReviewDaysConsultant: b.reviewDaysConsultant != null ? Number(b.reviewDaysConsultant) : null,
      ReviewDaysEmployer: b.reviewDaysEmployer != null ? Number(b.reviewDaysEmployer) : null,
      Status: b.status || "draft",
    }, userId);

    res.status(dup ? 200 : 201).json(cntOk(req, {
      created: up.action === "insert",
      item: up.row,
      ceiling: contractCeiling({
        initialAmount,
        executedAmount: 0,
        ceilingPct: Number(up.row.CeilingPct ?? 25),
      }),
    }));
  } catch (err) { next(err); }
});

/* ── فرم ۲: ثبت ردیف فهرست بها (هر دو حالت ارزش‌گذاری) ── */
app.post("/api/cnt/boq", cntRequire("cnt.boq.edit"), async (req, res, next) => {
  try {
    const b = engBody(req);
    const projectId = String(req.query.projectId || b.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");

    const issues = engValidate(b, [
      { field: "contractId", titleFa: "پیمان", required: true, maxLen: 80 },
      { field: "itemNo", titleFa: "شمارهٔ ردیف", required: true, maxLen: 40 },
      { field: "titleFa", titleFa: "شرح ردیف", required: true, maxLen: 800 },
      { field: "pricingBasis", titleFa: "مبنای ارزش‌گذاری", required: true, oneOf: ["unit_price", "lump_sum"] },
      { field: "chapterCode", titleFa: "کد فصل", maxLen: 20 },
      { field: "contractQty", titleFa: "مقدار پیمان", type: "number" },
      { field: "unitRate", titleFa: "نرخ واحد", type: "number" },
      { field: "lumpSumAmount", titleFa: "مبلغ مقطوع", type: "number" },
      { field: "rateStatus", titleFa: "وضعیت نرخ", oneOf: ["agreed", "rate_pending", "disputed"] },
      { field: "status", titleFa: "وضعیت ردیف", oneOf: ["active", "superseded", "cancelled"] },
    ]);
    if (issues.length) return cntInvalid(req, res, issues);

    const r = await repo();
    const userId = req.headers["x-user-id"] || "system";
    const contractId = String(b.contractId).trim();
    const contract = await r.findOne("ContractMaster", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "Id", op: "eq", value: contractId },
    ]);
    if (!contract) return cntBad(req, res, "E-CNT-NOT-FOUND", `پیمان ${contractId} یافت نشد`, 404);

    const itemNo = String(b.itemNo).trim();
    const basis = String(b.pricingBasis);
    const contractQty = b.contractQty != null && b.contractQty !== "" ? Number(b.contractQty) : null;
    const unitRate = b.unitRate != null && b.unitRate !== "" ? Number(b.unitRate) : null;
    const lumpSumAmount = b.lumpSumAmount != null && b.lumpSumAmount !== "" ? Number(b.lumpSumAmount) : null;

    const draft = {
      ProjectId: projectId,
      ContractId: contractId,
      ItemNo: itemNo,
      ParentItemNo: b.parentItemNo ? String(b.parentItemNo).trim() : null,
      TitleFa: String(b.titleFa).trim(),
      ChapterCode: b.chapterCode ? String(b.chapterCode).trim() : null,
      PricingBasis: basis,
      Unit: b.unit ? String(b.unit).trim() : null,
      ContractQty: contractQty,
      UnitRate: unitRate,
      LumpSumAmount: lumpSumAmount,
      LineAmount: basis === "lump_sum" ? Number(lumpSumAmount || 0) : Number(contractQty || 0) * Number(unitRate || 0),
      IsStarred: b.isStarred != null ? Boolean(b.isStarred) : false,
      /* ردیف ستاره‌دار تا توافق نرخ در جمع مالی نمی‌آید (ADR-CNT-08). */
      RateStatus: b.rateStatus || (b.isStarred ? "rate_pending" : "agreed"),
      WbsId: b.wbsId ? String(b.wbsId) : null,
      CostAccountCode: b.costAccountCode ? String(b.costAccountCode) : null,
      Status: b.status || "active",
    };

    /* اعتبارسنجی دامنه‌ای از موتور می‌آید نه از لایهٔ REST؛ همان قواعدی که
     * ورود دسته‌ای اکسل هم با آن سنجیده می‌شود. */
    const engineIssues = validateBoqItem(draft);
    if (engineIssues.length) return cntInvalid(req, res, engineIssues);

    const dup = await r.findOne("ContractBOQ_Item", [
      { column: "ContractId", op: "eq", value: contractId },
      { column: "ItemNo", op: "eq", value: itemNo },
    ]);
    if (dup && !b.allowUpdate) {
      return res.status(409).json({
        ok: false,
        error: { code: "E-CNT-DUP-ITEM", message: `ردیف ${itemNo} در این پیمان از قبل ثبت شده است`, traceId: req.requestId },
      });
    }

    const up = await r.upsert("ContractBOQ_Item", { ContractId: contractId, ItemNo: itemNo }, draft, userId);

    /* جمع فهرست بها بعد از هر ثبت اعلام می‌شود: کاربر باید همان لحظه ببیند
     * که جمع ردیف‌ها از مبلغ پیمان فاصله گرفته، نه سه ماه بعد سر صورت‌وضعیت. */
    const all = await r.list("ContractBOQ_Item", { where: [{ column: "ContractId", op: "eq", value: contractId }], limit: 20000 });
    const roll = boqRollup(all);
    const initialAmount = Number(contract.InitialAmount || 0);
    const variance = Math.round((roll.total - initialAmount) * 100) / 100;

    res.status(dup ? 200 : 201).json(cntOk(req, {
      created: up.action === "insert",
      item: { ...up.row, pricingBasisFa: PRICING_BASIS_FA[basis] ?? basis },
      boqTotal: roll.total,
      itemCount: all.length,
      byBasis: roll.chapters.reduce((acc, ch) => {
        acc.unit_price += ch.byBasis.unit_price;
        acc.lump_sum += ch.byBasis.lump_sum;
        return acc;
      }, { unit_price: 0, lump_sum: 0 }),
      varianceFa: Math.abs(variance) > 0.01
        ? `جمع فهرست بها ${roll.total} است و با مبلغ پیمان ${initialAmount} به اندازهٔ ${variance} اختلاف دارد`
        : null,
    }));
  } catch (err) { next(err); }
});

/* ── فرم ۳: ثبت مرحلهٔ مقطوع ── */
app.post("/api/cnt/milestone", cntRequire("cnt.boq.edit"), async (req, res, next) => {
  try {
    const b = engBody(req);
    const projectId = String(req.query.projectId || b.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");

    const issues = engValidate(b, [
      { field: "boqItemId", titleFa: "ردیف فهرست بها", required: true, maxLen: 80 },
      { field: "milestoneNo", titleFa: "شمارهٔ مرحله", required: true, type: "number", min: 1 },
      { field: "titleFa", titleFa: "عنوان مرحله", required: true, maxLen: 400 },
      { field: "weightPct", titleFa: "وزن مرحله", required: true, type: "number", min: 0, max: 100 },
      { field: "plannedDate", titleFa: "تاریخ برنامه‌ای", type: "date" },
      { field: "achievedDate", titleFa: "تاریخ تحقق", type: "date" },
      { field: "achievedPct", titleFa: "درصد تحقق", type: "number", min: 0, max: 100 },
      { field: "status", titleFa: "وضعیت", oneOf: ["pending", "claimed", "verified", "rejected"] },
    ]);
    if (issues.length) return cntInvalid(req, res, issues);

    const r = await repo();
    const userId = req.headers["x-user-id"] || "system";
    const boqItemId = String(b.boqItemId).trim();

    const item = await r.findOne("ContractBOQ_Item", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "Id", op: "eq", value: boqItemId },
    ]);
    if (!item) return cntBad(req, res, "E-CNT-NOT-FOUND", `ردیف ${boqItemId} یافت نشد`, 404);

    /* مرحله فقط روی ردیف مقطوع معنا دارد؛ روی ردیف فهرست‌بهایی پیشرفت از
     * ریزمتره می‌آید و مرحله آن را دوباره‌شماری می‌کند. */
    if (item.PricingBasis !== "lump_sum") {
      return cntInvalid(req, res, [{
        field: "boqItemId",
        code: "CNT-MS-NOT-LUMPSUM",
        messageFa: `ردیف ${item.ItemNo} فهرست‌بهایی است؛ مرحلهٔ مقطوع فقط برای ردیف مقطوع تعریف می‌شود`,
      }]);
    }

    const milestoneNo = Number(b.milestoneNo);
    const up = await r.upsert("LumpSumMilestone", { BoqItemId: boqItemId, MilestoneNo: milestoneNo }, {
      ProjectId: projectId,
      ContractId: item.ContractId,
      BoqItemId: boqItemId,
      MilestoneNo: milestoneNo,
      TitleFa: String(b.titleFa).trim(),
      WeightPct: Number(b.weightPct),
      PlannedDate: b.plannedDate || null,
      AcceptanceCriteriaFa: b.acceptanceCriteriaFa ? String(b.acceptanceCriteriaFa).trim() : null,
      AchievedDate: b.achievedDate || null,
      AchievedPct: b.achievedPct != null ? Number(b.achievedPct) : null,
      EvidenceDocNo: b.evidenceDocNo ? String(b.evidenceDocNo) : null,
      VerifiedBy: b.status === "verified" ? String(req.headers["x-user-id"] || "system") : null,
      Status: b.status || "pending",
    }, userId);

    const all = await r.list("LumpSumMilestone", { where: [{ column: "BoqItemId", op: "eq", value: boqItemId }], limit: 5000 });
    const p = milestoneProgress(all);

    res.status(up.action === "insert" ? 201 : 200).json(cntOk(req, {
      created: up.action === "insert",
      item: up.row,
      progress: p,
      earnedAmount: Math.round(Number(item.LumpSumAmount || 0) * (p.cumPct / 100) * 100) / 100,
    }));
  } catch (err) { next(err); }
});

/* ── فرم ۴: ثبت برگهٔ ریزمتره ── */
app.post("/api/cnt/measurement", cntRequire("cnt.measurement.record"), async (req, res, next) => {
  try {
    const b = engBody(req);
    const projectId = String(req.query.projectId || b.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");

    const issues = engValidate(b, [
      { field: "boqItemId", titleFa: "ردیف فهرست بها", required: true, maxLen: 80 },
      { field: "sheetNo", titleFa: "شمارهٔ برگه", required: true, type: "number", min: 1 },
      { field: "count", titleFa: "تعداد", type: "number", min: 0 },
      { field: "length", titleFa: "طول", type: "number", min: 0 },
      { field: "width", titleFa: "عرض", type: "number", min: 0 },
      { field: "height", titleFa: "ارتفاع", type: "number", min: 0 },
      { field: "factor", titleFa: "ضریب", type: "number", min: 0 },
      { field: "status", titleFa: "وضعیت", oneOf: ["draft", "claimed", "verified", "rejected"] },
    ]);
    if (issues.length) return cntInvalid(req, res, issues);

    const r = await repo();
    const userId = req.headers["x-user-id"] || "system";
    const boqItemId = String(b.boqItemId).trim();

    const item = await r.findOne("ContractBOQ_Item", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "Id", op: "eq", value: boqItemId },
    ]);
    if (!item) return cntBad(req, res, "E-CNT-NOT-FOUND", `ردیف ${boqItemId} یافت نشد`, 404);
    if (item.PricingBasis !== "unit_price") {
      return cntInvalid(req, res, [{
        field: "boqItemId",
        code: "CNT-MS-NOT-UNITPRICE",
        messageFa: `ردیف ${item.ItemNo} مقطوع است؛ کارکردش از مرحله ثبت می‌شود نه ریزمتره`,
      }]);
    }

    /* دروازهٔ کیفی: بدون تأییدیهٔ بازرسی، متره ثبت نمی‌شود مگر با مجوز
     * صریح دور زدن (ADR-CNT-02). این نقطه‌ای است که کیفیت به پول وصل می‌شود.
     *
     * پیمایش عدم انطباق باز از ستون `Ncr.ActivityId` می‌آید (مهاجرت 0011،
     * روی ایندکس `IX_Ncr_Activity`). رکوردهای تاریخی این ستون را خالی
     * دارند و مسدود نمی‌کنند — که درست است، چون عدم انطباقی که به فعالیت
     * وصل نیست نمی‌تواند بگوید کدام کارکرد را می‌بندد. برای آن موارد، کد
     * عدم انطباق صریح فرستاده می‌شود. */
    const activityId = b.activityId ? String(b.activityId) : null;
    const ncrCode = b.ncrCode ? String(b.ncrCode).trim() : null;
    let gate = null;
    if (activityId || b.inspectionRecordCode || ncrCode) {
      const w = [{ column: "ProjectId", op: "eq", value: projectId }];
      const [inspections, ncrs] = await Promise.all([
        r.list("InspectionRecord", { where: w, limit: 20000 }).catch(() => []),
        r.list("Ncr", { where: w, limit: 20000 }).catch(() => []),
      ]);
      const isOpen = (n) => n.Status && !["closed", "verified", "cancelled"].includes(String(n.Status));
      const openNcrActivityIds = ncrs.filter(isOpen).map((n) => n.ActivityId).filter(Boolean);
      /* عدم انطباق اعلام‌شده هم مثل عدم انطباق پیمایش‌شده مسدودکننده است. */
      if (ncrCode && activityId && ncrs.some((n) => n.Code === ncrCode && isOpen(n))) {
        openNcrActivityIds.push(activityId);
      }

      const wantsOverride = Boolean(b.override);
      let override = null;
      if (wantsOverride) {
        const subject = req.cntSubject ?? engSubject(req);
        const verdict = subject ? rbacEvaluate(subject, "cnt.ipc.override", { projectId: undefined }) : { allow: false };
        if (!verdict.allow) {
          return res.status(403).json({
            ok: false,
            error: {
              code: "E-CNT-OVERRIDE-FORBIDDEN",
              message: "دور زدن دروازهٔ کیفی نیازمند مجوز cnt.ipc.override است",
              permission: "cnt.ipc.override",
              traceId: req.requestId,
            },
          });
        }
        if (!b.overrideReasonFa) {
          return cntInvalid(req, res, [{ field: "overrideReasonFa", code: "REQUIRED", messageFa: "دلیل دور زدن دروازهٔ کیفی الزامی است" }]);
        }
        override = { by: String(req.headers["x-user-id"] || "system"), reasonFa: String(b.overrideReasonFa) };
      }

      gate = qualityGate({
        activityId,
        inspectionRecordCode: b.inspectionRecordCode ? String(b.inspectionRecordCode) : null,
        inspections,
        openNcrActivityIds,
        override,
      });
      if (!gate.passed) {
        return res.status(409).json({
          ok: false,
          error: { code: gate.code, message: gate.messageFa, traceId: req.requestId },
        });
      }
      /* اثبات باید ماندگار شود: اگر کاربر فقط فعالیت داده، کد بازرسی‌ای که
       * دروازه را باز کرد روی برگه می‌نشیند تا ممیزی بعدی بتواند دنبالش کند. */
      if (!b.inspectionRecordCode && activityId && gate.status === "passed") {
        const hit = inspections.find(
          (i) => i.ActivityId === activityId && ["accepted", "pass"].includes(String(i.Outcome ?? "").toLowerCase()),
        );
        if (hit) b.inspectionRecordCode = hit.Code;
      }
    }

    const sheetNo = Number(b.sheetNo);
    const row = {
      Count: b.count != null && b.count !== "" ? Number(b.count) : null,
      Length: b.length != null && b.length !== "" ? Number(b.length) : null,
      Width: b.width != null && b.width !== "" ? Number(b.width) : null,
      Height: b.height != null && b.height !== "" ? Number(b.height) : null,
      Factor: b.factor != null && b.factor !== "" ? Number(b.factor) : null,
    };
    const quantity = measurementQuantity(row);

    const up = await r.upsert("MeasurementSheet", { BoqItemId: boqItemId, SheetNo: sheetNo }, {
      ProjectId: projectId,
      ContractId: item.ContractId,
      BoqItemId: boqItemId,
      IpcId: b.ipcId ? String(b.ipcId) : null,
      SheetNo: sheetNo,
      LocationFa: b.locationFa ? String(b.locationFa).trim() : null,
      DrawingNo: b.drawingNo ? String(b.drawingNo).trim() : null,
      ...row,
      Quantity: quantity,
      SourceDprId: b.sourceDprId ? String(b.sourceDprId) : null,
      InspectionRecordCode: b.inspectionRecordCode ? String(b.inspectionRecordCode) : null,
      Status: b.status || "draft",
    }, userId);

    const all = await r.list("MeasurementSheet", { where: [{ column: "BoqItemId", op: "eq", value: boqItemId }], limit: 20000 });
    const totals = measurementTotal(all);
    const contractQty = Number(item.ContractQty || 0);

    res.status(up.action === "insert" ? 201 : 200).json(cntOk(req, {
      created: up.action === "insert",
      item: up.row,
      quantity,
      cumulativeQty: totals.total,
      contractQty,
      /* عبور مقدار از مقدار پیمان مانع ثبت نیست ولی باید دیده شود؛ سقف
       * مالی جای دیگری کنترل می‌شود. */
      overrunFa: contractQty > 0 && totals.total > contractQty
        ? `مقدار تجمعی ${totals.total} از مقدار پیمان ${contractQty} گذشته است`
        : null,
      qualityGate: gate,
    }));
  } catch (err) { next(err); }
});

/* ── ۱۴٫۱ اعتبارسنجی دسته‌ای فهرست بها (پیش از بارگذاری اکسل) ── */
app.post("/api/cnt/boq/validate", async (req, res, next) => {
  try {
    const b = engBody(req);
    const rows = Array.isArray(b.items) ? b.items : [];
    if (!rows.length) return cntBad(req, res, "E-CNT-NO-ITEMS", "هیچ ردیفی برای بررسی ارسال نشده است");

    const result = validateBoq(rows);
    const roll = boqRollup(rows.filter((it) => it.Status !== "cancelled"));

    res.json(cntOk(req, {
      ...result,
      rowCount: rows.length,
      chapters: roll.chapters,
      /* پیش‌نمایش است و چیزی نمی‌نویسد — کاربر باید قبل از ثبت بداند
       * چند ردیف ایراد دارد. */
      previewOnly: true,
    }));
  } catch (err) { next(err); }
});

/* ── ۱۴٫۱ رول‌آپ فصل‌ها و پوشش نگاشت یک پیمان ── */
app.get("/api/cnt/boq/rollup", async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    const contractId = String(req.query.contractId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");
    if (!contractId) return cntBad(req, res, "E-CNT-NO-CONTRACT", "پارامتر contractId الزامی است");

    const r = await repo();
    const items = await r.list("ContractBOQ_Item", {
      where: [{ column: "ProjectId", op: "eq", value: projectId }, { column: "ContractId", op: "eq", value: contractId }],
      limit: 20000,
    });
    const roll = boqRollup(items);

    res.json(cntOk(req, {
      contractId,
      ...roll,
      mapping: mappingCoverage(items),
      validation: validateBoq(items),
    }));
  } catch (err) { next(err); }
});

/* ── ۱۴٫۲ صورت‌وضعیت پیمانکار اصلی (D4) ── */

/* گردآوری داده‌های لازم برای محاسبهٔ یک صورت‌وضعیت.
 *
 * ردیف‌های فهرست بها، کارکرد تجمعی دورهٔ قبل، و ماندهٔ پیش‌پرداخت از سه
 * جای مختلف می‌آیند. اگر هرکدام جدا خوانده شود، محاسبه با دادهٔ ناهمگام
 * انجام می‌شود. */
async function cntIpcContext(r, projectId, contractId, excludeIpcId) {
  const [contract, boq, allIpcs, advances] = await Promise.all([
    r.findOne("ContractMaster", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "Id", op: "eq", value: contractId },
    ]),
    r.list("ContractBOQ_Item", {
      where: [
        { column: "ProjectId", op: "eq", value: projectId },
        { column: "ContractId", op: "eq", value: contractId },
      ],
      limit: 20000,
    }),
    r.list("InterimPaymentCertificate", {
      where: [
        { column: "ProjectId", op: "eq", value: projectId },
        { column: "ContractId", op: "eq", value: contractId },
      ],
      limit: 5000,
    }),
    r.list("AdvancePaymentSchedule", {
      where: [
        { column: "ProjectId", op: "eq", value: projectId },
        { column: "ContractId", op: "eq", value: contractId },
      ],
      limit: 500,
    }),
  ]);

  /* کارکرد تجمعی قبل فقط از صورت‌وضعیت‌های باطل‌نشده می‌آید. */
  const priorIpcs = allIpcs.filter(
    (x) => x.Status !== "cancelled" && String(x.Id) !== String(excludeIpcId ?? ""),
  );
  const priorIds = new Set(priorIpcs.map((x) => String(x.Id)));

  const priorLines = priorIds.size
    ? (await r.list("IPC_LineItem", {
        where: [{ column: "ProjectId", op: "eq", value: projectId }],
        limit: 50000,
      })).filter((l) => priorIds.has(String(l.IpcId)))
    : [];

  /* بیشینهٔ تجمعی هر ردیف در دوره‌های قبل — نه جمع، چون تجمعی است. */
  const prevByBoq = new Map();
  for (const l of priorLines) {
    const k = String(l.BoqItemId);
    const cur = prevByBoq.get(k) ?? { qty: 0, pct: 0 };
    prevByBoq.set(k, {
      qty: Math.max(cur.qty, Number(l.CumQty) || 0),
      pct: Math.max(cur.pct, Number(l.CumPct) || 0),
    });
  }

  const outstanding = advances.reduce((sum, a) => sum + (Number(a.OutstandingAmount) || 0), 0);

  return { contract, boq, allIpcs, prevByBoq, advanceOutstanding: outstanding };
}

/* پیش‌محاسبهٔ صورت‌وضعیت بدون ذخیره — برای دیدن مبلغ پیش از ثبت. */
app.post("/api/cnt/ipc/preview", cntRequire("cnt.ipc.prepare"), async (req, res, next) => {
  try {
    const b = engBody(req);
    const projectId = String(req.query.projectId || b.projectId || "");
    const contractId = String(b.contractId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");
    if (!contractId) return cntBad(req, res, "E-CNT-NO-CONTRACT", "پارامتر contractId الزامی است");

    const r = await repo();
    const ctx = await cntIpcContext(r, projectId, contractId, null);
    if (!ctx.contract) return cntBad(req, res, "E-CNT-NOT-FOUND", `پیمان ${contractId} یافت نشد`, 404);

    const claims = Array.isArray(b.lines) ? b.lines : [];
    const lines = [];
    for (const claim of claims) {
      const item = ctx.boq.find((x) => String(x.Id) === String(claim.boqItemId));
      if (!item) continue;
      const prev = ctx.prevByBoq.get(String(item.Id)) ?? { qty: 0, pct: 0 };
      lines.push({
        BoqItemId: String(item.Id),
        PricingBasis: item.PricingBasis,
        UnitRate: item.UnitRate,
        LumpSumAmount: item.LumpSumAmount,
        LineAmount: item.LineAmount,
        prevQty: prev.qty,
        cumQty: claim.cumQty,
        prevPct: prev.pct,
        cumPct: claim.cumPct,
        QualityGateStatus: claim.qualityGateStatus || "passed",
        Status: claim.status,
      });
    }

    const totals = computeIpc({
      lines,
      adjustmentAmount: b.adjustmentAmount,
      materialDiffAmount: b.materialDiffAmount,
      deductions: {
        ...(b.deductions || {}),
        advanceOutstanding:
          b.deductions?.advanceOutstanding ?? ctx.advanceOutstanding,
      },
    });

    /* سقف ۲۵٪: مبلغ تجمعی نباید از سقف مجاز پیمان عبور کند. */
    const priorCum = ctx.allIpcs
      .filter((x) => x.Status !== "cancelled")
      .reduce((m, x) => Math.max(m, Number(x.GrossCumulative) || 0), 0);
    const ceiling = contractCeiling({
      initialAmount: ctx.contract.InitialAmount,
      executedAmount: Math.max(priorCum, totals.grossCumulative),
      ceilingPct: ctx.contract.CeilingPct,
    });

    res.json(cntOk(req, {
      contractId,
      serialNo: nextIpcSerial(ctx.allIpcs),
      ...totals,
      ceiling,
      advanceOutstanding: ctx.advanceOutstanding,
    }));
  } catch (err) { next(err); }
});

/* ثبت صورت‌وضعیت جدید به همراه ردیف‌ها و کسورات. */
app.post("/api/cnt/ipc", cntRequire("cnt.ipc.prepare"), async (req, res, next) => {
  try {
    const b = engBody(req);
    const projectId = String(req.query.projectId || b.projectId || "");
    const contractId = String(b.contractId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");
    if (!contractId) return cntBad(req, res, "E-CNT-NO-CONTRACT", "پارامتر contractId الزامی است");

    const issues = engValidate(b, [
      { field: "periodCode", titleFa: "کد دوره", required: true, maxLen: 20 },
      { field: "periodFrom", titleFa: "از تاریخ", required: true, maxLen: 30 },
      { field: "periodTo", titleFa: "تا تاریخ", required: true, maxLen: 30 },
      { field: "ipcType", titleFa: "نوع", oneOf: ["interim", "final", "advance", "adjustment_only"] },
    ]);
    if (issues.length) return cntInvalid(req, res, issues);

    const r = await repo();
    const userId = req.headers["x-user-id"] || "system";
    const ctx = await cntIpcContext(r, projectId, contractId, null);
    if (!ctx.contract) return cntBad(req, res, "E-CNT-NOT-FOUND", `پیمان ${contractId} یافت نشد`, 404);

    const periodCode = String(b.periodCode).trim();
    const duplicate = ctx.allIpcs.find(
      (x) => x.PeriodCode === periodCode && x.Status !== "cancelled",
    );
    if (duplicate) {
      return cntBad(req, res, "E-CNT-DUP-PERIOD", `برای دورهٔ ${periodCode} صورت‌وضعیت ${duplicate.SerialNo} ثبت شده است`, 409);
    }

    const claims = Array.isArray(b.lines) ? b.lines : [];
    if (!claims.length) {
      return cntInvalid(req, res, [{ field: "lines", code: "CNT-IPC-NO-LINES", messageFa: "صورت‌وضعیت بدون ردیف ثبت نمی‌شود" }]);
    }

    const lines = [];
    const unknown = [];
    for (const claim of claims) {
      const item = ctx.boq.find((x) => String(x.Id) === String(claim.boqItemId));
      if (!item) { unknown.push(String(claim.boqItemId)); continue; }
      const prev = ctx.prevByBoq.get(String(item.Id)) ?? { qty: 0, pct: 0 };
      lines.push({
        _item: item,
        BoqItemId: String(item.Id),
        PricingBasis: item.PricingBasis,
        UnitRate: item.UnitRate,
        LumpSumAmount: item.LumpSumAmount,
        LineAmount: item.LineAmount,
        prevQty: prev.qty,
        cumQty: claim.cumQty,
        prevPct: prev.pct,
        cumPct: claim.cumPct,
        QualityGateStatus: claim.qualityGateStatus || "passed",
        Status: claim.status,
      });
    }
    if (unknown.length) {
      return cntBad(req, res, "E-CNT-NOT-FOUND", `ردیف‌های ناشناخته: ${unknown.join("، ")}`, 404);
    }

    const totals = computeIpc({
      lines,
      adjustmentAmount: b.adjustmentAmount,
      materialDiffAmount: b.materialDiffAmount,
      deductions: {
        ...(b.deductions || {}),
        advanceOutstanding: b.deductions?.advanceOutstanding ?? ctx.advanceOutstanding,
      },
    });

    /* سقف ۲۵٪ مانع سخت است مگر با درخواست تغییر مصوب (ADR-CNT-08). */
    const ceiling = contractCeiling({
      initialAmount: ctx.contract.InitialAmount,
      executedAmount: totals.grossCumulative,
      ceilingPct: ctx.contract.CeilingPct,
    });
    if (ceiling.status === "exceeded" && !b.changeRequestCode) {
      return cntBad(req, res, "E-CNT-CEILING-25", ceiling.messageFa || "مبلغ تجمعی از سقف مجاز پیمان عبور می‌کند", 409);
    }

    const serialNo = nextIpcSerial(ctx.allIpcs);
    const created = await r.create("InterimPaymentCertificate", {
      ProjectId: projectId,
      ContractId: contractId,
      SerialNo: serialNo,
      IpcType: String(b.ipcType || "interim"),
      PeriodCode: periodCode,
      PeriodFrom: String(b.periodFrom),
      PeriodTo: String(b.periodTo),
      GrossCurrent: totals.grossCurrent,
      GrossCumulative: totals.grossCumulative,
      AdjustmentAmount: totals.adjustmentAmount,
      MaterialDiffAmount: totals.materialDiffAmount,
      SubtotalAmount: totals.subtotal,
      TotalDeductions: totals.totalDeductions,
      VatAmount: totals.vatAmount,
      NetPayable: totals.netPayable,
      WorkflowState: "draft",
      PostedToFin: false,
      Status: "open",
    }, userId, "IPC");

    const ipcId = created.Id ?? created.id ?? created.row?.Id;

    for (const line of totals.lines) {
      const src = lines.find((l) => l.BoqItemId === line.BoqItemId);
      await r.create("IPC_LineItem", {
        ProjectId: projectId,
        IpcId: ipcId,
        BoqItemId: line.BoqItemId,
        PricingBasis: line.basis,
        PrevQty: src?.prevQty ?? null,
        CumQty: src?.cumQty ?? null,
        CurrentQty: line.currentQty,
        PrevPct: src?.prevPct ?? null,
        CumPct: src?.cumPct ?? null,
        UnitRate: src?.UnitRate ?? null,
        EarnedCurrent: line.included ? line.earnedCurrent : 0,
        EarnedCumulative: line.included ? line.earnedCumulative : 0,
        QualityGateStatus: src?.QualityGateStatus || "passed",
        Status: line.included ? "claimed" : "rejected",
      }, userId, "IPCL");
    }

    for (const d of totals.deductions) {
      await r.create("IPC_Deduction", {
        ProjectId: projectId,
        IpcId: ipcId,
        DeductionType: d.DeductionType,
        BaseAmount: d.BaseAmount,
        RatePct: d.RatePct,
        Amount: d.Amount,
        IsStatutory: d.IsStatutory,
        NoteFa: d.NoteFa,
      }, userId, "IPCD");
    }

    res.status(201).json(cntOk(req, {
      id: ipcId,
      serialNo,
      workflowState: "draft",
      ...totals,
      ceiling,
    }));
  } catch (err) { next(err); }
});

/* اقدام گردش کار: ارسال، تأیید، رد، بازگشت برای اصلاح، پرداخت.
 *
 * مجوز لازم به خودِ اقدام بستگی دارد، پس اینجا داخل بدنه بررسی می‌شود
 * نه با یک میان‌افزار ثابت — ارسال کار پیمانکار است ولی تصویب کار
 * کارفرما، و یک مجوز واحد کل تفکیک وظیفه را از بین می‌برد. */
const CNT_ACTION_PERMISSION = {
  submit: "cnt.ipc.prepare",
  approve: null,
  reject: null,
  return_for_correction: null,
  pay: "cnt.ipc.approve",
};

app.post("/api/cnt/ipc/:id/action", async (req, res, next) => {
  try {
    const b = engBody(req);
    const projectId = String(req.query.projectId || b.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");

    const action = String(b.action || "");
    const actor = String(b.actor || "");
    const issues = engValidate(b, [
      { field: "action", titleFa: "اقدام", required: true, oneOf: ["submit", "approve", "reject", "return_for_correction", "pay"] },
      { field: "actor", titleFa: "نقش اقدام‌کننده", required: true, oneOf: ["contractor", "consultant", "employer"] },
    ]);
    if (issues.length) return cntInvalid(req, res, issues);

    const r = await repo();
    const userId = req.headers["x-user-id"] || "system";
    const ipc = await r.findOne("InterimPaymentCertificate", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "Id", op: "eq", value: String(req.params.id) },
    ]);
    if (!ipc) return cntBad(req, res, "E-CNT-NOT-FOUND", `صورت‌وضعیت ${req.params.id} یافت نشد`, 404);

    /* مجوز بر اساس نقشی که اقدام می‌کند، نه بر اساس نوع اقدام تنها. */
    const permission =
      CNT_ACTION_PERMISSION[action] ??
      (actor === "consultant" ? "cnt.ipc.review" : "cnt.ipc.approve");
    const subject = engSubject(req);
    const enforce = String(process.env.CNT_RBAC_ENFORCE ?? "1") !== "0";
    if (enforce) {
      if (!subject) {
        return res.status(401).json({ ok: false, error: { code: "E-CNT-AUTH-REQUIRED", message: "شناسهٔ کاربر برای این اقدام الزامی است", permission, traceId: req.requestId } });
      }
      const verdict = rbacEvaluate(subject, permission, { projectId: undefined });
      if (!verdict.allow) {
        return res.status(403).json({ ok: false, error: { code: "E-CNT-FORBIDDEN", message: `کاربر ${subject.displayName} مجوز «${permission}» را ندارد`, permission, traceId: req.requestId } });
      }
    }

    const move = ipcTransition(ipc.WorkflowState, action, actor);
    if (!move.ok) return cntBad(req, res, move.code, move.messageFa, 409);

    const steps = await r.list("IPC_WorkflowStep", {
      where: [{ column: "IpcId", op: "eq", value: String(ipc.Id) }],
      limit: 500,
    });
    const stepNo = steps.reduce((m, s) => Math.max(m, Number(s.StepNo) || 0), 0) + 1;
    const now = new Date().toISOString();

    await r.create("IPC_WorkflowStep", {
      ProjectId: projectId,
      IpcId: String(ipc.Id),
      StepNo: stepNo,
      Actor: actor,
      ActorUserId: String(userId),
      Action: action,
      ActedAt: now,
      CommentFa: b.commentFa ? String(b.commentFa) : null,
    }, userId, "IPCW");

    const patch = { WorkflowState: move.to };
    if (move.to === "contractor_submitted") patch.SubmittedAt = now.slice(0, 10);
    if (move.to === "consultant_approved") patch.ConsultantApprovedAt = now.slice(0, 10);
    if (move.to === "approved") patch.EmployerApprovedAt = now.slice(0, 10);
    if (move.to === "paid") patch.PaidAt = now.slice(0, 10);
    if (move.to === "rejected") patch.Status = "closed";

    await r.upsert("InterimPaymentCertificate", { Id: String(ipc.Id) }, patch, userId);

    res.json(cntOk(req, {
      id: String(ipc.Id),
      serialNo: ipc.SerialNo,
      from: move.from,
      workflowState: move.to,
      stepNo,
      locked: isIpcLocked(move.to),
      nextActions: ipcNextActions(move.to),
    }));
  } catch (err) { next(err); }
});

/* فهرست صورت‌وضعیت‌های یک پیمان. */
app.get("/api/cnt/ipc", cntRequire("cnt.contract.view"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    const contractId = String(req.query.contractId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");

    const where = [{ column: "ProjectId", op: "eq", value: projectId }];
    if (contractId) where.push({ column: "ContractId", op: "eq", value: contractId });

    const r = await repo();
    const rows = await r.list("InterimPaymentCertificate", { where, limit: 5000 });
    rows.sort((a, b2) => (Number(a.SerialNo) || 0) - (Number(b2.SerialNo) || 0));

    res.json(cntOk(req, {
      count: rows.length,
      items: rows.map((x) => ({
        id: x.Id,
        serialNo: x.SerialNo,
        periodCode: x.PeriodCode,
        workflowState: x.WorkflowState,
        workflowStateFa: IPC_WORKFLOW_FA[x.WorkflowState] ?? x.WorkflowState,
        grossCurrent: x.GrossCurrent,
        netPayable: x.NetPayable,
        locked: isIpcLocked(x.WorkflowState),
        nextActions: ipcNextActions(x.WorkflowState),
        status: x.Status,
      })),
    }));
  } catch (err) { next(err); }
});

/* جزئیات کامل یک صورت‌وضعیت با ردیف‌ها، کسورات و تاریخچهٔ گردش. */
app.get("/api/cnt/ipc/:id", cntRequire("cnt.contract.view"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");

    const r = await repo();
    const ipc = await r.findOne("InterimPaymentCertificate", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "Id", op: "eq", value: String(req.params.id) },
    ]);
    if (!ipc) return cntBad(req, res, "E-CNT-NOT-FOUND", `صورت‌وضعیت ${req.params.id} یافت نشد`, 404);

    const [lines, deductions, steps] = await Promise.all([
      r.list("IPC_LineItem", { where: [{ column: "IpcId", op: "eq", value: String(ipc.Id) }], limit: 20000 }),
      r.list("IPC_Deduction", { where: [{ column: "IpcId", op: "eq", value: String(ipc.Id) }], limit: 200 }),
      r.list("IPC_WorkflowStep", { where: [{ column: "IpcId", op: "eq", value: String(ipc.Id) }], limit: 500 }),
    ]);
    steps.sort((a, b2) => (Number(a.StepNo) || 0) - (Number(b2.StepNo) || 0));

    res.json(cntOk(req, {
      header: {
        ...ipc,
        workflowStateFa: IPC_WORKFLOW_FA[ipc.WorkflowState] ?? ipc.WorkflowState,
        locked: isIpcLocked(ipc.WorkflowState),
        nextActions: ipcNextActions(ipc.WorkflowState),
      },
      lines,
      deductions: deductions.map((d) => ({ ...d, typeFa: DEDUCTION_TYPE_FA[d.DeductionType] ?? d.DeductionType })),
      workflow: steps,
    }));
  } catch (err) { next(err); }
});

/* ── ۱۴٫۴ تعدیل و مابه‌التفاوت (D5) ── */

/* ثبت شاخص در کاتالوگ. انتشار عمداً اقدام جداست: شاخص پیش‌نویس نباید
 * ناخواسته مبنای صورت‌وضعیت مصوب شود (G-04). */
app.post("/api/cnt/index", cntRequire("cnt.contract.edit"), async (req, res, next) => {
  try {
    const b = engBody(req);
    const projectId = String(req.query.projectId || b.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");

    const issues = engValidate(b, [
      { field: "indexPeriod", titleFa: "دورهٔ شاخص", required: true, maxLen: 20 },
      { field: "chapterCode", titleFa: "کد فصل", required: true, maxLen: 20 },
      { field: "indexValue", titleFa: "مقدار شاخص", required: true, type: "number", min: 0 },
      { field: "status", titleFa: "وضعیت", oneOf: ["draft", "published", "superseded"] },
    ]);
    if (issues.length) return cntInvalid(req, res, issues);

    const r = await repo();
    const userId = req.headers["x-user-id"] || "system";
    const indexPeriod = String(b.indexPeriod).trim();
    const chapterCode = String(b.chapterCode).trim();

    const existing = await r.findOne("AdjustmentIndexCatalog", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "IndexPeriod", op: "eq", value: indexPeriod },
      { column: "ChapterCode", op: "eq", value: chapterCode },
    ]);

    const payload = {
      ProjectId: projectId,
      IndexPeriod: indexPeriod,
      ChapterCode: chapterCode,
      IndexValue: Number(b.indexValue),
      SourceFa: b.sourceFa ? String(b.sourceFa) : null,
      PublishedAt: b.publishedAt ? String(b.publishedAt) : null,
      Status: String(b.status || "draft"),
    };

    if (existing) {
      /* شاخصی که پای صورت‌وضعیت مصوب رفته دیگر ویرایش نمی‌شود؛ باید
       * نسخهٔ جدید منتشر و قبلی بازنگری‌شده علامت بخورد. */
      const used = await r.list("PriceAdjustmentCalculation", {
        where: [
          { column: "ProjectId", op: "eq", value: projectId },
          { column: "ChapterCode", op: "eq", value: chapterCode },
          { column: "Status", op: "eq", value: "approved" },
        ],
        limit: 10,
      });
      if (used.length && existing.Status === "published") {
        return cntBad(req, res, "E-CNT-INDEX-LOCKED", `شاخص فصل ${chapterCode} در محاسبهٔ مصوب استفاده شده و ویرایش نمی‌شود`, 409);
      }
      await r.upsert("AdjustmentIndexCatalog", { Id: String(existing.Id) }, payload, userId);
      return res.json(cntOk(req, { id: existing.Id, action: "updated", ...payload }));
    }

    const created = await r.create("AdjustmentIndexCatalog", payload, userId, "IDX");
    res.status(201).json(cntOk(req, { id: created.Id ?? created.id, action: "created", ...payload }));
  } catch (err) { next(err); }
});

app.get("/api/cnt/index", cntRequire("cnt.contract.view"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");

    const where = [{ column: "ProjectId", op: "eq", value: projectId }];
    if (req.query.indexPeriod) where.push({ column: "IndexPeriod", op: "eq", value: String(req.query.indexPeriod) });

    const r = await repo();
    const rows = await r.list("AdjustmentIndexCatalog", { where, limit: 5000 });
    res.json(cntOk(req, {
      count: rows.length,
      items: rows.map((x) => ({ ...x, statusFa: INDEX_STATUS_FA[x.Status] ?? x.Status })),
    }));
  } catch (err) { next(err); }
});

/* محاسبهٔ تعدیل یک صورت‌وضعیت بر مبنای کارکرد فصل‌های همان دوره. */
app.post("/api/cnt/ipc/:id/adjustment", cntRequire("cnt.ipc.prepare"), async (req, res, next) => {
  try {
    const b = engBody(req);
    const projectId = String(req.query.projectId || b.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");

    const issues = engValidate(b, [
      { field: "indexPeriod", titleFa: "دورهٔ شاخص", required: true, maxLen: 20 },
      { field: "baseIndexPeriod", titleFa: "دورهٔ مبنا", required: true, maxLen: 20 },
      { field: "appliedRatePct", titleFa: "ضریب اعمال", type: "number", min: 0 },
    ]);
    if (issues.length) return cntInvalid(req, res, issues);

    const r = await repo();
    const userId = req.headers["x-user-id"] || "system";

    const ipc = await r.findOne("InterimPaymentCertificate", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "Id", op: "eq", value: String(req.params.id) },
    ]);
    if (!ipc) return cntBad(req, res, "E-CNT-NOT-FOUND", `صورت‌وضعیت ${req.params.id} یافت نشد`, 404);
    if (isIpcLocked(ipc.WorkflowState)) {
      return cntBad(req, res, "E-CNT-IPC-LOCKED", `صورت‌وضعیت در وضعیت «${IPC_WORKFLOW_FA[ipc.WorkflowState] ?? ipc.WorkflowState}» قفل است`, 409);
    }

    /* کارکرد هر فصل از ردیف‌های همین صورت‌وضعیت می‌آید — دوره‌ای، نه
     * تجمعی (ADR-CNT-04). فصل از دو رقم اول شمارهٔ ردیف مشتق می‌شود. */
    const [lines, boq, catalog] = await Promise.all([
      r.list("IPC_LineItem", { where: [{ column: "IpcId", op: "eq", value: String(ipc.Id) }], limit: 20000 }),
      r.list("ContractBOQ_Item", {
        where: [
          { column: "ProjectId", op: "eq", value: projectId },
          { column: "ContractId", op: "eq", value: String(ipc.ContractId) },
        ],
        limit: 20000,
      }),
      r.list("AdjustmentIndexCatalog", { where: [{ column: "ProjectId", op: "eq", value: projectId }], limit: 5000 }),
    ]);

    const chapterOf = new Map(boq.map((x) => [String(x.Id), String(x.ChapterCode || String(x.ItemNo || "").slice(0, 2) || "00")]));
    const byChapter = new Map();
    for (const l of lines) {
      if (String(l.Status) === "rejected") continue;
      const ch = chapterOf.get(String(l.BoqItemId)) || "00";
      byChapter.set(ch, (byChapter.get(ch) || 0) + (Number(l.EarnedCurrent) || 0));
    }

    const batch = adjustmentBatch({
      chapters: [...byChapter].map(([chapterCode, workAmount]) => ({ chapterCode, workAmount })),
      catalog,
      indexPeriod: String(b.indexPeriod),
      baseIndexPeriod: String(b.baseIndexPeriod),
      appliedRatePct: b.appliedRatePct,
    });

    if (b.dryRun) return res.json(cntOk(req, { ipcId: String(ipc.Id), ...batch }));

    if (!batch.usable) {
      return res.status(409).json({
        ok: false,
        error: {
          code: batch.blocked[0]?.code || "E-CNT-NO-INDEX",
          message: batch.blocked[0]?.messageFa || "هیچ فصلی برای تعدیل یافت نشد",
          blocked: batch.blocked,
          traceId: req.requestId,
        },
      });
    }

    /* ایندکس یکتای (IpcId, ChapterCode) مانع تعدیل مضاعف است. */
    const prior = await r.list("PriceAdjustmentCalculation", {
      where: [{ column: "IpcId", op: "eq", value: String(ipc.Id) }],
      limit: 500,
    });
    const seen = new Set(prior.map((p) => String(p.ChapterCode)));

    const saved = [];
    for (const row of batch.rows) {
      if (seen.has(row.chapterCode)) continue;
      const created = await r.create("PriceAdjustmentCalculation", {
        ProjectId: projectId,
        ContractId: String(ipc.ContractId),
        IpcId: String(ipc.Id),
        ChapterCode: row.chapterCode,
        WorkAmount: row.workAmount,
        BaseIndex: row.baseIndex,
        PeriodIndex: row.periodIndex,
        AdjustmentFactor: row.adjustmentFactor,
        AdjustmentAmount: row.adjustmentAmount,
        AppliedRatePct: row.appliedRatePct,
        CalcNoteFa: row.calcNoteFa,
        Status: "draft",
      }, userId, "PADJ");
      saved.push({ id: created.Id ?? created.id, ...row });
    }

    /* سرآیند صورت‌وضعیت بازمحاسبه می‌شود تا خالص پرداختنی با تعدیل بخواند. */
    const allAdj = await r.list("PriceAdjustmentCalculation", {
      where: [{ column: "IpcId", op: "eq", value: String(ipc.Id) }],
      limit: 500,
    });
    const totalAdjustment = allAdj.reduce((s, a) => s + (Number(a.AdjustmentAmount) || 0), 0);

    const totals = computeIpc({
      lines: lines.filter((l) => String(l.Status) !== "rejected").map((l) => ({
        BoqItemId: String(l.BoqItemId),
        PricingBasis: l.PricingBasis,
        UnitRate: l.UnitRate,
        prevQty: l.PrevQty, cumQty: l.CumQty,
        prevPct: l.PrevPct, cumPct: l.CumPct,
        LumpSumAmount: null, LineAmount: null,
        QualityGateStatus: l.QualityGateStatus,
      })),
      adjustmentAmount: totalAdjustment,
      materialDiffAmount: Number(ipc.MaterialDiffAmount) || 0,
      deductions: b.deductions || {},
    });

    await r.upsert("InterimPaymentCertificate", { Id: String(ipc.Id) }, {
      AdjustmentAmount: totalAdjustment,
      SubtotalAmount: totals.subtotal,
      TotalDeductions: totals.totalDeductions,
      VatAmount: totals.vatAmount,
      NetPayable: totals.netPayable,
    }, userId);

    res.status(201).json(cntOk(req, {
      ipcId: String(ipc.Id),
      saved,
      skipped: batch.rows.length - saved.length,
      totalAdjustment,
      subtotal: totals.subtotal,
      netPayable: totals.netPayable,
    }));
  } catch (err) { next(err); }
});

/* ثبت مابه‌التفاوت مصالح — جدا از تعدیل شاخص نگه داشته می‌شود. */
app.post("/api/cnt/material-diff", cntRequire("cnt.ipc.prepare"), async (req, res, next) => {
  try {
    const b = engBody(req);
    const projectId = String(req.query.projectId || b.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");

    const issues = engValidate(b, [
      { field: "contractId", titleFa: "پیمان", required: true, maxLen: 80 },
      /* مابه‌التفاوت همیشه به یک صورت‌وضعیت گره می‌خورد: ایندکس یکتای
       * (IpcId, MaterialCode) مانع پرداخت دوبارهٔ یک قلم در یک دوره است.
       * بدون آن، همان میلگرد می‌توانست در دو رکورد جدا دو بار بیاید. */
      { field: "ipcId", titleFa: "صورت‌وضعیت", required: true, maxLen: 80 },
      { field: "materialCode", titleFa: "کد مصالح", required: true, maxLen: 40 },
      { field: "materialNameFa", titleFa: "نام مصالح", required: true, maxLen: 200 },
      { field: "quantity", titleFa: "مقدار", required: true, type: "number", min: 0 },
      { field: "baseRate", titleFa: "نرخ مبنا", required: true, type: "number", min: 0 },
      { field: "periodRate", titleFa: "نرخ دوره", required: true, type: "number", min: 0 },
    ]);
    if (issues.length) return cntInvalid(req, res, issues);

    const r = await repo();
    const userId = req.headers["x-user-id"] || "system";

    const ipc = await r.findOne("InterimPaymentCertificate", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "Id", op: "eq", value: String(b.ipcId) },
    ]);
    if (!ipc) return cntBad(req, res, "E-CNT-NOT-FOUND", `صورت‌وضعیت ${b.ipcId} یافت نشد`, 404);
    if (isIpcLocked(ipc.WorkflowState)) {
      return cntBad(req, res, "E-CNT-IPC-LOCKED", "صورت‌وضعیت قفل است و مابه‌التفاوت جدید نمی‌پذیرد", 409);
    }

    const dupe = await r.findOne("MaterialDiffCalc", [
      { column: "IpcId", op: "eq", value: String(b.ipcId) },
      { column: "MaterialCode", op: "eq", value: String(b.materialCode) },
    ]);
    if (dupe) {
      return cntBad(req, res, "E-CNT-DUP-MATERIAL", `مابه‌التفاوت ${b.materialCode} برای این صورت‌وضعیت ثبت شده است`, 409);
    }

    const calc = materialDiff({
      materialCode: String(b.materialCode),
      materialNameFa: String(b.materialNameFa),
      quantity: Number(b.quantity),
      baseRate: Number(b.baseRate),
      periodRate: Number(b.periodRate),
      unit: b.unit ? String(b.unit) : null,
    });

    const created = await r.create("MaterialDiffCalc", {
      ProjectId: projectId,
      ContractId: String(b.contractId),
      IpcId: String(b.ipcId),
      MaterialCode: calc.materialCode,
      MaterialNameFa: calc.materialNameFa,
      Quantity: calc.quantity,
      Unit: calc.unit,
      BaseRate: calc.baseRate,
      PeriodRate: calc.periodRate,
      DiffAmount: calc.diffAmount,
      EvidenceDocNo: b.evidenceDocNo ? String(b.evidenceDocNo) : null,
      Status: "draft",
    }, userId, "MDIF");

    res.status(201).json(cntOk(req, { id: created.Id ?? created.id, ...calc }));
  } catch (err) { next(err); }
});

/* ── ۱۴٫۵ دفتر سپرده و آزادسازی روی رویداد تحویل (D6 · رفع G-01) ── */

app.get("/api/cnt/retainage", cntRequire("cnt.contract.view"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    const contractId = String(req.query.contractId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");
    if (!contractId) return cntBad(req, res, "E-CNT-NO-CONTRACT", "پارامتر contractId الزامی است");

    const r = await repo();
    const rows = await r.list("RetainageLedger", {
      where: [
        { column: "ProjectId", op: "eq", value: projectId },
        { column: "ContractId", op: "eq", value: contractId },
      ],
      limit: 20000,
    });
    rows.sort((a, b) => String(a.EntryDate ?? "").localeCompare(String(b.EntryDate ?? "")));

    res.json(cntOk(req, {
      contractId,
      ...retainageBalance(rows),
      entries: rows.map((x) => ({ ...x, entryTypeFa: RETAINAGE_ENTRY_FA[x.EntryType] ?? x.EntryType })),
    }));
  } catch (err) { next(err); }
});

/* انباشت سپرده از کسور یک صورت‌وضعیت به دفتر. */
app.post("/api/cnt/retainage/accrue", cntRequire("cnt.retainage.manage"), async (req, res, next) => {
  try {
    const b = engBody(req);
    const projectId = String(req.query.projectId || b.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");

    const issues = engValidate(b, [
      { field: "ipcId", titleFa: "صورت‌وضعیت", required: true, maxLen: 80 },
    ]);
    if (issues.length) return cntInvalid(req, res, issues);

    const r = await repo();
    const userId = req.headers["x-user-id"] || "system";

    const ipc = await r.findOne("InterimPaymentCertificate", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "Id", op: "eq", value: String(b.ipcId) },
    ]);
    if (!ipc) return cntBad(req, res, "E-CNT-NOT-FOUND", `صورت‌وضعیت ${b.ipcId} یافت نشد`, 404);

    /* فقط صورت‌وضعیت مصوب سپرده انباشته می‌کند: سپردهٔ پیش‌نویس هنوز
     * از کسی کسر نشده و ثبتش دفتر را از واقعیت جدا می‌کند. */
    if (!["approved", "paid"].includes(String(ipc.WorkflowState))) {
      return cntBad(req, res, "E-CNT-IPC-NOT-APPROVED", "سپرده تنها از صورت‌وضعیت مصوب انباشته می‌شود", 409);
    }

    const ded = await r.findOne("IPC_Deduction", [
      { column: "IpcId", op: "eq", value: String(ipc.Id) },
      { column: "DeductionType", op: "eq", value: "retainage" },
    ]);
    if (!ded || !(Number(ded.Amount) > 0)) {
      return cntBad(req, res, "E-CNT-NO-RETAINAGE", "این صورت‌وضعیت کسور سپرده ندارد", 409);
    }

    const existing = await r.list("RetainageLedger", {
      where: [
        { column: "ProjectId", op: "eq", value: projectId },
        { column: "ContractId", op: "eq", value: String(ipc.ContractId) },
      ],
      limit: 20000,
    });

    /* ایدمپوتنت: هر صورت‌وضعیت فقط یک بار انباشت می‌سازد. */
    if (existing.some((e) => String(e.IpcId) === String(ipc.Id) && e.EntryType === "accrual" && e.Status !== "reversed")) {
      return cntBad(req, res, "E-CNT-DUP-ACCRUAL", `سپردهٔ صورت‌وضعیت ${ipc.SerialNo} پیش‌تر انباشته شده است`, 409);
    }

    const before = retainageBalance(existing);
    const amount = Number(ded.Amount);
    const created = await r.create("RetainageLedger", {
      ProjectId: projectId,
      ContractId: String(ipc.ContractId),
      IpcId: String(ipc.Id),
      EntryType: "accrual",
      Amount: amount,
      BalanceAfter: Math.round((before.balance + amount) * 100) / 100,
      TriggerEvent: "ipc_approved",
      TriggerDocNo: `IPC-${ipc.SerialNo}`,
      EntryDate: new Date().toISOString().slice(0, 10),
      Status: "posted",
    }, userId, "RET");

    res.status(201).json(cntOk(req, {
      id: created.Id ?? created.id,
      amount,
      balanceAfter: Math.round((before.balance + amount) * 100) / 100,
    }));
  } catch (err) { next(err); }
});

/* آزادسازی سپرده روی گواهی تحویل — قلاب رویدادی ADR-CNT-09.
 *
 * این همان نقطه‌ای است که G-01 را می‌بست: بدون PAC/FAC واقعی، آزادسازی
 * ۵۰/۵۰ قابل پیاده‌سازی نبود. حالا گواهی مدرک محرک است و شمارهٔ آن در
 * دفتر ثبت می‌شود تا در ممیزی ردیابی شود. */
app.post("/api/cnt/retainage/release", cntRequire("cnt.retainage.manage"), async (req, res, next) => {
  try {
    const b = engBody(req);
    const projectId = String(req.query.projectId || b.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");

    const issues = engValidate(b, [
      { field: "contractId", titleFa: "پیمان", required: true, maxLen: 80 },
      { field: "certificateId", titleFa: "گواهی تحویل", required: true, maxLen: 80 },
      { field: "pacSharePct", titleFa: "درصد آزادسازی", type: "number", min: 0 },
    ]);
    if (issues.length) return cntInvalid(req, res, issues);

    const r = await repo();
    const userId = req.headers["x-user-id"] || "system";
    const contractId = String(b.contractId);

    const cert = await r.findOne("CompletionCertificate", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "Id", op: "eq", value: String(b.certificateId) },
    ]);
    if (!cert) return cntBad(req, res, "E-CNT-NOT-FOUND", `گواهی ${b.certificateId} یافت نشد`, 404);
    if (String(cert.Status) !== "issued") {
      return cntBad(req, res, "E-CNT-CERT-NOT-ISSUED", "گواهی صادر نشده و مبنای آزادسازی نیست", 409);
    }
    /* گواهی پیمان دیگر نباید سپردهٔ این پیمان را آزاد کند. */
    if (cert.ContractId && String(cert.ContractId) !== contractId) {
      return cntBad(req, res, "E-CNT-CERT-OTHER-CONTRACT", "گواهی به پیمان دیگری تعلق دارد", 409);
    }

    const entries = await r.list("RetainageLedger", {
      where: [
        { column: "ProjectId", op: "eq", value: projectId },
        { column: "ContractId", op: "eq", value: contractId },
      ],
      limit: 20000,
    });

    const event = String(cert.CertificateType) === "fac" ? "fac" : "pac";
    const plan = planRetainageRelease({ entries, event, pacSharePct: b.pacSharePct });

    if (b.dryRun) return res.json(cntOk(req, { event, ...plan }));
    if (!plan.ok) {
      return res.status(409).json({ ok: false, error: { code: plan.code, message: plan.messageFa, traceId: req.requestId } });
    }

    const created = await r.create("RetainageLedger", {
      ProjectId: projectId,
      ContractId: contractId,
      IpcId: null,
      EntryType: plan.entryType,
      Amount: plan.releaseAmount,
      BalanceAfter: plan.balanceAfter,
      TriggerEvent: event === "fac" ? "fac_issued" : "pac_issued",
      TriggerDocNo: String(cert.CertificateNo),
      EntryDate: new Date().toISOString().slice(0, 10),
      Status: "posted",
    }, userId, "RET");

    res.status(201).json(cntOk(req, {
      id: created.Id ?? created.id,
      event,
      entryType: plan.entryType,
      releaseAmount: plan.releaseAmount,
      balanceBefore: plan.balanceBefore,
      balanceAfter: plan.balanceAfter,
      triggerDocNo: String(cert.CertificateNo),
    }));
  } catch (err) { next(err); }
});

/* ── راه‌اندازی و تحویل نهایی: PAC/FAC (d15) ── */

function comRequire(permission) {
  return (req, res, next) => {
    const enforce = String(process.env.CNT_RBAC_ENFORCE ?? "1") !== "0";
    const subject = engSubject(req);
    if (!subject) {
      if (!enforce) return next();
      return res.status(401).json({ ok: false, error: { code: "E-CNT-AUTH-REQUIRED", message: "شناسهٔ کاربر برای این اقدام الزامی است", permission, traceId: req.requestId } });
    }
    const verdict = rbacEvaluate(subject, permission, { projectId: undefined });
    if (!verdict.allow) {
      if (!enforce) return next();
      return res.status(403).json({ ok: false, error: { code: "E-CNT-FORBIDDEN", message: `کاربر ${subject.displayName} مجوز «${permission}» را ندارد`, permission, traceId: req.requestId } });
    }
    return next();
  };
}

/* ثبت نقص فهرست تحویل. */
app.post("/api/com/punch", comRequire("com.punch.record"), async (req, res, next) => {
  try {
    const b = engBody(req);
    const projectId = String(req.query.projectId || b.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");

    const issues = engValidate(b, [
      { field: "itemNo", titleFa: "شمارهٔ نقص", required: true, maxLen: 40 },
      { field: "titleFa", titleFa: "شرح", required: true, maxLen: 600 },
      { field: "category", titleFa: "دسته", required: true, oneOf: ["a", "b", "c"] },
      { field: "status", titleFa: "وضعیت", oneOf: ["open", "in_progress", "closed", "waived"] },
    ]);
    if (issues.length) return cntInvalid(req, res, issues);

    const r = await repo();
    const userId = req.headers["x-user-id"] || "system";
    const itemNo = String(b.itemNo).trim();

    const dupe = await r.findOne("PunchListItem", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "ItemNo", op: "eq", value: itemNo },
    ]);
    if (dupe) return cntBad(req, res, "E-CNT-DUP-ITEM", `نقص ${itemNo} پیش‌تر ثبت شده است`, 409);

    const created = await r.create("PunchListItem", {
      ProjectId: projectId,
      CertificateId: b.certificateId ? String(b.certificateId) : null,
      ContractId: b.contractId ? String(b.contractId) : null,
      ItemNo: itemNo,
      TitleFa: String(b.titleFa),
      Category: String(b.category).toLowerCase(),
      DisciplineCode: b.disciplineCode ? String(b.disciplineCode) : null,
      LocationFa: b.locationFa ? String(b.locationFa) : null,
      RaisedBy: String(userId),
      RaisedAt: b.raisedAt ? String(b.raisedAt) : new Date().toISOString().slice(0, 10),
      DueDate: b.dueDate ? String(b.dueDate) : null,
      Status: String(b.status || "open"),
    }, userId, "PUNCH");

    res.status(201).json(cntOk(req, { id: created.Id ?? created.id, itemNo, category: String(b.category).toLowerCase() }));
  } catch (err) { next(err); }
});

/* بستن یا صرف‌نظر از نقص. */
app.post("/api/com/punch/:id/close", comRequire("com.punch.record"), async (req, res, next) => {
  try {
    const b = engBody(req);
    const projectId = String(req.query.projectId || b.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");

    const r = await repo();
    const userId = req.headers["x-user-id"] || "system";
    const item = await r.findOne("PunchListItem", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "Id", op: "eq", value: String(req.params.id) },
    ]);
    if (!item) return cntBad(req, res, "E-CNT-NOT-FOUND", `نقص ${req.params.id} یافت نشد`, 404);

    const status = String(b.status || "closed");
    if (!["closed", "waived"].includes(status)) {
      return cntInvalid(req, res, [{ field: "status", code: "CNT-PUNCH-BAD-STATUS", messageFa: "وضعیت باید closed یا waived باشد" }]);
    }
    /* صرف‌نظر از نقص تصمیم رسمی است و بدون دلیل ثبت نمی‌شود. */
    if (status === "waived" && !b.reasonFa) {
      return cntInvalid(req, res, [{ field: "reasonFa", code: "CNT-PUNCH-NO-REASON", messageFa: "صرف‌نظر از نقص بدون ثبت دلیل ممکن نیست" }]);
    }

    await r.upsert("PunchListItem", { Id: String(item.Id) }, {
      Status: status,
      ClosedAt: new Date().toISOString().slice(0, 10),
      ClosedBy: String(userId),
      EvidenceDocNo: b.evidenceDocNo ? String(b.evidenceDocNo) : null,
    }, userId);

    res.json(cntOk(req, { id: String(item.Id), itemNo: item.ItemNo, status }));
  } catch (err) { next(err); }
});

app.get("/api/com/punch", comRequire("com.certificate.view"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");

    const where = [{ column: "ProjectId", op: "eq", value: projectId }];
    if (req.query.contractId) where.push({ column: "ContractId", op: "eq", value: String(req.query.contractId) });

    const r = await repo();
    const rows = await r.list("PunchListItem", { where, limit: 20000 });
    res.json(cntOk(req, {
      count: rows.length,
      summary: comPunchSummary(rows),
      items: rows.map((x) => ({ ...x, categoryFa: PUNCH_CATEGORY_FA[String(x.Category).toLowerCase()] ?? x.Category })),
    }));
  } catch (err) { next(err); }
});

/* صدور گواهی تحویل موقت یا قطعی. */
app.post("/api/com/certificate", comRequire("com.certificate.issue"), async (req, res, next) => {
  try {
    const b = engBody(req);
    const projectId = String(req.query.projectId || b.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");

    const issues = engValidate(b, [
      { field: "certificateType", titleFa: "نوع گواهی", required: true, oneOf: ["pac", "fac"] },
      { field: "certificateNo", titleFa: "شمارهٔ گواهی", required: true, maxLen: 80 },
      { field: "titleFa", titleFa: "عنوان", required: true, maxLen: 400 },
      { field: "handoverDate", titleFa: "تاریخ تحویل", required: true, maxLen: 30 },
      { field: "warrantyMonths", titleFa: "دورهٔ تضمین", type: "number", min: 0 },
    ]);
    if (issues.length) return cntInvalid(req, res, issues);

    const r = await repo();
    const userId = req.headers["x-user-id"] || "system";
    const type = String(b.certificateType).toLowerCase();
    const certificateNo = String(b.certificateNo).trim();
    const contractId = b.contractId ? String(b.contractId) : null;

    const dupe = await r.findOne("CompletionCertificate", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "CertificateNo", op: "eq", value: certificateNo },
    ]);
    if (dupe) return cntBad(req, res, "E-CNT-DUP-CODE", `گواهی ${certificateNo} پیش‌تر ثبت شده است`, 409);

    const [punchRows, certs] = await Promise.all([
      r.list("PunchListItem", {
        where: [{ column: "ProjectId", op: "eq", value: projectId }],
        limit: 20000,
      }),
      r.list("CompletionCertificate", {
        where: [{ column: "ProjectId", op: "eq", value: projectId }],
        limit: 1000,
      }),
    ]);

    /* نواقص همان پیمان سنجیده می‌شوند؛ نقص بی‌ارجاع به پیمان، در سطح
     * پروژه است و همیشه شمرده می‌شود. */
    const scoped = punchRows.filter(
      (x) => !contractId || !x.ContractId || String(x.ContractId) === contractId,
    );

    const pac = certs.find(
      (x) => String(x.CertificateType) === "pac" &&
        String(x.Status) === "issued" &&
        (!contractId || String(x.ContractId ?? "") === contractId),
    );

    const gate = certificateGate({
      type,
      punchItems: scoped,
      hasPac: Boolean(pac),
      warrantyEnded: b.warrantyEnded,
    });

    if (b.dryRun) return res.json(cntOk(req, { gate, wouldIssue: gate.ok }));
    if (!gate.ok) {
      return res.status(409).json({
        ok: false,
        error: { code: gate.code, message: gate.messageFa, punch: gate.punch, traceId: req.requestId },
      });
    }

    const handoverDate = String(b.handoverDate);
    const warrantyMonths = b.warrantyMonths == null ? null : Number(b.warrantyMonths);

    const created = await r.create("CompletionCertificate", {
      ProjectId: projectId,
      ContractId: contractId,
      CertificateType: type,
      CertificateNo: certificateNo,
      TitleFa: String(b.titleFa),
      HandoverDate: handoverDate,
      IssueDate: b.issueDate ? String(b.issueDate) : new Date().toISOString().slice(0, 10),
      WarrantyMonths: warrantyMonths,
      WarrantyEndDate: type === "pac" && warrantyMonths ? warrantyEnd(handoverDate, warrantyMonths) : null,
      PredecessorId: type === "fac" && pac ? String(pac.Id) : null,
      OpenPunchCount: gate.punch.open,
      CommitteeFa: b.committeeFa ? String(b.committeeFa) : null,
      NoteFa: b.noteFa ? String(b.noteFa) : null,
      Status: "issued",
    }, userId, "CERT");

    res.status(201).json(cntOk(req, {
      id: created.Id ?? created.id,
      certificateType: type,
      certificateNo,
      warrantyEndDate: type === "pac" && warrantyMonths ? warrantyEnd(handoverDate, warrantyMonths) : null,
      punch: gate.punch,
    }));
  } catch (err) { next(err); }
});

app.get("/api/com/certificate", comRequire("com.certificate.view"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");

    const r = await repo();
    const rows = await r.list("CompletionCertificate", {
      where: [{ column: "ProjectId", op: "eq", value: projectId }],
      limit: 1000,
    });
    res.json(cntOk(req, {
      count: rows.length,
      items: rows.map((x) => ({ ...x, typeFa: CERTIFICATE_TYPE_FA[x.CertificateType] ?? x.CertificateType })),
    }));
  } catch (err) { next(err); }
});

/* ══════════════════ MOD-13 · D3 تفکیک سیستمی ══════════════════ */

/** درخت سیستم‌های یک پروژه؛ پایهٔ همهٔ پرس‌وجوهای این بخش. */
async function comSystems(r, projectId) {
  return await r.list("SystemSubsystem", { where: [{ column: "ProjectId", op: "eq", value: projectId }] });
}

function comDecorate(node) {
  return {
    ...node,
    typeFa: SYSTEM_TYPE_FA[node.SystemType] ?? node.SystemType,
    statusFa: SYSTEM_STATUS_FA[node.Status] ?? node.Status,
    criticalityLabelFa: node.CriticalityFa ? (CRITICALITY_FA[node.CriticalityFa] ?? node.CriticalityFa) : null,
  };
}

app.post("/api/com/system", comRequire("com.system.edit"), async (req, res, next) => {
  try {
    const b = engBody(req);
    const projectId = String(req.query.projectId || b.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");

    const errors = validateSystemInput({
      systemCode: b.systemCode,
      titleFa: b.titleFa,
      systemType: b.systemType,
      status: b.status ?? "planned",
      criticalityFa: b.criticalityFa ?? null,
      commissioningPriority: b.commissioningPriority ?? null,
    });
    if (errors.length)
      return res.status(422).json({ ok: false, error: { code: errors[0].code, message: errors[0].message, details: errors, traceId: req.requestId } });

    const r = await repo();
    const userId = req.headers["x-user-id"] || "system";
    const code = String(b.systemCode).trim();

    const dupe = await r.findOne("SystemSubsystem", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "SystemCode", op: "eq", value: code },
    ]);
    if (dupe) return cntBad(req, res, "E-COM-DUP-SYSTEM", `سیستم با کد ${code} پیش‌تر ثبت شده است`, 409);

    const parentId = b.parentId ? String(b.parentId) : null;
    if (parentId) {
      const parent = await r.findOne("SystemSubsystem", [{ column: "Id", op: "eq", value: parentId }]);
      if (!parent) return cntBad(req, res, "E-COM-PARENT-NOT-FOUND", "سیستم والد یافت نشد", 404);
      if (parent.ProjectId !== projectId)
        return cntBad(req, res, "E-COM-PARENT-OTHER-PROJECT", "سیستم والد به پروژهٔ دیگری تعلق دارد", 409);
    }

    const created = await r.create("SystemSubsystem", {
      ProjectId: projectId,
      ParentId: parentId,
      SystemCode: code,
      TitleFa: String(b.titleFa),
      TitleEn: b.titleEn ? String(b.titleEn) : null,
      SystemType: String(b.systemType),
      DisciplineCode: b.disciplineCode ? String(b.disciplineCode) : null,
      CommissioningPriority: b.commissioningPriority != null ? Number(b.commissioningPriority) : null,
      CriticalityFa: b.criticalityFa ? String(b.criticalityFa) : null,
      OwnerUserId: b.ownerUserId ? String(b.ownerUserId) : null,
      SortOrder: b.sortOrder != null ? Number(b.sortOrder) : null,
      Status: String(b.status ?? "planned"),
    }, userId, "SYS");

    res.status(201).json(cntOk(req, { id: created.Id, item: comDecorate(created) }));
  } catch (err) { next(err); }
});

/** جابه‌جایی گره در درخت؛ تنها راه تغییر والد، تا بررسی حلقه دور زده نشود. */
app.post("/api/com/system/:id/move", comRequire("com.system.edit"), async (req, res, next) => {
  try {
    const b = engBody(req);
    const projectId = String(req.query.projectId || b.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");

    const r = await repo();
    const node = await r.findOne("SystemSubsystem", [{ column: "Id", op: "eq", value: String(req.params.id) }]);
    if (!node) return cntBad(req, res, "E-COM-SYSTEM-NOT-FOUND", "سیستم یافت نشد", 404);

    const newParentId = b.parentId ? String(b.parentId) : null;
    const all = await comSystems(r, projectId);

    if (newParentId) {
      const parent = all.find((x) => x.Id === newParentId);
      if (!parent) return cntBad(req, res, "E-COM-PARENT-NOT-FOUND", "سیستم والد یافت نشد", 404);
    }
    const cyc = detectCycle(all, node.Id, newParentId);
    if (cyc) return cntBad(req, res, cyc.code, cyc.message, 409);

    const userId = req.headers["x-user-id"] || "system";
    const saved = await r.upsert("SystemSubsystem", { Id: node.Id }, { ...node, ParentId: newParentId }, userId);
    res.json(cntOk(req, { item: comDecorate(saved?.row ?? { ...node, ParentId: newParentId }) }));
  } catch (err) { next(err); }
});

app.get("/api/com/system", comRequire("com.system.view"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");
    const r = await repo();
    const rows = await comSystems(r, projectId);
    const { roots, orphans } = buildSystemTree(rows);
    const flat = flattenTree(roots);
    res.json(cntOk(req, {
      count: rows.length,
      orphans,
      tree: roots,
      items: flat.map((n) => ({ ...comDecorate(n), depth: n.depth, path: n.path, descendantCount: n.descendantCount, children: undefined })),
    }));
  } catch (err) { next(err); }
});

app.post("/api/com/system/:id/boundary", comRequire("com.system.edit"), async (req, res, next) => {
  try {
    const b = engBody(req);
    const projectId = String(req.query.projectId || b.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");

    const errors = validateBoundary({ targetKind: b.targetKind, targetRef: b.targetRef });
    if (errors.length)
      return res.status(422).json({ ok: false, error: { code: errors[0].code, message: errors[0].message, details: errors, traceId: req.requestId } });

    const r = await repo();
    const systemId = String(req.params.id);
    const sys = await r.findOne("SystemSubsystem", [{ column: "Id", op: "eq", value: systemId }]);
    if (!sys) return cntBad(req, res, "E-COM-SYSTEM-NOT-FOUND", "سیستم یافت نشد", 404);

    const kind = String(b.targetKind);
    const ref = String(b.targetRef).trim();
    const existing = await r.list("SystemBoundaryMapping", { where: [{ column: "SystemId", op: "eq", value: systemId }] });
    if (existing.some((x) => x.TargetKind === kind && x.TargetRef === ref))
      return cntBad(req, res, "E-COM-DUP-BOUNDARY", "این مرز پیش‌تر برای همین سیستم ثبت شده است", 409);

    const isPrimary = b.isPrimary === true || b.isPrimary === 1 || b.isPrimary === "true";
    if (isPrimary) {
      const conflict = assertSinglePrimary([...existing, { Id: "new", SystemId: systemId, TargetKind: kind, TargetRef: ref, IsPrimary: true }], systemId);
      if (conflict) return cntBad(req, res, conflict.code, conflict.message, 409);
    }

    const userId = req.headers["x-user-id"] || "system";
    const created = await r.create("SystemBoundaryMapping", {
      ProjectId: projectId,
      SystemId: systemId,
      TargetKind: kind,
      TargetRef: ref,
      BoundaryNoteFa: b.boundaryNoteFa ? String(b.boundaryNoteFa) : null,
      IsPrimary: isPrimary,
    }, userId, "BND");

    res.status(201).json(cntOk(req, {
      id: created.Id,
      item: { ...created, kindFa: BOUNDARY_KIND_FA[kind] ?? kind },
      coverage: boundaryCoverage([...existing, created], systemId),
    }));
  } catch (err) { next(err); }
});

app.get("/api/com/system/:id/boundary", comRequire("com.system.view"), async (req, res, next) => {
  try {
    const r = await repo();
    const systemId = String(req.params.id);
    const rows = await r.list("SystemBoundaryMapping", { where: [{ column: "SystemId", op: "eq", value: systemId }] });
    res.json(cntOk(req, {
      count: rows.length,
      items: rows.map((x) => ({ ...x, kindFa: BOUNDARY_KIND_FA[x.TargetKind] ?? x.TargetKind })),
      coverage: boundaryCoverage(rows, systemId),
    }));
  } catch (err) { next(err); }
});

app.post("/api/com/system/:id/milestone", comRequire("com.milestone.manage"), async (req, res, next) => {
  try {
    const b = engBody(req);
    const projectId = String(req.query.projectId || b.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");

    const errors = validateMilestone({ gateType: b.gateType, targetDate: b.targetDate });
    if (errors.length)
      return res.status(422).json({ ok: false, error: { code: errors[0].code, message: errors[0].message, details: errors, traceId: req.requestId } });

    const r = await repo();
    const systemId = String(req.params.id);
    const sys = await r.findOne("SystemSubsystem", [{ column: "Id", op: "eq", value: systemId }]);
    if (!sys) return cntBad(req, res, "E-COM-SYSTEM-NOT-FOUND", "سیستم یافت نشد", 404);

    const gateType = String(b.gateType).toLowerCase();
    const targetDate = String(b.targetDate);
    const existing = await r.list("SystemMilestoneTarget", { where: [{ column: "SystemId", op: "eq", value: systemId }] });

    /* ترتیب زمانی دروازه‌ها پیش از نوشتن بررسی می‌شود: تحویل موقت نمی‌تواند
       پیش از تکمیل مکانیکی برنامه‌ریزی شود. */
    const merged = [...existing.filter((x) => x.GateType !== gateType), { Id: "new", SystemId: systemId, GateType: gateType, TargetDate: targetDate }];
    const seqErrors = validateGateSequence(merged);
    if (seqErrors.length) return cntBad(req, res, seqErrors[0].code, seqErrors[0].message, 409);

    const prior = existing.find((x) => x.GateType === gateType);
    const userId = req.headers["x-user-id"] || "system";
    const payload = {
      ProjectId: projectId,
      SystemId: systemId,
      GateType: gateType,
      TargetDate: targetDate,
      ForecastDate: b.forecastDate ? String(b.forecastDate) : (prior?.ForecastDate ?? null),
      ActualDate: b.actualDate ? String(b.actualDate) : (prior?.ActualDate ?? null),
      NoteFa: b.noteFa ? String(b.noteFa) : null,
    };
    const slip = gateSlip({ Id: "x", SystemId: systemId, GateType: gateType, TargetDate: payload.TargetDate, ForecastDate: payload.ForecastDate, ActualDate: payload.ActualDate });
    payload.SlipDays = slip.slipDays;

    const saved = prior
      ? (await r.upsert("SystemMilestoneTarget", { Id: prior.Id }, { ...prior, ...payload }, userId))?.row
      : await r.create("SystemMilestoneTarget", payload, userId, "MST");
    const row = saved ?? { ...(prior ?? {}), ...payload };

    res.status(prior ? 200 : 201).json(cntOk(req, {
      id: row.Id ?? prior?.Id,
      replaced: Boolean(prior),
      item: { ...row, gateFa: COM_GATE_TYPE_FA[gateType] ?? gateType },
      slip,
    }));
  } catch (err) { next(err); }
});

/** برنامهٔ تحویل کل پروژه با لغزش هر دروازه. */
app.get("/api/com/plan", comRequire("com.system.view"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");
    const r = await repo();
    const systems = await comSystems(r, projectId);
    const milestones = await r.list("SystemMilestoneTarget", { where: [{ column: "ProjectId", op: "eq", value: projectId }] });
    const boundaries = await r.list("SystemBoundaryMapping", { where: [{ column: "ProjectId", op: "eq", value: projectId }] });

    const readiness = {};
    for (const s of systems) {
      const cov = boundaryCoverage(boundaries, s.Id);
      const hasMilestone = milestones.some((m) => m.SystemId === s.Id);
      readiness[s.Id] = (cov.total > 0 ? 50 : 0) + (hasMilestone ? 50 : 0);
    }

    res.json(cntOk(req, {
      gates: COM_GATE_ORDER.map((g) => ({ code: g, titleFa: COM_GATE_TYPE_FA[g] })),
      summary: systemizationSummary(systems, boundaries, milestones),
      plan: completionPlan(systems, milestones),
      priority: priorityMatrix(systems, readiness),
    }));
  } catch (err) { next(err); }
});

/** ماتریس سیستمی برای خروجی اکسل و گزارش A4. */
app.get("/api/com/matrix", comRequire("com.system.view"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");
    const r = await repo();
    const systems = await comSystems(r, projectId);
    const boundaries = await r.list("SystemBoundaryMapping", { where: [{ column: "ProjectId", op: "eq", value: projectId }] });
    const milestones = await r.list("SystemMilestoneTarget", { where: [{ column: "ProjectId", op: "eq", value: projectId }] });
    const rows = systemizationMatrix(systems, boundaries, milestones);
    res.json(cntOk(req, { count: rows.length, columns: rows.length ? Object.keys(rows[0]) : [], rows }));
  } catch (err) { next(err); }
});

/* ══════════════════ MOD-13 · D4 پیش‌راه‌اندازی و آزمون سرد ══════════════════ */

app.post("/api/com/pack", comRequire("com.checksheet.record"), async (req, res, next) => {
  try {
    const b = engBody(req);
    const projectId = String(req.query.projectId || b.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");

    const errors = validatePackInput({ packNo: b.packNo, titleFa: b.titleFa, packType: b.packType, status: b.status ?? "draft" });
    if (errors.length)
      return res.status(422).json({ ok: false, error: { code: errors[0].code, message: errors[0].message, details: errors, traceId: req.requestId } });

    const r = await repo();
    const systemId = String(b.systemId || "");
    const sys = systemId ? await r.findOne("SystemSubsystem", [{ column: "Id", op: "eq", value: systemId }]) : null;
    if (!sys) return cntBad(req, res, "E-COM-SYSTEM-NOT-FOUND", "بستهٔ آزمون باید به یک سیستم تعریف‌شده وصل باشد", 404);
    if (sys.ProjectId !== projectId)
      return cntBad(req, res, "E-COM-SYSTEM-OTHER-PROJECT", "سیستم به پروژهٔ دیگری تعلق دارد", 409);

    const packNo = String(b.packNo).trim();
    const dupe = await r.findOne("CheckRecordPack", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "PackNo", op: "eq", value: packNo },
    ]);
    if (dupe) return cntBad(req, res, "E-COM-DUP-PACK", `بستهٔ آزمون ${packNo} پیش‌تر ثبت شده است`, 409);

    const userId = req.headers["x-user-id"] || "system";
    const created = await r.create("CheckRecordPack", {
      ProjectId: projectId,
      SystemId: systemId,
      PackNo: packNo,
      TitleFa: String(b.titleFa),
      PackType: String(b.packType),
      DisciplineCode: b.disciplineCode ? String(b.disciplineCode) : null,
      TotalSheets: 0,
      ClearedSheets: 0,
      NoteFa: b.noteFa ? String(b.noteFa) : null,
      Status: String(b.status ?? "draft"),
    }, userId, "TP");

    res.status(201).json(cntOk(req, {
      id: created.Id,
      item: { ...created, typeFa: PACK_TYPE_FA[created.PackType], statusFa: PACK_STATUS_FA[created.Status] },
      allowedTestKinds: TEST_KINDS_BY_TYPE[created.PackType].map((k) => ({ code: k, titleFa: TEST_KIND_FA[k] })),
    }));
  } catch (err) { next(err); }
});

app.get("/api/com/pack", comRequire("com.system.view"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");
    const r = await repo();
    let packs = await r.list("CheckRecordPack", { where: [{ column: "ProjectId", op: "eq", value: projectId }] });
    if (req.query.systemId) packs = packs.filter((p) => p.SystemId === String(req.query.systemId));
    if (req.query.packType) packs = packs.filter((p) => p.PackType === String(req.query.packType));

    const sheets = await r.list("CheckSheet", { where: [{ column: "ProjectId", op: "eq", value: projectId }] });
    res.json(cntOk(req, {
      count: packs.length,
      items: packs.map((p) => ({
        ...p,
        typeFa: PACK_TYPE_FA[p.PackType] ?? p.PackType,
        statusFa: PACK_STATUS_FA[p.Status] ?? p.Status,
        progress: packProgress(p.Id, sheets),
      })),
    }));
  } catch (err) { next(err); }
});

/** ثبت برگهٔ آزمون همراه ردیف‌های پارامتر؛ برگه بدون ردیف پذیرفته نمی‌شود. */
app.post("/api/com/sheet", comRequire("com.checksheet.record"), async (req, res, next) => {
  try {
    const b = engBody(req);
    const projectId = String(req.query.projectId || b.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");

    const r = await repo();
    const packId = String(b.packId || "");
    const pack = packId ? await r.findOne("CheckRecordPack", [{ column: "Id", op: "eq", value: packId }]) : null;
    if (!pack) return cntBad(req, res, "E-COM-PACK-NOT-FOUND", "بستهٔ آزمون یافت نشد", 404);
    if (pack.ProjectId !== projectId)
      return cntBad(req, res, "E-COM-PACK-OTHER-PROJECT", "بستهٔ آزمون به پروژهٔ دیگری تعلق دارد", 409);
    if (pack.Status === "cleared")
      return cntBad(req, res, "E-COM-PACK-CLEARED", "بستهٔ تأییدشده برگهٔ جدید نمی‌پذیرد؛ ابتدا آن را بازگشایی کنید", 409);

    const lines = Array.isArray(b.lines) ? b.lines : [];
    const errors = [
      ...validateSheetInput({ sheetNo: b.sheetNo, titleFa: b.titleFa, testKind: b.testKind, packType: pack.PackType, resultFa: b.resultFa ?? null, status: "draft" }),
      ...validateSheetLines(lines.map((l, i) => ({ LineNo: l.lineNo ?? i + 1, ParameterFa: l.parameterFa }))),
    ];
    if (errors.length)
      return res.status(422).json({ ok: false, error: { code: errors[0].code, message: errors[0].message, details: errors, traceId: req.requestId } });

    const sheetNo = String(b.sheetNo).trim();
    const dupe = await r.findOne("CheckSheet", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "SheetNo", op: "eq", value: sheetNo },
    ]);
    if (dupe) return cntBad(req, res, "E-COM-DUP-SHEET", `برگهٔ ${sheetNo} پیش‌تر ثبت شده است`, 409);

    const userId = req.headers["x-user-id"] || "system";
    const sheet = await r.create("CheckSheet", {
      ProjectId: projectId,
      PackId: packId,
      SheetNo: sheetNo,
      SheetType: pack.PackType,
      TestKind: String(b.testKind),
      TitleFa: String(b.titleFa),
      TestDate: b.testDate ? String(b.testDate) : null,
      TestedBy: b.testedBy ? String(b.testedBy) : null,
      WitnessedBy: null,
      ResultFa: null,
      NcrRef: null,
      NoteFa: b.noteFa ? String(b.noteFa) : null,
      Status: "draft",
    }, userId, "CS");

    const savedLines = [];
    for (const [i, l] of lines.entries()) {
      savedLines.push(await r.create("CheckSheetLine", {
        ProjectId: projectId,
        SheetId: sheet.Id,
        LineNo: Number(l.lineNo ?? i + 1),
        ParameterFa: String(l.parameterFa),
        ExpectedValue: l.expectedValue != null ? String(l.expectedValue) : null,
        ActualValue: l.actualValue != null ? String(l.actualValue) : null,
        UnitFa: l.unitFa ? String(l.unitFa) : null,
        IsMandatory: l.isMandatory !== false,
        Passed: typeof l.passed === "boolean" ? l.passed : null,
        NoteFa: l.noteFa ? String(l.noteFa) : null,
      }, userId, "CSL"));
    }

    res.status(201).json(cntOk(req, {
      id: sheet.Id,
      item: { ...sheet, kindFa: TEST_KIND_FA[sheet.TestKind] ?? sheet.TestKind },
      lines: savedLines,
      verdict: sheetVerdict(savedLines),
    }));
  } catch (err) { next(err); }
});

/** ثبت مقدار واقعی یک ردیف؛ نتیجهٔ برگه از ردیف‌ها مشتق می‌شود نه دستی. */
app.post("/api/com/sheet/:id/reading", comRequire("com.checksheet.record"), async (req, res, next) => {
  try {
    const b = engBody(req);
    const r = await repo();
    const sheet = await r.findOne("CheckSheet", [{ column: "Id", op: "eq", value: String(req.params.id) }]);
    if (!sheet) return cntBad(req, res, "E-COM-SHEET-NOT-FOUND", "برگهٔ آزمون یافت نشد", 404);
    if (sheet.Status !== "draft")
      return cntBad(req, res, "E-COM-SHEET-LOCKED", "برگهٔ امضاشده یا باطل قابل ویرایش نیست", 409);

    const lineNo = Number(b.lineNo);
    const lines = await r.list("CheckSheetLine", { where: [{ column: "SheetId", op: "eq", value: sheet.Id }] });
    const line = lines.find((l) => Number(l.LineNo) === lineNo);
    if (!line) return cntBad(req, res, "E-COM-LINE-NOT-FOUND", `ردیف ${lineNo} در این برگه نیست`, 404);

    const userId = req.headers["x-user-id"] || "system";
    const patch = {
      ...line,
      ActualValue: b.actualValue != null ? String(b.actualValue) : line.ActualValue,
      Passed: typeof b.passed === "boolean" ? b.passed : line.Passed,
      NoteFa: b.noteFa != null ? String(b.noteFa) : line.NoteFa,
    };
    const saved = (await r.upsert("CheckSheetLine", { Id: line.Id }, patch, userId))?.row ?? patch;
    const fresh = lines.map((l) => (l.Id === line.Id ? saved : l));

    res.json(cntOk(req, { item: saved, verdict: sheetVerdict(fresh) }));
  } catch (err) { next(err); }
});

/** امضای برگه؛ نتیجه از ردیف‌ها مشتق و در ستون ResultFa تثبیت می‌شود. */
app.post("/api/com/sheet/:id/sign", comRequire("com.checksheet.sign"), async (req, res, next) => {
  try {
    const b = engBody(req);
    const r = await repo();
    const sheet = await r.findOne("CheckSheet", [{ column: "Id", op: "eq", value: String(req.params.id) }]);
    if (!sheet) return cntBad(req, res, "E-COM-SHEET-NOT-FOUND", "برگهٔ آزمون یافت نشد", 404);
    if (sheet.Status === "signed") return cntBad(req, res, "E-COM-ALREADY-SIGNED", "این برگه پیش‌تر امضا شده است", 409);
    if (sheet.Status === "void") return cntBad(req, res, "E-COM-SHEET-VOID", "برگهٔ باطل امضا نمی‌شود", 409);

    const lines = await r.list("CheckSheetLine", { where: [{ column: "SheetId", op: "eq", value: sheet.Id }] });
    const witnessedBy = b.witnessedBy ? String(b.witnessedBy) : "";
    const gate = canSignSheet(lines, witnessedBy);
    if (gate) return cntBad(req, res, gate.code, gate.message, 409);

    const verdict = sheetVerdict(lines);
    const userId = req.headers["x-user-id"] || "system";
    const saved = (await r.upsert("CheckSheet", { Id: sheet.Id }, {
      ...sheet,
      Status: "signed",
      ResultFa: verdict.resultFa,
      WitnessedBy: witnessedBy,
      TestDate: sheet.TestDate ?? new Date().toISOString().slice(0, 10),
      NcrRef: b.ncrRef ? String(b.ncrRef) : sheet.NcrRef,
    }, userId))?.row;

    const row = saved ?? { ...sheet, Status: "signed", ResultFa: verdict.resultFa };
    res.json(cntOk(req, {
      item: { ...row, resultLabelFa: SHEET_RESULT_FA[row.ResultFa] ?? row.ResultFa },
      verdict,
    }));
  } catch (err) { next(err); }
});

app.get("/api/com/sheet", comRequire("com.system.view"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");
    const r = await repo();
    let sheets = await r.list("CheckSheet", { where: [{ column: "ProjectId", op: "eq", value: projectId }] });
    if (req.query.packId) sheets = sheets.filter((x) => x.PackId === String(req.query.packId));
    const allLines = await r.list("CheckSheetLine", { where: [{ column: "ProjectId", op: "eq", value: projectId }] });

    res.json(cntOk(req, {
      count: sheets.length,
      items: sheets.map((x) => {
        const lines = allLines.filter((l) => l.SheetId === x.Id);
        return {
          ...x,
          kindFa: TEST_KIND_FA[x.TestKind] ?? x.TestKind,
          resultLabelFa: x.ResultFa ? (SHEET_RESULT_FA[x.ResultFa] ?? x.ResultFa) : null,
          lines,
          verdict: sheetVerdict(lines),
        };
      }),
    }));
  } catch (err) { next(err); }
});

/** تأیید بسته؛ تنها وقتی همهٔ برگه‌ها امضا شده و هیچ‌کدام مردود نیست. */
app.post("/api/com/pack/:id/clear", comRequire("com.checksheet.sign"), async (req, res, next) => {
  try {
    const b = engBody(req);
    const r = await repo();
    const pack = await r.findOne("CheckRecordPack", [{ column: "Id", op: "eq", value: String(req.params.id) }]);
    if (!pack) return cntBad(req, res, "E-COM-PACK-NOT-FOUND", "بستهٔ آزمون یافت نشد", 404);
    if (pack.Status === "cleared") return cntBad(req, res, "E-COM-PACK-ALREADY-CLEARED", "این بسته پیش‌تر تأیید شده است", 409);

    const sheets = await r.list("CheckSheet", { where: [{ column: "ProjectId", op: "eq", value: pack.ProjectId }] });
    const prog = packProgress(pack.Id, sheets);
    const dryRun = b.dryRun === true || String(req.query.dryRun || "") === "1";
    if (dryRun) return res.json(cntOk(req, { dryRun: true, progress: prog }));
    if (!prog.canClear)
      return res.status(409).json({ ok: false, error: { code: "E-COM-PACK-NOT-READY", message: prog.blockersFa[0], details: prog.blockersFa, traceId: req.requestId } });

    const userId = req.headers["x-user-id"] || "system";
    const saved = (await r.upsert("CheckRecordPack", { Id: pack.Id }, {
      ...pack,
      Status: "cleared",
      TotalSheets: prog.total,
      ClearedSheets: prog.signed,
      ClearedAt: b.clearedAt ? String(b.clearedAt) : new Date().toISOString().slice(0, 10),
      ClearedBy: userId,
    }, userId))?.row;

    res.json(cntOk(req, { item: saved ?? { ...pack, Status: "cleared" }, progress: prog }));
  } catch (err) { next(err); }
});

/** دروازهٔ تأیید آزمون سرد یک سیستم — پیش‌نیاز تکمیل مکانیکی. */
app.get("/api/com/system/:id/cold-clearance", comRequire("com.system.view"), async (req, res, next) => {
  try {
    const r = await repo();
    const systemId = String(req.params.id);
    const sys = await r.findOne("SystemSubsystem", [{ column: "Id", op: "eq", value: systemId }]);
    if (!sys) return cntBad(req, res, "E-COM-SYSTEM-NOT-FOUND", "سیستم یافت نشد", 404);

    const packs = await r.list("CheckRecordPack", { where: [{ column: "ProjectId", op: "eq", value: sys.ProjectId }] });
    const sheets = await r.list("CheckSheet", { where: [{ column: "ProjectId", op: "eq", value: sys.ProjectId }] });

    /* عدم انطباق باز در دامنهٔ سیستم؛ جدول Ncr ستون سیستم ندارد، پس از
       مرزبندی به فعالیت پل زده می‌شود. */
    const bounds = await r.list("SystemBoundaryMapping", { where: [{ column: "SystemId", op: "eq", value: systemId }] });
    const activityRefs = new Set(bounds.filter((x) => x.TargetKind === "activity").map((x) => x.TargetRef));
    const ncrs = await r.list("Ncr", { where: [{ column: "ProjectId", op: "eq", value: sys.ProjectId }] });
    const openNcrCount = ncrs.filter((n) => n.Status !== "closed" && n.ActivityId && activityRefs.has(n.ActivityId)).length;

    const clearance = coldTestClearance({ systemId, packs, sheets, openNcrCount });
    res.json(cntOk(req, { system: { id: sys.Id, code: sys.SystemCode, titleFa: sys.TitleFa }, clearance }));
  } catch (err) { next(err); }
});

app.get("/api/com/precomm", comRequire("com.system.view"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");
    const r = await repo();
    const systems = await comSystems(r, projectId);
    const packs = await r.list("CheckRecordPack", { where: [{ column: "ProjectId", op: "eq", value: projectId }] });
    const sheets = await r.list("CheckSheet", { where: [{ column: "ProjectId", op: "eq", value: projectId }] });
    res.json(cntOk(req, {
      summary: preCommSummary(systems, packs, sheets),
      testKinds: Object.entries(TEST_KINDS_BY_TYPE).map(([type, kinds]) => ({
        packType: type,
        packTypeFa: PACK_TYPE_FA[type],
        kinds: kinds.map((k) => ({ code: k, titleFa: TEST_KIND_FA[k] })),
      })),
    }));
  } catch (err) { next(err); }
});

/* ── ۱۴٫۱ وضعیت ماژول ── */
app.get("/api/cnt/status", (req, res) => {
  res.json(cntOk(req, {
    module: "d14",
    titleFa: "مدیریت پیمان و صورت‌وضعیت",
    engine: CNT_VERSION,
    delivered: ["14.1", "14.2", "14.4", "14.5"],
    vocabularies: {
      pricingBasis: PRICING_BASIS_FA,
      contractType: CONTRACT_TYPE_FA,
      rateStatus: RATE_STATUS_FA,
      ipcWorkflow: IPC_WORKFLOW_FA,
      deductionType: DEDUCTION_TYPE_FA,
      indexStatus: INDEX_STATUS_FA,
      retainageEntry: RETAINAGE_ENTRY_FA,
      certificateType: CERTIFICATE_TYPE_FA,
    },
  }));
});

/* ══════════════ MOD-08 / HSE — ارزیابی ریسک شغلی (D3) ══════════════ */

/** نگهبان مجوز ماژول ایمنی — هم‌الگوی comRequire. */
function hseRequire(permission) {
  return comRequire(permission);
}

/**
 * آیا این درخواست مجوز مشخصی را دارد؟ — بدون ردکردن درخواست.
 *
 * برای پاسخ‌هایی لازم است که بخشی از محتوایشان طبقه‌بندی بالاتری از
 * خودِ اندپوینت دارد؛ نام فرد «غیرمجاز به کار» دادهٔ پزشکی است و
 * نباید همراه فهرست تجهیزات به دست سرپرست اجرایی برسد.
 */
/**
 * آیا ردیف یافت‌شده به پروژهٔ درخواست تعلق دارد؟
 *
 * مسیرهای `/:id/` شناسهٔ ردیف را مستقیم می‌گیرند؛ بدون این بررسی،
 * کاربری که فقط به پروژهٔ ب دسترسی دارد می‌توانست ردیف پروژهٔ الف را
 * با حدس شناسه تغییر دهد — یافتهٔ لوپ ۸.
 */
function hseSameProject(req, row) {
  const projectId = String(req.query.projectId || "");
  if (!projectId) return true;
  return String(row?.ProjectId ?? "") === projectId;
}

function hseHas(req, permission) {
  const subject = engSubject(req);
  if (!subject) return false;
  return rbacEvaluate(subject, permission, { projectId: undefined }).allow === true;
}

async function hseJsaBundle(r, jsaId) {
  const [steps, hazards, controls] = await Promise.all([
    r.list("JSA_JobStep", { where: [{ column: "JsaId", op: "eq", value: jsaId }], limit: 500 }),
    r.list("JSA_Hazard", { where: [{ column: "JsaId", op: "eq", value: jsaId }], limit: 2000 }),
    r.list("JSA_Control", { where: [{ column: "JsaId", op: "eq", value: jsaId }], limit: 5000 }),
  ]);
  steps.sort((a, b) => Number(a.StepNo) - Number(b.StepNo));
  return { steps, hazards, controls };
}

/** ثبت ارزیابی ریسک شغلی. */
app.post("/api/hse/jsa", hseRequire("hse.jsa.edit"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");
    const b = req.body || {};
    const subject = engSubject(req);

    const input = {
      ProjectId: projectId,
      JsaNo: String(b.jsaNo ?? "").trim(),
      TitleFa: String(b.titleFa ?? "").trim(),
      PreparedBy: String(b.preparedBy ?? subject?.id ?? "").trim(),
      PreparedAt: b.preparedAt || new Date().toISOString().slice(0, 10),
      Status: "draft",
    };
    const issues = validateJsaInput(input);
    if (issues.length) return cntBad(req, res, issues[0].code, issues[0].message, 422, issues.map((i) => i.message));

    const dup = await repo().then((r) => r.findOne("HSE_RiskAssessment", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "JsaNo", op: "eq", value: input.JsaNo },
    ]));
    if (dup) return cntBad(req, res, "E-HSE-DUP-JSA", `ارزیابی با شمارهٔ ${input.JsaNo} قبلاً ثبت شده است`, 409);

    const r = await repo();
    const row = await r.create("HSE_RiskAssessment", {
      ...input,
      ActivityId: b.activityId || null,
      TemplateCode: b.templateCode || null,
      DisciplineCode: b.disciplineCode || null,
      LocationFa: b.locationFa || null,
      ValidUntil: b.validUntil || null,
      NoteFa: b.noteFa || null,
    }, subject?.id, "jsa");

    res.status(201).json(cntOk(req, {
      id: row.Id,
      item: { ...row, statusFa: JSA_STATUS_FA[row.Status] },
    }));
  } catch (err) { next(err); }
});

/** فهرست ارزیابی‌ها با خلاصهٔ ریسک. */
app.get("/api/hse/jsa", hseRequire("hse.jsa.view"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");
    const r = await repo();
    const rows = await r.list("HSE_RiskAssessment", { where: [{ column: "ProjectId", op: "eq", value: projectId }], limit: 2000 });

    /* سه کوئری در کل پروژه، نه سه کوئری به ازای هر ارزیابی: فهرست با ۲۰۰۰
     * ردیف در حالت قبلی ۶۰۰۱ رفت‌وبرگشت می‌ساخت. */
    const scope = [{ column: "ProjectId", op: "eq", value: projectId }];
    const [allSteps, allHazards, allControls] = await Promise.all([
      r.list("JSA_JobStep", { where: scope, limit: 20000 }),
      r.list("JSA_Hazard", { where: scope, limit: 50000 }),
      r.list("JSA_Control", { where: scope, limit: 100000 }),
    ]);
    const groupBy = (arr) => {
      const map = new Map();
      for (const x of arr) {
        const k = x.JsaId;
        if (!map.has(k)) map.set(k, []);
        map.get(k).push(x);
      }
      return map;
    };
    const stepsBy = groupBy(allSteps);
    const hazardsBy = groupBy(allHazards);
    const controlsBy = groupBy(allControls);

    const now = new Date();
    const items = [];
    for (const j of rows) {
      const steps = stepsBy.get(j.Id) ?? [];
      const hazards = hazardsBy.get(j.Id) ?? [];
      const controls = controlsBy.get(j.Id) ?? [];
      const st = jsaState(j, now);
      items.push({
        ...j,
        statusFa: st.statusFa,
        effectiveStatus: st.effectiveStatus,
        isUsable: st.isUsable,
        expiresInDays: st.expiresInDays,
        summary: jsaSummary(steps, hazards, controls),
      });
    }
    res.json(cntOk(req, { items, count: items.length }));
  } catch (err) { next(err); }
});

/** جزئیات کامل یک ارزیابی: گام‌ها، خطرات و کنترل‌ها. */
app.get("/api/hse/jsa/:id", hseRequire("hse.jsa.view"), async (req, res, next) => {
  try {
    const r = await repo();
    const jsaRow = await r.findOne("HSE_RiskAssessment", [{ column: "Id", op: "eq", value: String(req.params.id) }]);
    if (!jsaRow) return cntBad(req, res, "E-HSE-JSA-NOT-FOUND", "ارزیابی ریسک یافت نشد", 404);

    const { steps, hazards, controls } = await hseJsaBundle(r, jsaRow.Id);
    const st = jsaState(jsaRow, new Date());

    const stepView = steps.map((s) => ({
      ...s,
      hazards: hazards
        .filter((h) => h.StepId === s.Id)
        .sort((a, b) => Number(a.HazardNo) - Number(b.HazardNo))
        .map((h) => ({
          ...h,
          categoryFa: h.HazardCategory ? (HAZARD_CATEGORY_FA[h.HazardCategory] ?? h.HazardCategory) : null,
          evaluation: evaluateHazard(h, controls),
          controls: controls
            .filter((c) => c.HazardId === h.Id)
            .sort((a, b) => Number(a.ControlNo) - Number(b.ControlNo))
            .map((c) => ({ ...c, levelFa: CONTROL_LEVEL_FA[c.ControlLevel] ?? c.ControlLevel })),
        })),
    }));

    res.json(cntOk(req, {
      item: { ...jsaRow, statusFa: st.statusFa, effectiveStatus: st.effectiveStatus, isUsable: st.isUsable },
      steps: stepView,
      summary: jsaSummary(steps, hazards, controls),
    }));
  } catch (err) { next(err); }
});

/** افزودن گام کاری. */
app.post("/api/hse/jsa/:id/step", hseRequire("hse.jsa.edit"), async (req, res, next) => {
  try {
    const r = await repo();
    const jsaRow = await r.findOne("HSE_RiskAssessment", [{ column: "Id", op: "eq", value: String(req.params.id) }]);
    if (!jsaRow) return cntBad(req, res, "E-HSE-JSA-NOT-FOUND", "ارزیابی ریسک یافت نشد", 404);
    if (jsaRow.Status === "approved") {
      return cntBad(req, res, "E-HSE-JSA-LOCKED", "ارزیابی مصوب قابل ویرایش نیست", 409);
    }

    const b = req.body || {};
    const desc = String(b.descriptionFa ?? "").trim();
    if (!desc) return cntBad(req, res, "E-HSE-STEP-DESC-REQUIRED", "شرح گام کاری الزامی است", 422);

    const existing = await r.list("JSA_JobStep", { where: [{ column: "JsaId", op: "eq", value: jsaRow.Id }], limit: 500 });
    const stepNo = Number(b.stepNo ?? 0) || existing.length + 1;
    if (existing.some((x) => Number(x.StepNo) === stepNo)) {
      return cntBad(req, res, "E-HSE-DUP-STEP", `گام شمارهٔ ${stepNo} قبلاً ثبت شده است`, 409);
    }

    const row = await r.create("JSA_JobStep", {
      ProjectId: jsaRow.ProjectId,
      JsaId: jsaRow.Id,
      StepNo: stepNo,
      DescriptionFa: desc,
      ResponsibleFa: b.responsibleFa || null,
      NoteFa: b.noteFa || null,
    }, engSubject(req)?.id, "step");

    res.status(201).json(cntOk(req, { id: row.Id, item: row }));
  } catch (err) { next(err); }
});

/** افزودن خطر به گام، همراه کنترل‌های آن. */
app.post("/api/hse/jsa/step/:stepId/hazard", hseRequire("hse.jsa.edit"), async (req, res, next) => {
  try {
    const r = await repo();
    const step = await r.findOne("JSA_JobStep", [{ column: "Id", op: "eq", value: String(req.params.stepId) }]);
    if (!step) return cntBad(req, res, "E-HSE-STEP-NOT-FOUND", "گام کاری یافت نشد", 404);
    const jsaRow = await r.findOne("HSE_RiskAssessment", [{ column: "Id", op: "eq", value: step.JsaId }]);
    if (jsaRow?.Status === "approved") {
      return cntBad(req, res, "E-HSE-JSA-LOCKED", "ارزیابی مصوب قابل ویرایش نیست", 409);
    }

    const b = req.body || {};
    const input = {
      HazardFa: String(b.hazardFa ?? "").trim(),
      HazardCategory: b.hazardCategory || null,
      Likelihood: Number(b.likelihood),
      Severity: Number(b.severity),
    };
    const issues = validateHazardInput(input);
    if (issues.length) return cntBad(req, res, issues[0].code, issues[0].message, 422, issues.map((i) => i.message));

    const controlsIn = Array.isArray(b.controls) ? b.controls : [];
    for (const c of controlsIn) {
      const ci = validateControlInput({ ControlFa: String(c.controlFa ?? "").trim(), ControlLevel: c.controlLevel });
      if (ci.length) return cntBad(req, res, ci[0].code, ci[0].message, 422);
    }

    const existing = await r.list("JSA_Hazard", { where: [{ column: "StepId", op: "eq", value: step.Id }], limit: 500 });
    const hazardNo = Number(b.hazardNo ?? 0) || existing.length + 1;
    if (existing.some((x) => Number(x.HazardNo) === hazardNo)) {
      return cntBad(req, res, "E-HSE-DUP-HAZARD", `خطر شمارهٔ ${hazardNo} قبلاً ثبت شده است`, 409);
    }

    const hasResidual = b.residualLikelihood != null && b.residualSeverity != null;
    const hazardRow = await r.create("JSA_Hazard", {
      ProjectId: step.ProjectId,
      JsaId: step.JsaId,
      StepId: step.Id,
      HazardNo: hazardNo,
      HazardFa: input.HazardFa,
      HazardCategory: input.HazardCategory,
      Likelihood: input.Likelihood,
      Severity: input.Severity,
      /* نمرهٔ ریسک مشتق است — کاربر نمی‌تواند مستقیم بنویسدش. */
      InitialRisk: riskScore(input.Likelihood, input.Severity),
      ResidualLikelihood: hasResidual ? Number(b.residualLikelihood) : null,
      ResidualSeverity: hasResidual ? Number(b.residualSeverity) : null,
      ResidualRisk: hasResidual ? riskScore(Number(b.residualLikelihood), Number(b.residualSeverity)) : null,
      NoteFa: b.noteFa || null,
    }, engSubject(req)?.id, "hz");

    const created = [];
    let n = 0;
    for (const c of controlsIn) {
      n += 1;
      const row = await r.create("JSA_Control", {
        ProjectId: step.ProjectId,
        JsaId: step.JsaId,
        HazardId: hazardRow.Id,
        ControlNo: n,
        ControlLevel: c.controlLevel,
        ControlFa: String(c.controlFa).trim(),
        ResponsibleFa: c.responsibleFa || null,
      }, engSubject(req)?.id, "ctl");
      created.push(row);
    }

    res.status(201).json(cntOk(req, {
      id: hazardRow.Id,
      item: {
        ...hazardRow,
        categoryFa: hazardRow.HazardCategory ? (HAZARD_CATEGORY_FA[hazardRow.HazardCategory] ?? hazardRow.HazardCategory) : null,
        bandFa: riskBand(hazardRow.InitialRisk).fa,
      },
      controls: created.map((c) => ({ ...c, levelFa: CONTROL_LEVEL_FA[c.ControlLevel] })),
      evaluation: evaluateHazard(hazardRow, created),
    }));
  } catch (err) { next(err); }
});

/** افزودن کنترل به خطر موجود. */
app.post("/api/hse/jsa/hazard/:hazardId/control", hseRequire("hse.jsa.edit"), async (req, res, next) => {
  try {
    const r = await repo();
    const hazardRow = await r.findOne("JSA_Hazard", [{ column: "Id", op: "eq", value: String(req.params.hazardId) }]);
    if (!hazardRow) return cntBad(req, res, "E-HSE-HAZARD-NOT-FOUND", "خطر یافت نشد", 404);
    const jsaRow = await r.findOne("HSE_RiskAssessment", [{ column: "Id", op: "eq", value: hazardRow.JsaId }]);
    if (jsaRow?.Status === "approved") {
      return cntBad(req, res, "E-HSE-JSA-LOCKED", "ارزیابی مصوب قابل ویرایش نیست", 409);
    }

    const b = req.body || {};
    const input = { ControlFa: String(b.controlFa ?? "").trim(), ControlLevel: b.controlLevel };
    const issues = validateControlInput(input);
    if (issues.length) return cntBad(req, res, issues[0].code, issues[0].message, 422);

    const existing = await r.list("JSA_Control", { where: [{ column: "HazardId", op: "eq", value: hazardRow.Id }], limit: 500 });
    const row = await r.create("JSA_Control", {
      ProjectId: hazardRow.ProjectId,
      JsaId: hazardRow.JsaId,
      HazardId: hazardRow.Id,
      ControlNo: existing.length + 1,
      ControlLevel: input.ControlLevel,
      ControlFa: input.ControlFa,
      ResponsibleFa: b.responsibleFa || null,
    }, engSubject(req)?.id, "ctl");

    /* ریسک باقیمانده در صورت ارسال به‌روزرسانی می‌شود — مشتق، نه ورودی خام. */
    if (b.residualLikelihood != null && b.residualSeverity != null) {
      await r.upsert("JSA_Hazard", { Id: hazardRow.Id }, {
        ResidualLikelihood: Number(b.residualLikelihood),
        ResidualSeverity: Number(b.residualSeverity),
        ResidualRisk: riskScore(Number(b.residualLikelihood), Number(b.residualSeverity)),
      }, engSubject(req)?.id);
    }

    const all = [...existing, row];
    const fresh = await r.findOne("JSA_Hazard", [{ column: "Id", op: "eq", value: hazardRow.Id }]);
    res.status(201).json(cntOk(req, {
      id: row.Id,
      item: { ...row, levelFa: CONTROL_LEVEL_FA[row.ControlLevel] },
      evaluation: evaluateHazard(fresh ?? hazardRow, all),
    }));
  } catch (err) { next(err); }
});

/** تصویب ارزیابی ریسک — دروازهٔ سلسله‌مراتب کنترل. */
app.post("/api/hse/jsa/:id/approve", hseRequire("hse.jsa.approve"), async (req, res, next) => {
  try {
    const r = await repo();
    const jsaRow = await r.findOne("HSE_RiskAssessment", [{ column: "Id", op: "eq", value: String(req.params.id) }]);
    if (!jsaRow) return cntBad(req, res, "E-HSE-JSA-NOT-FOUND", "ارزیابی ریسک یافت نشد", 404);

    const { steps, hazards, controls } = await hseJsaBundle(r, jsaRow.Id);
    const subject = engSubject(req);
    const verdict = canApproveJsa({ jsa: jsaRow, steps, hazards, controls, approverId: subject?.id });

    if (req.body?.dryRun) {
      return res.json(cntOk(req, { dryRun: true, verdict, summary: jsaSummary(steps, hazards, controls) }));
    }
    if (!verdict.ok) {
      return cntBad(req, res, "E-HSE-JSA-NOT-APPROVABLE", "ارزیابی ریسک قابل تصویب نیست", 409, verdict.blockersFa);
    }

    const saved = (await r.upsert("HSE_RiskAssessment", { Id: jsaRow.Id }, {
      Status: "approved",
      ApprovedBy: subject?.id ?? "system",
      ApprovedAt: new Date().toISOString().slice(0, 10),
      MaxResidualRisk: verdict.maxResidualRisk,
    }, subject?.id))?.row;

    res.json(cntOk(req, {
      item: { ...saved, statusFa: JSA_STATUS_FA[saved.Status] },
      verdict,
      summary: jsaSummary(steps, hazards, controls),
    }));
  } catch (err) { next(err); }
});

/** آیا این ارزیابی پروانهٔ کار را پشتیبانی می‌کند؟ */
app.get("/api/hse/jsa/:id/permit-readiness", hseRequire("hse.jsa.view"), async (req, res, next) => {
  try {
    const r = await repo();
    const jsaRow = await r.findOne("HSE_RiskAssessment", [{ column: "Id", op: "eq", value: String(req.params.id) }]);
    if (!jsaRow) return cntBad(req, res, "E-HSE-JSA-NOT-FOUND", "ارزیابی ریسک یافت نشد", 404);
    const readiness = jsaSupportsPermit(jsaRow, new Date());
    res.json(cntOk(req, { jsaNo: jsaRow.JsaNo, readiness, state: jsaState(jsaRow, new Date()) }));
  } catch (err) { next(err); }
});

/** واژگان ماژول ایمنی برای رابط کاربری. */
app.get("/api/hse/vocab", hseRequire("hse.jsa.view"), (req, res) => {
  res.json(cntOk(req, {
    controlLevels: CONTROL_LEVELS.map((c, i) => ({ code: c, titleFa: CONTROL_LEVEL_FA[c], rank: i + 1 })),
    hazardCategories: HAZARD_CATEGORIES.map((h) => ({ code: h, titleFa: HAZARD_CATEGORY_FA[h] })),
    riskBands: RISK_BANDS.map((b) => ({ code: b.code, titleFa: b.fa, max: b.max, color: b.color })),
    thresholds: {
      maxApprovableResidual: MAX_APPROVABLE_RESIDUAL,
      ppeOnlyRiskThreshold: PPE_ONLY_RISK_THRESHOLD,
    },
  }));
});

/* ══════════════ MOD-08 / HSE — سامانهٔ پروانهٔ کار (D4) ══════════════ */

/** بستهٔ رکوردهای وابستهٔ یک پروانه — یک‌جا خوانده می‌شود. */
async function ptwBundle(r, permit) {
  const byPermit = (t, limit) =>
    r.list(t, { where: [{ column: "PermitId", op: "eq", value: permit.Id }], limit });
  const [gasTests, isolations, approvals, precautions, jsa] = await Promise.all([
    byPermit("GasTestLog", 500),
    byPermit("IsolationLog", 500),
    byPermit("PTW_Approval", 20),
    byPermit("PTW_Precaution", 200),
    permit.JsaId
      ? r.findOne("HSE_RiskAssessment", [{ column: "Id", op: "eq", value: permit.JsaId }])
      : Promise.resolve(null),
  ]);
  return { gasTests, isolations, approvals, precautions, jsa };
}

/** توکن اعتبارسنجی میدانی — مستقل از شناسهٔ داخلی تا روی کاغذ چاپ نشود. */
function makeQrToken() {
  return `ptw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** ثبت درخواست پروانهٔ کار. */
app.post("/api/hse/permit", hseRequire("hse.permit.request"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");
    const b = req.body || {};
    const subject = engSubject(req);
    const r = await repo();

    const input = {
      ProjectId: projectId,
      PermitNo: String(b.permitNo ?? "").trim(),
      PermitType: b.permitType,
      TitleFa: String(b.titleFa ?? "").trim(),
      RequestedBy: String(b.requestedBy ?? subject?.id ?? "").trim(),
      ValidFrom: b.validFrom,
      ValidTo: b.validTo,
      Status: "draft",
    };
    const issues = validatePermitInput(input);
    if (issues.length) return cntBad(req, res, issues[0].code, issues[0].message, 422, issues.map((i) => i.message));

    const dup = await r.findOne("WorkPermit", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "PermitNo", op: "eq", value: input.PermitNo },
    ]);
    if (dup) return cntBad(req, res, "E-HSE-DUP-PERMIT", `پروانهٔ ${input.PermitNo} قبلاً ثبت شده است`, 409);

    /* ارزیابی ریسک باید متعلق به همین پروژه باشد — پروانهٔ پروژهٔ الف
     * نباید به ارزیابی پروژهٔ ب تکیه کند. */
    if (b.jsaId) {
      const jsa = await r.findOne("HSE_RiskAssessment", [{ column: "Id", op: "eq", value: String(b.jsaId) }]);
      if (!jsa) return cntBad(req, res, "E-HSE-JSA-NOT-FOUND", "ارزیابی ریسک یافت نشد", 404);
      if (jsa.ProjectId !== projectId) {
        return cntBad(req, res, "E-HSE-JSA-CROSS-PROJECT", "ارزیابی ریسک متعلق به پروژهٔ دیگری است", 409);
      }
    }

    const row = await r.create("WorkPermit", {
      ...input,
      SystemId: b.systemId || null,
      ActivityId: b.activityId || null,
      LocationFa: b.locationFa || null,
      JsaId: b.jsaId || null,
      QrToken: makeQrToken(),
      SimopsRequired: b.simopsRequired === true,
      SimopsApprovedBy: b.simopsApprovedBy || null,
      NoteFa: b.noteFa || null,
      ParentPermitId: b.parentPermitId || null,
    }, subject?.id, "ptw");

    /* اقدامات احتیاطی همراه درخواست ثبت می‌شوند تا امضاکننده چیزی برای
     * بررسی داشته باشد. */
    const created = [];
    let n = 0;
    for (const pc of Array.isArray(b.precautions) ? b.precautions : []) {
      const text = String(pc.precautionFa ?? "").trim();
      if (!text) continue;
      n += 1;
      created.push(await r.create("PTW_Precaution", {
        ProjectId: projectId,
        PermitId: row.Id,
        PrecautionNo: n,
        PrecautionFa: text,
        IsMandatory: pc.isMandatory !== false,
        /* عمداً ثبت نمی‌شود: null یعنی هنوز بررسی نشده. */
        IsConfirmed: null,
      }, subject?.id, "prc"));
    }

    res.status(201).json(cntOk(req, {
      id: row.Id,
      item: { ...row, typeFa: PERMIT_TYPE_FA[row.PermitType], statusFa: PERMIT_STATUS_FA[row.Status] },
      precautions: created,
      requiresGasTest: GAS_TEST_REQUIRED_PERMITS.includes(row.PermitType),
      requiresIsolation: ISOLATION_REQUIRED_PERMITS.includes(row.PermitType),
    }));
  } catch (err) { next(err); }
});

/** فهرست پروانه‌ها با خلاصهٔ سامانه. */
app.get("/api/hse/permit", hseRequire("hse.permit.view"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");
    const r = await repo();
    const scope = [{ column: "ProjectId", op: "eq", value: projectId }];
    const [permits, gasTests, isolations] = await Promise.all([
      r.list("WorkPermit", { where: scope, limit: 5000 }),
      r.list("GasTestLog", { where: scope, limit: 20000 }),
      r.list("IsolationLog", { where: scope, limit: 20000 }),
    ]);

    const now = new Date();
    const items = permits.map((p) => {
      const st = permitState(p, now);
      const gas = latestGasTest(gasTests, p.Id, now);
      return {
        ...p,
        typeFa: PERMIT_TYPE_FA[p.PermitType] ?? p.PermitType,
        statusFa: st.statusFa,
        effectiveStatus: st.effectiveStatus,
        isValidNow: st.isValidNow,
        expiresInHours: st.expiresInHours,
        isHighRisk: HIGH_RISK_PERMITS.includes(p.PermitType),
        gasTest: gas.test ? { isSafe: gas.isSafe, isFresh: gas.isFresh, ageMinutes: gas.ageMinutes } : null,
        isolation: isolationState(isolations, p.Id),
      };
    });

    res.json(cntOk(req, {
      items,
      count: items.length,
      summary: ptwSummary({ permits, gasTests, isolations, now }),
    }));
  } catch (err) { next(err); }
});

/** جزئیات پروانه با دروازهٔ صدور. */
app.get("/api/hse/permit/:id", hseRequire("hse.permit.view"), async (req, res, next) => {
  try {
    const r = await repo();
    const permit = await r.findOne("WorkPermit", [{ column: "Id", op: "eq", value: String(req.params.id) }]);
    if (!permit) return cntBad(req, res, "E-HSE-PERMIT-NOT-FOUND", "پروانهٔ کار یافت نشد", 404);

    const now = new Date();
    const { gasTests, isolations, approvals, precautions, jsa } = await ptwBundle(r, permit);
    const st = permitState(permit, now);
    const gas = latestGasTest(gasTests, permit.Id, now);

    res.json(cntOk(req, {
      item: {
        ...permit,
        typeFa: PERMIT_TYPE_FA[permit.PermitType] ?? permit.PermitType,
        statusFa: st.statusFa,
        effectiveStatus: st.effectiveStatus,
        isValidNow: st.isValidNow,
        expiresInHours: st.expiresInHours,
      },
      jsa: jsa ? { Id: jsa.Id, JsaNo: jsa.JsaNo, TitleFa: jsa.TitleFa, Status: jsa.Status, readiness: jsaSupportsPermit(jsa, now) } : null,
      gasTests: gasTests.map((g) => ({ ...g, evaluation: evaluateGasTest(g) })),
      latestGasTest: gas.test ? { ...gas.test, isFresh: gas.isFresh, ageMinutes: gas.ageMinutes, evaluation: evaluateGasTest(gas.test) } : null,
      isolations: isolations.map((i) => ({ ...i, typeFa: ISOLATION_TYPE_FA[i.IsolationType] ?? i.IsolationType, statusFa: ISOLATION_STATUS_FA[i.Status] ?? i.Status })),
      isolationState: isolationState(isolations, permit.Id),
      approvals: approvals.map((a) => ({ ...a, levelFa: APPROVAL_LEVEL_FA[a.ApprovalLevel] ?? a.ApprovalLevel })),
      approvalChain: approvalChain(approvals, permit.Id),
      precautions,
      precautionState: precautionState(precautions, permit.Id),
      issueGate: canIssuePermit({ permit, jsa, gasTests, isolations, approvals, precautions, now }),
    }));
  } catch (err) { next(err); }
});

/** ثبت گازسنجی — IsSafe مشتق است نه ورودی. */
app.post("/api/hse/permit/:id/gas-test", hseRequire("hse.permit.gastest"), async (req, res, next) => {
  try {
    const r = await repo();
    const permit = await r.findOne("WorkPermit", [{ column: "Id", op: "eq", value: String(req.params.id) }]);
    if (!permit) return cntBad(req, res, "E-HSE-PERMIT-NOT-FOUND", "پروانهٔ کار یافت نشد", 404);

    const b = req.body || {};
    const reading = {
      LelPct: b.lelPct ?? null,
      OxygenPct: b.oxygenPct ?? null,
      H2sPpm: b.h2sPpm ?? null,
      CoPpm: b.coPpm ?? null,
    };
    const verdict = evaluateGasTest(reading);
    if (verdict.measuredCount === 0) {
      return cntBad(req, res, "E-HSE-GAS-NO-READING", "دست‌کم یک پارامتر گاز باید اندازه‌گیری شود", 422, verdict.missingFa);
    }

    const subject = engSubject(req);
    const row = await r.create("GasTestLog", {
      ProjectId: permit.ProjectId,
      PermitId: permit.Id,
      TestedAt: b.testedAt || new Date().toISOString(),
      ...reading,
      /* هرگز از ورودی خوانده نمی‌شود. */
      IsSafe: verdict.isSafe,
      BreachedFa: verdict.breachesFa.length ? verdict.breachesFa.join("، ") : null,
      TestedBy: String(b.testedBy ?? subject?.id ?? "").trim() || "system",
      DeviceSerial: b.deviceSerial || null,
      NoteFa: b.noteFa || null,
    }, subject?.id, "gas");

    /* قرائت ناایمن روی پروانهٔ فعال، کار را فوراً معلق می‌کند. */
    let suspended = false;
    if (!verdict.isSafe && permit.Status === "active") {
      await r.upsert("WorkPermit", { Id: permit.Id }, {
        Status: "suspended",
        SuspendedAt: new Date().toISOString(),
        SuspendedBy: subject?.id ?? "system",
        SuspendReasonFa: `گازسنجی خارج از محدودهٔ ایمن: ${verdict.breachesFa.join("، ")}`,
      }, subject?.id);
      suspended = true;
    }

    res.status(201).json(cntOk(req, {
      id: row.Id,
      item: row,
      evaluation: verdict,
      autoSuspended: suspended,
      limits: GAS_LIMITS,
    }));
  } catch (err) { next(err); }
});

/** ثبت ایزولاسیون. */
app.post("/api/hse/permit/:id/isolation", hseRequire("hse.permit.isolation"), async (req, res, next) => {
  try {
    const r = await repo();
    const permit = await r.findOne("WorkPermit", [{ column: "Id", op: "eq", value: String(req.params.id) }]);
    if (!permit) return cntBad(req, res, "E-HSE-PERMIT-NOT-FOUND", "پروانهٔ کار یافت نشد", 404);

    const b = req.body || {};
    const type = String(b.isolationType ?? "");
    if (!ISOLATION_TYPES.includes(type)) {
      return cntBad(req, res, "E-HSE-ISO-TYPE", "نوع ایزولاسیون نامعتبر است", 422);
    }
    const point = String(b.pointTagFa ?? "").trim();
    if (!point) return cntBad(req, res, "E-HSE-ISO-POINT-REQUIRED", "نقطهٔ ایزولاسیون الزامی است", 422);

    const status = String(b.status ?? "planned");
    if (!["planned", "applied", "removed"].includes(status)) {
      return cntBad(req, res, "E-HSE-ISO-STATUS", "وضعیت ایزولاسیون نامعتبر است", 422);
    }
    /* قفل اعمال‌شده بدون شمارهٔ فیزیکی قابل ممیزی نیست. */
    if (status === "applied" && !String(b.lockNo ?? "").trim()) {
      return cntBad(req, res, "E-HSE-ISO-LOCK-REQUIRED", "ایزولاسیون اعمال‌شده باید شمارهٔ قفل داشته باشد", 422);
    }

    const existing = await r.list("IsolationLog", { where: [{ column: "PermitId", op: "eq", value: permit.Id }], limit: 500 });
    const no = Number(b.isolationNo ?? 0) || existing.length + 1;
    if (existing.some((x) => Number(x.IsolationNo) === no)) {
      return cntBad(req, res, "E-HSE-DUP-ISO", `ایزولاسیون شمارهٔ ${no} قبلاً ثبت شده است`, 409);
    }

    const subject = engSubject(req);
    const row = await r.create("IsolationLog", {
      ProjectId: permit.ProjectId,
      PermitId: permit.Id,
      IsolationNo: no,
      IsolationType: type,
      PointTagFa: point,
      LockNo: b.lockNo || null,
      TagNo: b.tagNo || null,
      AppliedAt: status === "applied" ? (b.appliedAt || new Date().toISOString()) : null,
      AppliedBy: status === "applied" ? (subject?.id ?? "system") : null,
      Status: status,
    }, subject?.id, "iso");

    const all = [...existing, row];
    res.status(201).json(cntOk(req, {
      id: row.Id,
      item: { ...row, typeFa: ISOLATION_TYPE_FA[type], statusFa: ISOLATION_STATUS_FA[status] },
      state: isolationState(all, permit.Id),
    }));
  } catch (err) { next(err); }
});

/** برداشتن قفل. */
app.post("/api/hse/isolation/:isoId/remove", hseRequire("hse.permit.isolation"), async (req, res, next) => {
  try {
    const r = await repo();
    const iso = await r.findOne("IsolationLog", [{ column: "Id", op: "eq", value: String(req.params.isoId) }]);
    if (!iso) return cntBad(req, res, "E-HSE-ISO-NOT-FOUND", "ایزولاسیون یافت نشد", 404);
    if (iso.Status === "removed") {
      return cntBad(req, res, "E-HSE-ISO-ALREADY-REMOVED", "این قفل قبلاً برداشته شده است", 409);
    }

    const subject = engSubject(req);
    const saved = (await r.upsert("IsolationLog", { Id: iso.Id }, {
      Status: "removed",
      RemovedAt: new Date().toISOString(),
      RemovedBy: subject?.id ?? "system",
    }, subject?.id))?.row;

    const all = await r.list("IsolationLog", { where: [{ column: "PermitId", op: "eq", value: iso.PermitId }], limit: 500 });
    res.json(cntOk(req, {
      item: { ...saved, statusFa: ISOLATION_STATUS_FA.removed },
      state: isolationState(all, iso.PermitId),
    }));
  } catch (err) { next(err); }
});

/** تأیید اقدام احتیاطی. */
app.post("/api/hse/precaution/:pid/confirm", hseRequire("hse.permit.sign"), async (req, res, next) => {
  try {
    const r = await repo();
    const pc = await r.findOne("PTW_Precaution", [{ column: "Id", op: "eq", value: String(req.params.pid) }]);
    if (!pc) return cntBad(req, res, "E-HSE-PRECAUTION-NOT-FOUND", "اقدام احتیاطی یافت نشد", 404);

    const subject = engSubject(req);
    /* false هم مقدار معتبری است: «بررسی شد و برقرار نیست». */
    const confirmed = req.body?.isConfirmed !== false;
    const saved = (await r.upsert("PTW_Precaution", { Id: pc.Id }, {
      IsConfirmed: confirmed,
      ConfirmedBy: subject?.id ?? "system",
      ConfirmedAt: new Date().toISOString(),
      NoteFa: req.body?.noteFa || pc.NoteFa || null,
    }, subject?.id))?.row;

    const all = await r.list("PTW_Precaution", { where: [{ column: "PermitId", op: "eq", value: pc.PermitId }], limit: 200 });
    res.json(cntOk(req, { item: saved, state: precautionState(all, pc.PermitId) }));
  } catch (err) { next(err); }
});

/** امضای پروانه در یک سطح — ترتیب اجباری. */
app.post("/api/hse/permit/:id/sign", hseRequire("hse.permit.sign"), async (req, res, next) => {
  try {
    const r = await repo();
    const permit = await r.findOne("WorkPermit", [{ column: "Id", op: "eq", value: String(req.params.id) }]);
    if (!permit) return cntBad(req, res, "E-HSE-PERMIT-NOT-FOUND", "پروانهٔ کار یافت نشد", 404);

    const subject = engSubject(req);
    const level = String(req.body?.level ?? "");
    const approvals = await r.list("PTW_Approval", { where: [{ column: "PermitId", op: "eq", value: permit.Id }], limit: 20 });

    const verdict = canSignPermit({ permit, approvals, level, approverId: subject?.id });
    if (!verdict.ok) {
      return cntBad(req, res, "E-HSE-SIGN-BLOCKED", "امضا در این سطح مجاز نیست", 409, verdict.blockersFa);
    }

    const decision = req.body?.decision === "rejected" ? "rejected" : "approved";
    const row = await r.create("PTW_Approval", {
      ProjectId: permit.ProjectId,
      PermitId: permit.Id,
      ApprovalLevel: level,
      ApproverRef: subject?.id ?? "system",
      SignedAt: new Date().toISOString(),
      DecisionFa: decision,
      CommentFa: req.body?.commentFa || null,
    }, subject?.id, "sgn");

    const all = [...approvals, row];
    /* رد در هر سطح، پروانه را همان‌جا رد می‌کند. */
    if (decision === "rejected" && permit.Status !== "rejected") {
      await r.upsert("WorkPermit", { Id: permit.Id }, { Status: "rejected" }, subject?.id);
    }

    res.status(201).json(cntOk(req, {
      id: row.Id,
      item: { ...row, levelFa: APPROVAL_LEVEL_FA[level] },
      chain: approvalChain(all, permit.Id),
    }));
  } catch (err) { next(err); }
});

/** صدور پروانه — دروازهٔ کامل. */
app.post("/api/hse/permit/:id/issue", hseRequire("hse.permit.approve"), async (req, res, next) => {
  try {
    const r = await repo();
    const permit = await r.findOne("WorkPermit", [{ column: "Id", op: "eq", value: String(req.params.id) }]);
    if (!permit) return cntBad(req, res, "E-HSE-PERMIT-NOT-FOUND", "پروانهٔ کار یافت نشد", 404);

    const now = new Date();
    const subject = engSubject(req);
    const { gasTests, isolations, approvals, precautions, jsa } = await ptwBundle(r, permit);
    const verdict = canIssuePermit({
      permit, jsa, gasTests, isolations, approvals, precautions, approverId: subject?.id, now,
    });

    if (req.body?.dryRun) {
      return res.json(cntOk(req, { dryRun: true, verdict }));
    }
    if (!verdict.ok) {
      return cntBad(req, res, "E-HSE-PERMIT-NOT-ISSUABLE", "پروانه قابل صدور نیست", 409, verdict.blockersFa);
    }

    const saved = (await r.upsert("WorkPermit", { Id: permit.Id }, {
      Status: "active",
      ApprovedBy: subject?.id ?? "system",
      ApprovedAt: new Date().toISOString(),
    }, subject?.id))?.row;

    res.json(cntOk(req, {
      item: { ...saved, statusFa: PERMIT_STATUS_FA[saved.Status], typeFa: PERMIT_TYPE_FA[saved.PermitType] },
      verdict,
    }));
  } catch (err) { next(err); }
});

/** تعلیق پروانه — از لغو جداست. */
app.post("/api/hse/permit/:id/suspend", hseRequire("hse.permit.suspend"), async (req, res, next) => {
  try {
    const r = await repo();
    const permit = await r.findOne("WorkPermit", [{ column: "Id", op: "eq", value: String(req.params.id) }]);
    if (!permit) return cntBad(req, res, "E-HSE-PERMIT-NOT-FOUND", "پروانهٔ کار یافت نشد", 404);

    const verdict = canSuspendPermit(permit);
    if (!verdict.ok) return cntBad(req, res, "E-HSE-SUSPEND-BLOCKED", "تعلیق مجاز نیست", 409, verdict.blockersFa);

    const reason = String(req.body?.reasonFa ?? "").trim();
    if (!reason) return cntBad(req, res, "E-HSE-SUSPEND-REASON-REQUIRED", "دلیل تعلیق الزامی است", 422);

    const subject = engSubject(req);
    const saved = (await r.upsert("WorkPermit", { Id: permit.Id }, {
      Status: "suspended",
      SuspendedAt: new Date().toISOString(),
      SuspendedBy: subject?.id ?? "system",
      SuspendReasonFa: reason,
    }, subject?.id))?.row;

    res.json(cntOk(req, { item: { ...saved, statusFa: PERMIT_STATUS_FA[saved.Status] } }));
  } catch (err) { next(err); }
});

/** ازسرگیری پروانهٔ معلق. */
app.post("/api/hse/permit/:id/resume", hseRequire("hse.permit.suspend"), async (req, res, next) => {
  try {
    const r = await repo();
    const permit = await r.findOne("WorkPermit", [{ column: "Id", op: "eq", value: String(req.params.id) }]);
    if (!permit) return cntBad(req, res, "E-HSE-PERMIT-NOT-FOUND", "پروانهٔ کار یافت نشد", 404);

    const now = new Date();
    /* قاعدهٔ گازسنجی تازه در خودِ موتور است تا لایهٔ وب تنها جایی نباشد
     * که آن را می‌داند. */
    const gasTests = await r.list("GasTestLog", { where: [{ column: "PermitId", op: "eq", value: permit.Id }], limit: 500 });
    const verdict = canResumePermit(permit, now, gasTests);
    if (!verdict.ok) {
      const gasRelated = verdict.blockersFa.some((b) => b.includes("گازسنجی"));
      return cntBad(
        req, res,
        gasRelated ? "E-HSE-RESUME-GAS-REQUIRED" : "E-HSE-RESUME-BLOCKED",
        "ازسرگیری مجاز نیست", 409, verdict.blockersFa,
      );
    }

    const subject = engSubject(req);
    const saved = (await r.upsert("WorkPermit", { Id: permit.Id }, {
      Status: "active",
      SuspendedAt: null,
      SuspendedBy: null,
      SuspendReasonFa: null,
    }, subject?.id))?.row;

    res.json(cntOk(req, { item: { ...saved, statusFa: PERMIT_STATUS_FA[saved.Status] } }));
  } catch (err) { next(err); }
});

/** بستن پروانه. */
app.post("/api/hse/permit/:id/close", hseRequire("hse.permit.approve"), async (req, res, next) => {
  try {
    const r = await repo();
    const permit = await r.findOne("WorkPermit", [{ column: "Id", op: "eq", value: String(req.params.id) }]);
    if (!permit) return cntBad(req, res, "E-HSE-PERMIT-NOT-FOUND", "پروانهٔ کار یافت نشد", 404);

    const subject = engSubject(req);
    const isolations = await r.list("IsolationLog", { where: [{ column: "PermitId", op: "eq", value: permit.Id }], limit: 500 });
    const openIncidents = (await r.list("SafetyIncident", {
      where: [{ column: "ProjectId", op: "eq", value: permit.ProjectId }],
      limit: 2000,
    })).filter((i) => i.PermitId === permit.Id && i.Status !== "closed").length;

    const verdict = canClosePermit({ permit, isolations, openIncidents, closerId: subject?.id });
    if (req.body?.dryRun) return res.json(cntOk(req, { dryRun: true, verdict }));
    if (!verdict.ok) return cntBad(req, res, "E-HSE-CLOSE-BLOCKED", "بستن پروانه مجاز نیست", 409, verdict.blockersFa);

    const saved = (await r.upsert("WorkPermit", { Id: permit.Id }, {
      Status: "closed",
      ClosedBy: subject?.id ?? "system",
      ClosedAt: new Date().toISOString(),
    }, subject?.id))?.row;

    res.json(cntOk(req, { item: { ...saved, statusFa: PERMIT_STATUS_FA[saved.Status] }, warningsFa: verdict.warningsFa }));
  } catch (err) { next(err); }
});

/** اعتبارسنجی میدانی با توکن QR — بدون افشای شناسهٔ داخلی. */
app.get("/api/hse/permit/verify/:token", hseRequire("hse.permit.view"), async (req, res, next) => {
  try {
    const r = await repo();
    const permit = await r.findOne("WorkPermit", [{ column: "QrToken", op: "eq", value: String(req.params.token) }]);
    if (!permit) return cntBad(req, res, "E-HSE-PERMIT-NOT-FOUND", "پروانه‌ای با این توکن یافت نشد", 404);

    const now = new Date();
    const st = permitState(permit, now);
    const gasTests = await r.list("GasTestLog", { where: [{ column: "PermitId", op: "eq", value: permit.Id }], limit: 500 });
    const gas = latestGasTest(gasTests, permit.Id, now);

    /* پاسخ عمداً کم‌جزئیات است: این مسیر برای اسکن روی کاغذ کارگاه است. */
    res.json(cntOk(req, {
      permitNo: permit.PermitNo,
      titleFa: permit.TitleFa,
      typeFa: PERMIT_TYPE_FA[permit.PermitType] ?? permit.PermitType,
      statusFa: st.statusFa,
      isValidNow: st.isValidNow,
      expiresInHours: st.expiresInHours,
      locationFa: permit.LocationFa,
      gasTestSafe: gas.test ? gas.isSafe && gas.isFresh : null,
    }));
  } catch (err) { next(err); }
});

/**
 * دروازهٔ ایمنی آمادگی راه‌اندازی — پلی به ماژول راه‌اندازی.
 *
 * تا پیش از این، تابع rfsuSafetyClearance در موتور بود ولی هیچ مسیری
 * صدایش نمی‌زد؛ یعنی گزارش RFSU پروانه‌های واقعی را نمی‌دید. این
 * اندپوینت شکاف G-05 گزارش کیفی ماژول راه‌اندازی را عملاً می‌بندد.
 */
app.get("/api/hse/rfsu-clearance/:systemId", hseRequire("hse.permit.view"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");
    const systemId = String(req.params.systemId);
    const r = await repo();
    const scope = [{ column: "ProjectId", op: "eq", value: projectId }];
    const [permits, incidents, violations] = await Promise.all([
      r.list("WorkPermit", { where: scope, limit: 5000 }),
      r.list("SafetyIncident", { where: scope, limit: 5000 }),
      r.list("HSE_Violation", { where: scope, limit: 5000 }),
    ]);

    const now = new Date();
    const clearance = rfsuSafetyClearance({ systemId, permits, incidents, violations, now });
    /* فهرست پروانه‌های مانع را هم می‌دهیم تا کاربر بداند کدام‌ها را
     * باید ببندد، نه فقط چندتا. */
    const blocking = permits
      .filter((p) => p.SystemId === systemId && !["closed", "rejected"].includes(p.Status))
      .map((p) => ({
        permitNo: p.PermitNo,
        titleFa: p.TitleFa,
        typeFa: PERMIT_TYPE_FA[p.PermitType] ?? p.PermitType,
        statusFa: permitState(p, now).statusFa,
      }));

    /* رویدادهای مانع هم مثل پروانه‌ها فهرست می‌شوند: صرفِ شمارش، کاربر
     * را مجبور می‌کرد کل فهرست حوادث را دستی بگردد. */
    const blockingIncidents = incidents
      .filter((i) => i.SystemId === systemId && i.Status !== "closed")
      .map((i) => ({
        id: i.Id,
        incidentNo: i.IncidentNo,
        titleFa: i.TitleFa,
        typeFa: INCIDENT_TYPE_FA[i.IncidentType] ?? i.IncidentType,
        severityFa: SEVERITY_FA[i.Severity] ?? i.Severity,
        isBlocker: i.Severity === "high" || i.Severity === "critical",
      }));

    /* دستورهای توقف کار مانع هم مثل پروانه و رویداد فهرست می‌شوند. */
    const blockingStopWork = violations
      .filter((v) => {
        const st = violationState(v, now);
        if (!st.isBlocking || !st.isEnforceable) return false;
        return v.StopWorkScope === "project" || v.SystemId === systemId;
      })
      .map((v) => ({
        id: v.Id,
        violationNo: v.ViolationNo,
        titleFa: v.TitleFa,
        typeFa: VIOLATION_TYPE_FA[v.ViolationType] ?? v.ViolationType,
        scopeFa: STOP_WORK_SCOPE_FA[v.StopWorkScope ?? "activity"],
      }));

    res.json(cntOk(req, {
      systemId, clearance, blockingPermits: blocking, blockingIncidents, blockingStopWork,
    }));
  } catch (err) { next(err); }
});

/** واژگان سامانهٔ پروانه. */
app.get("/api/hse/permit-vocab", hseRequire("hse.permit.view"), (req, res) => {
  res.json(cntOk(req, {
    permitTypes: PERMIT_TYPES.map((t) => ({
      code: t,
      titleFa: PERMIT_TYPE_FA[t],
      isHighRisk: HIGH_RISK_PERMITS.includes(t),
      requiresGasTest: GAS_TEST_REQUIRED_PERMITS.includes(t),
      requiresIsolation: ISOLATION_REQUIRED_PERMITS.includes(t),
    })),
    isolationTypes: ISOLATION_TYPES.map((t) => ({ code: t, titleFa: ISOLATION_TYPE_FA[t] })),
    approvalLevels: APPROVAL_LEVELS.map((l, i) => ({ code: l, titleFa: APPROVAL_LEVEL_FA[l], order: i + 1 })),
    gasLimits: GAS_LIMITS,
    gasTestValidityMinutes: GAS_TEST_VALIDITY_MINUTES,
  }));
});

/* ══════════════ MOD-08 / HSE — حوادث، تحقیق و CAPA (D5) ══════════════ */

/** رکوردهای وابستهٔ یک رویداد. */
async function incidentBundle(r, incident) {
  const [persons, invList, actions] = await Promise.all([
    r.list("InjuredPerson", { where: [{ column: "IncidentId", op: "eq", value: incident.Id }], limit: 200 }),
    r.list("HSE_Investigation", { where: [{ column: "IncidentId", op: "eq", value: incident.Id }], limit: 5 }),
    r.list("CapaAction", { where: [{ column: "ProjectId", op: "eq", value: incident.ProjectId }], limit: 5000 }),
  ]);
  const investigation = invList[0] ?? null;
  const nodes = investigation
    ? await r.list("RootCauseNode", { where: [{ column: "InvestigationId", op: "eq", value: investigation.Id }], limit: 500 })
    : [];
  const mineActions = actions.filter(
    (a) => a.SourceId === incident.Id || (investigation && a.SourceId === investigation.Id),
  );
  return { persons, investigation, nodes, actions: mineActions };
}

/** ثبت رویداد ایمنی. */
app.post("/api/hse/incident", hseRequire("hse.incident.record"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");
    const b = req.body || {};
    const subject = engSubject(req);
    const r = await repo();

    const type = b.incidentType;
    const lostDays = b.lostDays == null ? null : Number(b.lostDays);
    const input = {
      ProjectId: projectId,
      IncidentNo: String(b.incidentNo ?? "").trim(),
      TitleFa: String(b.titleFa ?? "").trim(),
      IncidentType: type,
      OccurredAt: b.occurredAt,
      ReportedBy: String(b.reportedBy ?? subject?.id ?? "").trim(),
      LostDays: lostDays,
      /* شدت پیشنهادی موتور مبناست مگر کاربر صریحاً بالاتر ببرد. */
      Severity: b.severity ?? (INCIDENT_TYPES.includes(type) ? suggestSeverity(type, lostDays ?? 0) : undefined),
      Status: "open",
    };
    const issues = validateIncidentInput(input);
    if (issues.length) return cntBad(req, res, issues[0].code, issues[0].message, 422, issues.map((i) => i.message));

    const dup = await r.findOne("SafetyIncident", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "IncidentNo", op: "eq", value: input.IncidentNo },
    ]);
    if (dup) return cntBad(req, res, "E-HSE-DUP-INCIDENT", `رویداد ${input.IncidentNo} قبلاً ثبت شده است`, 409);

    /* پروانه باید متعلق به همین پروژه باشد. */
    if (b.permitId) {
      const permit = await r.findOne("WorkPermit", [{ column: "Id", op: "eq", value: String(b.permitId) }]);
      if (!permit) return cntBad(req, res, "E-HSE-PERMIT-NOT-FOUND", "پروانهٔ کار یافت نشد", 404);
      if (permit.ProjectId !== projectId) {
        return cntBad(req, res, "E-HSE-PERMIT-CROSS-PROJECT", "پروانه متعلق به پروژهٔ دیگری است", 409);
      }
    }

    const row = await r.create("SafetyIncident", {
      ...input,
      LocationFa: b.locationFa || null,
      SystemId: b.systemId || null,
      ActivityId: b.activityId || null,
      PermitId: b.permitId || null,
      InjuredPersonFa: b.injuredPersonFa || null,
      FlashReportAt: b.flashReportAt || null,
      IsEmergencyActivated: b.isEmergencyActivated === true,
      GpsLat: b.gpsLat ?? null,
      GpsLng: b.gpsLng ?? null,
    }, subject?.id, "inc");

    const need = requiresInvestigation(row);
    res.status(201).json(cntOk(req, {
      id: row.Id,
      item: {
        ...row,
        typeFa: INCIDENT_TYPE_FA[row.IncidentType] ?? row.IncidentType,
        severityFa: SEVERITY_FA[row.Severity] ?? row.Severity,
      },
      requiresInvestigation: need,
      flashReport: flashReportStatus(row),
    }));
  } catch (err) { next(err); }
});

/** ثبت گزارش فوری روی رویداد موجود. */
app.post("/api/hse/incident/:id/flash-report", hseRequire("hse.incident.record"), async (req, res, next) => {
  try {
    const r = await repo();
    const incident = await r.findOne("SafetyIncident", [{ column: "Id", op: "eq", value: String(req.params.id) }]);
    if (!incident) return cntBad(req, res, "E-HSE-INCIDENT-NOT-FOUND", "رویداد یافت نشد", 404);
    if (incident.FlashReportAt) {
      return cntBad(req, res, "E-HSE-FLASH-ALREADY", "گزارش فوری قبلاً ثبت شده است", 409);
    }

    const subject = engSubject(req);
    const saved = (await r.upsert("SafetyIncident", { Id: incident.Id }, {
      FlashReportAt: req.body?.reportedAt || new Date().toISOString(),
      IsEmergencyActivated: req.body?.isEmergencyActivated === true ? true : incident.IsEmergencyActivated,
    }, subject?.id))?.row;

    res.json(cntOk(req, { item: saved, flashReport: flashReportStatus(saved) }));
  } catch (err) { next(err); }
});

/** افزودن فرد مصدوم. */
app.post("/api/hse/incident/:id/injured", hseRequire("hse.incident.record"), async (req, res, next) => {
  try {
    const r = await repo();
    const incident = await r.findOne("SafetyIncident", [{ column: "Id", op: "eq", value: String(req.params.id) }]);
    if (!incident) return cntBad(req, res, "E-HSE-INCIDENT-NOT-FOUND", "رویداد یافت نشد", 404);
    if (incident.Status === "closed") {
      return cntBad(req, res, "E-HSE-INCIDENT-LOCKED", "رویداد بسته قابل ویرایش نیست", 409);
    }

    const b = req.body || {};
    const input = {
      FullNameFa: String(b.fullNameFa ?? "").trim(),
      InjuryType: b.injuryType,
      BodyPart: b.bodyPart ?? null,
      LostWorkDays: b.lostWorkDays ?? null,
      RestrictedDays: b.restrictedDays ?? null,
    };
    const issues = validateInjuredPersonInput(input);
    if (issues.length) return cntBad(req, res, issues[0].code, issues[0].message, 422, issues.map((i) => i.message));

    const existing = await r.list("InjuredPerson", { where: [{ column: "IncidentId", op: "eq", value: incident.Id }], limit: 200 });
    const no = Number(b.personNo ?? 0) || existing.length + 1;
    if (existing.some((x) => Number(x.PersonNo) === no)) {
      return cntBad(req, res, "E-HSE-DUP-INJURED", `مصدوم شمارهٔ ${no} قبلاً ثبت شده است`, 409);
    }

    const row = await r.create("InjuredPerson", {
      ProjectId: incident.ProjectId,
      IncidentId: incident.Id,
      PersonNo: no,
      PersonRef: b.personRef || null,
      FullNameFa: input.FullNameFa,
      CompanyFa: b.companyFa || null,
      InjuryType: input.InjuryType,
      BodyPart: input.BodyPart,
      LostWorkDays: input.LostWorkDays,
      RestrictedDays: input.RestrictedDays,
      ReturnedToWork: b.returnedToWork === true,
      ReturnedAt: b.returnedAt || null,
      TreatmentFa: b.treatmentFa || null,
    }, engSubject(req)?.id, "inj");

    const all = [...existing, row];
    res.status(201).json(cntOk(req, {
      id: row.Id,
      item: {
        ...row,
        injuryFa: INJURY_TYPE_FA[row.InjuryType] ?? row.InjuryType,
        bodyPartFa: row.BodyPart ? (BODY_PART_FA[row.BodyPart] ?? row.BodyPart) : null,
      },
      summary: injurySummary(all, incident.Id),
    }));
  } catch (err) { next(err); }
});

/** آغاز تحقیق حادثه. */
app.post("/api/hse/incident/:id/investigation", hseRequire("hse.investigation.manage"), async (req, res, next) => {
  try {
    const r = await repo();
    const incident = await r.findOne("SafetyIncident", [{ column: "Id", op: "eq", value: String(req.params.id) }]);
    if (!incident) return cntBad(req, res, "E-HSE-INCIDENT-NOT-FOUND", "رویداد یافت نشد", 404);

    const existing = await r.list("HSE_Investigation", { where: [{ column: "IncidentId", op: "eq", value: incident.Id }], limit: 5 });
    if (existing.length) {
      return cntBad(req, res, "E-HSE-DUP-INVESTIGATION", "برای این رویداد تحقیق ثبت شده است", 409);
    }

    const b = req.body || {};
    const subject = engSubject(req);
    const row = await r.create("HSE_Investigation", {
      ProjectId: incident.ProjectId,
      IncidentId: incident.Id,
      LeadInvestigator: String(b.leadInvestigator ?? subject?.id ?? "").trim() || "system",
      TeamFa: b.teamFa || null,
      StartedAt: b.startedAt || new Date().toISOString().slice(0, 10),
      MethodFa: b.methodFa || "five_why",
      Status: "in_progress",
    }, subject?.id, "inv");

    res.status(201).json(cntOk(req, {
      id: row.Id,
      item: { ...row, statusFa: INVESTIGATION_STATUS_FA[row.Status] },
      requiredDepth: MIN_ROOT_CAUSE_DEPTH,
    }));
  } catch (err) { next(err); }
});

/** افزودن گره به درخت ریشه‌یابی. */
app.post("/api/hse/investigation/:id/cause", hseRequire("hse.investigation.manage"), async (req, res, next) => {
  try {
    const r = await repo();
    const inv = await r.findOne("HSE_Investigation", [{ column: "Id", op: "eq", value: String(req.params.id) }]);
    if (!inv) return cntBad(req, res, "E-HSE-INVESTIGATION-NOT-FOUND", "تحقیق یافت نشد", 404);
    if (inv.Status === "approved") {
      return cntBad(req, res, "E-HSE-INVESTIGATION-LOCKED", "تحقیق تأییدشده قابل ویرایش نیست", 409);
    }

    const b = req.body || {};
    const input = {
      StatementFa: String(b.statementFa ?? "").trim(),
      CauseLevel: b.causeLevel,
      Category: b.category ?? null,
    };
    const issues = validateRootCauseInput(input);
    if (issues.length) return cntBad(req, res, issues[0].code, issues[0].message, 422, issues.map((i) => i.message));

    const existing = await r.list("RootCauseNode", { where: [{ column: "InvestigationId", op: "eq", value: inv.Id }], limit: 500 });

    /* عمق از والد مشتق می‌شود نه از ورودی کاربر — وگرنه درخت با عمق
     * جعلی از دروازهٔ «۵ چرا» رد می‌شود. */
    let depth = 0;
    const parentId = b.parentId || null;
    if (parentId) {
      const parent = existing.find((x) => x.Id === parentId);
      if (!parent) return cntBad(req, res, "E-HSE-CAUSE-PARENT-NOT-FOUND", "گره والد یافت نشد", 404);
      depth = Number(parent.Depth ?? 0) + 1;
    }

    const no = existing.length + 1;
    const row = await r.create("RootCauseNode", {
      ProjectId: inv.ProjectId,
      InvestigationId: inv.Id,
      NodeNo: no,
      ParentId: parentId,
      Depth: depth,
      StatementFa: input.StatementFa,
      CauseLevel: input.CauseLevel,
      Category: input.Category,
      EvidenceFa: b.evidenceFa || null,
      IsVerified: b.isVerified === true,
    }, engSubject(req)?.id, "rcn");

    const all = [...existing, row];
    res.status(201).json(cntOk(req, {
      id: row.Id,
      item: {
        ...row,
        levelFa: CAUSE_LEVEL_FA[row.CauseLevel] ?? row.CauseLevel,
        categoryFa: row.Category ? (CAUSE_CATEGORY_FA[row.Category] ?? row.Category) : null,
      },
      tree: rootCauseTree(all, inv.Id),
    }));
  } catch (err) { next(err); }
});

/** ثبت اقدام اصلاحی یا پیشگیرانه. */
app.post("/api/hse/capa", hseRequire("hse.capa.manage"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");
    const b = req.body || {};
    const r = await repo();

    const sourceType = String(b.sourceType ?? "");
    if (!["incident", "investigation", "inspection", "violation", "audit"].includes(sourceType)) {
      return cntBad(req, res, "E-HSE-CAPA-SOURCE", "منشأ اقدام نامعتبر است", 422);
    }
    const sourceId = String(b.sourceId ?? "").trim();
    if (!sourceId) return cntBad(req, res, "E-HSE-CAPA-SOURCE-REQUIRED", "شناسهٔ منشأ الزامی است", 422);

    const input = {
      ActionFa: String(b.actionFa ?? "").trim(),
      ActionType: b.actionType,
      OwnerRef: String(b.ownerRef ?? "").trim(),
      DueDate: b.dueDate,
    };
    const issues = validateCapaInput(input);
    if (issues.length) return cntBad(req, res, issues[0].code, issues[0].message, 422, issues.map((i) => i.message));

    const existing = await r.list("CapaAction", {
      where: [{ column: "ProjectId", op: "eq", value: projectId }],
      limit: 5000,
    });
    const sameSource = existing.filter((a) => a.SourceType === sourceType && a.SourceId === sourceId);
    const no = sameSource.length + 1;

    const row = await r.create("CapaAction", {
      ProjectId: projectId,
      SourceType: sourceType,
      SourceId: sourceId,
      ActionNo: no,
      ActionFa: input.ActionFa,
      ActionType: input.ActionType,
      RootCauseNodeId: b.rootCauseNodeId || null,
      OwnerRef: input.OwnerRef,
      DueDate: input.DueDate,
      Status: "open",
    }, engSubject(req)?.id, "capa");

    res.status(201).json(cntOk(req, {
      id: row.Id,
      item: { ...row, typeFa: CAPA_TYPE_FA[row.ActionType], statusFa: CAPA_STATUS_FA[row.Status] },
      summary: capaSummary([...sameSource, row]),
    }));
  } catch (err) { next(err); }
});

/** به‌روزرسانی وضعیت اقدام. */
app.post("/api/hse/capa/:id/status", hseRequire("hse.capa.manage"), async (req, res, next) => {
  try {
    const r = await repo();
    const action = await r.findOne("CapaAction", [{ column: "Id", op: "eq", value: String(req.params.id) }]);
    if (!action) return cntBad(req, res, "E-HSE-CAPA-NOT-FOUND", "اقدام یافت نشد", 404);

    const status = String(req.body?.status ?? "");
    if (!["in_progress", "completed", "cancelled"].includes(status)) {
      return cntBad(req, res, "E-HSE-CAPA-STATUS", "وضعیت نامعتبر است — راستی‌آزمایی مسیر جدا دارد", 422);
    }
    if (action.Status === "verified") {
      return cntBad(req, res, "E-HSE-CAPA-VERIFIED", "اقدام تأییدشده قابل تغییر نیست", 409);
    }

    const subject = engSubject(req);
    const saved = (await r.upsert("CapaAction", { Id: action.Id }, {
      Status: status,
      CompletedAt: status === "completed" ? (req.body?.completedAt || new Date().toISOString().slice(0, 10)) : action.CompletedAt,
    }, subject?.id))?.row;

    res.json(cntOk(req, { item: { ...saved, statusFa: CAPA_STATUS_FA[saved.Status] } }));
  } catch (err) { next(err); }
});

/** راستی‌آزمایی اثربخشی اقدام — مسیر جدا چون مجوز جدا دارد. */
app.post("/api/hse/capa/:id/verify", hseRequire("hse.capa.verify"), async (req, res, next) => {
  try {
    const r = await repo();
    const action = await r.findOne("CapaAction", [{ column: "Id", op: "eq", value: String(req.params.id) }]);
    if (!action) return cntBad(req, res, "E-HSE-CAPA-NOT-FOUND", "اقدام یافت نشد", 404);

    if (action.Status !== "completed") {
      return cntBad(req, res, "E-HSE-CAPA-NOT-COMPLETED", "فقط اقدام انجام‌شده قابل راستی‌آزمایی است", 409);
    }
    const subject = engSubject(req);
    /* راستی‌آزمای اثربخشی نباید همان مجری باشد. */
    if (subject?.id && subject.id === action.OwnerRef) {
      return cntBad(req, res, "E-HSE-CAPA-SELF-VERIFY", "مجری اقدام نمی‌تواند اثربخشی آن را تأیید کند", 409);
    }

    const saved = (await r.upsert("CapaAction", { Id: action.Id }, {
      Status: "verified",
      VerifiedBy: subject?.id ?? "system",
      VerifiedAt: new Date().toISOString().slice(0, 10),
      EffectivenessFa: req.body?.effectivenessFa || null,
    }, subject?.id))?.row;

    res.json(cntOk(req, { item: { ...saved, statusFa: CAPA_STATUS_FA[saved.Status] } }));
  } catch (err) { next(err); }
});

/** تأیید تحقیق. */
app.post("/api/hse/investigation/:id/approve", hseRequire("hse.investigation.approve"), async (req, res, next) => {
  try {
    const r = await repo();
    const inv = await r.findOne("HSE_Investigation", [{ column: "Id", op: "eq", value: String(req.params.id) }]);
    if (!inv) return cntBad(req, res, "E-HSE-INVESTIGATION-NOT-FOUND", "تحقیق یافت نشد", 404);

    const subject = engSubject(req);
    const [nodes, actions] = await Promise.all([
      r.list("RootCauseNode", { where: [{ column: "InvestigationId", op: "eq", value: inv.Id }], limit: 500 }),
      r.list("CapaAction", { where: [{ column: "ProjectId", op: "eq", value: inv.ProjectId }], limit: 5000 }),
    ]);

    const verdict = canCloseInvestigation({ investigation: inv, nodes, actions, approverId: subject?.id });
    if (req.body?.dryRun) return res.json(cntOk(req, { dryRun: true, verdict, tree: rootCauseTree(nodes, inv.Id) }));
    if (!verdict.ok) {
      return cntBad(req, res, "E-HSE-INVESTIGATION-NOT-APPROVABLE", "تحقیق قابل تأیید نیست", 409, verdict.blockersFa);
    }

    const b = req.body || {};
    const saved = (await r.upsert("HSE_Investigation", { Id: inv.Id }, {
      Status: "approved",
      CompletedAt: inv.CompletedAt || new Date().toISOString().slice(0, 10),
      ApprovedBy: subject?.id ?? "system",
      ApprovedAt: new Date().toISOString().slice(0, 10),
      SummaryFa: b.summaryFa ?? inv.SummaryFa,
      DirectCost: b.directCost ?? inv.DirectCost,
      IndirectCost: b.indirectCost ?? inv.IndirectCost,
      LessonsLearnedFa: b.lessonsLearnedFa ?? inv.LessonsLearnedFa,
    }, subject?.id))?.row;

    res.json(cntOk(req, {
      item: { ...saved, statusFa: INVESTIGATION_STATUS_FA[saved.Status] },
      verdict,
      tree: rootCauseTree(nodes, inv.Id),
    }));
  } catch (err) { next(err); }
});

/** جزئیات رویداد با همهٔ رکوردهای وابسته. */
app.get("/api/hse/incident/:id", hseRequire("hse.incident.record"), async (req, res, next) => {
  try {
    const r = await repo();
    const incident = await r.findOne("SafetyIncident", [{ column: "Id", op: "eq", value: String(req.params.id) }]);
    if (!incident) return cntBad(req, res, "E-HSE-INCIDENT-NOT-FOUND", "رویداد یافت نشد", 404);

    const { persons, investigation, nodes, actions } = await incidentBundle(r, incident);

    res.json(cntOk(req, {
      item: {
        ...incident,
        typeFa: INCIDENT_TYPE_FA[incident.IncidentType] ?? incident.IncidentType,
        severityFa: SEVERITY_FA[incident.Severity] ?? incident.Severity,
      },
      flashReport: flashReportStatus(incident),
      requiresInvestigation: requiresInvestigation(incident),
      persons: persons.map((p) => ({
        ...p,
        injuryFa: INJURY_TYPE_FA[p.InjuryType] ?? p.InjuryType,
        bodyPartFa: p.BodyPart ? (BODY_PART_FA[p.BodyPart] ?? p.BodyPart) : null,
      })),
      injurySummary: injurySummary(persons, incident.Id),
      investigation: investigation
        ? { ...investigation, statusFa: INVESTIGATION_STATUS_FA[investigation.Status] ?? investigation.Status }
        : null,
      tree: investigation ? rootCauseTree(nodes, investigation.Id) : null,
      nodes: nodes.map((n) => ({
        ...n,
        levelFa: CAUSE_LEVEL_FA[n.CauseLevel] ?? n.CauseLevel,
        categoryFa: n.Category ? (CAUSE_CATEGORY_FA[n.Category] ?? n.Category) : null,
      })),
      actions: actions.map((a) => ({ ...a, typeFa: CAPA_TYPE_FA[a.ActionType], statusFa: CAPA_STATUS_FA[a.Status] })),
      capaSummary: capaSummary(actions),
      closeGate: canCloseIncidentFull({ incident, investigation, nodes, actions, persons }),
    }));
  } catch (err) { next(err); }
});

/** بستن رویداد. */
app.post("/api/hse/incident/:id/close", hseRequire("hse.incident.close"), async (req, res, next) => {
  try {
    const r = await repo();
    const incident = await r.findOne("SafetyIncident", [{ column: "Id", op: "eq", value: String(req.params.id) }]);
    if (!incident) return cntBad(req, res, "E-HSE-INCIDENT-NOT-FOUND", "رویداد یافت نشد", 404);

    const subject = engSubject(req);
    const { persons, investigation, nodes, actions } = await incidentBundle(r, incident);
    const verdict = canCloseIncidentFull({ incident, investigation, nodes, actions, persons, closerId: subject?.id });

    if (req.body?.dryRun) return res.json(cntOk(req, { dryRun: true, verdict }));
    if (!verdict.ok) return cntBad(req, res, "E-HSE-INCIDENT-NOT-CLOSABLE", "رویداد قابل بستن نیست", 409, verdict.blockersFa);

    const b = req.body || {};
    const saved = (await r.upsert("SafetyIncident", { Id: incident.Id }, {
      Status: "closed",
      ClosedBy: subject?.id ?? "system",
      ClosedAt: new Date().toISOString(),
      RootCauseFa: b.rootCauseFa ?? incident.RootCauseFa,
      CorrectiveActionFa: b.correctiveActionFa ?? incident.CorrectiveActionFa,
    }, subject?.id))?.row;

    res.json(cntOk(req, { item: saved, verdict }));
  } catch (err) { next(err); }
});

/** ثبت نفرساعت روزانه. */
app.post("/api/hse/man-hours", hseRequire("hse.manhour.record"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");
    const b = req.body || {};
    const r = await repo();

    const hours = Number(b.manHours);
    if (!Number.isFinite(hours) || hours < 0) {
      return cntBad(req, res, "E-HSE-MANHOUR-INVALID", "نفرساعت باید عدد نامنفی باشد", 422);
    }
    const logDate = String(b.logDate ?? "").trim();
    if (!logDate) return cntBad(req, res, "E-HSE-MANHOUR-DATE-REQUIRED", "تاریخ سیاهه الزامی است", 422);

    /* «کل پروژه» به‌جای null: ستون در ایندکس یکتا شرکت دارد و مقدار
     * تهی ایدمپوتنسی را در SQL Server از بین می‌برد. */
    const contractor = String(b.contractorFa ?? "").trim() || "کل پروژه";
    /* ایدمپوتنت: ثبت دوبارهٔ همان روز و همان پیمانکار به‌روزرسانی است نه
     * ردیف تازه — وگرنه مخرج شاخص‌ها دو برابر می‌شود. */
    const saved = (await r.upsert("HSE_ManHourLog", {
      ProjectId: projectId,
      LogDate: logDate,
      ContractorFa: contractor,
    }, {
      ManHours: hours,
      HeadCount: b.headCount ?? null,
      SourceFa: b.sourceFa === "timesheet" ? "timesheet" : "manual",
      NoteFa: b.noteFa || null,
    }, engSubject(req)?.id));

    res.status(saved.action === "insert" ? 201 : 200).json(cntOk(req, {
      id: saved.row.Id,
      item: saved.row,
      action: saved.action,
    }));
  } catch (err) { next(err); }
});

/** فهرست رویدادها با شاخص‌های ایمنی. */
app.get("/api/hse/incident", hseRequire("hse.incident.record"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");
    const r = await repo();
    const scope = [{ column: "ProjectId", op: "eq", value: projectId }];

    /* چهار کوئری ثابت، مستقل از تعداد رویداد. */
    const [incidents, persons, investigations, manHourLogs] = await Promise.all([
      r.list("SafetyIncident", { where: scope, limit: 5000 }),
      r.list("InjuredPerson", { where: scope, limit: 20000 }),
      r.list("HSE_Investigation", { where: scope, limit: 5000 }),
      r.list("HSE_ManHourLog", { where: scope, limit: 20000 }),
    ]);

    const invByIncident = new Map(investigations.map((i) => [i.IncidentId, i]));
    const now = new Date();
    const items = incidents.map((i) => {
      const inv = invByIncident.get(i.Id) ?? null;
      return {
        ...i,
        typeFa: INCIDENT_TYPE_FA[i.IncidentType] ?? i.IncidentType,
        severityFa: SEVERITY_FA[i.Severity] ?? i.Severity,
        flashReport: flashReportStatus(i, now),
        requiresInvestigation: requiresInvestigation(i),
        investigationStatus: inv ? (INVESTIGATION_STATUS_FA[inv.Status] ?? inv.Status) : null,
        injuredCount: persons.filter((p) => p.IncidentId === i.Id).length,
      };
    });

    res.json(cntOk(req, {
      items,
      count: items.length,
      metrics: safetyMetricsFull({
        incidents, persons, manHourLogs,
        from: req.query.from ? String(req.query.from) : undefined,
        to: req.query.to ? String(req.query.to) : undefined,
      }),
      manHours: manHourTotal(manHourLogs),
    }));
  } catch (err) { next(err); }
});

/** واژگان حوادث. */
app.get("/api/hse/incident-vocab", hseRequire("hse.incident.record"), (req, res) => {
  res.json(cntOk(req, {
    incidentTypes: INCIDENT_TYPES.map((t) => ({ code: t, titleFa: INCIDENT_TYPE_FA[t] })),
    severities: SEVERITIES.map((s) => ({ code: s, titleFa: SEVERITY_FA[s] })),
    injuryTypes: INJURY_TYPES.map((t) => ({ code: t, titleFa: INJURY_TYPE_FA[t] })),
    bodyParts: BODY_PARTS.map((b) => ({ code: b, titleFa: BODY_PART_FA[b] })),
    causeLevels: CAUSE_LEVELS.map((c) => ({ code: c, titleFa: CAUSE_LEVEL_FA[c] })),
    causeCategories: CAUSE_CATEGORIES.map((c) => ({ code: c, titleFa: CAUSE_CATEGORY_FA[c] })),
    capaTypes: CAPA_TYPES.map((t) => ({ code: t, titleFa: CAPA_TYPE_FA[t] })),
    thresholds: {
      flashReportSlaMinutes: FLASH_REPORT_SLA_MINUTES,
      minRootCauseDepth: MIN_ROOT_CAUSE_DEPTH,
    },
  }));
});

/* ═══════ MOD-08 / HSE — بازرسی، تخلف و توقف کار (D6، شکاف GH-04) ═══════ */

/**
 * همگام‌سازی قفل فعالیت.
 *
 * `Activity.IsStopWorkOrder` مشتق است و هرگز مستقیم نوشته نمی‌شود:
 * پس از هر تغییر در تخلف، وضعیت واقعی از موتور بازخوانی و روی ردیف
 * فعالیت نشانده می‌شود. اگر ستون مستقیم نوشته می‌شد، بستن یک تخلف
 * می‌توانست قفلِ تخلف دیگری را هم بردارد.
 */
async function syncActivityLock(r, projectId, activityId, userId) {
  if (!activityId) return null;
  const activity = await r.findOne("Activity", [{ column: "Id", op: "eq", value: activityId }]);
  if (!activity) return null;

  const violations = await r.list("HSE_Violation", {
    where: [{ column: "ProjectId", op: "eq", value: projectId }],
    limit: 5000,
  });
  const state = activityStopWorkState({
    activityId,
    violations,
    areaFa: activity.AreaFa ?? null,
    systemId: activity.SystemId ?? null,
  });

  if (Boolean(activity.IsStopWorkOrder) !== state.isLocked) {
    await r.upsert("Activity", { Id: activityId }, { IsStopWorkOrder: state.isLocked }, userId);
  }
  return state;
}

/** ثبت بازرسی ایمنی. */
app.post("/api/hse/inspection", hseRequire("hse.inspection.conduct"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");
    const b = req.body || {};
    const subject = engSubject(req);
    const r = await repo();

    const no = String(b.inspectionNo ?? "").trim();
    if (!no) return cntBad(req, res, "E-HSE-INSPECTION-NO", "شمارهٔ بازرسی الزامی است", 422);
    const titleFa = String(b.titleFa ?? "").trim();
    if (!titleFa) return cntBad(req, res, "E-HSE-INSPECTION-TITLE", "عنوان بازرسی الزامی است", 422);
    const type = String(b.inspectionType ?? "");
    if (!["walkthrough", "toolbox", "audit", "drill", "equipment"].includes(type)) {
      return cntBad(req, res, "E-HSE-INSPECTION-TYPE", "نوع بازرسی نامعتبر است", 422);
    }

    const dup = await r.findOne("SafetyInspection", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "InspectionNo", op: "eq", value: no },
    ]);
    if (dup) return cntBad(req, res, "E-HSE-DUP-INSPECTION", `بازرسی ${no} قبلاً ثبت شده است`, 409);

    const row = await r.create("SafetyInspection", {
      ProjectId: projectId,
      InspectionNo: no,
      TitleFa: titleFa,
      InspectionType: type,
      InspectedAt: b.inspectedAt || new Date().toISOString().slice(0, 10),
      InspectedBy: String(b.inspectedBy ?? subject?.id ?? "").trim() || "system",
      AreaFa: b.areaFa || null,
      ScorePct: b.scorePct ?? null,
      NoteFa: b.noteFa || null,
      Status: "draft",
    }, subject?.id, "insp");

    res.status(201).json(cntOk(req, { id: row.Id, item: row, passScore: INSPECTION_PASS_SCORE }));
  } catch (err) { next(err); }
});

/** افزودن یافته به بازرسی. */
app.post("/api/hse/inspection/:id/finding", hseRequire("hse.inspection.conduct"), async (req, res, next) => {
  try {
    const r = await repo();
    const insp = await r.findOne("SafetyInspection", [{ column: "Id", op: "eq", value: String(req.params.id) }]);
    if (!insp) return cntBad(req, res, "E-HSE-INSPECTION-NOT-FOUND", "بازرسی یافت نشد", 404);
    if (insp.Status === "closed") {
      return cntBad(req, res, "E-HSE-INSPECTION-LOCKED", "بازرسی بسته یافتهٔ تازه نمی‌پذیرد", 409);
    }

    const b = req.body || {};
    const input = {
      DescriptionFa: String(b.descriptionFa ?? "").trim(),
      Category: b.category,
      Severity: b.severity,
    };
    const issues = validateFindingInput(input);
    if (issues.length) return cntBad(req, res, issues[0].code, issues[0].message, 422, issues.map((i) => i.message));

    const existing = await r.list("InspectionFinding", {
      where: [{ column: "InspectionId", op: "eq", value: insp.Id }],
      limit: 500,
    });
    const no = Number(b.findingNo ?? 0) || existing.length + 1;
    if (existing.some((x) => Number(x.FindingNo) === no)) {
      return cntBad(req, res, "E-HSE-DUP-FINDING", `یافتهٔ شمارهٔ ${no} قبلاً ثبت شده است`, 409);
    }

    const row = await r.create("InspectionFinding", {
      ProjectId: insp.ProjectId,
      InspectionId: insp.Id,
      FindingNo: no,
      DescriptionFa: input.DescriptionFa,
      Category: input.Category,
      Severity: input.Severity,
      AreaFa: b.areaFa || insp.AreaFa || null,
      ActivityId: b.activityId || null,
      PhotoRef: b.photoRef || null,
      OwnerRef: b.ownerRef || null,
      /* مهلت از شدت مشتق می‌شود مگر کاربر صریح بدهد. */
      DueDate: b.dueDate || suggestViolationDueDate(input.Severity, insp.InspectedAt),
      Status: "open",
    }, engSubject(req)?.id, "find");

    const all = [...existing, row];
    /* شمارنده‌های جدول موجود همگام می‌مانند تا گزارش‌های قدیمی نشکنند. */
    const sum = findingSummary(all, insp.Id);
    await r.upsert("SafetyInspection", { Id: insp.Id }, {
      FindingsCount: sum.total,
      ClosedFindings: sum.closed,
    }, engSubject(req)?.id);

    res.status(201).json(cntOk(req, {
      id: row.Id,
      item: {
        ...row,
        categoryFa: FINDING_CATEGORY_FA[row.Category] ?? row.Category,
        severityFa: SEVERITY_FA[row.Severity] ?? row.Severity,
        statusFa: FINDING_STATUS_FA[row.Status],
      },
      summary: sum,
    }));
  } catch (err) { next(err); }
});

/** بستن یا ابطال یافته. */
app.post("/api/hse/finding/:id/close", hseRequire("hse.finding.close"), async (req, res, next) => {
  try {
    const r = await repo();
    const finding = await r.findOne("InspectionFinding", [{ column: "Id", op: "eq", value: String(req.params.id) }]);
    if (!finding) return cntBad(req, res, "E-HSE-FINDING-NOT-FOUND", "یافته پیدا نشد", 404);
    if (finding.Status === "closed" || finding.Status === "void") {
      return cntBad(req, res, "E-HSE-FINDING-LOCKED", "این یافته قبلاً نهایی شده است", 409);
    }

    const b = req.body || {};
    const status = b.status === "void" ? "void" : "closed";
    /* ابطال باید دلیل داشته باشد وگرنه راه فرار از بستن یافته می‌شود. */
    const note = String(b.closureNoteFa ?? "").trim();
    if (status === "void" && !note) {
      return cntBad(req, res, "E-HSE-FINDING-VOID-REASON", "ابطال یافته بدون دلیل ممکن نیست", 422);
    }

    const subject = engSubject(req);
    const saved = (await r.upsert("InspectionFinding", { Id: finding.Id }, {
      Status: status,
      ClosedAt: new Date().toISOString().slice(0, 10),
      ClosedBy: subject?.id ?? "system",
      ClosureNoteFa: note || null,
    }, subject?.id))?.row;

    const all = await r.list("InspectionFinding", {
      where: [{ column: "InspectionId", op: "eq", value: finding.InspectionId }],
      limit: 500,
    });
    const sum = findingSummary(all, finding.InspectionId);
    await r.upsert("SafetyInspection", { Id: finding.InspectionId }, {
      FindingsCount: sum.total,
      ClosedFindings: sum.closed,
    }, subject?.id);

    res.json(cntOk(req, {
      item: { ...saved, statusFa: FINDING_STATUS_FA[saved.Status] },
      summary: sum,
    }));
  } catch (err) { next(err); }
});

/** صدور تخلف ایمنی (و در صورت لزوم دستور توقف کار). */
app.post("/api/hse/violation", hseRequire("hse.violation.issue"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");
    const b = req.body || {};
    const subject = engSubject(req);
    const r = await repo();

    const issuedAt = b.issuedAt || new Date().toISOString();
    const input = {
      ViolationNo: String(b.violationNo ?? "").trim(),
      TitleFa: String(b.titleFa ?? "").trim(),
      ViolationType: b.violationType,
      Severity: b.severity,
      IssuedAt: issuedAt,
      IssuedBy: String(b.issuedBy ?? subject?.id ?? "").trim(),
      ActivityId: b.activityId || null,
      SystemId: b.systemId || null,
      AreaFa: b.areaFa || null,
      IsStopWork: b.isStopWork === true,
      StopWorkScope: b.stopWorkScope || null,
      FineAmount: b.fineAmount ?? null,
    };

    /* الزام توقف کار پیش از اعتبارسنجی سنجیده می‌شود تا پیام خطا دربارهٔ
     * دامنهٔ غایب، بعد از پیام «توقف کار الزامی است» نیاید. */
    const need = stopWorkRequirement(input);
    if (need.required && input.IsStopWork !== true) {
      return cntBad(req, res, "E-HSE-SWO-REQUIRED", need.reasonFa, 422, [need.reasonFa]);
    }

    const issues = validateViolationInput(input);
    if (issues.length) return cntBad(req, res, issues[0].code, issues[0].message, 422, issues.map((i) => i.message));

    /* توقف کار مجوز جداگانه دارد: صدور تخلف ساده کافی نیست. */
    if (input.IsStopWork === true) {
      const verdict = rbacEvaluate(subject, "hse.violation.stopwork", {});
      if (!verdict.allow) {
        return cntBad(req, res, "E-HSE-SWO-FORBIDDEN", "صدور دستور توقف کار مجوز جداگانه لازم دارد", 403);
      }
    }

    const dup = await r.findOne("HSE_Violation", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "ViolationNo", op: "eq", value: input.ViolationNo },
    ]);
    if (dup) return cntBad(req, res, "E-HSE-DUP-VIOLATION", `تخلف ${input.ViolationNo} قبلاً ثبت شده است`, 409);

    if (input.ActivityId) {
      const activity = await r.findOne("Activity", [{ column: "Id", op: "eq", value: input.ActivityId }]);
      if (!activity) return cntBad(req, res, "E-HSE-ACTIVITY-NOT-FOUND", "فعالیت یافت نشد", 404);
      if (activity.ProjectId !== projectId) {
        return cntBad(req, res, "E-HSE-ACTIVITY-CROSS-PROJECT", "فعالیت متعلق به پروژهٔ دیگری است", 409);
      }
    }

    const row = await r.create("HSE_Violation", {
      ProjectId: projectId,
      ViolationNo: input.ViolationNo,
      TitleFa: input.TitleFa,
      ViolationType: input.ViolationType,
      Severity: input.Severity,
      IssuedAt: issuedAt,
      IssuedBy: input.IssuedBy,
      AreaFa: input.AreaFa,
      ActivityId: input.ActivityId,
      SystemId: input.SystemId,
      PermitId: b.permitId || null,
      InspectionId: b.inspectionId || null,
      FindingId: b.findingId || null,
      ContractorFa: b.contractorFa || null,
      OffenderRef: b.offenderRef || null,
      IsStopWork: input.IsStopWork,
      StopWorkScope: input.IsStopWork ? input.StopWorkScope : null,
      FineAmount: input.FineAmount,
      GpsLat: b.gpsLat ?? null,
      GpsLng: b.gpsLng ?? null,
      CorrectiveRequestFa: b.correctiveRequestFa || null,
      DueDate: b.dueDate || suggestViolationDueDate(input.Severity, issuedAt),
      NoteFa: b.noteFa || null,
      Status: "issued",
    }, subject?.id, "vio");

    const lock = await syncActivityLock(r, projectId, row.ActivityId, subject?.id);

    res.status(201).json(cntOk(req, {
      id: row.Id,
      item: {
        ...row,
        typeFa: VIOLATION_TYPE_FA[row.ViolationType] ?? row.ViolationType,
        severityFa: SEVERITY_FA[row.Severity] ?? row.Severity,
        statusFa: VIOLATION_STATUS_FA[row.Status],
        scopeFa: row.StopWorkScope ? (STOP_WORK_SCOPE_FA[row.StopWorkScope] ?? row.StopWorkScope) : null,
      },
      state: violationState(row),
      stopWorkRequired: need,
      activityLock: lock,
    }));
  } catch (err) { next(err); }
});

/** ثبت بازبینی مجدد پس از رفع تخلف. */
app.post("/api/hse/violation/:id/re-inspect", hseRequire("hse.violation.issue"), async (req, res, next) => {
  try {
    const r = await repo();
    const violation = await r.findOne("HSE_Violation", [{ column: "Id", op: "eq", value: String(req.params.id) }]);
    if (!violation) return cntBad(req, res, "E-HSE-VIOLATION-NOT-FOUND", "تخلف یافت نشد", 404);
    if (violation.Status === "closed" || violation.Status === "void") {
      return cntBad(req, res, "E-HSE-VIOLATION-LOCKED", "تخلف نهایی‌شده بازبینی نمی‌پذیرد", 409);
    }

    const subject = engSubject(req);
    const existing = await r.list("ViolationClosure", {
      where: [{ column: "ViolationId", op: "eq", value: violation.Id }],
      limit: 100,
    });
    const attempt = existing.length + 1;
    const ok = req.body?.isSatisfactory === true;

    const row = await r.create("ViolationClosure", {
      ProjectId: violation.ProjectId,
      ViolationId: violation.Id,
      AttemptNo: attempt,
      ReInspectedAt: req.body?.reInspectedAt || new Date().toISOString(),
      ReInspectedBy: String(req.body?.reInspectedBy ?? subject?.id ?? "").trim() || "system",
      IsSatisfactory: ok,
      EvidenceFa: req.body?.evidenceFa || null,
      PhotoRef: req.body?.photoRef || null,
      RejectReasonFa: ok ? null : (req.body?.rejectReasonFa || null),
    }, subject?.id, "vcl");

    /* بازبینی ناموفق تخلف را به «در حال رفع» برمی‌گرداند، نه بسته. */
    const saved = (await r.upsert("HSE_Violation", { Id: violation.Id }, {
      Status: ok ? "re_inspected" : "in_progress",
    }, subject?.id))?.row;

    res.status(201).json(cntOk(req, {
      id: row.Id,
      item: row,
      violation: { ...saved, statusFa: VIOLATION_STATUS_FA[saved.Status] },
      attemptNo: attempt,
    }));
  } catch (err) { next(err); }
});

/** آزادسازی تخلف و رفع قفل فعالیت. */
app.post("/api/hse/violation/:id/release", hseRequire("hse.violation.release"), async (req, res, next) => {
  try {
    const r = await repo();
    const violation = await r.findOne("HSE_Violation", [{ column: "Id", op: "eq", value: String(req.params.id) }]);
    if (!violation) return cntBad(req, res, "E-HSE-VIOLATION-NOT-FOUND", "تخلف یافت نشد", 404);

    const subject = engSubject(req);
    const [closures, actions] = await Promise.all([
      r.list("ViolationClosure", { where: [{ column: "ViolationId", op: "eq", value: violation.Id }], limit: 100 }),
      r.list("CapaAction", { where: [{ column: "ProjectId", op: "eq", value: violation.ProjectId }], limit: 5000 }),
    ]);

    const verdict = canReleaseViolation({ violation, closures, actions, releaserId: subject?.id });
    if (req.body?.dryRun) return res.json(cntOk(req, { dryRun: true, verdict }));
    if (!verdict.ok) {
      return cntBad(req, res, "E-HSE-VIOLATION-NOT-RELEASABLE", "تخلف قابل آزادسازی نیست", 409, verdict.blockersFa);
    }

    const saved = (await r.upsert("HSE_Violation", { Id: violation.Id }, {
      Status: "closed",
    }, subject?.id))?.row;

    const last = [...closures].sort((a, b) => Number(a.AttemptNo) - Number(b.AttemptNo)).at(-1);
    if (last) {
      await r.upsert("ViolationClosure", { Id: last.Id }, {
        ReleasedBy: subject?.id ?? "system",
        ReleasedAt: new Date().toISOString(),
      }, subject?.id);
    }

    /* قفل پس از بسته‌شدن تخلف بازمحاسبه می‌شود — اگر تخلف دیگری هنوز
     * همان فعالیت را می‌گیرد، قفل باز نمی‌شود. */
    const lock = await syncActivityLock(r, violation.ProjectId, violation.ActivityId, subject?.id);

    res.json(cntOk(req, {
      item: { ...saved, statusFa: VIOLATION_STATUS_FA[saved.Status] },
      verdict,
      activityLock: lock,
    }));
  } catch (err) { next(err); }
});

/** ابطال تخلف. */
app.post("/api/hse/violation/:id/void", hseRequire("hse.violation.release"), async (req, res, next) => {
  try {
    const r = await repo();
    const violation = await r.findOne("HSE_Violation", [{ column: "Id", op: "eq", value: String(req.params.id) }]);
    if (!violation) return cntBad(req, res, "E-HSE-VIOLATION-NOT-FOUND", "تخلف یافت نشد", 404);
    if (violation.Status === "closed" || violation.Status === "void") {
      return cntBad(req, res, "E-HSE-VIOLATION-LOCKED", "تخلف نهایی‌شده قابل ابطال نیست", 409);
    }
    const reason = String(req.body?.reasonFa ?? "").trim();
    if (!reason) return cntBad(req, res, "E-HSE-VOID-REASON", "ابطال تخلف بدون دلیل ممکن نیست", 422);

    const subject = engSubject(req);
    const saved = (await r.upsert("HSE_Violation", { Id: violation.Id }, {
      Status: "void",
      NoteFa: reason,
    }, subject?.id))?.row;

    const lock = await syncActivityLock(r, violation.ProjectId, violation.ActivityId, subject?.id);

    res.json(cntOk(req, {
      item: { ...saved, statusFa: VIOLATION_STATUS_FA[saved.Status] },
      activityLock: lock,
    }));
  } catch (err) { next(err); }
});

/** بستن بازرسی. */
app.post("/api/hse/inspection/:id/close", hseRequire("hse.inspection.conduct"), async (req, res, next) => {
  try {
    const r = await repo();
    const insp = await r.findOne("SafetyInspection", [{ column: "Id", op: "eq", value: String(req.params.id) }]);
    if (!insp) return cntBad(req, res, "E-HSE-INSPECTION-NOT-FOUND", "بازرسی یافت نشد", 404);

    const [findings, violations] = await Promise.all([
      r.list("InspectionFinding", { where: [{ column: "InspectionId", op: "eq", value: insp.Id }], limit: 500 }),
      r.list("HSE_Violation", { where: [{ column: "InspectionId", op: "eq", value: insp.Id }], limit: 500 }),
    ]);

    const verdict = canCloseInspection({ inspection: insp, findings, violations });
    if (req.body?.dryRun) return res.json(cntOk(req, { dryRun: true, verdict, summary: findingSummary(findings, insp.Id) }));
    if (!verdict.ok) {
      return cntBad(req, res, "E-HSE-INSPECTION-NOT-CLOSABLE", "بازرسی قابل بستن نیست", 409, verdict.blockersFa);
    }

    const sum = findingSummary(findings, insp.Id);
    const saved = (await r.upsert("SafetyInspection", { Id: insp.Id }, {
      Status: "closed",
      FindingsCount: sum.total,
      ClosedFindings: sum.closed,
      ScorePct: req.body?.scorePct ?? insp.ScorePct,
    }, engSubject(req)?.id))?.row;

    res.json(cntOk(req, { item: saved, verdict, summary: sum }));
  } catch (err) { next(err); }
});

/** جزئیات بازرسی با یافته‌ها و تخلفات. */
app.get("/api/hse/inspection/:id", hseRequire("hse.inspection.conduct"), async (req, res, next) => {
  try {
    const r = await repo();
    const insp = await r.findOne("SafetyInspection", [{ column: "Id", op: "eq", value: String(req.params.id) }]);
    if (!insp) return cntBad(req, res, "E-HSE-INSPECTION-NOT-FOUND", "بازرسی یافت نشد", 404);

    const [findings, violations] = await Promise.all([
      r.list("InspectionFinding", { where: [{ column: "InspectionId", op: "eq", value: insp.Id }], limit: 500 }),
      r.list("HSE_Violation", { where: [{ column: "InspectionId", op: "eq", value: insp.Id }], limit: 500 }),
    ]);

    const now = new Date();
    res.json(cntOk(req, {
      item: insp,
      findings: findings.map((f) => ({
        ...f,
        categoryFa: FINDING_CATEGORY_FA[f.Category] ?? f.Category,
        severityFa: SEVERITY_FA[f.Severity] ?? f.Severity,
        statusFa: FINDING_STATUS_FA[f.Status] ?? f.Status,
      })),
      summary: findingSummary(findings, insp.Id, now),
      violations: violations.map((v) => ({
        ...v,
        typeFa: VIOLATION_TYPE_FA[v.ViolationType] ?? v.ViolationType,
        statusFa: VIOLATION_STATUS_FA[v.Status] ?? v.Status,
        state: violationState(v, now),
      })),
      closeGate: canCloseInspection({ inspection: insp, findings, violations, now }),
    }));
  } catch (err) { next(err); }
});

/** جزئیات تخلف. */
app.get("/api/hse/violation/:id", hseRequire("hse.violation.view"), async (req, res, next) => {
  try {
    const r = await repo();
    const violation = await r.findOne("HSE_Violation", [{ column: "Id", op: "eq", value: String(req.params.id) }]);
    if (!violation) return cntBad(req, res, "E-HSE-VIOLATION-NOT-FOUND", "تخلف یافت نشد", 404);

    const [closures, actions] = await Promise.all([
      r.list("ViolationClosure", { where: [{ column: "ViolationId", op: "eq", value: violation.Id }], limit: 100 }),
      r.list("CapaAction", { where: [{ column: "ProjectId", op: "eq", value: violation.ProjectId }], limit: 5000 }),
    ]);
    const mineActions = actions.filter((a) => a.SourceType === "violation" && a.SourceId === violation.Id);

    res.json(cntOk(req, {
      item: {
        ...violation,
        typeFa: VIOLATION_TYPE_FA[violation.ViolationType] ?? violation.ViolationType,
        severityFa: SEVERITY_FA[violation.Severity] ?? violation.Severity,
        statusFa: VIOLATION_STATUS_FA[violation.Status] ?? violation.Status,
        scopeFa: violation.StopWorkScope ? (STOP_WORK_SCOPE_FA[violation.StopWorkScope] ?? violation.StopWorkScope) : null,
      },
      state: violationState(violation),
      closures: [...closures].sort((a, b) => Number(a.AttemptNo) - Number(b.AttemptNo)),
      actions: mineActions.map((a) => ({ ...a, statusFa: CAPA_STATUS_FA[a.Status] })),
      releaseGate: canReleaseViolation({ violation, closures, actions }),
    }));
  } catch (err) { next(err); }
});

/** فهرست تخلفات با خلاصه. */
app.get("/api/hse/violation", hseRequire("hse.violation.view"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");
    const r = await repo();
    const violations = await r.list("HSE_Violation", {
      where: [{ column: "ProjectId", op: "eq", value: projectId }],
      limit: 5000,
    });

    const now = new Date();
    const onlyStopWork = String(req.query.stopWork || "") === "1";
    const items = violations
      .map((v) => ({
        ...v,
        typeFa: VIOLATION_TYPE_FA[v.ViolationType] ?? v.ViolationType,
        severityFa: SEVERITY_FA[v.Severity] ?? v.Severity,
        statusFa: VIOLATION_STATUS_FA[v.Status] ?? v.Status,
        scopeFa: v.StopWorkScope ? (STOP_WORK_SCOPE_FA[v.StopWorkScope] ?? v.StopWorkScope) : null,
        state: violationState(v, now),
      }))
      .filter((v) => !onlyStopWork || v.state.isBlocking);

    res.json(cntOk(req, {
      items,
      count: items.length,
      summary: violationSummary(violations, now),
    }));
  } catch (err) { next(err); }
});

/** وضعیت قفل یک فعالیت. */
app.get("/api/hse/activity-lock/:activityId", hseRequire("hse.violation.view"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");
    const activityId = String(req.params.activityId);
    const r = await repo();

    const activity = await r.findOne("Activity", [{ column: "Id", op: "eq", value: activityId }]);
    if (!activity) return cntBad(req, res, "E-HSE-ACTIVITY-NOT-FOUND", "فعالیت یافت نشد", 404);

    const violations = await r.list("HSE_Violation", {
      where: [{ column: "ProjectId", op: "eq", value: projectId }],
      limit: 5000,
    });
    const state = activityStopWorkState({
      activityId,
      violations,
      areaFa: activity.AreaFa ?? null,
      systemId: activity.SystemId ?? null,
    });

    res.json(cntOk(req, {
      activityId,
      activityNameFa: activity.NameFa,
      /* ستون ذخیره‌شده و وضعیت مشتق کنار هم می‌آیند تا ناسازگاری
       * احتمالی دیده شود، نه پنهان بماند. */
      storedFlag: Boolean(activity.IsStopWorkOrder),
      derived: state,
      inSync: Boolean(activity.IsStopWorkOrder) === state.isLocked,
      /* دستور توقفی که دامنه یا مرجعش ناقص است اثری ندارد؛ صریح
       * گزارش می‌شود تا کاربر خیال نکند کار متوقف شده. */
      unenforceableFa: state.unenforceableFa,
      blockingViolations: violations
        .filter((v) => state.blockingIds.includes(v.Id))
        .map((v) => ({
          id: v.Id,
          violationNo: v.ViolationNo,
          titleFa: v.TitleFa,
          typeFa: VIOLATION_TYPE_FA[v.ViolationType] ?? v.ViolationType,
          scopeFa: STOP_WORK_SCOPE_FA[v.StopWorkScope ?? "activity"],
        })),
    }));
  } catch (err) { next(err); }
});

/** واژگان بازرسی و تخلف. */
app.get("/api/hse/violation-vocab", hseRequire("hse.violation.view"), (req, res) => {
  res.json(cntOk(req, {
    findingCategories: FINDING_CATEGORIES.map((c) => ({ code: c, titleFa: FINDING_CATEGORY_FA[c] })),
    findingStatuses: FINDING_STATUSES.map((s) => ({ code: s, titleFa: FINDING_STATUS_FA[s] })),
    violationTypes: VIOLATION_TYPES.map((t) => ({
      code: t,
      titleFa: VIOLATION_TYPE_FA[t],
      mandatoryStopWork: MANDATORY_STOP_WORK_TYPES.includes(t),
    })),
    violationStatuses: VIOLATION_STATUSES.map((s) => ({ code: s, titleFa: VIOLATION_STATUS_FA[s] })),
    stopWorkScopes: STOP_WORK_SCOPES.map((s) => ({ code: s, titleFa: STOP_WORK_SCOPE_FA[s] })),
    slaDays: VIOLATION_SLA_DAYS,
    inspectionPassScore: INSPECTION_PASS_SCORE,
  }));
});

/* ══════════════════════════════════════════════════════════════════
 * MOD-08 / HSE — بخش ۶: آموزش، بهداشت شغلی و محیط‌زیست (۰۸٫۵)
 * ══════════════════════════════════════════════════════════════════ */

/** ثبت جلسهٔ آموزش. */
app.post("/api/hse/training/session", hseRequire("hse.training.manage"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");
    const b = req.body || {};
    const subject = engSubject(req);
    const r = await repo();

    const input = {
      ProjectId: projectId,
      SessionNo: String(b.sessionNo ?? "").trim(),
      TitleFa: String(b.titleFa ?? "").trim(),
      CourseCode: String(b.courseCode ?? "").trim(),
      TrainingType: b.trainingType,
      HeldAt: b.heldAt,
      DurationMinutes: Number(b.durationMinutes),
      InstructorFa: String(b.instructorFa ?? "").trim(),
      ValidityMonths: b.validityMonths == null ? null : Number(b.validityMonths),
      Status: b.status === "planned" ? "planned" : "held",
    };
    const issues = validateTrainingSessionInput(input);
    if (issues.length) return cntBad(req, res, issues[0].code, issues[0].message, 422, issues.map((i) => i.message));

    const dup = await r.findOne("TrainingSession", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "SessionNo", op: "eq", value: input.SessionNo },
    ]);
    if (dup) return cntBad(req, res, "E-HSE-DUP-SESSION", `جلسهٔ ${input.SessionNo} قبلاً ثبت شده است`, 409);

    const row = await r.create("TrainingSession", {
      ...input,
      LocationFa: b.locationFa || null,
      ContractorFa: b.contractorFa || null,
      MaterialRef: b.materialRef || null,
    }, subject?.id, "trn");

    res.status(201).json(cntOk(req, { id: row.Id, item: row, state: trainingSessionState(row, []) }));
  } catch (err) { next(err); }
});

/**
 * افزودن حاضر به جلسه.
 *
 * وقتی فرد حاضر و قبول باشد، سابقهٔ آموزش (`SafetyTrainingRecord`) هم
 * ساخته یا به‌روز می‌شود — تنها نویسندهٔ آن جدول همین‌جاست تا گیت
 * `hseTraining` در منابع انسانی یک منبع حقیقت داشته باشد.
 */
app.post("/api/hse/training/session/:id/attendee", hseRequire("hse.training.manage"), async (req, res, next) => {
  try {
    const r = await repo();
    const session = await r.findOne("TrainingSession", [{ column: "Id", op: "eq", value: String(req.params.id) }]);
    if (!session || !hseSameProject(req, session)) {
      return cntBad(req, res, "E-HSE-SESSION-NOT-FOUND", "جلسهٔ آموزش یافت نشد", 404);
    }
    if (session.Status === "cancelled") {
      return cntBad(req, res, "E-HSE-SESSION-CANCELLED", "به جلسهٔ لغوشده حاضر افزوده نمی‌شود", 409);
    }

    const b = req.body || {};
    const subject = engSubject(req);
    const personRef = String(b.personRef ?? "").trim();
    if (!personRef) return cntBad(req, res, "E-HSE-ATTENDEE-PERSON", "شناسهٔ فرد الزامی است", 422);
    const personNameFa = String(b.personNameFa ?? "").trim();
    if (!personNameFa) return cntBad(req, res, "E-HSE-ATTENDEE-NAME", "نام فرد الزامی است", 422);

    const dup = await r.findOne("TrainingAttendee", [
      { column: "SessionId", op: "eq", value: session.Id },
      { column: "PersonRef", op: "eq", value: personRef },
    ]);
    if (dup) return cntBad(req, res, "E-HSE-DUP-ATTENDEE", "این فرد قبلاً در همین جلسه ثبت شده است", 409);

    /* نمرهٔ بیرون از بازهٔ ۰ تا ۱۰۰ میانگین نرخ قبولی را بی‌معنا
     * می‌کند و در گزارش آموزشِ کارفرما قابل دفاع نیست. */
    if (b.scorePct != null) {
      const sc = Number(b.scorePct);
      if (!Number.isFinite(sc) || sc < 0 || sc > 100) {
        return cntBad(req, res, "E-HSE-ATTENDEE-SCORE", "نمره باید عددی میان صفر تا صد باشد", 422);
      }
    }

    const attended = b.attended !== false;
    const passed = attended && b.passed !== false;

    const row = await r.create("TrainingAttendee", {
      ProjectId: session.ProjectId,
      SessionId: session.Id,
      PersonRef: personRef,
      PersonNameFa: personNameFa,
      TradeCode: b.tradeCode || null,
      ContractorFa: b.contractorFa || session.ContractorFa || null,
      Attended: attended,
      ScorePct: b.scorePct == null ? null : Number(b.scorePct),
      Passed: passed,
      SignatureRef: b.signatureRef || null,
      NoteFa: b.noteFa || null,
    }, subject?.id, "att");

    /* گواهی فقط برای حاضرِ قبول‌شده. غایب یا مردود سابقه نمی‌گیرد. */
    let record = null;
    if (attended && passed && session.Status === "held") {
      const st = trainingSessionState(session, [row]);
      record = (await r.upsert("SafetyTrainingRecord", {
        ProjectId: session.ProjectId,
        PersonRef: personRef,
        CourseCode: session.CourseCode,
      }, {
        CourseTitleFa: session.TitleFa,
        CompletedAt: String(session.HeldAt).slice(0, 10),
        ExpiresAt: st.certificateExpiry,
        ScorePct: b.scorePct == null ? null : Number(b.scorePct),
        CertificateNo: b.certificateNo || null,
        Status: "valid",
      }, subject?.id))?.row;
    }

    res.status(201).json(cntOk(req, { id: row.Id, item: row, certificate: record }));
  } catch (err) { next(err); }
});

/** فهرست جلسات آموزش با خلاصه. */
app.get("/api/hse/training/session", hseRequire("hse.training.view"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");
    const r = await repo();
    const scope = [{ column: "ProjectId", op: "eq", value: projectId }];
    /* سه کوئری ثابت، مستقل از تعداد جلسه. */
    const [sessions, attendees, records] = await Promise.all([
      r.list("TrainingSession", { where: scope, limit: 5000 }),
      r.list("TrainingAttendee", { where: scope, limit: 50000 }),
      r.list("SafetyTrainingRecord", { where: scope, limit: 50000 }),
    ]);

    const now = new Date();
    const items = sessions.map((x) => ({ ...x, state: trainingSessionState(x, attendees, now) }));

    res.json(cntOk(req, {
      items,
      count: items.length,
      summary: trainingSummary({ sessions, attendees, records, now }),
    }));
  } catch (err) { next(err); }
});

/** جزئیات یک جلسه با فهرست حاضران. */
app.get("/api/hse/training/session/:id", hseRequire("hse.training.view"), async (req, res, next) => {
  try {
    const r = await repo();
    const session = await r.findOne("TrainingSession", [{ column: "Id", op: "eq", value: String(req.params.id) }]);
    if (!session || !hseSameProject(req, session)) {
      return cntBad(req, res, "E-HSE-SESSION-NOT-FOUND", "جلسهٔ آموزش یافت نشد", 404);
    }

    const attendees = await r.list("TrainingAttendee", {
      where: [{ column: "SessionId", op: "eq", value: session.Id }], limit: 5000,
    });

    res.json(cntOk(req, {
      item: { ...session, state: trainingSessionState(session, attendees) },
      attendees,
    }));
  } catch (err) { next(err); }
});

/** ماتریس آموزش یک فرد. */
app.get("/api/hse/training/person/:personRef", hseRequire("hse.training.view"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");
    const r = await repo();
    const records = await r.list("SafetyTrainingRecord", {
      where: [{ column: "ProjectId", op: "eq", value: projectId }], limit: 50000,
    });
    const required = String(req.query.required || "").split(",").map((x) => x.trim()).filter(Boolean);

    res.json(cntOk(req, {
      matrix: personTrainingMatrix({
        personRef: String(req.params.personRef),
        records,
        requiredCourses: required.length ? required : [INDUCTION_COURSE_CODE],
      }),
    }));
  } catch (err) { next(err); }
});

/** تحویل تجهیزات حفاظت فردی. */
app.post("/api/hse/ppe", hseRequire("hse.ppe.issue"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");
    const b = req.body || {};
    const subject = engSubject(req);
    const r = await repo();

    const input = {
      ProjectId: projectId,
      IssueNo: String(b.issueNo ?? "").trim(),
      PersonRef: String(b.personRef ?? "").trim(),
      PersonNameFa: String(b.personNameFa ?? "").trim(),
      PpeType: b.ppeType,
      IssuedAt: b.issuedAt || new Date().toISOString().slice(0, 10),
      IssuedBy: String(b.issuedBy ?? subject?.id ?? "").trim() || "system",
      Quantity: b.quantity == null ? 1 : Number(b.quantity),
      ReplaceDueDate: b.replaceDueDate || null,
      Status: "issued",
    };
    const issues = validatePpeInput(input);
    if (!input.PersonNameFa) issues.push({ code: "E-HSE-PPE-NAME", message: "نام فرد الزامی است" });
    if (issues.length) return cntBad(req, res, issues[0].code, issues[0].message, 422, issues.map((i) => i.message));

    const dup = await r.findOne("PpeIssuance", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "IssueNo", op: "eq", value: input.IssueNo },
    ]);
    if (dup) return cntBad(req, res, "E-HSE-DUP-PPE", `تحویل ${input.IssueNo} قبلاً ثبت شده است`, 409);

    const row = await r.create("PpeIssuance", {
      ...input,
      SizeFa: b.sizeFa || null,
      SerialNo: b.serialNo || null,
      UnitCost: b.unitCost == null ? null : Number(b.unitCost),
      ContractorFa: b.contractorFa || null,
    }, subject?.id, "ppe");

    res.status(201).json(cntOk(req, {
      id: row.Id,
      item: { ...row, typeFa: PPE_TYPE_FA[row.PpeType] ?? row.PpeType },
      isCritical: CRITICAL_PPE.includes(row.PpeType),
    }));
  } catch (err) { next(err); }
});

/** بازگرداندن یا اعلام مفقودی تجهیز. */
app.post("/api/hse/ppe/:id/return", hseRequire("hse.ppe.issue"), async (req, res, next) => {
  try {
    const r = await repo();
    const row = await r.findOne("PpeIssuance", [{ column: "Id", op: "eq", value: String(req.params.id) }]);
    if (!row || !hseSameProject(req, row)) {
      return cntBad(req, res, "E-HSE-PPE-NOT-FOUND", "رکورد تحویل یافت نشد", 404);
    }
    if (row.Status !== "issued") {
      return cntBad(req, res, "E-HSE-PPE-LOCKED", "این تجهیز پیش‌تر تعیین تکلیف شده است", 409);
    }

    const status = ["returned", "lost", "damaged"].includes(req.body?.status) ? req.body.status : "returned";
    const subject = engSubject(req);
    const saved = (await r.upsert("PpeIssuance", { Id: row.Id }, {
      Status: status,
      ReturnedAt: req.body?.returnedAt || new Date().toISOString().slice(0, 10),
    }, subject?.id))?.row;

    res.json(cntOk(req, { item: { ...saved, statusFa: PPE_STATUS_FA[saved.Status] ?? saved.Status } }));
  } catch (err) { next(err); }
});

/** فهرست تحویل تجهیزات. */
app.get("/api/hse/ppe", hseRequire("hse.ppe.view"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");
    const r = await repo();
    const scope = [{ column: "ProjectId", op: "eq", value: projectId }];
    const [issuances, exams] = await Promise.all([
      r.list("PpeIssuance", { where: scope, limit: 50000 }),
      r.list("HealthExamination", { where: scope, limit: 20000 }),
    ]);

    const items = issuances.map((i) => ({
      ...i,
      typeFa: PPE_TYPE_FA[i.PpeType] ?? i.PpeType,
      statusFa: PPE_STATUS_FA[i.Status] ?? i.Status,
      isCritical: CRITICAL_PPE.includes(i.PpeType),
    }));

    /* شمارش وضعیت سلامت برای برنامه‌ریزی تجهیزات لازم است، ولی نام
     * فرد «غیرمجاز به کار» پروندهٔ پزشکی است — یافتهٔ لوپ ۶. */
    const summary = healthPpeSummary({ issuances, exams });
    if (!hseHas(req, "hse.health.view")) {
      summary.unfitPersons = [];
      summary.warningsFa = (summary.warningsFa ?? []).filter((w) => !/غیرمجاز/.test(String(w)));
    }

    res.json(cntOk(req, { items, count: items.length, summary }));
  } catch (err) { next(err); }
});

/** ثبت معاینهٔ طب کار. */
app.post("/api/hse/health/exam", hseRequire("hse.health.record"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");
    const b = req.body || {};
    const subject = engSubject(req);
    const r = await repo();

    const input = {
      ProjectId: projectId,
      ExamNo: String(b.examNo ?? "").trim(),
      PersonRef: String(b.personRef ?? "").trim(),
      PersonNameFa: String(b.personNameFa ?? "").trim(),
      ExamType: b.examType,
      ExaminedAt: b.examinedAt || new Date().toISOString().slice(0, 10),
      Fitness: b.fitness,
      RestrictionFa: b.restrictionFa || null,
      HazardCode: b.hazardCode || null,
      Status: "valid",
    };
    const issues = validateHealthExamInput(input);
    if (!input.PersonNameFa) issues.push({ code: "E-HSE-EXAM-NAME", message: "نام فرد الزامی است" });
    if (issues.length) return cntBad(req, res, issues[0].code, issues[0].message, 422, issues.map((i) => i.message));

    const dup = await r.findOne("HealthExamination", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "ExamNo", op: "eq", value: input.ExamNo },
    ]);
    if (dup) return cntBad(req, res, "E-HSE-DUP-EXAM", `معاینهٔ ${input.ExamNo} قبلاً ثبت شده است`, 409);

    /* تاریخ معاینهٔ بعدی از فاصلهٔ عامل زیان‌آور مشتق می‌شود؛ اگر عامل
     * ذکر نشده باشد، از ورودی خوانده می‌شود. */
    let next = b.nextExamDate || null;
    if (!next && input.HazardCode) {
      const hz = await r.findOne("OccupationalHazard", [
        { column: "ProjectId", op: "eq", value: projectId },
        { column: "HazardCode", op: "eq", value: input.HazardCode },
      ]);
      if (hz) next = nextExamDate(input.ExaminedAt, Number(hz.ExamIntervalMonths));
    }

    /* معاینهٔ قبلیِ همان فرد و همان نوع، جایگزین‌شده می‌شود تا آمار
     * وضعیت سلامت دو بار یک نفر را نشمارد. */
    const prior = await r.list("HealthExamination", {
      where: [
        { column: "ProjectId", op: "eq", value: projectId },
        { column: "PersonRef", op: "eq", value: input.PersonRef },
        { column: "ExamType", op: "eq", value: input.ExamType },
        /* فیلتر در کوئری نه در حافظه: تاریخچهٔ جایگزین‌شده هرگز دوباره
         * به‌روز نمی‌شود، پس خواندنش هزینهٔ بی‌ثمر است. */
        { column: "Status", op: "ne", value: "superseded" },
      ],
      limit: 500,
    });
    for (const old of prior) {
      await r.upsert("HealthExamination", { Id: old.Id }, { Status: "superseded" }, subject?.id);
    }

    const row = await r.create("HealthExamination", {
      ...input,
      NextExamDate: next,
      PhysicianFa: b.physicianFa || null,
      ClinicFa: b.clinicFa || null,
      ReportRef: b.reportRef || null,
    }, subject?.id, "exam");

    res.status(201).json(cntOk(req, {
      id: row.Id,
      item: { ...row, fitnessFa: FITNESS_FA[row.Fitness] ?? row.Fitness, typeFa: EXAM_TYPE_FA[row.ExamType] ?? row.ExamType },
      supersededCount: prior.length,
    }));
  } catch (err) { next(err); }
});

/** ثبت عامل زیان‌آور شغلی. */
app.post("/api/hse/health/hazard", hseRequire("hse.health.record"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");
    const b = req.body || {};
    const subject = engSubject(req);
    const r = await repo();

    const hazardCode = String(b.hazardCode ?? "").trim();
    if (!hazardCode) return cntBad(req, res, "E-HSE-HAZARD-CODE", "کد عامل زیان‌آور الزامی است", 422);
    if (!HAZARD_TYPES.includes(b.hazardType)) {
      return cntBad(req, res, "E-HSE-HAZARD-TYPE", "نوع عامل زیان‌آور نامعتبر است", 422);
    }
    const interval = Number(b.examIntervalMonths);
    if (!Number.isFinite(interval) || interval <= 0) {
      return cntBad(req, res, "E-HSE-HAZARD-INTERVAL", "فاصلهٔ معاینه باید عددی مثبت باشد", 422);
    }

    const dup = await r.findOne("OccupationalHazard", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "HazardCode", op: "eq", value: hazardCode },
    ]);
    if (dup) return cntBad(req, res, "E-HSE-DUP-HAZARD", `عامل ${hazardCode} قبلاً ثبت شده است`, 409);

    const row = await r.create("OccupationalHazard", {
      ProjectId: projectId,
      HazardCode: hazardCode,
      TitleFa: String(b.titleFa ?? "").trim() || hazardCode,
      HazardType: b.hazardType,
      TradeCode: b.tradeCode || null,
      ExposureLimitFa: b.exposureLimitFa || null,
      ExamIntervalMonths: interval,
      RequiredExamsFa: b.requiredExamsFa || null,
      RequiredPpeFa: b.requiredPpeFa || null,
      Status: "active",
    }, subject?.id, "hz");

    res.status(201).json(cntOk(req, { id: row.Id, item: { ...row, typeFa: HAZARD_TYPE_FA[row.HazardType] } }));
  } catch (err) { next(err); }
});

/** وضعیت سلامت شغلی یک فرد. */
app.get("/api/hse/health/person/:personRef", hseRequire("hse.health.view"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");
    const r = await repo();
    const scope = [{ column: "ProjectId", op: "eq", value: projectId }];
    const [exams, hazards] = await Promise.all([
      r.list("HealthExamination", { where: scope, limit: 20000 }),
      r.list("OccupationalHazard", { where: scope, limit: 2000 }),
    ]);

    res.json(cntOk(req, {
      state: personHealthState({
        personRef: String(req.params.personRef),
        exams, hazards,
        tradeCode: req.query.tradeCode ? String(req.query.tradeCode) : null,
      }),
    }));
  } catch (err) { next(err); }
});

/** فهرست معاینات با خلاصه. */
app.get("/api/hse/health/exam", hseRequire("hse.health.view"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");
    const r = await repo();
    const scope = [{ column: "ProjectId", op: "eq", value: projectId }];
    const [exams, issuances] = await Promise.all([
      r.list("HealthExamination", { where: scope, limit: 20000 }),
      r.list("PpeIssuance", { where: scope, limit: 50000 }),
    ]);

    const items = exams.map((e) => ({
      ...e,
      typeFa: EXAM_TYPE_FA[e.ExamType] ?? e.ExamType,
      fitnessFa: FITNESS_FA[e.Fitness] ?? e.Fitness,
    }));

    res.json(cntOk(req, { items, count: items.length, summary: healthPpeSummary({ issuances, exams }) }));
  } catch (err) { next(err); }
});

/**
 * دروازهٔ ورود فرد به کارگاه.
 *
 * این همان چیزی است که گیت `hseTraining` در ماژول منابع انسانی باید
 * بخواند. سه بُعد آموزش، تجهیزات و سلامت با «و» ترکیب می‌شوند.
 */
app.get("/api/hse/clearance/:personRef", hseRequire("hse.clearance.check"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");
    const personRef = String(req.params.personRef);
    const r = await repo();
    const scope = [{ column: "ProjectId", op: "eq", value: projectId }];

    const [trainings, issuances, exams, hazards] = await Promise.all([
      r.list("SafetyTrainingRecord", { where: scope, limit: 50000 }),
      r.list("PpeIssuance", { where: scope, limit: 50000 }),
      r.list("HealthExamination", { where: scope, limit: 20000 }),
      r.list("OccupationalHazard", { where: scope, limit: 2000 }),
    ]);

    const requiredCourses = String(req.query.required || "").split(",").map((x) => x.trim()).filter(Boolean);
    const requiredPpe = String(req.query.ppe || "").split(",").map((x) => x.trim()).filter(Boolean);
    const tradeCode = req.query.tradeCode ? String(req.query.tradeCode) : null;

    const clearance = personSiteClearance({
      personRef, trainings, issuances, exams, hazards,
      requiredCourses: requiredCourses.length ? requiredCourses : [INDUCTION_COURSE_CODE],
      requiredPpe,
      tradeCode,
    });

    res.json(cntOk(req, { personRef, clearance }));
  } catch (err) { next(err); }
});

/** ثبت سیاههٔ پسماند. */
app.post("/api/hse/waste", hseRequire("hse.waste.record"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");
    const b = req.body || {};
    const subject = engSubject(req);
    const r = await repo();

    const input = {
      ProjectId: projectId,
      WasteNo: String(b.wasteNo ?? "").trim(),
      WasteType: b.wasteType,
      DescriptionFa: String(b.descriptionFa ?? "").trim(),
      Quantity: Number(b.quantity),
      Unit: String(b.unit ?? "").trim(),
      GeneratedAt: b.generatedAt || new Date().toISOString().slice(0, 10),
      DisposalMethod: b.disposalMethod,
      ManifestNo: b.manifestNo || null,
      Status: "generated",
    };
    const issues = validateWasteInput(input);
    if (issues.length) return cntBad(req, res, issues[0].code, issues[0].message, 422, issues.map((i) => i.message));

    const dup = await r.findOne("WasteLog", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "WasteNo", op: "eq", value: input.WasteNo },
    ]);
    if (dup) return cntBad(req, res, "E-HSE-DUP-WASTE", `پسماند ${input.WasteNo} قبلاً ثبت شده است`, 409);

    const row = await r.create("WasteLog", {
      ...input,
      AreaFa: b.areaFa || null,
      CarrierFa: b.carrierFa || null,
      DestinationFa: b.destinationFa || null,
      CostAmount: b.costAmount == null ? null : Number(b.costAmount),
    }, subject?.id, "wst");

    res.status(201).json(cntOk(req, { id: row.Id, item: row, state: wasteLogState(row) }));
  } catch (err) { next(err); }
});

/** به‌روزرسانی وضعیت پسماند (حمل و دفع). */
app.post("/api/hse/waste/:id/status", hseRequire("hse.waste.record"), async (req, res, next) => {
  try {
    const r = await repo();
    const row = await r.findOne("WasteLog", [{ column: "Id", op: "eq", value: String(req.params.id) }]);
    if (!row || !hseSameProject(req, row)) {
      return cntBad(req, res, "E-HSE-WASTE-NOT-FOUND", "سیاههٔ پسماند یافت نشد", 404);
    }

    const status = req.body?.status;
    if (!["in_transit", "disposed", "rejected"].includes(status)) {
      return cntBad(req, res, "E-HSE-WASTE-STATUS", "وضعیت نامعتبر است", 422);
    }
    /* دفع بدون تاریخ دفع، رکورد ناقص می‌سازد که موتور بعداً ایراد
     * می‌گیرد؛ جلوی ساختنش را همین‌جا می‌گیریم. */
    const disposedAt = status === "disposed" ? (req.body?.disposedAt || new Date().toISOString().slice(0, 10)) : row.DisposedAt;
    if (status === "in_transit" && !String(req.body?.carrierFa ?? row.CarrierFa ?? "").trim()) {
      return cntBad(req, res, "E-HSE-WASTE-CARRIER-REQUIRED", "برای حمل، نام حمل‌کننده الزامی است", 422);
    }

    const subject = engSubject(req);
    const saved = (await r.upsert("WasteLog", { Id: row.Id }, {
      Status: status,
      DisposedAt: disposedAt,
      CarrierFa: req.body?.carrierFa || row.CarrierFa,
      DestinationFa: req.body?.destinationFa || row.DestinationFa,
    }, subject?.id))?.row;

    res.json(cntOk(req, { item: saved, state: wasteLogState(saved) }));
  } catch (err) { next(err); }
});

/** فهرست پسماند با خلاصه. */
app.get("/api/hse/waste", hseRequire("hse.env.view"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");
    const r = await repo();
    const logs = await r.list("WasteLog", {
      where: [{ column: "ProjectId", op: "eq", value: projectId }], limit: 20000,
    });

    const now = new Date();
    const items = logs.map((w) => ({ ...w, state: wasteLogState(w, now) }));

    res.json(cntOk(req, { items, count: items.length, summary: wasteSummary(logs, now) }));
  } catch (err) { next(err); }
});

/** ثبت اندازه‌گیری زیست‌محیطی. */
app.post("/api/hse/env/reading", hseRequire("hse.env.record"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");
    const b = req.body || {};
    const subject = engSubject(req);
    const r = await repo();

    const input = {
      ProjectId: projectId,
      ReadingNo: String(b.readingNo ?? "").trim(),
      Medium: b.medium,
      ParameterFa: String(b.parameterFa ?? "").trim(),
      MeasuredAt: b.measuredAt || new Date().toISOString(),
      MeasuredValue: Number(b.measuredValue),
      Unit: String(b.unit ?? "").trim(),
      LimitValue: Number(b.limitValue),
      Status: "recorded",
    };
    const issues = validateMonitoringInput(input);
    if (issues.length) return cntBad(req, res, issues[0].code, issues[0].message, 422, issues.map((i) => i.message));

    const dup = await r.findOne("EnvironmentalMonitoring", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "ReadingNo", op: "eq", value: input.ReadingNo },
    ]);
    if (dup) return cntBad(req, res, "E-HSE-DUP-READING", `اندازه‌گیری ${input.ReadingNo} قبلاً ثبت شده است`, 409);

    const row = await r.create("EnvironmentalMonitoring", {
      ...input,
      LocationFa: b.locationFa || null,
      MethodFa: b.methodFa || null,
      LabFa: b.labFa || null,
      CorrectiveActionFa: b.correctiveActionFa || null,
    }, subject?.id, "env");

    const state = monitoringState(row);
    res.status(201).json(cntOk(req, { id: row.Id, item: row, state }));
  } catch (err) { next(err); }
});

/** ثبت اقدام اصلاحی روی اندازه‌گیری فراتر از حد. */
app.post("/api/hse/env/reading/:id/action", hseRequire("hse.env.record"), async (req, res, next) => {
  try {
    const r = await repo();
    const row = await r.findOne("EnvironmentalMonitoring", [{ column: "Id", op: "eq", value: String(req.params.id) }]);
    if (!row || !hseSameProject(req, row)) {
      return cntBad(req, res, "E-HSE-READING-NOT-FOUND", "اندازه‌گیری یافت نشد", 404);
    }

    const st = monitoringState(row);
    /* اقدام اصلاحی روی اندازه‌گیری منطبق بی‌معناست و آمار «تجاوز با
     * اقدام» را آلوده می‌کند. */
    if (!st.isExceeded) {
      return cntBad(req, res, "E-HSE-ENV-NOT-EXCEEDED", "این اندازه‌گیری از حد مجاز فراتر نرفته است", 409);
    }
    const action = String(req.body?.correctiveActionFa ?? "").trim();
    if (!action) return cntBad(req, res, "E-HSE-ENV-ACTION-REQUIRED", "شرح اقدام اصلاحی الزامی است", 422);

    const subject = engSubject(req);
    const saved = (await r.upsert("EnvironmentalMonitoring", { Id: row.Id }, {
      CorrectiveActionFa: action,
      ViolationId: req.body?.violationId || row.ViolationId,
      Status: "verified",
    }, subject?.id))?.row;

    res.json(cntOk(req, { item: saved, state: monitoringState(saved) }));
  } catch (err) { next(err); }
});

/** فهرست پایش زیست‌محیطی با خلاصه. */
app.get("/api/hse/env/reading", hseRequire("hse.env.view"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");
    const r = await repo();
    const readings = await r.list("EnvironmentalMonitoring", {
      where: [{ column: "ProjectId", op: "eq", value: projectId }], limit: 20000,
    });

    const items = readings.map((x) => ({ ...x, state: monitoringState(x) }));
    res.json(cntOk(req, { items, count: items.length, summary: monitoringSummary(readings) }));
  } catch (err) { next(err); }
});

/** واژگان بخش آموزش، بهداشت و محیط‌زیست. */
app.get("/api/hse/training-vocab", hseRequire("hse.training.view"), (req, res) => {
  res.json(cntOk(req, {
    trainingTypes: TRAINING_TYPES.map((t) => ({ code: t, titleFa: TRAINING_TYPE_FA[t] })),
    ppeTypes: PPE_TYPES.map((t) => ({ code: t, titleFa: PPE_TYPE_FA[t], isCritical: CRITICAL_PPE.includes(t) })),
    hazardTypes: HAZARD_TYPES.map((t) => ({ code: t, titleFa: HAZARD_TYPE_FA[t] })),
    examTypes: EXAM_TYPES.map((t) => ({ code: t, titleFa: EXAM_TYPE_FA[t] })),
    fitnessResults: FITNESS_RESULTS.map((f) => ({ code: f, titleFa: FITNESS_FA[f] })),
    wasteTypes: WASTE_TYPES.map((w) => ({
      code: w, titleFa: WASTE_TYPE_FA[w], needsManifest: MANIFEST_REQUIRED_WASTE.includes(w),
    })),
    disposalMethods: DISPOSAL_METHODS.map((m) => ({ code: m, titleFa: DISPOSAL_METHOD_FA[m] })),
    monitoringMedia: MONITORING_MEDIA.map((m) => ({ code: m, titleFa: MEDIUM_FA[m] })),
    expiryWarningDays: EXPIRY_WARNING_DAYS,
    inductionCourseCode: INDUCTION_COURSE_CODE,
  }));
});

/* ══════════════════════════════════════════════════════════════════
 * MOD-08 / HSE — بخش ۷: شاخص، نمرهٔ ایمنی و هشدار زودهنگام (۰۸٫۶)
 * ══════════════════════════════════════════════════════════════════ */

/**
 * جمع‌آوری همهٔ دادهٔ پایهٔ لازم برای داشبورد ایمنی.
 *
 * هشت کوئری ثابت، مستقل از حجم داده. جدا شدن این تابع از مسیرها باعث
 * می‌شود داشبورد و انتشار عکس، هرگز روی دو مجموعهٔ ناهمخوان کار نکنند.
 */
async function hseDashboardInputs(r, projectId) {
  const scope = [{ column: "ProjectId", op: "eq", value: projectId }];
  const [
    incidents, persons, manHourLogs, permits, violations,
    sessions, attendees, trainings, readings, gasTests, rules, snapshots,
  ] = await Promise.all([
    r.list("SafetyIncident", { where: scope, limit: 20000 }),
    r.list("InjuredPerson", { where: scope, limit: 20000 }),
    r.list("HSE_ManHourLog", { where: scope, limit: 50000 }),
    r.list("WorkPermit", { where: scope, limit: 20000 }),
    r.list("HSE_Violation", { where: scope, limit: 20000 }),
    r.list("TrainingSession", { where: scope, limit: 5000 }),
    r.list("TrainingAttendee", { where: scope, limit: 50000 }),
    r.list("SafetyTrainingRecord", { where: scope, limit: 50000 }),
    r.list("EnvironmentalMonitoring", { where: scope, limit: 20000 }),
    r.list("GasTestLog", { where: scope, limit: 20000 }),
    r.list("HSE_AlertRule", { where: scope, limit: 500 }),
    r.list("HSE_MetricSnapshot", { where: scope, limit: 5000 }),
  ]);

  /* فهرست افراد از حاضرانِ آموزش و دریافت‌کنندگان تجهیزات ساخته
   * می‌شود، چون فهرست رسمی کارکنان در ماژول منابع انسانی است و مرز
   * ماژول‌ها نباید شکسته شود. اگر خالی بماند، موتور شکاف آموزش را
   * «قابل سنجش نبود» اعلام می‌کند نه صفر. */
  const personRefs = [...new Set(attendees.map((a) => a.PersonRef).filter(Boolean))];

  return {
    incidents, persons, manHourLogs, permits, violations,
    sessions, attendees, trainings, readings, gasTests, rules, snapshots, personRefs,
  };
}

/** داشبورد شاخص، هشدار، نمره و روند برای یک دوره. */
app.get("/api/hse/metrics", hseRequire("hse.metrics.view"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");

    /* دورهٔ پیش‌فرض ماه جاری است؛ کاربر نباید برای دیدن وضعیت امروز
     * مجبور به تایپ کد دوره باشد. */
    const periodCode = String(req.query.period || hsePeriodCodeOf(new Date()));
    if (!periodRange(periodCode)) {
      return cntBad(req, res, "E-HSE-PERIOD-INVALID", "کد دوره باید به شکل YYYY-MM باشد", 422);
    }

    const r = await repo();
    const inputs = await hseDashboardInputs(r, projectId);

    const headCount = Number(req.query.headCount);
    const dashboard = hseDashboard({
      periodCode,
      ...inputs,
      headCount: Number.isFinite(headCount) && headCount > 0 ? headCount : null,
    });

    res.json(cntOk(req, {
      ...dashboard,
      health: hseHealthContribution({ score: dashboard.score, alerts: dashboard.alerts }),
    }));
  } catch (err) { next(err); }
});

/** روند یک شاخص در همهٔ دوره‌های ثبت‌شده. */
app.get("/api/hse/metrics/trend/:metricCode", hseRequire("hse.metrics.view"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");

    const code = String(req.params.metricCode);
    if (!HSE_METRIC_CODES.includes(code)) {
      return cntBad(req, res, "E-HSE-METRIC-CODE", "کد شاخص نامعتبر است", 422);
    }

    const r = await repo();
    const snapshots = await r.list("HSE_MetricSnapshot", {
      where: [{ column: "ProjectId", op: "eq", value: projectId }], limit: 5000,
    });

    res.json(cntOk(req, { trend: metricTrend(snapshots, code) }));
  } catch (err) { next(err); }
});

/**
 * انتشار عکس شاخص برای یک دوره.
 *
 * عکس قبلیِ همان دوره جایگزین‌شده می‌شود، نه پاک: گزارشی که پیش‌تر به
 * کارفرما رفته باید در سامانه قابل بازیابی بماند حتی اگر عدد اصلاح
 * شود.
 */
app.post("/api/hse/metrics/publish", hseRequire("hse.metrics.publish"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");

    const b = req.body || {};
    const periodCode = String(b.periodCode || req.query.period || hsePeriodCodeOf(new Date()));
    const range = periodRange(periodCode);
    if (!range) {
      return cntBad(req, res, "E-HSE-PERIOD-INVALID", "کد دوره باید به شکل YYYY-MM باشد", 422);
    }

    /* دورهٔ آینده هنوز رخ نداده و انتشارش عددی می‌سازد که فردا غلط
     * می‌شود ولی در گزارش کارفرما مانده است. */
    if (new Date(range.from).getTime() > Date.now()) {
      return cntBad(req, res, "E-HSE-PERIOD-FUTURE", "دورهٔ آینده قابل انتشار نیست", 409);
    }

    const subject = engSubject(req);
    const r = await repo();
    const inputs = await hseDashboardInputs(r, projectId);
    const headCount = Number(b.headCount);
    const dashboard = hseDashboard({
      periodCode,
      ...inputs,
      headCount: Number.isFinite(headCount) && headCount > 0 ? headCount : null,
    });

    const rows = buildMetricSnapshots({ projectId, periodCode, dashboard });
    if (!rows.length) {
      return cntBad(req, res, "E-HSE-METRIC-NO-DATA", "هیچ شاخصی دادهٔ کافی برای انتشار نداشت", 409);
    }

    /* عکس‌های پیشین همین دوره کنار گذاشته می‌شوند تا کلید یکتا نشکند
     * و تاریخچه هم از دست نرود. */
    const prior = inputs.snapshots.filter(
      (s) => s.PeriodCode === periodCode && s.Status !== "superseded",
    );
    for (const old of prior) {
      await r.upsert("HSE_MetricSnapshot", { Id: old.Id }, { Status: "superseded" }, subject?.id);
    }

    const saved = [];
    for (const row of rows) {
      /* کلید یکتا سه‌تایی است، پس عکس جایگزین‌شده باید کنار برود پیش
       * از نوشتن دوباره — که بالا انجام شد. اینجا upsert روی همان
       * کلید طبیعی می‌نشیند. */
      const out = await r.upsert(
        "HSE_MetricSnapshot",
        { ProjectId: projectId, PeriodCode: periodCode, MetricCode: row.MetricCode },
        row,
        subject?.id,
      );
      saved.push(out?.row ?? row);
    }

    res.status(201).json(cntOk(req, {
      periodCode,
      published: saved.length,
      supersededCount: prior.length,
      items: saved,
      score: dashboard.score,
      health: hseHealthContribution({ score: dashboard.score, alerts: dashboard.alerts }),
    }));
  } catch (err) { next(err); }
});

/** فهرست قواعد هشدار همراه با وضعیت جاری‌شان. */
app.get("/api/hse/alerts", hseRequire("hse.metrics.view"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");

    const r = await repo();
    const inputs = await hseDashboardInputs(r, projectId);
    const dashboard = hseDashboard({ periodCode: hsePeriodCodeOf(new Date()), ...inputs });

    /* ردیف ذخیره‌شده کنار ارزیابی می‌آید تا UI بداند کدام قاعده واقعاً
     * پیکربندی شده و کدام روی پیش‌فرض است. */
    const byCode = new Map(inputs.rules.map((x) => [x.RuleCode, x]));
    const items = dashboard.alerts.alerts.map((a) => ({
      ...a,
      isConfigured: byCode.has(a.ruleCode),
      rowId: byCode.get(a.ruleCode)?.Id ?? null,
    }));

    res.json(cntOk(req, {
      items,
      count: items.length,
      triggeredCount: dashboard.alerts.triggeredCount,
      criticalCount: dashboard.alerts.criticalCount,
      mutedCount: dashboard.alerts.mutedCount,
      blockingFa: dashboard.alerts.blockingFa,
      warningsFa: dashboard.alerts.warningsFa,
    }));
  } catch (err) { next(err); }
});

/** ایجاد یا به‌روزرسانی قاعدهٔ هشدار. */
app.post("/api/hse/alerts", hseRequire("hse.alert.configure"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");

    const b = req.body || {};
    const ruleCode = String(b.ruleCode ?? "").trim();
    const def = HSE_ALERT_DEFAULTS[ruleCode];

    const input = {
      ProjectId: projectId,
      RuleCode: ruleCode,
      TitleFa: String(b.titleFa ?? "").trim() || HSE_ALERT_RULE_FA[ruleCode] || "",
      Severity: b.severity ?? def?.severity,
      Threshold: b.threshold == null ? def?.threshold : Number(b.threshold),
      Comparison: b.comparison ?? def?.comparison,
      IsEnabled: b.isEnabled !== false,
      MutedUntil: b.mutedUntil || null,
      MuteReasonFa: b.muteReasonFa || null,
      OwnerRole: b.ownerRole || def?.ownerRole || null,
      ActionFa: b.actionFa || def?.actionFa || null,
      Status: "active",
    };

    const issues = validateAlertRuleInput(input);
    if (issues.length) {
      return cntBad(req, res, issues[0].code, issues[0].message, 422, issues.map((i) => i.message));
    }

    const subject = engSubject(req);
    const r = await repo();
    const out = await r.upsert(
      "HSE_AlertRule",
      { ProjectId: projectId, RuleCode: input.RuleCode },
      input,
      subject?.id,
    );

    res.status(out?.action === "create" ? 201 : 200).json(cntOk(req, {
      action: out?.action ?? "update",
      item: out?.row ?? input,
    }));
  } catch (err) { next(err); }
});

/**
 * سکوت موقت یک قاعده.
 *
 * جدا از مسیر پیکربندی است چون کار متفاوتی است و باید در سیاههٔ
 * ممیزی جدا دیده شود: خاموش‌کردن هشدار ایمنی تصمیمی است که کسی باید
 * پاسخ‌گویش باشد.
 */
app.post("/api/hse/alerts/:ruleCode/mute", hseRequire("hse.alert.configure"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");

    const ruleCode = String(req.params.ruleCode);
    const def = HSE_ALERT_DEFAULTS[ruleCode];
    if (!def) return cntBad(req, res, "E-HSE-ALERT-CODE", "کد قاعدهٔ هشدار نامعتبر است", 422);

    const reason = String(req.body?.reasonFa ?? "").trim();
    if (!reason) {
      return cntBad(req, res, "E-HSE-ALERT-MUTE-REASON", "برای سکوت موقت، ذکر دلیل الزامی است", 422);
    }
    const until = String(req.body?.until ?? "").trim();
    if (!until || !Number.isFinite(new Date(until).getTime())) {
      return cntBad(req, res, "E-HSE-ALERT-MUTE-DATE", "تاریخ پایان سکوت الزامی و باید معتبر باشد", 422);
    }
    /* سکوت بی‌پایان همان خاموش‌کردن است؛ سی روز سقف عرفی بازبینی
     * دوره‌ای است و بعد از آن باید دوباره تصمیم گرفته شود. */
    const days = (new Date(until).getTime() - Date.now()) / 86_400_000;
    if (days > 30) {
      return cntBad(req, res, "E-HSE-ALERT-MUTE-TOO-LONG", "سکوت بیش از سی روز مجاز نیست", 422);
    }

    const subject = engSubject(req);
    const r = await repo();
    const existing = await r.findOne("HSE_AlertRule", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "RuleCode", op: "eq", value: ruleCode },
    ]);

    const payload = existing
      ? { MutedUntil: until, MuteReasonFa: reason }
      : {
          ProjectId: projectId,
          RuleCode: ruleCode,
          TitleFa: HSE_ALERT_RULE_FA[ruleCode],
          Severity: def.severity,
          Threshold: def.threshold,
          Comparison: def.comparison,
          IsEnabled: true,
          MutedUntil: until,
          MuteReasonFa: reason,
          OwnerRole: def.ownerRole,
          ActionFa: def.actionFa,
          Status: "active",
        };

    const out = await r.upsert(
      "HSE_AlertRule",
      { ProjectId: projectId, RuleCode: ruleCode },
      payload,
      subject?.id,
    );

    res.json(cntOk(req, { item: out?.row ?? payload, mutedUntil: until }));
  } catch (err) { next(err); }
});

/** رفع سکوت. */
app.post("/api/hse/alerts/:ruleCode/unmute", hseRequire("hse.alert.configure"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");

    const r = await repo();
    const row = await r.findOne("HSE_AlertRule", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "RuleCode", op: "eq", value: String(req.params.ruleCode) },
    ]);
    if (!row) return cntBad(req, res, "E-HSE-ALERT-NOT-FOUND", "قاعدهٔ هشدار یافت نشد", 404);

    const subject = engSubject(req);
    const out = await r.upsert(
      "HSE_AlertRule",
      { Id: row.Id },
      { MutedUntil: null, MuteReasonFa: null, IsEnabled: true },
      subject?.id,
    );
    res.json(cntOk(req, { item: out?.row ?? row }));
  } catch (err) { next(err); }
});

/** واژگان شاخص و هشدار. */
app.get("/api/hse/metrics-vocab", hseRequire("hse.metrics.view"), (req, res) => {
  res.json(cntOk(req, {
    metrics: HSE_METRIC_CODES.map((c) => ({
      code: c,
      titleFa: HSE_METRIC_FA[c],
      unit: HSE_METRIC_UNIT[c],
      direction: HSE_METRIC_DIRECTION[c],
      defaultTarget: HSE_METRIC_DEFAULT_TARGET[c],
      weight: HSE_SCORE_WEIGHTS[c] ?? null,
    })),
    alertRules: HSE_ALERT_RULES.map((c) => ({
      code: c,
      titleFa: HSE_ALERT_RULE_FA[c],
      ...HSE_ALERT_DEFAULTS[c],
    })),
    blockedScoreCap: HSE_SCORE_BLOCKED_CAP,
    currentPeriod: hsePeriodCodeOf(new Date()),
  }));
});

/* ══════════════ پیمان — ضمانت‌نامه و پیش‌پرداخت (D7) ══════════════ */

/**
 * ورودی مشترک دفتر وثیقه.
 *
 * دفتر ضمانت‌نامه بدون ماندهٔ پیش‌پرداخت ناقص است: خلأ «پیش‌پرداخت
 * بازیافت‌نشده بدون وثیقه» فقط وقتی دیده می‌شود که هر دو با هم خوانده
 * شوند. پس هر دو کوئری کنار هم و موازی می‌آیند.
 */
/**
 * مبلغ مؤثر پیمان.
 *
 * `CurrentAmount` پس از هر الحاقیه به‌روز می‌شود و همان است که درصد
 * ضمانت‌نامه و سقف پیش‌پرداخت باید با آن سنجیده شوند. اگر هنوز پر
 * نشده باشد به مبلغ اولیه برمی‌گردیم، نه به صفر: صفر باعث می‌شود
 * هشدارهای درصدی بی‌سروصدا خاموش بمانند و ستون ContractAmount اصلاً
 * در اسکیما وجود ندارد.
 */
function cntContractAmount(contract) {
  if (!contract) return null;
  const cur = Number(contract.CurrentAmount);
  if (Number.isFinite(cur) && cur > 0) return cur;
  const init = Number(contract.InitialAmount);
  return Number.isFinite(init) && init > 0 ? init : null;
}

async function cntGuaranteeInputs(r, projectId, contractId) {
  const scope = [
    { column: "ProjectId", op: "eq", value: projectId },
    { column: "ContractId", op: "eq", value: contractId },
  ];
  const [guarantees, advances, contract] = await Promise.all([
    r.list("ContractGuarantee", { where: scope, limit: 5000 }),
    r.list("AdvancePaymentSchedule", { where: scope, limit: 5000 }),
    r.findOne("ContractMaster", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "Id", op: "eq", value: contractId },
    ]),
  ]);
  advances.sort((a, b) => (Number(a.InstallmentNo) || 0) - (Number(b.InstallmentNo) || 0));
  const advance = advanceLedger(advances);
  return { guarantees, advances, advance, contract };
}

/** پارامترهای اجباری هر مسیر D7 — پیمان بدون پروژه معنا ندارد. */
function cntScopeOf(req, res) {
  const projectId = String(req.query.projectId || "");
  const contractId = String(req.query.contractId || "");
  if (!projectId) { cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است"); return null; }
  if (!contractId) { cntBad(req, res, "E-CNT-NO-CONTRACT", "پارامتر contractId الزامی است"); return null; }
  return { projectId, contractId };
}

/** دفتر کل ضمانت‌نامه‌ها با پوشش‌سنجی و سلامت وثیقه‌ای. */
app.get("/api/cnt/guarantee", cntRequire("cnt.guarantee.view"), async (req, res, next) => {
  try {
    const sc = cntScopeOf(req, res);
    if (!sc) return;

    const r = await repo();
    const { guarantees, advance, contract } = await cntGuaranteeInputs(r, sc.projectId, sc.contractId);
    const register = guaranteeRegister({
      rows: guarantees,
      contractAmount: cntContractAmount(contract),
      advanceOutstanding: advance.outstanding,
    });

    res.json(cntOk(req, {
      contractId: sc.contractId,
      ...register,
      items: register.items.map((x) => ({
        ...x,
        typeFa: GUARANTEE_TYPE_FA[x.GuaranteeType] ?? x.GuaranteeType,
      })),
      advance,
      health: guaranteeHealth({ register, advance }),
    }));
  } catch (err) { next(err); }
});

/** ثبت ضمانت‌نامهٔ تازه. */
app.post("/api/cnt/guarantee", cntRequire("cnt.guarantee.manage"), async (req, res, next) => {
  try {
    const sc = cntScopeOf(req, res);
    if (!sc) return;
    const b = engBody(req);

    const r = await repo();
    const contract = await r.findOne("ContractMaster", [
      { column: "ProjectId", op: "eq", value: sc.projectId },
      { column: "Id", op: "eq", value: sc.contractId },
    ]);
    if (!contract) return cntBad(req, res, "E-CNT-NOT-FOUND", "پیمان یافت نشد", 404);

    const verdict = validateGuaranteeInput({
      code: b.code,
      guaranteeType: b.guaranteeType,
      bankName: b.bankName,
      guaranteeNo: b.guaranteeNo,
      amount: b.amount,
      issueDate: b.issueDate,
      expiryDate: b.expiryDate,
      contractAmount: cntContractAmount(contract),
    });
    if (!verdict.ok) {
      return cntBad(req, res, "E-CNT-GRT-INVALID", "ثبت ضمانت‌نامه معتبر نیست", 422,
        verdict.issues.filter((i) => i.severity === "error").map((i) => i.messageFa));
    }

    /* کد ضمانت‌نامه در محدودهٔ پروژه یکتاست (ایندکس UX_ContractGuarantee)؛
     * برخورد را پیش از رسیدن به لایهٔ داده می‌گیریم تا پیام فارسی
     * روشن برگردد نه خطای یکتایی. */
    const dup = await r.findOne("ContractGuarantee", [
      { column: "ProjectId", op: "eq", value: sc.projectId },
      { column: "Code", op: "eq", value: String(b.code) },
    ]);
    if (dup) return cntBad(req, res, "E-CNT-GRT-DUPLICATE", `ضمانت‌نامه با کد ${b.code} پیش‌تر ثبت شده است`, 409);

    const subject = engSubject(req);
    const row = await r.create("ContractGuarantee", {
      ProjectId: sc.projectId,
      ContractId: sc.contractId,
      Code: String(b.code),
      GuaranteeType: String(b.guaranteeType),
      BankName: String(b.bankName),
      GuaranteeNo: String(b.guaranteeNo),
      Amount: Number(b.amount),
      Currency: b.currency ? String(b.currency) : "IRR",
      IssueDate: String(b.issueDate),
      ExpiryDate: String(b.expiryDate),
      ExtendedToDate: null,
      ReleaseDate: null,
      Status: "active",
      AlertLevel: guaranteeState({ ExpiryDate: String(b.expiryDate), Status: "active" }).alert,
    }, subject?.id, "grt");

    res.json(cntOk(req, {
      item: { ...row, state: guaranteeState(row) },
      /* هشدارها ثبت را نبستند ولی باید دیده شوند. */
      warningsFa: verdict.issues.filter((i) => i.severity === "warning").map((i) => i.messageFa),
    }));
  } catch (err) { next(err); }
});

/** تمدید ضمانت‌نامه — تاریخ اصلی پاک نمی‌شود. */
app.post("/api/cnt/guarantee/:id/extend", cntRequire("cnt.guarantee.manage"), async (req, res, next) => {
  try {
    const sc = cntScopeOf(req, res);
    if (!sc) return;
    const b = engBody(req);

    const r = await repo();
    const row = await r.findOne("ContractGuarantee", [{ column: "Id", op: "eq", value: String(req.params.id) }]);
    /* ردیف پیمان یا پروژهٔ دیگر نباید حتی وجودش لو برود. */
    if (!row || String(row.ProjectId) !== sc.projectId || String(row.ContractId) !== sc.contractId) {
      return cntBad(req, res, "E-CNT-GRT-NOT-FOUND", "ضمانت‌نامه یافت نشد", 404);
    }

    const verdict = canActOnGuarantee({ row, action: "extend", newExpiry: b.newExpiry });
    if (b.dryRun) return res.json(cntOk(req, { dryRun: true, verdict }));
    if (!verdict.ok) {
      return cntBad(req, res, verdict.code, verdict.messageFa, 409, verdict.blockersFa);
    }

    const subject = engSubject(req);
    const saved = (await r.upsert("ContractGuarantee", { Id: row.Id }, {
      ExtendedToDate: String(b.newExpiry),
      Status: "extended",
      AlertLevel: guaranteeState({ ...row, ExtendedToDate: String(b.newExpiry), Status: "extended" }).alert,
    }, subject?.id))?.row;

    res.json(cntOk(req, {
      item: { ...saved, state: guaranteeState(saved) },
      warningsFa: verdict.warningsFa,
    }));
  } catch (err) { next(err); }
});

/**
 * آزادسازی یا ضبط ضمانت‌نامه.
 *
 * هر دو زیر یک مجوز جداگانه‌اند (`cnt.guarantee.release`) که ثبت‌کننده
 * ندارد: قاعدهٔ SOD-13.
 */
app.post("/api/cnt/guarantee/:id/close", cntRequire("cnt.guarantee.release"), async (req, res, next) => {
  try {
    const sc = cntScopeOf(req, res);
    if (!sc) return;
    const b = engBody(req);
    const action = b.action === "forfeit" ? "forfeit" : "release";

    const r = await repo();
    const row = await r.findOne("ContractGuarantee", [{ column: "Id", op: "eq", value: String(req.params.id) }]);
    if (!row || String(row.ProjectId) !== sc.projectId || String(row.ContractId) !== sc.contractId) {
      return cntBad(req, res, "E-CNT-GRT-NOT-FOUND", "ضمانت‌نامه یافت نشد", 404);
    }

    const { advance } = await cntGuaranteeInputs(r, sc.projectId, sc.contractId);
    const verdict = canActOnGuarantee({
      row, action, advanceOutstanding: advance.outstanding,
    });
    if (b.dryRun) return res.json(cntOk(req, { dryRun: true, action, verdict }));
    if (!verdict.ok) {
      return cntBad(req, res, verdict.code, verdict.messageFa, 409, verdict.blockersFa);
    }

    const subject = engSubject(req);
    const saved = (await r.upsert("ContractGuarantee", { Id: row.Id }, {
      Status: action === "forfeit" ? "forfeited" : "released",
      ReleaseDate: new Date().toISOString().slice(0, 10),
      AlertLevel: "none",
    }, subject?.id))?.row;

    res.json(cntOk(req, {
      item: { ...saved, state: guaranteeState(saved) },
      action,
      warningsFa: verdict.warningsFa,
    }));
  } catch (err) { next(err); }
});

/** دفتر پیش‌پرداخت با ماندهٔ بازیافت‌نشده. */
app.get("/api/cnt/advance", cntRequire("cnt.guarantee.view"), async (req, res, next) => {
  try {
    const sc = cntScopeOf(req, res);
    if (!sc) return;

    const r = await repo();
    const { advances, advance, contract } = await cntGuaranteeInputs(r, sc.projectId, sc.contractId);

    res.json(cntOk(req, {
      contractId: sc.contractId,
      ...advance,
      contractAmount: cntContractAmount(contract),
      capPct: ADVANCE_CUSTOMARY_CAP_PCT,
      defaultRecoveryPct: ADVANCE_DEFAULT_RECOVERY_PCT,
      count: advances.length,
    }));
  } catch (err) { next(err); }
});

/** ثبت قسط پیش‌پرداخت. */
app.post("/api/cnt/advance", cntRequire("cnt.advance.manage"), async (req, res, next) => {
  try {
    const sc = cntScopeOf(req, res);
    if (!sc) return;
    const b = engBody(req);

    const r = await repo();
    const { advances, advance, contract } = await cntGuaranteeInputs(r, sc.projectId, sc.contractId);
    if (!contract) return cntBad(req, res, "E-CNT-NOT-FOUND", "پیمان یافت نشد", 404);

    const verdict = validateAdvanceInput({
      installmentNo: b.installmentNo,
      paidAmount: b.paidAmount,
      recoveryPct: b.recoveryPct,
      contractAmount: cntContractAmount(contract),
      alreadyPaid: advance.paidTotal,
      existingNos: advances.map((x) => Number(x.InstallmentNo)),
    });
    if (!verdict.ok) {
      return cntBad(req, res, "E-CNT-ADV-INVALID", "ثبت قسط پیش‌پرداخت معتبر نیست", 422,
        verdict.issues.filter((i) => i.severity === "error").map((i) => i.messageFa));
    }

    const subject = engSubject(req);
    const paid = Number(b.paidAmount);
    const row = await r.create("AdvancePaymentSchedule", {
      ProjectId: sc.projectId,
      ContractId: sc.contractId,
      InstallmentNo: Number(b.installmentNo),
      PaidAmount: paid,
      PaidAt: b.paidAt ? String(b.paidAt) : new Date().toISOString().slice(0, 10),
      RecoveryPct: b.recoveryPct != null ? Number(b.recoveryPct) : ADVANCE_DEFAULT_RECOVERY_PCT,
      RecoveredToDate: 0,
      OutstandingAmount: paid,
      Status: "paid",
    }, subject?.id, "adv");

    res.json(cntOk(req, {
      item: row,
      warningsFa: verdict.issues.filter((i) => i.severity === "warning").map((i) => i.messageFa),
    }));
  } catch (err) { next(err); }
});

/**
 * محاسبه و ثبت بازیافت پیش‌پرداخت از یک صورت‌وضعیت.
 *
 * `dryRun` اینجا مهم‌تر از جاهای دیگر است: تهیه‌کنندهٔ صورت‌وضعیت باید
 * پیش از قطعی‌کردن ببیند چقدر کسر می‌شود، بی‌آنکه دفتر را تکان دهد.
 */
app.post("/api/cnt/advance/recover", cntRequire("cnt.advance.manage"), async (req, res, next) => {
  try {
    const sc = cntScopeOf(req, res);
    if (!sc) return;
    const b = engBody(req);

    const gross = Number(b.grossAmount);
    if (!Number.isFinite(gross) || gross < 0) {
      return cntBad(req, res, "E-CNT-ADV-GROSS", "مبلغ ناخالص صورت‌وضعیت نامعتبر است", 422);
    }

    const r = await repo();
    const { advances, advance } = await cntGuaranteeInputs(r, sc.projectId, sc.contractId);

    /* نرخ از قدیمی‌ترین قسط بازنشده خوانده می‌شود، نه از ورودی کاربر:
     * نرخ بازیافت شرط پیمان است و کاربر نباید در لحظهٔ صورت‌وضعیت
     * عوضش کند. */
    const active = advances.find((x) => (Number(x.OutstandingAmount) || 0) > 0);
    const pct = active?.RecoveryPct != null ? Number(active.RecoveryPct) : null;

    const calc = advanceRecovery({
      grossAmount: gross,
      outstanding: advance.outstanding,
      recoveryPct: pct,
    });

    if (b.dryRun !== false) {
      /* پیش‌فرض روی محاسبهٔ بی‌اثر است: ثبت باید صریح خواسته شود. */
      return res.json(cntOk(req, { dryRun: true, ...calc }));
    }
    if (calc.recoverable <= 0) {
      return res.json(cntOk(req, { applied: false, ...calc }));
    }

    /* کسر از قدیمی‌ترین قسط به بعد سرشکن می‌شود — همان ترتیبی که
     * پرداخت انجام شده. */
    const subject = engSubject(req);
    let remaining = calc.recoverable;
    const touched = [];
    for (const inst of advances) {
      if (remaining <= 0) break;
      const outstanding = Number(inst.OutstandingAmount) || 0;
      if (outstanding <= 0) continue;
      const take = Math.min(outstanding, remaining);
      const nextOutstanding = outstanding - take;
      const saved = (await r.upsert("AdvancePaymentSchedule", { Id: inst.Id }, {
        RecoveredToDate: (Number(inst.RecoveredToDate) || 0) + take,
        OutstandingAmount: nextOutstanding,
        Status: nextOutstanding <= 0 ? "settled" : "recovering",
      }, subject?.id))?.row;
      touched.push({ installmentNo: saved.InstallmentNo, applied: take, outstandingAfter: nextOutstanding });
      remaining -= take;
    }

    /* فقط دفتر پیش‌پرداخت بازخوانی می‌شود، نه کل ورودی وثیقه:
     * `cntGuaranteeInputs` سه کوئری می‌زند و دو تای آن (ضمانت‌نامه و
     * شناسنامهٔ پیمان) اینجا مصرفی ندارند. */
    const refreshed = await r.list("AdvancePaymentSchedule", {
      where: [
        { column: "ProjectId", op: "eq", value: sc.projectId },
        { column: "ContractId", op: "eq", value: sc.contractId },
      ],
      limit: 5000,
    });
    refreshed.sort((a, b) => (Number(a.InstallmentNo) || 0) - (Number(b.InstallmentNo) || 0));
    res.json(cntOk(req, { applied: true, ...calc, touched, ledger: advanceLedger(refreshed) }));
  } catch (err) { next(err); }
});

/** واژگان نمایشی D7 — UI مقادیر ثابت را حدس نمی‌زند. */
app.get("/api/cnt/guarantee-vocab", cntRequire("cnt.guarantee.view"), (req, res) => {
  res.json(cntOk(req, {
    types: GUARANTEE_TYPES.map((code) => ({
      code,
      titleFa: GUARANTEE_TYPE_FA[code],
      customaryPct: GUARANTEE_CUSTOMARY_PCT[code],
    })),
    statusFa: GUARANTEE_STATUS_FA,
    alertFa: GUARANTEE_ALERT_FA,
    advanceStatusFa: ADVANCE_STATUS_FA,
    defaultRecoveryPct: ADVANCE_DEFAULT_RECOVERY_PCT,
    capPct: ADVANCE_CUSTOMARY_CAP_PCT,
  }));
});

/* ══════════════ پیمان — صورت‌وضعیت پیمانکار جزء (D8) ══════════════ */

/**
 * بارگذاری کامل یک صورت‌وضعیت جزء با هر چیزی که دروازه لازم دارد.
 *
 * وضعیت صورت‌وضعیت اصلی جدا خوانده می‌شود چون تأیید جزء بدون آن
 * نباید ممکن باشد — و اگر این کوئری را به تنبلی حذف کنیم، دروازه
 * بی‌سروصدا باز می‌شود.
 */
async function cntSubIpcBundle(r, projectId, subIpcId) {
  const sub = await r.findOne("SubcontractorIPC", [{ column: "Id", op: "eq", value: String(subIpcId) }]);
  if (!sub || String(sub.ProjectId) !== projectId) return null;

  const [lines, deductions, mainIpc] = await Promise.all([
    r.list("SubcontractorIPC_LineItem", {
      where: [{ column: "SubIpcId", op: "eq", value: sub.Id }], limit: 5000,
    }),
    r.list("BackToBackDeduction", {
      where: [{ column: "SubIpcId", op: "eq", value: sub.Id }], limit: 2000,
    }),
    sub.MainIpcId
      ? r.findOne("InterimPaymentCertificate", [{ column: "Id", op: "eq", value: String(sub.MainIpcId) }])
      : Promise.resolve(null),
  ]);

  const totals = subIpcTotals({ lines, backToBack: deductions });
  return { sub, lines, deductions, mainIpc, totals };
}

/** فهرست صورت‌وضعیت‌های جزء یک پیمان. */
app.get("/api/cnt/subipc", cntRequire("cnt.subipc.view"), async (req, res, next) => {
  try {
    const sc = cntScopeOf(req, res);
    if (!sc) return;

    const r = await repo();
    const rows = await r.list("SubcontractorIPC", {
      where: [
        { column: "ProjectId", op: "eq", value: sc.projectId },
        { column: "ContractId", op: "eq", value: sc.contractId },
      ],
      limit: 5000,
    });
    rows.sort((a, b) => (Number(a.SerialNo) || 0) - (Number(b.SerialNo) || 0));

    /* وضعیت صورت‌وضعیت‌های اصلی یکجا خوانده می‌شود، نه یکی‌یکی در
     * حلقه: با ده صورت‌وضعیت جزء، N+1 می‌شد. */
    const mainIds = [...new Set(rows.map((x) => x.MainIpcId).filter(Boolean).map(String))];
    const mainStates = {};
    if (mainIds.length) {
      const mains = await r.list("InterimPaymentCertificate", {
        where: [{ column: "ProjectId", op: "eq", value: sc.projectId }], limit: 5000,
      });
      for (const m of mains) {
        if (mainIds.includes(String(m.Id))) mainStates[String(m.Id)] = String(m.WorkflowState ?? "draft");
      }
    }

    res.json(cntOk(req, {
      contractId: sc.contractId,
      ...subIpcRegister({ rows, mainStates }),
    }));
  } catch (err) { next(err); }
});

/** جزئیات یک صورت‌وضعیت جزء با ردیف‌ها، کسور و حکم دروازه. */
app.get("/api/cnt/subipc/:id", cntRequire("cnt.subipc.view"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");

    const r = await repo();
    const b = await cntSubIpcBundle(r, projectId, req.params.id);
    if (!b) return cntBad(req, res, "E-CNT-SUB-NOT-FOUND", "صورت‌وضعیت پیمانکار جزء یافت نشد", 404);

    const state = String(b.sub.WorkflowState ?? "draft");
    res.json(cntOk(req, {
      item: { ...b.sub, stateFa: SUB_IPC_STATE_FA[state] ?? state, isLocked: isSubIpcLocked(state) },
      lines: b.totals.lineDetail,
      deductions: b.totals.backToBackDetail.rows,
      totals: b.totals,
      mainIpcState: b.mainIpc ? String(b.mainIpc.WorkflowState ?? "draft") : null,
      nextStates: SUB_IPC_TRANSITIONS[state] ?? [],
    }));
  } catch (err) { next(err); }
});

/** ایجاد صورت‌وضعیت جزء. */
app.post("/api/cnt/subipc", cntRequire("cnt.subipc.prepare"), async (req, res, next) => {
  try {
    const sc = cntScopeOf(req, res);
    if (!sc) return;
    const b = engBody(req);

    if (!String(b.periodCode ?? "").trim()) {
      return cntBad(req, res, "E-CNT-SUB-PERIOD", "کد دوره الزامی است", 422);
    }

    const r = await repo();
    const contract = await r.findOne("ContractMaster", [
      { column: "ProjectId", op: "eq", value: sc.projectId },
      { column: "Id", op: "eq", value: sc.contractId },
    ]);
    if (!contract) return cntBad(req, res, "E-CNT-NOT-FOUND", "پیمان یافت نشد", 404);

    /* صورت‌وضعیت اصلی اگر داده شده، باید واقعاً وجود داشته باشد و مال
     * همین پروژه باشد؛ گره الکی بدتر از نبود گره است. */
    if (b.mainIpcId) {
      const main = await r.findOne("InterimPaymentCertificate", [
        { column: "Id", op: "eq", value: String(b.mainIpcId) },
      ]);
      if (!main || String(main.ProjectId) !== sc.projectId) {
        return cntBad(req, res, "E-CNT-SUB-MAIN-NOT-FOUND", "صورت‌وضعیت اصلی یافت نشد", 404);
      }
    }

    const existing = await r.list("SubcontractorIPC", {
      where: [{ column: "ContractId", op: "eq", value: sc.contractId }], limit: 5000,
    });
    const serialNo = existing.reduce((m, x) => Math.max(m, Number(x.SerialNo) || 0), 0) + 1;

    const subject = engSubject(req);
    const row = await r.create("SubcontractorIPC", {
      ProjectId: sc.projectId,
      ContractId: sc.contractId,
      MainContractId: b.mainContractId ? String(b.mainContractId) : null,
      MainIpcId: b.mainIpcId ? String(b.mainIpcId) : null,
      SerialNo: serialNo,
      PeriodCode: String(b.periodCode),
      GrossCurrent: 0,
      TotalDeductions: 0,
      NetPayable: 0,
      WorkflowState: "draft",
      Status: "open",
    }, subject?.id, "sipc");

    res.json(cntOk(req, { item: { ...row, stateFa: SUB_IPC_STATE_FA.draft, isLocked: false } }));
  } catch (err) { next(err); }
});

/**
 * افزودن ردیف به صورت‌وضعیت جزء.
 *
 * `mainApprovedQty` از ردیف صورت‌وضعیت اصلی خوانده می‌شود، نه از
 * ورودی کاربر: اگر تهیه‌کننده بتواند خودش عدد مرجع را بنویسد، کل
 * سنجش انحراف بی‌معنا می‌شود.
 */
app.post("/api/cnt/subipc/:id/line", cntRequire("cnt.subipc.prepare"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");
    const b = engBody(req);

    const r = await repo();
    const bundle = await cntSubIpcBundle(r, projectId, req.params.id);
    if (!bundle) return cntBad(req, res, "E-CNT-SUB-NOT-FOUND", "صورت‌وضعیت پیمانکار جزء یافت نشد", 404);

    if (isSubIpcLocked(String(bundle.sub.WorkflowState))) {
      return cntBad(req, res, "E-CNT-SUB-LOCKED",
        "صورت‌وضعیت پس از ارسال قفل است؛ ویرایش ردیف ممکن نیست", 409);
    }
    if (!String(b.descriptionFa ?? "").trim()) {
      return cntBad(req, res, "E-CNT-SUB-LINE-DESC", "شرح ردیف الزامی است", 422);
    }

    let mainApprovedQty = null;
    if (b.boqItemId && bundle.sub.MainIpcId) {
      /* مقدار تجمعی تأییدشدهٔ همان ردیف در صورت‌وضعیت اصلی. */
      const mainLine = await r.findOne("IPC_LineItem", [
        { column: "IpcId", op: "eq", value: String(bundle.sub.MainIpcId) },
        { column: "BoqItemId", op: "eq", value: String(b.boqItemId) },
      ]);
      if (mainLine) {
        /* مقدار تأییدشده ملاک است نه ادعاشده: جزء نمی‌تواند بابت
         * چیزی پول بگیرد که هنوز در صورت‌وضعیت اصلی تأیید نشده. */
        const q = Number(mainLine.ApprovedQty ?? mainLine.CurrentQty);
        if (Number.isFinite(q)) mainApprovedQty = q;
      }
    }

    const subject = engSubject(req);
    const qty = Number(b.quantity);
    const rate = Number(b.unitRate);
    const amount = Number.isFinite(Number(b.amount))
      ? Number(b.amount)
      : (Number.isFinite(qty) && Number.isFinite(rate) ? qty * rate : 0);

    const row = await r.create("SubcontractorIPC_LineItem", {
      ProjectId: projectId,
      SubIpcId: bundle.sub.Id,
      BoqItemId: b.boqItemId ? String(b.boqItemId) : null,
      DescriptionFa: String(b.descriptionFa),
      Unit: b.unit ? String(b.unit) : null,
      Quantity: Number.isFinite(qty) ? qty : null,
      UnitRate: Number.isFinite(rate) ? rate : null,
      Amount: amount,
      MainApprovedQty: mainApprovedQty,
      VarianceFlag: null,
      Status: "draft",
    }, subject?.id, "sln");

    const after = await cntSubIpcBundle(r, projectId, bundle.sub.Id);
    await cntSyncSubIpcTotals(r, after, subject?.id);

    const saved = after.totals.lineDetail.find((l) => l.Id === row.Id) ?? row;
    res.json(cntOk(req, {
      item: saved,
      totals: after.totals,
      varianceFa: VARIANCE_FLAG_FA[saved.varianceFlag] ?? null,
    }));
  } catch (err) { next(err); }
});

/**
 * همگام‌سازی سرجمع‌های ذخیره‌شده با محاسبهٔ موتور.
 *
 * ستون‌های `GrossCurrent` و `NetPayable` برای گزارش‌گیری سریع
 * نگه داشته می‌شوند، ولی منبع حقیقت همان محاسبهٔ لحظه‌ای است؛ پس بعد
 * از هر تغییر بازنویسی می‌شوند تا این دو از هم دور نیفتند.
 */
async function cntSyncSubIpcTotals(r, bundle, userId) {
  if (!bundle) return;
  await r.upsert("SubcontractorIPC", { Id: bundle.sub.Id }, {
    GrossCurrent: bundle.totals.gross,
    TotalDeductions: bundle.totals.totalDeductions,
    NetPayable: bundle.totals.netPayable,
  }, userId);

  /* پرچم انحراف روی خود ردیف هم نوشته می‌شود تا گزارش‌های بعدی
   * مجبور نباشند دوباره کل محاسبه را انجام دهند. */
  for (const l of bundle.totals.lineDetail) {
    if (l.Id && l.VarianceFlag !== l.varianceFlag) {
      await r.upsert("SubcontractorIPC_LineItem", { Id: l.Id }, { VarianceFlag: l.varianceFlag }, userId);
    }
  }
}

/** ثبت کسر پشت‌به‌پشت. */
app.post("/api/cnt/subipc/:id/deduction", cntRequire("cnt.backtoback.manage"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");
    const b = engBody(req);

    const r = await repo();
    const bundle = await cntSubIpcBundle(r, projectId, req.params.id);
    if (!bundle) return cntBad(req, res, "E-CNT-SUB-NOT-FOUND", "صورت‌وضعیت پیمانکار جزء یافت نشد", 404);

    if (isSubIpcLocked(String(bundle.sub.WorkflowState))) {
      return cntBad(req, res, "E-CNT-SUB-LOCKED", "صورت‌وضعیت قفل است؛ ثبت کسر ممکن نیست", 409);
    }

    const verdict = validateBackToBack({
      sourceModule: b.sourceModule,
      descriptionFa: b.descriptionFa,
      amount: b.amount,
      evidenceDocNo: b.evidenceDocNo,
      status: b.status,
    });
    if (!verdict.ok) {
      return cntBad(req, res, "E-CNT-BTB-INVALID", "ثبت کسر معتبر نیست", 422,
        verdict.issues.filter((i) => i.severity === "error").map((i) => i.messageFa));
    }

    const subject = engSubject(req);
    const row = await r.create("BackToBackDeduction", {
      ProjectId: projectId,
      SubIpcId: bundle.sub.Id,
      SourceModule: String(b.sourceModule),
      SourceRefCode: b.sourceRefCode ? String(b.sourceRefCode) : null,
      DescriptionFa: String(b.descriptionFa),
      Amount: Number(b.amount),
      EvidenceDocNo: b.evidenceDocNo ? String(b.evidenceDocNo) : null,
      Status: b.status ? String(b.status) : "draft",
    }, subject?.id, "btb");

    const after = await cntSubIpcBundle(r, projectId, bundle.sub.Id);
    await cntSyncSubIpcTotals(r, after, subject?.id);

    res.json(cntOk(req, {
      item: { ...row, sourceFa: BACK_TO_BACK_SOURCE_FA[row.SourceModule] ?? row.SourceModule },
      totals: after.totals,
      warningsFa: verdict.issues.filter((i) => i.severity === "warning").map((i) => i.messageFa),
    }));
  } catch (err) { next(err); }
});

/**
 * گذار وضعیت صورت‌وضعیت جزء.
 *
 * تأیید مجوز جداگانه دارد (`cnt.subipc.approve`، قاعدهٔ SOD-14) چون
 * تأییدکننده دارد نقدینگی پیمانکار اصلی را خرج می‌کند.
 */
app.post("/api/cnt/subipc/:id/transition", async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");
    const b = engBody(req);
    const to = String(b.to ?? "");

    /* مجوز به مقصد گذار بستگی دارد: تأیید و پرداخت دست تأییدکننده
     * است، بقیه دست تهیه‌کننده. بررسی دستی می‌شود چون میان‌افزار
     * ثابت نمی‌تواند مقصد را ببیند. */
    const needed = (to === "approved" || to === "paid") ? "cnt.subipc.approve" : "cnt.subipc.prepare";
    const subject = engSubject(req);
    if (!subject) {
      return res.status(401).json({
        ok: false,
        error: { code: "E-CNT-AUTH-REQUIRED", message: "شناسهٔ کاربر برای این اقدام الزامی است", traceId: req.requestId },
      });
    }
    const decision = rbacEvaluate(subject, needed, { projectId: undefined });
    if (!decision.allow) {
      return res.status(403).json({
        ok: false,
        error: {
          code: "E-CNT-FORBIDDEN",
          message: `کاربر ${subject.displayName} مجوز «${needed}» را ندارد`,
          permission: needed,
          traceId: req.requestId,
        },
      });
    }

    const r = await repo();
    const bundle = await cntSubIpcBundle(r, projectId, req.params.id);
    if (!bundle) return cntBad(req, res, "E-CNT-SUB-NOT-FOUND", "صورت‌وضعیت پیمانکار جزء یافت نشد", 404);

    const from = String(bundle.sub.WorkflowState ?? "draft");
    const verdict = canTransitionSubIpc({
      from, to,
      totals: bundle.totals,
      mainIpcState: bundle.mainIpc ? String(bundle.mainIpc.WorkflowState ?? "draft") : null,
      allowUnmatched: b.allowUnmatched === true,
    });

    if (b.dryRun) return res.json(cntOk(req, { dryRun: true, from, to, verdict }));
    if (!verdict.ok) {
      return cntBad(req, res, verdict.code, verdict.messageFa, 409, verdict.blockersFa);
    }

    /* سرجمع‌ها پیش از قفل‌شدن یک بار دیگر همگام می‌شوند تا عددی که
     * تأیید می‌شود همان عددی باشد که ذخیره می‌ماند. */
    await cntSyncSubIpcTotals(r, bundle, subject?.id);
    const saved = (await r.upsert("SubcontractorIPC", { Id: bundle.sub.Id }, {
      WorkflowState: to,
      Status: to === "paid" ? "closed" : bundle.sub.Status,
    }, subject?.id))?.row;

    res.json(cntOk(req, {
      item: { ...saved, stateFa: SUB_IPC_STATE_FA[to] ?? to, isLocked: isSubIpcLocked(to) },
      from, to,
      totals: bundle.totals,
      warningsFa: verdict.warningsFa,
    }));
  } catch (err) { next(err); }
});

/** واژگان نمایشی D8. */
app.get("/api/cnt/subipc-vocab", cntRequire("cnt.subipc.view"), (req, res) => {
  res.json(cntOk(req, {
    states: SUB_IPC_STATES.map((code) => ({ code, titleFa: SUB_IPC_STATE_FA[code] })),
    transitions: SUB_IPC_TRANSITIONS,
    varianceFa: VARIANCE_FLAG_FA,
    sources: BACK_TO_BACK_SOURCES.map((code) => ({ code, titleFa: BACK_TO_BACK_SOURCE_FA[code] })),
    deductionStatusFa: BACK_TO_BACK_STATUS_FA,
  }));
});

/* ══════════════ پیمان — پیشرفت (D9) ══════════════ */

/**
 * ورودی‌های محاسبهٔ پیشرفت یک پیمان.
 *
 * چهار کوئری موازی است نه سریال: هیچ‌کدام به نتیجهٔ دیگری وابسته
 * نیست و سریال کردنشان فقط تأخیر می‌سازد.
 */
async function cntProgressInputs(r, projectId, contractId) {
  const contract = await r.findOne("ContractMaster", [
    { column: "ProjectId", op: "eq", value: projectId },
    { column: "Id", op: "eq", value: contractId },
  ]);
  if (!contract) return null;

  const [boq, ipcs, milestones] = await Promise.all([
    r.list("ContractBOQ_Item", {
      where: [{ column: "ContractId", op: "eq", value: contractId }], limit: 5000,
    }),
    r.list("InterimPaymentCertificate", {
      where: [{ column: "ContractId", op: "eq", value: contractId }], limit: 2000,
    }),
    r.list("LumpSumMilestone", {
      where: [{ column: "ContractId", op: "eq", value: contractId }], limit: 2000,
    }),
  ]);

  /* ردیف‌های صورت‌وضعیت فقط برای همان صورت‌وضعیت‌هایی خوانده می‌شوند
   * که تأیید شده‌اند: کارِ ادعاشدهٔ تأییدنشده پیشرفت نیست. */
  const approvedIds = new Set(
    ipcs
      .filter((x) => ["approved", "paid"].includes(String(x.WorkflowState ?? "")))
      .map((x) => String(x.Id)),
  );
  /* ردیف‌ها با `in` روی شناسهٔ صورت‌وضعیت‌های تأییدشده خوانده می‌شوند،
   * نه کل پروژه و فیلتر در حافظه: در پروژه‌ای با ده پیمان، خواندن
   * همهٔ ردیف‌ها برای محاسبهٔ پیشرفت یکی از آن‌ها اتلاف محض است. */
  let achieved = [];
  if (approvedIds.size) {
    const lines = await r.list("IPC_LineItem", {
      where: [
        { column: "ProjectId", op: "eq", value: projectId },
        { column: "IpcId", op: "in", value: [...approvedIds] },
      ],
      limit: 20000,
    });
    achieved = lines.map((l) => ({
      BoqItemId: l.BoqItemId,
      CumQty: l.CumQty,
      CumPct: l.CumPct,
      EarnedCumulative: l.EarnedCumulative,
    }));
  }

  return { contract, boq, ipcs, milestones, achieved };
}

/** تصویر پیشرفت یک پیمان. */
app.get("/api/cnt/progress", cntRequire("cnt.progress.view"), async (req, res, next) => {
  try {
    const sc = cntScopeOf(req, res);
    if (!sc) return;

    const r = await repo();
    const inp = await cntProgressInputs(r, sc.projectId, sc.contractId);
    if (!inp) return cntBad(req, res, "E-CNT-NOT-FOUND", "پیمان یافت نشد", 404);

    const snapshot = progressSnapshot({
      periodCode: req.query.periodCode ? String(req.query.periodCode) : null,
      contractAmount: cntContractAmount(inp.contract),
      contractType: inp.contract.ContractType,
      ceilingPct: inp.contract.CeilingPct,
      boq: inp.boq,
      achieved: inp.achieved,
      ipcs: inp.ipcs,
      milestones: inp.milestones,
    });

    res.json(cntOk(req, {
      contractId: sc.contractId,
      contractCode: inp.contract.Code,
      contractType: inp.contract.ContractType,
      ...snapshot,
    }));
  } catch (err) { next(err); }
});

/** تفکیک ردیف‌به‌ردیف پیشرفت فیزیکی. */
app.get("/api/cnt/progress/breakdown", cntRequire("cnt.progress.view"), async (req, res, next) => {
  try {
    const sc = cntScopeOf(req, res);
    if (!sc) return;

    const r = await repo();
    const inp = await cntProgressInputs(r, sc.projectId, sc.contractId);
    if (!inp) return cntBad(req, res, "E-CNT-NOT-FOUND", "پیمان یافت نشد", 404);

    const b = progressBreakdown({ boq: inp.boq, achieved: inp.achieved });

    /* فهرست کامل ردیف‌ها می‌تواند صدها سطر باشد؛ مرتب بر سهم در
     * پیشرفت تا مهم‌ترها اول بیایند. */
    const lines = [...b.lines].sort((a, c) => c.weightPct - a.weightPct);

    res.json(cntOk(req, { contractId: sc.contractId, ...b, lines }));
  } catch (err) { next(err); }
});

/**
 * منحنی S پیمان.
 *
 * برنامه از دوره‌های صورت‌وضعیت مصوب بازسازی نمی‌شود — آن «واقعی»
 * است نه «برنامه». برنامه اگر ثبت نشده باشد، منحنی فقط خط واقعی را
 * نشان می‌دهد و صریح هشدار می‌دهد که انحراف قابل سنجش نیست.
 */
app.get("/api/cnt/progress/scurve", cntRequire("cnt.progress.view"), async (req, res, next) => {
  try {
    const sc = cntScopeOf(req, res);
    if (!sc) return;

    const r = await repo();
    const inp = await cntProgressInputs(r, sc.projectId, sc.contractId);
    if (!inp) return cntBad(req, res, "E-CNT-NOT-FOUND", "پیمان یافت نشد", 404);

    const amount = cntContractAmount(inp.contract);
    const approved = inp.ipcs
      .filter((x) => ["approved", "paid"].includes(String(x.WorkflowState ?? "")))
      .filter((x) => String(x.Status ?? "open") !== "cancelled");

    const actual = approved
      .filter((x) => String(x.PeriodCode ?? "").trim())
      .map((x) => {
        const cum = num(x.GrossCumulative) || num(x.GrossCurrent);
        return {
          periodCode: String(x.PeriodCode),
          cumAmount: cum,
          cumPct: amount > 0 ? (cum / amount) * 100 : 0,
        };
      });

    /* دوره‌های برنامه از عکس‌های ثبت‌شدهٔ سنجه می‌آید، اگر باشد. */
    const snaps = await r.list("ContractMetricsSnapshot", {
      where: [{ column: "ContractId", op: "eq", value: sc.contractId }], limit: 500,
    });
    const planned = snaps
      .filter((x) => String(x.PeriodCode ?? "").trim())
      .map((x) => ({
        periodCode: String(x.PeriodCode),
        cumPct: num(x.PhysicalPct),
        cumAmount: amount > 0 ? (num(x.PhysicalPct) / 100) * amount : 0,
      }));

    res.json(cntOk(req, { contractId: sc.contractId, contractAmount: amount, ...sCurve({ planned, actual }) }));
  } catch (err) { next(err); }
});

/** نقاط عطف پیمان مقطوع. */
app.get("/api/cnt/milestone", cntRequire("cnt.progress.view"), async (req, res, next) => {
  try {
    const sc = cntScopeOf(req, res);
    if (!sc) return;

    const r = await repo();
    const rows = await r.list("LumpSumMilestone", {
      where: [
        { column: "ProjectId", op: "eq", value: sc.projectId },
        { column: "ContractId", op: "eq", value: sc.contractId },
      ],
      limit: 2000,
    });
    rows.sort((a, b) => (Number(a.MilestoneNo) || 0) - (Number(b.MilestoneNo) || 0));

    res.json(cntOk(req, { contractId: sc.contractId, ...milestoneRollup({ rows }) }));
  } catch (err) { next(err); }
});

/**
 * تحقق یا تأیید نقطهٔ عطف.
 *
 * «تأیید» فقط با سند ممکن است. بدون سند، حداکثر «محقق‌شده» ثبت
 * می‌شود که در محاسبه نیم‌شمرده می‌شود — و همین تفاوت، مرز بین
 * پیشرفت واقعی و پیشرفت کاغذی است.
 */
app.post("/api/cnt/milestone/:id/achieve", cntRequire("cnt.milestone.manage"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");
    const b = engBody(req);

    const r = await repo();
    const row = await r.findOne("LumpSumMilestone", [
      { column: "Id", op: "eq", value: String(req.params.id) },
    ]);
    if (!row || String(row.ProjectId) !== projectId) {
      return cntBad(req, res, "E-CNT-MS-NOT-FOUND", "نقطهٔ عطف یافت نشد", 404);
    }

    /* واژگان هر دو نسل پذیرفته می‌شود؛ مسیر قدیمی ثبت مرحله
     * `pending/claimed/rejected` می‌نویسد و سطرهای موجود همان را
     * دارند. رد کردنشان یعنی قفل شدن دادهٔ قبلی. */
    const target = String(b.status ?? "achieved");
    if (!Object.prototype.hasOwnProperty.call(MILESTONE_EFFECTIVE_STATUS, target)) {
      return cntBad(req, res, "E-CNT-MS-STATUS", `وضعیت «${target}» شناخته نمی‌شود`, 422);
    }
    const effective = MILESTONE_EFFECTIVE_STATUS[target];

    const evidence = String(b.evidenceDocNo ?? row.EvidenceDocNo ?? "").trim();
    if (effective === "verified" && !evidence) {
      return cntBad(req, res, "E-CNT-MS-NO-EVIDENCE",
        "تأیید نقطهٔ عطف بدون سند پشتیبان ممکن نیست", 409);
    }

    const subject = engSubject(req);
    const achievedPct = b.achievedPct == null
      ? (effective === "verified" ? 100 : num(row.AchievedPct))
      : num(b.achievedPct);

    const saved = (await r.upsert("LumpSumMilestone", { Id: row.Id }, {
      Status: target,
      AchievedPct: achievedPct,
      AchievedDate: b.achievedDate ? String(b.achievedDate) : (row.AchievedDate ?? null),
      EvidenceDocNo: evidence || null,
      VerifiedBy: effective === "verified" ? (subject?.id ?? null) : (row.VerifiedBy ?? null),
    }, subject?.id))?.row;

    const all = await r.list("LumpSumMilestone", {
      where: [{ column: "ContractId", op: "eq", value: String(row.ContractId) }], limit: 2000,
    });

    res.json(cntOk(req, {
      item: { ...saved, statusFa: MILESTONE_STATUS_FA[target] ?? target },
      rollup: milestoneRollup({ rows: all }),
    }));
  } catch (err) { next(err); }
});

/** واژگان نمایشی D9. */
app.get("/api/cnt/progress-vocab", cntRequire("cnt.progress.view"), (req, res) => {
  res.json(cntOk(req, {
    milestoneStatusFa: MILESTONE_STATUS_FA,
    gapVerdictFa: PROGRESS_GAP_FA,
  }));
});

/* ══════════════ پیمان — سنجه و هشدار زودهنگام (D10) ══════════════ */

/**
 * محاسبهٔ سنجه‌های یک پیمان از داده‌های زنده.
 *
 * همهٔ ورودی‌ها موازی خوانده می‌شوند و سپس یک بار به موتور داده
 * می‌شوند. سنجه‌ای که ورودی‌اش نیست `null` می‌ماند، نه صفر — تفاوت
 * «نمی‌دانیم» و «اندازه گرفتیم صفر بود» در تابلوی مدیریتی حیاتی است.
 */
async function cntKpiInputs(r, projectId, contractId) {
  const inp = await cntProgressInputs(r, projectId, contractId);
  if (!inp) return null;

  const ipcIds = inp.ipcs.map((x) => String(x.Id));
  const [guarantees, advances, changes, deductions] = await Promise.all([
    r.list("ContractGuarantee", {
      where: [{ column: "ContractId", op: "eq", value: contractId }], limit: 1000,
    }).catch(() => []),
    r.list("AdvancePaymentSchedule", {
      where: [{ column: "ContractId", op: "eq", value: contractId }], limit: 1000,
    }).catch(() => []),
    r.list("BOQ_QuantityChange", {
      where: [{ column: "ProjectId", op: "eq", value: projectId }], limit: 5000,
    }).catch(() => []),
    ipcIds.length
      ? r.list("IPC_Deduction", {
        where: [{ column: "IpcId", op: "in", value: ipcIds }], limit: 5000,
      }).catch(() => [])
      : Promise.resolve([]),
  ]);

  const boqIds = new Set(inp.boq.map((x) => String(x.Id)));
  const ownChanges = changes.filter((c) => boqIds.has(String(c.BoqItemId)));

  return { ...inp, guarantees, advances, changes: ownChanges, deductions };
}

/** ساخت شیء سنجه از ورودی‌های خام. */
function cntComputeKpis(inp, periodCode) {
  const amount = cntContractAmount(inp.contract);

  const snapshot = progressSnapshot({
    periodCode,
    contractAmount: amount,
    contractType: inp.contract.ContractType,
    ceilingPct: inp.contract.CeilingPct,
    boq: inp.boq,
    achieved: inp.achieved,
    ipcs: inp.ipcs,
    milestones: inp.milestones,
  });

  const cycle = ipcCycle({ rows: inp.ipcs });
  const extra = extraWorkRatio({
    boq: inp.boq,
    changes: inp.changes,
    initialAmount: num(inp.contract.InitialAmount) || amount,
  });

  /* ضمانت‌نامه: باز و رو به انقضا جدا شمرده می‌شوند. یک وثیقهٔ باز
   * خبر نیست؛ وثیقه‌ای که ۲۹ روز دیگر می‌میرد خبر است. */
  const gState = guaranteeRegister({ rows: inp.guarantees ?? [] });
  const openGuaranteeCount = gState.items.filter(
    (g) => !["released", "seized", "expired"].includes(String(g.state ?? g.Status ?? "")),
  ).length;
  const expiringGuaranteeCount = gState.items.filter(
    (g) => Number(g.daysToExpiry) >= 0 && Number(g.daysToExpiry) <= 30,
  ).length;

  /* پیش‌پرداخت: نسبت بازیافت‌شده به کل. اگر پیش‌پرداختی نباشد، سنجه
   * null می‌ماند نه صفر — نداشتن پیش‌پرداخت عیب نیست. */
  const ledger = advanceLedger(inp.advances ?? []);
  const advanceRecoveredPct = ledger.totalAmount > 0
    ? round((ledger.recoveredAmount / ledger.totalAmount) * 100)
    : null;

  /* ماندهٔ سپرده از سطرهای کسور می‌آید، نه از ستونی روی خود
   * صورت‌وضعیت: `InterimPaymentCertificate` فقط `TotalDeductions`
   * دارد که همهٔ کسور را قاطی کرده و سپرده را جدا نمی‌کند. */
  const retainage = round(
    (inp.deductions ?? [])
      .filter((d) => String(d.DeductionType ?? "") === "retainage")
      .reduce((sum, d) => sum + num(d.Amount), 0),
  );

  const kpis = contractKpis({
    periodCode,
    physicalPct: snapshot.physicalPct,
    financialPct: snapshot.financialPct,
    gapPct: snapshot.gap.gapPct,
    ceilingUsedPct: snapshot.financial.ceilingUsedPct,
    advanceRecoveredPct,
    extraWorkRatioPct: extra.isMeasurable ? extra.ratioPct : null,
    /* میانگینی که صورت‌وضعیت‌های گیرکرده را هم می‌بیند: عدد صادق‌تر
     * همان است که در تابلو می‌نشیند. */
    avgIpcCycleDays: (cycle.closed.length + cycle.openCount) > 0 ? cycle.avgIncludingOpenDays : null,
    openGuaranteeCount: inp.guarantees.length ? openGuaranteeCount : null,
    expiringGuaranteeCount: inp.guarantees.length ? expiringGuaranteeCount : null,
    retainageBalance: retainage > 0 ? retainage : null,
  });

  /* تصویر پیشرفت هم برگردانده می‌شود تا مسیرها بتوانند کیفیت داده را
   * گزارش کنند بدون اینکه محاسبه دوباره اجرا شود. */
  return { kpis, snapshot };
}

/** تابلوی سلامت یک پیمان: سنجه، نمره، هشدار و روند. */
app.get("/api/cnt/kpi", cntRequire("cnt.kpi.view"), async (req, res, next) => {
  try {
    const sc = cntScopeOf(req, res);
    if (!sc) return;

    const r = await repo();
    const inp = await cntKpiInputs(r, sc.projectId, sc.contractId);
    if (!inp) return cntBad(req, res, "E-CNT-NOT-FOUND", "پیمان یافت نشد", 404);

    const periodCode = req.query.periodCode ? String(req.query.periodCode) : null;
    const computed = cntComputeKpis(inp, periodCode);
    const kpis = computed.kpis;

    const [snapshots, overrides] = await Promise.all([
      r.list("ContractMetricsSnapshot", {
        where: [{ column: "ContractId", op: "eq", value: sc.contractId }], limit: 500,
      }),
      r.list("ContractAlertRule", {
        where: [{ column: "ProjectId", op: "eq", value: sc.projectId }], limit: 200,
      }).catch(() => []),
    ]);

    const card = contractScorecard({
      contractId: sc.contractId,
      periodCode,
      kpis,
      snapshots,
      overrides,
    });

    /* اگر فهرست‌بها مبلغ پیمان را پوشش ندهد، «فاصلهٔ» فیزیکی و مالی
     * روی دو مخرج ناهمخوان سنجیده شده و هشدارهای مبتنی بر آن
     * بی‌اعتبارند. این را صریح می‌گوییم، نه اینکه عدد را تحویل بدهیم
     * و کاربر خودش بفهمد. */
    const dataQualityFa = [];
    if (!computed.snapshot.isGapReliable) {
      dataQualityFa.push(
        `فهرست‌بها ${computed.snapshot.boqCoveragePct ?? "—"}٪ مبلغ پیمان را پوشش می‌دهد؛ سنجهٔ فاصله تا تکمیل آن قابل اتکا نیست`,
      );
    }

    res.json(cntOk(req, {
      contractCode: inp.contract.Code,
      contractTitleFa: inp.contract.TitleFa,
      boqCoveragePct: computed.snapshot.boqCoveragePct,
      isGapReliable: computed.snapshot.isGapReliable,
      dataQualityFa,
      ...card,
    }));
  } catch (err) { next(err); }
});

/**
 * ثبت عکس دوره‌ای سنجه‌ها.
 *
 * بدون این، روند وجود ندارد: سامانه فقط «الان» را می‌داند و هرگز
 * نمی‌تواند بگوید اوضاع دارد بهتر می‌شود یا بدتر. عکس روی
 * `ContractId+PeriodCode` یکتاست، پس ثبت دوباره همان دوره
 * به‌روزرسانی است نه سطر تازه — دو عکس از یک دوره یعنی دو حقیقت.
 */
app.post("/api/cnt/kpi/snapshot", cntRequire("cnt.kpi.snapshot"), async (req, res, next) => {
  try {
    const sc = cntScopeOf(req, res);
    if (!sc) return;
    const b = engBody(req);

    const periodCode = String(b.periodCode ?? "").trim();
    if (!periodCode) {
      return cntBad(req, res, "E-CNT-KPI-PERIOD", "کد دوره برای ثبت عکس الزامی است", 422);
    }

    const r = await repo();
    const inp = await cntKpiInputs(r, sc.projectId, sc.contractId);
    if (!inp) return cntBad(req, res, "E-CNT-NOT-FOUND", "پیمان یافت نشد", 404);

    const kpis = cntComputeKpis(inp, periodCode).kpis;
    const subject = engSubject(req);

    const up = await r.upsert("ContractMetricsSnapshot",
      { ContractId: sc.contractId, PeriodCode: periodCode },
      {
        ProjectId: sc.projectId,
        ContractId: sc.contractId,
        PeriodCode: periodCode,
        PhysicalPct: kpis.byCode.physical_pct,
        FinancialPct: kpis.byCode.financial_pct,
        VariancePct: kpis.byCode.progress_gap_pct,
        CeilingUsedPct: kpis.byCode.ceiling_used_pct,
        AdvanceRecoveredPct: kpis.byCode.advance_recovered_pct,
        ExtraWorkRatioPct: kpis.byCode.extra_work_ratio_pct,
        AvgIpcCycleDays: kpis.byCode.avg_ipc_cycle_days,
        OpenGuaranteeCount: kpis.byCode.open_guarantee_count,
        RetainageBalance: kpis.byCode.retainage_balance,
        SnapshotAt: new Date().toISOString(),
      }, subject?.id, "cms");

    res.json(cntOk(req, {
      item: up?.row ?? null,
      action: up?.action ?? "insert",
      kpis,
      noteFa: up?.action === "update"
        ? `عکس دورهٔ ${periodCode} به‌روزرسانی شد`
        : `عکس دورهٔ ${periodCode} ثبت شد`,
    }));
  } catch (err) { next(err); }
});

/** روند سنجه‌ها بین دوره‌های ثبت‌شده. */
app.get("/api/cnt/kpi/trend", cntRequire("cnt.kpi.view"), async (req, res, next) => {
  try {
    const sc = cntScopeOf(req, res);
    if (!sc) return;

    const r = await repo();
    const contract = await r.findOne("ContractMaster", [
      { column: "ProjectId", op: "eq", value: sc.projectId },
      { column: "Id", op: "eq", value: sc.contractId },
    ]);
    if (!contract) return cntBad(req, res, "E-CNT-NOT-FOUND", "پیمان یافت نشد", 404);

    const snapshots = await r.list("ContractMetricsSnapshot", {
      where: [{ column: "ContractId", op: "eq", value: sc.contractId }], limit: 500,
    });

    res.json(cntOk(req, {
      contractId: sc.contractId,
      snapshotCount: snapshots.length,
      ...kpiTrend({ snapshots }),
    }));
  } catch (err) { next(err); }
});

/** قواعد هشدار و آستانه‌های سفارشی پروژه. */
app.get("/api/cnt/alert-rule", cntRequire("cnt.kpi.view"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");

    const r = await repo();
    const rows = await r.list("ContractAlertRule", {
      where: [{ column: "ProjectId", op: "eq", value: projectId }], limit: 200,
    });
    const byCode = new Map(rows.map((x) => [String(x.RuleCode), x]));

    /* قاعدهٔ پیش‌فرض همیشه در فهرست می‌آید، حتی اگر سطر سفارشی
     * نداشته باشد: کاربر باید بداند چه چیزهایی دارند سنجیده می‌شوند،
     * نه فقط آن‌هایی که دست‌کاری شده‌اند. */
    const items = DEFAULT_ALERT_RULES.map((rule) => {
      const ov = byCode.get(rule.code);
      const enabled = !ov ? true : !(ov.IsEnabled === false || ov.IsEnabled === 0 || ov.IsEnabled === "0");
      return {
        ...rule,
        severityFa: ALERT_SEVERITY_FA[ov?.Severity ?? rule.severity] ?? rule.severity,
        effectiveThreshold: ov && ov.ThresholdValue != null ? num(ov.ThresholdValue) : rule.threshold,
        effectiveSeverity: ov?.Severity ?? rule.severity,
        isCustomized: Boolean(ov),
        isEnabled: enabled,
      };
    });

    res.json(cntOk(req, {
      items,
      customizedCount: items.filter((x) => x.isCustomized).length,
      disabledCount: items.filter((x) => !x.isEnabled).length,
    }));
  } catch (err) { next(err); }
});

/**
 * تنظیم آستانهٔ یک قاعده.
 *
 * خاموش کردن قاعده ممکن است ولی بی‌سروصدا نیست: پاسخ صریح می‌گوید
 * که این هشدار دیگر سنجیده نمی‌شود، و مسیر ممیزی‌شده است.
 */
app.post("/api/cnt/alert-rule", cntRequire("cnt.alertrule.manage"), async (req, res, next) => {
  try {
    const projectId = String(req.query.projectId || "");
    if (!projectId) return cntBad(req, res, "E-CNT-NO-PROJECT", "پارامتر projectId الزامی است");
    const b = engBody(req);

    const ruleCode = String(b.ruleCode ?? "").trim();
    const rule = DEFAULT_ALERT_RULES.find((x) => x.code === ruleCode);
    if (!rule) {
      return cntBad(req, res, "E-CNT-RULE-NOT-FOUND",
        `قاعدهٔ «${ruleCode}» در فهرست قواعد نیست`, 404);
    }

    const severity = b.severity == null ? rule.severity : String(b.severity);
    if (!["info", "warning", "critical"].includes(severity)) {
      return cntBad(req, res, "E-CNT-RULE-SEVERITY", `شدت «${severity}» شناخته نمی‌شود`, 422);
    }

    /* `num()` هر چیز نامعتبری را صفر می‌کند، پس `Number.isFinite`
     * روی خروجی‌اش هرگز false نمی‌شود و اعتبارسنجی بی‌اثر می‌ماند.
     * آستانهٔ صفرِ ناخواسته یعنی هشداری که همیشه روشن است. */
    let threshold = rule.threshold;
    if (b.thresholdValue != null) {
      const raw = Number(b.thresholdValue);
      if (!Number.isFinite(raw)) {
        return cntBad(req, res, "E-CNT-RULE-THRESHOLD", "آستانه باید عدد باشد", 422);
      }
      threshold = raw;
    }

    /* ستون `IsEnabled` از نوع bool است و اعتبارسنج ماندگاری مقدار
     * بولی واقعی می‌خواهد؛ رشتهٔ "0"/"1" فقط در `default` اسکیما
     * مجاز است و اینجا ۴۲۲ می‌گیرد. */
    const enabled = b.isEnabled !== false;
    const subject = engSubject(req);

    const up = await r_upsertAlertRule(await repo(), {
      projectId, ruleCode, rule, threshold, severity, enabled, userId: subject?.id,
    });

    res.json(cntOk(req, {
      item: up.row,
      action: up.action,
      noteFa: !enabled
        ? `قاعدهٔ «${rule.titleFa}» خاموش شد و دیگر سنجیده نمی‌شود`
        : `آستانهٔ «${rule.titleFa}» روی ${threshold} تنظیم شد`,
    }));
  } catch (err) { next(err); }
});

/** درج یا به‌روزرسانی سطر قاعده — جدا شده تا مسیر خوانا بماند. */
async function r_upsertAlertRule(r, o) {
  const up = await r.upsert("ContractAlertRule",
    { ProjectId: o.projectId, RuleCode: o.ruleCode },
    {
      ProjectId: o.projectId,
      RuleCode: o.ruleCode,
      TitleFa: o.rule.titleFa,
      Severity: o.severity,
      ThresholdValue: o.threshold,
      IsEnabled: o.enabled,
      Status: "active",
    }, o.userId, "car");
  return { row: up?.row ?? null, action: up?.action ?? "insert" };
}

/** واژگان نمایشی D10. */
app.get("/api/cnt/kpi-vocab", cntRequire("cnt.kpi.view"), (req, res) => {
  res.json(cntOk(req, {
    catalog: CONTRACT_KPI_CATALOG,
    rules: DEFAULT_ALERT_RULES,
    severityFa: ALERT_SEVERITY_FA,
    healthBandFa: HEALTH_BAND_FA,
  }));
});


/* ══════════════ ۱۸. پل CNT → FIN (G-03) ══════════════ */

/** خواندن پیمان با بررسی مالکیت پروژه. */
async function cntContractOf(r, projectId, contractId) {
  const [c] = await r.list("ContractMaster", {
    where: [{ column: "Id", op: "eq", value: contractId }],
    limit: 1,
  });
  if (!c || String(c.ProjectId) !== String(projectId)) return null;
  return c;
}

/** حساب هزینهٔ پیمان از روی کد نرم — پیوند بدون گره سخت به d5. */
async function cntCostAccountOf(r, projectId, contract) {
  const code = String(contract?.CostAccountCode ?? "").trim();
  if (!code) return null;
  const [acc] = await r.list("CostAccount", {
    where: [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "Code", op: "eq", value: code },
    ],
    limit: 1,
  });
  return acc ?? null;
}

/** صورت‌وضعیت‌ها و ثبت‌های مالی یک پیمان. */
async function cntFinInputs(r, projectId, contractId) {
  const [ipcs, postings] = await Promise.all([
    r.list("InterimPaymentCertificate", {
      where: [{ column: "ContractId", op: "eq", value: contractId }],
      limit: 2000,
    }),
    r.list("ContractFinPosting", {
      where: [{ column: "ContractId", op: "eq", value: contractId }],
      limit: 2000,
    }),
  ]);
  return { ipcs, postings };
}

/**
 * تطبیق دفتر پیمان با دفتر مالی.
 *
 * این مسیر خواندنی است و مخاطبش گسترده: مدیر پیمان باید بداند چه چیزی
 * ارسال نشده، کنترل هزینه باید مغایرت را ببیند. اما هیچ‌کدام از این
 * دو نمی‌توانند ارسال کنند.
 */
app.get("/api/cnt/fin/reconcile", cntRequire("cnt.fin.view"), async (req, res, next) => {
  try {
    const sc = cntScopeOf(req, res);
    if (!sc) return;

    const r = await repo();
    const contract = await cntContractOf(r, sc.projectId, sc.contractId);
    if (!contract) return cntBad(req, res, "E-CNT-CONTRACT-NOT-FOUND", "پیمان پیدا نشد", 404);

    const { ipcs, postings } = await cntFinInputs(r, sc.projectId, sc.contractId);
    const rec = reconcileFinPostings({ ipcs, postings });
    const account = await cntCostAccountOf(r, sc.projectId, contract);

    res.json(cntOk(req, {
      contractCode: contract.Code,
      contractTitleFa: contract.TitleFa,
      costAccountCode: String(contract.CostAccountCode ?? "").trim() || null,
      /* اگر کد حساب پر باشد ولی حساب پیدا نشود، مسئله پیکربندی است نه
       * تطبیق — و باید جدا اعلام شود وگرنه کاربر دنبال خطای اشتباه
       * می‌گردد. */
      costAccountFound: !!account,
      ...rec,
    }));
  } catch (e) { next(e); }
});

/** خلاصهٔ مالی پیمان از دید حساب هزینه. */
app.get("/api/cnt/fin/summary", cntRequire("cnt.fin.view"), async (req, res, next) => {
  try {
    const sc = cntScopeOf(req, res);
    if (!sc) return;

    const r = await repo();
    const contract = await cntContractOf(r, sc.projectId, sc.contractId);
    if (!contract) return cntBad(req, res, "E-CNT-CONTRACT-NOT-FOUND", "پیمان پیدا نشد", 404);

    const { ipcs, postings } = await cntFinInputs(r, sc.projectId, sc.contractId);
    const account = await cntCostAccountOf(r, sc.projectId, contract);
    const summary = contractFinSummary({ contract, ipcs, postings });

    res.json(cntOk(req, {
      ...summary,
      account: account
        ? {
            id: account.Id, code: account.Code, titleFa: account.TitleFa,
            budget: num(account.Budget), actual: num(account.Actual),
            committed: num(account.Committed),
          }
        : null,
    }));
  } catch (e) { next(e); }
});

/** فهرست صورت‌وضعیت‌ها با وضعیت قابلیت ارسال. */
app.get("/api/cnt/fin/postable", cntRequire("cnt.fin.view"), async (req, res, next) => {
  try {
    const sc = cntScopeOf(req, res);
    if (!sc) return;

    const r = await repo();
    const contract = await cntContractOf(r, sc.projectId, sc.contractId);
    if (!contract) return cntBad(req, res, "E-CNT-CONTRACT-NOT-FOUND", "پیمان پیدا نشد", 404);

    const { ipcs, postings } = await cntFinInputs(r, sc.projectId, sc.contractId);
    const account = await cntCostAccountOf(r, sc.projectId, contract);
    const byIpc = new Map(postings.map((p) => [String(p.IpcId), p]));

    const items = ipcs
      .map((ipc) => {
        const post = ipcPostability({ ipc, contract, account });
        const prior = byIpc.get(String(ipc.Id)) ?? null;
        return {
          ...post,
          periodCode: ipc.PeriodCode,
          workflowState: ipc.WorkflowState,
          isPosted: !!prior && String(prior.Status) === "posted",
          postedAmount: prior ? num(prior.NetAmount) : null,
          postedAt: prior?.PostedAt ?? null,
        };
      })
      .sort((a, b) => a.serialNo - b.serialNo);

    res.json(cntOk(req, {
      contractCode: contract.Code,
      postableStates: FIN_POSTABLE_STATES,
      items,
      readyCount: items.filter((i) => i.isPostable && !i.isPosted).length,
      blockedCount: items.filter((i) => !i.isPostable).length,
    }));
  } catch (e) { next(e); }
});

/**
 * ارسال صورت‌وضعیت به حساب هزینه — دومرحله‌ای و ایدمپوتنت.
 *
 * پیش‌فرض `dryRun` است: کسی نباید با یک کلیک اشتباه دفتر مالی را
 * تغییر دهد. اعمال دائمی فقط با `apply:true` صریح.
 */
app.post("/api/cnt/fin/post", cntRequire("cnt.fin.post"), async (req, res, next) => {
  try {
    const sc = cntScopeOf(req, res);
    if (!sc) return;
    const b = engBody(req);

    const ipcId = String(b.ipcId ?? "").trim();
    if (!ipcId) return cntBad(req, res, "E-CNT-FIN-NO-IPC", "شناسهٔ صورت‌وضعیت الزامی است", 422);
    const apply = b.apply === true;

    const r = await repo();
    const contract = await cntContractOf(r, sc.projectId, sc.contractId);
    if (!contract) return cntBad(req, res, "E-CNT-CONTRACT-NOT-FOUND", "پیمان پیدا نشد", 404);

    const [ipc] = await r.list("InterimPaymentCertificate", {
      where: [{ column: "Id", op: "eq", value: ipcId }],
      limit: 1,
    });
    /* صورت‌وضعیت پیمان دیگر = ۴۰۴ نه ۴۰۳: وجود یا نبود رکورد پروژهٔ
     * دیگر نباید از پاسخ قابل استنتاج باشد. */
    if (!ipc || String(ipc.ContractId) !== String(sc.contractId)) {
      return cntBad(req, res, "E-CNT-IPC-NOT-FOUND", "صورت‌وضعیت پیدا نشد", 404);
    }

    const account = await cntCostAccountOf(r, sc.projectId, contract);
    const check = ipcPostability({ ipc, contract, account });
    if (!check.isPostable) {
      return cntBad(req, res, "E-CNT-FIN-BLOCKED", check.blockFa, 422, [check.blockFa]);
    }

    const [prior] = await r.list("ContractFinPosting", {
      where: [{ column: "IpcId", op: "eq", value: ipcId }],
      limit: 1,
    });

    const line = buildFinPosting({
      ipc, contract, account, prior: prior ?? null,
      periodCode: b.periodCode ? String(b.periodCode) : undefined,
    });
    const impact = budgetImpact(line, account);

    /* ثبتی که حساب را از بودجه رد می‌کند، بدون تأیید صریح انجام
     * نمی‌شود. صورت‌وضعیت تأییدشده را نمی‌شود «رد» کرد — ولی می‌شود
     * وادار کرد کسی چشم‌بسته تأییدش نکند. */
    if (apply && impact.isOverBudget && !impact.wasAlreadyOver && b.acceptOverBudget !== true) {
      return cntBad(req, res, "E-CNT-FIN-OVER-BUDGET", impact.warningFa, 422,
        [impact.warningFa, "برای ادامه، acceptOverBudget را صریح true کنید"]);
    }

    const subject = engSubject(req);
    const userId = subject?.id ?? "cnt-fin";
    const nowIso = new Date().toISOString();

    if (apply) {
      await r.patch("CostAccount", account.Id, { Actual: line.nextActual }, userId);
      await r.upsert("ContractFinPosting", { IpcId: ipcId }, {
        ProjectId: sc.projectId,
        ContractId: sc.contractId,
        IpcId: ipcId,
        SerialNo: line.serialNo,
        PeriodCode: line.periodCode,
        CostAccountId: account.Id,
        GrossAmount: line.grossAmount,
        NetAmount: line.netAmount,
        DeductionAmount: line.deductionAmount,
        VatAmount: line.vatAmount,
        PreviousActual: line.previousActual,
        NextActual: line.nextActual,
        MemoFa: line.memoFa,
        PostedBy: userId,
        PostedAt: nowIso,
        ReversedBy: null,
        ReversedAt: null,
        ReversalReasonFa: null,
        Status: "posted",
      }, userId, "cfp");
      await r.patch("InterimPaymentCertificate", ipcId, { PostedToFin: true }, userId);
    }

    res.json(cntOk(req, {
      mode: apply ? "applied" : "preview",
      posting: line,
      budget: impact,
      noteFa: apply
        ? (line.isRepost
            ? `ارسال دوباره انجام شد؛ فقط تفاوت ${line.deltaAmount.toLocaleString("fa-IR")} ریال روی حساب نشست`
            : `${line.netAmount.toLocaleString("fa-IR")} ریال روی حساب «${line.costAccountCode}» نشست`)
        : "این پیش‌نمایش است و هیچ عددی در دفتر مالی تغییر نکرد",
    }));
  } catch (e) { next(e); }
});

/**
 * برگشت ثبت مالی.
 *
 * حذف نمی‌کنیم، برگشت می‌زنیم: سطر می‌ماند با `Status:"reversed"` و
 * دلیل. دفتری که سطرهایش پاک می‌شود، رد ممیزی ندارد.
 */
app.post("/api/cnt/fin/reverse", cntRequire("cnt.fin.post"), async (req, res, next) => {
  try {
    const sc = cntScopeOf(req, res);
    if (!sc) return;
    const b = engBody(req);

    const ipcId = String(b.ipcId ?? "").trim();
    if (!ipcId) return cntBad(req, res, "E-CNT-FIN-NO-IPC", "شناسهٔ صورت‌وضعیت الزامی است", 422);

    const reason = String(b.reasonFa ?? "").trim();
    /* برگشت بدون دلیل، همان حذف است با ظاهر بهتر. */
    if (reason.length < 10) {
      return cntBad(req, res, "E-CNT-FIN-NO-REASON",
        "دلیل برگشت الزامی است و باید دست‌کم ۱۰ نویسه باشد", 422);
    }

    const r = await repo();
    const contract = await cntContractOf(r, sc.projectId, sc.contractId);
    if (!contract) return cntBad(req, res, "E-CNT-CONTRACT-NOT-FOUND", "پیمان پیدا نشد", 404);

    const [prior] = await r.list("ContractFinPosting", {
      where: [{ column: "IpcId", op: "eq", value: ipcId }],
      limit: 1,
    });
    if (!prior || String(prior.ContractId) !== String(sc.contractId)) {
      return cntBad(req, res, "E-CNT-FIN-NOT-POSTED", "برای این صورت‌وضعیت ثبتی در مالی نیست", 404);
    }
    if (String(prior.Status) === "reversed") {
      return cntBad(req, res, "E-CNT-FIN-ALREADY-REVERSED",
        "این ثبت پیش‌تر برگشت خورده است", 422);
    }

    const [account] = await r.list("CostAccount", {
      where: [{ column: "Id", op: "eq", value: prior.CostAccountId }],
      limit: 1,
    });
    if (!account) {
      return cntBad(req, res, "E-CNT-FIN-ACCOUNT-GONE",
        "حساب هزینهٔ این ثبت دیگر وجود ندارد", 422);
    }

    const share = num(prior.NetAmount);
    const nextActual = round(num(account.Actual) - share);
    const subject = engSubject(req);
    const userId = subject?.id ?? "cnt-fin";

    await r.patch("CostAccount", account.Id, { Actual: nextActual }, userId);
    await r.patch("ContractFinPosting", prior.Id, {
      Status: "reversed",
      ReversedBy: userId,
      ReversedAt: new Date().toISOString(),
      ReversalReasonFa: reason,
    }, userId);
    await r.patch("InterimPaymentCertificate", ipcId, { PostedToFin: false }, userId);

    res.json(cntOk(req, {
      ipcId,
      reversedAmount: share,
      previousActual: num(account.Actual),
      nextActual,
      reasonFa: reason,
      noteFa: `${share.toLocaleString("fa-IR")} ریال از حساب «${account.Code}» برگشت خورد؛`
        + " سطر ثبت با وضعیت برگشتی نگهداری شد",
    }));
  } catch (e) { next(e); }
});

/** تعیین حساب هزینهٔ پیمان — پیش‌نیاز هر ارسالی. */
app.post("/api/cnt/fin/account", cntRequire("cnt.fin.post"), async (req, res, next) => {
  try {
    const sc = cntScopeOf(req, res);
    if (!sc) return;
    const b = engBody(req);

    const r = await repo();
    const contract = await cntContractOf(r, sc.projectId, sc.contractId);
    if (!contract) return cntBad(req, res, "E-CNT-CONTRACT-NOT-FOUND", "پیمان پیدا نشد", 404);

    const code = String(b.costAccountCode ?? "").trim();
    if (!code) {
      return cntBad(req, res, "E-CNT-FIN-NO-ACCOUNT-CODE", "کد حساب هزینه الزامی است", 422);
    }

    const [acc] = await r.list("CostAccount", {
      where: [
        { column: "ProjectId", op: "eq", value: sc.projectId },
        { column: "Code", op: "eq", value: code },
      ],
      limit: 1,
    });
    /* کد ناموجود پذیرفته نمی‌شود: پیوند نرم یعنی بدون کلید خارجی، نه
     * بدون اعتبارسنجی. ارجاع به حسابی که نیست، خطا را به زمان ارسال
     * موکول می‌کند — یعنی به بدترین لحظه. */
    if (!acc) {
      return cntBad(req, res, "E-CNT-FIN-ACCOUNT-UNKNOWN",
        `حساب هزینه با کد «${code}» در این پروژه پیدا نشد`, 422);
    }

    const subject = engSubject(req);
    const userId = subject?.id ?? "cnt-fin";
    await r.patch("ContractMaster", sc.contractId, { CostAccountCode: code }, userId);

    res.json(cntOk(req, {
      contractId: sc.contractId,
      costAccountCode: code,
      account: { id: acc.Id, code: acc.Code, titleFa: acc.TitleFa, budget: num(acc.Budget), actual: num(acc.Actual) },
      noteFa: `حساب هزینهٔ پیمان روی «${acc.TitleFa}» تنظیم شد`,
    }));
  } catch (e) { next(e); }
});


/* ══════════════ ۱۹. گزارش‌های پیمان (D11 + D12) ══════════════ */

const CNT_RENDER_FORMATS = new Set(["json", "html", "pdf", "word", "excel", "csv"]);

/** سربرگ گزارش از پارامترها؛ مقادیر نبود «—» می‌شوند نه رشتهٔ خالی. */
function cntLetterhead(q = {}, contract = {}, code = "RPT-CNT", seq = 1) {
  const dash = "—";
  return {
    projectName: String(q.projectName || contract.TitleFa || dash),
    projectCode: String(q.projectCode || dash),
    contractNo: String(contract.Code || dash),
    contractor: {
      name: String(q.contractorName || contract.ContractorName || dash),
      logoText: String(q.contractorLogo || ""),
      role: { fa: "پیمانکار", en: "Contractor" },
    },
    client: {
      name: String(q.clientName || contract.EmployerName || dash),
      logoText: String(q.clientLogo || ""),
      role: { fa: "کارفرما", en: "Client" },
    },
    consultant: {
      name: String(q.consultantName || contract.ConsultantName || dash),
      logoText: String(q.consultantLogo || ""),
      role: { fa: "مشاور", en: "Consultant" },
    },
    docNo: String(q.docNo || documentNumber(String(q.projectCode || "PRJ"), code, seq, Number(q.revision) || 0)),
    revision: String(q.revision ?? "00"),
    issueDate: String(q.issueDate || new Date().toISOString().slice(0, 10)),
    periodLabel: String(q.periodLabel || dash),
    classification: q.classification === "confidential" || q.classification === "public"
      ? String(q.classification) : "internal",
    distribution: String(q.distribution || "").split(",").map((x) => x.trim()).filter(Boolean),
    preparedBy: String(q.preparedBy || dash),
    approvedBy: String(q.approvedBy || dash),
  };
}

/** همهٔ دادهٔ لازم برای هر هشت گزارش، در یک رفت‌وبرگشت. */
async function cntReportInputs(r, projectId, contractId, contract) {
  const [boq, ipcs, guarantees, subIpcs, postings] = await Promise.all([
    r.list("ContractBOQ_Item", { where: [{ column: "ContractId", op: "eq", value: contractId }], limit: 5000 }),
    r.list("InterimPaymentCertificate", { where: [{ column: "ContractId", op: "eq", value: contractId }], limit: 2000 }),
    r.list("ContractGuarantee", { where: [{ column: "ContractId", op: "eq", value: contractId }], limit: 500 }),
    r.list("SubcontractorIPC", { where: [{ column: "ContractId", op: "eq", value: contractId }], limit: 2000 }),
    r.list("ContractFinPosting", { where: [{ column: "ContractId", op: "eq", value: contractId }], limit: 2000 }),
  ]);

  const ipcIds = ipcs.map((i) => String(i.Id));
  /* بدون صورت‌وضعیت، پرس‌وجوی `in` با آرایهٔ خالی می‌تواند همه‌چیز
   * برگرداند؛ صریح رد می‌شویم. */
  const [ipcLines, deductions] = ipcIds.length
    ? await Promise.all([
        r.list("IPC_LineItem", { where: [{ column: "IpcId", op: "in", value: ipcIds }], limit: 20000 }),
        r.list("IPC_Deduction", { where: [{ column: "IpcId", op: "in", value: ipcIds }], limit: 5000 }),
      ])
    : [[], []];

  return { boq, ipcs, ipcLines, deductions, guarantees, subIpcs, postings };
}

/** کاتالوگ گزارش‌ها با پالایش بر اساس مخاطب. */
app.get("/api/cnt/reports", cntRequire("cnt.report.view"), (req, res) => {
  const audience = String(req.query.audience || "");
  const items = audience
    ? CNT_REPORT_CATALOG.filter((r) => r.audiences.includes(audience))
    : CNT_REPORT_CATALOG;
  res.json(cntOk(req, { items, count: items.length, formats: [...CNT_RENDER_FORMATS] }));
});

/**
 * دادهٔ خام یک گزارش (JSON).
 *
 * جدا از `/render` نگه داشته شده تا UI بتواند پیش‌نمایش بدهد بدون
 * اینکه سند رسمی صادر شود.
 */
app.get("/api/cnt/reports/:code", cntRequire("cnt.report.view"), async (req, res, next) => {
  try {
    const code = String(req.params.code || "").toUpperCase();
    const def = getCntReport(code);
    if (!def) return cntBad(req, res, "E-CNT-RPT-CODE", `گزارش ${code} تعریف نشده`, 404);

    const sc = cntScopeOf(req, res);
    if (!sc) return;

    const audience = String(req.query.audience || "internal");
    if (!isCntAudienceAllowed(code, audience)) {
      return cntBad(req, res, "E-CNT-RPT-AUDIENCE",
        `گزارش «${def.title.fa}» برای مخاطب ${audience} مجاز نیست`, 403);
    }

    const r = await repo();
    const contract = await cntContractOf(r, sc.projectId, sc.contractId);
    if (!contract) return cntBad(req, res, "E-CNT-CONTRACT-NOT-FOUND", "پیمان پیدا نشد", 404);

    const payload = await cntReportPayload(r, sc, contract, code, req.query);
    if (!payload) return cntBad(req, res, "E-CNT-RPT-CODE", `سازندهٔ گزارش ${code} یافت نشد`, 404);

    res.json(cntOk(req, payload));
  } catch (e) { next(e); }
});

/** ساخت بدنهٔ گزارش با تمام محاسبات لازم برای همان کد. */
async function cntReportPayload(r, sc, contract, code, q = {}) {
  const inputs = await cntReportInputs(r, sc.projectId, sc.contractId, contract);

  const base = {
    contract,
    ...inputs,
    periodLabel: q.periodLabel ? String(q.periodLabel) : undefined,
    asOf: q.asOf ? String(q.asOf) : new Date().toISOString().slice(0, 10),
  };

  /* برگهٔ صورت‌وضعیت به یک صورت‌وضعیت مشخص نیاز دارد؛ اگر تعیین نشده
   * آخرین را می‌گیریم، نه اینکه برگهٔ خالی بدهیم. */
  if (code === "RPT-CNT-IPC") {
    const wanted = q.ipcId ? String(q.ipcId) : null;
    const sorted = [...inputs.ipcs].sort((a, b) => (Number(b.SerialNo) || 0) - (Number(a.SerialNo) || 0));
    const ipc = wanted ? inputs.ipcs.find((i) => String(i.Id) === wanted) : sorted[0];
    base.ipc = ipc ?? null;
    base.ipcLines = ipc ? inputs.ipcLines.filter((l) => String(l.IpcId) === String(ipc.Id)) : [];
    base.deductions = ipc ? inputs.deductions.filter((d) => String(d.IpcId) === String(ipc.Id)) : [];
  }

  if (code === "RPT-CNT-PRG" || code === "RPT-CNT-EXEC") {
    const pin = await cntProgressInputs(r, sc.projectId, sc.contractId);
    base.progress = progressSnapshot(pin);
    if (code === "RPT-CNT-PRG") base.sCurve = sCurve(pin)?.points ?? [];
  }

  if (code === "RPT-CNT-EXEC") {
    const kin = await cntKpiInputs(r, sc.projectId, sc.contractId);
    const periodCode = q.periodCode ? String(q.periodCode) : new Date().toISOString().slice(0, 7);
    const computed = cntComputeKpis(kin, periodCode);
    const [snapshots, overrides] = await Promise.all([
      r.list("ContractMetricsSnapshot", {
        where: [{ column: "ContractId", op: "eq", value: sc.contractId }], limit: 200,
      }),
      r.list("ContractAlertRule", {
        where: [{ column: "ProjectId", op: "eq", value: sc.projectId }], limit: 100,
      }),
    ]);
    base.scorecard = contractScorecard({
      contractId: sc.contractId, periodCode, kpis: computed.kpis, snapshots, overrides,
    });
  }

  if (code === "RPT-CNT-FIN") {
    base.reconcile = reconcileFinPostings({ ipcs: inputs.ipcs, postings: inputs.postings });
    base.finSummary = contractFinSummary({ contract, ipcs: inputs.ipcs, postings: inputs.postings });
  }

  return buildCntReport(code, base);
}

/**
 * خروجی قالب‌بندی‌شده: چاپ A4، ورد، اکسل یا CSV.
 *
 * نسخهٔ رسمی مجوز جدا می‌خواهد و بدون سربرگ کامل صادر نمی‌شود: سندی که
 * سه لوگو، شمارهٔ سند و فهرست توزیع ندارد، سند رسمی نیست.
 */
app.get("/api/cnt/reports/:code/render", async (req, res, next) => {
  try {
    const code = String(req.params.code || "").toUpperCase();
    const def = getCntReport(code);
    if (!def) return cntBad(req, res, "E-CNT-RPT-CODE", `گزارش ${code} تعریف نشده`, 404);

    const audience = String(req.query.audience || "internal");
    /* RBAC پیش از هر کار دیگری، و مجوز به مخاطب بستگی دارد: نسخهٔ
     * داخلی دیدن است، نسخهٔ رسمی صدور سند. میان‌افزار همگام است پس
     * با پرچم ساده کنترل می‌شود، نه Promise. */
    const need = audience === "official" ? "cnt.report.issue" : "cnt.report.view";
    let passed = false;
    cntRequire(need)(req, res, () => { passed = true; });
    if (!passed) return;

    const sc = cntScopeOf(req, res);
    if (!sc) return;

    if (!isCntAudienceAllowed(code, audience)) {
      return cntBad(req, res, "E-CNT-RPT-AUDIENCE",
        `گزارش «${def.title.fa}» برای مخاطب ${audience} مجاز نیست`, 403);
    }

    const format = String(req.query.format || "html").toLowerCase();
    if (!CNT_RENDER_FORMATS.has(format)) {
      return cntBad(req, res, "E-CNT-RPT-FORMAT", `قالب ${format} پشتیبانی نمی‌شود`, 400);
    }
    const lang = String(req.query.lang || "fa") === "en" ? "en" : "fa";

    const r = await repo();
    const contract = await cntContractOf(r, sc.projectId, sc.contractId);
    if (!contract) return cntBad(req, res, "E-CNT-CONTRACT-NOT-FOUND", "پیمان پیدا نشد", 404);

    const body = await cntReportPayload(r, sc, contract, code, req.query);
    if (!body) return cntBad(req, res, "E-CNT-RPT-CODE", `سازندهٔ گزارش ${code} یافت نشد`, 404);

    const lh = cntLetterhead(req.query, contract, code, Number(req.query.seq) || 1);

    /* سند رسمی بدون سربرگ کامل تولید نمی‌شود — این همان دروازه‌ای است
     * که جلوی «چاپ گرفتم و فرستادم» را می‌گیرد. */
    const issues = validateLetterhead(lh, audience);
    const blocking = issues.filter((i) => i.severity === "error");
    if (blocking.length > 0) {
      return cntBad(req, res, "E-CNT-RPT-LETTERHEAD",
        "سربرگ سند رسمی کامل نیست", 422,
        blocking.map((i) => (i.message?.fa ?? i.message ?? String(i.code))));
    }

    if (format === "json") return res.json(cntOk(req, { report: body, letterhead: lh, issues }));

    if (format === "csv") {
      const csv = toCsv(body, lang);
      res.setHeader("content-type", "text/csv; charset=utf-8");
      res.setHeader("content-disposition", `attachment; filename="${exportFileName(body, lh, "csv")}"`);
      /* BOM لازم است وگرنه اکسل فارسی را جویده نشان می‌دهد. */
      return res.send(`\ufeff${csv}`);
    }

    if (format === "excel") {
      const html = toExcelHtml(body, lh, lang);
      res.setHeader("content-type", "application/vnd.ms-excel; charset=utf-8");
      res.setHeader("content-disposition", `attachment; filename="${exportFileName(body, lh, "xls")}"`);
      return res.send(`\ufeff${html}`);
    }

    if (format === "word") {
      const html = toWordHtml(body, lh, audience, lang);
      res.setHeader("content-type", "application/msword; charset=utf-8");
      res.setHeader("content-disposition", `attachment; filename="${exportFileName(body, lh, "doc")}"`);
      return res.send(`\ufeff${html}`);
    }

    /* html و pdf یک خروجی دارند: مرورگر خودش چاپ به PDF می‌گیرد.
     * تولید PDF سمت سرور به کتابخانهٔ سنگین نیاز دارد و ارزشش را
     * ندارد وقتی CSS چاپ درست تنظیم شده باشد. */
    const html = toPrintHtml(body, lh, audience, lang);
    res.setHeader("content-type", "text/html; charset=utf-8");
    if (format === "pdf") {
      res.setHeader("content-disposition", `inline; filename="${exportFileName(body, lh, "pdf")}"`);
    }
    return res.send(html);
  } catch (e) { next(e); }
});


/* ═══════════════ ماژول نیروی انسانی — تایم‌شیت (hrm-v1، دامنهٔ d10) ═══════════════
 *
 * تحویلی D4. منطق در server/hrmLogic.js است؛ اینجا فقط داده خوانده،
 * اعتبارسنجی و سرو می‌شود. مبنا: docs/HRM_D2_DataModel.md بخش ۷.
 *
 * قاعدهٔ حاکم: هیچ ساعتی بدون فعالیت و حساب هزینه ثبت نمی‌شود، و هیچ
 * عددی پس از بسته شدن دوره تغییر نمی‌کند.
 */

const HRM_VERSION = "hrm-v1";

const hrmOk = (req, data, meta = {}) =>
  ({ ok: true, data, meta: { traceId: req.requestId, engine: HRM_VERSION, timestamp: new Date().toISOString(), ...meta } });

const hrmBad = (req, res, code, message, status = 400, detailsFa = null) =>
  res.status(status).json({
    ok: false,
    error: {
      code, message, traceId: req.requestId,
      ...(detailsFa && detailsFa.length ? { detailsFa } : {}),
    },
  });

/** ایرادهای موتور با همان قالب CNT برگردانده می‌شوند تا UI یک‌جور بخواند. */
function hrmInvalid(req, res, issues) {
  return res.status(422).json({
    ok: false,
    error: {
      code: "E-HRM-VALIDATION",
      message: `ورودی نامعتبر است (${issues.length} ایراد)`,
      issues: issues.map((i) => ({
        field: i.field ?? null,
        code: i.code,
        severity: i.severity ?? "error",
        messageFa: i.messageFa ?? i.message ?? "",
        personId: i.personId ?? null,
      })),
      traceId: req.requestId,
    },
  });
}

function hrmRequire(permission) {
  return (req, res, next) => {
    const enforce = String(process.env.HRM_RBAC_ENFORCE ?? "1") !== "0";
    const subject = engSubject(req);
    if (!subject) {
      if (!enforce) return next();
      return res.status(401).json({
        ok: false,
        error: { code: "E-HRM-AUTH-REQUIRED", message: "شناسهٔ کاربر برای این اقدام الزامی است", permission, traceId: req.requestId },
      });
    }
    const verdict = rbacEvaluate(subject, permission, { projectId: undefined });
    if (!verdict.allow) {
      if (!enforce) return next();
      return res.status(403).json({
        ok: false,
        error: {
          code: "E-HRM-FORBIDDEN",
          message: `کاربر ${subject.displayName} مجوز «${permission}» را ندارد`,
          permission,
          reason: verdict.reasonFa ?? verdict.reason ?? null,
          traceId: req.requestId,
        },
      });
    }
    req.hrmSubject = subject;
    return next();
  };
}

function hrmProjectOf(req, res) {
  const projectId = String(req.query.projectId || req.body?.projectId || "");
  if (!projectId) { hrmBad(req, res, "E-HRM-NO-PROJECT", "پارامتر projectId الزامی است"); return null; }
  return projectId;
}

const hrmActor = (req) => String(req.get("x-user-id") || req.hrmSubject?.code || "unknown");

/** قفل‌های دورهٔ یک پروژه. */
async function hrmLocks(r, projectId) {
  return r.list("HrmPeriodLock", {
    where: [{ column: "ProjectId", op: "eq", value: projectId }],
    limit: 500,
  });
}

/** برگه به همراه ردیف‌هایش؛ ردیف باطل‌شده کنار گذاشته می‌شود. */
async function hrmHeaderWithEntries(r, projectId, headerId) {
  const rows = await r.list("HrmTimesheetHeader", {
    where: [{ column: "ProjectId", op: "eq", value: projectId }, { column: "Id", op: "eq", value: headerId }],
    limit: 1,
  });
  const header = rows[0] ?? null;
  if (!header) return { header: null, entries: [] };
  const all = await r.list("HrmTimesheetEntry", {
    where: [{ column: "HeaderId", op: "eq", value: headerId }],
    limit: 2000,
  });
  return { header, entries: all.filter((e) => !e.VoidedAt) };
}

/** ساعت‌های همان نفرات در همان روز از برگه‌های *دیگر*. */
async function hrmPriorHours(r, projectId, workDate, excludeHeaderId) {
  const rows = await r.list("HrmTimesheetEntry", {
    where: [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "WorkDate", op: "eq", value: workDate },
    ],
    limit: 5000,
  });
  const map = {};
  for (const e of rows) {
    if (e.VoidedAt) continue;
    if (excludeHeaderId && String(e.HeaderId) === String(excludeHeaderId)) continue;
    const k = String(e.PersonId);
    map[k] = Math.round(((map[k] ?? 0) + Number(e.HoursRaw ?? 0)) * 100) / 100;
  }
  return map;
}

/** جمع‌های سربرگ را از ردیف‌های واقعی بازمی‌سازد — هرگز از ورودی کاربر. */
async function hrmRecalcHeader(r, header, entries) {
  const rows = entries.map((e) => ({
    personId: e.PersonId,
    hoursRaw: Number(e.HoursRaw ?? 0),
    hoursNormal: Number(e.HoursNormal ?? 0),
    hoursOt: Number(e.HoursOt ?? 0),
    hoursNight: Number(e.HoursNight ?? 0),
    hoursHoliday: Number(e.HoursHoliday ?? 0),
    hoursRejected: 0,
    isProductive: e.IsProductive === true || e.IsProductive === 1,
  }));
  const t = tsTotals(rows);
  await r.patch("HrmTimesheetHeader", header.Id, {
    TotalHoursRaw: t.raw,
    TotalHoursNormal: t.normal,
    TotalHoursOt: t.ot,
    TotalHoursNight: t.night,
    TotalHoursHoliday: t.holiday,
  }, "system");
  return t;
}

/** کاتالوگ ثابت‌های ماژول — UI دکمه‌ها و برچسب‌ها را از اینجا می‌سازد. */
app.get("/api/hrm/meta", hrmRequire("hrm.roster.view"), (req, res) => {
  res.json(hrmOk(req, {
    states: Object.entries(TS_STATE_FA).map(([code, fa]) => ({ code, fa, rank: TS_STATE_RANK[code] })),
    attendanceCodes: Object.entries(ATTENDANCE_FA).map(([code, fa]) => ({ code, fa })),
    adjustmentTypes: Object.entries(ADJUSTMENT_TYPE_FA).map(([code, fa]) => ({ code, fa })),
    laborLaw: IRAN_LABOR_LAW,
  }));
});

/** فهرست برگه‌های یک روز یا یک دوره، با خلاصهٔ روزانه. */
app.get("/api/hrm/timesheets", hrmRequire("hrm.roster.view"), async (req, res, next) => {
  try {
    const projectId = hrmProjectOf(req, res);
    if (!projectId) return;

    const where = [{ column: "ProjectId", op: "eq", value: projectId }];
    const workDate = String(req.query.workDate || "");
    if (workDate) where.push({ column: "WorkDate", op: "eq", value: workDate });

    const r = await repo();
    let headers = await r.list("HrmTimesheetHeader", { where, limit: 1000 });

    /* دوره پارامتر جداست چون در جدول ذخیره نمی‌شود — از تاریخ مشتق است. */
    const periodCode = String(req.query.periodCode || "");
    if (periodCode) headers = headers.filter((h) => periodOf(String(h.WorkDate)) === periodCode);
    const status = String(req.query.status || "");
    if (status) headers = headers.filter((h) => String(h.Status) === status);

    const ids = headers.map((h) => String(h.Id));
    const entries = ids.length
      ? (await r.list("HrmTimesheetEntry", { where: [{ column: "HeaderId", op: "in", value: ids }], limit: 20000 }))
          .filter((e) => !e.VoidedAt)
      : [];

    const locks = await hrmLocks(r, projectId);
    const items = headers
      .sort((a, b) => String(b.WorkDate).localeCompare(String(a.WorkDate)))
      .map((h) => ({
        ...h,
        statusFa: TS_STATE_FA[String(h.Status)] ?? String(h.Status),
        periodCode: periodOf(String(h.WorkDate)),
        isLocked: isDateLocked(String(h.WorkDate), locks),
        isEditable: isTsEditable(String(h.Status)) && !isDateLocked(String(h.WorkDate), locks),
        entryCount: entries.filter((e) => String(e.HeaderId) === String(h.Id)).length,
        nextStates: tsNextStates(String(h.Status)).map((t) => ({ to: t.to, toFa: TS_STATE_FA[t.to], labelFa: t.labelFa, permission: t.permission })),
      }));

    res.json(hrmOk(req, {
      items,
      count: items.length,
      summary: workDate ? dailySummary(workDate, headers, entries) : null,
    }));
  } catch (err) { next(err); }
});

/** یک برگه با ردیف‌ها، جمع‌ها و ایرادهای باقی‌مانده. */
app.get("/api/hrm/timesheets/:id", hrmRequire("hrm.roster.view"), async (req, res, next) => {
  try {
    const projectId = hrmProjectOf(req, res);
    if (!projectId) return;

    const r = await repo();
    const { header, entries } = await hrmHeaderWithEntries(r, projectId, String(req.params.id));
    if (!header) return hrmBad(req, res, "E-HRM-TS-NOT-FOUND", "برگهٔ کارکرد پیدا نشد", 404);

    const locks = await hrmLocks(r, projectId);
    const locked = isDateLocked(String(header.WorkDate), locks);

    const rows = entries.map((e) => ({
      personId: e.PersonId, hoursRaw: Number(e.HoursRaw ?? 0),
      hoursNormal: Number(e.HoursNormal ?? 0), hoursOt: Number(e.HoursOt ?? 0),
      hoursNight: Number(e.HoursNight ?? 0), hoursHoliday: Number(e.HoursHoliday ?? 0),
      hoursRejected: 0, isProductive: e.IsProductive === true || e.IsProductive === 1,
    }));

    res.json(hrmOk(req, {
      header: {
        ...header,
        statusFa: TS_STATE_FA[String(header.Status)] ?? String(header.Status),
        periodCode: periodOf(String(header.WorkDate)),
        isLocked: locked,
        isEditable: isTsEditable(String(header.Status)) && !locked,
        nextStates: tsNextStates(String(header.Status)).map((t) => ({ to: t.to, toFa: TS_STATE_FA[t.to], labelFa: t.labelFa, permission: t.permission })),
      },
      entries: entries.map((e) => ({
        ...e,
        attendanceFa: ATTENDANCE_FA[String(e.AttendanceCode)] ?? String(e.AttendanceCode),
      })),
      totals: tsTotals(rows),
    }));
  } catch (err) { next(err); }
});

/**
 * ساخت یا به‌روزرسانی برگه با ردیف‌هایش.
 *
 * شناسه قطعی است، پس ارسال دوباره از دستگاه آفلاین برگهٔ تکراری
 * نمی‌سازد؛ همان برگه را به‌روز می‌کند یا تعارض ثبت می‌کند.
 */
app.post("/api/hrm/timesheets", hrmRequire("hrm.timesheet.enter"), async (req, res, next) => {
  try {
    const b = req.body ?? {};
    const projectId = String(b.projectId || "");
    if (!projectId) return hrmBad(req, res, "E-HRM-NO-PROJECT", "پارامتر projectId الزامی است");
    const crewId = String(b.crewId || "");
    const workDate = String(b.workDate || "");
    if (!crewId || !workDate) {
      return hrmBad(req, res, "E-HRM-TS-KEY", "شناسهٔ اکیپ و تاریخ کارکرد الزامی است", 422);
    }
    const shift = ["day", "night", "swing"].includes(String(b.shift)) ? String(b.shift) : "day";

    const r = await repo();
    const locks = await hrmLocks(r, projectId);
    if (isDateLocked(workDate, locks)) {
      return hrmBad(req, res, "E-HRM-103", `دورهٔ ${periodOf(workDate)} بسته است؛ اصلاح فقط با سند اصلاحی ممکن است`, 422);
    }

    const id = timesheetId({ projectId, crewId, workDate, shift });
    const existing = (await r.list("HrmTimesheetHeader", {
      where: [{ column: "ProjectId", op: "eq", value: projectId }, { column: "Id", op: "eq", value: id }],
      limit: 1,
    }))[0] ?? null;

    /* برگهٔ موجودی که از پیش‌نویس گذشته، از این مسیر عوض نمی‌شود:
     * مسیر همگام‌سازی برای آن هست و تعارض ثبت می‌کند. */
    if (existing && !isTsEditable(String(existing.Status))) {
      return hrmBad(req, res, "E-HRM-TS-LOCKED",
        `برگه در وضعیت «${TS_STATE_FA[String(existing.Status)]}» است و ویرایش نمی‌شود`, 409);
    }

    const rawEntries = Array.isArray(b.entries) ? b.entries : [];
    if (rawEntries.length === 0) {
      return hrmBad(req, res, "E-HRM-111", "برگهٔ بدون ردیف کارکرد ثبت نمی‌شود", 422);
    }

    const prior = await hrmPriorHours(r, projectId, workDate, id);

    /* اعتبارسنجی پیش از هر نوشتنی: برگهٔ نیمه‌ساخته بدتر از نبود برگه است. */
    const ctx = {
      priorHoursByPerson: prior,
      isPeriodLocked: false,
      validActivityIds: Array.isArray(b.validActivityIds) ? b.validActivityIds.map(String) : undefined,
      openCbsIds: Array.isArray(b.openCbsIds) ? b.openCbsIds.map(String) : undefined,
      blockedPersonIds: Array.isArray(b.blockedPersonIds) ? b.blockedPersonIds.map(String) : undefined,
      unclearedPersonIds: Array.isArray(b.unclearedPersonIds) ? b.unclearedPersonIds.map(String) : undefined,
    };
    const running = { ...prior };
    const issues = [];
    for (const e of rawEntries) {
      const one = validateTsEntry(e, { ...ctx, priorHoursByPerson: running });
      issues.push(...one);
      const k = String(e.personId ?? "");
      if (k) running[k] = Math.round(((running[k] ?? 0) + Number(e.hoursRaw ?? 0)) * 100) / 100;
    }

    /* رفع TD-HRM-05 — گیت D7 روی ثبت مستقیم تایم‌شیت.
     *
     * عضویت اکیپ این گیت را داشت (`E-HRM-260`) ولی ثبت مستقیم نه. یعنی
     * پنج گیت تجهیز با یک درخواست دور زده می‌شد: نفری با وضعیت
     * `candidate` — بدون مدرک، بدون طب کار، بدون آموزش HSE — ساعتش ثبت
     * می‌شد و همان ساعت تا دفتر مالی می‌رفت.
     *
     * وضعیت از **پروندهٔ سرور** خوانده می‌شود نه از `blockedPersonIds`
     * بدنهٔ درخواست؛ کلاینت نباید بتواند بگوید چه کسی مجاز است.
     *
     * نفرِ بدون پرونده فقط **هشدار** می‌گیرد — همان استدلال عضویت اکیپ:
     * پروژه‌های موجود ساعت‌هایی دارند که پیش از راه‌اندازی D7 ثبت
     * شده‌اند و مسدود کردنشان سامانه را از کار می‌اندازد. */
    const personIds = [...new Set(rawEntries.map((e) => String(e.personId ?? "")).filter(Boolean))];
    if (personIds.length) {
      const people = await r.list("HrmPerson", {
        where: [{ column: "ProjectId", op: "eq", value: projectId }],
        limit: 20000,
      });
      const byId = new Map(people.map((x) => [String(x.Id), x]));
      for (const pid of personIds) {
        const person = byId.get(pid);
        if (!person) {
          issues.push({
            code: "W-HRM-524",
            severity: "warning",
            field: "personId",
            personId: pid,
            messageFa: "این نفر پروندهٔ پرسنلی ندارد؛ گیت‌های تجهیز روی ساعت او اعمال نشده است",
          });
          continue;
        }
        const st = String(person.Status ?? "candidate");
        if (st !== "active") {
          issues.push({
            code: "E-HRM-261",
            severity: "error",
            field: "personId",
            personId: pid,
            messageFa: `وضعیت ${person.FullNameFa} «${PERSON_STATUS_FA[st] ?? st}» است؛ ساعت فقط برای نیروی فعال ثبت می‌شود`,
          });
        }
      }
    }

    if (hasBlockingIssue(issues)) return hrmInvalid(req, res, issues);

    const computed = computeTsEntries(rawEntries, {
      workDate, shift,
      holidays: Array.isArray(b.holidays) ? b.holidays.map(String) : undefined,
      priorHoursByPerson: prior,
    });
    const totals = tsTotals(computed);
    const actor = hrmActor(req);
    const now = new Date().toISOString();

    const headerPayload = {
      ProjectId: projectId, CrewId: crewId, ObsNodeId: b.obsNodeId ?? null,
      WorkDate: workDate, Shift: shift,
      Status: "draft", Source: ["web", "mobile", "excel", "api"].includes(String(b.source)) ? String(b.source) : "web",
      Weather: b.weather ?? null, SiteCondition: b.siteCondition ?? null,
      GpsLat: b.gpsLat ?? null, GpsLng: b.gpsLng ?? null, GpsAccuracyM: b.gpsAccuracyM ?? null,
      PhotoRefs: Array.isArray(b.photoRefs) ? b.photoRefs.join(",") : (b.photoRefs ?? null),
      ForemanSignatureRef: b.foremanSignatureRef ?? null,
      ClientSignatureRef: b.clientSignatureRef ?? null,
      DeviceId: b.deviceId ?? null, AppVersion: b.appVersion ?? null,
      CapturedAt: b.capturedAt ?? now,
      SyncState: "synced",
      Revision: existing ? Number(existing.Revision ?? 1) + 1 : 1,
      TotalHoursRaw: totals.raw, TotalHoursNormal: totals.normal,
      TotalHoursOt: totals.ot, TotalHoursNight: totals.night, TotalHoursHoliday: totals.holiday,
      EnteredBy: existing?.EnteredBy ?? actor,
    };

    if (existing) {
      await r.patch("HrmTimesheetHeader", id, headerPayload, actor);
      /* ردیف‌های قبلی باطل می‌شوند نه حذف — قاعدهٔ ۵ سند D2. */
      const old = await r.list("HrmTimesheetEntry", { where: [{ column: "HeaderId", op: "eq", value: id }], limit: 2000 });
      for (const o of old) {
        if (o.VoidedAt) continue;
        await r.patch("HrmTimesheetEntry", o.Id, {
          VoidedAt: now, VoidedBy: actor, VoidReason: "جایگزینی با ارسال تازهٔ همان برگه",
        }, actor);
      }
    } else {
      await r.create("HrmTimesheetHeader", { Id: id, ...headerPayload });
    }

    const created = [];
    for (const c of computed) {
      const row = await r.create("HrmTimesheetEntry", {
        ProjectId: projectId, HeaderId: id, PersonId: String(c.personId ?? ""),
        WorkDate: workDate, TradeCode: String(c.tradeCode ?? ""), Grade: c.grade ?? null,
        ActivityId: String(c.activityId ?? ""), WbsId: c.wbsId ?? null, CbsId: String(c.cbsId ?? ""),
        HoursRaw: Number(c.hoursRaw ?? 0),
        HoursNormal: c.hoursNormal, HoursOt: c.hoursOt,
        HoursNight: c.hoursNight, HoursHoliday: c.hoursHoliday,
        AttendanceCode: String(c.attendanceCode ?? "present"),
        IsProductive: c.isProductive,
        QtyDone: c.qtyDone ?? null, QtyUom: c.qtyUom ?? null,
        RateLineId: c.rateLineId ?? null, RcaReasonId: c.rcaReasonId ?? null,
        Note: c.note ?? null,
      });
      created.push(row);
    }


    res.status(existing ? 200 : 201).json(hrmOk(req, {
      id, created: !existing, totals,
      entryCount: created.length,
      rejectedHours: computed.reduce((a, c) => a + Number(c.hoursRejected ?? 0), 0),
      warnings: issues.filter((i) => i.severity === "warning"),
    }));
  } catch (err) { next(err); }
});

/**
 * گذار وضعیت.
 *
 * مجوز از خود جدول گذارها می‌آید، نه از میان‌افزار ثابت: هر گذار
 * دست متفاوتی را امضا می‌کند.
 */
app.post("/api/hrm/timesheets/:id/transition", async (req, res, next) => {
  try {
    const b = req.body ?? {};
    const projectId = String(b.projectId || req.query.projectId || "");
    if (!projectId) return hrmBad(req, res, "E-HRM-NO-PROJECT", "پارامتر projectId الزامی است");

    const to = String(b.to || "");
    if (!to) return hrmBad(req, res, "E-HRM-NO-TARGET", "وضعیت مقصد مشخص نیست", 422);

    const r = await repo();
    const { header, entries } = await hrmHeaderWithEntries(r, projectId, String(req.params.id));
    if (!header) return hrmBad(req, res, "E-HRM-TS-NOT-FOUND", "برگهٔ کارکرد پیدا نشد", 404);

    const from = String(header.Status);
    const t = tsNextStates(from).find((x) => x.to === to);
    if (!t) {
      return hrmBad(req, res, "E-HRM-110",
        `گذار از «${TS_STATE_FA[from] ?? from}» به «${TS_STATE_FA[to] ?? to}» تعریف نشده است`, 422);
    }

    /* RBAC بر پایهٔ همان گذار. */
    let passed = false;
    hrmRequire(t.permission)(req, res, () => { passed = true; });
    if (!passed) return;

    const locks = await hrmLocks(r, projectId);
    const signature = b.foremanSignatureRef ? String(b.foremanSignatureRef) : (header.ForemanSignatureRef ?? null);

    const verdict = canTransition({
      from, to,
      hasForemanSignature: Boolean(signature),
      isPeriodLocked: isDateLocked(String(header.WorkDate), locks) && to !== "locked",
      entryCount: entries.length,
    });
    if (!verdict.ok) return hrmBad(req, res, verdict.code, verdict.messageFa, 422);

    /* برگشت بدون دلیل، اطلاعاتی به ثبت‌کننده نمی‌دهد. */
    const reason = String(b.reasonFa ?? "").trim();
    if (to === "rejected" && reason.length < 10) {
      return hrmBad(req, res, "E-HRM-113", "دلیل برگشت باید دست‌کم ۱۰ نویسه باشد", 422);
    }

    const actor = hrmActor(req);
    const now = new Date().toISOString();
    const patch = { Status: to, Revision: Number(header.Revision ?? 1) + 1 };
    if (to === "submitted") patch.SubmittedAt = now;
    if (to === "foreman_approved") patch.ForemanSignatureRef = signature;
    if (to === "pm_approved") { patch.ApprovedBy = actor; patch.ApprovedAt = now; }
    if (to === "rejected") patch.RejectReason = reason;
    if (to === "draft") patch.RejectReason = null;
    if (to === "locked") { patch.LockedAt = now; patch.LockedBy = actor; }

    await r.patch("HrmTimesheetHeader", header.Id, patch, actor);

    /* انتشار `hrm.manhours.approved` (رفع TD-HRM-15).
     *
     * بار رویداد **جمع دوره** است نه تک‌برگه: مصرف‌کننده (PEX) برای
     * وزن‌دهی نفر-ساعتی به رقم دوره نیاز دارد، و انتشار به‌ازای هر
     * برگه صدها رویداد می‌ساخت که همه یک چیز را می‌گویند.
     *
     * `compareKey: "actualMh"` یعنی اگر جمع عوض نشده باشد رویداد
     * تازه‌ای ساخته نمی‌شود — تأیید برگهٔ صفرساعته صف را شلوغ
     * نمی‌کند. */
    let mhEvent = null;
    if (to === "pm_approved") {
      const periodCode = periodOf(String(header.WorkDate));
      const approved = await hrmApprovedEntries(r, projectId, periodCode);
      const actualMh = round2Srv(
        approved.entries.reduce((sum, e) => sum + Number(e.HoursRaw ?? 0), 0)
      );
      mhEvent = await hrmEmit(r, req, {
        type: "hrm.manhours.approved",
        projectId,
        keyParts: [periodCode],
        entityName: "HrmTimesheetHeader",
        entityId: periodCode,
        occurredAt: now,
        compareKey: "actualMh",
        payload: {
          projectId,
          periodCode,
          actualMh,
          approvedSheets: approved.approvedCount,
          pendingSheets: approved.pending,
          otPct: approved.otPct,
        },
      });
    }

    res.json(hrmOk(req, {
      id: header.Id, from, to,
      toFa: TS_STATE_FA[to] ?? to,
      messageFa: `برگه به وضعیت «${TS_STATE_FA[to] ?? to}» رفت`,
      eventEmitted: mhEvent?.emitted ?? false,
      nextStates: tsNextStates(to).map((x) => ({ to: x.to, toFa: TS_STATE_FA[x.to], labelFa: x.labelFa })),
    }));
  } catch (err) { next(err); }
});

/**
 * هزینهٔ کارکرد یک دوره — نرخ × ساعت، نه فیش حقوقی.
 *
 * دروازه روی «بهره‌وری» است نه «نرخ»، و مبلغ‌ها برای کسی که مجوز
 * دیدن نرخ ندارد ماسک می‌شوند (رفع شکاف H-09).
 *
 * چرا این تفکیک: کنترل هزینه باید بداند چند نفر-ساعت روی کدام حساب
 * نشسته — این کار اوست. ولی نرخ دستمزد دادهٔ فردی حساس است و سطح
 * دسترسی بالاتری می‌خواهد. یک دروازهٔ واحد یا ساعت را از او می‌گرفت
 * یا نرخ را به همه می‌داد.
 */
app.get("/api/hrm/cost", hrmRequire("hrm.productivity.view"), async (req, res, next) => {
  try {
    const projectId = hrmProjectOf(req, res);
    if (!projectId) return;
    const periodCode = String(req.query.periodCode || "");
    if (!periodCode) return hrmBad(req, res, "E-HRM-NO-PERIOD", "پارامتر periodCode الزامی است");

    const r = await repo();
    const headers = (await r.list("HrmTimesheetHeader", {
      where: [{ column: "ProjectId", op: "eq", value: projectId }], limit: 2000,
    })).filter((h) => periodOf(String(h.WorkDate)) === periodCode);

    /* فقط ساعت تأییدشده هزینه می‌شود: عدد پیش‌نویس در دفتر مالی
     * جایی ندارد. */
    const approved = headers.filter((h) => TS_STATE_RANK[String(h.Status)] >= TS_STATE_RANK.pm_approved);
    const ids = approved.map((h) => String(h.Id));
    const entries = ids.length
      ? (await r.list("HrmTimesheetEntry", { where: [{ column: "HeaderId", op: "in", value: ids }], limit: 20000 }))
          .filter((e) => !e.VoidedAt)
      : [];

    /* منبع نرخ: کارت نرخ نسخه‌دار (D12).
     *
     * پیش از D12 اینجا نرخ از `WorkforceMember.DailyRate` تقسیم بر
     * سقف روزانه ساخته می‌شد. با آمدن کارت نرخ، دو منبع می‌شدند و
     * همان دوره از این مسیر یک رقم و از مسیر ارسال رقم دیگری
     * می‌گرفت. کارت نرخ برنده است چون نسخه‌دار است و می‌داند هزینهٔ
     * فروردین با نرخ فروردین حساب می‌شود.
     *
     * `DailyRate` عضو، **پشتیبان** می‌ماند: پروژه‌ای که هنوز کارت
     * نرخ ننوشته نباید یک‌شبه همهٔ مبالغش صفر شود. */
    const [cards, members] = await Promise.all([
      r.list("HrmRateCard", { where: [{ column: "ProjectId", op: "eq", value: projectId }], limit: 5000 }),
      r.list("WorkforceMember", { where: [{ column: "ProjectId", op: "eq", value: projectId }], limit: 5000 }),
    ]);
    const fallbackByTrade = new Map();
    for (const m of members) {
      const daily = Number(m.DailyRate ?? 0);
      if (!(daily > 0)) continue;
      const code = String(m.TradeCode ?? "");
      if (!fallbackByTrade.has(code)) fallbackByTrade.set(code, Math.round((daily / IRAN_LABOR_LAW.dailyNormalCap) * 100) / 100);
    }
    const cardLookup = rateLookupFrom(cards, `${periodCode}-28`);
    const rateOf = (trade) => cardLookup(trade) ?? fallbackByTrade.get(trade) ?? null;

    const rows = entries.map((e) => ({
      cbsId: e.CbsId, activityId: e.ActivityId, tradeCode: e.TradeCode,
      hoursRaw: Number(e.HoursRaw ?? 0),
      hoursNormal: Number(e.HoursNormal ?? 0), hoursOt: Number(e.HoursOt ?? 0),
      hoursNight: Number(e.HoursNight ?? 0), hoursHoliday: Number(e.HoursHoliday ?? 0),
      hoursRejected: 0, isProductive: e.IsProductive === true || e.IsProductive === 1,
    }));
    const summary = tsCostSummary(buildTsCostLines(rows, rateOf));

    /* ماسک مبلغ برای کسی که مجوز نرخ ندارد. ساعت‌ها می‌مانند چون
     * تصمیم دربارهٔ تخصیص نیرو به آن‌ها وابسته است. */
    const canSeeRates = rbacEvaluate(engSubject(req), "hrm.rate.view", { projectId: undefined }).allow;
    const MASK = "•••";

    res.json(hrmOk(req, {
      periodCode,
      lines: summary.lines.map((l) => (canSeeRates ? l : { ...l, hourlyRate: MASK, amount: MASK })),
      totalEquivalentHours: summary.totalEquivalentHours,
      totalAmount: canSeeRates ? summary.totalAmount : MASK,
      unpricedHours: summary.unpricedHours,
      isComplete: summary.isComplete,
      ratesMasked: !canSeeRates,
      headerCount: headers.length,
      approvedHeaderCount: approved.length,
      pendingHeaderCount: headers.length - approved.length,
      noteFa: summary.isComplete
        ? "همهٔ ساعت‌ها نرخ دارند"
        : `${summary.unpricedHours} ساعت مؤثر بدون نرخ مانده و مبلغ آن محاسبه نشده است`,
    }));
  } catch (err) { next(err); }
});

/** وضعیت قفل دوره‌ها. */
app.get("/api/hrm/periods", hrmRequire("hrm.roster.view"), async (req, res, next) => {
  try {
    const projectId = hrmProjectOf(req, res);
    if (!projectId) return;
    const r = await repo();
    const [locks, headers] = await Promise.all([
      hrmLocks(r, projectId),
      r.list("HrmTimesheetHeader", { where: [{ column: "ProjectId", op: "eq", value: projectId }], limit: 5000 }),
    ]);

    const byPeriod = new Map();
    for (const h of headers) {
      const p = periodOf(String(h.WorkDate));
      if (!byPeriod.has(p)) byPeriod.set(p, []);
      byPeriod.get(p).push(h);
    }

    const items = [...byPeriod.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([periodCode, hs]) => {
        const lock = locks.find((l) => String(l.PeriodCode) === periodCode && !l.UnlockedAt) ?? null;
        const check = canLockPeriod(hs);
        return {
          periodCode,
          headerCount: hs.length,
          isLocked: Boolean(lock),
          lockedAt: lock?.LockedAt ?? null,
          lockedBy: lock?.LockedBy ?? null,
          canLock: !lock && check.canLock,
          blockedReasonFa: lock ? null : (check.messageFa ?? null),
          pendingCount: check.pendingCount,
          postedCount: check.postedCount,
        };
      });

    res.json(hrmOk(req, { items, count: items.length }));
  } catch (err) { next(err); }
});

/** بستن دوره. */
app.post("/api/hrm/periods/lock", hrmRequire("hrm.period.lock"), async (req, res, next) => {
  try {
    const b = req.body ?? {};
    const projectId = String(b.projectId || "");
    const periodCode = String(b.periodCode || "");
    if (!projectId || !periodCode) {
      return hrmBad(req, res, "E-HRM-NO-PERIOD", "شناسهٔ پروژه و کد دوره الزامی است", 422);
    }

    const r = await repo();
    const locks = await hrmLocks(r, projectId);
    if (locks.some((l) => String(l.PeriodCode) === periodCode && !l.UnlockedAt)) {
      return hrmBad(req, res, "E-HRM-122", `دورهٔ ${periodCode} از پیش بسته است`, 409);
    }

    const headers = (await r.list("HrmTimesheetHeader", {
      where: [{ column: "ProjectId", op: "eq", value: projectId }], limit: 5000,
    })).filter((h) => periodOf(String(h.WorkDate)) === periodCode);

    const check = canLockPeriod(headers);
    if (!check.canLock) {
      return hrmBad(req, res, check.code, check.messageFa, 422,
        [`${check.pendingCount} برگهٔ تعیین‌تکلیف‌نشده`, `${check.postedCount} برگهٔ ارسال‌شده`]);
    }

    const actor = hrmActor(req);
    const now = new Date().toISOString();
    const row = await r.create("HrmPeriodLock", {
      ProjectId: projectId, PeriodCode: periodCode,
      LockedBy: actor, LockedAt: now, ReasonFa: b.reasonFa ?? null,
    });
    /* برگه‌های ارسال‌شده به وضعیت قفل می‌روند تا حالتشان با دفتر
     * یکی باشد؛ وگرنه UI برگهٔ «ارسال‌شده» در دورهٔ بسته نشان می‌دهد. */
    let moved = 0;
    for (const h of headers) {
      if (String(h.Status) === "posted") {
        await r.patch("HrmTimesheetHeader", h.Id, { Status: "locked", LockedAt: now, LockedBy: actor }, actor);
        moved++;
      }
    }

    /* انتشار `hrm.period.locked` (رفع TD-HRM-15).
     *
     * مصرف‌کننده باید بداند دوره بسته شد، وگرنه ساعتی می‌فرستد که
     * پذیرفته نمی‌شود و علتش را نمی‌فهمد. رخداد یکتاست — بازگشایی
     * و بستن دوباره رویداد تازه‌ای با کلید متفاوت می‌سازد. */
    const evt = await hrmEmit(r, req, {
      type: "hrm.period.locked",
      projectId,
      keyParts: [periodCode],
      entityName: "HrmPeriodLock",
      entityId: periodCode,
      occurredAt: now,
      payload: {
        projectId,
        periodCode,
        lockedAt: now,
        lockedBy: actor,
        lockedHeaderCount: moved,
        reasonFa: b.reasonFa ?? null,
      },
    });

    res.status(201).json(hrmOk(req, {
      periodCode, lockedAt: now, lockedBy: actor,
      lockedHeaderCount: moved,
      eventEmitted: evt.emitted,
      messageFa: `دورهٔ ${periodCode} بسته شد؛ از این پس اصلاح فقط با سند اصلاحی ممکن است`,
    }));
  } catch (err) { next(err); }
});

/** بازگشایی دوره — استثناست و دلیل می‌خواهد. */
app.post("/api/hrm/periods/unlock", hrmRequire("hrm.period.lock"), async (req, res, next) => {
  try {
    const b = req.body ?? {};
    const projectId = String(b.projectId || "");
    const periodCode = String(b.periodCode || "");
    const reason = String(b.reasonFa ?? "").trim();
    if (!projectId || !periodCode) {
      return hrmBad(req, res, "E-HRM-NO-PERIOD", "شناسهٔ پروژه و کد دوره الزامی است", 422);
    }
    /* بازگشایی، ردپای ممیزی می‌سازد؛ بدون دلیل مکتوب انجام نمی‌شود. */
    if (reason.length < 10) {
      return hrmBad(req, res, "E-HRM-123", "بازگشایی دوره بدون دلیل مکتوب (دست‌کم ۱۰ نویسه) ممکن نیست", 422);
    }

    const r = await repo();
    const locks = await hrmLocks(r, projectId);
    const lock = locks.find((l) => String(l.PeriodCode) === periodCode && !l.UnlockedAt);
    if (!lock) return hrmBad(req, res, "E-HRM-124", `دورهٔ ${periodCode} بسته نیست`, 404);

    const actor = hrmActor(req);
    const now = new Date().toISOString();
    await r.patch("HrmPeriodLock", lock.Id, {
      UnlockedBy: actor, UnlockedAt: now, UnlockReasonFa: reason,
    }, actor);

    res.json(hrmOk(req, {
      periodCode, unlockedAt: now, unlockedBy: actor,
      messageFa: `دورهٔ ${periodCode} بازگشایی شد؛ این اقدام در سیاههٔ ممیزی ثبت شد`,
    }));
  } catch (err) { next(err); }
});

/**
 * همگام‌سازی برگه از دستگاه آفلاین.
 *
 * جدول تصمیم حل تعارض اینجا اجرا می‌شود. نسخهٔ بازنده هرگز بی‌صدا
 * دور ریخته نمی‌شود: در دفتر تعارض می‌نشیند.
 */
app.post("/api/hrm/sync/timesheet", hrmRequire("hrm.timesheet.enter"), async (req, res, next) => {
  try {
    const b = req.body ?? {};
    const projectId = String(b.projectId || "");
    if (!projectId) return hrmBad(req, res, "E-HRM-NO-PROJECT", "پارامتر projectId الزامی است");
    const local = b.local ?? {};
    const id = String(local.id || "");
    if (!id) return hrmBad(req, res, "E-HRM-SYNC-NO-ID", "شناسهٔ برگهٔ محلی الزامی است", 422);

    const r = await repo();
    const server = (await r.list("HrmTimesheetHeader", {
      where: [{ column: "ProjectId", op: "eq", value: projectId }, { column: "Id", op: "eq", value: id }],
      limit: 1,
    }))[0] ?? null;

    /* برگه‌ای که سرور ندارد، تعارض نیست — فقط تازه است. */
    if (!server) {
      return res.json(hrmOk(req, {
        id, verdict: { winner: "local", code: "I-HRM-400", ruleFa: "برگه در سرور وجود ندارد؛ نسخهٔ محلی تازه است", needsConflictRecord: false, requiresAdjustment: false },
        action: "create_needed",
        messageFa: "برگه در سرور نیست؛ آن را از مسیر ثبت عادی ارسال کنید",
      }));
    }

    const verdict = resolveSyncConflict(
      {
        status: String(server.Status), revision: Number(server.Revision ?? 1),
        capturedAt: server.CapturedAt ?? null,
        hasForemanSignature: Boolean(server.ForemanSignatureRef),
      },
      {
        status: String(local.status ?? "draft"), revision: Number(local.revision ?? 1),
        capturedAt: local.capturedAt ?? null,
        hasForemanSignature: Boolean(local.foremanSignatureRef),
        deviceId: local.deviceId ?? null,
      }
    );

    let conflictId = null;
    if (verdict.needsConflictRecord) {
      const row = await r.create("HrmSyncConflict", {
        ProjectId: projectId, EntityType: "HrmTimesheetHeader", EntityId: id,
        DeviceId: local.deviceId ?? null,
        LocalRevision: Number(local.revision ?? 1),
        ServerRevision: Number(server.Revision ?? 1),
        LocalPayload: JSON.stringify(local).slice(0, 3900),
        ServerPayload: JSON.stringify({ Status: server.Status, Revision: server.Revision, TotalHoursRaw: server.TotalHoursRaw }).slice(0, 3900),
        DetectedAt: new Date().toISOString(),
        Resolution: verdict.winner === "server" ? "server_wins" : verdict.winner === "local" ? "local_wins" : "manual",
        DiffSummaryFa: verdict.ruleFa,
        RequiresAdjustment: verdict.requiresAdjustment,
        BlockReasonFa: verdict.requiresAdjustment ? verdict.ruleFa.slice(0, 300) : null,
        Status: verdict.requiresAdjustment ? "open" : "resolved",
      });
      conflictId = row?.Id ?? null;
    }

    res.json(hrmOk(req, {
      id, verdict, conflictId,
      serverStatus: String(server.Status),
      serverStatusFa: TS_STATE_FA[String(server.Status)] ?? String(server.Status),
      action: verdict.winner === "local" ? "apply_local" : verdict.winner === "server" ? "keep_server" : "noop",
      messageFa: verdict.ruleFa,
    }));
  } catch (err) { next(err); }
});

/** دفتر تعارض‌های باز. */
app.get("/api/hrm/conflicts", hrmRequire("hrm.conflict.resolve"), async (req, res, next) => {
  try {
    const projectId = hrmProjectOf(req, res);
    if (!projectId) return;
    const r = await repo();
    let items = await r.list("HrmSyncConflict", {
      where: [{ column: "ProjectId", op: "eq", value: projectId }], limit: 1000,
    });
    const status = String(req.query.status || "");
    if (status) items = items.filter((x) => String(x.Status) === status);
    items.sort((a, b) => String(b.DetectedAt).localeCompare(String(a.DetectedAt)));
    res.json(hrmOk(req, {
      items, count: items.length,
      openCount: items.filter((x) => String(x.Status) === "open").length,
    }));
  } catch (err) { next(err); }
});

/** ثبت سند اصلاحی — تنها راه تغییر دورهٔ بسته. */
app.post("/api/hrm/adjustments", hrmRequire("hrm.adjustment.raise"), async (req, res, next) => {
  try {
    const b = req.body ?? {};
    const projectId = String(b.projectId || "");
    if (!projectId) return hrmBad(req, res, "E-HRM-NO-PROJECT", "پارامتر projectId الزامی است");
    const entryId = String(b.originalEntryId || "");
    if (!entryId) return hrmBad(req, res, "E-HRM-ADJ-NO-ENTRY", "شناسهٔ ردیف اصلی الزامی است", 422);

    const r = await repo();
    const entry = (await r.list("HrmTimesheetEntry", {
      where: [{ column: "ProjectId", op: "eq", value: projectId }, { column: "Id", op: "eq", value: entryId }],
      limit: 1,
    }))[0] ?? null;
    if (!entry) return hrmBad(req, res, "E-HRM-ADJ-ENTRY-NOT-FOUND", "ردیف کارکرد پیدا نشد", 404);

    const priorAdj = await r.list("HrmAdjustment", {
      where: [{ column: "OriginalEntryId", op: "eq", value: entryId }], limit: 200,
    });
    const existingDelta = priorAdj
      .filter((a) => String(a.Status) === "approved")
      .reduce((s, a) => s + Number(a.DeltaHours ?? 0), 0);

    const issues = validateAdjustment(
      {
        adjustmentType: b.adjustmentType, deltaHours: b.deltaHours,
        reasonTextFa: b.reasonTextFa, newActivityId: b.newActivityId, newCbsId: b.newCbsId,
      },
      { originalHours: Number(entry.HoursRaw ?? 0), existingDelta }
    );
    if (hasBlockingIssue(issues)) return hrmInvalid(req, res, issues);

    const actor = hrmActor(req);
    const row = await r.create("HrmAdjustment", {
      ProjectId: projectId, OriginalEntryId: entryId,
      AdjustmentType: String(b.adjustmentType),
      DeltaHours: Number(b.deltaHours ?? 0),
      NewActivityId: b.newActivityId ?? null, NewCbsId: b.newCbsId ?? null,
      ReasonCode: b.reasonCode ?? null, ReasonTextFa: String(b.reasonTextFa),
      PeriodCode: periodOf(String(entry.WorkDate)),
      Status: "draft", PostedToFin: false,
    });

    res.status(201).json(hrmOk(req, {
      id: row?.Id ?? null,
      typeFa: ADJUSTMENT_TYPE_FA[String(b.adjustmentType)] ?? String(b.adjustmentType),
      originalHours: Number(entry.HoursRaw ?? 0),
      currentEffectiveHours: effectiveHours(Number(entry.HoursRaw ?? 0), priorAdj),
      projectedHours: Math.max(0, Math.round((Number(entry.HoursRaw ?? 0) + existingDelta + Number(b.deltaHours ?? 0)) * 100) / 100),
      messageFa: "سند اصلاحی در وضعیت پیش‌نویس ثبت شد و پس از تأیید اثر می‌گذارد",
      warnings: issues.filter((i) => i.severity === "warning"),
    }));
  } catch (err) { next(err); }
});

/** تأیید سند اصلاحی — دست دیگری غیر از نویسنده (SOD-18). */
app.post("/api/hrm/adjustments/:id/approve", hrmRequire("hrm.adjustment.approve"), async (req, res, next) => {
  try {
    const projectId = String(req.body?.projectId || req.query.projectId || "");
    if (!projectId) return hrmBad(req, res, "E-HRM-NO-PROJECT", "پارامتر projectId الزامی است");

    const r = await repo();
    const adj = (await r.list("HrmAdjustment", {
      where: [{ column: "ProjectId", op: "eq", value: projectId }, { column: "Id", op: "eq", value: String(req.params.id) }],
      limit: 1,
    }))[0] ?? null;
    if (!adj) return hrmBad(req, res, "E-HRM-ADJ-NOT-FOUND", "سند اصلاحی پیدا نشد", 404);
    if (String(adj.Status) === "approved") {
      return hrmBad(req, res, "E-HRM-ADJ-DONE", "این سند اصلاحی از پیش تأیید شده است", 409);
    }

    const actor = hrmActor(req);
    const now = new Date().toISOString();
    await r.patch("HrmAdjustment", adj.Id, { Status: "approved", ApprovedBy: actor, ApprovedAt: now }, actor);

    const entry = (await r.list("HrmTimesheetEntry", {
      where: [{ column: "Id", op: "eq", value: String(adj.OriginalEntryId) }], limit: 1,
    }))[0] ?? null;
    const allAdj = await r.list("HrmAdjustment", {
      where: [{ column: "OriginalEntryId", op: "eq", value: String(adj.OriginalEntryId) }], limit: 200,
    });


    res.json(hrmOk(req, {
      id: adj.Id, approvedBy: actor, approvedAt: now,
      originalHours: Number(entry?.HoursRaw ?? 0),
      effectiveHours: effectiveHours(Number(entry?.HoursRaw ?? 0), allAdj),
      messageFa: "سند اصلاحی تأیید شد و ساعت مؤثر ردیف به‌روز شد",
    }));
  } catch (err) { next(err); }
});

/** فهرست اسناد اصلاحی. */
app.get("/api/hrm/adjustments", hrmRequire("hrm.roster.view"), async (req, res, next) => {
  try {
    const projectId = hrmProjectOf(req, res);
    if (!projectId) return;
    const r = await repo();
    let items = await r.list("HrmAdjustment", {
      where: [{ column: "ProjectId", op: "eq", value: projectId }], limit: 1000,
    });
    const periodCode = String(req.query.periodCode || "");
    if (periodCode) items = items.filter((x) => String(x.PeriodCode) === periodCode);
    res.json(hrmOk(req, {
      items: items.map((x) => ({ ...x, typeFa: ADJUSTMENT_TYPE_FA[String(x.AdjustmentType)] ?? String(x.AdjustmentType) })),
      count: items.length,
      pendingCount: items.filter((x) => String(x.Status) === "draft").length,
    }));
  } catch (err) { next(err); }
});

/* ═══════════════ ماژول نیروی انسانی — بهره‌وری (D5) ═══════════════
 *
 * D4 ساعت را جمع کرد؛ اینجا از آن ساعت شاخص ساخته می‌شود.
 *
 * سه قاعدهٔ ثابت این بخش:
 *   ۱) ارزش کسب‌شده فقط از پیشرفت تأییدشده می‌آید (`plan.progress.approve`
 *      روی فعالیت خورده باشد)، وگرنه فعالیت اصلاً وارد محاسبه نمی‌شود.
 *   ۲) ساعت واقعی فقط از برگه‌های `pm_approved` و بالاتر می‌آید؛ برگهٔ
 *      پیش‌نویس نباید شاخص را جابه‌جا کند.
 *   ۳) عدد نهایی‌شده تغییر نمی‌کند — بازمحاسبه روی دورهٔ قفل‌شده ۴۰۹.
 */

/** رتبهٔ حداقلی برگه برای ورود به بهره‌وری — همان مبنای هزینه. */
const HRM_PROD_MIN_RANK = TS_STATE_RANK.pm_approved;

/** فعالیت‌های پروژه با بودجهٔ نفر-ساعت و پیشرفت تأییدشده. */
async function hrmActivitiesOf(r, projectId, activityIds) {
  const rows = await r.list("Activity", {
    where: [{ column: "ProjectId", op: "eq", value: projectId }],
    limit: 5000,
  });
  const want = activityIds ? new Set(activityIds.map(String)) : null;
  return rows.filter((a) => !want || want.has(String(a.Id)) || want.has(String(a.Code)));
}

/**
 * ردیف‌های کارکرد یک دوره که اجازهٔ ورود به بهره‌وری دارند.
 *
 * فیلتر روی سربرگ انجام می‌شود نه ردیف: وضعیت تأیید صفت برگه است،
 * و اگر ردیف به ردیف نگاه می‌کردیم، ردیف یک برگهٔ پیش‌نویس هم وارد
 * شاخص می‌شد.
 */
async function hrmApprovedEntries(r, projectId, periodCode) {
  const headers = await r.list("HrmTimesheetHeader", {
    where: [{ column: "ProjectId", op: "eq", value: projectId }],
    limit: 5000,
  });
  const inPeriod = headers.filter((h) => periodOf(String(h.WorkDate)) === periodCode);
  const approved = inPeriod.filter((h) => (TS_STATE_RANK[String(h.Status)] ?? -1) >= HRM_PROD_MIN_RANK);
  const pending = inPeriod.length - approved.length;
  if (approved.length === 0) return { entries: [], headerCount: inPeriod.length, approvedCount: 0, pending, otPct: null };

  const ids = approved.map((h) => String(h.Id));
  const raw = await r.list("HrmTimesheetEntry", {
    where: [{ column: "HeaderId", op: "in", value: ids }],
    limit: 40000,
  });
  const entries = raw.filter((e) => !e.VoidedAt);

  let totalRaw = 0, totalOt = 0;
  for (const h of approved) {
    totalRaw += Number(h.TotalHoursRaw ?? 0);
    totalOt += Number(h.TotalHoursOt ?? 0);
  }
  return {
    entries,
    headerCount: inPeriod.length,
    approvedCount: approved.length,
    pending,
    otPct: totalRaw > 0 ? Math.round((totalOt / totalRaw) * 10000) / 100 : null,
  };
}

/** ریشه‌یابی‌های ثبت‌شدهٔ یک دوره. */
async function hrmRcaOf(r, projectId, periodCode) {
  const rows = await r.list("HrmRcaEntry", {
    where: [{ column: "ProjectId", op: "eq", value: projectId }],
    limit: 5000,
  });
  return periodCode ? rows.filter((x) => String(x.PeriodCode) === periodCode) : rows;
}

/** آیا متریک این دوره قفل شده است؟ */
async function hrmPeriodFinal(r, projectId, periodCode) {
  const snaps = await r.list("HrmMetricSnapshot", {
    where: [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "PeriodCode", op: "eq", value: periodCode },
    ],
    limit: 500,
  });
  return { snaps, isFinal: snaps.some((s) => s.IsFinal === true || s.IsFinal === 1) };
}

/**
 * ساخت نمای کامل بهره‌وری یک دوره از داده خام.
 *
 * یک تابع، تا مسیرهای «مشاهده»، «محاسبه» و «نهایی‌سازی» هرگز سه عدد
 * متفاوت ندهند — همان درسی که در D4 با بازسازی همیشگی جمع‌ها گرفته شد.
 */
async function hrmBuildProductivity(r, projectId, periodCode) {
  const [{ entries, headerCount, approvedCount, pending, otPct }, rcaRows, prior] = await Promise.all([
    hrmApprovedEntries(r, projectId, periodCode),
    hrmRcaOf(r, projectId, periodCode),
    r.list("HrmProductivityLog", { where: [{ column: "ProjectId", op: "eq", value: projectId }], limit: 5000 }),
  ]);

  const actIds = [...new Set(entries.map((e) => String(e.ActivityId)).filter(Boolean))];
  const activities = await hrmActivitiesOf(r, projectId, actIds);
  const actByKey = new Map();
  for (const a of activities) {
    actByKey.set(String(a.Id), a);
    if (a.Code) actByKey.set(String(a.Code), a);
  }

  /* PI دورهٔ قبل برای روند. مقایسه رشته‌ای کافی است چون کد دوره
   * قالب مرتب‌شدنی `YYYY-MM` دارد. */
  const priorPi = {};
  for (const p of prior) {
    if (String(p.PeriodCode) >= periodCode) continue;
    const k = String(p.ActivityId);
    if (!priorPi[`${k}@`] || String(p.PeriodCode) > priorPi[`${k}@`]) {
      priorPi[`${k}@`] = String(p.PeriodCode);
      priorPi[k] = Number(p.Pi ?? 0);
    }
  }
  for (const k of Object.keys(priorPi)) if (k.endsWith("@")) delete priorPi[k];

  const inputs = actIds.map((id) => {
    const a = actByKey.get(id);
    const rows = entries.filter((e) => String(e.ActivityId) === id);
    return {
      activityId: id,
      /* بودجهٔ نفر-ساعت در جدول فعالیت نیست؛ اگر نبود، صفر می‌ماند و
       * PI صفر می‌شود که همان «نامشخص» است — نه یک عدد ساختگی. */
      budgetMh: Number(a?.BudgetMh ?? a?.BudgetManHours ?? 0),
      approvedProgressPct: Number(a?.PhysicalPct ?? 0),
      tradeCode: rows.find((e) => e.TradeCode)?.TradeCode,
      cbsId: rows.find((e) => e.CbsId)?.CbsId,
      qtyUom: rows.find((e) => e.QtyUom)?.QtyUom,
    };
  });

  const rows = computeProductivity(
    inputs,
    entries.map((e) => ({
      activityId: String(e.ActivityId),
      tradeCode: e.TradeCode ? String(e.TradeCode) : undefined,
      cbsId: e.CbsId ? String(e.CbsId) : undefined,
      hoursRaw: Number(e.HoursRaw ?? 0),
      isProductive: e.IsProductive === true || e.IsProductive === 1,
      qtyDone: e.QtyDone === null || e.QtyDone === undefined ? undefined : Number(e.QtyDone),
      qtyUom: e.QtyUom ? String(e.QtyUom) : undefined,
    })),
    periodCode,
    { priorPi }
  );

  const explained = [...new Set(rcaRows.map((x) => String(x.ActivityId)))];
  const summary = productivitySummary(rows, explained);
  const byTrade = productivityByTrade(rows);
  const { isFinal } = await hrmPeriodFinal(r, projectId, periodCode);

  return {
    rows, summary, byTrade, rcaRows, otPct, isFinal,
    timesheet: { headerCount, approvedCount, pending },
    activityNames: Object.fromEntries(activities.map((a) => [String(a.Id), String(a.NameFa ?? a.Code ?? a.Id)])),
  };
}

/** کاتالوگ ثابت‌های بهره‌وری — UI فهرست علت‌ها را از اینجا می‌سازد. */
app.get("/api/hrm/rca-catalog", hrmRequire("hrm.productivity.view"), (req, res) => {
  res.json(hrmOk(req, {
    reasons: RCA_CATALOG.map((x) => ({ ...x, categoryFa: RCA_CATEGORY_FA[x.category] })),
    categories: RCA_CATEGORIES.map((c) => ({ code: c, fa: RCA_CATEGORY_FA[c] })),
    metrics: METRIC_CODES.map((c) => ({ code: c, fa: METRIC_FA[c] })),
    piThreshold: PI_THRESHOLD,
    calibrationMinPeriods: CALIBRATION_MIN_PERIODS,
  }));
});

/** نمای بهره‌وری یک دوره — خواندنی محض، هیچ چیزی ذخیره نمی‌شود. */
app.get("/api/hrm/productivity", hrmRequire("hrm.productivity.view"), async (req, res, next) => {
  try {
    const projectId = hrmProjectOf(req, res);
    if (!projectId) return;
    const periodCode = String(req.query.periodCode || "");
    if (!periodCode) return hrmBad(req, res, "E-HRM-NO-PERIOD", "پارامتر periodCode الزامی است");

    const r = await repo();
    const v = await hrmBuildProductivity(r, projectId, periodCode);

    res.json(hrmOk(req, {
      periodCode,
      items: v.rows.map((x) => ({ ...x, activityNameFa: v.activityNames[x.activityId] ?? x.activityId })),
      summary: v.summary,
      byTrade: v.byTrade,
      otPct: v.otPct,
      isFinal: v.isFinal,
      timesheet: v.timesheet,
      /* عدد بدون این پرچم گمراه‌کننده است: اگر برگهٔ تأییدنشده مانده
       * باشد، شاخص کامل نیست حتی اگر سبز نشان بدهد. */
      isComplete: v.timesheet.pending === 0,
    }));
  } catch (err) { next(err); }
});

/**
 * اجرای محاسبه و ذخیرهٔ سیاهه.
 *
 * ایدمپوتنت: هش ورودی یکسان ⇒ ردیف دست نمی‌خورد و `unchanged` شمرده
 * می‌شود. بدون این، هر بار زدن دکمه، `ComputedAt` عوض می‌شد و ممیز
 * فکر می‌کرد عدد تغییر کرده است.
 */
app.post("/api/hrm/productivity/compute", hrmRequire("hrm.productivity.compute"), async (req, res, next) => {
  try {
    const projectId = hrmProjectOf(req, res);
    if (!projectId) return;
    const periodCode = String(req.body?.periodCode || "");
    if (!periodCode) return hrmBad(req, res, "E-HRM-NO-PERIOD", "پارامتر periodCode الزامی است");

    const r = await repo();
    const { isFinal } = await hrmPeriodFinal(r, projectId, periodCode);
    if (isFinal) {
      return hrmBad(req, res, "E-HRM-153", `متریک دورهٔ ${periodCode} نهایی شده و بازمحاسبه نمی‌شود`, 409);
    }

    const v = await hrmBuildProductivity(r, projectId, periodCode);
    if (v.rows.length === 0) {
      return hrmBad(req, res, "E-HRM-151", "در این دوره برگهٔ کارکرد تأییدشده‌ای نیست", 422);
    }

    const actor = hrmActor(req);
    const now = new Date().toISOString();
    const existing = await r.list("HrmProductivityLog", {
      where: [
        { column: "ProjectId", op: "eq", value: projectId },
        { column: "PeriodCode", op: "eq", value: periodCode },
      ],
      limit: 5000,
    });
    const byActivity = new Map(existing.map((x) => [String(x.ActivityId), x]));

    let created = 0, updated = 0, unchanged = 0;
    for (const row of v.rows) {
      const payload = {
        ProjectId: projectId,
        ActivityId: row.activityId,
        PeriodCode: periodCode,
        TradeCode: row.tradeCode ?? null,
        CbsId: row.cbsId ?? null,
        BudgetMh: row.budgetMh,
        EarnedMh: row.earnedMh,
        ActualMh: row.actualMh,
        ApprovedProgressPct: row.approvedProgressPct,
        Pi: row.pi,
        Pf: row.pf,
        QtyDone: row.qtyDone ?? null,
        QtyUom: row.qtyUom ?? null,
        UnitRate: row.unitRate ?? null,
        StdRate: row.stdRate ?? null,
        VariancePct: row.variancePct ?? null,
        Trend: row.trend,
        Status: row.status,
        LostMh: row.lostMh,
        IsCalibrated: row.isCalibrated,
        ComputedAt: now,
        InputHash: row.inputHash,
        IsFinal: false,
      };
      const prev = byActivity.get(row.activityId);
      if (!prev) {
        await r.create("HrmProductivityLog", payload, actor, "PRD");
        created++;
      } else if (String(prev.InputHash) === row.inputHash) {
        unchanged++;
      } else {
        await r.patch("HrmProductivityLog", prev.Id, payload, actor);
        updated++;
      }
    }

    res.status(201).json(hrmOk(req, {
      periodCode,
      created, updated, unchanged,
      summary: v.summary,
      messageFa: `محاسبهٔ بهره‌وری دورهٔ ${periodCode} انجام شد (${created} جدید، ${updated} به‌روز، ${unchanged} بدون تغییر)`,
    }));
  } catch (err) { next(err); }
});

/** فهرست ریشه‌یابی‌های ثبت‌شده. */
app.get("/api/hrm/rca", hrmRequire("hrm.productivity.view"), async (req, res, next) => {
  try {
    const projectId = hrmProjectOf(req, res);
    if (!projectId) return;
    const r = await repo();
    let items = await hrmRcaOf(r, projectId, String(req.query.periodCode || ""));
    const activityId = String(req.query.activityId || "");
    if (activityId) items = items.filter((x) => String(x.ActivityId) === activityId);
    const status = String(req.query.status || "");
    if (status) items = items.filter((x) => String(x.Status) === status);

    res.json(hrmOk(req, {
      items: items.map((x) => {
        const reason = RCA_BY_CODE[String(x.ReasonCode)];
        return {
          ...x,
          reasonFa: reason?.fa ?? String(x.ReasonCode),
          categoryFa: reason ? RCA_CATEGORY_FA[reason.category] : null,
          isClaimable: reason?.isClaimable ?? false,
          claimEligible: canRaiseClaim(x).ok,
        };
      }),
      count: items.length,
      rollup: rcaRollup(items),
      claimedCount: items.filter((x) => x.ClaimRef).length,
    }));
  } catch (err) { next(err); }
});

/** ثبت علت افت. */
app.post("/api/hrm/rca", hrmRequire("hrm.rca.record"), async (req, res, next) => {
  try {
    const projectId = hrmProjectOf(req, res);
    if (!projectId) return;
    const b = req.body ?? {};
    const activityId = String(b.activityId || "");
    const periodCode = String(b.periodCode || "");

    const r = await repo();
    /* سهم ثبت‌شدهٔ قبلی همان فعالیت-دوره، تا جمع از ۱۰۰٪ رد نشود. */
    const siblings = (await hrmRcaOf(r, projectId, periodCode))
      .filter((x) => String(x.ActivityId) === activityId && String(x.Status) !== "void");
    const existingShare = siblings.reduce((s, x) => s + Number(x.SharePct ?? 0), 0);

    const issues = validateRca(
      { activityId, periodCode, reasonCode: String(b.reasonCode || ""), sharePct: b.sharePct, lostMh: b.lostMh, noteFa: b.noteFa },
      existingShare
    );
    if (issues.length) return hrmInvalid(req, res, issues);

    /* دورهٔ نهایی‌شده ریشه‌یابی جدید نمی‌پذیرد: عددش قفل شده و
     * افزودن علت، پوشش ریشه‌یابی گزارش‌شده را عقب‌گرد می‌کند. */
    const { isFinal } = await hrmPeriodFinal(r, projectId, periodCode);
    if (isFinal) return hrmBad(req, res, "E-HRM-153", `دورهٔ ${periodCode} نهایی شده است`, 409);

    const actor = hrmActor(req);
    const row = await r.create("HrmRcaEntry", {
      ProjectId: projectId,
      ActivityId: activityId,
      PeriodCode: periodCode,
      ReasonCode: String(b.reasonCode),
      SharePct: b.sharePct === undefined ? 100 : Number(b.sharePct),
      LostMh: Number(b.lostMh ?? 0),
      EstimatedCost: b.estimatedCost === undefined ? null : Number(b.estimatedCost),
      NoteFa: String(b.noteFa).trim(),
      RaisedBy: actor,
      RaisedAt: new Date().toISOString(),
      ClaimRef: null,
      ClaimedAt: null,
      Status: "open",
    }, actor, "RCA");

    const reason = RCA_BY_CODE[String(b.reasonCode)];
    res.status(201).json(hrmOk(req, {
      id: row.Id,
      isClaimable: reason?.isClaimable ?? false,
      remainingSharePct: Math.round((100 - existingShare - Number(row.SharePct ?? 0)) * 100) / 100,
      messageFa: reason?.isClaimable
        ? `علت «${reason.fa}» ثبت شد و ادعاپذیر است`
        : `علت «${reason?.fa ?? b.reasonCode}» ثبت شد؛ این علت مبنای ادعای قراردادی نیست`,
    }));
  } catch (err) { next(err); }
});

/**
 * پیوند علت افت به ادعا.
 *
 * جدا از ثبت علت نگه داشته شده و مجوز سطح سری می‌خواهد (SOD-20):
 * تبدیل یک رویداد کارگاهی به مطالبهٔ مالی، تصمیم دفتر پیمان است.
 */
app.post("/api/hrm/rca/:id/claim", hrmRequire("hrm.claim.link"), async (req, res, next) => {
  try {
    const projectId = hrmProjectOf(req, res);
    if (!projectId) return;
    const r = await repo();
    const row = await r.findOne("HrmRcaEntry", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "Id", op: "eq", value: String(req.params.id) },
    ]);
    if (!row) return hrmBad(req, res, "E-HRM-RCA-NOT-FOUND", "ثبت ریشه‌یابی پیدا نشد", 404);

    const claimRef = String(req.body?.claimRef || "").trim();
    if (claimRef.length < 3) {
      return hrmBad(req, res, "E-HRM-154", "شمارهٔ ادعا الزامی است", 422);
    }

    const gate = canRaiseClaim(row);
    if (!gate.ok) return hrmBad(req, res, gate.code, gate.messageFa, 422);

    const actor = hrmActor(req);
    await r.patch("HrmRcaEntry", row.Id, {
      ClaimRef: claimRef,
      ClaimedAt: new Date().toISOString(),
      Status: "claimed",
    }, actor);

    res.json(hrmOk(req, {
      id: row.Id,
      claimRef,
      lostMh: Number(row.LostMh ?? 0),
      messageFa: `${Number(row.LostMh ?? 0)} نفر-ساعت به ادعای ${claimRef} پیوند خورد`,
    }));
  } catch (err) { next(err); }
});

/** نرخ استاندارد کالیبره‌شده از دادهٔ واقعی (H-15). */
app.get("/api/hrm/rates/calibration", hrmRequire("hrm.productivity.view"), async (req, res, next) => {
  try {
    const projectId = hrmProjectOf(req, res);
    if (!projectId) return;
    const r = await repo();
    const logs = await r.list("HrmProductivityLog", {
      where: [{ column: "ProjectId", op: "eq", value: projectId }],
      limit: 10000,
    });
    const obs = logs
      .filter((x) => Number(x.QtyDone ?? 0) > 0 && Number(x.ActualMh ?? 0) > 0)
      .map((x) => ({
        tradeCode: String(x.TradeCode ?? ""),
        periodCode: String(x.PeriodCode),
        qty: Number(x.QtyDone),
        hours: Number(x.ActualMh),
      }));
    const items = calibrateStdRate(obs);
    res.json(hrmOk(req, {
      items,
      count: items.length,
      calibratedCount: items.filter((x) => x.isCalibrated).length,
      minPeriods: CALIBRATION_MIN_PERIODS,
      /* بدون این پیام، کاربر نرخ کاتالوگ را نرخ واقعی پروژه می‌پندارد. */
      noteFa: `نرخ رسته‌های کالیبره‌نشده از کاتالوگ مرجع می‌آید و هنوز با دادهٔ این پروژه تأیید نشده است (حداقل ${CALIBRATION_MIN_PERIODS} دوره لازم است)`,
    }));
  } catch (err) { next(err); }
});

/** عکس‌های متریک یک دوره. */
app.get("/api/hrm/metrics", hrmRequire("hrm.productivity.view"), async (req, res, next) => {
  try {
    const projectId = hrmProjectOf(req, res);
    if (!projectId) return;
    const periodCode = String(req.query.periodCode || "");
    const r = await repo();
    let items = await r.list("HrmMetricSnapshot", {
      where: [{ column: "ProjectId", op: "eq", value: projectId }],
      limit: 5000,
    });
    if (periodCode) items = items.filter((x) => String(x.PeriodCode) === periodCode);
    const metricCode = String(req.query.metricCode || "");
    if (metricCode) items = items.filter((x) => String(x.MetricCode) === metricCode);

    res.json(hrmOk(req, {
      items: items.map((x) => ({ ...x, metricFa: METRIC_FA[String(x.MetricCode)] ?? String(x.MetricCode) })),
      count: items.length,
      finalCount: items.filter((x) => x.IsFinal === true || x.IsFinal === 1).length,
    }));
  } catch (err) { next(err); }
});

/**
 * نهایی‌سازی متریک دوره.
 *
 * برگشت‌ناپذیر است، پس چهار دروازهٔ موتور پیش از آن اجرا می‌شود.
 * هرچه اینجا رد شود، در گزارش رسمی به کارفرما ظاهر نمی‌شود.
 */
app.post("/api/hrm/metrics/finalize", hrmRequire("hrm.metric.finalize"), async (req, res, next) => {
  try {
    const projectId = hrmProjectOf(req, res);
    if (!projectId) return;
    const periodCode = String(req.body?.periodCode || "");
    if (!periodCode) return hrmBad(req, res, "E-HRM-NO-PERIOD", "پارامتر periodCode الزامی است");

    const r = await repo();
    const v = await hrmBuildProductivity(r, projectId, periodCode);
    const gate = canFinalizeProductivity({
      rows: v.rows,
      summary: v.summary,
      alreadyFinal: v.isFinal,
      timesheetPending: v.timesheet.pending,
    });
    if (!gate.ok) {
      return hrmBad(req, res, gate.code, gate.messageFa, gate.code === "E-HRM-150" ? 409 : 422, gate.detailsFa);
    }

    const actor = hrmActor(req);
    const now = new Date().toISOString();
    const snaps = hrmBuildMetricSnapshots(v.summary, v.byTrade, { otPct: v.otPct });
    const { snaps: existing } = await hrmPeriodFinal(r, projectId, periodCode);
    const keyOf = (s) => `${s.MetricCode ?? s.metricCode}|${s.Dimension ?? s.dimension}|${s.DimensionId ?? s.dimensionId ?? ""}`;
    const byKey = new Map(existing.map((s) => [keyOf(s), s]));

    let written = 0;
    for (const s of snaps) {
      const payload = {
        ProjectId: projectId,
        PeriodCode: periodCode,
        MetricCode: s.metricCode,
        Dimension: s.dimension,
        DimensionId: s.dimensionId,
        Value: s.value,
        Target: s.target,
        Status: s.status,
        ComputedAt: now,
        InputHash: s.inputHash,
        IsFinal: true,
      };
      const prev = byKey.get(keyOf(s));
      if (prev) {
        /* محافظ دوم روی ADR-11: حتی اگر منطق بالا دور زده شود،
         * ردیف نهایی‌شده بازنویسی نمی‌شود. */
        if (!canOverwriteSnapshot(prev)) continue;
        await r.patch("HrmMetricSnapshot", prev.Id, payload, actor);
      } else {
        await r.create("HrmMetricSnapshot", payload, actor, "MSN");
      }
      written++;
    }

    /* سیاههٔ بهره‌وری همان دوره هم قفل می‌شود تا عدد پشت متریک
     * نتواند بی‌سروصدا عوض شود. */
    const logs = await r.list("HrmProductivityLog", {
      where: [
        { column: "ProjectId", op: "eq", value: projectId },
        { column: "PeriodCode", op: "eq", value: periodCode },
      ],
      limit: 5000,
    });
    for (const l of logs) {
      if (l.IsFinal === true || l.IsFinal === 1) continue;
      await r.patch("HrmProductivityLog", l.Id, { IsFinal: true }, actor);
    }

    res.json(hrmOk(req, {
      periodCode,
      snapshotCount: written,
      lockedLogCount: logs.length,
      pi: v.summary.pi,
      messageFa: `متریک دورهٔ ${periodCode} نهایی و تغییرناپذیر شد (${written} شاخص)`,
    }));
  } catch (err) { next(err); }
});


/* ════════════════════════════ HRM D6 — اکیپ و نیروی پیمانکاری ════════════════════════════
 *
 * دو مسیر موازی و عمداً جدا:
 *   /crews/*        → نیروی مستقیم، عضویت، ترکیب، نرخ استفاده
 *   /subcontracts/* → قرارداد پیمانکاری، حضور گروهی، صورت‌کارکرد
 *
 * تنها جایی که این دو به هم می‌رسند `assertNoDoubleCount` است: پیش از
 * ثبت هر حضور گروهی بررسی می‌شود که همان نفرات آن روز برگهٔ فردی
 * نداشته باشند. بدون آن دروازه، نفر-ساعت دوبار وارد هزینه می‌شد.
 */

/** اکیپ‌های یک پروژه. */
async function hrmCrewsOf(r, projectId) {
  return r.list("HrmCrew", {
    where: [{ column: "ProjectId", op: "eq", value: projectId }],
    limit: 500,
  });
}

/** اعضای یک یا همهٔ اکیپ‌های پروژه، به شکل ورودی موتور. */
async function hrmMembersOf(r, projectId, crewId) {
  const where = [{ column: "ProjectId", op: "eq", value: projectId }];
  if (crewId) where.push({ column: "CrewId", op: "eq", value: crewId });
  const rows = await r.list("HrmCrewMember", { where, limit: 5000 });
  return rows.map((m) => ({
    id: String(m.Id),
    crewId: String(m.CrewId),
    personId: String(m.PersonId),
    roleInCrew: String(m.RoleInCrew ?? "skilled"),
    tradeCode: m.TradeCode ? String(m.TradeCode) : undefined,
    grade: m.Grade ?? null,
    fromDate: String(m.FromDate ?? ""),
    toDate: m.ToDate ? String(m.ToDate) : null,
    allocationPct: Number(m.AllocationPct ?? 100),
    status: String(m.Status ?? "active"),
  }));
}

/** قرارداد پیمانکاری با کنترل تعلق به پروژه — پروژهٔ دیگر یعنی ۴۰۴. */
async function hrmSubContract(r, projectId, id) {
  return r.findOne("HrmSubContract", [
    { column: "ProjectId", op: "eq", value: projectId },
    { column: "Id", op: "eq", value: String(id) },
  ]);
}

/** حضور گروهی یک قرارداد، در صورت نیاز محدود به یک دوره. */
async function hrmSubAttOf(r, projectId, subContractId, periodCode) {
  const rows = await r.list("HrmSubAttendance", {
    where: [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "SubContractId", op: "eq", value: String(subContractId) },
    ],
    limit: 5000,
  });
  if (!periodCode) return rows;
  return rows.filter((x) => periodOf(String(x.WorkDate ?? "")) === periodCode);
}

/*
 * چرا اینجا ماسک مبلغ نداریم؟
 *
 * در D4 مبلغ دستمزد پشت `hrm.rate.view` ماسک می‌شد چون همان مسیر با
 * مجوز عمومی‌تری (`hrm.productivity.view`) هم باز بود. اینجا خودِ
 * دروازهٔ مسیر `hrm.sub.view` است — سطح «محرمانه» و جدا از ثبت حضور.
 * افزودن ماسک دوم روی مسیری که فقط دارندگان همان مجوز به آن می‌رسند
 * نمایش امنیت است نه امنیت، و کد مرده تولید می‌کند. مرز واقعی این
 * است: کارگاه (`hrm.sub.record`) حضور را ثبت می‌کند ولی نرخ قرارداد
 * را نمی‌بیند، چون `hrm.sub.view` را ندارد.
 */

/** کاتالوگ ثابت‌های اکیپ و پیمانکاری. */
app.get("/api/hrm/crew-meta", hrmRequire("hrm.crew.view"), (req, res) => {
  res.json(hrmOk(req, {
    crewRoles: CREW_ROLES.map((c) => ({ code: c, fa: CREW_ROLE_FA[c] })),
    crewStatuses: CREW_STATUSES.map((c) => ({ code: c, fa: CREW_STATUS_FA[c] })),
    pricingModels: PRICING_MODELS.map((c) => ({ code: c, fa: PRICING_MODEL_FA[c] })),
    subAttStates: SUB_ATT_STATES.map((c) => ({ code: c, fa: SUB_ATT_STATE_FA[c] })),
    skillRatio: CREW_SKILL_RATIO,
    maxSpan: CREW_MAX_SPAN,
  }));
});

/**
 * تابلوی اکیپ‌ها: ترکیب امروز کنار نرخ استفادهٔ دوره.
 *
 * دو نسبت جدا برمی‌گردد (حضور و بهره‌وری) چون یک عدد ترکیبی تفاوت
 * «نیامدند» و «آمدند ولی جبهه نبود» را پنهان می‌کند.
 */
app.get("/api/hrm/crews", hrmRequire("hrm.crew.view"), async (req, res, next) => {
  try {
    const projectId = hrmProjectOf(req, res);
    if (!projectId) return;
    const onDate = String(req.query.onDate || new Date().toISOString().slice(0, 10));
    const periodCode = String(req.query.periodCode || periodOf(onDate));
    const workingDays = Number(req.query.workingDays ?? 0);

    const r = await repo();
    const crews = await hrmCrewsOf(r, projectId);
    const members = await hrmMembersOf(r, projectId);

    /* ساعت ثبت‌شده از برگه‌های همان دوره؛ برگهٔ باطل کنار می‌رود. */
    const headers = (await r.list("HrmTimesheetHeader", {
      where: [{ column: "ProjectId", op: "eq", value: projectId }],
      limit: 5000,
    })).filter((h) => periodOf(String(h.WorkDate ?? "")) === periodCode);
    const headerCrew = new Map(headers.map((h) => [String(h.Id), String(h.CrewId ?? "")]));
    const directEntries = (await r.list("HrmTimesheetEntry", {
      where: [{ column: "ProjectId", op: "eq", value: projectId }],
      limit: 20000,
    }))
      .filter((e) => !e.VoidedAt && headerCrew.has(String(e.HeaderId)))
      .map((e) => ({ CrewId: headerCrew.get(String(e.HeaderId)), HoursRaw: e.HoursRaw, IsProductive: e.IsProductive }));

    /*
     * ساعت اکیپ پیمانکاری در دفتر دیگری است.
     *
     * بدون این بلوک، اکیپی که با حضور گروهی کار می‌کند در تابلو ۰٪ و
     * «قرمز» دیده می‌شد — یعنی دقیقاً برعکس واقعیت. دو دفتر جدا
     * نگه داشته شده‌اند تا نفر-ساعت دوبار شمرده نشود، ولی نمای
     * مدیریتی باید هر دو را ببیند وگرنه هشدار کاذب تولید می‌کند.
     * ردیف رد‌شده کنار می‌رود؛ ردیف پیش‌نویس می‌ماند چون کار انجام
     * شده و فقط امضایش نرسیده است.
     */
    const subEntries = (await r.list("HrmSubAttendance", {
      where: [{ column: "ProjectId", op: "eq", value: projectId }],
      limit: 20000,
    }))
      .filter((x) => x.CrewId
        && String(x.Status ?? "") !== "rejected"
        && periodOf(String(x.WorkDate ?? "")) === periodCode)
      .map((x) => ({ CrewId: String(x.CrewId), HoursRaw: Number(x.TotalHours ?? 0), IsProductive: true }));

    const util = crewUtilization(crews, members, [...directEntries, ...subEntries], { workingDays, dateIso: onDate });
    const utilById = new Map(util.map((u) => [u.crewId, u]));

    res.json(hrmOk(req, {
      onDate,
      periodCode,
      workingDays,
      items: crews.map((c) => {
        const mine = members.filter((m) => m.crewId === String(c.Id));
        const comp = crewComposition(mine, onDate, {
          size: Number(c.TargetSize ?? 0) || undefined,
          mix: c.TargetMix ? (typeof c.TargetMix === "string" ? JSON.parse(c.TargetMix) : c.TargetMix) : undefined,
        });
        const u = utilById.get(String(c.Id));
        return {
          id: c.Id,
          code: c.Code,
          nameFa: c.NameFa,
          obsNodeId: c.ObsNodeId ?? null,
          foremanPersonId: c.ForemanPersonId ?? null,
          primaryTradeCode: c.PrimaryTradeCode,
          shiftCode: c.ShiftCode ?? null,
          isSubcontracted: c.IsSubcontracted === true || c.IsSubcontracted === 1,
          subContractId: c.SubContractId ?? null,
          status: c.Status,
          statusFa: CREW_STATUS_FA[String(c.Status)] ?? c.Status,
          targetSize: Number(c.TargetSize ?? 0),
          composition: comp,
          utilization: u ?? null,
        };
      }),
      summary: crewBoardSummary(util),
      /* بدون روز کاری، ساعت در دسترس صفر است و نرخ استفاده معنا
       * ندارد؛ UI باید این را بگوید نه اینکه صفر نشان بدهد. */
      utilizationAvailable: workingDays > 0,
    }));
  } catch (err) { next(err); }
});

/** یک اکیپ با اعضا و ترکیب آن در تاریخ خواسته‌شده. */
app.get("/api/hrm/crews/:id", hrmRequire("hrm.crew.view"), async (req, res, next) => {
  try {
    const projectId = hrmProjectOf(req, res);
    if (!projectId) return;
    const onDate = String(req.query.onDate || new Date().toISOString().slice(0, 10));

    const r = await repo();
    const crew = await r.findOne("HrmCrew", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "Id", op: "eq", value: String(req.params.id) },
    ]);
    if (!crew) return hrmBad(req, res, "E-HRM-CREW-NOT-FOUND", "اکیپ پیدا نشد", 404);

    const members = await hrmMembersOf(r, projectId, String(crew.Id));
    const comp = crewComposition(members, onDate, {
      size: Number(crew.TargetSize ?? 0) || undefined,
      mix: crew.TargetMix ? (typeof crew.TargetMix === "string" ? JSON.parse(crew.TargetMix) : crew.TargetMix) : undefined,
    });

    res.json(hrmOk(req, {
      id: crew.Id,
      code: crew.Code,
      nameFa: crew.NameFa,
      status: crew.Status,
      statusFa: CREW_STATUS_FA[String(crew.Status)] ?? crew.Status,
      primaryTradeCode: crew.PrimaryTradeCode,
      foremanPersonId: crew.ForemanPersonId ?? null,
      obsNodeId: crew.ObsNodeId ?? null,
      defaultCbsId: crew.DefaultCbsId ?? null,
      isSubcontracted: crew.IsSubcontracted === true || crew.IsSubcontracted === 1,
      subContractId: crew.SubContractId ?? null,
      disbandedAt: crew.DisbandedAt ?? null,
      disbandReasonFa: crew.DisbandReasonFa ?? null,
      onDate,
      members: members.map((m) => ({ ...m, roleFa: CREW_ROLE_FA[m.roleInCrew] ?? m.roleInCrew, isActiveOn: isMemberActiveOn(m, onDate) })),
      composition: comp,
    }));
  } catch (err) { next(err); }
});

/** ساخت اکیپ. اکیپ تازه همیشه `forming` است — فعال شدن دروازهٔ جدا دارد. */
app.post("/api/hrm/crews", hrmRequire("hrm.crew.manage"), async (req, res, next) => {
  try {
    const projectId = hrmProjectOf(req, res);
    if (!projectId) return;
    const b = req.body ?? {};
    const code = String(b.code || "").trim();
    const nameFa = String(b.nameFa || "").trim();
    const trade = String(b.primaryTradeCode || "").trim();

    const issues = [];
    if (code.length < 2) issues.push({ code: "E-HRM-161", severity: "error", field: "code", messageFa: "کد اکیپ الزامی است" });
    if (nameFa.length < 2) issues.push({ code: "E-HRM-161", severity: "error", field: "nameFa", messageFa: "نام اکیپ الزامی است" });
    if (!trade) issues.push({ code: "E-HRM-161", severity: "error", field: "primaryTradeCode", messageFa: "رستهٔ اصلی الزامی است" });
    if (issues.length) return hrmInvalid(req, res, issues);

    const r = await repo();
    const dup = await r.findOne("HrmCrew", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "Code", op: "eq", value: code },
    ]);
    if (dup) return hrmBad(req, res, "E-HRM-CREW-DUP", `اکیپ با کد ${code} از قبل وجود دارد`, 409);

    const actor = hrmActor(req);
    const row = await r.create("HrmCrew", {
      ProjectId: projectId,
      Code: code,
      NameFa: nameFa,
      ObsNodeId: b.obsNodeId ?? null,
      ForemanPersonId: b.foremanPersonId ?? null,
      PrimaryTradeCode: trade,
      TargetMix: b.targetMix ?? null,
      TargetSize: Number(b.targetSize ?? 0),
      DefaultCbsId: b.defaultCbsId ?? null,
      ShiftCode: b.shiftCode ?? null,
      IsSubcontracted: b.isSubcontracted === true,
      SubContractId: b.subContractId ?? null,
      Status: "forming",
      DisbandedAt: null,
      DisbandReasonFa: null,
    }, actor, "CRW");

    res.status(201).json(hrmOk(req, { id: row.Id, code, status: "forming", messageFa: `اکیپ ${nameFa} ساخته شد و در حال تشکیل است` }));
  } catch (err) { next(err); }
});

/**
 * افزودن عضو به اکیپ.
 *
 * قیدهای T-1 و T-4 روی **کل پروژه** بررسی می‌شوند نه فقط همین اکیپ؛
 * تعارض دقیقاً وقتی رخ می‌دهد که نفر در اکیپ دیگری باشد.
 */
app.post("/api/hrm/crews/:id/members", hrmRequire("hrm.crew.manage"), async (req, res, next) => {
  try {
    const projectId = hrmProjectOf(req, res);
    if (!projectId) return;
    const r = await repo();
    const crew = await r.findOne("HrmCrew", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "Id", op: "eq", value: String(req.params.id) },
    ]);
    if (!crew) return hrmBad(req, res, "E-HRM-CREW-NOT-FOUND", "اکیپ پیدا نشد", 404);
    if (String(crew.Status) === "disbanded") {
      return hrmBad(req, res, "E-HRM-170", "اکیپ منحل‌شده عضو تازه نمی‌پذیرد", 409);
    }

    const b = req.body ?? {};
    const candidate = {
      crewId: String(crew.Id),
      personId: String(b.personId || "").trim(),
      fromDate: String(b.fromDate || ""),
      toDate: b.toDate ? String(b.toDate) : null,
      allocationPct: b.allocationPct === undefined ? 100 : Number(b.allocationPct),
      status: "active",
    };

    const existing = await hrmMembersOf(r, projectId);
    const issues = validateMembership(candidate, existing);

    /*
     * اجرای گیت D7 روی عضویت اکیپ.
     *
     * بدون این بند، کل پنج گیت تجهیز تشریفاتی بود: نفری با وضعیت
     * `candidate` و مدرک منقضی می‌توانست عضو اکیپ شود و فردا برگهٔ
     * کارکردش امضا شود. گیت جایی معنا دارد که سرِ راه باشد.
     *
     * نفری که اصلاً پرونده ندارد فقط **هشدار** می‌گیرد نه خطا: پروژه‌های
     * موجود اکیپ‌هایی دارند که پیش از راه‌اندازی D7 ساخته شده‌اند و
     * مسدود کردنشان یعنی سامانه از کار می‌افتد. مهاجرت تدریجی است.
     */
    const person = await r.findOne("HrmPerson", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "Id", op: "eq", value: candidate.personId },
    ]);
    if (person) {
      const st = String(person.Status ?? "candidate");
      if (st !== "active") {
        issues.push({
          code: "E-HRM-260",
          severity: "error",
          field: "personId",
          personId: candidate.personId,
          messageFa: `وضعیت ${person.FullNameFa} «${PERSON_STATUS_FA[st] ?? st}» است؛ فقط نیروی فعال عضو اکیپ می‌شود`,
        });
      }
    } else {
      issues.push({
        code: "W-HRM-523",
        severity: "warning",
        field: "personId",
        personId: candidate.personId,
        messageFa: "این نفر پروندهٔ پرسنلی ندارد؛ گیت‌های تجهیز روی او اعمال نشده است",
      });
    }

    if (issues.some((i) => i.severity === "error")) return hrmInvalid(req, res, issues);

    const actor = hrmActor(req);
    const row = await r.create("HrmCrewMember", {
      ProjectId: projectId,
      CrewId: String(crew.Id),
      PersonId: candidate.personId,
      RoleInCrew: String(b.roleInCrew || "skilled"),
      TradeCode: String(b.tradeCode || crew.PrimaryTradeCode),
      Grade: b.grade ?? null,
      FromDate: candidate.fromDate,
      ToDate: candidate.toDate,
      AllocationPct: candidate.allocationPct,
      ExitReasonFa: null,
      Status: "active",
    }, actor, "CRM");

    const after = await hrmMembersOf(r, projectId, String(crew.Id));
    res.status(201).json(hrmOk(req, {
      id: row.Id,
      crewId: crew.Id,
      composition: crewComposition(after, candidate.fromDate),
      warnings: issues.filter((i) => i.severity === "warning"),
      messageFa: `نفر ${candidate.personId} از ${candidate.fromDate} به اکیپ ${crew.NameFa} افزوده شد`,
    }));
  } catch (err) { next(err); }
});

/**
 * خروج عضو از اکیپ.
 *
 * رکورد حذف نمی‌شود و فقط `ToDate` می‌خورد: سابقهٔ کارکرد روزهای
 * گذشته به همین عضویت گره خورده و پاک کردنش ساعت را بی‌صاحب می‌کند.
 */
app.post("/api/hrm/crews/:id/members/:memberId/end", hrmRequire("hrm.crew.manage"), async (req, res, next) => {
  try {
    const projectId = hrmProjectOf(req, res);
    if (!projectId) return;
    const r = await repo();
    const row = await r.findOne("HrmCrewMember", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "CrewId", op: "eq", value: String(req.params.id) },
      { column: "Id", op: "eq", value: String(req.params.memberId) },
    ]);
    if (!row) return hrmBad(req, res, "E-HRM-MEMBER-NOT-FOUND", "عضویت پیدا نشد", 404);
    if (row.ToDate) return hrmBad(req, res, "E-HRM-173", "این عضویت قبلاً بسته شده است", 409);

    const toDate = String(req.body?.toDate || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
      return hrmBad(req, res, "E-HRM-162", "تاریخ خروج نامعتبر است", 422);
    }
    if (toDate < String(row.FromDate ?? "")) {
      return hrmBad(req, res, "E-HRM-163", "تاریخ خروج پیش از تاریخ ورود است", 422);
    }

    const actor = hrmActor(req);
    await r.patch("HrmCrewMember", row.Id, {
      ToDate: toDate,
      ExitReasonFa: req.body?.reasonFa ? String(req.body.reasonFa) : null,
    }, actor);

    res.json(hrmOk(req, {
      id: row.Id,
      toDate,
      messageFa: `عضویت نفر ${row.PersonId} در تاریخ ${toDate} بسته شد`,
    }));
  } catch (err) { next(err); }
});

/** فعال‌سازی اکیپ — دروازهٔ سرپرست و عضو. */
app.post("/api/hrm/crews/:id/activate", hrmRequire("hrm.crew.manage"), async (req, res, next) => {
  try {
    const projectId = hrmProjectOf(req, res);
    if (!projectId) return;
    const r = await repo();
    const crew = await r.findOne("HrmCrew", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "Id", op: "eq", value: String(req.params.id) },
    ]);
    if (!crew) return hrmBad(req, res, "E-HRM-CREW-NOT-FOUND", "اکیپ پیدا نشد", 404);

    const onDate = String(req.body?.onDate || new Date().toISOString().slice(0, 10));
    const members = await hrmMembersOf(r, projectId, String(crew.Id));
    const comp = crewComposition(members, onDate);
    const gate = canActivateCrew({
      status: String(crew.Status),
      composition: comp,
      hasForemanAssigned: Boolean(crew.ForemanPersonId),
    });
    if (!gate.ok) {
      return hrmBad(req, res, gate.code, gate.messageFa, gate.code === "E-HRM-169" ? 422 : 409, gate.detailsFa);
    }

    await r.patch("HrmCrew", crew.Id, { Status: "active" }, hrmActor(req));
    res.json(hrmOk(req, {
      id: crew.Id,
      status: "active",
      composition: comp,
      messageFa: `اکیپ ${crew.NameFa} با ${comp.headcount} نفر فعال شد`,
    }));
  } catch (err) { next(err); }
});

/**
 * انحلال اکیپ.
 *
 * برگهٔ باز و عضو فعال هر دو مانع‌اند و یکجا گزارش می‌شوند: کاربر
 * نباید سه بار دکمه بزند تا سه مانع را یکی‌یکی کشف کند.
 */
app.post("/api/hrm/crews/:id/disband", hrmRequire("hrm.crew.disband"), async (req, res, next) => {
  try {
    const projectId = hrmProjectOf(req, res);
    if (!projectId) return;
    const r = await repo();
    const crew = await r.findOne("HrmCrew", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "Id", op: "eq", value: String(req.params.id) },
    ]);
    if (!crew) return hrmBad(req, res, "E-HRM-CREW-NOT-FOUND", "اکیپ پیدا نشد", 404);

    const onDate = new Date().toISOString().slice(0, 10);
    const members = await hrmMembersOf(r, projectId, String(crew.Id));
    const headers = await r.list("HrmTimesheetHeader", {
      where: [
        { column: "ProjectId", op: "eq", value: projectId },
        { column: "CrewId", op: "eq", value: String(crew.Id) },
      ],
      limit: 5000,
    });
    const open = headers.filter((h) => TS_STATE_RANK[String(h.Status)] < TS_STATE_RANK.pm_approved);

    const gate = canDisbandCrew({
      status: String(crew.Status),
      openTimesheets: open.length,
      activeMembers: members.filter((m) => isMemberActiveOn(m, onDate)).length,
      reasonFa: String(req.body?.reasonFa || ""),
    });
    if (!gate.ok) {
      return hrmBad(req, res, gate.code, gate.messageFa, gate.code === "E-HRM-170" ? 409 : 422, gate.detailsFa);
    }

    await r.patch("HrmCrew", crew.Id, {
      Status: "disbanded",
      DisbandedAt: new Date().toISOString(),
      DisbandReasonFa: String(req.body.reasonFa).trim(),
    }, hrmActor(req));

    res.json(hrmOk(req, {
      id: crew.Id,
      status: "disbanded",
      messageFa: `اکیپ ${crew.NameFa} منحل شد؛ سابقهٔ ${headers.length} برگهٔ کارکرد آن دست‌نخورده می‌ماند`,
    }));
  } catch (err) { next(err); }
});

/* ─────────── نیروی پیمانکاری ─────────── */

/** فهرست قراردادهای نیروی پیمانکاری؛ نرخ برای بی‌مجوز ماسک می‌شود. */
app.get("/api/hrm/subcontracts", hrmRequire("hrm.sub.view"), async (req, res, next) => {
  try {
    const projectId = hrmProjectOf(req, res);
    if (!projectId) return;
    const r = await repo();
    const rows = await r.list("HrmSubContract", {
      where: [{ column: "ProjectId", op: "eq", value: projectId }],
      limit: 500,
    });
    res.json(hrmOk(req, {
      items: rows.map((c) => ({
        id: c.Id,
        contractNo: c.ContractNo,
        contractorName: c.ContractorName,
        scopeTrades: typeof c.ScopeTrades === "string" ? JSON.parse(c.ScopeTrades || "[]") : (c.ScopeTrades ?? []),
        pricingModel: c.PricingModel,
        pricingModelFa: PRICING_MODEL_FA[String(c.PricingModel)] ?? c.PricingModel,
        agreedRates: typeof c.AgreedRates === "string" ? JSON.parse(c.AgreedRates || "{}") : (c.AgreedRates ?? {}),
        currency: c.Currency,
        startDate: c.StartDate,
        endDate: c.EndDate,
        retentionPct: Number(c.RetentionPct ?? 0),
        cntContractId: c.CntContractId ?? null,
        finVendorId: c.FinVendorId ?? null,
        status: c.Status,
      })),
    }));
  } catch (err) { next(err); }
});

/** ثبت قرارداد نیروی پیمانکاری. */
app.post("/api/hrm/subcontracts", hrmRequire("hrm.sub.manage"), async (req, res, next) => {
  try {
    const projectId = hrmProjectOf(req, res);
    if (!projectId) return;
    const b = req.body ?? {};
    const contractNo = String(b.contractNo || "").trim();
    const contractorName = String(b.contractorName || "").trim();

    const issues = [];
    if (contractNo.length < 2) issues.push({ code: "E-HRM-161", severity: "error", field: "contractNo", messageFa: "شمارهٔ قرارداد الزامی است" });
    if (contractorName.length < 2) issues.push({ code: "E-HRM-161", severity: "error", field: "contractorName", messageFa: "نام پیمانکار الزامی است" });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.startDate || ""))) issues.push({ code: "E-HRM-162", severity: "error", field: "startDate", messageFa: "تاریخ شروع نامعتبر است" });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.endDate || ""))) issues.push({ code: "E-HRM-162", severity: "error", field: "endDate", messageFa: "تاریخ پایان نامعتبر است" });
    if (String(b.endDate || "") < String(b.startDate || "")) issues.push({ code: "E-HRM-163", severity: "error", field: "endDate", messageFa: "تاریخ پایان پیش از شروع است" });
    if (b.pricingModel && !PRICING_MODELS.includes(String(b.pricingModel))) {
      issues.push({ code: "E-HRM-184", severity: "error", field: "pricingModel", messageFa: "مدل قیمت‌گذاری نامعتبر است" });
    }
    const retention = Number(b.retentionPct ?? 0);
    if (!(retention >= 0 && retention <= 100)) {
      issues.push({ code: "E-HRM-164", severity: "error", field: "retentionPct", messageFa: "درصد حسن انجام کار باید بین ۰ تا ۱۰۰ باشد" });
    }
    if (issues.length) return hrmInvalid(req, res, issues);

    const r = await repo();
    const dup = await r.findOne("HrmSubContract", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "ContractNo", op: "eq", value: contractNo },
    ]);
    if (dup) return hrmBad(req, res, "E-HRM-SUB-DUP", `قرارداد ${contractNo} از قبل ثبت شده است`, 409);

    const actor = hrmActor(req);
    const row = await r.create("HrmSubContract", {
      ProjectId: projectId,
      ContractNo: contractNo,
      ContractorName: contractorName,
      ScopeTrades: b.scopeTrades ?? null,
      PricingModel: String(b.pricingModel || "hourly"),
      AgreedRates: b.agreedRates ?? null,
      Currency: String(b.currency || "IRR"),
      StartDate: String(b.startDate),
      EndDate: String(b.endDate),
      RetentionPct: retention,
      PenaltyTermsFa: b.penaltyTermsFa ?? null,
      FinVendorId: b.finVendorId ?? null,
      CntContractId: b.cntContractId ?? null,
      Status: String(b.status || "draft"),
    }, actor, "SUB");

    res.status(201).json(hrmOk(req, {
      id: row.Id,
      contractNo,
      status: row.Status,
      messageFa: `قرارداد ${contractNo} با ${contractorName} ثبت شد`,
    }));
  } catch (err) { next(err); }
});

/**
 * ویرایش قرارداد پیمانکاری — رفع TD-HRM-04.
 *
 * بدون این مسیر بن‌بست بود و زنده اثبات شد: قراردادی که نرخ یک رسته
 * در آن جا افتاده بود، حضور آن رسته را با هشدار `W-HRM-510` می‌پذیرفت،
 * صورت‌کارکرد با ۳۲ نفر-ساعت بی‌نرخ در `draft` قفل می‌ماند — و **هیچ
 * راهی برای افزودن آن نرخ نبود**. کار انجام شده بود، ساعتش ثبت بود،
 * ولی پول هرگز پرداخت نمی‌شد.
 *
 * سه چیز عمداً **ویرایش نمی‌شوند**:
 *
 *   `ContractNo` — شمارهٔ قرارداد هویت سند است؛ عوض کردنش یعنی
 *   ساختن قرارداد دیگری زیر پوست همین رکورد، و ارجاع‌های بیرونی
 *   (صورت‌کارکرد، سند مالی) بی‌صدا به سند اشتباه اشاره می‌کنند.
 *
 *   `ProjectId` — انتقال قرارداد بین پروژه‌ها یعنی ساعت‌های ثبت‌شده
 *   ناگهان به بودجهٔ دیگری بچسبند.
 *
 *   نرخ رسته‌ای که **صورت‌کارکرد مهرخورده** دارد — آن رقم قبلاً در
 *   سندی رسمی رفته؛ تغییرش گذشته را بازنویسی می‌کند.
 */
app.patch("/api/hrm/subcontracts/:id", hrmRequire("hrm.sub.manage"), async (req, res, next) => {
  try {
    const projectId = hrmProjectOf(req, res);
    if (!projectId) return;
    const r = await repo();
    const row = await r.findOne("HrmSubContract", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "Id", op: "eq", value: String(req.params.id) },
    ]);
    if (!row) return hrmBad(req, res, "E-HRM-SUB-NOT-FOUND", "قرارداد پیمانکاری پیدا نشد", 404);

    const b = req.body ?? {};
    const issues = [];

    /* تلاش برای عوض کردن هویت، سکوت نمی‌گیرد: کاربر باید بداند چرا
     * تغییرش اعمال نشد، نه اینکه فکر کند شد. */
    if (b.contractNo !== undefined && String(b.contractNo) !== String(row.ContractNo)) {
      issues.push({
        code: "E-HRM-165", severity: "error", field: "contractNo",
        messageFa: "شمارهٔ قرارداد هویت سند است و عوض نمی‌شود؛ برای پیمان تازه قرارداد جدید ثبت کنید",
      });
    }
    if (b.projectId !== undefined && String(b.projectId) !== projectId) {
      issues.push({
        code: "E-HRM-166", severity: "error", field: "projectId",
        messageFa: "انتقال قرارداد بین پروژه‌ها ممکن نیست؛ ساعت‌های ثبت‌شده به بودجهٔ همین پروژه چسبیده‌اند",
      });
    }

    const patch = {};

    if (b.contractorName !== undefined) {
      const name = String(b.contractorName).trim();
      if (name.length < 2) {
        issues.push({ code: "E-HRM-161", severity: "error", field: "contractorName", messageFa: "نام پیمانکار الزامی است" });
      } else patch.ContractorName = name;
    }

    const startDate = b.startDate !== undefined ? String(b.startDate) : String(row.StartDate);
    const endDate = b.endDate !== undefined ? String(b.endDate) : String(row.EndDate);
    for (const [field, val] of [["startDate", startDate], ["endDate", endDate]]) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(val)) {
        issues.push({ code: "E-HRM-162", severity: "error", field, messageFa: `تاریخ ${field} نامعتبر است` });
      }
    }
    if (endDate < startDate) {
      issues.push({ code: "E-HRM-163", severity: "error", field: "endDate", messageFa: "تاریخ پایان پیش از شروع است" });
    }
    if (b.startDate !== undefined) patch.StartDate = startDate;
    if (b.endDate !== undefined) patch.EndDate = endDate;

    if (b.pricingModel !== undefined) {
      if (!PRICING_MODELS.includes(String(b.pricingModel))) {
        issues.push({ code: "E-HRM-184", severity: "error", field: "pricingModel", messageFa: "مدل قیمت‌گذاری نامعتبر است" });
      } else patch.PricingModel = String(b.pricingModel);
    }

    if (b.retentionPct !== undefined) {
      const rp = Number(b.retentionPct);
      if (!(rp >= 0 && rp <= 100)) {
        issues.push({ code: "E-HRM-164", severity: "error", field: "retentionPct", messageFa: "درصد حسن انجام کار باید بین ۰ تا ۱۰۰ باشد" });
      } else patch.RetentionPct = rp;
    }

    if (b.status !== undefined) patch.Status = String(b.status);
    if (b.scopeTrades !== undefined) patch.ScopeTrades = b.scopeTrades;
    if (b.penaltyTermsFa !== undefined) patch.PenaltyTermsFa = b.penaltyTermsFa;
    if (b.finVendorId !== undefined) patch.FinVendorId = b.finVendorId;
    if (b.cntContractId !== undefined) patch.CntContractId = b.cntContractId;

    /* ── نرخ‌ها: ادغام، نه جایگزینی ──
     *
     * ارسال `{MEC-WLD: 220000}` نباید نرخ `CIV-RBR` را پاک کند. مقصود
     * غالب «این را هم اضافه کن» است، و جایگزینی کامل یعنی هر ویرایش
     * جزئی باید کل جدول نرخ را دوباره بفرستد — که دیر یا زود یکی را
     * جا می‌اندازد. */
    let ratesChanged = [];
    if (b.agreedRates !== undefined) {
      let current = {};
      try {
        current = typeof row.AgreedRates === "string"
          ? JSON.parse(row.AgreedRates || "{}")
          : (row.AgreedRates ?? {});
      } catch { current = {}; }

      const incoming = b.agreedRates ?? {};
      if (typeof incoming !== "object" || incoming === null || Array.isArray(incoming)) {
        issues.push({ code: "E-HRM-167", severity: "error", field: "agreedRates", messageFa: "جدول نرخ باید شیء رسته→نرخ باشد" });
      } else {
        /* نرخی که صورت‌کارکرد مهرخورده دارد، گذشته است. */
        const sealed = await r.list("HrmSubAttendance", {
          where: [
            { column: "ProjectId", op: "eq", value: projectId },
            { column: "SubContractId", op: "eq", value: String(row.Id) },
          ],
          limit: 20000,
        });
        const sealedTrades = new Set(
          sealed.filter((a) => a.SubIpcId).map((a) => String(a.TradeCode))
        );

        const merged = { ...current };
        for (const [trade, rate] of Object.entries(incoming)) {
          const v = Number(rate);
          if (!(v > 0)) {
            issues.push({
              code: "E-HRM-168", severity: "error", field: `agreedRates.${trade}`,
              messageFa: `نرخ رستهٔ ${trade} باید بزرگ‌تر از صفر باشد`,
            });
            continue;
          }
          const before = Number(current[trade] ?? 0);
          if (before > 0 && round2Srv(before) !== round2Srv(v) && sealedTrades.has(trade)) {
            issues.push({
              code: "E-HRM-169", severity: "error", field: `agreedRates.${trade}`,
              messageFa: `رستهٔ ${trade} صورت‌کارکرد مهرخورده دارد؛ نرخش گذشته است و با سند اصلاحی عوض می‌شود نه با ویرایش`,
            });
            continue;
          }
          if (round2Srv(before) !== round2Srv(v)) {
            ratesChanged.push({ trade, from: before || null, to: v });
          }
          merged[trade] = v;
        }
        if (!issues.length) patch.AgreedRates = merged;
      }
    }

    if (issues.length) return hrmInvalid(req, res, issues);
    if (!Object.keys(patch).length) {
      return hrmBad(req, res, "E-HRM-170", "هیچ تغییری در بدنهٔ درخواست نیست", 422);
    }

    const actor = hrmActor(req);
    await r.patch("HrmSubContract", row.Id, patch, actor);

    /* تغییر نرخ مستقیماً مبلغ صورت‌کارکرد را عوض می‌کند، پس شدت
     * هشدار می‌گیرد تا در سیاهه دیده شود. */
    await hrmAudit(r, req, "HRM_SUBCONTRACT_UPDATED", {
      projectId,
      entityName: "HrmSubContract",
      entityId: String(row.Id),
      severity: ratesChanged.length ? "warning" : "info",
      contractNo: row.ContractNo,
      fields: Object.keys(patch),
      ratesChanged,
    });

    res.json(hrmOk(req, {
      id: row.Id,
      updatedFields: Object.keys(patch),
      ratesChanged,
      messageFa: ratesChanged.length
        ? `قرارداد به‌روز شد؛ ${ratesChanged.length} نرخ تغییر کرد — صورت‌کارکردهای پیش‌نویس باید دوباره تهیه شوند`
        : "قرارداد به‌روز شد",
    }));
  } catch (err) { next(err); }
});

/** حضور گروهی یک قرارداد در یک دوره. */
app.get("/api/hrm/sub-attendance", hrmRequire("hrm.crew.view"), async (req, res, next) => {
  try {
    const projectId = hrmProjectOf(req, res);
    if (!projectId) return;
    const subContractId = String(req.query.subContractId || "");
    if (!subContractId) return hrmBad(req, res, "E-HRM-NO-SUB", "پارامتر subContractId الزامی است");

    const r = await repo();
    const contract = await hrmSubContract(r, projectId, subContractId);
    if (!contract) return hrmBad(req, res, "E-HRM-SUB-NOT-FOUND", "قرارداد پیمانکاری پیدا نشد", 404);

    const periodCode = String(req.query.periodCode || "");
    const rows = await hrmSubAttOf(r, projectId, subContractId, periodCode);
    const byState = {};
    let totalHours = 0, verifiedHours = 0;
    for (const x of rows) {
      const st = String(x.Status ?? "draft");
      byState[st] = (byState[st] ?? 0) + 1;
      const h = Number(x.TotalHours ?? 0);
      totalHours += h;
      if (st === "verified" || st === "invoiced") verifiedHours += h;
    }

    res.json(hrmOk(req, {
      subContractId,
      periodCode: periodCode || null,
      items: rows
        .sort((a, b) => String(a.WorkDate).localeCompare(String(b.WorkDate)))
        .map((x) => ({
          id: x.Id,
          workDate: x.WorkDate,
          periodCode: periodOf(String(x.WorkDate ?? "")),
          tradeCode: x.TradeCode,
          headcount: Number(x.Headcount ?? 0),
          hoursPerPerson: Number(x.HoursPerPerson ?? 0),
          totalHours: Number(x.TotalHours ?? 0),
          activityId: x.ActivityId,
          cbsId: x.CbsId,
          crewId: x.CrewId ?? null,
          gatePassRef: x.GatePassRef ?? null,
          verifiedBy: x.VerifiedBy ?? null,
          verifiedAt: x.VerifiedAt ?? null,
          subIpcId: x.SubIpcId ?? null,
          status: x.Status,
          statusFa: SUB_ATT_STATE_FA[String(x.Status)] ?? x.Status,
        })),
      summary: {
        rowCount: rows.length,
        byState,
        totalHours: Math.round(totalHours * 100) / 100,
        verifiedHours: Math.round(verifiedHours * 100) / 100,
        pendingCount: rows.filter((x) => String(x.Status) === "draft" || String(x.Status) === "submitted").length,
      },
    }));
  } catch (err) { next(err); }
});

/**
 * ثبت حضور گروهی.
 *
 * دو دروازه پشت سر هم: اعتبارسنجی قرارداد/رسته/ساعت، و بررسی تقاطع
 * با تایم‌شیت فردی همان روز. دومی گران است ولی جای دیگری قابل گرفتن
 * نیست: پس از ثبت، عدد وارد هزینه شده است.
 */
app.post("/api/hrm/sub-attendance", hrmRequire("hrm.sub.record"), async (req, res, next) => {
  try {
    const projectId = hrmProjectOf(req, res);
    if (!projectId) return;
    const b = req.body ?? {};
    const subContractId = String(b.subContractId || "");
    if (!subContractId) return hrmBad(req, res, "E-HRM-NO-SUB", "پارامتر subContractId الزامی است");

    const r = await repo();
    const contract = await hrmSubContract(r, projectId, subContractId);
    if (!contract) return hrmBad(req, res, "E-HRM-SUB-NOT-FOUND", "قرارداد پیمانکاری پیدا نشد", 404);

    const input = {
      workDate: String(b.workDate || ""),
      tradeCode: String(b.tradeCode || ""),
      headcount: Number(b.headcount ?? 0),
      hoursPerPerson: Number(b.hoursPerPerson ?? 0),
      activityId: String(b.activityId || ""),
      cbsId: String(b.cbsId || ""),
      gatePassRef: b.gatePassRef ? String(b.gatePassRef) : undefined,
    };
    const issues = validateSubAttendance(input, contract);
    if (issues.some((i) => i.severity === "error")) return hrmInvalid(req, res, issues);

    /* دورهٔ بسته حضور تازه نمی‌پذیرد — همان قفل D4. */
    const locks = await hrmLocks(r, projectId);
    if (isDateLocked(input.workDate, locks)) {
      return hrmBad(req, res, "E-HRM-130", `دورهٔ ${periodOf(input.workDate)} بسته است`, 409);
    }

    /* رفع TD-HRM-03 — استعلام وجود مقصد شارژ.
     *
     * `activityId` و `cbsId` گرفته می‌شدند ولی وجودشان بررسی نمی‌شد.
     * زنده اثبات شد: ۱۰۸ نفر-ساعت روی `GHOST-ACT`/`GHOST-CBS` ثبت شد،
     * در هیستوگرام D8 نشست، در تجمیع CBS ظاهر شد و راهی گزارش رسمی
     * می‌شد — همه بی‌آنکه آن فعالیت یا حساب هرگز وجود داشته باشد.
     *
     * یک غلط تایپی در کد حساب کافی بود تا ساعت واقعی روی حسابی بنشیند
     * که هیچ‌کس نگاهش نمی‌کند: نه در بودجه دیده می‌شود، نه در انحراف.
     *
     * فعالیت **خطا** است چون بهره‌وری بدون آن محاسبه نمی‌شود؛ حساب
     * هزینه هم خطاست چون مقصد پول است. هر دو باید به پروژهٔ خودشان
     * تعلق داشته باشند — نه فقط وجود داشته باشند. */
    const chargeIssues = [];
    if (input.activityId) {
      const act = await r.findOne("Activity", [
        { column: "ProjectId", op: "eq", value: projectId },
        { column: "Id", op: "eq", value: input.activityId },
      ]);
      if (!act) {
        chargeIssues.push({
          code: "E-HRM-190",
          severity: "error",
          field: "activityId",
          messageFa: `فعالیت ${input.activityId} در این پروژه وجود ندارد؛ ساعت بی‌صاحب ثبت نمی‌شود`,
        });
      }
    }
    if (input.cbsId) {
      const acc = await r.findOne("CostAccount", [
        { column: "ProjectId", op: "eq", value: projectId },
        { column: "Id", op: "eq", value: input.cbsId },
      ]);
      if (!acc) {
        chargeIssues.push({
          code: "E-HRM-191",
          severity: "error",
          field: "cbsId",
          messageFa: `حساب هزینهٔ ${input.cbsId} در این پروژه وجود ندارد؛ هزینه مقصد ندارد`,
        });
      }
    }
    if (chargeIssues.length) return hrmInvalid(req, res, chargeIssues);

    /* تقاطع با تایم‌شیت فردی: فقط وقتی اکیپ مشخص شده باشد معنا دارد. */
    let doubleIssues = [];
    const crewId = b.crewId ? String(b.crewId) : null;
    if (crewId) {
      const members = (await hrmMembersOf(r, projectId, crewId)).filter((m) => isMemberActiveOn(m, input.workDate));
      const direct = await r.list("HrmTimesheetEntry", {
        where: [
          { column: "ProjectId", op: "eq", value: projectId },
          { column: "WorkDate", op: "eq", value: input.workDate },
        ],
        limit: 5000,
      });
      doubleIssues = assertNoDoubleCount({
        workDate: input.workDate,
        directEntries: direct.filter((e) => !e.VoidedAt),
        crewMemberPersonIds: members.map((m) => m.personId),
      });
      if (doubleIssues.length) return hrmInvalid(req, res, doubleIssues);
    }

    const dup = await r.findOne("HrmSubAttendance", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "SubContractId", op: "eq", value: subContractId },
      { column: "WorkDate", op: "eq", value: input.workDate },
      { column: "TradeCode", op: "eq", value: input.tradeCode },
      { column: "ActivityId", op: "eq", value: input.activityId },
    ]);
    if (dup) {
      return hrmBad(req, res, "E-HRM-SUBATT-DUP", `برای ${input.workDate}، رستهٔ ${input.tradeCode} و همین فعالیت قبلاً ردیف ثبت شده است`, 409);
    }

    const total = Math.round(input.headcount * input.hoursPerPerson * 100) / 100;
    const actor = hrmActor(req);
    const row = await r.create("HrmSubAttendance", {
      ProjectId: projectId,
      SubContractId: subContractId,
      WorkDate: input.workDate,
      TradeCode: input.tradeCode,
      Headcount: input.headcount,
      HoursPerPerson: input.hoursPerPerson,
      /* جمع همیشه از موتور می‌آید نه از ورودی کاربر: عددی که کاربر
       * می‌فرستد ممکن است با نفر×ساعت نخواند. */
      TotalHours: total,
      ActivityId: input.activityId,
      CbsId: input.cbsId,
      CrewId: crewId,
      GatePassRef: input.gatePassRef ?? null,
      VerifiedBy: null,
      VerifiedAt: null,
      InvoicePeriod: periodOf(input.workDate),
      SubIpcId: null,
      Status: "submitted",
      RejectReasonFa: null,
    }, actor, "SAT");

    res.status(201).json(hrmOk(req, {
      id: row.Id,
      totalHours: total,
      periodCode: periodOf(input.workDate),
      status: "submitted",
      warnings: issues.filter((i) => i.severity === "warning"),
      messageFa: `${input.headcount} نفر × ${input.hoursPerPerson} ساعت = ${total} نفر-ساعت ثبت شد`,
    }));
  } catch (err) { next(err); }
});

/**
 * تأیید یا رد حضور گروهی.
 *
 * تأییدکننده عمداً از ثبت‌کننده جداست (SOD-21): ردیف گروهی هیچ امضای
 * شخصی پشتش ندارد و تنها کنترلش همین چشم دوم است.
 */
app.post("/api/hrm/sub-attendance/:id/verify", hrmRequire("hrm.sub.verify"), async (req, res, next) => {
  try {
    const projectId = hrmProjectOf(req, res);
    if (!projectId) return;
    const r = await repo();
    const row = await r.findOne("HrmSubAttendance", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "Id", op: "eq", value: String(req.params.id) },
    ]);
    if (!row) return hrmBad(req, res, "E-HRM-SUBATT-NOT-FOUND", "ردیف حضور پیدا نشد", 404);

    const reject = req.body?.reject === true;
    const st = String(row.Status ?? "draft");
    if (st === "invoiced") {
      return hrmBad(req, res, "E-HRM-196", "این ردیف در صورت‌کارکرد رفته و دیگر تغییر نمی‌کند", 409);
    }
    if (st === "verified" && !reject) {
      return hrmBad(req, res, "E-HRM-197", "این ردیف قبلاً تأیید شده است", 409);
    }
    if (reject && String(req.body?.reasonFa || "").trim().length < 5) {
      return hrmBad(req, res, "E-HRM-198", "دلیل رد باید دست‌کم ۵ نویسه باشد", 422);
    }

    const actor = hrmActor(req);
    await r.patch("HrmSubAttendance", row.Id, reject
      ? { Status: "rejected", RejectReasonFa: String(req.body.reasonFa).trim(), VerifiedBy: null, VerifiedAt: null }
      : { Status: "verified", VerifiedBy: actor, VerifiedAt: new Date().toISOString(), RejectReasonFa: null },
      actor);

    res.json(hrmOk(req, {
      id: row.Id,
      status: reject ? "rejected" : "verified",
      totalHours: Number(row.TotalHours ?? 0),
      messageFa: reject
        ? `ردیف ${row.WorkDate} برگشت خورد`
        : `${Number(row.TotalHours ?? 0)} نفر-ساعت روز ${row.WorkDate} تأیید شد`,
    }));
  } catch (err) { next(err); }
});

/**
 * پیش‌نمایش صورت‌کارکرد یک دوره + فهرست صورت‌کارکردهای ثبت‌شده.
 *
 * خواندنی محض: هیچ چیزی ذخیره نمی‌شود، پس کاربر می‌تواند پیش از
 * تهیه ببیند چه مبلغی درمی‌آید و چند ساعت بی‌نرخ مانده است.
 */
app.get("/api/hrm/sub-ipc", hrmRequire("hrm.sub.view"), async (req, res, next) => {
  try {
    const projectId = hrmProjectOf(req, res);
    if (!projectId) return;
    const subContractId = String(req.query.subContractId || "");
    if (!subContractId) return hrmBad(req, res, "E-HRM-NO-SUB", "پارامتر subContractId الزامی است");

    const r = await repo();
    const contract = await hrmSubContract(r, projectId, subContractId);
    if (!contract) return hrmBad(req, res, "E-HRM-SUB-NOT-FOUND", "قرارداد پیمانکاری پیدا نشد", 404);

    const issued = await r.list("HrmSubIpc", {
      where: [
        { column: "ProjectId", op: "eq", value: projectId },
        { column: "SubContractId", op: "eq", value: subContractId },
      ],
      limit: 500,
    });

    const periodCode = String(req.query.periodCode || "");
    let draft = null;
    if (periodCode) {
      const rows = await hrmSubAttOf(r, projectId, subContractId, periodCode);
      draft = buildSubIpc(rows, contract, periodCode);
    }

    res.json(hrmOk(req, {
      subContractId,
      periodCode: periodCode || null,
      draft,
      issued: issued
        .sort((a, b) => String(a.PeriodCode).localeCompare(String(b.PeriodCode)))
        .map((x) => ({
          id: x.Id,
          periodCode: x.PeriodCode,
          serialNo: x.SerialNo,
          totalHours: Number(x.TotalHours ?? 0),
          unpricedHours: Number(x.UnpricedHours ?? 0),
          grossAmount: Number(x.GrossAmount ?? 0),
          retentionAmount: Number(x.RetentionAmount ?? 0),
          netAmount: Number(x.NetAmount ?? 0),
          status: x.Status,
          preparedBy: x.PreparedBy ?? null,
          approvedBy: x.ApprovedBy ?? null,
          approvedAt: x.ApprovedAt ?? null,
          finPostingRef: x.FinPostingRef ?? null,
        })),
    }));
  } catch (err) { next(err); }
});

/**
 * تهیهٔ صورت‌کارکرد دوره.
 *
 * ایدمپوتنت نیست ولی یکتاست: یک صورت‌کارکرد در هر دوره برای هر
 * قرارداد. تلاش دوم ۴۰۹ می‌گیرد تا دو سند موازی برای یک دوره ساخته
 * نشود.
 */
app.post("/api/hrm/sub-ipc/prepare", hrmRequire("hrm.subipc.prepare"), async (req, res, next) => {
  try {
    const projectId = hrmProjectOf(req, res);
    if (!projectId) return;
    const subContractId = String(req.body?.subContractId || "");
    const periodCode = String(req.body?.periodCode || "");
    if (!subContractId) return hrmBad(req, res, "E-HRM-NO-SUB", "پارامتر subContractId الزامی است");
    if (!periodCode) return hrmBad(req, res, "E-HRM-NO-PERIOD", "پارامتر periodCode الزامی است");

    const r = await repo();
    const contract = await hrmSubContract(r, projectId, subContractId);
    if (!contract) return hrmBad(req, res, "E-HRM-SUB-NOT-FOUND", "قرارداد پیمانکاری پیدا نشد", 404);

    const exists = await r.findOne("HrmSubIpc", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "SubContractId", op: "eq", value: subContractId },
      { column: "PeriodCode", op: "eq", value: periodCode },
    ]);
    if (exists) {
      return hrmBad(req, res, "E-HRM-SUBIPC-DUP", `صورت‌کارکرد دورهٔ ${periodCode} قبلاً تهیه شده است`, 409);
    }

    const rows = await hrmSubAttOf(r, projectId, subContractId, periodCode);
    const draft = buildSubIpc(rows, contract, periodCode);
    if (draft.issues.some((i) => i.severity === "error")) {
      return hrmInvalid(req, res, draft.issues);
    }

    const actor = hrmActor(req);
    /* شماره از بیشینه می‌آید نه از تعداد: اگر روزی سندی حذف شود،
     * `length + 1` شمارهٔ تکراری می‌ساخت و دو صورت‌کارکرد با یک
     * شماره در دفتر پیمانکار می‌نشست. */
    const prior = await r.list("HrmSubIpc", {
      where: [
        { column: "ProjectId", op: "eq", value: projectId },
        { column: "SubContractId", op: "eq", value: subContractId },
      ],
      limit: 500,
    });
    const serial = prior.reduce((mx, x) => Math.max(mx, Number(x.SerialNo ?? 0)), 0) + 1;

    const row = await r.create("HrmSubIpc", {
      ProjectId: projectId,
      SubContractId: subContractId,
      PeriodCode: periodCode,
      SerialNo: serial,
      TotalHours: draft.totalHours,
      GrossAmount: draft.grossAmount,
      RetentionAmount: draft.retentionAmount,
      DeductionAmount: 0,
      NetAmount: draft.netBeforeDeduction,
      UnpricedHours: draft.unpricedHours,
      DeductionNoteFa: null,
      Status: "draft",
      PreparedBy: actor,
      ApprovedBy: null,
      ApprovedAt: null,
      FinPostingRef: null,
    }, actor, "SIP");

    /* ردیف‌های وارد سند به `invoiced` می‌روند تا در سند بعدی دوباره
     * شمرده نشوند. */
    let stamped = 0;
    for (const x of rows) {
      if (String(x.Status) !== "verified") continue;
      await r.patch("HrmSubAttendance", x.Id, { Status: "invoiced", SubIpcId: row.Id }, actor);
      stamped++;
    }

    res.status(201).json(hrmOk(req, {
      id: row.Id,
      periodCode,
      serialNo: serial,
      totalHours: draft.totalHours,
      grossAmount: draft.grossAmount,
      retentionAmount: draft.retentionAmount,
      netAmount: draft.netBeforeDeduction,
      unpricedHours: draft.unpricedHours,
      lineCount: draft.lines.length,
      stampedRows: stamped,
      isComplete: draft.isComplete,
      warnings: draft.issues.filter((i) => i.severity === "warning"),
      messageFa: draft.isComplete
        ? `صورت‌کارکرد دورهٔ ${periodCode} با ${draft.totalHours} نفر-ساعت تهیه شد`
        : `صورت‌کارکرد تهیه شد ولی ${draft.unpricedHours} نفر-ساعت بی‌نرخ دارد و تا رفع آن تأیید نمی‌شود`,
    }));
  } catch (err) { next(err); }
});

/** تأیید صورت‌کارکرد — دروازهٔ ساعت بی‌نرخ اینجا بسته می‌شود. */
app.post("/api/hrm/sub-ipc/:id/approve", hrmRequire("hrm.subipc.approve"), async (req, res, next) => {
  try {
    const projectId = hrmProjectOf(req, res);
    if (!projectId) return;
    const r = await repo();
    const row = await r.findOne("HrmSubIpc", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "Id", op: "eq", value: String(req.params.id) },
    ]);
    if (!row) return hrmBad(req, res, "E-HRM-SUBIPC-NOT-FOUND", "صورت‌کارکرد پیدا نشد", 404);

    const gate = canApproveSubIpc({
      status: String(row.Status ?? "draft"),
      unpricedHours: Number(row.UnpricedHours ?? 0),
      totalHours: Number(row.TotalHours ?? 0),
      netAmount: Number(row.NetAmount ?? 0),
    });
    if (!gate.ok) {
      return hrmBad(req, res, gate.code, gate.messageFa, gate.code === "E-HRM-195" ? 422 : 409, gate.detailsFa);
    }

    const actor = hrmActor(req);
    await r.patch("HrmSubIpc", row.Id, {
      Status: "approved",
      ApprovedBy: actor,
      ApprovedAt: new Date().toISOString(),
    }, actor);

    res.json(hrmOk(req, {
      id: row.Id,
      periodCode: row.PeriodCode,
      status: "approved",
      totalHours: Number(row.TotalHours ?? 0),
      netAmount: Number(row.NetAmount ?? 0),
      messageFa: `صورت‌کارکرد دورهٔ ${row.PeriodCode} با ${Number(row.TotalHours ?? 0)} نفر-ساعت تأیید شد`,
    }));
  } catch (err) { next(err); }
});

/* ══════════════════════ HRM D7 — پذیرش، احکام و انطباق ══════════════════════
 *
 * این بخش یک دروازه است نه یک دفتر: هیچ عددی تولید نمی‌کند و فقط جواب
 * می‌دهد «چه کسی حق کار دارد؟».
 *
 * مرز با ماژول ایمنی: نتیجهٔ آموزش و طب کار از دفتر HSE **خوانده**
 * می‌شود و هرگز اینجا نوشته نمی‌شود. اگر HRM هم می‌توانست بنویسد، دو
 * دفتر واگرا می‌شدند و آن‌که سهل‌گیرتر است برنده می‌شد.
 */

const HRM_TODAY = () => new Date().toISOString().slice(0, 10);

/** نفر با کنترل تعلق به پروژه — پروژهٔ دیگر یعنی ۴۰۴. */
async function hrmPersonOf(r, projectId, id) {
  return r.findOne("HrmPerson", [
    { column: "ProjectId", op: "eq", value: projectId },
    { column: "Id", op: "eq", value: String(id) },
  ]);
}

async function hrmDocsOf(r, projectId, personId) {
  const where = [{ column: "ProjectId", op: "eq", value: projectId }];
  if (personId) where.push({ column: "PersonId", op: "eq", value: String(personId) });
  return r.list("HrmPersonDoc", { where, limit: 20000 });
}

async function hrmSkillsOf(r, projectId, personId) {
  const where = [{ column: "ProjectId", op: "eq", value: projectId }];
  if (personId) where.push({ column: "PersonId", op: "eq", value: String(personId) });
  return r.list("HrmSkill", { where, limit: 20000 });
}

/**
 * استعلام دروازهٔ ایمنی از دفتر HSE.
 *
 * خروجی سه‌حالته است و `null` یعنی «نتوانستیم بپرسیم» — که با «سبز»
 * یکی نیست. موتور گیت این تفاوت را می‌فهمد و `null` را قرمز می‌گیرد.
 *
 * **فقط بُعد آموزش** گیت می‌شود، نه کل `clearance`.
 *
 * دروازهٔ کامل HSE سه بُعد دارد: آموزش، تجهیزات و سلامت. اگر هر سه را
 * اینجا گیت می‌کردیم، طب کار دو بار بررسی می‌شد — یک بار در گیت ۲ از
 * دفتر مدارک HRM و یک بار از دفتر معاینات HSE — و کاربر مجبور می‌شد
 * یک واقعیت را در دو جا ثبت کند. بدتر اینکه پیام خطا هم دروغ می‌شد:
 * «آموزش: هیچ معاینهٔ طب کاری ثبت نشده».
 *
 * تقسیم کار: طب کار با گیت ۲ (سند HRM)، آموزش با گیت ۳ (دفتر HSE).
 * ابعاد سلامت و تجهیزات به‌عنوان **هشدار** نقل می‌شوند چون اطلاعات
 * واقعی‌اند، ولی دروازهٔ فعال‌سازی را دوباره نمی‌بندند — ورود روزانه
 * به کارگاه همچنان دروازهٔ کامل HSE را رد می‌کند.
 */
async function hrmHseClearance(r, projectId, personRef, tradeCode) {
  try {
    const scope = [{ column: "ProjectId", op: "eq", value: projectId }];
    const [trainings, issuances, exams, hazards] = await Promise.all([
      r.list("SafetyTrainingRecord", { where: scope, limit: 50000 }),
      r.list("PpeIssuance", { where: scope, limit: 50000 }),
      r.list("HealthExamination", { where: scope, limit: 20000 }),
      r.list("OccupationalHazard", { where: scope, limit: 2000 }),
    ]);
    const c = personSiteClearance({
      personRef, trainings, issuances, exams, hazards,
      requiredCourses: [INDUCTION_COURSE_CODE],
      tradeCode: tradeCode ?? null,
    });
    return {
      cleared: c.training.ok,
      blockersFa: c.training.blockersFa,
      /* بقیهٔ ابعاد گم نمی‌شوند؛ فقط از مانع به هشدار تنزل می‌کنند. */
      warningsFa: [
        ...c.warningsFa,
        ...c.ppe.blockersFa.map((b) => `تجهیزات: ${b}`),
        ...c.health.blockersFa.map((b) => `سلامت (دفتر ایمنی): ${b}`),
      ],
      siteEntryOk: c.ok,
    };
  } catch {
    /* خطای خواندن دفتر ایمنی نباید به «سبز» ترجمه شود. */
    return { cleared: null, blockersFa: [], warningsFa: [], siteEntryOk: null };
  }
}

/** گیت‌های یک نفر با استعلام زندهٔ ایمنی. */
async function hrmGatesOf(r, projectId, person) {
  const [docs, skills, hse] = await Promise.all([
    hrmDocsOf(r, projectId, person.Id),
    hrmSkillsOf(r, projectId, person.Id),
    hrmHseClearance(r, projectId, String(person.PersonnelNo ?? person.Id), person.PrimaryTradeCode),
  ]);
  const gates = evaluateMobGates({
    docs, skills,
    hseCleared: hse.cleared,
    hseBlockersFa: hse.blockersFa,
    gatePassRef: person.GatePassRef,
    todayIso: HRM_TODAY(),
  });
  return { docs, skills, hse, gates };
}

/** آیا کاربر مجاز به دیدن اطلاعات فردی است؟ */
const hrmSeesPersonal = (req) => rbacEvaluate(engSubject(req), "hrm.personal.view", { projectId: undefined }).allow;

const HRM_PII_MASK = "••••••••••";

/** کاتالوگ ثابت‌های پذیرش. */
app.get("/api/hrm/onboarding-meta", hrmRequire("hrm.person.view"), (req, res) => {
  res.json(hrmOk(req, {
    personStatuses: PERSON_STATUSES.map((c) => ({ code: c, fa: PERSON_STATUS_FA[c], next: personNextStates(c) })),
    employmentTypes: EMPLOYMENT_TYPES.map((c) => ({ code: c, fa: EMPLOYMENT_TYPE_FA[c] })),
    docTypes: HRM_DOC_TYPES.map((c) => ({ code: c, fa: HRM_DOC_TYPE_FA[c] })),
    gates: MOB_GATES.map((c) => ({ code: c, fa: MOB_GATE_FA[c] })),
    mobStates: MOB_REQ_STATES.map((c) => ({ code: c, fa: MOB_REQ_STATE_FA[c] })),
    mobTypes: MOB_REQUEST_TYPES.map((c) => ({ code: c, fa: MOB_REQUEST_TYPE_FA[c] })),
    demobItems: DEMOB_ITEMS.map((c) => ({ code: c, fa: DEMOB_ITEM_FA[c], optional: DEMOB_OPTIONAL.includes(c) })),
    expiryWarnDays: DOC_EXPIRY_WARN_DAYS,
  }));
});

/**
 * تابلوی انطباق نیروی پروژه.
 *
 * پاسخ به یک سؤال: «چند نفر امروز حق کار دارند و چند نفر نه؟». نفرِ
 * فعالِ دارای مدرک منقضی اول فهرست می‌آید چون همین الان دارد کار
 * می‌کند در حالی که نباید.
 */
app.get("/api/hrm/people", hrmRequire("hrm.person.view"), async (req, res, next) => {
  try {
    const projectId = hrmProjectOf(req, res);
    if (!projectId) return;
    const todayIso = String(req.query.onDate || HRM_TODAY());

    const r = await repo();
    const where = [{ column: "ProjectId", op: "eq", value: projectId }];
    const status = String(req.query.status || "");
    if (status) where.push({ column: "Status", op: "eq", value: status });

    const [people, docs, skills] = await Promise.all([
      r.list("HrmPerson", { where, limit: 5000 }),
      hrmDocsOf(r, projectId),
      hrmSkillsOf(r, projectId),
    ]);

    /* گروه‌بندی یک‌باره به‌جای پرس‌وجو به ازای هر نفر. */
    const docsBy = {};
    for (const d of docs) (docsBy[String(d.PersonId)] ??= []).push(d);
    const skillsBy = {};
    for (const s of skills) (skillsBy[String(s.PersonId)] ??= []).push(s);

    const panel = compliancePanel(people, docsBy, skillsBy, todayIso);
    res.json(hrmOk(req, { onDate: todayIso, ...panel }));
  } catch (err) { next(err); }
});

/** پروندهٔ یک نفر با مدارک، مهارت‌ها و وضعیت زندهٔ پنج گیت. */
app.get("/api/hrm/people/:id", hrmRequire("hrm.person.view"), async (req, res, next) => {
  try {
    const projectId = hrmProjectOf(req, res);
    if (!projectId) return;
    const r = await repo();
    const person = await hrmPersonOf(r, projectId, req.params.id);
    if (!person) return hrmBad(req, res, "E-HRM-PERSON-NOT-FOUND", "پروندهٔ پرسنلی پیدا نشد", 404);

    const todayIso = HRM_TODAY();
    const { docs, skills, hse, gates } = await hrmGatesOf(r, projectId, person);
    const seesPii = hrmSeesPersonal(req);

    res.json(hrmOk(req, {
      id: person.Id,
      personnelNo: person.PersonnelNo,
      fullNameFa: person.FullNameFa,
      nameEn: person.NameEn ?? null,
      /* کد ملی و شمارهٔ تماس پشت `hrm.personal.view` می‌مانند: سرپرست
       * باید بداند مدرک نفرش معتبر است، نه اینکه کد ملی او را بداند. */
      nationalId: seesPii ? (person.NationalId ?? null) : HRM_PII_MASK,
      mobile: seesPii ? (person.Mobile ?? null) : HRM_PII_MASK,
      emergencyContact: seesPii ? (person.EmergencyContact ?? null) : HRM_PII_MASK,
      employmentType: person.EmploymentType,
      employmentTypeFa: EMPLOYMENT_TYPE_FA[String(person.EmploymentType)] ?? person.EmploymentType,
      employerSubContractId: person.EmployerSubContractId ?? null,
      primaryTradeCode: person.PrimaryTradeCode,
      grade: person.Grade ?? null,
      hireDate: person.HireDate ?? null,
      status: person.Status,
      statusFa: PERSON_STATUS_FA[String(person.Status)] ?? person.Status,
      nextStates: personNextStates(String(person.Status)),
      gatePassRef: person.GatePassRef ?? null,
      activatedAt: person.ActivatedAt ?? null,
      demobilizedAt: person.DemobilizedAt ?? null,
      piiMasked: !seesPii,
      docs: docs.map((d) => {
        const st = docState(d, todayIso);
        return {
          id: d.Id, docType: d.DocType,
          docTypeFa: HRM_DOC_TYPE_FA[String(d.DocType)] ?? d.DocType,
          docNo: d.DocNo ?? null,
          issuedAt: d.IssuedAt ?? null, expiresAt: d.ExpiresAt ?? null,
          isBlocking: d.IsBlocking === true || d.IsBlocking === 1,
          verifiedBy: d.VerifiedBy ?? null, verifiedAt: d.VerifiedAt ?? null,
          state: st.state, daysLeft: st.daysLeft, messageFa: st.messageFa,
        };
      }),
      docCompliance: docCompliance(docs, todayIso),
      skills: skillMatrix(skills, todayIso),
      /* نتیجهٔ زندهٔ دفتر ایمنی، نه آینهٔ ذخیره‌شده.
       * `cleared` = بُعد آموزش (گیت ۳)؛ `siteEntryOk` = دروازهٔ کامل
       * ورود به کارگاه که سه بُعد را با «و» ترکیب می‌کند. */
      hse: {
        cleared: hse.cleared,
        siteEntryOk: hse.siteEntryOk,
        blockersFa: hse.blockersFa,
        warningsFa: hse.warningsFa,
      },
      gates,
    }));
  } catch (err) { next(err); }
});

/** ثبت پروندهٔ پرسنلی. نفر تازه همیشه `candidate` است. */
app.post("/api/hrm/people", hrmRequire("hrm.person.manage"), async (req, res, next) => {
  try {
    const projectId = hrmProjectOf(req, res);
    if (!projectId) return;
    const b = req.body ?? {};
    const personnelNo = String(b.personnelNo || "").trim();
    const fullNameFa = String(b.fullNameFa || "").trim();
    const trade = String(b.primaryTradeCode || "").trim();

    const issues = [];
    if (personnelNo.length < 1) issues.push({ code: "E-HRM-240", severity: "error", field: "personnelNo", messageFa: "شمارهٔ پرسنلی الزامی است" });
    if (fullNameFa.length < 3) issues.push({ code: "E-HRM-241", severity: "error", field: "fullNameFa", messageFa: "نام و نام خانوادگی الزامی است" });
    if (!trade) issues.push({ code: "E-HRM-242", severity: "error", field: "primaryTradeCode", messageFa: "رستهٔ اصلی الزامی است" });
    const empType = String(b.employmentType || "permanent");
    if (!EMPLOYMENT_TYPES.includes(empType)) {
      issues.push({ code: "E-HRM-243", severity: "error", field: "employmentType", messageFa: "نوع استخدام نامعتبر است" });
    }
    /* نیروی پیمانکاری بدون کارفرما یعنی هزینه‌اش به هیچ صورت‌کارکردی
     * وصل نمی‌شود و در دستمزد مستقیم گم می‌شود. */
    if (empType === "subcontractor" && !String(b.employerSubContractId || "").trim()) {
      issues.push({ code: "E-HRM-244", severity: "error", field: "employerSubContractId", messageFa: "برای نیروی پیمانکاری، قرارداد کارفرما الزامی است" });
    }
    if (issues.length) return hrmInvalid(req, res, issues);

    const r = await repo();
    const dup = await r.findOne("HrmPerson", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "PersonnelNo", op: "eq", value: personnelNo },
    ]);
    if (dup) return hrmBad(req, res, "E-HRM-PERSON-DUP", `نفری با شمارهٔ پرسنلی ${personnelNo} از قبل ثبت شده است`, 409);

    const actor = hrmActor(req);
    const row = await r.create("HrmPerson", {
      ProjectId: projectId,
      PersonnelNo: personnelNo,
      FullNameFa: fullNameFa,
      NameEn: b.nameEn ?? null,
      NationalId: b.nationalId ?? null,
      Mobile: b.mobile ?? null,
      EmergencyContact: b.emergencyContact ?? null,
      EmploymentType: empType,
      EmployerSubContractId: b.employerSubContractId ?? null,
      PrimaryTradeCode: trade,
      Grade: b.grade ?? null,
      HireDate: b.hireDate ?? null,
      TerminationDate: null,
      Status: "candidate",
      HseClearance: "none",
      HseCheckedAt: null,
      GatePassRef: b.gatePassRef ?? null,
      PhotoRef: b.photoRef ?? null,
      SignatureRef: b.signatureRef ?? null,
      ActivatedAt: null,
      DemobilizedAt: null,
      ExitReasonFa: null,
    }, actor, "PRS");

    res.status(201).json(hrmOk(req, {
      id: row.Id, personnelNo, status: "candidate",
      messageFa: `پروندهٔ ${fullNameFa} ساخته شد؛ تا سبز شدن گیت‌ها اجازهٔ ثبت ساعت ندارد`,
    }));
  } catch (err) { next(err); }
});

/**
 * گذار وضعیت نفر.
 *
 * سه مجوز متفاوت روی یک مسیر می‌نشیند چون سه تصمیم متفاوت است:
 * فعال‌سازی (باز کردن در ثبت ساعت)، تخلیه (بستن پرونده) و بقیهٔ
 * گذارها (اداری). یکی کردنشان یعنی هرکس بتواند مرخصی بزند، بتواند
 * نفر را هم فعال کند.
 */
app.post("/api/hrm/people/:id/transition", async (req, res, next) => {
  try {
    const to = String(req.body?.to || "");
    const permission = to === "active" ? "hrm.person.activate"
      : (to === "demobilized" || to === "terminated") ? "hrm.person.demobilize"
      : "hrm.person.manage";

    return hrmRequire(permission)(req, res, async () => {
      try {
        const projectId = hrmProjectOf(req, res);
        if (!projectId) return;
        const r = await repo();
        const person = await hrmPersonOf(r, projectId, req.params.id);
        if (!person) return hrmBad(req, res, "E-HRM-PERSON-NOT-FOUND", "پروندهٔ پرسنلی پیدا نشد", 404);

        const from = String(person.Status ?? "candidate");
        const reasonFa = String(req.body?.reasonFa || "");

        /* گیت‌ها فقط برای فعال‌سازی استعلام می‌شوند: استعلام زندهٔ HSE
         * گران است و برای ثبت مرخصی لازم نیست. */
        let gates = null;
        if (to === "active") {
          gates = (await hrmGatesOf(r, projectId, person)).gates;
        }

        /* برگهٔ باز و چک‌لیست فقط برای تخلیه. */
        let openTimesheets = 0;
        let checklist = null;
        if (to === "demobilized") {
          const entries = await r.list("HrmTimesheetEntry", {
            where: [
              { column: "ProjectId", op: "eq", value: projectId },
              { column: "PersonId", op: "eq", value: String(person.Id) },
            ],
            limit: 20000,
          });
          const headerIds = [...new Set(entries.filter((e) => !e.VoidedAt).map((e) => String(e.HeaderId)))];
          if (headerIds.length) {
            const headers = await r.list("HrmTimesheetHeader", {
              where: [{ column: "ProjectId", op: "eq", value: projectId }],
              limit: 20000,
            });
            openTimesheets = headers.filter((h) => headerIds.includes(String(h.Id))
              && TS_STATE_RANK[String(h.Status)] < TS_STATE_RANK.pm_approved).length;
          }
          const rows = await r.list("HrmDemobCheck", {
            where: [
              { column: "ProjectId", op: "eq", value: projectId },
              { column: "PersonId", op: "eq", value: String(person.Id) },
            ],
            limit: 100,
          });
          checklist = demobProgress(rows);
        }

        const gate = canTransitionPerson({
          from, to, gates, openTimesheets,
          demobChecklist: checklist ? { done: checklist.mandatoryDone, mandatoryTotal: checklist.mandatoryTotal, pendingFa: checklist.pendingFa } : undefined,
          reasonFa,
        });
        if (!gate.ok) {
          const status = gate.code === "E-HRM-216" ? 409 : 422;
          return hrmBad(req, res, gate.code, gate.messageFa, status, gate.detailsFa);
        }

        const actor = hrmActor(req);
        const now = new Date().toISOString();
        const patch = { Status: to };
        if (to === "active") {
          patch.ActivatedAt = now;
          /* آینهٔ نتیجهٔ ایمنی فقط اینجا به‌روز می‌شود — مبنای تصمیم
           * نیست، فقط حافظهٔ آخرین استعلام برای نمایش سریع. */
          patch.HseClearance = "cleared";
          patch.HseCheckedAt = now;
        }
        if (to === "demobilized") patch.DemobilizedAt = now;
        if (to === "terminated") {
          patch.TerminationDate = HRM_TODAY();
          patch.ExitReasonFa = reasonFa.trim();
        }
        await r.patch("HrmPerson", person.Id, patch, actor);

        res.json(hrmOk(req, {
          id: person.Id,
          from, to,
          toFa: PERSON_STATUS_FA[to] ?? to,
          nextStates: personNextStates(to),
          messageFa: to === "active"
            ? `${person.FullNameFa} فعال شد و از امروز می‌تواند ساعت ثبت کند`
            : `وضعیت ${person.FullNameFa} به «${PERSON_STATUS_FA[to] ?? to}» تغییر کرد`,
        }));
      } catch (err) { next(err); }
    });
  } catch (err) { next(err); }
});

/** ثبت مدرک پرسنلی. */
app.post("/api/hrm/people/:id/docs", hrmRequire("hrm.doc.upload"), async (req, res, next) => {
  try {
    const projectId = hrmProjectOf(req, res);
    if (!projectId) return;
    const r = await repo();
    const person = await hrmPersonOf(r, projectId, req.params.id);
    if (!person) return hrmBad(req, res, "E-HRM-PERSON-NOT-FOUND", "پروندهٔ پرسنلی پیدا نشد", 404);

    const b = req.body ?? {};
    const docType = String(b.docType || "");
    const issues = [];
    if (!HRM_DOC_TYPES.includes(docType)) {
      issues.push({ code: "E-HRM-245", severity: "error", field: "docType", messageFa: "نوع مدرک نامعتبر است" });
    }
    const expiresAt = b.expiresAt ? String(b.expiresAt) : null;
    if (expiresAt && !/^\d{4}-\d{2}-\d{2}$/.test(expiresAt)) {
      issues.push({ code: "E-HRM-246", severity: "error", field: "expiresAt", messageFa: "تاریخ انقضا نامعتبر است" });
    }
    const issuedAt = b.issuedAt ? String(b.issuedAt) : null;
    if (issuedAt && expiresAt && expiresAt < issuedAt) {
      issues.push({ code: "E-HRM-247", severity: "error", field: "expiresAt", messageFa: "تاریخ انقضا پیش از تاریخ صدور است" });
    }
    if (issues.length) return hrmInvalid(req, res, issues);

    const docNo = String(b.docNo || "").trim();
    const dup = await r.findOne("HrmPersonDoc", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "PersonId", op: "eq", value: String(person.Id) },
      { column: "DocType", op: "eq", value: docType },
      { column: "DocNo", op: "eq", value: docNo },
    ]);
    if (dup) return hrmBad(req, res, "E-HRM-DOC-DUP", `مدرک ${HRM_DOC_TYPE_FA[docType]} با همین شماره از قبل ثبت شده است`, 409);

    const actor = hrmActor(req);
    const row = await r.create("HrmPersonDoc", {
      ProjectId: projectId,
      PersonId: String(person.Id),
      DocType: docType,
      DocNo: docNo,
      IssuedAt: issuedAt,
      ExpiresAt: expiresAt,
      FileRef: b.fileRef ?? null,
      IsBlocking: b.isBlocking === true,
      Status: "valid",
      /* بارگذاری تأیید نیست: مدرک تازه هنوز اصالت‌سنجی نشده. */
      VerifiedBy: null,
      VerifiedAt: null,
      NoteFa: b.noteFa ?? null,
    }, actor, "PDC");

    const st = docState(row, HRM_TODAY());
    res.status(201).json(hrmOk(req, {
      id: row.Id,
      docType,
      docTypeFa: HRM_DOC_TYPE_FA[docType],
      state: st.state,
      daysLeft: st.daysLeft,
      messageFa: `${HRM_DOC_TYPE_FA[docType]} بارگذاری شد؛ تا تأیید اصالت، در گیت‌ها به‌عنوان مدرک تأییدنشده شمرده می‌شود`,
    }));
  } catch (err) { next(err); }
});

/** تأیید اصالت مدرک — عمداً از بارگذاری جدا (SOD-24). */
app.post("/api/hrm/docs/:docId/verify", hrmRequire("hrm.doc.verify"), async (req, res, next) => {
  try {
    const projectId = hrmProjectOf(req, res);
    if (!projectId) return;
    const r = await repo();
    const doc = await r.findOne("HrmPersonDoc", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "Id", op: "eq", value: String(req.params.docId) },
    ]);
    if (!doc) return hrmBad(req, res, "E-HRM-DOC-NOT-FOUND", "مدرک پیدا نشد", 404);

    const reject = req.body?.reject === true;
    if (doc.VerifiedAt && !reject) {
      return hrmBad(req, res, "E-HRM-248", "این مدرک قبلاً تأیید شده است", 409);
    }
    if (reject && String(req.body?.reasonFa || "").trim().length < 5) {
      return hrmBad(req, res, "E-HRM-249", "دلیل رد مدرک باید دست‌کم ۵ نویسه باشد", 422);
    }

    const actor = hrmActor(req);
    await r.patch("HrmPersonDoc", doc.Id, reject
      ? { Status: "rejected", VerifiedBy: null, VerifiedAt: null, NoteFa: String(req.body.reasonFa).trim() }
      : { Status: "valid", VerifiedBy: actor, VerifiedAt: new Date().toISOString() },
      actor);

    res.json(hrmOk(req, {
      id: doc.Id,
      status: reject ? "rejected" : "valid",
      messageFa: reject
        ? `${HRM_DOC_TYPE_FA[String(doc.DocType)] ?? doc.DocType} رد شد`
        : `اصالت ${HRM_DOC_TYPE_FA[String(doc.DocType)] ?? doc.DocType} تأیید شد`,
    }));
  } catch (err) { next(err); }
});

/** ثبت یا به‌روزرسانی ارزیابی مهارت. */
app.post("/api/hrm/people/:id/skills", hrmRequire("hrm.skill.assess"), async (req, res, next) => {
  try {
    const projectId = hrmProjectOf(req, res);
    if (!projectId) return;
    const r = await repo();
    const person = await hrmPersonOf(r, projectId, req.params.id);
    if (!person) return hrmBad(req, res, "E-HRM-PERSON-NOT-FOUND", "پروندهٔ پرسنلی پیدا نشد", 404);

    const b = req.body ?? {};
    const skillCode = String(b.skillCode || "").trim();
    const level = Number(b.level ?? 0);
    const issues = [];
    if (!skillCode) issues.push({ code: "E-HRM-250", severity: "error", field: "skillCode", messageFa: "کد مهارت الزامی است" });
    if (!Number.isInteger(level) || level < 0 || level > 5) {
      issues.push({ code: "E-HRM-251", severity: "error", field: "level", messageFa: "سطح مهارت باید عددی صحیح بین ۰ تا ۵ باشد" });
    }
    if (issues.length) return hrmInvalid(req, res, issues);

    const actor = hrmActor(req);
    const payload = {
      SkillNameFa: b.skillNameFa ?? skillCode,
      Level: level,
      CertifiedAt: b.certifiedAt ?? null,
      ExpiresAt: b.expiresAt ?? null,
      EvidenceRef: b.evidenceRef ?? null,
      VerifiedBy: actor,
      IsBlocking: b.isBlocking === true,
      Status: "valid",
    };

    /* ارزیابی مجدد همان مهارت، رکورد تازه نمی‌سازد: تاریخچهٔ سطح در
     * سیاههٔ ممیزی است و دو ردیف فعال برای یک مهارت، ماتریس را
     * دوگانه می‌کرد. */
    const existing = await r.findOne("HrmSkill", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "PersonId", op: "eq", value: String(person.Id) },
      { column: "SkillCode", op: "eq", value: skillCode },
    ]);

    let id;
    if (existing) {
      await r.patch("HrmSkill", existing.Id, payload, actor);
      id = existing.Id;
    } else {
      const row = await r.create("HrmSkill", {
        ProjectId: projectId, PersonId: String(person.Id), SkillCode: skillCode, ...payload,
      }, actor, "SKL");
      id = row.Id;
    }

    const all = await hrmSkillsOf(r, projectId, person.Id);
    res.status(existing ? 200 : 201).json(hrmOk(req, {
      id, skillCode, level,
      updated: Boolean(existing),
      matrix: skillMatrix(all, HRM_TODAY()),
      messageFa: existing ? `سطح مهارت ${skillCode} به ${level} به‌روز شد` : `مهارت ${skillCode} با سطح ${level} ثبت شد`,
    }));
  } catch (err) { next(err); }
});

/** ثبت یا تغییر بند چک‌لیست تخلیه. */
app.post("/api/hrm/people/:id/demob-check", hrmRequire("hrm.person.demobilize"), async (req, res, next) => {
  try {
    const projectId = hrmProjectOf(req, res);
    if (!projectId) return;
    const r = await repo();
    const person = await hrmPersonOf(r, projectId, req.params.id);
    if (!person) return hrmBad(req, res, "E-HRM-PERSON-NOT-FOUND", "پروندهٔ پرسنلی پیدا نشد", 404);

    const itemCode = String(req.body?.itemCode || "");
    if (!DEMOB_ITEMS.includes(itemCode)) {
      return hrmBad(req, res, "E-HRM-252", "بند چک‌لیست نامعتبر است", 422);
    }

    const actor = hrmActor(req);
    const isDone = req.body?.isDone !== false;
    const existing = await r.findOne("HrmDemobCheck", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "PersonId", op: "eq", value: String(person.Id) },
      { column: "ItemCode", op: "eq", value: itemCode },
    ]);
    const payload = {
      IsDone: isDone,
      DoneBy: isDone ? actor : null,
      DoneAt: isDone ? new Date().toISOString() : null,
      NoteFa: req.body?.noteFa ?? null,
      IsMandatory: req.body?.isMandatory === undefined ? !DEMOB_OPTIONAL.includes(itemCode) : req.body.isMandatory === true,
    };
    if (existing) await r.patch("HrmDemobCheck", existing.Id, payload, actor);
    else await r.create("HrmDemobCheck", { ProjectId: projectId, PersonId: String(person.Id), ItemCode: itemCode, ...payload }, actor, "DMC");

    const rows = await r.list("HrmDemobCheck", {
      where: [
        { column: "ProjectId", op: "eq", value: projectId },
        { column: "PersonId", op: "eq", value: String(person.Id) },
      ],
      limit: 100,
    });
    const progress = demobProgress(rows);
    res.json(hrmOk(req, {
      personId: person.Id,
      itemCode,
      progress,
      messageFa: progress.isComplete
        ? "چک‌لیست تخلیه کامل شد؛ نفر آمادهٔ تخلیه است"
        : `${progress.mandatoryDone} از ${progress.mandatoryTotal} بند اجباری انجام شده`,
    }));
  } catch (err) { next(err); }
});

/** پایش مدارک رو به انقضا — مبنای هشدار زودهنگام EWS-HRM-04. */
app.get("/api/hrm/expiry-watch", hrmRequire("hrm.person.view"), async (req, res, next) => {
  try {
    const projectId = hrmProjectOf(req, res);
    if (!projectId) return;
    const todayIso = String(req.query.onDate || HRM_TODAY());
    const horizon = Number(req.query.horizonDays ?? DOC_EXPIRY_WARN_DAYS);

    const r = await repo();
    const [docs, people] = await Promise.all([
      hrmDocsOf(r, projectId),
      r.list("HrmPerson", { where: [{ column: "ProjectId", op: "eq", value: projectId }], limit: 5000 }),
    ]);
    const nameBy = new Map(people.map((p) => [String(p.Id), { nameFa: String(p.FullNameFa ?? ""), no: String(p.PersonnelNo ?? ""), status: String(p.Status ?? "") }]));

    const items = expiryWatch(docs, todayIso, horizon).map((x) => ({
      ...x,
      personNameFa: nameBy.get(x.personId)?.nameFa ?? x.personId,
      personnelNo: nameBy.get(x.personId)?.no ?? "",
      personStatus: nameBy.get(x.personId)?.status ?? "",
    }));

    res.json(hrmOk(req, {
      onDate: todayIso,
      horizonDays: horizon,
      items,
      summary: {
        total: items.length,
        expired: items.filter((x) => x.daysLeft < 0).length,
        /* منقضیِ مسدودکنندهٔ نفرِ فعال بدترین حالت است: او همین الان
         * سر کار است و سامانه مجازش می‌داند. */
        blockingExpiredActive: items.filter((x) => x.daysLeft < 0 && x.isBlocking && x.personStatus === "active").length,
      },
    }));
  } catch (err) { next(err); }
});

/* ─────────── درخواست تجهیز نیرو ─────────── */

/** فهرست درخواست‌های تجهیز، با تفکیک وضعیت برای کانبان. */
app.get("/api/hrm/mob-requests", hrmRequire("hrm.person.view"), async (req, res, next) => {
  try {
    const projectId = hrmProjectOf(req, res);
    if (!projectId) return;
    const r = await repo();
    const rows = await r.list("HrmMobRequest", {
      where: [{ column: "ProjectId", op: "eq", value: projectId }],
      limit: 2000,
    });

    const byState = {};
    for (const x of rows) byState[String(x.Status)] = (byState[String(x.Status)] ?? 0) + 1;
    const todayIso = HRM_TODAY();

    res.json(hrmOk(req, {
      items: rows
        .sort((a, b) => String(a.NeedByDate).localeCompare(String(b.NeedByDate)))
        .map((x) => ({
          id: x.Id,
          requestNo: x.RequestNo,
          requestType: x.RequestType,
          requestTypeFa: MOB_REQUEST_TYPE_FA[String(x.RequestType)] ?? x.RequestType,
          tradeCode: x.TradeCode,
          qty: Number(x.Qty ?? 0),
          fulfilledQty: Number(x.FulfilledQty ?? 0),
          fulfilledPct: Number(x.Qty ?? 0) > 0 ? Math.round((Number(x.FulfilledQty ?? 0) / Number(x.Qty)) * 100) : 0,
          needByDate: x.NeedByDate,
          /* درخواست عقب‌افتاده باید در کانبان دیده شود، نه اینکه با
           * بقیه یکسان بنشیند. */
          isOverdue: String(x.NeedByDate ?? "") < todayIso && !["fulfilled", "cancelled", "rejected"].includes(String(x.Status)),
          obsNodeId: x.ObsNodeId ?? null,
          crewId: x.CrewId ?? null,
          justificationFa: x.JustificationFa,
          status: x.Status,
          statusFa: MOB_REQ_STATE_FA[String(x.Status)] ?? x.Status,
          approvedBy: x.ApprovedBy ?? null,
          rejectReasonFa: x.RejectReasonFa ?? null,
        })),
      byState,
      summary: {
        total: rows.length,
        openQty: rows.filter((x) => !["fulfilled", "cancelled", "rejected"].includes(String(x.Status)))
          .reduce((s, x) => s + (Number(x.Qty ?? 0) - Number(x.FulfilledQty ?? 0)), 0),
        overdueCount: rows.filter((x) => String(x.NeedByDate ?? "") < todayIso
          && !["fulfilled", "cancelled", "rejected"].includes(String(x.Status))).length,
      },
    }));
  } catch (err) { next(err); }
});

/** ثبت درخواست تجهیز. */
app.post("/api/hrm/mob-requests", hrmRequire("hrm.mob.request"), async (req, res, next) => {
  try {
    const projectId = hrmProjectOf(req, res);
    if (!projectId) return;
    const b = req.body ?? {};
    const todayIso = HRM_TODAY();

    const issues = validateMobRequest({
      requestType: String(b.requestType || "mobilize"),
      tradeCode: String(b.tradeCode || ""),
      qty: Number(b.qty ?? 0),
      needByDate: String(b.needByDate || ""),
      justificationFa: String(b.justificationFa || ""),
      todayIso,
    });
    if (issues.some((i) => i.severity === "error")) return hrmInvalid(req, res, issues);

    const r = await repo();
    const requestNo = String(b.requestNo || "").trim() || `MR-${Date.now().toString(36).toUpperCase()}`;
    const dup = await r.findOne("HrmMobRequest", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "RequestNo", op: "eq", value: requestNo },
    ]);
    if (dup) return hrmBad(req, res, "E-HRM-MOB-DUP", `درخواست ${requestNo} از قبل ثبت شده است`, 409);

    const actor = hrmActor(req);
    const row = await r.create("HrmMobRequest", {
      ProjectId: projectId,
      RequestNo: requestNo,
      RequestType: String(b.requestType || "mobilize"),
      TradeCode: String(b.tradeCode),
      Qty: Number(b.qty),
      NeedByDate: String(b.needByDate),
      ObsNodeId: b.obsNodeId ?? null,
      CrewId: b.crewId ?? null,
      PlanLineRef: b.planLineRef ?? null,
      JustificationFa: String(b.justificationFa).trim(),
      FulfilledQty: 0,
      FulfilledAt: null,
      Status: "draft",
      SubmittedBy: actor,
      ApprovedBy: null,
      ApprovedAt: null,
      RejectReasonFa: null,
    }, actor, "MRQ");

    res.status(201).json(hrmOk(req, {
      id: row.Id, requestNo, status: "draft",
      warnings: issues.filter((i) => i.severity === "warning"),
      messageFa: `درخواست ${requestNo} برای ${b.qty} نفر ${b.tradeCode} ثبت شد`,
    }));
  } catch (err) { next(err); }
});

/**
 * گذار وضعیت درخواست تجهیز.
 *
 * `approved` مجوز جداگانه دارد (SOD-25): درخواست تعهد بودجهٔ نفر-ساعت
 * است و تأییدش با کسی است که پاسخ‌گوی هزینه است.
 */
app.post("/api/hrm/mob-requests/:id/transition", async (req, res, next) => {
  try {
    const to = String(req.body?.to || "");
    const permission = to === "approved" ? "hrm.mob.approve" : "hrm.mob.request";

    return hrmRequire(permission)(req, res, async () => {
      try {
        const projectId = hrmProjectOf(req, res);
        if (!projectId) return;
        const r = await repo();
        const row = await r.findOne("HrmMobRequest", [
          { column: "ProjectId", op: "eq", value: projectId },
          { column: "Id", op: "eq", value: String(req.params.id) },
        ]);
        if (!row) return hrmBad(req, res, "E-HRM-MOB-NOT-FOUND", "درخواست تجهیز پیدا نشد", 404);

        const fulfilledQty = req.body?.fulfilledQty === undefined
          ? Number(row.FulfilledQty ?? 0)
          : Number(req.body.fulfilledQty);
        const gate = canTransitionMobRequest({
          from: String(row.Status ?? "draft"),
          to,
          fulfilledQty,
          qty: Number(row.Qty ?? 0),
          reasonFa: String(req.body?.reasonFa || ""),
        });
        if (!gate.ok) return hrmBad(req, res, gate.code, gate.messageFa, 422, gate.detailsFa);

        const actor = hrmActor(req);
        const now = new Date().toISOString();
        const patch = { Status: to, FulfilledQty: fulfilledQty };
        if (to === "approved") { patch.ApprovedBy = actor; patch.ApprovedAt = now; }
        if (to === "rejected" || to === "cancelled") patch.RejectReasonFa = String(req.body.reasonFa).trim();
        if (to === "fulfilled") patch.FulfilledAt = now;
        await r.patch("HrmMobRequest", row.Id, patch, actor);

        res.json(hrmOk(req, {
          id: row.Id,
          from: row.Status,
          to,
          toFa: MOB_REQ_STATE_FA[to] ?? to,
          fulfilledQty,
          messageFa: `درخواست ${row.RequestNo} به «${MOB_REQ_STATE_FA[to] ?? to}» رفت`,
        }));
      } catch (err) { next(err); }
    });
  } catch (err) { next(err); }
});

/* ═══════════════ HRM · D8 — تحلیل، هیستوگرام و گزارش ═══════════════
 *
 * این لایه هیچ حقیقت تازه‌ای نمی‌سازد؛ فقط آنچه D4 تا D7 ثبت کرده‌اند
 * را کنار هم می‌گذارد. تنها استثنا برنامهٔ مبناست که جای دیگری ندارد.
 *
 * قاعدهٔ حاکم: هر عددی که از داده‌ای مشتق نشده باشد `null` است، نه
 * صفر. داشبوردی که «نمی‌دانیم» را سبز نشان بدهد بدتر از نبودنش است.
 */

/** ماه میلادی یک تاریخ `YYYY-MM-DD` ⇒ `YYYY-MM`. */
function hrmPeriodOfDate(iso) {
  return String(iso ?? "").slice(0, 7);
}

/** دوره‌های بین دو کد ماه، شامل هر دو سر. */
function hrmPeriodRange(fromCode, toCode) {
  const out = [];
  if (!/^\d{4}-\d{2}$/.test(fromCode) || !/^\d{4}-\d{2}$/.test(toCode)) return out;
  let [y, m] = fromCode.split("-").map(Number);
  const [ty, tm] = toCode.split("-").map(Number);
  /* سقف سخت، تا ورودی وارونه یا بازهٔ ده‌ساله حلقه را بی‌نهایت نکند. */
  for (let guard = 0; guard < 240; guard++) {
    if (y > ty || (y === ty && m > tm)) break;
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}

/**
 * گردآوری یک‌بارهٔ همهٔ دادهٔ خام تحلیل.
 *
 * همهٔ جدول‌ها یک‌جا خوانده می‌شوند و بقیه در حافظه گروه می‌شود؛
 * پرس‌وجو به ازای هر دوره یعنی N+1 روی بازهٔ دوازده‌ماهه.
 */
async function hrmAnalyticsRaw(r, projectId, opts) {
  const revision = opts.revision || "baseline";
  const [plans, headers, entries, subAtt, subContracts, people, docs, skills, conflicts] = await Promise.all([
    r.list("HrmManpowerPlan", {
      where: [
        { column: "ProjectId", op: "eq", value: projectId },
        { column: "Revision", op: "eq", value: revision },
      ],
      limit: 20000,
    }),
    r.list("HrmTimesheetHeader", { where: [{ column: "ProjectId", op: "eq", value: projectId }], limit: 20000 }),
    r.list("HrmTimesheetEntry", { where: [{ column: "ProjectId", op: "eq", value: projectId }], limit: 50000 }),
    r.list("HrmSubAttendance", { where: [{ column: "ProjectId", op: "eq", value: projectId }], limit: 20000 }),
    r.list("HrmSubContract", { where: [{ column: "ProjectId", op: "eq", value: projectId }], limit: 2000 }),
    r.list("HrmPerson", { where: [{ column: "ProjectId", op: "eq", value: projectId }], limit: 5000 }),
    hrmDocsOf(r, projectId),
    hrmSkillsOf(r, projectId),
    /* یافتهٔ لوپ ۱۰: تحلیل نمی‌دانست دادهٔ نرسیده وجود دارد و با
     * اطمینان کامل عدد می‌داد. تعارض باز یعنی بخشی از کارکرد هنوز
     * تکلیفش روشن نیست — و این باید روی داشبورد دیده شود، نه فقط
     * در کارتابل همگام‌سازی. */
    r.list("HrmSyncConflict", {
      where: [
        { column: "ProjectId", op: "eq", value: projectId },
        { column: "Status", op: "eq", value: "open" },
      ],
      limit: 5000,
    }),
  ]);

  /* فقط ساعت تأییدشده وارد تحلیل می‌شود. برگهٔ پیش‌نویس هنوز ادعاست،
   * و ادعا در گزارشی که مبنای مطالبه می‌شود جایی ندارد.
   *
   * آستانه همان `HRM_PROD_MIN_RANK` بهره‌وری است، نه یک مقایسهٔ رشته‌ای
   * تازه: حالت «تأییدشده» در این ماشین `pm_approved` نام دارد و هر
   * تعریف موازی، دو عدد متفاوت از یک حقیقت می‌سازد. */
  const approvedHeaders = new Set(
    headers
      .filter((h) => (TS_STATE_RANK[String(h.Status)] ?? -1) >= HRM_PROD_MIN_RANK)
      .map((h) => String(h.Id))
  );
  const liveEntries = entries.filter(
    (e) => !e.VoidedAt && approvedHeaders.has(String(e.HeaderId))
  );
  /* ردیف ردشدهٔ پیمانکاری کنار می‌رود؛ بقیه (حتی تأییدنشده) می‌ماند
   * چون مسیر تأییدش صورت‌وضعیت است نه برگهٔ روزانه — همان تفکیکی که
   * در D6 برای تابلوی اکیپ گذاشته شد. */
  const liveSub = subAtt.filter((a) => String(a.Status ?? "") !== "rejected");

  return { plans, headers, entries: liveEntries, subAtt: liveSub, subContracts, people, docs, skills, conflicts };
}

/**
 * ساخت نمای کامل تحلیل از دادهٔ خام.
 *
 * یک تابع برای هر سه مسیر (تحلیل، هیستوگرام، گزارش) تا سه عدد متفاوت
 * از یک حقیقت بیرون نیاید — همان درس D5.
 */
function hrmBuildAnalytics(raw, { fromCode, toCode, todayIso, groupBy }) {
  const { plans, entries, subAtt, subContracts, people, docs, skills, conflicts = [] } = raw;

  /* دوره‌های موجود در داده؛ اگر بازه داده شده باشد ماه‌های خالی هم
   * ساخته می‌شوند تا شکاف در نمودار دیده شود نه اینکه حذف شود. */
  const seen = new Set();
  for (const p of plans) seen.add(String(p.PeriodCode));
  for (const e of entries) seen.add(hrmPeriodOfDate(e.WorkDate));
  for (const a of subAtt) seen.add(hrmPeriodOfDate(a.WorkDate));
  seen.delete("");
  let periods = [...seen].sort();
  if (fromCode && toCode) {
    const span = hrmPeriodRange(fromCode, toCode);
    periods = span.length > 0 ? span : periods.filter((c) => c >= fromCode && c <= toCode);
  }
  const inRange = new Set(periods);

  /* تجمیع دوره‌ای. */
  const planBy = new Map();
  for (const p of plans) {
    const k = String(p.PeriodCode);
    if (!inRange.has(k)) continue;
    const cur = planBy.get(k) ?? { mh: 0, hc: 0 };
    cur.mh += Number(p.PlannedMh ?? 0);
    cur.hc += Number(p.PlannedHeadcount ?? 0);
    planBy.set(k, cur);
  }

  const directBy = new Map();
  const peopleBy = new Map();
  for (const e of entries) {
    const k = hrmPeriodOfDate(e.WorkDate);
    if (!inRange.has(k)) continue;
    directBy.set(k, (directBy.get(k) ?? 0) + Number(e.HoursRaw ?? 0));
    if (!peopleBy.has(k)) peopleBy.set(k, new Set());
    peopleBy.get(k).add(String(e.PersonId));
  }

  const subBy = new Map();
  const subHeadBy = new Map();
  for (const a of subAtt) {
    const k = hrmPeriodOfDate(a.WorkDate);
    if (!inRange.has(k)) continue;
    subBy.set(k, (subBy.get(k) ?? 0) + Number(a.TotalHours ?? 0));
    /* نیروی پیمانکاری گروهی ثبت می‌شود و هویت فردی ندارد؛ بیشینهٔ
     * روزانه تقریب معقولی از «چند نفر آنجا بودند» است — جمع کردنِ
     * روزها همان نفر را چندین بار می‌شمرد. */
    subHeadBy.set(k, Math.max(subHeadBy.get(k) ?? 0, Number(a.Headcount ?? 0)));
  }

  const histRows = periods.map((code) => {
    const pl = planBy.get(code);
    const direct = directBy.get(code) ?? 0;
    const sub = subBy.get(code) ?? 0;
    const hasActual = directBy.has(code) || subBy.has(code);
    return {
      periodCode: code,
      plannedMh: pl ? pl.mh : null,
      plannedHeadcount: pl ? pl.hc : null,
      directMh: direct,
      subMh: sub,
      actualHeadcount: hasActual ? (peopleBy.get(code)?.size ?? 0) + (subHeadBy.get(code) ?? 0) : null,
    };
  });

  const histogram = manpowerHistogram(histRows);
  const sCurve = manpowerSCurve(histogram.bars);

  /* تجمیع رسته‌ای یا سازمانی. */
  const key = groupBy === "obs" ? "obs" : groupBy === "cbs" ? "cbs" : "trade";
  const bdRows = [];
  for (const e of entries) {
    if (!inRange.has(hrmPeriodOfDate(e.WorkDate))) continue;
    bdRows.push({
      key: String((key === "cbs" ? e.CbsId : key === "obs" ? e.ObsNodeId : e.TradeCode) ?? "—"),
      directMh: Number(e.HoursRaw ?? 0),
      subMh: 0,
      personId: String(e.PersonId ?? ""),
    });
  }
  const subByContract = new Map(subContracts.map((c) => [String(c.Id), c]));
  for (const a of subAtt) {
    if (!inRange.has(hrmPeriodOfDate(a.WorkDate))) continue;
    const contract = subByContract.get(String(a.SubContractId));
    bdRows.push({
      key: String(
        (key === "cbs" ? a.CbsId : key === "obs" ? contract?.ObsNodeId : a.TradeCode) ?? "—"
      ),
      directMh: 0,
      subMh: Number(a.TotalHours ?? 0),
      /* شناسهٔ ساختگی، تا نفرات گروهی با نفرات مستقیم قاطی نشوند و
       * سرشماری یکتا معنا بدهد. */
      personId: `sub:${a.SubContractId}:${a.WorkDate}`,
    });
  }
  const breakdown = mhBreakdown(bdRows, (k) =>
    key === "trade" ? (TRADE_BY_CODE[k]?.fa ?? k) : k
  );

  /* پنل انطباق برای شاخص‌های پرسنلی. */
  const docsBy = {};
  for (const d of docs) (docsBy[String(d.PersonId)] ??= []).push(d);
  const skillsBy = {};
  for (const sk of skills) (skillsBy[String(sk.PersonId)] ??= []).push(sk);
  const panel = compliancePanel(people, docsBy, skillsBy, todayIso);

  /* گردش نیرو در بازه: تخلیه‌شده‌ها و پایان‌یافته‌ها. */
  const leavers = people.filter((p) => ["demobilized", "terminated"].includes(String(p.Status ?? ""))).length;

  const totalHours = histogram.totals.actualMh;
  let otHours = 0;
  for (const e of entries) {
    if (!inRange.has(hrmPeriodOfDate(e.WorkDate))) continue;
    otHours += Number(e.HoursOt ?? 0);
  }
  let unproductive = 0;
  for (const e of entries) {
    if (!inRange.has(hrmPeriodOfDate(e.WorkDate))) continue;
    if (!(e.IsProductive === true || e.IsProductive === 1)) unproductive += Number(e.HoursRaw ?? 0);
  }

  /* سرشماری صفر در کنار ساعت ثبت‌شده تناقض است، نه واقعیت: یعنی
   * دفتر پرسنلی هنوز پر نشده. `null` می‌رود تا داشبورد «نمی‌دانیم»
   * بگوید نه «هیچ‌کس اینجا نیست». */
  const hasHours = histogram.totals.actualMh > 0;
  const activeHeadcount = panel.activeCount > 0 ? panel.activeCount : (hasHours ? null : 0);

  /* مخرج نرخ استفاده **ظرفیت** دوره است نه ساعت ثبت‌شده. با مخرجِ
   * ثبت‌شده، پروژه‌ای که یک‌دهم برنامه کار کرده هم ۱۰۰٪ سبز می‌شد. */
  const capacity = capacityMh(activeHeadcount, periods);

  /* صورت و مخرج انطباق باید یک جمعیت باشند. `panel.compliantCount`
   * همهٔ پرونده‌ها را می‌شمارد (از جمله نامزدهایی که هنوز سر کار
   * نیامده‌اند) و کنار مخرجِ «فعال» عددی بی‌معنا — گاهی بالای صد
   * درصد — می‌سازد. فقط نفرات فعال شمرده می‌شوند. */
  const activeCompliant = panel.rows.filter((x) => x.status === "active" && x.isCompliant).length;

  const kpis = hrKpiSet({
    activeHeadcount,
    periodStartHeadcount: (activeHeadcount ?? 0) + leavers,
    leaversInPeriod: leavers,
    compliantCount: activeCompliant,
    totalPeople: panel.activeCount,
    availableHours: capacity ?? 0,
    /* ساعت غیربهره‌ور از صورت کسر می‌شود نه از مخرج، چون آدم آنجا
     * بوده و هزینه‌اش پرداخت شده. */
    chargedHours: round2Srv(histogram.totals.directMh - unproductive),
    otHours: round2Srv(otHours),
    totalHours: histogram.totals.directMh,
    subMh: histogram.totals.subMh,
    directMh: histogram.totals.directMh,
  });

  const alerts = hrAnalyticsAlerts({
    kpis,
    histogram,
    sCurve,
    blockedActiveCount: panel.blockedActiveCount,
    expiringSoonCount: panel.expiringSoonCount,
    openSyncConflicts: conflicts.length,
  });

  return {
    periods,
    histogram,
    sCurve,
    breakdown,
    groupBy: key,
    kpis,
    alerts,
    capacityMh: capacity,
    openSyncConflicts: conflicts.length,
    compliance: {
      headcount: panel.headcount,
      activeCount: panel.activeCount,
      compliantCount: panel.compliantCount,
      activeCompliantCount: activeCompliant,
      blockedActiveCount: panel.blockedActiveCount,
      expiringSoonCount: panel.expiringSoonCount,
      byStatus: panel.byStatus,
      /* هر دو از خروجی موجود برداشته می‌شوند، نه محاسبهٔ دوباره —
       * وگرنه سند رسمی و داشبورد می‌توانستند دو رقم بدهند. */
      activeHeadcount,
      compliancePct: kpis.find((k) => k.code === "COMPLIANCE_PCT")?.value ?? null,
    },
    headlineFa: hrHeadlineFa(kpis, alerts),
  };
}

function round2Srv(n) { return Math.round(Number(n ?? 0) * 100) / 100; }

/**
 * انتشار یک رویداد در صندوق خروجی — کمکی مشترک (رفع TD-HRM-15).
 *
 * پیش از این فقط `hrm.labor.posted` منتشر می‌شد و منطقش درون‌خطی در
 * مسیر ارسال هزینه بود. دو رویداد دیگر کاتالوگ قرارداد داشتند ولی
 * هیچ‌جا صدا زده نمی‌شدند — یعنی مصرف‌کننده روی چیزی حساب باز می‌کرد
 * که هرگز نمی‌آمد.
 *
 * سه قاعده که در پیاده‌سازی اول با آزمون زنده به‌دست آمد و اینجا
 * یک‌جا نگه داشته می‌شوند:
 *
 *   ۱) رویداد ناقص در صندوق **نمی‌نشیند** — بارها تلاش و بارها شکست
 *      می‌خورد. در سیاهه ثبت می‌شود تا دیده شود.
 *   ۲) رویداد **تحویل‌شده** بازنویسی نمی‌شود؛ اصلاح، رویدادِ `#rN`
 *      تازه می‌سازد. وگرنه رقمی که سامانهٔ بیرونی گرفته بی‌رد گم
 *      می‌شود.
 *   ۳) تکرار با **همان مقدار** رویداد تازه نمی‌سازد.
 *
 * `compareKey` می‌گوید کدام فیلد بار، «همان مقدار» را تعریف می‌کند.
 * برای هزینه `amount` است؛ برای قفل دوره چیزی نیست، چون آن رخداد
 * یکتاست و تکرارش معنا ندارد.
 */
async function hrmEmit(r, req, input) {
  const { envelope, issues } = buildEvent({
    type: input.type,
    projectId: input.projectId,
    keyParts: input.keyParts,
    entityName: input.entityName,
    entityId: input.entityId,
    occurredAt: input.occurredAt,
    payload: input.payload,
  });

  if (!envelope) {
    await hrmAudit(r, req, "HRM_EVENT_BUILD_FAILED", {
      projectId: input.projectId,
      entityName: "IntegrationEvent",
      entityId: String(input.entityId ?? input.type),
      severity: "warning",
      eventType: input.type,
      issues: issues.map((x) => x.code),
    });
    return { emitted: false, reason: "invalid" };
  }

  const actor = hrmActor(req);
  let key = envelope.eventKey;

  const prior = await r.findOne("IntegrationEvent", [
    { column: "EventKey", op: "eq", value: envelope.eventKey },
  ]);

  if (prior && String(prior.Status) === "delivered") {
    const field = input.compareKey;
    if (!field) return { emitted: false, reason: "already_delivered" };

    let priorVal = null;
    try { priorVal = JSON.parse(String(prior.PayloadJson ?? "{}"))[field]; } catch { priorVal = null; }
    const same =
      priorVal !== null && priorVal !== undefined &&
      round2Srv(Number(priorVal)) === round2Srv(Number(envelope.payload[field]));
    if (same) return { emitted: false, reason: "unchanged" };

    const siblings = await r.list("IntegrationEvent", {
      where: [
        { column: "ProjectId", op: "eq", value: input.projectId },
        { column: "EntityId", op: "eq", value: envelope.entityId },
      ],
      limit: 100,
    });
    key = `${envelope.eventKey}#r${siblings.length}`;
    envelope.payload.supersedesValue = priorVal;
    envelope.payload.revision = siblings.length;
  }

  await r.upsert(
    "IntegrationEvent",
    { EventKey: key },
    {
      EventKey: key,
      EventType: envelope.eventType,
      SchemaVersion: envelope.schemaVersion,
      SourceModule: envelope.sourceModule,
      TargetModule: envelope.targetModule,
      ProjectId: input.projectId,
      EntityName: envelope.entityName ?? null,
      EntityId: envelope.entityId ?? null,
      PayloadJson: JSON.stringify(envelope.payload).slice(0, 7900),
      Status: "pending",
      OccurredAt: envelope.occurredAt,
      AttemptCount: 0,
      EmittedBy: actor,
    },
    actor,
  );

  return { emitted: true, eventKey: key };
}


/**
 * ثبت ممیزی سمت سرور روی جدول `AuditLog` — رفع جزئی TD-HRM-01.
 *
 * `writeAudit` قدیمی به `pool` واقعی SQL نیاز دارد و با درایور JSON
 * کار نمی‌کند؛ این نسخه از همان مخزنی می‌نویسد که بقیهٔ داده در آن
 * است. عمداً فقط روی صدور گزارش رسمی نشسته: آن سند مبنای مطالبه
 * می‌شود و ممیزی سمت مرورگر برایش کافی نیست — کلاینت می‌تواند دروغ
 * بگوید یا اصلاً چیزی نفرستد.
 */
async function hrmAudit(r, req, action, details) {
  try {
    await r.create("AuditLog", {
      At: new Date().toISOString(),
      SubjectId: hrmActor(req),
      Action: action,
      ProjectCode: details.projectId ?? null,
      EntityName: details.entityName ?? null,
      EntityId: details.entityId ?? null,
      Severity: details.severity ?? "info",
      Details: { traceId: req.requestId, ...details },
    }, hrmActor(req));
  } catch {
    /* شکست ممیزی نباید پاسخ کاربر را بیندازد، ولی سکوت هم نمی‌کند:
     * در سیاههٔ سرور دیده می‌شود. */
    console.error(`[${req.requestId}] hrmAudit failed for ${action}`);
  }
}

/** ثابت‌های لایهٔ تحلیل — UI برچسب و آستانه را از اینجا می‌گیرد. */
app.get("/api/hrm/analytics-meta", hrmRequire("hrm.analytics.view"), (req, res) => {
  res.json(hrmOk(req, {
    kpis: HR_KPI_CODES.map((c) => ({ code: c, fa: HR_KPI_FA[c], ...(HR_KPI_TARGETS[c] ?? {}) })),
    varianceThreshold: HISTOGRAM_VARIANCE_THRESHOLD,
    groupBy: [
      { code: "trade", fa: "رسته" },
      { code: "cbs", fa: "شکست هزینه" },
      { code: "obs", fa: "واحد سازمانی" },
    ],
  }));
});

/** نمای کامل تحلیل — خواندنی محض، هیچ چیزی ذخیره نمی‌شود. */
app.get("/api/hrm/analytics", hrmRequire("hrm.analytics.view"), async (req, res, next) => {
  try {
    const projectId = hrmProjectOf(req, res);
    if (!projectId) return;
    const fromCode = String(req.query.from || "");
    const toCode = String(req.query.to || "");
    if ((fromCode && !toCode) || (toCode && !fromCode)) {
      return hrmBad(req, res, "E-HRM-RANGE", "بازه باید هر دو سر را داشته باشد (from و to)");
    }
    if (fromCode && toCode && fromCode > toCode) {
      return hrmBad(req, res, "E-HRM-RANGE-ORDER", "شروع بازه بعد از پایان آن است");
    }

    const r = await repo();
    const raw = await hrmAnalyticsRaw(r, projectId, { revision: String(req.query.revision || "") });
    const view = hrmBuildAnalytics(raw, {
      fromCode, toCode,
      todayIso: String(req.query.onDate || HRM_TODAY()),
      groupBy: String(req.query.groupBy || "trade"),
    });

    res.json(hrmOk(req, {
      projectId,
      from: fromCode || (view.periods[0] ?? null),
      to: toCode || (view.periods[view.periods.length - 1] ?? null),
      revision: String(req.query.revision || "baseline"),
      ...view,
    }));
  } catch (err) { next(err); }
});

/** فقط هیستوگرام و منحنی S — سبک‌تر، برای نمودار زنده. */
app.get("/api/hrm/histogram", hrmRequire("hrm.analytics.view"), async (req, res, next) => {
  try {
    const projectId = hrmProjectOf(req, res);
    if (!projectId) return;
    const r = await repo();
    const raw = await hrmAnalyticsRaw(r, projectId, { revision: String(req.query.revision || "") });
    const view = hrmBuildAnalytics(raw, {
      fromCode: String(req.query.from || ""),
      toCode: String(req.query.to || ""),
      todayIso: String(req.query.onDate || HRM_TODAY()),
      groupBy: "trade",
    });
    res.json(hrmOk(req, {
      bars: view.histogram.bars,
      totals: view.histogram.totals,
      sCurve: view.sCurve,
      varianceThreshold: HISTOGRAM_VARIANCE_THRESHOLD,
    }));
  } catch (err) { next(err); }
});

/* ─────────── برنامهٔ مبنای نیرو ─────────── */

/** فهرست ردیف‌های مبنا. */
app.get("/api/hrm/manpower-plan", hrmRequire("hrm.analytics.view"), async (req, res, next) => {
  try {
    const projectId = hrmProjectOf(req, res);
    if (!projectId) return;
    const r = await repo();
    const where = [{ column: "ProjectId", op: "eq", value: projectId }];
    const revision = String(req.query.revision || "");
    if (revision) where.push({ column: "Revision", op: "eq", value: revision });
    const rows = await r.list("HrmManpowerPlan", { where, limit: 20000 });

    /* فهرست بازنگری‌ها از خود داده مشتق می‌شود؛ جدول جداگانه برای
     * نگهداری نامشان یک جدول اضافه بود که همیشه با داده واگرا می‌شد. */
    const revisions = [...new Set(rows.map((x) => String(x.Revision ?? "baseline")))].sort();
    res.json(hrmOk(req, {
      rows: rows.slice().sort((a, b) => String(a.PeriodCode).localeCompare(String(b.PeriodCode))),
      revisions,
      totalPlannedMh: round2Srv(rows.reduce((s, x) => s + Number(x.PlannedMh ?? 0), 0)),
    }));
  } catch (err) { next(err); }
});

/**
 * ثبت یا به‌روزرسانی ردیف‌های مبنا (دسته‌ای).
 *
 * `upsert` روی کلید یکتا، تا ارسال دوبارهٔ همان فایل برنامه دو مبنای
 * موازی نسازد. بدون آن، هر بارگذاری مجدد انحراف را دو برابر می‌کرد.
 */
app.post("/api/hrm/manpower-plan", hrmRequire("hrm.plan.baseline"), async (req, res, next) => {
  try {
    const projectId = hrmProjectOf(req, res);
    if (!projectId) return;
    const revision = String(req.body?.revision || "baseline").trim();
    const lines = Array.isArray(req.body?.lines) ? req.body.lines : [];
    if (lines.length === 0) return hrmBad(req, res, "E-HRM-PLAN-EMPTY", "هیچ ردیف برنامه‌ای ارسال نشد");
    if (lines.length > 2000) return hrmBad(req, res, "E-HRM-PLAN-BULK", "بیش از ۲۰۰۰ ردیف در یک درخواست");

    const issues = [];
    lines.forEach((l, i) => {
      if (!/^\d{4}-\d{2}$/.test(String(l?.periodCode ?? ""))) {
        issues.push({ field: `lines[${i}].periodCode`, code: "E-HRM-PLAN-PERIOD", messageFa: "کد دوره باید قالب YYYY-MM داشته باشد" });
      }
      if (Number(l?.plannedMh ?? 0) < 0 || Number(l?.plannedHeadcount ?? 0) < 0) {
        issues.push({ field: `lines[${i}]`, code: "E-HRM-PLAN-NEGATIVE", messageFa: "نفر-ساعت یا سرشماری منفی پذیرفته نیست" });
      }
    });
    if (issues.length > 0) return hrmInvalid(req, res, issues);

    const actor = hrmActor(req);
    const r = await repo();

    /* یک‌بار خواندن و نمایه کردن در حافظه، به‌جای یک `findOne` به ازای
     * هر ردیف: بارگذاری یک برنامهٔ دوساله دو هزار رفت‌وبرگشت می‌شد. */
    const current = await r.list("HrmManpowerPlan", {
      where: [
        { column: "ProjectId", op: "eq", value: projectId },
        { column: "Revision", op: "eq", value: revision },
      ],
      limit: 20000,
    });
    const byKey = new Map(
      current.map((x) => [`${x.PeriodCode}|${String(x.TradeCode ?? "")}`, x])
    );

    let created = 0, updated = 0;
    for (const l of lines) {
      const keys = {
        ProjectId: projectId,
        PeriodCode: String(l.periodCode),
        Revision: revision,
        TradeCode: l.tradeCode ? String(l.tradeCode) : "",
      };
      const existing = byKey.get(`${keys.PeriodCode}|${keys.TradeCode}`);
      const payload = {
        ...keys,
        ObsNodeId: l.obsNodeId ? String(l.obsNodeId) : null,
        PlannedMh: round2Srv(l.plannedMh),
        PlannedHeadcount: Math.round(Number(l.plannedHeadcount ?? 0)),
        NoteFa: l.noteFa ? String(l.noteFa).slice(0, 400) : null,
      };
      if (existing) { await r.patch("HrmManpowerPlan", existing.Id, payload, actor); updated++; }
      else {
        const row = await r.create("HrmManpowerPlan", payload, actor);
        /* نمایه به‌روز می‌شود تا ردیف تکراری داخل همان درخواست، دو
         * ردیف موازی نسازد — همان دفاعی که کلید یکتا در پایگاه دارد. */
        byKey.set(`${keys.PeriodCode}|${keys.TradeCode}`, row);
        created++;
      }
    }

    /* تغییر مبنا خطرناک‌ترین نوشتن این لایه است: انحراف دیروز را
     * می‌تواند محو کند. بدون رد ممیزی، آن تغییر نامرئی می‌ماند. */
    await hrmAudit(r, req, "HRM_MANPOWER_BASELINE_SET", {
      projectId,
      entityName: "HrmManpowerPlan",
      entityId: revision,
      severity: updated > 0 ? "warning" : "info",
      created, updated, lineCount: lines.length,
    });

    res.json(hrmOk(req, {
      revision, created, updated,
      messageFa: `برنامهٔ «${revision}» ثبت شد: ${created} ردیف تازه، ${updated} ردیف به‌روز`,
    }));
  } catch (err) { next(err); }
});

/**
 * گزارش رسمی A4 با سربرگ.
 *
 * جدا از `/analytics` است چون خروجی‌اش سند است نه داده: مهر زمانی،
 * صادرکننده و شمارهٔ ردیابی دارد و در سیاههٔ ممیزی می‌نشیند.
 */
app.get("/api/hrm/analytics/report", hrmRequire("hrm.analytics.export"), async (req, res, next) => {
  try {
    const projectId = hrmProjectOf(req, res);
    if (!projectId) return;
    const fromCode = String(req.query.from || "");
    const toCode = String(req.query.to || "");
    if (fromCode && toCode && fromCode > toCode) {
      return hrmBad(req, res, "E-HRM-RANGE-ORDER", "شروع بازه بعد از پایان آن است");
    }

    const todayIso = String(req.query.onDate || HRM_TODAY());
    const r = await repo();
    const raw = await hrmAnalyticsRaw(r, projectId, { revision: String(req.query.revision || "") });
    const view = hrmBuildAnalytics(raw, {
      fromCode, toCode, todayIso,
      groupBy: String(req.query.groupBy || "trade"),
    });

    /* پیش از پاسخ نوشته می‌شود: اگر بعد از ارسال بنویسیم و درخواست
     * قطع شود، سندی بیرون رفته که رد آن در سامانه نیست. */
    await hrmAudit(r, req, "HRM_ANALYTICS_REPORT_EXPORT", {
      projectId,
      entityName: "HrmAnalyticsReport",
      entityId: `${view.periods[0] ?? "-"}..${view.periods.at(-1) ?? "-"}`,
      revision: String(req.query.revision || "baseline"),
      groupBy: view.groupBy,
      headlineFa: view.headlineFa,
      highAlerts: view.alerts.filter((a) => a.severity === "high").length,
    });

    res.json(hrmOk(req, {
      header: {
        titleFa: "گزارش نیروی انسانی و بهره‌وری",
        projectId,
        periodFa: `${view.periods[0] ?? "—"} تا ${view.periods[view.periods.length - 1] ?? "—"}`,
        issuedAt: new Date().toISOString(),
        issuedBy: hrmActor(req),
        revision: String(req.query.revision || "baseline"),
        /* شمارهٔ ردیابی همان traceId است: اگر کسی بعداً به عدد این
         * برگه استناد کرد، بتوان دقیقاً همان اجرا را پیدا کرد. */
        traceId: req.requestId,
        headlineFa: view.headlineFa,
        pageSize: "A4",
        /* گزارشی که ساعت تأییدنشده را حساب نکرده باید همین را بگوید،
         * وگرنه خواننده فرض می‌کند همهٔ کارکرد را می‌بیند. */
        basisFa: "فقط برگه‌های تأییدشدهٔ کارکرد مستقیم و حضور تأییدنشدهٔ پیمانکاری (به‌جز ردشده‌ها)",
      },
      kpis: view.kpis,
      histogram: view.histogram,
      sCurve: view.sCurve,
      breakdown: view.breakdown,
      groupBy: view.groupBy,
      alerts: view.alerts,
      compliance: view.compliance,
    }));
  } catch (err) { next(err); }
});

/* ═══════════ HRM · D9 — همگام‌سازی میدانی و کارتابل تعارض ═══════════
 *
 * D4 قرارداد حل تعارض را بست ولی سه چیز باز ماند که بدون آن‌ها یک
 * دستگاه آفلاین واقعی کار نمی‌کند: ارسال دسته‌ای، ایدمپوتنسی، و
 * بستن تعارض. این بخش هر سه را می‌بندد.
 *
 * اصل حاکم: هیچ نسخه‌ای بی‌صدا دور ریخته نمی‌شود.
 */

/** ثابت‌های لایهٔ همگام‌سازی — دستگاه سقف و قواعد را از اینجا می‌خواند. */
app.get("/api/hrm/sync-meta", hrmRequire("hrm.timesheet.enter"), (req, res) => {
  res.json(hrmOk(req, {
    batchMax: SYNC_BATCH_MAX,
    signatureRoles: SIGNATURE_ROLES.map((c) => ({ code: c, fa: SIGNATURE_ROLE_FA[c] })),
    resolutions: CONFLICT_RESOLUTIONS.map((c) => ({ code: c, fa: CONFLICT_RESOLUTION_FA[c] })),
    staleWarnDays: DEVICE_STALE_WARN_DAYS,
    staleCritDays: DEVICE_STALE_CRIT_DAYS,
  }));
});

/**
 * ارسال دسته‌ای برگه‌ها از دستگاه آفلاین.
 *
 * ایدمپوتنت است: اثر انگشت دسته از محتوا ساخته می‌شود و اگر همان
 * دسته دوباره برسد، **همان پاسخ اول** برگردانده می‌شود بدون هیچ
 * نوشتن تازه‌ای. بدون این، قطعِ شبکه پس از نوشتن و پیش از رسیدن
 * پاسخ، نفر-ساعت را دو برابر می‌کرد.
 */
app.post("/api/hrm/sync/batch", hrmRequire("hrm.timesheet.enter"), async (req, res, next) => {
  try {
    const projectId = hrmProjectOf(req, res);
    if (!projectId) return;
    const b = req.body ?? {};
    const deviceId = String(b.deviceId || "").trim();
    const items = Array.isArray(b.items) ? b.items : [];

    const issues = validateSyncBatch({
      deviceId, items,
      capturedAtMax: new Date(Date.now() + 60_000).toISOString(),
    });
    if (issues.some((i) => i.severity === "error")) return hrmInvalid(req, res, issues);

    const r = await repo();
    const fingerprint = batchFingerprint(deviceId, items);

    /* بازپخش: همان دسته، همان پاسخ. شمارندهٔ بازپخش بالا می‌رود تا
     * بعداً بتوان فهمید کدام دستگاه شبکهٔ ناپایدار دارد. */
    const prior = await r.findOne("HrmSyncBatch", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "DeviceId", op: "eq", value: deviceId },
      { column: "Fingerprint", op: "eq", value: fingerprint },
    ]);
    if (prior) {
      await r.patch("HrmSyncBatch", prior.Id, {
        ReplayCount: Number(prior.ReplayCount ?? 0) + 1,
        LastReplayAt: new Date().toISOString(),
      }, hrmActor(req));
      let cached = {};
      try { cached = JSON.parse(String(prior.ResultJson ?? "{}")); } catch { cached = {}; }
      return res.json(hrmOk(req, {
        ...cached,
        fingerprint,
        replay: true,
        messageFa: "این دسته قبلاً پردازش شده است؛ همان نتیجهٔ اول برگردانده شد",
      }));
    }

    /* هر برگه با همان جدول تصمیم D4 سنجیده می‌شود. سرآیندها یک‌جا
     * خوانده می‌شوند تا دستهٔ ۲۰۰تایی، ۲۰۰ پرس‌وجو نشود. */
    const headers = await r.list("HrmTimesheetHeader", {
      where: [{ column: "ProjectId", op: "eq", value: projectId }],
      limit: 20000,
    });
    const byId = new Map(headers.map((h) => [String(h.Id), h]));

    const outcomes = [];
    const conflictRows = [];
    for (const it of items) {
      const id = String(it.id);
      const server = byId.get(id) ?? null;

      if (!server) {
        /* برگه‌ای که سرور ندارد تعارض نیست، فقط تازه است. ساختنش
         * اینجا انجام نمی‌شود چون مسیر ثبت عادی اعتبارسنجی کامل
         * ردیف‌ها را دارد و دور زدنش یعنی ساعت بی‌صاحب. */
        outcomes.push({
          itemId: id, winner: "local", action: "create_needed",
          code: "I-HRM-400", ruleFa: "برگه در سرور نیست؛ از مسیر ثبت عادی ارسال شود",
          conflictRecorded: false, requiresAdjustment: false,
        });
        continue;
      }

      const verdict = resolveSyncConflict(
        {
          status: String(server.Status), revision: Number(server.Revision ?? 1),
          capturedAt: server.CapturedAt ?? null,
          hasForemanSignature: Boolean(server.ForemanSignatureRef),
        },
        {
          status: String(it.status ?? "draft"), revision: Number(it.revision ?? 1),
          capturedAt: it.capturedAt ?? null,
          hasForemanSignature: Boolean(it.foremanSignatureRef),
          deviceId,
        }
      );

      if (verdict.needsConflictRecord) {
        conflictRows.push({
          ProjectId: projectId, EntityType: "HrmTimesheetHeader", EntityId: id,
          DeviceId: deviceId,
          LocalRevision: Number(it.revision ?? 1),
          ServerRevision: Number(server.Revision ?? 1),
          LocalPayload: JSON.stringify(it).slice(0, 3900),
          ServerPayload: JSON.stringify({ Status: server.Status, Revision: server.Revision, TotalHoursRaw: server.TotalHoursRaw }).slice(0, 3900),
          DetectedAt: new Date().toISOString(),
          Resolution: verdict.winner === "server" ? "server_wins" : verdict.winner === "local" ? "local_wins" : "manual",
          DiffSummaryFa: verdict.ruleFa,
          /* الزام صریح ذخیره می‌شود تا گیت بستن به متن نمایشی وابسته
           * نباشد؛ یک ویرایش نگارشی نباید بتواند گیت را خاموش کند. */
          RequiresAdjustment: verdict.requiresAdjustment,
          BlockReasonFa: verdict.requiresAdjustment ? verdict.ruleFa.slice(0, 300) : null,
          /* فقط تعارضی که سند اصلاحی می‌خواهد باز می‌ماند؛ بقیه
           * تصمیمشان همین‌جا گرفته شده و باز نگه داشتنشان کارتابل را
           * با نویز پر می‌کرد. */
          Status: verdict.requiresAdjustment ? "open" : "resolved",
        });
      }

      outcomes.push({
        itemId: id,
        winner: verdict.winner,
        action: verdict.winner === "local" ? "apply_local" : verdict.winner === "server" ? "keep_server" : "noop",
        code: verdict.code,
        ruleFa: verdict.ruleFa,
        conflictRecorded: verdict.needsConflictRecord,
        requiresAdjustment: verdict.requiresAdjustment,
      });
    }

    for (const c of conflictRows) await r.create("HrmSyncConflict", c, hrmActor(req));

    const summary = summarizeSyncBatch(outcomes);
    const payload = { deviceId, summary, outcomes, warnings: issues.filter((i) => i.severity === "warning") };

    await r.create("HrmSyncBatch", {
      ProjectId: projectId,
      DeviceId: deviceId,
      Fingerprint: fingerprint,
      ItemCount: items.length,
      ReceivedAt: new Date().toISOString(),
      ReceivedBy: hrmActor(req),
      AppVersion: b.appVersion ? String(b.appVersion) : null,
      ResultJson: JSON.stringify(payload).slice(0, 7900),
      AppliedCount: summary.applied,
      ConflictCount: summary.conflicts,
      ReplayCount: 0,
    }, hrmActor(req));

    /* یافتهٔ لوپ ۹: دسته‌ای که برگهٔ امضاشده را کنار زده باید رد
     * سمت سرور بگذارد. `HrmSyncBatch` خودش سابقه است، ولی سیاههٔ
     * ممیزی جای دیدنِ «چه کسی چه چیزی را کنار زد» است — و فقط وقتی
     * تعارضی رخ داده، تا سیاهه با ترافیک عادی پر نشود. */
    if (summary.conflicts > 0) {
      await hrmAudit(r, req, "HRM_SYNC_BATCH_CONFLICT", {
        projectId,
        entityName: "HrmSyncBatch",
        entityId: fingerprint,
        severity: summary.needsAdjustment > 0 ? "warning" : "info",
        deviceId,
        itemCount: items.length,
        conflicts: summary.conflicts,
        blockedIds: summary.blockedIds,
      });
    }

    res.json(hrmOk(req, { ...payload, fingerprint, replay: false, messageFa: summary.messageFa }));
  } catch (err) { next(err); }
});

/** تاریخچهٔ دسته‌های یک دستگاه — برای عیب‌یابی صف. */
app.get("/api/hrm/sync/batches", hrmRequire("hrm.device.monitor"), async (req, res, next) => {
  try {
    const projectId = hrmProjectOf(req, res);
    if (!projectId) return;
    const r = await repo();
    const where = [{ column: "ProjectId", op: "eq", value: projectId }];
    const deviceId = String(req.query.deviceId || "");
    if (deviceId) where.push({ column: "DeviceId", op: "eq", value: deviceId });

    const rows = await r.list("HrmSyncBatch", { where, limit: 2000 });
    rows.sort((a, b) => String(b.ReceivedAt).localeCompare(String(a.ReceivedAt)));

    /* پاسخ کامل هر دسته می‌تواند چند کیلوبایت باشد؛ در فهرست فقط
     * سرشماری برگردانده می‌شود. */
    res.json(hrmOk(req, {
      items: rows.map(({ ResultJson, ...rest }) => rest),
      count: rows.length,
      replayTotal: rows.reduce((s, x) => s + Number(x.ReplayCount ?? 0), 0),
    }));
  } catch (err) { next(err); }
});

/** تابلوی سلامت دستگاه‌های میدانی. */
app.get("/api/hrm/devices", hrmRequire("hrm.device.monitor"), async (req, res, next) => {
  try {
    const projectId = hrmProjectOf(req, res);
    if (!projectId) return;
    const todayIso = String(req.query.onDate || HRM_TODAY());

    const r = await repo();
    const [conflicts, batches] = await Promise.all([
      r.list("HrmSyncConflict", { where: [{ column: "ProjectId", op: "eq", value: projectId }], limit: 5000 }),
      r.list("HrmSyncBatch", { where: [{ column: "ProjectId", op: "eq", value: projectId }], limit: 5000 }),
    ]);

    /* دستگاهی که تعارض ندارد هم باید دیده شود: سکوتش ممکن است یعنی
     * یک هفته داده در جیب کسی مانده. */
    const lastSync = {};
    for (const bt of batches) {
      const d = String(bt.DeviceId ?? "");
      if (!d) continue;
      const at = String(bt.ReceivedAt ?? "");
      if (at && (!lastSync[d] || at > lastSync[d])) lastSync[d] = at;
    }

    const rows = deviceHealth(conflicts, todayIso, lastSync);
    res.json(hrmOk(req, {
      onDate: todayIso,
      rows,
      summary: {
        total: rows.length,
        red: rows.filter((x) => x.flag === "red").length,
        amber: rows.filter((x) => x.flag === "amber").length,
        openConflicts: rows.reduce((s, x) => s + x.openConflicts, 0),
      },
      thresholds: { warnDays: DEVICE_STALE_WARN_DAYS, critDays: DEVICE_STALE_CRIT_DAYS },
    }));
  } catch (err) { next(err); }
});

/**
 * بستن یک تعارض.
 *
 * دو گیت: تعارض بسته دوباره بسته نمی‌شود، و تعارضِ روی دورهٔ بسته
 * فقط با سند اصلاحی واقعی بسته می‌شود — نه با «حل شد» زدن.
 */
app.post("/api/hrm/conflicts/:id/close", hrmRequire("hrm.conflict.resolve"), async (req, res, next) => {
  try {
    const projectId = hrmProjectOf(req, res);
    if (!projectId) return;
    const r = await repo();
    const row = await r.findOne("HrmSyncConflict", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "Id", op: "eq", value: String(req.params.id) },
    ]);
    if (!row) return hrmBad(req, res, "E-HRM-CONFLICT-NOT-FOUND", "تعارض پیدا نشد", 404);

    const b = req.body ?? {};
    const adjustmentId = b.adjustmentId ? String(b.adjustmentId) : null;

    /* ادعای سند اصلاحی باید سند واقعیِ **تأییدشده** پشتش باشد.
     *
     * یافتهٔ لوپ ۶: بررسیِ صرفِ وجود کافی نبود. هر کسی که
     * `adjustment.raise` دارد می‌توانست یک پیش‌نویس بسازد و با شمارهٔ
     * آن تعارض را ببندد — یعنی همان راه فراری که گیت برای بستنش ساخته
     * شده بود، از یک در دیگر باز می‌ماند. تأیید سند مجوز جدا دارد
     * (`hrm.adjustment.approve`) و همان مرز واقعی است. */
    if (adjustmentId) {
      const adj = await r.findOne("HrmAdjustment", [
        { column: "ProjectId", op: "eq", value: projectId },
        { column: "Id", op: "eq", value: adjustmentId },
      ]);
      if (!adj) return hrmBad(req, res, "E-HRM-ADJ-NOT-FOUND", `سند اصلاحی ${adjustmentId} پیدا نشد`, 404);
      if (String(adj.Status ?? "") !== "approved") {
        return hrmBad(
          req, res, "E-HRM-446",
          `سند اصلاحی ${adjustmentId} هنوز تأیید نشده است؛ تعارض با پیش‌نویس بسته نمی‌شود`,
          422,
          [`وضعیت فعلی سند: ${adj.Status ?? "نامشخص"}`]
        );
      }
    }

    /* «آیا سند اصلاحی لازم است» از ستون صریح خود ردیف خوانده می‌شود،
     * نه از بدنهٔ درخواست (کلاینت نباید بتواند گیت را خاموش کند) و نه
     * از متن نمایشی (که ویرایش نگارشی می‌شکندش).
     *
     * ردیف تاریخیِ پیش از مهاجرت `0029` ستون را ندارد؛ برای آن‌ها —
     * و فقط آن‌ها — به متن برمی‌گردیم، چون سکوت کردن یعنی باز کردن
     * راه فرار روی همان ردیف‌هایی که گیت برایشان ساخته شده بود. */
    const requiresAdjustment = row.RequiresAdjustment === null || row.RequiresAdjustment === undefined
      ? /سند اصلاحی/.test(String(row.DiffSummaryFa ?? ""))
      : row.RequiresAdjustment === true || row.RequiresAdjustment === 1;

    const gate = canCloseConflict({
      currentStatus: String(row.Status ?? "open"),
      resolution: String(b.resolution || ""),
      noteFa: String(b.noteFa || ""),
      requiresAdjustment,
      adjustmentId,
    });
    if (!gate.ok) {
      /* دلیلِ ثبت‌شدهٔ همین ردیف به پیام اضافه می‌شود: پیام عمومی
       * «دورهٔ بسته است» وقتی دلیل واقعی «برگهٔ امضاشده» بوده،
       * کاربر را دنبال مشکلی می‌فرستد که وجود ندارد. */
      const details = [...(gate.detailsFa ?? [])];
      if (row.BlockReasonFa) details.unshift(`دلیل این تعارض: ${row.BlockReasonFa}`);
      return hrmBad(req, res, gate.code, gate.messageFa, 422, details.length ? details : undefined);
    }

    const actor = hrmActor(req);
    await r.patch("HrmSyncConflict", row.Id, {
      Status: "resolved",
      Resolution: String(b.resolution),
      ResolvedBy: actor,
      ResolvedAt: new Date().toISOString(),
      DiffSummaryFa: `${String(row.DiffSummaryFa ?? "")} | ${gate.messageFa}${b.noteFa ? ` — ${String(b.noteFa).slice(0, 300)}` : ""}`.slice(0, 1000),
    }, actor);

    await hrmAudit(r, req, "HRM_SYNC_CONFLICT_CLOSED", {
      projectId,
      entityName: "HrmSyncConflict",
      entityId: String(row.Id),
      severity: String(b.resolution) === "manual" ? "warning" : "info",
      resolution: String(b.resolution),
      deviceId: row.DeviceId ?? null,
      adjustmentId,
    });

    res.json(hrmOk(req, {
      id: row.Id,
      resolution: String(b.resolution),
      resolutionFa: CONFLICT_RESOLUTION_FA[String(b.resolution)] ?? String(b.resolution),
      messageFa: gate.messageFa,
    }));
  } catch (err) { next(err); }
});

/** بررسی زنجیرهٔ امضای یک برگه — خواندنی محض. */
app.get("/api/hrm/timesheets/:id/signature-chain", hrmRequire("hrm.roster.view"), async (req, res, next) => {
  try {
    const projectId = hrmProjectOf(req, res);
    if (!projectId) return;
    const r = await repo();
    const h = await r.findOne("HrmTimesheetHeader", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "Id", op: "eq", value: String(req.params.id) },
    ]);
    if (!h) return hrmBad(req, res, "E-HRM-TS-NOT-FOUND", "برگهٔ کارکرد پیدا نشد", 404);

    /* زنجیره از ستون‌های موجود بازسازی می‌شود. زمان امضای سرپرست
     * ستون اختصاصی ندارد، پس از زمان ارسال تقریب زده می‌شود — همین
     * تقریب در `verifySignatureChain` هشدار می‌گیرد اگر نبود. */
    const links = [];
    if (h.ForemanSignatureRef) {
      links.push({ role: "foreman", ref: String(h.ForemanSignatureRef), signedAt: h.SubmittedAt ?? null, signerId: h.EnteredBy ?? null });
    }
    if (h.ApprovedBy) {
      links.push({ role: "pm", ref: `approval:${h.ApprovedBy}`, signedAt: h.ApprovedAt ?? null, signerId: String(h.ApprovedBy) });
    }
    if (h.ClientSignatureRef) {
      links.push({ role: "client", ref: String(h.ClientSignatureRef), signedAt: h.ApprovedAt ?? null });
    }

    const required = Array.isArray(req.query.required)
      ? req.query.required.map(String)
      : req.query.required ? [String(req.query.required)] : ["foreman"];

    res.json(hrmOk(req, {
      id: String(h.Id),
      status: String(h.Status),
      statusFa: TS_STATE_FA[String(h.Status)] ?? String(h.Status),
      links,
      required,
      chain: verifySignatureChain(links, required),
    }));
  } catch (err) { next(err); }
});

/* ═══════════ HRM · D11 — گزارش‌های رسمی و خروجی چندقالبی ═══════════
 *
 * D8 عدد را ساخت و JSON داد؛ D11 آن را به سندی تبدیل می‌کند که روی
 * میز جلسه گذاشته می‌شود. شکاف H-06 و L9 که از D1 باز مانده بود.
 *
 * هیچ محاسبهٔ تازه‌ای اینجا نیست: همان `hrmBuildAnalytics` که داشبورد
 * را می‌سازد، سند را هم می‌سازد. اگر دو مسیر محاسبه داشتیم، دو سند از
 * یک ماه دو رقم متفاوت می‌دادند.
 */

/** سربرگ از querystring یا پیش‌فرض. */
function hrmLetterhead(source = {}, reportCode = "RPT-HRM", seq = 1) {
  /* در querystring سربرگ رشتهٔ JSON است؛ spread کردن رشته کاراکترها را
   * به کلید عددی تبدیل می‌کند و بازنویسی بی‌اثر می‌شود. */
  let override = source.letterhead ?? {};
  if (typeof override === "string") {
    try { override = JSON.parse(override); } catch { override = {}; }
  }
  if (typeof override !== "object" || override === null || Array.isArray(override)) override = {};

  const lh = { ...HRM_DEFAULT_LETTERHEAD, ...override };
  if (!lh.docNo) {
    lh.docNo = documentNumber(lh.projectCode, reportCode, seq, Number(String(lh.revision).replace(/\D/g, "")) || 0);
  }
  return lh;
}

/** فهرست گزارش‌های در دسترس. */
app.get("/api/hrm/reports", hrmRequire("hrm.analytics.view"), (req, res) => {
  res.json(hrmOk(req, {
    items: HRM_REPORT_CATALOG,
    count: HRM_REPORT_CATALOG.length,
    formats: ["json", "html", "pdf", "doc", "xls", "csv"],
    audiences: ["internal", "official"],
  }));
});

/**
 * صدور گزارش رسمی نیرو در شش قالب.
 *
 * دو لایهٔ مجوز روی هم: `hrm.analytics.view` برای دیدن دادهٔ نیرو، و
 * برای نسخهٔ رسمی **علاوه بر آن** `report.official.publish`. کسی که
 * فقط مجوز انتشار عمومی دارد نباید بتواند دادهٔ پرسنلی را بیرون
 * بفرستد، و کسی که فقط داشبورد نیرو را می‌بیند نباید سند ابلاغی
 * امضا کند.
 */
app.get("/api/hrm/reports/:code", hrmRequire("hrm.analytics.view"), async (req, res, next) => {
  try {
    const projectId = hrmProjectOf(req, res);
    if (!projectId) return;

    const code = String(req.params.code || "").toUpperCase();
    const def = hrmReportByCode(code);
    if (!def) {
      return hrmBad(req, res, "E-HRM-RPT-UNKNOWN", `گزارش ${code} در کاتالوگ نیست`, 404,
        HRM_REPORT_CATALOG.map((r) => `${r.code} — ${r.title.fa}`));
    }

    const audience = String(req.query.audience || "internal") === "official" ? "official" : "internal";
    if (!def.audiences.includes(audience)) {
      return hrmBad(req, res, "E-HRM-RPT-AUDIENCE",
        `گزارش ${code} نسخهٔ «${audience === "official" ? "رسمی" : "داخلی"}» ندارد`, 422,
        [`مخاطب‌های مجاز: ${def.audiences.join("، ")}`]);
    }

    /* لایهٔ دوم مجوز فقط برای نسخهٔ رسمی. مسیر پشت `analytics.view`
     * است، پس این ماسک اضافه نیست: مجوز متفاوتی را می‌سنجد. */
    if (audience === "official") {
      const verdict = rbacEvaluate(req.hrmSubject, "report.official.publish", { projectId: undefined });
      if (!verdict.allow) {
        return res.status(403).json({
          ok: false,
          error: {
            code: "E-HRM-FORBIDDEN",
            message: `صدور نسخهٔ رسمی نیازمند مجوز «report.official.publish» است`,
            permission: "report.official.publish",
            reason: verdict.reasonFa ?? verdict.reason ?? null,
            traceId: req.requestId,
          },
        });
      }
    }

    const format = String(req.query.format || "json").toLowerCase();
    const lang = String(req.query.lang || "fa") === "en" ? "en" : "fa";
    const groupBy = ["trade", "cbs", "obs"].includes(String(req.query.groupBy)) ? String(req.query.groupBy) : "trade";

    /* بازهٔ مبهم پیش از هر کاری رد می‌شود — همان قاعدهٔ D8، چون سندی
     * که ندانیم کدام ماه‌ها را پوشش می‌دهد بی‌معناست. */
    const qFrom = String(req.query.from || "");
    const qTo = String(req.query.to || "");
    if ((qFrom && !qTo) || (qTo && !qFrom)) {
      return hrmBad(req, res, "E-HRM-RANGE", "بازه باید هر دو سر را داشته باشد (from و to)");
    }
    if (qFrom && qTo && qFrom > qTo) {
      return hrmBad(req, res, "E-HRM-RANGE-ORDER", "شروع بازه بعد از پایان آن است");
    }

    const r = await repo();
    const raw = await hrmAnalyticsRaw(r, projectId, { revision: String(req.query.revision || "") });
    const view = hrmBuildAnalytics(raw, {
      fromCode: qFrom,
      toCode: qTo,
      todayIso: String(req.query.onDate || HRM_TODAY()),
      groupBy,
    });

    /* برگهٔ تأییدنشده در بازه — مانع نسخهٔ رسمی. از سرآیندهای همان
     * دادهٔ خام شمرده می‌شود تا پرس‌وجوی اضافه نخورد. */
    const unapproved = raw.headers.filter(
      (h) => !h.VoidedAt && (TS_STATE_RANK[String(h.Status)] ?? 0) < HRM_PROD_MIN_RANK
    ).length;

    const gate = hrmPublishGate(audience, {
      openSyncConflicts: view.openSyncConflicts ?? 0,
      unapprovedSheets: unapproved,
      periodsWithoutPlan: Number(view.histogram?.totals?.periodsWithoutPlan ?? 0),
      blockedActive: Number(view.compliance?.blockedActiveCount ?? 0),
      headcountUnknown: view.compliance?.activeHeadcount === null,
      expiringSoon: Number(view.compliance?.expiringSoonCount ?? 0),
    });

    const lh = hrmLetterhead(req.query, code, Number(req.query.seq) || 1);
    lh.periodLabel = `${view.fromCode} … ${view.toCode}`;
    /* یافتهٔ لوپ ۱۰: فهرست توزیع پیش‌فرض فقط داخلی بود، ولی سند رسمی
     * به کارفرما و مشاور ابلاغ می‌شود — یعنی سند به دست کسی می‌رسید
     * که در فهرست توزیع خودش نبود، و بعداً معلوم نمی‌شد چه کسی
     * قانوناً نسخه گرفته است. */
    if (audience === "official" && !req.query.letterhead) {
      lh.distribution = [...lh.distribution, lh.client.name, lh.consultant.name];
    }
    const letterheadIssues = validateLetterhead(lh, audience);
    const blocking = letterheadIssues.filter((i) => i.severity === "error");

    if (audience === "official" && (!gate.ok || blocking.length > 0)) {
      /* تلاش ناموفق برای صدور رسمی ثبت می‌شود: الگوی تکرارشوندهٔ آن
       * یعنی یا داده مزمن ناقص است یا کسی مدام در می‌زند. */
      await hrmAudit(r, req, "HRM_REPORT_PUBLISH_BLOCKED", {
        projectId, entityName: "HrmReport", entityId: code,
        severity: "warning", reasons: gate.reasons, letterheadIssues: blocking.length,
      });
      return res.status(409).json({
        ok: false,
        error: {
          code: "E-HRM-RPT-GATE",
          message: "گزارش رسمی با شرایط فعلی قابل صدور نیست",
          reasons: gate.reasons,
          warnings: gate.warnings,
          letterheadIssues: blocking,
          traceId: req.requestId,
        },
      });
    }

    let report;
    if (code === "RPT-HRM-TS") {
      report = buildTimesheetCertificate({
        breakdown: view.breakdown ?? [],
        histogram: view.histogram,
        fromCode: view.fromCode,
        toCode: view.toCode,
        groupByFa: groupBy === "cbs" ? "ساختار هزینه" : groupBy === "obs" ? "ساختار سازمانی" : "رسته",
      });
    } else if (code === "RPT-HRM-CMP") {
      report = buildComplianceReport({ compliance: view.compliance ?? {}, alerts: view.alerts ?? [] });
    } else {
      /* هیستوگرام و بهره‌وری هر دو همین شکل را دارند؛ تفاوتشان در
       * کد سند است نه در ساختار. */
      report = buildManpowerReport({
        histogram: view.histogram,
        sCurve: view.sCurve,
        kpis: view.kpis ?? [],
        headlineFa: view.headlineFa,
      });
      if (code === "RPT-HRM-PRD") {
        report.code = code;
        report.title = def.title;
      }
    }

    if (audience === "official") {
      await hrmAudit(r, req, "HRM_REPORT_PUBLISHED", {
        projectId, entityName: "HrmReport", entityId: code,
        severity: "info", format, range: `${view.fromCode}..${view.toCode}`,
        docNo: lh.docNo, warnings: gate.warnings.length,
      });
    }

    if (format === "json") {
      return res.json(hrmOk(req, {
        report, letterhead: lh, audience, gate, letterheadIssues,
        rows: hrmReportRows(report),
        pages: estimatePages({ ...report, sections: report.sections }),
      }));
    }

    const fileName = exportFileName(report, lh, format === "html" || format === "pdf" ? "pdf" : format);
    if (format === "csv") {
      res.type("text/csv; charset=utf-8").set("content-disposition", `attachment; filename="${fileName}"`);
      /* BOM لازم است وگرنه Excel فارسی را خراب می‌خواند. */
      return res.send(`\uFEFF${toCsv(report, lang)}`);
    }
    if (format === "doc") {
      res.type("application/msword; charset=utf-8").set("content-disposition", `attachment; filename="${fileName}"`);
      return res.send(toWordHtml(report, lh, audience, lang));
    }
    if (format === "xls") {
      res.type("application/vnd.ms-excel; charset=utf-8").set("content-disposition", `attachment; filename="${fileName}"`);
      return res.send(toExcelHtml(report, lh, lang));
    }
    if (format === "html" || format === "pdf") {
      /* PDF از مسیر چاپ مرورگر تولید می‌شود؛ رندر سمت سرور در کل
       * سامانه هنوز نیست (H-06 برای بقیهٔ ماژول‌ها باز می‌ماند). */
      return res.type("text/html; charset=utf-8").send(toPrintHtml(report, lh, audience, lang));
    }

    return hrmBad(req, res, "E-HRM-RPT-FORMAT", `قالب ${format} پشتیبانی نمی‌شود`, 422,
      ["json", "html", "pdf", "doc", "xls", "csv"]);
  } catch (err) { next(err); }
});

/* ═══════════ HRM · D12 — ارسال هزینهٔ نیرو به مالی ═══════════
 *
 * D4 خطوط هزینه را ساخت ولی جایی نمی‌فرستاد. اینجا به حساب هزینهٔ
 * FIN می‌رسند.
 *
 * دامنه (قید صریح): نرخ × ساعت برای هزینهٔ پروژه. فیش حقوقی، بیمه و
 * مالیات محاسبه نمی‌شود.
 *
 * زنجیرهٔ سه‌طرفه که هیچ‌کس دو سرش را ندارد: مدیر منابع انسانی نرخ را
 * تعریف می‌کند (SOD-28 مانع ارسالش می‌شود) · مدیر پروژه دوره را قفل
 * می‌کند (SOD-17 مانع ارسالش می‌شود) · PMO می‌فرستد.
 */

/** کارت‌های نرخ یک پروژه. */
app.get("/api/hrm/rate-cards", hrmRequire("hrm.rate.view"), async (req, res, next) => {
  try {
    const projectId = hrmProjectOf(req, res);
    if (!projectId) return;
    const r = await repo();
    const items = await r.list("HrmRateCard", {
      where: [{ column: "ProjectId", op: "eq", value: projectId }],
      limit: 5000,
    });
    items.sort((a, b) =>
      String(a.TradeCode).localeCompare(String(b.TradeCode)) ||
      String(b.EffectiveFrom).localeCompare(String(a.EffectiveFrom)));

    const onDate = String(req.query.onDate || HRM_TODAY());
    const trade = String(req.query.tradeCode || "");
    res.json(hrmOk(req, {
      items,
      count: items.length,
      onDate,
      /* نرخ مؤثر همان تاریخ — تا کاربر نبیند «کدام کارت الان اثر
       * دارد» را خودش حدس بزند. */
      effective: trade ? rateCardFor(items, trade, onDate) : null,
    }));
  } catch (err) { next(err); }
});

/**
 * ثبت یا بازنگری کارت نرخ.
 *
 * صدور نسخهٔ تازه، نسخهٔ قبلی همان رسته را می‌بندد. بدون این، دو نرخ
 * هم‌زمان معتبر می‌شدند و انتخاب میانشان دلبخواهی.
 */
app.post("/api/hrm/rate-cards", hrmRequire("hrm.rate.manage"), async (req, res, next) => {
  try {
    const projectId = hrmProjectOf(req, res);
    if (!projectId) return;
    const b = req.body ?? {};
    const tradeCode = String(b.tradeCode || "").trim();
    const rate = Number(b.hourlyRate);
    const from = String(b.effectiveFrom || HRM_TODAY()).slice(0, 10);

    const issues = [];
    if (!tradeCode) issues.push({ code: "E-HRM-460", severity: "error", field: "tradeCode", messageFa: "کد رسته الزامی است" });
    if (!(rate > 0)) issues.push({ code: "E-HRM-461", severity: "error", field: "hourlyRate", messageFa: "نرخ ساعتی باید بزرگ‌تر از صفر باشد" });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) issues.push({ code: "E-HRM-462", severity: "error", field: "effectiveFrom", messageFa: "تاریخ اثر باید به قالب YYYY-MM-DD باشد" });
    if (issues.length) return hrmInvalid(req, res, issues);

    const r = await repo();
    const grade = b.grade ? String(b.grade) : null;
    const actor = hrmActor(req);

    /* نسخهٔ باز قبلی بسته می‌شود — یک روز پیش از شروع نسخهٔ تازه، تا
     * بازه‌ها نه همپوشانی داشته باشند نه شکاف. */
    const prior = await r.list("HrmRateCard", {
      where: [
        { column: "ProjectId", op: "eq", value: projectId },
        { column: "TradeCode", op: "eq", value: tradeCode },
      ],
      limit: 500,
    });
    const dayBefore = new Date(new Date(`${from}T00:00:00Z`).getTime() - 86_400_000).toISOString().slice(0, 10);
    let closed = 0;
    for (const c of prior) {
      if (String(c.Status ?? "active") !== "active") continue;
      if ((c.Grade ?? null) !== grade) continue;
      if (c.EffectiveTo) continue;
      if (String(c.EffectiveFrom) >= from) continue;
      await r.patch("HrmRateCard", c.Id, { EffectiveTo: dayBefore }, actor);
      closed += 1;
    }

    const row = await r.create("HrmRateCard", {
      ProjectId: projectId,
      TradeCode: tradeCode,
      Grade: grade,
      HourlyRate: round2Srv(rate),
      Currency: String(b.currency || "IRR"),
      EffectiveFrom: from,
      EffectiveTo: b.effectiveTo ? String(b.effectiveTo).slice(0, 10) : null,
      SourceFa: b.sourceFa ? String(b.sourceFa).slice(0, 200) : null,
      Status: "active",
    }, actor);

    await hrmAudit(r, req, "HRM_RATE_CARD_SET", {
      projectId, entityName: "HrmRateCard", entityId: String(row?.Id ?? ""),
      severity: closed > 0 ? "warning" : "info",
      tradeCode, hourlyRate: round2Srv(rate), effectiveFrom: from, closedVersions: closed,
    });

    res.status(201).json(hrmOk(req, {
      id: row?.Id ?? null,
      closedVersions: closed,
      messageFa: closed > 0
        ? `کارت نرخ ثبت شد و ${closed} نسخهٔ قبلی در ${dayBefore} بسته شد`
        : "کارت نرخ ثبت شد",
    }));
  } catch (err) { next(err); }
});

/** دادهٔ مشترک پیش‌نمایش و ارسال — یک مسیر محاسبه، دو مصرف‌کننده. */
async function hrmCostPlan(r, projectId, periodCode) {
  const [lockRow, approved, conflicts, cards, members] = await Promise.all([
    r.findOne("HrmPeriodLock", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "PeriodCode", op: "eq", value: periodCode },
    ]),
    hrmApprovedEntries(r, projectId, periodCode),
    r.list("HrmSyncConflict", {
      where: [
        { column: "ProjectId", op: "eq", value: projectId },
        { column: "Status", op: "eq", value: "open" },
      ],
      limit: 2000,
    }),
    r.list("HrmRateCard", { where: [{ column: "ProjectId", op: "eq", value: projectId }], limit: 5000 }),
    r.list("WorkforceMember", { where: [{ column: "ProjectId", op: "eq", value: projectId }], limit: 5000 }),
  ]);

  /* نرخ در **پایان دوره** خوانده می‌شود: اگر نرخ وسط ماه عوض شود،
   * یک مبنای واحد لازم است وگرنه دو ردیف یک ماه دو نرخ می‌گیرند و
   * جمع قابل توضیح نیست. */
  const asOf = `${periodCode}-28`;
  const rows = approved.entries.map((e) => ({
    hoursRaw: Number(e.HoursRaw ?? 0),
    hoursNormal: Number(e.HoursNormal ?? 0),
    hoursOt: Number(e.HoursOt ?? 0),
    hoursNight: Number(e.HoursNight ?? 0),
    hoursHoliday: Number(e.HoursHoliday ?? 0),
    cbsId: e.CbsId ?? "",
    activityId: e.ActivityId ?? "",
    tradeCode: e.TradeCode ?? "",
  }));

  /* همان منبع و همان پشتیبانِ `/api/hrm/cost` — دو مسیر نباید دو
   * رقم بدهند. */
  const fallbackByTrade = new Map();
  for (const m of members) {
    const daily = Number(m.DailyRate ?? 0);
    if (!(daily > 0)) continue;
    const code = String(m.TradeCode ?? "");
    if (!fallbackByTrade.has(code)) fallbackByTrade.set(code, round2Srv(daily / IRAN_LABOR_LAW.dailyNormalCap));
  }
  const cardLookup = rateLookupFrom(cards, asOf);
  const lines = buildTsCostLines(rows, (trade) => cardLookup(trade) ?? fallbackByTrade.get(trade) ?? null);
  const plan = buildLaborPostings({ periodCode, lines });

  return {
    plan,
    locked: Boolean(lockRow && String(lockRow.Status ?? "locked") === "locked"),
    pending: approved.pending,
    openConflicts: conflicts.length,
    asOf,
  };
}

/**
 * پیش‌نمایش و ارسال هزینهٔ دوره.
 *
 * `apply=1` می‌نویسد؛ بدون آن فقط نشان می‌دهد. پیش‌نمایش و ارسال از
 * **یک** مسیر محاسبه می‌آیند تا آنچه کاربر تأیید می‌کند دقیقاً همان
 * چیزی باشد که نوشته می‌شود.
 */
app.post("/api/hrm/cost/post", hrmRequire("hrm.cost.post"), async (req, res, next) => {
  try {
    const projectId = hrmProjectOf(req, res);
    if (!projectId) return;
    const b = req.body ?? {};
    const periodCode = String(b.periodCode || req.query.periodCode || "");
    if (!/^\d{4}-\d{2}$/.test(periodCode)) {
      return hrmBad(req, res, "E-HRM-463", "کد دوره باید به قالب YYYY-MM باشد");
    }
    const apply = b.apply === true || req.query.apply === "1";

    const r = await repo();
    const { plan, locked, pending, openConflicts, asOf } = await hrmCostPlan(r, projectId, periodCode);

    const priorRows = await r.list("HrmCostPosting", {
      where: [
        { column: "ProjectId", op: "eq", value: projectId },
        { column: "PeriodCode", op: "eq", value: periodCode },
      ],
      limit: 2000,
    });
    const priorByAccount = new Map(priorRows.map((x) => [String(x.CostAccountId), x]));

    const gate = laborPostingGate({
      /* دورهٔ **قفل‌شده** هم قابل ارسال است (ارسال دوباره پس از سند
       * اصلاحی)، ولی قفل پیش‌شرط نیست — چون `canLockPeriod` می‌خواهد
       * همهٔ برگه‌ها `posted` باشند و `posted` شدن کار همین مسیر است.
       * اگر قفل را پیش‌شرط می‌گرفتیم، هیچ دوره‌ای هرگز ارسال نمی‌شد. */
      periodLocked: true,
      periodLockedActual: locked,
      unapprovedSheets: pending,
      openConflicts,
      unpricedHours: plan.unpricedHours,
      unallocatedHours: plan.unallocatedHours,
      alreadyPostedAt: priorRows.length ? String(priorRows[0].PostedAt) : null,
    });

    /* دروازه فقط جلوی **نوشتن** را می‌گیرد. پیش‌نمایش همیشه باز است،
     * چون کاربر باید بتواند ببیند چرا نمی‌تواند بفرستد. */
    if (apply && !gate.ok) {
      await hrmAudit(r, req, "HRM_COST_POST_BLOCKED", {
        projectId, entityName: "HrmCostPosting", entityId: periodCode,
        severity: "warning", reasons: gate.reasons,
      });
      return res.status(409).json({
        ok: false,
        error: {
          code: "E-HRM-451",
          message: "هزینهٔ این دوره با شرایط فعلی قابل ارسال نیست",
          reasons: gate.reasons,
          warnings: gate.warnings,
          traceId: req.requestId,
        },
      });
    }

    const actor = hrmActor(req);
    const results = [];
    let postedAmount = 0;

    /* یافتهٔ لوپ ۳: `findOne` به‌ازای هر حساب یعنی پروژه‌ای با ۲۰۰
     * حساب هزینه، ۲۰۰ پرس‌وجو در یک درخواست. یک `list` و یک نمایه.
     *
     * نمایه پس از هر نوشتن به‌روز می‌شود تا اگر دو سطر یک حساب را
     * هدف بگیرند (که نباید، ولی دفاع لازم است) رقم دوم روی رقم اول
     * بنشیند نه روی مقدار کهنه. */
    const accountRows = await r.list("CostAccount", {
      where: [{ column: "ProjectId", op: "eq", value: projectId }],
      limit: 20000,
    });
    const accountById = new Map(accountRows.map((a) => [String(a.Id), a]));

    for (const line of plan.lines) {
      const account = accountById.get(line.costAccountId) ?? null;
      if (!account) {
        /* حساب ناموجود سکوت نمی‌گیرد: مبلغش جایی نمی‌رود و باید
         * دیده شود. */
        results.push({ costAccountId: line.costAccountId, status: "missing_account", amount: line.amount });
        continue;
      }
      const prior = priorByAccount.get(line.costAccountId);
      const previousShare = Number(prior?.Amount ?? 0);
      const nextActual = applyLaborPosting(Number(account.Actual) || 0, previousShare, line.amount);

      results.push({
        costAccountId: line.costAccountId,
        accountCode: account.Code ?? null,
        status: apply ? "posted" : "preview",
        previousActual: round2Srv(account.Actual),
        previousHrmShare: previousShare,
        hrmShare: line.amount,
        nextActual,
        equivalentHours: line.equivalentHours,
        unpricedHours: line.unpricedHours,
        memoFa: line.memoFa,
        eventKey: laborEventKey(projectId, periodCode, line.costAccountId),
      });

      if (apply) {
        await r.patch("CostAccount", line.costAccountId, { Actual: nextActual }, actor);
        accountById.set(line.costAccountId, { ...account, Actual: nextActual });
        await r.upsert(
          "HrmCostPosting",
          { ProjectId: projectId, CostAccountId: line.costAccountId, PeriodCode: periodCode },
          {
            ProjectId: projectId,
            CostAccountId: line.costAccountId,
            PeriodCode: periodCode,
            Amount: line.amount,
            EquivalentHours: line.equivalentHours,
            Currency: plan.currency,
            UnpricedHours: line.unpricedHours,
            MemoFa: line.memoFa,
            PostedAt: new Date().toISOString(),
            PostedBy: actor,
            EventKey: laborEventKey(projectId, periodCode, line.costAccountId),
          },
          actor,
        );
        postedAmount = round2Srv(postedAmount + line.amount);
      }
    }

    /* گذار `pm_approved → posted` که سند D2 به «موتور D12» سپرده بود.
     *
     * بدون آن، قفل دوره ممکن نمی‌شد: `canLockPeriod` همهٔ برگه‌ها را
     * `posted` می‌خواهد. حالا زنجیره کامل است — تأیید، ارسال، قفل. */
    let movedToPosted = 0;
    if (apply) {
      const headers = await r.list("HrmTimesheetHeader", {
        where: [{ column: "ProjectId", op: "eq", value: projectId }],
        limit: 5000,
      });
      for (const h of headers) {
        if (periodOf(String(h.WorkDate)) !== periodCode) continue;
        if (String(h.Status) !== "pm_approved") continue;
        /* فقط `Status` نوشته می‌شود؛ سربرگ ستون `PostedAt` ندارد و
         * زمان ارسال جای درستش `HrmCostPosting.PostedAt` است — یک
         * واقعیت، یک ستون. */
        await r.patch("HrmTimesheetHeader", h.Id, { Status: "posted" }, actor);
        movedToPosted += 1;
      }
    }

    /* انتشار رویداد (D13، شکاف H-04).
     *
     * پس از نوشتن در دفتر داخلی و در **همان** درخواست: اگر به بعد
     * موکول می‌شد، بین ثبت و انتشار پنجره‌ای می‌ماند که در آن دفتر
     * داخلی رقم دارد و سامانهٔ بیرونی ندارد.
     *
     * `upsert` روی `EventKey` یکتا — رویداد دو بار در صندوق
     * نمی‌نشیند حتی اگر دوره چند بار ارسال شود؛ بار به‌روز می‌شود
     * چون رقم تازه، حقیقت تازه است. */
    let emitted = 0;
    if (apply) {
      const occurredAt = new Date().toISOString();
      for (const x of results) {
        if (x.status !== "posted") continue;
        const { envelope, issues } = buildEvent({
          type: "hrm.labor.posted",
          projectId,
          keyParts: [periodCode, x.costAccountId],
          entityName: "HrmCostPosting",
          entityId: `${periodCode}:${x.costAccountId}`,
          occurredAt,
          payload: {
            projectId,
            periodCode,
            costAccountId: x.costAccountId,
            accountCode: x.accountCode ?? null,
            amount: x.hrmShare,
            equivalentHours: x.equivalentHours,
            unpricedHours: x.unpricedHours,
            currency: plan.currency,
            memoFa: x.memoFa,
          },
        });
        if (!envelope) {
          /* رویداد ناقص در صندوق نمی‌نشیند — بارها تلاش و بارها شکست
           * می‌خورد. در سیاهه ثبت می‌شود تا دیده شود. */
          await hrmAudit(r, req, "HRM_EVENT_BUILD_FAILED", {
            projectId, entityName: "IntegrationEvent", entityId: x.costAccountId,
            severity: "warning", issues: issues.map((i) => i.code),
          });
          continue;
        }
        /* یافتهٔ لوپ ۱۰: `upsert` ساده، رویدادِ **تحویل‌شده** را با
         * مبلغ تازه بازنویسی می‌کرد و به `pending` برمی‌گرداند.
         * سامانهٔ بیرونی رقم قبلی را گرفته بود و هیچ ردی از آن
         * نمی‌ماند — نه در صندوق، نه در آشتی.
         *
         * حالا رویداد تحویل‌شده دست‌نخورده می‌ماند و اصلاح، رویداد
         * **تازه‌ای** با نسخهٔ بعدی می‌سازد. تاریخچهٔ آنچه واقعاً
         * بیرون رفته حفظ می‌شود، که اصل «رویداد عکس لحظهٔ وقوع است»
         * را نگه می‌دارد. */
        const prior = await r.findOne("IntegrationEvent", [
          { column: "EventKey", op: "eq", value: envelope.eventKey },
        ]);
        let key = envelope.eventKey;
        if (prior && String(prior.Status) === "delivered") {
          let priorAmount = null;
          try { priorAmount = Number(JSON.parse(String(prior.PayloadJson ?? "{}")).amount); } catch { priorAmount = null; }
          /* ارسال دوباره با همان رقم، رویداد تازه نمی‌خواهد. */
          if (priorAmount !== null && round2Srv(priorAmount) === round2Srv(x.hrmShare)) continue;

          /* شمارهٔ اصلاح از تعداد رویدادهای موجود همین کلید می‌آید. */
          const siblings = await r.list("IntegrationEvent", {
            where: [
              { column: "ProjectId", op: "eq", value: projectId },
              { column: "EntityId", op: "eq", value: envelope.entityId },
            ],
            limit: 100,
          });
          key = `${envelope.eventKey}#r${siblings.length}`;
          envelope.payload.supersedesAmount = priorAmount;
          envelope.payload.revision = siblings.length;
        }

        await r.upsert(
          "IntegrationEvent",
          { EventKey: key },
          {
            EventKey: key,
            EventType: envelope.eventType,
            SchemaVersion: envelope.schemaVersion,
            SourceModule: envelope.sourceModule,
            TargetModule: envelope.targetModule,
            ProjectId: projectId,
            EntityName: envelope.entityName ?? null,
            EntityId: envelope.entityId ?? null,
            PayloadJson: JSON.stringify(envelope.payload).slice(0, 7900),
            Status: "pending",
            OccurredAt: envelope.occurredAt,
            AttemptCount: 0,
            EmittedBy: actor,
          },
          actor,
        );
        emitted += 1;
      }
    }

    if (apply) {
      await hrmAudit(r, req, "HRM_COST_POSTED", {
        projectId, entityName: "HrmCostPosting", entityId: periodCode,
        severity: "info",
        accounts: results.filter((x) => x.status === "posted").length,
        amount: postedAmount,
        unpricedHours: plan.unpricedHours,
        replaced: priorRows.length,
        movedToPosted,
        eventsEmitted: emitted,
      });
    }

    res.json(hrmOk(req, {
      mode: apply ? "applied" : "preview",
      periodCode,
      rateAsOf: asOf,
      periodLocked: locked,
      movedToPosted,
      eventsEmitted: emitted,
      gate,
      postings: results,
      totals: {
        amount: apply ? postedAmount : plan.totalAmount,
        equivalentHours: plan.totalHours,
        unpricedHours: plan.unpricedHours,
        unallocatedHours: plan.unallocatedHours,
        currency: plan.currency,
      },
      missingAccounts: results.filter((x) => x.status === "missing_account").length,
    }));
  } catch (err) { next(err); }
});

/** دفتر ارسال‌های انجام‌شده. */
app.get("/api/hrm/cost/postings", hrmRequire("hrm.analytics.view"), async (req, res, next) => {
  try {
    const projectId = hrmProjectOf(req, res);
    if (!projectId) return;
    const r = await repo();
    const where = [{ column: "ProjectId", op: "eq", value: projectId }];
    const periodCode = String(req.query.periodCode || "");
    if (periodCode) where.push({ column: "PeriodCode", op: "eq", value: periodCode });

    const items = await r.list("HrmCostPosting", { where, limit: 5000 });
    items.sort((a, b) => String(b.PostedAt).localeCompare(String(a.PostedAt)));

    res.json(hrmOk(req, {
      items,
      count: items.length,
      totalAmount: round2Srv(items.reduce((s, x) => s + Number(x.Amount ?? 0), 0)),
      totalHours: round2Srv(items.reduce((s, x) => s + Number(x.EquivalentHours ?? 0), 0)),
      unpricedHours: round2Srv(items.reduce((s, x) => s + Number(x.UnpricedHours ?? 0), 0)),
    }));
  } catch (err) { next(err); }
});

/* ═══════════ D13 — صندوق رویداد و یکپارچه‌سازی ═══════════
 *
 * D12 هزینه را در دفتر مالی نشاند، ولی فقط داخل همین سامانه. اینجا
 * قرارداد رسمی رویداد ساخته می‌شود تا سامانهٔ بیرونی هم بداند —
 * شکاف H-04 از سند D1.
 *
 * مسیرها زیر `/api/hrm/` نیستند چون صندوق **مشترک** است: هر ماژول
 * دیگری هم می‌تواند در آن بنویسد. RBAC هم با مجوز `core.event.*`
 * است نه `hrm.*`.
 */

/** کاتالوگ رویدادهای منتشرشونده — قرارداد با مصرف‌کننده. */
app.get("/api/events/catalog", hrmRequire("core.event.view"), (req, res) => {
  res.json(hrmOk(req, {
    schemaVersion: EVENT_SCHEMA_VERSION,
    items: HRM_EVENT_CATALOG,
    count: HRM_EVENT_CATALOG.length,
    states: Object.entries(EVENT_STATE_FA).map(([code, fa]) => ({ code, fa })),
    maxAttempts: EVENT_MAX_ATTEMPTS,
  }));
});

/** صندوق خروجی و سلامت آن. */
app.get("/api/events/outbox", hrmRequire("core.event.view"), async (req, res, next) => {
  try {
    const projectId = hrmProjectOf(req, res);
    if (!projectId) return;
    const r = await repo();
    const where = [{ column: "ProjectId", op: "eq", value: projectId }];
    const status = String(req.query.status || "");
    if (status) where.push({ column: "Status", op: "eq", value: status });

    const rows = await r.list("IntegrationEvent", { where, limit: 5000 });
    rows.sort((a, b) => String(b.OccurredAt).localeCompare(String(a.OccurredAt)));

    const nowIso = new Date().toISOString();
    /* سلامت همیشه از **کل** صندوق حساب می‌شود، نه از نمای فیلترشده.
     * وگرنه فیلتر «تحویل‌شده» صندوقِ عقب‌مانده را سبز نشان می‌داد. */
    const all = status
      ? await r.list("IntegrationEvent", { where: [{ column: "ProjectId", op: "eq", value: projectId }], limit: 5000 })
      : rows;

    res.json(hrmOk(req, {
      items: rows.map(({ PayloadJson, ...rest }) => ({
        ...rest,
        payloadSize: String(PayloadJson ?? "").length,
        dueForRetry: isDueForRetry(rest, nowIso),
      })),
      count: rows.length,
      health: outboxHealth(all, nowIso),
    }));
  } catch (err) { next(err); }
});

/** یک رویداد با بار کامل. */
app.get("/api/events/outbox/:id", hrmRequire("core.event.view"), async (req, res, next) => {
  try {
    const projectId = hrmProjectOf(req, res);
    if (!projectId) return;
    const r = await repo();
    const row = await r.findOne("IntegrationEvent", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "Id", op: "eq", value: String(req.params.id) },
    ]);
    if (!row) return hrmBad(req, res, "E-HRM-EVT-NOT-FOUND", "رویداد پیدا نشد", 404);

    let payload = null;
    try { payload = JSON.parse(String(row.PayloadJson ?? "null")); } catch { payload = null; }

    res.json(hrmOk(req, {
      event: { ...row, payload },
      statusFa: EVENT_STATE_FA[String(row.Status)] ?? String(row.Status),
      dueForRetry: isDueForRetry(row, new Date().toISOString()),
    }));
  } catch (err) { next(err); }
});

/**
 * تلاش تحویل.
 *
 * مصرف‌کنندهٔ واقعی (ERP سازمان) در این مخزن نیست، پس تحویل شبیه‌سازی
 * می‌شود: `ack` یعنی مقصد پذیرفت، بدون آن یعنی نپذیرفت. آنچه واقعی
 * است، **ماشین حالت** است — و همان چیزی است که وقتی اتصال واقعی
 * بیاید تغییر نمی‌کند.
 */
app.post("/api/events/outbox/:id/deliver", hrmRequire("core.event.replay"), async (req, res, next) => {
  try {
    const projectId = hrmProjectOf(req, res);
    if (!projectId) return;
    const r = await repo();
    const row = await r.findOne("IntegrationEvent", [
      { column: "ProjectId", op: "eq", value: projectId },
      { column: "Id", op: "eq", value: String(req.params.id) },
    ]);
    if (!row) return hrmBad(req, res, "E-HRM-EVT-NOT-FOUND", "رویداد پیدا نشد", 404);

    const current = String(row.Status ?? "pending");
    if (current === "delivered") {
      /* تحویل دوباره یعنی نوشتن دوباره در سامانهٔ بیرونی. */
      return hrmBad(req, res, "E-HRM-473", "این رویداد قبلاً تحویل شده است", 409);
    }
    if (current === "abandoned" && req.body?.force !== true) {
      return hrmBad(req, res, "E-HRM-474",
        `این رویداد پس از ${row.AttemptCount} تلاش رها شده؛ برای تلاش دوباره force لازم است`, 409,
        ["ابتدا علت شکست را برطرف کنید، سپس با force=true تلاش کنید"]);
    }

    const b = req.body ?? {};
    const outcome = nextDeliveryState({
      ok: b.ack === true,
      /* رویداد رهاشده‌ای که با force تلاش می‌شود، شمارنده‌اش صفر
       * می‌شود — وگرنه بی‌درنگ دوباره رها می‌شد. */
      attemptCount: current === "abandoned" ? 0 : Number(row.AttemptCount ?? 0),
      errorFa: b.errorFa ? String(b.errorFa).slice(0, 300) : undefined,
    });

    const actor = hrmActor(req);
    await r.patch("IntegrationEvent", row.Id, {
      Status: outcome.nextStatus,
      AttemptCount: outcome.attemptCount,
      DeliveredAt: outcome.nextStatus === "delivered" ? new Date().toISOString() : null,
      LastErrorFa: outcome.nextStatus === "delivered" ? null : outcome.messageFa.slice(0, 400),
      AckRef: b.ackRef ? String(b.ackRef).slice(0, 120) : null,
    }, actor);

    await hrmAudit(r, req, "EVENT_DELIVERY_ATTEMPT", {
      projectId, entityName: "IntegrationEvent", entityId: String(row.Id),
      severity: outcome.nextStatus === "abandoned" ? "warning" : "info",
      eventType: row.EventType, result: outcome.nextStatus, attempt: outcome.attemptCount,
    });

    res.json(hrmOk(req, {
      id: row.Id,
      ...outcome,
      statusFa: EVENT_STATE_FA[outcome.nextStatus],
    }));
  } catch (err) { next(err); }
});

/**
 * آشتی‌دادن دفتر ارسال با صندوق رویداد.
 *
 * ارسال هزینه و انتشار رویداد دو نوشتن جدا هستند. اگر میانشان چیزی
 * بشکند، دفتر داخلی رقم دارد ولی سامانهٔ بیرونی ندارد — و هیچ‌کدام
 * متوجه نمی‌شوند چون هرکدام دفتر خودش را کامل می‌بیند.
 */
app.get("/api/events/reconcile", hrmRequire("core.event.view"), async (req, res, next) => {
  try {
    const projectId = hrmProjectOf(req, res);
    if (!projectId) return;
    const r = await repo();
    const pWhere = [{ column: "ProjectId", op: "eq", value: projectId }];
    const periodCode = String(req.query.periodCode || "");
    if (periodCode) pWhere.push({ column: "PeriodCode", op: "eq", value: periodCode });

    const [postings, events] = await Promise.all([
      r.list("HrmCostPosting", { where: pWhere, limit: 5000 }),
      r.list("IntegrationEvent", {
        where: [
          { column: "ProjectId", op: "eq", value: projectId },
          { column: "EventType", op: "eq", value: "hrm.labor.posted" },
        ],
        limit: 5000,
      }),
    ]);

    const recon = reconcilePostings(postings, events);
    res.json(hrmOk(req, {
      periodCode: periodCode || null,
      ...recon,
      isClean: recon.issues === 0,
      messageFa: recon.issues === 0
        ? `${recon.matched} ردیف منطبق؛ دفتر داخلی و صندوق رویداد هم‌خوان‌اند`
        : `${recon.issues} ناهمخوانی — سامانهٔ بیرونی از بخشی از ارقام بی‌خبر است`,
    }));
  } catch (err) { next(err); }
});

/* ═══════════ زمان‌بند تحویل رویداد (رفع TD-HRM-16) ═══════════
 *
 * تا اینجا صندوق پر می‌شد ولی کسی خالی‌اش نمی‌کرد: تحویل فقط با
 * فراخوانی دستی `POST /api/events/outbox/:id/deliver` انجام می‌شد.
 * یعنی رویدادی که نیمه‌شب ساخته می‌شد تا صبح در صف می‌ماند و
 * `outboxHealth` به‌درستی قرمز می‌شد — ولی کسی نبود که کاری بکند.
 *
 * **پیش‌فرض خاموش است.** بدون `EVENT_DISPATCH_MS` هیچ تایمری ساخته
 * نمی‌شود. دلیلش این است که مصرف‌کنندهٔ واقعی (ERP سازمان) در این
 * مخزن نیست؛ زمان‌بندی که به جایی وصل نباشد فقط شمارندهٔ تلاش را
 * بالا می‌برد و رویدادهای سالم را به `abandoned` می‌رساند — یعنی
 * دقیقاً همان چیزی را خراب می‌کند که قرار بود درست کند.
 *
 * وقتی اتصال واقعی آمد، `EVENT_TARGET_URL` را بدهید و همین حلقه
 * بدون تغییر ساختار کار می‌کند.
 */

/** یک دور تحویل: رویدادهای سررسیدشده را برمی‌دارد و تلاش می‌کند. */
async function dispatchDueEvents(limit = 20) {
  const r = await repo();
  const nowIso = new Date().toISOString();

  /* فقط وضعیت‌های زنده — `delivered` و `abandoned` کاری ندارند.
   * محدودیت تعداد عمدی است: یک دور طولانی، دور بعدی را عقب می‌اندازد
   * و اگر مقصد کند باشد صف را بدتر می‌کند. */
  const rows = await r.list("IntegrationEvent", {
    where: [{ column: "Status", op: "in", value: ["pending", "failed"] }],
    limit: 500,
  });

  const due = rows.filter((x) => isDueForRetry(x, nowIso)).slice(0, limit);
  if (!due.length) return { attempted: 0, delivered: 0, failed: 0, abandoned: 0 };

  const target = String(process.env.EVENT_TARGET_URL || "").trim();
  const timeoutMs = Math.max(Number(process.env.EVENT_TIMEOUT_MS || 10000), 1000);
  const out = { attempted: 0, delivered: 0, failed: 0, abandoned: 0 };

  for (const row of due) {
    out.attempted += 1;

    let ok = false;
    let errorFa;
    let ackRef = null;

    if (!target) {
      /* بدون مقصد، تحویل «موفق» اعلام نمی‌شود.
       *
       * وسوسه‌اش هست — صف خالی می‌شود و همه‌چیز سبز به‌نظر می‌رسد —
       * ولی آن دروغ است: هیچ سامانه‌ای آن رقم را نگرفته. شکست صادقانه
       * با پیام روشن، صف را قرمز نگه می‌دارد تا کسی مقصد را تنظیم کند. */
      errorFa = "مقصد تحویل تنظیم نشده است (EVENT_TARGET_URL)";
    } else {
      try {
        const res = await fetch(target, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-event-type": String(row.EventType),
            "x-event-key": String(row.EventKey),
            /* کلید ایدمپوتنسی به سبک استاندارد، برای مقصدی که
             * `x-event-key` اختصاصی ما را نمی‌شناسد. تحویل دوباره پس
             * از قطعی شبکه در سمت **مقصد** هم نباید سند دوم بسازد. */
            "idempotency-key": String(row.EventKey),
            "x-attempt": String(Number(row.AttemptCount ?? 0) + 1),
          },
          body: String(row.PayloadJson ?? "{}"),
          signal: AbortSignal.timeout(timeoutMs),
        });
        ok = res.ok;

        /* رفع TD-HRM-14 — پاسخ مقصد نگه داشته می‌شود.
         *
         * پیش از این پاسخ خوانده نمی‌شد و دور ریخته می‌شد. یعنی وقتی
         * فردا کسی می‌پرسید «این رقم در ERP کدام سند است؟» جوابی
         * نبود — نه در صندوق، نه در سیاهه. مسیر دستی `deliver` این
         * را داشت (`ackRef`) ولی مسیر خودکار نه، و همان مسیر خودکار
         * است که در عمل کار می‌کند.
         *
         * پاسخ غیر JSON یا بدون شناسه، سکوت می‌گیرد؛ نبودش خطا نیست
         * چون همهٔ مقصدها شناسه برنمی‌گردانند. */
        const raw = await res.text().catch(() => "");
        if (ok && raw) {
          try {
            const body = JSON.parse(raw);
            const found = body?.ref ?? body?.id ?? body?.documentNo ?? body?.reference ?? null;
            if (found) ackRef = String(found).slice(0, 120);
          } catch { /* پاسخ متنی — شناسه‌ای برای ذخیره نیست */ }
        }
        if (!ok) {
          /* بدنهٔ خطا اغلب می‌گوید **چرا** رد شد؛ بدون آن، «۴۰۰» یعنی
           * کسی باید لاگ مقصد را بخواند. */
          const hint = raw ? ` — ${raw.replace(/\s+/g, " ").slice(0, 120)}` : "";
          errorFa = `مقصد پاسخ ${res.status} داد${hint}`;
        }
      } catch (err) {
        /* مهلت تمام‌شده از خطای شبکه جدا می‌شود: اولی یعنی مقصد کند
         * است (شاید سند را ساخته باشد)، دومی یعنی اصلاً نرسید. */
        const name = String(err?.name ?? "");
        errorFa = name === "TimeoutError" || name === "AbortError"
          ? `مقصد در ${timeoutMs} میلی‌ثانیه پاسخ نداد؛ ممکن است سند را ساخته باشد — کلید ایدمپوتنسی از تکرار جلوگیری می‌کند`
          : `خطای شبکه: ${String(err?.message ?? err).slice(0, 160)}`;
      }
    }

    const outcome = nextDeliveryState({
      ok,
      attemptCount: Number(row.AttemptCount ?? 0),
      errorFa,
    });

    await r.patch("IntegrationEvent", row.Id, {
      Status: outcome.nextStatus,
      AttemptCount: outcome.attemptCount,
      DeliveredAt: outcome.nextStatus === "delivered" ? new Date().toISOString() : null,
      LastErrorFa: outcome.nextStatus === "delivered" ? null : outcome.messageFa.slice(0, 400),
      /* شناسهٔ سند مقصد فقط وقتی نوشته می‌شود که واقعاً آمده باشد —
       * تهی کردنش در تلاش بعدی، ردِ تحویل قبلی را پاک می‌کند. */
      ...(ackRef ? { AckRef: ackRef } : {}),
    }, "event-dispatcher");

    if (outcome.nextStatus === "delivered") out.delivered += 1;
    else if (outcome.nextStatus === "abandoned") out.abandoned += 1;
    else out.failed += 1;
  }

  return out;
}

/**
 * اجرای دستی یک دور تحویل.
 *
 * حتی وقتی زمان‌بند خاموش است این مسیر کار می‌کند — برای عیب‌یابی و
 * برای استقراری که ترجیح می‌دهد از cron بیرونی صدا بزند به‌جای
 * تایمر درون‌فرایندی.
 */
app.post("/api/events/dispatch", hrmRequire("core.event.replay"), async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.body?.limit ?? 20), 1), 100);
    const result = await dispatchDueEvents(limit);
    res.json(hrmOk(req, {
      ...result,
      targetConfigured: Boolean(String(process.env.EVENT_TARGET_URL || "").trim()),
      messageFa: result.attempted === 0
        ? "رویداد سررسیدشده‌ای در صف نبود"
        : `${result.attempted} تلاش · ${result.delivered} تحویل · ${result.failed} ناموفق · ${result.abandoned} رهاشده`,
    }));
  } catch (err) { next(err); }
});

const eventDispatchMs = Number(process.env.EVENT_DISPATCH_MS || 0);
if (eventDispatchMs > 0) {
  setInterval(() => {
    dispatchDueEvents(20)
      .then((r) => {
        if (r.attempted > 0) {
          console.log(`[event-dispatch] ${r.attempted} تلاش · ${r.delivered} تحویل · ${r.abandoned} رهاشده`);
        }
      })
      /* خطای حلقهٔ پس‌زمینه نباید فرایند را بکشد — صندوق فردا هم
       * همان‌جاست. */
      .catch((err) => console.error("[event-dispatch] خطا:", err?.message ?? err));
  }, eventDispatchMs).unref();
  console.log(`[event-dispatch] زمان‌بند فعال — هر ${eventDispatchMs} میلی‌ثانیه`);
}

app.use((req, res) => {
  res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: `Route ${req.method} ${req.path} was not found`, traceId: req.requestId } });
});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  console.error(`[${req.requestId}]`, err);
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ ok: false, error: { code: "FILE_UPLOAD_ERROR", message: err.message, traceId: req.requestId } });
  }
  if (err.code === "ROW_VALIDATION_FAILED") {
    return res.status(422).json({ ok: false, error: { code: err.code, message: err.message, issues: err.issues, traceId: req.requestId } });
  }
  if (err.code === "DUPLICATE_KEY" || err.code === "UNIQUE_VIOLATION") {
    return res.status(409).json({ ok: false, error: { code: err.code, message: err.message, traceId: req.requestId } });
  }
  if (err.code === "UNKNOWN_COLUMN" || err.code === "UNKNOWN_TABLE") {
    return res.status(400).json({ ok: false, error: { code: err.code, message: err.message, traceId: req.requestId } });
  }
  if (err.code === "PERSISTENCE_UNAVAILABLE") {
    return res.status(503).json({ ok: false, error: { code: err.code, message: err.message, traceId: req.requestId } });
  }
  if (err.code === "UNSUPPORTED_FILE_TYPE") {
    return res.status(415).json({ ok: false, error: { code: err.code, message: err.message, traceId: req.requestId } });
  }
  res.status(500).json({ ok: false, error: { code: "UNHANDLED_ERROR", message: "Unexpected server error", traceId: req.requestId } });
});


const server = app.listen(PORT, () => {
  console.log("=======================================================");
  console.log(`  PMIS REST API Service running on http://localhost:${PORT}`);
  console.log(`  SQL Server Target: ${process.env.SQL_SERVER || ".\\SQL2008EXPRESS"} (${process.env.SQL_DATABASE || "PMIS_MASTER_DB"})`);
  console.log("=======================================================");
});

async function shutdown(signal) {
  console.log(`${signal} received; stopping PMIS API...`);
  server.close(async () => {
    if (poolCache) await poolCache.close().catch(() => {});
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
