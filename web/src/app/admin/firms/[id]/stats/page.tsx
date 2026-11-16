"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ErrorBanner } from "@/components/ErrorBanner";
import { FirmStatsCard } from "@/components/FirmStatsCard";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { WorkspaceGate } from "@/components/WorkspaceGate";
import { useAdminFirmStats } from "@/hooks/useAdmin";

export default function AdminFirmStatsPage() {
  const params = useParams<{ id: string }>();
  const stats = useAdminFirmStats(params.id);
  const data = stats.data;

  return (
    <WorkspaceGate allow="platform">
      <div className="space-y-8">
        <div>
          <Link href="/admin/firms" className="text-sm font-semibold text-teal hover:underline">
            ← Firms
          </Link>
          <h2 className="mt-2 text-2xl font-semibold text-ink">{data?.name ?? "Firm stats"}</h2>
          <p className="mt-2 text-sm text-ink-muted">
            Aggregated counts for this tenant. No client names, documents, or bank transactions are returned.
          </p>
        </div>
        {stats.isError ? <ErrorBanner title="Stats unavailable" message={stats.error.message} /> : null}
        {stats.isLoading || !data ? (
          <LoadingSpinner label="Loading firm counts…" />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <FirmStatsCard label="Clients" value={data.totalClients} hint="Headcount only" />
            <FirmStatsCard label="Firm users" value={data.totalFirmUsers} hint="All roles at this firm" />
            <FirmStatsCard label="VAT returns" value={data.totalVatReturns} hint="Submitted VAT returns" />
            <FirmStatsCard label="ITSA submissions" value={data.totalItsaSubmissions} hint="Quarterly updates sent" />
          </div>
        )}
      </div>
    </WorkspaceGate>
  );
}
