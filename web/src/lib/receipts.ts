import { apiFetch, apiFetchBlob } from "./api";
import type { BankTransactionRecord } from "./reconciliation";

export const RECEIPT_ACCEPT = ".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf";
export const RECEIPT_MAX_BYTES = 12 * 1024 * 1024;

export type ReceiptAttachmentKind = "bank" | "invoice" | "bill" | "journal" | "unattached";
export type ReceiptFilterAttachment = ReceiptAttachmentKind | "all";

export interface ReceiptRecord {
  id: string;
  clientId: string;
  bankTransactionId?: string | null;
  invoiceId?: string | null;
  billId?: string | null;
  journalEntryId?: string | null;
  fileName: string;
  fileType: string;
  fileSize: number;
  storageUrl: string;
  uploadedByUserId: string;
  uploadedAt: string;
  tags: string[];
  ocrText?: string | null;
  ocrMerchant?: string | null;
  ocrSupplierName?: string | null;
  ocrAmount?: number | null;
  ocrNetAmount?: number | null;
  ocrVatAmount?: number | null;
  ocrVatRate?: number | null;
  ocrInvoiceNumber?: string | null;
  ocrDate?: string | null;
  status: "uploaded" | "processed";
  proofAvailable: boolean;
}

export interface ReceiptOcrResult {
  receiptId: string;
  text: string | null;
  merchantName: string | null;
  supplierName: string | null;
  amount: number | null;
  netAmount: number | null;
  vatAmount: number | null;
  vatRate: number | null;
  date: string | null;
  invoiceNumber: string | null;
  source: string;
  confidence: number;
}

export interface ReceiptEvidence {
  receiptsAttached: number;
  vat: { box4: { items: number; withProof: number; proofAttached: boolean } };
  itsa: { attached: number; allowableExpenses: number; allowableExpensesWithReceipt: number };
}

export interface ReceiptSuggestion {
  bankTransactionId: string;
  description: string;
  merchantName?: string | null;
  amount: number;
  date: string;
  score: number;
  reasons?: string[];
}

export interface ReceiptTag {
  id: string;
  name: string;
  description?: string | null;
}

export interface SalesDocumentRecord {
  id: string;
  date: string;
  dueDate?: string;
  status?: string;
  netTotal: number;
  vatTotal: number;
  grossTotal: number;
  customer?: { name?: string | null } | null;
  supplier?: { name?: string | null } | null;
}

export interface JournalRecord {
  id: string;
  date: string;
  reference?: string | null;
  description: string;
  source?: string;
  lines?: Array<{ debit?: number; credit?: number }>;
}

export interface AttachTarget {
  kind: Exclude<ReceiptAttachmentKind, "unattached">;
  id: string;
  title: string;
  subtitle: string;
  amount?: number | null;
  date?: string | null;
}

export interface ReceiptFilters {
  query: string;
  attachmentType: ReceiptFilterAttachment;
  merchant: string;
  dateFrom: string;
  dateTo: string;
  amountMin: string;
  amountMax: string;
}

export interface ReceiptActivityItem {
  id: string;
  at: string;
  action: string;
  label: string;
  detail?: string;
}

export interface AuditLogRow {
  id: string;
  actionType: string;
  createdAt: string;
  metadata?: { receiptId?: string } & Record<string, unknown>;
}

export const EMPTY_RECEIPT_FILTERS: ReceiptFilters = {
  query: "",
  attachmentType: "all",
  merchant: "",
  dateFrom: "",
  dateTo: "",
  amountMin: "",
  amountMax: "",
};

function asNumber(value: unknown): number {
  return Number(value ?? 0);
}

