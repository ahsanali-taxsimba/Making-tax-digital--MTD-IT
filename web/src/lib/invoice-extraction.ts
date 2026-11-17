import { apiFetch, apiFetchBlob } from "./api";
import { readFileAsBase64 } from "./receipts";

export type InvoiceDirection = "sales" | "purchase";
export type ReviewStatus = "not_started" | "in_progress" | "completed" | "failed" | "rejected" | "approved";
export type ConfidenceTone = "high" | "medium" | "low";
export type FieldState = "ok" | "low" | "missing";

export interface ExtractedLineItem {
  id?: string;
  description: string;
  quantity: number | null;
  unitPrice: number | null;
  net: number | null;
  vat: number | null;
  vatRate: number | null;
  gross: number | null;
  confidence: number;
}

export interface FieldConfidence {
  supplierName: number;
  supplierAddress: number;
  invoiceNumber: number;
  invoiceDate: number;
  dueDate: number;
  lineItems: number;
  subtotal: number;
  vatTotal: number;
  grandTotal: number;
}

export interface ExtractedInvoice {
  supplierName: string | null;
  supplierAddress: string | null;
  supplierId: string | null;
  customerName: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  currency: string;
  lineItems: ExtractedLineItem[];
  subtotal: number | null;
  vatTotal: number | null;
  grandTotal: number | null;
  direction: InvoiceDirection;
  vatBoxes: string[];
  itsaCategory: string | null;
  itsaBucket: string | null;
  issues: string[];
  fieldConfidence: FieldConfidence;
  confidence: number;
  source: "ocr" | "hint";
}

