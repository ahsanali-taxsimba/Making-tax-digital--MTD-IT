"use client";

import { useEffect, useMemo, useState } from "react";
import { BankWorkspaceNav } from "@/components/BankWorkspaceNav";
import { CategorisationCard } from "@/components/CategorisationCard";
import { ConfidenceBadge } from "@/components/ConfidenceBadge";
import { ErrorBanner } from "@/components/ErrorBanner";
import { FirmStatsCard } from "@/components/FirmStatsCard";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ReasonChips } from "@/components/ReasonChips";
import { RequireStaff } from "@/components/RequireStaff";
import { useApplyCategorisationSuggestion, useCategorisationRules, useCategorisationSuggestions } from "@/hooks/useCategorisation";
import { useClientBankLines } from "@/hooks/useClientBankLines";
import { useSession } from "@/hooks/useSession";
import { formatDate, formatMoney } from "@/lib/format";
import type { CategorisationSuggestion } from "@/lib/reconciliation";

export default function CategorisationWorkspacePage() {
  const { clientId } = useSession();
  const suggestions = useCategorisationSuggestions(clientId);
  const lines = useClientBankLines(clientId);
  const rules = useCategorisationRules();
  const apply = useApplyCategorisationSuggestion(clientId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "high">("all");
  const [showRules, setShowRules] = useState(false);

  const rows = useMemo(() => {
    const txns = new Map((lines.data ?? []).map((row) => [row.id, row]));
    return (suggestions.data?.suggestions ?? [])
      .filter((item) => item.status !== "APPLIED")
      .map((item) => ({ suggestion: item, transaction: txns.get(item.bankTransactionId) }))
      .filter((item) => (filter === "high" ? item.suggestion.confidence >= 0.85 : true));
  }, [suggestions.data, lines.data, filter]);

  const selected = rows.find((row) => row.suggestion.bankTransactionId === selectedId) ?? rows[0] ?? null;

  useEffect(() => {
    if (selected && selected.suggestion.bankTransactionId !== selectedId) {
      setSelectedId(selected.suggestion.bankTransactionId);
    }
  }, [selected, selectedId]);

  const high = (suggestions.data?.suggestions ?? []).filter((item) => item.confidence >= 0.85).length;

  return (
    <RequireStaff>
      <div className="space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-ink-muted">Yapily enrichment</p>
            <h2 className="mt-1 text-2xl font-semibold text-ink">Auto-categorisation</h2>
          </div>
          <BankWorkspaceNav />
        </div>
        {!clientId ? (
          <ErrorBanner title="Select a client" message="Choose a client in the top bar to score bank lines." />
        ) : suggestions.isError ? (
          <ErrorBanner title="Categorisation unavailable" message={suggestions.error.message} />
        ) : suggestions.isLoading ? (
          <LoadingSpinner label="Scoring merchant, MCC, VAT and ITSA categories…" />
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <FirmStatsCard label="Suggestions" value={suggestions.data?.count ?? 0} hint="Unmatched lines with a ledger proposal" />
              <FirmStatsCard label="High confidence" value={high} hint="85% or above — ready to post" />
              <FirmStatsCard label="Merchant rules" value={rules.data?.merchants.length ?? "—"} hint="Dictionary plus MCC mappings" />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <select
                className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm"
                value={filter}
                onChange={(event) => setFilter(event.target.value as "all" | "high")}
                aria-label="Categorisation filter"
              >
                <option value="all">All suggestions</option>
                <option value="high">High confidence only</option>
              </select>
              <button
                type="button"
                onClick={() => setShowRules((open) => !open)}
                className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-semibold text-ink hover:border-teal/40"
              >
                {showRules ? "Hide rules" : "View merchant & MCC rules"}
              </button>
            </div>
            {showRules ? <RulesPanel rules={rules.data} loading={rules.isLoading} /> : null}
            <div className="grid gap-6 xl:grid-cols-2">
              <section className="space-y-3">
                <h3 className="text-lg font-semibold text-ink">Suggested categories</h3>
                {rows.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-line bg-white p-6 text-sm text-ink-muted">
                    No unmatched bank lines need categorisation.
                  </p>
                ) : (
                  rows.map(({ suggestion, transaction }) => (
                    <CategorisationCard
                      key={suggestion.bankTransactionId}
                      suggestion={suggestion}
                      merchant={transaction?.merchantName ?? transaction?.description}
                      amount={transaction?.amount}
                      type={transaction?.type}
                      selected={suggestion.bankTransactionId === selected?.suggestion.bankTransactionId}
                      onSelect={() => setSelectedId(suggestion.bankTransactionId)}
                    />
                  ))
                )}
              </section>
              <section>
                <h3 className="text-lg font-semibold text-ink">Draft journal</h3>
                {selected ? (
                  <CategorisationDetail
                    suggestion={selected.suggestion}
                    merchant={selected.transaction?.merchantName}
                    description={selected.transaction?.description}
                    date={selected.transaction?.date}
                    amount={selected.transaction?.amount}
                    mcc={selected.transaction?.merchantCategoryCode}
                    pending={apply.isPending}
                    error={apply.error?.message}
                    onApply={() =>
                      apply.mutate({
                        suggestionId: selected.suggestion.id ?? undefined,
                        bankTransactionId: selected.suggestion.bankTransactionId,
                      })
                    }
                  />
                ) : (
                  <p className="mt-3 rounded-xl border border-dashed border-line bg-white p-6 text-sm text-ink-muted">
                    Select a suggestion to review the ledger, VAT and ITSA draft.
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

function CategorisationDetail({
  suggestion,
  merchant,
  description,
  date,
  amount,
  mcc,
  pending,
  error,
  onApply,
}: {
  suggestion: CategorisationSuggestion;
  merchant?: string | null;
  description?: string;
  date?: string;
  amount?: number;
  mcc?: string | null;
  pending: boolean;
  error?: string;
  onApply: () => void;
}) {
  return (
    <article className="mt-3 space-y-4 rounded-2xl border border-line bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Proposed posting</p>
          <h4 className="mt-1 text-lg font-semibold text-ink">
            {suggestion.suggestedLedger.code} {suggestion.suggestedLedger.name}
          </h4>
          <p className="mt-1 text-sm text-ink-muted">
            {merchant || description || "Bank line"}
            {date ? ` · ${formatDate(date)}` : ""}
            {mcc ? ` · MCC ${mcc}` : ""}
          </p>
        </div>
        <ConfidenceBadge value={suggestion.confidence} />
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-ink-muted">VAT code</dt>
          <dd className="mt-1 font-semibold">{suggestion.suggestedTaxCode.code ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">ITSA category</dt>
          <dd className="mt-1 font-semibold">{suggestion.suggestedItsa?.category ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Amount</dt>
          <dd className="mt-1 font-semibold">{formatMoney(amount)}</dd>
        </div>
      </dl>
      <ReasonChips reasons={suggestion.reasons} />
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-paper text-ink-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Account</th>
              <th className="px-3 py-2 font-medium">Debit</th>
              <th className="px-3 py-2 font-medium">Credit</th>
            </tr>
          </thead>
          <tbody>
            {suggestion.draftJournal.lines.map((line, index) => (
              <tr key={`${line.ledgerAccountId}-${index}`} className="border-t border-line">
                <td className="px-3 py-2">
                  {line.ledgerCode ?? ""} {line.ledgerName ?? line.description ?? line.ledgerAccountId}
                </td>
                <td className="px-3 py-2">{formatMoney(line.debit)}</td>
                <td className="px-3 py-2">{formatMoney(line.credit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error ? <ErrorBanner title="Could not post journal" message={error} /> : null}
      <button
        type="button"
        disabled={pending}
        onClick={onApply}
        className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-dark disabled:opacity-60"
      >
        {pending ? "Posting journal…" : "Apply categorisation"}
      </button>
    </article>
  );
}

function RulesPanel({
  rules,
  loading,
}: {
  rules?: {
    merchants: Array<{ merchantName: string; categoryKey: string; ledgerCode: number }>;
    mcc: Array<{ mcc: string; industry: string; ledgerCode: number; vatable: boolean }>;
  };
  loading: boolean;
}) {
  if (loading || !rules) {
    return <LoadingSpinner label="Loading merchant and MCC rules…" />;
  }
  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
        <h3 className="font-semibold text-ink">Merchant dictionary</h3>
        <ul className="mt-3 space-y-2 text-sm">
          {rules.merchants.slice(0, 8).map((rule) => (
            <li key={rule.merchantName} className="flex justify-between gap-3">
              <span>{rule.merchantName}</span>
              <span className="text-ink-muted">
                {rule.ledgerCode} · {rule.categoryKey.replace(/_/g, " ")}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
        <h3 className="font-semibold text-ink">MCC mappings</h3>
        <ul className="mt-3 space-y-2 text-sm">
          {rules.mcc.slice(0, 8).map((rule) => (
            <li key={rule.mcc} className="flex justify-between gap-3">
              <span>
                {rule.mcc} {rule.industry}
              </span>
              <span className="text-ink-muted">{rule.vatable ? "Standard VAT" : "No VAT"}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
