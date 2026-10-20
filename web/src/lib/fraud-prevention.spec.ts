import { collectFraudPrevention, fraudPreventionHeader } from "./fraud-prevention";

describe("browser fraud-prevention collector", () => {
  const memory = new Map<string, string>();

  beforeEach(() => {
    memory.clear();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        localStorage: {
          getItem: (key: string) => memory.get(key) ?? null,
          setItem: (key: string, value: string) => {
            memory.set(key, value);
          },
        },
        screen: { width: 1440, height: 900, colorDepth: 24 },
        innerWidth: 1200,
        innerHeight: 800,
        devicePixelRatio: 2,
      },
    });
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        userAgent: "Mozilla/5.0 TestBrowser",
        platform: "MacIntel",
        doNotTrack: "0",
        plugins: [{ name: "PDF Viewer" }],
      },
    });
  });

  it("collects device, screen, timezone, and user agent from the window", () => {
    const first = collectFraudPrevention("user-9");
    expect(first.deviceId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(first.screens).toContain("width=1440");
    expect(first.screens).toContain("scaling-factor=2");
    expect(first.windowSize).toBe("width=1200&height=800");
    expect(first.userAgent).toBe("Mozilla/5.0 TestBrowser");
    expect(first.userIds).toBe("mtd=user-9");
    expect(first.timezone).toMatch(/^UTC[+-]\d{2}:\d{2}$/);
    expect(collectFraudPrevention("user-9").deviceId).toBe(first.deviceId);
    expect(JSON.parse(fraudPreventionHeader("user-9")).deviceId).toBe(first.deviceId);
  });
});
