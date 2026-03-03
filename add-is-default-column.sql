-- Add isDefault column to Score table
-- Default scores should not factor into handicap calculations
ALTER TABLE "Score" ADD COLUMN IF NOT EXISTS "isDefault" BOOLEAN NOT NULL DEFAULT false;
