import { FraudPreventionContext } from "./hmrc.types";

export function buildFraudPreventionHeaders(ctx?: FraudPreventionContext): Record<string, string> {
  const forwarded = ctx?.vendorForwarded ?? {};
  return {
    "Gov-Client-Connection-Method": forwarded["Gov-Client-Connection-Method"] ?? "WEB_APP_VIA_SERVER",
    "Gov-Vendor-Version": "mtd-platform=1.0.0",
    "Gov-Vendor-Product-Name": "Making Tax Digital IT",
    "Gov-Client-Timezone": ctx?.timezone ?? "UTC+00:00",
    "Gov-Client-Public-IP": ctx?.publicIp ?? "127.0.0.1",
    "Gov-Client-User-IDs": ctx?.userIds ?? "os=unknown",
    "Gov-Client-Device-ID": ctx?.deviceId ?? "00000000-0000-4000-8000-000000000000",
    ...forwarded,
  };
}
