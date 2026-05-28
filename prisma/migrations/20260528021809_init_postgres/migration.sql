-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "binanceApiKeyEncrypted" TEXT,
    "binanceApiSecretEncrypted" TEXT,
    "binanceApiKeyPreview" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthUser" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "username" TEXT,
    "displayUsername" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthAccount" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "idToken" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthVerification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "lastRequest" BIGINT NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckingTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceInstitution" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "bookingDate" TIMESTAMP(3) NOT NULL,
    "rawDateLabel" TEXT NOT NULL,
    "typeLabel" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "balanceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "statementFileName" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "relatedInvestmentId" TEXT,
    "relatedCryptoId" TEXT,

    CONSTRAINT "CheckingTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestmentTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceInstitution" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "bookingDate" TIMESTAMP(3) NOT NULL,
    "rawDateLabel" TEXT NOT NULL,
    "typeLabel" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "productName" TEXT,
    "isin" TEXT,
    "quantityUnits" DOUBLE PRECISION,
    "tradeType" TEXT,
    "statementFileName" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvestmentTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CryptoTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceInstitution" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "bookingDate" TIMESTAMP(3) NOT NULL,
    "rawDateLabel" TEXT NOT NULL,
    "typeLabel" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "tokenName" TEXT,
    "tokenSymbol" TEXT,
    "quantityUnits" DOUBLE PRECISION,
    "statementFileName" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CryptoTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "isin" TEXT NOT NULL,
    "ticker" TEXT,
    "name" TEXT,
    "ter" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "wkn" TEXT,
    "type" TEXT,
    "country" TEXT,
    "marketCap" TEXT,
    "dividendYield" TEXT,
    "sector" TEXT,
    "perf1Month" TEXT,
    "perf1Year" TEXT,
    "perf3Months" TEXT,
    "perf3Years" TEXT,
    "perf5Years" TEXT,
    "perf6Months" TEXT,
    "perfYTD" TEXT,
    "maxDrawdown1Year" TEXT,
    "maxDrawdown3Years" TEXT,
    "maxDrawdown5Years" TEXT,
    "maxDrawdownSinceInception" TEXT,
    "returnPerRisk1Year" TEXT,
    "returnPerRisk3Years" TEXT,
    "returnPerRisk5Years" TEXT,
    "volatility1Year" TEXT,
    "volatility3Years" TEXT,
    "volatility5Years" TEXT,
    "distributionPolicy" TEXT,
    "fundSize" TEXT,
    "inceptionDate" TEXT,
    "replication" TEXT,
    "holdingsCount" TEXT,
    "holdingsTotalWeight" TEXT,
    "topHoldings" TEXT,
    "countriesWeight" TEXT,
    "sectorsWeight" TEXT,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("isin")
);

-- CreateTable
CREATE TABLE "CryptoAsset" (
    "tokenSymbol" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CryptoAsset_pkey" PRIMARY KEY ("tokenSymbol")
);

-- CreateTable
CREATE TABLE "AssetHistory" (
    "id" TEXT NOT NULL,
    "isin" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceCache" (
    "key" TEXT NOT NULL,
    "price" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceCache_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "BinanceBalance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenSymbol" TEXT NOT NULL,
    "tokenName" TEXT,
    "freeAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lockedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "eurValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BinanceBalance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "User_ownerId_idx" ON "User"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "User_ownerId_name_key" ON "User"("ownerId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "AuthUser_email_key" ON "AuthUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AuthUser_username_key" ON "AuthUser"("username");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_token_key" ON "AuthSession"("token");

-- CreateIndex
CREATE INDEX "AuthSession_userId_idx" ON "AuthSession"("userId");

-- CreateIndex
CREATE INDEX "AuthAccount_userId_idx" ON "AuthAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimit_key_key" ON "RateLimit"("key");

-- CreateIndex
CREATE INDEX "CheckingTransaction_userId_bookingDate_idx" ON "CheckingTransaction"("userId", "bookingDate");

-- CreateIndex
CREATE UNIQUE INDEX "CheckingTransaction_userId_fingerprint_key" ON "CheckingTransaction"("userId", "fingerprint");

-- CreateIndex
CREATE INDEX "InvestmentTransaction_userId_bookingDate_idx" ON "InvestmentTransaction"("userId", "bookingDate");

-- CreateIndex
CREATE INDEX "InvestmentTransaction_userId_isin_idx" ON "InvestmentTransaction"("userId", "isin");

-- CreateIndex
CREATE UNIQUE INDEX "InvestmentTransaction_userId_fingerprint_key" ON "InvestmentTransaction"("userId", "fingerprint");

-- CreateIndex
CREATE INDEX "CryptoTransaction_userId_bookingDate_idx" ON "CryptoTransaction"("userId", "bookingDate");

-- CreateIndex
CREATE INDEX "CryptoTransaction_userId_tokenSymbol_idx" ON "CryptoTransaction"("userId", "tokenSymbol");

-- CreateIndex
CREATE UNIQUE INDEX "CryptoTransaction_userId_fingerprint_key" ON "CryptoTransaction"("userId", "fingerprint");

-- CreateIndex
CREATE INDEX "AssetHistory_isin_date_idx" ON "AssetHistory"("isin", "date");

-- CreateIndex
CREATE UNIQUE INDEX "AssetHistory_isin_date_currency_key" ON "AssetHistory"("isin", "date", "currency");

-- CreateIndex
CREATE INDEX "BinanceBalance_userId_idx" ON "BinanceBalance"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BinanceBalance_userId_tokenSymbol_key" ON "BinanceBalance"("userId", "tokenSymbol");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "AuthUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AuthUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthAccount" ADD CONSTRAINT "AuthAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AuthUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckingTransaction" ADD CONSTRAINT "CheckingTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckingTransaction" ADD CONSTRAINT "CheckingTransaction_relatedInvestmentId_fkey" FOREIGN KEY ("relatedInvestmentId") REFERENCES "InvestmentTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckingTransaction" ADD CONSTRAINT "CheckingTransaction_relatedCryptoId_fkey" FOREIGN KEY ("relatedCryptoId") REFERENCES "CryptoTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentTransaction" ADD CONSTRAINT "InvestmentTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CryptoTransaction" ADD CONSTRAINT "CryptoTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BinanceBalance" ADD CONSTRAINT "BinanceBalance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
