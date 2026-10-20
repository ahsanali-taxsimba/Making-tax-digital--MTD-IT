import { Injectable } from "@nestjs/common";
import { ChartProfile, ObligationStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ItsaRepository {
  constructor(private readonly prisma: PrismaService) {}

  listBusinesses(clientId: string) {
    return this.prisma.business.findMany({ where: { clientId }, orderBy: { createdAt: "asc" } });
  }

  findBusiness(clientId: string, businessId: string) {
    return this.prisma.business.findFirst({ where: { id: businessId, clientId } });
  }

  findBusinessByHmrcId(clientId: string, hmrcBusinessId: string) {
    return this.prisma.business.findFirst({ where: { clientId, hmrcBusinessId } });
  }

  createBusiness(data: Prisma.BusinessUncheckedCreateInput) {
    return this.prisma.business.create({ data });
  }

  listObligations(clientId: string) {
    return this.prisma.itsaObligation.findMany({
      where: { clientId },
      include: { business: true },
      orderBy: { due: "asc" },
    });
  }

  findObligation(clientId: string, type: string, taxYear: string, periodId?: string | null, businessId?: string | null) {
    return this.prisma.itsaObligation.findFirst({
      where: {
        clientId,
        type,
        taxYear,
        periodId: periodId ?? undefined,
        businessId: businessId ?? undefined,
      },
    });
  }

  upsertObligation(data: Prisma.ItsaObligationUncheckedCreateInput) {
    return this.prisma.itsaObligation.create({ data });
  }

  updateObligation(id: string, data: Prisma.ItsaObligationUpdateInput) {
    return this.prisma.itsaObligation.update({ where: { id }, data });
  }

  listUpdates(clientId: string, filters: { businessId?: string; taxYear?: string } = {}) {
    return this.prisma.itsaUpdate.findMany({
      where: { clientId, ...filters },
      include: { business: true },
      orderBy: { createdAt: "desc" },
    });
  }

  createUpdate(data: Prisma.ItsaUpdateUncheckedCreateInput) {
    return this.prisma.itsaUpdate.create({ data });
  }

  listEops(clientId: string, taxYear?: string) {
    return this.prisma.itsaEndOfPeriodStatement.findMany({
      where: { clientId, ...(taxYear ? { taxYear } : {}) },
      include: { business: true },
      orderBy: { createdAt: "desc" },
    });
  }

  createEops(data: Prisma.ItsaEndOfPeriodStatementUncheckedCreateInput) {
    return this.prisma.itsaEndOfPeriodStatement.create({ data });
  }

  listFinals(clientId: string, taxYear?: string) {
    return this.prisma.itsaFinalDeclaration.findMany({
      where: { clientId, ...(taxYear ? { taxYear } : {}) },
      orderBy: { createdAt: "desc" },
    });
  }

  createFinal(data: Prisma.ItsaFinalDeclarationUncheckedCreateInput) {
    return this.prisma.itsaFinalDeclaration.create({ data });
  }

  listMappings(profile?: ChartProfile) {
    return this.prisma.itsaAccountMapping.findMany({
      where: profile ? { profile } : {},
      orderBy: [{ profile: "asc" }, { code: "asc" }],
    });
  }

  listLedgers(clientId: string) {
    return this.prisma.ledger.findMany({
      where: { clientId },
      orderBy: [{ profile: "asc" }, { code: "asc" }],
    });
  }

  loadLedgersForPeriod(clientId: string, profile: ChartProfile, periodStart: string, periodEnd: string) {
    return this.prisma.ledger.findMany({
      where: { clientId, profile },
      include: {
        transactions: { where: { date: { gte: new Date(periodStart), lte: new Date(periodEnd) } } },
      },
      orderBy: { code: "asc" },
    });
  }

  countTransactions(clientId: string, profile: ChartProfile, periodStart: string, periodEnd: string) {
    return this.prisma.transaction.count({
      where: {
        clientId,
        date: { gte: new Date(periodStart), lte: new Date(periodEnd) },
        ledger: { profile },
      },
    });
  }
}
