import { ChartProfile } from "@prisma/client";
import { ITSAInferenceService } from "./itsa-inference.service";

describe("ITSAInferenceService", () => {
  const service = new ITSAInferenceService();

  it("maps sole-trader motor expenses to the ITSA motor category", () => {
    expect(service.infer(ChartProfile.SOLE_TRADER, 3080)).toMatchObject({
      category: "Motor Expenses",
      bucket: "business_expenses_allowable",
      includedInQuarterlyUpdate: true,
    });
  });

  it("maps landlord rent to UK property income", () => {
    expect(service.infer(ChartProfile.LANDLORD, 2000)).toMatchObject({
      category: "UK Property Income",
      bucket: "property_income",
    });
  });

  it("returns null for company codes that are not in the ITSA map", () => {
    expect(service.infer(ChartProfile.COMPANY, 1000)).toBeNull();
  });
});
