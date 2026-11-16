import { Injectable } from "@nestjs/common";
import { AsyncLocalStorage } from "async_hooks";
import { IncomingMessage } from "http";
import { FraudPreventionContext } from "./hmrc.types";

const GOV_PREFIX = /^(gov-client-|gov-vendor-)/i;

@Injectable()
export class FraudPreventionStore {
  private readonly als = new AsyncLocalStorage<FraudPreventionContext>();

  run<T>(context: FraudPreventionContext, next: () => T): T {
    return this.als.run(context, next);
  }

  current(): FraudPreventionContext | undefined {
    return this.als.getStore();
  }
}

export function fraudContextFromRequest(req: IncomingMessage & { ip?: string }): FraudPreventionContext {
  const header = (name: string): string | undefined => {
    const value = req.headers[name.toLowerCase()];
    if (Array.isArray(value)) {
      return value[0];
    }
    return value;
  };

  const vendorForwarded: Record<string, string> = {};
  for (const [key, raw] of Object.entries(req.headers)) {
    if (!raw || !GOV_PREFIX.test(key)) {
      continue;
    }
    vendorForwarded[toGovHeaderName(key)] = Array.isArray(raw) ? raw[0] : raw;
  }

  const forwardedFor = header("x-forwarded-for");
  const publicIp =
    header("gov-client-public-ip") ??
    forwardedFor?.split(",")[0]?.trim() ??
    req.ip ??
    req.socket?.remoteAddress ??
    undefined;

  return {
    publicIp,
    timezone: header("gov-client-timezone"),
    userIds: header("gov-client-user-ids"),
    deviceId: header("gov-client-device-id"),
    vendorForwarded,
  };
}

export function toGovHeaderName(header: string): string {
  return header
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("-");
}

export const PLACEHOLDER_DEVICE_ID = "00000000-0000-4000-8000-000000000000";

export function isPlaceholderFraudContext(ctx?: FraudPreventionContext): boolean {
  if (!ctx) {
    return true;
  }
  const ip = ctx.publicIp ?? ctx.vendorForwarded?.["Gov-Client-Public-IP"];
  const device = ctx.deviceId ?? ctx.vendorForwarded?.["Gov-Client-Device-ID"];
  return !ip || ip === "127.0.0.1" || !device || device === PLACEHOLDER_DEVICE_ID;
}
