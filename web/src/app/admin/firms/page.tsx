"use client";

import Link from "next/link";
import { ErrorBanner } from "@/components/ErrorBanner";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { WorkspaceGate } from "@/components/WorkspaceGate";
import { useAdminFirms } from "@/hooks/useAdmin";

export default function AdminFirmsPage() {
  const firms = useAdminFirms();
  const rows = firms.data ?? [];

  return (
    <WorkspaceGate allow="platform">
      <div className="space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Tenants</p>
          <h2 className="mt-1 text-2xl font-semibold text-ink">Accountancy firms</h2>
          <p className="mt-2 text-sm text-ink-muted">
            Each row is a tenant. Counts are aggregated. Client-level data is never loaded here.
          </p>
        </div>
        {firms.isError ? <ErrorBanner title="Unable to list firms" message={firms.error.message} /> : null}
        {firms.isLoading ? <LoadingSpinner label="Loading firms…" /> : null}
        <section className="overflow-hidden rounded-2xl border border-line bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-paper text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Firm</th>
                <th className="px-4 py-3 font-semibold">Slug</th>
                <th className="px-4 py-3 font-semibold">Plan</th>
                <th className="px-4 py-3 font-semibold">Clients</th>
                <th className="px-4 py-3 font-semibold">Users</th>
                <th className="px-4 py-3 font-semibold">VAT returns</th>
                <th className="px-4 py-3 font-semibold">ITSA</th>
                <th className="px-4 py-3 font-semibold"> </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="px-4 py-4 font-medium">{row.name}</td>
                  <td className="px-4 py-4">{row.slug}</td>
                  <td className="px-4 py-4 capitalize">{row.subscriptionPlan}</td>
                  <td className="px-4 py-4">{row.totalClients}</td>
                  <td className="px-4 py-4">{row.totalFirmUsers}</td>
                  <td className="px-4 py-4">{row.totalVatReturns}</td>
                  <td className="px-4 py-4">{row.totalItsaSubmissions}</td>
                  <td className="px-4 py-4 text-right">
                    <Link href={`/admin/firms/${row.id}/stats`} className="font-semibold text-teal hover:underline">
                      Stats
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && !firms.isLoading ? <p className="px-4 py-6 text-sm text-ink-muted">No firms to show.</p> : null}
        </section>
      </div>
    </WorkspaceGate>
  );
}
