import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Pool } from 'pg'
import { expect, it } from 'vitest'

// Supply an isolated database: this test exercises legacy-column migration and
// publication behavior on real Postgres, independently of the app's auth schema.
it.skipIf(!process.env.GENERATION_OUTPUT_TEST_DB)(
  'moves existing analytics out of the publication and is idempotent',
  async () => {
    const pool = new Pool({
      connectionString: process.env.GENERATION_OUTPUT_TEST_DB,
    })
    const migration = readFileSync(
      resolve('zero/migrations/20261016_move_message_analytics.sql'),
      'utf8',
    )
    try {
      await pool.query(`CREATE TABLE messages(id text PRIMARY KEY, content text, provider_metadata jsonb, generation_metadata jsonb, ai_cost double precision);
      INSERT INTO messages VALUES ('a', 'Saved answer', '{"gateway":{"cost":"0.02"}}', '{"finishReason":"length"}', 0.02);
      CREATE PUBLICATION zero_data FOR TABLE messages;`)
      await pool.query(`INSERT INTO messages
        SELECT 'batch-' || value, 'answer', '{"gateway":{}}'::jsonb, NULL, NULL
        FROM generate_series(1, 6001) AS value`)
      await pool.query(migration)
      await pool.query(migration)
      expect(
        (await pool.query("SELECT * FROM message_analytics WHERE message_id = 'a'")).rows,
      ).toEqual([
        {
          message_id: 'a',
          provider_metadata: { gateway: { cost: '0.02' } },
          generation_metadata: { finishReason: 'length' },
          ai_cost: 0.02,
        },
      ])
      expect((await pool.query("SELECT * FROM messages WHERE id = 'a'")).rows).toEqual([
        { id: 'a', content: 'Saved answer', provider_metadata: null, generation_metadata: null, ai_cost: null },
      ])
      const published = (
        await pool.query(
          "SELECT tablename, attnames::text[] AS attnames FROM pg_publication_tables WHERE pubname = 'zero_data'",
        )
      ).rows
      expect(published).toEqual([
        { tablename: 'messages', attnames: ['id', 'content', 'provider_metadata', 'generation_metadata', 'ai_cost'] },
      ])
      expect((await pool.query('SELECT count(*)::int AS count FROM message_analytics')).rows[0].count).toBe(6002)
      expect((await pool.query('SELECT count(*)::int AS count FROM messages WHERE provider_metadata IS NOT NULL OR generation_metadata IS NOT NULL OR ai_cost IS NOT NULL')).rows[0].count).toBe(0)
      // Old server statements and old Zero schemas still see their columns.
      await pool.query("UPDATE messages SET ai_cost = 0.03 WHERE id = 'a'")
      await pool.query("DELETE FROM messages WHERE id = 'a'")
      expect(
        (await pool.query("SELECT * FROM message_analytics WHERE message_id = 'a'")).rows,
      ).toEqual([])
    } finally {
      await pool.query(
        'DROP PUBLICATION IF EXISTS zero_data; DROP TABLE IF EXISTS message_analytics; DROP TABLE IF EXISTS messages;',
      )
      await pool.end()
    }
  },
)
