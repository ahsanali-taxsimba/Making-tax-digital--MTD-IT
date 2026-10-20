"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { RequireStaff } from "@/components/RequireStaff";
import { useClients } from "@/hooks/useClients";
import { setSelectedClientId } from "@/lib/session";
import { clientHmrcStatus, clientTypeLabel, hmrcStatusLabel, riskLabel } from "@/lib/practice";

export default function ClientWorkspacePage() {
  const params = useParams<{ id: string }>();
  const clients = useClients();
  const record = clients.data?.find((item) => item.id === params.id);

  useEffect(() => {
    if (params.id) {
      setSelectedClientId(params.id);
    }
  }, [params.id]);

  return (
    <RequireStaff>
      {!record ? (
        <LoadingSpinner label="Opening client workspace…" />
      ) : (
        <div className="space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Client workspace</p>
            <h2 className="mt-1 text-2xl font-semibold text-ink">{record.name}</h2>
            <p className="mt-2 text-sm text-ink-muted">
              {clientTypeLabel(record.type)} · {riskLabel(record.riskLevel)} risk · {hmrcStatusLabel(clientHmrcStatus(record))}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Link href={`/vat?clientId=${record.id}`} className="rounded-2xl border border-line bg-white p-5 shadow-sm hover:border-teal/40">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">VAT</p>
              <h3 className="mt-2 text-lg font-semibold">VAT connection</h3>
              <p className="mt-2 text-sm text-ink-muted">Connect HMRC VAT, fetch obligations, and prepare the return.</p>
            </Link>
            <Link href={`/itsa?clientId=${record.id}`} className="rounded-2xl border border-line bg-white p-5 shadow-sm hover:border-teal/40">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">ITSA</p>
              <h3 className="mt-2 text-lg font-semibold">ITSA connection</h3>
              <p className="mt-2 text-sm text-ink-muted">Quarterly updates, EOPS, and the final declaration.</p>
            </Link>
            <Link href="/portal" className="rounded-2xl border border-line bg-white p-5 shadow-sm hover:border-teal/40">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Portal</p>
              <h3 className="mt-2 text-lg font-semibold">Client portal preview</h3>
              <p className="mt-2 text-sm text-ink-muted">Records, messages, and approval tasks for this client.</p>
            </Link>
          </div>
        </div>
      )}
    </RequireStaff>
  );
}
