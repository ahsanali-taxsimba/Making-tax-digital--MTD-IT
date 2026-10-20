import { TaxCodeKind } from "@prisma/client";
import { inferTaxCodeKind } from "./vat.inference";

describe("VATInference", () => {
  it("applies standard VAT when the MCC is VATable", () => {
    expect(
      inferTaxCodeKind({
        type: "DEBIT",
        merchantCategoryCode: "5812",
        description: "THE LANE RESTAURANT",
      }),
    ).toBe(TaxCodeKind.VAT_STANDARD);
  });

  it("applies NO_VAT when the MCC is exempt", () => {
    expect(
      inferTaxCodeKind({
        type: "DEBIT",
        merchantCategoryCode: "6300",
        description: "AVIVA BUSINESS INSURANCE",
      }),
    ).toBe(TaxCodeKind.NO_VAT);
  });

  it("prefers the merchant dictionary tax hint", () => {
    expect(
      inferTaxCodeKind({
        type: "DEBIT",
        merchantCategoryCode: "5812",
        merchantRule: {
          merchantKey: "starling",
          merchantName: "Starling",
          aliases: [],
          categoryKey: "bank_charges",
          ledgerCode: 3010,
          taxCodeKind: TaxCodeKind.NO_VAT,
          confidence: 0.9,
        },
      }),
    ).toBe(TaxCodeKind.NO_VAT);
  });

  it("falls back to standard VAT on unmatched credits and NO_VAT on unmatched debits", () => {
    expect(inferTaxCodeKind({ type: "CREDIT", description: "Unknown inbound" })).toBe(TaxCodeKind.VAT_STANDARD);
    expect(inferTaxCodeKind({ type: "DEBIT", description: "Unknown spend" })).toBe(TaxCodeKind.NO_VAT);
  });
});
