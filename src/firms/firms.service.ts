import { Injectable, NotFoundException } from "@nestjs/common";
import { ObligationStatus, TaskStatus, UserRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AuthUser } from "../common/types";
import { UpdateFirmDto } from "./dto/firm.dto";

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

  async updateMe(user: AuthUser, dto: UpdateFirmDto) {
    const firm = await this.prisma.firm.update({
      where: { id: user.firmId },
      data: dto,
    });
    await this.audit.record({ actor: user, actionType: "firm.updated", metadata: { ...dto } });
    return this.publicFirm(firm);
  }

  async dashboard(user: AuthUser) {
    const firm = await this.me(user);
    const firmId = user.firmId;
    const now = new Date();
    const [
      staffCount,
      clientCount,
      openVatObligations,
      openItsaObligations,
      unmatchedBank,
      overdueInvoices,
      openTasks,
      documents,
      hmrcConnected,
      nextVat,
      nextItsa,
      taskRows,
    ] = await Promise.all([
      this.prisma.user.count({ where: { firmId, role: { not: UserRole.CLIENT } } }),
      this.prisma.client.count({ where: { firmId } }),
      this.prisma.vatObligation.count({
        where: { status: ObligationStatus.OPEN, client: { firmId } },
      }),
      this.prisma.itsaObligation.count({
        where: { status: ObligationStatus.OPEN, client: { firmId } },
      }),
      this.prisma.bankTransaction.count({
        where: { status: "UNMATCHED", bankAccount: { client: { firmId } } },
      }),
      this.prisma.salesInvoice.count({
        where: { client: { firmId }, dueDate: { lt: now }, status: { not: "VOID" } },
      }),
      this.prisma.task.count({
        where: { firmId, status: { in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS] } },
      }),
      this.prisma.supportingDocument.count({ where: { client: { firmId } } }),
      this.prisma.mtdConnection.count({
        where: { disconnectedAt: null, client: { firmId } },
      }),
      this.prisma.vatObligation.findFirst({
        where: { status: ObligationStatus.OPEN, client: { firmId } },
        include: { client: { select: { name: true } } },
        orderBy: { due: "asc" },
      }),
      this.prisma.itsaObligation.findFirst({
        where: { status: ObligationStatus.OPEN, client: { firmId } },
        include: { client: { select: { name: true } } },
        orderBy: { due: "asc" },
      }),
      this.prisma.task.groupBy({
        by: ["status"],
        where: { firmId },
        _count: { _all: true },
      }),
    ]);

    const byStatus = Object.fromEntries(taskRows.map((row) => [row.status, row._count._all]));
    return {
      firm,
      staffCount,
      clientCount,
      openVatObligations,
      openItsaObligations,
      openObligations: openVatObligations + openItsaObligations,
      unmatchedBank,
      overdueInvoices,
      openTasks,
      documents,
      receipts: 0,
      unattachedReceipts: 0,
      suggestedCategories: 0,
      suggestedMatches: 0,
      extractionReview: 0,
      hmrcConnected,
      nextVatDue: nextVat
        ? { due: nextVat.due.toISOString(), label: nextVat.periodKey, clientName: nextVat.client.name }
        : null,
      nextItsaDue: nextItsa
        ? { due: nextItsa.due.toISOString(), label: nextItsa.taxYear, clientName: nextItsa.client.name }
        : null,
      taskWorkload: [
        {
          userId: null,
          name: "Practice workload",
          role: null,
          status: null,
          open: byStatus[TaskStatus.OPEN] ?? 0,
          inProgress: byStatus[TaskStatus.IN_PROGRESS] ?? 0,
          waitingOnClient: 0,
          completed: byStatus[TaskStatus.COMPLETED] ?? 0,
        },
      ],
    };
  }

  async hmrcOverview(user: AuthUser) {
    const clients = await this.prisma.client.findMany({
      where: { firmId: user.firmId },
      include: { mtdConnections: true },
      orderBy: { name: "asc" },
    });
    return clients.flatMap((client) => {
      const connections = client.mtdConnections.length ? client.mtdConnections : [null];
      return connections.map((connection) => {
        const active = Boolean(connection && !connection.disconnectedAt);
        const scopes = connection?.scopes ?? [];
        const vat = scopes.some((scope) => scope.toLowerCase().includes("vat"));
        const itsa = scopes.some((scope) => /self-assessment|income/i.test(scope));
        return {
          clientId: client.id,
          clientName: client.name,
          environment: (connection?.environment ?? "SANDBOX").toLowerCase(),
          vatStatus: active && vat ? "connected" : connection?.disconnectedAt ? "disconnected" : "not_connected",
          itsaStatus: active && itsa ? "connected" : connection?.disconnectedAt ? "disconnected" : "not_connected",
          connected: active,
          tokenExpiresAt: connection?.tokenExpiresAt?.toISOString() ?? null,
        };
      });
    });
  }

  async workspaceDocuments(user: AuthUser) {
    const rows = await this.prisma.supportingDocument.findMany({
      where: { client: { firmId: user.firmId } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => ({
      id: row.id,
      clientId: row.clientId,
      fileName: row.fileName,
      type: row.mimeType,
      uploadedAt: row.createdAt.toISOString(),
    }));
  }

  async workspaceVatReturns(user: AuthUser) {
    const rows = await this.prisma.vatReturn.findMany({
      where: { client: { firmId: user.firmId } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => ({
      id: row.id,
      clientId: row.clientId,
      periodKey: row.periodKey,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async workspaceItsaSubmissions(user: AuthUser) {
    const [updates, eops, finals] = await Promise.all([
      this.prisma.itsaUpdate.findMany({ where: { client: { firmId: user.firmId } } }),
      this.prisma.itsaEndOfPeriodStatement.findMany({ where: { client: { firmId: user.firmId } } }),
      this.prisma.itsaFinalDeclaration.findMany({ where: { client: { firmId: user.firmId } } }),
    ]);
    return [
      ...updates.map((row) => ({
        id: row.id,
        clientId: row.clientId,
        taxYear: row.taxYear,
        status: row.status,
        kind: "quarterly" as const,
        label: "Quarterly update",
        periodId: row.periodId,
        createdAt: row.createdAt.toISOString(),
      })),
      ...eops.map((row) => ({
        id: row.id,
        clientId: row.clientId,
        taxYear: row.taxYear,
        status: row.status,
        kind: "eops" as const,
        label: "End of period",
        createdAt: row.createdAt.toISOString(),
      })),
      ...finals.map((row) => ({
        id: row.id,
        clientId: row.clientId,
        taxYear: row.taxYear,
        status: row.status,
        kind: "final" as const,
        label: "Final declaration",
        createdAt: row.createdAt.toISOString(),
      })),
    ];
  }

  private publicFirm(firm: { webhookSecret: string } & Record<string, unknown>) {
    const { webhookSecret: _secret, ...rest } = firm;
    return rest;
  }
}
