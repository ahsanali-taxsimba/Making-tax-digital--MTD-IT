import { Injectable } from "@nestjs/common";
import { ocrLines, parseSterling } from "./clean-text";

const ISO_DATE = /\b(\d{4})-(\d{2})-(\d{2})\b/;
const UK_DATE = /\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b/;
const NAMED_DATE =
  /\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{2,4})\b/i;
const MONTHS: Record<string, string> = {
  jan: "01",
  january: "01",
  feb: "02",
  february: "02",
  mar: "03",
  march: "03",
  apr: "04",
  april: "04",
  may: "05",
  jun: "06",
  june: "06",
  jul: "07",
  july: "07",
  aug: "08",
  august: "08",
  sep: "09",
  sept: "09",
  september: "09",
  oct: "10",
  october: "10",
  nov: "11",
  november: "11",
  dec: "12",
  december: "12",
};

const TOTAL = /(?:grand\s*)?(?:total|amount(?:\s*due)?|gbp)\s*[:-]?\s*£?\s*([\d,]+(?:\.\d{2})?)/i;
const STERLING = /£\s*([\d,]+(?:\.\d{2})?)/g;

@Injectable()
export class OCRParserService {
  extractDate(text: string): string | null {
    const iso = ISO_DATE.exec(text);
    if (iso) {
      return `${iso[1]}-${iso[2]}-${iso[3]}`;
    }
    const named = NAMED_DATE.exec(text);
    if (named) {
      const month = MONTHS[named[2].toLowerCase()];
      if (month) {
        return `${fullYear(named[3])}-${month}-${named[1].padStart(2, "0")}`;
      }
    }
    const uk = UK_DATE.exec(text);
    if (!uk) {
      return null;
    }
    return `${fullYear(uk[3])}-${uk[2].padStart(2, "0")}-${uk[1].padStart(2, "0")}`;
  }

  extractAmounts(text: string): number[] {
    const values = new Set<number>();
    const total = TOTAL.exec(text);
    const parsedTotal = parseSterling(total?.[1]);
    if (parsedTotal != null) {
      values.add(parsedTotal);
    }
    for (const match of text.matchAll(STERLING)) {
      const value = parseSterling(match[1]);
      if (value != null && value > 0) {
        values.add(value);
      }
    }
    return [...values].sort((left, right) => right - left);
  }

  extractTotal(text: string): number | null {
    const labelled = parseSterling(TOTAL.exec(text)?.[1]);
    if (labelled != null) {
      return labelled;
    }
    return this.extractAmounts(text)[0] ?? null;
  }

  meaningfulLines(text: string): string[] {
    return ocrLines(text).filter((line) => line.length > 2 && !/^\d+([.,]\d{2})?$/.test(line));
  }
}

function fullYear(value: string): string {
  if (value.length !== 2) {
    return value;
  }
  return Number(value) >= 70 ? `19${value}` : `20${value}`;
}
