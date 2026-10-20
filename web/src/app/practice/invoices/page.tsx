"use client";

import { BillingSubNav } from "@/components/BillingSubNav";
import { ErrorBanner } from "@/components/ErrorBanner";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { WorkspaceGate } from "@/components/WorkspaceGate";
import { useBillingInvoices } from "@/hooks/useBilling";
import { useSession } from "@/hooks/useSession";
import { formatGbp } from "@/lib/billing";

export default function InvoiceHistoryPage() {
  const { user } = useSession();
  const invoices = useBillingInvoices();
  const rows = invoices.data ?? [];

  return (
    <WorkspaceGate allow="practice" firmId={user?.firmId}>
      <div className="space-y-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Billing</p>
          <h2 className="mt-1 text-2xl font-semibold text-ink">Invoice history</h2>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">UK VAT invoices issued by Stripe (or the mock gateway in development).</p>
        </div>
        <BillingSubNav />
        {invoices.isError ? <ErrorBanner title="Invoices unavailable" message={invoices.error.message} /> : null}
        {invoices.isLoading ? <LoadingSpinner label="Loading invoices…" /> : null}
        <section className="overflow-hidden rounded-2xl border border-line bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-paper text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Number</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Net</th>
                <th className="px-4 py-3 font-semibold">VAT</th>
                <th className="px-4 py-3 font-semibold">Total</th>
                <th className="px-4 py-3 font-semibold">Issued</th>
                <th className="px-4 py-3 font-semibold">PDF</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="px-4 py-3 font-medium">{row.number ?? row.id.slice(0, 8)}</td>
                  <td className="px-4 py-3 capitalize">{row.status}</td>
                  <td className="px-4 py-3">{formatGbp(row.subtotalPence, row.currency)}</td>
                  <td className="px-4 py-3">{formatGbp(row.taxPence, row.currency)}</td>
                  <td className="px-4 py-3">{formatGbp(row.totalPence, row.currency)}</td>
                  <td className="px-4 py-3">{new Date(row.createdAt).toLocaleDateString("en-GB")}</td>
                  <td className="px-4 py-3">
                    {row.hostedInvoiceUrl ? (
                      <a href={row.hostedInvoiceUrl} className="font-semibold text-teal hover:underline" target="_blank" rel="noreferrer">
                        View
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && !invoices.isLoading ? <p className="px-4 py-6 text-sm text-ink-muted">No invoices yet.</p> : null}
        </section>
      </div>
    </WorkspaceGate>
  );
}
