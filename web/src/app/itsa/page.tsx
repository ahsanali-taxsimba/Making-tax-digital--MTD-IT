"use client";

import Link from "next/link";
import { ApiError } from "@/lib/api";
import { hmrcUserMessage } from "@/lib/errors";
import { useHmrcStatus, useRefreshHmrc } from "@/hooks/useHmrcStatus";
import { useSession } from "@/hooks/useSession";
import { ErrorBanner } from "@/components/ErrorBanner";
import { HMRCStatusCard } from "@/components/HMRCStatusCard";
import { RequireAuth } from "@/components/RequireAuth";

export default function ItsaDashboardPage() {
  const { clientId, environment, canManage } = useSession();
  const status = useHmrcStatus(clientId, environment);
  const refresh = useRefreshHmrc(clientId, environment);

  return (
    <RequireAuth>
      <div className="space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">ITSA</p>
          <h1 className="mt-1 text-3xl font-semibold text-ink">HMRC ITSA connection</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">
            Connect a client to HMRC Making Tax Digital for Income Tax. One HMRC grant covers VAT and ITSA. Access
            tokens stay encrypted on the server and are never shown in this browser.
          </p>
        </div>

        {!clientId ? (
          <ErrorBanner title="Choose a client" message="Select an Income Tax client before connecting to HMRC." />
        ) : null}

        <HMRCStatusCard
          regime="itsa"
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
              "itsa",
            )}
          />
        ) : null}

        <section className="rounded-2xl border border-line bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">ITSA obligations</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Once HMRC is connected, fetch quarterly updates for sole trade and property businesses.
          </p>
          <Link
            href={`/itsa/obligations${clientId ? `?clientId=${clientId}` : ""}`}
            className="mt-4 inline-flex rounded-xl bg-teal px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-dark"
          >
            View ITSA Obligations
          </Link>
        </section>
      </div>
    </RequireAuth>
  );
}
