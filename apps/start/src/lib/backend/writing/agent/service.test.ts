import { describe, expect, it } from 'vitest'
import { normalizeWritingAgentToolPath } from './service'

describe('normalizeWritingAgentToolPath', () => {
  it('strips the virtual writing workspace prefix from tool paths', () => {
    expect(
      normalizeWritingAgentToolPath({
        path: '/writing/project-123/chapter-02.md',
        workspaceRoots: ['/writing/project-123', '/writing-agent/project-123'],
      }),
    ).toBe('/chapter-02.md')
  })

  it('leaves already project-relative paths unchanged', () => {
    expect(
      normalizeWritingAgentToolPath({
        path: '/drafts/draft-02.md',
        workspaceRoots: ['/writing/project-123', '/writing-agent/project-123'],
      }),
    ).toBe('/drafts/draft-02.md')
  })
})
