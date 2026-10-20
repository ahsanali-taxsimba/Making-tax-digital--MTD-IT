"use client";

import { useState } from "react";
import { BillingSubNav } from "@/components/BillingSubNav";
import { ErrorBanner } from "@/components/ErrorBanner";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { WorkspaceGate } from "@/components/WorkspaceGate";
import { useBillingPlans, useBillingSubscription, useCheckout } from "@/hooks/useBilling";
import { useSession } from "@/hooks/useSession";
import { featureLabel, formatGbp, type BillingPlan } from "@/lib/billing";
import { canonicalRole } from "@/lib/roles";

export default function PricingPage() {
  const { user } = useSession();
  const plans = useBillingPlans();
  const sub = useBillingSubscription();
  const checkout = useCheckout();
  const [vatNumber, setVatNumber] = useState("");
  const canPay = canonicalRole(user) === "firm_admin";
  const rows = plans.data ?? [];
  const currentSlug = sub.data?.subscription?.plan.slug;

  async function subscribe(plan: BillingPlan) {
    const started = await checkout.mutateAsync({ planSlug: plan.slug, vatNumber: vatNumber || undefined });
    window.location.href = started.url;
  }

  return (
    <WorkspaceGate allow="practice" firmId={user?.firmId}>
      <div className="space-y-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Billing</p>
          <h2 className="mt-1 text-2xl font-semibold text-ink">Plans</h2>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">
            Monthly GBP billing with UK VAT on every invoice. Accountant plans are charged per active client.
          </p>
        </div>
        <BillingSubNav />
        {canPay ? (
          <label className="block max-w-sm text-sm">
            <span className="font-medium text-ink">VAT number (optional)</span>
            <input
              value={vatNumber}
              onChange={(event) => setVatNumber(event.target.value)}
              className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2"
              placeholder="GB123456789"
            />
          </label>
        ) : null}
        {plans.isError ? <ErrorBanner title="Plans unavailable" message={plans.error.message} /> : null}
        {checkout.isError ? <ErrorBanner title="Checkout failed" message={checkout.error.message} /> : null}
        {plans.isLoading ? <LoadingSpinner label="Loading plans…" /> : null}
        <PlanGroup title="Business" plans={rows.filter((plan) => plan.audience === "BUSINESS")} currentSlug={currentSlug} canPay={canPay} onSubscribe={subscribe} busy={checkout.isPending} />
        <PlanGroup title="Accountant" plans={rows.filter((plan) => plan.audience === "PRACTICE")} currentSlug={currentSlug} canPay={canPay} onSubscribe={subscribe} busy={checkout.isPending} />
      </div>
    </WorkspaceGate>
  );
}

function PlanGroup({
  title,
  plans,
  currentSlug,
  canPay,
  onSubscribe,
  busy,
}: {
  title: string;
  plans: BillingPlan[];
  currentSlug?: string;
  canPay: boolean;
  onSubscribe: (plan: BillingPlan) => void;
  busy: boolean;
}) {
  if (!plans.length) {
    return null;
  }
  return (
    <section className="space-y-4">
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      <div className="grid gap-4 md:grid-cols-2">
        {plans.map((plan) => (
          <article key={plan.id} className={`rounded-2xl border bg-white p-5 shadow-sm ${plan.highlight ? "border-teal" : "border-line"}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">{plan.name}</p>
            <p className="mt-2 text-2xl font-semibold text-ink">{plan.priceLabel}</p>
            <p className="mt-1 text-sm text-ink-muted">
              {formatGbp(plan.exampleMonthlyTotalPence)} incl. {plan.vatPercent}% VAT
              {plan.billingModel === "PER_UNIT" ? " at the minimum client count" : ""}
            </p>
            <p className="mt-3 text-sm text-ink-muted">{plan.description}</p>
            <ul className="mt-4 space-y-1 text-sm text-ink">
              {plan.features.map((feature) => (
                <li key={feature}>• {featureLabel(feature)}</li>
              ))}
            </ul>
            {currentSlug === plan.slug ? (
              <p className="mt-4 text-sm font-semibold text-success">Current plan</p>
            ) : canPay ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => onSubscribe(plan)}
                className="mt-4 rounded-xl bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-dark disabled:opacity-60"
              >
                Subscribe
              </button>
            ) : (
              <p className="mt-4 text-sm text-ink-muted">Ask a firm admin to change plan.</p>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
