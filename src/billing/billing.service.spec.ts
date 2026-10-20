import { BillingAudience, BillingModel, BillingStatus } from "@prisma/client";
import { BillingService } from "./billing.service";
import { MockStripeGateway } from "./stripe.mock";

describe("BillingService", () => {
  const firm = {
    id: "firm-1",
    name: "Northbridge",
    contactEmail: "carol.w@example.org",
    billingStatus: BillingStatus.TRIAL,
    billingVatNumber: null,
    stripeCustomerId: null,
  };
  const lite = {
    id: "plan-lite",
    slug: "ledger-lite",
    name: "Ledger Lite",
    description: "Lite",
    audience: BillingAudience.BUSINESS,
    billingModel: BillingModel.FLAT,
    currency: "GBP",
    unitAmountPence: 600,
    interval: "month",
    vatPercent: 20,
    vatInclusive: false,
    minQuantity: 1,
    maxQuantity: 1,
    features: ["bookkeeping", "vat_returns"],
    highlight: false,
    enabled: true,
    sortOrder: 10,
    stripeProductId: null,
    stripePriceId: null,
  };
  const start = {
    ...lite,
    id: "plan-start",
    slug: "practice-start",
    name: "Practice Start",
    audience: BillingAudience.PRACTICE,
    billingModel: BillingModel.PER_UNIT,
    maxQuantity: 25,
    features: ["practice_clients", "multi_user", "ai_categorisation"],
  };
  const growth = {
    ...start,
    id: "plan-growth",
    slug: "practice-growth",
    name: "Practice Growth",
    unitAmountPence: 400,
    minQuantity: 26,
    maxQuantity: null,
  };

  const prisma = {
    billingPlan: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    firm: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    firmSubscription: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    billingInvoice: { findMany: jest.fn(), create: jest.fn(), upsert: jest.fn() },
    billingEvent: { findUnique: jest.fn(), upsert: jest.fn(), update: jest.fn() },
    billingUsageSnapshot: { create: jest.fn() },
    client: { count: jest.fn() },
    user: { count: jest.fn() },
  };
  const config = {
    get: jest.fn((key: string) => {
      if (key === "nodeEnv") return "test";
      if (key === "stripe.mode") return "mock";
      if (key === "frontendOrigin") return "http://localhost:2327";
      return undefined;
    }),
  };
  const audit = { record: jest.fn() };
  const notifications = { notify: jest.fn() };
  const stripe = new MockStripeGateway();
  const service = new BillingService(prisma as never, config as never, stripe, audit as never, notifications as never);
  const user = { id: "u1", firmId: "firm-1", role: "ADMIN", email: "p", name: "Priya", clientId: null } as never;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.firm.findUnique.mockResolvedValue(firm);
    prisma.firm.update.mockResolvedValue(firm);
    prisma.client.count.mockResolvedValue(3);
    prisma.user.count.mockResolvedValue(1);
    prisma.billingPlan.upsert.mockResolvedValue(lite);
    prisma.billingPlan.findMany.mockResolvedValue([lite, start, growth]);
    prisma.billingPlan.update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ ...lite, ...data, stripeProductId: "prod_mock_ledger-lite", stripePriceId: "price_mock_ledger-lite" }),
    );
    prisma.firmSubscription.findUnique.mockResolvedValue(null);
    prisma.firmSubscription.upsert.mockImplementation(({ create, update }: { create: Record<string, unknown>; update: Record<string, unknown> }) =>
      Promise.resolve({ id: "sub-1", firmId: "firm-1", ...create, ...update, plan: lite }),
    );
    prisma.billingInvoice.upsert.mockResolvedValue({ id: "inv-1" });
    prisma.billingInvoice.create.mockResolvedValue({ id: "inv-1" });
    prisma.billingEvent.findUnique.mockResolvedValue(null);
    prisma.billingEvent.upsert.mockResolvedValue({ id: "evt-1" });
    prisma.billingEvent.update.mockResolvedValue({});
    prisma.billingUsageSnapshot.create.mockResolvedValue({});
  });

  it("lists catalog plans with VAT-inclusive example totals", async () => {
    const plans = await service.listPlans(true);
    expect(plans[0].priceLabel).toContain("£6.00");
    expect(plans[0].exampleMonthlyTotalPence).toBe(720);
  });

  it("starts Checkout and activates a Lite subscription from the mock session", async () => {
    prisma.billingPlan.findUnique.mockResolvedValue(lite);
    const started = await service.checkout(user, { planSlug: "ledger-lite" });
    expect(started.url).toContain("session_id=");
    const completed = await service.completeCheckout(user, started.sessionId);
    expect(prisma.firmSubscription.upsert).toHaveBeenCalled();
    expect(prisma.billingInvoice.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ taxPence: 120, totalPence: 720, status: "paid" }),
      }),
    );
    expect(completed.firmId).toBe("firm-1");
  });

  it("blocks Practice Start when the firm has more than 25 clients", async () => {
    prisma.billingPlan.findUnique.mockResolvedValue(start);
    prisma.client.count.mockResolvedValue(26);
    await expect(service.checkout(user, { planSlug: "practice-start" })).rejects.toThrow(/Practice Growth/);
  });

  it("reports per-client usage and moves Start onto Growth past 25 clients", async () => {
    prisma.firmSubscription.findMany.mockResolvedValue([
      {
        id: "sub-1",
        firmId: "firm-1",
        planId: start.id,
        status: "active",
        quantity: 25,
        stripeSubscriptionId: "sub_mock_firm-1",
        stripeCustomerId: "cus_mock_firm-1",
        vatNumber: null,
        plan: start,
        firm,
      },
    ]);
    prisma.client.count.mockResolvedValue(30);
    prisma.billingPlan.findFirst.mockResolvedValue(growth);
    prisma.billingPlan.findUnique.mockResolvedValue(growth);
    const updated = await service.syncUsage();
    expect(updated).toBe(1);
    expect(notifications.notify).toHaveBeenCalledWith(expect.objectContaining({ title: expect.stringContaining("Practice Growth") }));
  });

  it("treats trial firms as Pro for entitlements and Lite once the trial ends", async () => {
    prisma.firmSubscription.findUnique.mockResolvedValue(null);
    expect(await service.hasFeature("firm-1", "ai_categorisation")).toBe(true);
    prisma.firm.findUnique.mockResolvedValue({ ...firm, billingStatus: BillingStatus.CANCELLED });
    expect(await service.hasFeature("firm-1", "ai_categorisation")).toBe(false);
  });

  it("is idempotent for Stripe webhook deliveries", async () => {
    prisma.billingEvent.findUnique.mockResolvedValue({ id: "evt-1", processedAt: new Date() });
    const result = await service.handleWebhook(JSON.stringify({ id: "evt_1", type: "invoice.paid", data: {} }));
    expect(result).toEqual({ received: true, duplicate: true });
    expect(prisma.billingInvoice.upsert).not.toHaveBeenCalled();
  });

  it("records a VAT invoice from invoice.paid and notifies on payment_failed", async () => {
    prisma.billingEvent.findUnique.mockResolvedValue(null);
    prisma.firm.findFirst.mockResolvedValue(firm);
    await service.handleWebhook(
      JSON.stringify({
        id: "evt_paid",
        type: "invoice.paid",
        data: { id: "in_live_1", customer: "cus_1", subtotal: 600, tax: 120, total: 720, status: "paid", number: "MTD-1", currency: "gbp" },
      }),
    );
    expect(prisma.billingInvoice.upsert).toHaveBeenCalled();
    expect(notifications.notify).toHaveBeenCalledWith(expect.objectContaining({ type: "BILLING_PAYMENT_SUCCEEDED" }));
    await service.handleWebhook(
      JSON.stringify({
        id: "evt_fail",
        type: "invoice.payment_failed",
        data: { id: "in_live_2", customer: "cus_1", subtotal: 600, tax: 120, total: 720, status: "open" },
      }),
    );
    expect(notifications.notify).toHaveBeenCalledWith(expect.objectContaining({ type: "BILLING_PAYMENT_FAILED" }));
  });
});
