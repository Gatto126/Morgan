import { handleBinanceSyncRoute } from "@/app/api/binance/route-handler";
import { apiLogger } from "@/server/logging/logger";

const log = apiLogger("BinanceSync");

export async function POST(request: Request) {
  return handleBinanceSyncRoute(request, {
    endpoint: "/api/binance/sync",
    genericError: "Errore di sincronizzazione Binance.",
    log,
  });
}
