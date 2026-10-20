import { ChartProfile } from "@prisma/client";
import { amountBucket, defaultCategorisationModel, tokenizeFeatures, trainCategorisationModel } from "./naive-bayes";

describe("NaiveBayesClassifier", () => {
  const model = defaultCategorisationModel();

  it("tokenizes merchant, OCR, MCC and amount buckets", () => {
    expect(tokenizeFeatures({
      merchantName: "BP",
      description: "BP CONNECT BRIGHTON",
      ocrText: "VAT 20% petrol",
      merchantCategoryCode: "5541",
      amount: 55,
      type: "DEBIT",
    })).toEqual(expect.arrayContaining(["bp", "petrol", "mcc:5541", "dir:debit", "amt:medium"]));
    expect(amountBucket(12.99)).toBe("amt:micro");
  });

  it("classifies fuel and subscription language", () => {
    const fuel = model.predict(
      { date: "2026-03-04", amount: 55, type: "DEBIT", description: "BP CONNECT petrol", merchantName: "BP", merchantCategoryCode: "5541" },
      ChartProfile.SOLE_TRADER,
    );
    expect(fuel.categoryKey).toBe("fuel");
    expect(fuel.ledgerCode).toBe(3080);
    expect(fuel.confidence).toBeGreaterThan(0.5);

    const sub = model.predict(
      { date: "2026-03-01", amount: 12.99, type: "DEBIT", description: "ADOBE CREATIVE CLOUD MONTHLY", merchantName: "Adobe" },
      ChartProfile.SOLE_TRADER,
    );
    expect(sub.categoryKey).toBe("subscriptions");
  });

  it("uses OCR text when the bank description is thin", () => {
    const result = trainCategorisationModel().predict(
      { date: "2026-03-08", amount: 48, type: "DEBIT", description: "CARD PAYMENT", ocrText: "The Lane Restaurant VAT 20%" },
      ChartProfile.SOLE_TRADER,
    );
    expect(result.categoryKey).toBe("restaurants");
  });

  it("reports model stats", () => {
    const stats = model.stats();
    expect(stats.algorithm).toBe("naive_bayes");
    expect(stats.vocabularySize).toBeGreaterThan(20);
    expect(stats.trainedExamples).toBeGreaterThan(20);
    expect(stats.classes).toContain("fuel");
  });
});
