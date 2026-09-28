/**
 * کلاینت REST میز کار خرید و تدارکات — SCM (P5)
 * مسیر نسبی /api/scm/... از پراکسی Vite
 */
import { jsonRequest, type ApiResult } from "./apiClient";

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
