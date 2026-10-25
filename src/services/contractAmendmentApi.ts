import { jsonRequest } from './apiClient';
import type { AmendmentFields, AmendmentRecord } from './contractAmendments';
export type AmendmentRow = AmendmentFields & AmendmentRecord & {
  Id: string; RowVersion: number; DecidedBy?: string | null; DecidedAt?: string | null; DecisionNote?: string | null;
};
export type AmendmentWorkspace = { items: AmendmentRow[]; currentAmount: number; currentDurationDays: number };
export class ContractAmendmentClient {
  private readonly base: string;
  constructor(projectId: string, contractId: string, private readonly userId: string | null) {
    this.base = `/api/cnt-amendments/${encodeURIComponent(projectId)}/contracts/${encodeURIComponent(contractId)}`;
  }
  list = () => jsonRequest<AmendmentWorkspace>(this.base, this.userId, 'GET');
  save = (fields: AmendmentFields, row?: AmendmentRow) => jsonRequest<{ item: AmendmentRow }>(
    `${this.base}${row ? `/${encodeURIComponent(row.Id)}` : ''}`, this.userId, row ? 'PATCH' : 'POST',
    row ? { ...fields, RowVersion: row.RowVersion } : fields);
  transition = (row: AmendmentRow, action: string, note: string) => jsonRequest<{ item: AmendmentRow }>(
    `${this.base}/${encodeURIComponent(row.Id)}/transitions`, this.userId, 'POST', { RowVersion: row.RowVersion, action, note });
}
