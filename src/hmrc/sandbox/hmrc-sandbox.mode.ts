export type HmrcRuntimeMode = "mock" | "sandbox" | "live";

export function parseHmrcMode(value?: string | null): HmrcRuntimeMode {
  const normalised = String(value ?? "mock").trim().toLowerCase();
  if (normalised === "sandbox" || normalised === "test") return "sandbox";
  if (normalised === "live" || normalised === "prod" || normalised === "production") return "live";
  return "mock";
}

export function hmrcCallsUpstream(mode: HmrcRuntimeMode): boolean {
  return mode === "sandbox" || mode === "live";
}

export function hmrcUsesSandboxHost(mode: HmrcRuntimeMode, environment?: string | null): boolean {
  if (mode === "sandbox") return true;
  if (mode === "live") {
    const env = String(environment ?? "sandbox").toLowerCase();
    return env !== "live" && env !== "prod" && env !== "production";
  }
  return true;
}
