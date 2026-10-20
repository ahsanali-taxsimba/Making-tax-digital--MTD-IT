import { Injectable } from "@nestjs/common";
import { BankTxnStatus, CategorisationStatus, DocumentStatus, ObligationStatus, TaskStatus } from "@prisma/client";
import { AuthUser } from "../common/types";
import { CategorisationService } from "../categorisation/categorisation.service";
import { MatchingService } from "../matching/matching.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AgentToolsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categorisation: CategorisationService,
    private readonly matching: MatchingService,
  ) {}

  async run(user: AuthUser, name: string, args: Record<string, unknown>): Promise<unknown> {
    const clientId = optionalId(args.clientId);
    switch (name) {
      case "practice_overview":
        return this.overview(user.firmId);
      case "list_uncategorised_bank":
        return this.uncategorised(user.firmId, clientId);
      case "suggest_categories":
        return this.suggestCategories(user, clientId, optionalId(args.bankTransactionId));
      case "list_unmatched_bank":
        return this.unmatched(user, clientId);
      case "list_overdue_invoices":
        return this.overdueInvoices(user.firmId, clientId);
      case "vat_position":
        return this.vatPosition(user.firmId, clientId);
      case "itsa_position":
        return this.itsaPosition(user.firmId, clientId);
      case "cash_position":
        return this.cashPosition(user.firmId, clientId);
      case "list_open_tasks":
        return this.openTasks(user.firmId);
      case "search_transactions":
        return this.search(user.firmId, String(args.query ?? ""), clientId);
      default:
        return { error: `Unknown tool ${name}` };
    }
  }

  async overview(firmId: string) {
    const [clients, unmatchedBank, overdueInvoices, openVat, openItsa, openTasks] = await Promise.all([
      this.prisma.client.count({ where: { firmId } }),
      this.prisma.bankTransaction.count({
        where: { bankAccount: { firmId }, status: BankTxnStatus.UNMATCHED },
      }),
      this.prisma.salesInvoice.count({
        where: { client: { firmId }, status: DocumentStatus.POSTED, dueDate: { lt: new Date() } },
      }),
      this.prisma.vatObligation.count({ where: { client: { firmId }, status: ObligationStatus.OPEN } }),
      this.prisma.itsaObligation.count({ where: { client: { firmId }, status: ObligationStatus.OPEN } }),
      this.prisma.task.count({ where: { firmId, status: { in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS, TaskStatus.WAITING_ON_CLIENT] } } }),
    ]);
    return { clients, unmatchedBank, overdueInvoices, openVat, openItsa, openTasks };
  }

  async uncategorised(firmId: string, clientId?: string) {
    const rows = await this.prisma.bankTransaction.findMany({
      where: {
        bankAccount: { firmId, ...(clientId ? { clientId } : {}) },
        status: BankTxnStatus.UNMATCHED,
        OR: [{ categorisation: null }, { categorisation: { status: { not: CategorisationStatus.APPLIED } } }],
      },
      include: { bankAccount: { include: { client: { select: { id: true, name: true } } } }, categorisation: true },
      orderBy: { date: "desc" },
      take: 20,
    });
    return {
      transactions: rows.map((row) => ({
        id: row.id,
        clientId: row.bankAccount.clientId,
        clientName: row.bankAccount.client.name,
        date: row.date,
        description: row.description,
        merchantName: row.merchantName,
        amountPence: moneyToPence(row.amount),
        type: row.type,
      })),
    };
  }

  async suggestCategories(user: AuthUser, clientId?: string, bankTransactionId?: string) {
    if (bankTransactionId) {
      return this.categorisation.suggest(user, { bankTransactionId, persist: true });
    }
    const open = await this.uncategorised(user.firmId, clientId);
    const suggestions = [];
    for (const row of open.transactions.slice(0, 8)) {
      const result = await this.categorisation.suggest(user, { bankTransactionId: row.id, persist: true });
      suggestions.push(
        ...result.suggestions.map((item) => ({
          ...item,
          merchantName: row.merchantName ?? row.description,
          amountPence: row.amountPence,
        })),
      );
    }
    return { suggestions, count: suggestions.length };
  }

  async unmatched(user: AuthUser, clientId?: string) {
    const open = await this.prisma.bankTransaction.findMany({
      where: { bankAccount: { firmId: user.firmId, ...(clientId ? { clientId } : {}) }, status: BankTxnStatus.UNMATCHED },
      include: { bankAccount: { include: { client: { select: { id: true, name: true } } } } },
      take: 12,
      orderBy: { date: "desc" },
    });
    const matches = [];
    for (const row of open.slice(0, 8)) {
      const result = await this.matching.suggestions(user, { bankTransactionId: row.id, persist: true });
      matches.push(
        ...result.suggestions.map((item) => ({
          ...item,
          description: row.description,
          clientName: row.bankAccount.client.name,
        })),
      );
    }
    return {
      unmatched: open.map((row) => ({
        id: row.id,
        clientId: row.bankAccount.clientId,
        clientName: row.bankAccount.client.name,
        description: row.description,
        amountPence: moneyToPence(row.amount),
        date: row.date,
      })),
      matches,
    };
  }

  async overdueInvoices(firmId: string, clientId?: string) {
    const rows = await this.prisma.salesInvoice.findMany({
      where: {
        client: { firmId },
        ...(clientId ? { clientId } : {}),
        status: DocumentStatus.POSTED,
        dueDate: { lt: new Date() },
      },
      include: { client: { select: { name: true } }, customer: { select: { name: true } } },
      orderBy: { dueDate: "asc" },
      take: 20,
    });
    return {
      invoices: rows.map((row) => ({
        id: row.id,
        clientId: row.clientId,
        clientName: row.client.name,
        customerName: row.customer.name,
        invoiceNumber: row.invoiceNumber,
        dueDate: row.dueDate,
        grossTotalPence: moneyToPence(row.grossTotal),
      })),
    };
  }

  async vatPosition(firmId: string, clientId?: string) {
    const rows = await this.prisma.vatObligation.findMany({
      where: { client: { firmId }, ...(clientId ? { clientId } : {}), status: ObligationStatus.OPEN },
      include: { client: { select: { name: true } } },
      orderBy: { due: "asc" },
      take: 20,
    });
    return {
      obligations: rows.map((row) => ({
        id: row.id,
        clientId: row.clientId,
        clientName: row.client.name,
        periodKey: row.periodKey,
        due: row.due,
        status: row.status,
      })),
    };
  }

  async itsaPosition(firmId: string, clientId?: string) {
    const rows = await this.prisma.itsaObligation.findMany({
      where: { client: { firmId }, ...(clientId ? { clientId } : {}), status: ObligationStatus.OPEN },
      include: { client: { select: { name: true } } },
      orderBy: { due: "asc" },
      take: 20,
    });
    return {
      obligations: rows.map((row) => ({
        id: row.id,
        clientId: row.clientId,
        clientName: row.client.name,
        type: row.type,
        taxYear: row.taxYear,
        due: row.due,
        status: row.status,
      })),
    };
  }

  async cashPosition(firmId: string, clientId?: string) {
    const rows = await this.prisma.bankAccount.findMany({
      where: { firmId, ...(clientId ? { clientId } : {}) },
      include: { client: { select: { name: true } } },
      orderBy: { name: "asc" },
    });
    return {
      accounts: rows.map((row) => ({
        id: row.id,
        clientId: row.clientId,
        clientName: row.client.name,
        name: row.name,
        balancePence: moneyToPence(row.balance),
      })),
    };
  }

  async openTasks(firmId: string) {
    const rows = await this.prisma.task.findMany({
      where: { firmId, status: { in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS, TaskStatus.WAITING_ON_CLIENT] } },
      include: { client: { select: { name: true } } },
      orderBy: { dueDate: "asc" },
      take: 20,
    });
    return {
      tasks: rows.map((row) => ({
        id: row.id,
        title: row.title,
        type: row.type,
        status: row.status,
        clientName: row.client.name,
        dueDate: row.dueDate,
      })),
    };
  }

  async search(firmId: string, query: string, clientId?: string) {
    const needle = query.trim();
    if (!needle) {
      return { transactions: [] };
    }
    const rows = await this.prisma.bankTransaction.findMany({
      where: {
        bankAccount: { firmId, ...(clientId ? { clientId } : {}) },
        OR: [
          { description: { contains: needle, mode: "insensitive" } },
          { merchantName: { contains: needle, mode: "insensitive" } },
        ],
      },
      include: { bankAccount: { include: { client: { select: { id: true, name: true } } } } },
      take: 20,
      orderBy: { date: "desc" },
    });
    return {
      transactions: rows.map((row) => ({
        id: row.id,
        clientId: row.bankAccount.clientId,
        clientName: row.bankAccount.client.name,
        date: row.date,
        description: row.description,
        merchantName: row.merchantName,
        amountPence: moneyToPence(row.amount),
        status: row.status,
      })),
    };
  }
}

function optionalId(value: unknown): string | undefined {
  const id = String(value ?? "").trim();
  return id.length ? id : undefined;
}

function moneyToPence(value: unknown): number {
  if (value && typeof value === "object" && "toNumber" in value && typeof (value as { toNumber: () => number }).toNumber === "function") {
    return Math.round((value as { toNumber: () => number }).toNumber() * 100);
  }
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}