export interface ExtractionAuditEntry {
  id: string;
  action: string;
  userName: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface InvoiceExtractionRecord {
  documentId: string;
  clientId: string;
  fileName: string;
  fileType: string;
  previewUrl: string;
  invoiceId?: string | null;
  billId?: string | null;
  status: string;
  reviewStatus: ReviewStatus;
  confidence: number;
  extracted: ExtractedInvoice;
  audit: ExtractionAuditEntry[];
}

export interface ExtractionQueueItem {
  documentId: string;
  clientId: string;
  fileName: string;
  fileType: string;
  previewUrl: string;
  type?: string;
  invoiceNumber?: string | null;
  supplierName?: string | null;
  status: string;
  reviewStatus: ReviewStatus;
  confidence: number;
  invoiceId?: string | null;
  billId?: string | null;
  uploadedAt: string;
}

export interface ExtractionForm {
  supplierName: string;
  supplierAddress: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  direction: InvoiceDirection;
  lineItems: ExtractedLineItem[];
}

export interface BookkeepingInvoice {
  kind: InvoiceDirection;
  id: string;
  clientId: string;
  partyName: string;
  partyId: string | null;
  invoiceNumber: string | null;
  date: string;
  dueDate: string;
  status: string;
  netTotal: number;
  vatTotal: number;
  grossTotal: number;
  journalId: string | null;
  lines: Array<{ id: string; description: string; net: number; vat: number; gross: number }>;
  journal?: unknown;
  documents?: LibraryDocument[];
  receipts?: LibraryDocument[];
  readyToPost: boolean;
}

export interface JournalPreview {
  kind: InvoiceDirection;
  partyName: string;
  invoiceNumber: string | null;
  netTotal: number;
  vatTotal: number;
  grossTotal: number;
  lines: Array<{ accountCode: number | null; accountName: string; debit: number; credit: number; description: string }>;
}

export interface LibraryDocument {
  id: string;
  clientId: string;
  type: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  previewUrl?: string;
  uploadedAt: string;
  invoiceId?: string | null;
  billId?: string | null;
  tags?: string[];
}

export const EMPTY_FIELD_CONFIDENCE: FieldConfidence = {
  supplierName: 0,
  supplierAddress: 0,
  invoiceNumber: 0,
  invoiceDate: 0,
  dueDate: 0,
  lineItems: 0,
  subtotal: 0,
  vatTotal: 0,
  grandTotal: 0,
};

export function emptyLine(): ExtractedLineItem {
  return {
    id: `line-${Math.random().toString(36).slice(2, 8)}`,
    description: "",
    quantity: 1,
    unitPrice: 0,
    net: 0,
    vat: 0,
    vatRate: 20,
    gross: 0,
    confidence: 1,
  };
}

export function formFromExtracted(extracted?: ExtractedInvoice | null): ExtractionForm {
  return {
    supplierName: extracted?.supplierName ?? "",
    supplierAddress: extracted?.supplierAddress ?? "",
    invoiceNumber: extracted?.invoiceNumber ?? "",
    invoiceDate: extracted?.invoiceDate ?? "",
    dueDate: extracted?.dueDate ?? "",
    direction: extracted?.direction ?? "purchase",
    lineItems: (extracted?.lineItems?.length ? extracted.lineItems : [emptyLine()]).map((line, index) => ({
      ...emptyLine(),
      ...line,
      id: line.id ?? `line-${index}`,
      net: line.net ?? 0,
      vat: line.vat ?? 0,
      gross: line.gross ?? Number(line.net ?? 0) + Number(line.vat ?? 0),
    })),
  };
}

export function calcLineGross(line: Pick<ExtractedLineItem, "net" | "vat" | "gross">): number {
  if (line.gross != null && Number.isFinite(line.gross)) {
    return roundMoney(line.gross);
  }
  return roundMoney(Number(line.net ?? 0) + Number(line.vat ?? 0));
}

export function calcTotals(lines: ExtractedLineItem[]): { subtotal: number; vatTotal: number; grandTotal: number } {
  const subtotal = roundMoney(lines.reduce((sum, line) => sum + Number(line.net ?? 0), 0));
  const vatTotal = roundMoney(lines.reduce((sum, line) => sum + Number(line.vat ?? 0), 0));
  return { subtotal, vatTotal, grandTotal: roundMoney(subtotal + vatTotal) };
}

export function applyLineNet(line: ExtractedLineItem, net: number): ExtractedLineItem {
  const vatRate = line.vatRate ?? 20;
  const vat = roundMoney(net * (vatRate / 100));
  return { ...line, net: roundMoney(net), vat, gross: roundMoney(net + vat) };
}

export function confidenceTone(value?: number | null): ConfidenceTone {
  const score = Number(value ?? 0);
  if (score >= 0.85) {
    return "high";
  }
  if (score >= 0.6) {
    return "medium";
  }
  return "low";
}

export function fieldState(value: string | number | null | undefined, confidence?: number | null): FieldState {
  if (value == null || value === "") {
    return "missing";
  }
  return confidenceTone(confidence) === "low" ? "low" : "ok";
}

export function fieldHighlightClass(state: FieldState): string {
  if (state === "missing") {
    return "border-danger bg-danger-soft/40";
  }
  if (state === "low") {
    return "border-warning bg-warning-soft";
  }
  return "border-line bg-white";
}

export function extractionDiffers(extracted: ExtractedInvoice | null | undefined, form: ExtractionForm): boolean {
  if (!extracted) {
    return false;
  }
  if ((extracted.supplierName ?? "") !== form.supplierName) {
    return true;
  }
  if ((extracted.invoiceNumber ?? "") !== form.invoiceNumber) {
    return true;
  }
  if ((extracted.invoiceDate ?? "") !== form.invoiceDate) {
    return true;
  }
  if ((extracted.dueDate ?? "") !== form.dueDate) {
    return true;
  }
  if ((extracted.direction ?? "purchase") !== form.direction) {
    return true;
  }
  const original = extracted.lineItems ?? [];
  if (original.length !== form.lineItems.length) {
    return true;
  }
  return form.lineItems.some((line, index) => {
    const prior = original[index];
    return (
      (prior?.description ?? "") !== line.description ||
      Number(prior?.net ?? 0) !== Number(line.net ?? 0) ||
      Number(prior?.vat ?? 0) !== Number(line.vat ?? 0)
    );
  });
}

export function validateExtractionForm(form: ExtractionForm): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.supplierName.trim()) {
    errors.supplierName = "Supplier name is required";
  }
  if (!form.invoiceDate.trim()) {
    errors.invoiceDate = "Invoice date is required";
  }
  if (!form.lineItems.length || form.lineItems.every((line) => !line.description && !line.net)) {
    errors.lineItems = "Add at least one line item";
  }
  const totals = calcTotals(form.lineItems);
  if (totals.grandTotal <= 0) {
    errors.totals = "Total must be greater than zero";
  }
  return errors;
}

export function confirmPayload(form: ExtractionForm) {
  return {
    direction: form.direction,
    supplierName: form.supplierName || undefined,
    invoiceNumber: form.invoiceNumber || undefined,
    invoiceDate: form.invoiceDate || undefined,
    dueDate: form.dueDate || undefined,
    lines: form.lineItems.map((line) => ({
      description: line.description || "Extracted line",
      quantity: line.quantity ?? 1,
      net: Number(line.net ?? 0),
      vat: Number(line.vat ?? 0),
    })),
  };
}

export function reviewStatusLabel(status?: string | null): string {
  switch (status) {
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "completed":
      return "Ready for review";
    case "in_progress":
      return "Extracting";
    case "failed":
      return "Failed";
    case "not_started":
      return "Not started";
    default:
      return status ? status.replace(/[_-]+/g, " ") : "Unknown";
  }
}

