import { applySupabaseEnv, resolveStorageDriver } from "./supabase";

export default () => {
  const supabase = applySupabaseEnv();
  return {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: parseInt(process.env.PORT ?? "3000", 10),
  appBaseUrl: process.env.APP_BASE_URL ?? "http://localhost:3000",
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? "http://localhost:2327",
  seedOnStart: process.env.SEED_ON_START === "true",
  databaseProvider: supabase.provider,
  supabase: {
    url: process.env.SUPABASE_URL ?? "",
    projectRef: supabase.projectRef,
    configured: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
  },
  storage: {
    driver: resolveStorageDriver(),
    localDir: process.env.STORAGE_LOCAL_DIR ?? "uploads",
    supabaseUrl: process.env.SUPABASE_URL ?? "",
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? "",
    supabaseBucket: process.env.SUPABASE_BUCKET ?? "mtd-documents",
    maxUploadBytes: parseInt(process.env.STORAGE_MAX_UPLOAD_BYTES ?? String(10 * 1024 * 1024), 10),
  },
  jobs: {
    obligationSyncMs: parseInt(process.env.OBLIGATION_SYNC_INTERVAL_MS ?? "900000", 10),
    webhookRetryMs: parseInt(process.env.WEBHOOK_RETRY_INTERVAL_MS ?? "60000", 10),
    webhookMaxAttempts: parseInt(process.env.WEBHOOK_MAX_ATTEMPTS ?? "5", 10),
  },
  databaseUrl: supabase.databaseUrl ?? process.env.DATABASE_URL,
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? "dev-access-secret-change-me-please-32ch",
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? "dev-refresh-secret-change-me-please-32",
    accessTtl: process.env.JWT_ACCESS_TTL ?? "15m",
    refreshTtlDays: parseInt(process.env.JWT_REFRESH_TTL_DAYS ?? "7", 10),
  },
  tokenEncryptionKey: process.env.TOKEN_ENCRYPTION_KEY ?? "",
  hmrc: {
    mode: (process.env.HMRC_MODE ?? "mock") as "mock" | "live",
    environment: (process.env.HMRC_ENVIRONMENT ?? "sandbox") as "sandbox" | "live" | "dev",
    clientId: process.env.HMRC_SANDBOX_CLIENT_ID || process.env.HMRC_CLIENT_ID || "",
    clientSecret: process.env.HMRC_SANDBOX_CLIENT_SECRET || process.env.HMRC_CLIENT_SECRET || "",
    redirectUri:
      process.env.HMRC_SANDBOX_REDIRECT_URI ||
      process.env.HMRC_REDIRECT_URI ||
      "http://localhost:3000/hmrc/oauth/callback",
    sandboxApiBase:
      process.env.HMRC_SANDBOX_BASE_URL ||
      process.env.HMRC_SANDBOX_API_BASE ||
      "https://test-api.service.hmrc.gov.uk",
    liveApiBase: process.env.HMRC_LIVE_BASE_URL || process.env.HMRC_LIVE_API_BASE || "https://api.service.hmrc.gov.uk",
    sandboxAuthBase: process.env.HMRC_SANDBOX_AUTH_BASE ?? "https://test-www.tax.service.gov.uk",
    liveAuthBase: process.env.HMRC_LIVE_AUTH_BASE ?? "https://www.tax.service.gov.uk",
    scopes: (process.env.HMRC_SCOPES ?? "read:vat write:vat read:self-assessment write:self-assessment")
      .split(/\s+/)
      .filter(Boolean),
    refreshSkewMs: parseInt(process.env.HMRC_TOKEN_REFRESH_SKEW_MS ?? "60000", 10),
    refreshIntervalMs: parseInt(process.env.HMRC_TOKEN_REFRESH_INTERVAL_MS ?? "300000", 10),
    requireFraudHeaders:
      process.env.HMRC_REQUIRE_FRAUD_HEADERS === "true" ||
      ((process.env.NODE_ENV ?? "development") === "production" && (process.env.HMRC_MODE ?? "mock") === "live"),
    sandbox: {
      clientId: process.env.HMRC_SANDBOX_CLIENT_ID || process.env.HMRC_CLIENT_ID || "",
      clientSecret: process.env.HMRC_SANDBOX_CLIENT_SECRET || process.env.HMRC_CLIENT_SECRET || "",
      redirectUri:
        process.env.HMRC_SANDBOX_REDIRECT_URI ||
        process.env.HMRC_REDIRECT_URI ||
        "http://localhost:3000/hmrc/oauth/callback",
      baseUrl:
        process.env.HMRC_SANDBOX_BASE_URL ||
        process.env.HMRC_SANDBOX_API_BASE ||
        "https://test-api.service.hmrc.gov.uk",
      authBaseUrl: process.env.HMRC_SANDBOX_AUTH_BASE ?? "https://test-www.tax.service.gov.uk",
    },
    live: {
      clientId: process.env.HMRC_LIVE_CLIENT_ID || process.env.HMRC_CLIENT_ID || "",
      clientSecret: process.env.HMRC_LIVE_CLIENT_SECRET || process.env.HMRC_CLIENT_SECRET || "",
      redirectUri:
        process.env.HMRC_LIVE_REDIRECT_URI ||
        process.env.HMRC_REDIRECT_URI ||
        "http://localhost:3000/hmrc/oauth/callback",
      baseUrl: process.env.HMRC_LIVE_BASE_URL || process.env.HMRC_LIVE_API_BASE || "https://api.service.hmrc.gov.uk",
      authBaseUrl: process.env.HMRC_LIVE_AUTH_BASE ?? "https://www.tax.service.gov.uk",
    },
  },
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL_SECONDS ?? "60", 10) * 1000,
    limit: parseInt(process.env.THROTTLE_LIMIT ?? "60", 10),
  },
  };
};
