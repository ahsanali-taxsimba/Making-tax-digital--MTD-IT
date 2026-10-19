import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { ObligationStatus } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { ClientsService } from "../clients/clients.service";
import { AuthUser } from "../common/types";
import { HMRC_ITSA } from "../hmrc/hmrc.tokens";
import { HmrcItsaGateway } from "../hmrc/hmrc.types";
import { MtdConnectionService } from "../hmrc/mtd-connection.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { TasksService } from "../tasks/tasks.service";
import { WebhooksService } from "../webhooks/webhooks.service";
import { CreateBusinessDto, SubmitEopsDto, SubmitFinalDeclarationDto, SubmitItsaUpdateDto } from "./dto/itsa.dto";

@Injectable()
export class ItsaService {
  constructor(
    @Inject(HMRC_ITSA) private readonly itsa: HmrcItsaGateway,
    private readonly connections: MtdConnectionService,
    private readonly clients: ClientsService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly tasks: TasksService,
    private readonly notifications: NotificationsService,
    private readonly webhooks: WebhooksService,
  ) {}

  async obligations(user: AuthUser, clientId: string) {
    const client = await this.requireItsaClient(user, clientId);
    const ctx = await this.connections.getCallContext(client.id);
    const result = await this.itsa.getObligations(ctx, client.nino!);
    for (const item of result.data.obligations) {
      const business = item.businessId
        ? await this.prisma.business.findFirst({ where: { clientId: client.id, hmrcBusinessId: item.businessId } })
        : null;
      await this.prisma.itsaObligation.create({
        data: {
          clientId: client.id,
          businessId: business?.id,
          type: item.type,
          taxYear: item.taxYear,
          periodId: item.periodId,
          start: new Date(item.start),
          end: new Date(item.end),
          due: new Date(item.due),
          status: item.status === "Fulfilled" ? ObligationStatus.FULFILLED : ObligationStatus.OPEN,
          received: item.received ? new Date(item.received) : null,
          correlationId: result.correlationId,
          rawPayload: { ...item },
        },
      });
      if (item.status === "Open") {
        const taskType =
          item.type === "EOPS"
            ? "MTD_ITSA_EOPS"
            : item.type === "FINAL_DECLARATION"
              ? "MTD_ITSA_FINAL_DECLARATION"
              : "MTD_ITSA_UPDATE";
        await this.tasks.ensure(client.firmId, client.id, taskType, new Date(item.due), `${item.type} ${item.taxYear}`);
      }
    }
    await this.audit.record({
      actor: user,
      clientId: client.id,
      actionType: "itsa.obligations.fetched",
      metadata: { correlationId: result.correlationId },
    });
    await this.notifications.notify({
      firmId: client.firmId,
      type: "OBLIGATION_FETCHED",
      title: "ITSA obligations refreshed",
      body: `Income Tax obligations synced for ${client.name}.`,
      metadata: { clientId: client.id },
    });
    return this.prisma.itsaObligation.findMany({
      where: { clientId: client.id },
      include: { business: true },
      orderBy: { due: "asc" },
    });
  }

  async listUpdates(user: AuthUser, clientId: string) {
    await this.requireItsaClient(user, clientId);
    return this.prisma.itsaUpdate.findMany({
      where: { clientId },
      include: { business: true },
      orderBy: { createdAt: "desc" },
    });
  }

  async submitUpdate(user: AuthUser, clientId: string, dto: SubmitItsaUpdateDto) {
    const client = await this.requireItsaClient(user, clientId);
    const business = await this.requireBusiness(client.id, dto.businessId);
    const ctx = await this.connections.getCallContext(client.id);
    const result = await this.itsa.submitQuarterlyUpdate(ctx, client.nino!, {
      businessId: business.hmrcBusinessId ?? business.id,
      taxYear: dto.taxYear,
      periodId: dto.periodId,
      periodStart: dto.periodStart,
      periodEnd: dto.periodEnd,
      incomes: dto.incomes,
      expenses: dto.expenses,
    });
    const saved = await this.prisma.itsaUpdate.create({
      data: {
        clientId: client.id,
        businessId: business.id,
        taxYear: dto.taxYear,
        periodId: dto.periodId,
        periodStart: new Date(dto.periodStart),
        periodEnd: new Date(dto.periodEnd),
        incomes: dto.incomes,
        expenses: dto.expenses,
        status: "SUBMITTED",
        hmrcPeriodId: result.data.periodId,
        correlationId: result.correlationId,
        rawPayload: result.data,
      },
    });
    await this.tasks.complete(client.firmId, client.id, "MTD_ITSA_UPDATE");
    await this.audit.record({
      actor: user,
      clientId: client.id,
      actionType: "itsa.update.submitted",
      metadata: { correlationId: result.correlationId, businessId: business.id },
    });
    await this.webhooks.emit(client.firmId, "ITSA_UPDATE_SUBMITTED", {
      clientId: client.id,
      taxYear: dto.taxYear,
      periodId: dto.periodId,
    });
    return saved;
  }

