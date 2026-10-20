"use client";

import Link from "next/link";
import { ErrorBanner } from "@/components/ErrorBanner";
import { FirmStatsCard } from "@/components/FirmStatsCard";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { WorkspaceGate } from "@/components/WorkspaceGate";
import { useFirm } from "@/hooks/useFirm";
import { useSession } from "@/hooks/useSession";
import { canInviteStaff } from "@/lib/session";
import { roleLabel } from "@/lib/practice";

export default function PracticeDashboardPage() {
  const { dashboard } = useFirm();
  const { user } = useSession();
  const data = dashboard.data;

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
              <h2 className="mt-1 text-2xl font-semibold text-ink">Practice dashboard</h2>
              <p className="mt-2 max-w-2xl text-sm text-ink-muted">
                This workspace is scoped to your firm. Other accountancy firms and their clients are never requested.
              </p>
            </div>
            <div className="flex gap-3">
              <Link href="/practice/clients?new=1" className="rounded-xl bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-dark">
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
            <FirmStatsCard label="Staff" value={data.staffCount} hint="Admins, accountants and assistants" />
            <FirmStatsCard label="Clients" value={data.clientCount} hint="Individuals, companies and landlords" />
            <FirmStatsCard label="Open VAT obligations" value={data.openVatObligations} hint="Due or in progress with HMRC" />
            <FirmStatsCard label="Open ITSA obligations" value={data.openItsaObligations} hint="Quarterly updates, EOPS and finals" />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Link href="/practice/vat" className="rounded-2xl border border-line bg-white p-5 shadow-sm hover:border-teal/40">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">VAT</p>
              <h3 className="mt-2 text-lg font-semibold">VAT returns</h3>
            </Link>
            <Link href="/practice/itsa" className="rounded-2xl border border-line bg-white p-5 shadow-sm hover:border-teal/40">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">ITSA</p>
              <h3 className="mt-2 text-lg font-semibold">ITSA submissions</h3>
            </Link>
            <Link href="/practice/bank-feeds" className="rounded-2xl border border-line bg-white p-5 shadow-sm hover:border-teal/40">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Bank</p>
              <h3 className="mt-2 text-lg font-semibold">Bank feeds</h3>
            </Link>
          </div>
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
