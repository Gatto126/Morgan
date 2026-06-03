import { prisma } from "@/server/db/prisma";

export type BinanceDailySnapshotProfile = {
  binanceApiKeyEncrypted: string | null;
  binanceApiKeyPreview: string | null;
  binanceApiSecretEncrypted: string | null;
  id: string;
  name: string;
};

export type BinanceDailySnapshotTokenInput = {
  eurPrice: number;
  eurValue: number;
  freeAmount: number;
  lockedAmount: number;
  tokenName: string | null;
  tokenSymbol: string;
  totalAmount: number;
};

export type BinanceDailySnapshotSummary = {
  dateKey: string;
  id: string;
  snapshotAt: Date;
  tokenCount: number;
  totalEurValue: number;
  userId: string;
};

export type BinanceDailySnapshotWriteResult = BinanceDailySnapshotSummary & {
  created: boolean;
};

export type CreateBinanceDailySnapshotInput = {
  dateKey: string;
  snapshotAt: Date;
  tokens: BinanceDailySnapshotTokenInput[];
  totalEurValue: number;
  userId: string;
};

export type BinanceDailySnapshotRepository = {
  createSnapshot(input: CreateBinanceDailySnapshotInput): Promise<BinanceDailySnapshotWriteResult>;
  findSnapshot(userId: string, dateKey: string): Promise<BinanceDailySnapshotSummary | null>;
  listSnapshots(userId: string): Promise<BinanceDailySnapshotSummary[]>;
  listProfilesWithBinanceCredentials(): Promise<BinanceDailySnapshotProfile[]>;
};

const snapshotSelect = {
  dateKey: true,
  id: true,
  snapshotAt: true,
  tokenCount: true,
  totalEurValue: true,
  userId: true
} as const;

async function listProfilesWithBinanceCredentials() {
  return prisma.user.findMany({
    where: {
      binanceApiKeyEncrypted: { not: null },
      binanceApiSecretEncrypted: { not: null }
    },
    orderBy: { createdAt: "asc" },
    select: {
      binanceApiKeyEncrypted: true,
      binanceApiKeyPreview: true,
      binanceApiSecretEncrypted: true,
      id: true,
      name: true
    }
  });
}

async function findSnapshot(userId: string, dateKey: string) {
  return prisma.binanceDailySnapshot.findUnique({
    where: { userId_dateKey: { userId, dateKey } },
    select: snapshotSelect
  });
}

async function listSnapshots(userId: string) {
  return prisma.binanceDailySnapshot.findMany({
    where: { userId },
    orderBy: { dateKey: "asc" },
    select: snapshotSelect
  });
}

async function createSnapshot({
  dateKey,
  snapshotAt,
  tokens,
  totalEurValue,
  userId
}: CreateBinanceDailySnapshotInput) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.binanceDailySnapshot.findUnique({
      where: { userId_dateKey: { userId, dateKey } },
      select: snapshotSelect
    });

    if (existing) {
      return { ...existing, created: false };
    }

    const snapshot = await tx.binanceDailySnapshot.create({
      data: {
        dateKey,
        snapshotAt,
        tokenCount: tokens.length,
        totalEurValue,
        userId
      },
      select: snapshotSelect
    });

    if (tokens.length > 0) {
      await tx.binanceDailySnapshotToken.createMany({
        data: tokens.map((token) => ({
          ...token,
          snapshotId: snapshot.id
        }))
      });
    }

    return { ...snapshot, created: true };
  });
}

export const binanceDailySnapshotRepository: BinanceDailySnapshotRepository = {
  createSnapshot,
  findSnapshot,
  listSnapshots,
  listProfilesWithBinanceCredentials
};
