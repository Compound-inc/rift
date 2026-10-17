/**
 * Seeds realistic dummy chat threads/messages for one real user account so the
 * sidebar and thread view behave exactly like production data.
 *
 * What this script guarantees:
 * 1. It resolves a target user + organization from Better Auth tables.
 * 2. It removes existing threads/messages (and related attachments) for that user.
 * 3. It inserts a large set of thread/message rows with valid branching metadata.
 * 4. It preserves the data shape expected by Zero queries and the chat UI.
 *
 * Default usage (from apps/start):
 *   bun run scripts/seed-dummy-chats.ts
 *
 * Common overrides:
 *   bun run scripts/seed-dummy-chats.ts --count=1000
 *   bun run scripts/seed-dummy-chats.ts --user-email=you@example.com
 *   bun run scripts/seed-dummy-chats.ts --user-id=<user-id> --org-id=<org-id>
 *   bun run scripts/seed-dummy-chats.ts --database-url=postgresql://rift:rift@localhost:5432/rift
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Pool } from 'pg'

const DEFAULT_DATABASE_URL = 'postgresql://rift:rift@localhost:5432/rift'
const DEFAULT_THREAD_COUNT = 1000
const THREAD_INSERT_CHUNK_SIZE = 100
const MESSAGE_INSERT_CHUNK_SIZE = 1200

const appDir = join(import.meta.dir, '..')

type CliOptions = {
  readonly count: number
  readonly userId?: string
  readonly userEmail?: string
  readonly organizationId?: string
  readonly databaseUrl?: string
}

type TargetAccount = {
  readonly userId: string
  readonly userEmail: string
  readonly organizationId: string
  readonly organizationName: string
}

type ThreadRow = {
  readonly id: string
  readonly thread_id: string
  readonly title: string
  readonly created_at: number
  readonly updated_at: number
  readonly last_message_at: number
  readonly generation_status: 'completed'
  readonly visibility: 'visible'
  readonly user_set_title: boolean
  readonly user_id: string
  readonly model: string
  readonly response_style: 'regular' | 'learning' | 'technical' | 'concise' | null
  readonly pinned: boolean
  readonly active_child_by_parent: Record<string, string>
  readonly branch_version: number
  readonly allow_attachments: boolean
  readonly owner_org_id: string
  readonly reasoning_effort:
    | 'none'
    | 'minimal'
    | 'low'
    | 'medium'
    | 'high'
    | 'xhigh'
    | 'max'
    | null
  readonly mode_id: string | null
  readonly disabled_tool_keys: readonly string[]
}

type MessageRow = {
  readonly id: string
  readonly message_id: string
  readonly thread_id: string
  readonly user_id: string
  readonly reasoning: null
  readonly content: string
  readonly status: 'done'
  readonly updated_at: number
  readonly parent_message_id: string | null
  readonly branch_index: 1
  readonly branch_anchor_message_id: null
  readonly regen_source_message_id: null
  readonly role: 'user' | 'assistant'
  readonly created_at: number
  readonly server_error: null
  readonly model: string
  readonly attachments_ids: readonly string[]
  readonly sources: null
  readonly model_params: { readonly reasoningEffort?: string } | null
  readonly provider_metadata: null
  readonly generation_metadata: null
  readonly ai_cost: number | null
  readonly public_cost: number | null
  readonly used_byok: boolean
  readonly input_tokens: number | null
  readonly output_tokens: number | null
  readonly total_tokens: number | null
  readonly reasoning_tokens: number | null
  readonly text_tokens: number | null
  readonly cache_read_tokens: number | null
  readonly cache_write_tokens: number | null
  readonly no_cache_tokens: number | null
  readonly billable_web_search_calls: number | null
}

type ChatSeedData = {
  readonly threads: readonly ThreadRow[]
  readonly messages: readonly MessageRow[]
}

const TOPICS = [
  'quarterly planning',
  'frontend performance',
  'database migration',
  'incident retrospective',
  'CI reliability',
  'onboarding checklist',
  'pricing experiment',
  'feature rollout plan',
  'customer interview notes',
  'dashboard redesign',
  'auth edge cases',
  'analytics tracking cleanup',
  'mobile UX polish',
  'release notes draft',
  'technical debt triage',
] as const

const TITLE_PATTERNS = [
  'Plan for {topic}',
  '{topic} next steps',
  'Help me debug {topic}',
  'Checklist: {topic}',
  'Draft: {topic}',
  'How should we handle {topic}?',
  '{topic} action plan',
  'Review and improve {topic}',
] as const

const OPENERS = [
  'I need a practical plan for {topic}. Keep it actionable.',
  'Can you help me break down {topic} into milestones for this week?',
  'I am stuck on {topic}. What should I do first?',
  'Give me a concise strategy for {topic} with clear priorities.',
  'Please propose a realistic approach for {topic} with tradeoffs.',
] as const

const FOLLOW_UPS = [
  'Can you turn that into a day-by-day schedule?',
  'Now make it more concise and executive-friendly.',
  'Add risk mitigation and fallback options.',
  'What are the biggest mistakes to avoid here?',
  'Can you estimate effort levels for each step?',
  'Rewrite this with a stronger focus on speed.',
  'Please include a short checklist I can copy.',
] as const

const ASSISTANT_OPENERS = [
  'Great context. Here is a concrete plan you can execute right away:',
  'Here is a practical structure with priorities and expected outcomes:',
  'A reliable way to approach this is to split it into phases:',
  'You can move quickly with this sequence:',
  'Below is a balanced plan that optimizes speed and quality:',
] as const

const ASSISTANT_FOLLOW_UP_STARTS = [
  'Absolutely. Here is the tightened version:',
  'Good call. Here is the revised plan with sharper constraints:',
  'Yes. I adjusted the approach to reduce risk and overhead:',
  'Done. Here is a more implementation-focused version:',
  'Great request. I converted it into a concrete checklist:',
] as const

const MODELS = [
  'openai/gpt-5.4',
  'openai/gpt-5.2-chat',
  'openai/gpt-5.3-codex',
  'anthropic/claude-sonnet-4.6',
  'anthropic/claude-opus-4.6',
] as const

const RESPONSE_STYLES = [
  'regular',
  'learning',
  'technical',
  'concise',
  null,
] as const

const REASONING_EFFORTS = [
  'none',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  null,
] as const

async function loadEnv(): Promise<void> {
  const envFiles = [join(appDir, '.env.local'), join(appDir, '.env')]

  for (const envFile of envFiles) {
    try {
      const text = await readFile(envFile, 'utf-8')
      for (const line of text.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const separatorIndex = trimmed.indexOf('=')
        if (separatorIndex <= 0) continue

        const key = trimmed.slice(0, separatorIndex).trim()
        const value = trimmed.slice(separatorIndex + 1).trim()
        if (!process.env[key]) process.env[key] = value
      }
    } catch {
      // Missing env files are valid when values already come from the shell.
    }
  }
}

function parseArgs(argv: readonly string[]): CliOptions {
  let count = DEFAULT_THREAD_COUNT
  let userId: string | undefined
  let userEmail: string | undefined
  let organizationId: string | undefined
  let databaseUrl: string | undefined

  for (const arg of argv) {
    if (arg.startsWith('--count=')) {
      const raw = arg.slice('--count='.length)
      const parsed = Number.parseInt(raw, 10)
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`Invalid --count value: "${raw}"`)
      }
      count = parsed
      continue
    }
    if (arg.startsWith('--user-id=')) {
      userId = arg.slice('--user-id='.length).trim() || undefined
      continue
    }
    if (arg.startsWith('--user-email=')) {
      userEmail = arg.slice('--user-email='.length).trim() || undefined
      continue
    }
    if (arg.startsWith('--org-id=')) {
      organizationId = arg.slice('--org-id='.length).trim() || undefined
      continue
    }
    if (arg.startsWith('--database-url=')) {
      databaseUrl = arg.slice('--database-url='.length).trim() || undefined
      continue
    }
    if (arg === '--help') {
      printHelpAndExit()
    }
    throw new Error(`Unknown argument: ${arg}`)
  }

  return {
    count,
    userId,
    userEmail,
    organizationId,
    databaseUrl,
  }
}

function printHelpAndExit(): never {
  console.log(`
Seed dummy chat data into the local Postgres database.

Options:
  --count=<number>           Number of threads to create (default: ${DEFAULT_THREAD_COUNT})
  --user-id=<id>             Target user id
  --user-email=<email>       Target user email (alternative to --user-id)
  --org-id=<id>              Target organization id
  --database-url=<url>       Postgres URL (default: ${DEFAULT_DATABASE_URL})
  --help                     Show this help text
`)
  process.exit(0)
}

function pickOne<T>(values: readonly T[]): T {
  return values[Math.floor(Math.random() * values.length)]
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomFloat(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function interpolate(template: string, replacements: Record<string, string>): string {
  let output = template
  for (const [key, value] of Object.entries(replacements)) {
    output = output.replaceAll(`{${key}}`, value)
  }
  return output
}

function titleCase(input: string): string {
  return input
    .split(' ')
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ')
}

function estimateTokens(text: string): number {
  // Rough estimate: 1 token ~ 4 characters in mixed English prose.
  return Math.max(1, Math.round(text.length / 4))
}

function buildAssistantPlanLines(topic: string): readonly string[] {
  return [
    `1. Define the success criteria for ${topic} before implementation starts.`,
    `2. Split work into small milestones with owners and deadlines.`,
    '3. Track one leading metric and one quality metric from day one.',
    '4. Review results at the end of each milestone and adjust quickly.',
  ]
}

function createAssistantReply(topic: string, followUp = false): string {
  const lead = followUp
    ? pickOne(ASSISTANT_FOLLOW_UP_STARTS)
    : pickOne(ASSISTANT_OPENERS)

  const planLines = buildAssistantPlanLines(topic).join('\n')
  const extraLine = followUp
    ? 'If you want, I can convert this into a template you can reuse every week.'
    : 'If you share constraints, I can tune this plan to your exact context.'

  return `${lead}\n\n${planLines}\n\n${extraLine}`
}

/**
 * Builds a linear user/assistant conversation chain and a matching
 * `active_child_by_parent` map so branch resolution renders all messages.
 */
