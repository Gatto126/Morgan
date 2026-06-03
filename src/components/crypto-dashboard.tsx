"use client";

import { Coins } from "lucide-react";
import {
  PortfolioDashboard,
  type PortfolioDashboardConfig,
  type PortfolioDashboardProps
} from "./portfolio-dashboard/portfolio-dashboard";

type CryptoDashboardProps = Omit<PortfolioDashboardProps, "config">;

const cryptoDashboardConfig: PortfolioDashboardConfig = {
  endpoint: "/api/transactions/crypto",
  rootLabel: "CRYPTO",
  aggregateLegendLabel: "CRYPTO",
  rootIcon: Coins,
  loadingLabel: "Caricamento investimenti crypto...",
  fetchErrorMessage: "Errore nel caricamento della pagina investimenti crypto.",
  priceQueryParam: "cryptos",
  identifierLabel: "Token",
  showCashback: false,
  transactionFilter: (transaction) => transaction.tradeType !== null
};

export function CryptoDashboard(props: CryptoDashboardProps) {
  return <PortfolioDashboard {...props} config={cryptoDashboardConfig} />;
}
