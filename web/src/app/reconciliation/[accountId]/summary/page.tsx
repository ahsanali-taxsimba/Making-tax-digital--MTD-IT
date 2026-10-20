"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { BankTransactionRow } from "@/components/BankTransactionRow";
import { ErrorBanner } from "@/components/ErrorBanner";
import { FirmStatsCard } from "@/components/FirmStatsCard";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ReconciliationProgressBar } from "@/components/ReconciliationProgressBar";
import { RequireStaff } from "@/components/RequireStaff";
import { useReconciliationSummary } from "@/hooks/useReconciliation";
import { formatDate, formatMoney } from "@/lib/format";

export default function ReconciliationSummaryPage() {
  const params = useParams<{ accountId: string }>();
  const [statement, setStatement] = useState("");
  const summary = useReconciliationSummary(params.accountId, statement ? Number(statement) : undefined);
  const data = summary.data;

  return (
    <RequireStaff>
      {summary.isError ? (
        <ErrorBanner title="Summary unavailable" message={summary.error.message} />
      ) : summary.isLoading || !data ? (
        <LoadingSpinner label="Loading reconciliation summary…" />
      ) : (
        <div className="space-y-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <Link href={`/reconciliation/${params.accountId}`} className="text-sm font-semibold text-teal hover:underline">
                Back to workspace
              </Link>
              <h2 className="mt-1 text-2xl font-semibold text-ink">{data.account.name} summary</h2>
              <p className="mt-1 text-sm text-ink-muted">
                {formatDate(data.periodStart)} – {formatDate(data.periodEnd)}
              </p>
            </div>
            <label className="text-sm">
              <span className="mr-2 text-ink-muted">Statement balance</span>
              <input
                type="number"
                step="0.01"
                className="w-36 rounded-lg border border-line px-3 py-1.5"
                value={statement}
                onChange={(event) => setStatement(event.target.value)}
                placeholder={String(data.statementBalance)}
              />
            </label>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <FirmStatsCard label="Reconciled" value={data.reconciledCount} hint="Matched, reconciled or ignored" />
            <FirmStatsCard label="Remaining" value={data.remainingCount} hint="Still unmatched" />
            <FirmStatsCard label="Ledger balance" value={formatMoney(data.ledgerBalance)} hint="Bank control account" />
            <FirmStatsCard label="Variance" value={formatMoney(data.variance)} hint="Statement minus ledger" />
          </div>
          <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
            <ReconciliationProgressBar transactionCount={data.total} unmatchedCount={data.unmatchedCount} />
            <dl className="mt-5 grid gap-4 sm:grid-cols-3 text-sm">
              <div>
                <dt className="text-ink-muted">Bank credits</dt>
                <dd className="mt-1 font-semibold">{formatMoney(data.bankCredits)}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">Bank debits</dt>
                <dd className="mt-1 font-semibold">{formatMoney(data.bankDebits)}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">Statement balance</dt>
                <dd className="mt-1 font-semibold">{formatMoney(data.statementBalance)}</dd>
              </div>
            </dl>
          </section>
          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-ink">Remaining unmatched</h3>
            {data.unmatched.length === 0 ? (
              <p className="rounded-xl border border-success/20 bg-success-soft px-4 py-3 text-sm text-success">
                This account is fully reconciled for the period.
              </p>
            ) : (
              data.unmatched.map((transaction) => <BankTransactionRow key={transaction.id} transaction={transaction} />)
            )}
          </section>
        </div>
      )}
    </RequireStaff>
  );
}
