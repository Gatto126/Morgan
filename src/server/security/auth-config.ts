type AuthEnv = Partial<Record<
  | "BETTER_AUTH_IP_HEADERS"
  | "BETTER_AUTH_SECRET"
  | "BETTER_AUTH_TRUSTED_ORIGINS"
  | "BETTER_AUTH_URL"
  | "DATABASE_URL"
  | "DIRECT_URL"
  | "MORGAN_ENCRYPTION_KEY"
  | "NODE_ENV"
  | "TRUSTED_IP_HEADERS",
  string
>>;

function splitCsv(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isLocalhostUrl(value: string) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

function isHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function hasMinimumSecretLength(value: string | undefined) {
  return (value ?? "").trim().length >= 32;
}

function isValidEncryptionKey(value: string | undefined) {
  const key = (value ?? "").trim();
  if (/^[a-f0-9]{64}$/i.test(key)) {
    return true;
  }

  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(key)) {
    return false;
  }

  try {
    return Buffer.from(key, "base64").length === 32;
  } catch {
    return false;
  }
}

export function getTrustedOrigins(env: AuthEnv = process.env) {
  const origins = new Set([
    env.BETTER_AUTH_URL,
    ...splitCsv(env.BETTER_AUTH_TRUSTED_ORIGINS)
  ].filter((origin): origin is string => Boolean(origin)));

  if (env.NODE_ENV !== "production") {
    origins.add("http://localhost:3000");
    origins.add("http://127.0.0.1:3000");
    origins.add("http://192.168.*.*:3000");
  }

  return Array.from(origins);
}

export function getIpAddressHeaders(env: AuthEnv = process.env) {
  const configuredHeaders = splitCsv(env.BETTER_AUTH_IP_HEADERS ?? env.TRUSTED_IP_HEADERS)
    .map((header) => header.toLowerCase());

  return configuredHeaders.length > 0 ? configuredHeaders : ["x-forwarded-for"];
}

export function shouldUseSecureCookies(env: AuthEnv = process.env) {
  return env.BETTER_AUTH_URL ? isHttpsUrl(env.BETTER_AUTH_URL) : env.NODE_ENV === "production";
}

export function getAuthDeploymentWarnings(env: AuthEnv = process.env) {
  if (env.NODE_ENV !== "production") {
    return [];
  }

  const warnings: string[] = [];
  const baseUrl = env.BETTER_AUTH_URL;
  const trustedOrigins = splitCsv(env.BETTER_AUTH_TRUSTED_ORIGINS);
  const ipHeaders = splitCsv(env.BETTER_AUTH_IP_HEADERS ?? env.TRUSTED_IP_HEADERS);

  if (!env.DATABASE_URL) {
    warnings.push("DATABASE_URL is required in production.");
  }

  if (!env.DIRECT_URL) {
    warnings.push("DIRECT_URL is required in production.");
  }

  if (!env.BETTER_AUTH_SECRET) {
    warnings.push("BETTER_AUTH_SECRET is required in production.");
  } else if (!hasMinimumSecretLength(env.BETTER_AUTH_SECRET)) {
    warnings.push("BETTER_AUTH_SECRET should be at least 32 characters in production.");
  }

  if (!env.MORGAN_ENCRYPTION_KEY) {
    warnings.push("MORGAN_ENCRYPTION_KEY is required in production.");
  } else if (!isValidEncryptionKey(env.MORGAN_ENCRYPTION_KEY)) {
    warnings.push("MORGAN_ENCRYPTION_KEY must be a 32-byte base64 or 64-character hex value.");
  }

  if (!baseUrl) {
    warnings.push("BETTER_AUTH_URL is required in production.");
  } else if (!isHttpsUrl(baseUrl) && !isLocalhostUrl(baseUrl)) {
    warnings.push("BETTER_AUTH_URL should use HTTPS for public production deployments.");
  }

  if (trustedOrigins.some((origin) => origin.includes("*")) && !trustedOrigins.every(isLocalhostUrl)) {
    warnings.push("BETTER_AUTH_TRUSTED_ORIGINS should not use wildcard public origins in production.");
  }

  if (ipHeaders.length === 0) {
    warnings.push("Configure BETTER_AUTH_IP_HEADERS for the trusted proxy or hosting provider in production.");
  }

  return warnings;
}
