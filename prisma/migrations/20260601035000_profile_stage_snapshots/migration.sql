-- Materialized profile stage snapshots for stable historical dashboard payloads.
CREATE TABLE "ProfileStageSnapshot" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "stage" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "dateKey" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProfileStageSnapshot_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ProfileStageSnapshot"
  ADD CONSTRAINT "ProfileStageSnapshot_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "ProfileStageSnapshot_userId_stage_version_dateKey_key"
  ON "ProfileStageSnapshot"("userId", "stage", "version", "dateKey");

CREATE INDEX "ProfileStageSnapshot_stage_dateKey_idx"
  ON "ProfileStageSnapshot"("stage", "dateKey");

CREATE INDEX "ProfileStageSnapshot_userId_idx"
  ON "ProfileStageSnapshot"("userId");
