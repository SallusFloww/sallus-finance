import {
  Receivable,
  ReceivableStatus,
  GlossType,
  AppealStatus,
  ReceivableHistoryEntry,
} from "@/types";

export interface ReceivablesFilters {
  startDate?: Date;
  endDate?: Date;
  unit?: string;
  status?: ReceivableStatus;
  source?: string;
  search?: string;
  competencia?: string;
  appealStatus?: AppealStatus;
}

// Database row type
export interface DBReceivable {
  id: string;
  company_id: string;
  billing_date: string;
  competencia: string | null;
  unit: string;
  source: string;
  description: string;
  billed_amount: number;
  received_amount: number;
  glossed_amount: number;
  status: string;
  gloss_type: string | null;
  gloss_reason: string | null;
  appeal_status: string | null;
  appeal_amount: number | null;
  appeal_start_date: string | null;
  appeal_resolved_date: string | null;
  appeal_recovered_amount: number | null;
  appeal_transaction_id: string | null;
  expected_receipt_days: number | null;
  actual_receipt_date: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
  linked_transaction_id: string | null;
  idempotency_key?: string | null;
  history: ReceivableHistoryEntry[];
  edit_logs: Array<{
    field: string;
    previousValue: string;
    newValue: string;
    editedAt: string;
    editedBy: string;
  }>;
}

// Convert from DB to domain
export function toReceivable(db: DBReceivable): Receivable {
  return {
    id: db.id,
    billingDate: db.billing_date,
    competencia: db.competencia || undefined,
    unit: db.unit,
    source: db.source,
    description: db.description,
    billedAmount: Number(db.billed_amount),
    receivedAmount: Number(db.received_amount),
    glossedAmount: Number(db.glossed_amount),
    status: db.status as ReceivableStatus,
    glossType: db.gloss_type as GlossType | undefined,
    glossReason: db.gloss_reason || undefined,
    appealStatus: (db.appeal_status || "NAO_INICIADO") as AppealStatus,
    appealAmount: db.appeal_amount ? Number(db.appeal_amount) : undefined,
    appealStartDate: db.appeal_start_date || undefined,
    appealResolvedDate: db.appeal_resolved_date || undefined,
    appealRecoveredAmount: db.appeal_recovered_amount ? Number(db.appeal_recovered_amount) : undefined,
    appealTransactionId: db.appeal_transaction_id || undefined,
    expectedReceiptDays: db.expected_receipt_days || undefined,
    actualReceiptDate: db.actual_receipt_date || undefined,
    notes: db.notes || undefined,
    createdBy: db.created_by || "system",
    createdAt: db.created_at,
    updatedAt: db.updated_at,
    linkedTransactionId: db.linked_transaction_id || undefined,
    history: db.history || [],
    editLogs: db.edit_logs || [],
  };
}

// Create history entry helper
export function createHistoryEntry(
  action: ReceivableHistoryEntry["action"],
  description: string,
  userName: string,
  amount?: number,
  linkedTransactionId?: string,
): ReceivableHistoryEntry {
  return {
    id: crypto.randomUUID(),
    action,
    description,
    timestamp: new Date().toISOString(),
    userName,
    amount,
    linkedTransactionId,
  };
}
