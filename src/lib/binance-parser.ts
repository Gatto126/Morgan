import { apiLogger } from "@/lib/logger";

const log = apiLogger("Binance");

export interface AssetHistoryPoint {
  date: string;   // "YYYY-MM-DD"
  value: number;  // prezzo in EUR o convertito
}

/**
 * Fetches klines from Binance public API for a given pair.
 */
async function fetchKlines(binanceSymbol: string): Promise<AssetHistoryPoint[]> {
  // Fetch up to 1000 daily candles (approx. 2.7 years)
  const url = `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=1d&limit=1000`;

  const res = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "User-Agent": "Mozilla/5.0"
    }
  });

  if (!res.ok) {
    throw new Error(`HTTP Error ${res.status} per la coppia ${binanceSymbol}`);
  }

  const data = await res.json() as unknown;
  if (!Array.isArray(data)) {
    return [];
  }

  return data.flatMap((item): AssetHistoryPoint[] => {
    if (!Array.isArray(item) || typeof item[0] !== "number" || typeof item[4] !== "string") {
      return [];
    }

    const openTimeMs = item[0];
    const closePrice = parseFloat(item[4]);
    const date = new Date(openTimeMs).toISOString().split("T")[0];
    return [{
      date,
      value: closePrice
    }];
  });
}

/**
 * Fetches historical daily prices in EUR for a crypto token symbol.
 * Tries direct EUR pair (e.g. BTCEUR), then falls back to USDT pair (e.g. BTCUSDT) converted via EURUSDT.
 */
export async function fetchCryptoHistory(symbol: string): Promise<AssetHistoryPoint[]> {
  const uppercaseSymbol = symbol.toUpperCase();

  // 1. Try direct EUR pair
  try {
    log.info(`Fetching storico Binance per coppia diretta: ${uppercaseSymbol}EUR`);
    const points = await fetchKlines(`${uppercaseSymbol}EUR`);
    if (points && points.length > 0) {
      log.info(`Recuperati ${points.length} punti per ${uppercaseSymbol}EUR`);
      return points;
    }
  } catch (err) {
    log.info(`Coppia diretta ${uppercaseSymbol}EUR non disponibile o fallita: ${err instanceof Error ? err.message : String(err)}. Provo fallback USDT.`);
  }

  // 2. Fallback to USDT, converted to EUR using EURUSDT exchange rate history
  try {
    log.info(`Fetching storico Binance per coppia fallback: ${uppercaseSymbol}USDT`);
    const usdtPoints = await fetchKlines(`${uppercaseSymbol}USDT`);
    if (usdtPoints && usdtPoints.length > 0) {
      log.info(`Recuperati ${usdtPoints.length} punti USDT. Scarico storico EURUSDT per la conversione...`);
      const eurusdtPoints = await fetchKlines("EURUSDT");

      const rateMap = new Map<string, number>();
      for (const p of eurusdtPoints) {
        rateMap.set(p.date, p.value); // 1 EUR = X USDT
      }

      const convertedPoints: AssetHistoryPoint[] = [];
      for (const p of usdtPoints) {
        const rate = rateMap.get(p.date) ?? 1.08; // default fallback if missing
        convertedPoints.push({
          date: p.date,
          value: p.value / rate
        });
      }

      log.info(`Convertiti ${convertedPoints.length} punti da USDT a EUR per ${uppercaseSymbol}`);
      return convertedPoints;
    }
  } catch (err) {
    log.error("BinanceParser", `Errore nel recupero dello storico per la crypto ${uppercaseSymbol}`, err);
  }

  return [];
}