export function auditActionLabel(action?: string | null): string {
  const value = String(action ?? "").replace(/^invoice\.extraction\./, "").replace(/^bookkeeping\./, "").replace(/[._]/g, " ");
  if (!value) {
    return "Activity";
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function listExtractions(clientId: string) {
  return apiFetch<{ clientId: string; count: number; documents: ExtractionQueueItem[] }>(
    `/invoices/extractions?clientId=${encodeURIComponent(clientId)}`,
  );
}

export function getInvoiceExtraction(documentId: string) {
  return apiFetch<InvoiceExtractionRecord>(`/invoices/extraction/${documentId}`);
}

export function extractFromDocument(documentId: string, direction?: InvoiceDirection) {
  const query = direction ? `?direction=${direction}` : "";
  return apiFetch<InvoiceExtractionRecord>(`/invoices/extract-from-document/${documentId}${query}`, { method: "POST" });
}

export function confirmExtraction(documentId: string, form: ExtractionForm) {
  return apiFetch<{ status: string; direction: InvoiceDirection; invoice?: { id: string } | null; bill?: { id: string } | null }>(
    `/invoices/extraction/${documentId}/confirm`,
    { method: "POST", body: JSON.stringify(confirmPayload(form)) },
  );
}

export function saveExtractionDraft(documentId: string, form: ExtractionForm) {
  return apiFetch<InvoiceExtractionRecord>(`/invoices/extraction/${documentId}/save-draft`, {
    method: "POST",
    body: JSON.stringify(confirmPayload(form)),
  });
}

export function rejectExtraction(documentId: string, reason?: string) {
  return apiFetch<InvoiceExtractionRecord>(`/invoices/extraction/${documentId}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function reprocessExtraction(documentId: string, direction?: InvoiceDirection) {
  const query = direction ? `?direction=${direction}` : "";
  return apiFetch<InvoiceExtractionRecord>(`/invoices/extraction/${documentId}/reprocess${query}`, { method: "POST" });
}

export function listExtractionAudit(documentId: string) {
  return apiFetch<ExtractionAuditEntry[]>(`/invoices/extraction/${documentId}/audit`);
}

export function fetchDocumentFile(documentId: string) {
  return apiFetchBlob(`/documents/${documentId}/file`);
}

export function listLibraryDocuments(query: { clientId?: string; invoiceId?: string; billId?: string; tag?: string }) {
  const params = new URLSearchParams();
  if (query.clientId) {
    params.set("clientId", query.clientId);
  }
  if (query.invoiceId) {
    params.set("invoiceId", query.invoiceId);
  }
  if (query.billId) {
    params.set("billId", query.billId);
  }
  if (query.tag) {
    params.set("tag", query.tag);
  }
  return apiFetch<{ documents: LibraryDocument[]; count: number }>(`/documents?${params.toString()}`);
}

export async function uploadSupportingDocument(input: {
  clientId: string;
  file: File;
  type?: string;
  tags?: string[];
  invoiceId?: string;
  billId?: string;
}) {
  return apiFetch<LibraryDocument>("/documents/upload", {
    method: "POST",
    body: JSON.stringify({
      clientId: input.clientId,
      fileName: input.file.name,
      content: await readFileAsBase64(input.file),
      mimeType: input.file.type,
      type: input.type,
      tags: input.tags,
      invoiceId: input.invoiceId,
      billId: input.billId,
    }),
  });
}

export function detachLibraryDocument(id: string) {
  return apiFetch<LibraryDocument>(`/documents/${id}/detach`, {
    method: "POST",
    body: JSON.stringify({ target: "all" }),
  });
}

export function getBookkeepingInvoice(id: string, kind: InvoiceDirection = "sales") {
  const path = kind === "purchase" ? `/bookkeeping/bills/${id}` : `/bookkeeping/invoices/${id}`;
  return apiFetch<BookkeepingInvoice>(path);
}

export function postBookkeepingInvoice(id: string, kind: InvoiceDirection = "sales") {
  const path = kind === "purchase" ? `/bookkeeping/bills/${id}/post` : `/bookkeeping/invoices/${id}/post`;
  return apiFetch<BookkeepingInvoice>(path, { method: "POST" });
}

export function getJournalPreview(id: string, kind: InvoiceDirection = "sales") {
  const path = kind === "purchase" ? `/bookkeeping/bills/${id}/journal-preview` : `/bookkeeping/invoices/${id}/journal-preview`;
  return apiFetch<JournalPreview>(path);
}

export function listInvoiceAudit(id: string, kind: InvoiceDirection, clientId: string) {
  const key = kind === "purchase" ? "billId" : "invoiceId";
  return apiFetch<Array<{ id: string; actionType: string; createdAt: string; actor?: { name?: string | null } | null; metadata?: Record<string, unknown> }>>(
    `/audit/logs?clientId=${encodeURIComponent(clientId)}&${key}=${encodeURIComponent(id)}`,
  ).then((rows) =>
    (rows ?? []).map((row) => ({
      id: row.id,
      action: row.actionType,
      userName: row.actor?.name || "System",
      createdAt: row.createdAt,
      metadata: row.metadata ?? {},
    })),
  );
}

function roundMoney(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}
