export type InvoiceDirection = "sales" | "purchase";

export interface ExtractedLineItem {
  description: string;
  quantity: number | null;
  unitPrice: number | null;
  net: number | null;
  vat: number | null;
  vatRate: number | null;
  gross: number | null;
  confidence: number;
}

export interface FieldConfidence {
  supplierName: number;
  supplierAddress: number;
  invoiceNumber: number;
  invoiceDate: number;
  dueDate: number;
  lineItems: number;
  subtotal: number;
  vatTotal: number;
  grandTotal: number;
}

export interface ExtractedInvoice {
  supplierName: string | null;
  supplierAddress: string | null;
  supplierId: string | null;
  customerName: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  currency: string;
  lineItems: ExtractedLineItem[];
  subtotal: number | null;
  vatTotal: number | null;
  grandTotal: number | null;
  direction: InvoiceDirection;
  vatBoxes: string[];
  itsaCategory: string | null;
  itsaBucket: string | null;
  issues: string[];
  fieldConfidence: FieldConfidence;
  confidence: number;
  source: "ocr" | "hint";
}

export interface ReconciliationResult {
  lineNetOk: boolean;
  lineVatOk: boolean;
  totalOk: boolean;
  issues: string[];
}
