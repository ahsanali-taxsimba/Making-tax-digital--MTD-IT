"use client";

import { FormEvent, useState } from "react";
import { formatMoney } from "@/lib/format";
import type { BankTransactionRecord, LedgerOption } from "@/lib/reconciliation";

export function CreateJournalModal({
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
  onSubmit: (ledgerAccountId: string) => void;
}) {
  const [ledgerAccountId, setLedgerAccountId] = useState(ledgers[0]?.id ?? "");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (ledgerAccountId) {
      onSubmit(ledgerAccountId);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4" role="dialog" aria-modal="true" aria-labelledby="journal-title">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="journal-title" className="text-lg font-semibold text-ink">
              Create journal
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              Post {formatMoney(transaction.amount)} to a ledger and match this bank line.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-ink-muted hover:text-ink">
            Close
          </button>
        </div>
        <label className="mt-4 block text-sm">
          <span className="font-medium">Counterpart account</span>
          <select
            className="mt-1 w-full rounded-lg border border-line px-3 py-2"
            value={ledgerAccountId}
            onChange={(event) => setLedgerAccountId(event.target.value)}
          >
            {ledgers.map((ledger) => (
              <option key={ledger.id} value={ledger.id}>
                {ledger.code} {ledger.name}
              </option>
            ))}
          </select>
        </label>
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-sm font-semibold">
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending || !ledgerAccountId}
            className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-dark disabled:opacity-60"
          >
            {pending ? "Posting…" : "Post and match"}
          </button>
        </div>
      </form>
    </div>
  );
}
