import { jsonRequest } from './apiClient';
import type { BoqItem } from './contracts';
export type VariationKind = 'quantity' | 'extra';
export type VariationRow = {
  Id: string; RowVersion: number; Status: string; CreatedBy?: string; SubmittedBy?: string;
  ReasonFa: string; DocumentRef: string; LinkedCrCode?: string | null; DecisionNote?: string | null; DecidedBy?: string | null;
  BoqItemId?: string | null; ChangeNo?: number; PreviousQty?: number; NewQty?: number; DeltaAmount?: number;
  Code?: string; TitleFa?: string; Unit?: string; Quantity?: number; ProposedRate?: number; AgreedRate?: number; AnalysisMethod?: string;
};
export type VariationWorkspace = { quantities: VariationRow[]; extras: VariationRow[]; boq: (BoqItem & { RowVersion: number })[] };
export class ContractVariationClient {
  private readonly base: string;
  constructor(projectId: string, contractId: string, private readonly userId: string | null) {
    this.base = `/api/cnt-variations/${encodeURIComponent(projectId)}/contracts/${encodeURIComponent(contractId)}`;
  }
  list = () => jsonRequest<VariationWorkspace>(this.base, this.userId, 'GET');
  save = (kind: VariationKind, fields: object, row?: VariationRow) => jsonRequest<{ item: VariationRow }>(`${this.base}/${kind}${row ? `/${encodeURIComponent(row.Id)}` : ''}`, this.userId, row ? 'PATCH' : 'POST', row ? { ...fields, RowVersion: row.RowVersion } : fields);
  transition = (kind: VariationKind, row: VariationRow, action: string, note: string, rate?: string) => jsonRequest<{ item: VariationRow }>(`${this.base}/${kind}/${encodeURIComponent(row.Id)}/transitions`, this.userId, 'POST', { action, note, RowVersion: row.RowVersion, ...(kind === 'extra' && action === 'approve' ? { AgreedRate: rate } : {}) });
}
