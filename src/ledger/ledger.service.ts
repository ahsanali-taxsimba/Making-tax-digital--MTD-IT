import { Injectable } from "@nestjs/common";
import { LedgerAccountType } from "@prisma/client";
import { ClientsService } from "../clients/clients.service";
import { AuthUser } from "../common/types";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class LedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clients: ClientsService,
  ) {}

  async list(user: AuthUser, clientId: string) {
    await this.clients.get(user, clientId);
    return this.prisma.ledger.findMany({
      where: { clientId },
      include: { transactions: { orderBy: { date: "desc" }, take: 25 } },
    });
  }

  async addTransaction(
    user: AuthUser,
    clientId: string,
    dto: { ledgerId?: string; date: string; description: string; amount: number; source?: string },
  ) {
    await this.clients.get(user, clientId);
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

  async createLedger(user: AuthUser, clientId: string, name: string, type: LedgerAccountType) {
    await this.clients.get(user, clientId);
    return this.prisma.ledger.create({ data: { clientId, name, type } });
  }
}
