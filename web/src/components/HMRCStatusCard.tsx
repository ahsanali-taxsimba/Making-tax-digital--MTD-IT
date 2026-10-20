"use client";

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { environmentLabel, formatCountdown, formatDate } from "@/lib/format";
import { hmrcUserMessage } from "@/lib/errors";
import type { HmrcStatus } from "@/lib/types";
import { ConnectButton } from "./ConnectButton";
import { DisconnectButton } from "./DisconnectButton";
import { LoadingSpinner } from "./LoadingSpinner";

export function HMRCStatusCard({
  status,
  isLoading,
  error,
  clientId,
  environment,
  canManage,
  onRefresh,
  refreshing,
}: {
  status?: HmrcStatus;
  isLoading: boolean;
  error: unknown;
  clientId?: string | null;
  environment: string;
  canManage: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const connected = Boolean(status?.connected);
  const env = environmentLabel(status?.environment ?? environment);
  const expired = connected && status?.expiresAt ? new Date(status.expiresAt).getTime() <= now : false;

  return (
    <section className="rounded-2xl border border-line bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">HMRC VAT</p>
          <h2 className="mt-1 text-xl font-semibold text-ink">Connection status</h2>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
            connected && !expired ? "bg-success-soft text-success" : "bg-amber-50 text-amber-800"
          }`}
        >
          {connected ? (expired ? "Expired" : "Connected") : "Not connected"}
        </span>
      </div>

      {isLoading ? (
        <div className="mt-6">
          <LoadingSpinner label="Checking HMRC connection…" />
        </div>
      ) : error ? (
        <p className="mt-6 text-sm text-danger">
          {hmrcUserMessage(error instanceof ApiError ? error.errorCode : undefined, error instanceof Error ? error.message : "Unable to load status.")}
        </p>
      ) : (
        <dl className="mt-6 grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-ink-muted">Environment</dt>
            <dd className="mt-1 text-sm font-medium capitalize">{env}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-ink-muted">Token expiry</dt>
            <dd className="mt-1 text-sm font-medium">{connected ? formatCountdown(status?.expiresAt, now) : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-ink-muted">Expires at</dt>
            <dd className="mt-1 text-sm font-medium">{formatDate(status?.expiresAt)}</dd>
          </div>
        </dl>
      )}

      {expired ? (
        <p className="mt-4 text-sm text-amber-800">Your HMRC VAT connection has expired.</p>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        {canManage && !connected ? <ConnectButton clientId={clientId} environment={env} /> : null}
        {canManage && connected ? (
          <>
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="inline-flex items-center justify-center rounded-xl border border-line bg-paper px-4 py-2.5 text-sm font-semibold text-ink hover:bg-white disabled:opacity-50"
            >
              {refreshing ? "Refreshing…" : "Refresh token"}
            </button>
            <DisconnectButton clientId={clientId} environment={env} />
            {expired ? <ConnectButton clientId={clientId} environment={env} /> : null}
          </>
        ) : null}
        {!canManage ? (
          <p className="text-sm text-ink-muted">
            Ask your accountant if this HMRC VAT connection needs to be renewed.
          </p>
        ) : null}
      </div>
    </section>
  );
}
