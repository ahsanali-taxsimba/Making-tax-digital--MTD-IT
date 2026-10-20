import { BadRequestException, Injectable } from "@nestjs/common";
import { ObligationStatus } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { ClientsService } from "../clients/clients.service";
import { AuthUser } from "../common/types";
import { HmrcClientService } from "../hmrc/client/hmrc-client.service";
import { ItsaObligationDto } from "../hmrc/hmrc.types";
import { NotificationsService } from "../notifications/notifications.service";
import { TasksService } from "../tasks/tasks.service";
import { WebhooksService } from "../webhooks/webhooks.service";
import {
  CreateBusinessDto,
  PreviewItsaUpdateDto,
  SubmitEopsDto,
  SubmitFinalDeclarationDto,
  SubmitItsaUpdateDto,
  ValidateItsaDto,
} from "./dto/itsa.dto";
import {
  validateItsaEops,
  validateItsaFinalDeclaration,
  validateItsaQuarterlyUpdate,
  validateItsaYear,
  ItsaValidationResult,
} from "./itsa-return.validator";
import { ItsaRepository } from "./itsa.repository";
import { chartProfileForBusinessType, lookupItsaMapping, MTD_ITSA_MAPPING } from "./mtd-itsa.mapping";

@Injectable()
export class ItsaService {
  constructor(
    private readonly hmrc: HmrcClientService,
    private readonly clients: ClientsService,
    private readonly repo: ItsaRepository,
    private readonly audit: AuditService,
    private readonly tasks: TasksService,
    private readonly notifications: NotificationsService,
    private readonly webhooks: WebhooksService,
  ) {}

  mapping() {
    return {
      buckets: MTD_ITSA_MAPPING,
      rules: {
        quarterlyExcludes: ["capital_items", "business_expenses_disallowable"],
        propertyUsesSa105: true,
      },
    };
  }

  async clientMapping(user: AuthUser, clientId: string) {
    const client = await this.requireItsaClient(user, clientId);
    const accounts = await this.repo.listLedgers(client.id);
    const persisted = await this.repo.listMappings();
    return {
      mapping: MTD_ITSA_MAPPING,
      catalog: persisted,
      accounts: accounts.map((account) => ({
        ...account,
        itsa: lookupItsaMapping(account.profile, account.code) ?? null,
      })),
    };
  }

  async listBusinesses(user: AuthUser, clientId: string) {
    await this.requireItsaClient(user, clientId);
    return this.repo.listBusinesses(clientId);
  }

