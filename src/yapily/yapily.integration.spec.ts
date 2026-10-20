import { MockYapilyGateway } from "./yapily.mock";

describe("MockYapilyGateway", () => {
  const gateway = new MockYapilyGateway();

  it("returns a mock authorisation URL", async () => {
    const started = await gateway.createAuthRequest({
      applicationUserId: "firm:client",
      institutionId: "modelo-sandbox",
      callback: "http://localhost:3000/yapily/consent/callback",
    });
    expect(started.mode).toBe("mock");
    expect(started.authorisationUrl).toContain("mock-yapily.local");
  });

  it("returns canned UK accounts, transactions and a balance", async () => {
    const accounts = await gateway.listAccounts("token");
    const txns = await gateway.listTransactions("token", accounts[0].id, "2026-01-01", "2026-06-01");
    const balance = await gateway.getBalance("token", accounts[0].id);
    expect(accounts[0].sortCode).toBe("20-45-67");
    expect(txns.some((row) => row.merchantName === "Brighton Gallery Ltd")).toBe(true);
    expect(balance.balance).toBe(4120);
  });
});
