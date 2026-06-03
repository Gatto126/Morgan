-- CreateTable
CREATE TABLE "BinanceDailySnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "snapshotAt" TIMESTAMP(3) NOT NULL,
    "totalEurValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tokenCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BinanceDailySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BinanceDailySnapshotToken" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "tokenSymbol" TEXT NOT NULL,
    "tokenName" TEXT,
    "freeAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lockedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "eurPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "eurValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BinanceDailySnapshotToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BinanceDailySnapshot_dateKey_idx" ON "BinanceDailySnapshot"("dateKey");

-- CreateIndex
CREATE INDEX "BinanceDailySnapshot_userId_idx" ON "BinanceDailySnapshot"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BinanceDailySnapshot_userId_dateKey_key" ON "BinanceDailySnapshot"("userId", "dateKey");

-- CreateIndex
CREATE INDEX "BinanceDailySnapshotToken_snapshotId_idx" ON "BinanceDailySnapshotToken"("snapshotId");

-- CreateIndex
CREATE INDEX "BinanceDailySnapshotToken_tokenSymbol_idx" ON "BinanceDailySnapshotToken"("tokenSymbol");

-- CreateIndex
CREATE UNIQUE INDEX "BinanceDailySnapshotToken_snapshotId_tokenSymbol_key" ON "BinanceDailySnapshotToken"("snapshotId", "tokenSymbol");

-- AddForeignKey
ALTER TABLE "BinanceDailySnapshot" ADD CONSTRAINT "BinanceDailySnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BinanceDailySnapshotToken" ADD CONSTRAINT "BinanceDailySnapshotToken_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "BinanceDailySnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
