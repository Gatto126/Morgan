import "server-only";

import crypto from "node:crypto";

const SECRET_PREFIX = "v1";
const KEY_LENGTH_BYTES = 32;

type BinanceCredentialFields = {
  binanceApiKey?: string | null;
  binanceApiSecret?: string | null;
  binanceApiKeyEncrypted?: string | null;
  binanceApiSecretEncrypted?: string | null;
  binanceApiKeyPreview?: string | null;
};

export type BinanceCredentials = {
  apiKey: string;
  secret: string;
};

function getEncryptionKey() {
  const rawKey = process.env.MORGAN_ENCRYPTION_KEY;

  if (!rawKey) {
    throw new Error("MORGAN_ENCRYPTION_KEY is required to store Binance credentials.");
  }

  const base64Key = Buffer.from(rawKey, "base64");
  if (base64Key.length === KEY_LENGTH_BYTES) return base64Key;

  if (/^[0-9a-f]{64}$/i.test(rawKey)) {
    const hexKey = Buffer.from(rawKey, "hex");
    if (hexKey.length === KEY_LENGTH_BYTES) return hexKey;
  }

  throw new Error("MORGAN_ENCRYPTION_KEY must be a 32-byte base64 or 64-character hex value.");
}

export function encryptSecret(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(trimmed, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    SECRET_PREFIX,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

export function decryptSecret(value: string | null | undefined) {
  if (!value) return null;

  const [prefix, ivText, tagText, encryptedText] = value.split(":");
  if (prefix !== SECRET_PREFIX || !ivText || !tagText || !encryptedText) {
    throw new Error("Encrypted secret has an unsupported format.");
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivText, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function makeBinanceApiKeyPreview(apiKey: string | null | undefined) {
  const trimmed = apiKey?.trim();
  if (!trimmed) return null;

  return `${trimmed.slice(0, 8)}...`;
}

export function hasBinanceCredentials(user: BinanceCredentialFields | null | undefined) {
  if (!user) return false;

  return !!(
    (user.binanceApiKeyEncrypted && user.binanceApiSecretEncrypted) ||
    (user.binanceApiKey && user.binanceApiSecret)
  );
}

export function getBinanceApiKeyPreview(user: BinanceCredentialFields | null | undefined) {
  if (!user) return null;

  return user.binanceApiKeyPreview ?? makeBinanceApiKeyPreview(user.binanceApiKey);
}

export function decryptBinanceCredentials(user: BinanceCredentialFields | null | undefined): BinanceCredentials | null {
  if (!user) return null;

  const apiKey = user.binanceApiKeyEncrypted
    ? decryptSecret(user.binanceApiKeyEncrypted)
    : user.binanceApiKey ?? null;
  const secret = user.binanceApiSecretEncrypted
    ? decryptSecret(user.binanceApiSecretEncrypted)
    : user.binanceApiSecret ?? null;

  if (!apiKey || !secret) return null;

  return { apiKey, secret };
}
