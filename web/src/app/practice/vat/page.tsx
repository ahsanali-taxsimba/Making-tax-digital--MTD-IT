"use client";

import Link from "next/link";
import { ErrorBanner } from "@/components/ErrorBanner";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { WorkspaceGate } from "@/components/WorkspaceGate";
import { useFirmWorkspace } from "@/hooks/useFirmWorkspace";
import { useSession } from "@/hooks/useSession";
import { formatDate } from "@/lib/format";

export default function PracticeVatPage() {
  const { user } = useSession();
  const { vat, clients } = useFirmWorkspace();
  const rows = vat.data ?? [];

  return (
    <WorkspaceGate allow="practice" firmId={user?.firmId}>
      <div className="space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">VAT</p>
          <h2 className="mt-1 text-2xl font-semibold text-ink">VAT returns</h2>
          <p className="mt-2 text-sm text-ink-muted">Returns for clients that belong to your firm only.</p>
        </div>
        {vat.isError ? <ErrorBanner title="VAT returns unavailable" message={vat.error.message} /> : null}
        {vat.isLoading ? <LoadingSpinner label="Loading VAT returns…" /> : null}
        <section className="overflow-hidden rounded-2xl border border-line bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-paper text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Client</th>
                <th className="px-4 py-3 font-semibold">Period</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Created</th>
                <th className="px-4 py-3 font-semibold"> </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const client = (clients.data ?? []).find((item) => item.id === row.clientId);
                return (
                  <tr key={row.id} className="border-t border-line">
                    <td className="px-4 py-4 font-medium">{client?.name ?? row.clientId}</td>
                    <td className="px-4 py-4">{row.periodKey}</td>
                    <td className="px-4 py-4">{row.status}</td>
                    <td className="px-4 py-4">{formatDate(row.createdAt)}</td>
                    <td className="px-4 py-4 text-right">
                      <Link href={`/practice/clients/${row.clientId}`} className="font-semibold text-teal hover:underline">
                        Open client
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!rows.length && !vat.isLoading ? <p className="px-4 py-6 text-sm text-ink-muted">No VAT returns for this firm yet.</p> : null}
        </section>
      </div>
    </WorkspaceGate>
  );
}
