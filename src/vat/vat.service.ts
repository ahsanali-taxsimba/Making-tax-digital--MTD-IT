import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { ObligationStatus } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { ClientsService } from "../clients/clients.service";
import { AuthUser } from "../common/types";
import { MtdConnectionService } from "../hmrc/mtd-connection.service";
import { HMRC_VAT } from "../hmrc/hmrc.tokens";
import { HmrcVatGateway, VatReturnBoxes } from "../hmrc/hmrc.types";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { TasksService } from "../tasks/tasks.service";
import { WebhooksService } from "../webhooks/webhooks.service";
import { SubmitVatReturnDto } from "./dto/vat.dto";

@Injectable()
export class VatService {
  constructor(
    @Inject(HMRC_VAT) private readonly vat: HmrcVatGateway,
    private readonly connections: MtdConnectionService,
    private readonly clients: ClientsService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly tasks: TasksService,
    private readonly notifications: NotificationsService,
    private readonly webhooks: WebhooksService,
  ) {}

  async obligations(user: AuthUser, clientId: string) {
    const client = await this.requireVatClient(user, clientId);
    const ctx = await this.connections.getCallContext(client.id);
    const result = await this.vat.getObligations(ctx, client.vatRegistrationNumber!);
    for (const item of result.data.obligations) {
      const saved = await this.prisma.vatObligation.upsert({
        where: { clientId_periodKey: { clientId: client.id, periodKey: item.periodKey } },
        update: {
          start: new Date(item.start),
          end: new Date(item.end),
          due: new Date(item.due),
          status: item.status === "F" ? ObligationStatus.FULFILLED : ObligationStatus.OPEN,
          received: item.received ? new Date(item.received) : null,
          correlationId: result.correlationId,
          rawPayload: { ...item },
        },
        create: {
          clientId: client.id,
          periodKey: item.periodKey,
          start: new Date(item.start),
          end: new Date(item.end),
          due: new Date(item.due),
          status: item.status === "F" ? ObligationStatus.FULFILLED : ObligationStatus.OPEN,
          received: item.received ? new Date(item.received) : null,
          correlationId: result.correlationId,
          rawPayload: { ...item },
        },
      });
      if (saved.status === ObligationStatus.OPEN) {
        await this.tasks.ensure(client.firmId, client.id, "MTD_VAT_RETURN", saved.due, `VAT return ${saved.periodKey}`);
      }
    }
    await this.audit.record({
      actor: user,
      clientId: client.id,
      actionType: "vat.obligations.fetched",
      metadata: { correlationId: result.correlationId, count: result.data.obligations.length },
    });
    await this.notifications.notify({
      firmId: client.firmId,
      type: "OBLIGATION_FETCHED",
      title: "VAT obligations refreshed",
      body: `${result.data.obligations.length} VAT obligation(s) synced for ${client.name}.`,
      metadata: { clientId: client.id },
    });
    return this.prisma.vatObligation.findMany({ where: { clientId: client.id }, orderBy: { start: "desc" } });
  }

  async listReturns(user: AuthUser, clientId: string) {
    await this.requireVatClient(user, clientId);
    return this.prisma.vatReturn.findMany({ where: { clientId }, orderBy: { createdAt: "desc" } });
  }

  async submit(user: AuthUser, clientId: string, dto: SubmitVatReturnDto) {
    if (!dto.finalised) {
      throw new BadRequestException("HMRC requires the VAT return to be finalised before submission");
    }
    const client = await this.requireVatClient(user, clientId);
    const ctx = await this.connections.getCallContext(client.id);
    const boxes: VatReturnBoxes = {
      periodKey: dto.periodKey,
      vatDueSales: dto.vatDueSales,
      vatDueAcquisitions: dto.vatDueAcquisitions,
      totalVatDue: dto.totalVatDue,
      vatReclaimedCurrPeriod: dto.vatReclaimedCurrPeriod,
      netVatDue: dto.netVatDue,
      totalValueSalesExVAT: dto.totalValueSalesExVAT,
      totalValuePurchasesExVAT: dto.totalValuePurchasesExVAT,
      totalValueGoodsSuppliedExVAT: dto.totalValueGoodsSuppliedExVAT,
      totalAcquisitionsExVAT: dto.totalAcquisitionsExVAT,
      finalised: dto.finalised,
    };
    try {
      const result = await this.vat.submitReturn(ctx, client.vatRegistrationNumber!, boxes);
      const obligation = await this.prisma.vatObligation.findUnique({
        where: { clientId_periodKey: { clientId: client.id, periodKey: dto.periodKey } },
      });
      const saved = await this.prisma.vatReturn.create({
        data: {
          clientId: client.id,
          obligationId: dto.obligationId ?? obligation?.id,
          ...boxes,
          status: "SUBMITTED",
          formBundleNumber: result.data.formBundleNumber,
          chargeRefNumber: result.data.chargeRefNumber,
          processingDate: new Date(result.data.processingDate),
          correlationId: result.correlationId,
          rawPayload: { ...result.data },
        },
      });
      if (obligation) {
        await this.prisma.vatObligation.update({
          where: { id: obligation.id },
          data: { status: ObligationStatus.FULFILLED, received: new Date() },
        });
        await this.tasks.complete(client.firmId, client.id, "MTD_VAT_RETURN");
      }
      await this.audit.record({
        actor: user,
        clientId: client.id,
        actionType: "vat.return.submitted",
        metadata: { correlationId: result.correlationId, periodKey: dto.periodKey },
      });
      await this.webhooks.emit(client.firmId, "VAT_RETURN_SUBMITTED", {
        clientId: client.id,
        periodKey: dto.periodKey,
        formBundleNumber: saved.formBundleNumber,
      });
      await this.notifications.notify({
        firmId: client.firmId,
        type: "SUBMISSION_SUCCEEDED",
        title: "VAT return submitted",
        body: `VAT return ${dto.periodKey} was accepted for ${client.name}.`,
        metadata: { clientId: client.id },
      });
      return saved;
    } catch (error) {
      await this.notifications.notify({
        firmId: client.firmId,
        type: "SUBMISSION_FAILED",
        title: "VAT return failed",
        body: `VAT return ${dto.periodKey} failed for ${client.name}.`,
        metadata: { clientId: client.id },
      });
      await this.audit.record({
        actor: user,
        clientId: client.id,
        actionType: "vat.return.failed",
        metadata: { periodKey: dto.periodKey, message: error instanceof Error ? error.message : "unknown" },
      });
      throw error;
    }
  }

  async payments(user: AuthUser, clientId: string) {
    const client = await this.requireVatClient(user, clientId);
    const ctx = await this.connections.getCallContext(client.id);
    const result = await this.vat.getPayments(ctx, client.vatRegistrationNumber!);
    await this.prisma.vatPayment.deleteMany({ where: { clientId: client.id } });
    await this.prisma.vatPayment.createMany({
      data: result.data.payments.map((payment) => ({
        clientId: client.id,
        amount: payment.amount,
        received: new Date(payment.received),
        correlationId: result.correlationId,
        rawPayload: { ...payment },
      })),
    });
    await this.audit.record({
      actor: user,
      clientId: client.id,
      actionType: "vat.payments.fetched",
      metadata: { correlationId: result.correlationId },
    });
    return this.prisma.vatPayment.findMany({ where: { clientId: client.id }, orderBy: { received: "desc" } });
  }

  private async requireVatClient(user: AuthUser, clientId: string) {
    const client = await this.clients.get(user, clientId);
    if (!client.vatRegistrationNumber) {
      throw new BadRequestException("Client does not have a VAT registration number");
    }
    return client;
  }
}
