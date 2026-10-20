import { Injectable } from "@nestjs/common";
import { ocrLines } from "./clean-text";
import { InvoiceHit } from "./ocr.types";

const LABELLED =
  /(?:invoice|inv|bill|receipt)\s*(?:no\.?|number|#)?\s*[:\-]?\s*([A-Z0-9][-A-Z0-9/]{1,18})/i;
const BARE = /\b((?:INV|INVOICE|BILL|PO)[-/\s]?\d{2,}[A-Z0-9\-]*)\b/i;
const COMPANY = /\b([A-Z][A-Za-z0-9&.'\-\s]{2,60})\s+(ltd|limited|plc|llp|llp\.|cic)\b/i;
const SUPPLIER_LABEL = /(?:supplier|from|sold\s+by|merchant)\s*[:-]\s*(.+)$/i;

@Injectable()
export class InvoiceDetectionService {
  detect(text: string): InvoiceHit {
    return {
      invoiceNumber: this.invoiceNumber(text),
      supplierName: this.supplierName(text),
    };
  }

  invoiceNumber(text: string): string | null {
    const labelled = LABELLED.exec(text)?.[1];
    const bare = BARE.exec(text)?.[1];
    const raw = labelled ?? bare;
    if (!raw) {
      return null;
    }
    return raw.replace(/\s+/g, "").replace(/^INVOICE/i, "INV").toUpperCase();
  }

  supplierName(text: string): string | null {
    for (const line of ocrLines(text)) {
      const labelled = SUPPLIER_LABEL.exec(line);
      if (labelled?.[1] && !/total|vat|amount/i.test(labelled[1])) {
        return tidyName(labelled[1]);
      }
      const company = COMPANY.exec(line);
      if (company) {
        return tidyName(`${company[1]} ${company[2]}`);
      }
    }
    return null;
  }
}

function tidyName(value: string): string {
  return value.replace(/\s+/g, " ").replace(/[.,;]+$/, "").trim().slice(0, 80);
}
