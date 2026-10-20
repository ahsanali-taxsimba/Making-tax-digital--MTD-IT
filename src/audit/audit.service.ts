import { ForbiddenException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuthUser } from "../common/types";
import { AuthorizationService } from "../authorization/authorization.service";
import { AuditLogInput, inferResourceId, inferResourceType } from "./domain/audit.types";
import { hashAuditEntry, verifyAuditChain } from "./domain/hash";
import { parsePeriod } from "./domain/period";

export { parsePeriod } from "./domain/period";

@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: AuthorizationService,
  ) {}

  async log(input: AuditLogInput): Promise<void> {
    const action = input.action;
    const metadata = input.metadata ?? {};
    const firmId = this.resolveFirmId(input);
    const clientId = input.clientId ?? input.actor?.clientId ?? null;
    if (input.actor && firmId && input.actor.firmId && firmId !== input.actor.firmId && input.actor.firmId !== "") {
      throw new ForbiddenException("Cannot write an audit entry for another firm");
    }
    const resourceType = input.resourceType ?? inferResourceType(action, metadata);
    const resourceId = input.resourceId ?? inferResourceId(metadata);
    const createdAt = new Date();
    await this.appendHashedEntry({
      actorUserId: input.actor?.id ?? null,
      firmId,
      clientId,
      action,
      resourceType,
      resourceId,
      beforeData: input.beforeData ?? null,
      afterData: input.afterData ?? null,
      metadata,
      createdAt,
    });
  }

  private async appendHashedEntry(row: {
    actorUserId: string | null;
    firmId: string | null;
    clientId: string | null;
    action: string;
    resourceType: string | null;
    resourceId: string | null;
    beforeData: unknown;
    afterData: unknown;
    metadata: Record<string, unknown>;
    createdAt: Date;
  }, attempt = 0): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        const previous = row.firmId
          ? await tx.auditLog.findFirst({
              where: { firmId: row.firmId },
              orderBy: { createdAt: "desc" },
              select: { entryHash: true },
            })
          : null;
        const prevHash = previous?.entryHash ?? null;
        const entryHash = hashAuditEntry({
          prevHash,
          firmId: row.firmId,
          clientId: row.clientId,
          userId: row.actorUserId,
          action: row.action,
          resourceType: row.resourceType,
          resourceId: row.resourceId,
          beforeData: row.beforeData,
          afterData: row.afterData,
          metadata: row.metadata,
          createdAt: row.createdAt.toISOString(),
        });
        await tx.auditLog.create({
          data: {
            actorUserId: row.actorUserId ?? undefined,
            firmId: row.firmId,
            clientId: row.clientId,
            actionType: row.action,
            action: row.action,
            resourceType: row.resourceType,
            resourceId: row.resourceId,
            beforeData: (row.beforeData ?? Prisma.JsonNull) as Prisma.InputJsonValue,
            afterData: (row.afterData ?? Prisma.JsonNull) as Prisma.InputJsonValue,
            metadata: row.metadata as Prisma.InputJsonValue,
            prevHash,
            entryHash,
            createdAt: row.createdAt,
          },
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (attempt < 3 && (isUniqueViolation(error) || isSerializationFailure(error))) {
        await this.appendHashedEntry(row, attempt + 1);
        return;
      }
      throw error;
    }
  }

  async record(params: {
    actor?: AuthUser | null;
    firmId?: string | null;
    clientId?: string | null;
    actionType: string;
    metadata?: Record<string, unknown>;
    beforeData?: Record<string, unknown> | null;
    afterData?: Record<string, unknown> | null;
    resourceType?: string | null;
    resourceId?: string | null;
  }): Promise<void> {
    await this.log({
      actor: params.actor,
      firmId: params.firmId,
      clientId: params.clientId,
      action: params.actionType,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      beforeData: params.beforeData,
      afterData: params.afterData,
      metadata: params.metadata,
    });
  }

  async list(
    user: AuthUser,
    query: {
      firmId?: string;
      clientId?: string;
      actorUserId?: string;
      actionPrefix?: string;
      action?: string;
      resourceType?: string;
      resourceId?: string;
      documentId?: string;
      invoiceId?: string;
      billId?: string;
      from?: string;
      to?: string;
    },
  ) {
    const firmId = this.scopedFirmId(user, query.firmId);
    this.assertFirmRead(user, firmId, query.clientId);
    const metadataFilters = [
      query.documentId ? { metadata: { path: ["documentId"], equals: query.documentId } } : null,
      query.invoiceId ? { metadata: { path: ["invoiceId"], equals: query.invoiceId } } : null,
      query.billId ? { metadata: { path: ["billId"], equals: query.billId } } : null,
    ].filter(Boolean) as Prisma.AuditLogWhereInput[];
    const rows = await this.prisma.auditLog.findMany({
      where: {
        firmId,
        ...(query.clientId ? { clientId: query.clientId } : {}),
        ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
        ...(query.action ? { OR: [{ action: query.action }, { actionType: query.action }] } : {}),
        ...(query.actionPrefix ? { actionType: { startsWith: query.actionPrefix } } : {}),
        ...(query.resourceType ? { resourceType: query.resourceType } : {}),
        ...(query.resourceId ? { resourceId: query.resourceId } : {}),
        ...(query.from || query.to
          ? {
              createdAt: {
                ...(query.from ? { gte: new Date(query.from) } : {}),
                ...(query.to ? { lte: new Date(query.to) } : {}),
              },
            }
          : {}),
        ...(metadataFilters.length ? { OR: metadataFilters } : {}),
      },
      include: {
        actor: { select: { id: true, name: true, email: true, role: true } },
        client: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return rows.map((row) => this.present(row));
  }

  async export(user: AuthUser, query: { clientId?: string; period?: string }) {
    const firmId = this.scopedFirmId(user);
    this.assertFirmRead(user, firmId, query.clientId);
    const range = parsePeriod(query.period);
    const entries = await this.prisma.auditLog.findMany({
      where: {
        firmId,
        ...(query.clientId ? { clientId: query.clientId } : {}),
        ...(range ? { createdAt: { gte: range.start, lte: range.end } } : {}),
      },
      include: {
        actor: { select: { id: true, name: true, email: true, role: true } },
        client: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 5000,
    });
    const presented = entries.map((row) => this.present(row));
    return {
      firmId,
      clientId: query.clientId ?? null,
      period: range ? { start: range.start.toISOString(), end: range.end.toISOString() } : null,
      generatedAt: new Date().toISOString(),
      generatedBy: { id: user.id, name: user.name, role: user.role },
      entryCount: presented.length,
      chainIntact: verifyAuditChain(presented),
      entries: presented,
    };
  }

  private present(row: {
    id: string;
    actorUserId: string | null;
    firmId: string | null;
    clientId: string | null;
    actionType: string;
    action: string;
    resourceType: string | null;
    resourceId: string | null;
    beforeData: unknown;
    afterData: unknown;
    metadata: unknown;
    prevHash: string | null;
    entryHash: string | null;
    createdAt: Date;
    actor?: { id: string; name: string; email: string; role?: string } | null;
    client?: { id: string; name: string } | null;
  }) {
    return {
      id: row.id,
      firmId: row.firmId,
      clientId: row.clientId,
      userId: row.actorUserId,
      action: row.action || row.actionType,
      resourceType: row.resourceType,
      resourceId: row.resourceId,
      beforeData: row.beforeData,
      afterData: row.afterData,
      metadata: row.metadata,
      createdAt: row.createdAt,
      prevHash: row.prevHash,
      entryHash: row.entryHash,
      actor: row.actor ?? null,
      client: row.client ?? null,
    };
  }

  private resolveFirmId(input: AuditLogInput): string | null {
    return input.firmId ?? input.actor?.firmId ?? null;
  }

  private scopedFirmId(user: AuthUser, requested?: string): string {
    if (this.authz.isPlatform(user)) {
      throw new ForbiddenException("Platform staff cannot export or list client audit trails");
    }
    if (requested && requested !== user.firmId) {
      throw new ForbiddenException("Cannot read another firm's audit trail");
    }
    return user.firmId;
  }

  private assertFirmRead(user: AuthUser, firmId: string, clientId?: string) {
    this.authz.assertCanAccessClientData(user, { firmId, clientId: clientId ?? null });
    if (user.role === "CLIENT" && user.clientId && clientId && clientId !== user.clientId) {
      throw new ForbiddenException("Clients can only see their own audit trail");
    }
  }
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "P2002");
}

function isSerializationFailure(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: string }).code === "P2034");
}
