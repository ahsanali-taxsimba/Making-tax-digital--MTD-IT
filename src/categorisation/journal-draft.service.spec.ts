import { ChartProfile, TaxCodeKind } from "@prisma/client";
import { LedgerSnapshot } from "../bookkeeping/domain/journal.rules";
import { JournalDraftService } from "./journal-draft.service";

const ledger = (code: number, type: string, name: string): LedgerSnapshot => ({
  id: `L-${code}`,
  clientId: "c1",
  isActive: true,
  type,
  code,
  name,
  profile: ChartProfile.SOLE_TRADER,
  category: type === "EXPENSE" ? "Expenses" : type === "ASSET" ? "Assets" : "VAT",
});

describe("JournalDraftService", () => {
  const service = new JournalDraftService();

  it("builds a VAT-aware payment draft", () => {
    const draft = service.build({
      txn: { date: "2026-03-06", amount: 23.4, type: "DEBIT", description: "TESCO STORES 2847", merchantName: "Tesco" },
      counterpart: ledger(3050, "EXPENSE", "Office Supplies"),
      ledgers: [
        ledger(1200, "ASSET", "Bank"),
        ledger(2220, "LIABILITY", "VAT on Purchases"),
        ledger(2200, "LIABILITY", "VAT on Sales"),
        ledger(3050, "EXPENSE", "Office Supplies"),
      ],
      profile: ChartProfile.SOLE_TRADER,
      tax: { id: "S", code: "S", name: "Standard", rate: 20, type: "VAT_STANDARD" },
      taxCodeKind: TaxCodeKind.VAT_STANDARD,
    });
    expect(draft.source).toBe("BANK_FEED");
    expect(draft.lines.some((line) => line.ledgerCode === 3050 && line.taxCode === "S")).toBe(true);
    expect(draft.lines.some((line) => line.ledgerCode === 1200 && line.credit === 23.4)).toBe(true);
  });
});
