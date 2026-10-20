import { BadRequestException, Injectable } from "@nestjs/common";
import { ObligationStatus } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { ClientsService } from "../clients/clients.service";
import { AuthUser } from "../common/types";
import { HmrcClientService } from "../hmrc/client/hmrc-client.service";
import { VatObligationDto, VatPaymentDto, VatReturnBoxes, VatSubmitResult } from "../hmrc/hmrc.types";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { TasksService } from "../tasks/tasks.service";
import { WebhooksService } from "../webhooks/webhooks.service";
import { PreviewVatReturnDto, SubmitVatReturnDto, ValidateVatReturnDto } from "./dto/vat.dto";
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
import { presentStoredReturn, toIsoDate } from "./vat.presenter";
import { ReceiptsService } from "../receipts/receipts.service";
import { VatRepository } from "./vat.repository";
import {
  toVatReturnView,
  validateVatReturn,
  VatObligationPeriod,
  VatReturnView,
  VatValidationResult,
} from "./vat-return.validator";

@Injectable()
export class VatService {
  constructor(
    private readonly hmrc: HmrcClientService,
    private readonly clients: ClientsService,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly tasks: TasksService,
    private readonly notifications: NotificationsService,
    private readonly webhooks: WebhooksService,
    private readonly repo: VatRepository,
    private readonly receipts: ReceiptsService,
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
    const client = await this.clients.get(user, clientId);
    const rolled = await this.rollUpFromLedger(clientId, dto.periodStart, dto.periodEnd, dto.periodKey);
    const validation = await this.validateTotals(rolled.totals, rolled.transactionCount, dto.region ?? client.vatRegion, {
      periodKey: dto.periodKey,
      periodStart: dto.periodStart,
      periodEnd: dto.periodEnd,
    }, clientId);
    return {
      ...rolled,
      periodKey: dto.periodKey,
      vatReturn: toVatReturnView(rolled.totals),
      validation,
    };
  }

  async validateReturn(user: AuthUser, clientId: string, dto: ValidateVatReturnDto) {
    const client = await this.clients.get(user, clientId);
    const resolved = await this.resolveReturnForValidation(clientId, dto);
    const validation = await this.validateTotals(
      resolved.view,
      resolved.transactionCount,
      dto.region ?? client.vatRegion,
      {
        periodKey: dto.periodKey,
        periodStart: resolved.periodStart ?? dto.periodStart,
        periodEnd: resolved.periodEnd ?? dto.periodEnd,
      },
      clientId,
    );
    const proof = await this.receipts.evidenceForClient(clientId);
    return {
      vatReturn: resolved.view,
      totals: resolved.totals,
      validation,
      proof: proof.vat,
    };
  }

  async obligations(user: AuthUser, clientId: string) {
    const client = await this.requireVatClient(user, clientId);
    const result = await this.hmrc.get<{ obligations: VatObligationDto[] }>(
      `/organisations/vat/${client.vatRegistrationNumber}/obligations`,
      client.id,
    );
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
    const rows = await this.repo.listReturns(clientId);
    return rows.map((row) => presentStoredReturn(row));
  }

  async createDraft(user: AuthUser, clientId: string, dto: SubmitVatReturnDto) {
    const client = await this.requireVatClient(user, clientId);
    const resolved = await this.resolveReturnForValidation(client.id, { ...dto, fromLedger: dto.fromLedger ?? true });
    const totals = finaliseVatBoxes(resolved.input);
    const obligation = await this.prisma.vatObligation.findUnique({
      where: { clientId_periodKey: { clientId: client.id, periodKey: dto.periodKey } },
    });
    const saved = await this.prisma.vatReturn.create({
      data: {
        clientId: client.id,
        obligationId: dto.obligationId ?? obligation?.id,
        periodStart: resolved.periodStart ? new Date(resolved.periodStart) : obligation?.start,
        periodEnd: resolved.periodEnd ? new Date(resolved.periodEnd) : obligation?.end,
        periodKey: dto.periodKey,
        ...totals,
        finalised: false,
        status: "DRAFT",
      },
    });
    await this.audit.record({
      actor: user,
      clientId: client.id,
      actionType: "vat.return.drafted",
      resourceType: "vat_return",
      resourceId: saved.id,
      afterData: { periodKey: saved.periodKey, status: saved.status, netVatDue: String(saved.netVatDue) },
      metadata: { periodKey: dto.periodKey, vatReturnId: saved.id, sandbox: true },
    });
    return presentStoredReturn(saved);
  }

  async listSummaries(user: AuthUser, clientId: string) {
    await this.clients.get(user, clientId);
    return this.repo.listSummaries(clientId);
  }

