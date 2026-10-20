import { ocrLines } from "../../receipts/ocr/clean-text";
import { InvoiceDetectionService } from "../../receipts/ocr/invoice-detection.service";

const POSTCODE = /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i;
const detectors = new InvoiceDetectionService();

export function detectSupplier(text: string): { name: string | null; address: string | null } {
  const name = detectors.supplierName(text);
  const lines = ocrLines(text);
  const start = name ? lines.findIndex((line) => line.toLowerCase().includes(name.split(" ")[0].toLowerCase())) : 0;
  const address: string[] = [];
  for (const line of lines.slice(Math.max(0, start), Math.max(0, start) + 6)) {
    if (line === name) {
      continue;
    }
    if (/invoice|total|vat|tel|email/i.test(line)) {
      break;
    }
    if (POSTCODE.test(line) || /\d/.test(line) || /street|road|lane|avenue|brighton|london|manchester/i.test(line)) {
      address.push(line);
    }
  }
  return { name, address: address.length ? address.join(", ") : null };
}

export function matchPartyName(name: string | null | undefined, parties: Array<{ id: string; name: string }>): { id: string; name: string } | null {
  if (!name) {
    return null;
  }
  const key = normalize(name);
  return parties.find((party) => normalize(party.name) === key || normalize(party.name).includes(key) || key.includes(normalize(party.name))) ?? null;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
