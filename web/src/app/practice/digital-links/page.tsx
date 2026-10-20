"use client";

import Link from "next/link";
import { ErrorBanner } from "@/components/ErrorBanner";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { WorkspaceGate } from "@/components/WorkspaceGate";
import { useFirmWorkspace } from "@/hooks/useFirmWorkspace";
import { useSession } from "@/hooks/useSession";
import { formatDate } from "@/lib/format";

export default function PracticeDigitalLinksIndexPage() {
  const { user } = useSession();
  const { documents, vat, itsa, clients } = useFirmWorkspace();
  const clientName = (id: string) => (clients.data ?? []).find((row) => row.id === id)?.name ?? id;

  return (
    <WorkspaceGate allow="practice" firmId={user?.firmId}>
      <div className="space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Digital links</p>
          <h2 className="mt-1 text-2xl font-semibold text-ink">HMRC digital links</h2>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">
            Open a document, VAT return, or ITSA filing to walk the HMRC digital-link chain.
          </p>
        </div>
        {documents.isError ? <ErrorBanner title="Documents unavailable" message={documents.error.message} /> : null}
        {vat.isError ? <ErrorBanner title="VAT returns unavailable" message={vat.error.message} /> : null}
        {itsa.isError ? <ErrorBanner title="ITSA submissions unavailable" message={itsa.error.message} /> : null}
        {documents.isLoading || vat.isLoading || itsa.isLoading ? <LoadingSpinner label="Loading link sources…" /> : null}

        <section className="overflow-hidden rounded-2xl border border-line bg-white">
          <h3 className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">Documents</h3>
          <table className="min-w-full text-left text-sm">
            <thead className="bg-paper text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">File</th>
                <th className="px-4 py-3 font-semibold">Client</th>
                <th className="px-4 py-3 font-semibold">Uploaded</th>
                <th className="px-4 py-3 font-semibold"> </th>
              </tr>
            </thead>
            <tbody>
              {(documents.data ?? []).map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="px-4 py-3 font-medium">{row.fileName}</td>
                  <td className="px-4 py-3">{clientName(row.clientId)}</td>
                  <td className="px-4 py-3">{formatDate(row.uploadedAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-3">
                      <Link href={`/practice/digital-links/${row.id}`} className="font-semibold text-teal hover:underline">
                        VAT timeline
                      </Link>
                      <Link href={`/practice/digital-links/itsa/${row.id}`} className="font-semibold text-teal hover:underline">
                        ITSA timeline
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!documents.data?.length && !documents.isLoading ? (
            <p className="px-4 py-6 text-sm text-ink-muted">No documents to start a digital-link chain.</p>
          ) : null}
        </section>

        <section className="overflow-hidden rounded-2xl border border-line bg-white">
          <h3 className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">VAT returns</h3>
          <table className="min-w-full text-left text-sm">
            <thead className="bg-paper text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Period</th>
                <th className="px-4 py-3 font-semibold">Client</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold"> </th>
              </tr>
            </thead>
            <tbody>
              {(vat.data ?? []).map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="px-4 py-3 font-medium">{row.periodKey}</td>
                  <td className="px-4 py-3">{clientName(row.clientId)}</td>
                  <td className="px-4 py-3">{row.status}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/practice/digital-links/${row.id}`} className="font-semibold text-teal hover:underline">
                      View timeline
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!vat.data?.length && !vat.isLoading ? (
            <p className="px-4 py-6 text-sm text-ink-muted">No VAT returns to start a digital-link chain.</p>
          ) : null}
        </section>

        <section className="overflow-hidden rounded-2xl border border-line bg-white">
          <h3 className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">ITSA filings</h3>
          <table className="min-w-full text-left text-sm">
            <thead className="bg-paper text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Filing</th>
                <th className="px-4 py-3 font-semibold">Client</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold"> </th>
              </tr>
            </thead>
            <tbody>
              {(itsa.data ?? []).map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="px-4 py-3 font-medium">{row.label ?? `${row.taxYear}${row.periodId ? ` ${row.periodId}` : ""}`}</td>
                  <td className="px-4 py-3">{clientName(row.clientId)}</td>
                  <td className="px-4 py-3">{row.status}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/practice/digital-links/itsa/${row.id}`} className="font-semibold text-teal hover:underline">
                      View ITSA timeline
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!itsa.data?.length && !itsa.isLoading ? (
            <p className="px-4 py-6 text-sm text-ink-muted">No ITSA filings to start a digital-link chain.</p>
          ) : null}
        </section>
      </div>
    </WorkspaceGate>
  );
}
