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
})
