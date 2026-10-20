import { Injectable } from "@nestjs/common";
import { Prisma, YapilyConsentStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class YapilyRepository {
  constructor(private readonly prisma: PrismaService) {}

  findConnection(clientId: string, institutionId?: string) {
    if (institutionId) {
      return this.prisma.yapilyConnection.findUnique({
        where: { clientId_institutionId: { clientId, institutionId } },
      });
    }
    return this.prisma.yapilyConnection.findFirst({
      where: { clientId },
      orderBy: { updatedAt: "desc" },
    });
  }

  findConnectionById(id: string) {
    return this.prisma.yapilyConnection.findUnique({ where: { id } });
  }

  upsertConnection(data: {
    clientId: string;
    institutionId: string;
    applicationUserId?: string;
    consentId?: string;
    consentTokenEnc?: string | null;
    status: YapilyConsentStatus;
    expiresAt?: Date | null;
  }) {
    return this.prisma.yapilyConnection.upsert({
      where: { clientId_institutionId: { clientId: data.clientId, institutionId: data.institutionId } },
      create: data,
      update: {
        applicationUserId: data.applicationUserId,
        consentId: data.consentId,
        consentTokenEnc: data.consentTokenEnc,
        status: data.status,
        expiresAt: data.expiresAt,
      },
    });
  }

  findBankAccount(clientId: string, externalId: string) {
    return this.prisma.bankAccount.findFirst({ where: { clientId, externalId } });
  }

  findBankAccountByNumbers(clientId: string, sortCode?: string | null, accountNumber?: string | null) {
    if (!sortCode && !accountNumber) {
      return null;
    }
    return this.prisma.bankAccount.findFirst({
      where: {
        clientId,
        ...(sortCode ? { sortCode } : {}),
        ...(accountNumber ? { accountNumber } : {}),
      },
    });
  }

  findBankAccountById(id: string) {
    return this.prisma.bankAccount.findUnique({ where: { id } });
  }

  createBankAccount(data: Prisma.BankAccountCreateInput) {
    return this.prisma.bankAccount.create({ data });
  }

  updateBankAccount(id: string, data: Prisma.BankAccountUpdateInput) {
    return this.prisma.bankAccount.update({ where: { id }, data });
  }

  listBankAccounts(clientId: string) {
    return this.prisma.bankAccount.findMany({
      where: { clientId, provider: "yapily" },
      orderBy: { name: "asc" },
    });
  }

  findTransaction(bankAccountId: string, externalRef: string) {
    return this.prisma.bankTransaction.findFirst({ where: { bankAccountId, externalRef } });
  }

  createTransaction(data: Prisma.BankTransactionCreateInput) {
    return this.prisma.bankTransaction.create({ data });
  }

  updateTransaction(id: string, data: Prisma.BankTransactionUpdateInput) {
    return this.prisma.bankTransaction.update({ where: { id }, data });
  }

  listTransactions(bankAccountId: string, from?: Date, to?: Date) {
    return this.prisma.bankTransaction.findMany({
      where: {
        bankAccountId,
        ...(from || to ? { date: { gte: from, lte: to } } : {}),
      },
      include: { matchedJournal: true },
      orderBy: { date: "desc" },
    });
  }
}
