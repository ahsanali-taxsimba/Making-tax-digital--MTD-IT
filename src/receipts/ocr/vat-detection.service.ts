import { Injectable } from "@nestjs/common";
import { parseSterling } from "./clean-text";
import { OCRParserService } from "./ocr-parser.service";
import { ParsedAmounts } from "./ocr.types";

const VAT_LINE = /(?:vat|tax)\s*(?:@|at)?\s*(5|20|0)?\s*%?\s*[:-]?\s*£?\s*([\d,]+(?:\.\d{2})?)/i;
const VAT_ONLY = /(?:vat|tax)\s*(?:amount)?\s*[:-]?\s*£?\s*([\d,]+(?:\.\d{2})?)/i;
const NET_LINE = /(?:net|sub[-\s]?total|goods)\s*[:-]?\s*£?\s*([\d,]+(?:\.\d{2})?)/i;
const RATE = /(?:vat|tax)\s*(?:@|at)\s*(5|20|0)\s*%/i;
const UK_RATES = [20, 5, 0] as const;

@Injectable()
export class VATDetectionService {
  constructor(private readonly parser: OCRParserService) {}

  detect(text: string): ParsedAmounts {
    const total = this.parser.extractTotal(text);
    const vatFromLine = parseSterling(VAT_LINE.exec(text)?.[2] ?? VAT_ONLY.exec(text)?.[1]);
    const netFromLine = parseSterling(NET_LINE.exec(text)?.[1]);
    const rateFromText = Number(RATE.exec(text)?.[1] ?? VAT_LINE.exec(text)?.[1]);
    const vatRate = UK_RATES.includes(rateFromText as (typeof UK_RATES)[number]) ? rateFromText : inferRate(total, vatFromLine, netFromLine);

    let vat = vatFromLine;
    let net = netFromLine;
    if (total != null && vat != null && net == null) {
      net = roundMoney(total - vat);
    }
    if (total != null && net != null && vat == null) {
      vat = roundMoney(total - net);
    }
    if (total != null && vat == null && vatRate != null) {
      vat = roundMoney(total - total / (1 + vatRate / 100));
      net = roundMoney(total - vat);
    }
    if (net != null && vat != null && total == null) {
      return { total: roundMoney(net + vat), net, vat, vatRate: vatRate ?? inferRate(net + vat, vat, net) };
    }
    return {
      total,
      net,
      vat,
      vatRate: vatRate ?? inferRate(total, vat, net),
    };
  }
}

function inferRate(total?: number | null, vat?: number | null, net?: number | null): number | null {
  if (total != null && vat != null && total > 0) {
    const rate = Math.round((vat / (total - vat || total)) * 100);
    return UK_RATES.includes(rate as (typeof UK_RATES)[number]) ? rate : closestRate(vat / total);
  }
  if (net != null && vat != null && net > 0) {
    const rate = Math.round((vat / net) * 100);
    return UK_RATES.includes(rate as (typeof UK_RATES)[number]) ? rate : closestRate(vat / (net + vat));
  }
  return null;
}

function closestRate(fraction: number): number | null {
  if (!Number.isFinite(fraction) || fraction <= 0) {
    return null;
  }
  const asPercent = fraction > 1 ? fraction : (fraction / (1 - fraction)) * 100;
  const match = UK_RATES.find((rate) => Math.abs(asPercent - rate) <= 1.5);
  return match ?? null;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
