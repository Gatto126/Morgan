import type { Prisma } from "@prisma/client";

import type { AssetMetadata } from "@/integrations/justetf/justetf-parser";
import { prisma } from "@/server/db/prisma";

export type CheckingTransactionCreateManyInput = Prisma.CheckingTransactionCreateManyInput;
export type InvestmentTransactionCreateManyInput = Prisma.InvestmentTransactionCreateManyInput;
export type CryptoTransactionCreateManyInput = Prisma.CryptoTransactionCreateManyInput;
export type AssetHistoryCreateManyInput = Prisma.AssetHistoryCreateManyInput;

export type TransactionImportBatch = {
  checkingData: CheckingTransactionCreateManyInput[];
  investmentData: InvestmentTransactionCreateManyInput[];
  cryptoData: CryptoTransactionCreateManyInput[];
};

export type TransactionImportUserRecord = {
  id: string;
  name: string;
};

export type CheckingBalanceAnchorRecord = {
  balanceCents: number;
};

export type TransactionImportRepository = {
  getExistingFingerprints(userId: string, fingerprints: string[]): Promise<Set<string>>;
  findUser(userId: string): Promise<TransactionImportUserRecord | null>;
  findLatestCheckingBalanceBefore(
    userId: string,
    sourceInstitution: string,
    bookingDate: Date
  ): Promise<CheckingBalanceAnchorRecord | null>;
  findEarliestCheckingBalanceAfter(
    userId: string,
    sourceInstitution: string,
    bookingDate: Date
  ): Promise<CheckingBalanceAnchorRecord | null>;
  createTransactions(batch: TransactionImportBatch): Promise<void>;
  listExistingAssetIsins(isins: string[]): Promise<Set<string>>;
  upsertAssetMetadata(isin: string, metadata: AssetMetadata): Promise<void>;
  createAssetHistory(points: AssetHistoryCreateManyInput[]): Promise<void>;
  listExistingCryptoTokens(tokens: string[]): Promise<Set<string>>;
  upsertCryptoAsset(tokenSymbol: string, name: string): Promise<void>;
};

function assetMetadataData(metadata: AssetMetadata) {
  return {
    type: metadata.type,
    wkn: metadata.wkn,
    name: metadata.name,
    ter: metadata.ter,
    ticker: metadata.ticker,
    marketCap: metadata.marketCap,
    country: metadata.country,
    sector: metadata.sector,
    dividendYield: metadata.dividendYield,
    perfYTD: metadata.perfYTD,
    perf1Month: metadata.perf1Month,
    perf3Months: metadata.perf3Months,
    perf6Months: metadata.perf6Months,
    perf1Year: metadata.perf1Year,
    perf3Years: metadata.perf3Years,
    perf5Years: metadata.perf5Years,
    volatility1Year: metadata.volatility1Year,
    volatility3Years: metadata.volatility3Years,
    volatility5Years: metadata.volatility5Years,
    returnPerRisk1Year: metadata.returnPerRisk1Year,
    returnPerRisk3Years: metadata.returnPerRisk3Years,
    returnPerRisk5Years: metadata.returnPerRisk5Years,
    maxDrawdown1Year: metadata.maxDrawdown1Year,
    maxDrawdown3Years: metadata.maxDrawdown3Years,
    maxDrawdown5Years: metadata.maxDrawdown5Years,
    maxDrawdownSinceInception: metadata.maxDrawdownSinceInception,
    fundSize: metadata.fundSize,
    distributionPolicy: metadata.distributionPolicy,
    replication: metadata.replication,
    inceptionDate: metadata.inceptionDate,
    holdingsTotalWeight: metadata.holdingsTotalWeight,
    holdingsCount: metadata.holdingsCount,
    topHoldings: metadata.topHoldings,
    countriesWeight: metadata.countriesWeight,
    sectorsWeight: metadata.sectorsWeight
  };
}

