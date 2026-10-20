"use client";

import Link from "next/link";
import { BillingSubNav } from "@/components/BillingSubNav";
import { ErrorBanner } from "@/components/ErrorBanner";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { WorkspaceGate } from "@/components/WorkspaceGate";
import { useBillingSubscription } from "@/hooks/useBilling";
import { useSession } from "@/hooks/useSession";
import { featureLabel, formatGbp } from "@/lib/billing";

export default function SubscriptionPage() {
  const { user } = useSession();
  const sub = useBillingSubscription();
  const data = sub.data;
  const current = data?.subscription;

  return (
    <WorkspaceGate allow="practice" firmId={user?.firmId}>
      <div className="space-y-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Billing</p>
          <h2 className="mt-1 text-2xl font-semibold text-ink">Subscription</h2>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">Features come from the catalog row, not from hardcoded plan names.</p>
        </div>
        <BillingSubNav />
        {sub.isError ? <ErrorBanner title="Subscription unavailable" message={sub.error.message} /> : null}
        {sub.isLoading ? <LoadingSpinner label="Loading subscription…" /> : null}
        <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
          {current ? (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-ink">{current.plan.name}</h3>
              <p className="text-sm text-ink-muted">
                {current.status} · qty {current.quantity} · {formatGbp(current.monthlyTotalPence)} incl. VAT
              </p>
              {current.currentPeriodEnd ? (
                <p className="text-sm text-ink-muted">Current period ends {new Date(current.currentPeriodEnd).toLocaleDateString("en-GB")}</p>
              ) : null}
              {current.cancelAtPeriodEnd ? <p className="text-sm text-warning">Cancels at period end</p> : null}
              <ul className="mt-4 grid gap-1 text-sm md:grid-cols-2">
                {current.plan.features.map((feature) => (
                  <li key={feature}>• {featureLabel(feature)}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div>
              <p className="text-sm text-ink-muted">This firm is on a trial. Pick a paid plan to generate VAT invoices.</p>
              <Link href="/practice/pricing" className="mt-4 inline-block rounded-xl bg-teal px-4 py-2 text-sm font-semibold text-white">
                View pricing
              </Link>
            </div>
          )}
        </section>
      </div>
    </WorkspaceGate>
  );
}
