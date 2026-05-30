"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type TransactionRowsPayload<TTransaction> = {
  transactions: TTransaction[];
  total: number;
  nextOffset: number | null;
  error?: string;
};

type UseTransactionRowsOptions = {
  endpoint: string;
  initialPageSize?: number;
  isActive: boolean;
  pageSize?: number;
  sourceInstitution: string;
  totalCount: number;
  userId: string;
};

type TransactionRowsState<TTransaction> = {
  error: string | null;
  loading: boolean;
  nextOffset: number | null;
  requestKey: string;
  total: number;
  transactions: TTransaction[];
};

const TRANSACTION_ROWS_CACHE_MAX_AGE_MS = 5_000;
const transactionRowsCache = new Map<string, {
  payload: TransactionRowsPayload<unknown>;
  updatedAt: number;
}>();
const inFlightTransactionRows = new Map<string, Promise<TransactionRowsPayload<unknown>>>();

async function fetchTransactionRows<TTransaction>(cacheKey: string, url: string) {
  const cached = transactionRowsCache.get(cacheKey);
  if (cached && Date.now() - cached.updatedAt <= TRANSACTION_ROWS_CACHE_MAX_AGE_MS) {
    return cached.payload as TransactionRowsPayload<TTransaction>;
  }

  const inFlightRequest = inFlightTransactionRows.get(cacheKey);
  if (inFlightRequest) {
    return inFlightRequest as Promise<TransactionRowsPayload<TTransaction>>;
  }

  const request = fetch(url, { cache: "no-store" })
    .then(async (response) => {
      const payload = (await response.json()) as TransactionRowsPayload<TTransaction>;

      if (!response.ok) {
        throw new Error(payload.error ?? "Errore nel caricamento delle transazioni.");
      }

      transactionRowsCache.set(cacheKey, {
        payload: payload as TransactionRowsPayload<unknown>,
        updatedAt: Date.now()
      });
      return payload;
    })
    .finally(() => {
      inFlightTransactionRows.delete(cacheKey);
    });

  inFlightTransactionRows.set(cacheKey, request as Promise<TransactionRowsPayload<unknown>>);
  return request;
}

export function useTransactionRows<TTransaction>({
  endpoint,
  initialPageSize = 20,
  isActive,
  pageSize = 10,
  sourceInstitution,
  totalCount,
  userId
}: UseTransactionRowsOptions) {
  const requestKey = `${endpoint}|${userId}|${sourceInstitution}|${totalCount}|${initialPageSize}|${pageSize}`;
  const [state, setState] = useState<TransactionRowsState<TTransaction>>({
    error: null,
    loading: false,
    nextOffset: totalCount > 0 ? 0 : null,
    requestKey,
    total: totalCount,
    transactions: []
  });
  const currentRequestKeyRef = useRef(requestKey);
  const loadingPageKeyRef = useRef<string | null>(null);
  const isCurrentState = state.requestKey === requestKey;
  const transactions = isCurrentState ? state.transactions : [];
  const total = isCurrentState ? state.total : totalCount;
  const nextOffset = isCurrentState ? state.nextOffset : totalCount > 0 ? 0 : null;
  const loading = isCurrentState ? state.loading : false;
  const error = isCurrentState ? state.error : null;

  const loadPage = useCallback(async (offset: number, replace = false) => {
    const activeRequestKey = requestKey;
    const limit = replace ? initialPageSize : pageSize;
    const pageKey = `${activeRequestKey}|offset=${offset}|limit=${limit}`;
    if (loadingPageKeyRef.current === pageKey) {
      return;
    }

    loadingPageKeyRef.current = pageKey;
    currentRequestKeyRef.current = activeRequestKey;
    setState((previousState) => ({
      error: null,
      loading: true,
      nextOffset: replace ? (totalCount > 0 ? 0 : null) : previousState.nextOffset,
      requestKey: activeRequestKey,
      total: replace ? totalCount : previousState.total,
      transactions: replace ? [] : previousState.transactions
    }));

    try {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
        provider: sourceInstitution,
        userId
      });
      const payload = await fetchTransactionRows<TTransaction>(pageKey, `${endpoint}?${params.toString()}`);

      if (currentRequestKeyRef.current !== activeRequestKey) {
        return;
      }

      setState((previousState) => ({
        error: null,
        loading: false,
        nextOffset: payload.nextOffset,
        requestKey: activeRequestKey,
        total: payload.total,
        transactions: replace
          ? payload.transactions
          : [...previousState.transactions, ...payload.transactions]
      }));
    } catch (fetchError: unknown) {
      if (currentRequestKeyRef.current !== activeRequestKey) {
        return;
      }

      setState((previousState) => ({
        ...previousState,
        error: fetchError instanceof Error ? fetchError.message : "Errore nel caricamento delle transazioni.",
        loading: false,
        requestKey: activeRequestKey
      }));
    } finally {
      if (loadingPageKeyRef.current === pageKey) {
        loadingPageKeyRef.current = null;
      }

      if (currentRequestKeyRef.current === activeRequestKey) {
        setState((previousState) => ({
          ...previousState,
          loading: false,
          requestKey: activeRequestKey
        }));
      }
    }
  }, [endpoint, initialPageSize, pageSize, requestKey, sourceInstitution, totalCount, userId]);

  useEffect(() => {
    if (!isActive || totalCount === 0) {
      return;
    }

    void loadPage(0, true);
  }, [isActive, loadPage, requestKey, totalCount]);

  const loadNext = useCallback(() => {
    if (loading || nextOffset === null) {
      return;
    }

    void loadPage(nextOffset);
  }, [loadPage, loading, nextOffset]);

  return {
    error,
    hasMore: nextOffset !== null,
    loading,
    loadNext,
    total,
    transactions
  };
}
