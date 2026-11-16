import { IncomingMessage } from "http";
import { Socket } from "net";
import { buildFraudPreventionHeaders } from "./fraud-prevention";
import {
  fraudContextFromRequest,
  isPlaceholderFraudContext,
  PLACEHOLDER_DEVICE_ID,
} from "./fraud-prevention.store";

describe("fraud prevention", () => {
  it("forwards Gov-Client headers and the caller IP from the request", () => {
    const req = {
      ip: "10.0.0.8",
      headers: {
        "gov-client-device-id": "11111111-1111-4111-8111-111111111111",
        "gov-client-timezone": "UTC+01:00",
        "gov-client-user-ids": "os=mac",
        "x-forwarded-for": "203.0.113.10, 10.0.0.1",
      },
      socket: { remoteAddress: "10.0.0.8" } as Socket,
    } as unknown as IncomingMessage & { ip?: string };

    const ctx = fraudContextFromRequest(req);
    expect(ctx.publicIp).toBe("203.0.113.10");
    expect(ctx.deviceId).toBe("11111111-1111-4111-8111-111111111111");
    expect(isPlaceholderFraudContext(ctx)).toBe(false);

    const headers = buildFraudPreventionHeaders(ctx);
    expect(headers["Gov-Client-Public-IP"]).toBe("203.0.113.10");
    expect(headers["Gov-Client-Device-ID"]).toBe("11111111-1111-4111-8111-111111111111");
    expect(headers["Gov-Client-Timezone"]).toBe("UTC+01:00");
  });

  it("treats missing telemetry as a placeholder", () => {
    expect(isPlaceholderFraudContext(undefined)).toBe(true);
    expect(
      isPlaceholderFraudContext({ publicIp: "127.0.0.1", deviceId: PLACEHOLDER_DEVICE_ID }),
    ).toBe(true);
  });
});
