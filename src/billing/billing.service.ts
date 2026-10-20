import { BadRequestException, Inject, Injectable, Logger, NotFoundException, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BillingModel, BillingStatus, Prisma, UserRole } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { AuthUser } from "../common/types";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { DEFAULT_BILLING_PLANS, featureList, mapStripeStatus, vatPence } from "./billing.catalog";
import { STRIPE_GATEWAY } from "./billing.tokens";
import { CheckoutDto } from "./dto/billing.dto";
import { mockInvoice } from "./stripe.mock";
import { StripeGateway } from "./stripe.types";

const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

@Injectable()
export class BillingService implements OnModuleInit {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(STRIPE_GATEWAY) private readonly stripe: StripeGateway,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.config.get<string>("nodeEnv") === "test") {
      return;
    }
    try {
      await this.ensureCatalog();
    } catch (error) {
      this.logger.warn(`Billing catalog bootstrap failed: ${error instanceof Error ? error.message : "unknown"}`);
    }
  }

  async ensureCatalog(): Promise<void> {
    for (const seed of DEFAULT_BILLING_PLANS) {
      await this.prisma.billingPlan.upsert({
        where: { slug: seed.slug },
        update: {},
        create: {
          slug: seed.slug,
          name: seed.name,
          description: seed.description,
          audience: seed.audience,
          billingModel: seed.billingModel,
          unitAmountPence: seed.unitAmountPence,
          vatPercent: seed.vatPercent,
          minQuantity: seed.minQuantity,
          maxQuantity: seed.maxQuantity,
          features: seed.features,
          highlight: seed.highlight,
          sortOrder: seed.sortOrder,
          enabled: true,
        },
      });
    }
    if (this.config.get<string>("stripe.mode") === "live") {
      const plans = await this.prisma.billingPlan.findMany({ where: { enabled: true } });
      for (const plan of plans) {
        await this.syncPlanToStripe(plan.id);
      }
    }
  }

  async listPlans(enabledOnly = true) {
    const plans = await this.prisma.billingPlan.findMany({
      where: enabledOnly ? { enabled: true } : {},
      orderBy: [{ audience: "asc" }, { sortOrder: "asc" }],
    });
    return plans.map((plan) => this.presentPlan(plan));
  }

  async subscription(user: AuthUser) {
    const firm = await this.requireFirm(user.firmId);
    const sub = await this.prisma.firmSubscription.findUnique({
      where: { firmId: firm.id },
      include: { plan: true },
    });
    const activeClients = await this.activeClientCount(firm.id);
    const features = await this.featuresForFirm(firm.id);
    return {
      firmId: firm.id,
      firmName: firm.name,
      billingStatus: firm.billingStatus,
      vatNumber: firm.billingVatNumber,
      stripeCustomerId: firm.stripeCustomerId,
      activeClients,
      features,
      subscription: sub ? this.presentSubscription(sub, sub.plan) : null,
    };
  }

  async checkout(user: AuthUser, dto: CheckoutDto) {
    const firm = await this.requireFirm(user.firmId);
    const plan = await this.requirePlan(dto.planSlug, true);
    const quantity = await this.quantityFor(firm.id, plan);
    this.assertQuantity(plan, quantity);
    const origin = this.config.get<string>("frontendOrigin") ?? "http://localhost:2327";
    const successUrl = dto.successUrl ?? `${origin}/practice/billing?checkout=success`;
    const cancelUrl = dto.cancelUrl ?? `${origin}/practice/pricing?checkout=cancelled`;
    const existing = await this.prisma.firmSubscription.findUnique({ where: { firmId: firm.id } });
    if (existing?.stripeSubscriptionId && ACTIVE_STATUSES.has(existing.status)) {
      const syncedExisting = await this.syncPlanToStripe(plan.id);
      if (syncedExisting.stripePriceId) {
        await this.stripe.updateSubscriptionPrice(existing.stripeSubscriptionId, syncedExisting.stripePriceId, quantity);
      }
      await this.activateSubscription({
        firmId: firm.id,
        plan,
        status: existing.status,
        stripeCustomerId: existing.stripeCustomerId ?? firm.stripeCustomerId,
        stripeSubscriptionId: existing.stripeSubscriptionId,
        stripePriceId: syncedExisting.stripePriceId,
        quantity,
        vatNumber: dto.vatNumber ?? existing.vatNumber,
      });
      await this.audit.record({
        actor: user,
        actionType: "billing.plan.changed",
        metadata: { planSlug: plan.slug, quantity },
      });
      return { url: `${origin}/practice/billing?checkout=success`, sessionId: existing.stripeSubscriptionId, quantity };
    }
    const synced = await this.syncPlanToStripe(plan.id);
    if (!synced.stripePriceId) {
      throw new BadRequestException("Plan is not linked to a Stripe price");
    }
    const vatTaxRateId = await this.stripe.ensureVatTaxRate(plan.vatPercent);
    const session = await this.stripe.createCheckoutSession({
      firmId: firm.id,
      planId: plan.id,
      planSlug: plan.slug,
      planName: plan.name,
      customerId: firm.stripeCustomerId,
      customerEmail: firm.contactEmail,
      priceId: synced.stripePriceId,
      quantity,
      successUrl,
      cancelUrl,
      vatTaxRateId,
    });
    if (dto.vatNumber) {
      await this.prisma.firm.update({ where: { id: firm.id }, data: { billingVatNumber: dto.vatNumber } });
    }
    await this.audit.record({
      actor: user,
      actionType: "billing.checkout.started",
      metadata: { planSlug: plan.slug, sessionId: session.id, quantity },
    });
    return { url: session.url, sessionId: session.id, quantity };
  }

  async completeCheckout(user: AuthUser, sessionId: string) {
    const session = await this.stripe.retrieveCheckoutSession(sessionId);
    const firmId = session.firmId ?? user.firmId;
    if (firmId !== user.firmId) {
      throw new BadRequestException("Checkout session does not belong to this firm");
    }
    const plan = session.planId
      ? await this.prisma.billingPlan.findUnique({ where: { id: session.planId } })
      : session.planSlug
        ? await this.prisma.billingPlan.findUnique({ where: { slug: session.planSlug } })
        : null;
    if (!plan) {
      throw new NotFoundException("Plan not found");
    }
    const quantity = await this.quantityFor(firmId, plan);
    const applied = await this.activateSubscription({
      firmId,
      plan,
      status: "active",
      stripeCustomerId: session.customerId,
      stripeSubscriptionId: session.subscriptionId,
      stripePriceId: plan.stripePriceId,
      quantity,
      vatNumber: session.vatNumber,
    });
    await this.recordInvoiceForActivation(applied.id, firmId, plan, quantity, sessionId);
    await this.audit.record({ actor: user, actionType: "billing.checkout.completed", metadata: { planSlug: plan.slug, sessionId } });
    return this.subscription(user);
  }

  async portal(user: AuthUser, returnUrl?: string) {
    const firm = await this.requireFirm(user.firmId);
    if (!firm.stripeCustomerId) {
      throw new BadRequestException("No Stripe customer is linked to this firm yet");
    }
    const origin = this.config.get<string>("frontendOrigin") ?? "http://localhost:2327";
    const session = await this.stripe.createPortalSession(firm.stripeCustomerId, returnUrl ?? `${origin}/practice/billing`);
    return { url: session.url };
  }

  async invoices(user: AuthUser) {
    await this.requireFirm(user.firmId);
    const rows = await this.prisma.billingInvoice.findMany({
      where: { firmId: user.firmId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return rows.map((row) => this.presentInvoice(row));
  }

  async handleWebhook(payload: Buffer | string, signature?: string) {
    const event = this.stripe.constructWebhookEvent(payload, signature);
    const existing = event.id
      ? await this.prisma.billingEvent.findUnique({ where: { stripeEventId: event.id } })
      : null;
    if (existing?.processedAt) {
      return { received: true, duplicate: true };
    }
    const stored = await this.prisma.billingEvent.upsert({
      where: { stripeEventId: event.id },
      update: { type: event.type, payload: event.data as Prisma.InputJsonValue },
      create: { type: event.type, stripeEventId: event.id, payload: event.data as Prisma.InputJsonValue },
    });
    try {
      await this.dispatchWebhook(event.type, event.data);
      await this.prisma.billingEvent.update({ where: { id: stored.id }, data: { processedAt: new Date() } });
    } catch (error) {
      this.logger.warn(`Billing webhook ${event.type} failed: ${error instanceof Error ? error.message : "unknown"}`);
      throw error;
    }
    return { received: true, type: event.type };
  }

  async featuresForFirm(firmId: string): Promise<string[]> {
    const sub = await this.prisma.firmSubscription.findUnique({ where: { firmId }, include: { plan: true } });
    if (!sub || !ACTIVE_STATUSES.has(sub.status) || !sub.plan.enabled) {
      const firm = await this.prisma.firm.findUnique({ where: { id: firmId } });
      if (firm?.billingStatus === BillingStatus.TRIAL) {
        return DEFAULT_BILLING_PLANS.find((plan) => plan.slug === "ledger-pro")?.features ?? [];
      }
      return DEFAULT_BILLING_PLANS.find((plan) => plan.slug === "ledger-lite")?.features ?? [];
    }
    return featureList(sub.plan.features);
  }

  async hasFeature(firmId: string, feature: string): Promise<boolean> {
    const features = await this.featuresForFirm(firmId);
    return features.includes(feature);
  }

  async assertFeature(firmId: string, feature: string): Promise<void> {
    if (!(await this.hasFeature(firmId, feature))) {
      throw new BadRequestException({
        message: `Your current plan does not include ${feature.replace(/_/g, " ")}`,
        errorCode: "BILLING_FEATURE_REQUIRED",
        feature,
      });
    }
  }

  async assertStaffSeat(firmId: string): Promise<void> {
    if (await this.hasFeature(firmId, "multi_user")) {
      return;
    }
    const staff = await this.prisma.user.count({
      where: { firmId, role: { in: [UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.ASSISTANT] } },
    });
    if (staff >= 1) {
      throw new BadRequestException({
        message: "Ledger Lite includes a single staff login. Upgrade to Ledger Pro for multi-user access.",
        errorCode: "BILLING_SEAT_LIMIT",
      });
    }
  }

  async syncUsage(firmId?: string): Promise<number> {
    const where = firmId ? { firmId, plan: { billingModel: BillingModel.PER_UNIT } } : { plan: { billingModel: BillingModel.PER_UNIT } };
    const subs = await this.prisma.firmSubscription.findMany({
      where: { ...where, status: { in: [...ACTIVE_STATUSES] } },
      include: { plan: true, firm: true },
    });
    let updated = 0;
    for (const sub of subs) {
      const quantity = await this.quantityFor(sub.firmId, sub.plan);
      const nextPlan = await this.planForQuantity(sub.plan, quantity);
      if (nextPlan && nextPlan.id !== sub.planId) {
        const synced = await this.syncPlanToStripe(nextPlan.id);
        if (sub.stripeSubscriptionId && synced.stripePriceId) {
          await this.stripe.updateSubscriptionPrice(sub.stripeSubscriptionId, synced.stripePriceId, quantity);
        }
        await this.activateSubscription({
          firmId: sub.firmId,
          plan: nextPlan,
          status: sub.status,
          stripeCustomerId: sub.stripeCustomerId,
          stripeSubscriptionId: sub.stripeSubscriptionId,
          stripePriceId: synced.stripePriceId,
          quantity,
          vatNumber: sub.vatNumber,
        });
        await this.notifications.notify({
          firmId: sub.firmId,
          type: "BILLING_PAYMENT_SUCCEEDED",
          title: `Moved to ${nextPlan.name}`,
          body: `Active clients are now ${quantity}, so billing moved to ${nextPlan.name} (£${(nextPlan.unitAmountPence / 100).toFixed(2)} per client).`,
          metadata: { planSlug: nextPlan.slug, quantity },
        });
      } else if (sub.stripeSubscriptionId && quantity !== sub.quantity) {
        await this.stripe.updateSubscriptionQuantity(sub.stripeSubscriptionId, quantity);
        await this.prisma.firmSubscription.update({ where: { id: sub.id }, data: { quantity } });
      } else if (quantity !== sub.quantity) {
        await this.prisma.firmSubscription.update({ where: { id: sub.id }, data: { quantity } });
      }
      await this.prisma.billingUsageSnapshot.create({
        data: { firmId: sub.firmId, subscriptionId: sub.id, quantity },
      });
      updated += 1;
    }
    return updated;
  }

  async syncPlanToStripe(planId: string) {
    const plan = await this.prisma.billingPlan.findUnique({ where: { id: planId } });
    if (!plan) {
      throw new NotFoundException("Plan not found");
    }
    const refs = await this.stripe.ensurePrice(plan);
    if (refs.productId !== plan.stripeProductId || refs.priceId !== plan.stripePriceId) {
      return this.prisma.billingPlan.update({
        where: { id: plan.id },
        data: { stripeProductId: refs.productId, stripePriceId: refs.priceId },
      });
    }
    return plan;
  }

  presentPlan(plan: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    audience: string;
    billingModel: string;
    currency: string;
    unitAmountPence: number;
    interval: string;
    vatPercent: number;
    vatInclusive: boolean;
    minQuantity: number;
    maxQuantity: number | null;
    features: unknown;
    highlight: boolean;
    enabled: boolean;
    sortOrder: number;
  }) {
    const exampleQty = plan.billingModel === "PER_UNIT" ? Math.max(plan.minQuantity, 1) : 1;
    const example = vatPence(plan.unitAmountPence * exampleQty, plan.vatPercent, plan.vatInclusive);
    return {
      id: plan.id,
      slug: plan.slug,
      name: plan.name,
      description: plan.description,
      audience: plan.audience,
      billingModel: plan.billingModel,
      currency: plan.currency,
      unitAmountPence: plan.unitAmountPence,
      interval: plan.interval,
      vatPercent: plan.vatPercent,
      vatInclusive: plan.vatInclusive,
      minQuantity: plan.minQuantity,
      maxQuantity: plan.maxQuantity,
      features: featureList(plan.features),
      highlight: plan.highlight,
      enabled: plan.enabled,
      sortOrder: plan.sortOrder,
      priceLabel: this.priceLabel(plan),
      exampleMonthlyTotalPence: example.totalPence,
    };
  }

  private async dispatchWebhook(type: string, data: Record<string, unknown>) {
    if (type === "checkout.session.completed") {
      const firmId = String(data.client_reference_id ?? meta(data, "firmId") ?? "");
      const planId = String(meta(data, "planId") ?? "");
      if (!firmId || !planId) return;
      const plan = await this.prisma.billingPlan.findUnique({ where: { id: planId } });
      if (!plan) return;
      const quantity = await this.quantityFor(firmId, plan);
      await this.activateSubscription({
        firmId,
        plan,
        status: "active",
        stripeCustomerId: idOf(data.customer),
        stripeSubscriptionId: idOf(data.subscription),
        stripePriceId: plan.stripePriceId,
        quantity,
      });
      return;
    }
    if (type === "customer.subscription.updated" || type === "customer.subscription.deleted") {
      const subId = String(data.id ?? "");
      const firmId = meta(data, "firmId") ?? (await this.firmIdForStripeSub(subId));
      if (!firmId) return;
      const status = String(data.status ?? (type.endsWith("deleted") ? "canceled" : "active"));
      await this.prisma.firmSubscription.updateMany({
        where: { firmId },
        data: {
          status,
          cancelAtPeriodEnd: Boolean(data.cancel_at_period_end),
          currentPeriodEnd: unixDate(data.current_period_end),
          currentPeriodStart: unixDate(data.current_period_start),
        },
      });
      await this.prisma.firm.update({
        where: { id: firmId },
        data: { billingStatus: mapStripeStatus(status) },
      });
      return;
    }
    if (type === "invoice.paid" || type === "invoice.finalized" || type === "invoice.payment_failed" || type === "invoice.voided") {
      await this.upsertStripeInvoice(data, type);
    }
  }

  private async upsertStripeInvoice(data: Record<string, unknown>, type: string) {
    const paid = type === "invoice.paid";
    const customerId = idOf(data.customer);
    const firm = customerId
      ? await this.prisma.firm.findFirst({ where: { stripeCustomerId: customerId } })
      : await this.prisma.firm.findFirst({ where: { id: meta(data, "firmId") ?? "" } });
    if (!firm) return;
    const subtotal = moneyToPence(data.subtotal);
    const tax = moneyToPence(data.tax ?? data.tax_amount);
    const total = moneyToPence(data.total);
    const stripeInvoiceId = String(data.id ?? "");
    await this.prisma.billingInvoice.upsert({
      where: { stripeInvoiceId },
      update: {
        status: String(data.status ?? (paid ? "paid" : "open")),
        subtotalPence: subtotal,
        taxPence: tax,
        totalPence: total,
        hostedInvoiceUrl: optionalString(data.hosted_invoice_url),
        invoicePdfUrl: optionalString(data.invoice_pdf),
        paidAt: paid ? new Date() : null,
        rawPayload: data as Prisma.InputJsonValue,
      },
      create: {
        firmId: firm.id,
        stripeInvoiceId,
        number: optionalString(data.number),
        status: String(data.status ?? (paid ? "paid" : "open")),
        currency: String(data.currency ?? "gbp").toUpperCase(),
        subtotalPence: subtotal,
        taxPence: tax,
        totalPence: total,
        hostedInvoiceUrl: optionalString(data.hosted_invoice_url),
        invoicePdfUrl: optionalString(data.invoice_pdf),
        paidAt: paid ? new Date() : null,
        rawPayload: data as Prisma.InputJsonValue,
      },
    });
    if (paid) {
      await this.notifications.notify({
        firmId: firm.id,
        type: "BILLING_PAYMENT_SUCCEEDED",
        title: "Subscription invoice paid",
        body: `VAT invoice ${optionalString(data.number) ?? stripeInvoiceId} was paid.`,
        metadata: { stripeInvoiceId },
      });
    }
    if (type === "invoice.payment_failed") {
      await this.notifications.notify({
        firmId: firm.id,
        type: "BILLING_PAYMENT_FAILED",
        title: "Subscription payment failed",
        body: "Update the card on the billing portal to keep Making Tax Digital connected.",
        metadata: { stripeInvoiceId },
      });
    }
  }

  private async activateSubscription(input: {
    firmId: string;
    plan: { id: string; slug: string; stripePriceId: string | null };
    status: string;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    stripePriceId?: string | null;
    quantity: number;
    vatNumber?: string | null;
  }) {
    const periodStart = new Date();
    const periodEnd = new Date(periodStart.getTime() + 30 * 86400000);
    const row = await this.prisma.firmSubscription.upsert({
      where: { firmId: input.firmId },
      update: {
        planId: input.plan.id,
        status: input.status,
        stripeCustomerId: input.stripeCustomerId ?? undefined,
        stripeSubscriptionId: input.stripeSubscriptionId ?? undefined,
        stripePriceId: input.stripePriceId ?? input.plan.stripePriceId ?? undefined,
        quantity: input.quantity,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        vatNumber: input.vatNumber ?? undefined,
      },
      create: {
        firmId: input.firmId,
        planId: input.plan.id,
        status: input.status,
        stripeCustomerId: input.stripeCustomerId,
        stripeSubscriptionId: input.stripeSubscriptionId,
        stripePriceId: input.stripePriceId ?? input.plan.stripePriceId,
        quantity: input.quantity,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        vatNumber: input.vatNumber,
      },
    });
    await this.prisma.firm.update({
      where: { id: input.firmId },
      data: {
        subscriptionPlan: input.plan.slug,
        billingStatus: mapStripeStatus(input.status),
        stripeCustomerId: input.stripeCustomerId ?? undefined,
        billingVatNumber: input.vatNumber ?? undefined,
      },
    });
    return row;
  }

  private async recordInvoiceForActivation(
    subscriptionId: string,
    firmId: string,
    plan: { unitAmountPence: number; vatPercent: number; vatInclusive: boolean; currency: string },
    quantity: number,
    externalId?: string,
  ) {
    if (this.config.get<string>("stripe.mode") === "live") {
      return;
    }
    const subtotal = plan.unitAmountPence * quantity;
    const tax = vatPence(subtotal, plan.vatPercent, plan.vatInclusive);
    const mock = mockInvoice({
      id: `in_mock_${externalId ?? firmId}`,
      firmId,
      subscriptionId,
      subtotalPence: tax.netPence,
      taxPence: tax.taxPence,
      totalPence: tax.totalPence,
    });
    await this.prisma.billingInvoice.upsert({
      where: { stripeInvoiceId: mock.id },
      update: {
        status: "paid",
        subtotalPence: tax.netPence,
        taxPence: tax.taxPence,
        totalPence: tax.totalPence,
        paidAt: mock.paidAt ?? new Date(),
      },
      create: {
        firmId,
        subscriptionId,
        stripeInvoiceId: mock.id,
        number: mock.number,
        status: "paid",
        currency: plan.currency,
        subtotalPence: tax.netPence,
        taxPence: tax.taxPence,
        totalPence: tax.totalPence,
        hostedInvoiceUrl: mock.hostedInvoiceUrl,
        invoicePdfUrl: mock.invoicePdfUrl,
        periodStart: mock.periodStart,
        periodEnd: mock.periodEnd,
        paidAt: mock.paidAt ?? new Date(),
      },
    });
  }

  private async quantityFor(firmId: string, plan: { billingModel: BillingModel; minQuantity: number }) {
    if (plan.billingModel !== BillingModel.PER_UNIT) {
      return 1;
    }
    const clients = await this.activeClientCount(firmId);
    return Math.max(clients, plan.minQuantity, 1);
  }

  private async activeClientCount(firmId: string) {
    return this.prisma.client.count({ where: { firmId } });
  }

  private assertQuantity(plan: { name: string; minQuantity: number; maxQuantity: number | null; billingModel: BillingModel }, quantity: number) {
    if (plan.maxQuantity && quantity > plan.maxQuantity) {
      throw new BadRequestException(
        `${plan.name} supports up to ${plan.maxQuantity} active clients. Choose Practice Growth for ${quantity} clients.`,
      );
    }
    if (plan.billingModel === BillingModel.PER_UNIT && quantity < plan.minQuantity) {
      throw new BadRequestException(`${plan.name} starts at ${plan.minQuantity} active clients.`);
    }
  }

  private async planForQuantity(current: { audience: string; billingModel: BillingModel; maxQuantity: number | null }, quantity: number) {
    if (current.billingModel !== BillingModel.PER_UNIT) {
      return null;
    }
    if (current.maxQuantity && quantity > current.maxQuantity) {
      return this.prisma.billingPlan.findFirst({
        where: {
          enabled: true,
          audience: "PRACTICE",
          billingModel: BillingModel.PER_UNIT,
          OR: [{ maxQuantity: null }, { maxQuantity: { gte: quantity } }],
          minQuantity: { lte: quantity },
        },
        orderBy: { unitAmountPence: "asc" },
      });
    }
    return null;
  }

  private async requireFirm(firmId: string) {
    const firm = await this.prisma.firm.findUnique({ where: { id: firmId } });
    if (!firm) {
      throw new NotFoundException("Firm not found");
    }
    return firm;
  }

  private async requirePlan(slug: string, enabledOnly = false) {
    const plan = await this.prisma.billingPlan.findUnique({ where: { slug } });
    if (!plan || (enabledOnly && !plan.enabled)) {
      throw new NotFoundException("Plan not found");
    }
    return plan;
  }

  private async firmIdForStripeSub(subscriptionId: string) {
    const row = await this.prisma.firmSubscription.findFirst({ where: { stripeSubscriptionId: subscriptionId } });
    return row?.firmId;
  }

  private priceLabel(plan: { billingModel: string; unitAmountPence: number; currency: string }) {
    const amount = `£${(plan.unitAmountPence / 100).toFixed(2)}`;
    return plan.billingModel === "PER_UNIT" ? `${amount} per active client / month` : `${amount} / month`;
  }

  private presentSubscription(
    sub: {
      id: string;
      status: string;
      quantity: number;
      currentPeriodStart: Date | null;
      currentPeriodEnd: Date | null;
      cancelAtPeriodEnd: boolean;
      stripeCustomerId: string | null;
      stripeSubscriptionId: string | null;
      vatNumber: string | null;
    },
    plan: Parameters<BillingService["presentPlan"]>[0],
  ) {
    const billed = vatPence(plan.unitAmountPence * sub.quantity, plan.vatPercent, plan.vatInclusive);
    return {
      id: sub.id,
      status: sub.status,
      quantity: sub.quantity,
      currentPeriodStart: sub.currentPeriodStart,
      currentPeriodEnd: sub.currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      stripeSubscriptionId: sub.stripeSubscriptionId,
      monthlyNetPence: billed.netPence,
      monthlyVatPence: billed.taxPence,
      monthlyTotalPence: billed.totalPence,
      plan: this.presentPlan(plan),
    };
  }

  private presentInvoice(row: {
    id: string;
    number: string | null;
    status: string;
    currency: string;
    subtotalPence: number;
    taxPence: number;
    totalPence: number;
    hostedInvoiceUrl: string | null;
    invoicePdfUrl: string | null;
    periodStart: Date | null;
    periodEnd: Date | null;
    paidAt: Date | null;
    createdAt: Date;
  }) {
    return {
      id: row.id,
      number: row.number,
      status: row.status,
      currency: row.currency,
      subtotalPence: row.subtotalPence,
      taxPence: row.taxPence,
      totalPence: row.totalPence,
      hostedInvoiceUrl: row.hostedInvoiceUrl,
      invoicePdfUrl: row.invoicePdfUrl,
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      paidAt: row.paidAt,
      createdAt: row.createdAt,
    };
  }
}

function meta(data: Record<string, unknown>, key: string): string | undefined {
  const metadata = data.metadata;
  if (metadata && typeof metadata === "object" && key in (metadata as Record<string, unknown>)) {
    const value = (metadata as Record<string, unknown>)[key];
    return value == null ? undefined : String(value);
  }
  return undefined;
}

function idOf(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value && "id" in value) {
    return String((value as { id: string }).id);
  }
  return undefined;
}

function unixDate(value: unknown): Date | undefined {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000) : undefined;
}

function moneyToPence(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function optionalString(value: unknown): string | undefined {
  return value == null ? undefined : String(value);
}
