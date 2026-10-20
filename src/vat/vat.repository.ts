import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { VatReturnView } from "./vat-return.validator";

@Injectable()
export class VatRepository {
  constructor(private readonly prisma: PrismaService) {}

  listObligations(clientId: string) {
    return this.prisma.vatObligation.findMany({ where: { clientId }, orderBy: { start: "desc" } });
  }

  findObligation(clientId: string, periodKey: string) {
    return this.prisma.vatObligation.findUnique({
      where: { clientId_periodKey: { clientId, periodKey } },
    });
  }

  upsertObligation(clientId: string, periodKey: string, data: Prisma.VatObligationUncheckedCreateInput) {
    return this.prisma.vatObligation.upsert({
      where: { clientId_periodKey: { clientId, periodKey } },
      update: {
        start: data.start,
        end: data.end,
        due: data.due,
        status: data.status,
        received: data.received,
        correlationId: data.correlationId,
        rawPayload: data.rawPayload ?? Prisma.JsonNull,
      },
      create: data,
    });
  }

  updateObligation(id: string, data: Prisma.VatObligationUpdateInput) {
    return this.prisma.vatObligation.update({ where: { id }, data });
  }

  listReturns(clientId: string) {
    return this.prisma.vatReturn.findMany({ where: { clientId }, orderBy: { createdAt: "desc" } });
  }

  createReturn(data: Prisma.VatReturnUncheckedCreateInput) {
    return this.prisma.vatReturn.create({ data });
  }

  replacePayments(clientId: string, rows: Prisma.VatPaymentCreateManyInput[]) {
    return this.prisma.$transaction([
      this.prisma.vatPayment.deleteMany({ where: { clientId } }),
      this.prisma.vatPayment.createMany({ data: rows }),
    ]);
  }

  listPayments(clientId: string) {
    return this.prisma.vatPayment.findMany({ where: { clientId }, orderBy: { received: "desc" } });
  }

  listSummaries(clientId: string) {
    return this.prisma.vatTransactionSummary.findMany({
      where: { clientId },
      orderBy: { periodStart: "desc" },
    });
  }

  upsertSummary(
    clientId: string,
    periodStart: Date,
    periodEnd: Date,
    data: {
      periodKey?: string;
      boxes: VatReturnView;
      transactionCount: number;
      lines: unknown;
      excluded: unknown;
    },
  ) {
    const boxes = {
      box1: data.boxes.box1,
      box2: data.boxes.box2,
      box3: data.boxes.box3,
      box4: data.boxes.box4,
      box5: data.boxes.box5,
      box6: data.boxes.box6,
      box7: data.boxes.box7,
      box8: data.boxes.box8,
      box9: data.boxes.box9,
    };
    return this.prisma.vatTransactionSummary.upsert({
      where: { clientId_periodStart_periodEnd: { clientId, periodStart, periodEnd } },
      update: {
        periodKey: data.periodKey,
        transactionCount: data.transactionCount,
        lines: data.lines as Prisma.InputJsonValue,
        excluded: data.excluded as Prisma.InputJsonValue,
        ...boxes,
      },
      create: {
        clientId,
        periodStart,
        periodEnd,
        periodKey: data.periodKey,
        transactionCount: data.transactionCount,
        lines: data.lines as Prisma.InputJsonValue,
        excluded: data.excluded as Prisma.InputJsonValue,
        ...boxes,
      },
    });
  }

  countTransactions(clientId: string, periodStart?: string, periodEnd?: string) {
    return this.prisma.transaction.count({
      where: {
        clientId,
        ...(periodStart && periodEnd ? { date: { gte: new Date(periodStart), lte: new Date(periodEnd) } } : {}),
      },
    });
  }

  loadLedgersForPeriod(clientId: string, periodStart: string, periodEnd: string) {
    const start = new Date(periodStart);
    const end = new Date(periodEnd);
    return this.prisma.ledger.findMany({
      where: { clientId },
      include: {
        transactions: { where: { date: { gte: start, lte: end } } },
      },
      orderBy: [{ profile: "asc" }, { code: "asc" }],
    });
  }
}
