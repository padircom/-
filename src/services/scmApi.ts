/**
 * کلاینت REST میز کار خرید و تدارکات — SCM (P5)
 * مسیر نسبی /api/scm/... از پراکسی Vite
 * ═══════════════════════════════════════════════════════════════════════
 * این فایل گذشته از کلاینت، «آینهٔ کلاینت‌سوی RBAC» را هم دارد
 * (`canScmAccess`) تا رابط کاربری بداند کدام دکمه را غیرفعال و با چه
 * مجوزی نشان دهد. تصمیم نهایی همیشه با سرور است (`server/scmWorkspaceApi.js`
 * با همان `evaluate` روی همان `DEMO_SUBJECTS`).
 */
import { jsonRequest, type ApiResult } from "./apiClient";
import { DEMO_SUBJECTS, evaluate, roleDef, type Decision, type Subject } from "./accessControl";

export type ScmWorkspacePayload = {
  projectId: string;
  vendors: any[];
  avls: any[];
  packages: any[];
  links: any[];
  inquiries: any[];
  bidders: any[];
  invitations: any[];
  mrChanges: any[];
  mrrs: any[];
  mrs: any[];
  proposals: any[];
  clarifications: any[];
  evaluations: any[];
  bidReports: any[];
  koms: any[];
  inspections: any[];
  shipments: any[];
  psrs: any[];
  warehouses: any[];
  catalog: any[];
  mrcs: any[];
  mrcLines: any[];
  mivs: any[];
  mivLines: any[];
  mrvs: any[];
  transfers: any[];
  balances: any[];
};

export type ScmResult<T> = ApiResult<T>;

export class ScmClient {
  constructor(private readonly projectId: string, private readonly userId: string | null) {}

  private req<T>(method: string, path: string, body?: unknown): Promise<ScmResult<T>> {
    return jsonRequest<T>(`/api/scm/${encodeURIComponent(this.projectId)}${path}`, this.userId, method, body);
  }

  workspace = () => this.req<ScmWorkspacePayload>("GET", "/workspace");
  createMr = (body: unknown) => this.req("POST", "/mrs", body);
  createVendor = (v: unknown) => this.req("POST", "/vendors", v);
  updateVendor = (code: string, patch: unknown) => this.req("PATCH", `/vendors/${encodeURIComponent(code)}`, patch);
  deleteVendor = (code: string) => this.req("DELETE", `/vendors/${encodeURIComponent(code)}`);

  createAvl = (a: unknown) => this.req("POST", "/avl", a);
  deleteAvl = (id: string) => this.req("DELETE", `/avl/${encodeURIComponent(id)}`);

  createPackage = (p: unknown) => this.req("POST", "/packages", p);
  updatePackage = (code: string, patch: unknown) => this.req("PATCH", `/packages/${encodeURIComponent(code)}`, patch);
  deletePackage = (code: string) => this.req("DELETE", `/packages/${encodeURIComponent(code)}`);

  linkMr = (pkgCode: string, body: unknown) => this.req("POST", `/packages/${encodeURIComponent(pkgCode)}/mrs`, body);
  unlinkMr = (pkgCode: string, mrCode: string) => this.req("DELETE", `/packages/${encodeURIComponent(pkgCode)}/mrs/${encodeURIComponent(mrCode)}`);

  createInquiry = (i: unknown) => this.req("POST", "/inquiries", i);
  updateInquiry = (code: string, patch: unknown) => this.req("PATCH", `/inquiries/${encodeURIComponent(code)}`, patch);

  addBidder = (inqCode: string, body: unknown) => this.req("POST", `/inquiries/${encodeURIComponent(inqCode)}/bidders`, body);
  ackBidder = (inqCode: string, vendorCode: string, body: unknown) => this.req("POST", `/inquiries/${encodeURIComponent(inqCode)}/bidders/${encodeURIComponent(vendorCode)}/ack`, body);
  removeBidder = (inqCode: string, vendorCode: string) => this.req("DELETE", `/inquiries/${encodeURIComponent(inqCode)}/bidders/${encodeURIComponent(vendorCode)}`);

  createInvitation = (body: unknown) => this.req("POST", "/invitations", body);
  ackInvitation = (invNo: string, body: unknown) => this.req("POST", `/invitations/${encodeURIComponent(invNo)}/ack`, body);

  listMrChanges = () => this.req<any[]>("GET", "/mr-changes");
  createMrChange = (body: unknown) => this.req("POST", "/mr-changes", body);
  notifyMrChange = (id: string) => this.req("POST", `/mr-changes/${encodeURIComponent(id)}/notify`, {});

