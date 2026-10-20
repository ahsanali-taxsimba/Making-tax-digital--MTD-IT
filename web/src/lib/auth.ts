import { apiFetch } from "./api";
import { clearSession, getRefreshToken, setSession } from "./session";
import type { LoginResult } from "./types";

export async function login(email: string, password: string): Promise<LoginResult> {
  const result = await apiFetch<LoginResult>("/auth/login", {
    method: "POST",
    auth: false,
    body: JSON.stringify({ email, password }),
  });
  setSession(result.accessToken, result.refreshToken, result.user);
  return result;
}

export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();
  try {
    if (refreshToken) {
      await apiFetch("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
      });
    }
  } finally {
    clearSession();
  }
}
