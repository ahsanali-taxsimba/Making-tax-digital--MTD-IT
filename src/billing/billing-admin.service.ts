import { Injectable, NotFoundException } from "@nestjs/common";
import { BillingModel, BillingStatus } from "@prisma/client";
import { AuthUser } from "../common/types";
import { AuthorizationService } from "../authorization/authorization.service";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { vatPence } from "./billing.catalog";
import { BillingService } from "./billing.service";
import { CreatePlanDto, UpsertPlanDto } from "./dto/billing.dto";

@Injectable()
export class BillingAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthorizationService,
    private readonly billing: BillingService,
    private readonly audit: AuditService,
  ) {}

  async metrics(user: AuthUser) {
    this.authz.assertPlatform(user, this.authz.canPlatform(user, "view_billing") ? "view_billing" : "manage_firm_subscription");
    const subs = await this.prisma.firmSubscription.findMany({
      where: { status: { in: ["active", "trialing", "past_due"] } },
      include: { plan: true, firm: { select: { id: true, name: true, slug: true, billingStatus: true } } },
    });
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const paidThisMonth = await this.prisma.billingInvoice.aggregate({
      where: { status: "paid", paidAt: { gte: monthStart } },
      _sum: { totalPence: true, taxPence: true, subtotalPence: true },
    });
    const byPlan = new Map<string, { slug: string; name: string; subscribers: number; mrrPence: number }>();
    let mrrPence = 0;
    for (const sub of subs) {
      const billed = vatPence(sub.plan.unitAmountPence * sub.quantity, sub.plan.vatPercent, sub.plan.vatInclusive);
      mrrPence += billed.totalPence;
      const current = byPlan.get(sub.plan.slug) ?? { slug: sub.plan.slug, name: sub.plan.name, subscribers: 0, mrrPence: 0 };
      current.subscribers += 1;
      current.mrrPence += billed.totalPence;
      byPlan.set(sub.plan.slug, current);
    }
    return {
      currency: "GBP",
      mrrPence,
      arrPence: mrrPence * 12,
      recognisedRevenuePence: paidThisMonth._sum.totalPence ?? 0,
      vatCollectedPence: paidThisMonth._sum.taxPence ?? 0,
      activeSubscribers: subs.filter((row) => row.status === "active").length,
      trialing: subs.filter((row) => row.status === "trialing").length,
      pastDue: subs.filter((row) => row.status === "past_due").length,
      byPlan: [...byPlan.values()].sort((a, b) => b.mrrPence - a.mrrPence),
    };
  }

  async subscribers(user: AuthUser) {
    this.authz.assertPlatform(user, this.authz.canPlatform(user, "view_billing") ? "view_billing" : "manage_firm_subscription");
    const rows = await this.prisma.firmSubscription.findMany({
      include: { plan: true, firm: { select: { id: true, name: true, slug: true, billingStatus: true } } },
      orderBy: { updatedAt: "desc" },
    });
    return rows.map((row) => ({
      firmId: row.firm.id,
      firmName: row.firm.name,
      slug: row.firm.slug,
      plan: row.plan.slug,
      planName: row.plan.name,
      status: row.status,
      billingStatus: row.firm.billingStatus as BillingStatus,
      quantity: row.quantity,
      mrrPence: vatPence(row.plan.unitAmountPence * row.quantity, row.plan.vatPercent, row.plan.vatInclusive).totalPence,
    }));
  }

  async listPlans(user: AuthUser) {
    this.assertManageOrView(user);
    return this.billing.listPlans(false);
  }

  async createPlan(user: AuthUser, dto: CreatePlanDto) {
    this.authz.assertPlatform(user, "manage_billing");
    const created = await this.prisma.billingPlan.create({
      data: {
        slug: dto.slug,
        name: dto.name,
        description: dto.description,
        audience: dto.audience,
        billingModel: dto.billingModel,
        unitAmountPence: dto.unitAmountPence,
        vatPercent: dto.vatPercent ?? 20,
        minQuantity: dto.minQuantity ?? 1,
        maxQuantity: dto.maxQuantity ?? null,
        features: dto.features ?? [],
        highlight: dto.highlight ?? false,
        sortOrder: dto.sortOrder ?? 100,
        enabled: dto.enabled ?? true,
      },
    });
    const synced = await this.billing.syncPlanToStripe(created.id);
    await this.audit.record({ actor: user, actionType: "billing.plan.created", metadata: { slug: created.slug } });
    return this.billing.presentPlan(synced);
  }

  async updatePlan(user: AuthUser, id: string, dto: UpsertPlanDto) {
    this.authz.assertPlatform(user, "manage_billing");
    const plan = await this.prisma.billingPlan.findUnique({ where: { id } });
    if (!plan) {
      throw new NotFoundException("Plan not found");
    }
    const priceChanged = dto.unitAmountPence != null && dto.unitAmountPence !== plan.unitAmountPence;
    const updated = await this.prisma.billingPlan.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        audience: dto.audience,
        billingModel: dto.billingModel as BillingModel | undefined,
        unitAmountPence: dto.unitAmountPence,
        vatPercent: dto.vatPercent,
        minQuantity: dto.minQuantity,
        maxQuantity: dto.maxQuantity === undefined ? undefined : dto.maxQuantity,
        features: dto.features ? dto.features : undefined,
        highlight: dto.highlight,
        sortOrder: dto.sortOrder,
        enabled: dto.enabled,
        ...(priceChanged ? { stripePriceId: null } : {}),
      },
    });
    const synced = await this.billing.syncPlanToStripe(updated.id);
    await this.audit.record({
      actor: user,
      actionType: "billing.plan.updated",
      metadata: { slug: updated.slug, enabled: updated.enabled, unitAmountPence: updated.unitAmountPence },
    });
    return this.billing.presentPlan(synced);
  }

  private assertManageOrView(user: AuthUser) {
    if (this.authz.canPlatform(user, "manage_billing") || this.authz.canPlatform(user, "view_billing")) {
      this.authz.assertPlatform(user, this.authz.canPlatform(user, "manage_billing") ? "manage_billing" : "view_billing");
      return;
    }
    this.authz.assertPlatform(user, "manage_firm_subscription");
  }
}
