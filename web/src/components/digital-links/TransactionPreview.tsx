"use client";

import { formatDate, formatMoney } from "@/lib/format";
import type { TransactionDetail } from "@/lib/digital-links";

export function TransactionPreview({ transaction }: { transaction: TransactionDetail }) {
  return (
    <dl className="grid grid-cols-2 gap-3 text-sm">
      <Field label="Date" value={formatDate(transaction.date)} />
      <Field label="Amount" value={formatMoney(transaction.amount)} />
      <Field label="Description" value={transaction.description ?? "—"} />
      <Field label="Category" value={transaction.category ?? transaction.merchantName ?? "—"} />
      <Field label="Reconciliation" value={transaction.status ?? "—"} />
    </dl>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-ink">{value}</dd>
    </div>
  );
}
