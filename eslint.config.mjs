import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname
});

const serviceBoundaryConfig = {
  files: ["src/server/services/**/*.{ts,tsx}"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        paths: [
          {
            name: "@/server/db/prisma",
            message: "Service modules must use src/server/repositories instead of importing Prisma directly."
          },
          {
            name: "@prisma/client",
            message: "Keep Prisma types inside repository modules; export service-safe types from repositories when needed."
          }
        ],
        patterns: [
          {
            group: ["@/server/db/*"],
            message: "Service modules must depend on repositories, not database adapters."
          }
        ]
      }
    ]
  }
};

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  serviceBoundaryConfig
];

export default eslintConfig;
