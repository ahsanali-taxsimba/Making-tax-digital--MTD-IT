"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ErrorBanner } from "@/components/ErrorBanner";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { WorkspaceGate } from "@/components/WorkspaceGate";
import { useSession } from "@/hooks/useSession";
import { useAdminBillingPlans, useCreateBillingPlan, useUpdateBillingPlan } from "@/hooks/useBilling";
import { formatGbp, type BillingPlan } from "@/lib/billing";
import { canonicalRole } from "@/lib/roles";

export default function AdminBillingPlansPage() {
  const { user } = useSession();
  const canManage = canonicalRole(user) === "admin_super";
  const plans = useAdminBillingPlans();
  const update = useUpdateBillingPlan();
  const create = useCreateBillingPlan();
  const rows = plans.data ?? [];
  const [draft, setDraft] = useState({
    slug: "",
    name: "",
    audience: "BUSINESS" as "BUSINESS" | "PRACTICE",
    billingModel: "FLAT" as "FLAT" | "PER_UNIT",
    unitAmountPence: 0,
    description: "",
  });

  async function toggle(plan: BillingPlan) {
    await update.mutateAsync({ id: plan.id, body: { enabled: !plan.enabled } });
  }

  async function savePrice(plan: BillingPlan, pounds: string) {
    const unitAmountPence = Math.round(Number(pounds) * 100);
    if (!Number.isFinite(unitAmountPence) || unitAmountPence < 0) {
      return;
    }
    await update.mutateAsync({ id: plan.id, body: { unitAmountPence } });
  }

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    await create.mutateAsync(draft);
    setDraft({ slug: "", name: "", audience: "BUSINESS", billingModel: "FLAT", unitAmountPence: 0, description: "" });
  }

  return (
    <WorkspaceGate allow="platform">
      <div className="space-y-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">Platform billing</p>
          <h2 className="mt-1 text-2xl font-semibold text-ink">Plans</h2>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">
            Edit prices and availability here. New rows are stored in the catalog and synced to Stripe — no deploy required.
          </p>
          <Link href="/admin/billing" className="mt-3 inline-block text-sm font-semibold text-teal hover:underline">
            Back to revenue
          </Link>
        </div>
        {plans.isError ? <ErrorBanner title="Catalog unavailable" message={plans.error.message} /> : null}
        {update.isError ? <ErrorBanner title="Update failed" message={update.error.message} /> : null}
        {create.isError ? <ErrorBanner title="Create failed" message={create.error.message} /> : null}
        {plans.isLoading ? <LoadingSpinner label="Loading plans…" /> : null}
        <section className="overflow-hidden rounded-2xl border border-line bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-paper text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Plan</th>
                <th className="px-4 py-3 font-semibold">Audience</th>
                <th className="px-4 py-3 font-semibold">Price (ex VAT)</th>
                <th className="px-4 py-3 font-semibold">Enabled</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((plan) => (
                <tr key={plan.id} className="border-t border-line">
                  <td className="px-4 py-4">
                    <p className="font-medium">{plan.name}</p>
                    <p className="text-xs text-ink-muted">{plan.slug}</p>
                  </td>
                  <td className="px-4 py-4 capitalize">{plan.audience.toLowerCase()}</td>
                  <td className="px-4 py-4">
                    <input
                      defaultValue={(plan.unitAmountPence / 100).toFixed(2)}
                      disabled={!canManage}
                      className="w-24 rounded-lg border border-line px-2 py-1 disabled:bg-paper"
                      onBlur={(event) => void savePrice(plan, event.target.value)}
                    />
                    <p className="mt-1 text-xs text-ink-muted">{formatGbp(plan.unitAmountPence)} {plan.billingModel === "PER_UNIT" ? "/ client" : "/ month"}</p>
                  </td>
                  <td className="px-4 py-4">
                    <button type="button" disabled={!canManage} className="rounded-full border border-line px-3 py-1 text-xs font-semibold disabled:opacity-50" onClick={() => void toggle(plan)}>
                      {plan.enabled ? "Enabled" : "Disabled"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        {canManage ? (
        <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-ink">Add a plan</h3>
          <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={(event) => void onCreate(event)}>
            <input required placeholder="slug" value={draft.slug} onChange={(event) => setDraft({ ...draft, slug: event.target.value })} className="rounded-xl border border-line px-3 py-2" />
            <input required placeholder="Name" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="rounded-xl border border-line px-3 py-2" />
            <select value={draft.audience} onChange={(event) => setDraft({ ...draft, audience: event.target.value as "BUSINESS" | "PRACTICE" })} className="rounded-xl border border-line px-3 py-2">
              <option value="BUSINESS">Business</option>
              <option value="PRACTICE">Accountant</option>
            </select>
            <select value={draft.billingModel} onChange={(event) => setDraft({ ...draft, billingModel: event.target.value as "FLAT" | "PER_UNIT" })} className="rounded-xl border border-line px-3 py-2">
              <option value="FLAT">Flat monthly</option>
              <option value="PER_UNIT">Per active client</option>
            </select>
            <input
              required
              type="number"
              min={0}
              step="0.01"
              placeholder="Price pounds"
              value={draft.unitAmountPence ? (draft.unitAmountPence / 100).toString() : ""}
              onChange={(event) => setDraft({ ...draft, unitAmountPence: Math.round(Number(event.target.value) * 100) })}
              className="rounded-xl border border-line px-3 py-2"
            />
            <input placeholder="Description" value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} className="rounded-xl border border-line px-3 py-2" />
            <button type="submit" className="rounded-xl bg-teal px-4 py-2 text-sm font-semibold text-white md:col-span-2">
              Create plan
            </button>
          </form>
        </section>
        ) : (
          <p className="text-sm text-ink-muted">Price and availability changes are limited to super admins.</p>
        )}
      </div>
    </WorkspaceGate>
  );
}
