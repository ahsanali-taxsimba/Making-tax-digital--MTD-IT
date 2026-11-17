"use client";

import Link from "next/link";
import { formatDate, formatMoney, obligationStatus } from "@/lib/format";
import { useClient } from "@/hooks/useClient";
import { useClientObligations, useVatReturns } from "@/hooks/useClientObligations";
import { useSession } from "@/hooks/useSession";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { RequireAuth } from "@/components/RequireAuth";

export default function PortalVatPage() {
  const { clientId, user } = useSession();
  const client = useClient();
  const resolvedId = client.data?.id ?? clientId ?? user?.clientId;
  const { vat } = useClientObligations(resolvedId);
  const returns = useVatReturns(resolvedId);
  const rows = vat.data ?? [];

  return (
    <RequireAuth>
      <div className="space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">VAT</p>
          <h1 className="mt-1 text-3xl font-semibold">VAT periods</h1>
          <p className="mt-2 text-sm text-ink-muted">Open periods need a review. Fulfilled periods have already been sent to HMRC.</p>
        </div>
        {vat.isLoading ? <LoadingSpinner label="Loading VAT periods…" /> : null}
        <div className="overflow-hidden rounded-2xl border border-line bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-paper text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Period</th>
                <th className="px-4 py-3 font-semibold">Due date</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Submitted amount</th>
                <th className="px-4 py-3 font-semibold"> </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => {
                const submitted = returns.data?.find((row) => row.periodKey === item.periodKey);
                const status = obligationStatus(item.status);
                return (
                  <tr key={item.id} className="border-t border-line">
                    <td className="px-4 py-4">
                      <p className="font-medium">{item.periodKey}</p>
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
                    <td className="px-4 py-4">{submitted ? formatMoney(submitted.netVatDue ?? submitted.box5) : "—"}</td>
                    <td className="px-4 py-4 text-right">
                      <Link
                        href={`/portal/vat/${encodeURIComponent(item.periodKey)}`}
                        className="text-sm font-semibold text-teal hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!rows.length && !vat.isLoading ? <p className="px-4 py-6 text-sm text-ink-muted">No VAT periods have been fetched yet.</p> : null}
        </div>
      </div>
    </RequireAuth>
  );
}
