import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { BankTxnStatus, ChartProfile, JournalSource, TaxCodeKind } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { BookkeepingRepository } from "../bookkeeping/bookkeeping.repository";
import { LedgerSnapshot, TaxCodeSnapshot, toTaxSnapshot } from "../bookkeeping/domain/journal.rules";
import { JournalService } from "../bookkeeping/journal.service";
import { ClientsService } from "../clients/clients.service";
import { AuthUser } from "../common/types";
import { defaultProfileForClientType } from "../ledger/chart-of-accounts.catalog";
import { CAT_ERR, CategorisationError } from "./categorisation.errors";
import { CategorisationRepository } from "./categorisation.repository";
import { classifyTransaction } from "./domain/classify";
import { Classification, ClassifyInput, MerchantRule, MccRule } from "./domain/types";
import { CategorisationApplyDto, CategorisationSuggestDto } from "./dto/categorisation.dto";
import { ITSAInferenceService } from "./itsa-inference.service";
import { JournalDraftService } from "./journal-draft.service";
import { MCCMappingService } from "./mcc-mapping.service";
import { MerchantDictionaryService } from "./merchant-dictionary.service";
import { VATInferenceService } from "./vat-inference.service";

@Injectable()
export class CategorisationService {
  constructor(
    private readonly repo: CategorisationRepository,
    private readonly clients: ClientsService,
    private readonly books: BookkeepingRepository,
    private readonly journals: JournalService,
    private readonly audit: AuditService,
    private readonly merchants: MerchantDictionaryService,
    private readonly mcc: MCCMappingService,
    private readonly vat: VATInferenceService,
    private readonly itsa: ITSAInferenceService,
    private readonly drafts: JournalDraftService,
  ) {}

  async suggest(user: AuthUser, dto: CategorisationSuggestDto) {
    const persist = dto.persist !== false;
    const merchantRules = await this.merchants.list();
    const mccRules = await this.mcc.list();
    const targets = await this.resolveTargets(user, dto);
    const suggestions = [];
    for (const target of targets) {
      const classified = this.classifyLoaded(target, merchantRules, mccRules);
      const saved = persist
        ? await this.repo.upsertSuggestion({
            bankTransactionId: target.txn.id,
            clientId: target.client.id,
            firmId: target.client.firmId,
            ledgerAccountId: classified.ledgerAccountId,
            ledgerCode: classified.ledgerCode,
            taxCodeId: classified.taxCodeId,
            taxCodeKind: classified.taxCodeKind,
            itsaCategory: classified.itsaCategory,
            itsaBucket: classified.itsaBucket,
            vatBoxes: classified.vatBoxes,
            confidence: classified.confidence,
            reasons: classified.reasons,
            draftJournal: classified.draftJournal as never,
            status: target.txn.categorisation?.status === "APPLIED" ? "APPLIED" : "SUGGESTED",
            appliedJournalEntryId: target.txn.categorisation?.appliedJournalEntryId ?? null,
          })
        : null;
      suggestions.push(this.publicSuggestion(saved?.id ?? target.txn.categorisation?.id ?? null, target.txn.id, target.client.id, classified, saved?.status ?? "SUGGESTED"));
    }
    if (persist && suggestions.length) {
      await this.audit.record({
        actor: user,
        clientId: targets[0]?.client.id,
        actionType: "categorisation.suggested",
        metadata: { count: suggestions.length, bankAccountId: dto.bankAccountId, bankTransactionId: dto.bankTransactionId },
      });
    }
    return { suggestions, count: suggestions.length };
  }

