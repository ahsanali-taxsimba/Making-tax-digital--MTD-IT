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

export function parseSandboxFlag(value?: string | boolean | number | null): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (value == null || value === "") return undefined;
  const normalised = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "sandbox"].includes(normalised)) return true;
  if (["0", "false", "no", "live"].includes(normalised)) return false;
  return undefined;
}

export function hmrcUsesSandboxHost(mode: HmrcRuntimeMode, environment?: string | null): boolean {
  if (mode === "sandbox") return true;
  if (mode === "live") {
    const env = String(environment ?? "sandbox").toLowerCase();
    return env !== "live" && env !== "prod" && env !== "production";
  }
  return true;
}

export interface HmrcRequestScope {
  environment: "sandbox" | "live";
  sandbox: boolean;
}

function headerValue(headers: Record<string, string | string[] | undefined> | undefined, name: string): string | undefined {
  if (!headers) return undefined;
  const direct = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(direct) ? direct[0] : direct;
}

/**
 * Resolve sandbox vs live for one API request.
 * `sandbox=true` (query, JSON body, or `x-mtd-hmrc-sandbox`) always wins.
 */
export function resolveRequestSandbox(input: {
  query?: Record<string, unknown>;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
  mode?: string | null;
  defaultEnvironment?: string | null;
  envSandbox?: string | boolean | null;
}): HmrcRequestScope {
  const body = (input.body ?? {}) as Record<string, unknown>;
  const flagged =
    parseSandboxFlag(input.query?.sandbox as string | boolean | undefined) ??
    parseSandboxFlag(headerValue(input.headers, "x-mtd-hmrc-sandbox")) ??
    parseSandboxFlag(body.sandbox as string | boolean | undefined) ??
    parseSandboxFlag(input.envSandbox);
  const requestedEnv = String(
    input.query?.environment ?? headerValue(input.headers, "x-mtd-hmrc-environment") ?? body.environment ?? input.defaultEnvironment ?? "sandbox",
  ).toLowerCase();
  const mode = parseHmrcMode(input.mode);
  const sandbox = flagged === true || (flagged !== false && hmrcUsesSandboxHost(mode, requestedEnv));
  return {
    sandbox,
    environment: sandbox ? "sandbox" : "live",
  };
}
