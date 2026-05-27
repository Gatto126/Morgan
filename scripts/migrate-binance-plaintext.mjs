#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PrismaClient } from "@prisma/client";

const SECRET_PREFIX = "v1";
const KEY_LENGTH_BYTES = 32;
const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function loadEnvFile() {
  const envPath = path.join(rootDir, ".env");
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, "");

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function getEncryptionKey() {
  const rawKey = process.env.MORGAN_ENCRYPTION_KEY;

  if (!rawKey) {
    throw new Error("MORGAN_ENCRYPTION_KEY is required to migrate legacy Binance credentials.");
  }

  const base64Key = Buffer.from(rawKey, "base64");
  if (base64Key.length === KEY_LENGTH_BYTES) return base64Key;

  if (/^[0-9a-f]{64}$/i.test(rawKey)) {
    const hexKey = Buffer.from(rawKey, "hex");
    if (hexKey.length === KEY_LENGTH_BYTES) return hexKey;
  }

  throw new Error("MORGAN_ENCRYPTION_KEY must be a 32-byte base64 or 64-character hex value.");
}

function encryptSecret(value, key) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(trimmed, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    SECRET_PREFIX,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

function makeBinanceApiKeyPreview(apiKey) {
  const trimmed = apiKey?.trim();
  return trimmed ? `${trimmed.slice(0, 8)}...` : null;
}

loadEnvFile();

const prisma = new PrismaClient();

try {
  const columns = await prisma.$queryRawUnsafe('PRAGMA table_info("User")');
  const columnNames = new Set(columns.map((column) => column.name));

  if (!columnNames.has("binanceApiKey") && !columnNames.has("binanceApiSecret")) {
    console.log("No legacy Binance plaintext columns found.");
  } else {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT
        id,
        binanceApiKey,
        binanceApiSecret,
        binanceApiKeyEncrypted,
        binanceApiSecretEncrypted,
        binanceApiKeyPreview
      FROM "User"
      WHERE binanceApiKey IS NOT NULL OR binanceApiSecret IS NOT NULL
    `);

    if (rows.length === 0) {
      console.log("No legacy Binance plaintext values found.");
    } else {
      const encryptionKey = getEncryptionKey();
      let migrated = 0;
      let cleared = 0;

      for (const row of rows) {
        const hasPlaintextPair = row.binanceApiKey && row.binanceApiSecret;
        const needsEncryptedPair = !row.binanceApiKeyEncrypted || !row.binanceApiSecretEncrypted;

        if (hasPlaintextPair && needsEncryptedPair) {
          await prisma.$executeRawUnsafe(
            `
              UPDATE "User"
              SET
                binanceApiKeyEncrypted = ?,
                binanceApiSecretEncrypted = ?,
                binanceApiKeyPreview = COALESCE(binanceApiKeyPreview, ?),
                binanceApiKey = NULL,
                binanceApiSecret = NULL
              WHERE id = ?
            `,
            encryptSecret(row.binanceApiKey, encryptionKey),
            encryptSecret(row.binanceApiSecret, encryptionKey),
            makeBinanceApiKeyPreview(row.binanceApiKey),
            row.id
          );
          migrated++;
        } else {
          await prisma.$executeRawUnsafe(
            'UPDATE "User" SET binanceApiKey = NULL, binanceApiSecret = NULL WHERE id = ?',
            row.id
          );
          cleared++;
        }
      }

      console.log(`Migrated ${migrated} legacy Binance credential row(s); cleared ${cleared} incomplete row(s).`);
    }
  }
} finally {
  await prisma.$disconnect();
}
