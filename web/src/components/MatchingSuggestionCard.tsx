"use client";

import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { ReasonChips } from "@/components/ReasonChips";
import { formatDate, formatMoney } from "@/lib/format";
import { matchingKindLabel, type MatchingSuggestion } from "@/lib/matching";

export function MatchingSuggestionCard({
  suggestion,
  selected,
  onSelect,
}: {
  suggestion: MatchingSuggestion;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const credit = suggestion.bankTransaction.type === "CREDIT";
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-xl border px-4 py-3 text-left transition ${
        selected ? "border-teal bg-teal/5" : "border-line bg-white hover:border-teal/40"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">
            {matchingKindLabel(suggestion.documentKind)}
          </p>
          <p className="mt-1 truncate font-medium text-ink">
            {suggestion.documentReference ?? suggestion.partyName ?? suggestion.documentId}
          </p>
          <p className="mt-0.5 truncate text-xs text-ink-muted">
            {suggestion.bankTransaction.merchantName || suggestion.bankTransaction.description}
            {` · ${formatDate(suggestion.bankTransaction.date)}`}
          </p>
        </div>
        <div className="text-right">
          <p className={`font-semibold ${credit ? "text-success" : "text-ink"}`}>
            {credit ? "+" : "−"}
            {formatMoney(suggestion.bankTransaction.amount)}
          </p>
          <div className="mt-1">
            <ConfidenceBadge value={suggestion.confidence} />
          </div>
        </div>
      </div>
      <div className="mt-3">
        <ReasonChips reasons={suggestion.reasons.slice(0, 4)} />
      </div>
    </button>
  );
}
