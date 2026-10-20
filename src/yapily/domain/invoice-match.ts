import { daysBetween, money } from "../../bookkeeping/domain/money";
import { descriptionScore } from "../../bookkeeping/domain/matching.engine";

export interface MatchableDocument {
  id: string;
  kind: "invoice" | "bill";
  date: Date | string;
  description: string;
  reference?: string | null;
  grossTotal: number;
  journalId?: string | null;
}

export interface DocumentMatch {
  documentId: string;
  kind: "invoice" | "bill";
  journalId: string | null;
  score: number;
  reasons: string[];
}

export function suggestDocumentMatch(
  txn: { date: Date | string; amount: number; type: "CREDIT" | "DEBIT"; description: string; merchantName?: string | null },
  documents: MatchableDocument[],
  windowDays = 7,
): DocumentMatch | null {
  const wanted = txn.type === "CREDIT" ? "invoice" : "bill";
  let best: DocumentMatch | null = null;
  for (const document of documents.filter((item) => item.kind === wanted)) {
    const amountGap = Math.abs(money(txn.amount) - money(document.grossTotal));
    if (amountGap > 2) {
      continue;
    }
    const gap = daysBetween(txn.date, document.date);
    if (gap > windowDays) {
      continue;
    }
    const text = `${document.description} ${document.reference ?? ""}`;
    const overlap = descriptionScore(`${txn.merchantName ?? ""} ${txn.description}`, text);
    const score = money(60 + Math.max(0, (windowDays - gap) * 4) + overlap * 25 - amountGap * 5);
    const reasons = amountGap === 0 ? ["amount"] : ["amount_tolerance"];
    if (gap === 0) {
      reasons.push("same_date");
    } else {
      reasons.push(`date_within_${gap}d`);
    }
    if (overlap > 0) {
      reasons.push("description");
    }
    if (!best || score > best.score) {
      best = { documentId: document.id, kind: document.kind, journalId: document.journalId ?? null, score, reasons };
    }
  }
  return best && best.score >= 60 ? best : null;
}
