import type { AuthUser, CanonicalRole, FirmRole, PlatformRole, PrincipalKind } from "./types";

export const PLATFORM_ROLES: PlatformRole[] = [
  "admin_super",
  "admin_owner",
  "admin_marketing",
  "admin_developer",
  "admin_support",
];

export const FIRM_STAFF_ROLES: FirmRole[] = ["firm_admin", "firm_accountant", "firm_staff"];
export const FIRM_ROLES: FirmRole[] = [...FIRM_STAFF_ROLES, "firm_client"];

export type NavItem = { href: string; label: string; match?: string };

export const ADMIN_NAV: NavItem[] = [
  { href: "/admin/overview", label: "Dashboard", match: "/admin/overview" },
  { href: "/admin/firms", label: "Firms", match: "/admin/firms" },
  { href: "/admin/integrations", label: "Integrations", match: "/admin/integrations" },
  { href: "/admin/feature-flags", label: "Feature Flags", match: "/admin/feature-flags" },
  { href: "/admin/logs", label: "Logs", match: "/admin/logs" },
  { href: "/admin/system-health", label: "System Health", match: "/admin/system-health" },
];

export const PRACTICE_NAV: NavItem[] = [
  { href: "/practice/dashboard", label: "Dashboard", match: "/practice/dashboard" },
  { href: "/practice/clients", label: "Clients", match: "/practice/clients" },
  { href: "/practice/vat", label: "VAT", match: "/practice/vat" },
  { href: "/practice/itsa", label: "ITSA", match: "/practice/itsa" },
  { href: "/practice/bank-feeds", label: "Bank Feeds", match: "/practice/bank-feeds" },
  { href: "/practice/reconciliation", label: "Reconciliation", match: "/practice/reconciliation" },
  { href: "/practice/documents", label: "Documents", match: "/practice/documents" },
  { href: "/practice/audit", label: "Audit", match: "/practice/audit" },
  { href: "/practice/digital-links", label: "Digital links", match: "/practice/digital-links" },
  { href: "/practice/tasks", label: "Tasks", match: "/practice/tasks" },
];

export const CLIENT_NAV: NavItem[] = [
  { href: "/client/home", label: "Home", match: "/client/home" },
  { href: "/client/vat", label: "VAT", match: "/client/vat" },
  { href: "/client/itsa", label: "ITSA", match: "/client/itsa" },
  { href: "/client/documents", label: "Documents", match: "/client/documents" },
  { href: "/client/messages", label: "Messages", match: "/client/messages" },
];

export function canonicalRole(user?: Pick<AuthUser, "role" | "principal" | "platformRole" | "firmRole"> | null): CanonicalRole | null {
  if (!user) {
    return null;
  }
  if (user.principal === "platform" || user.platformRole) {
    const role = String(user.platformRole ?? "").toLowerCase().replace(/-/g, "_");
    return (PLATFORM_ROLES as string[]).includes(role) ? (role as PlatformRole) : "admin_support";
  }
  if (user.firmRole && (FIRM_ROLES as string[]).includes(user.firmRole)) {
    return user.firmRole;
  }
  switch (user.role) {
    case "ADMIN":
      return "firm_admin";
    case "ACCOUNTANT":
      return "firm_accountant";
    case "ASSISTANT":
      return "firm_staff";
    case "CLIENT":
      return "firm_client";
    default:
      return null;
  }
}

export function principalOf(user?: AuthUser | null): PrincipalKind | null {
  const role = canonicalRole(user);
  if (!role) {
    return null;
  }
  return PLATFORM_ROLES.includes(role as PlatformRole) ? "platform" : "firm";
}

export function isPlatformRole(role?: string | null): boolean {
  return (PLATFORM_ROLES as string[]).includes(String(role ?? ""));
}

export function isFirmStaffRole(role?: string | null): boolean {
  return (FIRM_STAFF_ROLES as string[]).includes(String(role ?? "")) || role === "ADMIN" || role === "ACCOUNTANT" || role === "ASSISTANT";
}

export function canViewAudit(role?: string | null): boolean {
  return role === "firm_admin" || role === "firm_accountant" || role === "ADMIN" || role === "ACCOUNTANT";
}

export function practiceNavFor(role?: string | null): NavItem[] {
  if (canViewAudit(role)) {
    return PRACTICE_NAV;
  }
  return PRACTICE_NAV.filter((item) => item.href !== "/practice/audit" && item.href !== "/practice/digital-links");
}

export function isFirmClientRole(role?: string | null): boolean {
  return role === "firm_client" || role === "CLIENT";
}

export function homePath(user?: AuthUser | null): string {
  const role = canonicalRole(user);
  if (role && isPlatformRole(role)) {
    return "/admin/overview";
  }
  if (role === "firm_client") {
    return "/client/home";
  }
  if (role && isFirmStaffRole(role)) {
    return "/practice/dashboard";
  }
  return "/login";
}

