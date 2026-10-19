import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HmrcEnvironment } from "@prisma/client";
import { randomUUID } from "crypto";
import { AuditService } from "../audit/audit.service";
import { ClientsService } from "../clients/clients.service";
import { TokenCryptoService } from "../common/crypto/token-crypto.service";
import { AuthUser } from "../common/types";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { WebhooksService } from "../webhooks/webhooks.service";
import { HmrcCallContext, HmrcOAuthGateway } from "./hmrc.types";
import { HMRC_OAUTH } from "./hmrc.tokens";

@Injectable()
export class MtdConnectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clients: ClientsService,
    private readonly crypto: TokenCryptoService,
    @Inject(HMRC_OAUTH) private readonly oauth: HmrcOAuthGateway,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly webhooks: WebhooksService,
    private readonly notifications: NotificationsService,
  ) {}

  async startAuth(user: AuthUser, clientId: string) {
    const client = await this.clients.get(user, clientId);
    const environment = this.environment();
    const state = randomUUID();
    const scopes = this.config.get<string[]>("hmrc.scopes") ?? [];
    await this.prisma.oauthState.create({
      data: {
        state,
        clientId: client.id,
        userId: user.id,
        environment,
        scopes,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });
    const redirectUrl = this.oauth.buildAuthorizeUrl({ state, scopes, environment });
    await this.audit.record({
      actor: user,
      clientId: client.id,
      actionType: "mtd.auth.started",
      metadata: { environment },
    });
    return { redirectUrl, state, environment };
  }

  async handleCallback(query: { code?: string; state?: string; error?: string; error_description?: string }) {
    if (query.error || !query.code || !query.state) {
      throw new BadRequestException(query.error_description ?? "HMRC authorisation was denied");
    }
    const stored = await this.prisma.oauthState.findUnique({ where: { state: query.state } });
    if (!stored || stored.expiresAt < new Date()) {
      throw new BadRequestException("OAuth state is invalid or expired");
    }
    const tokens = await this.oauth.exchangeCode({ code: query.code, environment: stored.environment });
    const connection = await this.prisma.mtdConnection.upsert({
      where: { clientId_environment: { clientId: stored.clientId, environment: stored.environment } },
      update: {
        hmrcClientId: this.config.get<string>("hmrc.clientId") ?? "unknown",
        scopes: tokens.scope.split(/\s+/).filter(Boolean),
        accessTokenEnc: this.crypto.encrypt(tokens.accessToken),
        refreshTokenEnc: this.crypto.encrypt(tokens.refreshToken),
        tokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
      },
      create: {
        clientId: stored.clientId,
        hmrcClientId: this.config.get<string>("hmrc.clientId") ?? "unknown",
        scopes: tokens.scope.split(/\s+/).filter(Boolean),
        accessTokenEnc: this.crypto.encrypt(tokens.accessToken),
        refreshTokenEnc: this.crypto.encrypt(tokens.refreshToken),
        tokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
        environment: stored.environment,
      },
    });
    await this.prisma.oauthState.delete({ where: { id: stored.id } });
    const client = await this.prisma.client.findUnique({ where: { id: stored.clientId } });
    await this.audit.record({
      firmId: client?.firmId,
      clientId: stored.clientId,
      actionType: "mtd.connection.created",
      metadata: { environment: stored.environment, scopes: connection.scopes },
    });
    if (client) {
      await this.webhooks.emit(client.firmId, "MTD_CONNECTION_CREATED", {
        clientId: client.id,
        environment: stored.environment,
      });
    }
    return {
      connected: true,
      clientId: stored.clientId,
      environment: stored.environment,
      tokenExpiresAt: connection.tokenExpiresAt,
    };
  }

  async status(user: AuthUser, clientId: string) {
    await this.clients.get(user, clientId);
    const connections = await this.prisma.mtdConnection.findMany({
      where: { clientId },
      select: { id: true, environment: true, scopes: true, tokenExpiresAt: true, createdAt: true, updatedAt: true },
    });
    return { connected: connections.length > 0, connections };
  }

  async getCallContext(clientId: string): Promise<HmrcCallContext> {
    const environment = this.environment();
    const connection = await this.prisma.mtdConnection.findUnique({
      where: { clientId_environment: { clientId, environment } },
    });
    if (!connection) {
      throw new NotFoundException("Client is not connected to HMRC");
    }
    let accessToken = this.crypto.decrypt(connection.accessTokenEnc);
    if (connection.tokenExpiresAt.getTime() - Date.now() < 60_000) {
      const refreshed = await this.oauth.refresh({
        refreshToken: this.crypto.decrypt(connection.refreshTokenEnc),
        environment,
      });
      accessToken = refreshed.accessToken;
      await this.prisma.mtdConnection.update({
        where: { id: connection.id },
        data: {
          accessTokenEnc: this.crypto.encrypt(refreshed.accessToken),
          refreshTokenEnc: this.crypto.encrypt(refreshed.refreshToken),
          tokenExpiresAt: new Date(Date.now() + refreshed.expiresIn * 1000),
        },
      });
    } else if (connection.tokenExpiresAt.getTime() - Date.now() < 48 * 60 * 60 * 1000) {
      const client = await this.prisma.client.findUnique({ where: { id: clientId } });
      if (client) {
        await this.notifications.notify({
          firmId: client.firmId,
          type: "TOKEN_EXPIRING",
          title: "HMRC token expiring soon",
          body: `${client.name} needs to re-authorise HMRC access soon.`,
          metadata: { clientId },
        });
      }
    }
    return { environment, accessToken, clientId };
  }

  private environment(): HmrcEnvironment {
    return this.config.get<string>("hmrc.environment") === "live" ? "LIVE" : "SANDBOX";
  }
}
