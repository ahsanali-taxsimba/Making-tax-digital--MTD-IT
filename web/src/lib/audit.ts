import { apiFetch } from "./api";
import { canonicalRoleLabel } from "./roles";

export const AUDIT_RESOURCE_TYPES = [
  "bank_transaction",
  "invoice",
  "bill",
  "vat_return",
  "itsa_submission",
  "document",
] as const;

export type AuditResourceType = (typeof AUDIT_RESOURCE_TYPES)[number];

export const AUDIT_ACTIONS = [
  { value: "auth.login", label: "Login" },
  { value: "user.updated", label: "Permission change" },
  { value: "document.uploaded", label: "Document uploaded" },
  { value: "document.attached", label: "Document attached" },
  { value: "document.detached", label: "Document detached" },
  { value: "receipt.uploaded", label: "Receipt uploaded" },
  { value: "bookkeeping.invoice.posted", label: "Invoice posted" },
  { value: "bookkeeping.bill.posted", label: "Bill posted" },
  { value: "bookkeeping.reconciliation.matched", label: "Reconciled" },
  { value: "categorisation.applied", label: "Categorised" },
  { value: "vat.return.submitted", label: "VAT submitted" },
  { value: "itsa.update.submitted", label: "ITSA submitted" },
] as const;

export interface AuditActor {
  id: string;
  name: string;
  email: string;
  role?: string;
}

export interface AuditClient {
  id: string;
  name: string;
}

export interface AuditLogEntry {
  id: string;
  firmId: string | null;
  clientId: string | null;
  userId: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  prevHash?: string | null;
  entryHash?: string | null;
  actor?: AuditActor | null;
  client?: AuditClient | null;
}

export interface AuditFilters {
  clientId: string;
  resourceType: string;
  action: string;
  from: string;
  to: string;
}

export const EMPTY_AUDIT_FILTERS: AuditFilters = {
  clientId: "",
  resourceType: "",
  action: "",
  from: "",
  to: "",
};

export interface DigitalLinkNode {
  type: string;
  id: string | null;
  label: string;
  linked: boolean;
  detail: Record<string, unknown> | null;
}

export interface DigitalLinks {
  chain: "vat" | "itsa" | "invoice";
  resourceId: string;
  document: DigitalLinkNode;
  bankTransaction: DigitalLinkNode;
  journalEntry: DigitalLinkNode;
  extraction: DigitalLinkNode;
  invoice: DigitalLinkNode;
  vatReturn: DigitalLinkNode;
  quarterlyUpdate: DigitalLinkNode;
  eops: DigitalLinkNode;
  finalDeclaration: DigitalLinkNode;
  path: string[];
}

export interface AuditExport {
  firmId: string;
  clientId: string | null;
  period: { start: string; end: string } | null;
  generatedAt: string;
  generatedBy: { id: string; name: string; role: string };
  entryCount: number;
  chainIntact?: boolean;
  entries: AuditLogEntry[];
  digitalLinks?: DigitalLinks[];
}

export interface JsonDiffRow {
  path: string;
  before: string;
  after: string;
  change: "unchanged" | "added" | "removed" | "changed";
}

export interface LinkedEntity {
  type: "document" | "bank_transaction" | "invoice" | "bill" | "journal" | "vat_return" | "itsa_submission";
  id: string;
  label: string;
  href: string;
  detail?: string | null;
  thumbnail?: boolean;
}

export function listAuditLogs(filters: Partial<AuditFilters> & { firmId?: string } = {}) {
  const params = new URLSearchParams();
  if (filters.firmId) params.set("firmId", filters.firmId);
  if (filters.clientId) params.set("clientId", filters.clientId);
  if (filters.resourceType) params.set("resourceType", filters.resourceType);
  if (filters.action) params.set("action", filters.action);
  if (filters.from) params.set("from", toStartOfDay(filters.from));
  if (filters.to) params.set("to", toEndOfDay(filters.to));
  const query = params.toString();
  return apiFetch<AuditLogEntry[]>(query ? `/audit/logs?${query}` : "/audit/logs");
}