  listMrrs = () => this.req<any[]>("GET", "/mrrs");
  createMrr = (body: unknown) => this.req("POST", "/mrrs", body);
  updateMrr = (code: string, patch: unknown) => this.req("PATCH", `/mrrs/${encodeURIComponent(code)}`, patch);

  createProposal = (body: unknown) => this.req("POST", "/proposals", body);
  createClarification = (proposalNo: string, body: unknown) => this.req("POST", `/proposals/${encodeURIComponent(proposalNo)}/clarifications`, body);
  createEvaluation = (body: unknown) => this.req("POST", "/evaluations", body);
  createBidReport = (body: unknown) => this.req("POST", "/bid-reports", body);
  createKom = (body: unknown) => this.req("POST", "/koms", body);
  createInspection = (body: unknown) => this.req("POST", "/inspections", body);
  createShipment = (body: unknown) => this.req("POST", "/shipments", body);
  createPsr = (body: unknown) => this.req("POST", "/psrs", body);
  createWarehouse = (body: unknown) => this.req("POST", "/warehouses", body);
  createCatalog = (body: unknown) => this.req("POST", "/catalog", body);
  createMrc = (body: unknown) => this.req("POST", "/mrcs", body);
  createMiv = (body: unknown) => this.req("POST", "/mivs", body);
  createMrv = (body: unknown) => this.req("POST", "/mrvs", body);
  createTransfer = (body: unknown) => this.req("POST", "/transfers", body);
  upsertBalance = (body: unknown) => this.req("POST", "/stock-balances", body);
}

/* ═══════════════════ انواع ردیف‌ها (شکل واقعی پاسخ سرور) ═══════════════════ */

export interface ScmVendorRow {
  Id: string;
  Code: string;
  NameFa: string;
  NameEn?: string | null;
  ContactPerson?: string | null;
  Email?: string | null;
  Phone?: string | null;
  Country?: string | null;
  City?: string | null;
  Disciplines?: string[] | null;
  MaterialCategories?: string[] | null;
  Status?: string | null;
  NoteFa?: string | null;
}

export interface ScmAvlRow {
  Id: string;
  VendorId: string;
  Discipline: string;
  MaterialCategory?: string | null;
  ApprovedBy?: string | null;
  ApprovedAt?: string | null;
  ExpiryAt?: string | null;
  Status?: string | null;
  NoteFa?: string | null;
}

export interface ScmPackageRow {
  Id: string;
  Code: string;
  TitleFa: string;
  Discipline?: string | null;
  WbsId?: string | null;
  Status?: string | null;
  PlannedIssueDate?: string | null;
  TotalEstimatedAmount?: number | null;
  Currency?: string | null;
  NoteFa?: string | null;
}

export interface ScmPackageMrLinkRow {
  Id: string;
  PackageId: string;
  MrCode: string;
  AddedBy?: string | null;
  AddedAt?: string | null;
  NoteFa?: string | null;
}

export interface ScmMrRow {
  Id: string;
  Code: string;
  TitleFa: string;
  Discipline?: string | null;
  Quantity?: number | null;
  Unit?: string | null;
  NeedByDate?: string | null;
  RaisedBy?: string | null;
  RaisedAt?: string | null;
  Status?: string | null;
  RemarksFa?: string | null;
}

export interface ScmInquiryRow {
  Id: string;
  Code: string;
  PackageId: string;
  TitleFa: string;
  InquiryType?: string | null;
  IssueDate?: string | null;
  DueDate?: string | null;
  Status?: string | null;
  NoteFa?: string | null;
}

export interface ScmBidderRow {
  Id: string;
  InquiryPackageId: string;
  VendorId: string;
  ListType?: string | null;
  Status?: string | null;
  InvitedAt?: string | null;
  AcknowledgedAt?: string | null;
  DeclineReasonFa?: string | null;
  NoteFa?: string | null;
}

export interface ScmInvitationRow {
  Id: string;
  InquiryPackageId: string;
  VendorId: string;
  InvitationNo: string;
  SentAt?: string | null;
  SentBy?: string | null;
  ValidUntil?: string | null;
  AckAt?: string | null;
  AckStatus?: string | null;
  NoteFa?: string | null;
}

export interface ScmMrChangeRow {
  Id: string;
  MrCode: string;
  ChangeType: string;
  OldValue?: string | null;
  NewValue?: string | null;
  ChangedBy?: string | null;
  ChangedAt?: string | null;
  NotifyStatus?: string | null;
  NotifiedAt?: string | null;
}

