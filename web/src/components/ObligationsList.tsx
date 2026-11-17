"use client";

import Link from "next/link";
import { formatDate, obligationStatus } from "@/lib/format";
import type { VatObligation } from "@/lib/types";
import { LoadingSpinner } from "./LoadingSpinner";

export function ObligationsList({
  obligations,
  isLoading,
  clientId,
}: {
  obligations?: VatObligation[];
  isLoading: boolean;
  clientId?: string | null;
}) {
  if (isLoading) {
    return <LoadingSpinner label="Loading VAT obligations…" />;
  }

  if (!obligations?.length) {
    return <p className="text-sm text-ink-muted">No VAT obligations have been fetched for this client yet.</p>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-paper text-xs uppercase tracking-wide text-ink-muted">
          <tr>
            <th className="px-4 py-3 font-semibold">Period</th>
            <th className="px-4 py-3 font-semibold">Due date</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3 font-semibold"> </th>
          </tr>
        </thead>
        <tbody>
          {obligations.map((item) => {
            const status = obligationStatus(item.status);
            return (
              <tr key={item.id} className="border-t border-line">
                <td className="px-4 py-4">
                  <p className="font-medium text-ink">{item.periodKey}</p>
                  <p className="text-ink-muted">
                    {formatDate(item.start)} – {formatDate(item.end)}
                  </p>
                </td>
                <td className="px-4 py-4">{formatDate(item.due)}</td>
                <td className="px-4 py-4">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${
                      status === "open" ? "bg-amber-50 text-amber-800" : "bg-success-soft text-success"
                    }`}
                  >
                    {status}
                  </span>
                </td>
                <td className="px-4 py-4 text-right">
                  <Link
                    href={`/vat/returns/prepare?clientId=${clientId ?? item.clientId}&periodKey=${encodeURIComponent(item.periodKey)}&obligationId=${item.id}`}
                    className="inline-flex rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-teal hover:bg-paper"
                  >
                    Prepare VAT Return
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
