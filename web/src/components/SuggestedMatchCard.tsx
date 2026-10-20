"use client";

import { formatDate, formatMoney } from "@/lib/format";
import type { ReconciliationSuggestion } from "@/lib/reconciliation";
import { MatchButton } from "./MatchButton";

export function SuggestedMatchCard({
  suggestion,
  pending,
  onMatch,
}: {
  suggestion: ReconciliationSuggestion;
  pending?: boolean;
  onMatch: () => void;
}) {
  return (
    <article className="rounded-xl border border-line bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Suggested journal</p>
          <h3 className="mt-1 font-semibold text-ink">{suggestion.journal?.description ?? "Journal match"}</h3>
          <p className="mt-1 text-sm text-ink-muted">
            {formatDate(suggestion.journal?.date)}
            {suggestion.journal?.reference ? ` · ${suggestion.journal.reference}` : ""}
          </p>
        </div>
        <p className="text-sm font-semibold text-teal">{Math.round(suggestion.score)}% match</p>
      </div>
      <p className="mt-3 text-lg font-semibold text-ink">{formatMoney(suggestion.journal?.total)}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {suggestion.reasons.map((reason) => (
          <span key={reason} className="rounded-full bg-paper px-2 py-0.5 text-xs text-ink-muted">
            {reason.replace(/_/g, " ")}
          </span>
        ))}
      </div>
      <div className="mt-4">
        <MatchButton onClick={onMatch} pending={pending} />
      </div>
    </article>
  );
}
