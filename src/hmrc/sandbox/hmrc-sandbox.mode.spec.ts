import { hmrcCallsUpstream, hmrcUsesSandboxHost, parseHmrcMode, parseSandboxFlag, resolveRequestSandbox } from "./hmrc-sandbox.mode";

describe("HMRC sandbox mode", () => {
  it("parses mock, sandbox, and live", () => {
    expect(parseHmrcMode("mock")).toBe("mock");
    expect(parseHmrcMode("sandbox")).toBe("sandbox");
    expect(parseHmrcMode("test")).toBe("sandbox");
    expect(parseHmrcMode("live")).toBe("live");
    expect(parseHmrcMode("production")).toBe("live");
  });

  it("calls HMRC for sandbox and live, not mock", () => {
    expect(hmrcCallsUpstream("mock")).toBe(false);
    expect(hmrcCallsUpstream("sandbox")).toBe(true);
    expect(hmrcCallsUpstream("live")).toBe(true);
  });

  it("never uses the live host when mode is sandbox", () => {
    expect(hmrcUsesSandboxHost("sandbox", "live")).toBe(true);
    expect(hmrcUsesSandboxHost("live", "live")).toBe(false);
    expect(hmrcUsesSandboxHost("live", "sandbox")).toBe(true);
    expect(hmrcUsesSandboxHost("mock", "live")).toBe(true);
  });

  it("treats sandbox=true as a request flag", () => {
    expect(parseSandboxFlag("true")).toBe(true);
    expect(parseSandboxFlag(false)).toBe(false);
    expect(resolveRequestSandbox({ query: { sandbox: "true" }, mode: "live", defaultEnvironment: "live" })).toEqual({
      sandbox: true,
      environment: "sandbox",
    });
    expect(
      resolveRequestSandbox({
        headers: { "x-mtd-hmrc-sandbox": "false", "x-mtd-hmrc-environment": "live" },
        mode: "live",
        defaultEnvironment: "sandbox",
      }),
    ).toEqual({ sandbox: false, environment: "live" });
  });
});
