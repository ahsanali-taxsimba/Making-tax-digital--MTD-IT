import { applySupabaseEnv, resolveDatabaseUrl, resolveStorageDriver, withSslMode } from "./supabase";

describe("supabase config", () => {
  it("prefers SUPABASE_DB_URL and adds sslmode", () => {
    const resolved = resolveDatabaseUrl({
      SUPABASE_URL: "https://abcdxyzabcdefgh.supabase.co",
      SUPABASE_DB_URL: "postgresql://postgres:secret@db.abcdxyzabcdefgh.supabase.co:5432/postgres",
    });
    expect(resolved.provider).toBe("supabase");
    expect(resolved.projectRef).toBe("abcdxyzabcdefgh");
    expect(resolved.databaseUrl).toContain("sslmode=require");
  });

  it("builds a direct URL from the project ref and database password", () => {
    const resolved = resolveDatabaseUrl({
      SUPABASE_URL: "https://abcdxyzabcdefgh.supabase.co",
      SUPABASE_DB_PASSWORD: "p@ss",
    });
    expect(resolved.databaseUrl).toContain("postgres:p%40ss@db.abcdxyzabcdefgh.supabase.co");
    expect(resolved.databaseUrl).toContain("sslmode=require");
  });

  it("prefers SUPABASE_DB_URL over a local DATABASE_URL", () => {
    const resolved = resolveDatabaseUrl({
      DATABASE_URL: "postgresql://mtd:mtd@localhost:5432/mtd",
      SUPABASE_DB_URL: "postgresql://postgres:secret@db.abcdxyzabcdefgh.supabase.co:5432/postgres",
      SUPABASE_URL: "https://abcdxyzabcdefgh.supabase.co",
    });
    expect(resolved.provider).toBe("supabase");
  });

  it("keeps a local Docker URL unchanged", () => {
    const resolved = resolveDatabaseUrl({
      DATABASE_URL: "postgresql://mtd:mtd@localhost:5432/mtd?schema=public",
    });
    expect(resolved.provider).toBe("local");
    expect(resolved.databaseUrl).toBe("postgresql://mtd:mtd@localhost:5432/mtd?schema=public");
  });

  it("selects the supabase storage driver when credentials are present", () => {
    expect(resolveStorageDriver({})).toBe("local");
    expect(
      resolveStorageDriver({ SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "key" }),
    ).toBe("supabase");
    expect(
      resolveStorageDriver({
        STORAGE_DRIVER: "local",
        SUPABASE_URL: "https://x.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "key",
      }),
    ).toBe("local");
  });

  it("copies resolved URLs onto process.env once", () => {
    const env: NodeJS.ProcessEnv = {
      SUPABASE_URL: "https://abcdxyzabcdefgh.supabase.co",
      SUPABASE_DB_URL: "postgresql://postgres:secret@db.abcdxyzabcdefgh.supabase.co:5432/postgres",
    };
    applySupabaseEnv(env);
    expect(env.DATABASE_URL).toContain("sslmode=require");
    expect(env.DIRECT_URL).toBe(env.DATABASE_URL);
    expect(withSslMode("postgresql://postgres:x@localhost:5432/mtd")).toBe(
      "postgresql://postgres:x@localhost:5432/mtd",
    );
  });
});
