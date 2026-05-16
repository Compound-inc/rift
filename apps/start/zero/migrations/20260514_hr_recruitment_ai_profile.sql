-- HR Recruitment AI profile columns.
--
-- Adds AI-extracted profile fields to `hr_candidate` and an AI
-- analysis blob to `hr_application`. The candidate columns power the
-- "show the person's name" UX (replacing the file name) and let us
-- dedupe by email when the AI extractor finds one. The application
-- column captures the AI rationale + signals that the affinity score
-- was based on so the UI can explain WHY the candidate ranked the
-- way they did.
--
-- All columns are nullable: existing rows stay untouched and the
-- workflow's metadata-only fallback continues to work when AI is
-- disabled or fails.

ALTER TABLE hr_candidate
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS headline TEXT,
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS years_of_experience INTEGER,
  ADD COLUMN IF NOT EXISTS skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS languages JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS highest_degree TEXT,
  ADD COLUMN IF NOT EXISTS profile_source TEXT;

ALTER TABLE hr_application
  ADD COLUMN IF NOT EXISTS ai_profile_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS ai_signals JSONB;
