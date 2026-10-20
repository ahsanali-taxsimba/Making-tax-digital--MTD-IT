"use client";

import { categoryLabel, formatDate } from "@/lib/format";
import { useClient } from "@/hooks/useClient";
import { useDocuments } from "@/hooks/useDocuments";
import { useSession } from "@/hooks/useSession";
import { DocumentUpload } from "@/components/DocumentUpload";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { RequireAuth } from "@/components/RequireAuth";

export default function PortalDocumentsPage() {
  const { clientId, user } = useSession();
  const client = useClient();
  const resolvedId = client.data?.id ?? clientId ?? user?.clientId;
  const documents = useDocuments(resolvedId);

  return (
    <RequireAuth>
      <div className="space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Records</p>
          <h1 className="mt-1 text-3xl font-semibold">Documents</h1>
          <p className="mt-2 text-sm text-ink-muted">Upload bank statements, invoices, and receipts for your accountant.</p>
        </div>
        <DocumentUpload clientId={resolvedId} />
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
              {(documents.data ?? []).map((item) => (
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
          {!documents.data?.length && !documents.isLoading ? (
            <p className="px-4 py-6 text-sm text-ink-muted">No documents uploaded yet.</p>
          ) : null}
        </section>
      </div>
    </RequireAuth>
  );
}
