import type { Prisma } from "@prisma/client";

import { prisma } from "@/server/db/prisma";

export type ProfileStageSnapshotKey = {
  dateKey: string;
  stage: string;
  userId: string;
  version: number;
};

export type ProfileStageSnapshotRepository = {
  deleteProfileSnapshots(userId: string): Promise<void>;
  findSnapshot(key: ProfileStageSnapshotKey): Promise<unknown | null>;
  upsertSnapshot(key: ProfileStageSnapshotKey, payload: unknown): Promise<void>;
};

export const profileStageSnapshotRepository: ProfileStageSnapshotRepository = {
  async deleteProfileSnapshots(userId) {
    await prisma.profileStageSnapshot.deleteMany({
      where: { userId }
    });
  },

  async findSnapshot(key) {
    const snapshot = await prisma.profileStageSnapshot.findUnique({
      where: {
        userId_stage_version_dateKey: key
      }
    });

    return snapshot?.payload ?? null;
  },

  async upsertSnapshot(key, payload) {
    await prisma.profileStageSnapshot.upsert({
      create: {
        ...key,
        payload: payload as Prisma.InputJsonValue
      },
      update: {
        payload: payload as Prisma.InputJsonValue
      },
      where: {
        userId_stage_version_dateKey: key
      }
    });
  }
};
