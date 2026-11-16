"use client";

import Link from "next/link";
import { useState } from "react";
import { formatDate } from "@/lib/format";
import { hmrcStatusLabel } from "@/lib/practice";
import { setSelectedClientId } from "@/lib/session";
import { useHMRCStatus } from "@/hooks/useHmrcStatus";
import type { HmrcConnectionOverview } from "@/lib/types";
import { LoadingSpinner } from "./LoadingSpinner";

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "connected"
      ? "bg-success-soft text-success"
      : status === "disconnected"
        ? "bg-danger-soft text-danger"
        : "bg-paper text-ink-muted";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${tone}`}>{hmrcStatusLabel(status)}</span>;
}

export function HMRCConnectionTable({ rows }: { rows: HmrcConnectionOverview[] }) {
  const [selected, setSelected] = useState<HmrcConnectionOverview | null>(null);
  const detail = useHMRCStatus(selected?.clientId, selected?.environment.toLowerCase() ?? "sandbox");

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-paper text-xs uppercase tracking-[0.12em] text-ink-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Client</th>
              <th className="px-4 py-3 font-semibold">VAT</th>
              <th className="px-4 py-3 font-semibold">ITSA</th>
              <th className="px-4 py-3 font-semibold">Environment</th>
              <th className="px-4 py-3 font-semibold">Last HMRC interaction</th>
              <th className="px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.clientId} className="border-t border-line">
                <td className="px-4 py-3 font-medium text-ink">{row.clientName}</td>
                <td className="px-4 py-3">
                  <StatusPill status={row.vatStatus} />
                </td>
                <td className="px-4 py-3">
                  <StatusPill status={row.itsaStatus} />
                </td>
                <td className="px-4 py-3 capitalize">{row.environment.toLowerCase()}</td>
                <td className="px-4 py-3 text-ink-muted">
                  {row.lastHmrcInteraction ? (
                    <button type="button" className="text-left text-teal underline-offset-2 hover:underline" onClick={() => setSelected(row)}>
                      {formatDate(row.lastHmrcInteraction.at)} · {row.lastHmrcInteraction.actionType}
                    </button>
                  ) : (
                    <button type="button" className="text-teal underline-offset-2 hover:underline" onClick={() => setSelected(row)}>
                      View last interaction
                    </button>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/vat/connect?clientId=${row.clientId}`}
                    className="font-semibold text-teal underline-offset-2 hover:underline"
                    onClick={() => setSelectedClientId(row.clientId)}
                  >
                    Connect
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selected ? (
        <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Last HMRC interaction</p>
              <h2 className="mt-1 text-lg font-semibold text-ink">{selected.clientName}</h2>
            </div>
            <button type="button" className="text-sm text-ink-muted hover:text-ink" onClick={() => setSelected(null)}>
              Close
            </button>
          </div>
          {detail.isLoading ? <LoadingSpinner label="Loading HMRC status…" /> : null}
          <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
            <div>
              <dt className="text-ink-muted">Connection</dt>
              <dd className="font-medium">{detail.data && "connected" in detail.data ? (detail.data.connected ? "Connected" : "Not connected") : selected.connected ? "Connected" : "Not connected"}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Environment</dt>
              <dd className="font-medium capitalize">{selected.environment.toLowerCase()}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Last action</dt>
              <dd className="font-medium">{selected.lastHmrcInteraction?.actionType ?? "No HMRC calls recorded yet"}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">When</dt>
              <dd className="font-medium">{formatDate(selected.lastHmrcInteraction?.at)}</dd>
            </div>
            {selected.lastHmrcInteraction?.path ? (
              <div className="md:col-span-2">
                <dt className="text-ink-muted">Request</dt>
                <dd className="font-medium">
                  {selected.lastHmrcInteraction.method} {selected.lastHmrcInteraction.path}
                  {selected.lastHmrcInteraction.statusCode ? ` · ${selected.lastHmrcInteraction.statusCode}` : ""}
                </dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : null}
    </div>
  );
}
