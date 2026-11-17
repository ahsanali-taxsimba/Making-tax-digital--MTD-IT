"use client";

import Link from "next/link";
import { ErrorBanner } from "@/components/ErrorBanner";
import { FirmStatsCard } from "@/components/FirmStatsCard";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { WorkspaceGate } from "@/components/WorkspaceGate";
import { useFirm } from "@/hooks/useFirm";
import { useSession } from "@/hooks/useSession";
import { PRACTICE_HOME_GROUPS, practiceHomeTiles, roleLabel } from "@/lib/practice";
import { formatDate } from "@/lib/format";
import { canInviteStaff } from "@/lib/session";
import { canonicalRole } from "@/lib/roles";

export default function PracticeDashboardPage() {
  const { dashboard } = useFirm();
  const { user } = useSession();
  const data = dashboard.data;
  const role = canonicalRole(user) ?? user?.role;
  const tiles = data ? practiceHomeTiles(data, role) : [];

  return (
    <WorkspaceGate allow="practice" firmId={user?.firmId}>
      {dashboard.isError ? (
        <ErrorBanner title="Dashboard unavailable" message={dashboard.error.message} />
      ) : dashboard.isLoading || !data ? (
        <LoadingSpinner label="Loading the practice dashboard…" />
      ) : (
        <div className="space-y-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm text-ink-muted">{data.firm.name}</p>
              <h2 className="mt-1 text-2xl font-semibold text-ink">Practice home</h2>
              <p className="mt-2 max-w-2xl text-sm text-ink-muted">
                VAT, ITSA, bank feeds, documents and the bookkeeping agent for this firm only. Counts below are live.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/practice/agent" className="rounded-xl bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-dark">
                Ask the agent
              </Link>
              <Link href="/practice/clients?new=1" className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:border-teal/40">
                Add client
              </Link>
              {canInviteStaff(user?.role, user) ? (
                <Link href="/practice/staff?invite=1" className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:border-teal/40">
                  Invite staff
                </Link>
              ) : null}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <FirmStatsCard label="Unmatched bank" value={data.unmatchedBank} hint="Lines still to code or match" />
            <FirmStatsCard label="Overdue invoices" value={data.overdueInvoices} hint="Posted sales invoices past due" />
            <FirmStatsCard label="Open VAT" value={data.openVatObligations} hint={dueHint(data.nextVatDue, "No open VAT period")} />
            <FirmStatsCard label="Open ITSA" value={data.openItsaObligations} hint={dueHint(data.nextItsaDue, "No open ITSA obligation")} />
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <FirmStatsCard label="Open tasks" value={data.openTasks} hint="Not started, in progress, waiting on client" />
            <FirmStatsCard label="HMRC connected" value={data.hmrcConnected} hint={`${data.clientCount} clients in the firm`} />
            <FirmStatsCard label="Receipts to attach" value={data.unattachedReceipts} hint={`${data.receipts} receipts in total`} />
            <FirmStatsCard label="Clients" value={data.clientCount} hint={`${data.staffCount} staff · ${data.firm.billingStatus ?? "trial"}`} />
          </div>
          {PRACTICE_HOME_GROUPS.map((group) => {
            const items = tiles.filter((tile) => tile.group === group.id);
            if (!items.length) {
              return null;
            }
            return (
              <section key={group.id} className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-ink-muted">{group.title}</h3>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {items.map((tile) => (
                    <Link
                      key={tile.href}
                      href={tile.href}
                      className="rounded-2xl border border-line bg-white p-5 shadow-sm hover:border-teal/40"
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">{tile.kicker}</p>
                      <h4 className="mt-2 text-lg font-semibold text-ink">{tile.title}</h4>
                      <p className="mt-2 text-sm text-ink-muted">{tile.detail}</p>
                      <p className="mt-3 text-sm font-semibold text-teal">{tile.metric}</p>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
          <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-ink">Task workload by staff</h3>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.12em] text-ink-muted">
                  <tr>
                    <th className="py-2 font-semibold">Staff</th>
                    <th className="py-2 font-semibold">Not started</th>
                    <th className="py-2 font-semibold">In progress</th>
                    <th className="py-2 font-semibold">Waiting on client</th>
                    <th className="py-2 font-semibold">Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {data.taskWorkload.map((row) => (
                    <tr key={row.userId ?? "unassigned"} className="border-t border-line">
                      <td className="py-3">
                        <p className="font-medium">{row.name}</p>
                        <p className="text-xs text-ink-muted">{row.role ? roleLabel(row.role) : "No owner"}</p>
                      </td>
                      <td className="py-3">{row.open}</td>
                      <td className="py-3">{row.inProgress}</td>
                      <td className="py-3">{row.waitingOnClient}</td>
                      <td className="py-3">{row.completed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </WorkspaceGate>
  );
}

function dueHint(item: { due: string; label: string; clientName: string } | null | undefined, empty: string): string {
  if (!item) {
    return empty;
  }
  return `${item.clientName} · ${item.label} due ${formatDate(item.due)}`;
}
