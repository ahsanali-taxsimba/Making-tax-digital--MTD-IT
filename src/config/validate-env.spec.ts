import { assertProductionConfig, parseCorsOrigins, ProductionConfigError } from "./validate-env";

describe("assertProductionConfig", () => {
  const valid: NodeJS.ProcessEnv = {
    NODE_ENV: "production",
    JWT_ACCESS_SECRET: "a".repeat(32),
    JWT_REFRESH_SECRET: "b".repeat(32),
    TOKEN_ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    FRONTEND_ORIGIN: "https://app.example.com",
    DATABASE_URL: "postgresql://mtd:mtd@localhost:5432/mtd",
    HMRC_MODE: "mock",
  };

  it("allows a complete production configuration", () => {
    expect(() => assertProductionConfig(valid)).not.toThrow();
  });

  it("rejects default JWT secrets and an open CORS origin", () => {
    expect(() =>
      assertProductionConfig({
        ...valid,
        JWT_ACCESS_SECRET: "dev-access-secret-change-me-please-32ch",
        FRONTEND_ORIGIN: "",
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

  it("accepts SUPABASE_DB_URL in place of DATABASE_URL", () => {
    const { DATABASE_URL: _ignored, ...rest } = valid;
    expect(() =>
      assertProductionConfig({
        ...rest,
        SUPABASE_DB_URL: "postgresql://postgres:secret@db.abcdxyzabcdefgh.supabase.co:5432/postgres",
      }),
    ).not.toThrow();
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
