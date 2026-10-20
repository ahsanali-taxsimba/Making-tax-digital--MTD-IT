import { money } from "../../bookkeeping/domain/money";

const MERCHANTS: Array<{ match: RegExp; name: string }> = [
  { match: /\bbp\b|bp fuel/i, name: "BP" },
  { match: /tesco/i, name: "Tesco" },
  { match: /sainsbury/i, name: "Sainsbury's" },
  { match: /shell/i, name: "Shell" },
  { match: /amazon/i, name: "Amazon" },
  { match: /uber/i, name: "Uber" },
  { match: /trainline|tfl/i, name: "Trainline" },
];

export interface OcrExtraction {
  text: string;
  merchantName: string | null;
  amount: number | null;
  date: string | null;
}

export function extractPdfText(buffer: Buffer): string {
  const latin = buffer.toString("latin1");
  const fromParens = [...latin.matchAll(/\(([^)]{3,80})\)/g)].map((match) => decodePdfString(match[1]));
  const printable = latin
    .replace(/[^\x09\x0a\x0d\x20-\x7e]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return [...fromParens, printable].filter((part) => part.length > 3).join("\n");
}

export function parseReceiptText(text: string): OcrExtraction {
  const cleaned = text.replace(/\u0000/g, " ").replace(/[ \t]+/g, " ").trim();
  return {
    text: cleaned || "",
    merchantName: extractMerchant(cleaned),
    amount: extractAmount(cleaned),
    date: extractDate(cleaned),
  };
}

export function scoreReceiptAgainstTxn(
  ocr: { merchantName?: string | null; amount?: number | null; date?: string | null },
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
  return { score: Math.min(1, Number(score.toFixed(3))), reasons };
}

function extractMerchant(text: string): string | null {
  const known = MERCHANTS.find((rule) => rule.match.test(text));
  if (known) {
    return known.name;
  }
  const line = text
    .split(/\n/)
    .map((row) => row.trim())
    .find((row) => row.length > 3 && !/^\d/.test(row) && !/total|vat|amount|date/i.test(row));
  return line ? line.slice(0, 80) : null;
}

function extractAmount(text: string): number | null {
  const total = /(?:total|amount|gbp)\s*[:-]?\s*£?\s*([\d,]+(?:\.\d{2})?)/i.exec(text);
  const sterling = /£\s*([\d,]+(?:\.\d{2})?)/.exec(text);
  const raw = total?.[1] ?? sterling?.[1];
  if (!raw) {
    return null;
  }
  const parsed = Number(raw.replace(/,/g, ""));
  return Number.isFinite(parsed) ? money(parsed) : null;
}

function extractDate(text: string): string | null {
  const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (iso) {
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }
  const uk = /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/.exec(text);
  if (!uk) {
    return null;
  }
  const year = uk[3].length === 2 ? (Number(uk[3]) >= 70 ? `19${uk[3]}` : `20${uk[3]}`) : uk[3];
  return `${year}-${uk[2].padStart(2, "0")}-${uk[1].padStart(2, "0")}`;
}

function decodePdfString(value: string): string {
  return value.replace(/\\n/g, " ").replace(/\\[()\\]/g, "").trim();
}

function iso(value: Date | string): string {
  return typeof value === "string" ? `${value.slice(0, 10)}T00:00:00Z` : value.toISOString();
}
