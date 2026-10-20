import { Injectable } from "@nestjs/common";
import { DocumentStatus, MatchingDocumentKind, MatchingStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

const suggestionInclude = {
  bankTransaction: { include: { bankAccount: true } },
} satisfies Prisma.MatchingSuggestionInclude;

const invoiceInclude = { customer: true, journal: true, lines: true } satisfies Prisma.SalesInvoiceInclude;
const billInclude = { supplier: true, journal: true, lines: true } satisfies Prisma.PurchaseBillInclude;

@Injectable()
export class MatchingRepository {
  constructor(private readonly prisma: PrismaService) {}

  findTransaction(id: string) {
    return this.prisma.bankTransaction.findUnique({
      where: { id },
      include: { bankAccount: true, matching: true },
    });
  }

  findBankAccount(id: string) {
    return this.prisma.bankAccount.findUnique({ where: { id } });
  }

  listTransactionsForAccount(bankAccountId: string) {
    return this.prisma.bankTransaction.findMany({
      where: { bankAccountId },
      include: { bankAccount: true, matching: true },
      orderBy: { date: "desc" },
    });
  }

  listTransactionsForClient(clientId: string) {
    return this.prisma.bankTransaction.findMany({
      where: { bankAccount: { clientId } },
      include: { bankAccount: true, matching: true },
      orderBy: { date: "desc" },
    });
  }

  listInvoices(clientId: string) {
    return this.prisma.salesInvoice.findMany({
      where: { clientId, status: { not: DocumentStatus.VOID } },
      include: invoiceInclude,
      orderBy: { date: "desc" },
    });
  }

  findInvoice(clientId: string, id: string) {
    return this.prisma.salesInvoice.findFirst({
      where: { id, clientId },
      include: invoiceInclude,
    });
  }

  listBills(clientId: string) {
    return this.prisma.purchaseBill.findMany({
      where: { clientId, status: { not: DocumentStatus.VOID } },
      include: billInclude,
      orderBy: { date: "desc" },
    });
  }

  findBill(clientId: string, id: string) {
    return this.prisma.purchaseBill.findFirst({
      where: { id, clientId },
      include: billInclude,
    });
  }

  listAppliedDocumentIds(clientId: string) {
    return this.prisma.matchingSuggestion.findMany({
      where: { clientId, status: MatchingStatus.APPLIED },
      select: { documentId: true, documentKind: true },
    });
  }

  findSuggestion(id: string) {
    return this.prisma.matchingSuggestion.findUnique({ where: { id }, include: suggestionInclude });
  }

  findSuggestionByTransaction(bankTransactionId: string) {
    return this.prisma.matchingSuggestion.findUnique({
      where: { bankTransactionId },
      include: suggestionInclude,
    });
  }

  upsertSuggestion(data: {
    bankTransactionId: string;
    clientId: string;
    firmId: string;
    documentKind: MatchingDocumentKind;
    documentId: string;
    documentReference?: string | null;
    partyName?: string | null;
    amountGap: number;
    dateGapDays: number;
    confidence: number;
    reasons: Prisma.InputJsonValue;
    signals: Prisma.InputJsonValue;
    status?: MatchingStatus;
    journalEntryId?: string | null;
  }) {
    return this.prisma.matchingSuggestion.upsert({
      where: { bankTransactionId: data.bankTransactionId },
      create: {
        bankTransactionId: data.bankTransactionId,
        clientId: data.clientId,
        firmId: data.firmId,
        documentKind: data.documentKind,
        documentId: data.documentId,
        documentReference: data.documentReference,
        partyName: data.partyName,
        amountGap: data.amountGap,
        dateGapDays: data.dateGapDays,
        confidence: data.confidence,
        reasons: data.reasons,
        signals: data.signals,
        status: data.status ?? MatchingStatus.SUGGESTED,
        journalEntryId: data.journalEntryId,
      },
      update: {
        documentKind: data.documentKind,
        documentId: data.documentId,
        documentReference: data.documentReference,
        partyName: data.partyName,
        amountGap: data.amountGap,
        dateGapDays: data.dateGapDays,
        confidence: data.confidence,
        reasons: data.reasons,
        signals: data.signals,
        status: data.status ?? MatchingStatus.SUGGESTED,
        journalEntryId: data.journalEntryId,
      },
      include: suggestionInclude,
    });
  }

  markRejected(id: string) {
    return this.prisma.matchingSuggestion.update({
      where: { id },
      data: { status: MatchingStatus.REJECTED, journalEntryId: null },
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
