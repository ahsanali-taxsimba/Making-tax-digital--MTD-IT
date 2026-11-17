import { featureLabel, formatGbp } from "./billing";

describe("billing helpers", () => {
  it("formats pence as GBP and labels feature keys", () => {
    expect(formatGbp(720)).toBe("£7.20");
    expect(formatGbp(1000)).toBe("£10.00");
    expect(featureLabel("ai_categorisation")).toBe("AI categorisation");
    expect(featureLabel("bookkeeping_agent")).toBe("Bookkeeping agent");
    expect(featureLabel("vat_returns")).toBe("VAT returns");
  });
});
