"use client";

import { actorLabel, auditActionLabel, auditSummary, resourceTypeLabel, type AuditLogEntry } from "@/lib/audit";
import { formatDateTime } from "@/lib/format";

export function AuditTable({
  entries,
  selectedId,
  onSelect,
}: {
  entries: AuditLogEntry[];
  selectedId?: string | null;
  onSelect: (entry: AuditLogEntry) => void;
}) {
  if (!entries.length) {
    return <p className="px-4 py-8 text-sm text-ink-muted">No audit events match these filters.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-paper text-xs uppercase tracking-wide text-ink-muted">
          <tr>
            <th className="px-4 py-3 font-semibold">Timestamp</th>
            <th className="px-4 py-3 font-semibold">User</th>
            <th className="px-4 py-3 font-semibold">Client</th>
            <th className="px-4 py-3 font-semibold">Resource type</th>
            <th className="px-4 py-3 font-semibold">Resource ID</th>
            <th className="px-4 py-3 font-semibold">Action</th>
            <th className="px-4 py-3 font-semibold">Summary</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const selected = entry.id === selectedId;
            return (
              <tr
                key={entry.id}
                className={`cursor-pointer border-t border-line ${selected ? "bg-teal/5" : "hover:bg-paper"}`}
                onClick={() => onSelect(entry)}
              >
                <td className="whitespace-nowrap px-4 py-3 text-ink-muted">{formatDateTime(entry.createdAt)}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-ink">{entry.actor?.name ?? "System"}</p>
                  <p className="text-xs text-ink-muted">{actorLabel(entry).split(" · ")[1] ?? "—"}</p>
                </td>
                <td className="px-4 py-3">{entry.client?.name ?? entry.clientId ?? "—"}</td>
                <td className="px-4 py-3">{resourceTypeLabel(entry.resourceType)}</td>
                <td className="max-w-[8rem] truncate px-4 py-3 font-mono text-xs text-ink-muted">{entry.resourceId ?? "—"}</td>
                <td className="px-4 py-3">{auditActionLabel(entry.action)}</td>
                <td className="px-4 py-3 text-ink-muted">{auditSummary(entry)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
