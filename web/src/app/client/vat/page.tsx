"use client";

import { ErrorBanner } from "@/components/ErrorBanner";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { WorkspaceGate } from "@/components/WorkspaceGate";
import { useClientWorkspace } from "@/hooks/useClientWorkspace";
import { useSession } from "@/hooks/useSession";
import { formatDate, obligationStatus } from "@/lib/format";

export default function ClientVatPage() {
  const { user } = useSession();
  const { obligations } = useClientWorkspace();
  const rows = obligations.data?.vat ?? [];

  return (
    <WorkspaceGate allow="client" clientId={user?.clientId}>
      <div className="space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">VAT</p>
          <h1 className="mt-1 text-3xl font-semibold text-ink">Your VAT periods</h1>
          <p className="mt-2 text-sm text-ink-muted">Only obligations attached to your client record are listed.</p>
        </div>
        {obligations.isError ? <ErrorBanner title="VAT periods unavailable" message="Try again in a moment." /> : null}
        {obligations.isLoading ? <LoadingSpinner label="Loading VAT periods…" /> : null}
        <section className="overflow-hidden rounded-2xl border border-line bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-paper text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Period</th>
                <th className="px-4 py-3 font-semibold">Due date</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => {
                const status = obligationStatus(item.status);
                return (
                  <tr key={item.id} className="border-t border-line">
                    <td className="px-4 py-4">
                      <p className="font-medium">{item.periodKey}</p>
                      <p className="text-ink-muted">
                        {formatDate(item.start)} – {formatDate(item.end)}
                      </p>
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
            <p className="px-4 py-6 text-sm text-ink-muted">No VAT periods have been fetched for you yet.</p>
          ) : null}
        </section>
      </div>
    </WorkspaceGate>
  );
}
