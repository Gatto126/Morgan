"use client";

import { useEffect, useMemo, useState } from "react";

export type BinanceHistoricalPoint = {
  dateKey: string;
  valueCents: number;
};

type BinanceHistoryState = {
  points: BinanceHistoricalPoint[];
  status: "idle" | "loading" | "ready";
  userId: string | null;
};

const emptyState: BinanceHistoryState = {
  points: [],
  status: "idle",
  userId: null
};

export function useBinanceHistory({
  enabled,
  userId
}: {
  enabled: boolean;
  userId: string;
}) {
  const [state, setState] = useState<BinanceHistoryState>(emptyState);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      if (!enabled) {
        setState(emptyState);
        return;
      }

      setState((current) => ({
        points: current.userId === userId ? current.points : [],
        status: "loading",
        userId
      }));

      void fetch(`/api/binance/history?userId=${encodeURIComponent(userId)}`, {
        signal: controller.signal
      })
        .then(async (response) => {
          if (!response.ok) return null;
          return (await response.json()) as {
            snapshots?: Array<{ dateKey: string; totalEurValue: number }>;
          };
        })
        .then((payload) => {
          if (!payload || !Array.isArray(payload.snapshots)) {
            setState({ points: [], status: "ready", userId });
            return;
          }

          setState({
            points: payload.snapshots.map((snapshot) => ({
              dateKey: snapshot.dateKey,
              valueCents: Math.round(snapshot.totalEurValue * 100)
            })),
            status: "ready",
            userId
          });
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") {
            return;
          }

          setState({ points: [], status: "ready", userId });
        });
    }, 0);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [enabled, userId]);

  const historyReady = !enabled || (state.userId === userId && state.status === "ready");

  return useMemo(() => ({
    binanceHistoricalPoints: state.userId === userId ? state.points : [],
    binanceHistoryReady: historyReady
  }), [historyReady, state.points, state.userId, userId]);
}