function buildThreadData(input: {
  readonly userId: string
  readonly organizationId: string
  readonly threadCreatedAt: number
}): {
  readonly thread: ThreadRow
  readonly messages: readonly MessageRow[]
} {
  const topic = pickOne(TOPICS)
  const model = pickOne(MODELS)
  const responseStyle = pickOne(RESPONSE_STYLES)
  const reasoningEffort = pickOne(REASONING_EFFORTS)
  const threadPublicId = crypto.randomUUID()
  const threadDbId = crypto.randomUUID()

  const titleTemplate = pickOne(TITLE_PATTERNS)
  const title = interpolate(titleTemplate, { topic: titleCase(topic) })

  const turnCount = randomInt(2, 5)
  let currentTimestamp = input.threadCreatedAt + randomInt(1_000, 12_000)
  let parentMessageId: string | null = null
  const activeChildByParent: Record<string, string> = {}
  const messages: MessageRow[] = []

  for (let turnIndex = 0; turnIndex < turnCount; turnIndex += 1) {
    const userMessageId = crypto.randomUUID()
    const userPrompt =
      turnIndex === 0
        ? interpolate(pickOne(OPENERS), { topic })
        : pickOne(FOLLOW_UPS)
    const userCreatedAt = currentTimestamp
    const userUpdatedAt = userCreatedAt + randomInt(30, 240)
    const userInputTokens = estimateTokens(userPrompt)

    messages.push({
      id: userMessageId,
      message_id: userMessageId,
      thread_id: threadPublicId,
      user_id: input.userId,
      reasoning: null,
      content: userPrompt,
      status: 'done',
      updated_at: userUpdatedAt,
      parent_message_id: parentMessageId,
      branch_index: 1,
      branch_anchor_message_id: null,
      regen_source_message_id: null,
      role: 'user',
      created_at: userCreatedAt,
      server_error: null,
      model,
      attachments_ids: [],
      sources: null,
      model_params: reasoningEffort ? { reasoningEffort } : null,
      provider_metadata: null,
      generation_metadata: null,
      ai_cost: null,
      public_cost: null,
      used_byok: false,
      input_tokens: userInputTokens,
      output_tokens: null,
      total_tokens: userInputTokens,
      reasoning_tokens: null,
      text_tokens: userInputTokens,
      cache_read_tokens: null,
      cache_write_tokens: null,
      no_cache_tokens: null,
      billable_web_search_calls: null,
    })

    if (parentMessageId) activeChildByParent[parentMessageId] = userMessageId
    parentMessageId = userMessageId
    currentTimestamp = userUpdatedAt + randomInt(2_000, 16_000)

    const assistantMessageId = crypto.randomUUID()
    const assistantReply = createAssistantReply(topic, turnIndex > 0)
    const assistantCreatedAt = currentTimestamp
    const assistantUpdatedAt = assistantCreatedAt + randomInt(600, 2_800)
    const assistantInputTokens = estimateTokens(userPrompt)
    const assistantOutputTokens = estimateTokens(assistantReply)
    const assistantTotalTokens = assistantInputTokens + assistantOutputTokens
    const assistantCost = Number(randomFloat(0.0008, 0.015).toFixed(6))

    messages.push({
      id: assistantMessageId,
      message_id: assistantMessageId,
      thread_id: threadPublicId,
      user_id: input.userId,
      reasoning: null,
      content: assistantReply,
      status: 'done',
      updated_at: assistantUpdatedAt,
      parent_message_id: parentMessageId,
      branch_index: 1,
      branch_anchor_message_id: null,
      regen_source_message_id: null,
      role: 'assistant',
      created_at: assistantCreatedAt,
      server_error: null,
      model,
      attachments_ids: [],
      sources: null,
      model_params: reasoningEffort ? { reasoningEffort } : null,
      provider_metadata: null,
      generation_metadata: null,
      ai_cost: assistantCost,
      public_cost: assistantCost,
      used_byok: false,
      input_tokens: assistantInputTokens,
      output_tokens: assistantOutputTokens,
      total_tokens: assistantTotalTokens,
      reasoning_tokens: Math.round(assistantOutputTokens * randomFloat(0.1, 0.35)),
      text_tokens: assistantOutputTokens,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
      no_cache_tokens: assistantTotalTokens,
      billable_web_search_calls: 0,
    })

    activeChildByParent[parentMessageId] = assistantMessageId
    parentMessageId = assistantMessageId
    currentTimestamp = assistantUpdatedAt + randomInt(4_000, 48_000)
  }

  const lastMessageAt = messages[messages.length - 1]?.updated_at ?? input.threadCreatedAt
  const thread: ThreadRow = {
    id: threadDbId,
    thread_id: threadPublicId,
    title,
    created_at: input.threadCreatedAt,
    updated_at: lastMessageAt,
    last_message_at: lastMessageAt,
    generation_status: 'completed',
    visibility: 'visible',
    user_set_title: true,
    user_id: input.userId,
    model,
    response_style: responseStyle,
    pinned: false,
    active_child_by_parent: activeChildByParent,
    branch_version: messages.length + 1,
    allow_attachments: true,
    owner_org_id: input.organizationId,
    reasoning_effort: reasoningEffort,
    mode_id: null,
    disabled_tool_keys: [],
  }

  return { thread, messages }
}

