import { describe, expect, it } from 'vitest'
import {
  WRITING_PROJECT_INSTRUCTION_PATH,
  createDefaultWritingScaffold,
} from './index'

describe('writing scaffold', () => {
  it('creates the simplified root-only project scaffold', () => {
    const scaffold = createDefaultWritingScaffold('Business Plan')

    expect(scaffold.map((entry) => entry.path)).toEqual(
      ['/', WRITING_PROJECT_INSTRUCTION_PATH],
    )
  })

  it('guides projects toward section folders while keeping root instructions-only', () => {
    const scaffold = createDefaultWritingScaffold('Business Plan')
    const instructions = scaffold.find(
      (entry): entry is Extract<(typeof scaffold)[number], { kind: 'file' }> =>
        entry.kind === 'file' && entry.path === WRITING_PROJECT_INSTRUCTION_PATH,
    )

    expect(instructions?.content).toContain('Reserve the root for /agents.md')
    expect(instructions?.content).toContain('/01.-mechanics/01-intro.md')
    expect(instructions?.content).toContain(
      'numeric prefixes as the source of truth',
    )
  })
})
