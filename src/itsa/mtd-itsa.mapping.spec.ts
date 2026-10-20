import { ChartProfile } from "@prisma/client";
import { chartProfileForBusinessType, lookupItsaMapping, MTD_ITSA_MAPPING } from "./mtd-itsa.mapping";

describe("MTD ITSA mapping", () => {
  it("maps sole-trader turnover codes onto one HMRC box", () => {
    const first = lookupItsaMapping(ChartProfile.SOLE_TRADER, 1000);
    const cash = lookupItsaMapping(ChartProfile.SOLE_TRADER, 1010);
    expect(first?.category).toBe("Turnover");
    expect(first?.hmrcKey).toBe("turnover");
    expect(cash?.hmrcKey).toBe("turnover");
    expect(first?.includedInQuarterlyUpdate).toBe(true);
  });

  it("keeps capital and disallowable items out of quarterly updates", () => {
    expect(lookupItsaMapping(ChartProfile.SOLE_TRADER, 4000)?.includedInQuarterlyUpdate).toBe(false);
    expect(lookupItsaMapping(ChartProfile.SOLE_TRADER, 4300)?.bucket).toBe("business_expenses_disallowable");
    expect(lookupItsaMapping(ChartProfile.SOLE_TRADER, 4300)?.includedInQuarterlyUpdate).toBe(false);
  });

  it("maps landlord codes onto property boxes, including restricted interest", () => {
    const rent = lookupItsaMapping(ChartProfile.LANDLORD, 2000);
    const interest = lookupItsaMapping(ChartProfile.LANDLORD, 3020);
    expect(rent?.category).toBe("UK Property Income");
    expect(interest?.category).toBe("Loan Interest (Restricted)");
    expect(interest?.includedInQuarterlyUpdate).toBe(true);
  });

  it("does not use company VAT control as a sole-trader disallowable", () => {
    expect(lookupItsaMapping(ChartProfile.COMPANY, 4400)).toBeUndefined();
  });

  it("selects landlord mapping for property businesses", () => {
    expect(chartProfileForBusinessType("uk-property")).toBe(ChartProfile.LANDLORD);
    expect(chartProfileForBusinessType("self-employment")).toBe(ChartProfile.SOLE_TRADER);
  });

  it("covers every published bucket", () => {
    expect(Object.keys(MTD_ITSA_MAPPING)).toEqual([
      "business_income",
      "business_expenses_allowable",
      "business_expenses_disallowable",
      "capital_items",
      "property_income",
      "property_expenses",
    ]);
  });
});
