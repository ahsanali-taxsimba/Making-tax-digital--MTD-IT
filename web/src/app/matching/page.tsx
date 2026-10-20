"use client";

import { useEffect, useMemo, useState } from "react";
import { BankWorkspaceNav } from "@/components/BankWorkspaceNav";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { ErrorBanner } from "@/components/ErrorBanner";
import { FirmStatsCard } from "@/components/FirmStatsCard";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { MatchingSuggestionCard } from "@/components/MatchingSuggestionCard";
import { ReasonChips } from "@/components/ReasonChips";
import { RequireStaff } from "@/components/RequireStaff";
import { useApplyMatching, useMatchingSuggestions, useRejectMatching } from "@/hooks/useMatching";
import { useSession } from "@/hooks/useSession";
import { formatDate, formatMoney } from "@/lib/format";
import { matchingKindLabel, type MatchingSuggestion } from "@/lib/matching";

const SIGNAL_LABELS: Array<{ key: keyof MatchingSuggestion["signals"]; label: string }> = [
  { key: "exactAmount", label: "Exact amount" },
  { key: "amountTolerance", label: "Amount tolerance" },
  { key: "dateProximity", label: "Date proximity" },
  { key: "invoiceReference", label: "Invoice reference" },
  { key: "merchantSimilarity", label: "Merchant similarity" },
  { key: "recurring", label: "Recurring payment" },
  { key: "mccAlignment", label: "MCC alignment" },
];