export function exportAuditTrail(query: { clientId?: string; period?: string } = {}) {
  const params = new URLSearchParams();
  if (query.clientId) params.set("clientId", query.clientId);
  if (query.period) params.set("period", query.period);
  const suffix = params.toString();
  return apiFetch<AuditExport>(suffix ? `/audit/export?${suffix}` : "/audit/export");
}

export function getDigitalLinks(resourceId: string, resourceType?: string | null) {
  if (resourceType === "itsa_submission") {
    return apiFetch<DigitalLinks>(`/digital-links/itsa/${resourceId}`);
  }
  if (resourceType === "invoice" || resourceType === "bill") {
    return apiFetch<DigitalLinks>(`/digital-links/invoice/${resourceId}`);
  }
  return apiFetch<DigitalLinks>(`/digital-links/${resourceId}`);
}

export function resourceTypeLabel(type?: string | null): string {
  switch (String(type ?? "")) {
    case "bank_transaction":
      return "Bank transaction";
    case "invoice":
      return "Invoice";
    case "bill":
      return "Bill";
    case "vat_return":
      return "VAT return";
    case "itsa_submission":
      return "ITSA submission";
    case "document":
      return "Document";
    case "journal":
      return "Journal";
    case "user":
      return "User";
    case "client":
      return "Client";
    case "firm":
      return "Firm";
    default:
      return type ? type.replace(/[_-]+/g, " ") : "—";
  }
}

export function auditActionLabel(action?: string | null): string {
  const known = AUDIT_ACTIONS.find((item) => item.value === action);
  if (known) {
    return known.label;
  }
  const last = String(action ?? "")
    .split(".")
    .filter(Boolean)
    .at(-1);
  if (!last) {
    return "—";
  }
  return last.replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function auditSummary(entry: AuditLogEntry): string {
  const before = asRecord(entry.beforeData);
  const after = asRecord(entry.afterData);
  const money = changedMoney(before, after);
  if (money) {
    return `${resourceTypeLabel(entry.resourceType)} total changed from ${money.before} to ${money.after}`;
  }
  const status = firstChanged(before, after, ["status", "role"]);
  if (status) {
    return `${resourceTypeLabel(entry.resourceType)} ${status.key} changed from ${status.before} to ${status.after}`;
  }
  if (String(entry.action).includes("attached")) {
    const target =
      stringOrNull(entry.metadata?.invoiceId) ? "invoice" :
      stringOrNull(entry.metadata?.billId) ? "bill" :
      stringOrNull(entry.metadata?.bankTransactionId) ? "bank_transaction" :
      stringOrNull(entry.metadata?.vatReturnId) ? "vat_return" :
      stringOrNull(entry.metadata?.itsaSubmissionId) ? "itsa_submission" :
      entry.resourceType;
    return `Document attached to ${resourceTypeLabel(target).toLowerCase()}`;
  }
  if (String(entry.action).includes("submitted")) {
    const period = String(entry.metadata?.periodKey ?? after.periodKey ?? entry.metadata?.taxYear ?? "");
    return period ? `Submitted ${resourceTypeLabel(entry.resourceType).toLowerCase()} ${period}` : `Submitted ${resourceTypeLabel(entry.resourceType).toLowerCase()}`;
  }
  if (String(entry.action).includes("login")) {
    return `${entry.actor?.name ?? "User"} signed in`;
  }
  return `${auditActionLabel(entry.action)} ${resourceTypeLabel(entry.resourceType).toLowerCase()}`;
}

export function actorLabel(entry: AuditLogEntry): string {
  const name = entry.actor?.name ?? "System";
  const role = canonicalRoleLabel(entry.actor?.role);
  return role && role !== "—" ? `${name} · ${role}` : name;
}

export function flattenRecord(value: unknown, prefix = ""): Record<string, string> {
  if (value === null || value === undefined) {
    return {};
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    return prefix ? { [prefix]: stringifyValue(value) } : {};
  }
  const rows: Record<string, string> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      Object.assign(rows, flattenRecord(nested, path));
    } else {
      rows[path] = stringifyValue(nested);
    }
  }
  return rows;
}

