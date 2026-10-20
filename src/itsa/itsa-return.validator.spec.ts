import { ChartProfile } from "@prisma/client";
import {
  ITSA_ISSUE_CODE,
  validateItsaEops,
  validateItsaFinalDeclaration,
  validateItsaQuarterlyUpdate,
  validateItsaYear,
} from "./itsa-return.validator";

describe("ITSA validation engine", () => {
  it("accepts mapped sole-trader turnover and office costs", () => {
    const result = validateItsaQuarterlyUpdate(
      { incomes: { turnover: 5000 }, expenses: { officeCosts: 250 }, transactionCount: 2 },
      ChartProfile.SOLE_TRADER,
    );
    expect(result).toEqual({ valid: true, errors: [], warnings: [], issues: [] });
  });

  it("rejects unknown and capital categories", () => {
    const unknown = validateItsaQuarterlyUpdate(
      { incomes: { mystery: 10 }, expenses: {}, transactionCount: 1 },
      ChartProfile.SOLE_TRADER,
    );
    expect(unknown.issues[0]?.code).toBe(ITSA_ISSUE_CODE.ITSA_ERR_INVALID_CATEGORY);

    const capital = validateItsaQuarterlyUpdate(
      { incomes: {}, expenses: { capitalExpenditureNotInQuarterlyUpdate: 1200 }, transactionCount: 1 },
      ChartProfile.SOLE_TRADER,
    );
    expect(capital.issues[0]?.code).toBe(ITSA_ISSUE_CODE.ITSA_ERR_CAPITAL_ITEM_INCLUDED);
  });

  it("rejects a zero update when the ledger has activity", () => {
    const result = validateItsaQuarterlyUpdate(
      { incomes: {}, expenses: {}, transactionCount: 3 },
      ChartProfile.SOLE_TRADER,
    );
    expect(result.issues[0]?.code).toBe(ITSA_ISSUE_CODE.ITSA_ERR_ZERO_UPDATE_INVALID);
  });

  it("rejects period dates that do not match the obligation", () => {
    const result = validateItsaQuarterlyUpdate(
      { incomes: { turnover: 1 }, expenses: {}, transactionCount: 1 },
      ChartProfile.SOLE_TRADER,
      {
        obligation: { periodId: "2026-04-06_2026-07-05", start: "2026-04-06", end: "2026-07-05" },
        submitted: { periodId: "2026-04-06_2026-07-05", periodStart: "2025-04-06", periodEnd: "2025-07-05" },
      },
    );
    expect(result.issues.map((issue) => issue.code)).toContain(ITSA_ISSUE_CODE.ITSA_ERR_PERIOD_MISMATCH);
  });

  it("requires quarterly updates before EOPS and EOPS before the final declaration", () => {
    expect(validateItsaEops({ businessId: "b1", taxYear: "2025-26", quarterlyUpdateCount: 0 }).issues[0]?.code).toBe(
      ITSA_ISSUE_CODE.ITSA_ERR_PERIOD_MISMATCH,
    );
    expect(
      validateItsaFinalDeclaration({
        taxYear: "2025-26",
        businesses: [{ id: "b1", tradingName: "Studio" }],
        eopsBusinessIds: [],
      }).issues[0]?.code,
    ).toBe(ITSA_ISSUE_CODE.ITSA_ERR_MISSING_EOPS);
    expect(
      validateItsaYear({
        taxYear: "2025-26",
        businesses: [{ id: "b1", tradingName: "Studio" }],
        eopsBusinessIds: ["b1"],
        hasFinalDeclaration: false,
      }).issues[0]?.code,
    ).toBe(ITSA_ISSUE_CODE.ITSA_ERR_MISSING_FINAL_DECLARATION);
  });
});
