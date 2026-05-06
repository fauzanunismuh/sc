ALTER TABLE "projects"
  ADD COLUMN IF NOT EXISTS "similarityCheckedAt" TIMESTAMP(3);