export function diffRecords(before: unknown, after: unknown): JsonDiffRow[] {
  const left = flattenRecord(before);
  const right = flattenRecord(after);
  const keys = Array.from(new Set([...Object.keys(left), ...Object.keys(right)])).sort();
  return keys.map((path) => {
    const hasBefore = Object.prototype.hasOwnProperty.call(left, path);
    const hasAfter = Object.prototype.hasOwnProperty.call(right, path);
    const beforeValue = hasBefore ? left[path] : "";
    const afterValue = hasAfter ? right[path] : "";
    let change: JsonDiffRow["change"] = "unchanged";
    if (!hasBefore && hasAfter) change = "added";
    else if (hasBefore && !hasAfter) change = "removed";
    else if (beforeValue !== afterValue) change = "changed";
    return { path, before: beforeValue, after: afterValue, change };
  });
}

export function linkedEntities(entry: AuditLogEntry, links?: DigitalLinks | null): LinkedEntity[] {
  const fromLinks = links ? nodesToEntities(links) : [];
  const fromMeta = metadataEntities(entry);
  const seen = new Set(fromLinks.map((item) => `${item.type}:${item.id}`));
  for (const item of fromMeta) {
    if (!seen.has(`${item.type}:${item.id}`)) {
      fromLinks.push(item);
      seen.add(`${item.type}:${item.id}`);
    }
  }
  return fromLinks;
}

export function hmrcContext(entry: AuditLogEntry, links?: DigitalLinks | null): {
  submissionId: string | null;
  status: string | null;
  visible: boolean;
} {
  const type = entry.resourceType;
  const visible = type === "vat_return" || type === "itsa_submission";
  const after = asRecord(entry.afterData);
  const meta = asRecord(entry.metadata);
  const node = type === "itsa_submission" ? links?.quarterlyUpdate ?? links?.eops ?? links?.finalDeclaration : links?.vatReturn;
  const detail = asRecord(node?.detail);
  const submissionId =
    stringOrNull(after.formBundleNumber) ??
    stringOrNull(after.hmrcSubmissionId) ??
    stringOrNull(after.correlationId) ??
    stringOrNull(detail.hmrcSubmissionId) ??
    stringOrNull(detail.formBundleNumber) ??
    stringOrNull(detail.correlationId) ??
    stringOrNull(meta.correlationId);
  const status = stringOrNull(after.status) ?? stringOrNull(detail.status) ?? stringOrNull(meta.status);
  return { visible, submissionId, status };
}

export function exportPeriod(filters: AuditFilters): string {
  if (filters.from && filters.to) {
    return `${filters.from}/${filters.to}`;
  }
  if (filters.from) {
    return filters.from;
  }
  const now = new Date();
  const year = now.getUTCMonth() > 2 || (now.getUTCMonth() === 2 && now.getUTCDate() >= 6) ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return `${year}-04`;
}

export function auditExportCsv(entries: AuditLogEntry[]): string {
  const header = ["Timestamp", "User", "Role", "Client", "Resource type", "Resource ID", "Action", "Summary"];
  const rows = entries.map((entry) =>
    [
      entry.createdAt,
      entry.actor?.name ?? "",
      entry.actor?.role ?? "",
      entry.client?.name ?? entry.clientId ?? "",
      entry.resourceType ?? "",
      entry.resourceId ?? "",
      entry.action,
      auditSummary(entry),
    ].map(csvCell),
  );
  return [header.join(","), ...rows.map((row) => row.join(","))].join("\n");
}

export function downloadText(fileName: string, content: string, type = "application/json") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function digitalLinkResourceId(entry: AuditLogEntry): string | null {
  if (entry.resourceId) {
    return entry.resourceId;
  }
  const meta = asRecord(entry.metadata);
  return (
    stringOrNull(meta.documentId) ??
    stringOrNull(meta.invoiceId) ??
    stringOrNull(meta.billId) ??
    stringOrNull(meta.bankTransactionId) ??
    stringOrNull(meta.vatReturnId) ??
    stringOrNull(meta.itsaSubmissionId)
  );
}

