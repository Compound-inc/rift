import { describe, expect, it } from 'vitest'
import type { AST, Condition, ValuePosition } from '@rocicorp/zero'
import { addContextToQuery, asQueryInternals } from '@rocicorp/zero/bindings'
import { queries } from './queries'
import type { ZeroContext } from './schema'

type Row = Record<string, unknown>
type Tables = Record<string, readonly Row[]>

// Evaluate the actual query authorization AST against a small relational fixture.
// Unsupported operators throw so a changed policy cannot silently pass a test.
function matches(
  condition: Condition | undefined,
  row: Row,
  tables: Tables,
): boolean {
  if (!condition) return true
  if (condition.type === 'and')
    return condition.conditions.every((part) => matches(part, row, tables))
  if (condition.type === 'or')
    return condition.conditions.some((part) => matches(part, row, tables))
  if (condition.type === 'correlatedSubquery') {
    const { correlation, subquery } = condition.related
    const exists = tables[subquery.table].some(
      (child) =>
        correlation.parentField.every(
          (field, index) =>
            row[field] != null &&
            row[field] === child[correlation.childField[index]],
        ) && matches(subquery.where, child, tables),
    )
    return condition.op === 'EXISTS' ? exists : !exists
  }
  const value = (part: ValuePosition): unknown => {
    if (part.type === 'column') return row[part.name] ?? null
    if (part.type === 'literal') return part.value
    throw new Error(`Unexpected reference ${part.type}`)
  }
  const left = value(condition.left)
  const right = value(condition.right)
  switch (condition.op) {
    case '=':
      return left != null && left === right
    case 'IS':
      return left === right
    case 'ILIKE':
      return (
        typeof left === 'string' &&
        typeof right === 'string' &&
        left.toLowerCase().includes(right.slice(1, -1).toLowerCase())
      )
    case 'IN':
      return Array.isArray(right) && right.includes(left)
    default:
      throw new Error(`Unexpected operator ${condition.op}`)
  }
}

function rows(ast: AST, tables: Tables): readonly Row[] {
  return tables[ast.table].filter((row) => matches(ast.where, row, tables))
}

function fixture(
  visibility: 'private' | 'org',
  deletedAt: number | null = null,
): Tables {
  return {
    project: [
      {
        id: 'p',
        userId: 'owner',
        organizationId: 'org',
        visibility,
        deletedAt,
      },
    ],
    organization: [{ id: 'org' }],
    member: ['owner', 'member', 'admin'].map((userId) => ({
      id: userId,
      userId,
      organizationId: 'org',
    })),
    attachment: [
      { id: 'f', projectId: 'p', status: 'uploaded', orgKnowledgeKind: null },
    ],
    skill: [{ id: 's', projectId: 'p', deletedAt: null }],
    skillProjectOverride: [{ projectId: 'p', skillId: 'g' }],
    thread: ['owner', 'member', 'admin', 'outsider'].flatMap((userId) => [
      { threadId: userId, userId, projectId: 'p', visibility: 'visible' },
      {
        threadId: `${userId}-archive`,
        userId,
        projectId: 'p',
        visibility: 'archived',
      },
    ]),
    message: ['owner', 'member', 'admin', 'outsider'].map((userId) => ({
      id: userId,
      userId,
      threadId: userId,
    })),
  }
}

const people = [
  { userID: 'owner', allowed: true },
  { userID: 'member', allowed: false },
  { userID: 'admin', allowed: false },
  { userID: 'outsider', allowed: false },
  { userID: 'owner', isAnonymous: true, allowed: false },
]

