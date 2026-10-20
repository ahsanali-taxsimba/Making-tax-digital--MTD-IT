"use client";

import { useMemo, useState } from "react";
import { AuditDetailDrawer } from "@/components/audit/AuditDetailDrawer";
import { AuditFiltersPanel } from "@/components/audit/AuditFiltersPanel";
import { AuditTable } from "@/components/audit/AuditTable";
import { ExportButton } from "@/components/audit/ExportButton";
import { ErrorBanner } from "@/components/ErrorBanner";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { WorkspaceGate } from "@/components/WorkspaceGate";
import { useAuditExport, useAuditLogs } from "@/hooks/useAuditLogs";
import { useClients } from "@/hooks/useClients";
import { useSession } from "@/hooks/useSession";
import { EMPTY_AUDIT_FILTERS, exportPeriod, type AuditFilters, type AuditLogEntry } from "@/lib/audit";

export default function PracticeAuditPage() {
  const { user } = useSession();
  const [draft, setDraft] = useState<AuditFilters>(EMPTY_AUDIT_FILTERS);
  const [applied, setApplied] = useState<AuditFilters>(EMPTY_AUDIT_FILTERS);
  const [selected, setSelected] = useState<AuditLogEntry | null>(null);
  const clients = useClients();
  const logs = useAuditLogs(applied);
  const exporter = useAuditExport();
  const rows = logs.data ?? [];
  const clientRows = useMemo(() => clients.data ?? [], [clients.data]);

  return (
    <WorkspaceGate allow="practice" firmId={user?.firmId}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Audit</p>
            <h2 className="mt-1 text-2xl font-semibold text-ink">HMRC audit trail</h2>
            <p className="mt-2 max-w-2xl text-sm text-ink-muted">
              Immutable events for your firm. Inspect before/after snapshots, digital links, and export the trail for HMRC.
            </p>
          </div>
          <ExportButton
            filters={applied}
            exporting={exporter.isPending}
            onExport={() =>
              exporter.mutateAsync({
                clientId: applied.clientId || undefined,
                period: exportPeriod(applied),
              })
            }
          />
        </div>

        {logs.isError ? <ErrorBanner title="Audit log unavailable" message={logs.error.message} /> : null}
        {exporter.isError ? <ErrorBanner title="Export failed" message={exporter.error.message} /> : null}

        <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <AuditFiltersPanel
            value={draft}
            clients={clientRows}
            onChange={setDraft}
            onApply={() => {
              setApplied(draft);
              setSelected(null);
            }}
          />
          <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
            {logs.isLoading ? (
              <div className="px-4 py-8">
                <LoadingSpinner label="Loading audit logs…" />
              </div>
            ) : (
              <AuditTable entries={rows} selectedId={selected?.id} onSelect={setSelected} />
            )}
          </section>
        </div>
      </div>
      <AuditDetailDrawer entry={selected} onClose={() => setSelected(null)} />
    </WorkspaceGate>
  );
}
