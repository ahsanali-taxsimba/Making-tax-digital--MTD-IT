"use client";

import { ErrorBanner } from "@/components/ErrorBanner";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { WorkspaceGate } from "@/components/WorkspaceGate";
import { useFeatureFlags } from "@/hooks/useAdmin";

export default function AdminFeatureFlagsPage() {
  const flags = useFeatureFlags();
  const rows = flags.data ?? [];

  return (
    <WorkspaceGate allow="platform">
      <div className="space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Developer console</p>
          <h2 className="mt-1 text-2xl font-semibold text-ink">Feature flags</h2>
          <p className="mt-2 text-sm text-ink-muted">Platform-wide switches. They never expose client financial data.</p>
        </div>
        {flags.isError ? <ErrorBanner title="Flags unavailable" message={flags.error.message} /> : null}
        {flags.isLoading ? <LoadingSpinner label="Loading feature flags…" /> : null}
        <section className="overflow-hidden rounded-2xl border border-line bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-paper text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Key</th>
                <th className="px-4 py-3 font-semibold">Enabled</th>
                <th className="px-4 py-3 font-semibold">Description</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="px-4 py-4 font-medium">{row.key}</td>
                  <td className="px-4 py-4">{row.enabled ? "On" : "Off"}</td>
                  <td className="px-4 py-4 text-ink-muted">{row.description ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && !flags.isLoading && !flags.isError ? (
            <p className="px-4 py-6 text-sm text-ink-muted">No feature flags configured.</p>
          ) : null}
        </section>
      </div>
    </WorkspaceGate>
  );
}
