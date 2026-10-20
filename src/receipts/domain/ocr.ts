import { InvoiceDetectionService } from "../ocr/invoice-detection.service";
import { MerchantDetectionService } from "../ocr/merchant-detection.service";
import { OCRParserService } from "../ocr/ocr-parser.service";
import { OcrExtraction } from "../ocr/ocr.types";
import { VATDetectionService } from "../ocr/vat-detection.service";
import { cleanOcrText } from "../ocr/clean-text";

export type { OcrExtraction } from "../ocr/ocr.types";

export function extractPdfText(buffer: Buffer): string {
  const latin = buffer.toString("latin1");
  const fromParens = [...latin.matchAll(/\(([^)]{3,80})\)/g)].map((match) => decodePdfString(match[1]));
  const printable = latin
    .replace(/[^\x09\x0a\x0d\x20-\x7e]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return [...fromParens, printable].filter((part) => part.length > 3).join("\n");
}

export function parseReceiptText(
  text: string,
  deps?: {
    parser?: OCRParserService;
    merchants?: MerchantDetectionService;
    vat?: VATDetectionService;
    invoices?: InvoiceDetectionService;
  },
): OcrExtraction {
  const parser = deps?.parser ?? new OCRParserService();
  const merchants = deps?.merchants ?? new MerchantDetectionService(parser);
  const vat = deps?.vat ?? new VATDetectionService(parser);
  const invoices = deps?.invoices ?? new InvoiceDetectionService();
  const cleaned = cleanOcrText(text);
  const merchant = merchants.detect(cleaned);
  const amounts = vat.detect(cleaned);
  const document = invoices.detect(cleaned);
  const fields = [merchant?.name, amounts.total, parser.extractDate(cleaned), document.invoiceNumber].filter(Boolean).length;
  return {
    text: cleaned || "",
    merchantName: merchant?.name ?? null,
    supplierName: document.supplierName ?? (looksLikeCompany(merchant?.name) ? merchant?.name ?? null : null),
    amount: amounts.total,
    netAmount: amounts.net,
    vatAmount: amounts.vat,
    vatRate: amounts.vatRate,
    date: parser.extractDate(cleaned),
    invoiceNumber: document.invoiceNumber,
    source: "hint",
    confidence: Math.min(1, 0.2 + fields * 0.2 + (merchant?.source === "dictionary" ? 0.15 : 0)),
  };
}

export function scoreReceiptAgainstTxn(
  ocr: { merchantName?: string | null; amount?: number | null; date?: string | null; invoiceNumber?: string | null },
  txn: { merchantName?: string | null; description: string; amount: number; date: Date | string },
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  if (ocr.amount != null && Math.abs(Number(ocr.amount) - Number(txn.amount)) <= 2) {
    score += Math.abs(Number(ocr.amount) - Number(txn.amount)) < 0.01 ? 0.45 : 0.3;
    reasons.push(Math.abs(Number(ocr.amount) - Number(txn.amount)) < 0.01 ? "ocr_amount_exact" : "ocr_amount_tolerance");
  }
  if (ocr.date) {
    const days = Math.abs(Date.parse(`${ocr.date}T00:00:00Z`) - Date.parse(iso(txn.date))) / 86_400_000;
    if (days <= 7) {
      score += days === 0 ? 0.3 : 0.2;
      reasons.push(days === 0 ? "ocr_date_exact" : "ocr_date_proximity");
    }
  }
  const merchant = (ocr.merchantName ?? "").toLowerCase();
  const haystack = `${txn.merchantName ?? ""} ${txn.description}`.toLowerCase();
  if (merchant && haystack.includes(merchant)) {
    score += 0.25;
    reasons.push("ocr_merchant");
  }
  const invoice = (ocr.invoiceNumber ?? "").replace(/[^A-Z0-9]/gi, "");
  if (invoice && haystack.replace(/[^a-z0-9]/gi, "").includes(invoice.toLowerCase())) {
    score += 0.2;
    reasons.push("ocr_invoice_number");
  }
  return { score: Math.min(1, Number(score.toFixed(3))), reasons };
}

function looksLikeCompany(name?: string | null): boolean {
  return Boolean(name && /\b(ltd|limited|plc|llp)\b/i.test(name));
}

function decodePdfString(value: string): string {
  return value.replace(/\\n/g, " ").replace(/\\[()\\]/g, "").trim();
}

function iso(value: Date | string): string {
  return typeof value === "string" ? `${value.slice(0, 10)}T00:00:00Z` : value.toISOString();
}
