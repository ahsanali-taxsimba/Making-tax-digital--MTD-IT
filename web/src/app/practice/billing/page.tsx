"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { BillingSubNav } from "@/components/BillingSubNav";
import { ErrorBanner } from "@/components/ErrorBanner";
import { FirmStatsCard } from "@/components/FirmStatsCard";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { WorkspaceGate } from "@/components/WorkspaceGate";
import { useBillingPortal, useBillingSubscription, useCompleteCheckout } from "@/hooks/useBilling";
import { useSession } from "@/hooks/useSession";
import { formatGbp } from "@/lib/billing";
import { canonicalRole } from "@/lib/roles";

function BillingBody() {
  const { user } = useSession();
  const params = useSearchParams();
  const sub = useBillingSubscription();
  const portal = useBillingPortal();
  const complete = useCompleteCheckout();
  const done = useRef(false);
  const canPay = canonicalRole(user) === "firm_admin";
  const sessionId = params.get("session_id");
  const data = sub.data;

  useEffect(() => {
    if (!sessionId || done.current) {
      return;
    }
    done.current = true;
    void complete.mutateAsync(sessionId);
  }, [complete, sessionId]);

  async function openPortal() {
    const opened = await portal.mutateAsync();
    window.location.href = opened.url;
  }

  return (
    <WorkspaceGate allow="practice" firmId={user?.firmId}>
      <div className="space-y-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Billing</p>
          <h2 className="mt-1 text-2xl font-semibold text-ink">Billing</h2>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">
            Manage the Stripe customer, VAT invoices and the current monthly charge.
          </p>
        </div>
        <BillingSubNav />
        {params.get("checkout") === "success" ? (
          <p className="rounded-xl border border-success/30 bg-success-soft px-4 py-3 text-sm text-success">Checkout completed. VAT invoices appear in invoice history.</p>
        ) : null}
        {sub.isError ? <ErrorBanner title="Billing unavailable" message={sub.error.message} /> : null}
        {complete.isError ? <ErrorBanner title="Could not finalise checkout" message={complete.error.message} /> : null}
        {sub.isLoading || complete.isPending ? <LoadingSpinner label="Loading billing…" /> : null}
        {data ? (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <FirmStatsCard label="Status" value={data.billingStatus} hint={data.subscription?.plan.name ?? "No paid plan yet"} />
              <FirmStatsCard label="Active clients" value={data.activeClients} hint="Quantity for accountant plans" />
              <FirmStatsCard
                label="This month"
                value={data.subscription ? formatGbp(data.subscription.monthlyTotalPence) : "—"}
                hint={data.subscription ? `${formatGbp(data.subscription.monthlyVatPence)} VAT` : "Choose a plan"}
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/practice/pricing" className="rounded-xl bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-dark">
                Change plan
              </Link>
              {canPay ? (
                <button
                  type="button"
                  onClick={() => void openPortal()}
                  className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:border-teal/40"
                >
                  Open customer portal
                </button>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </WorkspaceGate>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={<LoadingSpinner label="Loading billing…" />}>
      <BillingBody />
    </Suspense>
  );
}