function chunk<T>(items: readonly T[], size: number): readonly (readonly T[])[] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

async function resolveTargetAccount(
  pool: Pool,
  options: CliOptions,
): Promise<TargetAccount> {
  const targetRows = await pool.query<{
    user_id: string
    user_email: string
    organization_id: string | null
    organization_name: string | null
  }>(
    `
      SELECT
        u.id AS user_id,
        u.email AS user_email,
        m."organizationId" AS organization_id,
        o.name AS organization_name
      FROM "user" u
      LEFT JOIN member m ON m."userId" = u.id
      LEFT JOIN organization o ON o.id = m."organizationId"
      WHERE ($1::text IS NULL OR u.id = $1)
        AND ($2::text IS NULL OR LOWER(u.email) = LOWER($2))
      ORDER BY m."createdAt" DESC NULLS LAST, u."createdAt" DESC
    `,
    [options.userId ?? null, options.userEmail ?? null],
  )

  if (targetRows.rowCount === 0) {
    throw new Error(
      'Could not find a user. Pass --user-id or --user-email to select a valid account.',
    )
  }

  const matchedRows = options.organizationId
    ? targetRows.rows.filter((row) => row.organization_id === options.organizationId)
    : targetRows.rows

  const selected = matchedRows.find((row) => row.organization_id && row.organization_name)
  if (!selected?.organization_id || !selected.organization_name) {
    throw new Error(
      'Could not resolve a user membership with organization context. Pass --org-id for a valid member organization.',
    )
  }

  return {
    userId: selected.user_id,
    userEmail: selected.user_email,
    organizationId: selected.organization_id,
    organizationName: selected.organization_name,
  }
}