function asDate(value: unknown): string {
  if (!value) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function asMoneyDocument(row: SalesDocumentRecord): SalesDocumentRecord {
  return {
    ...row,
    netTotal: asNumber(row.netTotal),
    vatTotal: asNumber(row.vatTotal),
    grossTotal: asNumber(row.grossTotal),
    date: asDate(row.date),
    dueDate: row.dueDate ? asDate(row.dueDate) : row.dueDate,
  };
}

export function listReceipts(clientId: string) {
  return apiFetch<{ receipts: ReceiptRecord[]; count: number }>(`/receipts?clientId=${encodeURIComponent(clientId)}`);
}

export function getReceipt(id: string) {
  return apiFetch<ReceiptRecord>(`/receipts/${id}`);
}

export function getReceiptOcr(id: string) {
  return apiFetch<ReceiptOcrResult>(`/receipts/${id}/ocr`);
}

export function reprocessReceiptOcr(id: string) {
  return apiFetch<ReceiptOcrResult>(`/receipts/${id}/ocr/reprocess`, { method: "POST" });
}

export function listBankTransactionReceipts(id: string) {
  return apiFetch<{ receipts: ReceiptRecord[]; count: number }>(`/bank-transactions/${id}/receipts`);
}

export function listInvoiceReceipts(id: string) {
  return apiFetch<{ receipts: ReceiptRecord[]; count: number }>(`/invoices/${id}/receipts`);
}

export function listBillReceipts(id: string) {
  return apiFetch<{ receipts: ReceiptRecord[]; count: number }>(`/bills/${id}/receipts`);
}

export function listJournalReceipts(id: string) {
  return apiFetch<{ receipts: ReceiptRecord[]; count: number }>(`/journals/${id}/receipts`);
}

export function receiptEvidence(clientId: string) {
  return apiFetch<ReceiptEvidence>(`/receipts/evidence?clientId=${encodeURIComponent(clientId)}`);
}

export function listReceiptTags() {
  return apiFetch<{ tags: ReceiptTag[] }>("/receipts/tags");
}

export function receiptSuggestions(id: string) {
  return apiFetch<{ suggestions: ReceiptSuggestion[]; count: number }>(`/receipts/${id}/suggestions`).then((body) => ({
    count: body.count,
    suggestions: (body.suggestions ?? []).map((row) => ({
      ...row,
      amount: asNumber(row.amount),
      date: asDate(row.date),
      score: asNumber(row.score),
    })),
  }));
}

export function fetchReceiptFile(id: string) {
  return apiFetchBlob(`/receipts/${id}/file`);
}

export function uploadReceipt(input: {
  clientId: string;
  fileName: string;
  content: string;
  mimeType?: string;
  bankTransactionId?: string;
  invoiceId?: string;
  billId?: string;
  journalEntryId?: string;
  tags?: string[];
}) {
  return apiFetch<ReceiptRecord>("/receipts/upload", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function attachReceiptToBankTransaction(receiptId: string, transactionId: string) {
  return apiFetch<ReceiptRecord>(`/receipts/${receiptId}/attach/bank-transaction/${transactionId}`, { method: "POST" });
}

export function attachReceiptToInvoice(receiptId: string, invoiceId: string) {
  return apiFetch<ReceiptRecord>(`/receipts/${receiptId}/attach/invoice/${invoiceId}`, { method: "POST" });
}

export function attachReceiptToBill(receiptId: string, billId: string) {
  return apiFetch<ReceiptRecord>(`/receipts/${receiptId}/attach/bill/${billId}`, { method: "POST" });
}

export function attachReceiptToJournal(receiptId: string, journalEntryId: string) {
  return apiFetch<ReceiptRecord>(`/receipts/${receiptId}/attach/journal/${journalEntryId}`, { method: "POST" });
}

export function attachReceipt(receiptId: string, target: AttachTarget) {
  if (target.kind === "invoice") {
    return attachReceiptToInvoice(receiptId, target.id);
  }
  if (target.kind === "bill") {
    return attachReceiptToBill(receiptId, target.id);
  }
  if (target.kind === "journal") {
    return attachReceiptToJournal(receiptId, target.id);
  }
  return attachReceiptToBankTransaction(receiptId, target.id);
}

export function detachReceipt(id: string) {
  return apiFetch<ReceiptRecord>(`/receipts/${id}/detach`, { method: "POST" });
}

export function updateReceiptTags(id: string, tags: string[]) {
  return apiFetch<ReceiptRecord>(`/receipts/${id}/tags`, {
    method: "PATCH",
    body: JSON.stringify({ tags }),
  });
}

export function listSalesInvoices(clientId: string) {
  return apiFetch<SalesDocumentRecord[]>(`/bookkeeping/invoices?clientId=${encodeURIComponent(clientId)}`).then((rows) =>
    (rows ?? []).map(asMoneyDocument),
  );
}

export function listPurchaseBills(clientId: string) {
  return apiFetch<SalesDocumentRecord[]>(`/bookkeeping/bills?clientId=${encodeURIComponent(clientId)}`).then((rows) =>
    (rows ?? []).map(asMoneyDocument),
  );
}

export function listJournalEntries(clientId: string) {
  return apiFetch<JournalRecord[]>(`/bookkeeping/journals?clientId=${encodeURIComponent(clientId)}`).then((rows) =>
    (rows ?? []).map((row) => ({
      ...row,
      date: asDate(row.date),
      lines: (row.lines ?? []).map((line) => ({ debit: asNumber(line.debit), credit: asNumber(line.credit) })),
    })),
  );
}

export function listReceiptAudit(clientId: string) {
  return apiFetch<AuditLogRow[]>(`/audit/logs?clientId=${encodeURIComponent(clientId)}`);
}

export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result ?? "");
      resolve(value.includes(",") ? value.slice(value.indexOf(",") + 1) : value);
    };
    reader.onerror = () => reject(new Error("Unable to read receipt file"));
    reader.readAsDataURL(file);
  });
}

