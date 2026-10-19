import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ClientsRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(firmId: string, clientId?: string | null) {
    return this.prisma.client.findMany({
      where: { firmId, ...(clientId ? { id: clientId } : {}) },
      include: { businesses: true, mtdConnections: { select: { id: true, environment: true, scopes: true, tokenExpiresAt: true } } },
      orderBy: { name: "asc" },
    });
  }

  findInFirm(firmId: string, id: string) {
    return this.prisma.client.findFirst({
      where: { id, firmId },
      include: { businesses: true },
    });
  }

  create(data: Prisma.ClientCreateInput) {
    return this.prisma.client.create({ data, include: { businesses: true } });
  }

  update(id: string, data: Prisma.ClientUpdateInput) {
    return this.prisma.client.update({ where: { id }, data, include: { businesses: true } });
  }

  delete(id: string) {
    return this.prisma.client.delete({ where: { id } });
  }
}
