import { BillingAdminService } from "./billing-admin.service";

describe("BillingAdminService", () => {
  const prisma = {
    firmSubscription: { findMany: jest.fn() },
    billingInvoice: { aggregate: jest.fn() },
    billingPlan: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  };
  const authz = {
    assertPlatform: jest.fn(),
    canPlatform: jest.fn().mockReturnValue(true),
  };
  const billing = {
    listPlans: jest.fn().mockResolvedValue([]),
    syncPlanToStripe: jest.fn().mockImplementation((id: string) => Promise.resolve({ id, slug: "ledger-plus", name: "Ledger Plus", description: "", audience: "BUSINESS", billingModel: "FLAT", currency: "GBP", unitAmountPence: 1200, interval: "month", vatPercent: 20, vatInclusive: false, minQuantity: 1, maxQuantity: null, features: [], highlight: false, enabled: true, sortOrder: 50 })),
    presentPlan: jest.fn().mockImplementation((plan: { slug: string }) => ({ slug: plan.slug })),
  };
  const audit = { record: jest.fn() };
  const service = new BillingAdminService(prisma as never, authz as never, billing as never, audit as never);
  const user = { id: "p1", principal: "platform", platformRole: "admin_super" } as never;

  beforeEach(() => {
    jest.clearAllMocks();
    authz.canPlatform.mockReturnValue(true);
  });

  it("rolls MRR from active subscriptions including VAT", async () => {
    prisma.firmSubscription.findMany.mockResolvedValue([
      {
        status: "active",
        quantity: 1,
        plan: { slug: "ledger-lite", name: "Ledger Lite", unitAmountPence: 600, vatPercent: 20, vatInclusive: false },
        firm: { id: "f1", name: "Northbridge", slug: "northbridge", billingStatus: "ACTIVE" },
      },
      {
        status: "active",
        quantity: 10,
        plan: { slug: "practice-start", name: "Practice Start", unitAmountPence: 600, vatPercent: 20, vatInclusive: false },
        firm: { id: "f2", name: "Westgate", slug: "westgate", billingStatus: "ACTIVE" },
      },
    ]);
    prisma.billingInvoice.aggregate.mockResolvedValue({ _sum: { totalPence: 7200, taxPence: 1200, subtotalPence: 6000 } });
    const metrics = await service.metrics(user);
    expect(metrics.activeSubscribers).toBe(2);
    expect(metrics.mrrPence).toBe(720 + 7200);
    expect(metrics.arrPence).toBe(metrics.mrrPence * 12);
    expect(metrics.recognisedRevenuePence).toBe(7200);
  });

  it("creates a catalog plan without a code change", async () => {
    prisma.billingPlan.create.mockResolvedValue({ id: "plan-9", slug: "ledger-plus" });
    const created = await service.createPlan(user, {
      slug: "ledger-plus",
      name: "Ledger Plus",
      audience: "BUSINESS" as never,
      billingModel: "FLAT" as never,
      unitAmountPence: 1200,
    });
    expect(created.slug).toBe("ledger-plus");
    expect(billing.syncPlanToStripe).toHaveBeenCalled();
  });
});
