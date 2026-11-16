"use client";

import Link from "next/link";
import { ErrorBanner } from "@/components/ErrorBanner";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { WorkspaceGate } from "@/components/WorkspaceGate";
import { useFirmWorkspace } from "@/hooks/useFirmWorkspace";
import { useSession } from "@/hooks/useSession";
import { formatDate } from "@/lib/format";

export default function PracticeDocumentsPage() {
  const { user } = useSession();
  const { documents, clients } = useFirmWorkspace();
  const rows = documents.data ?? [];

  return (
    <WorkspaceGate allow="practice" firmId={user?.firmId}>
      <div className="space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Documents</p>
          <h2 className="mt-1 text-2xl font-semibold text-ink">Firm document library</h2>
          <p className="mt-2 text-sm text-ink-muted">
            Files uploaded for clients in your firm. Another practice&apos;s documents are never requested.
          </p>
        </div>
        {documents.isError ? <ErrorBanner title="Documents unavailable" message={documents.error.message} /> : null}
        {documents.isLoading ? <LoadingSpinner label="Loading documents…" /> : null}
        <section className="overflow-hidden rounded-2xl border border-line bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-paper text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">File</th>
                <th className="px-4 py-3 font-semibold">Client</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Uploaded</th>
                <th className="px-4 py-3 font-semibold"> </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const client = (clients.data ?? []).find((item) => item.id === row.clientId);
                return (
                  <tr key={row.id} className="border-t border-line">
                    <td className="px-4 py-4 font-medium">{row.fileName}</td>
                    <td className="px-4 py-4">{client?.name ?? row.clientId}</td>
                    <td className="px-4 py-4">{row.type ?? "—"}</td>
                    <td className="px-4 py-4">{formatDate(row.uploadedAt)}</td>
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
          {!rows.length && !documents.isLoading ? (
            <p className="px-4 py-6 text-sm text-ink-muted">No documents uploaded for this firm yet.</p>
          ) : null}
        </section>
      </div>
    </WorkspaceGate>
  );
}