function buildSeedPayload(input: {
  readonly count: number
  readonly userId: string
  readonly organizationId: string
}): ChatSeedData {
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000
  const now = Date.now()
  const start = now - ninetyDaysMs
  const threads: ThreadRow[] = []
  const messages: MessageRow[] = []

  for (let index = 0; index < input.count; index += 1) {
    const threadCreatedAt = randomInt(start, now - 60_000)
    const generated = buildThreadData({
      userId: input.userId,
      organizationId: input.organizationId,
      threadCreatedAt,
    })
    threads.push(generated.thread)
    messages.push(...generated.messages)
  }

  threads.sort((left, right) => right.updated_at - left.updated_at)
  messages.sort((left, right) => left.created_at - right.created_at)

  return { threads, messages }
}

async function clearExistingChats(pool: Pool, userId: string): Promise<void> {
  await pool.query(
    `
      WITH target_threads AS (
        SELECT thread_id
        FROM threads
        WHERE user_id = $1
      )
      DELETE FROM attachments
      WHERE user_id = $1
         OR thread_id IN (SELECT thread_id FROM target_threads)
    `,
    [userId],
  )
  await pool.query('DELETE FROM messages WHERE user_id = $1', [userId])
  await pool.query('DELETE FROM threads WHERE user_id = $1', [userId])
}

