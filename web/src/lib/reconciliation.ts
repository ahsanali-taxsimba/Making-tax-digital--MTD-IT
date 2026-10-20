import { apiFetch } from "./api";

export type BankTxnStatus = "UNMATCHED" | "MATCHED" | "IGNORED" | "RECONCILED";
export type BankTxnDirection = "CREDIT" | "DEBIT";

export interface BankAccountRecord {
  id: string;
  clientId: string;
  name: string;
  sortCode?: string | null;
  accountNumber?: string | null;
  provider?: string | null;
  currency?: string | null;
  balance: number;
  ledgerId?: string | null;
  transactionCount: number;
  unmatchedCount: number;
  matchedCount: number;
  ignoredCount: number;
  reconciledCount: number;
  lastSyncAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface BankTransactionRecord {
  id: string;
  bankAccountId?: string;
  date: string;
  amount: number;
  type: BankTxnDirection;
  description: string;
  externalRef?: string | null;
  merchantName?: string | null;
  category?: string | null;
  merchantCategoryCode?: string | null;
  status: BankTxnStatus;
  matchedJournalEntryId?: string | null;
  matchedJournal?: { id: string; description: string; reference?: string | null } | null;
}

export interface ReconciliationSuggestion {
  bankTransactionId: string;
  journalEntryId: string;
  score: number;
  reasons: string[];
  journal?: {
    id: string;
    date: string;
    description: string;
    reference?: string | null;
    source?: string | null;
    total: number;
  } | null;
}

export interface BankFeed {
  account: BankAccountRecord;
  transactions: BankTransactionRecord[];
  suggestions: ReconciliationSuggestion[];
}

export interface ReconciliationSuggestions {
  accounts: BankAccountRecord[];
  transactions: BankTransactionRecord[];
  suggestions: ReconciliationSuggestion[];
}

export interface ReconciliationSummary {
  account: BankAccountRecord;
  periodStart: string;
  periodEnd: string;
  total: number;
  reconciledCount: number;
  remainingCount: number;
  unmatchedCount: number;
  matchedCount: number;
  ignoredCount: number;
  bankCredits: number;
  bankDebits: number;
  ledgerBalance: number;
  statementBalance: number;
  variance: number;
  unmatched: BankTransactionRecord[];
}

export interface LedgerOption {
  id: string;
  code: number;
  name: string;
  type?: string;
  profile?: string;
}

export interface CategorisationSuggestion {
  id?: string | null;
  bankTransactionId: string;
  suggestedLedger: { id: string | null; code: number; name: string };
  suggestedTaxCode: { id: string | null; code: string | null; kind: string; rate: number };
  suggestedItsa?: { category?: string | null };
  confidence: number;
  reasons: string[];
  draftJournal: {
    date: string;
    description: string;
    lines: Array<{ ledgerAccountId: string; ledgerCode?: number; ledgerName?: string; debit: number; credit: number; description?: string }>;
  };
}

function asNumber(value: unknown): number {
  return Number(value ?? 0);
}

function asAccount(row: BankAccountRecord): BankAccountRecord {
  return {
    ...row,
    balance: asNumber(row.balance),
    transactionCount: asNumber(row.transactionCount),
    unmatchedCount: asNumber(row.unmatchedCount),
    matchedCount: asNumber(row.matchedCount),
    ignoredCount: asNumber(row.ignoredCount),
    reconciledCount: asNumber(row.reconciledCount),
  };
}

function asTransaction(row: BankTransactionRecord): BankTransactionRecord {
  return {
    ...row,
    amount: asNumber(row.amount),
    type: String(row.type).toUpperCase() === "CREDIT" ? "CREDIT" : "DEBIT",
    status: String(row.status).toUpperCase() as BankTxnStatus,
    date: typeof row.date === "string" ? row.date : new Date(row.date).toISOString(),
  };
}

export function listBankAccounts(clientId: string) {
  return apiFetch<BankAccountRecord[]>(`/bookkeeping/bank/accounts?clientId=${encodeURIComponent(clientId)}`).then((rows) =>
    rows.map(asAccount),
  );
}

export function getBankTransactions(accountId: string) {
  return apiFetch<BankFeed>(`/bookkeeping/bank/accounts/${accountId}/transactions`).then((feed) => ({
    account: asAccount(feed.account),
    transactions: feed.transactions.map(asTransaction),
    suggestions: feed.suggestions ?? [],
  }));
}

export function getReconciliationSuggestions(query: { bankAccountId?: string; clientId?: string }) {
  const params = new URLSearchParams();
  if (query.bankAccountId) params.set("bankAccountId", query.bankAccountId);
  if (query.clientId) params.set("clientId", query.clientId);
  return apiFetch<ReconciliationSuggestions>(`/bookkeeping/reconciliation/suggestions?${params.toString()}`).then((body) => ({
    accounts: (body.accounts ?? []).map(asAccount),
    transactions: (body.transactions ?? []).map(asTransaction),
    suggestions: body.suggestions ?? [],
  }));
}

export function getReconciliationSummary(query: { bankAccountId: string; periodStart?: string; periodEnd?: string; statementBalance?: number }) {
  const params = new URLSearchParams({ bankAccountId: query.bankAccountId });
  if (query.periodStart) params.set("periodStart", query.periodStart);
  if (query.periodEnd) params.set("periodEnd", query.periodEnd);
  if (query.statementBalance !== undefined) params.set("statementBalance", String(query.statementBalance));
  return apiFetch<ReconciliationSummary>(`/bookkeeping/reconciliation/summary?${params.toString()}`).then((body) => ({
    ...body,
    account: asAccount(body.account),
    unmatched: (body.unmatched ?? []).map(asTransaction),
    bankCredits: asNumber(body.bankCredits),
    bankDebits: asNumber(body.bankDebits),
    ledgerBalance: asNumber(body.ledgerBalance),
    statementBalance: asNumber(body.statementBalance),
    variance: asNumber(body.variance),
  }));
}

export function matchBankTransaction(bankTransactionId: string, journalEntryId: string) {
  return apiFetch<{ transaction: BankTransactionRecord }>(`/bookkeeping/reconciliation/match`, {
    method: "POST",
    body: JSON.stringify({ bankTransactionId, journalEntryId }),
  });
}

export function ignoreBankTransaction(bankTransactionId: string) {
  return apiFetch<{ transaction: BankTransactionRecord }>(`/bookkeeping/reconciliation/ignore`, {
    method: "POST",
    body: JSON.stringify({ bankTransactionId }),
  });
}

export function splitBankTransaction(
  bankTransactionId: string,
  allocations: Array<{ ledgerAccountId: string; amount: number; description?: string }>,
) {
  return apiFetch<{ transaction: BankTransactionRecord }>(`/bookkeeping/reconciliation/split`, {
    method: "POST",
    body: JSON.stringify({ bankTransactionId, allocations }),
  });
}

export function listClientLedgers(clientId: string) {
  return apiFetch<{ ledgers?: LedgerOption[] }>(`/bookkeeping/chart-of-accounts?clientId=${encodeURIComponent(clientId)}`).then(
    (body) => body.ledgers ?? [],
  );
}

export function createBankJournal(input: {
  clientId: string;
  date: string;
  description: string;
  bankLedgerId: string;
  counterpartLedgerId: string;
  amount: number;
  type: BankTxnDirection;
}) {
  const lines =
    input.type === "CREDIT"
      ? [
          { ledgerAccountId: input.bankLedgerId, debit: input.amount, credit: 0, description: input.description },
          { ledgerAccountId: input.counterpartLedgerId, debit: 0, credit: input.amount, description: input.description },
        ]
      : [
          { ledgerAccountId: input.counterpartLedgerId, debit: input.amount, credit: 0, description: input.description },
          { ledgerAccountId: input.bankLedgerId, debit: 0, credit: input.amount, description: input.description },
        ];
  return apiFetch<{ id: string }>(`/bookkeeping/journals`, {
    method: "POST",
    body: JSON.stringify({
      clientId: input.clientId,
      date: input.date.slice(0, 10),
      description: input.description,
      source: "BANK_FEED",
      lines,
    }),
  });
}

export function suggestCategorisation(bankTransactionId: string) {
  return apiFetch<{ suggestions: CategorisationSuggestion[] }>(`/categorisation/suggest`, {
    method: "POST",
    body: JSON.stringify({ bankTransactionId, persist: true }),
  }).then((body) => body.suggestions[0] ?? null);
}

export function applyCategorisation(bankTransactionId: string) {
  return apiFetch<{ journal: { id: string } }>(`/categorisation/apply`, {
    method: "POST",
    body: JSON.stringify({ bankTransactionId }),
  });
}

export function reconciliationProgress(input: { transactionCount: number; unmatchedCount: number }): number {
  if (!input.transactionCount) {
    return 100;
  }
  return Math.round(((input.transactionCount - input.unmatchedCount) / input.transactionCount) * 100);
}

export function maskAccountNumber(value?: string | null): string {
  if (!value) {
    return "—";
  }
  const digits = value.replace(/\s+/g, "");
  if (digits.length <= 4) {
    return digits;
  }
  return `•••• ${digits.slice(-4)}`;
}

export function statusLabel(status?: string | null): string {
  switch (String(status ?? "").toUpperCase()) {
    case "MATCHED":
      return "Matched";
    case "RECONCILED":
      return "Reconciled";
    case "IGNORED":
      return "Ignored";
    default:
      return "Unmatched";
  }
}
