"use client";

import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { ReasonChips } from "@/components/ReasonChips";
import { formatMoney } from "@/lib/format";
import type { CategorisationSuggestion } from "@/lib/reconciliation";

export function CategorisationCard({
  suggestion,
  merchant,
  amount,
  type,
  selected,
  onSelect,
}: {
  suggestion: CategorisationSuggestion;
  merchant?: string | null;
  amount?: number;
  type?: string;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const credit = String(type).toUpperCase() === "CREDIT";
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
          <p className="truncate font-medium text-ink">
            {suggestion.suggestedLedger.code} {suggestion.suggestedLedger.name}
          </p>
          <p className="mt-0.5 truncate text-xs text-ink-muted">
            {merchant || "Bank line"}
            {suggestion.suggestedTaxCode.code ? ` · VAT ${suggestion.suggestedTaxCode.code}` : ""}
            {suggestion.suggestedItsa?.category ? ` · ${suggestion.suggestedItsa.category}` : ""}
          </p>
        </div>
        <div className="text-right">
          {amount !== undefined ? (
            <p className={`font-semibold ${credit ? "text-success" : "text-ink"}`}>
              {credit ? "+" : "−"}
              {formatMoney(amount)}
            </p>
          ) : null}
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