  async fetchHmrcReturn(user: AuthUser, clientId: string, periodKey: string) {
    const client = await this.requireVatClient(user, clientId);
    const result = await this.hmrc.get<VatReturnBoxes>(
      `/organisations/vat/${client.vatRegistrationNumber}/returns/${encodeURIComponent(periodKey)}`,
      client.id,
    );
    await this.audit.record({
      actor: user,
      clientId: client.id,
      actionType: "vat.return.fetched",
      metadata: { correlationId: result.correlationId, periodKey },
    });
    return {
      source: "hmrc",
      correlationId: result.correlationId,
      ...presentStoredReturn(result.data),
    };
  }

  async submit(user: AuthUser, clientId: string, dto: SubmitVatReturnDto) {
    if (!dto.finalised) {
      throw new BadRequestException("HMRC requires the VAT return to be finalised before submission");
    }
    const client = await this.requireVatClient(user, clientId);
    const resolved = await this.resolveReturnForValidation(client.id, dto);
    const validation = await this.validateTotals(
      resolved.view,
      resolved.transactionCount,
      dto.region ?? client.vatRegion,
      {
        periodKey: dto.periodKey,
        periodStart: resolved.periodStart ?? dto.periodStart,
        periodEnd: resolved.periodEnd ?? dto.periodEnd,
      },
      client.id,
    );
    this.assertValid(validation);
    const totals = finaliseVatBoxes(resolved.input);
    const boxes: VatReturnBoxes = {
      periodKey: dto.periodKey,
      ...totals,
      finalised: dto.finalised,
    };
    try {
      const result = await this.hmrc.post<VatSubmitResult>(
        `/organisations/vat/${client.vatRegistrationNumber}/returns`,
        boxes,
        client.id,
      );
      const obligation = await this.prisma.vatObligation.findUnique({
        where: { clientId_periodKey: { clientId: client.id, periodKey: dto.periodKey } },
      });
      const saved = await this.prisma.vatReturn.create({
        data: {
          clientId: client.id,
          obligationId: dto.obligationId ?? obligation?.id,
          periodStart: resolved.periodStart ? new Date(resolved.periodStart) : obligation?.start,
          periodEnd: resolved.periodEnd ? new Date(resolved.periodEnd) : obligation?.end,
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
        resourceType: "vat_return",
        resourceId: saved.id,
        afterData: {
          periodKey: saved.periodKey,
          status: saved.status,
          formBundleNumber: saved.formBundleNumber,
          correlationId: saved.correlationId,
          vatDueSales: String(saved.vatDueSales),
          netVatDue: String(saved.netVatDue),
        },
        metadata: {
          correlationId: result.correlationId,
          periodKey: dto.periodKey,
          vatReturnId: saved.id,
          fromLedger: Boolean(dto.fromLedger),
          warnings: validation.warnings,
          issues: validation.issues,
        },
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
      return presentStoredReturn(saved);
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
    const result = await this.hmrc.get<{ payments: VatPaymentDto[] }>(
      `/organisations/vat/${client.vatRegistrationNumber}/payments`,
      client.id,
    );
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
    return this.repo.listPayments(client.id);
  }

  private async resolveReturnForValidation(clientId: string, dto: SubmitVatReturnDto | ValidateVatReturnDto) {
    if (dto.fromLedger) {
      const [periodStart, periodEnd] = await this.resolveLedgerPeriod(clientId, dto);
      const rolled = await this.rollUpFromLedger(clientId, periodStart, periodEnd, dto.periodKey);
      return {
        view: toVatReturnView(rolled.totals),
        totals: rolled.totals,
        input: rolled.totals,
        transactionCount: rolled.transactionCount,
        periodStart,
        periodEnd,
      };
    }
    const raw = this.readManualBoxes(dto);
    const view: VatReturnView = {
      box1: raw.vatDueSales,
      box2: raw.vatDueAcquisitions,
      box3: dto.totalVatDue ?? dto.box3 ?? raw.vatDueSales + raw.vatDueAcquisitions,
      box4: raw.vatReclaimedCurrPeriod,
      box5: dto.netVatDue ?? dto.box5 ?? raw.vatDueSales + raw.vatDueAcquisitions - raw.vatReclaimedCurrPeriod,
      box6: raw.totalValueSalesExVAT,
      box7: raw.totalValuePurchasesExVAT,
      box8: raw.totalValueGoodsSuppliedExVAT,
      box9: raw.totalAcquisitionsExVAT,
    };
    const [periodStart, periodEnd] = await this.tryResolvePeriod(clientId, dto);
    const transactionCount = await this.repo.countTransactions(clientId, periodStart, periodEnd);
    return { view, totals: raw, input: raw, transactionCount, periodStart, periodEnd };
  }

  private readManualBoxes(dto: SubmitVatReturnDto | ValidateVatReturnDto): VatBoxInput {
    const raw: VatBoxInput = {
      vatDueSales: dto.vatDueSales ?? dto.box1 ?? missing("vatDueSales"),
      vatDueAcquisitions: dto.vatDueAcquisitions ?? dto.box2 ?? missing("vatDueAcquisitions"),
      vatReclaimedCurrPeriod: dto.vatReclaimedCurrPeriod ?? dto.box4 ?? missing("vatReclaimedCurrPeriod"),
      totalValueSalesExVAT: dto.totalValueSalesExVAT ?? dto.box6 ?? missing("totalValueSalesExVAT"),
      totalValuePurchasesExVAT: dto.totalValuePurchasesExVAT ?? dto.box7 ?? missing("totalValuePurchasesExVAT"),
      totalValueGoodsSuppliedExVAT: dto.totalValueGoodsSuppliedExVAT ?? dto.box8 ?? missing("totalValueGoodsSuppliedExVAT"),
      totalAcquisitionsExVAT: dto.totalAcquisitionsExVAT ?? dto.box9 ?? missing("totalAcquisitionsExVAT"),
    };
    return raw;
  }

  private async validateTotals(
    source: VatReturnView | ReturnType<typeof finaliseVatBoxes>,
    transactionCount: number,
    region: string | undefined,
    submitted: { periodKey?: string; periodStart?: string; periodEnd?: string },
    clientId: string,
  ): Promise<VatValidationResult> {
    const view = "box1" in source ? source : toVatReturnView(source);
    const obligation = await this.obligationPeriod(clientId, submitted.periodKey);
    return validateVatReturn(
      view,
      { transactionCount },
      { region: region === "NI" ? "NI" : "GB" },
      { obligation, submitted },
    );
  }

  private async obligationPeriod(clientId: string, periodKey?: string): Promise<VatObligationPeriod | null> {
    if (!periodKey) {
      return null;
    }
    const obligation = await this.repo.findObligation(clientId, periodKey);
    if (!obligation?.start || !obligation?.end) {
      return null;
    }
    return {
      periodKey: obligation.periodKey,
      start: toIsoDate(obligation.start),
      end: toIsoDate(obligation.end),
    };
  }

  private assertValid(validation: VatValidationResult) {
    if (validation.errors.length === 0) {
      return;
    }
    throw new BadRequestException({
      message: "VAT return failed validation",
      errors: validation.errors,
      warnings: validation.warnings,
      issues: validation.issues,
    });
  }

  private async resolveLedgerPeriod(
    clientId: string,
    dto: SubmitVatReturnDto | ValidateVatReturnDto,
  ): Promise<[string, string]> {
    const resolved = await this.tryResolvePeriod(clientId, dto);
    if (resolved[0] && resolved[1]) {
      return [resolved[0], resolved[1]];
    }
    throw new BadRequestException("periodStart and periodEnd are required when fromLedger is true");
  }

  private async tryResolvePeriod(
    clientId: string,
    dto: { periodKey?: string; periodStart?: string; periodEnd?: string },
  ): Promise<[string | undefined, string | undefined]> {
    if (dto.periodStart && dto.periodEnd) {
      return [dto.periodStart, dto.periodEnd];
    }
    if (!dto.periodKey) {
      return [undefined, undefined];
    }
    const obligation = await this.repo.findObligation(clientId, dto.periodKey);
    if (obligation?.start && obligation?.end) {
      return [toIsoDate(obligation.start), toIsoDate(obligation.end)];
    }
    return [undefined, undefined];
  }

  private async rollUpFromLedger(clientId: string, periodStart: string, periodEnd: string, periodKey?: string) {
    const accounts = await this.repo.loadLedgersForPeriod(clientId, periodStart, periodEnd);
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
    const transactionCount = accounts.reduce((count, account) => count + account.transactions.length, 0);
    const view = toVatReturnView(totals);
    await this.repo.upsertSummary(clientId, new Date(periodStart), new Date(periodEnd), {
      periodKey,
      boxes: view,
      transactionCount,
      lines,
      excluded,
    });
    return {
      periodStart,
      periodEnd,
      totals,
      boxes: describeVatBoxes(totals),
      lines,
      excluded,
      transactionCount,
      summary: view,
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

function missing(field: string): never {
  throw new BadRequestException(`${field} is required unless fromLedger is true`);
}
