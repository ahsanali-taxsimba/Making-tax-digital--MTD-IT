import { businessTypeLabel, categoryLabel, formatMoney, obligationStatus, obligationTypeLabel } from "./format";

describe("businessTypeLabel", () => {
  it("maps sole trade and property businesses", () => {
    expect(businessTypeLabel("self-employment")).toBe("Sole trade");
    expect(businessTypeLabel("sole_trader")).toBe("Sole trade");
    expect(businessTypeLabel("uk-property")).toBe("Property");
    expect(businessTypeLabel("landlord")).toBe("Property");
  });
});

describe("obligation labels", () => {
  it("normalises open and fulfilled statuses", () => {
    expect(obligationStatus("OPEN")).toBe("open");
    expect(obligationStatus("Fulfilled")).toBe("fulfilled");
    expect(obligationStatus("F")).toBe("fulfilled");
  });

  it("labels quarterly, EOPS, and final declaration types", () => {
    expect(obligationTypeLabel("QUARTERLY_UPDATE")).toBe("Quarterly update");
    expect(obligationTypeLabel("EOPS")).toBe("EOPS");
    expect(obligationTypeLabel("FINAL_DECLARATION")).toBe("Final declaration");
  });
});

describe("formatMoney", () => {
  it("formats sterling amounts", () => {
    expect(formatMoney(12500)).toMatch(/12,500\.00/);
  });
});

describe("categoryLabel", () => {
  it("humanises camelCase and snake_case keys", () => {
    expect(categoryLabel("advertisingAndBusinessPromotion")).toBe("Advertising And Business Promotion");
    expect(categoryLabel("capital_not_in_quarterly_update")).toBe("Capital not in quarterly update");
  });
});
