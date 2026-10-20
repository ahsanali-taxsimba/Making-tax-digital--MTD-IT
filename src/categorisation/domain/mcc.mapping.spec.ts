import { TaxCodeKind } from "@prisma/client";
import { isExemptMcc, isVatableMcc, matchMcc } from "./mcc.mapping";

describe("MCCMapping", () => {
  it("maps 5812 to restaurants", () => {
    expect(matchMcc("5812")).toMatchObject({
      industry: "Restaurants",
      categoryKey: "restaurants",
      ledgerCode: 3090,
      vatable: true,
      taxCodeKind: TaxCodeKind.VAT_STANDARD,
    });
  });

  it("treats padded MCC strings as the same code", () => {
    expect(matchMcc("MCC-5541")?.categoryKey).toBe("fuel");
  });

  it("flags insurance and finance MCCs as exempt / no VAT", () => {
    expect(isExemptMcc("6300")).toBe(true);
    expect(isVatableMcc("6300")).toBe(false);
    expect(matchMcc("6300")?.taxCodeKind).toBe(TaxCodeKind.NO_VAT);
  });

  it("flags restaurant and fuel MCCs as VATable", () => {
    expect(isVatableMcc("5812")).toBe(true);
    expect(isVatableMcc("5541")).toBe(true);
  });
});
