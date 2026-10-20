"use client";

import Link from "next/link";
import { ErrorBanner } from "@/components/ErrorBanner";
import { FirmStatsCard } from "@/components/FirmStatsCard";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ReconciliationProgressBar } from "@/components/ReconciliationProgressBar";
import { RequireStaff } from "@/components/RequireStaff";
import { useBankAccounts } from "@/hooks/useBankAccounts";
import { useSession } from "@/hooks/useSession";
import { formatDate, formatMoney } from "@/lib/format";
import { maskAccountNumber } from "@/lib/reconciliation";

export default function ReconciliationDashboardPage() {
  const { clientId } = useSession();
  const accounts = useBankAccounts(clientId);
  const rows = accounts.data ?? [];
  const unmatched = rows.reduce((sum, row) => sum + row.unmatchedCount, 0);
  const total = rows.reduce((sum, row) => sum + row.transactionCount, 0);
  const lastSync = rows
    .map((row) => row.lastSyncAt)
    .filter(Boolean)
    .sort()
    .at(-1);

  return (
    <RequireStaff>
      <div className="space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-ink-muted">Yapily bank feeds</p>
            <h2 className="mt-1 text-2xl font-semibold text-ink">Reconciliation dashboard</h2>
          </div>
        </div>
        {!clientId ? (
          <ErrorBanner title="Select a client" message="Choose a client in the top bar to load bank accounts." />
        ) : accounts.isError ? (
          <ErrorBanner title="Bank accounts unavailable" message={accounts.error.message} />
        ) : accounts.isLoading ? (
          <LoadingSpinner label="Loading bank accounts…" />
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <FirmStatsCard label="Bank accounts" value={rows.length} hint="Starling, Yapily and imported feeds" />
              <FirmStatsCard label="Unreconciled" value={unmatched} hint="Lines still waiting for a match" />
              <FirmStatsCard label="Last sync" value={lastSync ? formatDate(lastSync) : "—"} hint="Account updated timestamp" />
            </div>
            <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
              <ReconciliationProgressBar transactionCount={total} unmatchedCount={unmatched} />
            </section>
            <section className="space-y-3">
              {rows.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-line bg-white p-8 text-sm text-ink-muted">
                  No bank accounts yet. Sync Yapily or add an account in bookkeeping.
                </p>
              ) : (
                rows.map((account) => (
                  <Link
                    key={account.id}
                    href={`/reconciliation/${account.id}`}
                    className="block rounded-2xl border border-line bg-white p-5 shadow-sm hover:border-teal/40"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-semibold text-ink">{account.name}</h3>
                        <p className="mt-1 text-sm text-ink-muted">
                          {account.sortCode ?? "—"} · {maskAccountNumber(account.accountNumber)} · {account.provider ?? "manual"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold text-ink">{formatMoney(account.balance)}</p>
                        <p className="mt-1 text-sm text-ink-muted">{account.unmatchedCount} unmatched</p>
                      </div>
                    </div>
                    <div className="mt-4">
                      <ReconciliationProgressBar transactionCount={account.transactionCount} unmatchedCount={account.unmatchedCount} />
                    </div>
                    <p className="mt-3 text-xs text-ink-muted">Last sync {formatDate(account.lastSyncAt)}</p>
                  </Link>
                ))
              )}
            </section>
          </>
        )}
      </div>
    </RequireStaff>
  );
}
