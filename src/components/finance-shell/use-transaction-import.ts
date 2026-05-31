"use client";

import { useMemo, useRef, useState, type ChangeEvent, type MutableRefObject } from "react";

import type { PreviewSummary, PreviewTransaction } from "./types";

const PAGE_SIZE = 12;

export type ImportedTransactionCounts = {
  insertedCount: number;
  addedChecking: number;
  addedInvestment: number;
  addedCrypto: number;
};

type UseTransactionImportOptions = {
  activeUserId: string | null;
  fileInputRef: MutableRefObject<HTMLInputElement | null>;
  setError: (message: string | null) => void;
  setNotice: (message: string | null) => void;
  onImportedTransactions: (counts: ImportedTransactionCounts) => void;
};

function getPreviewAccountType(transaction: PreviewTransaction) {
  return transaction.accountType ?? (transaction.sourceInstitution === "bbva" ? "checking" : undefined);
}

export function countImportedTransactionsByAccountType(
  transactions: PreviewTransaction[],
  insertedFingerprints: Set<string>
) {
  let addedChecking = 0;
  let addedInvestment = 0;
  let addedCrypto = 0;

  transactions.forEach((transaction) => {
    if (!insertedFingerprints.has(transaction.fingerprint)) {
      return;
    }

    const accountType = getPreviewAccountType(transaction);
    if (accountType === "checking") addedChecking++;
    else if (accountType === "investment") addedInvestment++;
    else if (accountType === "crypto") addedCrypto++;
  });

  return {
    addedChecking,
    addedCrypto,
    addedInvestment
  };
}

export function useTransactionImport({
  activeUserId,
  fileInputRef,
  setError,
  setNotice,
  onImportedTransactions
}: UseTransactionImportOptions) {
  const [parsing, setParsing] = useState(false);
  const [approving, setApproving] = useState(false);
  const [previewSummary, setPreviewSummary] = useState<PreviewSummary | null>(null);
  const [previewTransactions, setPreviewTransactions] = useState<PreviewTransaction[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [importOverlayVisible, setImportOverlayVisible] = useState(false);
  const [importOverlayFadingOut, setImportOverlayFadingOut] = useState(false);
  const importOverlayDismissedRef = useRef(false);

  const totalPages = Math.max(1, Math.ceil(previewTransactions.length / PAGE_SIZE));
  const visiblePage = Math.min(currentPage, totalPages);
  const currentTransactions = useMemo(() => {
    const startIndex = (visiblePage - 1) * PAGE_SIZE;
    return previewTransactions.slice(startIndex, startIndex + PAGE_SIZE);
  }, [previewTransactions, visiblePage]);

  const newTransactionsCount = useMemo(
    () => previewTransactions.filter((transaction) => transaction.status === "new").length,
    [previewTransactions]
  );

  function resetPreview() {
    setPreviewSummary(null);
    setPreviewTransactions([]);
    setCurrentPage(1);
  }

  function openFilePicker() {
    if (parsing || approving) {
      return;
    }

    fileInputRef.current?.click();
  }

  function handleImportRefreshComplete() {
    if (importOverlayDismissedRef.current) return;
    importOverlayDismissedRef.current = true;
    setImportOverlayFadingOut(true);
    setTimeout(() => {
      setImportOverlayVisible(false);
      setImportOverlayFadingOut(false);
      importOverlayDismissedRef.current = false;
    }, 550);
  }

  async function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    const selectedFile = files?.[0] ?? null;
    event.currentTarget.value = "";

    if (!selectedFile || !activeUserId) {
      return;
    }

    if ((files?.length ?? 0) > 1) {
      setError("Carica un solo file alla volta.");
      return;
    }

    setParsing(true);
    setError(null);
    setNotice(null);

    try {
      const formData = new FormData();
      formData.append("userId", activeUserId);
      formData.append("file", selectedFile);

      const response = await fetch("/api/transactions/preview", {
        method: "POST",
        body: formData
      });

      const payload = (await response.json()) as {
        summary?: PreviewSummary;
        transactions?: PreviewTransaction[];
        error?: string;
      };

      if (!response.ok || !payload.summary || !payload.transactions) {
        throw new Error(payload.error ?? "Parsing del file non riuscito.");
      }

      setPreviewSummary(payload.summary);
      setPreviewTransactions(payload.transactions);
      setCurrentPage(1);
    } catch (parsingError) {
      setError(parsingError instanceof Error ? parsingError.message : "Parsing del file non riuscito.");
    } finally {
      setParsing(false);
    }
  }

  async function approveTransactions(onSuccess?: () => void) {
    if (!activeUserId || !previewSummary || previewTransactions.length === 0 || approving) {
      return;
    }

    importOverlayDismissedRef.current = false;
    setImportOverlayFadingOut(false);
    setImportOverlayVisible(true);
    setApproving(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/transactions/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userId: activeUserId,
          statementFileName: previewSummary.fileName,
          transactions: previewTransactions
        })
      });

      const payload = (await response.json()) as {
        insertedCount?: number;
        skippedCount?: number;
        insertedFingerprints?: string[];
        error?: string;
      };

      if (!response.ok || !payload.insertedFingerprints) {
        throw new Error(payload.error ?? "Salvataggio delle transazioni non riuscito.");
      }

      const insertedFingerprintSet = new Set(payload.insertedFingerprints);

      setPreviewTransactions((currentTransactionsState) =>
        currentTransactionsState.map((transaction) => {
          if (insertedFingerprintSet.has(transaction.fingerprint)) {
            return {
              ...transaction,
              status: "saved"
            };
          }

          return transaction;
        })
      );

      setPreviewSummary((currentSummary) =>
        currentSummary
          ? {
              ...currentSummary,
              newTransactions: 0,
              existingTransactions: currentSummary.totalTransactions
            }
          : currentSummary
      );

      setNotice(
        `Import completato: ${payload.insertedCount ?? 0} transazioni salvate, ${payload.skippedCount ?? 0} gia presenti.`
      );

      const insertedCount = payload.insertedCount ?? 0;
      if (insertedCount > 0) {
        const {
          addedChecking,
          addedCrypto,
          addedInvestment
        } = countImportedTransactionsByAccountType(previewTransactions, insertedFingerprintSet);

        onImportedTransactions({
          insertedCount,
          addedChecking,
          addedInvestment,
          addedCrypto
        });
      }

      resetPreview();
      onSuccess?.();
      if (insertedCount === 0) {
        handleImportRefreshComplete();
      }
    } catch (approvalError) {
      setError(approvalError instanceof Error ? approvalError.message : "Salvataggio delle transazioni non riuscito.");
      if (!importOverlayDismissedRef.current) {
        handleImportRefreshComplete();
      }
    } finally {
      setApproving(false);
    }
  }

  return {
    parsing,
    approving,
    previewSummary,
    previewTransactions,
    totalPages,
    visiblePage,
    currentTransactions,
    newTransactionsCount,
    importOverlayVisible,
    importOverlayFadingOut,
    resetPreview,
    openFilePicker,
    handleFileSelection,
    approveTransactions,
    handleImportRefreshComplete,
    goToPreviousPage: () => setCurrentPage((page) => Math.max(1, page - 1)),
    goToNextPage: () => setCurrentPage((page) => Math.min(totalPages, page + 1))
  };
}
