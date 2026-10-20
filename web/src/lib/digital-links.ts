import { apiFetch, apiFetchBlob } from "./api";
import type { DigitalLinkNode, DigitalLinks } from "./audit";
import { getDigitalLinks } from "./audit";

export type TimelineKind = "document" | "bank" | "journal" | "vat";
export type LinkStatus = "linked" | "partial" | "missing";

export interface TimelineNode {
  kind: TimelineKind;
  title: string;
  subtitle: string;
  status: LinkStatus;
  id: string | null;
  href: string;
  openLabel: string;
}

export interface DocumentDetail {
  id: string;
  fileName: string;
  fileType?: string | null;
  type?: string | null;
  uploadedAt?: string | null;
  ocrText?: string | null;
  ocrMerchant?: string | null;
  ocrAmount?: number | null;
  ocrInvoiceNumber?: string | null;
  extracted?: {
    supplier?: string | null;
    total?: number | null;
    vat?: number | null;
    invoiceNumber?: string | null;
  } | null;
}

export interface TransactionDetail {
  id: string;
  date?: string | null;
  amount?: number | null;
  description?: string | null;
  category?: string | null;
  merchantName?: string | null;
  status?: string | null;
}

export interface JournalLineDetail {
  account: string;
  debit: number;
  credit: number;
  description?: string | null;
}

export interface JournalDetail {
  id: string;
  date?: string | null;
  reference?: string | null;
  description?: string | null;
  lines: JournalLineDetail[];
}

export interface VatReturnDetail {
  id: string;
  periodKey?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  status?: string | null;
  hmrcSubmissionId?: string | null;
  boxes: Array<{ id: string; label: string; value: number }>;
}

export const VAT_BOX_LABELS: Record<string, string> = {
  box1: "Box 1 · VAT due on sales",
  box2: "Box 2 · VAT due on acquisitions",
  box3: "Box 3 · Total VAT due",
  box4: "Box 4 · VAT reclaimed",
  box5: "Box 5 · Net VAT due",
  box6: "Box 6 · Sales excluding VAT",
  box7: "Box 7 · Purchases excluding VAT",
  box8: "Box 8 · EU supplies",
  box9: "Box 9 · EU acquisitions",
};

export function fetchDigitalLinks(resourceId: string) {
  return getDigitalLinks(resourceId);
}

export function getDocument(id: string) {
  return apiFetch<Record<string, unknown>>(`/documents/${id}`);
}

export function getBankTransaction(id: string) {
  return apiFetch<Record<string, unknown>>(`/bank-transactions/${id}`);
}

export function getJournalEntry(id: string) {
  return apiFetch<Record<string, unknown>>(`/journal-entries/${id}`);
}

export function getVatReturn(id: string) {
  return apiFetch<Record<string, unknown>>(`/vat/returns/id/${id}`);
}

export function fetchDocumentPreview(id: string) {
  return apiFetchBlob(`/documents/${id}/file`);
}

export function timelineNodes(links: DigitalLinks): TimelineNode[] {
  return [
    {
      kind: "document",
      title: "Document",
      subtitle: links.document.label,
      status: nodeStatus("document", links.document, links.extraction),
      id: links.document.id,
      href: links.document.id ? `/invoices/extraction/${links.document.id}` : "/practice/documents",
      openLabel: "Open Document",
    },
    {
      kind: "bank",
      title: "Bank transaction",
      subtitle: links.bankTransaction.label,
      status: nodeStatus("bank", links.bankTransaction),
      id: links.bankTransaction.id,
      href: "/practice/reconciliation",
      openLabel: "Open Transaction",
    },
    {
      kind: "journal",
      title: "Journal entry",
      subtitle: links.journalEntry.label,
      status: nodeStatus("journal", links.journalEntry),
      id: links.journalEntry.id,
      href: "/practice/reconciliation",
      openLabel: "Open Journal Entry",
    },
    {
      kind: "vat",
      title: "VAT return",
      subtitle: links.vatReturn.label,
      status: nodeStatus("vat", links.vatReturn),
      id: links.vatReturn.id,
      href: "/practice/vat",
      openLabel: "Open VAT Return",
    },
  ];
}

export function nodeStatus(kind: TimelineKind, node?: DigitalLinkNode | null, extraction?: DigitalLinkNode | null): LinkStatus {
  if (!node?.id || !node.linked) {
    return "missing";
  }
  const detail = asRecord(node.detail);
  if (kind === "document") {
    const hasOcr = Boolean(detail.ocrText || detail.ocrMerchant);
    const hasExtraction = Boolean(extraction?.linked || detail.extractedData);
    return hasOcr || hasExtraction ? "linked" : "partial";
  }
  if (kind === "bank") {
    const status = String(detail.status ?? "").toUpperCase();
    return status === "UNMATCHED" || status === "IGNORED" ? "partial" : "linked";
  }
  if (kind === "journal") {
    const lines = Array.isArray(detail.lines) ? detail.lines : [];
    return lines.length ? "linked" : "partial";
  }
  const status = String(detail.status ?? "").toUpperCase();
  return status === "SUBMITTED" || status === "FULFILLED" ? "linked" : "partial";
}

