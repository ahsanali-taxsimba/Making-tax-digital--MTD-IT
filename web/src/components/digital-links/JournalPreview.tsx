"use client";

import { formatDate, formatMoney } from "@/lib/format";
import type { JournalDetail } from "@/lib/digital-links";

export function JournalPreview({ journal }: { journal: JournalDetail }) {
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <Field label="Journal ID" value={journal.id} />
        <Field label="Date" value={formatDate(journal.date)} />
        <Field label="Reference" value={journal.reference ?? "—"} />
        <Field label="Description" value={journal.description ?? "—"} />
      </dl>
      {journal.lines.length ? (
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="py-2 font-semibold">Account</th>
              <th className="py-2 font-semibold">Debit</th>
              <th className="py-2 font-semibold">Credit</th>
            </tr>
          </thead>
          <tbody>
            {journal.lines.map((line, index) => (
              <tr key={`${line.account}-${index}`} className="border-t border-line">
                <td className="py-2">
                  <p className="font-medium text-ink">{line.account}</p>
                  {line.description ? <p className="text-xs text-ink-muted">{line.description}</p> : null}
                </td>
                <td className="py-2">{line.debit ? formatMoney(line.debit) : "—"}</td>
                <td className="py-2">{line.credit ? formatMoney(line.credit) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-ink-muted">No ledger lines on this journal yet.</p>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="mt-0.5 break-all text-ink">{value}</dd>
    </div>
  );
}
