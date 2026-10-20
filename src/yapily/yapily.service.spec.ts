import { YapilyConsentStatus } from "@prisma/client";
import { YapilyError } from "./yapily.errors";
import { YapilyService } from "./yapily.service";

describe("YapilyService", () => {
  const repo = {
    upsertConnection: jest.fn(),
    findConnection: jest.fn(),
    findConnectionById: jest.fn(),
    findConnectionByState: jest.fn(),
    findBankAccount: jest.fn(),
    findBankAccountByNumbers: jest.fn(),
    findBankAccountById: jest.fn(),
    createBankAccount: jest.fn(),
    updateBankAccount: jest.fn(),
    findTransaction: jest.fn(),
    createTransaction: jest.fn(),
    updateTransaction: jest.fn(),
    listTransactions: jest.fn(),
  };
  const clients = { get: jest.fn() };
  const crypto = { encrypt: jest.fn((value: string) => `enc:${value}`), decrypt: jest.fn((value: string) => value.replace(/^enc:/, "")) };
  const audit = { record: jest.fn() };
  const config = { get: jest.fn((key: string) => (key === "yapily.mode" ? "mock" : key === "yapily.defaultInstitution" ? "modelo-sandbox" : "http://localhost:3000/yapily/consent/callback")) };
  const bank = { transactions: jest.fn() };
  const gateway = {
    createAuthRequest: jest.fn(),
    listAccounts: jest.fn(),
    listTransactions: jest.fn(),
    getBalance: jest.fn(),
  };
  const service = new YapilyService(
    repo as never,
    clients as never,
    crypto as never,
    audit as never,
    config as never,
    bank as never,
    gateway as never,
  );
  const actor = { id: "u1", role: "ADMIN", firmId: "f1", clientId: null, name: "Priya", email: "p" } as never;

  beforeEach(() => {
    jest.clearAllMocks();
    clients.get.mockResolvedValue({ id: "c1", firmId: "f1", type: "INDIVIDUAL" });
  });

  it("starts consent without exposing a token", async () => {
    gateway.createAuthRequest.mockResolvedValue({
      authorisationUrl: "https://mock-yapily.local/auth",
      consentId: "consent-1",
      applicationUserId: "f1:c1",
      institutionId: "modelo-sandbox",
      mode: "mock",
    });
    repo.upsertConnection.mockResolvedValue({ id: "conn-1" });
    const started = await service.startConsent(actor, { clientId: "c1" });
    expect(started.authorizationUrl).toMatch(/state=[0-9a-f]{48}/);
    expect(started).not.toHaveProperty("consentToken");
    expect(JSON.stringify(started)).not.toContain("enc:");
  });

  it("encrypts the callback token and returns a public connection", async () => {
    repo.findConnectionByState.mockResolvedValue({
      id: "conn-1",
      clientId: "c1",
      institutionId: "modelo-sandbox",
      applicationUserId: "f1:c1",
      consentId: "consent-1",
    });
    repo.upsertConnection.mockResolvedValue({
      id: "conn-1",
      clientId: "c1",
      institutionId: "modelo-sandbox",
      status: YapilyConsentStatus.AUTHORISED,
      expiresAt: new Date("2026-12-01"),
      createdAt: new Date(),
      updatedAt: new Date(),
      consentTokenEnc: "enc:secret",
    });
    const result = await service.handleCallback({ state: "conn-1", consent: "secret-token" });
    expect(crypto.encrypt).toHaveBeenCalledWith("secret-token");
    expect(result).not.toHaveProperty("consentTokenEnc");
    expect(result.status).toBe(YapilyConsentStatus.AUTHORISED);
  });

  it("syncs accounts into BankAccount rows", async () => {
    repo.findConnection.mockResolvedValue({
      status: YapilyConsentStatus.AUTHORISED,
      consentTokenEnc: "enc:token",
      expiresAt: new Date(Date.now() + 86400000),
    });
    gateway.listAccounts.mockResolvedValue([
      { id: "yap-1", name: "Studio", sortCode: "20-45-67", accountNumber: "12345678", currency: "GBP", balance: 100 },
    ]);
    repo.findBankAccount.mockResolvedValue(null);
    repo.findBankAccountByNumbers.mockResolvedValue(null);
    repo.createBankAccount.mockResolvedValue({
      id: "ba1",
      clientId: "c1",
      name: "Studio",
      externalId: "yap-1",
      provider: "yapily",
      currency: "GBP",
      balance: 100,
      createdAt: new Date(),
    });
    const accounts = await service.syncAccounts(actor, "c1");
    expect(accounts[0].externalAccountId).toBe("yap-1");
    expect(accounts[0].balance).toBe(100);
    expect(repo.createBankAccount).toHaveBeenCalled();
  });

  it("refuses to fetch accounts without consent", async () => {
    repo.findConnection.mockResolvedValue(null);
    await expect(service.syncAccounts(actor, "c1")).rejects.toBeInstanceOf(YapilyError);
  });
});
