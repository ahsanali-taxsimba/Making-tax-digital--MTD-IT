"use client";

import { formatDate, formatMoney } from "@/lib/format";
import type { ReceiptRecord } from "@/lib/receipts";

export function OCRTextPanel({
  receipt,
  pending,
  onReprocess,
}: {
  receipt: Pick<
    ReceiptRecord,
    | "ocrText"
    | "ocrMerchant"
    | "ocrSupplierName"
    | "ocrAmount"
    | "ocrNetAmount"
    | "ocrVatAmount"
    | "ocrVatRate"
    | "ocrInvoiceNumber"
    | "ocrDate"
    | "status"
  >;
  pending?: boolean;
  onReprocess?: () => void;
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-line bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-ink">OCR</h3>
          <p className="mt-1 text-sm text-ink-muted">
            {receipt.status === "processed"
              ? "Extracted merchant, amounts, VAT, date, and invoice number for matching."
              : "Waiting for OCR to finish."}
          </p>
        </div>
        {onReprocess ? (
          <button
            type="button"
            disabled={pending}
            onClick={onReprocess}
            className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-ink hover:border-teal/40 disabled:opacity-60"
          >
            {pending ? "Reprocessing…" : "Reprocess OCR"}
          </button>
        ) : null}
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-ink-muted">Merchant</dt>
          <dd className="mt-1 font-semibold text-ink">{receipt.ocrMerchant || "—"}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Supplier</dt>
          <dd className="mt-1 font-semibold text-ink">{receipt.ocrSupplierName || "—"}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Invoice no.</dt>
          <dd className="mt-1 font-semibold text-ink">{receipt.ocrInvoiceNumber || "—"}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Gross</dt>
          <dd className="mt-1 font-semibold text-ink">{formatMoney(receipt.ocrAmount)}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Net</dt>
          <dd className="mt-1 font-semibold text-ink">{formatMoney(receipt.ocrNetAmount)}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">VAT</dt>
          <dd className="mt-1 font-semibold text-ink">
            {formatMoney(receipt.ocrVatAmount)}
            {receipt.ocrVatRate != null ? ` · ${receipt.ocrVatRate}%` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-ink-muted">Date</dt>
          <dd className="mt-1 font-semibold text-ink">{formatDate(receipt.ocrDate)}</dd>
        </div>
      </dl>
      <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-paper p-4 text-sm text-ink">
        {receipt.ocrText || "No extracted text yet."}
      </pre>
    </section>
  );
}
