import { parseSterling } from "../../receipts/ocr/clean-text";
import { OCRParserService } from "../../receipts/ocr/ocr-parser.service";
import { InvoiceDetectionService } from "../../receipts/ocr/invoice-detection.service";

const DUE = /due\s*(?:date|by|on)?\s*[:\-]?\s*(.+)$/im;
const INVOICE_DATE = /(?:invoice\s*)?date\s*[:\-]?\s*(.+)$/im;
const SUBTOTAL = /(?:sub\s*total|net(?:\s*total)?|goods)\s*[:\-]?\s*£\s*([\d,]+\.\d{2})/i;
const VAT_TOTAL = /vat(?:\s*total)?(?:\s*@?\s*\d+\s*%)?\s*[:\-]?\s*£\s*([\d,]+\.\d{2})/i;
const GRAND = /(?:grand\s+total|amount\s+due|(?<!sub)(?<!net )total(?:\s+due)?)\s*[:\-]?\s*£\s*([\d,]+\.\d{2})/i;
const INVOICE_NO = /invoice\s*(?:no\.?|number|#)\s*[:\-]?\s*([A-Z0-9][-A-Z0-9/]{1,18})/i;
const BARE_INV = /\b((?:INV|INVOICE)[-/\s]?\d{2,}[A-Z0-9\-]*)\b/i;
const CURRENCY = /\b(GBP|EUR|USD|£)\b/i;

const dates = new OCRParserService();
const invoices = new InvoiceDetectionService();

export function extractInvoiceNumber(text: string): string | null {
  const labelled = INVOICE_NO.exec(text)?.[1];
  const bare = BARE_INV.exec(text)?.[1];
  const raw = labelled ?? bare;
  if (raw) {
    return raw.replace(/\s+/g, "").replace(/^INVOICE/i, "INV").toUpperCase();
  }
  const fallback = invoices.invoiceNumber(text);
  return fallback && /\d/.test(fallback) ? fallback : null;
}

export function extractInvoiceDate(text: string): string | null {
  const labelled = INVOICE_DATE.exec(text);
  if (labelled?.[1]) {
    return dates.extractDate(labelled[1]) ?? dates.extractDate(text);
  }
  return dates.extractDate(text);
}

export function extractDueDate(text: string, invoiceDate?: string | null): string | null {
  const labelled = DUE.exec(text);
  if (labelled?.[1]) {
    const parsed = dates.extractDate(labelled[1]);
    if (parsed) {
      return parsed;
    }
  }
  for (const line of text.split("\n")) {
    if (/due/i.test(line)) {
      const parsed = dates.extractDate(line);
      if (parsed && parsed !== invoiceDate) {
        return parsed;
      }
    }
  }
  return null;
}

export function extractTotals(text: string): { subtotal: number | null; vatTotal: number | null; grandTotal: number | null } {
  return {
    subtotal: parseSterling(SUBTOTAL.exec(text)?.[1]),
    vatTotal: parseSterling(VAT_TOTAL.exec(text)?.[1]),
    grandTotal: parseSterling(GRAND.exec(text)?.[1]) ?? dates.extractTotal(text),
  };
}

export function extractCurrency(text: string): string {
  const match = CURRENCY.exec(text);
  if (!match) {
    return "GBP";
  }
  if (match[1] === "£" || match[1].toUpperCase() === "GBP") {
    return "GBP";
  }
  return match[1].toUpperCase();
}

export function detectDirection(text: string, forced?: "sales" | "purchase"): "sales" | "purchase" {
  if (forced) {
    return forced;
  }
  if (/\b(sales invoice|tax invoice issued|invoice to)\b/i.test(text) && !/\b(supplier|bill from|purchase)\b/i.test(text)) {
    return "sales";
  }
  return "purchase";
}
