-- Improve production dashboard reads on Vercel/Neon.
CREATE INDEX "CheckingTransaction_userId_sourceInstitution_bookingDate_id_idx"
  ON "CheckingTransaction"("userId", "sourceInstitution", "bookingDate", "id");

CREATE INDEX "InvestmentTransaction_userId_sourceInstitution_bookingDate_id_idx"
  ON "InvestmentTransaction"("userId", "sourceInstitution", "bookingDate", "id");

CREATE INDEX "CryptoTransaction_userId_sourceInstitution_bookingDate_id_idx"
  ON "CryptoTransaction"("userId", "sourceInstitution", "bookingDate", "id");

CREATE INDEX "AssetHistory_currency_isin_date_idx"
  ON "AssetHistory"("currency", "isin", "date");
