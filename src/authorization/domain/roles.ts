import { UserRole } from "@prisma/client";

export const PLATFORM_ROLES = [
  "admin_super",
  "admin_owner",
  "admin_marketing",
  "admin_developer",
  "admin_support",
] as const;

export const FIRM_ROLES = ["firm_admin", "firm_accountant", "firm_staff", "firm_client"] as const;

export type PlatformRoleName = (typeof PLATFORM_ROLES)[number];
export type FirmRoleName = (typeof FIRM_ROLES)[number];
export type PrincipalKind = "platform" | "firm";

export type PlatformAction =
  | "view_firms"
  | "view_firm_stats"
  | "view_firm_counts_only"
  | "view_firm_and_client_metadata"
  | "manage_firm_subscription"
  | "view_system_health"
  | "view_logs"
  | "manage_feature_flags"
  | "view_clients"
  | "view_documents"
  | "view_financials"
  | "view_bank_transactions";

export type FirmAction =
  | "view"
  | "create"
  | "update"
  | "delete"
  | "submit"
  | "upload"
  | "reconcile"
  | "manage_users"
  | "manage_firm";

export type ResourceType =
  | "firm"
  | "client"
  | "document"
  | "bank_transaction"
  | "invoice"
  | "bill"
  | "journal"
  | "vat_return"
  | "itsa_submission"
  | "user"
  | "feature_flag"
  | "system";

export interface PlatformUserView {
  id: string;
  role: PlatformRoleName;
  name: string;
  email: string;
  isActive: boolean;
}

export interface FirmUserView {
  id: string;
  firmId: string;
  role: FirmRoleName;
  name: string;
  email: string;
  isActive: boolean;
  clientId: string | null;
}

export interface AuthzResource {
  firmId?: string | null;
  clientId?: string | null;
  assignedUserId?: string | null;
}

export function toFirmRole(role: UserRole | string | null | undefined): FirmRoleName {
  switch (String(role)) {
    case UserRole.ADMIN:
    case "FIRM_ADMIN":
    case "firm_admin":
      return "firm_admin";
    case UserRole.ACCOUNTANT:
    case "FIRM_ACCOUNTANT":
    case "firm_accountant":
      return "firm_accountant";
    case UserRole.ASSISTANT:
    case "FIRM_STAFF":
    case "firm_staff":
      return "firm_staff";
    default:
      return "firm_client";
  }
}

export function toUserRole(role: FirmRoleName | UserRole | string): UserRole {
  switch (toFirmRole(role)) {
    case "firm_admin":
      return UserRole.ADMIN;
    case "firm_accountant":
      return UserRole.ACCOUNTANT;
    case "firm_staff":
      return UserRole.ASSISTANT;
    default:
      return UserRole.CLIENT;
  }
}

export function toPlatformRole(role: string | null | undefined): PlatformRoleName {
  const normalised = String(role ?? "")
    .toLowerCase()
    .replace(/^admin_/, "admin_")
    .replace(/-/g, "_");
  if (normalised === "admin_super" || normalised === "admin_superuser") {
    return "admin_super";
  }
  if (normalised === "admin_owner") {
    return "admin_owner";
  }
  if (normalised === "admin_marketing") {
    return "admin_marketing";
  }
  if (normalised === "admin_developer") {
    return "admin_developer";
  }
  return "admin_support";
}

export function publicPlatformRole(role: string): PlatformRoleName {
  return toPlatformRole(String(role).replace(/^ADMIN_/, "admin_"));
}

export function publicFirmRole(role: UserRole | string): FirmRoleName {
  return toFirmRole(role);
}

export const CLIENT_DATA_PATHS = [
  "/clients",
  "/documents",
  "/bookkeeping",
  "/receipts",
  "/invoices",
  "/portal",
  "/vat",
  "/itsa",
  "/reconciliation",
  "/categorisation",
  "/matching",
  "/firm",
  "/firms",
  "/client",
  "/users",
];
