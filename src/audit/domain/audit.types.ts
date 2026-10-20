export const AUDIT_RESOURCE_TYPES = [
  "firm",
  "client",
  "user",
  "document",
  "bank_transaction",
  "invoice",
  "bill",
  "journal",
  "vat_return",
  "itsa_submission",
  "feature_flag",
  "system",
] as const;

export type AuditResourceType = (typeof AUDIT_RESOURCE_TYPES)[number];

export interface AuditLogInput {
  actor?: { id: string; firmId?: string | null; clientId?: string | null } | null;
  firmId?: string | null;
  clientId?: string | null;
  action: string;
  resourceType?: AuditResourceType | string | null;
  resourceId?: string | null;
  beforeData?: Record<string, unknown> | null;
  afterData?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
}

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

export function inferResourceType(action: string, metadata: Record<string, unknown> = {}): AuditResourceType | null {
  if (typeof metadata.resourceType === "string") {
    return metadata.resourceType as AuditResourceType;
  }
  const prefix = action.split(".")[0] ?? "";
  switch (prefix) {
    case "document":
    case "documents":
    case "receipt":
    case "receipts":
      return "document";
    case "vat":
      return "vat_return";
    case "itsa":
      return "itsa_submission";
    case "bookkeeping":
      if (action.includes("invoice")) return "invoice";
      if (action.includes("bill")) return "bill";
      if (action.includes("journal")) return "journal";
      return "journal";
    case "invoice":
    case "invoices":
      return "invoice";
    case "bill":
    case "bills":
      return "bill";
    case "journal":
      return "journal";
    case "bank":
    case "yapily":
    case "categorisation":
    case "matching":
    case "reconciliation":
      return "bank_transaction";
    case "client":
      return "client";
    case "user":
    case "users":
    case "auth":
      return "user";
    case "firm":
    case "admin":
      return "firm";
    default:
      return null;
  }
}

export function inferResourceId(metadata: Record<string, unknown> = {}): string | null {
  const keys = [
    "resourceId",
    "documentId",
    "invoiceId",
    "billId",
    "journalId",
    "bankTransactionId",
    "vatReturnId",
    "itsaSubmissionId",
    "clientId",
    "userId",
  ];
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value) {
      return value;
    }
  }
  return null;
}
