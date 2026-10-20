import { clearSession, getAccessToken, getRefreshToken, setSession, getUser } from "./session";
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

export async function apiFetch<T>(
  path: string,
  init: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (init.auth !== false) {
    const token = getAccessToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  let response = await fetch(`${apiBase()}${path}`, { ...init, headers });
  if (response.status === 401 && init.auth !== false) {
    const next = await refreshAccessToken();
    if (next) {
      headers.set("Authorization", `Bearer ${next}`);
      response = await fetch(`${apiBase()}${path}`, { ...init, headers });
    } else {
      clearSession();
    }
  }
  return parseEnvelope<T>(response);
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