  async apply(user: AuthUser, dto: CategorisationApplyDto) {
    if (!dto.suggestionId && !dto.bankTransactionId) {
      throw new BadRequestException("suggestionId or bankTransactionId is required");
    }
    const existing = dto.suggestionId
      ? await this.repo.findSuggestion(dto.suggestionId)
      : await this.repo.findSuggestionByTransaction(dto.bankTransactionId!);
    const txn = existing
      ? existing.bankTransaction
      : dto.bankTransactionId
        ? await this.repo.findTransaction(dto.bankTransactionId)
        : null;
    if (!txn) {
      throw new CategorisationError(CAT_ERR.TRANSACTION_NOT_FOUND, "Bank transaction not found");
    }
    const client = await this.clients.get(user, txn.bankAccount.clientId);
    if (existing?.status === "APPLIED" && existing.appliedJournalEntryId) {
      const journal = await this.journals.get(user, existing.appliedJournalEntryId);
      return {
        suggestion: this.publicSuggestion(existing.id, txn.id, client.id, await this.reclassify(txn, client), "APPLIED"),
        journal,
        alreadyApplied: true,
      };
    }
    if (txn.status === BankTxnStatus.MATCHED && txn.matchedJournalEntryId) {
      throw new CategorisationError(CAT_ERR.ALREADY_MATCHED, "Bank transaction is already matched to a journal");
    }

    const classified = await this.reclassify(txn, client);
    const profile = defaultProfileForClientType(client.type);
    if (dto.override?.ledgerAccountId || dto.override?.taxCodeId) {
      const [ledgers, taxes] = await Promise.all([this.books.listLedgers(client.id, profile), this.books.listTaxCodes()]);
      const ledger = dto.override.ledgerAccountId
        ? ledgers.find((item) => item.id === dto.override?.ledgerAccountId)
        : ledgers.find((item) => item.id === classified.ledgerAccountId);
      if (!ledger) {
        throw new CategorisationError(CAT_ERR.MISSING_LEDGER, "Override ledger account was not found");
      }
      const tax = dto.override.taxCodeId
        ? taxes.find((item) => item.id === dto.override?.taxCodeId)
        : taxes.find((item) => item.id === classified.taxCodeId);
      classified.ledgerAccountId = ledger.id;
      classified.ledgerCode = ledger.code;
      classified.ledgerName = ledger.name;
      const itsa = this.itsa.infer(profile, ledger.code);
      classified.itsaCategory = itsa?.category ?? classified.itsaCategory;
      classified.itsaBucket = itsa?.bucket ?? classified.itsaBucket;
      classified.itsaHmrcKey = itsa?.hmrcKey ?? classified.itsaHmrcKey;
      if (tax) {
        classified.taxCodeId = tax.id;
        classified.taxCode = tax.code;
        classified.taxCodeKind = tax.type as TaxCodeKind;
        classified.taxRate = Number(tax.rate);
      }
      classified.draftJournal = this.drafts.build({
        txn: {
          date: txn.date,
          amount: Number(txn.amount),
          type: txn.type === "CREDIT" ? "CREDIT" : "DEBIT",
          description: txn.description,
          merchantName: txn.merchantName,
        },
        counterpart: ledger as LedgerSnapshot,
        ledgers: ledgers as LedgerSnapshot[],
        profile,
        tax: tax ? toTaxSnapshot(tax) : null,
        taxCodeKind: classified.taxCodeKind,
      });
    }

    const lines = classified.draftJournal.lines.map((line) => ({
      ledgerAccountId: line.ledgerAccountId,
      debit: line.debit,
      credit: line.credit,
      taxCodeId: line.taxCodeId,
      description: line.description,
    }));

    const journal = await this.journals.post(user, {
      clientId: client.id,
      firmId: client.firmId,
      date: classified.draftJournal.date,
      description: classified.draftJournal.description,
      reference: classified.draftJournal.reference,
      source: JournalSource.BANK_FEED,
      lines,
      profile,
    });
    const suggestion = await this.repo.upsertSuggestion({
      bankTransactionId: txn.id,
      clientId: client.id,
      firmId: client.firmId,
      ledgerAccountId: classified.ledgerAccountId,
      ledgerCode: classified.ledgerCode,
      taxCodeId: classified.taxCodeId,
      taxCodeKind: classified.taxCodeKind,
      itsaCategory: classified.itsaCategory,
      itsaBucket: classified.itsaBucket,
      vatBoxes: classified.vatBoxes,
      confidence: classified.confidence,
      reasons: classified.reasons,
      draftJournal: classified.draftJournal as never,
      status: "APPLIED",
      appliedJournalEntryId: journal.id,
    });
    await this.repo.markTransactionMatched(txn.id, journal.id);
    await this.audit.record({
      actor: user,
      clientId: client.id,
      actionType: "categorisation.applied",
      metadata: { suggestionId: suggestion.id, journalId: journal.id, bankTransactionId: txn.id },
    });
    return {
      suggestion: this.publicSuggestion(suggestion.id, txn.id, client.id, classified, "APPLIED"),
      journal,
      alreadyApplied: false,
    };
  }

