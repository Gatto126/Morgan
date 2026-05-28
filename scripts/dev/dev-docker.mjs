import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..", "..");
const host = process.env.NEXT_DEV_HOST ?? "127.0.0.1";
const port = process.env.NEXT_DEV_PORT ?? process.env.PORT ?? "3000";
const postgresPort = process.env.POSTGRES_PORT ?? "5432";
const postgresUser = process.env.POSTGRES_USER ?? "morgan";
const postgresPassword = process.env.POSTGRES_PASSWORD ?? "morgan";
const postgresDb = process.env.POSTGRES_DB ?? "morgan";
const dockerDatabaseUrl =
  `postgresql://${postgresUser}:${postgresPassword}@localhost:${postgresPort}/${postgresDb}?schema=public`;
const baseUrl = `http://${host}:${port}`;
const trustedOrigins = [
  process.env.BETTER_AUTH_TRUSTED_ORIGINS,
  baseUrl,
  `http://localhost:${port}`,
  `http://127.0.0.1:${port}`
].filter(Boolean).join(",");
const nextBin = path.join(rootDir, "node_modules", "next", "dist", "bin", "next");

if (!existsSync(nextBin)) {
  throw new Error("Next.js binary not found. Run pnpm install before pnpm run dev:docker.");
}

console.log(`Starting Next dev against Docker Postgres on localhost:${postgresPort}.`);
console.log(`App URL: ${baseUrl}`);

const child = spawn(process.execPath, [nextBin, "dev", "-H", host, "-p", port], {
  cwd: rootDir,
  env: {
    ...process.env,
    DATABASE_URL: process.env.DOCKER_DATABASE_URL ?? dockerDatabaseUrl,
    DIRECT_URL: process.env.DOCKER_DIRECT_URL ?? process.env.DOCKER_DATABASE_URL ?? dockerDatabaseUrl,
    MORGAN_DATABASE_PROVIDER: "postgresql",
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? baseUrl,
    BETTER_AUTH_TRUSTED_ORIGINS: trustedOrigins,
    PORT: port
  },
  stdio: "inherit",
  windowsHide: true
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
