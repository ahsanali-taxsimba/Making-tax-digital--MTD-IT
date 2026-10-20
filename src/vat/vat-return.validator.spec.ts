import { toVatReturnView, validateVatReturn, VAT_ISSUE_CODE } from "./vat-return.validator";

const gb = { region: "GB" as const };
const ni = { region: "NI" as const };

function boxes(overrides: Partial<Parameters<typeof validateVatReturn>[0]> = {}) {
  return {
    box1: 1200,
    box2: 0,
    box3: 1200,
    box4: 200,
    box5: 1000,
    box6: 6000,
    box7: 1000,
    box8: 0,
    box9: 0,
    ...overrides,
  };
}

describe("validateVatReturn", () => {
  it("accepts a consistent standard-rated return", () => {
    expect(validateVatReturn(boxes(), { transactionCount: 4 }, gb)).toEqual({
      valid: true,
      errors: [],
      warnings: [],
      issues: [],
    });
  });

  it("requires box 3 to equal box 1 + box 2", () => {
    const result = validateVatReturn(boxes({ box3: 900 }), { transactionCount: 1 }, gb);
    expect(result.valid).toBe(false);
    expect(result.issues[0]?.code).toBe(VAT_ISSUE_CODE.VAT_ERR_ARITHMETIC);
    expect(result.errors).toContain("Box 3 must equal Box 1 + Box 2.");
  });

  it("requires box 5 to equal box 3 - box 4, or the HMRC absolute net", () => {
    const wrong = validateVatReturn(boxes({ box5: 50 }), { transactionCount: 1 }, gb);
    expect(wrong.issues.map((issue) => issue.code)).toContain(VAT_ISSUE_CODE.VAT_ERR_ARITHMETIC);

    const repaymentSigned = validateVatReturn(boxes({ box1: 100, box3: 100, box4: 400, box5: -300, box7: 2000 }), { transactionCount: 1 }, gb);
    expect(repaymentSigned.valid).toBe(true);

    const repaymentHmrc = validateVatReturn(boxes({ box1: 100, box3: 100, box4: 400, box5: 300, box7: 2000 }), { transactionCount: 1 }, gb);
    expect(repaymentHmrc.valid).toBe(true);
  });

  it("rejects negative source boxes but allows a signed box 5", () => {
    const result = validateVatReturn(boxes({ box1: -10, box3: -10, box5: -210 }), { transactionCount: 1 }, gb);
    expect(result.issues.map((issue) => issue.code)).toContain(VAT_ISSUE_CODE.VAT_ERR_NEGATIVE);
    expect(result.errors).toContain("Box 1 cannot be negative.");
    expect(result.errors.some((error) => error.includes("Box 5"))).toBe(false);
  });

  it("warns when output or input VAT exceeds 20% of the net box", () => {
    const output = validateVatReturn(boxes({ box1: 1400, box3: 1400, box5: 1200 }), { transactionCount: 1 }, gb);
    expect(output.issues[0]?.code).toBe(VAT_ISSUE_CODE.VAT_WARN_OUTPUT_VAT_HIGH);

    const input = validateVatReturn(boxes({ box4: 400, box5: 800 }), { transactionCount: 1 }, gb);
    expect(input.issues.map((issue) => issue.code)).toContain(VAT_ISSUE_CODE.VAT_WARN_INPUT_VAT_HIGH);
  });

  it("warns on EU acquisition and non-NI supply mismatches", () => {
    const eu = validateVatReturn(boxes({ box2: 80, box3: 1280, box5: 1080 }), { transactionCount: 1 }, gb);
    expect(eu.issues[0]?.code).toBe(VAT_ISSUE_CODE.VAT_WARN_EU_INCONSISTENT);

    const supplies = validateVatReturn(boxes({ box8: 500 }), { transactionCount: 1 }, gb);
    expect(supplies.issues[0]?.code).toBe(VAT_ISSUE_CODE.VAT_WARN_EU_INCONSISTENT);

    const niSupplies = validateVatReturn(boxes({ box8: 500 }), { transactionCount: 1 }, ni);
    expect(niSupplies.warnings).toEqual([]);
  });

  it("errors when the return is zero but the ledger has transactions", () => {
    const zero = {
      box1: 0,
      box2: 0,
      box3: 0,
      box4: 0,
      box5: 0,
      box6: 0,
      box7: 0,
      box8: 0,
      box9: 0,
    };
    const result = validateVatReturn(zero, { transactionCount: 3 }, gb);
    expect(result.issues[0]?.code).toBe(VAT_ISSUE_CODE.VAT_ERR_ZERO_RETURN_INVALID);
    expect(validateVatReturn(zero, { transactionCount: 0 }, gb).valid).toBe(true);
  });

  it("errors when submitted dates do not match the HMRC obligation", () => {
    const result = validateVatReturn(
      boxes(),
      { transactionCount: 1 },
      gb,
      {
        obligation: { periodKey: "26A1", start: "2026-01-01", end: "2026-03-31" },
        submitted: { periodKey: "26A1", periodStart: "2025-01-01", periodEnd: "2025-03-31" },
      },
    );
    expect(result.issues.map((issue) => issue.code)).toContain(VAT_ISSUE_CODE.VAT_ERR_PERIOD_MISMATCH);
  });

  it("maps HMRC field names onto box1-9", () => {
    expect(toVatReturnView({
      vatDueSales: 1,
      vatDueAcquisitions: 2,
      totalVatDue: 3,
      vatReclaimedCurrPeriod: 4,
      netVatDue: 1,
      totalValueSalesExVAT: 6,
      totalValuePurchasesExVAT: 7,
      totalAcquisitionsExVAT: 9,
      totalValueGoodsSuppliedExVAT: 8,
    })).toEqual({
      box1: 1,
      box2: 2,
      box3: 3,
      box4: 4,
      box5: 1,
      box6: 6,
      box7: 7,
      box8: 8,
      box9: 9,
    });
  });
});
