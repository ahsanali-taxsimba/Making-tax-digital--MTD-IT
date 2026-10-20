import { HmrcEnvironment } from "@prisma/client";
import { HMRC_OAUTH_ERR } from "./hmrc-oauth.errors";
import { HmrcOAuthService } from "./hmrc-oauth.service";

describe("HmrcOAuthService", () => {
  const user = { id: "u1", firmId: "firm-1", role: "ACCOUNTANT" } as never;
  const client = { id: "client-1", firmId: "firm-1", name: "Amelia" };
  const repo = {
    createState: jest.fn(),
    findState: jest.fn(),
    deleteState: jest.fn(),
    findConnection: jest.fn(),
    listConnections: jest.fn(),
    upsertConnection: jest.fn(),
    updateConnection: jest.fn(),
    disconnect: jest.fn(),
    expiringConnections: jest.fn(),
    findClient: jest.fn(),
  };
  const clients = { get: jest.fn().mockResolvedValue(client) };
  const crypto = { encrypt: jest.fn((value: string) => `enc:${value}`), decrypt: jest.fn((value: string) => value.replace("enc:", "")) };
  const gateway = {
    buildAuthorizeUrl: jest.fn(),
    exchangeCode: jest.fn().mockResolvedValue({
      accessToken: "access-1",
      refreshToken: "refresh-1",
      expiresIn: 14400,
      scope: "read:vat write:vat",
    }),
    refresh: jest.fn().mockResolvedValue({
      accessToken: "access-2",
      refreshToken: "refresh-2",
      expiresIn: 14400,
    }),
    revoke: jest.fn().mockResolvedValue(undefined),
  };
  const apps = {
    requireSettings: jest.fn().mockReturnValue({
      environment: HmrcEnvironment.SANDBOX,
      clientId: "sandbox-app",
      clientSecret: "secret",
      redirectUri: "http://localhost:3000/hmrc/oauth/callback",
      baseUrl: "https://test-api.service.hmrc.gov.uk",
      authBaseUrl: "https://test-www.tax.service.gov.uk",
    }),
    defaultEnvironment: jest.fn().mockReturnValue(HmrcEnvironment.SANDBOX),
    scopes: jest.fn().mockReturnValue(["read:vat", "write:vat"]),
    refreshSkewMs: jest.fn().mockReturnValue(60_000),
    isLiveMode: jest.fn().mockReturnValue(false),
  };
  const audit = { record: jest.fn() };
  const webhooks = { emit: jest.fn() };
  const notifications = { notify: jest.fn() };

  const service = new HmrcOAuthService(
    repo as never,
    clients as never,
    crypto as never,
    gateway as never,
    apps as never,
    audit as never,
    webhooks as never,
    notifications as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    clients.get.mockResolvedValue(client);
    apps.requireSettings.mockReturnValue({
      environment: HmrcEnvironment.SANDBOX,
      clientId: "sandbox-app",
      clientSecret: "secret",
      redirectUri: "http://localhost:3000/hmrc/oauth/callback",
      baseUrl: "https://test-api.service.hmrc.gov.uk",
      authBaseUrl: "https://test-www.tax.service.gov.uk",
    });
    apps.scopes.mockReturnValue(["read:vat", "write:vat"]);
    apps.defaultEnvironment.mockReturnValue(HmrcEnvironment.SANDBOX);
    apps.refreshSkewMs.mockReturnValue(60_000);
  });

  it("starts authorisation with a CSRF state and HMRC auth URL", async () => {
    const started = await service.startAuth(user, client.id, "sandbox");
    expect(started.authorizationUrl).toContain("response_type=code");
    expect(started.authorizationUrl).toContain("client_id=sandbox-app");
    expect(started.authorizationUrl).toContain("state=");
    expect(started.mode).toBe("mock");
    expect(repo.createState).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ actionType: "hmrc.oauth.started" }));
  });

  it("exchanges the callback code and stores encrypted tokens", async () => {
    repo.findState.mockResolvedValue({
      id: "st1",
      clientId: client.id,
      environment: HmrcEnvironment.SANDBOX,
      expiresAt: new Date(Date.now() + 60_000),
    });
    repo.upsertConnection.mockResolvedValue({
      tokenExpiresAt: new Date(),
      scopes: ["read:vat", "write:vat"],
    });
    repo.findClient.mockResolvedValue(client);

    const result = await service.handleCallback({ code: "abc", state: "state-1", environment: "sandbox" });
    expect(result.connected).toBe(true);
    expect(crypto.encrypt).toHaveBeenCalledWith("access-1");
    expect(crypto.encrypt).toHaveBeenCalledWith("refresh-1");
    expect(webhooks.emit).toHaveBeenCalledWith("firm-1", "MTD_CONNECTION_CREATED", expect.any(Object));
  });

  it("rejects an invalid or expired OAuth state", async () => {
    repo.findState.mockResolvedValue(null);
    await expect(service.handleCallback({ code: "abc", state: "bad" })).rejects.toMatchObject({
      errorCode: HMRC_OAUTH_ERR.INVALID_STATE,
    });
  });

  it("refreshes an access token that is inside the expiry window", async () => {
    repo.findConnection.mockResolvedValue({
      id: "conn-1",
      clientId: client.id,
      environment: HmrcEnvironment.SANDBOX,
      accessTokenEnc: "enc:old-access",
      refreshTokenEnc: "enc:old-refresh",
      tokenExpiresAt: new Date(Date.now() + 10_000),
      disconnectedAt: null,
    });
    repo.updateConnection.mockResolvedValue({});

    const token = await service.getValidAccessToken(client.id, "sandbox");
    expect(gateway.refresh).toHaveBeenCalledWith({
      refreshToken: "old-refresh",
      environment: HmrcEnvironment.SANDBOX,
    });
    expect(token).toBe("access-2");
    expect(crypto.encrypt).toHaveBeenCalledWith("access-2");
  });

  it("refreshNow returns the updated connection status", async () => {
    repo.findConnection.mockResolvedValue({
      id: "conn-1",
      clientId: client.id,
      environment: HmrcEnvironment.SANDBOX,
      accessTokenEnc: "enc:current",
      refreshTokenEnc: "enc:refresh",
      tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      disconnectedAt: null,
    });
    repo.listConnections.mockResolvedValue([
      { environment: HmrcEnvironment.SANDBOX, tokenExpiresAt: new Date(), disconnectedAt: null },
    ]);

    const status = await service.refreshNow(user, client.id, "sandbox");
    expect(status.connected).toBe(true);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ actionType: "hmrc.oauth.refresh_requested" }));
  });

  it("returns the current token when it is still valid", async () => {
    repo.findConnection.mockResolvedValue({
      id: "conn-1",
      clientId: client.id,
      environment: HmrcEnvironment.SANDBOX,
      accessTokenEnc: "enc:current",
      refreshTokenEnc: "enc:refresh",
      tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      disconnectedAt: null,
    });

    await expect(service.getValidAccessToken(client.id, "sandbox")).resolves.toBe("current");
    expect(gateway.refresh).not.toHaveBeenCalled();
  });

  it("wraps a failed refresh as HMRC_OAUTH_ERR_REFRESH_FAILED", async () => {
    repo.findConnection.mockResolvedValue({
      id: "conn-1",
      clientId: client.id,
      environment: HmrcEnvironment.SANDBOX,
      accessTokenEnc: "enc:old-access",
      refreshTokenEnc: "enc:old-refresh",
      tokenExpiresAt: new Date(Date.now() + 10_000),
      disconnectedAt: null,
    });
    gateway.refresh.mockRejectedValueOnce(new Error("upstream"));
    await expect(service.getValidAccessToken(client.id, "sandbox")).rejects.toMatchObject({
      errorCode: HMRC_OAUTH_ERR.REFRESH_FAILED,
    });
  });
});
