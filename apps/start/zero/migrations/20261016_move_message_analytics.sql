-- Release N of the analytics move. Preserve legacy columns for old servers
-- and Zero client schemas. A later release may remove them only after old
-- server/browser bundles have drained for at least 24 hours.
-- Private provider accounting must never enter Zero's published messages rows.
-- Keep this table out of zero_data (the publication uses an explicit table list).
CREATE TABLE IF NOT EXISTS message_analytics (
  message_id TEXT PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,
  provider_metadata JSONB,
  generation_metadata JSONB,
  ai_cost DOUBLE PRECISION
);

-- Copy and clear in batches of at most 3,000 rows per UPDATE. Each batch locks
-- its source rows and copies before clearing, so a retry cannot lose accounting.
-- Existing private values win over stale accounting from an older server.
-- The migration runner owns the transaction and the once-only ledger entry.
DO $$
DECLARE
  legacy_column TEXT;
  cleared_rows INTEGER;
BEGIN
  FOREACH legacy_column IN ARRAY ARRAY['provider_metadata', 'generation_metadata', 'ai_cost']
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'messages'
        AND column_name = legacy_column
    ) THEN
      LOOP
        EXECUTE format(
          'WITH batch AS (
             SELECT id, %1$I FROM messages
             WHERE %1$I IS NOT NULL ORDER BY id LIMIT 3000 FOR UPDATE
           ), copied AS (
             INSERT INTO message_analytics (message_id, %1$I)
             SELECT id, %1$I FROM batch
             ON CONFLICT (message_id) DO UPDATE
               SET %1$I = COALESCE(message_analytics.%1$I, EXCLUDED.%1$I)
             RETURNING message_id
           )
           UPDATE messages SET %1$I = NULL
           FROM copied WHERE messages.id = copied.message_id',
          legacy_column
        );
        GET DIAGNOSTICS cleared_rows = ROW_COUNT;
        EXIT WHEN cleared_rows = 0;
      END LOOP;
    END IF;
  END LOOP;
END
$$;
