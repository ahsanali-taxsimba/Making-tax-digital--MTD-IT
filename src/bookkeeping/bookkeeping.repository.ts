import { Injectable } from "@nestjs/common";
import {
  BankTxnStatus,
  DocumentStatus,
  JournalSource,
  PartyKind,
  Prisma,
  ReconciliationStatus,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { DraftJournalLine } from "./domain/journal.rules";
import { parseDate } from "./domain/money";

const journalInclude = {
  lines: { include: { ledger: true, taxCode: true } },
} satisfies Prisma.JournalEntryInclude;

@Injectable()
export class BookkeepingRepository {
  constructor(private readonly prisma: PrismaService) {}

  listChart(profile?: string) {
    return this.prisma.chartOfAccount.findMany({
      where: profile ? { profile: profile as never } : undefined,
      orderBy: [{ profile: "asc" }, { code: "asc" }],
    });
  }

  findChart(id: string) {
    return this.prisma.chartOfAccount.findUnique({ where: { id } });
  }

  createChart(data: Prisma.ChartOfAccountCreateInput) {
    return this.prisma.chartOfAccount.create({ data });
  }

  updateChart(id: string, data: Prisma.ChartOfAccountUpdateInput) {
    return this.prisma.chartOfAccount.update({ where: { id }, data });
  }

  listTaxCodes() {
    return this.prisma.taxCode.findMany({ orderBy: { code: "asc" } });
  }

  listLedgers(clientId: string, profile?: string) {
    return this.prisma.ledger.findMany({
      where: { clientId, ...(profile ? { profile: profile as never } : {}) },
      orderBy: [{ profile: "asc" }, { code: "asc" }],
    });
  }

  findLedgersByIds(ids: string[]) {
    return this.prisma.ledger.findMany({ where: { id: { in: ids } } });
  }

  listPeriods(clientId: string) {
    return this.prisma.accountingPeriod.findMany({ where: { clientId }, orderBy: { start: "desc" } });
  }

  createPeriod(data: Prisma.AccountingPeriodCreateInput) {
    return this.prisma.accountingPeriod.create({ data });
  }

  lockPeriod(id: string) {
    return this.prisma.accountingPeriod.update({ where: { id }, data: { locked: true } });
  }

  listJournals(clientId: string, start?: Date, end?: Date, source?: JournalSource) {
    return this.prisma.journalEntry.findMany({
      where: {
        clientId,
        ...(source ? { source } : {}),
        ...(start && end ? { date: { gte: start, lte: end } } : {}),
      },
      include: journalInclude,
      orderBy: { date: "desc" },
    });
  }

  findJournal(id: string) {
    return this.prisma.journalEntry.findUnique({ where: { id }, include: journalInclude });
  }

  async createJournal(input: {
    firmId: string;
    clientId: string;
    date: Date;
    reference?: string;
    description: string;
    source: JournalSource;
    createdByUserId?: string;
    lines: DraftJournalLine[];
    movements: Array<{ ledgerAccountId: string; delta: number }>;
    dualWrites: Array<{ ledgerAccountId: string; amount: number; description: string }>;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.journalEntry.create({
        data: {
          firmId: input.firmId,
          clientId: input.clientId,
          date: input.date,
          reference: input.reference,
          description: input.description,
          source: input.source,
          createdByUserId: input.createdByUserId,
          lines: {
            create: input.lines.map((line) => ({
              ledgerAccountId: line.ledgerAccountId,
              debit: line.debit,
              credit: line.credit,
              taxCodeId: line.taxCodeId ?? null,
              description: line.description ?? null,
            })),
          },
        },
        include: journalInclude,
      });

      for (const movement of input.movements) {
        await tx.ledger.update({
          where: { id: movement.ledgerAccountId },
          data: { currentBalance: { increment: movement.delta } },
        });
      }

      if (input.dualWrites.length > 0) {
        await tx.transaction.createMany({
          data: input.dualWrites.map((row) => ({
            clientId: input.clientId,
            ledgerId: row.ledgerAccountId,
            date: input.date,
            description: row.description,
            amount: row.amount,
            source: input.source.toLowerCase(),
          })),
        });
      }

      return entry;
    });
  }

  listBankAccounts(clientId: string) {
    return this.prisma.bankAccount.findMany({
      where: { clientId },
      include: { _count: { select: { transactions: true } } },
      orderBy: { createdAt: "asc" },
    });
  }

  countTransactionsByStatus(bankAccountIds: string[]) {
    if (bankAccountIds.length === 0) {
      return Promise.resolve([]);
    }
    return this.prisma.bankTransaction.groupBy({
      by: ["bankAccountId", "status"],
      where: { bankAccountId: { in: bankAccountIds } },
      _count: { _all: true },
    });
  }

  findBankAccount(id: string) {
    return this.prisma.bankAccount.findUnique({ where: { id } });
  }

  findBankTransaction(id: string) {
    return this.prisma.bankTransaction.findUnique({
      where: { id },
      include: { bankAccount: true, matchedJournal: true },
    });
  }

  createBankAccount(data: Prisma.BankAccountCreateInput) {
    return this.prisma.bankAccount.create({ data });
  }

  listBankTransactions(bankAccountId: string) {
    return this.prisma.bankTransaction.findMany({
      where: { bankAccountId },
      include: { matchedJournal: true },
      orderBy: { date: "desc" },
    });
  }

  findBankTransactions(ids: string[]) {
    return this.prisma.bankTransaction.findMany({ where: { id: { in: ids } } });
  }

  createBankTransactions(
    bankAccountId: string,
    rows: Array<{
      date: Date;
      amount: number;
      type: "CREDIT" | "DEBIT";
      description: string;
      externalRef?: string;
      merchantName?: string | null;
      category?: string | null;
      merchantCategoryCode?: string | null;
      transactionCategory?: string | null;
      enrichment?: Prisma.InputJsonValue;
    }>,
  ) {
    return this.prisma.bankTransaction.createMany({
      data: rows.map((row) => ({
        bankAccountId,
        date: row.date,
        amount: row.amount,
        type: row.type,
        description: row.description,
        externalRef: row.externalRef,
        merchantName: row.merchantName ?? undefined,
        category: row.category ?? undefined,
        merchantCategoryCode: row.merchantCategoryCode ?? undefined,
        transactionCategory: row.transactionCategory ?? undefined,
        enrichment: row.enrichment ?? undefined,
      })),
    });
  }

  listExternalRefs(bankAccountId: string) {
    return this.prisma.bankTransaction.findMany({
      where: { bankAccountId, externalRef: { not: null } },
      select: { externalRef: true },
    });
  }

  updateBankTransaction(id: string, data: Prisma.BankTransactionUpdateInput) {
    return this.prisma.bankTransaction.update({ where: { id }, data });
  }

  createReconciliation(data: Prisma.ReconciliationSessionCreateInput) {
    return this.prisma.reconciliationSession.create({ data });
  }

  markReconciled(ids: string[]) {
    return this.prisma.bankTransaction.updateMany({
      where: { id: { in: ids } },
      data: { status: BankTxnStatus.RECONCILED },
    });
  }

  ensureParty(clientId: string, kind: PartyKind, id?: string, name?: string) {
    if (id) {
      return this.prisma.tradingParty.findFirst({ where: { id, clientId, kind } });
    }
    return this.prisma.tradingParty.create({
      data: { clientId, kind, name: name ?? (kind === "CUSTOMER" ? "Customer" : "Supplier") },
    });
  }

  createInvoice(data: Prisma.SalesInvoiceCreateInput) {
    return this.prisma.salesInvoice.create({ data, include: { lines: true, customer: true, journal: { include: journalInclude } } });
  }

  listInvoices(clientId: string) {
    return this.prisma.salesInvoice.findMany({
      where: { clientId },
      include: { lines: true, customer: true },
      orderBy: { date: "desc" },
    });
  }

  createBill(data: Prisma.PurchaseBillCreateInput) {
    return this.prisma.purchaseBill.create({ data, include: { lines: true, supplier: true, journal: { include: journalInclude } } });
  }

  listBills(clientId: string) {
    return this.prisma.purchaseBill.findMany({
      where: { clientId },
      include: { lines: true, supplier: true },
      orderBy: { date: "desc" },
    });
  }

  updateInvoiceJournal(id: string, journalId: string) {
    return this.prisma.salesInvoice.update({
      where: { id },
      data: { journalId, status: DocumentStatus.POSTED },
    });
  }

  updateBillJournal(id: string, journalId: string) {
    return this.prisma.purchaseBill.update({
      where: { id },
      data: { journalId, status: DocumentStatus.POSTED },
    });
  }

  toDate(value: string) {
    return parseDate(value);
  }

  periodFilter(start?: string, end?: string) {
    if (!start || !end) {
      return undefined;
    }
    return { gte: parseDate(start), lte: parseDate(end) };
  }
}

export { ReconciliationStatus, BankTxnStatus };
