export type DatabaseProvider = "local" | "supabase";
export type StorageDriver = "local" | "supabase";

export interface ResolvedDatabase {
  databaseUrl?: string;
  directUrl?: string;
  provider: DatabaseProvider;
  projectRef?: string;
}

const SUPABASE_HOST = /supabase\.(co|com)/i;

export function supabaseProjectRef(url?: string): string | undefined {
  if (!url) {
    return undefined;
  }
  try {
    const host = new URL(url).hostname;
    const [sub] = host.split(".");
    return sub && sub !== "db" && sub !== "aws-0" ? sub : host.split(".")[1];
  } catch {
    const match = url.match(/([a-z0-9]{15,})\.supabase\.(?:co|com)/i);
    return match?.[1];
  }
}

export function isSupabaseDatabaseUrl(url?: string): boolean {
  return Boolean(url && SUPABASE_HOST.test(url));
}

export function withSslMode(url?: string): string | undefined {
  if (!url || !isSupabaseDatabaseUrl(url)) {
    return url;
  }
  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has("sslmode")) {
      parsed.searchParams.set("sslmode", "require");
    }
    return parsed.toString();
  } catch {
    return url.includes("sslmode=") ? url : `${url}${url.includes("?") ? "&" : "?"}sslmode=require`;
  }
}

export function resolveDatabaseUrl(env: NodeJS.ProcessEnv = process.env): ResolvedDatabase {
  const projectRef = supabaseProjectRef(env.SUPABASE_URL);
  let databaseUrl = env.SUPABASE_DB_URL || env.DATABASE_URL;
  if (!databaseUrl && env.SUPABASE_DB_PASSWORD && projectRef) {
    databaseUrl = `postgresql://postgres:${encodeURIComponent(env.SUPABASE_DB_PASSWORD)}@db.${projectRef}.supabase.co:5432/postgres`;
  }
  databaseUrl = withSslMode(databaseUrl);
  const directUrl = withSslMode(env.DIRECT_URL || env.SUPABASE_DB_DIRECT_URL || databaseUrl);
  return {
    databaseUrl,
    directUrl,
    provider: isSupabaseDatabaseUrl(databaseUrl) ? "supabase" : "local",
    projectRef,
  };
}

export function resolveStorageDriver(env: NodeJS.ProcessEnv = process.env): StorageDriver {
  const explicit = env.STORAGE_DRIVER?.trim().toLowerCase();
  if (explicit === "supabase" || explicit === "local") {
    return explicit;
  }
  return env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY ? "supabase" : "local";
}

export function applySupabaseEnv(env: NodeJS.ProcessEnv = process.env): ResolvedDatabase {
  const resolved = resolveDatabaseUrl(env);
  if (resolved.databaseUrl) {
    env.DATABASE_URL = resolved.databaseUrl;
  }
  if (resolved.directUrl) {
    env.DIRECT_URL = resolved.directUrl;
  }
  if (!env.STORAGE_DRIVER) {
    env.STORAGE_DRIVER = resolveStorageDriver(env);
  }
  return resolved;
}
