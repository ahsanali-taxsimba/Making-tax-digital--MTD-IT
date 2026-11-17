import { apiFetch } from "./api";
import type { DigitalLinkNode, DigitalLinks, LinkedEntity } from "./audit";
import { getDigitalLinks } from "./audit";
import {
  documentFrom,
  journalFrom,
  nodeStatus as vatNodeStatus,
  statusTone,
  transactionFrom,
  type DocumentDetail,
  type JournalDetail,
  type LinkStatus,
  type TransactionDetail,
} from "./digital-links";

export type ItsaTimelineKind = "document" | "bank" | "journal" | "quarterly" | "eops" | "final";

export interface ItsaTimelineNode {
  kind: ItsaTimelineKind;
  title: string;
  subtitle: string;
  status: LinkStatus;
  id: string | null;
  href: string;
  openLabel: string;
}

export interface CategoryAmount {
  id: string;
  label: string;
  value: number;
}

export interface QuarterlyDetail {
  id: string;
  taxYear?: string | null;
  periodId?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  status?: string | null;
  hmrcSubmissionId?: string | null;
  incomes: CategoryAmount[];
  expenses: CategoryAmount[];
  adjustments: CategoryAmount[];
  rawPayload: Record<string, unknown> | null;
}

export interface EopsDetail {
  id: string;
  taxYear?: string | null;
  typeOfBusiness?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  finalised?: boolean;
  status?: string | null;
  hmrcSubmissionId?: string | null;
  adjustments: CategoryAmount[];
  summary: Record<string, unknown>;
  rawPayload: Record<string, unknown> | null;
}

export interface FinalDeclarationDetail {
  id: string;
  taxYear?: string | null;
  calculationId?: string | null;
  finalised?: boolean;
  status?: string | null;
  hmrcSubmissionId?: string | null;
  calculation: Record<string, unknown>;
  rawPayload: Record<string, unknown> | null;
}

export function fetchDigitalLinksItsa(resourceId: string) {
  return getDigitalLinks(resourceId, "itsa_submission");
}

export function getQuarterlyUpdate(id: string) {
  return apiFetch<Record<string, unknown>>(`/itsa/updates/id/${id}`);
}

export function getEops(id: string) {
  return apiFetch<Record<string, unknown>>(`/itsa/eops/id/${id}`);
}

export function getFinalDeclaration(id: string) {
  return apiFetch<Record<string, unknown>>(`/itsa/final-declaration/id/${id}`);
}

export function itsaTimelineNodes(links: DigitalLinks): ItsaTimelineNode[] {
  return [
    {
      kind: "document",
      title: "Document",
      subtitle: links.document.label,
      status: vatNodeStatus("document", links.document, links.extraction),
      id: links.document.id,
      href: links.document.id ? `/practice/digital-links/itsa/${links.document.id}` : "/practice/documents",
      openLabel: "Open Document",
    },
    {
      kind: "bank",
      title: "Bank transaction",
      subtitle: links.bankTransaction.label,
      status: vatNodeStatus("bank", links.bankTransaction),
      id: links.bankTransaction.id,
      href: "/practice/reconciliation",
      openLabel: "Open Transaction",
    },
    {
      kind: "journal",
      title: "Journal entry",
      subtitle: links.journalEntry.label,
      status: vatNodeStatus("journal", links.journalEntry),
      id: links.journalEntry.id,
      href: "/practice/reconciliation",
      openLabel: "Open Journal Entry",
    },
    {
      kind: "quarterly",
      title: "Quarterly update",
      subtitle: links.quarterlyUpdate.label,
      status: filingStatus(links.quarterlyUpdate),
      id: links.quarterlyUpdate.id,
      href: "/practice/itsa",
      openLabel: "Open Quarterly Update",
    },
    {
      kind: "eops",
      title: "EOPS",
      subtitle: links.eops.label,
      status: filingStatus(links.eops),
      id: links.eops.id,
      href: "/practice/itsa",
      openLabel: "Open EOPS",
    },
    {
      kind: "final",
      title: "Final declaration",
      subtitle: links.finalDeclaration.label,
      status: filingStatus(links.finalDeclaration),
      id: links.finalDeclaration.id,
      href: "/practice/itsa",
      openLabel: "Open Final Declaration",
    },
  ];
}

export function filingStatus(node?: DigitalLinkNode | null): LinkStatus {
  if (!node?.id || !node.linked) {
    return "missing";
  }
  const status = String(asRecord(node.detail).status ?? "").toUpperCase();
  return status === "SUBMITTED" || status === "FULFILLED" ? "linked" : "partial";
}

