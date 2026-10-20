import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuthUser } from "../common/types";
import { AuthorizationService } from "../authorization/authorization.service";

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthorizationService,
  ) {}

  async listFirms(user: AuthUser) {
    this.authz.assertPlatform(user, this.authz.canPlatform(user, "view_firms") ? "view_firms" : "view_firm_counts_only");
    const firms = await this.prisma.firm.findMany({ orderBy: { name: "asc" } });
    const stats = await Promise.all(firms.map((firm) => this.countsForFirm(firm.id)));
    return firms.map((firm, index) => ({
      id: firm.id,
      name: firm.name,
      slug: firm.slug,
      subscriptionPlan: firm.subscriptionPlan || firm.planType.toLowerCase(),
      createdAt: firm.createdAt,
      ...stats[index],
    }));
  }

  async firmStats(user: AuthUser, firmId: string) {
    if (!this.authz.canPlatform(user, "view_firm_stats")) {
      this.authz.assertPlatform(user, "view_firm_counts_only");
    }
    const firm = await this.requireFirm(firmId);
    return {
      id: firm.id,
      name: firm.name,
      slug: firm.slug,
      subscriptionPlan: firm.subscriptionPlan || firm.planType.toLowerCase(),
      ...(await this.countsForFirm(firm.id)),
    };
  }

  async firmMetadata(user: AuthUser, firmId: string) {
    this.authz.assertPlatform(user, "view_firm_and_client_metadata");
    const firm = await this.requireFirm(firmId);
    const clients = await this.prisma.client.findMany({
      where: { firmId: firm.id },
      select: { id: true, name: true, type: true, createdAt: true },
      orderBy: { name: "asc" },
    });
    const users = await this.prisma.user.findMany({
      where: { firmId: firm.id },
      select: { id: true, name: true, email: true, role: true, status: true },
      orderBy: { name: "asc" },
    });
    return {
      id: firm.id,
      name: firm.name,
      slug: firm.slug,
      contactEmail: firm.contactEmail,
      clients: clients.map((client) => ({ id: client.id, name: client.name, type: client.type, createdAt: client.createdAt })),
      users: users.map((member) => ({ id: member.id, name: member.name, email: member.email, role: member.role, isActive: member.status === "ACTIVE" })),
    };
  }

  async health(user: AuthUser) {
    this.authz.assertPlatform(user, "view_system_health");
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: "ok", service: "mtd-it-api", scope: "platform" };
  }

  async logs(user: AuthUser) {
    this.authz.assertPlatform(user, "view_logs");
    return this.prisma.auditLog.findMany({
      where: { OR: [{ firmId: null }, { actionType: { startsWith: "admin." } }, { actionType: { startsWith: "auth." } }] },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, actionType: true, createdAt: true, actorUserId: true, firmId: true },
    });
  }

  async featureFlags(user: AuthUser) {
    this.authz.assertPlatform(user, "manage_feature_flags");
    return this.prisma.featureFlag.findMany({ orderBy: { key: "asc" } });
  }

  private async requireFirm(id: string) {
    const firm = await this.prisma.firm.findUnique({ where: { id } });
    if (!firm) {
      throw new NotFoundException("Firm not found");
    }
    return firm;
  }

  private async countsForFirm(firmId: string) {
    const [totalClients, totalFirmUsers, totalVatReturns, totalItsaSubmissions] = await Promise.all([
      this.prisma.client.count({ where: { firmId } }),
      this.prisma.user.count({ where: { firmId } }),
      this.prisma.vatReturn.count({ where: { client: { firmId } } }),
      this.prisma.itsaUpdate.count({ where: { client: { firmId } } }),
    ]);
    return {
      totalClients,
      totalFirmUsers,
      totalVatReturns,
      totalItsaSubmissions,
      numberOfClients: totalClients,
      numberOfUsers: totalFirmUsers,
      numberOfVatReturns: totalVatReturns,
      numberOfItsaSubmissions: totalItsaSubmissions,
    };
  }
}
