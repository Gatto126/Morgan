/**
 * Transaction classifier – maps typeLabel + description to account type
 * and extracts structured investment/crypto data from the description.
 */

import { findCryptoSymbolInText, normalizeCryptoSymbol } from "@/domain/pricing/crypto-symbols";

export type AccountType = "checking" | "investment" | "crypto";

export type ClassificationResult = {
  accountType: AccountType;
  productName: string | null;
  isin: string | null;
  quantityUnits: number | null;
  tradeType: "buy_trade" | "savings_plan" | null;
};

const ISIN_PATTERN = /\b([A-Z]{2}[A-Z0-9]{10})\b/;
const CRYPTO_TOKENS = ["btc", "eth", "bitcoin", "ethereum", "litecoin", "ltc", "xrp", "solana", "sol", "doge", "dogecoin"];

function extractISIN(text: string): string | null {
  const match = text.match(ISIN_PATTERN);
  return match?.[1] ?? null;
}

function extractQuantity(text: string): number | null {
  // First try: prefix format "quantity: 0.5"
  let match = text.match(/(?:quantity|quantit[àa])[:\-\s]*([0-9.,]+)/i);
  
  if (!match) {
    // Second try: suffix format "0.5 pcs"
    match = text.match(/([0-9.,]+)\s*(?:pcs|pz|shares?|units?|azioni)/i);
  }

  if (match?.[1]) {
    const normalized = match[1].replace(",", ".");
    const value = Number.parseFloat(normalized);
    return Number.isNaN(value) ? null : value;
  }

  return null;
}

function extractProductName(description: string, isin: string | null): string | null {
  let cleaned = description;

  // Rimuovi prefissi noti
  cleaned = cleaned.replace(/^(?:buy trade|sell trade|savings plan execution)\s+/i, "");

  // Rimuovi ISIN
  if (isin) {
    cleaned = cleaned.replace(isin, "");
  }

  // Rimuovi tutto da ", quantity:" o simili in poi
  const commaIndex = cleaned.indexOf(",");
  if (commaIndex !== -1) {
    cleaned = cleaned.substring(0, commaIndex);
  }

  // Rimuovi altra sporcizia
  cleaned = cleaned.replace(/iShares III plc -/i, "").trim();
  cleaned = cleaned.replace(/^- /, "").trim();

  // Se dopo aver pulito rimane qualcosa di sensato
  if (cleaned.length >= 2) {
    return cleaned;
  }

  // Fallback per le crypto (spesso scritte come "Bitcoin", "Ethereum")
  if (description.toLowerCase().includes("bitcoin")) return "BTC";
  if (description.toLowerCase().includes("ethereum")) return "ETH";
  if (description.toLowerCase().includes("litecoin")) return "LTC";
  if (description.toLowerCase().includes("solana")) return "SOL";

  return null;
}

function isCryptoTransaction(typeLabel: string, description: string): boolean {
  const combined = ` ${typeLabel} ${description} `
    .toLowerCase()
    .replace(/[^a-z0-9]/g, " ");
  const words = combined.split(/\s+/).filter(Boolean);
  return CRYPTO_TOKENS.some((token) => words.includes(token));
}


function isInvestmentTransaction(typeLabel: string, description: string): { isInvestment: boolean; tradeType: "buy_trade" | "savings_plan" | null } {
  const combined = `${typeLabel} ${description}`.toLowerCase();

  if (combined.includes("buy trade") || combined.includes("sell trade")) {
    return { isInvestment: true, tradeType: "buy_trade" };
  }

  if (combined.includes("savings plan execution")) {
    return { isInvestment: true, tradeType: "savings_plan" };
  }

  return { isInvestment: false, tradeType: null };
}

export function classifyTransaction(typeLabel: string, description: string): ClassificationResult {
  // Check crypto first (crypto is more specific than investment)
  if (isCryptoTransaction(typeLabel, description)) {
    const rawIdentifier = extractISIN(description);
    const isin = findCryptoSymbolInText(description) ?? normalizeCryptoSymbol(rawIdentifier);
    const quantity = extractQuantity(description);
    const productName = extractProductName(description, rawIdentifier);

    return {
      accountType: "crypto",
      productName,
      isin,
      quantityUnits: quantity,
      tradeType: null
    };
  }

  // Check investment
  const investmentResult = isInvestmentTransaction(typeLabel, description);

  if (investmentResult.isInvestment) {
    const isin = extractISIN(description);
    const quantity = extractQuantity(description);
    const productName = extractProductName(description, isin);

    return {
      accountType: "investment",
      productName,
      isin,
      quantityUnits: quantity,
      tradeType: investmentResult.tradeType
    };
  }

  // Default to checking
  return {
    accountType: "checking",
    productName: null,
    isin: null,
    quantityUnits: null,
    tradeType: null
  };
}
