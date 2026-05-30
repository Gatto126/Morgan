import { normalizeCryptoSymbol } from "@/domain/pricing/crypto-symbols";

export const PRICE_REQUEST_LIMITS = {
  maxTotalKeys: 50,
  maxIsins: 40,
  maxCryptos: 25
} as const;

const ISIN_PATTERN = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;
const CRYPTO_SYMBOL_PATTERN = /^[A-Z0-9]{2,15}$/;

export class PriceRequestValidationError extends Error {
  constructor(
    message: string,
    public status: 400 | 413 | 422
  ) {
    super(message);
    this.name = "PriceRequestValidationError";
  }
}

type PriceRequestParams = Pick<URLSearchParams, "get">;

type PriceRequestListOptions = {
  paramName: "isins" | "cryptos";
  pattern: RegExp;
  maxItems: number;
};

function parsePriceRequestList(
  params: PriceRequestParams,
  { paramName, pattern, maxItems }: PriceRequestListOptions
) {
  const rawValue = params.get(paramName);
  if (!rawValue) return [];

  const values = new Set<string>();
  for (const rawItem of rawValue.split(",")) {
    const item = paramName === "cryptos"
      ? normalizeCryptoSymbol(rawItem)
      : rawItem.trim().toUpperCase();
    if (!item) continue;

    if (!pattern.test(item)) {
      throw new PriceRequestValidationError(
        `Invalid ${paramName} value: ${item}.`,
        422
      );
    }

    values.add(item);
  }

  if (values.size > maxItems) {
    throw new PriceRequestValidationError(
      `Too many ${paramName} requested. Maximum is ${maxItems}.`,
      413
    );
  }

  return [...values];
}

export function parsePriceRequestParams(params: PriceRequestParams) {
  const isins = parsePriceRequestList(params, {
    paramName: "isins",
    pattern: ISIN_PATTERN,
    maxItems: PRICE_REQUEST_LIMITS.maxIsins
  });
  const cryptos = parsePriceRequestList(params, {
    paramName: "cryptos",
    pattern: CRYPTO_SYMBOL_PATTERN,
    maxItems: PRICE_REQUEST_LIMITS.maxCryptos
  });
  const totalKeys = isins.length + cryptos.length;

  if (totalKeys === 0) {
    throw new PriceRequestValidationError(
      "Either isins or cryptos parameter is required.",
      400
    );
  }

  if (totalKeys > PRICE_REQUEST_LIMITS.maxTotalKeys) {
    throw new PriceRequestValidationError(
      `Too many price keys requested. Maximum is ${PRICE_REQUEST_LIMITS.maxTotalKeys}.`,
      413
    );
  }

  return {
    isins,
    cryptos,
    keys: [...isins, ...cryptos]
  };
}
