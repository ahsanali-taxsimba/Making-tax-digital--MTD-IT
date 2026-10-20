import { LedgerSnapshot } from "./journal.rules";
import { purchaseBillLines, salesInvoiceLines } from "./posting";

const ledger = (code: number, type: string, name: string): LedgerSnapshot => ({
  id: `L-${code}`,
  clientId: "c1",
  isActive: true,
  type,
  code,
  name,
  profile: "SOLE_TRADER",
  category: type === "INCOME" ? "Income" : type === "EXPENSE" ? "Expenses" : "Assets",
});

const accounts = [
  ledger(1000, "INCOME", "Sales"),
  ledger(3000, "EXPENSE", "Advertising"),
  ledger(1100, "ASSET", "Debtors"),
  ledger(2100, "LIABILITY", "Creditors"),
  ledger(2200, "LIABILITY", "VAT on Sales"),
  ledger(2220, "LIABILITY", "VAT on Purchases"),
];

const tax = [{ id: "S", code: "S", name: "Standard", rate: 20, type: "VAT_STANDARD" }];

describe("automatic postings", () => {
  it("posts a sales invoice to income, VAT and debtors", () => {
    const posted = salesInvoiceLines(
      [{ description: "Studio work", net: 6000, taxCodeId: "S" }],
      accounts,
      tax,
      "SOLE_TRADER",
    );
    expect(posted).toMatchObject({ netTotal: 6000, vatTotal: 1200, grossTotal: 7200 });
    expect(posted.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ledgerAccountId: "L-1100", debit: 7200 }),
        expect.objectContaining({ ledgerAccountId: "L-1000", credit: 6000, taxCodeId: "S" }),
        expect.objectContaining({ ledgerAccountId: "L-2200", credit: 1200 }),
      ]),
    );
  });

  it("posts a purchase bill to expenses, VAT and creditors", () => {
    const posted = purchaseBillLines(
      [{ description: "Ads", net: 1000, taxCodeId: "S" }],
      accounts,
      tax,
      "SOLE_TRADER",
    );
    expect(posted.grossTotal).toBe(1200);
    expect(posted.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ledgerAccountId: "L-3000", debit: 1000 }),
        expect.objectContaining({ ledgerAccountId: "L-2220", debit: 200 }),
        expect.objectContaining({ ledgerAccountId: "L-2100", credit: 1200 }),
      ]),
    );
  });
});
