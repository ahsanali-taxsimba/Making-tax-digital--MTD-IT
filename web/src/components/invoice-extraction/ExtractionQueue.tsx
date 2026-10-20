"use client";

import Link from "next/link";
import { useInvoiceExtractions } from "@/hooks/useInvoiceExtraction";
import { useSession } from "@/hooks/useSession";
import { reviewStatusLabel } from "@/lib/invoice-extraction";
import { formatDate } from "@/lib/format";
import { LoadingSpinner } from "../LoadingSpinner";
import { ConfidenceBadge } from "./ConfidenceBadge";

export function ExtractionQueue() {
  const { clientId } = useSession();
  const queue = useInvoiceExtractions(clientId);

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">Bookkeeping</p>
        <h1 className="mt-1 text-2xl font-semibold text-ink">Invoice extraction review</h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-muted">
          Compare the original PDF or image with extracted supplier, line, and VAT fields. Approve a draft invoice or reject and re-run.
        </p>
      </header>
      {!clientId ? (
        <p className="rounded-2xl border border-dashed border-line bg-white p-6 text-sm text-ink-muted">Select a client to review invoice extractions.</p>
      ) : queue.isLoading ? (
        <LoadingSpinner label="Loading extractions…" />
      ) : !queue.data?.documents.length ? (
        <p className="rounded-2xl border border-dashed border-line bg-white p-6 text-sm text-ink-muted">
          No invoice documents are waiting for review. Upload an invoice in the document library, then extract it.
        </p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
          {queue.data.documents.map((item) => {
            const href =
              item.reviewStatus === "approved" && (item.invoiceId || item.billId)
                ? `/invoices/${item.invoiceId ?? item.billId}?kind=${item.invoiceId ? "sales" : "purchase"}`
                : `/invoices/extraction/${item.documentId}`;
            return (
              <li key={item.documentId}>
                <Link href={href} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 hover:bg-paper">
                  <div>
                    <p className="font-semibold text-ink">{item.supplierName || item.fileName}</p>
                    <p className="text-sm text-ink-muted">
                      {item.invoiceNumber || "No invoice number"} · {item.fileName} · {formatDate(item.uploadedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-ink-muted">{reviewStatusLabel(item.reviewStatus)}</span>
                    <ConfidenceBadge value={item.confidence} compact />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
