import { Injectable } from "@nestjs/common";
import { MERCHANT_DICTIONARY, matchMerchant } from "../../categorisation/domain/merchant.dictionary";
import { levenshteinRatio, normalizeKey, tokenOverlap } from "./clean-text";
import { OCRParserService } from "./ocr-parser.service";
import { MerchantHit } from "./ocr.types";

const SKIP = /^(total|vat|amount|date|invoice|receipt|tel|phone|thank|card|visa|mastercard|contactless)$/i;

@Injectable()
export class MerchantDetectionService {
  constructor(private readonly parser: OCRParserService) {}

  detect(text: string): MerchantHit | null {
    const dictionary = matchMerchant(null, text, MERCHANT_DICTIONARY);
    if (dictionary) {
      return { name: dictionary.merchantName, score: dictionary.confidence, source: "dictionary" };
    }
    const fuzzy = this.fuzzy(text);
    if (fuzzy) {
      return fuzzy;
    }
    const line = this.parser
      .meaningfulLines(text)
      .find((row) => row.length > 3 && !/^\d/.test(row) && !SKIP.test(row) && !/total|vat|amount|date|invoice/i.test(row));
    return line ? { name: line.slice(0, 80), score: 0.4, source: "line" } : null;
  }

  fuzzy(text: string): MerchantHit | null {
    const haystack = normalizeKey(text);
    let best: MerchantHit | null = null;
    for (const rule of MERCHANT_DICTIONARY) {
      for (const needle of [rule.merchantName, rule.merchantKey, ...rule.aliases]) {
        const key = normalizeKey(needle);
        if (!key) {
          continue;
        }
        const score = Math.max(tokenOverlap(haystack, key), levenshteinRatio(bestWindow(haystack, key), key));
        if (score < 0.78) {
          continue;
        }
        if (!best || score > best.score) {
          best = { name: rule.merchantName, score: Math.min(0.92, score), source: "fuzzy" };
        }
      }
    }
    return best;
  }
}

function bestWindow(haystack: string, needle: string): string {
  const tokens = haystack.split(" ");
  const width = Math.max(1, needle.split(" ").length);
  let best = haystack;
  let score = 0;
  for (let i = 0; i <= Math.max(0, tokens.length - width); i += 1) {
    const window = tokens.slice(i, i + width + 1).join(" ");
    const next = levenshteinRatio(window, needle);
    if (next > score) {
      score = next;
      best = window;
    }
  }
  return best;
}
