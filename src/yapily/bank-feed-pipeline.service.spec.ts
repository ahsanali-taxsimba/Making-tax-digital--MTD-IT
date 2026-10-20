import { PIPELINE_CATEGORISE_APPLY, PIPELINE_MATCH_APPLY, BankFeedPipelineService } from "./bank-feed-pipeline.service";

describe("BankFeedPipelineService", () => {
  const yapily = {
    status: jest.fn(),
    syncAccounts: jest.fn(),
    syncBalance: jest.fn(),
    syncTransactions: jest.fn(),
    getAccount: jest.fn(),
  };
  const repo = { listClientBankAccounts: jest.fn() };
  const books = { createReconciliation: jest.fn() };
  const categorisation = { suggest: jest.fn(), apply: jest.fn() };
  const matching = { suggestions: jest.fn(), apply: jest.fn() };
  const bank = { summary: jest.fn() };
  const reports = { vatSummary: jest.fn(), itsaSummary: jest.fn() };
  const audit = { record: jest.fn() };
  const service = new BankFeedPipelineService(
    yapily as never,
    repo as never,
    books as never,
    categorisation as never,
    matching as never,
    bank as never,
    reports as never,
    audit as never,
  );
  const actor = { id: "u1", role: "ADMIN", firmId: "f1", clientId: null, name: "Priya", email: "p" } as never;
  const account = {
    id: "ba1",
    clientId: "c1",
    provider: "yapily",
    externalId: "yap-1",
    externalAccountId: "yap-1",
    name: "Studio",
    sortCode: "20-45-67",
    accountNumber: "12345678",
    currency: "GBP",
    balance: 4120,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    yapily.status.mockResolvedValue({ connected: true, status: "AUTHORISED", clientId: "c1" });
    yapily.syncAccounts.mockResolvedValue([account]);
    yapily.syncBalance.mockResolvedValue({ ...account, balanceType: "CLOSING" });
    yapily.syncTransactions.mockResolvedValue({
      account,
      transactions: [
        { id: "t-inv", enrichment: { merchantName: "Brighton Gallery Ltd" }, status: "unmatched" },
        { id: "t-bp", enrichment: { merchantName: "BP" }, status: "unmatched" },
      ],
      suggestions: [],
    });
    matching.suggestions.mockResolvedValue({
      count: 1,
      suggestions: [
        { id: "m1", status: "SUGGESTED", confidence: 0.95, bankTransactionId: "t-inv", documentKind: "invoice" },
        { id: "m-low", status: "SUGGESTED", confidence: 0.5, bankTransactionId: "t-other" },
      ],
    });
    matching.apply.mockResolvedValue({ suggestion: { id: "m1", status: "APPLIED" }, journal: { id: "j-match" } });
    categorisation.suggest.mockResolvedValue({
      count: 1,
      suggestions: [
        { id: "c1", status: "SUGGESTED", confidence: 0.99, bankTransactionId: "t-bp" },
        { id: "c-low", status: "SUGGESTED", confidence: 0.4, bankTransactionId: "t-fee" },
      ],
    });
    categorisation.apply.mockResolvedValue({ suggestion: { id: "c1", status: "APPLIED" }, journal: { id: "j-cat" } });
    books.createReconciliation.mockResolvedValue({ id: "sess-1" });
    bank.summary.mockResolvedValue({ unmatchedCount: 1, remainingCount: 1, matchedCount: 2 });
    reports.vatSummary.mockResolvedValue({
      period: { start: "2026-01-01", end: "2026-12-31" },
      boxes: { box1: 1200, box4: 200, box6: 6000, box7: 1000 },
    });
    reports.itsaSummary.mockResolvedValue({
      period: { start: "2026-01-01", end: "2026-12-31" },
      incomes: { turnover: 6000 },
      expenses: { advertisingAndBusinessPromotion: 1000 },
      quarterly: { incomes: { turnover: 6000 } },
    });
  });

  it("runs consent, sync, enrich, match, categorise, reconcile and VAT/ITSA mapping", async () => {
    const result = await service.run(actor, { clientId: "c1", from: "2026-01-01", to: "2026-06-30" });
    expect(result.steps).toEqual([
      "consent",
      "accounts",
      "transactions",
      "enrichment",
      "matching",
      "categorisation",
      "reconciliation",
      "journals",
      "vat_itsa",
    ]);
    expect(yapily.syncAccounts).toHaveBeenCalledWith(actor, "c1");
    expect(yapily.syncTransactions).toHaveBeenCalledWith(actor, "ba1", { from: "2026-01-01", to: "2026-06-30" });
    expect(result.enrichment.enriched).toBe(2);
    expect(result.matching.count).toBe(1);
    expect(result.categorisation.count).toBe(1);
    expect(result.matching.applied).toEqual([]);
    expect(result.journals.posted).toBe(0);
    expect(result.vat.box1).toBe(1200);
    expect(result.vat.box6).toBe(6000);
    expect(result.itsa.incomes.turnover).toBe(6000);
    expect(result.reconciliation[0].sessionId).toBe("sess-1");
    expect(matching.apply).not.toHaveBeenCalled();
    expect(categorisation.apply).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ actionType: "yapily.pipeline.ran" }));
  });

  it("auto-posts only high-confidence matches and categorisations", async () => {
    const result = await service.run(actor, { clientId: "c1", autoPost: true });
    expect(matching.apply).toHaveBeenCalledTimes(1);
    expect(matching.apply).toHaveBeenCalledWith(actor, { suggestionId: "m1" });
    expect(categorisation.apply).toHaveBeenCalledTimes(1);
    expect(categorisation.apply).toHaveBeenCalledWith(actor, { suggestionId: "c1" });
    expect(result.autoPost).toEqual({ posted: 1, matched: 1 });
    expect(result.journals.posted).toBe(2);
    expect(PIPELINE_MATCH_APPLY).toBe(0.8);
    expect(PIPELINE_CATEGORISE_APPLY).toBe(0.85);
  });

  it("resolves clientId from a bank account when syncing a single feed", async () => {
    yapily.getAccount.mockResolvedValue({ id: "ba1", clientId: "c1" });
    await service.run(actor, { bankAccountId: "ba1", autoMatch: false, autoCategorise: false });
    expect(yapily.syncAccounts).toHaveBeenCalledWith(actor, "c1");
    expect(matching.suggestions).not.toHaveBeenCalled();
    expect(categorisation.suggest).not.toHaveBeenCalled();
  });

  it("returns consent and reconciliation status without mutating feeds", async () => {
    repo.listClientBankAccounts.mockResolvedValue([account]);
    const status = await service.status(actor, { clientId: "c1" });
    expect(status.consent.connected).toBe(true);
    expect(status.accounts[0].externalAccountId).toBe("yap-1");
    expect(yapily.syncAccounts).not.toHaveBeenCalled();
  });
});
