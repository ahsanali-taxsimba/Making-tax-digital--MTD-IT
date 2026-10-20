import { JournalSource } from "@prisma/client";
import { JournalPostingService } from "./journal-posting.service";

describe("JournalPostingService", () => {
  const books = { listLedgers: jest.fn() };
  const journals = { post: jest.fn() };
  const service = new JournalPostingService(books as never, journals as never);
  const actor = { id: "u1", role: "ADMIN", firmId: "f1", clientId: null, name: "Priya", email: "p" } as never;

  const ledgers = [
    { id: "L-1200", clientId: "c1", isActive: true, type: "ASSET", code: 1200, name: "Bank", profile: "SOLE_TRADER", category: "Assets" },
    { id: "L-1100", clientId: "c1", isActive: true, type: "ASSET", code: 1100, name: "Debtors", profile: "SOLE_TRADER", category: "Assets" },
    { id: "L-2100", clientId: "c1", isActive: true, type: "LIABILITY", code: 2100, name: "Creditors", profile: "SOLE_TRADER", category: "Liabilities" },
  ];

  beforeEach(() => {
    books.listLedgers.mockResolvedValue(ledgers);
    journals.post.mockResolvedValue({ id: "j-settle" });
  });

  it("posts a bank receipt against debtors for an invoice match", async () => {
    await service.postSettlement(actor, {
      client: { id: "c1", firmId: "f1", type: "INDIVIDUAL" },
      txn: { date: "2026-01-16", amount: 7200, type: "CREDIT", description: "Brighton Gallery Ltd INV-1001" },
      document: {
        id: "inv-1",
        kind: "invoice",
        date: "2026-01-15",
        description: "Studio sales",
        reference: "INV-1001",
        partyName: "Brighton Gallery Ltd",
        grossTotal: 7200,
      },
      bankLedgerId: "L-1200",
    });
    expect(journals.post).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({
        source: JournalSource.BANK_FEED,
        reference: "MATCH-INV-1001",
        lines: [
          { ledgerAccountId: "L-1200", debit: 7200, credit: 0, description: "Match invoice INV-1001 Brighton Gallery Ltd" },
          { ledgerAccountId: "L-1100", debit: 0, credit: 7200, description: "Match invoice INV-1001 Brighton Gallery Ltd" },
        ],
      }),
    );
  });

  it("posts a bank payment against creditors for a bill match", async () => {
    await service.postSettlement(actor, {
      client: { id: "c1", firmId: "f1", type: "INDIVIDUAL" },
      txn: { date: "2026-02-10", amount: 1200, type: "DEBIT", description: "North Ads Agency BILL-88" },
      document: {
        id: "bill-1",
        kind: "bill",
        date: "2026-02-10",
        description: "Advertising",
        reference: "BILL-88",
        partyName: "North Ads Agency",
        grossTotal: 1200,
      },
    });
    expect(journals.post).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({
        reference: "MATCH-BILL-88",
        lines: [
          { ledgerAccountId: "L-2100", debit: 1200, credit: 0, description: "Match bill BILL-88 North Ads Agency" },
          { ledgerAccountId: "L-1200", debit: 0, credit: 1200, description: "Match bill BILL-88 North Ads Agency" },
        ],
      }),
    );
  });
});
