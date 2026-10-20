import { BankTxnStatus } from "@prisma/client";
import { BK_ERR } from "./bookkeeping.errors";
import { BankService } from "./bank.service";

describe("BankService reconciliation actions", () => {
  const repo = {
    listBankAccounts: jest.fn(),
    countTransactionsByStatus: jest.fn(),
    findBankAccount: jest.fn(),
    listBankTransactions: jest.fn(),
    listJournals: jest.fn(),
    findJournal: jest.fn(),
    findBankTransaction: jest.fn(),
    updateBankTransaction: jest.fn(),
    listLedgers: jest.fn(),
  };
  const clients = { get: jest.fn() };
  const journals = { post: jest.fn() };
  const audit = { record: jest.fn() };
  const service = new BankService(repo as never, clients as never, journals as never, audit as never);
  const actor = { id: "u1", role: "ADMIN", firmId: "f1", clientId: null, name: "Priya", email: "p" } as never;

  const txn = {
    id: "t1",
    bankAccountId: "ba1",
    date: new Date("2026-03-18"),
    amount: 40,
    type: "DEBIT",
    description: "Unmatched bank fee",
    status: BankTxnStatus.UNMATCHED,
    bankAccount: { id: "ba1", clientId: "c1", ledgerId: "L-1200" },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    clients.get.mockResolvedValue({ id: "c1", firmId: "f1", type: "INDIVIDUAL" });
  });

  it("matches an unmatched line to a client journal", async () => {
    repo.findBankTransaction.mockResolvedValue(txn);
    repo.findJournal.mockResolvedValue({ id: "j1", clientId: "c1", description: "Bank fee" });
    repo.updateBankTransaction.mockResolvedValue({ ...txn, status: BankTxnStatus.MATCHED, matchedJournalEntryId: "j1" });
    const result = await service.matchOne(actor, { bankTransactionId: "t1", journalEntryId: "j1" });
    expect(result.transaction.status).toBe("MATCHED");
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ actionType: "bookkeeping.reconciliation.matched" }));
  });

  it("ignores a bank line", async () => {
    repo.findBankTransaction.mockResolvedValue(txn);
    repo.updateBankTransaction.mockResolvedValue({ ...txn, status: BankTxnStatus.IGNORED });
    const result = await service.ignoreOne(actor, { bankTransactionId: "t1" });
    expect(result.transaction.status).toBe("IGNORED");
  });

  it("refuses to match a line that is already matched", async () => {
    repo.findBankTransaction.mockResolvedValue({ ...txn, status: BankTxnStatus.MATCHED });
    await expect(service.matchOne(actor, { bankTransactionId: "t1", journalEntryId: "j1" })).rejects.toMatchObject({
      code: BK_ERR.ALREADY_MATCHED,
    });
  });
});
