import { Injectable } from "@nestjs/common";
import { HmrcEnvironment, Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class HmrcOAuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  createState(data: Prisma.OauthStateCreateInput) {
    return this.prisma.oauthState.create({ data });
  }

  findState(state: string) {
    return this.prisma.oauthState.findUnique({ where: { state } });
  }

  deleteState(id: string) {
    return this.prisma.oauthState.delete({ where: { id } });
  }

  findConnection(clientId: string, environment: HmrcEnvironment) {
    return this.prisma.mtdConnection.findUnique({
      where: { clientId_environment: { clientId, environment } },
    });
  }

  listConnections(clientId: string, environment?: HmrcEnvironment) {
    return this.prisma.mtdConnection.findMany({
      where: { clientId, ...(environment ? { environment } : {}) },
      select: {
        id: true,
        environment: true,
        scopes: true,
        tokenExpiresAt: true,
        disconnectedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  upsertConnection(
    clientId: string,
    environment: HmrcEnvironment,
    data: {
      hmrcClientId: string;
      scopes: string[];
      accessTokenEnc: string;
      refreshTokenEnc: string;
      tokenExpiresAt: Date;
    },
  ) {
    return this.prisma.mtdConnection.upsert({
      where: { clientId_environment: { clientId, environment } },
      update: { ...data, disconnectedAt: null },
      create: {
        clientId,
        environment,
        ...data,
      },
    });
  }

  updateConnection(id: string, data: Prisma.MtdConnectionUpdateInput) {
    return this.prisma.mtdConnection.update({ where: { id }, data });
  }

  disconnect(id: string) {
    return this.prisma.mtdConnection.update({
      where: { id },
      data: { disconnectedAt: new Date() },
    });
  }

  expiringConnections(before: Date) {
    return this.prisma.mtdConnection.findMany({
      where: { disconnectedAt: null, tokenExpiresAt: { lte: before } },
    });
  }

  findClient(id: string) {
    return this.prisma.client.findUnique({ where: { id } });
  }
}
