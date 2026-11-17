import { assertProductionConfig, parseCorsOrigins, ProductionConfigError } from "./validate-env";

describe("assertProductionConfig", () => {
  const valid: NodeJS.ProcessEnv = {
    NODE_ENV: "production",
    JWT_ACCESS_SECRET: "a".repeat(32),
    JWT_REFRESH_SECRET: "b".repeat(32),
    TOKEN_ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    FRONTEND_ORIGIN: "https://app.example.com",
    SUPABASE_URL: "https://abcdxyzabcdefgh.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role",
    SUPABASE_DB_URL: "postgresql://postgres:secret@db.abcdxyzabcdefgh.supabase.co:5432/postgres",
    HMRC_MODE: "mock",
  };

  it("allows a complete production configuration on Supabase", () => {
    expect(() => assertProductionConfig(valid)).not.toThrow();
  });

  it("rejects default JWT secrets and an open CORS origin", () => {
    expect(() =>
      assertProductionConfig({
        ...valid,
        JWT_ACCESS_SECRET: "dev-access-secret-change-me-please-32ch",
        FRONTEND_ORIGIN: "",
        VERCEL_URL: "",
      }),
    ).toThrow(ProductionConfigError);
  });

  it("requires HMRC credentials when HMRC_MODE=live", () => {
    expect(() =>
      assertProductionConfig({
        ...valid,
        HMRC_MODE: "live",
        HMRC_ENVIRONMENT: "sandbox",
      }),
    ).toThrow(/HMRC_MODE=live/);
  });

  it("rejects a local Postgres URL in production", () => {
    expect(() =>
      assertProductionConfig({
        ...valid,
        SUPABASE_DB_URL: "",
        DATABASE_URL: "postgresql://mtd:mtd@localhost:5432/mtd",
      }),
    ).toThrow(/Supabase/);
  });

  it("requires FRONTEND_ORIGIN even when VERCEL_URL is set", () => {
    expect(() =>
      assertProductionConfig({
        ...valid,
        FRONTEND_ORIGIN: "",
        VERCEL_URL: "mtd-it.vercel.app",
      }),
    ).toThrow(/FRONTEND_ORIGIN/);
  });

  it("skips checks outside production", () => {
    expect(() => assertProductionConfig({ NODE_ENV: "development" })).not.toThrow();
  });
});

describe("parseCorsOrigins", () => {
  it("splits a comma-separated allow-list", () => {
    expect(parseCorsOrigins("https://a.example, https://b.example")).toEqual([
      "https://a.example",
      "https://b.example",
    ]);
  });

  it("refuses a wildcard origin in production", () => {
    expect(parseCorsOrigins("", "production")).toBe(false);
  });
});
