"use client";

import Link from "next/link";
import { formatDate, formatMoney } from "@/lib/format";
import {
  formatFileSize,
  receiptAttachmentKind,
  receiptAttachmentLabel,
  receiptDateValue,
  receiptKindLabel,
  type ReceiptRecord,
} from "@/lib/receipts";

export function ReceiptCard({
  receipt,
  href,
  selected,
  layout = "grid",
  onOpen,
  onPreview,
}: {
  receipt: ReceiptRecord;
  href?: string;
  selected?: boolean;
  layout?: "grid" | "list";
  onOpen?: (receipt: ReceiptRecord) => void;
  onPreview?: (receipt: ReceiptRecord) => void;
}) {
  const kind = receiptAttachmentKind(receipt);
  const body = (
    <>
      <div
        className={`flex shrink-0 items-center justify-center rounded-xl bg-paper text-teal ${
          layout === "list" ? "h-16 w-16" : "h-28 w-full"
        }`}
      >
        <span className="text-xs font-semibold uppercase tracking-wide">{receiptKindLabel(receipt.fileType)}</span>
      </div>
      <div className={layout === "list" ? "min-w-0 flex-1" : "min-w-0"}>
        <p className="truncate font-semibold text-ink">{receipt.ocrMerchant || receipt.fileName}</p>
        <p className="mt-1 truncate text-sm text-ink-muted">
          {receipt.ocrAmount != null ? formatMoney(receipt.ocrAmount) : formatFileSize(receipt.fileSize)}
          {" · "}
          {formatDate(receiptDateValue(receipt))}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              kind === "unattached" ? "bg-amber-50 text-amber-800" : "bg-success-soft text-success"
            }`}
          >
            {receiptAttachmentLabel(kind)}
          </span>
          {receipt.tags.slice(0, 2).map((tag) => (
            <span key={tag} className="rounded-full bg-paper px-2 py-0.5 text-[11px] text-ink-muted">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </>
  );

  const className =
    layout === "list"
      ? `flex w-full items-center gap-4 rounded-2xl border bg-white p-4 text-left shadow-sm ${
          selected ? "border-teal" : "border-line hover:border-teal/40"
        }`
      : `flex h-full flex-col gap-3 rounded-2xl border bg-white p-4 text-left shadow-sm ${
          selected ? "border-teal" : "border-line hover:border-teal/40"
        }`;

  return (
    <article className="relative">
      {href ? (
        <Link href={href} className={className} onClick={() => onOpen?.(receipt)}>
          {body}
        </Link>
      ) : (
        <button type="button" className={className} onClick={() => onOpen?.(receipt)}>
          {body}
        </button>
      )}
      {onPreview ? (
        <button
          type="button"
          className="absolute right-3 top-3 rounded-lg border border-line bg-white px-2 py-1 text-[11px] font-semibold text-ink hover:border-teal/40"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onPreview(receipt);
          }}
        >
          Preview
        </button>
      ) : null}
    </article>
  );
}
