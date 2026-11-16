"use client";

import { DocumentUpload } from "@/components/DocumentUpload";
import { ErrorBanner } from "@/components/ErrorBanner";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { WorkspaceGate } from "@/components/WorkspaceGate";
import { useClientWorkspace } from "@/hooks/useClientWorkspace";
import { useSession } from "@/hooks/useSession";
import { categoryLabel, formatDate } from "@/lib/format";

export default function ClientDocumentsPage() {
  const { user } = useSession();
  const { documents, clientId } = useClientWorkspace();
  const rows = documents.data ?? [];

  return (
    <WorkspaceGate allow="client" clientId={user?.clientId}>
      <div className="space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Records</p>
          <h1 className="mt-1 text-3xl font-semibold text-ink">Your documents</h1>
          <p className="mt-2 text-sm text-ink-muted">Uploads attach to your client record only.</p>
        </div>
        {documents.isError ? <ErrorBanner title="Documents unavailable" message="Try again in a moment." /> : null}
        <DocumentUpload clientId={clientId} />
        <section className="overflow-hidden rounded-2xl border border-line bg-white">
          {documents.isLoading ? (
            <div className="p-4">
              <LoadingSpinner label="Loading documents…" />
            </div>
          ) : null}
          <table className="min-w-full text-left text-sm">
            <thead className="bg-paper text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">File</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.id} className="border-t border-line">
                  <td className="px-4 py-4 font-medium">{item.fileName}</td>
                  <td className="px-4 py-4">{categoryLabel(item.category)}</td>
                  <td className="px-4 py-4">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${
                        item.status === "USED" ? "bg-success-soft text-success" : "bg-amber-50 text-amber-800"
                      }`}
                    >
                      {item.status === "USED" ? "used" : "pending"}
                    </span>
                  </td>
                  <td className="px-4 py-4">{formatDate(item.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && !documents.isLoading ? (
            <p className="px-4 py-6 text-sm text-ink-muted">No documents uploaded yet.</p>
          ) : null}
        </section>
      </div>
    </WorkspaceGate>
  );
}
