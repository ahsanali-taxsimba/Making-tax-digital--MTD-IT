"use client";

import { useState } from "react";
import Link from "next/link";
import { useBookkeepingInvoice, useInvoiceAudit, useJournalPreview, usePostBookkeepingInvoice } from "@/hooks/useInvoiceExtraction";
import { useAttachments, useRemoveAttachment, useUploadAttachment } from "@/hooks/useAttachments";
import { formatDate, formatMoney } from "@/lib/format";
import type { InvoiceDirection } from "@/lib/invoice-extraction";
import { ErrorBanner } from "../ErrorBanner";
import { LoadingSpinner } from "../LoadingSpinner";
import { SuccessBanner } from "../SuccessBanner";
import { AttachmentPanel } from "./AttachmentPanel";
import { AuditLogPanel } from "./AuditLogPanel";
import { LineItemsTable } from "./LineItemsTable";

export function InvoiceDetailWorkspace({ id, kind }: { id: string; kind: InvoiceDirection }) {
  const invoice = useBookkeepingInvoice(id, kind);
  const post = usePostBookkeepingInvoice(id, kind);
  const [showPreview, setShowPreview] = useState(false);
  const preview = useJournalPreview(id, kind, showPreview);
  const attachments = useAttachments({
    clientId: invoice.data?.clientId,
    invoiceId: kind === "sales" ? id : null,
    billId: kind === "purchase" ? id : null,
  });
  const upload = useUploadAttachment({
    clientId: invoice.data?.clientId,
    invoiceId: kind === "sales" ? id : undefined,
    billId: kind === "purchase" ? id : undefined,
  });
  const remove = useRemoveAttachment();
  const audit = useInvoiceAudit(id, kind, invoice.data?.clientId);

  if (invoice.isLoading) {
    return <LoadingSpinner label="Loading invoice…" />;
  }
  if (invoice.isError || !invoice.data) {
    return <ErrorBanner message="Unable to load this invoice." />;
  }

  const record = invoice.data;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">
            {record.kind === "sales" ? "Sales invoice" : "Purchase bill"}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-ink">{record.invoiceNumber || record.partyName}</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {record.partyName} · {formatDate(record.date)} · Due {formatDate(record.dueDate)}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${record.status === "POSTED" ? "bg-success-soft text-success" : "bg-warning-soft text-warning"}`}>
          {record.status}
        </span>
      </header>

      {record.readyToPost ? (
        <SuccessBanner title="Ready to post" message="The extraction is approved. Review the journal preview, then post this draft to the ledger." />
      ) : null}
      {record.status === "POSTED" ? (
        <SuccessBanner title="Posted to ledger" message="This invoice is on the books. VAT and ITSA totals will pick it up in the next period summary." />
      ) : null}
      {post.isError ? <ErrorBanner message={post.error instanceof Error ? post.error.message : "Unable to post this invoice."} /> : null}

      <section className="rounded-2xl border border-line bg-white p-5">
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-ink-muted">Supplier / customer</dt>
            <dd className="font-semibold">{record.partyName}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">Invoice number</dt>
            <dd className="font-semibold">{record.invoiceNumber || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-muted">Gross</dt>
            <dd className="font-semibold">{formatMoney(record.grossTotal)}</dd>
          </div>
        </dl>
        <div className="mt-5">
          <LineItemsTable lines={record.lines.map((line) => ({ ...line, quantity: 1, unitPrice: line.net, vatRate: null, confidence: 1 }))} readOnly />
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {record.readyToPost ? (
            <button
              type="button"
              disabled={post.isPending}
              onClick={() => void post.mutateAsync()}
              className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {post.isPending ? "Posting…" : "Post to Ledger"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setShowPreview((value) => !value)}
            className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink"
          >
            {showPreview ? "Hide journal preview" : "View Journal Preview"}
          </button>
          <Link href="/invoices/extraction" className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink">
            Back to extractions
          </Link>
        </div>
      </section>

      {showPreview ? (
        <section className="rounded-2xl border border-line bg-white p-5">
          <h2 className="text-sm font-semibold text-ink">Journal preview</h2>
          {preview.isLoading ? (
            <LoadingSpinner label="Building journal…" />
          ) : preview.isError || !preview.data ? (
            <p className="mt-3 text-sm text-danger">Unable to preview this journal.</p>
          ) : (
            <table className="mt-4 w-full text-left text-sm">
              <thead className="text-xs uppercase text-ink-muted">
                <tr>
                  <th className="py-2">Account</th>
                  <th className="py-2">Debit</th>
                  <th className="py-2">Credit</th>
                </tr>
              </thead>
              <tbody>
                {preview.data.lines.map((line, index) => (
                  <tr key={`${line.accountCode}-${index}`} className="border-t border-line">
                    <td className="py-2">
                      {line.accountCode} {line.accountName}
                      <span className="block text-xs text-ink-muted">{line.description}</span>
                    </td>
                    <td className="py-2">{formatMoney(line.debit)}</td>
                    <td className="py-2">{formatMoney(line.credit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ) : null}

      <AttachmentPanel
        documents={attachments.data?.documents ?? []}
        uploading={upload.isPending}
        actionLabel="Attach Receipt"
        onUpload={(file) => void upload.mutateAsync(file)}
        onRemove={(id) => void remove.mutateAsync(id)}
      />
      <AuditLogPanel entries={audit.data ?? []} />
    </div>
  );
}