export const transactionImportRepository: TransactionImportRepository = {
  async getExistingFingerprints(userId, fingerprints) {
    if (fingerprints.length === 0) {
      return new Set<string>();
    }

    const [checkingTxs, investmentTxs, cryptoTxs] = await Promise.all([
      prisma.checkingTransaction.findMany({
        where: { userId, fingerprint: { in: fingerprints } },
        select: { fingerprint: true }
      }),
      prisma.investmentTransaction.findMany({
        where: { userId, fingerprint: { in: fingerprints } },
        select: { fingerprint: true }
      }),
      prisma.cryptoTransaction.findMany({
        where: { userId, fingerprint: { in: fingerprints } },
        select: { fingerprint: true }
      })
    ]);

    return new Set([
      ...checkingTxs.map((transaction) => transaction.fingerprint),
      ...investmentTxs.map((transaction) => transaction.fingerprint),
      ...cryptoTxs.map((transaction) => transaction.fingerprint)
    ]);
  },

  async findUser(userId) {
    return prisma.user.findUnique({
      where: {
        id: userId
      },
      select: {
        id: true,
        name: true
      }
    });
  },

  async findLatestCheckingBalanceBefore(userId, sourceInstitution, bookingDate) {
    return prisma.checkingTransaction.findFirst({
      where: {
        userId,
        sourceInstitution,
        bookingDate: { lt: bookingDate }
      },
      orderBy: [
        { bookingDate: "desc" },
        { importedAt: "desc" },
        { id: "desc" }
      ],
      select: { balanceCents: true }
    });
  },

  async findEarliestCheckingBalanceAfter(userId, sourceInstitution, bookingDate) {
    return prisma.checkingTransaction.findFirst({
      where: {
        userId,
        sourceInstitution,
        bookingDate: { gt: bookingDate }
      },
      orderBy: [
        { bookingDate: "asc" },
        { importedAt: "asc" },
        { id: "asc" }
      ],
      select: { balanceCents: true }
    });
  },

  async createTransactions(batch) {
    const queries: Prisma.PrismaPromise<Prisma.BatchPayload>[] = [];
    if (batch.investmentData.length > 0) {
      queries.push(prisma.investmentTransaction.createMany({ data: batch.investmentData, skipDuplicates: true }));
    }
    if (batch.cryptoData.length > 0) {
      queries.push(prisma.cryptoTransaction.createMany({ data: batch.cryptoData, skipDuplicates: true }));
    }
    if (batch.checkingData.length > 0) {
      queries.push(prisma.checkingTransaction.createMany({ data: batch.checkingData, skipDuplicates: true }));
    }

    if (queries.length > 0) {
      await prisma.$transaction(queries);
    }
  },

  async listExistingAssetIsins(isins) {
    if (isins.length === 0) {
      return new Set<string>();
    }

    const existingAssets = await prisma.asset.findMany({
      where: {
        isin: { in: isins }
      },
      select: { isin: true }
    });

    return new Set(existingAssets.map((asset) => asset.isin));
  },

  async upsertAssetMetadata(isin, metadata) {
    const data = assetMetadataData(metadata);

    await prisma.asset.upsert({
      where: { isin },
      update: data,
      create: {
        isin,
        ...data
      }
    });
  },

  async createAssetHistory(points) {
    if (points.length === 0) return;

    await prisma.assetHistory.createMany({ data: points, skipDuplicates: true });
  },

  async listExistingCryptoTokens(tokens) {
    if (tokens.length === 0) {
      return new Set<string>();
    }

    const existingCryptoAssets = await prisma.cryptoAsset.findMany({
      where: {
        tokenSymbol: { in: tokens }
      },
      select: { tokenSymbol: true }
    });

    return new Set(existingCryptoAssets.map((asset) => asset.tokenSymbol));
  },

  async upsertCryptoAsset(tokenSymbol, name) {
    await prisma.cryptoAsset.upsert({
      where: { tokenSymbol },
      update: { name },
      create: {
        tokenSymbol,
        name
      }
    });
  }
};
