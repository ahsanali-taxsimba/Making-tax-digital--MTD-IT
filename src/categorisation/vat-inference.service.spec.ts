import { TaxCodeKind } from "@prisma/client";
import { VATInferenceService } from "./vat-inference.service";

describe("VATInferenceService", () => {
  const service = new VATInferenceService();

  it("maps a VATable MCC to the standard tax code", () => {
    expect(service.infer({ type: "DEBIT", merchantCategoryCode: "5541" })).toBe(TaxCodeKind.VAT_STANDARD);
    expect(service.codeFor(TaxCodeKind.VAT_STANDARD)).toBe("S");
    expect(service.rateFor(TaxCodeKind.VAT_STANDARD)).toBe(20);
  });

  it("maps an exempt MCC to NO_VAT", () => {
    expect(service.infer({ type: "DEBIT", merchantCategoryCode: "6300" })).toBe(TaxCodeKind.NO_VAT);
    expect(service.codeFor(TaxCodeKind.NO_VAT)).toBe("NA");
  });
});
