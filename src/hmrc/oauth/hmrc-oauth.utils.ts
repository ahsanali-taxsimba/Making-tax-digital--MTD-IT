import { HmrcEnvironment } from "@prisma/client";
import { HMRC_OAUTH_ERR, HmrcOAuthError } from "./hmrc-oauth.errors";

export interface HmrcAppSettings {
  environment: HmrcEnvironment;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  baseUrl: string;
  authBaseUrl: string;
}

export function parseHmrcEnvironment(value?: string | null): HmrcEnvironment {
  if (!value) {
    return HmrcEnvironment.SANDBOX;
  }
  const normalised = value.trim().toLowerCase();
  if (normalised === "live" || normalised === "prod" || normalised === "production") {
    return HmrcEnvironment.LIVE;
  }
  if (normalised === "sandbox" || normalised === "dev" || normalised === "development" || normalised === "test") {
    return HmrcEnvironment.SANDBOX;
  }
  if (normalised === "sandbox" || value === HmrcEnvironment.SANDBOX) {
    return HmrcEnvironment.SANDBOX;
  }
  if (value === HmrcEnvironment.LIVE) {
    return HmrcEnvironment.LIVE;
  }
  throw new HmrcOAuthError(HMRC_OAUTH_ERR.CONFIG_MISSING, `Unknown HMRC environment '${value}'`);
}

export function buildHmrcAuthorizeUrl(app: HmrcAppSettings, state: string, scopes: string[]): string {
  const url = new URL("/oauth/authorize", app.authBaseUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", app.clientId);
  url.searchParams.set("redirect_uri", app.redirectUri);
  url.searchParams.set("scope", scopes.join(" "));
  url.searchParams.set("state", state);
  return url.toString();
}

export function tokenExpiresAt(expiresInSeconds: number, now = Date.now()): Date {
  return new Date(now + expiresInSeconds * 1000);
}

export function needsRefresh(expiresAt: Date, skewMs = 60_000, now = Date.now()): boolean {
  return expiresAt.getTime() - now <= skewMs;
}

export function matchesRedirectUri(configured: string, incoming?: string | null): boolean {
  if (!incoming) {
    return true;
  }
  return trimSlash(configured) === trimSlash(incoming);
}

function trimSlash(value: string): string {
  return value.trim().replace(/\/$/, "");
}

export function assertAppConfigured(app: HmrcAppSettings, requireSecrets: boolean): void {
  if (!app.clientId || !app.redirectUri || !app.baseUrl) {
    throw new HmrcOAuthError(
      HMRC_OAUTH_ERR.CONFIG_MISSING,
      `HMRC app config is missing for ${app.environment.toLowerCase()}`,
      { environment: app.environment },
    );
  }
  if (requireSecrets && !app.clientSecret) {
    throw new HmrcOAuthError(
      HMRC_OAUTH_ERR.CONFIG_MISSING,
      `HMRC client secret is missing for ${app.environment.toLowerCase()}`,
      { environment: app.environment },
    );
  }
}
