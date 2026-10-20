import { Injectable, NotFoundException } from "@nestjs/common";
import { ObligationStatus, TaskStatus, UserRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AuthUser } from "../common/types";
import { UpdateFirmDto } from "./dto/firm.dto";

const STAFF_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.ASSISTANT];

@Injectable()
export class FirmsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async me(user: AuthUser) {
    const firm = await this.prisma.firm.findUnique({ where: { id: user.firmId } });
    if (!firm) {
      throw new NotFoundException("Firm not found");
    }
    return this.publicFirm(firm);
  }

  async dashboard(user: AuthUser) {
    const firm = await this.me(user);
    const [staffCount, clientCount, openVatObligations, openItsaObligations, staff, tasks] = await Promise.all([
      this.prisma.user.count({ where: { firmId: user.firmId, role: { in: STAFF_ROLES } } }),
      this.prisma.client.count({ where: { firmId: user.firmId } }),
      this.prisma.vatObligation.count({
        where: { status: ObligationStatus.OPEN, client: { firmId: user.firmId } },
      }),
      this.prisma.itsaObligation.count({
        where: { status: ObligationStatus.OPEN, client: { firmId: user.firmId } },
      }),
      this.prisma.user.findMany({
        where: { firmId: user.firmId, role: { in: STAFF_ROLES } },
        select: { id: true, name: true, role: true, status: true },
        orderBy: { name: "asc" },
      }),
      this.prisma.task.findMany({
        where: { firmId: user.firmId },
        select: { assigneeId: true, status: true },
      }),
    ]);

    const workload = staff.map((member) => {
      const assigned = tasks.filter((task) => task.assigneeId === member.id);
      return {
        userId: member.id,
        name: member.name,
        role: member.role,
        status: member.status,
        open: assigned.filter((task) => task.status === TaskStatus.OPEN).length,
        inProgress: assigned.filter((task) => task.status === TaskStatus.IN_PROGRESS).length,
        waitingOnClient: assigned.filter((task) => task.status === TaskStatus.WAITING_ON_CLIENT).length,
        completed: assigned.filter((task) => task.status === TaskStatus.COMPLETED).length,
      };
    });

    const unassigned = tasks.filter((task) => !task.assigneeId);
    const taskWorkload = [
      ...workload,
      ...(unassigned.length
        ? [
            {
              userId: null,
              name: "Unassigned",
              role: null,
              status: null,
              open: unassigned.filter((task) => task.status === TaskStatus.OPEN).length,
              inProgress: unassigned.filter((task) => task.status === TaskStatus.IN_PROGRESS).length,
              waitingOnClient: unassigned.filter((task) => task.status === TaskStatus.WAITING_ON_CLIENT).length,
              completed: unassigned.filter((task) => task.status === TaskStatus.COMPLETED).length,
            },
          ]
        : []),
    ];

    return {
      firm,
      staffCount,
      clientCount,
      openVatObligations,
      openItsaObligations,
      openObligations: openVatObligations + openItsaObligations,
      taskWorkload,
    };
  }

  async hmrcConnections(user: AuthUser) {
    const clients = await this.prisma.client.findMany({
      where: { firmId: user.firmId },
      orderBy: { name: "asc" },
      include: {
        mtdConnections: {
          select: {
            id: true,
            environment: true,
            scopes: true,
            tokenExpiresAt: true,
            disconnectedAt: true,
            updatedAt: true,
          },
        },
      },
    });
    const clientIds = clients.map((client) => client.id);
    const [audits, interactions] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { firmId: user.firmId, clientId: { in: clientIds }, actionType: { startsWith: "hmrc." } },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.hmrcInteraction.findMany({
        where: { clientId: { in: clientIds } },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const latestAudit = new Map<string, (typeof audits)[number]>();
    for (const row of audits) {
      if (row.clientId && !latestAudit.has(row.clientId)) {
        latestAudit.set(row.clientId, row);
      }
    }
    const latestCall = new Map<string, (typeof interactions)[number]>();
    for (const row of interactions) {
      if (row.clientId && !latestCall.has(row.clientId)) {
        latestCall.set(row.clientId, row);
      }
    }

    return clients.map((client) => {
      const active = client.mtdConnections.filter((connection) => !connection.disconnectedAt);
      const current = active[0] ?? client.mtdConnections[0] ?? null;
      const scopes = current?.scopes ?? [];
      const connected = Boolean(current && !current.disconnectedAt);
      const audit = latestAudit.get(client.id);
      const call = latestCall.get(client.id);
      const lastAt = [audit?.createdAt, call?.createdAt].filter(Boolean).sort((a, b) => Number(b) - Number(a))[0];
      return {
        clientId: client.id,
        clientName: client.name,
        environment: current?.environment ?? "SANDBOX",
        vatStatus: connectionLabel(connected && hasScope(scopes, "vat"), current?.disconnectedAt),
        itsaStatus: connectionLabel(connected && hasScope(scopes, "self-assessment"), current?.disconnectedAt),
        connected,
        tokenExpiresAt: current?.tokenExpiresAt ?? null,
        lastHmrcInteraction: lastAt
          ? {
              at: (call && (!audit || call.createdAt >= audit.createdAt) ? call.createdAt : audit?.createdAt) ?? lastAt,
              actionType: audit?.actionType ?? "hmrc.request",
              method: call?.method ?? null,
              path: call?.path ?? null,
              statusCode: call?.statusCode ?? null,
            }
          : null,
      };
    });
  }

  async updateMe(user: AuthUser, dto: UpdateFirmDto) {
    const firm = await this.prisma.firm.update({
      where: { id: user.firmId },
      data: dto,
    });
    await this.audit.record({ actor: user, actionType: "firm.updated", metadata: { ...dto } });
    return this.publicFirm(firm);
  }

  private publicFirm(firm: { webhookSecret: string } & Record<string, unknown>) {
    const { webhookSecret: _secret, ...rest } = firm;
    return rest;
  }
}

function hasScope(scopes: string[], needle: string): boolean {
  if (!scopes.length) {
    return true;
  }
  return scopes.some((scope) => scope.toLowerCase().includes(needle));
}

function connectionLabel(connected: boolean, disconnectedAt?: Date | null): "connected" | "disconnected" | "not_connected" {
  if (connected) {
    return "connected";
  }
  if (disconnectedAt) {
    return "disconnected";
  }
  return "not_connected";
}
