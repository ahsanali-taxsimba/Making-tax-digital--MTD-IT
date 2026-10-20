import { BadRequestException, Injectable, NotFoundException, Optional } from "@nestjs/common";
import { BankTxnStatus, ChartProfile, JournalSource, TaxCodeKind } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { BookkeepingRepository } from "../bookkeeping/bookkeeping.repository";
import { LedgerSnapshot, TaxCodeSnapshot, toTaxSnapshot } from "../bookkeeping/domain/journal.rules";
import { JournalService } from "../bookkeeping/journal.service";
import { ClientsService } from "../clients/clients.service";
import { AuthUser } from "../common/types";
import { defaultProfileForClientType } from "../ledger/chart-of-accounts.catalog";
import { CAT_ERR, CategorisationError } from "./categorisation.errors";
import { CategorisationModelService } from "./categorisation-model.service";
import { CategorisationRepository } from "./categorisation.repository";
import { ConfidenceEngineService } from "./confidence-engine.service";
import { classifyTransaction } from "./domain/classify";
import { Classification, ClassifyInput, MerchantRule, MccRule } from "./domain/types";
import { CategorisationApplyDto, CategorisationSuggestDto } from "./dto/categorisation.dto";
import { ITSAInferenceService } from "./itsa-inference.service";
import { JournalDraftService } from "./journal-draft.service";
import { MCCMappingService } from "./mcc-mapping.service";
import { MerchantDictionaryService } from "./merchant-dictionary.service";
import { RulesEngineService } from "./rules-engine.service";
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
    private readonly model: CategorisationModelService,
    private readonly confidence: ConfidenceEngineService,
    @Optional() private readonly rulesEngine?: RulesEngineService,
  ) {}

  async suggest(user: AuthUser, dto: CategorisationSuggestDto) {
    const persist = dto.persist !== false;
    const merchantRules = await this.merchants.list();
    const mccRules = await this.mcc.list();
    if (dto.receiptId && !dto.bankTransactionId && !dto.bankAccountId) {
      const receipt = await this.repo.findReceipt(dto.receiptId);
      if (!receipt) {
        throw new NotFoundException("Receipt not found");
      }
      if (receipt.bankTransactionId) {
        dto = { ...dto, bankTransactionId: receipt.bankTransactionId };
      } else {
        return this.suggestReceipt(user, dto, merchantRules, mccRules, persist, receipt);
      }
    }
    if (this.isAdHoc(dto) && !dto.bankTransactionId && !dto.bankAccountId) {
      return this.suggestAdHoc(user, dto, merchantRules, mccRules);
    }
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
    if (dto.receiptId && !dto.suggestionId && !dto.bankTransactionId) {
      const receipt = await this.repo.findReceipt(dto.receiptId);
      if (!receipt) {
        throw new NotFoundException("Receipt not found");
      }
      if (receipt.bankTransactionId) {
        dto = { ...dto, bankTransactionId: receipt.bankTransactionId };
      } else {
        return this.applyReceipt(user, dto, receipt);
      }
    }
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
    if (this.rulesEngine) {
      const catalog = await this.rulesEngine.catalog();
      return { ...catalog, model: this.model.stats() };
    }
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
      model: this.model.stats(),
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
      enrichment?: unknown;
      receipts?: ReceiptOcrRow[];
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
        enrichment?: unknown;
        receipts?: ReceiptOcrRow[];
      };
      client: { id: string; type: Parameters<typeof defaultProfileForClientType>[0]; firmId: string };
      profile: ChartProfile;
      ledgers: LedgerSnapshot[];
      taxCodes: TaxCodeSnapshot[];
      siblings: Array<{
        id?: string;
        merchantName?: string | null;
        amount: unknown;
        description: string;
        ledgerCode?: number | null;
        categorisation?: { ledgerCode?: number | null } | null;
      }>;
      invoices: Array<{ id: string; date: Date; customer?: { name?: string } | null; journalId?: string | null; grossTotal: unknown }>;
      bills: Array<{ id: string; date: Date; supplier?: { name?: string } | null; journalId?: string | null; grossTotal: unknown }>;
    },
    merchantRules: MerchantRule[],
    mccRules: MccRule[],
  ): Classification {
    const ocr = readOcrFields(target.txn);
    const input: ClassifyInput = {
      date: target.txn.date,
      amount: Number(target.txn.amount),
      type: target.txn.type === "CREDIT" ? "CREDIT" : "DEBIT",
      description: target.txn.description,
      merchantName: target.txn.merchantName ?? ocr.ocrMerchantName,
      merchantCategoryCode: target.txn.merchantCategoryCode,
      transactionCategory: target.txn.transactionCategory ?? target.txn.category,
      category: target.txn.category,
      location: target.txn.location,
      labels: target.txn.labels,
      ...ocr,
    };
    return classifyTransaction(input, {
      profile: target.profile,
      ledgers: target.ledgers,
      taxCodes: target.taxCodes,
      model: this.model,
      siblings: target.siblings
        .filter((row) => row.id !== target.txn.id)
        .map((row) => ({
          merchantName: row.merchantName,
          amount: Number(row.amount),
          description: row.description,
          ledgerCode: row.ledgerCode ?? row.categorisation?.ledgerCode ?? null,
        })),
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
      enrichment?: unknown;
      receipts?: ReceiptOcrRow[];
      status?: string;
      bankAccount: { id: string; clientId: string };
      categorisation?: { id: string; status: string; appliedJournalEntryId?: string | null; ledgerCode?: number | null } | null;
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
      model: classified.model,
      confidenceBreakdown: classified.confidenceBreakdown,
      status,
    };
  }

  private isAdHoc(dto: CategorisationSuggestDto) {
    return Boolean(dto.ocrText || dto.merchantName || dto.description || dto.amount != null || dto.merchantCategoryCode);
  }

  private async suggestReceipt(
    user: AuthUser,
    dto: CategorisationSuggestDto,
    merchantRules: MerchantRule[],
    mccRules: MccRule[],
    persist: boolean,
    receipt: ReceiptOcrRow & { id: string; clientId: string; bankTransactionId?: string | null; fileName?: string },
  ) {
    const client = await this.clients.get(user, receipt.clientId);
    const classified = await this.classifyStandalone(
      client,
      receiptToClassifyInput(receipt, dto),
      merchantRules,
      mccRules,
    );
    if (persist) {
      await this.audit.record({
        actor: user,
        clientId: client.id,
        actionType: "categorisation.suggested",
        metadata: { receiptId: receipt.id, ephemeral: true },
      });
    }
    return {
      suggestions: [this.publicSuggestion(null, receipt.bankTransactionId ?? `receipt:${receipt.id}`, client.id, classified, "SUGGESTED")],
      count: 1,
    };
  }

  private async suggestAdHoc(user: AuthUser, dto: CategorisationSuggestDto, merchantRules: MerchantRule[], mccRules: MccRule[]) {
    if (!dto.clientId) {
      throw new BadRequestException("clientId is required when classifying OCR or ad-hoc text");
    }
    const client = await this.clients.get(user, dto.clientId);
    const classified = await this.classifyStandalone(client, adHocToClassifyInput(dto), merchantRules, mccRules);
    return {
      suggestions: [this.publicSuggestion(null, "ad-hoc", client.id, classified, "SUGGESTED")],
      count: 1,
    };
  }

  private async applyReceipt(
    user: AuthUser,
    dto: CategorisationApplyDto,
    receipt: ReceiptOcrRow & { id: string; clientId: string; bankTransactionId?: string | null; fileName?: string },
  ) {
    const client = await this.clients.get(user, receipt.clientId);
    const classified = await this.reclassifyStandalone(client, receiptToClassifyInput(receipt));
    if (dto.override?.ledgerAccountId || dto.override?.taxCodeId) {
      const profile = defaultProfileForClientType(client.type);
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
      classified.draftJournal = this.drafts.build({
        txn: receiptToClassifyInput(receipt),
        counterpart: ledger as LedgerSnapshot,
        ledgers: ledgers as LedgerSnapshot[],
        profile,
        tax: tax ? toTaxSnapshot(tax) : null,
        taxCodeKind: classified.taxCodeKind,
      });
    }
    const journal = await this.journals.post(user, {
      clientId: client.id,
      firmId: client.firmId,
      date: classified.draftJournal.date,
      description: classified.draftJournal.description,
      reference: classified.draftJournal.reference,
      source: JournalSource.MANUAL,
      lines: classified.draftJournal.lines.map((line) => ({
        ledgerAccountId: line.ledgerAccountId,
        debit: line.debit,
        credit: line.credit,
        taxCodeId: line.taxCodeId,
        description: line.description,
      })),
      profile: defaultProfileForClientType(client.type),
    });
    await this.repo.attachReceiptJournal(receipt.id, journal.id);
    await this.audit.record({
      actor: user,
      clientId: client.id,
      actionType: "categorisation.applied",
      metadata: { receiptId: receipt.id, journalId: journal.id },
    });
    return {
      suggestion: this.publicSuggestion(null, `receipt:${receipt.id}`, client.id, classified, "APPLIED"),
      journal,
      alreadyApplied: false,
    };
  }

  private async classifyStandalone(
    client: { id: string; type: Parameters<typeof defaultProfileForClientType>[0]; firmId: string },
    input: ClassifyInput,
    merchantRules: MerchantRule[],
    mccRules: MccRule[],
  ) {
    const profile = defaultProfileForClientType(client.type);
    const [ledgers, taxCodes] = await Promise.all([this.books.listLedgers(client.id, profile), this.books.listTaxCodes()]);
    return classifyTransaction(input, {
      profile,
      ledgers: ledgers as LedgerSnapshot[],
      taxCodes: taxCodes.map(toTaxSnapshot),
      merchantRules,
      mccRules,
      model: this.model,
    });
  }

  private async reclassifyStandalone(
    client: { id: string; type: Parameters<typeof defaultProfileForClientType>[0]; firmId: string },
    input: ClassifyInput,
  ) {
    const [merchantRules, mccRules] = await Promise.all([this.merchants.list(), this.mcc.list()]);
    return this.classifyStandalone(client, input, merchantRules, mccRules);
  }
}