export interface ScmProposalRow {
  Id: string;
  ProposalNo: string;
  InquiryPackageId?: string | null;
  InquiryCode: string;
  VendorId?: string | null;
  VendorCode: string;
  Type: string;
  Status?: string | null;
  SubmittedAt?: string | null;
  Amount?: number | null;
  Currency?: string | null;
  ValidUntil?: string | null;
  NoteFa?: string | null;
}

export interface ScmClarificationRow {
  Id: string;
  ProposalId?: string | null;
  ProposalNo: string;
  QuestionFa: string;
  AnswerFa?: string | null;
  AskedBy?: string | null;
  AskedAt?: string | null;
  AnsweredAt?: string | null;
  Status?: string | null;
}

export interface ScmEvaluationRow {
  Id: string;
  EvalNo: string;
  ProposalId?: string | null;
  ProposalNo: string;
  Type: string;
  Score?: number | null;
  Result: string;
  EvaluatedBy?: string | null;
  EvaluatedAt?: string | null;
  NoteFa?: string | null;
}

export interface ScmBidReportRow {
  Id: string;
  ReportNo: string;
  InquiryPackageId?: string | null;
  InquiryCode: string;
  WinnerVendorCode?: string | null;
  TotalAmount?: number | null;
  Currency?: string | null;
  RecommendationFa?: string | null;
  Status?: string | null;
  CreatedBy?: string | null;
  CreatedAt?: string | null;
}

export interface ScmKomRow {
  Id: string;
  KomNo: string;
  PoNo?: string | null;
  Type: string;
  MeetingDate: string;
  LocationFa?: string | null;
  Status?: string | null;
  NoteFa?: string | null;
}

export interface ScmMrrRow {
  Id: string;
  Code: string;
  PoNo: string;
  ReceivedAt: string;
  ReceivedBy?: string | null;
  Quantity?: number | null;
  AcceptedQty?: number | null;
  RejectedQty?: number | null;
  OverQty?: number | null;
  ShortageQty?: number | null;
  DamageQty?: number | null;
  OpiType?: string | null;
  Status?: string | null;
  Warehouse?: string | null;
  NoteFa?: string | null;
}

export interface ScmInspectionRow {
  Id: string;
  InspectionNo: string;
  PoNo?: string | null;
  Type: string;
  Inspector?: string | null;
  InspectionDate: string;
  Result: string;
  ReleaseNoteNo?: string | null;
  NoteFa?: string | null;
}

export interface ScmShipmentRow {
  Id: string;
  ShipmentNo: string;
  PoNo?: string | null;
  Mode: string;
  OriginFa?: string | null;
  DestinationFa?: string | null;
  EtaDate?: string | null;
  AtaDate?: string | null;
  CustomsStatus?: string | null;
  NoteFa?: string | null;
}

export interface ScmPsrRow {
  Id: string;
  PsrNo: string;
  PoNo?: string | null;
  PackageCode?: string | null;
  ProgressPct?: number | null;
  ReportDate: string;
  StatusFa?: string | null;
  NextActionFa?: string | null;
  ReportedBy?: string | null;
}

export interface ScmWarehouseRow {
  Id: string;
  Code: string;
  NameFa: string;
  LocationFa?: string | null;
  Status?: string | null;
}

export interface ScmCatalogRow {
  Id: string;
  Code: string;
  NameFa: string;
  Category?: string | null;
  Unit?: string | null;
  SpecFa?: string | null;
  Status?: string | null;
}

export interface ScmBalanceRow {
  Id: string;
  WarehouseCode: string;
  MaterialCode: string;
  OnHand?: number | null;
  Reserved?: number | null;
  OnOrder?: number | null;
}

export interface ScmMrcRow {
  Id: string;
  MrcNo: string;
  RequestedBy?: string | null;
  RequiredDate: string;
  Status?: string | null;
  NoteFa?: string | null;
}

export interface ScmMrcLineRow {
  Id: string;
  MrcId: string;
  MrcNo: string;
  MaterialCode: string;
  Quantity?: number | null;
  ReservedQty?: number | null;
}

export interface ScmMivRow {
  Id: string;
  MivNo: string;
  MrcNo?: string | null;
  WarehouseCode: string;
  IssuedBy?: string | null;
  IssuedAt: string;
  Status?: string | null;
  NoteFa?: string | null;
}

export interface ScmMivLineRow {
  Id: string;
  MivId: string;
  MivNo: string;
  MaterialCode: string;
  Quantity?: number | null;
}