export default function MatchingWorkspacePage() {
  const { clientId } = useSession();
  const suggestions = useMatchingSuggestions({ clientId });
  const apply = useApplyMatching(clientId);
  const reject = useRejectMatching(clientId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [kind, setKind] = useState<"all" | "invoice" | "bill">("all");

  const rows = useMemo(
    () =>
      (suggestions.data?.suggestions ?? []).filter((item) => (kind === "all" ? true : item.documentKind === kind)),
    [suggestions.data, kind],
  );
  const selected = rows.find((row) => row.id === selectedId) ?? rows[0] ?? null;

  useEffect(() => {
    if (selected?.id && selected.id !== selectedId) {
      setSelectedId(selected.id);
    }
  }, [selected, selectedId]);

  const invoices = (suggestions.data?.suggestions ?? []).filter((item) => item.documentKind === "invoice").length;
  const bills = (suggestions.data?.suggestions ?? []).filter((item) => item.documentKind === "bill").length;

  return (
    <RequireStaff>
      <div className="space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-ink-muted">Sales invoices and purchase bills</p>
            <h2 className="mt-1 text-2xl font-semibold text-ink">Invoice & bill matching</h2>
          </div>
          <BankWorkspaceNav />
        </div>
        {!clientId ? (
          <ErrorBanner title="Select a client" message="Choose a client in the top bar to match bank lines." />
        ) : suggestions.isError ? (
          <ErrorBanner title="Matching unavailable" message={suggestions.error.message} />
        ) : suggestions.isLoading ? (
          <LoadingSpinner label="Scoring invoices and bills against the bank feed…" />
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <FirmStatsCard label="Open suggestions" value={suggestions.data?.count ?? 0} hint="Unmatched lines with a document pair" />
              <FirmStatsCard label="Invoices" value={invoices} hint="Credits against sales invoices" />
              <FirmStatsCard label="Bills" value={bills} hint="Debits against purchase bills" />
            </div>
            <select
              className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm"
              value={kind}
              onChange={(event) => setKind(event.target.value as "all" | "invoice" | "bill")}
              aria-label="Document kind filter"
            >
              <option value="all">Invoices and bills</option>
              <option value="invoice">Invoices only</option>
              <option value="bill">Bills only</option>
            </select>
            <div className="grid gap-6 xl:grid-cols-2">
              <section className="space-y-3">
                <h3 className="text-lg font-semibold text-ink">Suggested matches</h3>
                {rows.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-line bg-white p-6 text-sm text-ink-muted">
                    No invoice or bill suggestions for unmatched bank lines.
                  </p>
                ) : (
                  rows.map((suggestion) => (
                    <MatchingSuggestionCard
                      key={suggestion.id ?? suggestion.bankTransactionId}
                      suggestion={suggestion}
                      selected={suggestion.id === selected?.id}
                      onSelect={() => setSelectedId(suggestion.id)}
                    />
                  ))
                )}
              </section>
              <section>
                <h3 className="text-lg font-semibold text-ink">Match detail</h3>
                {selected ? (
                  <MatchingDetail
                    suggestion={selected}
                    applyPending={apply.isPending}
                    rejectPending={reject.isPending}
                    error={apply.error?.message ?? reject.error?.message}
                    onApply={() => selected.id && apply.mutate(selected.id)}
                    onReject={() => selected.id && reject.mutate(selected.id)}
                  />
                ) : (
                  <p className="mt-3 rounded-xl border border-dashed border-line bg-white p-6 text-sm text-ink-muted">
                    Select a suggestion to review confidence signals and post the settlement.
                  </p>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </RequireStaff>
  );
}

function MatchingDetail({
  suggestion,
  applyPending,
  rejectPending,
  error,
  onApply,
  onReject,
}: {
  suggestion: MatchingSuggestion;
  applyPending: boolean;
  rejectPending: boolean;
  error?: string;
  onApply: () => void;
  onReject: () => void;
}) {
  return (
    <article className="mt-3 space-y-4 rounded-2xl border border-line bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
            {matchingKindLabel(suggestion.documentKind)}
          </p>
          <h4 className="mt-1 text-lg font-semibold text-ink">
            {suggestion.documentReference ?? suggestion.partyName ?? "Document match"}
          </h4>
          <p className="mt-1 text-sm text-ink-muted">{suggestion.partyName}</p>
        </div>
        <ConfidenceBadge value={suggestion.confidence} />
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-ink-muted">Bank line</dt>
          <dd className="mt-1 font-semibold">
            {suggestion.bankTransaction.merchantName || suggestion.bankTransaction.description}
          </dd>
          <dd className="text-ink-muted">
            {formatDate(suggestion.bankTransaction.date)} · {formatMoney(suggestion.bankTransaction.amount)}
          </dd>
        </div>
        <div>
          <dt className="text-ink-muted">Settlement</dt>
          <dd className="mt-1 font-semibold">
            {suggestion.documentKind === "invoice" ? "Bank Dr / Debtors Cr" : "Creditors Dr / Bank Cr"}
          </dd>
          <dd className="text-ink-muted">
            {suggestion.signals.dateGapDays === 0 ? "Same date" : `${suggestion.signals.dateGapDays} day gap`}
            {suggestion.signals.amountGap ? ` · £${suggestion.signals.amountGap} amount gap` : ""}
          </dd>
        </div>
      </dl>
      <ReasonChips reasons={suggestion.reasons} />
      <ul className="grid gap-2 sm:grid-cols-2">
        {SIGNAL_LABELS.map((signal) => (
          <li
            key={signal.key}
            className={`rounded-lg px-3 py-2 text-sm ${
              suggestion.signals[signal.key] ? "bg-success-soft text-success" : "bg-paper text-ink-muted"
            }`}
          >
            {signal.label}
            {signal.key === "merchantSimilarity"
              ? ` · ${Math.round(Number(suggestion.signals.merchantSimilarity) * 100)}%`
              : ""}
          </li>
        ))}
      </ul>
      {error ? <ErrorBanner title="Matching action failed" message={error} /> : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={applyPending || !suggestion.id}
          onClick={onApply}
          className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-dark disabled:opacity-60"
        >
          {applyPending ? "Posting settlement…" : "Apply match"}
        </button>
        <button
          type="button"
          disabled={rejectPending || !suggestion.id}
          onClick={onReject}
          className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink hover:border-danger/40 hover:text-danger disabled:opacity-60"
        >
          {rejectPending ? "Rejecting…" : "Reject"}
        </button>
      </div>
    </article>
  );
}