for (const visibility of ['private', 'org'] as const) {
  describe(`${visibility} project Zero query access`, () => {
    it.each(people)(
      'checks every project read for $userID, anonymous=$isAnonymous',
      (person) => {
        const ctx: ZeroContext = {
          organizationId: 'org',
          isAnonymous: false,
          ...person,
        }
        const allowed =
          !ctx.isAnonymous &&
          (person.allowed ||
            (visibility === 'org' && ['member', 'admin'].includes(ctx.userID)))
        const asts = [
          asQueryInternals(addContextToQuery(queries.projects.list({}), ctx))
            .ast,
          asQueryInternals(
            addContextToQuery(queries.projects.byId({ projectId: 'p' }), ctx),
          ).ast,
          asQueryInternals(
            addContextToQuery(
              queries.projects.attachments({ projectId: 'p' }),
              ctx,
            ),
          ).ast,
          asQueryInternals(
            addContextToQuery(
              queries.skills.listForProject({ projectId: 'p' }),
              ctx,
            ),
          ).ast,
          asQueryInternals(
            addContextToQuery(
              queries.skills.overridesForProject({ projectId: 'p' }),
              ctx,
            ),
          ).ast,
        ]
        for (const ast of asts) {
          expect(rows(ast, fixture(visibility)), ast.table).toHaveLength(
            allowed && (ast.table !== 'attachment' || ctx.userID === 'owner')
              ? 1
              : 0,
          )
          expect(
            rows(ast, fixture(visibility, 1)),
            `deleted ${ast.table}`,
          ).toHaveLength(0)
        }
        const recent = asQueryInternals(
          addContextToQuery(
            queries.projects.recentThreads({ projectId: 'p', limit: 30 }),
            ctx,
          ),
        ).ast
        const sidebar = asQueryInternals(
          addContextToQuery(
            queries.projects.threadsPage({
              projectId: 'p',
              limit: 30,
              dir: 'forward',
            }),
            ctx,
          ),
        ).ast
        expect(
          rows(recent, fixture(visibility)).map((row) => row.threadId),
        ).toEqual(allowed ? [ctx.userID] : [])
        expect(
          rows(sidebar, fixture(visibility)).map((row) => row.threadId),
        ).toEqual(allowed ? [ctx.userID] : [])
        for (const threadId of ['owner', 'member', 'admin', 'outsider']) {
          const thread = asQueryInternals(
            addContextToQuery(queries.threads.byId({ threadId }), ctx),
          ).ast
          const messages = asQueryInternals(
            addContextToQuery(queries.messages.byThread({ threadId }), ctx),
          ).ast
          expect(rows(thread, fixture(visibility))).toHaveLength(
            allowed && threadId === ctx.userID ? 1 : 0,
          )
          expect(rows(messages, fixture(visibility))).toHaveLength(
            allowed && threadId === ctx.userID ? 1 : 0,
          )
        }
      },
    )
  })
}

it('requires matching active organization even for a current member', () => {
  for (const organizationId of [undefined, 'other-org']) {
    const ctx = { userID: 'member', isAnonymous: false, organizationId }
    const ast = asQueryInternals(
      addContextToQuery(queries.projects.list({}), ctx),
    ).ast
    expect(rows(ast, fixture('org'))).toHaveLength(0)
  }
})

it('stops all shared context and thread reads when the owner leaves', () => {
  const tables = fixture('org')
  const orphan = {
    ...tables,
    member: tables.member.filter((row) => row.userId !== 'owner'),
  }
  const ctx = { userID: 'member', organizationId: 'org', isAnonymous: false }
  const asts = [
    asQueryInternals(addContextToQuery(queries.projects.list({}), ctx)).ast,
    asQueryInternals(
      addContextToQuery(queries.projects.byId({ projectId: 'p' }), ctx),
    ).ast,
    asQueryInternals(
      addContextToQuery(
        queries.projects.recentThreads({ projectId: 'p', limit: 30 }),
        ctx,
      ),
    ).ast,
    asQueryInternals(
      addContextToQuery(queries.skills.listForProject({ projectId: 'p' }), ctx),
    ).ast,
    asQueryInternals(
      addContextToQuery(
        queries.skills.overridesForProject({ projectId: 'p' }),
        ctx,
      ),
    ).ast,
    asQueryInternals(
      addContextToQuery(queries.threads.byId({ threadId: 'member' }), ctx),
    ).ast,
    asQueryInternals(
      addContextToQuery(queries.messages.byThread({ threadId: 'member' }), ctx),
    ).ast,
  ]
  for (const ast of asts) {
    expect(rows(ast, orphan), ast.table).toHaveLength(0)
  }
})

it('never relates the owner user row into a project read', () => {
  for (const userID of ['owner', 'member', 'admin']) {
    const ast = asQueryInternals(
      addContextToQuery(queries.projects.byId({ projectId: 'p' }), {
        userID,
        organizationId: 'org',
        isAnonymous: false,
      }),
    ).ast
    expect(ast.related ?? []).toHaveLength(0)
  }
})

it('full attachment rows are owner-only even while the project is shared', () => {
  for (const userID of ['owner', 'member', 'admin', 'outsider']) {
    const ast = asQueryInternals(
      addContextToQuery(queries.projects.attachments({ projectId: 'p' }), {
        userID,
        organizationId: 'org',
        isAnonymous: false,
      }),
    ).ast
    expect(rows(ast, fixture('org'))).toHaveLength(userID === 'owner' ? 1 : 0)
  }
})

it('filters upstream before limiting, so a match older than the first 30 rows is found', () => {
  const base = fixture('org')
  const thread = base.thread[0]
  const tables = {
    ...base,
    thread: Array.from({ length: 45 }, (_, index) => ({
      ...thread,
      threadId: `t${index}`,
      title: index === 40 ? 'Old roadmap' : 'Recent work',
      updatedAt: 100 - index,
    })),
  }
  const ast = asQueryInternals(
    addContextToQuery(
      queries.projects.recentThreads({
        projectId: 'p',
        limit: 30,
        search: 'roadmap',
      }),
      { userID: 'owner', organizationId: 'org', isAnonymous: false },
    ),
  ).ast
  expect(
    rows(ast, tables)
      .slice(0, ast.limit)
      .map((row) => row.threadId),
  ).toEqual(['t40'])
})
