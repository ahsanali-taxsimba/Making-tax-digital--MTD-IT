"use client";

import { useMemo, useState } from "react";
import { businessTypeLabel, categoryLabel, formatDate, formatMoney } from "@/lib/format";
import { useClient } from "@/hooks/useClient";
import { useClientObligations, useConfirmPortal, useItsaSubmissions, usePropertyIncome } from "@/hooks/useClientObligations";
import { useSession } from "@/hooks/useSession";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { RequireAuth } from "@/components/RequireAuth";
import { StatusCard } from "@/components/StatusCard";
import { SuccessBanner } from "@/components/SuccessBanner";

function sumRecord(values?: Record<string, number>): number {
  return Object.values(values ?? {}).reduce((total, value) => total + Number(value || 0), 0);
}

export default function PortalItsaPage() {
  const { clientId, user, canManage } = useSession();
  const client = useClient();
  const resolvedId = client.data?.id ?? clientId ?? user?.clientId;
  const { itsa } = useClientObligations(resolvedId);
  const submissions = useItsaSubmissions(resolvedId);
  const [tab, setTab] = useState<"business" | "property">("business");
  const property = usePropertyIncome(resolvedId, "2026-04-06", "2026-07-05");
  const confirm = useConfirmPortal();

  const filteredUpdates = useMemo(() => {
    return (submissions.updates.data ?? []).filter((item) => {
      const type = businessTypeLabel(item.business?.type);
      return tab === "property" ? type === "Property" : type === "Sole trade";
    });
  }, [submissions.updates.data, tab]);

  const eops = (submissions.eops.data ?? []).filter((item) => {
    const type = businessTypeLabel(item.business?.type ?? item.typeOfBusiness);
    return tab === "property" ? type === "Property" : type !== "Property";
  });
  const finals = submissions.finals.data ?? [];

  return (
    <RequireAuth>
      <div className="space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Income Tax</p>
          <h1 className="mt-1 text-3xl font-semibold">ITSA updates</h1>
          <p className="mt-2 text-sm text-ink-muted">Quarterly figures for your sole trade and property businesses, plus EOPS and the final declaration.</p>
        </div>

        <div className="flex gap-2">
          {(["business", "property"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                tab === value ? "bg-teal text-white" : "bg-white text-ink-muted hover:bg-paper"
              }`}
            >
              {value === "business" ? "Business (sole trade)" : "Property"}
            </button>
          ))}
        </div>

        {tab === "property" ? (
          <StatusCard
            label="Property income this quarter"
            value={formatMoney(sumRecord(property.data?.incomes))}
            hint={property.data ? "From the ledger" : "No property totals yet"}
          />
        ) : null}

        <section className="overflow-hidden rounded-2xl border border-line bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-paper text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Period</th>
                <th className="px-4 py-3 font-semibold">Income</th>
                <th className="px-4 py-3 font-semibold">Expenses</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredUpdates.map((item) => (
                <tr key={item.id} className="border-t border-line">
                  <td className="px-4 py-4">
                    <p className="font-medium">{item.periodId}</p>
                    <p className="text-ink-muted">
                      {formatDate(item.periodStart)} – {formatDate(item.periodEnd)}
                    </p>
                  </td>
                  <td className="px-4 py-4">{formatMoney(sumRecord(item.incomes))}</td>
                  <td className="px-4 py-4">{formatMoney(sumRecord(item.expenses))}</td>
                  <td className="px-4 py-4 capitalize">{item.status.toLowerCase()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {submissions.updates.isLoading ? (
            <div className="p-4">
              <LoadingSpinner label="Loading quarterly updates…" />
            </div>
          ) : null}
          {!filteredUpdates.length && !submissions.updates.isLoading ? (
            <p className="px-4 py-6 text-sm text-ink-muted">No quarterly updates for this tab yet.</p>
          ) : null}
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <StatusCard
            label="EOPS"
            value={eops[0] ? categoryLabel(eops[0].status) : "Not submitted"}
            hint={eops[0] ? eops[0].taxYear : itsa.data?.[0]?.taxYear ?? "2025-26"}
            tone={eops[0] ? "ok" : "action"}
          />
          <StatusCard
            label="Final declaration"
            value={finals[0] ? categoryLabel(finals[0].status) : "Not submitted"}
            hint={finals[0] ? finals[0].taxYear : "Awaiting EOPS"}
            tone={finals[0] ? "ok" : "neutral"}
          />
        </div>

        {confirm.isSuccess ? <SuccessBanner title="Approved" message="Your accountant can send the quarterly update to HMRC." /> : null}
        {!canManage ? (
          <button
            type="button"
            onClick={() => confirm.mutate({ kind: "itsa" })}
            className="rounded-xl bg-teal px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-dark"
          >
            Approve quarterly update
          </button>
        ) : null}
      </div>
    </RequireAuth>
  );
}