export function statusTone(status: LinkStatus): { dot: string; label: string; text: string } {
  if (status === "linked") {
    return { dot: "bg-success", label: "Linked", text: "text-success" };
  }
  if (status === "partial") {
    return { dot: "bg-warning", label: "Partial link", text: "text-warning" };
  }
  return { dot: "bg-danger", label: "Missing link", text: "text-danger" };
}

export function documentFrom(node?: DigitalLinkNode | null, extra?: Record<string, unknown> | null): DocumentDetail | null {
  const detail = { ...asRecord(node?.detail), ...asRecord(extra) };
  const id = node?.id ?? stringOrNull(detail.id);
  if (!id) {
    return null;
  }
  const extracted = extractionSummary(detail.extractedData ?? asRecord(asRecord(detail.data ?? extra).data));
  return {
    id,
    fileName: stringOrNull(detail.fileName) ?? node?.label ?? "Document",
    fileType: stringOrNull(detail.fileType),
    type: stringOrNull(detail.type),
    uploadedAt: iso(detail.uploadedAt),
    ocrText: stringOrNull(detail.ocrText),
    ocrMerchant: stringOrNull(detail.ocrMerchant),
    ocrAmount: numberOrNull(detail.ocrAmount),
    ocrInvoiceNumber: stringOrNull(detail.ocrInvoiceNumber),
    extracted,
  };
}

export function transactionFrom(node?: DigitalLinkNode | null, extra?: Record<string, unknown> | null): TransactionDetail | null {
  const detail = { ...asRecord(node?.detail), ...asRecord(extra) };
  const id = node?.id ?? stringOrNull(detail.id);
  if (!id) {
    return null;
  }
  return {
    id,
    date: iso(detail.date),
    amount: numberOrNull(detail.amount),
    description: stringOrNull(detail.description) ?? node?.label,
    category: stringOrNull(detail.category) ?? stringOrNull(detail.merchantName),
    merchantName: stringOrNull(detail.merchantName),
    status: stringOrNull(detail.status),
  };
}

export function journalFrom(node?: DigitalLinkNode | null, extra?: Record<string, unknown> | null): JournalDetail | null {
  const detail = { ...asRecord(node?.detail), ...asRecord(extra) };
  const id = node?.id ?? stringOrNull(detail.id);
  if (!id) {
    return null;
  }
  const rawLines = Array.isArray(detail.lines) ? detail.lines : [];
  return {
    id,
    date: iso(detail.date),
    reference: stringOrNull(detail.reference),
    description: stringOrNull(detail.description),
    lines: rawLines.map((line) => {
      const row = asRecord(line);
      const ledger = asRecord(row.ledger);
      return {
        account: stringOrNull(ledger.name) ?? stringOrNull(ledger.code) ?? stringOrNull(row.account) ?? "Ledger",
        debit: numberOrNull(row.debit) ?? 0,
        credit: numberOrNull(row.credit) ?? 0,
        description: stringOrNull(row.description),
      };
    }),
  };
}

export function vatFrom(node?: DigitalLinkNode | null, extra?: Record<string, unknown> | null): VatReturnDetail | null {
  const detail = { ...asRecord(node?.detail), ...asRecord(extra) };
  const id = node?.id ?? stringOrNull(detail.id);
  if (!id) {
    return null;
  }
  return {
    id,
    periodKey: stringOrNull(detail.periodKey) ?? node?.label,
    periodStart: iso(detail.periodStart),
    periodEnd: iso(detail.periodEnd),
    status: stringOrNull(detail.status),
    hmrcSubmissionId: stringOrNull(detail.hmrcSubmissionId) ?? stringOrNull(detail.formBundleNumber) ?? stringOrNull(detail.correlationId),
    boxes: [1, 2, 3, 4, 5, 6, 7, 8, 9].map((box) => ({
      id: `box${box}`,
      label: VAT_BOX_LABELS[`box${box}`],
      value: numberOrNull(detail[`box${box}`]) ?? 0,
    })),
  };
}

function extractionSummary(value: unknown): DocumentDetail["extracted"] {
  const data = asRecord(value);
  if (!Object.keys(data).length) {
    return null;
  }
  return {
    supplier: stringOrNull(data.supplierName) ?? stringOrNull(data.supplier),
    total: numberOrNull(data.grandTotal) ?? numberOrNull(data.total),
    vat: numberOrNull(data.vatTotal) ?? numberOrNull(data.vat),
    invoiceNumber: stringOrNull(data.invoiceNumber),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function iso(value: unknown): string | null {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}
