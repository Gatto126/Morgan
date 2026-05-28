import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname
});

const targetNeutralBoundaryConfig = {
  files: [
    "src/domain/**/*.{ts,tsx}",
    "src/shared/**/*.{ts,tsx}"
  ],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        paths: [
          {
            name: "next",
            message: "Target-neutral modules must not depend on Next.js."
          },
          {
            name: "react",
            message: "Target-neutral modules must not depend on React."
          },
          {
            name: "react-dom",
            message: "Target-neutral modules must not depend on React DOM."
          },
          {
            name: "@prisma/client",
            message: "Target-neutral modules must not depend on Prisma or a concrete database provider."
          },
          {
            name: "server-only",
            message: "Target-neutral modules must be reusable outside the Next.js server runtime."
          },
          {
            name: "lucide-react",
            message: "Target-neutral modules must not depend on UI icon libraries."
          },
          {
            name: "recharts",
            message: "Target-neutral modules must not depend on chart rendering libraries."
          }
        ],
        patterns: [
          {
            group: [
              "next/*",
              "react/*",
              "react-dom/*",
              "@/app/*",
              "@/client/*",
              "@/components/*",
              "@/server/*"
            ],
            message: "Target-neutral modules can depend only on other neutral modules."
          }
        ]
      }
    ]
  }
};

const clientBoundaryConfig = {
  files: [
    "src/client/**/*.{ts,tsx}",
    "src/components/**/*.{ts,tsx}"
  ],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        paths: [
          {
            name: "@/server/db/prisma",
            message: "Client/UI modules must never import database adapters."
          },
          {
            name: "@prisma/client",
            message: "Client/UI modules must not depend on Prisma types or clients."
          },
          {
            name: "server-only",
            message: "Client/UI modules must not import server-only modules."
          }
        ],
        patterns: [
          {
            group: ["@/server/*"],
            message: "Client/UI modules must call API routes or use client hooks, not server modules."
          }
        ]
      }
    ]
  }
};

const appBoundaryConfig = {
  files: [
    "src/app/**/*.{ts,tsx}"
  ],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        paths: [
          {
            name: "@/server/db/prisma",
            message: "Next app modules must use src/server/repositories or services instead of importing Prisma directly."
          },
          {
            name: "@prisma/client",
            message: "Keep Prisma types inside repository modules; export app-safe types from repositories when needed."
          }
        ],
        patterns: [
          {
            group: ["@/server/db/*"],
            message: "Next app modules must depend on repositories/services, not database adapters."
          }
        ]
      }
    ]
  }
};

const serverBoundaryConfig = {
  files: [
    "src/server/**/*.{ts,tsx}"
  ],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["@/app/*", "@/client/*", "@/components/*"],
            message: "Server modules must not depend on web UI, client, or route modules."
          }
        ]
      }
    ]
  }
};

const serverServiceBoundaryConfig = {
  files: [
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
            message: "Server services and guards must use repositories instead of importing Prisma directly."
          },
          {
            name: "@prisma/client",
            message: "Keep Prisma types inside repository modules; export service-safe types from repositories when needed."
          }
        ],
        patterns: [
          {
            group: ["@/server/db/*"],
            message: "Server services and guards must depend on repositories, not database adapters."
          },
          {
            group: ["@/app/*", "@/client/*", "@/components/*"],
            message: "Server services and guards must not depend on web UI, client, or route modules."
          }
        ]
      }
    ]
  }
};

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  targetNeutralBoundaryConfig,
  clientBoundaryConfig,
  appBoundaryConfig,
  serverBoundaryConfig,
  serverServiceBoundaryConfig
];

export default eslintConfig;
