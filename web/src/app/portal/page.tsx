"use client";

import { formatDate, obligationStatus } from "@/lib/format";
import { useClient } from "@/hooks/useClient";
import { useClientObligations, useConfirmPortal } from "@/hooks/useClientObligations";
import { useSession } from "@/hooks/useSession";
import { ErrorBanner } from "@/components/ErrorBanner";
import { ObligationsTimeline } from "@/components/ObligationsTimeline";
import { RequireAuth } from "@/components/RequireAuth";
import { StatusCard } from "@/components/StatusCard";
import { SuccessBanner } from "@/components/SuccessBanner";

export default function PortalHomePage() {
  const { user, clientId, canManage } = useSession();
  const client = useClient();
  const resolvedId = client.data?.id ?? clientId ?? user?.clientId;
  const { vat, itsa, tasks } = useClientObligations(resolvedId);
  const confirm = useConfirmPortal();
  const nextVat = (vat.data ?? []).filter((item) => obligationStatus(item.status) === "open").sort((a, b) => a.due.localeCompare(b.due))[0];
  const nextItsa = (itsa.data ?? [])
    .filter((item) => obligationStatus(item.status) === "open" && (item.type === "QUARTERLY_UPDATE" || !item.type))
    .sort((a, b) => a.due.localeCompare(b.due))[0];
  const openTasks = (tasks.data ?? []).filter((item) => item.status === "OPEN" || item.status === "IN_PROGRESS");
  const actionNeeded = Boolean(nextVat || nextItsa || openTasks.length);

  return (
    <RequireAuth>
      <div className="space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Client portal</p>
          <h1 className="mt-1 text-3xl font-semibold text-ink">{client.data?.name ?? "Your tax position"}</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">
            See what is due, send records, and approve drafts. HMRC tokens are never shown here.
          </p>
        </div>

        {vat.isError || itsa.isError ? (
          <ErrorBanner title="Unable to load obligations" message="Try again in a moment. If this continues, ask your accountant." />
        ) : null}

        <div className="grid gap-4 md:grid-cols-3">
          <StatusCard
            label="Overall"
            value={actionNeeded ? "Action needed" : "Up to date"}
            hint={actionNeeded ? "Action needed" : "Up to date"}
            tone={actionNeeded ? "action" : "ok"}
          />
          <StatusCard label="Next VAT due" value={formatDate(nextVat?.due)} hint={nextVat ? nextVat.periodKey : "No open VAT period"} />
          <StatusCard
            label="Next ITSA quarterly"
            value={formatDate(nextItsa?.due)}
            hint={nextItsa ? nextItsa.periodId ?? nextItsa.taxYear : "No open quarterly update"}
          />
        </div>

        {confirm.isSuccess ? <SuccessBanner title="Thanks" message="Your accountant can see that you confirmed this." /> : null}
        {confirm.isError ? <ErrorBanner title="Could not confirm" message="Try again, or send a note from Messages." /> : null}

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Outstanding tasks</h2>
          <ObligationsTimeline
            items={openTasks.map((task) => ({
              id: task.id,
              title: task.title,
              due: task.dueDate,
              status: task.status,
              href: task.type.includes("VAT") || task.type === "APPROVE_RETURN" ? "/portal/vat" : task.type.includes("ITSA") ? "/portal/itsa" : "/portal/documents",
            }))}
          />
        </section>

        {!canManage ? (
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => confirm.mutate({ kind: "records" })}
              className="rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold hover:bg-paper"
            >
              Confirm I have provided records
            </button>
            <button
              type="button"
              onClick={() => confirm.mutate({ kind: "vat" })}
              className="rounded-xl bg-teal px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-dark"
            >
              Approve VAT return
            </button>
          </div>
        ) : (
          <p className="text-sm text-ink-muted">You are previewing the client portal as practice staff.</p>
        )}
      </div>
    </RequireAuth>
  );
}
