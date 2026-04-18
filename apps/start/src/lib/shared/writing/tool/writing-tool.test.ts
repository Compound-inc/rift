import { describe, expect, it } from 'vitest'
import { WRITING_PROJECT_INSTRUCTION_PATH } from '../constants'
import {
  applyAcceptedHunks,
  applyWritingPatchToContent,
  assertValidWritingFolderPath,
  assertValidWritingFilePath,
  createWritingHunks,
  getWritingHunkPreviewText,
  getWritingHunkReplacementText,
  normalizeWritingPath,
  parseWritingApplyPatch,
} from './index'

describe('writing tool paths', () => {
  it('normalizes workspace-relative paths into rooted project paths', () => {
    expect(normalizeWritingPath('outline/../drafts/draft-01.md')).toBe(
      '/drafts/draft-01.md',
    )
    expect(assertValidWritingFilePath(WRITING_PROJECT_INSTRUCTION_PATH)).toBe(
      WRITING_PROJECT_INSTRUCTION_PATH,
    )
    expect(assertValidWritingFolderPath('/research')).toBe('/research')
  })
})

describe('writing tool apply_patch parser', () => {
  it('parses and applies Codex-style update hunks', () => {
    const operations = parseWritingApplyPatch(`*** Begin Patch
*** Update File: /README.md
@@
-Old line
+New line
*** End Patch`)
    const operation = operations[0]

    expect(operations).toHaveLength(1)
    expect(operation?.kind).toBe('update')

    const result = applyWritingPatchToContent({
      path: '/README.md',
      currentContent: 'Old line\nSecond line\n',
      patch: operation?.kind === 'update' ? operation.patch : '',
    })

    expect(result).toContain('New line')
    expect(result).toContain('Second line')
  })
})

describe('writing tool diff hunks', () => {
  it('derives preview and replacement text from canonical patch text', () => {
    const [hunk] = createWritingHunks({
      path: '/draft.md',
      oldContent: 'Alpha\nBeta\nGamma\n',
      newContent: 'Alpha\nBetter beta\nGamma\n',
    })

    expect(hunk).toBeDefined()
    if (!hunk) {
      throw new Error('Expected a diff hunk to be created')
    }
    expect(getWritingHunkPreviewText(hunk.patchText)).toContain('-Beta')
    expect(getWritingHunkPreviewText(hunk.patchText)).toContain('+Better beta')
    expect(getWritingHunkReplacementText(hunk.patchText)).toContain('Better beta')
    expect(getWritingHunkReplacementText(hunk.patchText)).not.toContain('-Beta')
  })

  it('rebuilds accepted content directly from patch text', () => {
    const [hunk] = createWritingHunks({
      path: '/draft.md',
      oldContent: 'One\nTwo\nThree\n',
      newContent: 'One\nTwo updated\nThree\n',
    })
    if (!hunk) {
      throw new Error('Expected a diff hunk to be created')
    }

    const result = applyAcceptedHunks({
      baseContent: 'One\nTwo\nThree\n',
      acceptedHunks: [
        {
          oldStart: hunk.oldStart,
          oldLines: hunk.oldLines,
          patchText: hunk.patchText,
        },
      ],
    })

    expect(result).toBe('One\nTwo updated\nThree\n')
  })
})
