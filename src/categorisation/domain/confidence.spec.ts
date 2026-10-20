import { amountCloseness, merchantNameOverlap, ocrMatchScore, scoreConfidence } from "./confidence";

describe("ConfidenceEngine", () => {
  it("scores OCR merchant and amount overlap", () => {
    expect(merchantNameOverlap("BP Connect", "BP")).toBeGreaterThan(0.7);
    expect(amountCloseness(55, 55)).toBe(1);
    expect(ocrMatchScore({
      date: "2026-03-04",
      amount: 55,
      type: "DEBIT",
      description: "CARD",
      merchantName: "BP",
      ocrText: "BP CONNECT BRIGHTON",
      ocrMerchantName: "BP",
      ocrAmount: 55,
      ocrVatRate: 20,
    })).toBeGreaterThan(0.7);
  });

  it("boosts agreeing merchant, OCR and historical signals", () => {
    const scored = scoreConfidence(
      {
        date: "2026-03-04",
        amount: 55,
        type: "DEBIT",
        description: "BP CONNECT",
        merchantName: "BP",
        ocrMerchantName: "BP",
        ocrAmount: 55,
      },
      {
        merchantRule: {
          merchantKey: "bp",
          merchantName: "BP",
          aliases: [],
          categoryKey: "fuel",
          ledgerCode: 3080,
          taxCodeKind: "VAT_STANDARD" as never,
          confidence: 0.95,
        },
        model: { categoryKey: "fuel", ledgerCode: 3080, confidence: 0.8 },
        ruleScore: 0.95,
        winnerLedgerCode: 3080,
        siblings: [{ merchantName: "BP", amount: 55, description: "BP", ledgerCode: 3080 }],
      },
      true,
    );
    expect(scored.confidence).toBeGreaterThan(0.95);
    expect(scored.breakdown.ocrMatch).toBeGreaterThan(0.7);
    expect(scored.breakdown.historical).toBeGreaterThan(0.5);
    expect(scored.reasons).toEqual(expect.arrayContaining(["ocr_match", "model_agree", "historical_pattern"]));
  });
});
