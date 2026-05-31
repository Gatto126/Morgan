import { shouldLogPerformance } from "@/server/logging/logger";

type StepMetadata = Record<string, unknown>;

type PerformanceStep = StepMetadata & {
  durationMs: number;
  name: string;
};

type PerformanceLogger = {
  performance(event: string, body?: unknown): void;
};

function roundDuration(durationMs: number) {
  return Math.round(durationMs * 10) / 10;
}

function nowMs() {
  return performance.now();
}

export type PerformanceTrace = ReturnType<typeof createPerformanceTrace>;

export function createPerformanceTrace(event: string, metadata: StepMetadata = {}) {
  const startedAt = nowMs();
  const enabled = shouldLogPerformance();
  const steps: PerformanceStep[] = [];

  return {
    isEnabled: enabled,

    addStep(name: string, durationMs: number, stepMetadata: StepMetadata = {}) {
      if (!enabled) return;

      steps.push({
        ...stepMetadata,
        durationMs: roundDuration(durationMs),
        name
      });
    },

    finish(log: PerformanceLogger, extra: StepMetadata = {}) {
      if (!enabled) return;

      log.performance(event, {
        ...metadata,
        ...extra,
        durationMs: roundDuration(nowMs() - startedAt),
        steps
      });
    }
  };
}

export function measurePerformanceStep<T>(
  trace: PerformanceTrace | undefined,
  name: string,
  operation: () => Promise<T>,
  metadata: StepMetadata | ((value: T) => StepMetadata) = {}
) {
  if (!trace?.isEnabled) {
    return operation();
  }

  const startedAt = nowMs();

  return operation().then(
    (value) => {
      const resolvedMetadata = typeof metadata === "function" ? metadata(value) : metadata;
      trace?.addStep(name, nowMs() - startedAt, resolvedMetadata);
      return value;
    },
    (error: unknown) => {
      const baseMetadata = typeof metadata === "function" ? {} : metadata;
      trace?.addStep(name, nowMs() - startedAt, {
        ...baseMetadata,
        failed: true
      });
      throw error;
    }
  );
}

export function getJsonSizeBytesIfTracing(trace: PerformanceTrace | undefined, value: unknown) {
  if (!trace?.isEnabled) {
    return undefined;
  }

  try {
    return new TextEncoder().encode(JSON.stringify(value)).length;
  } catch {
    return undefined;
  }
}
