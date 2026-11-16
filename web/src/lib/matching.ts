import { apiFetch } from "./api";

export interface MatchingSignals {
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

export interface MatchingSuggestion {
  id: string | null;
  clientId: string;
  bankTransactionId: string;
  bankTransaction: {
    id: string;
    date: string;
    amount: number;
    type: string;
    description: string;
    merchantName?: string | null;
  };
  documentKind: "invoice" | "bill";
  documentId: string;
  documentReference?: string | null;
  partyName?: string | null;
  documentJournalId?: string | null;
  journalEntryId?: string | null;
  journalId?: string | null;
  confidence: number;
  reasons: string[];
  signals: MatchingSignals;
  status: "SUGGESTED" | "APPLIED" | "REJECTED" | string;
}

function asSuggestion(row: MatchingSuggestion): MatchingSuggestion {
  return {
    ...row,
    confidence: Number(row.confidence ?? 0),
    bankTransaction: {
      ...row.bankTransaction,
      amount: Number(row.bankTransaction?.amount ?? 0),
      type: String(row.bankTransaction?.type ?? "").toUpperCase(),
    },
    signals: {
      exactAmount: Boolean(row.signals?.exactAmount),
      amountTolerance: Boolean(row.signals?.amountTolerance),
      amountGap: Number(row.signals?.amountGap ?? 0),
      dateProximity: Boolean(row.signals?.dateProximity),
      dateGapDays: Number(row.signals?.dateGapDays ?? 0),
      merchantSimilarity: Number(row.signals?.merchantSimilarity ?? 0),
      invoiceReference: Boolean(row.signals?.invoiceReference),
      recurring: Boolean(row.signals?.recurring),
      mccAlignment: Boolean(row.signals?.mccAlignment),
    },
  };
}

export function listMatchingSuggestions(query: { clientId?: string; bankAccountId?: string; bankTransactionId?: string }) {
  const params = new URLSearchParams();
  if (query.clientId) params.set("clientId", query.clientId);
  if (query.bankAccountId) params.set("bankAccountId", query.bankAccountId);
  if (query.bankTransactionId) params.set("bankTransactionId", query.bankTransactionId);
  return apiFetch<{ suggestions: MatchingSuggestion[]; count: number }>(`/matching/suggestions?${params.toString()}`).then(
    (body) => ({
      count: body.count,
      suggestions: (body.suggestions ?? []).map(asSuggestion),
    }),
  );
}

export function applyMatchingSuggestion(suggestionId: string) {
  return apiFetch<{ suggestion: MatchingSuggestion; journal?: { id: string; reference?: string | null }; alreadyApplied?: boolean }>(
    `/matching/apply`,
    {
      method: "POST",
      body: JSON.stringify({ suggestionId }),
    },
  );
}

export function rejectMatchingSuggestion(suggestionId: string) {
  return apiFetch<{ suggestion: MatchingSuggestion }>(`/matching/reject`, {
    method: "POST",
    body: JSON.stringify({ suggestionId }),
  });
}

export function matchingKindLabel(kind?: string | null): string {
  return kind === "bill" ? "Purchase bill" : "Sales invoice";
}