async function insertThreads(pool: Pool, rows: readonly ThreadRow[]): Promise<void> {
  for (const rowsChunk of chunk(rows, THREAD_INSERT_CHUNK_SIZE)) {
    await pool.query(
      `
        INSERT INTO threads (
          id,
          thread_id,
          title,
          created_at,
          updated_at,
          last_message_at,
          generation_status,
          visibility,
          user_set_title,
          user_id,
          model,
          response_style,
          pinned,
          active_child_by_parent,
          branch_version,
          allow_attachments,
          owner_org_id,
          reasoning_effort,
          mode_id,
          disabled_tool_keys
        )
        SELECT
          x.id,
          x.thread_id,
          x.title,
          x.created_at,
          x.updated_at,
          x.last_message_at,
          x.generation_status,
          x.visibility,
          x.user_set_title,
          x.user_id,
          x.model,
          x.response_style,
          x.pinned,
          x.active_child_by_parent,
          x.branch_version,
          x.allow_attachments,
          x.owner_org_id,
          x.reasoning_effort,
          x.mode_id,
          x.disabled_tool_keys
        FROM jsonb_to_recordset($1::jsonb) AS x(
          id text,
          thread_id text,
          title text,
          created_at bigint,
          updated_at bigint,
          last_message_at bigint,
          generation_status text,
          visibility text,
          user_set_title boolean,
          user_id text,
          model text,
          response_style text,
          pinned boolean,
          active_child_by_parent jsonb,
          branch_version bigint,
          allow_attachments boolean,
          owner_org_id text,
          reasoning_effort text,
          mode_id text,
          disabled_tool_keys jsonb
        )
      `,
      [JSON.stringify(rowsChunk)],
    )
  }
}

