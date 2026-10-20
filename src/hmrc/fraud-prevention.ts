import { FraudPreventionContext } from "./hmrc.types";

const BROWSER_KEYS = [
  "deviceId",
  "timezone",
  "localIps",
  "screens",
  "windowSize",
  "browserPlugins",
  "userAgent",
  "doNotTrack",
  "userIds",
  "multiFactor",
] as const;

const MAX_PAYLOAD_BYTES = 8192;

function headerValue(headers: Record<string, string | string[] | undefined> | undefined, name: string): string | undefined {
  if (!headers) return undefined;
  const direct = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(direct) ? direct[0] : direct;
}

function encodeValue(value: string): string {
  return encodeURIComponent(value);
}

function normalizeIp(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().replace(/^::ffff:/i, "");
  return trimmed || undefined;
}

/**
 * Browser-originated fraud fields only. Public IP/port are filled by the server
 * from the incoming request so clients cannot spoof Gov-Client-Public-IP.
 */
export function parseBrowserFraudPayload(raw?: string | string[] | null): FraudPreventionContext {
  const text = Array.isArray(raw) ? raw[0] : raw;
  if (!text || text.length > MAX_PAYLOAD_BYTES) {
    return {};
  }
  try {
    const parsed = JSON.parse(text) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const out: FraudPreventionContext = {};
    for (const key of BROWSER_KEYS) {
      const value = parsed[key];
      if (typeof value === "string" && value.trim() && value.length < 1024) {
        out[key] = value.trim();
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function clientPublicIp(
  headers?: Record<string, string | string[] | undefined>,
  fallback?: string | null,
): string | undefined {
  const forwarded = headerValue(headers, "x-forwarded-for");
  const first = forwarded?.split(",")[0];
  return normalizeIp(first) ?? normalizeIp(headerValue(headers, "x-real-ip")) ?? normalizeIp(fallback ?? undefined);
}

export function clientPublicPort(
  headers?: Record<string, string | string[] | undefined>,
  fallback?: string | null,
): string | undefined {
  const forwarded = headerValue(headers, "x-forwarded-port");
  const value = forwarded?.split(",")[0]?.trim() || fallback || undefined;
  return value && /^\d{1,5}$/.test(value) ? value : "443";
}

export function mergeFraudContext(
  browser: FraudPreventionContext | undefined,
  server: { publicIp?: string; publicPort?: string; vendorPublicIp?: string; userIds?: string },
): FraudPreventionContext {
  return {
    ...(browser ?? {}),
    publicIp: server.publicIp,
    publicPort: server.publicPort,
    vendorPublicIp: server.vendorPublicIp,
    userIds: browser?.userIds ?? server.userIds,
  };
}

/**
 * HMRC fraud-prevention headers for WEB_APP_VIA_SERVER.
 * Missing client-originated values are filled with documented placeholders so
 * sandbox calls are accepted; production overwrites them from the browser + edge IP.
 */
export function buildFraudPreventionHeaders(ctx?: FraudPreventionContext): Record<string, string> {
  const forwarded = ctx?.vendorForwarded ?? {};
  const timezone = ctx?.timezone ?? forwarded["Gov-Client-Timezone"] ?? "UTC+00:00";
  const screens = ctx?.screens ?? forwarded["Gov-Client-Screens"] ?? "width=1920&height=1080&scaling-factor=1&colour-depth=24";
  const windowSize = ctx?.windowSize ?? forwarded["Gov-Client-Window-Size"] ?? "width=1920&height=1080";
  const plugins = ctx?.browserPlugins ?? forwarded["Gov-Client-Browser-Plugins"] ?? "PDF Viewer";
  const userAgent = ctx?.userAgent ?? forwarded["Gov-Client-Browser-JS-User-Agent"] ?? "Mozilla/5.0";
  const userIds = ctx?.userIds ?? forwarded["Gov-Client-User-IDs"] ?? "os=unknown";
  const localIps = ctx?.localIps ?? forwarded["Gov-Client-Local-IPs"] ?? "127.0.0.1";
  const multiFactor = ctx?.multiFactor ?? forwarded["Gov-Client-Multi-Factor"] ?? "type=TOTP&timestamp=1970-01-01T00:00:00.000Z";
  return {
    "Gov-Client-Connection-Method": forwarded["Gov-Client-Connection-Method"] ?? "WEB_APP_VIA_SERVER",
    "Gov-Client-Public-IP": ctx?.publicIp ?? forwarded["Gov-Client-Public-IP"] ?? "127.0.0.1",
    "Gov-Client-Public-Port": ctx?.publicPort ?? forwarded["Gov-Client-Public-Port"] ?? "443",
    "Gov-Client-Device-ID": ctx?.deviceId ?? forwarded["Gov-Client-Device-ID"] ?? "00000000-0000-4000-8000-000000000000",
    "Gov-Client-User-IDs": encodeValue(userIds),
    "Gov-Client-Timezone": encodeValue(timezone),
    "Gov-Client-Local-IPs": encodeValue(localIps),
    "Gov-Client-Screens": encodeValue(screens),
    "Gov-Client-Window-Size": encodeValue(windowSize),
    "Gov-Client-Browser-Plugins": encodeValue(plugins),
    "Gov-Client-Browser-JS-User-Agent": encodeValue(userAgent),
    "Gov-Client-Browser-Do-Not-Track": ctx?.doNotTrack ?? forwarded["Gov-Client-Browser-Do-Not-Track"] ?? "false",
    "Gov-Client-Multi-Factor": encodeValue(multiFactor),
    "Gov-Vendor-Version": forwarded["Gov-Vendor-Version"] ?? encodeValue("mtd-platform=1.0.0"),
    "Gov-Vendor-Product-Name": forwarded["Gov-Vendor-Product-Name"] ?? encodeValue("Making Tax Digital IT"),
    "Gov-Vendor-Public-IP": ctx?.vendorPublicIp ?? forwarded["Gov-Vendor-Public-IP"] ?? "127.0.0.1",
    ...forwarded,
  };
}
