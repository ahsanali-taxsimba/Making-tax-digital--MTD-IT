import { MtdConnectionService } from "./mtd-connection.service";

describe("MtdConnectionService", () => {
  const user = { id: "u1", firmId: "firm-1", role: "ACCOUNTANT" } as never;
  const client = { id: "client-1", firmId: "firm-1", name: "Amelia" };
  const prisma = {
    oauthState: { create: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
    mtdConnection: { upsert: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    client: { findUnique: jest.fn() },
  };
  const clients = { get: jest.fn().mockResolvedValue(client) };
  const crypto = { encrypt: jest.fn((v: string) => `enc:${v}`), decrypt: jest.fn((v: string) => v.replace("enc:", "")) };
  const oauth = {
    buildAuthorizeUrl: jest.fn().mockReturnValue("https://hmrc.test/oauth/authorize"),
    exchangeCode: jest.fn().mockResolvedValue({
      accessToken: "access",
      refreshToken: "refresh",
      expiresIn: 14400,
      scope: "read:vat write:vat",
    }),
    refresh: jest.fn(),
  };
  const config = { get: (key: string) => (key === "hmrc.scopes" ? ["read:vat"] : key === "hmrc.clientId" ? "app-1" : "sandbox") };
  const audit = { record: jest.fn() };
  const webhooks = { emit: jest.fn() };
  const notifications = { notify: jest.fn() };

  const service = new MtdConnectionService(
    prisma as never,
    clients as never,
    crypto as never,
    oauth as never,
    config as never,
    audit as never,
    webhooks as never,
    notifications as never,
  );

  it("starts HMRC authorisation with a persisted state", async () => {
    const result = await service.startAuth(user, client.id);
    expect(result.redirectUrl).toContain("hmrc.test");
    expect(prisma.oauthState.create).toHaveBeenCalled();
  });

  it("stores encrypted tokens on callback", async () => {
    prisma.oauthState.findUnique.mockResolvedValue({
      id: "st1",
      clientId: client.id,
      environment: "SANDBOX",
      expiresAt: new Date(Date.now() + 60_000),
    });
    prisma.mtdConnection.upsert.mockResolvedValue({ tokenExpiresAt: new Date(), scopes: ["read:vat"] });
    prisma.client.findUnique.mockResolvedValue(client);

    const result = await service.handleCallback({ code: "abc", state: "state-1" });
    expect(result.connected).toBe(true);
    expect(crypto.encrypt).toHaveBeenCalledWith("access");
    expect(webhooks.emit).toHaveBeenCalledWith("firm-1", "MTD_CONNECTION_CREATED", expect.any(Object));
  });
});
