"use client";

import { receiptKindLabel, type ReceiptRecord } from "@/lib/receipts";

export function ReceiptThumbnails({ receipts }: { receipts: ReceiptRecord[] }) {
  if (!receipts.length) {
    return <p className="text-sm text-ink-muted">No receipts attached.</p>;
  }
  return (
    <ul className="flex flex-wrap gap-2">
      {receipts.map((receipt) => (
        <li
          key={receipt.id}
          className="flex h-16 w-20 flex-col items-center justify-center rounded-lg border border-line bg-paper px-1 text-center"
        >
          <span className="text-[10px] font-semibold uppercase tracking-wide text-teal">{receiptKindLabel(receipt.fileType)}</span>
          <span className="mt-1 w-full truncate text-[10px] text-ink-muted">{receipt.fileName}</span>
        </li>
      ))}
    </ul>
  );
}
