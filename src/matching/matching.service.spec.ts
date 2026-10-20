import { BankTxnStatus, ClientType, MatchingDocumentKind, MatchingStatus } from "@prisma/client";
import { BillLookupService } from "./bill-lookup.service";
import { ConfidenceScoringService } from "./confidence-scoring.service";
import { InvoiceLookupService } from "./invoice-lookup.service";
import { MATCH_ERR, MatchingError } from "./matching.errors";
import { MatchingService } from "./matching.service";

describe("MatchingService", () => {
  const repo = {
    findTransaction: jest.fn(),
    findBankAccount: jest.fn(),
    listTransactionsForAccount: jest.fn(),
    listTransactionsForClient: jest.fn(),
    listAppliedDocumentIds: jest.fn(),
    findSuggestion: jest.fn(),
    findSuggestionByTransaction: jest.fn(),
    upsertSuggestion: jest.fn(),
    markRejected: jest.fn(),
    markTransactionMatched: jest.fn(),
    listInvoices: jest.fn(),
    listBills: jest.fn(),
    findInvoice: jest.fn(),
    findBill: jest.fn(),
  };
  const clients = { get: jest.fn() };
  const posting = { postSettlement: jest.fn() };
  const audit = { record: jest.fn() };
  const invoices = new InvoiceLookupService(repo as never);
  const bills = new BillLookupService(repo as never);
  const service = new MatchingService(
    repo as never,
    clients as never,
    invoices,
    bills,
    new ConfidenceScoringService(),
    posting as never,
    audit as never,
  );
  const actor = { id: "u1", role: "ADMIN", firmId: "f1", clientId: null, name: "Priya", email: "p" } as never;
  const client = { id: "c1", firmId: "f1", type: ClientType.INDIVIDUAL };

  const invoiceRow = {
    id: "inv-1",
    date: new Date("2026-01-15"),
    status: "POSTED",
    grossTotal: 7200,
    journalId: "j-inv",
    customer: { name: "Brighton Gallery Ltd" },
    journal: { reference: "INV-1001", description: "Sales invoice INV-1001" },
    lines: [{ description: "Studio sales" }],
  };
  const txn = {
    id: "t-inv",
    date: new Date("2026-01-16"),
    amount: 7200,
    type: "CREDIT" as const,
    description: "Brighton Gallery Ltd INV-1001",
    merchantName: "Brighton Gallery Ltd",
    merchantCategoryCode: "4829",
    status: BankTxnStatus.UNMATCHED,
    bankAccount: { id: "ba1", clientId: "c1", ledgerId: "L-1200" },
    matching: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    clients.get.mockResolvedValue(client);
    repo.listAppliedDocumentIds.mockResolvedValue([]);
    repo.listInvoices.mockResolvedValue([invoiceRow]);
    repo.listBills.mockResolvedValue([]);
    repo.listTransactionsForAccount.mockResolvedValue([txn]);
    repo.listTransactionsForClient.mockResolvedValue([txn]);
    repo.findTransaction.mockResolvedValue(txn);
    repo.upsertSuggestion.mockImplementation(async (data: { bankTransactionId: string }) => ({
      id: "s1",
      status: MatchingStatus.SUGGESTED,
      bankTransactionId: data.bankTransactionId,
    }));
    repo.findInvoice.mockResolvedValue(invoiceRow);
  });

  it("persists a high-confidence invoice suggestion", async () => {
    const result = await service.suggestions(actor, { clientId: "c1" });
    expect(result.count).toBe(1);
    expect(result.suggestions[0]).toMatchObject({
      documentKind: "invoice",
      documentId: "inv-1",
      documentReference: "INV-1001",
      status: "SUGGESTED",
    });
    expect(result.suggestions[0].confidence).toBeGreaterThanOrEqual(0.8);
    expect(result.suggestions[0].reasons).toEqual(expect.arrayContaining(["exact_amount", "invoice_reference", "merchant"]));
    expect(repo.upsertSuggestion).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ actionType: "matching.suggested" }));
  });

  it("skips rejected suggestions when listing", async () => {
    repo.listTransactionsForClient.mockResolvedValue([{ ...txn, matching: { id: "s1", status: MatchingStatus.REJECTED } }]);
    await expect(service.suggestions(actor, { clientId: "c1" })).resolves.toEqual({ suggestions: [], count: 0 });
  });

  it("applies a suggestion and posts a settlement journal", async () => {
    posting.postSettlement.mockResolvedValue({ id: "j-settle" });
    repo.findSuggestion.mockResolvedValue({
      id: "s1",
      status: MatchingStatus.SUGGESTED,
      documentId: "inv-1",
      documentKind: MatchingDocumentKind.invoice,
      bankTransaction: txn,
      clientId: "c1",
    });
    repo.upsertSuggestion.mockResolvedValue({
      id: "s1",
      status: MatchingStatus.APPLIED,
      journalEntryId: "j-settle",
    });
    const result = await service.apply(actor, { suggestionId: "s1" });
    expect(posting.postSettlement).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({
        document: expect.objectContaining({ id: "inv-1", kind: "invoice" }),
        txn: expect.objectContaining({ amount: 7200, type: "CREDIT" }),
      }),
    );
    expect(repo.markTransactionMatched).toHaveBeenCalledWith("t-inv", "j-settle");
    expect(result.alreadyApplied).toBe(false);
    expect(result.journal).toEqual({ id: "j-settle" });
  });

  it("rejects a suggestion without matching the bank line", async () => {
    repo.findSuggestion.mockResolvedValue({
      id: "s1",
      status: MatchingStatus.SUGGESTED,
      documentId: "inv-1",
      documentKind: MatchingDocumentKind.invoice,
      documentReference: "INV-1001",
      partyName: "Brighton Gallery Ltd",
      confidence: 0.9,
      reasons: ["exact_amount"],
      signals: { exactAmount: true },
      bankTransaction: txn,
      bankTransactionId: txn.id,
      clientId: "c1",
    });
    repo.markRejected.mockResolvedValue({
      id: "s1",
      status: MatchingStatus.REJECTED,
      documentId: "inv-1",
      documentKind: MatchingDocumentKind.invoice,
      documentReference: "INV-1001",
      partyName: "Brighton Gallery Ltd",
      confidence: 0.9,
      reasons: ["exact_amount"],
      signals: { exactAmount: true },
    });
    const result = await service.reject(actor, { suggestionId: "s1" });
    expect(result.suggestion.status).toBe("REJECTED");
    expect(repo.markTransactionMatched).not.toHaveBeenCalled();
  });

  it("refuses to reject an applied match", async () => {
    repo.findSuggestion.mockResolvedValue({
      id: "s1",
      status: MatchingStatus.APPLIED,
      clientId: "c1",
      bankTransaction: txn,
    });
    await expect(service.reject(actor, { suggestionId: "s1" })).rejects.toMatchObject({
      errorCode: MATCH_ERR.ALREADY_APPLIED,
    });
    expect(repo.markRejected).not.toHaveBeenCalled();
  });

  it("throws when the transaction is missing", async () => {
    repo.findSuggestion.mockResolvedValue(null);
    repo.findTransaction.mockResolvedValue(null);
    await expect(service.apply(actor, { bankTransactionId: "missing" })).rejects.toBeInstanceOf(MatchingError);
  });
});
