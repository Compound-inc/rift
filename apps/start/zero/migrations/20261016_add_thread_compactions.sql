-- Immutable checkpoints cover one branch prefix, identified by its last message.
-- thread_id/message_id are logical IDs, not the primary keys of their tables.
CREATE TABLE IF NOT EXISTS thread_compactions (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  covers_through_message_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  summary_tokens INTEGER NOT NULL CHECK (summary_tokens >= 0),
  prompt_tokens INTEGER CHECK (prompt_tokens >= 0),
  prompt_through_message_id TEXT,
  source_tokens INTEGER NOT NULL CHECK (source_tokens >= 0),
  model TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'summary' CHECK (kind IN ('summary', 'sliding-window')),
  UNIQUE (thread_id, user_id, covers_through_message_id)
);
CREATE INDEX IF NOT EXISTS thread_compactions_user_thread
  ON thread_compactions (user_id, thread_id);

-- Existing installations may use an explicit table publication. Fresh installs
-- create zero_data after schema.sql, with this table in zero-dev-reset's list.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'zero_data' AND NOT puballtables)
    AND NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'zero_data' AND schemaname = 'public' AND tablename = 'thread_compactions'
    ) THEN
    ALTER PUBLICATION zero_data ADD TABLE thread_compactions;
  END IF;
END $$;

-- Remove summaries left by earlier deletions, including installations where
-- duplicate logical thread IDs prevent the cascading constraint below.
DELETE FROM thread_compactions AS checkpoint
WHERE NOT EXISTS (
  SELECT 1 FROM threads
  WHERE threads.thread_id = checkpoint.thread_id
    AND threads.user_id = checkpoint.user_id
);

-- The runner wraps each file in a transaction, so CONCURRENTLY is unavailable.
-- Legacy duplicate logical IDs must not block deploys. The delete mutator and
-- orphan cleanup still remove summaries when the optional FK cannot be added.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM threads GROUP BY thread_id, user_id HAVING count(*) > 1
  ) THEN
    RAISE NOTICE 'Skipping thread compaction unique index and FK: duplicate (thread_id, user_id) pairs exist';
  ELSE
    BEGIN
      CREATE UNIQUE INDEX IF NOT EXISTS threads_logical_owner_unique
        ON threads (thread_id, user_id);

      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'thread_compactions'::regclass
          AND conname = 'thread_compactions_thread_owner_fk'
      ) THEN
        ALTER TABLE thread_compactions
          ADD CONSTRAINT thread_compactions_thread_owner_fk
          FOREIGN KEY (thread_id, user_id) REFERENCES threads (thread_id, user_id)
          ON DELETE CASCADE;
      END IF;
    EXCEPTION WHEN unique_violation THEN
      -- A writer may introduce a duplicate between the check and index creation.
      RAISE NOTICE 'Skipping thread compaction unique index and FK: concurrent duplicate (thread_id, user_id) pair';
    END;
  END IF;
END $$;
