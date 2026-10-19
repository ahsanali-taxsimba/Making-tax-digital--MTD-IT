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
    environment: (process.env.HMRC_ENVIRONMENT ?? "sandbox") as "sandbox" | "live",
    clientId: process.env.HMRC_CLIENT_ID ?? "",
    clientSecret: process.env.HMRC_CLIENT_SECRET ?? "",
    redirectUri: process.env.HMRC_REDIRECT_URI ?? "http://localhost:3000/mtd/callback",
    sandboxApiBase: process.env.HMRC_SANDBOX_API_BASE ?? "https://test-api.service.hmrc.gov.uk",
    liveApiBase: process.env.HMRC_LIVE_API_BASE ?? "https://api.service.hmrc.gov.uk",
    sandboxAuthBase: process.env.HMRC_SANDBOX_AUTH_BASE ?? "https://test-www.tax.service.gov.uk",
    liveAuthBase: process.env.HMRC_LIVE_AUTH_BASE ?? "https://www.tax.service.gov.uk",
    scopes: (process.env.HMRC_SCOPES ?? "read:vat write:vat read:self-assessment write:self-assessment")
      .split(/\s+/)
      .filter(Boolean),
  },
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL_SECONDS ?? "60", 10) * 1000,
    limit: parseInt(process.env.THROTTLE_LIMIT ?? "60", 10),
  },
});
