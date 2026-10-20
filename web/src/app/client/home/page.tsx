"use client";

import Link from "next/link";
import { ErrorBanner } from "@/components/ErrorBanner";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { StatusCard } from "@/components/StatusCard";
import { WorkspaceGate } from "@/components/WorkspaceGate";
import { useClientWorkspace } from "@/hooks/useClientWorkspace";
import { useSession } from "@/hooks/useSession";
import { formatDate, obligationStatus } from "@/lib/format";

export default function ClientHomePage() {
  const { user } = useSession();
  const { me, obligations } = useClientWorkspace();
  const vat = obligations.data?.vat ?? [];
  const itsa = obligations.data?.itsa ?? [];
  const nextVat = vat.filter((item) => obligationStatus(item.status) === "open").sort((a, b) => a.due.localeCompare(b.due))[0];
  const nextItsa = itsa
    .filter((item) => obligationStatus(item.status) === "open")
    .sort((a, b) => a.due.localeCompare(b.due))[0];
  const actionNeeded = Boolean(nextVat || nextItsa);

  return (
    <WorkspaceGate allow="client" clientId={user?.clientId}>
      <div className="space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Client portal</p>
          <h1 className="mt-1 text-3xl font-semibold text-ink">{me.data?.name ?? "Your tax position"}</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">
            This portal only loads your own client record. Other clients at the firm stay hidden.
          </p>
        </div>
        {me.isError || obligations.isError ? (
          <ErrorBanner title="Unable to load your portal" message="Ask your accountant if this continues." />
        ) : null}
        {me.isLoading || obligations.isLoading ? <LoadingSpinner label="Loading your portal…" /> : null}
        <div className="grid gap-4 md:grid-cols-3">
          <StatusCard
            label="Overall"
            value={actionNeeded ? "Action needed" : "Up to date"}
            hint={actionNeeded ? "Action needed" : "Up to date"}
            tone={actionNeeded ? "action" : "ok"}
          />
          <StatusCard label="Next VAT due" value={formatDate(nextVat?.due)} hint={nextVat ? nextVat.periodKey : "No open VAT period"} />
          <StatusCard
            label="Next ITSA due"
            value={formatDate(nextItsa?.due)}
            hint={nextItsa ? nextItsa.taxYear : "No open ITSA obligation"}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/client/vat" className="rounded-2xl border border-line bg-white p-5 shadow-sm hover:border-teal/40">
            <h2 className="text-lg font-semibold">VAT</h2>
            <p className="mt-2 text-sm text-ink-muted">Review your VAT periods and submitted amounts.</p>
          </Link>
          <Link href="/client/itsa" className="rounded-2xl border border-line bg-white p-5 shadow-sm hover:border-teal/40">
            <h2 className="text-lg font-semibold">ITSA</h2>
            <p className="mt-2 text-sm text-ink-muted">See quarterly Income Tax updates for your businesses.</p>
          </Link>
          <Link href="/client/documents" className="rounded-2xl border border-line bg-white p-5 shadow-sm hover:border-teal/40">
            <h2 className="text-lg font-semibold">Documents</h2>
            <p className="mt-2 text-sm text-ink-muted">Upload receipts and statements for your accountant.</p>
          </Link>
          <Link href="/client/messages" className="rounded-2xl border border-line bg-white p-5 shadow-sm hover:border-teal/40">
            <h2 className="text-lg font-semibold">Messages</h2>
            <p className="mt-2 text-sm text-ink-muted">Send a note to your accountant about this record only.</p>
          </Link>
        </div>
      </div>
    </WorkspaceGate>
  );
}
