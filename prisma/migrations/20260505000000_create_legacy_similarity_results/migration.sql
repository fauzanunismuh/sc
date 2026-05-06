-- Create legacy similarity_results table used by the current API routes.
-- This matches the existing raw SQL queries in src/app/api/compare/students/route.ts
-- and src/app/api/similarity/batch/route.ts.

CREATE TABLE IF NOT EXISTS "similarity_results" (
  "id" TEXT NOT NULL,
  "projectAId" TEXT NOT NULL,
  "projectBId" TEXT NOT NULL,
  "scoreCodebert" DOUBLE PRECISION NOT NULL,
  "scoreWinnowing" DOUBLE PRECISION NOT NULL,
  "scoreHybrid" DOUBLE PRECISION NOT NULL,
  "category" TEXT NOT NULL,
  "categoryLabel" TEXT,
  "snippets" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "similarity_results_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "similarity_results_projectAId_projectBId_key"
  ON "similarity_results"("projectAId", "projectBId");

ALTER TABLE "similarity_results"
  ADD CONSTRAINT "similarity_results_projectAId_fkey"
  FOREIGN KEY ("projectAId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "similarity_results"
  ADD CONSTRAINT "similarity_results_projectBId_fkey"
  FOREIGN KEY ("projectBId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;