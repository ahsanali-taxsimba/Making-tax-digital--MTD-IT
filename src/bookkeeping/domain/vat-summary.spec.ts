import { ChartProfile } from "@prisma/client";
import { LedgerSnapshot } from "./journal.rules";
import { vatSummaryFromJournals } from "./vat-summary";

const ledger = (code: number, type: string, name: string, profile = ChartProfile.SOLE_TRADER): LedgerSnapshot => ({
  id: `${profile}-${code}`,
  clientId: "c1",
  isActive: true,
  type,
  code,
  name,
  profile,
  category: type === "INCOME" ? "Income" : type === "EXPENSE" ? "Expenses" : "VAT",
});

describe("VAT summary from journals", () => {
  it("fills boxes 1, 4, 6 and 7 from tax-coded sales and purchases", () => {
    const summary = vatSummaryFromJournals([
      {
        ledger: ledger(1000, "INCOME", "Sales"),
        debit: 0,
        credit: 6000,
        tax: { id: "S", code: "S", name: "Standard", rate: 20, type: "VAT_STANDARD" },
      },
      { ledger: ledger(2200, "LIABILITY", "VAT on Sales"), debit: 0, credit: 1200 },
      {
        ledger: ledger(3000, "EXPENSE", "Advertising"),
        debit: 1000,
        credit: 0,
        tax: { id: "S", code: "S", name: "Standard", rate: 20, type: "VAT_STANDARD" },
      },
      { ledger: ledger(2220, "LIABILITY", "VAT on Purchases"), debit: 200, credit: 0 },
    ]);

    expect(summary.boxes).toEqual({ box1: 1200, box4: 200, box6: 6000, box7: 1000 });
    expect(summary.totals.totalVatDue).toBe(1200);
    expect(summary.totals.netVatDue).toBe(1000);
  });
});
