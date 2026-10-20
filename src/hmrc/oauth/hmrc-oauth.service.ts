import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { HmrcEnvironment } from "@prisma/client";
import { randomBytes } from "crypto";
import { AuditService } from "../../audit/audit.service";
import { ClientsService } from "../../clients/clients.service";
import { TokenCryptoService } from "../../common/crypto/token-crypto.service";
import { AuthUser } from "../../common/types";
import { NotificationsService } from "../../notifications/notifications.service";
import { WebhooksService } from "../../webhooks/webhooks.service";
import { HmrcApiError } from "../hmrc.errors";
import { HMRC_OAUTH } from "../hmrc.tokens";
import { HmrcCallContext, HmrcOAuthGateway } from "../hmrc.types";
import { HmrcAppConfigService } from "./hmrc-app-config.service";
import { HMRC_OAUTH_ERR, HmrcOAuthError } from "./hmrc-oauth.errors";
import { HmrcOAuthRepository } from "./hmrc-oauth.repository";
import {
  buildHmrcAuthorizeUrl,
  matchesRedirectUri,
  needsRefresh,
  parseHmrcEnvironment,
  tokenExpiresAt,
} from "./hmrc-oauth.utils";

@Injectable()
export class HmrcOAuthService {
  constructor(
    private readonly repo: HmrcOAuthRepository,
    private readonly clients: ClientsService,
    private readonly crypto: TokenCryptoService,
    @Inject(HMRC_OAUTH) private readonly oauth: HmrcOAuthGateway,
    private readonly apps: HmrcAppConfigService,
    private readonly audit: AuditService,
    private readonly webhooks: WebhooksService,
    private readonly notifications: NotificationsService,
  ) {}

  startAuthUrl(clientId: string, environment: string, state?: string, scopes?: string[]): string {
    const env = parseHmrcEnvironment(environment);
    const app = this.apps.requireSettings(env);
    return buildHmrcAuthorizeUrl(app, state ?? randomBytes(24).toString("hex"), scopes ?? this.apps.scopes());
  }

  async startAuth(user: AuthUser, clientId: string, environment?: string) {
    const client = await this.clients.get(user, clientId);
    const env = environment ? parseHmrcEnvironment(environment) : this.apps.defaultEnvironment();
    const app = this.apps.requireSettings(env);
    const state = randomBytes(24).toString("hex");
    const scopes = this.apps.scopes();
    await this.repo.createState({
      state,
      clientId: client.id,
      userId: user.id,
      environment: env,
      scopes,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });
    const authorizationUrl = this.startAuthUrl(client.id, env, state, scopes);
    await this.audit.record({
      actor: user,
      clientId: client.id,
      actionType: "hmrc.oauth.started",
      metadata: { environment: env, redirectUri: app.redirectUri },
    });
    return {
      authorizationUrl,
      redirectUrl: authorizationUrl,
      state,
      environment: env,
      redirectUri: app.redirectUri,
      mode: this.apps.isLiveMode() ? "live" : "mock",
    };
  }