  async rules() {
    const [merchant, mcc] = await Promise.all([this.merchants.list(), this.mcc.list()]);
    return {
      merchants: merchant,
      mcc,
      vat: {
        standardWhenVatableMcc: true,
        noVatWhenExemptMcc: true,
        standardCode: this.vat.codeFor(TaxCodeKind.VAT_STANDARD),
        noVatCode: this.vat.codeFor(TaxCodeKind.NO_VAT),
        vatableMccs: mcc.filter((rule) => rule.vatable).map((rule) => rule.mcc),
        exemptMccs: mcc.filter((rule) => !rule.vatable).map((rule) => rule.mcc),
      },
    };
  }

  classify(txn: ClassifyInput, context: Parameters<typeof classifyTransaction>[1]): Classification {
    return classifyTransaction(txn, context);
  }

  private async reclassify(
    txn: {
      id: string;
      date: Date;
      amount: unknown;
      type: string;
      description: string;
      merchantName?: string | null;
      category?: string | null;
      merchantCategoryCode?: string | null;
      transactionCategory?: string | null;
      location?: string | null;
      labels?: string[];
      bankAccount: { id: string; clientId: string };
    },
    client: { id: string; type: Parameters<typeof defaultProfileForClientType>[0]; firmId: string },
  ) {
    const profile = defaultProfileForClientType(client.type);
    const [ledgers, taxCodes, siblings, invoices, bills, merchantRules, mccRules] = await Promise.all([
      this.books.listLedgers(client.id, profile),
      this.books.listTaxCodes(),
      this.repo.listTransactionsForAccount(txn.bankAccount.id),
      this.books.listInvoices(client.id),
      this.books.listBills(client.id),
      this.merchants.list(),
      this.mcc.list(),
    ]);
    return this.classifyLoaded(
      {
        txn,
        client,
        profile,
        ledgers: ledgers as LedgerSnapshot[],
        taxCodes: taxCodes.map(toTaxSnapshot),
        siblings,
        invoices,
        bills,
      },
      merchantRules,
      mccRules,
    );
  }

  private classifyLoaded(
    target: {
      txn: {
        id: string;
        date: Date;
        amount: unknown;
        type: string;
        description: string;
        merchantName?: string | null;
        category?: string | null;
        merchantCategoryCode?: string | null;
        transactionCategory?: string | null;
        location?: string | null;
        labels?: string[];
      };
      client: { id: string; type: Parameters<typeof defaultProfileForClientType>[0]; firmId: string };
      profile: ChartProfile;
      ledgers: LedgerSnapshot[];
      taxCodes: TaxCodeSnapshot[];
      siblings: Array<{ id?: string; merchantName?: string | null; amount: unknown; description: string }>;
      invoices: Array<{ id: string; date: Date; customer?: { name?: string } | null; journalId?: string | null; grossTotal: unknown }>;
      bills: Array<{ id: string; date: Date; supplier?: { name?: string } | null; journalId?: string | null; grossTotal: unknown }>;
    },
    merchantRules: MerchantRule[],
    mccRules: MccRule[],
  ): Classification {
    const input: ClassifyInput = {
      date: target.txn.date,
      amount: Number(target.txn.amount),
      type: target.txn.type === "CREDIT" ? "CREDIT" : "DEBIT",
      description: target.txn.description,
      merchantName: target.txn.merchantName,
      merchantCategoryCode: target.txn.merchantCategoryCode,
      transactionCategory: target.txn.transactionCategory ?? target.txn.category,
      category: target.txn.category,
      location: target.txn.location,
      labels: target.txn.labels,
    };
    return classifyTransaction(input, {
      profile: target.profile,
      ledgers: target.ledgers,
      taxCodes: target.taxCodes,
      siblings: target.siblings
        .filter((row) => row.id !== target.txn.id)
        .map((row) => ({ merchantName: row.merchantName, amount: Number(row.amount), description: row.description })),
      documents: [
        ...target.invoices.map((row) => ({
          id: row.id,
          kind: "invoice" as const,
          date: row.date,
          description: row.customer?.name ?? "Sales invoice",
          reference: row.id,
          grossTotal: Number(row.grossTotal),
          journalId: row.journalId,
        })),
        ...target.bills.map((row) => ({
          id: row.id,
          kind: "bill" as const,
          date: row.date,
          description: row.supplier?.name ?? "Purchase bill",
          reference: row.id,
          grossTotal: Number(row.grossTotal),
          journalId: row.journalId,
        })),
      ],
      merchantRules,
      mccRules,
    });
  }

