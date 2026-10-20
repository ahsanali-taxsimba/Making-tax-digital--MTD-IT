import { TaxCodeKind } from "@prisma/client";
import { matchMerchant } from "./merchant.dictionary";

describe("MerchantDictionary", () => {
  it("maps BP to fuel / motor expenses", () => {
    const hit = matchMerchant("BP", "BP CONNECT BRIGHTON");
    expect(hit).toMatchObject({
      merchantName: "BP",
      categoryKey: "fuel",
      ledgerCode: 3080,
      taxCodeKind: TaxCodeKind.VAT_STANDARD,
      itsaCategory: "Motor Expenses",
    });
    expect(hit!.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("maps Tesco to groceries / office costs", () => {
    const hit = matchMerchant("Tesco", "TESCO STORES 2847");
    expect(hit).toMatchObject({
      merchantName: "Tesco",
      categoryKey: "groceries",
      ledgerCode: 3050,
      taxCodeKind: TaxCodeKind.VAT_STANDARD,
    });
  });

  it("matches an alias buried in the description", () => {
    expect(matchMerchant(null, "Payment to Adobe Creative Cloud")?.categoryKey).toBe("subscriptions");
  });

  it("returns null when the merchant is unknown", () => {
    expect(matchMerchant("Unknown Cafe", "coffee")).toBeNull();
  });
});
