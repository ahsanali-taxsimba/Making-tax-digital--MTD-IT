"use client";

import Link from "next/link";
import { ErrorBanner } from "@/components/ErrorBanner";
import { FirmStatsCard } from "@/components/FirmStatsCard";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { WorkspaceGate } from "@/components/WorkspaceGate";
import { useAdminBillingMetrics, useAdminBillingSubscribers } from "@/hooks/useBilling";
import { formatGbp } from "@/lib/billing";

export default function AdminBillingPage() {
  const metrics = useAdminBillingMetrics();
  const subscribers = useAdminBillingSubscribers();
  const data = metrics.data;
  const rows = subscribers.data ?? [];

  return (
    <WorkspaceGate allow="platform">
      <div className="space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Platform billing</p>
            <h2 className="mt-1 text-2xl font-semibold text-ink">Revenue</h2>
            <p className="mt-2 max-w-2xl text-sm text-ink-muted">
              Aggregated subscription metrics. Client records never leave the tenant.
            </p>
          </div>
          <Link href="/admin/billing/plans" className="rounded-xl bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-dark">
            Edit plans
          </Link>
        </div>
        {metrics.isError ? <ErrorBanner title="Metrics unavailable" message={metrics.error.message} /> : null}
        {metrics.isLoading ? <LoadingSpinner label="Loading revenue…" /> : null}
        {data ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <FirmStatsCard label="MRR" value={formatGbp(data.mrrPence)} hint="Active subscriptions including VAT" />
            <FirmStatsCard label="ARR" value={formatGbp(data.arrPence)} hint="MRR × 12" />
            <FirmStatsCard label="Recognised this month" value={formatGbp(data.recognisedRevenuePence)} hint={`${formatGbp(data.vatCollectedPence)} VAT collected`} />
            <FirmStatsCard label="Active subscribers" value={data.activeSubscribers} hint={`${data.trialing} trial · ${data.pastDue} past due`} />
          </div>
        ) : null}
        <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-ink">By plan</h3>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.12em] text-ink-muted">
                <tr>
                  <th className="py-2 font-semibold">Plan</th>
                  <th className="py-2 font-semibold">Subscribers</th>
                  <th className="py-2 font-semibold">MRR</th>
                </tr>
              </thead>
              <tbody>
                {(data?.byPlan ?? []).map((row) => (
                  <tr key={row.slug} className="border-t border-line">
                    <td className="py-3">{row.name}</td>
                    <td className="py-3">{row.subscribers}</td>
                    <td className="py-3">{formatGbp(row.mrrPence)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-ink">Subscribers</h3>
          {subscribers.isError ? <ErrorBanner title="Subscribers unavailable" message={subscribers.error.message} /> : null}
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.12em] text-ink-muted">
                <tr>
                  <th className="py-2 font-semibold">Firm</th>
                  <th className="py-2 font-semibold">Plan</th>
                  <th className="py-2 font-semibold">Status</th>
                  <th className="py-2 font-semibold">Qty</th>
                  <th className="py-2 font-semibold">MRR</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.firmId} className="border-t border-line">
                    <td className="py-3">
                      {row.firmName}
                      <p className="text-xs text-ink-muted">{row.slug}</p>
                    </td>
                    <td className="py-3">{row.planName}</td>
                    <td className="py-3 capitalize">{row.status}</td>
                    <td className="py-3">{row.quantity}</td>
                    <td className="py-3">{formatGbp(row.mrrPence)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && !subscribers.isLoading ? <p className="py-6 text-sm text-ink-muted">No subscribers yet.</p> : null}
          </div>
        </section>
      </div>
    </WorkspaceGate>
  );
}
