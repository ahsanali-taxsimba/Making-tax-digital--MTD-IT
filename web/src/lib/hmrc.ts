import { apiFetch, assertHttpsRedirect } from "./api";
import type { HmrcCallbackResult, HmrcStartResult, HmrcStatus } from "./types";

export function startHmrcOAuth(clientId: string, environment: string) {
  const query = new URLSearchParams({ clientId, environment });
  return apiFetch<HmrcStartResult>(`/hmrc/oauth/start?${query.toString()}`);
}

export function getHmrcStatus(clientId: string, environment: string) {
  const query = new URLSearchParams({ clientId, environment });
  return apiFetch<HmrcStatus>(`/hmrc/oauth/status?${query.toString()}`);
}

export function disconnectHmrc(clientId: string, environment: string) {
  return apiFetch<HmrcStatus>("/hmrc/oauth/disconnect", {
    method: "POST",
    body: JSON.stringify({ clientId, environment }),
  });
}

export function refreshHmrcToken(clientId: string, environment: string) {
  return apiFetch<HmrcStatus>("/hmrc/oauth/refresh", {
    method: "POST",
    body: JSON.stringify({ clientId, environment }),
  });
}

export function completeHmrcCallback(params: {
  code?: string;
  state?: string;
  environment?: string;
  error?: string;
  error_description?: string;
}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      query.set(key, value);
    }
  });
  return apiFetch<HmrcCallbackResult>(`/hmrc/oauth/callback?${query.toString()}`, { auth: false });
}

export function shouldCompleteLocally(started: HmrcStartResult): boolean {
  if (process.env.NEXT_PUBLIC_HMRC_MOCK === "true") {
    return true;
  }
  if (started.mode === "mock") {
    return true;
  }
  try {
    return new URL(started.authorizationUrl).hostname === "mock-hmrc.local";
  } catch {
    return false;
  }
}

export function safeHmrcRedirect(url: string): string {
  assertHttpsRedirect(url);
  return url;
}