export function receiptKindLabel(fileType: string): string {
  return fileType === "pdf" ? "PDF" : fileType.toUpperCase();
}

export function isAcceptedReceiptFile(file: Pick<File, "name" | "type">): boolean {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return (
    type === "image/jpeg" ||
    type === "image/jpg" ||
    type === "image/png" ||
    type === "application/pdf" ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".png") ||
    name.endsWith(".pdf")
  );
}

export function receiptFileError(file: Pick<File, "name" | "type" | "size">): string | null {
  if (!isAcceptedReceiptFile(file)) {
    return "Only JPG, PNG, and PDF receipts are supported";
  }
  if (file.size > RECEIPT_MAX_BYTES) {
    return "Receipt must be 12MB or smaller";
  }
  return null;
}

export function formatFileSize(bytes?: number | null): string {
  const value = Number(bytes ?? 0);
  if (!value) {
    return "—";
  }
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function receiptAttachmentKind(receipt: Pick<ReceiptRecord, "bankTransactionId" | "invoiceId" | "billId" | "journalEntryId">): ReceiptAttachmentKind {
  if (receipt.bankTransactionId) {
    return "bank";
  }
  if (receipt.invoiceId) {
    return "invoice";
  }
  if (receipt.billId) {
    return "bill";
  }
  if (receipt.journalEntryId) {
    return "journal";
  }
  return "unattached";
}

export function receiptAttachmentLabel(kind: ReceiptAttachmentKind | ReceiptFilterAttachment): string {
  switch (kind) {
    case "bank":
      return "Bank transaction";
    case "invoice":
      return "Invoice";
    case "bill":
      return "Bill";
    case "journal":
      return "Journal entry";
    case "unattached":
      return "Unattached";
    default:
      return "All attachments";
  }
}

export function receiptDateValue(receipt: Pick<ReceiptRecord, "ocrDate" | "uploadedAt">): string {
  return String(receipt.ocrDate || receipt.uploadedAt || "").slice(0, 10);
}

export function filterReceipts(receipts: ReceiptRecord[], filters: ReceiptFilters): ReceiptRecord[] {
  const query = filters.query.trim().toLowerCase();
  const merchant = filters.merchant.trim().toLowerCase();
  const min = filters.amountMin === "" ? null : Number(filters.amountMin);
  const max = filters.amountMax === "" ? null : Number(filters.amountMax);
  return receipts.filter((receipt) => {
    if (filters.attachmentType !== "all" && receiptAttachmentKind(receipt) !== filters.attachmentType) {
      return false;
    }
    if (merchant && !(receipt.ocrMerchant ?? "").toLowerCase().includes(merchant)) {
      return false;
    }
    const date = receiptDateValue(receipt);
    if (filters.dateFrom && date && date < filters.dateFrom) {
      return false;
    }
    if (filters.dateTo && date && date > filters.dateTo) {
      return false;
    }
    if (min != null && !Number.isNaN(min) && (receipt.ocrAmount == null || receipt.ocrAmount < min)) {
      return false;
    }
    if (max != null && !Number.isNaN(max) && (receipt.ocrAmount == null || receipt.ocrAmount > max)) {
      return false;
    }
    if (query) {
      const haystack = [receipt.fileName, receipt.ocrText, receipt.ocrMerchant, ...(receipt.tags ?? [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) {
        return false;
      }
    }
    return true;
  });
}

export function bankLineToTarget(row: BankTransactionRecord & { accountName?: string }): AttachTarget {
  return {
    kind: "bank",
    id: row.id,
    title: row.merchantName || row.description || "Bank transaction",
    subtitle: [row.accountName, row.description].filter(Boolean).join(" · "),
    amount: row.amount,
    date: row.date,
  };
}

export function invoiceToTarget(row: SalesDocumentRecord): AttachTarget {
  return {
    kind: "invoice",
    id: row.id,
    title: row.customer?.name || "Sales invoice",
    subtitle: row.status ? `Invoice · ${row.status}` : "Sales invoice",
    amount: row.grossTotal,
    date: row.date,
  };
}

export function billToTarget(row: SalesDocumentRecord): AttachTarget {
  return {
    kind: "bill",
    id: row.id,
    title: row.supplier?.name || "Purchase bill",
    subtitle: row.status ? `Bill · ${row.status}` : "Purchase bill",
    amount: row.grossTotal,
    date: row.date,
  };
}

export function journalToTarget(row: JournalRecord): AttachTarget {
  const total = (row.lines ?? []).reduce((sum, line) => sum + Math.max(asNumber(line.debit), asNumber(line.credit)), 0);
  return {
    kind: "journal",
    id: row.id,
    title: row.description || row.reference || "Journal entry",
    subtitle: [row.reference, row.source].filter(Boolean).join(" · ") || "Journal entry",
    amount: total || null,
    date: row.date,
  };
}

export function suggestionToTarget(row: ReceiptSuggestion): AttachTarget {
  return {
    kind: "bank",
    id: row.bankTransactionId,
    title: row.merchantName || row.description || "Suggested bank line",
    subtitle: row.description,
    amount: row.amount,
    date: row.date,
  };
}

export function dedupeAttachTargets(targets: AttachTarget[]): AttachTarget[] {
  const seen = new Set<string>();
  return targets.filter((target) => {
    const key = `${target.kind}:${target.id}`;
    const fuzzy = `${target.kind}:${target.title}:${target.amount ?? ""}:${String(target.date ?? "").slice(0, 10)}`;
    if (seen.has(key) || seen.has(fuzzy)) {
      return false;
    }
    seen.add(key);
    seen.add(fuzzy);
    return true;
  });
}

export function searchAttachTargets(targets: AttachTarget[], query: string): AttachTarget[] {
  const unique = dedupeAttachTargets(targets);
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return unique;
  }
  return unique.filter((target) =>
    [target.title, target.subtitle, target.kind, target.amount != null ? String(target.amount) : ""]
      .join(" ")
      .toLowerCase()
      .includes(needle),
  );
}

export function scoreAttachTarget(receipt: Pick<ReceiptRecord, "ocrMerchant" | "ocrAmount" | "ocrDate">, target: AttachTarget): number {
  let score = 0;
  const merchant = (receipt.ocrMerchant ?? "").toLowerCase();
  const haystack = `${target.title} ${target.subtitle}`.toLowerCase();
  if (merchant && haystack.includes(merchant)) {
    score += 0.4;
  }
  if (receipt.ocrAmount != null && target.amount != null) {
    const gap = Math.abs(Math.abs(receipt.ocrAmount) - Math.abs(target.amount));
    if (gap < 0.01) {
      score += 0.5;
    } else if (gap <= 1) {
      score += 0.3;
    } else if (gap <= 5) {
      score += 0.1;
    }
  }
  if (receipt.ocrDate && target.date) {
    const days = Math.abs((new Date(receipt.ocrDate).getTime() - new Date(target.date).getTime()) / 86_400_000);
    if (days <= 3) {
      score += 0.3;
    } else if (days <= 7) {
      score += 0.15;
    }
  }
  return score;
}

export function suggestAttachTargets(
  receipt: Pick<ReceiptRecord, "ocrMerchant" | "ocrAmount" | "ocrDate">,
  targets: AttachTarget[],
): AttachTarget[] {
  return targets
    .map((target) => ({ target, score: scoreAttachTarget(receipt, target) }))
    .filter((row) => row.score >= 0.3)
    .sort((left, right) => right.score - left.score)
    .slice(0, 6)
    .map((row) => row.target);
}

export function activityLabel(actionType: string): string {
  switch (actionType) {
    case "receipt.uploaded":
      return "Uploaded";
    case "receipt.processed":
      return "OCR processed";
    case "receipt.attached":
      return "Attached";
    case "receipt.detached":
      return "Detached";
    case "receipt.tagged":
      return "Tags updated";
    default:
      return actionType.replace(/^receipt\./, "").replace(/[_-]+/g, " ");
  }
}

export function deriveReceiptActivity(receipt: ReceiptRecord, auditLogs: AuditLogRow[] = []): ReceiptActivityItem[] {
  const fromAudit = auditLogs
    .filter((log) => {
      const receiptId = log.metadata?.receiptId;
      return receiptId === receipt.id || (!receiptId && String(log.actionType).startsWith("receipt."));
    })
    .map((log) => ({
      id: log.id,
      at: log.createdAt,
      action: log.actionType,
      label: activityLabel(log.actionType),
      detail: log.metadata?.tags ? (log.metadata.tags as string[]).join(", ") : undefined,
    }));
  if (fromAudit.length) {
    return fromAudit.sort((left, right) => right.at.localeCompare(left.at));
  }
  const items: ReceiptActivityItem[] = [
    {
      id: `upload-${receipt.id}`,
      at: receipt.uploadedAt,
      action: "receipt.uploaded",
      label: "Uploaded",
      detail: receipt.fileName,
    },
  ];
  if (receipt.status === "processed") {
    items.push({
      id: `ocr-${receipt.id}`,
      at: receipt.uploadedAt,
      action: "receipt.processed",
      label: "OCR processed",
      detail: receipt.ocrMerchant ?? undefined,
    });
  }
  if (receipt.proofAvailable) {
    items.push({
      id: `attach-${receipt.id}`,
      at: receipt.uploadedAt,
      action: "receipt.attached",
      label: `Attached to ${receiptAttachmentLabel(receiptAttachmentKind(receipt)).toLowerCase()}`,
    });
  }
  if (receipt.tags.length) {
    items.push({
      id: `tags-${receipt.id}`,
      at: receipt.uploadedAt,
      action: "receipt.tagged",
      label: "Tagged",
      detail: receipt.tags.join(", "),
    });
  }
  return items;
}
