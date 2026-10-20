"use client";

import { ErrorBanner } from "@/components/ErrorBanner";
import { FirmStatsCard } from "@/components/FirmStatsCard";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { WorkspaceGate } from "@/components/WorkspaceGate";
import { useAdminHealth } from "@/hooks/useAdmin";

export default function AdminSystemHealthPage() {
  const health = useAdminHealth();

  return (
    <WorkspaceGate allow="platform">
      <div className="space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Operations</p>
          <h2 className="mt-1 text-2xl font-semibold text-ink">System health</h2>
          <p className="mt-2 text-sm text-ink-muted">API and database reachability for the platform. No tenant records.</p>
        </div>
        {health.isError ? <ErrorBanner title="Health check failed" message={health.error.message} /> : null}
        {health.isLoading ? (
          <LoadingSpinner label="Checking system health…" />
        ) : health.data ? (
          <div className="grid gap-4 md:grid-cols-3">
            <FirmStatsCard label="Status" value={health.data.status} hint="Database ping succeeded" />
            <FirmStatsCard label="Service" value={health.data.service} />
            <FirmStatsCard label="Scope" value={health.data.scope ?? "platform"} hint="Platform staff only" />
          </div>
        ) : null}
      </div>
    </WorkspaceGate>
  );
}