export function workspaceForPath(pathname: string): "admin" | "practice" | "client" | "public" | "other" {
  if (pathname === "/login" || pathname === "/access-denied") {
    return "public";
  }
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return "admin";
  }
  if (pathname === "/client" || pathname.startsWith("/client/")) {
    return "client";
  }
  if (
    pathname.startsWith("/practice") ||
    pathname.startsWith("/reconciliation") ||
    pathname.startsWith("/categorisation") ||
    pathname.startsWith("/matching") ||
    pathname.startsWith("/receipts") ||
    pathname.startsWith("/invoices") ||
    pathname.startsWith("/vat") ||
    pathname.startsWith("/itsa")
  ) {
    return "practice";
  }
  if (pathname.startsWith("/portal")) {
    return "client";
  }
  return "other";
}

export function canAccessPath(user: AuthUser | null | undefined, pathname: string): boolean {
  const workspace = workspaceForPath(pathname);
  if (workspace === "public") {
    return true;
  }
  const role = canonicalRole(user);
  if (!role) {
    return false;
  }
  if (workspace === "admin") {
    return isPlatformRole(role);
  }
  if (workspace === "practice") {
    if (
      pathname === "/practice/audit" ||
      pathname.startsWith("/practice/audit/") ||
      pathname === "/practice/digital-links" ||
      pathname.startsWith("/practice/digital-links/")
    ) {
      return canViewAudit(role);
    }
    return isFirmStaffRole(role);
  }
  if (workspace === "client") {
    return role === "firm_client";
  }
  return Boolean(role);
}

export function tenantMismatch(user: AuthUser | null | undefined, route?: { firmId?: string | null; clientId?: string | null }): boolean {
  if (!user) {
    return false;
  }
  const role = canonicalRole(user);
  if (role && isPlatformRole(role)) {
    return Boolean(route?.firmId || route?.clientId);
  }
  if (route?.firmId && user.firmId && route.firmId !== user.firmId) {
    return true;
  }
  if (role === "firm_client" && route?.clientId && user.clientId && route.clientId !== user.clientId) {
    return true;
  }
  return false;
}

export function tenantQuery(user?: AuthUser | null): Record<string, string> {
  const role = canonicalRole(user);
  if (!user || (role && isPlatformRole(role))) {
    return {};
  }
  if (role === "firm_client" && user.clientId) {
    return { clientId: user.clientId };
  }
  if (user.firmId) {
    return { firmId: user.firmId };
  }
  return {};
}

export function withTenantQuery(path: string, user?: AuthUser | null, extra: Record<string, string | undefined> = {}): string {
  const [base, existing = ""] = path.split("?");
  const params = new URLSearchParams(existing);
  const role = canonicalRole(user);

  for (const [key, value] of Object.entries({ ...Object.fromEntries(params.entries()), ...extra })) {
    if (!value) {
      params.delete(key);
      continue;
    }
    if (key === "firmId" && user?.firmId && value !== user.firmId) {
      continue;
    }
    if (key === "clientId" && user?.clientId && role === "firm_client" && value !== user.clientId) {
      continue;
    }
    params.set(key, value);
  }

  for (const [key, value] of Object.entries(tenantQuery(user))) {
    params.set(key, value);
  }

  if (role && isPlatformRole(role)) {
    params.delete("firmId");
    params.delete("clientId");
  } else if (user?.firmId && params.get("firmId") && params.get("firmId") !== user.firmId) {
    params.set("firmId", user.firmId);
  }
  if (role === "firm_client" && user?.clientId) {
    params.set("clientId", user.clientId);
  }

  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

export function navActive(pathname: string, href: string, match?: string): boolean {
  const prefix = match ?? href;
  if (prefix === "/practice/dashboard") {
    return pathname === "/practice" || pathname === "/practice/dashboard";
  }
  if (prefix === "/admin/overview") {
    return pathname === "/admin" || pathname === "/admin/overview";
  }
  if (prefix === "/client/home") {
    return pathname === "/client" || pathname === "/client/home";
  }
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function canonicalRoleLabel(role?: string | null): string {
  switch (String(role ?? "")) {
    case "admin_super":
      return "Platform super admin";
    case "admin_owner":
      return "Platform owner";
    case "admin_marketing":
      return "Marketing";
    case "admin_developer":
      return "Developer";
    case "admin_support":
      return "Support";
    case "firm_admin":
    case "ADMIN":
      return "Firm admin";
    case "firm_accountant":
    case "ACCOUNTANT":
      return "Accountant";
    case "firm_staff":
    case "ASSISTANT":
      return "Staff";
    case "firm_client":
    case "CLIENT":
      return "Client";
    default:
      return role ? String(role).replace(/[_-]+/g, " ") : "—";
  }
}
