export interface StripePriceRef {
  productId: string;
  priceId: string;
}

export interface StripeCheckoutInput {
  firmId: string;
  planId: string;
  planSlug: string;
  planName: string;
  customerId?: string | null;
  customerEmail: string;
  priceId: string;
  quantity: number;
  successUrl: string;
  cancelUrl: string;
  vatTaxRateId?: string;
}

export interface StripeCheckoutSession {
  id: string;
  url: string;
  customerId?: string;
}

export interface StripePortalSession {
  url: string;
}

export interface StripeSubscriptionView {
  id: string;
  status: string;
  customerId: string;
  priceId?: string;
  quantity: number;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd: boolean;
  itemId?: string;
}

export interface StripeInvoiceView {
  id: string;
  number?: string;
  status: string;
  currency: string;
  subtotalPence: number;
  taxPence: number;
  totalPence: number;
  hostedInvoiceUrl?: string;
  invoicePdfUrl?: string;
  periodStart?: Date;
  periodEnd?: Date;
  paidAt?: Date | null;
  customerId?: string;
  subscriptionId?: string;
  metadata: Record<string, string>;
}

export interface StripeWebhookEvent {
  id: string;
  type: string;
  data: Record<string, unknown>;
}

export interface StripeGateway {
  readonly name: string;
  ensurePrice(plan: {
    id: string;
    slug: string;
    name: string;
    description?: string | null;
    unitAmountPence: number;
    currency: string;
    interval: string;
    stripeProductId?: string | null;
    stripePriceId?: string | null;
  }): Promise<StripePriceRef>;
  ensureVatTaxRate(percent: number): Promise<string | undefined>;
  createCheckoutSession(input: StripeCheckoutInput): Promise<StripeCheckoutSession>;
  retrieveCheckoutSession(id: string): Promise<{
    id: string;
    firmId?: string;
    planId?: string;
    planSlug?: string;
    customerId?: string;
    subscriptionId?: string;
    vatNumber?: string;
  }>;
  createPortalSession(customerId: string, returnUrl: string): Promise<StripePortalSession>;
  updateSubscriptionQuantity(subscriptionId: string, quantity: number, itemId?: string): Promise<StripeSubscriptionView>;
  updateSubscriptionPrice(subscriptionId: string, priceId: string, quantity: number): Promise<StripeSubscriptionView>;
  retrieveSubscription(id: string): Promise<StripeSubscriptionView>;
  constructWebhookEvent(payload: Buffer | string, signature?: string): StripeWebhookEvent;
}
