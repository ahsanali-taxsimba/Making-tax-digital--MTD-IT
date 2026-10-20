export default () => ({
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: parseInt(process.env.PORT ?? "3000", 10),
  appBaseUrl: process.env.APP_BASE_URL ?? "http://localhost:3000",
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? "http://localhost:2327",
  databaseUrl: process.env.DATABASE_URL,
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
  yapily: {
    mode: (process.env.YAPILY_MODE ?? "mock") as "mock" | "live",
    baseUrl: process.env.YAPILY_BASE_URL ?? "https://api.yapily.com",
    applicationKey: process.env.YAPILY_APPLICATION_KEY ?? "",
    applicationSecret: process.env.YAPILY_APPLICATION_SECRET ?? "",
    callbackUrl: process.env.YAPILY_CALLBACK_URL ?? "http://localhost:3000/yapily/consent/callback",
    defaultInstitution: process.env.YAPILY_DEFAULT_INSTITUTION ?? "modelo-sandbox",
  },
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL_SECONDS ?? "60", 10) * 1000,
    limit: parseInt(process.env.THROTTLE_LIMIT ?? "60", 10),
  },
  receipts: {
    driver: (process.env.RECEIPTS_STORAGE_DRIVER ?? "local") as "local" | "s3",
    localDir: process.env.RECEIPTS_LOCAL_DIR ?? "",
    s3: {
      endpoint: process.env.RECEIPTS_S3_ENDPOINT ?? process.env.S3_ENDPOINT ?? "",
      bucket: process.env.RECEIPTS_S3_BUCKET ?? process.env.S3_BUCKET ?? "receipts",
      region: process.env.RECEIPTS_S3_REGION ?? process.env.S3_REGION ?? "eu-west-2",
      accessKey: process.env.RECEIPTS_S3_ACCESS_KEY ?? process.env.S3_ACCESS_KEY ?? "",
      secretKey: process.env.RECEIPTS_S3_SECRET_KEY ?? process.env.S3_SECRET_KEY ?? "",
    },
  },
});
