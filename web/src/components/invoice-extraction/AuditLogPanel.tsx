"use client";

import { auditActionLabel, type ExtractionAuditEntry } from "@/lib/invoice-extraction";
import { formatDate } from "@/lib/format";

export function AuditLogPanel({ entries, title = "Audit trail" }: { entries: ExtractionAuditEntry[]; title?: string }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      {!entries.length ? (
        <p className="mt-3 text-sm text-ink-muted">No audit events yet.</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-start justify-between gap-3 border-b border-line pb-3 last:border-0 last:pb-0">
              <div>
                <p className="text-sm font-medium text-ink">{auditActionLabel(entry.action)}</p>
                <p className="text-xs text-ink-muted">{entry.userName}</p>
              </div>
              <time className="shrink-0 text-xs text-ink-muted">{formatDate(entry.createdAt)}</time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
