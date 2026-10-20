import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { YAPILY_ERR, YapilyError } from "./yapily.errors";

@Injectable()
export class YapilyHttpClient {
  constructor(private readonly config: ConfigService) {}

  async request<T>(path: string, init: RequestInit & { consentToken?: string } = {}): Promise<T> {
    const base = this.config.get<string>("yapily.baseUrl") ?? "https://api.yapily.com";
    const key = this.config.get<string>("yapily.applicationKey") ?? "";
    const secret = this.config.get<string>("yapily.applicationSecret") ?? "";
    if (!key || !secret) {
      throw new YapilyError(YAPILY_ERR.CONFIG_MISSING, "Yapily application key and secret are required in live mode");
    }
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}`);
    headers.set("Accept", "application/json");
    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    if (init.consentToken) {
      headers.set("Consent", init.consentToken);
    }
    const response = await fetch(`${base.replace(/\/$/, "")}${path}`, { ...init, headers });
    const body = (await response.json().catch(() => null)) as T | { error?: { message?: string } } | null;
    if (!response.ok) {
      throw new YapilyError(
        YAPILY_ERR.REQUEST_FAILED,
        (body as { error?: { message?: string } } | null)?.error?.message ?? `Yapily request failed (${response.status})`,
        { status: response.status, path },
        response.status >= 400 && response.status < 500 ? response.status : 502,
      );
    }
    return body as T;
  }
}
