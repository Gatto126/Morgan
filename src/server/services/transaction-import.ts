import crypto from "node:crypto";

import { classifyTransaction } from "@/domain/imports/transaction-classifier";
import { fetchAssetMetadata, fetchAssetHistory } from "@/integrations/justetf/justetf-parser";
import { fetchCryptoHistory } from "@/integrations/binance/binance-parser";
import { apiLogger } from "@/server/logging/logger";
import type { PreviewTransactionPayload } from "@/domain/imports/transaction-preview";
import {
  transactionImportRepository,
  type CheckingTransactionCreateManyInput,
  type CryptoTransactionCreateManyInput,
  type InvestmentTransactionCreateManyInput,
  type TransactionImportRepository
} from "@/server/repositories/transaction-import-repository";

export { markPreviewTransactions, previewTransactionSchema } from "@/domain/imports/transaction-preview";
export type { PreviewTransactionPayload } from "@/domain/imports/transaction-preview";

const log = apiLogger("Import");

export async function getExistingFingerprints(
  userId: string,
  fingerprints: string[],
  repository: TransactionImportRepository = transactionImportRepository
) {
  return repository.getExistingFingerprints(userId, fingerprints);
}

export async function assertUserExists(
  userId: string,
  repository: TransactionImportRepository = transactionImportRepository
) {
  const user = await repository.findUser(userId);

  if (!user) {
    throw new Error("Utente non trovato.");
  }

  return user;
}

