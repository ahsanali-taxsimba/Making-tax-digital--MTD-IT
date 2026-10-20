import { money } from "../../bookkeeping/domain/money";
import { clampConfidence } from "./scoring";
import { ClassifyInput, ConfidenceBreakdown, HistoricalSibling, MerchantRule, ModelPrediction } from "./types";

export interface ConfidenceFactors {
  merchantRule: MerchantRule | null;
  model: ModelPrediction | null;
  ruleScore: number;
  winnerLedgerCode: number;
  siblings?: HistoricalSibling[];
}

export function merchantNameOverlap(left?: string | null, right?: string | null): number {
  const a = (left ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const b = (right ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (!a || !b) {
    return 0;
  }
  if (a === b) {
    return 1;
  }
  if (a.includes(b) || b.includes(a)) {
    return 0.78;
  }
  const leftTokens = new Set(a.split(/\s+/).filter(Boolean));
  const rightTokens = b.split(/\s+/).filter(Boolean);
  const hits = rightTokens.filter((token) => leftTokens.has(token)).length;
  return rightTokens.length ? hits / rightTokens.length : 0;
}

export function amountCloseness(left?: number | null, right?: number | null): number {
  if (left == null || right == null) {
    return 0;
  }
  const delta = Math.abs(money(left) - money(right));
  const scale = Math.max(1, Math.abs(money(right)));
  if (delta <= 0.02) {
    return 1;
  }
  if (delta / scale <= 0.02) {
    return 0.92;
  }
  if (delta / scale <= 0.08) {
    return 0.55;
  }
  return 0;
}

export function ocrMatchScore(txn: ClassifyInput): number {
  const merchant = Math.max(
    merchantNameOverlap(txn.ocrMerchantName, txn.merchantName),
    merchantNameOverlap(txn.ocrText, txn.merchantName),
    merchantNameOverlap(txn.ocrText, txn.ocrMerchantName),
  );
  const amount = amountCloseness(txn.ocrAmount, txn.amount);
  const invoice = txn.ocrInvoiceNumber ? 0.45 : 0;
  const vat = txn.ocrVatAmount != null || txn.ocrVatRate != null ? 0.2 : 0;
  return clampConfidence(Math.max(merchant, amount * 0.85, invoice) + vat * 0.15);
}

export function amountMatchScore(txn: ClassifyInput, recurring: boolean): number {
  const ocr = amountCloseness(txn.ocrAmount, txn.amount);
  return clampConfidence(Math.max(recurring ? 0.8 : 0, ocr));
}

export function historicalScore(
  txn: ClassifyInput,
  winnerLedgerCode: number,
  siblings: HistoricalSibling[] = [],
): number {
  const key = (txn.merchantName ?? txn.ocrMerchantName ?? txn.description).toLowerCase().slice(0, 10);
  if (!key) {
    return 0;
  }
  const matches = siblings.filter((row) => {
    const other = (row.merchantName ?? row.description).toLowerCase();
    return other.includes(key.slice(0, 8)) || key.includes(other.slice(0, 8));
  });
  if (matches.length === 0) {
    return 0;
  }
  const sameLedger = matches.filter((row) => row.ledgerCode === winnerLedgerCode);
  if (sameLedger.length > 0) {
    return clampConfidence(0.55 + Math.min(0.35, sameLedger.length * 0.1));
  }
  return 0.2;
}

export function scoreConfidence(txn: ClassifyInput, factors: ConfidenceFactors, recurring: boolean): {
  confidence: number;
  breakdown: ConfidenceBreakdown;
  reasons: string[];
} {
  const breakdown: ConfidenceBreakdown = {
    ocrMatch: ocrMatchScore(txn),
    merchantMatch: factors.merchantRule?.confidence ?? 0,
    amountMatch: amountMatchScore(txn, recurring),
    historical: historicalScore(txn, factors.winnerLedgerCode, factors.siblings),
    model: factors.model?.confidence ?? 0,
    rules: factors.ruleScore,
  };
  const reasons: string[] = [];
  let confidence = factors.ruleScore;
  if (breakdown.ocrMatch >= 0.7) {
    confidence = Math.min(0.99, money(confidence + 0.03));
    reasons.push("ocr_match");
  } else if (txn.ocrAmount != null && breakdown.amountMatch < 0.4 && breakdown.ocrMatch < 0.3) {
    confidence = Math.max(0.35, money(confidence - 0.05));
    reasons.push("ocr_amount_mismatch");
  }
  if (breakdown.amountMatch >= 0.8) {
    confidence = Math.min(0.99, money(confidence + 0.02));
    reasons.push("amount_match");
  }
  if (breakdown.historical >= 0.55) {
    confidence = Math.min(0.99, money(confidence + 0.03));
    reasons.push("historical_pattern");
  }
  if (factors.model && factors.model.ledgerCode === factors.winnerLedgerCode && factors.ruleScore >= 0.6) {
    confidence = Math.min(0.99, money(confidence + 0.02));
    reasons.push("model_agree");
  } else if (factors.model && factors.model.confidence >= 0.55 && factors.model.ledgerCode !== factors.winnerLedgerCode) {
    confidence = Math.max(0.35, money(confidence - 0.06));
    reasons.push("model_conflict");
  }
  return { confidence: clampConfidence(confidence), breakdown, reasons };
}
