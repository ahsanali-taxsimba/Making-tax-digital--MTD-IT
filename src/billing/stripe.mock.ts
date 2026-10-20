import { Injectable } from "@nestjs/common";
import {
  StripeCheckoutInput,
  StripeCheckoutSession,
  StripeGateway,
  StripeInvoiceView,
  StripePortalSession,
  StripePriceRef,
  StripeSubscriptionView,
  StripeWebhookEvent,
} from "./stripe.types";

const sessions = new Map<string, { input: StripeCheckoutInput; customerId: string; subscriptionId: string }>();

@Injectable()
export class MockStripeGateway implements StripeGateway {
  readonly name = "mock";

  async ensurePrice(plan: { id: string; slug: string; stripeProductId?: string | null; stripePriceId?: string | null }): Promise<StripePriceRef> {
    return {
      productId: plan.stripeProductId ?? `prod_mock_${plan.slug}`,
      priceId: plan.stripePriceId ?? `price_mock_${plan.slug}`,
    };
  }

  async ensureVatTaxRate(percent: number): Promise<string> {
    return `txr_mock_vat${percent}`;
  }

  async createCheckoutSession(input: StripeCheckoutInput): Promise<StripeCheckoutSession> {
    const id = `cs_mock.${input.planSlug}.${input.firmId}`;
    const customerId = input.customerId ?? `cus_mock_${input.firmId}`;
    const subscriptionId = `sub_mock_${input.firmId}`;
    sessions.set(id, { input, customerId, subscriptionId });
    const url = new URL(input.successUrl);
    url.searchParams.set("session_id", id);
    url.searchParams.set("checkout", "success");
    return { id, url: url.toString(), customerId };
  }

  async retrieveCheckoutSession(id: string) {
    const stored = sessions.get(id);
    if (!stored) {
      const [, planSlug, firmId] = id.split(".");
      return { id, firmId, planSlug, customerId: `cus_mock_${firmId}`, subscriptionId: `sub_mock_${firmId}` };
    }
    return {
      id,
      firmId: stored.input.firmId,
      planId: stored.input.planId,
      planSlug: stored.input.planSlug,
      customerId: stored.customerId,
      subscriptionId: stored.subscriptionId,
    };
  }

  async createPortalSession(customerId: string, returnUrl: string): Promise<StripePortalSession> {
    const url = new URL(returnUrl);
    url.searchParams.set("portal", "mock");
    url.searchParams.set("customer", customerId);
    return { url: url.toString() };
  }

  async updateSubscriptionQuantity(subscriptionId: string, quantity: number): Promise<StripeSubscriptionView> {
    return {
      id: subscriptionId,
      status: "active",
      customerId: subscriptionId.replace("sub_mock_", "cus_mock_"),
      quantity,
      cancelAtPeriodEnd: false,
    };
  }

  async updateSubscriptionPrice(subscriptionId: string, priceId: string, quantity: number): Promise<StripeSubscriptionView> {
    return {
      ...(await this.updateSubscriptionQuantity(subscriptionId, quantity)),
      priceId,
    };
  }

  async retrieveSubscription(id: string): Promise<StripeSubscriptionView> {
    return {
      id,
      status: "active",
      customerId: id.replace("sub_mock_", "cus_mock_"),
      quantity: 1,
      cancelAtPeriodEnd: false,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
    };
  }

  constructWebhookEvent(payload: Buffer | string): StripeWebhookEvent {
    const body = typeof payload === "string" ? payload : payload.toString("utf8");
    const parsed = JSON.parse(body || "{}") as { id?: string; type?: string; data?: { object?: Record<string, unknown> } };
    return {
      id: parsed.id ?? `evt_mock_${Date.now()}`,
      type: parsed.type ?? "checkout.session.completed",
      data: (parsed.data?.object ?? parsed.data ?? parsed) as Record<string, unknown>,
    };
  }
}

export function mockInvoice(params: {
  id?: string;
  firmId: string;
  subscriptionId?: string;
  subtotalPence: number;
  taxPence: number;
  totalPence: number;
}): StripeInvoiceView {
  const now = new Date();
  return {
    id: params.id ?? `in_mock_${params.firmId}_${Date.now()}`,
    number: `MTD-${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`,
    status: "paid",
    currency: "gbp",
    subtotalPence: params.subtotalPence,
    taxPence: params.taxPence,
    totalPence: params.totalPence,
    hostedInvoiceUrl: `https://invoice.mock.local/${params.firmId}`,
    invoicePdfUrl: `https://invoice.mock.local/${params.firmId}.pdf`,
    periodStart: now,
    periodEnd: new Date(now.getTime() + 30 * 86400000),
    paidAt: now,
    customerId: `cus_mock_${params.firmId}`,
    subscriptionId: params.subscriptionId,
    metadata: { firmId: params.firmId },
  };
}