type ReceiptOcrRow = {
  ocrText?: string | null;
  ocrMerchant?: string | null;
  ocrAmount?: unknown;
  ocrNetAmount?: unknown;
  ocrVatAmount?: unknown;
  ocrVatRate?: unknown;
  ocrInvoiceNumber?: string | null;
  ocrDate?: Date | string | null;
};

function asNumber(value: unknown): number | null {
  if (value == null || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readOcrFields(source: { enrichment?: unknown; receipts?: ReceiptOcrRow[] }): Partial<ClassifyInput> {
  const enrichment = (source.enrichment ?? {}) as Record<string, unknown>;
  const ocr = (enrichment.receiptOcr ?? {}) as Record<string, unknown>;
  const receipt = source.receipts?.[0];
  return {
    ocrText: (typeof ocr.text === "string" ? ocr.text : null) ?? receipt?.ocrText ?? null,
    ocrMerchantName: (typeof ocr.merchantName === "string" ? ocr.merchantName : null) ?? receipt?.ocrMerchant ?? null,
    ocrAmount: asNumber(ocr.amount) ?? asNumber(receipt?.ocrAmount),
    ocrNetAmount: asNumber(ocr.netAmount) ?? asNumber(receipt?.ocrNetAmount),
    ocrVatAmount: asNumber(ocr.vatAmount) ?? asNumber(receipt?.ocrVatAmount),
    ocrVatRate: asNumber(ocr.vatRate) ?? asNumber(receipt?.ocrVatRate),
    ocrInvoiceNumber: (typeof ocr.invoiceNumber === "string" ? ocr.invoiceNumber : null) ?? receipt?.ocrInvoiceNumber ?? null,
  };
}

function receiptToClassifyInput(receipt: ReceiptOcrRow & { fileName?: string; ocrDate?: Date | string | null }, dto?: CategorisationSuggestDto): ClassifyInput {
  return {
    date: dto?.date ?? receipt.ocrDate ?? new Date(),
    amount: dto?.amount ?? asNumber(receipt.ocrAmount) ?? 0,
    type: dto?.type ?? "DEBIT",
    description: dto?.description ?? receipt.ocrText ?? receipt.fileName ?? "Receipt",
    merchantName: dto?.merchantName ?? receipt.ocrMerchant,
    merchantCategoryCode: dto?.merchantCategoryCode,
    ocrText: receipt.ocrText,
    ocrMerchantName: receipt.ocrMerchant,
    ocrAmount: asNumber(receipt.ocrAmount),
    ocrNetAmount: asNumber(receipt.ocrNetAmount),
    ocrVatAmount: asNumber(receipt.ocrVatAmount),
    ocrVatRate: asNumber(receipt.ocrVatRate),
    ocrInvoiceNumber: receipt.ocrInvoiceNumber,
  };
}

function adHocToClassifyInput(dto: CategorisationSuggestDto): ClassifyInput {
  return {
    date: dto.date ?? new Date(),
    amount: dto.amount ?? 0,
    type: dto.type ?? "DEBIT",
    description: dto.description ?? dto.ocrText ?? dto.merchantName ?? "Ad-hoc categorisation",
    merchantName: dto.merchantName,
    merchantCategoryCode: dto.merchantCategoryCode,
    ocrText: dto.ocrText,
    ocrMerchantName: dto.merchantName,
    ocrAmount: dto.amount ?? null,
  };
}
