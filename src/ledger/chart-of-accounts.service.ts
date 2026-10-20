import { Injectable } from "@nestjs/common";
import { ChartProfile, ClientType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { decorateAccountWithItsa } from "../itsa/mtd-itsa.mapping";
import { decorateAccountWithVat } from "../vat/vat-box.mapping";
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
    const charts = profile ? [getChart(toChartProfile(profile))] : CHART_OF_ACCOUNTS;
    return charts.map((chart) => ({
      ...chart,
      accounts: chart.accounts.map((account) =>
        decorateAccountWithVat(decorateAccountWithItsa({ ...account, profile: toChartProfile(chart.profile) })),
      ),
    }));
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
    const templates = await this.prisma.chartOfAccount.findMany({ where: { profile } });
    const templateByCode = new Map(templates.map((item) => [item.code, item.id]));
    const rows = chart.accounts.map((account) => ({
      clientId,
      profile,
      code: account.code,
      name: account.name,
      category: account.category,
      type: toLedgerAccountType(account.type),
      chartOfAccountId: templateByCode.get(account.code),
      isActive: true,
    }));
    await this.prisma.ledger.createMany({ data: rows, skipDuplicates: true });
    if (templateByCode.size > 0) {
      const existing = await this.prisma.ledger.findMany({ where: { clientId, profile, chartOfAccountId: null } });
      for (const account of existing) {
        const chartId = templateByCode.get(account.code);
        if (chartId) {
          await this.prisma.ledger.update({ where: { id: account.id }, data: { chartOfAccountId: chartId } });
        }
      }
    }
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
    const decorated = accounts.map((account) => decorateAccountWithVat(decorateAccountWithItsa(account)));
    const grouped = CHART_OF_ACCOUNTS.map((template) => {
      const key = toChartProfile(template.profile);
      return {
        profile: template.profile,
        accounts: decorated.filter((account) => account.profile === key),
      };
    }).filter((group) => group.accounts.length > 0);
    return { profile: profile ? profile.toLowerCase() : undefined, charts: grouped, accounts: decorated };
  }
}
