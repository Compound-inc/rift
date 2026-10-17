import { describe, expect, it } from 'vitest'
import { chatQueryDefinitions } from './chat.queries'
import { projectQueryDefinitions } from './projects.queries'

const ctx = { userID: 'owner', organizationId: 'org', isAnonymous: false }
// Zero exposes the completed query AST at runtime. Inspect its predicates to
// guard filtering at the sync boundary, where hidden rows must be excluded.
function ast(query: unknown) {
  return (query as { ast: unknown }).ast
}
const visible = {
  type: 'simple',
  left: { type: 'column', name: 'visibility' },
  op: '=',
  right: { type: 'literal', value: 'visible' },
}

describe('archive filtering', () => {
  it('excludes archived rows from sidebar history and project lists', () => {
    for (const query of [
      chatQueryDefinitions.threads.historyPage.fn({
        args: { dir: 'forward', limit: 20 },
        ctx,
      }),
      projectQueryDefinitions.projects.threadsPage.fn({
        args: { projectId: 'project', dir: 'forward', limit: 20 },
        ctx,
      }),
    ]) {
      expect(ast(query)).toMatchObject({
        where: { type: 'and', conditions: expect.arrayContaining([visible]) },
      })
    }
  })
  it('allows direct thread access regardless of archive visibility', () => {
    // Only the thread's own predicates matter. Correlated subqueries filter
    // other tables (e.g. the project's own `visibility` for project access).
    const threadColumns = (node: unknown): string[] => {
      if (!node || typeof node !== 'object') return []
      const value = node as Record<string, unknown>
      if (value.type === 'correlatedSubquery') return []
      if (value.type === 'simple')
        return [(value.left as { name?: string } | undefined)?.name ?? '']
      return Array.isArray(value.conditions)
        ? value.conditions.flatMap(threadColumns)
        : []
    }
    const query = ast(
      chatQueryDefinitions.threads.byId.fn({
        args: { threadId: 'thread' },
        ctx,
      }),
    ) as { where?: unknown }
    expect(threadColumns(query.where)).toContain('threadId')
    expect(threadColumns(query.where)).not.toContain('visibility')
  })
  it('scopes the archive list to the owner, organization and existing projects', () => {
    const serialized = JSON.stringify(
      ast(
        chatQueryDefinitions.threads.archived.fn({
          args: { organizationId: 'org' },
          ctx,
        }),
      ),
    )
    expect(serialized).toContain('archived')
    expect(serialized).toContain('owner')
    expect(serialized).toContain('ownerOrgId')
    expect(serialized).toContain('deletedAt')
  })
})