function nodesToEntities(links: DigitalLinks): LinkedEntity[] {
  const nodes: Array<[LinkedEntity["type"], DigitalLinkNode, string]> = [
    ["document", links.document, documentHref(links.document.id)],
    ["bank_transaction", links.bankTransaction, links.bankTransaction.id ? `/practice/digital-links/${links.bankTransaction.id}` : "/practice/reconciliation"],
    ["invoice", links.invoice, links.invoice.id ? `/practice/digital-links/${links.invoice.id}` : "/practice/documents"],
    ["vat_return", links.vatReturn, links.vatReturn.id ? `/practice/digital-links/${links.vatReturn.id}` : "/practice/vat"],
    ["itsa_submission", links.quarterlyUpdate, links.quarterlyUpdate.id ? `/practice/digital-links/itsa/${links.quarterlyUpdate.id}` : "/practice/itsa"],
    ["itsa_submission", links.eops, links.eops.id ? `/practice/digital-links/itsa/${links.eops.id}` : "/practice/itsa"],
    ["itsa_submission", links.finalDeclaration, links.finalDeclaration.id ? `/practice/digital-links/itsa/${links.finalDeclaration.id}` : "/practice/itsa"],
  ];
  return nodes
    .filter(([, node]) => node.linked && node.id)
    .map(([type, node, href]) => ({
      type,
      id: node.id!,
      label: node.label,
      href,
      detail: hmrcDetail(node.detail),
      thumbnail: type === "document",
    }));
}

function metadataEntities(entry: AuditLogEntry): LinkedEntity[] {
  const meta = asRecord(entry.metadata);
  const pairs: Array<[LinkedEntity["type"], string | null, string]> = [
    ["document", stringOrNull(meta.documentId), documentHref(stringOrNull(meta.documentId))],
    ["bank_transaction", stringOrNull(meta.bankTransactionId), "/practice/reconciliation"],
    ["invoice", stringOrNull(meta.invoiceId), meta.invoiceId ? `/invoices/${meta.invoiceId}` : "/practice/documents"],
    ["bill", stringOrNull(meta.billId), "/practice/documents"],
    ["journal", stringOrNull(meta.journalId) ?? stringOrNull(meta.journalEntryId), "/practice/reconciliation"],
    ["vat_return", stringOrNull(meta.vatReturnId), "/practice/vat"],
    ["itsa_submission", stringOrNull(meta.itsaSubmissionId), meta.itsaSubmissionId ? `/practice/digital-links/itsa/${meta.itsaSubmissionId}` : "/practice/itsa"],
  ];
  return pairs
    .filter(([, id]) => Boolean(id))
    .map(([type, id, href]) => ({
      type,
      id: id!,
      label: resourceTypeLabel(type),
      href,
      thumbnail: type === "document",
    }));
}

function documentHref(id?: string | null) {
  return id ? `/practice/digital-links/${id}` : "/practice/digital-links";
}

function hmrcDetail(detail: Record<string, unknown> | null): string | null {
  if (!detail) {
    return null;
  }
  return stringOrNull(detail.hmrcSubmissionId) ?? stringOrNull(detail.formBundleNumber) ?? stringOrNull(detail.status);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function changedMoney(before: Record<string, unknown>, after: Record<string, unknown>) {
  for (const key of ["grossTotal", "netTotal", "total", "amount", "netVatDue"]) {
    if (before[key] !== undefined && after[key] !== undefined && String(before[key]) !== String(after[key])) {
      return { before: String(before[key]), after: String(after[key]) };
    }
  }
  return null;
}

function firstChanged(before: Record<string, unknown>, after: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (before[key] !== undefined && after[key] !== undefined && String(before[key]) !== String(after[key])) {
      return { key, before: String(before[key]), after: String(after[key]) };
    }
  }
  return null;
}

function csvCell(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toStartOfDay(value: string) {
  return value.includes("T") ? value : `${value}T00:00:00.000Z`;
}

function toEndOfDay(value: string) {
  return value.includes("T") ? value : `${value}T23:59:59.999Z`;
}
