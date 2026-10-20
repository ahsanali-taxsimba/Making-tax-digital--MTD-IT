import { apiFetch } from "./api";

export interface BillingPlan {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  audience: "BUSINESS" | "PRACTICE";
  billingModel: "FLAT" | "PER_UNIT";
  currency: string;
  unitAmountPence: number;
  interval: string;
  vatPercent: number;
  vatInclusive: boolean;
  minQuantity: number;
  maxQuantity: number | null;
  features: string[];
  highlight: boolean;
  enabled: boolean;
  sortOrder: number;
  priceLabel: string;
  exampleMonthlyTotalPence: number;
}

export interface BillingSubscriptionView {
  firmId: string;
  firmName: string;
  billingStatus: string;
  vatNumber?: string | null;
  activeClients: number;
  features: string[];
  subscription: {
    id: string;
    status: string;
    quantity: number;
    currentPeriodStart?: string | null;
    currentPeriodEnd?: string | null;
    cancelAtPeriodEnd: boolean;
    monthlyNetPence: number;
    monthlyVatPence: number;
    monthlyTotalPence: number;
    plan: BillingPlan;
  } | null;
}

export interface BillingInvoiceRow {
  id: string;
  number?: string | null;
  status: string;
  currency: string;
  subtotalPence: number;
  taxPence: number;
  totalPence: number;
  hostedInvoiceUrl?: string | null;
  invoicePdfUrl?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  paidAt?: string | null;
  createdAt: string;
}

export interface BillingMetrics {
  currency: string;
  mrrPence: number;
  arrPence: number;
  recognisedRevenuePence: number;
  vatCollectedPence: number;
  activeSubscribers: number;
  trialing: number;
  pastDue: number;
  byPlan: Array<{ slug: string; name: string; subscribers: number; mrrPence: number }>;
}

export interface BillingSubscriberRow {
  firmId: string;
  firmName: string;
  slug: string;
  plan: string;
  planName: string;
  status: string;
  billingStatus: string;
  quantity: number;
  mrrPence: number;
}

export function formatGbp(pence: number, currency = "GBP"): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(pence / 100);
}

const FEATURE_LABELS: Record<string, string> = {
  bookkeeping: "Bookkeeping",
  vat_returns: "VAT returns",
  mtd_it: "MTD IT",
  bank_feeds: "Bank feeds",
  invoicing: "Invoicing",
  basic_reports: "Basic reports",
  unlimited_transactions: "Unlimited transactions",
  ai_categorisation: "AI categorisation",
  advanced_reports: "Advanced reports",
  cashflow_dashboard: "Cashflow dashboard",
  multi_user: "Multi-user access",
  priority_support: "Priority support",
  practice_clients: "Practice clients",
};

export function featureLabel(feature: string): string {
  return FEATURE_LABELS[feature] ?? feature.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function listBillingPlans() {
  return apiFetch<BillingPlan[]>("/billing/plans");
}

export function getBillingSubscription() {
  return apiFetch<BillingSubscriptionView>("/billing/subscription");
}

export function listBillingInvoices() {
  return apiFetch<BillingInvoiceRow[]>("/billing/invoices");
}

export function startCheckout(planSlug: string, vatNumber?: string) {
  return apiFetch<{ url: string; sessionId: string; quantity: number }>("/billing/checkout", {
    method: "POST",
    body: JSON.stringify({
      planSlug,
      successUrl: `${window.location.origin}/practice/billing?checkout=success`,
      cancelUrl: `${window.location.origin}/practice/pricing?checkout=cancelled`,
      vatNumber,
    }),
  });
}

export function completeCheckout(sessionId: string) {
  return apiFetch<BillingSubscriptionView>("/billing/checkout/complete", {
    method: "POST",
    body: JSON.stringify({ sessionId }),
  });
}

export function openBillingPortal() {
  return apiFetch<{ url: string }>("/billing/portal", {
    method: "POST",
    body: JSON.stringify({ returnUrl: `${window.location.origin}/practice/billing` }),
  });
}

export function listAdminBillingPlans() {
  return apiFetch<BillingPlan[]>("/admin/billing/plans");
}

export function getBillingMetrics() {
  return apiFetch<BillingMetrics>("/admin/billing/metrics");
}

export function listBillingSubscribers() {
  return apiFetch<BillingSubscriberRow[]>("/admin/billing/subscribers");
}

export function updateBillingPlan(id: string, body: Partial<BillingPlan> & { enabled?: boolean; unitAmountPence?: number }) {
  return apiFetch<BillingPlan>(`/admin/billing/plans/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function createBillingPlan(body: {
  slug: string;
  name: string;
  audience: "BUSINESS" | "PRACTICE";
  billingModel: "FLAT" | "PER_UNIT";
  unitAmountPence: number;
  description?: string;
  features?: string[];
}) {
  return apiFetch<BillingPlan>("/admin/billing/plans", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
