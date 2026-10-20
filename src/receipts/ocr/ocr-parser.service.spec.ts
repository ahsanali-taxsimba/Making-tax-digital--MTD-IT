import { parseReceiptText } from "../domain/ocr";
import { InvoiceDetectionService } from "./invoice-detection.service";
import { MerchantDetectionService } from "./merchant-detection.service";
import { OCRParserService } from "./ocr-parser.service";
import { VATDetectionService } from "./vat-detection.service";

const SAMPLE = `
BP CONNECT BRIGHTON
21/01/2026
Invoice No INV-4412
Diesel
Net £40.00
VAT @ 20% £8.00
Total £48.00
`;

describe("OCR parser and detectors", () => {
  const parser = new OCRParserService();
  const vat = new VATDetectionService(parser);
  const invoices = new InvoiceDetectionService();
  const merchants = new MerchantDetectionService(parser);

  it("parses UK and ISO dates", () => {
    expect(parser.extractDate("Paid 21/01/2026")).toBe("2026-01-21");
    expect(parser.extractDate("2026-03-04 statement")).toBe("2026-03-04");
    expect(parser.extractDate("21 January 2026")).toBe("2026-01-21");
  });

  it("extracts labelled sterling totals", () => {
    expect(parser.extractTotal("Amount due £12.40")).toBe(12.4);
    expect(parser.extractTotal("Total: 48.00")).toBe(48);
  });

  it("detects net, VAT and rate from a UK receipt", () => {
    const amounts = vat.detect(SAMPLE);
    expect(amounts.total).toBe(48);
    expect(amounts.net).toBe(40);
    expect(amounts.vat).toBe(8);
    expect(amounts.vatRate).toBe(20);
  });

  it("detects invoice numbers and company suppliers", () => {
    expect(invoices.invoiceNumber(SAMPLE)).toBe("INV-4412");
    expect(invoices.supplierName("Supplier: North Ads Agency Ltd\nTotal £1200.00")).toBe("North Ads Agency Ltd");
  });

  it("matches known merchants and fuzzy aliases", () => {
    expect(merchants.detect("BP CONNECT BRIGHTON")?.name).toBe("BP");
    expect(merchants.detect("tesco expres brighton")?.name).toBe("Tesco");
  });

  it("composes a full extraction including VAT and invoice fields", () => {
    const parsed = parseReceiptText(SAMPLE);
    expect(parsed.merchantName).toBe("BP");
    expect(parsed.amount).toBe(48);
    expect(parsed.vatAmount).toBe(8);
    expect(parsed.netAmount).toBe(40);
    expect(parsed.invoiceNumber).toBe("INV-4412");
    expect(parsed.date).toBe("2026-01-21");
    expect(parsed.confidence).toBeGreaterThan(0.7);
  });
});
