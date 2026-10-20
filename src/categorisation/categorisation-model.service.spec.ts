import { ChartProfile } from "@prisma/client";
import { CategorisationModelService } from "./categorisation-model.service";

describe("CategorisationModelService", () => {
  const service = new CategorisationModelService();

  it("predicts a ledger from merchant, description and OCR", () => {
    const prediction = service.predict(
      {
        date: "2026-03-04",
        amount: 55,
        type: "DEBIT",
        description: "CARD PAYMENT",
        merchantName: "BP",
        ocrText: "BP CONNECT petrol VAT 20%",
        merchantCategoryCode: "5541",
      },
      ChartProfile.SOLE_TRADER,
    );
    expect(prediction.categoryKey).toBe("fuel");
    expect(service.features({ merchantName: "BP", description: "petrol", merchantCategoryCode: "5541" })).toContain("mcc:5541");
    expect(service.stats().algorithm).toBe("naive_bayes");
  });
});
