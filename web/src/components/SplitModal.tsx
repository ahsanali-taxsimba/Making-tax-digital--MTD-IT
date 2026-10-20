"use client";

import { FormEvent, useMemo, useState } from "react";
import { formatMoney } from "@/lib/format";
import type { BankTransactionRecord, LedgerOption } from "@/lib/reconciliation";

export function SplitModal({
  transaction,
  ledgers,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  transaction: BankTransactionRecord;
  ledgers: LedgerOption[];
  pending?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (allocations: Array<{ ledgerAccountId: string; amount: number; description?: string }>) => void;
}) {
  const [rows, setRows] = useState([
    { ledgerAccountId: ledgers[0]?.id ?? "", amount: transaction.amount, description: transaction.description },
    { ledgerAccountId: ledgers[1]?.id ?? ledgers[0]?.id ?? "", amount: 0, description: "" },
  ]);
  const allocated = useMemo(() => rows.reduce((sum, row) => sum + Number(row.amount || 0), 0), [rows]);
  const remaining = Number((transaction.amount - allocated).toFixed(2));

  function update(index: number, patch: Partial<(typeof rows)[number]>) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSubmit(rows.filter((row) => row.ledgerAccountId && Number(row.amount) > 0).map((row) => ({ ...row, amount: Number(row.amount) })));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4" role="dialog" aria-modal="true" aria-labelledby="split-title">
      <form onSubmit={handleSubmit} className="w-full max-w-xl rounded-2xl border border-line bg-white p-6 shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="split-title" className="text-lg font-semibold text-ink">
              Split transaction
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              Allocate {formatMoney(transaction.amount)} across ledger accounts.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-ink-muted hover:text-ink">
            Close
          </button>
        </div>
        <div className="mt-4 space-y-3">
          {rows.map((row, index) => (
            <div key={index} className="grid gap-2 md:grid-cols-[1fr_7rem_1fr]">
              <select
                className="rounded-lg border border-line px-3 py-2 text-sm"
                value={row.ledgerAccountId}
                onChange={(event) => update(index, { ledgerAccountId: event.target.value })}
                aria-label={`Ledger for split line ${index + 1}`}
              >
                <option value="">Select account</option>
                {ledgers.map((ledger) => (
                  <option key={ledger.id} value={ledger.id}>
                    {ledger.code} {ledger.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                step="0.01"
                className="rounded-lg border border-line px-3 py-2 text-sm"
                value={row.amount}
                onChange={(event) => update(index, { amount: Number(event.target.value) })}
                aria-label={`Amount for split line ${index + 1}`}
              />
              <input
                className="rounded-lg border border-line px-3 py-2 text-sm"
                value={row.description}
                onChange={(event) => update(index, { description: event.target.value })}
                placeholder="Narrative"
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          className="mt-3 text-sm font-semibold text-teal"
          onClick={() => setRows((current) => [...current, { ledgerAccountId: "", amount: Math.max(remaining, 0), description: "" }])}
        >
          Add line
        </button>
        <p className={`mt-3 text-sm ${remaining === 0 ? "text-success" : "text-danger"}`}>
          Remaining {formatMoney(remaining)}
        </p>
        {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-sm font-semibold">
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending || remaining !== 0}
            className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-dark disabled:opacity-60"
          >
            {pending ? "Posting split…" : "Post split journal"}
          </button>
        </div>
      </form>
    </div>
  );
}
