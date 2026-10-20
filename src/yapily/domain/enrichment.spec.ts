import { enrichBankLine, extractMerchant } from "./enrichment";

describe("Yapily enrichment", () => {
  it("classifies advertising as a VATable expense", () => {
    const enriched = enrichBankLine({
      description: "North Ads Agency BILL-88",
      merchantName: "North Ads Agency",
      type: "DEBIT",
    });
    expect(enriched.category).toBe("advertising");
    expect(enriched.vatHint).toBe("STANDARD");
    expect(enriched.itsaBucket).toBe("expense");
  });

  it("classifies gallery receipts as sales income", () => {
    const enriched = enrichBankLine({
      description: "Brighton Gallery Ltd INV-1001",
      type: "CREDIT",
    });
    expect(enriched.category).toBe("sales");
    expect(enriched.merchantName).toContain("Brighton Gallery");
  });

  it("treats bank fees as no-VAT", () => {
    expect(enrichBankLine({ description: "Unmatched bank fee", type: "DEBIT" }).vatHint).toBe("NONE");
  });

  it("extracts a merchant from a noisy description", () => {
    expect(extractMerchant("Brighton Gallery Ltd INV-1001")).toBe("Brighton Gallery Ltd");
  });
});
