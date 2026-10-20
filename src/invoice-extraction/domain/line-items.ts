import { money } from "../../bookkeeping/domain/money";
import { ocrLines, parseSterling } from "../../receipts/ocr/clean-text";
import { ExtractedLineItem } from "./types";

const SKIP = /^(invoice|date|due|subtotal|sub\s*total|vat|tax|total|qty|quantity|description|unit|net|gross|amount)/i;
const LINE =
  /^(.+?)\s+(\d+(?:\.\d+)?)\s+(?:x\s*)?£?([\d,]+\.\d{2})(?:\s+£?([\d,]+\.\d{2}))?(?:\s+£?([\d,]+\.\d{2}))?(?:\s+£?([\d,]+\.\d{2}))?$/i;

export function extractLineItems(text: string): ExtractedLineItem[] {
  const items: ExtractedLineItem[] = [];
  for (const line of ocrLines(text)) {
    if (SKIP.test(line) || /total|subtotal|vat\s*@/i.test(line)) {
      continue;
    }
    const match = LINE.exec(line);
    if (!match) {
      continue;
    }
    const description = match[1].replace(/[:\-]+$/, "").trim();
    if (description.length < 3 || /^(from|to|tel|vat)$/i.test(description)) {
      continue;
    }
    const quantity = Number(match[2]);
    const amounts = [match[3], match[4], match[5], match[6]].map(parseSterling).filter((value): value is number => value != null);
    if (amounts.length === 0) {
      continue;
    }
    items.push(classifyAmounts(description, quantity, amounts));
  }
  return items;
}

function classifyAmounts(description: string, quantity: number, amounts: number[]): ExtractedLineItem {
  let unitPrice: number | null = null;
  let net: number | null = null;
  let vat: number | null = null;
  let gross: number | null = null;
  let confidence = 0.62;

  if (amounts.length === 4) {
    [unitPrice, net, vat, gross] = amounts;
    confidence = 0.92;
  } else if (amounts.length === 3) {
    const [a, b, c] = amounts;
    if (near(a + b, c)) {
      net = a;
      vat = b;
      gross = c;
      unitPrice = quantity ? money(a / quantity) : a;
      confidence = 0.9;
    } else {
      unitPrice = a;
      net = b;
      gross = c;
      vat = money(c - b);
      confidence = 0.78;
    }
  } else if (amounts.length === 2) {
    const [a, b] = amounts;
    if (quantity && near(a * quantity, b)) {
      unitPrice = a;
      net = b;
      confidence = 0.74;
    } else if (b > a && near(a * 1.2, b)) {
      net = a;
      gross = b;
      vat = money(b - a);
      confidence = 0.8;
    } else {
      unitPrice = a;
      net = b;
      confidence = 0.6;
    }
  } else {
    net = amounts[0];
    confidence = 0.5;
  }

  if (net != null && vat != null && gross == null) {
    gross = money(net + vat);
  }
  if (net != null && gross != null && vat == null) {
    vat = money(gross - net);
  }
  const vatRate = net && vat != null && net > 0 ? guessRate(vat / net) : null;
  return { description, quantity: Number.isFinite(quantity) ? quantity : null, unitPrice, net, vat, vatRate, gross, confidence };
}

function near(left: number, right: number, tolerance = 0.06): boolean {
  return Math.abs(money(left) - money(right)) <= tolerance;
}

function guessRate(ratio: number): number | null {
  if (Math.abs(ratio - 0.2) < 0.03) {
    return 20;
  }
  if (Math.abs(ratio - 0.05) < 0.02) {
    return 5;
  }
  if (ratio < 0.01) {
    return 0;
  }
  return money(ratio * 100);
}
