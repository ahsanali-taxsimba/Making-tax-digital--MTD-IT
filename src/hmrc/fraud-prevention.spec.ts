import {
  buildFraudPreventionHeaders,
  clientPublicIp,
  clientPublicPort,
  mergeFraudContext,
  parseBrowserFraudPayload,
} from "./fraud-prevention";

describe("fraud-prevention headers", () => {
  it("accepts browser JSON and ignores spoofed public IP fields", () => {
    const parsed = parseBrowserFraudPayload(
      JSON.stringify({
        deviceId: "11111111-1111-4111-8111-111111111111",
        timezone: "UTC+01:00",
        screens: "width=1440&height=900&scaling-factor=2&colour-depth=24",
        windowSize: "width=1200&height=800",
        userAgent: "Mozilla/5.0 Test",
        doNotTrack: "false",
        browserPlugins: "PDF Viewer",
        userIds: "mtd=user-1",
        publicIp: "1.2.3.4",
        vendorPublicIp: "9.9.9.9",
        vendorForwarded: { "Gov-Client-Public-IP": "8.8.8.8" },
      }),
    );
    expect(parsed.deviceId).toBe("11111111-1111-4111-8111-111111111111");
    expect(parsed.timezone).toBe("UTC+01:00");
    expect(parsed.publicIp).toBeUndefined();
    expect(parsed.vendorPublicIp).toBeUndefined();
    expect(parsed.vendorForwarded).toBeUndefined();
  });

  it("rejects oversized or invalid payloads", () => {
    expect(parseBrowserFraudPayload("not-json")).toEqual({});
    expect(parseBrowserFraudPayload("x".repeat(9000))).toEqual({});
  });

  it("takes the first X-Forwarded-For hop as the client public IP", () => {
    expect(clientPublicIp({ "x-forwarded-for": "81.2.69.142, 10.0.0.1" }, "127.0.0.1")).toBe("81.2.69.142");
    expect(clientPublicIp({ "x-real-ip": "::ffff:203.0.113.9" })).toBe("203.0.113.9");
    expect(clientPublicPort({ "x-forwarded-port": "8443" })).toBe("8443");
    expect(clientPublicPort({})).toBe("443");
  });

  it("lets the server-observed IP win over browser values", () => {
    const merged = mergeFraudContext(
      { deviceId: "dev-1", timezone: "UTC+01:00", publicIp: "1.1.1.1" },
      { publicIp: "81.2.69.142", publicPort: "443", vendorPublicIp: "203.0.113.10" },
    );
    expect(merged.publicIp).toBe("81.2.69.142");
    expect(merged.deviceId).toBe("dev-1");
    const headers = buildFraudPreventionHeaders(merged);
    expect(headers["Gov-Client-Public-IP"]).toBe("81.2.69.142");
    expect(headers["Gov-Client-Connection-Method"]).toBe("WEB_APP_VIA_SERVER");
    expect(headers["Gov-Client-Timezone"]).toBe("UTC%2B01%3A00");
    expect(headers["Gov-Client-Device-ID"]).toBe("dev-1");
  });
});
