"use client";

import Link from "next/link";
import { WorkspaceGate } from "@/components/WorkspaceGate";
import { useSession } from "@/hooks/useSession";

const LINKS = [
  {
    href: "/practice/reconciliation",
    label: "Reconciliation",
    detail: "Match Yapily and CSV lines to invoices, bills, and journals for this firm.",
  },
  {
    href: "/reconciliation",
    label: "Yapily sync",
    detail: "Open the live bank-feed workspace for the selected client in your firm.",
  },
  {
    href: "/categorisation",
    label: "Auto-categorisation",
    detail: "Review suggested categories before they post to the ledger.",
  },
  {
    href: "/matching",
    label: "Invoice matching",
    detail: "Confirm invoice and bill matches against bank transactions.",
  },
];

export default function PracticeBankFeedsPage() {
  const { user } = useSession();

  return (
    <WorkspaceGate allow="practice" firmId={user?.firmId}>
      <div className="space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Bank feeds</p>
          <h2 className="mt-1 text-2xl font-semibold text-ink">Yapily and CSV</h2>
          <p className="mt-2 text-sm text-ink-muted">
            Feeds and statements stay inside your firm. Another practice can never be selected from this workspace.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-2xl border border-line bg-white p-5 shadow-sm hover:border-teal/40"
            >
              <h3 className="text-lg font-semibold text-ink">{item.label}</h3>
              <p className="mt-2 text-sm text-ink-muted">{item.detail}</p>
            </Link>
          ))}
        </div>
      </div>
    </WorkspaceGate>
  );
}