  async submitEops(user: AuthUser, clientId: string, dto: SubmitEopsDto) {
    if (!dto.finalised) {
      throw new BadRequestException("EOPS must be finalised before submission");
    }
    const client = await this.requireItsaClient(user, clientId);
    const business = await this.requireBusiness(client.id, dto.businessId);
    const ctx = await this.connections.getCallContext(client.id);
    const result = await this.itsa.submitEops(ctx, client.nino!, {
      businessId: business.hmrcBusinessId ?? business.id,
      taxYear: dto.taxYear,
      typeOfBusiness: dto.typeOfBusiness,
      accountingPeriodStart: dto.accountingPeriodStart,
      accountingPeriodEnd: dto.accountingPeriodEnd,
      finalised: dto.finalised,
    });
    const saved = await this.prisma.itsaEndOfPeriodStatement.create({
      data: {
        clientId: client.id,
        businessId: business.id,
        taxYear: dto.taxYear,
        typeOfBusiness: dto.typeOfBusiness,
        accountingPeriodStart: new Date(dto.accountingPeriodStart),
        accountingPeriodEnd: new Date(dto.accountingPeriodEnd),
        finalised: dto.finalised,
        status: "SUBMITTED",
        correlationId: result.correlationId,
        rawPayload: result.data,
      },
    });
    await this.tasks.complete(client.firmId, client.id, "MTD_ITSA_EOPS");
    await this.audit.record({
      actor: user,
      clientId: client.id,
      actionType: "itsa.eops.submitted",
      metadata: { correlationId: result.correlationId },
    });
    return saved;
  }

  async submitFinal(user: AuthUser, clientId: string, dto: SubmitFinalDeclarationDto) {
    if (!dto.finalised) {
      throw new BadRequestException("Final declaration must be finalised");
    }
    const client = await this.requireItsaClient(user, clientId);
    const ctx = await this.connections.getCallContext(client.id);
    const result = await this.itsa.submitFinalDeclaration(ctx, client.nino!, dto);
    const saved = await this.prisma.itsaFinalDeclaration.create({
      data: {
        clientId: client.id,
        taxYear: dto.taxYear,
        calculationId: result.data.calculationId,
        finalised: dto.finalised,
        status: "SUBMITTED",
        correlationId: result.correlationId,
        rawPayload: result.data,
      },
    });
    await this.tasks.complete(client.firmId, client.id, "MTD_ITSA_FINAL_DECLARATION");
    await this.audit.record({
      actor: user,
      clientId: client.id,
      actionType: "itsa.final_declaration.submitted",
      metadata: { correlationId: result.correlationId, taxYear: dto.taxYear },
    });
    return saved;
  }

  async addBusiness(user: AuthUser, clientId: string, dto: CreateBusinessDto) {
    const client = await this.requireItsaClient(user, clientId);
    return this.prisma.business.create({
      data: {
        clientId: client.id,
        type: dto.type,
        tradingName: dto.tradingName,
        hmrcBusinessId: dto.hmrcBusinessId,
      },
    });
  }

  private async requireItsaClient(user: AuthUser, clientId: string) {
    const client = await this.clients.get(user, clientId);
    if (!client.nino && !client.niNumber) {
      throw new BadRequestException("Client does not have a National Insurance number");
    }
    return { ...client, nino: client.nino ?? client.niNumber };
  }

  private async requireBusiness(clientId: string, businessId: string) {
    const business = await this.prisma.business.findFirst({ where: { id: businessId, clientId } });
    if (!business) {
      throw new BadRequestException("Business does not belong to this client");
    }
    return business;
  }
}
