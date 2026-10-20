"use client";

import { diffRecords } from "@/lib/audit";

const TONE = {
  unchanged: "bg-white text-ink",
  added: "bg-success-soft text-success",
  removed: "bg-danger-soft text-danger",
  changed: "bg-warning-soft text-warning",
} as const;

export function JsonDiffViewer({
  before,
  after,
}: {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}) {
  const rows = diffRecords(before, after);

  if (!before && !after) {
    return <p className="text-sm text-ink-muted">No before/after snapshot was recorded for this event.</p>;
  }

  if (!rows.length) {
    return <p className="text-sm text-ink-muted">The snapshot is empty.</p>;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <div className="grid grid-cols-[minmax(8rem,1fr)_1fr_1fr] bg-paper text-xs font-semibold uppercase tracking-wide text-ink-muted">
        <p className="px-3 py-2">Field</p>
        <p className="px-3 py-2">Before</p>
        <p className="px-3 py-2">After</p>
      </div>
      {rows.map((row) => (
        <div
          key={row.path}
          className={`grid grid-cols-[minmax(8rem,1fr)_1fr_1fr] border-t border-line text-sm ${TONE[row.change]}`}
        >
          <p className="px-3 py-2 font-mono text-xs text-ink">{row.path}</p>
          <p className={`px-3 py-2 font-mono text-xs ${row.change === "removed" || row.change === "changed" ? "font-semibold" : ""}`}>
            {row.before || "—"}
          </p>
          <p className={`px-3 py-2 font-mono text-xs ${row.change === "added" || row.change === "changed" ? "font-semibold" : ""}`}>
            {row.after || "—"}
          </p>
        </div>
      ))}
    </div>
  );
}