export async function importPreviewTransactions(
  userId: string,
  transactions: PreviewTransactionPayload[],
  statementFileName?: string,
  repository: TransactionImportRepository = transactionImportRepository
) {
  const uniqueTransactions = [...new Map(transactions.map((transaction) => [transaction.fingerprint, transaction])).values()];
  const existingFingerprints = await getExistingFingerprints(
    userId,
    uniqueTransactions.map((transaction) => transaction.fingerprint),
    repository
  );

  const transactionsToCreate = uniqueTransactions.filter(
    (transaction) => !existingFingerprints.has(transaction.fingerprint)
  );

  if (transactionsToCreate.length > 0) {
    const checkingData: CheckingTransactionCreateManyInput[] = [];
    const investmentData: InvestmentTransactionCreateManyInput[] = [];
    const cryptoData: CryptoTransactionCreateManyInput[] = [];

    for (const tx of transactionsToCreate) {
      const classification = classifyTransaction(tx.typeLabel, tx.description);
      const accountType = tx.accountType ?? classification.accountType;
      const productName = tx.productName === undefined ? classification.productName : tx.productName;
      const isin = tx.isin === undefined ? classification.isin : tx.isin;
      const quantityUnits =
        tx.quantityUnits === undefined ? classification.quantityUnits : tx.quantityUnits;
      const tradeType = tx.tradeType === undefined ? classification.tradeType : tx.tradeType;

      if (accountType === "checking") {
        checkingData.push({
          userId,
          sourceInstitution: tx.sourceInstitution,
          fingerprint: tx.fingerprint,
          bookingDate: new Date(tx.bookingDate),
          rawDateLabel: tx.rawDateLabel,
          typeLabel: tx.typeLabel,
          description: tx.description,
          direction: tx.direction,
          amountCents: tx.amountCents,
          balanceCents: tx.balanceCents,
          currency: tx.currency,
          statementFileName
        });
      } else if (accountType === "investment") {
        const investmentId = crypto.randomUUID();
        const cashSideCheckingId = crypto.randomUUID();

        investmentData.push({
          id: investmentId,
          userId,
          sourceInstitution: tx.sourceInstitution,
          fingerprint: tx.fingerprint,
          bookingDate: new Date(tx.bookingDate),
          rawDateLabel: tx.rawDateLabel,
          typeLabel: tx.typeLabel,
          description: tx.description,
          direction: tx.direction,
          amountCents: tx.amountCents,
          currency: tx.currency,
          productName,
          isin,
          quantityUnits,
          tradeType,
          statementFileName
        });

        // Double-entry record for cash impact
        checkingData.push({
          id: cashSideCheckingId,
          userId,
          sourceInstitution: tx.sourceInstitution,
          fingerprint: `${tx.fingerprint}-cash`,
          bookingDate: new Date(tx.bookingDate),
          rawDateLabel: tx.rawDateLabel,
          typeLabel: tx.typeLabel,
          description: `Regolamento liquidità: ${tx.description}`,
          direction: tx.direction,
          amountCents: tx.amountCents,
          balanceCents: tx.balanceCents,
          currency: tx.currency,
          statementFileName,
          relatedInvestmentId: investmentId
        });
      } else if (accountType === "crypto") {
        const cryptoId = crypto.randomUUID();
        const cashSideCheckingId = crypto.randomUUID();

        cryptoData.push({
          id: cryptoId,
          userId,
          sourceInstitution: tx.sourceInstitution,
          fingerprint: tx.fingerprint,
          bookingDate: new Date(tx.bookingDate),
          rawDateLabel: tx.rawDateLabel,
          typeLabel: tx.typeLabel,
          description: tx.description,
          direction: tx.direction,
          amountCents: tx.amountCents,
          currency: tx.currency,
          tokenName: productName,
          tokenSymbol: isin,
          quantityUnits,
          statementFileName
        });

        // Double-entry record for cash impact
        checkingData.push({
          id: cashSideCheckingId,
          userId,
          sourceInstitution: tx.sourceInstitution,
          fingerprint: `${tx.fingerprint}-cash`,
          bookingDate: new Date(tx.bookingDate),
          rawDateLabel: tx.rawDateLabel,
          typeLabel: tx.typeLabel,
          description: `Regolamento liquidità crypto: ${tx.description}`,
          direction: tx.direction,
          amountCents: tx.amountCents,
          balanceCents: tx.balanceCents,
          currency: tx.currency,
          statementFileName,
          relatedCryptoId: cryptoId
        });
      }
    }

    await repository.createTransactions({
      checkingData,
      investmentData,
      cryptoData
    });

    // Extract unique ISINs from transactions to create
    const isinsToProcess = new Set<string>();
    for (const tx of transactionsToCreate) {
      const classification = classifyTransaction(tx.typeLabel, tx.description);
      const accountType = tx.accountType ?? classification.accountType;
      const isin = tx.isin === undefined ? classification.isin : tx.isin;
      if (accountType === "investment" && isin && isin.length === 12) {
        isinsToProcess.add(isin);
      }
    }

    // Process unique crypto tokens
    const tokensToProcess = new Set<string>();
    const tokenNames = new Map<string, string>();
    for (const tx of transactionsToCreate) {
      const classification = classifyTransaction(tx.typeLabel, tx.description);
      const accountType = tx.accountType ?? classification.accountType;
      const tokenSymbol = tx.isin === undefined ? classification.isin : tx.isin;
      const tokenName = tx.productName === undefined ? classification.productName : tx.productName;
      if (accountType === "crypto" && tokenSymbol) {
        tokensToProcess.add(tokenSymbol);
        if (tokenName) {
          tokenNames.set(tokenSymbol, tokenName);
        }
      }
    }

    // Run JustETF (for ISINs) and Binance (for Cryptos) processes concurrently
    const etfPromise = (async () => {
      if (isinsToProcess.size === 0) return;
      log.info(`${isinsToProcess.size} ISIN unici da elaborare: ${Array.from(isinsToProcess).join(", ")}`);
      
      const existingIsins = await repository.listExistingAssetIsins(Array.from(isinsToProcess));
      if (existingIsins.size > 0) {
        log.info(`Saltati ${existingIsins.size} ISIN già presenti: ${Array.from(existingIsins).join(", ")}`);
      }
      
      const missingIsins = Array.from(isinsToProcess).filter((isin) => !existingIsins.has(isin));

      if (missingIsins.length > 0) {
        await Promise.all(
          missingIsins.map(async (isin) => {
            try {
              log.info(`Fetching metadata JustETF per nuovo ISIN: ${isin}`);
              const metadata = await fetchAssetMetadata(isin);
              await repository.upsertAssetMetadata(isin, metadata);

              log.info(`Fetching storico prezzi JustETF per nuovo ISIN: ${isin}`);
              const historyPoints = await fetchAssetHistory(isin);
              if (historyPoints.length > 0) {
                await repository.createAssetHistory(
                  historyPoints.map((p) => ({
                    isin,
                    date: p.date,
                    value: p.value,
                    currency: "EUR"
                  }))
                );
                log.info(`Salvato storico prezzi per ${isin}: ${historyPoints.length} punti`);
              }
            } catch (err) {
              log.error("AssetSync", `Errore durante il fetch dei dettagli per ISIN: ${isin}`, err);
            }
          })
        );
      }
    })();

    const cryptoPromise = (async () => {
      if (tokensToProcess.size === 0) return;
      log.info(`${tokensToProcess.size} token crypto unici da elaborare: ${Array.from(tokensToProcess).join(", ")}`);

      const existingTokens = await repository.listExistingCryptoTokens(Array.from(tokensToProcess));
      if (existingTokens.size > 0) {
        log.info(`Saltati ${existingTokens.size} token crypto già presenti: ${Array.from(existingTokens).join(", ")}`);
      }

      const missingTokens = Array.from(tokensToProcess).filter((symbol) => !existingTokens.has(symbol));

      if (missingTokens.length > 0) {
        await Promise.all(
          missingTokens.map(async (symbol) => {
            try {
              log.info(`Creazione metadati crypto per: ${symbol}`);
              await repository.upsertCryptoAsset(symbol, tokenNames.get(symbol) || symbol);

              log.info(`Fetching storico prezzi Binance per nuova crypto: ${symbol}`);
              const historyPoints = await fetchCryptoHistory(symbol);
              if (historyPoints.length > 0) {
                await repository.createAssetHistory(
                  historyPoints.map((p) => ({
                    isin: symbol,
                    date: p.date,
                    value: p.value,
                    currency: "EUR"
                  }))
                );
                log.info(`Salvato storico prezzi Binance per ${symbol}: ${historyPoints.length} punti`);
              }
            } catch (err) {
              log.error("CryptoAssetSync", `Errore durante la creazione dei metadati/storico crypto per: ${symbol}`, err);
            }
          })
        );
      }
    })();

    await Promise.all([etfPromise, cryptoPromise]);
  }

  return {
    insertedCount: transactionsToCreate.length,
    skippedCount: uniqueTransactions.length - transactionsToCreate.length,
    insertedFingerprints: transactionsToCreate.map((transaction) => transaction.fingerprint)
  };
}
