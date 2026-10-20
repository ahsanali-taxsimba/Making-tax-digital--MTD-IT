"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { WorkspaceGate } from "@/components/WorkspaceGate";
import { useClients } from "@/hooks/useClients";
import { useSession } from "@/hooks/useSession";
import { setSelectedClientId } from "@/lib/session";
import { clientHmrcStatus, clientTypeLabel, hmrcStatusLabel, riskLabel } from "@/lib/practice";

export default function ClientWorkspacePage() {
  const params = useParams<{ id: string }>();
  const { user } = useSession();
  const clients = useClients();
  const record = clients.data?.find((item) => item.id === params.id);

  useEffect(() => {
    if (params.id) {
      setSelectedClientId(params.id);
    }
  }, [params.id]);

  return (
    <WorkspaceGate allow="practice" firmId={user?.firmId}>
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
            <Link href={`/practice/vat`} className="rounded-2xl border border-line bg-white p-5 shadow-sm hover:border-teal/40">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">VAT</p>
              <h3 className="mt-2 text-lg font-semibold">VAT returns</h3>
              <p className="mt-2 text-sm text-ink-muted">VAT periods and submissions for this firm.</p>
            </Link>
            <Link href={`/practice/itsa`} className="rounded-2xl border border-line bg-white p-5 shadow-sm hover:border-teal/40">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">ITSA</p>
              <h3 className="mt-2 text-lg font-semibold">ITSA submissions</h3>
              <p className="mt-2 text-sm text-ink-muted">Quarterly updates, EOPS, and the final declaration.</p>
            </Link>
            <Link href="/practice/documents" className="rounded-2xl border border-line bg-white p-5 shadow-sm hover:border-teal/40">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Documents</p>
              <h3 className="mt-2 text-lg font-semibold">Firm documents</h3>
              <p className="mt-2 text-sm text-ink-muted">Receipts and records uploaded for clients in this practice.</p>
            </Link>
          </div>
        </div>
      )}
    </WorkspaceGate>
  );
}
