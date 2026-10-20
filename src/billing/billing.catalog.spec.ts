import { DEFAULT_BILLING_PLANS, vatPence } from "./billing.catalog";

describe("billing catalog", () => {
  it("seeds four commercial products with UK VAT exclusive pricing", () => {
    expect(DEFAULT_BILLING_PLANS.map((plan) => plan.slug)).toEqual([
      "ledger-lite",
      "ledger-pro",
      "practice-start",
      "practice-growth",
    ]);
    const lite = DEFAULT_BILLING_PLANS[0];
    const growth = DEFAULT_BILLING_PLANS[3];
    expect(lite.unitAmountPence).toBe(600);
    expect(growth.unitAmountPence).toBe(400);
    expect(growth.minQuantity).toBe(26);
    expect(vatPence(600, 20, false)).toEqual({ netPence: 600, taxPence: 120, totalPence: 720 });
    expect(vatPence(1000, 20, true).totalPence).toBe(1000);
  });
});
