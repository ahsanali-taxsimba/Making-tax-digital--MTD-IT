"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { BankTransactionRow } from "@/components/BankTransactionRow";
import { CreateJournalModal } from "@/components/CreateJournalModal";
import { ErrorBanner } from "@/components/ErrorBanner";
import { IgnoreButton } from "@/components/IgnoreButton";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ReconciliationProgressBar } from "@/components/ReconciliationProgressBar";
import { RequireStaff } from "@/components/RequireStaff";
import { SplitModal } from "@/components/SplitModal";
import { SuggestedMatchCard } from "@/components/SuggestedMatchCard";
import { useBankTransactions } from "@/hooks/useBankTransactions";
import {
  useApplyCategorisation,
  useCategorisationSuggestion,
  useIgnoreBank,
  useMatchBank,
  useReconciliationSuggestions,
  useSplitBank,
} from "@/hooks/useReconciliation";
import { useSession } from "@/hooks/useSession";
import { formatMoney } from "@/lib/format";
import { createBankJournal, listClientLedgers, type BankTransactionRecord, type LedgerOption } from "@/lib/reconciliation";

export default function ReconciliationWorkspacePage() {
  const params = useParams<{ accountId: string }>();
  const accountId = params.accountId;
  const { clientId } = useSession();
  const feed = useBankTransactions(accountId);
  const suggestions = useReconciliationSuggestions(accountId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"unmatched" | "all">("unmatched");
  const [splitOpen, setSplitOpen] = useState(false);
  const [journalOpen, setJournalOpen] = useState(false);
  const [ledgers, setLedgers] = useState<LedgerOption[]>([]);
  const [actionError, setActionError] = useState<string | null>(null);

  const transactions = feed.data?.transactions ?? [];
  const account = feed.data?.account;
  const visible = transactions.filter((row) => (filter === "all" ? true : row.status === "UNMATCHED"));
  const selected = visible.find((row) => row.id === selectedId) ?? visible[0] ?? null;

  useEffect(() => {
    if (selected && selected.id !== selectedId) {
      setSelectedId(selected.id);
    }
  }, [selected, selectedId]);

  useEffect(() => {
    if (!clientId) {
      return;
    }
    void listClientLedgers(clientId).then(setLedgers).catch(() => setLedgers([]));
  }, [clientId]);

  const matches = useMemo(
    () => (suggestions.data?.suggestions ?? []).filter((item) => item.bankTransactionId === selected?.id),
    [suggestions.data, selected?.id],
  );
  const categorisation = useCategorisationSuggestion(selected?.status === "UNMATCHED" ? selected.id : null);
  const match = useMatchBank(accountId);
  const ignore = useIgnoreBank(accountId);
  const split = useSplitBank(accountId);
  const applyCategory = useApplyCategorisation(accountId);
  const counterpartLedgers = ledgers.filter((item) => item.code !== 1200);

  async function createJournal(ledgerAccountId: string) {
    if (!selected || !account || !clientId) {
      return;
    }
    setActionError(null);
    try {
      const bankLedgerId = account.ledgerId ?? ledgers.find((item) => item.code === 1200)?.id;
      if (!bankLedgerId) {
        throw new Error("Bank ledger account is missing");
      }
      const journal = await createBankJournal({
        clientId,
        date: selected.date,
        description: selected.description,
        bankLedgerId,
        counterpartLedgerId: ledgerAccountId,
        amount: selected.amount,
        type: selected.type,
      });
      await match.mutateAsync({ bankTransactionId: selected.id, journalEntryId: journal.id });
      setJournalOpen(false);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to post journal");
    }
  }

  return (
    <RequireStaff>
      {feed.isError ? (
        <ErrorBanner title="Bank feed unavailable" message={feed.error.message} />
      ) : feed.isLoading || !account ? (
        <LoadingSpinner label="Loading reconciliation workspace…" />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <Link href="/reconciliation" className="text-sm font-semibold text-teal hover:underline">
                All accounts
              </Link>
              <h2 className="mt-1 text-2xl font-semibold text-ink">{account.name}</h2>
              <p className="mt-1 text-sm text-ink-muted">
                {account.sortCode} · Balance {formatMoney(account.balance)}
              </p>
            </div>
            <Link
              href={`/reconciliation/${accountId}/summary`}
              className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:border-teal/40"
            >
              View summary
            </Link>
          </div>
          <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
            <ReconciliationProgressBar transactionCount={account.transactionCount} unmatchedCount={account.unmatchedCount} />
          </section>
          <div className="grid gap-6 xl:grid-cols-2">
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-ink">Bank transactions</h3>
                <select
                  className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm"
                  value={filter}
                  onChange={(event) => setFilter(event.target.value as "unmatched" | "all")}
                  aria-label="Transaction filter"
                >
                  <option value="unmatched">Unmatched</option>
                  <option value="all">All lines</option>
                </select>
              </div>
              {visible.length === 0 ? (
                <p className="rounded-xl border border-dashed border-line bg-white p-6 text-sm text-ink-muted">
                  No {filter === "unmatched" ? "unmatched " : ""}transactions on this account.
                </p>
              ) : (
                visible.map((transaction) => (
                  <BankTransactionRow
                    key={transaction.id}
                    transaction={transaction}
                    selected={transaction.id === selected?.id}
                    onSelect={() => setSelectedId(transaction.id)}
                  />
                ))
              )}
            </section>
            <section className="space-y-3">
              <h3 className="text-lg font-semibold text-ink">Suggested journal entries</h3>
              {!selected ? (
                <p className="rounded-xl border border-dashed border-line bg-white p-6 text-sm text-ink-muted">
                  Select a bank line to see matches.
                </p>
              ) : (
                <SelectedActions
                  transaction={selected}
                  matches={matches}
                  categorisation={categorisation.data}
                  categorisationLoading={categorisation.isLoading}
                  actionError={actionError ?? match.error?.message ?? ignore.error?.message ?? split.error?.message}
                  matchPending={match.isPending}
                  ignorePending={ignore.isPending}
                  applyPending={applyCategory.isPending}
                  onMatch={(journalEntryId) => {
                    setActionError(null);
                    match.mutate({ bankTransactionId: selected.id, journalEntryId });
                  }}
                  onIgnore={() => {
                    setActionError(null);
                    ignore.mutate(selected.id);
                  }}
                  onSplit={() => setSplitOpen(true)}
                  onCreate={() => setJournalOpen(true)}
                  onApplyCategory={() => applyCategory.mutate(selected.id)}
                />
              )}
            </section>
          </div>
        </div>
      )}
      {splitOpen && selected ? (
        <SplitModal
          transaction={selected}
          ledgers={counterpartLedgers}
          pending={split.isPending}
          error={split.error?.message}
          onClose={() => setSplitOpen(false)}
          onSubmit={(allocations) => {
            split.mutate(
              { bankTransactionId: selected.id, allocations },
              { onSuccess: () => setSplitOpen(false) },
            );
          }}
        />
      ) : null}
      {journalOpen && selected ? (
        <CreateJournalModal
          transaction={selected}
          ledgers={counterpartLedgers}
          pending={match.isPending}
          error={actionError}
          onClose={() => setJournalOpen(false)}
          onSubmit={(ledgerAccountId) => void createJournal(ledgerAccountId)}
        />
      ) : null}
    </RequireStaff>
  );
}

function SelectedActions({
  transaction,
  matches,
  categorisation,
  categorisationLoading,
  actionError,
  matchPending,
  ignorePending,
  applyPending,
  onMatch,
  onIgnore,
  onSplit,
  onCreate,
  onApplyCategory,
}: {
  transaction: BankTransactionRecord;
  matches: Array<{ bankTransactionId: string; journalEntryId: string; score: number; reasons: string[]; journal?: { id: string; date: string; description: string; reference?: string | null; total: number } | null }>;
  categorisation?: {
    suggestedLedger: { code: number; name: string };
    suggestedTaxCode: { code: string | null };
    suggestedItsa?: { category?: string | null };
    confidence: number;
    reasons: string[];
  } | null;
  categorisationLoading: boolean;
  actionError?: string | null;
  matchPending: boolean;
  ignorePending: boolean;
  applyPending: boolean;
  onMatch: (journalEntryId: string) => void;
  onIgnore: () => void;
  onSplit: () => void;
  onCreate: () => void;
  onApplyCategory: () => void;
}) {
  const open = transaction.status === "UNMATCHED";
  return (
    <div className="space-y-3">
      {transaction.matchedJournal ? (
        <p className="rounded-xl border border-success/20 bg-success-soft px-4 py-3 text-sm text-success">
          Matched to {transaction.matchedJournal.description}
          {transaction.matchedJournal.reference ? ` (${transaction.matchedJournal.reference})` : ""}.
        </p>
      ) : null}
      {matches.map((suggestion) => (
        <SuggestedMatchCard
          key={`${suggestion.bankTransactionId}-${suggestion.journalEntryId}`}
          suggestion={suggestion}
          pending={matchPending}
          onMatch={() => onMatch(suggestion.journalEntryId)}
        />
      ))}
      {categorisationLoading ? <LoadingSpinner label="Scoring a new journal…" /> : null}
      {open && categorisation ? (
        <article className="rounded-xl border border-line bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Auto-categorisation</p>
          <h3 className="mt-1 font-semibold text-ink">
            {categorisation.suggestedLedger.code} {categorisation.suggestedLedger.name}
          </h3>
          <p className="mt-1 text-sm text-ink-muted">
            VAT {categorisation.suggestedTaxCode.code ?? "—"}
            {categorisation.suggestedItsa?.category ? ` · ${categorisation.suggestedItsa.category}` : ""}
            {` · ${Math.round(categorisation.confidence * 100)}% confidence`}
          </p>
          <div className="mt-4">
            <button
              type="button"
              disabled={applyPending}
              onClick={onApplyCategory}
              className="rounded-lg bg-teal px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-dark disabled:opacity-60"
            >
              {applyPending ? "Posting…" : "Create new journal"}
            </button>
          </div>
        </article>
      ) : null}
      {open && matches.length === 0 && !categorisation && !categorisationLoading ? (
        <p className="rounded-xl border border-dashed border-line bg-white p-6 text-sm text-ink-muted">
          No suggested journals for this line. Create one, split it, or ignore it.
        </p>
      ) : null}
      {actionError ? <ErrorBanner title="Reconciliation failed" message={actionError} /> : null}
      {open ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onCreate}
            className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-semibold text-ink hover:border-teal/40"
          >
            Create new journal
          </button>
          <button
            type="button"
            onClick={onSplit}
            className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-semibold text-ink hover:border-teal/40"
          >
            Split
          </button>
          <IgnoreButton onClick={onIgnore} pending={ignorePending} />
        </div>
      ) : null}
    </div>
  );
}
