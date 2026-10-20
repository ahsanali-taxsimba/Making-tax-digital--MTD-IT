"use client";

import { ReceiptCard } from "./ReceiptCard";
import type { ReceiptRecord } from "@/lib/receipts";

export function DocumentList({
  receipts,
  layout,
  hrefFor,
  onPreview,
  empty = "No receipts match these filters.",
}: {
  receipts: ReceiptRecord[];
  layout: "grid" | "list";
  hrefFor?: (receipt: ReceiptRecord) => string;
  onPreview?: (receipt: ReceiptRecord) => void;
  empty?: string;
}) {
  if (!receipts.length) {
    return (
      <p className="rounded-2xl border border-dashed border-line bg-white p-8 text-sm text-ink-muted">{empty}</p>
    );
  }

  return (
    <ul className={layout === "grid" ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3" : "space-y-3"}>
      {receipts.map((receipt) => (
        <li key={receipt.id}>
          <ReceiptCard
            receipt={receipt}
            layout={layout}
            href={hrefFor?.(receipt)}
            onPreview={onPreview}
          />
        </li>
      ))}
    </ul>
  );
}
