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

  async list(query: { firmId: string; clientId?: string; actorUserId?: string }) {
    return this.prisma.auditLog.findMany({
      where: {
        firmId: query.firmId,
        ...(query.clientId ? { clientId: query.clientId } : {}),
        ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }
}
