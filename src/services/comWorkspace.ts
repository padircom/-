/**
 * CSU-1 + CSU-2 — کلاینت REST فضای کاری راه‌اندازی و تحویل (d15).
 * مسیرها نسبی `/api/com/...?projectId=` هستند تا از پراکسی Vite عبور کنند.
 * هیچ دادهٔ نمونه‌ای در کلاینت وجود ندارد؛ همه از سرور می‌آید.
 */
import { jsonRequest, type ApiResult } from './apiClient';
import {
  SYSTEM_TYPES,
  SYSTEM_STATUSES,
  GATE_TYPES,
  BOUNDARY_KINDS,
  CRITICALITIES,
  PACK_TYPES,
  TEST_KINDS_BY_TYPE,
  TEST_KIND_FA,
  PACK_TYPE_FA,
  PACK_STATUS_FA,
  SYSTEM_TYPE_FA,
  SYSTEM_STATUS_FA,
  GATE_TYPE_FA,
  BOUNDARY_KIND_FA,
  CRITICALITY_FA,
  SHEET_RESULT_FA,
  TAG_TYPES,
  TAG_STATUSES,
  TAG_TYPE_FA,
  TAG_STATUS_FA,
} from './commissioning';

export {
  SYSTEM_TYPES,
  SYSTEM_STATUSES,
  GATE_TYPES,
  BOUNDARY_KINDS,
  CRITICALITIES,
  PACK_TYPES,
  TEST_KINDS_BY_TYPE,
  TEST_KIND_FA,
  PACK_TYPE_FA,
  PACK_STATUS_FA,
  SYSTEM_TYPE_FA,
  SYSTEM_STATUS_FA,
  GATE_TYPE_FA,
  BOUNDARY_KIND_FA,
  CRITICALITY_FA,
  SHEET_RESULT_FA,
  TAG_TYPES,
  TAG_STATUSES,
  TAG_TYPE_FA,
  TAG_STATUS_FA,
};

export type ComResult<T> = ApiResult<T>;

export type SystemItem = {
  Id: string;
  ProjectId: string;
  ParentId: string | null;
  SystemCode: string;
  TitleFa: string;
  TitleEn?: string | null;
  SystemType: string;
  DisciplineCode?: string | null;
  CommissioningPriority?: number | null;
  CriticalityFa?: string | null;
  SortOrder?: number | null;
  Status: string;
  typeFa: string;
  statusFa: string;
  criticalityLabelFa: string | null;
  depth?: number;
  path?: string[];
  descendantCount?: number;
};

export type SystemTreePayload = {
  count: number;
  orphans: string[];
  tree: (SystemItem & { children: SystemTreePayload['tree'] })[];
  items: SystemItem[];
};

export type BoundaryItem = {
  Id: string;
  ProjectId: string;
  SystemId: string;
  TargetKind: string;
  TargetRef: string;
  IsPrimary: boolean;
  BoundaryNoteFa?: string | null;
  kindFa: string;
};

export type BoundaryPayload = {
  count: number;
  items: BoundaryItem[];
  coverage: {
    systemId: string;
    total: number;
    byKind: Record<string, number>;
    hasPrimary: boolean;
    gapsFa: string[];
  };
};

export type MilestonePayload = {
  id: string;
  replaced: boolean;
  item: {
    Id?: string;
    ProjectId: string;
    SystemId: string;
    GateType: string;
    TargetDate: string;
    ForecastDate?: string | null;
    ActualDate?: string | null;
    SlipDays?: number | null;
    gateFa: string;
  };
  slip: { slipDays: number | null; basis: string };
};

export type PlanGate = { code: string; titleFa: string };
export type PlanRow = {
  systemId: string;
  systemCode: string;
  titleFa: string;
  gates: Record<string, { target: string | null; forecast: string | null; actual: string | null; slipDays: number | null; basis: string }>;
  worstSlipDays: number | null;
  status: string;
  statusFa: string;
};
export type PriorityCell = {
  systemId: string;
  systemCode: string;
  titleFa: string;
  priority: number;
  criticality: string;
  readinessPct: number;
  band: string;
  bandFa: string;
  rank: number;
};
export type PlanPayload = {
  gates: PlanGate[];
  summary: {
    total: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
    byCriticality: Record<string, number>;
    rootCount: number;
    maxDepth: number;
    orphanCount: number;
    withoutBoundary: number;
    withoutMilestone: number;
    readinessPct: number;
  };
  plan: PlanRow[];
  priority: PriorityCell[];
};

