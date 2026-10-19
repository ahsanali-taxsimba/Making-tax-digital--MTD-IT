import { Injectable } from "@nestjs/common";
import { ChartProfile, ClientType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  CHART_OF_ACCOUNTS,
  defaultProfileForClientType,
  getChart,
  toChartProfile,
  toLedgerAccountType,
} from "./chart-of-accounts.catalog";

@Injectable()
export class ChartOfAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  templates(profile?: string) {
    if (!profile) {
      return CHART_OF_ACCOUNTS;
    }
    return [getChart(toChartProfile(profile))];
  }

  async provision(clientId: string, type: ClientType, extraProfiles: ChartProfile[] = []) {
    const profiles = Array.from(new Set([defaultProfileForClientType(type), ...extraProfiles]));
    const created = [];
    for (const profile of profiles) {
      created.push(await this.applyProfile(clientId, profile));
    }
    return created.flat();
  }

  async applyProfile(clientId: string, profile: ChartProfile) {
    const chart = getChart(profile);
    const rows = chart.accounts.map((account) => ({
      clientId,
      profile,
      code: account.code,
      name: account.name,
      category: account.category,
      type: toLedgerAccountType(account.type),
    }));
    await this.prisma.ledger.createMany({ data: rows, skipDuplicates: true });
    return this.prisma.ledger.findMany({
      where: { clientId, profile },
      orderBy: { code: "asc" },
    });
  }

  async forClient(clientId: string, profile?: ChartProfile) {
    const accounts = await this.prisma.ledger.findMany({
      where: { clientId, ...(profile ? { profile } : {}) },
      include: { transactions: { orderBy: { date: "desc" }, take: 25 } },
      orderBy: [{ profile: "asc" }, { code: "asc" }],
    });
    const grouped = CHART_OF_ACCOUNTS.map((template) => {
      const key = toChartProfile(template.profile);
      return {
        profile: template.profile,
        accounts: accounts.filter((account) => account.profile === key),
      };
    }).filter((group) => group.accounts.length > 0);
    return { profile: profile ? profile.toLowerCase() : undefined, charts: grouped, accounts };
  }
}
