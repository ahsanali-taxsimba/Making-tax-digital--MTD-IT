import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Stripe from "stripe";
import {
  StripeCheckoutInput,
  StripeCheckoutSession,
  StripeGateway,
  StripePortalSession,
  StripePriceRef,
  StripeSubscriptionView,
  StripeWebhookEvent,
} from "./stripe.types";

@Injectable()
export class LiveStripeGateway implements StripeGateway {
  readonly name = "live";
  private readonly logger = new Logger(LiveStripeGateway.name);
  private client?: Stripe;

  constructor(private readonly config: ConfigService) {}

  private stripe(): Stripe {
    if (!this.client) {
      const key = this.config.get<string>("stripe.secretKey") ?? "";
      this.client = new Stripe(key);
    }
    return this.client;
  }

  async ensurePrice(plan: {
    id: string;
    slug: string;
    name: string;
    description?: string | null;
    unitAmountPence: number;
    currency: string;
    interval: string;
    stripeProductId?: string | null;
    stripePriceId?: string | null;
  }): Promise<StripePriceRef> {
    const stripe = this.stripe();
    let productId = plan.stripeProductId ?? undefined;
    if (!productId) {
      const product = await stripe.products.create({
        name: plan.name,
        description: plan.description ?? undefined,
        metadata: { planId: plan.id, slug: plan.slug },
      });
      productId = product.id;
    }
    if (plan.stripePriceId) {
      const existing = await stripe.prices.retrieve(plan.stripePriceId);
      if (existing.unit_amount === plan.unitAmountPence && existing.active) {
        return { productId, priceId: existing.id };
      }
    }
    const price = await stripe.prices.create({
      product: productId,
      currency: plan.currency.toLowerCase(),
      unit_amount: plan.unitAmountPence,
      tax_behavior: "exclusive",
      recurring: { interval: plan.interval === "year" ? "year" : "month" },
      metadata: { planId: plan.id, slug: plan.slug },
    });
    this.logger.log(`Created Stripe price ${price.id} for ${plan.slug}`);
    return { productId, priceId: price.id };
  }

  async ensureVatTaxRate(percent: number): Promise<string | undefined> {
    const configured = this.config.get<string>("stripe.vatTaxRateId");
    if (configured) {
      return configured;
    }
    const stripe = this.stripe();
    const existing = await stripe.taxRates.list({ active: true, limit: 20 });
    const match = existing.data.find((rate) => rate.percentage === percent && rate.inclusive === false && rate.country === "GB");
    if (match) {
      return match.id;
    }
    const created = await stripe.taxRates.create({
      display_name: "VAT",
      description: "UK VAT",
      percentage: percent,
      inclusive: false,
      country: "GB",
      jurisdiction: "GB",
    });
    return created.id;
  }

  async createCheckoutSession(input: StripeCheckoutInput): Promise<StripeCheckoutSession> {
    const session = await this.stripe().checkout.sessions.create({
      mode: "subscription",
      customer: input.customerId || undefined,
      customer_email: input.customerId ? undefined : input.customerEmail,
      client_reference_id: input.firmId,
      success_url: input.successUrl.includes("{CHECKOUT_SESSION_ID}")
        ? input.successUrl
        : `${input.successUrl}${input.successUrl.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: input.cancelUrl,
      locale: "en-GB",
      billing_address_collection: "required",
      tax_id_collection: { enabled: true },
      allow_promotion_codes: true,
      line_items: [
        {
          price: input.priceId,
          quantity: input.quantity,
          tax_rates: input.vatTaxRateId ? [input.vatTaxRateId] : undefined,
        },
      ],
      metadata: { firmId: input.firmId, planId: input.planId, planSlug: input.planSlug },
      subscription_data: {
        metadata: { firmId: input.firmId, planId: input.planId, planSlug: input.planSlug },
      },
    });
    return { id: session.id, url: session.url ?? input.cancelUrl, customerId: customerIdOf(session.customer) };
  }

  async retrieveCheckoutSession(id: string) {
    const session = await this.stripe().checkout.sessions.retrieve(id);
    return {
      id: session.id,
      firmId: session.metadata?.firmId ?? session.client_reference_id ?? undefined,
      planId: session.metadata?.planId,
      planSlug: session.metadata?.planSlug,
      customerId: customerIdOf(session.customer),
      subscriptionId: typeof session.subscription === "string" ? session.subscription : session.subscription?.id,
      vatNumber: session.customer_details?.tax_ids?.[0]?.value ?? undefined,
    };
  }

  async createPortalSession(customerId: string, returnUrl: string): Promise<StripePortalSession> {
    const session = await this.stripe().billingPortal.sessions.create({ customer: customerId, return_url: returnUrl });
    return { url: session.url };
  }

  async updateSubscriptionQuantity(subscriptionId: string, quantity: number, itemId?: string): Promise<StripeSubscriptionView> {
    const stripe = this.stripe();
    const current = await stripe.subscriptions.retrieve(subscriptionId);
    const item = itemId ?? current.items.data[0]?.id;
    const updated = item
      ? await stripe.subscriptions.update(subscriptionId, {
          items: [{ id: item, quantity }],
          proration_behavior: "create_prorations",
        })
      : current;
    return presentSubscription(updated);
  }

  async updateSubscriptionPrice(subscriptionId: string, priceId: string, quantity: number): Promise<StripeSubscriptionView> {
    const stripe = this.stripe();
    const current = await stripe.subscriptions.retrieve(subscriptionId);
    const item = current.items.data[0];
    const updated = await stripe.subscriptions.update(subscriptionId, {
      items: item ? [{ id: item.id, price: priceId, quantity }] : [{ price: priceId, quantity }],
      proration_behavior: "create_prorations",
    });
    return presentSubscription(updated);
  }

  async retrieveSubscription(id: string): Promise<StripeSubscriptionView> {
    return presentSubscription(await this.stripe().subscriptions.retrieve(id));
  }

  constructWebhookEvent(payload: Buffer | string, signature?: string): StripeWebhookEvent {
    const secret = this.config.get<string>("stripe.webhookSecret") ?? "";
    const body = typeof payload === "string" ? payload : payload;
    const event = secret && signature
      ? this.stripe().webhooks.constructEvent(body, signature, secret)
      : (JSON.parse(typeof payload === "string" ? payload : payload.toString("utf8")) as Stripe.Event);
    const object = event.data.object as unknown as Record<string, unknown>;
    return { id: event.id, type: event.type, data: object };
  }
}

function customerIdOf(value: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined): string | undefined {
  if (!value) return undefined;
  return typeof value === "string" ? value : value.id;
}

function presentSubscription(sub: Stripe.Subscription): StripeSubscriptionView {
  const item = sub.items.data[0];
  const start = periodUnix(sub, "start");
  const end = periodUnix(sub, "end");
  return {
    id: sub.id,
    status: sub.status,
    customerId: customerIdOf(sub.customer) ?? "",
    priceId: typeof item?.price === "string" ? item.price : item?.price?.id,
    quantity: item?.quantity ?? 1,
    currentPeriodStart: start ? new Date(start * 1000) : undefined,
    currentPeriodEnd: end ? new Date(end * 1000) : undefined,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    itemId: item?.id,
  };
}

function periodUnix(sub: Stripe.Subscription, which: "start" | "end"): number | undefined {
  const top = sub as unknown as { current_period_start?: number; current_period_end?: number };
  const item = sub.items?.data?.[0] as unknown as { current_period_start?: number; current_period_end?: number } | undefined;
  const value = which === "start" ? (top.current_period_start ?? item?.current_period_start) : (top.current_period_end ?? item?.current_period_end);
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
