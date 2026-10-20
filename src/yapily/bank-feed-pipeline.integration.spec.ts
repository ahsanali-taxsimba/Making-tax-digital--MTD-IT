import { BankFeedPipelineService } from "./bank-feed-pipeline.service";

describe("bank feed pipeline integration", () => {
  it("posts invoice settlement before leftover categorisation journals", async () => {
    const order: string[] = [];
    const yapily = {
      status: jest.fn().mockResolvedValue({ connected: true, status: "AUTHORISED" }),
      syncAccounts: jest.fn().mockResolvedValue([{ id: "ba1", clientId: "c1" }]),
      syncBalance: jest.fn().mockResolvedValue({ id: "ba1", balance: 100 }),
      syncTransactions: jest.fn().mockImplementation(async () => {
        order.push("sync");
        return { account: { id: "ba1" }, transactions: [{ id: "t1", enrichment: {} }], suggestions: [] };
      }),
    };
    const matching = {
      suggestions: jest.fn().mockImplementation(async () => {
        order.push("match-suggest");
        return { count: 1, suggestions: [{ id: "m1", status: "SUGGESTED", confidence: 0.99 }] };
      }),
      apply: jest.fn().mockImplementation(async () => {
        order.push("match-apply");
        return { suggestion: { id: "m1", status: "APPLIED" } };
      }),
    };
    const categorisation = {
      suggest: jest.fn().mockImplementation(async () => {
        order.push("cat-suggest");
        return { count: 1, suggestions: [{ id: "c1", status: "SUGGESTED", confidence: 0.99 }] };
      }),
      apply: jest.fn().mockImplementation(async () => {
        order.push("cat-apply");
        return { suggestion: { id: "c1", status: "APPLIED" } };
      }),
    };
    const books = { createReconciliation: jest.fn().mockResolvedValue({ id: "s1" }) };
    const bank = { summary: jest.fn().mockResolvedValue({ unmatchedCount: 0 }) };
    const reports = {
      vatSummary: jest.fn().mockImplementation(async () => {
        order.push("vat");
        return { period: {}, boxes: { box1: 0, box4: 0, box6: 0, box7: 0 } };
      }),
      itsaSummary: jest.fn().mockImplementation(async () => {
        order.push("itsa");
        return { period: {}, incomes: {}, expenses: {}, quarterly: {} };
      }),
    };
    const service = new BankFeedPipelineService(
      yapily as never,
      { listClientBankAccounts: jest.fn() } as never,
      books as never,
      categorisation as never,
      matching as never,
      bank as never,
      reports as never,
      { record: jest.fn() } as never,
    );

    await service.run({ id: "u1" } as never, { clientId: "c1", autoPost: true });
    expect(order).toEqual(["sync", "match-suggest", "match-apply", "cat-suggest", "cat-apply", "vat", "itsa"]);
  });
});
