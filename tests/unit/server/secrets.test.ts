import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  decryptBinanceCredentials,
  encryptSecret,
  getBinanceApiKeyPreview,
  hasBinanceCredentials,
  makeBinanceApiKeyPreview
} from "@/server/security/secrets";
import { setTestEnv } from "../../setup/env";

const encryptionKey = Buffer.alloc(32, 7).toString("base64");

describe("secret helpers", () => {
  let restoreEnv: () => void;

  beforeEach(() => {
    restoreEnv = setTestEnv({
      MORGAN_ENCRYPTION_KEY: encryptionKey
    });
  });

  afterEach(() => {
    restoreEnv();
  });

  it("detects only encrypted Binance credential pairs", () => {
    const encryptedApiKey = encryptSecret("api-key");
    const encryptedSecret = encryptSecret("secret");

    expect(hasBinanceCredentials({
      binanceApiKeyEncrypted: encryptedApiKey,
      binanceApiSecretEncrypted: encryptedSecret
    })).toBe(true);
    expect(hasBinanceCredentials({
      binanceApiKeyEncrypted: encryptedApiKey,
      binanceApiSecretEncrypted: null
    })).toBe(false);
  });

  it("decrypts encrypted Binance credentials without plaintext fallback fields", () => {
    const encryptedApiKey = encryptSecret("api-key");
    const encryptedSecret = encryptSecret("secret");

    expect(decryptBinanceCredentials({
      binanceApiKeyEncrypted: encryptedApiKey,
      binanceApiSecretEncrypted: encryptedSecret
    })).toEqual({
      apiKey: "api-key",
      secret: "secret"
    });
    expect(decryptBinanceCredentials({
      binanceApiKeyEncrypted: encryptedApiKey,
      binanceApiSecretEncrypted: null
    })).toBeNull();
  });

  it("uses stored previews instead of deriving them from plaintext fields", () => {
    expect(makeBinanceApiKeyPreview("123456789abcdef")).toBe("12345678...");
    expect(getBinanceApiKeyPreview({ binanceApiKeyPreview: "stored..." })).toBe("stored...");
    expect(getBinanceApiKeyPreview({ binanceApiKeyPreview: null })).toBeNull();
  });
});
