import { canonicalRoleLabel } from "./roles";
import type { HmrcLinkStatus, PracticeTaskStatus, PracticeTaskType } from "./types";

export const TASK_BOARD_COLUMNS = [
  { id: "OPEN", title: "Not started" },
  { id: "IN_PROGRESS", title: "In progress" },
  { id: "WAITING_ON_CLIENT", title: "Waiting on client" },
  { id: "COMPLETED", title: "Completed" },
] as const;

export const PRACTICE_TASK_TYPES: PracticeTaskType[] = [
  "VAT_RETURN",
  "ITSA_UPDATE",
  "EOPS",
  "FINAL_DECLARATION",
  "BOOKKEEPING",
  "RECONCILIATION",
];

export function taskColumn(status?: string | null): (typeof TASK_BOARD_COLUMNS)[number]["id"] | "HIDDEN" {
  switch (String(status ?? "OPEN").toUpperCase()) {
    case "OPEN":
      return "OPEN";
    case "IN_PROGRESS":
      return "IN_PROGRESS";
    case "WAITING_ON_CLIENT":
      return "WAITING_ON_CLIENT";
    case "COMPLETED":
      return "COMPLETED";
    default:
      return "HIDDEN";
  }
}

export function taskTypeLabel(type?: string | null): string {
  switch (String(type ?? "").toUpperCase()) {
    case "VAT_RETURN":
    case "MTD_VAT_RETURN":
      return "VAT return";
    case "ITSA_UPDATE":
    case "MTD_ITSA_UPDATE":
      return "ITSA update";
    case "EOPS":
    case "MTD_ITSA_EOPS":
      return "EOPS";
    case "FINAL_DECLARATION":
    case "MTD_ITSA_FINAL_DECLARATION":
      return "Final declaration";
    case "BOOKKEEPING":
      return "Bookkeeping";
    case "RECONCILIATION":
      return "Reconciliation";
    case "PROVIDE_RECORDS":
      return "Provide records";
    case "APPROVE_RETURN":
      return "Approve return";
    case "MTD_TOKEN_EXPIRING":
      return "HMRC token expiring";
    default:
      return type ? type.replace(/[_-]+/g, " ") : "Task";
  }
}

export function taskStatusLabel(status?: string | null): string {
  switch (taskColumn(status)) {
    case "OPEN":
      return "Not started";
    case "IN_PROGRESS":
      return "In progress";
    case "WAITING_ON_CLIENT":
      return "Waiting on client";
    case "COMPLETED":
      return "Completed";
    default:
      return "Cancelled";
  }
}

export function roleLabel(role?: string | null): string {
  return canonicalRoleLabel(role);
}

export function statusLabel(status?: string | null): string {
  switch (String(status ?? "").toUpperCase()) {
    case "ACTIVE":
      return "Active";
    case "INVITED":
      return "Invited";
    case "SUSPENDED":
      return "Deactivated";
    default:
      return status ?? "—";
  }
}

export function riskLabel(level?: string | null): string {
  switch (String(level ?? "MEDIUM").toUpperCase()) {
    case "LOW":
      return "Low";
    case "HIGH":
      return "High";
    default:
      return "Medium";
  }
}

export function clientTypeLabel(type?: string | null): string {
  switch (String(type ?? "").toUpperCase()) {
    case "INDIVIDUAL":
      return "Individual";
    case "COMPANY":
      return "Company";
    case "LANDLORD":
      return "Landlord";
    case "PARTNERSHIP":
      return "Partnership";
    default:
      return type ?? "—";
  }
}

export function hmrcStatusLabel(status?: HmrcLinkStatus | string | null): string {
  switch (String(status ?? "not_connected")) {
    case "connected":
      return "Connected";
    case "disconnected":
      return "Disconnected";
    default:
      return "Not connected";
  }
}

export function clientHmrcStatus(client: {
  mtdConnections?: Array<{ disconnectedAt?: string | null; scopes?: string[] }>;
}): HmrcLinkStatus {
  const active = (client.mtdConnections ?? []).filter((row) => !row.disconnectedAt);
  if (active.length) {
    return "connected";
  }
  if ((client.mtdConnections ?? []).length) {
    return "disconnected";
  }
  return "not_connected";
}

export function matchesQuery(haystack: Array<string | null | undefined>, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  return haystack.some((value) => String(value ?? "").toLowerCase().includes(needle));
}

export function pageTitle(pathname: string): string {
  if (pathname.startsWith("/admin/firms")) return "Firms";
  if (pathname.startsWith("/admin/integrations")) return "Integrations";
  if (pathname.startsWith("/admin/feature-flags")) return "Feature flags";
  if (pathname.startsWith("/admin/logs")) return "Logs";
  if (pathname.startsWith("/admin/system-health")) return "System health";
  if (pathname.startsWith("/admin")) return "Platform dashboard";
  if (pathname.startsWith("/practice/staff")) return "Staff";
  if (pathname.startsWith("/practice/clients")) return "Clients";
  if (pathname.startsWith("/practice/tasks")) return "Tasks";
  if (pathname.startsWith("/practice/hmrc")) return "HMRC connections";
  if (pathname.startsWith("/practice/vat")) return "VAT";
  if (pathname.startsWith("/practice/itsa")) return "ITSA";
  if (pathname.startsWith("/practice/bank-feeds")) return "Bank feeds";
  if (pathname.startsWith("/practice/reconciliation")) return "Reconciliation";
  if (pathname.startsWith("/practice/documents")) return "Documents";
  if (pathname.startsWith("/practice/audit")) return "Audit";
  if (pathname.startsWith("/practice/digital-links")) return "Digital links";
  if (pathname.startsWith("/practice/dashboard")) return "Dashboard";
  if (pathname.startsWith("/practice")) return "Practice";
  if (pathname.startsWith("/client/vat")) return "VAT";
  if (pathname.startsWith("/client/itsa")) return "ITSA";
  if (pathname.startsWith("/client/documents")) return "Documents";
  if (pathname.startsWith("/client/messages")) return "Messages";
  if (pathname.startsWith("/client")) return "Home";
  if (pathname.startsWith("/reconciliation")) return "Bank reconciliation";
  if (pathname.startsWith("/categorisation")) return "Auto-categorisation";
  if (pathname.startsWith("/matching")) return "Invoice & bill matching";
  if (pathname.startsWith("/receipts")) return "Receipts";
  if (pathname.startsWith("/vat")) return "VAT";
  if (pathname.startsWith("/itsa")) return "ITSA";
  if (pathname.startsWith("/portal")) return "Client portal";
  return "Making Tax Digital";
}

export const CREATEABLE_TASK_STATUSES: PracticeTaskStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING_ON_CLIENT",
  "COMPLETED",
];
