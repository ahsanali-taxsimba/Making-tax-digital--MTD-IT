import { Injectable } from "@nestjs/common";
import { ManualStatementStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ManualStatementsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.ManualStatementUploadCreateInput) {
    return this.prisma.manualStatementUpload.create({ data });
  }

  find(id: string) {
    return this.prisma.manualStatementUpload.findUnique({
      where: { id },
      include: { bankAccount: true },
    });
  }

  list(clientId: string, bankAccountId?: string) {
    return this.prisma.manualStatementUpload.findMany({
      where: { clientId, ...(bankAccountId ? { bankAccountId } : {}) },
      orderBy: { uploadedAt: "desc" },
      select: {
        id: true,
        clientId: true,
        bankAccountId: true,
        fileName: true,
        fileType: true,
        uploadedByUserId: true,
        uploadedAt: true,
        parsedAt: true,
        status: true,
        profile: true,
        rowCount: true,
        importedCount: true,
        duplicateCount: true,
        health: true,
        errorMessage: true,
      },
    });
  }

  update(id: string, data: Prisma.ManualStatementUploadUpdateInput) {
    return this.prisma.manualStatementUpload.update({ where: { id }, data });
  }

  mark(id: string, status: ManualStatementStatus, data: Prisma.ManualStatementUploadUpdateInput = {}) {
    return this.update(id, { status, ...data });
  }
}
