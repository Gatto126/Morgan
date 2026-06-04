export type BinanceHistoricalToken = {
  tokenName: string | null;
  tokenSymbol: string;
  valueCents: number;
};

export type BinanceHistoricalPoint = {
  dateKey: string;
  tokens?: BinanceHistoricalToken[];
  valueCents: number;
};