async function insertMessages(pool: Pool, rows: readonly MessageRow[]): Promise<void> {
  for (const rowsChunk of chunk(rows, MESSAGE_INSERT_CHUNK_SIZE)) {
    await pool.query(
      `
        INSERT INTO messages (
          id,
          message_id,
          thread_id,
          user_id,
          reasoning,
          content,
          status,
          updated_at,
          parent_message_id,
          branch_index,
          branch_anchor_message_id,
          regen_source_message_id,
          role,
          created_at,
          server_error,
          model,
          attachments_ids,
          sources,
          model_params,
          public_cost,
          used_byok,
          input_tokens,
          output_tokens,
          total_tokens,
          reasoning_tokens,
          text_tokens,
          cache_read_tokens,
          cache_write_tokens,
          no_cache_tokens,
          billable_web_search_calls
        )
        SELECT
          x.id,
          x.message_id,
          x.thread_id,
          x.user_id,
          x.reasoning,
          x.content,
          x.status,
          x.updated_at,
          x.parent_message_id,
          x.branch_index,
          x.branch_anchor_message_id,
          x.regen_source_message_id,
          x.role,
          x.created_at,
          x.server_error,
          x.model,
          x.attachments_ids,
          x.sources,
          x.model_params,
          x.public_cost,
          x.used_byok,
          x.input_tokens,
          x.output_tokens,
          x.total_tokens,
          x.reasoning_tokens,
          x.text_tokens,
          x.cache_read_tokens,
          x.cache_write_tokens,
          x.no_cache_tokens,
          x.billable_web_search_calls
        FROM jsonb_to_recordset($1::jsonb) AS x(
          id text,
          message_id text,
          thread_id text,
          user_id text,
          reasoning text,
          content text,
          status text,
          updated_at bigint,
          parent_message_id text,
          branch_index integer,
          branch_anchor_message_id text,
          regen_source_message_id text,
          role text,
          created_at bigint,
          server_error jsonb,
          model text,
          attachments_ids jsonb,
          sources jsonb,
          model_params jsonb,
          public_cost double precision,
          used_byok boolean,
          input_tokens bigint,
          output_tokens bigint,
          total_tokens bigint,
          reasoning_tokens bigint,
          text_tokens bigint,
          cache_read_tokens bigint,
          cache_write_tokens bigint,
          no_cache_tokens bigint,
          billable_web_search_calls bigint
        )
      `,
      [JSON.stringify(rowsChunk)],
    )
    await pool.query(
      `INSERT INTO message_analytics(message_id, provider_metadata, generation_metadata, ai_cost)
       SELECT id, provider_metadata, generation_metadata, ai_cost
       FROM jsonb_to_recordset($1::jsonb) AS x(
         id text, provider_metadata jsonb, generation_metadata jsonb, ai_cost double precision)
       ON CONFLICT (message_id) DO UPDATE SET
         provider_metadata = EXCLUDED.provider_metadata,
         generation_metadata = EXCLUDED.generation_metadata,
         ai_cost = EXCLUDED.ai_cost`,
      [JSON.stringify(rowsChunk)],
    )
  }
}

async function main(): Promise<void> {
  await loadEnv()
  const options = parseArgs(process.argv.slice(2))
  const databaseUrl =
    options.databaseUrl
    ?? process.env.ZERO_UPSTREAM_DB
    ?? process.env.DATABASE_URL
    ?? DEFAULT_DATABASE_URL

  const pool = new Pool({ connectionString: databaseUrl })

  try {
    const account = await resolveTargetAccount(pool, options)
    console.log(
      `Seeding ${options.count} threads for user "${account.userEmail}" (${account.userId}) in org "${account.organizationName}" (${account.organizationId}).`,
    )

    const seedData = buildSeedPayload({
      count: options.count,
      userId: account.userId,
      organizationId: account.organizationId,
    })

    await pool.query('BEGIN')
    await clearExistingChats(pool, account.userId)
    await insertThreads(pool, seedData.threads)
    await insertMessages(pool, seedData.messages)
    await pool.query('COMMIT')

    const verification = await pool.query<{
      thread_count: string
      message_count: string
    }>(
      `
        SELECT
          (SELECT COUNT(*)::text FROM threads WHERE user_id = $1 AND owner_org_id = $2) AS thread_count,
          (SELECT COUNT(*)::text FROM messages WHERE user_id = $1) AS message_count
      `,
      [account.userId, account.organizationId],
    )

    const row = verification.rows[0]
    console.log(
      `Done. Inserted ${row?.thread_count ?? '0'} threads and ${row?.message_count ?? '0'} messages for the target user.`,
    )
  } catch (error) {
    await pool.query('ROLLBACK').catch(() => undefined)
    console.error('Failed to seed dummy chats.', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main()

