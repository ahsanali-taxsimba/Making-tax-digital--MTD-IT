import {
  CLIENT_DATA_PATHS,
  type AuthzResource,
  type FirmAction,
  type FirmUserView,
  type PlatformAction,
  type PlatformRoleName,
  type PlatformUserView,
  type ResourceType,
} from "./roles";

const PLATFORM_DENY_CLIENT_DATA = new Set<PlatformAction>([
  "view_clients",
  "view_documents",
  "view_financials",
  "view_bank_transactions",
]);

const PLATFORM_GRANTS: Record<PlatformRoleName, PlatformAction[]> = {
  admin_super: [
    "view_firms",
    "view_firm_stats",
    "view_firm_counts_only",
    "manage_firm_subscription",
    "view_system_health",
    "view_logs",
    "manage_feature_flags",
  ],
  admin_owner: ["view_firms", "view_firm_stats", "view_firm_counts_only"],
  admin_marketing: ["view_firms", "view_firm_counts_only"],
  admin_developer: ["view_system_health", "view_logs", "manage_feature_flags"],
  admin_support: ["view_firms", "view_firm_stats", "view_firm_and_client_metadata"],
};

export function canPlatform(
  user: PlatformUserView,
  action: PlatformAction,
  _resourceType?: ResourceType,
  _resource?: AuthzResource,
): boolean {
  if (!user.isActive) {
    return false;
  }
  if (PLATFORM_DENY_CLIENT_DATA.has(action)) {
    return false;
  }
  return PLATFORM_GRANTS[user.role]?.includes(action) ?? false;
}

export function canFirm(
  user: FirmUserView,
  action: FirmAction,
  resourceType: ResourceType,
  resource?: AuthzResource,
  options?: { restrictAccountantsToAssigned?: boolean },
): boolean {
  if (!user.isActive) {
    return false;
  }
  if (resource?.firmId && resource.firmId !== user.firmId) {
    return false;
  }
  if (user.role === "firm_client") {
    if (action !== "view" && action !== "upload") {
      return false;
    }
    if (resource?.clientId && resource.clientId !== user.clientId) {
      return false;
    }
    return ["client", "document", "vat_return", "itsa_submission", "invoice", "bill"].includes(resourceType);
  }
  if (user.role === "firm_staff") {
    if (action === "submit" || action === "manage_users" || action === "manage_firm" || action === "delete") {
      return false;
    }
    return ["client", "document", "bank_transaction", "invoice", "bill", "journal", "vat_return", "itsa_submission"].includes(
      resourceType,
    );
  }
  if (user.role === "firm_accountant") {
    if (action === "manage_users" || action === "manage_firm") {
      return false;
    }
    if (options?.restrictAccountantsToAssigned) {
      const assigned = resource?.assignedUserId;
      if (assigned && assigned !== user.id) {
        return false;
      }
    }
    return true;
  }
  return user.role === "firm_admin";
}

export function isClientDataPath(path: string): boolean {
  const normalised = path.split("?")[0] ?? path;
  return CLIENT_DATA_PATHS.some((prefix) => normalised === prefix || normalised.startsWith(`${prefix}/`));
}

export function isAdminPath(path: string): boolean {
  const normalised = path.split("?")[0] ?? path;
  return normalised === "/admin" || normalised.startsWith("/admin/");
}

export function platformMayAccessPath(user: PlatformUserView, path: string): boolean {
  if (isClientDataPath(path)) {
    return false;
  }
  if (path.startsWith("/admin/system") || path.startsWith("/admin/logs") || path.startsWith("/admin/feature-flags")) {
    return canPlatform(user, path.includes("feature-flags") ? "manage_feature_flags" : path.includes("logs") ? "view_logs" : "view_system_health");
  }
  if (path.startsWith("/admin/firms") && path.includes("/metadata")) {
    return canPlatform(user, "view_firm_and_client_metadata");
  }
  if (path.startsWith("/admin/firms") && path.includes("/stats")) {
    return canPlatform(user, "view_firm_stats") || canPlatform(user, "view_firm_counts_only");
  }
  if (path.startsWith("/admin/firms")) {
    return canPlatform(user, "view_firms") || canPlatform(user, "view_firm_counts_only");
  }
  return path.startsWith("/admin") || path.startsWith("/health") || path.startsWith("/auth");
}

export function firmMayAccessPath(user: FirmUserView, path: string): boolean {
  if (isAdminPath(path)) {
    return false;
  }
  if (path.startsWith("/client")) {
    return user.role === "firm_client";
  }
  if ((path.startsWith("/firm") || path.startsWith("/practice")) && user.role === "firm_client") {
    return false;
  }
  if (path.startsWith("/audit") || path.startsWith("/digital-links")) {
    return user.role === "firm_admin" || user.role === "firm_accountant";
  }
  return true;
}
