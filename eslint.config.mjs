import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname
});

const prismaBoundaryConfig = {
  files: [
    "src/app/**/*.{ts,tsx}",
    "src/server/auth/auth-guard.ts",
    "src/server/services/**/*.{ts,tsx}"
  ],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        paths: [
          {
            name: "@/server/db/prisma",
            message: "Application modules must use src/server/repositories or services instead of importing Prisma directly."
          },
          {
            name: "@prisma/client",
            message: "Keep Prisma types inside repository modules; export app-safe types from repositories when needed."
          }
        ],
        patterns: [
          {
            group: ["@/server/db/*"],
            message: "Application modules must depend on repositories/services, not database adapters."
          }
        ]
      }
    ]
  }
};

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  prismaBoundaryConfig
];

export default eslintConfig;
