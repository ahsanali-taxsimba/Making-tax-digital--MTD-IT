import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuthUser } from "../common/types";

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(params: {
    actor?: AuthUser | null;
    firmId?: string | null;
    clientId?: string | null;
    actionType: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorUserId: params.actor?.id,
        firmId: params.firmId ?? params.actor?.firmId,
        clientId: params.clientId,
        actionType: params.actionType,
        metadata: (params.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  async list(query: {
    firmId: string;
    clientId?: string;
    actorUserId?: string;
    actionPrefix?: string;
    documentId?: string;
    invoiceId?: string;
    billId?: string;
  }) {
    const metadataFilters = [
      query.documentId ? { metadata: { path: ["documentId"], equals: query.documentId } } : null,
      query.invoiceId ? { metadata: { path: ["invoiceId"], equals: query.invoiceId } } : null,
      query.billId ? { metadata: { path: ["billId"], equals: query.billId } } : null,
    ].filter(Boolean) as Prisma.AuditLogWhereInput[];
    return this.prisma.auditLog.findMany({
      where: {
        firmId: query.firmId,
        ...(query.clientId ? { clientId: query.clientId } : {}),
        ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
        ...(query.actionPrefix ? { actionType: { startsWith: query.actionPrefix } } : {}),
        ...(metadataFilters.length ? { OR: metadataFilters } : {}),
      },
      include: { actor: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }
}
