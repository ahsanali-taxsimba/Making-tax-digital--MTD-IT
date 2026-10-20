import { ChartProfile } from "@prisma/client";
import { assertBalancedJournal, assertPeriodOpen, LedgerSnapshot } from "./domain/journal.rules";
import { itsaSummaryFromJournals } from "./domain/itsa-summary";
import { suggestMatches } from "./domain/matching.engine";
import { purchaseBillLines, salesInvoiceLines } from "./domain/posting";
import { profitAndLoss, trialBalance } from "./domain/reports";
import { vatSummaryFromJournals } from "./domain/vat-summary";
import { BK_ERR } from "./bookkeeping.errors";

const ledger = (code: number, type: string, name: string, profile = ChartProfile.SOLE_TRADER): LedgerSnapshot => ({
  id: `L-${code}`,
  clientId: "c1",
  isActive: true,
  type,
  code,
  name,
  profile,
  category: type === "INCOME" ? "Income" : type === "EXPENSE" ? "Expenses" : type === "ASSET" ? "Assets" : "Liabilities",
});

const accounts = [
  ledger(1000, "INCOME", "Sales"),
  ledger(3000, "EXPENSE", "Advertising"),
  ledger(1100, "ASSET", "Debtors"),
  ledger(2100, "LIABILITY", "Creditors"),
  ledger(1200, "ASSET", "Bank"),
  ledger(2200, "LIABILITY", "VAT on Sales"),
  ledger(2220, "LIABILITY", "VAT on Purchases"),
];
const tax = [{ id: "S", code: "S", name: "Standard", rate: 20, type: "VAT_STANDARD" }];

describe("bookkeeping integration", () => {
  it("posts invoices and bills, then rolls VAT, ITSA, trial balance and a bank match", () => {
    const invoice = salesInvoiceLines([{ description: "Studio", net: 6000, taxCodeId: "S" }], accounts, tax, "SOLE_TRADER");
    const bill = purchaseBillLines([{ description: "Ads", net: 1000, taxCodeId: "S" }], accounts, tax, "SOLE_TRADER");
    expect(assertBalancedJournal(invoice.lines).balanced).toBe(true);
    expect(assertBalancedJournal(bill.lines).balanced).toBe(true);

    const vat = vatSummaryFromJournals([
      ...invoice.lines.map((line) => ({
        ledger: accounts.find((account) => account.id === line.ledgerAccountId)!,
        debit: line.debit,
        credit: line.credit,
        tax: line.taxCodeId ? tax[0] : null,
      })),
      ...bill.lines.map((line) => ({
        ledger: accounts.find((account) => account.id === line.ledgerAccountId)!,
        debit: line.debit,
        credit: line.credit,
        tax: line.taxCodeId ? tax[0] : null,
      })),
    ]);
    expect(vat.boxes).toEqual({ box1: 1200, box4: 200, box6: 6000, box7: 1000 });

    const receipt = [
      { ledgerAccountId: "L-1200", debit: 5000, credit: 0 },
      { ledgerAccountId: "L-1000", debit: 0, credit: 5000, taxCodeId: "S" },
    ];
    const itsa = itsaSummaryFromJournals(
      receipt.map((line) => ({
        ledger: accounts.find((account) => account.id === line.ledgerAccountId)!,
        debit: line.debit,
        credit: line.credit,
      })),
      "sole_trader",
    );
    expect(itsa.incomes.turnover).toBe(5000);

    const rows = trialBalance(
      accounts,
      [
        ...invoice.lines.map((line) => ({ ...line, date: "2026-01-15" })),
        ...bill.lines.map((line) => ({ ...line, date: "2026-02-10" })),
      ],
      "2026-01-01",
      "2026-03-31",
    );
    expect(profitAndLoss(rows).totals).toEqual({ income: 6000, expenses: 1000, netProfit: 5000 });

    const matches = suggestMatches(
      [
        {
          id: "txn",
          date: "2026-01-15",
          amount: 7200,
          type: "CREDIT",
          description: "Studio invoice",
          status: "UNMATCHED",
        },
      ],
      [{ id: "j1", date: "2026-01-15", description: "Studio invoice", total: 7200 }],
    );
    expect(matches).toHaveLength(1);

    expect(() => assertPeriodOpen("2024-06-01", [{ start: "2024-04-06", end: "2025-04-05", locked: true }])).toThrow(
      expect.objectContaining({ code: BK_ERR.PERIOD_LOCKED }),
    );
  });
});
