-- RAG rework (ADR-0006): the per-turn context planner decides which documents
-- fit in the prompt from their extracted-text length, without loading
-- `file_content`. New rows set `content_chars` at insert time; this backfills
-- existing rows once.
ALTER TABLE attachments
ADD COLUMN IF NOT EXISTS content_chars INTEGER;

UPDATE attachments
SET content_chars = char_length(file_content)
WHERE content_chars IS NULL;
