"use client";

import Link from "next/link";
import { ErrorBanner } from "@/components/ErrorBanner";
import { FirmStatsCard } from "@/components/FirmStatsCard";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { WorkspaceGate } from "@/components/WorkspaceGate";
import { useAdminFirms } from "@/hooks/useAdmin";

export default function AdminOverviewPage() {
  const firms = useAdminFirms();
  const rows = firms.data ?? [];
  const totals = rows.reduce(
    (sum, row) => ({
      firms: sum.firms + 1,
      clients: sum.clients + row.totalClients,
      users: sum.users + row.totalFirmUsers,
      vat: sum.vat + row.totalVatReturns,
    }),
    { firms: 0, clients: 0, users: 0, vat: 0 },
  );

  return (
    <WorkspaceGate allow="platform">
      <div className="space-y-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Platform admin console</p>
          <h2 className="mt-1 text-2xl font-semibold text-ink">Aggregated firm counts</h2>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">
            Platform staff see tenant totals only. Client records, documents, and bank lines stay inside each firm.
          </p>
        </div>
        {firms.isError ? <ErrorBanner title="Firms unavailable" message={firms.error.message} /> : null}
        {firms.isLoading ? <LoadingSpinner label="Loading platform totals…" /> : null}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <FirmStatsCard label="Firms" value={totals.firms} hint="Accountancy tenants on the platform" />
          <FirmStatsCard label="Clients" value={totals.clients} hint="Count only — no client names" />
          <FirmStatsCard label="Firm users" value={totals.users} hint="Admins, accountants, staff and clients" />
          <FirmStatsCard label="VAT returns" value={totals.vat} hint="Submitted returns across all firms" />
        </div>
        <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-ink">Firms</h3>
            <Link href="/admin/firms" className="text-sm font-semibold text-teal hover:underline">
              View all
            </Link>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.12em] text-ink-muted">
                <tr>
                  <th className="py-2 font-semibold">Firm</th>
                  <th className="py-2 font-semibold">Plan</th>
                  <th className="py-2 font-semibold">Clients</th>
                  <th className="py-2 font-semibold">Users</th>
                  <th className="py-2 font-semibold">VAT</th>
                  <th className="py-2 font-semibold">ITSA</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-line">
                    <td className="py-3">
                      <Link href={`/admin/firms/${row.id}/stats`} className="font-medium text-teal hover:underline">
                        {row.name}
                      </Link>
                      <p className="text-xs text-ink-muted">{row.slug}</p>
                    </td>
                    <td className="py-3 capitalize">{row.subscriptionPlan}</td>
                    <td className="py-3">{row.totalClients}</td>
                    <td className="py-3">{row.totalFirmUsers}</td>
                    <td className="py-3">{row.totalVatReturns}</td>
                    <td className="py-3">{row.totalItsaSubmissions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && !firms.isLoading ? <p className="py-6 text-sm text-ink-muted">No firms yet.</p> : null}
          </div>
        </section>
      </div>
    </WorkspaceGate>
  );
}
