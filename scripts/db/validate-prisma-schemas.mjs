import { spawnSync } from "node:child_process";

const checks = [
  {
    name: "Postgres",
    schema: "prisma/schema.prisma",
    env: {}
  },
  {
    name: "SQLite",
    schema: "prisma/sqlite/schema.prisma",
    env: {
      SQLITE_DATABASE_URL: process.env.SQLITE_DATABASE_URL ?? "file:./prisma/sqlite/validate.db"
    }
  }
];

for (const check of checks) {
  console.log(`Validating ${check.name} Prisma schema...`);

  const result = spawnSync(
    "pnpm",
    ["exec", "prisma", "validate", "--schema", check.schema],
    {
      env: {
        ...process.env,
        ...check.env
      },
      shell: true,
      stdio: "inherit"
    }
  );

  if (result.error) {
    console.error(result.error);
    process.exit(1);
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
