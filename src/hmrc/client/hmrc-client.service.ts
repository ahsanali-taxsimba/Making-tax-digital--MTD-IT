import { Inject, Injectable, Logger, forwardRef } from "@nestjs/common";
import { HmrcEnvironment } from "@prisma/client";
import { AuditService } from "../../audit/audit.service";
import { HmrcHttpClient } from "../hmrc.http";
import { HmrcCallContext, HmrcHttpResult } from "../hmrc.types";
import { HmrcAppConfigService } from "../oauth/hmrc-app-config.service";
import { HmrcOAuthError } from "../oauth/hmrc-oauth.errors";
import { HmrcOAuthService } from "../oauth/hmrc-oauth.service";
import { parseHmrcEnvironment } from "../oauth/hmrc-oauth.utils";
import { HMRC_ERR, handleHMRCError, HmrcClientError } from "./hmrc-client.errors";
import { mockHmrcResponse } from "./hmrc-client.mock";
import { expandLiveCalls, mergeItsaObligations } from "./hmrc-client.routes";

export interface HmrcConnectionRef {
  id?: string;
  clientId: string;
  environment: HmrcEnvironment | string;
}

@Injectable()
export class HmrcClientService {
  private readonly logger = new Logger(HmrcClientService.name);

  constructor(
    @Inject(forwardRef(() => HmrcOAuthService)) private readonly oauth: HmrcOAuthService,
    private readonly http: HmrcHttpClient,
    private readonly apps: HmrcAppConfigService,
    private readonly audit: AuditService,
  ) {}

  getValidAccessToken(clientId: string, environment: "sandbox" | "live" | HmrcEnvironment | string): Promise<string> {
    return this.oauth.getValidAccessToken(clientId, parseHmrcEnvironment(String(environment)));
  }

  async get<T>(
    url: string,
    clientId: string,
    environment: "sandbox" | "live" | HmrcEnvironment | string = this.apps.defaultEnvironment(),
    options?: { query?: Record<string, string | undefined>; accept?: string },
  ): Promise<HmrcHttpResult<T>> {
    return this.request<T>("GET", url, clientId, environment, undefined, options);
  }

  async post<T>(
    url: string,
    body: unknown,
    clientId: string,
    environment: "sandbox" | "live" | HmrcEnvironment | string = this.apps.defaultEnvironment(),
    options?: { accept?: string },
  ): Promise<HmrcHttpResult<T>> {
    return this.request<T>("POST", url, clientId, environment, body, options);
  }

  async handleTokenRefresh(connection: HmrcConnectionRef): Promise<string> {
    try {
      return await this.getValidAccessToken(connection.clientId, connection.environment);
    } catch (error) {
      if (error instanceof HmrcClientError) {
        throw error;
      }
      throw new HmrcClientError(
        HMRC_ERR.TOKEN_REFRESH_FAILED,
        "HMRC token refresh failed",
        error instanceof Error ? { message: error.message } : undefined,
      );
    }
  }

  handleHMRCError(response: { status: number; body?: unknown; correlationId?: string }): never {
    throw handleHMRCError(response);
  }

  private async request<T>(
    method: "GET" | "POST",
    url: string,
    clientId: string,
    environment: string,
    body?: unknown,
    options?: { query?: Record<string, string | undefined>; accept?: string },
  ): Promise<HmrcHttpResult<T>> {
    const env = parseHmrcEnvironment(String(environment));
    if (!this.apps.isLiveMode()) {
      const mocked = mockHmrcResponse(method, url, body);
      if (mocked) {
        await this.audit.record({
          clientId,
          actionType: "hmrc.client.mock",
          metadata: { method, url, environment: env },
        });
        return mocked as HmrcHttpResult<T>;
      }
    }

    const token = await this.resolveToken(clientId, env);
    const ctx: HmrcCallContext = { clientId, environment: env, accessToken: token };
    const calls = expandLiveCalls(method, url, body) ?? [
      { path: url.split("?")[0], accept: options?.accept, body: method === "POST" ? body : undefined },
    ];

    try {
      const results = await Promise.all(
        calls.map((call) => this.sendWithRefresh(ctx, method, call.path, { ...options, accept: call.accept, body: call.body })),
      );
      const merged = this.mergeIfNeeded(url, results);
      await this.audit.record({
        clientId,
        actionType: "hmrc.client.call",
        metadata: { method, url, environment: env, correlationId: merged.correlationId, status: merged.status },
      });
      return merged as HmrcHttpResult<T>;
    } catch (error) {
      await this.audit.record({
        clientId,
        actionType: "hmrc.client.failed",
        metadata: {
          method,
          url,
          environment: env,
          errorCode: error instanceof HmrcClientError ? error.errorCode : "HMRC_ERR_CONNECTION",
        },
      });
      throw error;
    }
  }

  private async sendWithRefresh(
    ctx: HmrcCallContext,
    method: string,
    path: string,
    options?: { query?: Record<string, string | undefined>; body?: unknown; accept?: string },
  ) {
    let sent = await this.safeSend(ctx, method, path, options);
    if (sent.status === 401 && ctx.clientId) {
      ctx.accessToken = await this.handleTokenRefresh({ clientId: ctx.clientId, environment: ctx.environment });
      sent = await this.safeSend(ctx, method, path, options);
    }
    if (!sent.ok) {
      this.handleHMRCError({ status: sent.status, body: sent.body, correlationId: sent.correlationId });
    }
    return { data: sent.body, correlationId: sent.correlationId, status: sent.status };
  }

  private async safeSend(
    ctx: HmrcCallContext,
    method: string,
    path: string,
    options?: { query?: Record<string, string | undefined>; body?: unknown; accept?: string },
  ) {
    try {
      return await this.http.send(ctx, method, path, options);
    } catch {
      this.handleHMRCError({ status: 0, body: { message: "network" } });
    }
  }

  private mergeIfNeeded(url: string, results: Array<{ data: unknown; correlationId: string; status: number }>) {
    if (/\/income-tax\/[^/]+\/obligations$/.test(url.split("?")[0]) && results.length > 1) {
      return {
        data: { obligations: mergeItsaObligations(results.map((item) => (item.data ?? {}) as { obligations?: Array<Record<string, string>> })) },
        correlationId: results[0].correlationId,
        status: results[0].status,
      };
    }
    return results[0];
  }

  private async resolveToken(clientId: string, environment: HmrcEnvironment): Promise<string> {
    try {
      return await this.getValidAccessToken(clientId, environment);
    } catch (error) {
      if (!this.apps.isLiveMode() && !(error instanceof HmrcOAuthError && error.errorCode === "HMRC_OAUTH_ERR_REFRESH_FAILED")) {
        this.logger.debug(`Using mock access token for ${clientId}`);
        return "mock-access-token";
      }
      if (error instanceof HmrcClientError || error instanceof HmrcOAuthError) {
        throw new HmrcClientError(HMRC_ERR.TOKEN_REFRESH_FAILED, "Could not obtain a valid HMRC access token", {
          cause: error instanceof HmrcOAuthError ? error.errorCode : error.message,
        });
      }
      throw error;
    }
  }
}
