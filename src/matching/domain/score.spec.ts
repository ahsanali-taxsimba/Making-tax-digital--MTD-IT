import { bestDocumentMatch, extractReferences, hasInvoiceReference, scoreDocumentMatch } from "./score";
import { MatchableDocument } from "./types";

const invoice: MatchableDocument = {
  id: "inv-1",
  kind: "invoice",
  date: "2026-01-15",
  description: "Studio sales",
  reference: "INV-1001",
  partyName: "Brighton Gallery Ltd",
  grossTotal: 7200,
  journalId: "j-inv",
};

const bill: MatchableDocument = {
  id: "bill-1",
  kind: "bill",
  date: "2026-02-10",
  description: "Advertising",
  reference: "BILL-88",
  partyName: "North Ads Agency",
  grossTotal: 1200,
  journalId: "j-bill",
};

describe("invoice/bill matching score", () => {
  it("extracts invoice and bill references from a bank description", () => {
    expect(extractReferences("Brighton Gallery Ltd INV-1001")).toEqual(expect.arrayContaining(["INV1001"]));
    expect(extractReferences("Payment BILL 88 North Ads")).toEqual(expect.arrayContaining(["BILL88"]));
  });

  it("scores an exact credit-to-invoice match with date, merchant and reference", () => {
    const match = scoreDocumentMatch(
      {
        date: "2026-01-16",
        amount: 7200,
        type: "CREDIT",
        description: "Brighton Gallery Ltd INV-1001",
        merchantName: "Brighton Gallery Ltd",
        merchantCategoryCode: "4829",
      },
      invoice,
    );
    expect(match?.documentId).toBe("inv-1");
    expect(match?.confidence).toBeGreaterThanOrEqual(0.85);
    expect(match?.reasons).toEqual(
      expect.arrayContaining(["exact_amount", "date_within_1d", "merchant", "invoice_reference", "mcc"]),
    );
    expect(match?.signals.exactAmount).toBe(true);
    expect(hasInvoiceReference({ date: "2026-01-16", amount: 7200, type: "CREDIT", description: "INV-1001" }, invoice)).toBe(
      true,
    );
  });

  it("accepts an amount within a two-pound tolerance", () => {
    const match = scoreDocumentMatch(
      {
        date: "2026-01-15",
        amount: 7201.5,
        type: "CREDIT",
        description: "Brighton Gallery Ltd INV-1001",
        merchantName: "Brighton Gallery Ltd",
      },
      invoice,
    );
    expect(match?.signals.amountTolerance).toBe(true);
    expect(match?.signals.exactAmount).toBe(false);
    expect(match?.signals.amountGap).toBe(1.5);
    expect(match?.reasons).toContain("amount_tolerance");
  });

  it("rejects amount gaps larger than two pounds or dates outside seven days", () => {
    expect(
      scoreDocumentMatch({ date: "2026-01-15", amount: 7100, type: "CREDIT", description: "Brighton Gallery Ltd" }, invoice),
    ).toBeNull();
    expect(
      scoreDocumentMatch({ date: "2026-01-30", amount: 7200, type: "CREDIT", description: "Brighton Gallery Ltd" }, invoice),
    ).toBeNull();
  });

  it("does not pair a debit with an invoice", () => {
    expect(
      scoreDocumentMatch({ date: "2026-01-15", amount: 7200, type: "DEBIT", description: "Brighton Gallery Ltd" }, invoice),
    ).toBeNull();
  });

  it("boosts recurring bill payments with the same merchant and amount", () => {
    const match = scoreDocumentMatch(
      {
        id: "txn-now",
        date: "2026-02-10",
        amount: 1200,
        type: "DEBIT",
        description: "North Ads Agency BILL-88",
        merchantName: "North Ads Agency",
        merchantCategoryCode: "7311",
      },
      bill,
      [
        { id: "txn-prev", merchantName: "North Ads Agency", amount: 1200, description: "North Ads Agency" },
        { id: "txn-now", merchantName: "North Ads Agency", amount: 1200, description: "North Ads Agency BILL-88" },
      ],
    );
    expect(match?.signals.recurring).toBe(true);
    expect(match?.reasons).toContain("recurring");
    expect(match?.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("picks the best document above the confidence floor", () => {
    const other: MatchableDocument = { ...invoice, id: "inv-2", reference: "INV-1099", grossTotal: 7200, partyName: "Other Ltd" };
    const best = bestDocumentMatch(
      {
        date: "2026-01-16",
        amount: 7200,
        type: "CREDIT",
        description: "Brighton Gallery Ltd INV-1001",
        merchantName: "Brighton Gallery Ltd",
      },
      [other, invoice],
    );
    expect(best?.documentId).toBe("inv-1");
  });

  it("uses an OCR invoice number when the bank description has no reference", () => {
    expect(
      hasInvoiceReference(
        { date: "2026-01-16", amount: 7200, type: "CREDIT", description: "Brighton Gallery Ltd", ocrInvoiceNumber: "INV-1001" },
        invoice,
      ),
    ).toBe(true);
  });
});
