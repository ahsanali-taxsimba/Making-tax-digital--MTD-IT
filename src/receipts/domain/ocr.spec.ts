import { extractPdfText, parseReceiptText, scoreReceiptAgainstTxn } from "./ocr";

describe("receipt OCR parsing", () => {
  it("extracts merchant, sterling total and UK date", () => {
    const parsed = parseReceiptText("BP Fuel\n21/01/2026\nDiesel\nTotal £48.00");
    expect(parsed.merchantName).toBe("BP");
    expect(parsed.amount).toBe(48);
    expect(parsed.date).toBe("2026-01-21");
  });

  it("reads printable strings from a PDF-like buffer", () => {
    const buffer = Buffer.from("%PDF-1.4 (Tesco Extra) (Total £12.40) (20/01/2026)");
    const parsed = parseReceiptText(extractPdfText(buffer));
    expect(parsed.merchantName).toBe("Tesco");
    expect(parsed.amount).toBe(12.4);
  });

  it("scores OCR fields against a bank line", () => {
    const scored = scoreReceiptAgainstTxn(
      { merchantName: "BP", amount: 48, date: "2026-01-21" },
      { merchantName: null, description: "BP FUEL CARD", amount: 48, date: "2026-01-21" },
    );
    expect(scored.score).toBeGreaterThanOrEqual(0.9);
    expect(scored.reasons).toEqual(expect.arrayContaining(["ocr_amount_exact", "ocr_date_exact", "ocr_merchant"]));
  });
});
