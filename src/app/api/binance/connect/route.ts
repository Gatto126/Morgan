import { handleBinanceSyncRoute } from "@/app/api/binance/route-handler";
import { apiLogger } from "@/server/logging/logger";

const log = apiLogger("BinanceConnect");

export async function POST(request: Request) {
  return handleBinanceSyncRoute(request, {
    endpoint: "/api/binance/connect",
    genericError: "Errore di connessione a Binance.",
    log,
    logBinanceApiError: true,
  });
}