  async handleCallback(query: {
    code?: string;
    state?: string;
    environment?: string;
    redirect_uri?: string;
    error?: string;
    error_description?: string;
  }) {
    if (query.error || !query.code || !query.state) {
      throw new HmrcOAuthError(
        HMRC_OAUTH_ERR.TOKEN_EXCHANGE_FAILED,
        query.error_description ?? "HMRC authorisation was denied",
        { error: query.error },
      );
    }
    const stored = await this.repo.findState(query.state);
    if (!stored || stored.expiresAt < new Date()) {
      throw new HmrcOAuthError(HMRC_OAUTH_ERR.INVALID_STATE, "OAuth state is invalid or expired");
    }
    if (query.environment && parseHmrcEnvironment(query.environment) !== stored.environment) {
      throw new HmrcOAuthError(HMRC_OAUTH_ERR.INVALID_STATE, "OAuth state does not match the requested environment");
    }
    const app = this.apps.requireSettings(stored.environment);
    if (!matchesRedirectUri(app.redirectUri, query.redirect_uri)) {
      throw new HmrcOAuthError(HMRC_OAUTH_ERR.INVALID_STATE, "redirect_uri does not match the configured environment");
    }

    let tokens: { accessToken: string; refreshToken: string; expiresIn: number; scope: string };
    try {
      tokens = await this.oauth.exchangeCode({ code: query.code, environment: stored.environment });
    } catch (error) {
      throw this.wrap(HMRC_OAUTH_ERR.TOKEN_EXCHANGE_FAILED, "HMRC token exchange failed", error);
    }

    const connection = await this.repo.upsertConnection(stored.clientId, stored.environment, {
      hmrcClientId: app.clientId || "unknown",
      scopes: tokens.scope.split(/\s+/).filter(Boolean),
      accessTokenEnc: this.crypto.encrypt(tokens.accessToken),
      refreshTokenEnc: this.crypto.encrypt(tokens.refreshToken),
      tokenExpiresAt: tokenExpiresAt(tokens.expiresIn),
    });
    await this.repo.deleteState(stored.id);
    const client = await this.repo.findClient(stored.clientId);
    await this.audit.record({
      firmId: client?.firmId,
      clientId: stored.clientId,
      actionType: "hmrc.oauth.connected",
      metadata: { environment: stored.environment, scopes: connection.scopes, expiresAt: connection.tokenExpiresAt },
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

  async getConnectionStatus(clientId: string, environment?: string) {
    const env = environment ? parseHmrcEnvironment(environment) : undefined;
    const connections = await this.repo.listConnections(clientId, env);
    const active = connections.filter((item) => !item.disconnectedAt);
    const current = env ? active.find((item) => item.environment === env) : active[0];
    return {
      connected: Boolean(current),
      expiresAt: current?.tokenExpiresAt ?? null,
      environment: current?.environment ?? env ?? null,
      connections: active,
    };
  }

  async status(user: AuthUser, clientId: string, environment?: string) {
    await this.clients.get(user, clientId);
    return this.getConnectionStatus(clientId, environment);
  }

  async getValidAccessToken(clientId: string, environment: "sandbox" | "live" | HmrcEnvironment): Promise<string> {
    const ctx = await this.getCallContext(clientId, environment);
    return ctx.accessToken;
  }

  async getCallContext(clientId: string, environment?: string | HmrcEnvironment): Promise<HmrcCallContext> {
    const env = environment ? parseHmrcEnvironment(String(environment)) : this.apps.defaultEnvironment();
    const connection = await this.repo.findConnection(clientId, env);
    if (!connection || connection.disconnectedAt) {
      throw new NotFoundException("Client is not connected to HMRC");
    }
    let accessToken = this.crypto.decrypt(connection.accessTokenEnc);
    if (needsRefresh(connection.tokenExpiresAt, this.apps.refreshSkewMs())) {
      accessToken = await this.refreshConnection(connection.id, clientId, env);
    } else if (connection.tokenExpiresAt.getTime() - Date.now() < 48 * 60 * 60 * 1000) {
      const client = await this.repo.findClient(clientId);
      if (client) {
        await this.notifications.notify({
          firmId: client.firmId,
          type: "TOKEN_EXPIRING",
          title: "HMRC token expiring soon",
          body: `${client.name} needs to re-authorise HMRC access soon.`,
          metadata: { clientId, environment: env },
        });
      }
    }
    return { environment: env, accessToken, clientId };
  }

  async refreshNow(user: AuthUser, clientId: string, environment?: string) {
    const client = await this.clients.get(user, clientId);
    const env = environment ? parseHmrcEnvironment(environment) : this.apps.defaultEnvironment();
    await this.getValidAccessToken(client.id, env);
    await this.audit.record({
      actor: user,
      clientId: client.id,
      actionType: "hmrc.oauth.refresh_requested",
      metadata: { environment: env },
    });
    return this.getConnectionStatus(client.id, env);
  }

  async disconnect(user: AuthUser, clientId: string, environment?: string) {
    const client = await this.clients.get(user, clientId);
    const env = environment ? parseHmrcEnvironment(environment) : this.apps.defaultEnvironment();
    const connection = await this.repo.findConnection(client.id, env);
    if (!connection || connection.disconnectedAt) {
      return { connected: false, clientId: client.id, environment: env };
    }
    try {
      await this.oauth.revoke?.({
        token: this.crypto.decrypt(connection.refreshTokenEnc),
        environment: env,
      });
    } catch {
      await this.audit.record({
        actor: user,
        clientId: client.id,
        actionType: "hmrc.oauth.revoke_failed",
        metadata: { environment: env },
      });
    }
    await this.repo.disconnect(connection.id);
    await this.audit.record({
      actor: user,
      clientId: client.id,
      actionType: "hmrc.oauth.disconnected",
      metadata: { environment: env },
    });
    return { connected: false, clientId: client.id, environment: env };
  }

  async refreshExpiring(): Promise<number> {
    const skew = this.apps.refreshSkewMs();
    const rows = await this.repo.expiringConnections(new Date(Date.now() + skew));
    let refreshed = 0;
    for (const row of rows) {
      try {
        await this.refreshConnection(row.id, row.clientId, row.environment);
        refreshed += 1;
      } catch {
        await this.audit.record({
          clientId: row.clientId,
          actionType: "hmrc.oauth.refresh_failed",
          metadata: { environment: row.environment, connectionId: row.id },
        });
      }
    }
    return refreshed;
  }

  private async refreshConnection(connectionId: string, clientId: string, environment: HmrcEnvironment): Promise<string> {
    const connection = await this.repo.findConnection(clientId, environment);
    if (!connection || connection.disconnectedAt) {
      throw new HmrcOAuthError(HMRC_OAUTH_ERR.REFRESH_FAILED, "HMRC connection is not available to refresh");
    }
    try {
      const refreshed = await this.oauth.refresh({
        refreshToken: this.crypto.decrypt(connection.refreshTokenEnc),
        environment,
      });
      await this.repo.updateConnection(connectionId, {
        accessTokenEnc: this.crypto.encrypt(refreshed.accessToken),
        refreshTokenEnc: this.crypto.encrypt(refreshed.refreshToken),
        tokenExpiresAt: tokenExpiresAt(refreshed.expiresIn),
      });
      await this.audit.record({
        clientId,
        actionType: "hmrc.oauth.refreshed",
        metadata: { environment, connectionId },
      });
      return refreshed.accessToken;
    } catch (error) {
      throw this.wrap(HMRC_OAUTH_ERR.REFRESH_FAILED, "HMRC token refresh failed", error);
    }
  }

  private wrap(code: (typeof HMRC_OAUTH_ERR)[keyof typeof HMRC_OAUTH_ERR], message: string, error: unknown) {
    if (error instanceof HmrcOAuthError) {
      return error;
    }
    const details =
      error instanceof HmrcApiError
        ? { code: error.code, message: error.message, statusCode: error.statusCode }
        : error instanceof Error
          ? { message: error.message }
          : undefined;
    return new HmrcOAuthError(code, message, details);
  }
}
