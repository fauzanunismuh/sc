-- Migration: Tambah field snippetA dan snippetB ke tabel similarity_results
-- Jalankan: npx prisma migrate deploy
-- Atau langsung jalankan SQL ini di database PostgreSQL Anda

ALTER TABLE "similarity_results"
  ADD COLUMN IF NOT EXISTS "snippetA" JSONB,
  ADD COLUMN IF NOT EXISTS "snippetB" JSONB;
