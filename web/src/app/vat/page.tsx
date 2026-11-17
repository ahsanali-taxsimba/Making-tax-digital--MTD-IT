"use client";

import Link from "next/link";
import { ApiError } from "@/lib/api";
import { hmrcUserMessage } from "@/lib/errors";
import { useHmrcStatus, useRefreshHmrc } from "@/hooks/useHmrcStatus";
import { useSession } from "@/hooks/useSession";
import { ErrorBanner } from "@/components/ErrorBanner";
import { HMRCStatusCard } from "@/components/HMRCStatusCard";
import { RequireAuth } from "@/components/RequireAuth";

export default function VatDashboardPage() {
  const { clientId, environment, canManage } = useSession();
  const status = useHmrcStatus(clientId, environment);
  const refresh = useRefreshHmrc(clientId, environment);

  return (
    <RequireAuth>
      <div className="space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">VAT</p>
          <h1 className="mt-1 text-3xl font-semibold text-ink">HMRC connection</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">
            Connect a client to HMRC Making Tax Digital for VAT. Access tokens stay encrypted on the server and are
            refreshed automatically before they expire.
          </p>
        </div>

        {!clientId ? (
          <ErrorBanner title="Choose a client" message="Select a VAT client before connecting to HMRC." />
        ) : null}

        <HMRCStatusCard
          status={status.data}
          isLoading={status.isLoading}
          error={status.error}
          clientId={clientId}
          environment={environment}
          canManage={canManage}
          refreshing={refresh.isPending}
          onRefresh={() =>
            refresh.mutate(undefined, {
              onError: () => undefined,
            })
          }
        />

        {refresh.error ? (
          <ErrorBanner
            title="Refresh failed"
            message={hmrcUserMessage(
              refresh.error instanceof ApiError ? refresh.error.errorCode : undefined,
              "Unable to refresh HMRC token.",
              "vat",
            )}
          />
        ) : null}

        <section className="rounded-2xl border border-line bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">VAT obligations</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Once HMRC is connected, fetch open and fulfilled periods and start a return.
          </p>
          <Link
            href={`/vat/obligations${clientId ? `?clientId=${clientId}` : ""}`}
            className="mt-4 inline-flex rounded-xl bg-teal px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-dark"
          >
            View VAT Obligations
          </Link>
        </section>
      </div>
    </RequireAuth>
  );
}