export type MatrixPayload = {
  count: number;
  columns: string[];
  rows: Record<string, unknown>[];
};

export type PackItem = {
  Id: string;
  ProjectId: string;
  SystemId: string;
  PackNo: string;
  TitleFa: string;
  PackType: string;
  Status: string;
  typeFa: string;
  statusFa: string;
  TotalSheets?: number;
  ClearedSheets?: number;
  progress: {
    packId: string;
    total: number;
    signed: number;
    passed: number;
    failed: number;
    draft: number;
    voided: number;
    clearedPct: number;
    canClear: boolean;
    blockersFa: string[];
  };
};

export type PackPayload = { count: number; items: PackItem[] };
export type PackCreatePayload = {
  id: string;
  item: PackItem;
  allowedTestKinds: { code: string; titleFa: string }[];
};

export type SheetLine = {
  Id: string;
  SheetId: string;
  LineNo: number;
  ParameterFa: string;
  ExpectedValue?: string | null;
  ActualValue?: string | null;
  UnitFa?: string | null;
  IsMandatory: boolean;
  Passed?: boolean | null;
  NoteFa?: string | null;
};

export type SheetItem = {
  Id: string;
  ProjectId: string;
  PackId: string;
  SheetNo: string;
  SheetType: string;
  TestKind: string;
  TitleFa: string;
  Status: string;
  ResultFa?: string | null;
  WitnessedBy?: string | null;
  TestDate?: string | null;
  kindFa: string;
  resultLabelFa: string | null;
  lines: SheetLine[];
  verdict: {
    total: number;
    mandatory: number;
    passed: number;
    failed: number;
    pending: number;
    resultFa: string;
    resultLabelFa: string;
    blockersFa: string[];
  };
};

export type SheetPayload = { count: number; items: SheetItem[] };
export type SheetCreatePayload = {
  id: string;
  item: SheetItem;
  lines: SheetLine[];
  verdict: SheetItem['verdict'];
};

export type PunchItem = {
  Id: string;
  ProjectId: string;
  CertificateId?: string | null;
  ContractId?: string | null;
  ItemNo: string;
  TitleFa: string;
  Category: string;
  DisciplineCode?: string | null;
  Status: string;
  categoryFa?: string;
};

export type PunchPayload = {
  count: number;
  summary: Record<string, unknown>;
  items: PunchItem[];
};

export type CertificateItem = {
  Id: string;
  ProjectId: string;
  ContractId?: string | null;
  CertificateType: string;
  CertificateNo: string;
  TitleFa: string;
  HandoverDate: string;
  Status: string;
  typeFa?: string;
};

export type CertificatePayload = { count: number; items: CertificateItem[] };

export type PrecommPayload = {
  summary: {
    packs: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
    sheets: number;
    signedSheets: number;
    failedSheets: number;
    progressPct: number;
    systemsWithoutPack: string[];
  };
  testKinds: { packType: string; packTypeFa: string; kinds: { code: string; titleFa: string }[] }[];
};

export type ColdClearancePayload = {
  system: { id: string; code: string; titleFa: string };
  clearance: {
    systemId: string;
    ok: boolean;
    packCount: number;
    clearedPacks: number;
    blockersFa: string[];
    warningsFa: string[];
  };
};

export type TagItem = {
  Id: string;
  ProjectId: string;
  SystemId: string | null;
  TagNo: string;
  TitleFa: string;
  TitleEn?: string | null;
  TagType: string;
  DisciplineCode?: string | null;
  LocationFa?: string | null;
  LoopNo?: string | null;
  ManufacturerFa?: string | null;
  ModelFa?: string | null;
  SerialNo?: string | null;
  CriticalityFa?: string | null;
  NoteFa?: string | null;
  Status: string;
  typeFa: string;
  statusFa: string;
};

export type TagPayload = {
  count: number;
  summary: {
    total: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
    bySystem: Record<string, number>;
    withoutSystem: number;
    withoutDiscipline: number;
  };
  items: TagItem[];
};

export class ComClient {
  constructor(private readonly projectId: string, private readonly userId: string | null) {}

  private q(path: string) {
    const sep = path.includes('?') ? '&' : '?';
    return `${path}${sep}projectId=${encodeURIComponent(this.projectId)}`;
  }

  private req<T>(method: string, path: string, body?: unknown): Promise<ComResult<T>> {
    return jsonRequest<T>(this.q(path), this.userId, method, body);
  }

