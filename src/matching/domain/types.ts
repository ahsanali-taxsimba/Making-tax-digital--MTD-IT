export type MatchingDocumentKind = "invoice" | "bill";

export interface BankMatchTxn {
  id?: string;
  date: Date | string;
  amount: number;
  type: "CREDIT" | "DEBIT";
  description: string;
  merchantName?: string | null;
  merchantCategoryCode?: string | null;
}

export interface MatchableDocument {
  id: string;
  kind: MatchingDocumentKind;
  date: Date | string;
  description: string;
  reference?: string | null;
  partyName?: string | null;
  grossTotal: number;
  journalId?: string | null;
  status?: string;
}

export interface SiblingTxn {
  id?: string;
  merchantName?: string | null;
  amount: number;
  description: string;
}

export interface MatchSignals {
  exactAmount: boolean;
  amountTolerance: boolean;
  amountGap: number;
  dateProximity: boolean;
  dateGapDays: number;
  merchantSimilarity: number;
  invoiceReference: boolean;
  recurring: boolean;
  mccAlignment: boolean;
}

export interface ScoredDocumentMatch {
  documentId: string;
  kind: MatchingDocumentKind;
  journalId: string | null;
  documentReference: string | null;
  partyName: string | null;
  confidence: number;
  reasons: string[];
  signals: MatchSignals;
}

export const AMOUNT_TOLERANCE_GBP = 2;
export const DATE_WINDOW_DAYS = 7;
export const MIN_SUGGEST_CONFIDENCE = 0.45;

export const MATCH_WEIGHTS = {
  exactAmount: 0.35,
  amountTolerance: 0.2,
  dateProximity: 0.2,
  merchantSimilarity: 0.15,
  invoiceReference: 0.2,
  recurring: 0.1,
  mccAlignment: 0.05,
} as const;

/** MCC codes typical of inbound invoice settlement (wires / financial institutions). */
export const INVOICE_SETTLEMENT_MCCS = new Set(["4829", "6010", "6011", "6012", "6051"]);

/** MCC codes typical of supplier / professional bill payments. */
export const BILL_EXPENSE_MCCS = new Set([
  "7311",
  "7372",
  "7392",
  "6513",
  "5734",
  "5817",
  "5968",
  "4814",
  "4900",
]);
