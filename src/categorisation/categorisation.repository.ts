import { Injectable } from "@nestjs/common";
import { CategorisationStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

const txnInclude = {
  bankAccount: true,
  categorisation: true,
  receipts: true,
} as const;

const suggestionInclude = {
  bankTransaction: { include: { bankAccount: true, receipts: true } },
} satisfies Prisma.CategorisationSuggestionInclude;

@Injectable()
export class CategorisationRepository {
  constructor(private readonly prisma: PrismaService) {}

  listMerchantRules() {
    return this.prisma.categorisationMerchantRule.findMany({ orderBy: { merchantName: "asc" } });
  }

  listMccRules() {
    return this.prisma.categorisationMccRule.findMany({ orderBy: { mcc: "asc" } });
  }

  upsertMerchantRule(data: Prisma.CategorisationMerchantRuleCreateInput) {
    return this.prisma.categorisationMerchantRule.upsert({
      where: { merchantKey: data.merchantKey },
      create: data,
      update: {
        merchantName: data.merchantName,
        aliases: data.aliases,
        categoryKey: data.categoryKey,
        ledgerCode: data.ledgerCode,
        taxCodeKind: data.taxCodeKind,
        itsaCategory: data.itsaCategory,
        confidence: data.confidence,
      },
    });
  }

  upsertMccRule(data: Prisma.CategorisationMccRuleCreateInput) {
    return this.prisma.categorisationMccRule.upsert({
      where: { mcc: data.mcc },
      create: data,
      update: {
        industry: data.industry,
        categoryKey: data.categoryKey,
        ledgerCode: data.ledgerCode,
        taxCodeKind: data.taxCodeKind,
        vatable: data.vatable,
        itsaCategory: data.itsaCategory,
        confidence: data.confidence,
      },
    });
  }

  findTransaction(id: string) {
    return this.prisma.bankTransaction.findUnique({
      where: { id },
      include: txnInclude,
    });
  }

  listTransactionsForAccount(bankAccountId: string) {
    return this.prisma.bankTransaction.findMany({
      where: { bankAccountId },
      include: txnInclude,
      orderBy: { date: "desc" },
    });
  }

  listTransactionsForClient(clientId: string) {
    return this.prisma.bankTransaction.findMany({
      where: { bankAccount: { clientId } },
      include: txnInclude,
      orderBy: { date: "desc" },
    });
  }

  findReceipt(id: string) {
    return this.prisma.receiptFile.findUnique({ where: { id } });
  }

  attachReceiptJournal(receiptId: string, journalId: string) {
    return this.prisma.receiptFile.update({
      where: { id: receiptId },
      data: { journal: { connect: { id: journalId } }, status: "PROCESSED" },
    });
  }

  findBankAccount(id: string) {
    return this.prisma.bankAccount.findUnique({ where: { id } });
  }

  findSuggestion(id: string) {
    return this.prisma.categorisationSuggestion.findUnique({ where: { id }, include: suggestionInclude });
  }

  findSuggestionByTransaction(bankTransactionId: string) {
    return this.prisma.categorisationSuggestion.findUnique({
      where: { bankTransactionId },
      include: suggestionInclude,
    });
  }

  upsertSuggestion(data: {
    bankTransactionId: string;
    clientId: string;
    firmId: string;
    ledgerAccountId?: string | null;
    ledgerCode: number;
    taxCodeId?: string | null;
    taxCodeKind: Prisma.CategorisationSuggestionCreateInput["taxCodeKind"];
    itsaCategory?: string | null;
    itsaBucket?: string | null;
    vatBoxes: Prisma.InputJsonValue;
    confidence: number;
    reasons: Prisma.InputJsonValue;
    draftJournal: Prisma.InputJsonValue;
    status?: CategorisationStatus;
    appliedJournalEntryId?: string | null;
  }) {
    return this.prisma.categorisationSuggestion.upsert({
      where: { bankTransactionId: data.bankTransactionId },
      create: {
        bankTransactionId: data.bankTransactionId,
        clientId: data.clientId,
        firmId: data.firmId,
        ledgerAccountId: data.ledgerAccountId,
        ledgerCode: data.ledgerCode,
        taxCodeId: data.taxCodeId,
        taxCodeKind: data.taxCodeKind,
        itsaCategory: data.itsaCategory,
        itsaBucket: data.itsaBucket,
        vatBoxes: data.vatBoxes,
        confidence: data.confidence,
        reasons: data.reasons,
        draftJournal: data.draftJournal,
        status: data.status ?? CategorisationStatus.SUGGESTED,
        appliedJournalEntryId: data.appliedJournalEntryId,
      },
      update: {
        ledgerAccountId: data.ledgerAccountId,
        ledgerCode: data.ledgerCode,
        taxCodeId: data.taxCodeId,
        taxCodeKind: data.taxCodeKind,
        itsaCategory: data.itsaCategory,
        itsaBucket: data.itsaBucket,
        vatBoxes: data.vatBoxes,
        confidence: data.confidence,
        reasons: data.reasons,
        draftJournal: data.draftJournal,
        status: data.status ?? CategorisationStatus.SUGGESTED,
        appliedJournalEntryId: data.appliedJournalEntryId,
      },
      include: suggestionInclude,
    });
  }

  markApplied(id: string, journalId: string) {
    return this.prisma.categorisationSuggestion.update({
      where: { id },
      data: { status: CategorisationStatus.APPLIED, appliedJournalEntryId: journalId },
      include: suggestionInclude,
    });
  }

  markTransactionMatched(id: string, journalId: string) {
    return this.prisma.bankTransaction.update({
      where: { id },
      data: { matchedJournal: { connect: { id: journalId } }, status: "MATCHED" },
    });
  }
}
