import { BankTxnStatus, ChartProfile, TaxCodeKind } from "@prisma/client";
import { CAT_ERR, CategorisationError } from "./categorisation.errors";
import { CategorisationService } from "./categorisation.service";
import { MCC_MAPPING } from "./domain/mcc.mapping";
import { MERCHANT_DICTIONARY } from "./domain/merchant.dictionary";
import { ITSAInferenceService } from "./itsa-inference.service";
import { JournalDraftService } from "./journal-draft.service";
import { VATInferenceService } from "./vat-inference.service";

const ledger = (code: number, type: string, name: string) => ({
  id: `L-${code}`,
  clientId: "c1",
  isActive: true,
  type,
  code,
  name,
  profile: ChartProfile.SOLE_TRADER,
  category: type === "INCOME" ? "Income" : type === "EXPENSE" ? "Expenses" : type === "ASSET" ? "Assets" : "VAT",
});

const ledgers = [
  ledger(1000, "INCOME", "Sales"),
  ledger(1200, "ASSET", "Bank"),
  ledger(2200, "LIABILITY", "VAT on Sales"),
  ledger(2220, "LIABILITY", "VAT on Purchases"),
  ledger(3000, "EXPENSE", "Advertising"),
  ledger(3050, "EXPENSE", "Office Supplies"),
  ledger(3080, "EXPENSE", "Motor Expenses"),
  ledger(3090, "EXPENSE", "Travel"),
  ledger(3150, "EXPENSE", "Subscriptions"),
];

const taxCodes = [
  { id: "S", code: "S", name: "Standard", rate: 20, type: TaxCodeKind.VAT_STANDARD },
  { id: "NA", code: "NA", name: "No VAT", rate: 0, type: TaxCodeKind.NO_VAT },
];

describe("CategorisationService", () => {
  const repo = {
    findTransaction: jest.fn(),
    findBankAccount: jest.fn(),
    listTransactionsForAccount: jest.fn(),
    listTransactionsForClient: jest.fn(),
    upsertSuggestion: jest.fn(),
    findSuggestion: jest.fn(),
    findSuggestionByTransaction: jest.fn(),
    markApplied: jest.fn(),
    markTransactionMatched: jest.fn(),
    listMerchantRules: jest.fn(),
    listMccRules: jest.fn(),
  };
  const clients = { get: jest.fn() };
  const books = {
    listLedgers: jest.fn(),
    listTaxCodes: jest.fn(),
    listInvoices: jest.fn(),
    listBills: jest.fn(),
  };
  const journals = { post: jest.fn(), get: jest.fn() };
  const audit = { record: jest.fn() };
  const merchants = { list: jest.fn() };
  const mcc = { list: jest.fn() };
  const service = new CategorisationService(
    repo as never,
    clients as never,
    books as never,
    journals as never,
    audit as never,
    merchants as never,
    mcc as never,
    new VATInferenceService(),
    new ITSAInferenceService(),
    new JournalDraftService(),
  );
  const actor = { id: "u1", role: "ADMIN", firmId: "f1", clientId: null, name: "Priya", email: "p" } as never;

  const bpTxn = {
    id: "t-bp",
    date: new Date("2026-03-04"),
    amount: 55,
    type: "DEBIT",
    description: "BP CONNECT BRIGHTON",
    merchantName: "BP",
    merchantCategoryCode: "5541",
    transactionCategory: "fuel",
    category: "fuel",
    labels: ["motor"],
    status: BankTxnStatus.UNMATCHED,
    bankAccount: { id: "ba1", clientId: "c1" },
    categorisation: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    clients.get.mockResolvedValue({ id: "c1", firmId: "f1", type: "INDIVIDUAL" });
    merchants.list.mockResolvedValue(MERCHANT_DICTIONARY);
    mcc.list.mockResolvedValue(MCC_MAPPING);
    books.listLedgers.mockResolvedValue(ledgers);
    books.listTaxCodes.mockResolvedValue(taxCodes);
    books.listInvoices.mockResolvedValue([]);
    books.listBills.mockResolvedValue([]);
    repo.listTransactionsForAccount.mockResolvedValue([bpTxn]);
    repo.upsertSuggestion.mockImplementation(async (data: { bankTransactionId: string }) => ({
      id: "sug-1",
      status: "SUGGESTED",
      bankTransactionId: data.bankTransactionId,
    }));
  });

  it("suggests a ledger, VAT code, ITSA category and draft journal", async () => {
    repo.findTransaction.mockResolvedValue(bpTxn);
    const result = await service.suggest(actor, { bankTransactionId: "t-bp" });
    expect(result.count).toBe(1);
    expect(result.suggestions[0].suggestedLedger.code).toBe(3080);
    expect(result.suggestions[0].suggestedTaxCode.code).toBe("S");
    expect(result.suggestions[0].suggestedItsa.category).toBe("Motor Expenses");
    expect(result.suggestions[0].confidence).toBeGreaterThan(0.85);
    expect(result.suggestions[0].draftJournal.lines.length).toBeGreaterThanOrEqual(2);
    expect(repo.upsertSuggestion).toHaveBeenCalled();
  });

  it("applies a suggestion by posting a bank-feed journal and matching the transaction", async () => {
    repo.findSuggestion.mockResolvedValue({ id: "sug-1", status: "SUGGESTED", bankTransaction: bpTxn, appliedJournalEntryId: null });
    journals.post.mockResolvedValue({ id: "j-1", source: "BANK_FEED" });
    repo.upsertSuggestion.mockResolvedValue({ id: "sug-1", status: "APPLIED" });
    const applied = await service.apply(actor, { suggestionId: "sug-1" });
    expect(journals.post).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({
        clientId: "c1",
        source: "BANK_FEED",
        lines: expect.any(Array),
      }),
    );
    expect(repo.markTransactionMatched).toHaveBeenCalledWith("t-bp", "j-1");
    expect(applied.alreadyApplied).toBe(false);
    expect(applied.journal.id).toBe("j-1");
  });

  it("refuses to apply a transaction that is already matched", async () => {
    repo.findSuggestion.mockResolvedValue({
      id: "sug-1",
      status: "SUGGESTED",
      appliedJournalEntryId: null,
      bankTransaction: { ...bpTxn, status: BankTxnStatus.MATCHED, matchedJournalEntryId: "j-old" },
    });
    await expect(service.apply(actor, { suggestionId: "sug-1" })).rejects.toMatchObject({ errorCode: CAT_ERR.ALREADY_MATCHED });
    await expect(service.apply(actor, { suggestionId: "sug-1" })).rejects.toBeInstanceOf(CategorisationError);
  });

  it("returns merchant and MCC rules", async () => {
    const rules = await service.rules();
    expect(rules.merchants.some((rule) => rule.merchantName === "BP")).toBe(true);
    expect(rules.mcc.some((rule) => rule.mcc === "5812")).toBe(true);
    expect(rules.vat.vatableMccs).toContain("5812");
    expect(rules.vat.exemptMccs).toContain("6300");
  });
});
