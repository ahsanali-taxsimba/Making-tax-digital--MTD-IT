import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

const CLIENT_INCLUDE = {
  businesses: true,
  assignedUser: { select: { id: true, name: true, role: true, status: true } },
  mtdConnections: {
    select: { id: true, environment: true, scopes: true, tokenExpiresAt: true, disconnectedAt: true },
  },
} as const;

@Injectable()
export class ClientsRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(firmId: string, clientId?: string | null) {
    return this.prisma.client.findMany({
      where: { firmId, ...(clientId ? { id: clientId } : {}) },
      include: CLIENT_INCLUDE,
      orderBy: { name: "asc" },
    });
  }

  findInFirm(firmId: string, id: string) {
    return this.prisma.client.findFirst({
      where: { id, firmId },
      include: CLIENT_INCLUDE,
    });
  }

  findStaff(firmId: string, userId: string) {
    return this.prisma.user.findFirst({
      where: { id: userId, firmId, role: { not: "CLIENT" } },
    });
  }

  create(data: Prisma.ClientCreateInput) {
    return this.prisma.client.create({ data, include: CLIENT_INCLUDE });
  }

  update(id: string, data: Prisma.ClientUpdateInput) {
    return this.prisma.client.update({ where: { id }, data, include: CLIENT_INCLUDE });
  }

  delete(id: string) {
    return this.prisma.client.delete({ where: { id } });
  }
}
