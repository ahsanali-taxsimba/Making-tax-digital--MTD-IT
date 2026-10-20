import { suggestDocumentMatch } from "./invoice-match";

describe("Yapily invoice matching", () => {
  const invoice = {
    id: "inv1",
    kind: "invoice" as const,
    date: "2026-01-15",
    description: "Brighton Gallery Ltd",
    reference: "INV-1001",
    grossTotal: 7200,
    journalId: "j1",
  };

  it("matches a credit to an invoice on amount, date and merchant", () => {
    const match = suggestDocumentMatch(
      {
        date: "2026-01-16",
        amount: 7200,
        type: "CREDIT",
        description: "Brighton Gallery Ltd INV-1001",
        merchantName: "Brighton Gallery Ltd",
      },
      [invoice],
    );
    expect(match?.documentId).toBe("inv1");
    expect(match?.journalId).toBe("j1");
    expect(match?.reasons).toEqual(expect.arrayContaining(["amount", "description"]));
  });

  it("ignores amount gaps larger than two pounds", () => {
    expect(
      suggestDocumentMatch({ date: "2026-01-15", amount: 50, type: "CREDIT", description: "Brighton Gallery Ltd" }, [
        invoice,
      ]),
    ).toBeNull();
  });
});