  // ── systems
  systems = () => this.req<SystemTreePayload>('GET', '/api/com/system');
  createSystem = (body: unknown) => this.req<{ id: string; item: SystemItem }>('POST', '/api/com/system', body);
  moveSystem = (id: string, parentId: string | null) => this.req<{ item: SystemItem }>('POST', `/api/com/system/${encodeURIComponent(id)}/move`, { parentId });

  // ── boundaries
  boundaries = (systemId: string) => this.req<BoundaryPayload>('GET', `/api/com/system/${encodeURIComponent(systemId)}/boundary`);
  createBoundary = (systemId: string, body: unknown) => this.req<BoundaryPayload>('POST', `/api/com/system/${encodeURIComponent(systemId)}/boundary`, body);

  // ── milestones
  createMilestone = (systemId: string, body: unknown) => this.req<MilestonePayload>('POST', `/api/com/system/${encodeURIComponent(systemId)}/milestone`, body);

  // ── plan / matrix
  plan = () => this.req<PlanPayload>('GET', '/api/com/plan');
  matrix = () => this.req<MatrixPayload>('GET', '/api/com/matrix');

  // ── packs
  packs = (params: { systemId?: string; packType?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.systemId) qs.set('systemId', params.systemId);
    if (params.packType) qs.set('packType', params.packType);
    const extra = qs.toString() ? `&${qs.toString()}` : '';
    return this.req<PackPayload>('GET', `/api/com/pack${extra}`);
  };
  createPack = (body: unknown) => this.req<PackCreatePayload>('POST', '/api/com/pack', body);

  // ── sheets
  sheets = (params: { packId?: string } = {}) => {
    const extra = params.packId ? `&packId=${encodeURIComponent(params.packId)}` : '';
    return this.req<SheetPayload>('GET', `/api/com/sheet${extra}`);
  };
  createSheet = (body: unknown) => this.req<SheetCreatePayload>('POST', '/api/com/sheet', body);
  postReading = (sheetId: string, body: unknown) => this.req<{ item: SheetLine; verdict: SheetItem['verdict'] }>('POST', `/api/com/sheet/${encodeURIComponent(sheetId)}/reading`, body);
  signSheet = (sheetId: string, body: unknown) => this.req<{ item: SheetItem; verdict: SheetItem['verdict'] }>('POST', `/api/com/sheet/${encodeURIComponent(sheetId)}/sign`, body);
  clearPack = (packId: string, body: { dryRun?: boolean } = {}) => this.req<{ item: PackItem; progress: PackItem['progress']; dryRun?: boolean }>('POST', `/api/com/pack/${encodeURIComponent(packId)}/clear`, body);

  // ── cold clearance / precomm
  coldClearance = (systemId: string) => this.req<ColdClearancePayload>('GET', `/api/com/system/${encodeURIComponent(systemId)}/cold-clearance`);
  precomm = () => this.req<PrecommPayload>('GET', '/api/com/precomm');

  // ── punch
  punch = (params: { contractId?: string } = {}) => {
    const extra = params.contractId ? `&contractId=${encodeURIComponent(params.contractId)}` : '';
    return this.req<PunchPayload>('GET', `/api/com/punch${extra}`);
  };
  createPunch = (body: unknown) => this.req<{ id: string; itemNo: string; category: string }>('POST', '/api/com/punch', body);
  closePunch = (id: string, body: unknown) => this.req<{ id: string; itemNo: string; status: string }>('POST', `/api/com/punch/${encodeURIComponent(id)}/close`, body);

  // ── certificates
  certificates = () => this.req<CertificatePayload>('GET', '/api/com/certificate');
  createCertificate = (body: unknown) => this.req<{ id: string; certificateType: string; certificateNo: string; punch: unknown; warrantyEndDate: string | null }>('POST', '/api/com/certificate', body);

  // ── tags (CSU-2)
  tags = (params: { systemId?: string; tagType?: string; status?: string; q?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.systemId) qs.set('systemId', params.systemId);
    if (params.tagType) qs.set('tagType', params.tagType);
    if (params.status) qs.set('status', params.status);
    if (params.q) qs.set('q', params.q);
    const extra = qs.toString() ? `&${qs.toString()}` : '';
    return this.req<TagPayload>('GET', `/api/com/tag${extra}`);
  };
  createTag = (body: unknown) => this.req<{ id: string; item: TagItem }>('POST', '/api/com/tag', body);
  updateTag = (id: string, body: unknown) => this.req<{ item: TagItem }>('POST', `/api/com/tag/${encodeURIComponent(id)}`, body);
}
