"use client";

import { ErrorBanner } from "@/components/ErrorBanner";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { WorkspaceGate } from "@/components/WorkspaceGate";
import { useClientWorkspace } from "@/hooks/useClientWorkspace";
import { useSession } from "@/hooks/useSession";
import { formatDate, obligationStatus } from "@/lib/format";

export default function ClientItsaPage() {
  const { user } = useSession();
  const { obligations } = useClientWorkspace();
  const rows = obligations.data?.itsa ?? [];

  return (
    <WorkspaceGate allow="client" clientId={user?.clientId}>
      <div className="space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Income Tax</p>
          <h1 className="mt-1 text-3xl font-semibold text-ink">Your ITSA updates</h1>
          <p className="mt-2 text-sm text-ink-muted">Quarterly obligations for your own businesses only.</p>
        </div>
        {obligations.isError ? <ErrorBanner title="ITSA updates unavailable" message="Try again in a moment." /> : null}
        {obligations.isLoading ? <LoadingSpinner label="Loading ITSA updates…" /> : null}
        <section className="overflow-hidden rounded-2xl border border-line bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-paper text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Tax year</th>
                <th className="px-4 py-3 font-semibold">Period</th>
                <th className="px-4 py-3 font-semibold">Due</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => {
                const status = obligationStatus(item.status);
                return (
                  <tr key={item.id} className="border-t border-line">
                    <td className="px-4 py-4 font-medium">{item.type}</td>
                    <td className="px-4 py-4">{item.taxYear}</td>
                    <td className="px-4 py-4">
                      {formatDate(item.start)} – {formatDate(item.end)}
                    </td>
                    <td className="px-4 py-4">{formatDate(item.due)}</td>
                    <td className="px-4 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${
                          status === "open" ? "bg-amber-50 text-amber-800" : "bg-success-soft text-success"
                        }`}
                      >
                        {status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!rows.length && !obligations.isLoading ? (
            <p className="px-4 py-6 text-sm text-ink-muted">No ITSA obligations have been fetched for you yet.</p>
          ) : null}
        </section>
      </div>
    </WorkspaceGate>
  );
}
