import { descriptionScore, tokenize } from "../../bookkeeping/domain/matching.engine";
import { daysBetween, money } from "../../bookkeeping/domain/money";
import { isRecurringAmount } from "../../categorisation/domain/scoring";
import {
  AMOUNT_TOLERANCE_GBP,
  BankMatchTxn,
  BILL_EXPENSE_MCCS,
  DATE_WINDOW_DAYS,
  INVOICE_SETTLEMENT_MCCS,
  MATCH_WEIGHTS,
  MatchableDocument,
  MIN_SUGGEST_CONFIDENCE,
  ScoredDocumentMatch,
  SiblingTxn,
} from "./types";

export function wantedKind(type: "CREDIT" | "DEBIT"): "invoice" | "bill" {
  return type === "CREDIT" ? "invoice" : "bill";
}

export function normalizeRef(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function extractReferences(text: string): string[] {
  const matches = text.toUpperCase().match(/\b(?:INV|INVOICE|BILL|PO)[- /\s]?[A-Z0-9]{2,}\b/g) ?? [];
  return matches.map((item) => normalizeRef(item.replace(/^INVOICE/, "INV")));
}

export function hasInvoiceReference(txn: BankMatchTxn, document: MatchableDocument): boolean {
  if (!document.reference) {
    return false;
  }
  const hay = `${txn.description} ${txn.merchantName ?? ""} ${txn.ocrInvoiceNumber ?? ""} ${txn.ocrText ?? ""}`;
  const compact = normalizeRef(hay);
  const ref = normalizeRef(document.reference);
  if (ref.length >= 3 && compact.includes(ref)) {
    return true;
  }
  return extractReferences(hay).some((item) => item.includes(ref) || ref.includes(item));
}

export function merchantSimilarity(txn: BankMatchTxn, document: MatchableDocument): number {
  const left = `${txn.merchantName ?? ""} ${txn.description}`.trim();
  const right = `${document.partyName ?? ""} ${document.description} ${document.reference ?? ""}`.trim();
  const token = descriptionScore(left, right);
  const a = normalizeName(txn.merchantName ?? txn.description);
  const b = normalizeName(document.partyName ?? document.description);
  if (!a || !b) {
    return token;
  }
  if (a === b) {
    return 1;
  }
  if (a.includes(b) || b.includes(a)) {
    return Math.max(token, 0.85);
  }
  const shared = tokenize(a).filter((word) => tokenize(b).includes(word));
  if (shared.length >= 2) {
    return Math.max(token, 0.7);
  }
  return token;
}

export function mccAligns(txn: BankMatchTxn, document: MatchableDocument): boolean {
  const mcc = txn.merchantCategoryCode?.trim();
  if (!mcc) {
    return false;
  }
  if (document.kind === "invoice") {
    return INVOICE_SETTLEMENT_MCCS.has(mcc);
  }
  return BILL_EXPENSE_MCCS.has(mcc);
}

export function scoreDocumentMatch(
  txn: BankMatchTxn,
  document: MatchableDocument,
  siblings: SiblingTxn[] = [],
  options?: { windowDays?: number; tolerance?: number },
): ScoredDocumentMatch | null {
  const windowDays = options?.windowDays ?? DATE_WINDOW_DAYS;
  const tolerance = options?.tolerance ?? AMOUNT_TOLERANCE_GBP;
  if (document.kind !== wantedKind(txn.type)) {
    return null;
  }
  const amountGap = money(Math.abs(money(txn.amount) - money(document.grossTotal)));
  if (amountGap > tolerance) {
    return null;
  }
  const dateGapDays = daysBetween(txn.date, document.date);
  if (dateGapDays > windowDays) {
    return null;
  }

  const exactAmount = amountGap === 0;
  const amountTolerance = !exactAmount && amountGap <= tolerance;
  const merchant = merchantSimilarity(txn, document);
  const invoiceReference = hasInvoiceReference(txn, document);
  const recurring = isRecurringAmount(
    txn.amount,
    txn.merchantName,
    txn.description,
    siblings.filter((row) => row.id !== txn.id),
  );
  const mccAlignment = mccAligns(txn, document);

  let confidence = 0;
  const reasons: string[] = [];
  if (exactAmount) {
    confidence = money(confidence + MATCH_WEIGHTS.exactAmount);
    reasons.push("exact_amount");
  } else if (amountTolerance) {
    confidence = money(confidence + MATCH_WEIGHTS.amountTolerance * (1 - amountGap / tolerance));
    reasons.push("amount_tolerance");
  }
  const dateScore = MATCH_WEIGHTS.dateProximity * (1 - dateGapDays / windowDays);
  if (dateScore > 0) {
    confidence = money(confidence + dateScore);
    reasons.push(dateGapDays === 0 ? "same_date" : `date_within_${dateGapDays}d`);
  }
  if (merchant > 0) {
    confidence = money(confidence + MATCH_WEIGHTS.merchantSimilarity * merchant);
    reasons.push("merchant");
  }
  if (invoiceReference) {
    confidence = money(confidence + MATCH_WEIGHTS.invoiceReference);
    reasons.push("invoice_reference");
  }
  if (recurring) {
    confidence = money(confidence + MATCH_WEIGHTS.recurring);
    reasons.push("recurring");
  }
  if (mccAlignment) {
    confidence = money(confidence + MATCH_WEIGHTS.mccAlignment);
    reasons.push("mcc");
  }

  confidence = Math.min(1, Math.max(0, money(confidence)));
  return {
    documentId: document.id,
    kind: document.kind,
    journalId: document.journalId ?? null,
    documentReference: document.reference ?? null,
    partyName: document.partyName ?? null,
    confidence,
    reasons,
    signals: {
      exactAmount,
      amountTolerance,
      amountGap,
      dateProximity: dateGapDays <= windowDays,
      dateGapDays,
      merchantSimilarity: money(merchant),
      invoiceReference,
      recurring,
      mccAlignment,
    },
  };
}

export function rankDocumentMatches(
  txn: BankMatchTxn,
  documents: MatchableDocument[],
  siblings: SiblingTxn[] = [],
  minConfidence = MIN_SUGGEST_CONFIDENCE,
): ScoredDocumentMatch[] {
  return documents
    .map((document) => scoreDocumentMatch(txn, document, siblings))
    .filter((row): row is ScoredDocumentMatch => row != null && row.confidence >= minConfidence)
    .sort((left, right) => right.confidence - left.confidence || left.signals.amountGap - right.signals.amountGap);
}

export function bestDocumentMatch(
  txn: BankMatchTxn,
  documents: MatchableDocument[],
  siblings: SiblingTxn[] = [],
  minConfidence = MIN_SUGGEST_CONFIDENCE,
): ScoredDocumentMatch | null {
  return rankDocumentMatches(txn, documents, siblings, minConfidence)[0] ?? null;
}

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
