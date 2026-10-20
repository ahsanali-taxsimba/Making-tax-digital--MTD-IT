import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HmrcEnvironment } from "@prisma/client";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { mapHmrcError } from "./hmrc.errors";
import { buildFraudPreventionHeaders } from "./fraud-prevention";
import { HmrcCallContext, HmrcHttpResult } from "./hmrc.types";

@Injectable()
export class HmrcHttpClient {
  private readonly logger = new Logger(HmrcHttpClient.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  apiBase(environment: HmrcEnvironment): string {
    const live = this.config.get<string>("hmrc.live.baseUrl") ?? this.config.get<string>("hmrc.liveApiBase");
    const sandbox = this.config.get<string>("hmrc.sandbox.baseUrl") ?? this.config.get<string>("hmrc.sandboxApiBase");
    return environment === "LIVE" ? (live as string) : (sandbox as string);
  }

  authBase(environment: HmrcEnvironment): string {
    const live = this.config.get<string>("hmrc.live.authBaseUrl") ?? this.config.get<string>("hmrc.liveAuthBase");
    const sandbox = this.config.get<string>("hmrc.sandbox.authBaseUrl") ?? this.config.get<string>("hmrc.sandboxAuthBase");
    return environment === "LIVE" ? (live as string) : (sandbox as string);
  }

  async send(
    ctx: HmrcCallContext,
    method: string,
    path: string,
    options?: { query?: Record<string, string | undefined>; body?: unknown; accept?: string },
  ): Promise<{ ok: boolean; status: number; body: unknown; correlationId: string; path: string }> {
    const correlationId = randomUUID();
    const url = new URL(path, this.apiBase(ctx.environment));
    Object.entries(options?.query ?? {}).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value);
    });

    const headers: Record<string, string> = {
      Accept: options?.accept ?? "application/vnd.hmrc.1.0+json",
      Authorization: `Bearer ${ctx.accessToken}`,
      "X-Correlation-ID": correlationId,
      ...buildFraudPreventionHeaders(ctx.fraud),
    };
    if (options?.body) {
      headers["Content-Type"] = "application/json";
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: options?.body ? JSON.stringify(options.body) : undefined,
      });
      const text = await response.text();
      const body = text ? JSON.parse(text) : {};
      await this.persist(
        ctx.clientId,
        correlationId,
        method,
        `${url.pathname}${url.search}`,
        response.status,
        options?.body,
        body,
        response.ok ? undefined : "HMRC_ERROR",
      );
      return { ok: response.ok, status: response.status, body, correlationId, path: `${url.pathname}${url.search}` };
    } catch (error) {
      await this.persist(ctx.clientId, correlationId, method, path, 0, options?.body, undefined, "NETWORK_ERROR");
      this.logger.warn(`HMRC ${method} ${path} failed (${correlationId})`);
      throw error;
    }
  }

  async request<T>(
    ctx: HmrcCallContext,
    method: string,
    path: string,
    options?: { query?: Record<string, string | undefined>; body?: unknown; accept?: string },
  ): Promise<HmrcHttpResult<T>> {
    const sent = await this.send(ctx, method, path, options);
    if (!sent.ok) {
      throw mapHmrcError(sent.status, sent.body, sent.correlationId);
    }
    return { data: sent.body as T, correlationId: sent.correlationId, status: sent.status };
  }

  async persist(
    clientId: string | undefined,
    correlationId: string,
    method: string,
    path: string,
    statusCode: number,
    requestBody: unknown,
    responseBody: unknown,
    errorCode?: string,
  ) {
    await this.prisma.hmrcInteraction.create({
      data: {
        clientId,
        correlationId,
        method,
        path,
        statusCode,
        requestBody: requestBody ? JSON.parse(JSON.stringify(this.redact(requestBody))) : undefined,
        responseBody: responseBody ? JSON.parse(JSON.stringify(this.redact(responseBody))) : undefined,
        errorCode,
      },
    });
  }

  private redact(value: unknown): unknown {
    if (!value || typeof value !== "object") return value;
    const clone = { ...(value as Record<string, unknown>) };
    for (const key of Object.keys(clone)) {
      if (/token|secret|authorization|password/i.test(key)) {
        clone[key] = "[redacted]";
      }
    }
    return clone;
  }
}
