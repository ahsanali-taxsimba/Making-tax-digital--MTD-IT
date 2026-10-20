import { ConfidenceScoringService } from "./confidence-scoring.service";

describe("ConfidenceScoringService", () => {
  const service = new ConfidenceScoringService();

  it("ranks an invoice above the confidence floor", () => {
    const best = service.best(
      {
        date: "2026-01-16",
        amount: 7200,
        type: "CREDIT",
        description: "Brighton Gallery Ltd INV-1001",
        merchantName: "Brighton Gallery Ltd",
      },
      [
        {
          id: "inv-1",
          kind: "invoice",
          date: "2026-01-15",
          description: "Studio sales",
          reference: "INV-1001",
          partyName: "Brighton Gallery Ltd",
          grossTotal: 7200,
        },
      ],
    );
    expect(best?.documentId).toBe("inv-1");
    expect(best?.confidence).toBeGreaterThanOrEqual(0.8);
  });
});
