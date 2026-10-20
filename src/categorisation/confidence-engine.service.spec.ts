import { ConfidenceEngineService } from "./confidence-engine.service";

describe("ConfidenceEngineService", () => {
  const service = new ConfidenceEngineService();

  it("scores OCR, merchant, amount and historical factors", () => {
    const result = service.score({
      txn: {
        date: "2026-03-04",
        amount: 55,
        type: "DEBIT",
        description: "BP CONNECT",
        merchantName: "BP",
        ocrMerchantName: "BP",
        ocrAmount: 55,
      },
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
      siblings: [{ merchantName: "BP", amount: 55, description: "BP CONNECT", ledgerCode: 3080 }],
    });
    expect(result.breakdown.merchantMatch).toBe(0.95);
    expect(result.breakdown.ocrMatch).toBeGreaterThan(0.7);
    expect(result.confidence).toBeGreaterThan(0.95);
  });
});
