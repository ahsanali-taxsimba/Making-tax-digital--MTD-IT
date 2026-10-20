import { FraudPreventionContext } from "./hmrc.types";

/**
 * HMRC fraud-prevention headers for WEB_APP_VIA_SERVER.
 * Missing client-originated values are filled with documented placeholders so
 * sandbox calls are accepted; production must overwrite them from the browser.
 */
export function buildFraudPreventionHeaders(ctx?: FraudPreventionContext): Record<string, string> {
  const forwarded = ctx?.vendorForwarded ?? {};
  return {
    "Gov-Client-Connection-Method": forwarded["Gov-Client-Connection-Method"] ?? "WEB_APP_VIA_SERVER",
    "Gov-Client-Public-IP": ctx?.publicIp ?? forwarded["Gov-Client-Public-IP"] ?? "127.0.0.1",
    "Gov-Client-Public-Port": ctx?.publicPort ?? forwarded["Gov-Client-Public-Port"] ?? "443",
    "Gov-Client-Device-ID": ctx?.deviceId ?? forwarded["Gov-Client-Device-ID"] ?? "00000000-0000-4000-8000-000000000000",
    "Gov-Client-User-IDs": ctx?.userIds ?? forwarded["Gov-Client-User-IDs"] ?? "os=unknown",
    "Gov-Client-Timezone": ctx?.timezone ?? forwarded["Gov-Client-Timezone"] ?? "UTC+00:00",
    "Gov-Client-Local-IPs": ctx?.localIps ?? forwarded["Gov-Client-Local-IPs"] ?? "127.0.0.1",
    "Gov-Client-Screens": ctx?.screens ?? forwarded["Gov-Client-Screens"] ?? "width=1920&height=1080&scaling-factor=1&colour-depth=24",
    "Gov-Client-Window-Size": ctx?.windowSize ?? forwarded["Gov-Client-Window-Size"] ?? "width=1920&height=1080",
    "Gov-Client-Browser-Plugins": ctx?.browserPlugins ?? forwarded["Gov-Client-Browser-Plugins"] ?? "PDF%20Viewer",
    "Gov-Client-Browser-JS-User-Agent": ctx?.userAgent ?? forwarded["Gov-Client-Browser-JS-User-Agent"] ?? "Mozilla/5.0",
    "Gov-Client-Browser-Do-Not-Track": ctx?.doNotTrack ?? forwarded["Gov-Client-Browser-Do-Not-Track"] ?? "false",
    "Gov-Client-Multi-Factor": ctx?.multiFactor ?? forwarded["Gov-Client-Multi-Factor"] ?? "type=TOTP&timestamp=1970-01-01T00:00:00.000Z",
    "Gov-Vendor-Version": forwarded["Gov-Vendor-Version"] ?? "mtd-platform=1.0.0",
    "Gov-Vendor-Product-Name": forwarded["Gov-Vendor-Product-Name"] ?? "Making Tax Digital IT",
    "Gov-Vendor-Public-IP": ctx?.vendorPublicIp ?? forwarded["Gov-Vendor-Public-IP"] ?? "127.0.0.1",
    ...forwarded,
  };
}
