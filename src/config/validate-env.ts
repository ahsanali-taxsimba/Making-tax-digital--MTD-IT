const DEV_JWT_MARKERS = ["change-me", "dev-access-secret", "dev-refresh-secret"];

export class ProductionConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductionConfigError";
  }
}

export function isProductionEnv(nodeEnv?: string): boolean {
  return (nodeEnv ?? process.env.NODE_ENV) === "production";
}

export function assertProductionConfig(env: NodeJS.ProcessEnv = process.env): void {
  if (!isProductionEnv(env.NODE_ENV)) {
    return;
  }

  const problems: string[] = [];
  const access = env.JWT_ACCESS_SECRET ?? "";
  const refresh = env.JWT_REFRESH_SECRET ?? "";
  if (!access || access.length < 32 || DEV_JWT_MARKERS.some((marker) => access.includes(marker))) {
    problems.push("JWT_ACCESS_SECRET must be a unique value of at least 32 characters");
  }
  if (!refresh || refresh.length < 32 || DEV_JWT_MARKERS.some((marker) => refresh.includes(marker))) {
    problems.push("JWT_REFRESH_SECRET must be a unique value of at least 32 characters");
  }
  if (!/^[0-9a-fA-F]{64}$/.test(env.TOKEN_ENCRYPTION_KEY ?? "")) {
    problems.push("TOKEN_ENCRYPTION_KEY must be 32 bytes encoded as 64 hex characters");
  }
  if (!env.FRONTEND_ORIGIN) {
    problems.push("FRONTEND_ORIGIN must be set so CORS is not left open");
  }
  if (!env.DATABASE_URL) {
    problems.push("DATABASE_URL is required");
  }
  if ((env.HMRC_MODE ?? "mock") === "live") {
    const sandboxId = env.HMRC_SANDBOX_CLIENT_ID || env.HMRC_CLIENT_ID;
    const liveId = env.HMRC_LIVE_CLIENT_ID || env.HMRC_CLIENT_ID;
    const envName = (env.HMRC_ENVIRONMENT ?? "sandbox").toLowerCase();
    const clientId = envName === "live" ? liveId : sandboxId;
    const secret =
      envName === "live"
        ? env.HMRC_LIVE_CLIENT_SECRET || env.HMRC_CLIENT_SECRET
        : env.HMRC_SANDBOX_CLIENT_SECRET || env.HMRC_CLIENT_SECRET;
    if (!clientId || !secret) {
      problems.push("HMRC_MODE=live requires HMRC client id and secret for the selected environment");
    }
  }
  if ((env.STORAGE_DRIVER ?? "local") === "supabase") {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      problems.push("STORAGE_DRIVER=supabase requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    }
  }

  if (problems.length > 0) {
    throw new ProductionConfigError(`Production configuration is incomplete:\n- ${problems.join("\n- ")}`);
  }
}

export function parseCorsOrigins(frontendOrigin?: string, nodeEnv?: string): string[] | boolean {
  const origins = (frontendOrigin ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (origins.length > 0) {
    return origins;
  }
  return isProductionEnv(nodeEnv) ? false : true;
}
