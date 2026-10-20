export const LOGICAL_SERVICES = [
  "api-gateway",
  "auth",
  "tenant-management",
  "mtd-vat",
  "mtd-itsa",
  "bookkeeping",
  "bank-feeds",
  "document-management",
  "ocr",
  "ai-extraction",
  "client-portal",
  "practice-dashboard",
  "platform-admin",
] as const;

export type LogicalService = (typeof LOGICAL_SERVICES)[number];

const PREFIXES: Array<{ prefix: string; service: LogicalService }> = [
  { prefix: "/auth", service: "auth" },
  { prefix: "/firms", service: "tenant-management" },
  { prefix: "/users", service: "tenant-management" },
  { prefix: "/clients", service: "tenant-management" },
  { prefix: "/vat", service: "mtd-vat" },
  { prefix: "/itsa", service: "mtd-itsa" },
  { prefix: "/bookkeeping", service: "bookkeeping" },
  { prefix: "/ledger", service: "bookkeeping" },
  { prefix: "/yapily", service: "bank-feeds" },
  { prefix: "/bank", service: "bank-feeds" },
  { prefix: "/matching", service: "bank-feeds" },
  { prefix: "/categorisation", service: "bank-feeds" },
  { prefix: "/reconciliation", service: "bank-feeds" },
  { prefix: "/documents", service: "document-management" },
  { prefix: "/receipts", service: "ocr" },
  { prefix: "/invoices/extraction", service: "ai-extraction" },
  { prefix: "/invoice-extraction", service: "ai-extraction" },
  { prefix: "/portal", service: "client-portal" },
  { prefix: "/client", service: "client-portal" },
  { prefix: "/firm", service: "practice-dashboard" },
  { prefix: "/practice", service: "practice-dashboard" },
  { prefix: "/tasks", service: "practice-dashboard" },
  { prefix: "/admin", service: "platform-admin" },
  { prefix: "/audit", service: "platform-admin" },
  { prefix: "/digital-links", service: "platform-admin" },
  { prefix: "/hmrc", service: "api-gateway" },
];

export const IDENTITY_HEADERS = {
  userId: "x-mtd-user-id",
  principal: "x-mtd-principal",
  role: "x-mtd-role",
  firmId: "x-mtd-firm-id",
  clientId: "x-mtd-client-id",
  service: "x-mtd-service",
  hmrcMode: "x-mtd-hmrc-mode",
  hmrcEnvironment: "x-mtd-hmrc-environment",
  hmrcSandbox: "x-mtd-hmrc-sandbox",
} as const;

export function serviceForPath(path: string): LogicalService {
  const clean = (path.split("?")[0] ?? "/").replace(/\/+$/, "") || "/";
  const match = PREFIXES.find((row) => clean === row.prefix || clean.startsWith(`${row.prefix}/`));
  return match?.service ?? "api-gateway";
}

export function auditActionFor(method: string, path: string): string {
  const service = serviceForPath(path);
  const verb = method.toLowerCase();
  const clean = path.split("?")[0] ?? "";
  if (clean.includes("/vat/") && verb === "post") return "vat.return.submitted";
  if (clean.includes("/itsa/quarterly") && verb === "post") return "itsa.update.submitted";
  if (clean.includes("/itsa/eops") && verb === "post") return "itsa.eops.submitted";
  if (clean.includes("/final-declaration") && verb === "post") return "itsa.final.submitted";
  if (clean.includes("/journal") && verb === "post") return "bookkeeping.journal.posted";
  if (clean.includes("/invoices") && verb === "post") return "bookkeeping.invoice.posted";
  if (clean.includes("/bills") && verb === "post") return "bookkeeping.bill.posted";
  if (clean.includes("/reconcile") && verb === "post") return "bookkeeping.reconciliation.matched";
  if (clean.includes("/matching") && verb === "post") return "bank.matching.applied";
  if (clean.includes("/documents") && verb === "post") return "document.uploaded";
  if (clean.includes("/documents") && verb === "delete") return "document.deleted";
  if (clean.includes("/admin/feature-flags")) return "platform.feature_flag.updated";
  return `${service}.${verb}`;
}
