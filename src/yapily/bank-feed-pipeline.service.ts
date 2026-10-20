import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AuditService } from "../audit/audit.service";
import { BankService } from "../bookkeeping/bank.service";
import { BookkeepingRepository } from "../bookkeeping/bookkeeping.repository";
import { ReportsService } from "../bookkeeping/reports.service";
import { CategorisationService } from "../categorisation/categorisation.service";
import { AuthUser } from "../common/types";
import { MatchingService } from "../matching/matching.service";
import { YapilyTransactionSyncDto } from "./dto/yapily.dto";
import { YapilyRepository } from "./yapily.repository";
import { YapilyService } from "./yapily.service";

export const PIPELINE_MATCH_APPLY = 0.8;
export const PIPELINE_CATEGORISE_APPLY = 0.85;

@Injectable()
export class BankFeedPipelineService {
  constructor(
    private readonly yapily: YapilyService,
    private readonly repo: YapilyRepository,
    private readonly books: BookkeepingRepository,
    private readonly categorisation: CategorisationService,
    private readonly matching: MatchingService,
    private readonly bank: BankService,
    private readonly reports: ReportsService,
    private readonly audit: AuditService,
  ) {}

  async run(user: AuthUser, dto: YapilyTransactionSyncDto) {
    const clientId = await this.resolveClientId(user, dto);
    const from = dto.from;
    const to = dto.to;
    const autoCategorise = dto.autoCategorise !== false;
    const autoMatch = dto.autoMatch !== false;
    const autoPost = Boolean(dto.autoPost);

    const consent = await this.yapily.status(user, clientId);
    const accounts = await this.yapily.syncAccounts(user, clientId);
    const targets = dto.bankAccountId ? accounts.filter((row) => row.id === dto.bankAccountId) : accounts;
    if (dto.bankAccountId && targets.length === 0) {
      throw new NotFoundException("Bank account was not in the Yapily sync set");
    }

    const synced = [];
    let enriched = 0;
    for (const account of targets) {
      const balance = await this.yapily.syncBalance(user, account.id);
      const feed = await this.yapily.syncTransactions(user, account.id, { from, to });
      enriched += feed.transactions.filter((row) => row.enrichment).length;
      synced.push({
        account: feed.account,
        balance,
        transactions: feed.transactions,
        journalSuggestions: feed.suggestions,
      });
    }

    const matching = autoMatch
      ? await this.matching.suggestions(user, {
          clientId,
          bankAccountId: dto.bankAccountId,
          persist: true,
        })
      : { suggestions: [], count: 0 };

    const appliedMatches = [];
    if (autoPost) {
      for (const suggestion of matching.suggestions) {
        if (!suggestion.id || suggestion.status !== "SUGGESTED" || suggestion.confidence < PIPELINE_MATCH_APPLY) {
          continue;
        }
        appliedMatches.push(await this.matching.apply(user, { suggestionId: suggestion.id }));
      }
    }

    const categorisation = autoCategorise
      ? await this.categorisation.suggest(user, {
          clientId,
          bankAccountId: dto.bankAccountId,
          persist: true,
        })
      : { suggestions: [], count: 0 };

    const appliedCategories = [];
    if (autoPost) {
      for (const suggestion of categorisation.suggestions) {
        if (!suggestion.id || suggestion.status !== "SUGGESTED" || suggestion.confidence < PIPELINE_CATEGORISE_APPLY) {
          continue;
        }
        appliedCategories.push(await this.categorisation.apply(user, { suggestionId: suggestion.id }));
      }
    }

    const periodStart = from ?? "2026-01-01";
    const periodEnd = to ?? "2026-12-31";
    const reconciliation = [];
    for (const account of targets) {
      const session = await this.books.createReconciliation({
        bankAccount: { connect: { id: account.id } },
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        createdByUserId: user.id,
      });
      const summary = await this.bank.summary(user, {
        bankAccountId: account.id,
        periodStart,
        periodEnd,
      });
      reconciliation.push({ sessionId: session.id, ...summary });
    }

    const vat = await this.reports.vatSummary(user, { clientId, periodStart, periodEnd });
    const itsa = await this.reports.itsaSummary(user, { clientId, periodStart, periodEnd });
    const journalsPosted = appliedMatches.length + appliedCategories.length;

    await this.audit.record({
      actor: user,
      clientId,
      actionType: "yapily.pipeline.ran",
      metadata: {
        accounts: targets.length,
        transactions: synced.reduce((total, row) => total + row.transactions.length, 0),
        matching: matching.count,
        categorisation: categorisation.count,
        appliedMatches: appliedMatches.length,
        appliedCategories: appliedCategories.length,
        autoPost,
      },
    });

    const primary = synced[0];
    return {
      clientId,
      steps: [
        "consent",
        "accounts",
        "transactions",
        "enrichment",
        "matching",
        "categorisation",
        "reconciliation",
        "journals",
        "vat_itsa",
      ],
      consent,
      accounts,
      sync: synced,
      enrichment: { enriched },
      matching: {
        suggestions: matching.suggestions,
        count: matching.count,
        applied: appliedMatches.map((row) => row.suggestion),
        journals: appliedMatches.length,
      },
      categorisation: {
        suggestions: categorisation.suggestions,
        count: categorisation.count,
        applied: appliedCategories.map((row) => row.suggestion),
        journals: appliedCategories.length,
      },
      reconciliation,
      journals: { posted: journalsPosted },
      vat: {
        period: vat.period,
        boxes: vat.boxes,
        box1: vat.boxes?.box1,
        box4: vat.boxes?.box4,
        box6: vat.boxes?.box6,
        box7: vat.boxes?.box7,
      },
      itsa: {
        period: itsa.period,
        incomes: itsa.incomes,
        expenses: itsa.expenses,
        quarterly: itsa.quarterly,
      },
      account: primary?.account,
      transactions: primary?.transactions ?? [],
      suggestions: matching.suggestions,
      autoPost: autoPost ? { posted: appliedCategories.length, matched: appliedMatches.length } : undefined,
    };
  }

  async status(user: AuthUser, query: { clientId: string; bankAccountId?: string }) {
    const consent = await this.yapily.status(user, query.clientId);
    const accounts = await this.repo.listClientBankAccounts(query.clientId);
    const scoped = query.bankAccountId ? accounts.filter((row) => row.id === query.bankAccountId) : accounts;
    const reconciliation = [];
    for (const account of scoped) {
      reconciliation.push(
        await this.bank.summary(user, {
          bankAccountId: account.id,
        }),
      );
    }
    return {
      clientId: query.clientId,
      consent,
      accounts: scoped.map((row) => ({
        id: row.id,
        provider: row.provider,
        externalAccountId: row.externalId,
        name: row.name,
        sortCode: row.sortCode,
        accountNumber: row.accountNumber,
        currency: row.currency,
        balance: Number(row.balance),
        providerMetadata: row.providerMetadata ?? null,
      })),
      reconciliation,
    };
  }

  private async resolveClientId(user: AuthUser, dto: YapilyTransactionSyncDto): Promise<string> {
    if (dto.clientId) {
      return dto.clientId;
    }
    if (!dto.bankAccountId) {
      throw new BadRequestException("clientId or bankAccountId is required");
    }
    const account = await this.yapily.getAccount(user, dto.bankAccountId);
    return account.clientId;
  }
}
