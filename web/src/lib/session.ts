import { canonicalRole, isFirmClientRole, isFirmStaffRole, isPlatformRole } from "./roles";
import type { AuthUser, HmrcEnvironment } from "./types";

const ACCESS = "mtd.accessToken";
const REFRESH = "mtd.refreshToken";
const USER = "mtd.user";
const CLIENT = "mtd.clientId";
const ENV = "mtd.environment";

export const SESSION_EVENT = "mtd-session-change";
export const DEMO_ACCESS_TOKEN = "mtd-demo-access";
export const DEMO_REFRESH_TOKEN = "mtd-demo-refresh";

function notify(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new Event(SESSION_EVENT));
}

function store(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.sessionStorage;
}

export function getAccessToken(): string | null {
  return store()?.getItem(ACCESS) ?? null;
}

export function getRefreshToken(): string | null {
  return store()?.getItem(REFRESH) ?? null;
}

export function getUser(): AuthUser | null {
  const raw = store()?.getItem(USER);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function getSelectedClientId(): string | null {
  return store()?.getItem(CLIENT) ?? getUser()?.clientId ?? null;
}

export function getEnvironment(): "sandbox" | "live" {
  const value = (store()?.getItem(ENV) ?? "sandbox").toLowerCase();
  return value === "live" ? "live" : "sandbox";
}

export function setSession(accessToken: string, refreshToken: string, user: AuthUser): void {
  const memory = store();
  if (!memory) {
    return;
  }
  memory.setItem(ACCESS, accessToken);
  memory.setItem(REFRESH, refreshToken);
  memory.setItem(USER, JSON.stringify(user));
  if (user.clientId) {
    memory.setItem(CLIENT, user.clientId);
  }
  notify();
}

export function setSelectedClientId(clientId: string): void {
  store()?.setItem(CLIENT, clientId);
  notify();
}

export function setEnvironment(environment: HmrcEnvironment): void {
  store()?.setItem(ENV, environment.toLowerCase() === "live" ? "live" : "sandbox");
  notify();
}

export function isDemoSession(): boolean {
  return getAccessToken() === DEMO_ACCESS_TOKEN;
}

export function startDemoSession(user: AuthUser): void {
  setSession(DEMO_ACCESS_TOKEN, DEMO_REFRESH_TOKEN, user);
}

export function clearSession(): void {
  const memory = store();
  memory?.removeItem(ACCESS);
  memory?.removeItem(REFRESH);
  memory?.removeItem(USER);
  memory?.removeItem(CLIENT);
  notify();
}

export function canManageConnection(role?: string | null, user?: AuthUser | null): boolean {
  const resolved = user ? canonicalRole(user) : role;
  return isFirmStaffRole(resolved);
}

export function isPracticeStaff(role?: string | null, user?: AuthUser | null): boolean {
  const resolved = user ? canonicalRole(user) : role;
  return isFirmStaffRole(resolved);
}

export function isPlatformStaff(user?: AuthUser | null): boolean {
  return isPlatformRole(canonicalRole(user));
}

export function isFirmClient(user?: AuthUser | null): boolean {
  return isFirmClientRole(canonicalRole(user));
}

export function canInviteStaff(role?: string | null, user?: AuthUser | null): boolean {
  const resolved = user ? canonicalRole(user) : role;
  return resolved === "firm_admin" || role === "ADMIN";
}
