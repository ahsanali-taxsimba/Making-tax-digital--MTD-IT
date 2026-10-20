import { clearSession, getAccessToken, getRefreshToken, setSession, getUser } from "./session";
import { withTenantQuery } from "./roles";
import type { ApiEnvelope } from "./types";
import { errorCodeOf } from "./errors";

export class ApiError extends Error {
  readonly status: number;
  readonly errorCode?: string;
  readonly details?: unknown;

  constructor(status: number, message: string, errorCode?: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errorCode = errorCode;
    this.details = details;
  }
}

export function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:3000";
}

async function parseEnvelope<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!body) {
    throw new ApiError(response.status, "The API did not return a valid response");
  }
  if (body.error) {
    throw new ApiError(response.status, body.error.message, errorCodeOf(body.error), body.error.details);
  }
  return body.data;
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return null;
  }
  const response = await fetch(`${apiBase()}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!response.ok) {
    return null;
  }
  const data = await parseEnvelope<{ accessToken: string; refreshToken: string }>(response);
  const user = getUser();
  if (user) {
    setSession(data.accessToken, data.refreshToken, user);
  }
  return data.accessToken;
}

function tenantScopedPath(path: string, auth?: boolean): string {
  if (auth === false || path.startsWith("/auth/")) {
    return path;
  }
  return withTenantQuery(path, getUser());
}

async function authorizedFetch(path: string, init: RequestInit & { auth?: boolean } = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type") && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (init.auth !== false) {
    const token = getAccessToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const scoped = tenantScopedPath(path, init.auth);
  let response = await fetch(`${apiBase()}${scoped}`, { ...init, headers });
  if (response.status === 401 && init.auth !== false) {
    const next = await refreshAccessToken();
    if (next) {
      headers.set("Authorization", `Bearer ${next}`);
      response = await fetch(`${apiBase()}${scoped}`, { ...init, headers });
    } else {
      clearSession();
    }
  }
  return response;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  return parseEnvelope<T>(await authorizedFetch(path, init));
}

export async function apiFetchBlob(path: string): Promise<{ blob: Blob; contentType: string; fileName: string }> {
  const response = await authorizedFetch(path);
  const contentType = response.headers.get("content-type") ?? "application/octet-stream";
  if (!response.ok || contentType.includes("application/json")) {
    await parseEnvelope<unknown>(response);
  }
  const disposition = response.headers.get("content-disposition") ?? "";
  const match = /filename="([^"]+)"/.exec(disposition);
  return {
    blob: await response.blob(),
    contentType,
    fileName: match?.[1] ?? "receipt",
  };
}

export function assertHttpsRedirect(url: string): void {
  const parsed = new URL(url);
  if (parsed.hostname === "mock-hmrc.local" || parsed.hostname === "localhost") {
    return;
  }
  if (parsed.protocol !== "https:") {
    throw new ApiError(400, "HMRC redirects must use HTTPS.");
  }
}