  private async resolveTargets(user: AuthUser, dto: CategorisationSuggestDto) {
    if (dto.bankTransactionId) {
      const txn = await this.repo.findTransaction(dto.bankTransactionId);
      if (!txn) {
        throw new CategorisationError(CAT_ERR.TRANSACTION_NOT_FOUND, "Bank transaction not found");
      }
      const client = await this.clients.get(user, txn.bankAccount.clientId);
      return [await this.hydrate(txn, client)];
    }
    if (dto.bankAccountId) {
      const account = await this.repo.findBankAccount(dto.bankAccountId);
      if (!account) {
        throw new NotFoundException("Bank account not found");
      }
      const client = await this.clients.get(user, account.clientId);
      const rows = await this.repo.listTransactionsForAccount(account.id);
      return Promise.all(rows.filter((row) => row.status === BankTxnStatus.UNMATCHED).map((row) => this.hydrate(row, client)));
    }
    if (!dto.clientId) {
      throw new BadRequestException("clientId, bankAccountId or bankTransactionId is required");
    }
    const client = await this.clients.get(user, dto.clientId);
    const rows = await this.repo.listTransactionsForClient(client.id);
    return Promise.all(rows.filter((row) => row.status === BankTxnStatus.UNMATCHED).map((row) => this.hydrate(row, client)));
  }

  private async hydrate(
    txn: {
      id: string;
      date: Date;
      amount: unknown;
      type: string;
      description: string;
      merchantName?: string | null;
      category?: string | null;
      merchantCategoryCode?: string | null;
      transactionCategory?: string | null;
      location?: string | null;
      labels?: string[];
      status?: string;
      bankAccount: { id: string; clientId: string };
      categorisation?: { id: string; status: string; appliedJournalEntryId?: string | null } | null;
    },
    client: { id: string; type: Parameters<typeof defaultProfileForClientType>[0]; firmId: string },
  ) {
    const profile = defaultProfileForClientType(client.type);
    const [ledgers, taxCodes, siblings, invoices, bills] = await Promise.all([
      this.books.listLedgers(client.id, profile),
      this.books.listTaxCodes(),
      this.repo.listTransactionsForAccount(txn.bankAccount.id),
      this.books.listInvoices(client.id),
      this.books.listBills(client.id),
    ]);
    return {
      txn,
      client,
      profile,
      ledgers: ledgers as LedgerSnapshot[],
      taxCodes: taxCodes.map(toTaxSnapshot),
      siblings,
      invoices,
      bills,
    };
  }

  private publicSuggestion(
    id: string | null,
    bankTransactionId: string,
    clientId: string,
    classified: Classification,
    status: string,
  ) {
    return {
      id,
      bankTransactionId,
      clientId,
      suggestedLedger: {
        id: classified.ledgerAccountId,
        code: classified.ledgerCode,
        name: classified.ledgerName,
      },
      suggestedTaxCode: {
        id: classified.taxCodeId,
        code: classified.taxCode,
        kind: classified.taxCodeKind,
        rate: classified.taxRate,
      },
      suggestedItsa: {
        category: classified.itsaCategory,
        bucket: classified.itsaBucket,
        hmrcKey: classified.itsaHmrcKey,
        includedInQuarterlyUpdate: classified.includedInQuarterlyUpdate,
      },
      vatBoxes: classified.vatBoxes,
      draftJournal: classified.draftJournal,
      confidence: classified.confidence,
      reasons: classified.reasons,
      status,
    };
  }
}
