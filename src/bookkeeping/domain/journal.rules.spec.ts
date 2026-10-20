import { BK_ERR, BookkeepingError } from "../bookkeeping.errors";
import {
  assertBalancedJournal,
  assertPeriodOpen,
  assertValidAccounts,
  classifyAccount,
  journalTotals,
  LedgerSnapshot,
  signedMovement,
} from "./journal.rules";

const account = (overrides: Partial<LedgerSnapshot> = {}): LedgerSnapshot => ({
  id: overrides.id ?? "acc-1",
  clientId: "client-1",
  isActive: true,
  type: "INCOME",
  code: 1000,
  name: "Sales",
  profile: "SOLE_TRADER",
  category: "Income",
  ...overrides,
});

describe("journal rules", () => {
  it("accepts a balanced two-line journal", () => {
    const totals = assertBalancedJournal([
      { ledgerAccountId: "bank", debit: 100, credit: 0 },
      { ledgerAccountId: "sales", debit: 0, credit: 100 },
    ]);
    expect(totals).toEqual({ debits: 100, credits: 100, balanced: true });
  });

  it("rejects an unbalanced journal with BK_ERR_UNBALANCED_JOURNAL", () => {
    try {
      assertBalancedJournal([
        { ledgerAccountId: "bank", debit: 100, credit: 0 },
        { ledgerAccountId: "sales", debit: 0, credit: 90 },
      ]);
      fail("expected error");
    } catch (error) {
      expect(error).toBeInstanceOf(BookkeepingError);
      expect((error as BookkeepingError).code).toBe(BK_ERR.UNBALANCED_JOURNAL);
    }
  });

  it("rejects posting to an inactive account", () => {
    expect(() =>
      assertValidAccounts(
        [{ ledgerAccountId: "acc-1", debit: 10, credit: 0 }],
        [account({ isActive: false })],
        "client-1",
      ),
    ).toThrow(BookkeepingError);
    try {
      assertValidAccounts(
        [{ ledgerAccountId: "acc-1", debit: 10, credit: 0 }],
        [account({ isActive: false })],
        "client-1",
      );
    } catch (error) {
      expect((error as BookkeepingError).code).toBe(BK_ERR.INVALID_ACCOUNT);
    }
  });

  it("rejects a locked period", () => {
    expect(() =>
      assertPeriodOpen("2025-01-10", [{ start: "2025-01-01", end: "2025-03-31", locked: true }]),
    ).toThrow(expect.objectContaining({ code: BK_ERR.PERIOD_LOCKED }));
  });

  it("allows posting when the period is open", () => {
    expect(() =>
      assertPeriodOpen("2025-01-10", [{ start: "2025-01-01", end: "2025-03-31", locked: false }]),
    ).not.toThrow();
  });

  it("signs asset debits and income credits as positive movement", () => {
    expect(signedMovement(account({ type: "ASSET", category: "Assets", code: 1200 }), 50, 0)).toBe(50);
    expect(signedMovement(account({ type: "INCOME", category: "Income", code: 1000 }), 0, 50)).toBe(50);
    expect(journalTotals([]).balanced).toBe(true);
    expect(classifyAccount(account({ type: "CAPITAL", code: 4000 }))).toBe("equity");
  });
});
