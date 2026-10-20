"use client";

import {
  EMPTY_RECEIPT_FILTERS,
  receiptAttachmentLabel,
  type ReceiptFilterAttachment,
  type ReceiptFilters,
} from "@/lib/receipts";

const ATTACHMENT_OPTIONS: ReceiptFilterAttachment[] = ["all", "unattached", "bank", "invoice", "bill", "journal"];

export function DocumentFilters({
  value,
  onChange,
}: {
  value: ReceiptFilters;
  onChange: (next: ReceiptFilters) => void;
}) {
  function patch(partial: Partial<ReceiptFilters>) {
    onChange({ ...value, ...partial });
  }

  return (
    <section className="space-y-4 rounded-2xl border border-line bg-white p-4 shadow-sm md:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">Filters</h3>
          <p className="text-xs text-ink-muted">Search OCR text, merchant, date, amount, or what the receipt is attached to.</p>
        </div>
        <button
          type="button"
          className="text-sm font-semibold text-teal underline-offset-2 hover:underline"
          onClick={() => onChange(EMPTY_RECEIPT_FILTERS)}
        >
          Clear
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <label className="block text-sm md:col-span-2">
          <span className="font-medium text-ink">Search OCR text</span>
          <input
            className="mt-1 w-full rounded-lg border border-line px-3 py-2"
            placeholder="Merchant, filename, or extracted text"
            value={value.query}
            onChange={(event) => patch({ query: event.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-ink">Merchant</span>
          <input
            className="mt-1 w-full rounded-lg border border-line px-3 py-2"
            placeholder="BP, Tesco…"
            value={value.merchant}
            onChange={(event) => patch({ merchant: event.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-ink">Attached to</span>
          <select
            className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2"
            value={value.attachmentType}
            aria-label="Attachment type"
            onChange={(event) => patch({ attachmentType: event.target.value as ReceiptFilterAttachment })}
          >
            {ATTACHMENT_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {receiptAttachmentLabel(option)}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="font-medium text-ink">From</span>
          <input
            type="date"
            className="mt-1 w-full rounded-lg border border-line px-3 py-2"
            value={value.dateFrom}
            onChange={(event) => patch({ dateFrom: event.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-ink">To</span>
          <input
            type="date"
            className="mt-1 w-full rounded-lg border border-line px-3 py-2"
            value={value.dateTo}
            onChange={(event) => patch({ dateTo: event.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-ink">Min amount</span>
          <input
            type="number"
            min="0"
            step="0.01"
            className="mt-1 w-full rounded-lg border border-line px-3 py-2"
            placeholder="0.00"
            value={value.amountMin}
            onChange={(event) => patch({ amountMin: event.target.value })}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-ink">Max amount</span>
          <input
            type="number"
            min="0"
            step="0.01"
            className="mt-1 w-full rounded-lg border border-line px-3 py-2"
            placeholder="100.00"
            value={value.amountMax}
            onChange={(event) => patch({ amountMax: event.target.value })}
          />
        </label>
      </div>
    </section>
  );
}