export function quarterlyFrom(node?: DigitalLinkNode | null, extra?: Record<string, unknown> | null): QuarterlyDetail | null {
  const detail = { ...asRecord(node?.detail), ...asRecord(extra) };
  const id = node?.id ?? stringOrNull(detail.id);
  if (!id) {
    return null;
  }
  return {
    id,
    taxYear: stringOrNull(detail.taxYear),
    periodId: stringOrNull(detail.periodId),
    periodStart: iso(detail.periodStart),
    periodEnd: iso(detail.periodEnd),
    status: stringOrNull(detail.status),
    hmrcSubmissionId: stringOrNull(detail.hmrcSubmissionId) ?? stringOrNull(detail.correlationId) ?? stringOrNull(detail.hmrcPeriodId),
    incomes: categoryRows(detail.incomes),
    expenses: categoryRows(detail.expenses),
    adjustments: categoryRows(detail.adjustments),
    rawPayload: recordOrNull(detail.rawPayload),
  };
}

export function eopsFrom(node?: DigitalLinkNode | null, extra?: Record<string, unknown> | null): EopsDetail | null {
  const detail = { ...asRecord(node?.detail), ...asRecord(extra) };
  const id = node?.id ?? stringOrNull(detail.id);
  if (!id) {
    return null;
  }
  return {
    id,
    taxYear: stringOrNull(detail.taxYear),
    typeOfBusiness: stringOrNull(detail.typeOfBusiness),
    periodStart: iso(detail.periodStart ?? asRecord(detail.summary).periodStart),
    periodEnd: iso(detail.periodEnd ?? asRecord(detail.summary).periodEnd),
    finalised: Boolean(detail.finalised),
    status: stringOrNull(detail.status),
    hmrcSubmissionId: stringOrNull(detail.hmrcSubmissionId) ?? stringOrNull(detail.correlationId),
    adjustments: categoryRows(detail.adjustments),
    summary: asRecord(detail.summary),
    rawPayload: recordOrNull(detail.rawPayload),
  };
}

export function finalFrom(node?: DigitalLinkNode | null, extra?: Record<string, unknown> | null): FinalDeclarationDetail | null {
  const detail = { ...asRecord(node?.detail), ...asRecord(extra) };
  const id = node?.id ?? stringOrNull(detail.id);
  if (!id) {
    return null;
  }
  return {
    id,
    taxYear: stringOrNull(detail.taxYear),
    calculationId: stringOrNull(detail.calculationId),
    finalised: Boolean(detail.finalised),
    status: stringOrNull(detail.status),
    hmrcSubmissionId: stringOrNull(detail.hmrcSubmissionId) ?? stringOrNull(detail.correlationId) ?? stringOrNull(detail.calculationId),
    calculation: asRecord(detail.calculation),
    rawPayload: recordOrNull(detail.rawPayload),
  };
}

export function itsaLinkedEntities(links: DigitalLinks): LinkedEntity[] {
  return itsaTimelineNodes(links)
    .filter((node) => node.id && node.status !== "missing")
    .map((node) => ({
      type: entityType(node.kind),
      id: node.id!,
      label: node.subtitle,
      href: node.href,
      detail: node.title,
      thumbnail: node.kind === "document",
    }));
}

export function itsaDocumentFrom(node?: DigitalLinkNode | null, extra?: Record<string, unknown> | null): DocumentDetail | null {
  return documentFrom(node, extra);
}

export function itsaTransactionFrom(node?: DigitalLinkNode | null, extra?: Record<string, unknown> | null): TransactionDetail | null {
  return transactionFrom(node, extra);
}

export function itsaJournalFrom(node?: DigitalLinkNode | null, extra?: Record<string, unknown> | null): JournalDetail | null {
  return journalFrom(node, extra);
}

export { statusTone };

function entityType(kind: ItsaTimelineKind): LinkedEntity["type"] {
  if (kind === "document") return "document";
  if (kind === "bank") return "bank_transaction";
  if (kind === "journal") return "journal";
  return "itsa_submission";
}

function categoryRows(value: unknown): CategoryAmount[] {
  return Object.entries(asRecord(value)).map(([id, amount]) => ({
    id,
    label: labelCategory(id),
    value: Number(amount) || 0,
  }));
}

function labelCategory(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function recordOrNull(value: unknown): Record<string, unknown> | null {
  const record = asRecord(value);
  return Object.keys(record).length ? record : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
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
