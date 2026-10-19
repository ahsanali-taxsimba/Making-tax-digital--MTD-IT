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
import { PreviewVatReturnDto, SubmitVatReturnDto } from "./dto/vat.dto";
import {
  applyAmountToVatBoxes,
  decorateAccountWithVat,
  describeVatBoxes,
  emptyVatBoxInput,
  finaliseVatBoxes,
  lookupVatMapping,
  VAT_BOX_FIELD,
  VAT_BOX_MAPPING,
  VAT_LEDGER_ACCOUNTS,
  VatBoxInput,
} from "./vat-box.mapping";

const MANUAL_BOX_FIELDS: Array<keyof VatBoxInput> = [
  "vatDueSales",
  "vatDueAcquisitions",
  "vatReclaimedCurrPeriod",
  "totalValueSalesExVAT",
  "totalValuePurchasesExVAT",
  "totalValueGoodsSuppliedExVAT",
  "totalAcquisitionsExVAT",
];

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

  mapping() {
    return {
      boxes: VAT_BOX_MAPPING,
      fields: VAT_BOX_FIELD,
      ledgerAccounts: VAT_LEDGER_ACCOUNTS,
    };
  }

  async clientMapping(user: AuthUser, clientId: string) {
    const client = await this.clients.get(user, clientId);
    const accounts = await this.prisma.ledger.findMany({
      where: { clientId: client.id },
      orderBy: [{ profile: "asc" }, { code: "asc" }],
    });
    return {
      boxes: VAT_BOX_MAPPING,
      fields: VAT_BOX_FIELD,
      accounts: accounts.map((account) => decorateAccountWithVat(account)),
    };
  }

  async previewReturn(user: AuthUser, clientId: string, dto: PreviewVatReturnDto) {
    await this.clients.get(user, clientId);
    const rolled = await this.rollUpFromLedger(clientId, dto.periodStart, dto.periodEnd);
    return { ...rolled, periodKey: dto.periodKey };
  }

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
    let totals;
    if (dto.fromLedger) {
      const [periodStart, periodEnd] = await this.resolveLedgerPeriod(client.id, dto);
      totals = (await this.rollUpFromLedger(client.id, periodStart, periodEnd)).totals;
    } else {
      totals = this.manualBoxes(dto);
    }
    const boxes: VatReturnBoxes = {
      periodKey: dto.periodKey,
      ...totals,
      finalised: dto.finalised,
    };
    try {
      const ctx = await this.connections.getCallContext(client.id);
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
        metadata: { correlationId: result.correlationId, periodKey: dto.periodKey, fromLedger: Boolean(dto.fromLedger) },
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

  private manualBoxes(dto: SubmitVatReturnDto) {
    for (const field of MANUAL_BOX_FIELDS) {
      if (dto[field] === undefined || dto[field] === null) {
        throw new BadRequestException(`${field} is required unless fromLedger is true`);
      }
    }
    return finaliseVatBoxes({
      vatDueSales: dto.vatDueSales!,
      vatDueAcquisitions: dto.vatDueAcquisitions!,
      vatReclaimedCurrPeriod: dto.vatReclaimedCurrPeriod!,
      totalValueSalesExVAT: dto.totalValueSalesExVAT!,
      totalValuePurchasesExVAT: dto.totalValuePurchasesExVAT!,
      totalValueGoodsSuppliedExVAT: dto.totalValueGoodsSuppliedExVAT!,
      totalAcquisitionsExVAT: dto.totalAcquisitionsExVAT!,
    });
  }

  private async resolveLedgerPeriod(clientId: string, dto: SubmitVatReturnDto): Promise<[string, string]> {
    if (dto.periodStart && dto.periodEnd) {
      return [dto.periodStart, dto.periodEnd];
    }
    const obligation = await this.prisma.vatObligation.findUnique({
      where: { clientId_periodKey: { clientId, periodKey: dto.periodKey } },
    });
    if (obligation) {
      return [toIsoDate(obligation.start), toIsoDate(obligation.end)];
    }
    throw new BadRequestException("periodStart and periodEnd are required when fromLedger is true");
  }

  private async rollUpFromLedger(clientId: string, periodStart: string, periodEnd: string) {
    const start = new Date(periodStart);
    const end = new Date(periodEnd);
    const accounts = await this.prisma.ledger.findMany({
      where: { clientId },
      include: {
        transactions: { where: { date: { gte: start, lte: end } } },
      },
      orderBy: [{ profile: "asc" }, { code: "asc" }],
    });
    const input = emptyVatBoxInput();
    const lines: Array<{
      code: number;
      name: string;
      profile: string;
      amount: number;
      sources: string[];
      boxes: string[];
    }> = [];
    const excluded: Array<{ code: number; name: string; profile: string; amount: number; reason: string }> = [];

    for (const account of accounts) {
      const amount = account.transactions.reduce((sum, txn) => sum + Number(txn.amount), 0);
      if (amount === 0) {
        continue;
      }
      const mapping = lookupVatMapping(account.profile, account.code);
      if (!mapping) {
        excluded.push({
          code: account.code,
          name: account.name,
          profile: account.profile,
          amount,
          reason: "unmapped",
        });
        continue;
      }
      applyAmountToVatBoxes(input, amount, mapping.boxes);
      lines.push({
        code: account.code,
        name: account.name,
        profile: account.profile,
        amount: Number(amount.toFixed(2)),
        sources: mapping.sources,
        boxes: mapping.boxes,
      });
    }

    const totals = finaliseVatBoxes(input);
    return {
      periodStart,
      periodEnd,
      totals,
      boxes: describeVatBoxes(totals),
      lines,
      excluded,
    };
  }

  private async requireVatClient(user: AuthUser, clientId: string) {
    const client = await this.clients.get(user, clientId);
    if (!client.vatRegistrationNumber) {
      throw new BadRequestException("Client does not have a VAT registration number");
    }
    return client;
  }
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}
