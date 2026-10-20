"use client";

import Link from "next/link";
import { actorLabel, auditActionLabel, downloadText, hmrcContext, linkedEntities, resourceTypeLabel, type AuditLogEntry } from "@/lib/audit";
import { formatDateTime } from "@/lib/format";
import { useDigitalLinks } from "@/hooks/useAuditLogs";
import { JsonDiffViewer } from "./JsonDiffViewer";
import { LinkedEntitiesPanel } from "./LinkedEntitiesPanel";

export function AuditDetailDrawer({
  entry,
  onClose,
}: {
  entry: AuditLogEntry | null;
  onClose: () => void;
}) {
  const links = useDigitalLinks(entry);
  if (!entry) {
    return null;
  }
  const entities = linkedEntities(entry, links.data ?? null);
  const hmrc = hmrcContext(entry, links.data ?? null);

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-ink/30" role="dialog" aria-modal="true" aria-label="Audit entry">
      <button type="button" className="h-full flex-1 cursor-default" aria-label="Close detail" onClick={onClose} />
      <aside className="flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-line bg-white shadow-xl">
        <header className="border-b border-line px-6 py-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Audit entry</p>
              <h2 className="mt-1 text-lg font-semibold text-ink">{auditActionLabel(entry.action)}</h2>
              <p className="mt-1 text-sm text-ink-muted">{formatDateTime(entry.createdAt)}</p>
            </div>
            <button type="button" className="text-sm font-semibold text-teal" onClick={onClose}>
              Close
            </button>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <Field label="User" value={actorLabel(entry)} />
            <Field label="Client" value={entry.client?.name ?? entry.clientId ?? "—"} />
            <Field label="Resource" value={`${resourceTypeLabel(entry.resourceType)} · ${entry.resourceId ?? "—"}`} />
            <Field label="Action" value={entry.action} />
          </dl>
        </header>

        <div className="space-y-6 px-6 py-5">
          <section>
            <h3 className="text-sm font-semibold text-ink">Before / after</h3>
            <div className="mt-3">
              <JsonDiffViewer before={entry.beforeData} after={entry.afterData} />
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-ink">Linked entities</h3>
            <div className="mt-3">
              {links.isLoading ? <p className="text-sm text-ink-muted">Loading digital links…</p> : <LinkedEntitiesPanel entities={entities} />}
            </div>
          </section>

          {hmrc.visible ? (
            <section className="rounded-xl border border-line bg-paper p-4">
              <h3 className="text-sm font-semibold text-ink">HMRC context</h3>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <Field label="Submission ID" value={hmrc.submissionId ?? "—"} />
                <Field label="Status" value={hmrc.status ?? "—"} />
              </dl>
            </section>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-xl bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-dark"
              onClick={() => downloadText(`audit-entry-${entry.id}.json`, JSON.stringify(entry, null, 2))}
            >
              Export this entry
            </button>
            {entry.clientId ? (
              <Link
                href={`/practice/clients/${entry.clientId}`}
                className="rounded-xl border border-line px-4 py-2 text-sm font-semibold text-ink hover:border-teal/40"
              >
                Open related client
              </Link>
            ) : null}
          </div>
        </div>
      </aside>
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
