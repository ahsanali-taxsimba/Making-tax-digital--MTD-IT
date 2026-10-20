"use client";

import { formatDate, formatMoney } from "@/lib/format";
import type { ReceiptRecord } from "@/lib/receipts";

export function OCRTextPanel({ receipt }: { receipt: Pick<ReceiptRecord, "ocrText" | "ocrMerchant" | "ocrAmount" | "ocrDate" | "status"> }) {
  return (
    <section className="space-y-4 rounded-2xl border border-line bg-white p-5 shadow-sm">
      <div>
        <h3 className="text-lg font-semibold text-ink">OCR</h3>
        <p className="mt-1 text-sm text-ink-muted">
          {receipt.status === "processed"
            ? "Extracted merchant, amount, and date for matching."
            : "Waiting for OCR to finish."}
        </p>
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-ink-muted">Merchant</dt>
          <dd className="mt-1 font-semibold text-ink">{receipt.ocrMerchant || "—"}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Amount</dt>
          <dd className="mt-1 font-semibold text-ink">{formatMoney(receipt.ocrAmount)}</dd>
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
