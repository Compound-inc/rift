-- Bounded tool display records; model history continues to use content only.
ALTER TABLE messages ADD COLUMN IF NOT EXISTS parts JSONB;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS finish_reason TEXT;