  async obligations(user: AuthUser, clientId: string) {
    const client = await this.requireItsaClient(user, clientId);
    const result = await this.hmrc.get<{ obligations: ItsaObligationDto[] }>(
      `/income-tax/${client.nino}/obligations`,
      client.id,
    );
    for (const item of result.data.obligations) {
      const business = item.businessId ? await this.repo.findBusinessByHmrcId(client.id, item.businessId) : null;
      const existing = await this.repo.findObligation(client.id, item.type, item.taxYear, item.periodId, business?.id);
      const data = {
        start: new Date(item.start),
        end: new Date(item.end),
        due: new Date(item.due),
        status: item.status === "Fulfilled" ? ObligationStatus.FULFILLED : ObligationStatus.OPEN,
        received: item.received ? new Date(item.received) : null,
        correlationId: result.correlationId,
        rawPayload: { ...item },
        businessId: business?.id,
      };
      if (existing) {
        await this.repo.updateObligation(existing.id, data);
      } else {
        await this.repo.upsertObligation({
          clientId: client.id,
          type: item.type,
          taxYear: item.taxYear,
          periodId: item.periodId,
          ...data,
        });
      }
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
    return this.repo.listObligations(client.id);
  }

  async previewUpdate(user: AuthUser, clientId: string, dto: PreviewItsaUpdateDto) {
    await this.requireItsaClient(user, clientId);
    const business = await this.requireBusiness(clientId, dto.businessId);
    const rolled = await this.rollUpFromLedger(clientId, business.type, dto.periodStart, dto.periodEnd);
    const validation = await this.validateQuarterly(clientId, business.id, business.type, {
      ...dto,
      incomes: rolled.incomes,
      expenses: rolled.expenses,
    }, rolled.transactionCount);
    return { ...rolled, validation };
  }

  async validate(user: AuthUser, clientId: string, dto: ValidateItsaDto) {
    await this.requireItsaClient(user, clientId);
    const kind = dto.kind ?? "quarterly";
    if (kind === "eops") {
      return this.validateEops(clientId, dto);
    }
    if (kind === "final" || kind === "year") {
      return this.validateYear(clientId, dto, kind);
    }
    const business = await this.requireBusiness(clientId, dto.businessId ?? "");
    const rolled = dto.fromLedger !== false
      ? await this.rollUpFromLedger(clientId, business.type, dto.periodStart!, dto.periodEnd!)
      : null;
    const incomes = rolled?.incomes ?? dto.incomes ?? {};
    const expenses = rolled?.expenses ?? dto.expenses ?? {};
    const transactionCount = rolled?.transactionCount ?? 0;
    const validation = await this.validateQuarterly(
      clientId,
      business.id,
      business.type,
      { ...dto, incomes, expenses },
      transactionCount,
    );
    return { kind: "quarterly", incomes, expenses, excluded: rolled?.excluded ?? [], validation };
  }

  async listUpdates(user: AuthUser, clientId: string) {
    await this.requireItsaClient(user, clientId);
    return this.repo.listUpdates(clientId);
  }

  async listEops(user: AuthUser, clientId: string, taxYear?: string) {
    await this.requireItsaClient(user, clientId);
    return this.repo.listEops(clientId, taxYear);
  }

  async listFinals(user: AuthUser, clientId: string, taxYear?: string) {
    await this.requireItsaClient(user, clientId);
    return this.repo.listFinals(clientId, taxYear);
  }

  async submitUpdate(user: AuthUser, clientId: string, dto: SubmitItsaUpdateDto) {
    const client = await this.requireItsaClient(user, clientId);
    const business = await this.requireBusiness(client.id, dto.businessId);
    const rolled = dto.fromLedger
      ? await this.rollUpFromLedger(client.id, business.type, dto.periodStart, dto.periodEnd)
      : null;
    const incomes = rolled?.incomes ?? dto.incomes;
    const expenses = rolled?.expenses ?? dto.expenses;
    if (!incomes || !expenses) {
      throw new BadRequestException("incomes and expenses are required unless fromLedger is true");
    }
    const validation = await this.validateQuarterly(
      client.id,
      business.id,
      business.type,
      { ...dto, incomes, expenses },
      rolled?.transactionCount ?? 0,
    );
    this.assertValid(validation);
    const result = await this.hmrc.post<{ periodId: string }>(
      `/income-tax/${client.nino}/updates`,
      {
        businessId: business.hmrcBusinessId ?? business.id,
        taxYear: dto.taxYear,
        periodId: dto.periodId,
        periodStart: dto.periodStart,
        periodEnd: dto.periodEnd,
        incomes,
        expenses,
      },
      client.id,
    );
    const saved = await this.repo.createUpdate({
      clientId: client.id,
      businessId: business.id,
      taxYear: dto.taxYear,
      periodId: dto.periodId,
      periodStart: new Date(dto.periodStart),
      periodEnd: new Date(dto.periodEnd),
      incomes,
      expenses,
      status: "SUBMITTED",
      hmrcPeriodId: result.data.periodId,
      correlationId: result.correlationId,
      rawPayload: result.data,
    });
    await this.tasks.complete(client.firmId, client.id, "MTD_ITSA_UPDATE");
    await this.audit.record({
      actor: user,
      clientId: client.id,
      actionType: "itsa.update.submitted",
      metadata: { correlationId: result.correlationId, businessId: business.id, issues: validation.issues },
    });
    await this.webhooks.emit(client.firmId, "ITSA_UPDATE_SUBMITTED", {
      clientId: client.id,
      taxYear: dto.taxYear,
      periodId: dto.periodId,
    });
    return { ...saved, validation };
  }

  async submitEops(user: AuthUser, clientId: string, dto: SubmitEopsDto) {
    if (!dto.finalised) {
      throw new BadRequestException("EOPS must be finalised before submission");
    }
    const client = await this.requireItsaClient(user, clientId);
    const business = await this.requireBusiness(client.id, dto.businessId);
    const updates = await this.repo.listUpdates(client.id, { businessId: business.id, taxYear: dto.taxYear });
    const validation = validateItsaEops({
      businessId: business.id,
      taxYear: dto.taxYear,
      quarterlyUpdateCount: updates.length,
    });
    this.assertValid(validation);
    const result = await this.hmrc.post<{ processingDate: string }>(
      `/income-tax/${client.nino}/eops`,
      {
        businessId: business.hmrcBusinessId ?? business.id,
        taxYear: dto.taxYear,
        typeOfBusiness: dto.typeOfBusiness,
        accountingPeriodStart: dto.accountingPeriodStart,
        accountingPeriodEnd: dto.accountingPeriodEnd,
        finalised: dto.finalised,
      },
      client.id,
    );
    const saved = await this.repo.createEops({
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
    });
    await this.tasks.complete(client.firmId, client.id, "MTD_ITSA_EOPS");
    await this.audit.record({
      actor: user,
      clientId: client.id,
      actionType: "itsa.eops.submitted",
      metadata: { correlationId: result.correlationId, issues: validation.issues },
    });
    return { ...saved, validation };
  }

  async submitFinal(user: AuthUser, clientId: string, dto: SubmitFinalDeclarationDto) {
    if (!dto.finalised) {
      throw new BadRequestException("Final declaration must be finalised");
    }
    const client = await this.requireItsaClient(user, clientId);
    const validation = await this.finalValidation(client.id, dto.taxYear);
    this.assertValid(validation);
    const result = await this.hmrc.post<{ calculationId: string }>(
      `/income-tax/${client.nino}/final-declaration`,
      dto,
      client.id,
    );
    const saved = await this.repo.createFinal({
      clientId: client.id,
      taxYear: dto.taxYear,
      calculationId: result.data.calculationId,
      finalised: dto.finalised,
      status: "SUBMITTED",
      correlationId: result.correlationId,
      rawPayload: result.data,
    });
    await this.tasks.complete(client.firmId, client.id, "MTD_ITSA_FINAL_DECLARATION");
    await this.audit.record({
      actor: user,
      clientId: client.id,
      actionType: "itsa.final_declaration.submitted",
      metadata: { correlationId: result.correlationId, taxYear: dto.taxYear, issues: validation.issues },
    });
    return { ...saved, validation };
  }

  async addBusiness(user: AuthUser, clientId: string, dto: CreateBusinessDto) {
    const client = await this.requireItsaClient(user, clientId);
    return this.repo.createBusiness({
      clientId: client.id,
      type: dto.type,
      tradingName: dto.tradingName,
      hmrcBusinessId: dto.hmrcBusinessId,
    });
  }

  private async validateQuarterly(
    clientId: string,
    businessId: string,
    businessType: string,
    dto: { taxYear?: string; periodId?: string; periodStart?: string; periodEnd?: string; incomes?: Record<string, number>; expenses?: Record<string, number> },
    transactionCount: number,
  ): Promise<ItsaValidationResult> {
    const profile = chartProfileForBusinessType(businessType);
    const obligation = dto.taxYear
      ? await this.repo.findObligation(clientId, "QUARTERLY_UPDATE", dto.taxYear, dto.periodId, businessId)
      : dto.periodId
        ? await this.repo.findObligation(clientId, "QUARTERLY_UPDATE", dto.taxYear ?? "", dto.periodId, businessId)
        : null;
    return validateItsaQuarterlyUpdate(
      {
        incomes: dto.incomes ?? {},
        expenses: dto.expenses ?? {},
        transactionCount,
      },
      profile,
      {
        obligation: obligation
          ? { periodId: obligation.periodId, start: toIsoDate(obligation.start), end: toIsoDate(obligation.end) }
          : null,
        submitted: { periodId: dto.periodId, periodStart: dto.periodStart, periodEnd: dto.periodEnd },
      },
    );
  }

  private async validateEops(clientId: string, dto: ValidateItsaDto) {
    const business = await this.requireBusiness(clientId, dto.businessId ?? "");
    const taxYear = dto.taxYear ?? "";
    const updates = await this.repo.listUpdates(clientId, { businessId: business.id, taxYear });
    return {
      kind: "eops",
      businessId: business.id,
      taxYear,
      quarterlyUpdateCount: updates.length,
      validation: validateItsaEops({ businessId: business.id, taxYear, quarterlyUpdateCount: updates.length }),
    };
  }

  private async validateYear(clientId: string, dto: ValidateItsaDto, kind: "final" | "year") {
    const taxYear = dto.taxYear ?? "";
    const validation = await this.finalValidation(clientId, taxYear, kind === "year");
    return { kind, taxYear, validation };
  }

  private async finalValidation(clientId: string, taxYear: string, includeMissingFinal = false) {
    const businesses = await this.repo.listBusinesses(clientId);
    const eops = await this.repo.listEops(clientId, taxYear);
    const eopsBusinessIds = eops.map((item) => item.businessId).filter((id): id is string => Boolean(id));
    if (includeMissingFinal) {
      const finals = await this.repo.listFinals(clientId, taxYear);
      return validateItsaYear({
        taxYear,
        businesses,
        eopsBusinessIds,
        hasFinalDeclaration: finals.length > 0,
      });
    }
    return validateItsaFinalDeclaration({ taxYear, businesses, eopsBusinessIds });
  }

  private async rollUpFromLedger(clientId: string, businessType: string, periodStart: string, periodEnd: string) {
    const profile = chartProfileForBusinessType(businessType);
    const accounts = await this.repo.loadLedgersForPeriod(clientId, profile, periodStart, periodEnd);
    const incomes: Record<string, number> = {};
    const expenses: Record<string, number> = {};
    const excluded: Array<{ code: number; category: string; amount: number; reason: string }> = [];
    const lines: Array<{ code: number; name: string; amount: number; category: string; hmrcKey: string }> = [];

    for (const account of accounts) {
      const amount = account.transactions.reduce((sum, txn) => sum + Number(txn.amount), 0);
      if (amount === 0) {
        continue;
      }
      const mapping = lookupItsaMapping(account.profile, account.code);
      if (!mapping) {
        excluded.push({ code: account.code, category: account.name, amount, reason: "unmapped" });
        continue;
      }
      if (!mapping.includedInQuarterlyUpdate) {
        excluded.push({
          code: account.code,
          category: mapping.category,
          amount,
          reason: mapping.bucket === "capital_items" ? "capital_not_in_quarterly_update" : "disallowable",
        });
        continue;
      }
      const target = mapping.bucket.endsWith("income") ? incomes : expenses;
      target[mapping.hmrcKey] = Number(((target[mapping.hmrcKey] ?? 0) + amount).toFixed(2));
      lines.push({
        code: account.code,
        name: account.name,
        amount,
        category: mapping.category,
        hmrcKey: mapping.hmrcKey,
      });
    }

    const transactionCount = await this.repo.countTransactions(clientId, profile, periodStart, periodEnd);
    return { profile, incomes, expenses, excluded, lines, transactionCount };
  }

  private assertValid(validation: ItsaValidationResult) {
    if (validation.errors.length === 0) {
      return;
    }
    throw new BadRequestException({
      message: "ITSA submission failed validation",
      errors: validation.errors,
      warnings: validation.warnings,
      issues: validation.issues,
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
    if (!businessId) {
      throw new BadRequestException("businessId is required");
    }
    const business = await this.repo.findBusiness(clientId, businessId);
    if (!business) {
      throw new BadRequestException("Business does not belong to this client");
    }
    return business;
  }
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}
