export interface OcrExtraction {
  text: string;
  merchantName: string | null;
  supplierName: string | null;
  amount: number | null;
  netAmount: number | null;
  vatAmount: number | null;
  vatRate: number | null;
  date: string | null;
  invoiceNumber: string | null;
  source: "hint" | "pdf" | "tesseract" | "cloud";
  confidence: number;
}

export interface ParsedAmounts {
  total: number | null;
  net: number | null;
  vat: number | null;
  vatRate: number | null;
}

export interface MerchantHit {
  name: string;
  score: number;
  source: "dictionary" | "fuzzy" | "line";
}

export interface InvoiceHit {
  invoiceNumber: string | null;
  supplierName: string | null;
}
