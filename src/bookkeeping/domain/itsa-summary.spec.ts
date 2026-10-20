import { ChartProfile } from "@prisma/client";
import { LedgerSnapshot } from "./journal.rules";
import { itsaSummaryFromJournals } from "./itsa-summary";

const ledger = (code: number, type: string, name: string, profile: ChartProfile): LedgerSnapshot => ({
  id: `${profile}-${code}`,
  clientId: "c1",
  isActive: true,
  type,
  code,
  name,
  profile,
  category: type === "INCOME" ? "Income" : "Expenses",
});

describe("ITSA summary from journals", () => {
  const lines = [
    { ledger: ledger(1000, "INCOME", "Sales", ChartProfile.SOLE_TRADER), debit: 0, credit: 5000 },
    { ledger: ledger(3000, "EXPENSE", "Advertising", ChartProfile.SOLE_TRADER), debit: 250, credit: 0 },
    { ledger: ledger(4000, "CAPITAL", "Equipment", ChartProfile.SOLE_TRADER), debit: 800, credit: 0 },
    { ledger: ledger(4300, "EXPENSE", "Entertainment", ChartProfile.SOLE_TRADER), debit: 50, credit: 0 },
    { ledger: ledger(2000, "INCOME", "Rent", ChartProfile.LANDLORD), debit: 0, credit: 2000 },
    { ledger: ledger(3030, "EXPENSE", "Agent fees", ChartProfile.LANDLORD), debit: 150, credit: 0 },
  ];

  it("aggregates sole-trade income and allowable expenses", () => {
    const summary = itsaSummaryFromJournals(lines, "sole_trader");
    expect(summary.incomes.turnover).toBe(5000);
    expect(summary.expenses.advertisingAndBusinessPromotion).toBe(250);
    expect(summary.capital.capitalExpenditureNotInQuarterlyUpdate).toBe(800);
    expect(summary.disallowable.nonAllowableEntertainment).toBe(50);
    expect(summary.quarterly.incomes.turnover).toBe(5000);
  });

  it("aggregates property income separately", () => {
    const summary = itsaSummaryFromJournals(lines, "property");
    expect(summary.incomes.ukPropertyIncome).toBe(2000);
    expect(summary.expenses.agentFees).toBe(150);
  });
});