export interface ScmMrvRow {
  Id: string;
  MrvNo: string;
  MivNo?: string | null;
  WarehouseCode: string;
  ReturnedBy?: string | null;
  ReturnedAt: string;
  Status?: string | null;
  NoteFa?: string | null;
}

export interface ScmTransferRow {
  Id: string;
  TransferNo: string;
  FromWarehouse: string;
  ToWarehouse: string;
  MaterialCode: string;
  Quantity: number;
  TransferredBy?: string | null;
  TransferredAt: string;
  Status?: string | null;
  NoteFa?: string | null;
}

/* ═══════════════════ خطا و بازکردن نتیجهٔ کلاینت ═══════════════════ */

/** خطای SCM با همان کد و وضعیت HTTP سرور؛ برای نمایش دقیق دلیل به کاربر. */
export class ScmRequestError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(message: string, code: string, status: number, details?: Record<string, unknown>) {
    super(message);
    this.name = "ScmRequestError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/**
 * نتیجهٔ `ScmClient` را باز می‌کند: موفق → داده، ناموفق → `ScmRequestError`.
 * کامپوننت‌های CRUD خطا را با `catch` می‌گیرند، پس باید پرتاب شود.
 */
export async function callScm<T>(result: Promise<ScmResult<T>>): Promise<T> {
  const resolved = await result;
  if (resolved.ok) return resolved.data;
  throw new ScmRequestError(resolved.message, resolved.code, resolved.status, resolved.details);
}

/** پیام خطا برای نمایش در جدول/فرم؛ کد خطای سرور هم می‌آید. */
export function describeScmError(error: unknown): string {
  if (error instanceof ScmRequestError) {
    return error.code ? `${error.message} (${error.code})` : error.message;
  }
  if (error instanceof Error) return error.message;
  return "خطای ناشناخته در ارتباط با سرور خرید و انبار";
}

/* ═══════════════════ آینهٔ کلاینت‌سوی RBAC ═══════════════════ */

/** همان ده مجوز ماژول d5 که سرور روی مسیرهای SCM بررسی می‌کند. */
export const SCM_PERMISSION_CODES = [
  "scm.vendor.view",
  "scm.vendor.manage",
  "scm.package.view",
  "scm.package.edit",
  "scm.bidder.view",
  "scm.bidder.manage",
  "scm.mr.view",
  "scm.mr.manage",
  "scm.mrr.view",
  "scm.mrr.post",
] as const;

export type ScmPermissionCode = (typeof SCM_PERMISSION_CODES)[number];

export function findScmSubject(userId?: string | null): Subject | null {
  if (!userId) return null;
  const subject = DEMO_SUBJECTS.find((item) => item.id === userId) ?? null;
  return subject ?? null;
}

/**
 * تصمیم دسترسی برای یک مجوز SCM. سرور در `server/scmWorkspaceApi.js` هم
 * `evaluate(subject, permission, { projectId: undefined })` را صدا می‌زند؛
 * اینجا همان فراخوانی تکرار می‌شود تا دکمه‌های رابط کاربری با سرور یکی باشند.
 */
export function evaluateScmAccess(userId: string | null | undefined, permission: string): Decision {
  const subject = findScmSubject(userId);
  if (!subject) {
    return {
      allow: false,
      code: "DENY_INACTIVE",
      reason: { fa: "کاربر احراز هویت نشده است", en: "Unauthenticated user" },
      audit: true,
    };
  }
  return evaluate(subject, permission, {});
}

export function canScmAccess(userId: string | null | undefined, permission: string): boolean {
  return evaluateScmAccess(userId, permission).allow;
}

/* کاربران نمونهٔ حائز مجوز SCM — کاربران غیرفعال و کاربر آزمون تفکیک وظیفه
 * (`u-over`) عمداً نیستند، مثل فهرست ورود `AuthContext`. */
export const SCM_DEMO_USERS: Array<{
  id: string;
  displayName: string;
  roleFa: string;
  roleEn: string;
  permissions: string[];
}> = DEMO_SUBJECTS.filter(
  (subject) => subject.active && subject.id !== "u-over" && subject.id !== "u-left",
)
  .map((subject) => {
    const permissions = SCM_PERMISSION_CODES.filter((code) => evaluate(subject, code, {}).allow);
    const role = roleDef(subject.roles[0]);
    return {
      id: subject.id,
      displayName: subject.displayName,
      roleFa: role?.title.fa ?? subject.roles[0],
      roleEn: role?.title.en ?? subject.roles[0],
      permissions,
    };
  })
  .filter((user) => user.permissions.length > 0);
