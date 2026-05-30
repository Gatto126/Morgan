const CRYPTO_SYMBOL_ALIASES: Record<string, string> = {
  BITCOIN: "BTC",
  BTC: "BTC",
  BNB: "BNB",
  DOGE: "DOGE",
  DOGECOIN: "DOGE",
  ETH: "ETH",
  ETHEREUM: "ETH",
  LTC: "LTC",
  LITECOIN: "LTC",
  SOL: "SOL",
  SOLANA: "SOL",
  TETHER: "USDT",
  USDT: "USDT",
  XRP: "XRP"
};

export function normalizeCryptoSymbol(value: string | null | undefined) {
  const normalized = value?.trim().toUpperCase();
  if (!normalized) return null;

  const exactAlias = CRYPTO_SYMBOL_ALIASES[normalized];
  if (exactAlias) return exactAlias;

  if (normalized.startsWith("XF")) {
    for (const [alias, symbol] of Object.entries(CRYPTO_SYMBOL_ALIASES)) {
      if (normalized.includes(alias)) {
        return symbol;
      }
    }
  }

  return normalized;
}

export function findCryptoSymbolInText(value: string | null | undefined) {
  const normalized = value?.trim().toUpperCase();
  if (!normalized) return null;

  for (const word of normalized.split(/[^A-Z0-9]+/).filter(Boolean)) {
    if (CRYPTO_SYMBOL_ALIASES[word]) {
      return CRYPTO_SYMBOL_ALIASES[word];
    }

    const symbol = normalizeCryptoSymbol(word);
    if (symbol && symbol !== word) {
      return symbol;
    }
  }

  return null;
}
