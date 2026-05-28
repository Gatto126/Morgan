export type MorganDatabaseProvider = "postgresql" | "sqlite";

type DatabaseProviderEnv = Record<string, string | undefined>;

export function getDatabaseProvider(env: DatabaseProviderEnv = process.env): MorganDatabaseProvider {
  const configuredProvider = env.MORGAN_DATABASE_PROVIDER?.trim().toLowerCase();

  if (configuredProvider === "postgresql" || configuredProvider === "sqlite") {
    return configuredProvider;
  }

  if (env.SQLITE_DATABASE_URL && !env.DATABASE_URL) {
    return "sqlite";
  }

  return "postgresql";
}
