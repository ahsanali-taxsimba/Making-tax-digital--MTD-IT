import { money } from "../../bookkeeping/domain/money";
import { ClassifySignal } from "./types";

export function resolveSignals(signals: ClassifySignal[]): { winner: ClassifySignal; confidence: number; reasons: string[] } {
  if (signals.length === 0) {
    throw new Error("At least one categorisation signal is required");
  }
  const ranked = [...signals].sort((left, right) => right.confidence - left.confidence);
  const winner = ranked[0];
  let confidence = winner.confidence;
  const reasons = ranked.map((signal) => (signal.detail ? `${signal.name}:${signal.detail}` : signal.name));
  for (const other of ranked.slice(1)) {
    if (other.ledgerCode === winner.ledgerCode) {
      confidence = Math.min(0.99, money(confidence + 0.04));
      reasons.push(`agree:${other.name}`);
    } else {
      confidence = Math.max(0.35, money(confidence - 0.1));
      reasons.push(`conflict:${other.name}`);
    }
  }
  return { winner, confidence: clampConfidence(confidence), reasons };
}

export function clampConfidence(value: number): number {
  return Math.min(1, Math.max(0, money(value)));
}

export function looksLikeSubscription(description: string, merchantName?: string | null): boolean {
  return /\b(subscription|monthly|annual|saas|adobe|slack|zoom|microsoft 365|office 365|direct debit)\b/i.test(
    `${merchantName ?? ""} ${description}`,
  );
}

export function looksLikeInvoice(description: string): boolean {
  return /\b(inv|invoice)[- ]?\w+/i.test(description);
}

export function looksLikeBill(description: string): boolean {
  return /\b(bill|purchase)[- ]?\w+/i.test(description);
}

export function isRecurringAmount(
  amount: number,
  merchantName: string | null | undefined,
  description: string,
  siblings: Array<{ merchantName?: string | null; amount: number; description: string }> = [],
): boolean {
  const target = money(amount);
  const key = (merchantName ?? description).toLowerCase();
  const matches = siblings.filter((row) => {
    if (money(row.amount) !== target) {
      return false;
    }
    const other = (row.merchantName ?? row.description).toLowerCase();
    return other.includes(key.slice(0, 8)) || key.includes(other.slice(0, 8));
  });
  return matches.length >= 1;
}
