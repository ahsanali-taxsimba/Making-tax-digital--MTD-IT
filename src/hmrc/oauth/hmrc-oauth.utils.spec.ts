import { HmrcEnvironment } from "@prisma/client";
import { HMRC_OAUTH_ERR } from "./hmrc-oauth.errors";
import {
  assertAppConfigured,
  buildHmrcAuthorizeUrl,
  matchesRedirectUri,
  needsRefresh,
  parseHmrcEnvironment,
  tokenExpiresAt,
} from "./hmrc-oauth.utils";

describe("HMRC OAuth helpers", () => {
  const sandbox = {
    environment: HmrcEnvironment.SANDBOX,
    clientId: "sandbox-app",
    clientSecret: "secret",
    redirectUri: "http://localhost:3000/hmrc/oauth/callback",
    baseUrl: "https://test-api.service.hmrc.gov.uk",
    authBaseUrl: "https://test-www.tax.service.gov.uk",
  };

  it("builds the HMRC authorise URL with code, client, redirect, scope and state", () => {
    const url = new URL(buildHmrcAuthorizeUrl(sandbox, "csrf-state", ["read:vat", "write:vat"]));
    expect(url.origin).toBe("https://test-www.tax.service.gov.uk");
    expect(url.pathname).toBe("/oauth/authorize");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("sandbox-app");
    expect(url.searchParams.get("redirect_uri")).toBe(sandbox.redirectUri);
    expect(url.searchParams.get("scope")).toBe("read:vat write:vat");
    expect(url.searchParams.get("state")).toBe("csrf-state");
  });

  it("maps sandbox/live/dev environment names", () => {
    expect(parseHmrcEnvironment("sandbox")).toBe(HmrcEnvironment.SANDBOX);
    expect(parseHmrcEnvironment("live")).toBe(HmrcEnvironment.LIVE);
    expect(parseHmrcEnvironment("dev")).toBe(HmrcEnvironment.SANDBOX);
  });

  it("refreshes tokens inside the expiry skew window", () => {
    const now = Date.parse("2026-01-01T00:00:00.000Z");
    expect(needsRefresh(new Date(now + 30_000), 60_000, now)).toBe(true);
    expect(needsRefresh(new Date(now + 120_000), 60_000, now)).toBe(false);
    expect(tokenExpiresAt(14400, now).toISOString()).toBe("2026-01-01T04:00:00.000Z");
  });

  it("validates the configured redirect URI and required app settings", () => {
    expect(matchesRedirectUri(sandbox.redirectUri, "http://localhost:3000/hmrc/oauth/callback/")).toBe(true);
    expect(matchesRedirectUri(sandbox.redirectUri, "https://evil.example/callback")).toBe(false);
    expect(() => assertAppConfigured({ ...sandbox, clientId: "" }, false)).toThrow(
      expect.objectContaining({ errorCode: HMRC_OAUTH_ERR.CONFIG_MISSING }),
    );
  });
});
