import { confidencePercent, confidenceTone, reasonLabel } from "./bank-workspace";

describe("bank workspace helpers", () => {
  it("converts confidence to a percent and tone", () => {
    expect(confidencePercent(0.874)).toBe(87);
    expect(confidenceTone(0.9)).toBe("high");
    expect(confidenceTone(0.7)).toBe("medium");
    expect(confidenceTone(0.4)).toBe("low");
  });

  it("labels matching and categorisation reasons", () => {
    expect(reasonLabel("exact_amount")).toBe("Exact amount");
    expect(reasonLabel("date_within_1d")).toBe("Date within 1d");
    expect(reasonLabel("merchant:Brighton")).toBe("Merchant · Brighton");
  });
});
