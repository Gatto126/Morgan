import { getUtcDateKey } from "@/shared/date-keys";
import type { PerformanceTrace } from "@/server/logging/performance";
import {
  profileStageSnapshotRepository,
  type ProfileStageSnapshotRepository
} from "@/server/repositories/profile-stage-snapshot-repository";

type SnapshotStage = "checking" | "crypto" | "dashboard" | "investment";

type ProfileStageSnapshotMetric = {
  dateKey: string;
  stage: SnapshotStage;
  status: "disabled" | "hit" | "miss" | "store_failed" | "stored";
  userId: string;
  version: number;
};

type GetProfileStageSnapshotOptions = {
  dateKey?: string;
  onMetric?: (metric: ProfileStageSnapshotMetric) => void;
  repository?: ProfileStageSnapshotRepository;
  trace?: PerformanceTrace;
};

export function parseProfileStageSnapshotVersion(version: string | null) {
  const parsed = Number.parseInt(version ?? "0", 10);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export async function getProfileStageSnapshot<TData>(
  stage: SnapshotStage,
  userId: string,
  version: number,
  load: () => Promise<TData>,
  {
    dateKey = getUtcDateKey(),
    onMetric,
    repository = profileStageSnapshotRepository,
    trace
  }: GetProfileStageSnapshotOptions = {}
) {
  const key = {
    dateKey,
    stage,
    userId,
    version
  };
  let snapshot: unknown | null = null;
  try {
    snapshot = await repository.findSnapshot(key);
  } catch {
    onMetric?.({ dateKey, stage, status: "disabled", userId, version });
    trace?.addStep("profile.stageSnapshot", 0, {
      dateKey,
      stage,
      status: "disabled",
      version
    });
    return load();
  }

  if (snapshot !== null) {
    onMetric?.({ dateKey, stage, status: "hit", userId, version });
    trace?.addStep("profile.stageSnapshot", 0, {
      dateKey,
      stage,
      status: "hit",
      version
    });
    return snapshot as TData;
  }

  onMetric?.({ dateKey, stage, status: "miss", userId, version });
  trace?.addStep("profile.stageSnapshot", 0, {
    dateKey,
    stage,
    status: "miss",
    version
  });
  const payload = await load();

  try {
    await repository.upsertSnapshot(key, payload);
    onMetric?.({ dateKey, stage, status: "stored", userId, version });
    trace?.addStep("profile.stageSnapshot", 0, {
      dateKey,
      stage,
      status: "stored",
      version
    });
  } catch {
    onMetric?.({ dateKey, stage, status: "store_failed", userId, version });
    trace?.addStep("profile.stageSnapshot", 0, {
      dateKey,
      stage,
      status: "store_failed",
      version
    });
  }

  return payload;
}

export async function invalidateProfileStageSnapshots(userId: string) {
  try {
    await profileStageSnapshotRepository.deleteProfileSnapshots(userId);
  } catch {
    // Snapshot invalidation is best-effort; transaction-count versions still prevent stale data reuse.
  }
}
