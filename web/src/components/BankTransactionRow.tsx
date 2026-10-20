"use client";

import { formatDate, formatMoney } from "@/lib/format";
import { statusLabel, type BankTransactionRecord } from "@/lib/reconciliation";

export function BankTransactionRow({
  transaction,
  selected,
  onSelect,
}: {
  transaction: BankTransactionRecord;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const credit = transaction.type === "CREDIT";
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-xl border px-4 py-3 text-left transition ${
        selected ? "border-teal bg-teal/5" : "border-line bg-white hover:border-teal/40"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{transaction.merchantName || transaction.description}</p>
          <p className="mt-0.5 truncate text-xs text-ink-muted">
            {formatDate(transaction.date)}
            {transaction.merchantName ? ` · ${transaction.description}` : ""}
            {transaction.category ? ` · ${transaction.category.replace(/_/g, " ")}` : ""}
          </p>
        </div>
        <div className="text-right">
          <p className={`font-semibold ${credit ? "text-success" : "text-ink"}`}>
            {credit ? "+" : "−"}
            {formatMoney(transaction.amount)}
          </p>
          <p className="mt-0.5 text-xs capitalize text-ink-muted">{statusLabel(transaction.status)}</p>
        </div>
      </div>
    </button>
  );
}
