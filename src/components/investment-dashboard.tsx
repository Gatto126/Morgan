"use client";

import { Wallet } from "lucide-react";
import {
  PortfolioDashboard,
  type PortfolioDashboardConfig,
  type PortfolioDashboardProps,
  type PortfolioTransaction
} from "./portfolio-dashboard/portfolio-dashboard";

type InvestmentDashboardProps = Omit<PortfolioDashboardProps, "config">;

function isInvestmentTransaction(transaction: PortfolioTransaction) {
  const isTrade = transaction.tradeType !== null;
  const description = (transaction.description || "").toLowerCase();
  const product = (transaction.productName || "").toLowerCase();
  const isCrypto =
    description.includes("crypto") ||
    description.includes("bitcoin") ||
    description.includes("ethereum") ||
    description.includes("btc") ||
    description.includes("eth") ||
    product.includes("crypto") ||
    product.includes("bitcoin") ||
    product.includes("ethereum") ||
    product.includes("btc") ||
    product.includes("eth");

  return isTrade && !isCrypto;
}

const investmentDashboardConfig: PortfolioDashboardConfig = {
  endpoint: "/api/transactions/investment",
  rootLabel: "INVESTMENTS",
  rootIcon: Wallet,
  loadingLabel: "Caricamento investimenti...",
  fetchErrorMessage: "Errore nel caricamento della pagina investimenti.",
  priceQueryParam: "isins",
  identifierLabel: "ISIN",
  showCashback: true,
  transactionFilter: isInvestmentTransaction
};

export function InvestmentDashboard(props: InvestmentDashboardProps) {
  return <PortfolioDashboard {...props} config={investmentDashboardConfig} />;
}
