import type { NextConfig } from "next";

const commonSecurityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Content-Security-Policy", value: "base-uri 'self'; frame-ancestors 'none'; object-src 'none'" }
];

const productionSecurityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload"
  }
];

const distDir = process.env.NEXT_DIST_DIR?.trim();

const nextConfig: NextConfig = {
  ...(distDir ? { distDir } : {}),
  typedRoutes: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: process.env.NODE_ENV === "production"
          ? [...commonSecurityHeaders, ...productionSecurityHeaders]
          : commonSecurityHeaders
      }
    ];
  }
};

export default nextConfig;
