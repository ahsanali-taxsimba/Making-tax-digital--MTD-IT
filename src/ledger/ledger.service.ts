import { BadRequestException, Injectable } from "@nestjs/common";
import { ChartProfile, LedgerAccountType } from "@prisma/client";
import { ClientsService } from "../clients/clients.service";
import { AuthUser } from "../common/types";
import { PrismaService } from "../prisma/prisma.service";
import { ChartOfAccountsService } from "./chart-of-accounts.service";
import { toChartProfile } from "./chart-of-accounts.catalog";

@Injectable()
export class LedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clients: ClientsService,
    private readonly charts: ChartOfAccountsService,
  ) {}

  async list(user: AuthUser, clientId: string, profile?: string) {
    await this.clients.get(user, clientId);
    return this.charts.forClient(clientId, profile ? toChartProfile(profile) : undefined);
  }

  async applyChart(user: AuthUser, clientId: string, profile: string) {
    await this.clients.get(user, clientId);
    const accounts = await this.charts.applyProfile(clientId, toChartProfile(profile));
    return { profile: toChartProfile(profile), applied: accounts.length, accounts };
  }

  async addTransaction(
    user: AuthUser,
    clientId: string,
    dto: { ledgerId?: string; date: string; description: string; amount: number; source?: string },
  ) {
    await this.clients.get(user, clientId);
    if (dto.ledgerId) {
      const account = await this.prisma.ledger.findFirst({ where: { id: dto.ledgerId, clientId } });
      if (!account) {
        throw new BadRequestException("Ledger account does not belong to this client");
      }
    }
    return this.prisma.transaction.create({
      data: {
        clientId,
        ledgerId: dto.ledgerId,
        date: new Date(dto.date),
        description: dto.description,
        amount: dto.amount,
        source: dto.source,
      },
    });
  }

  async createLedger(
    user: AuthUser,
    clientId: string,
    dto: { name: string; type: LedgerAccountType; code: number; category: string; profile?: string },
  ) {
    await this.clients.get(user, clientId);
    return this.prisma.ledger.create({
      data: {
        clientId,
        name: dto.name,
        type: dto.type,
        code: dto.code,
        category: dto.category,
        profile: dto.profile ? toChartProfile(dto.profile) : ChartProfile.SOLE_TRADER,
      },
    });
  }
}
