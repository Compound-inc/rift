import { describe, expect, it } from 'vitest'
import {
  WRITING_PROJECT_INSTRUCTION_PATH,
  applyAcceptedHunks,
  applyWritingPatchToContent,
  assertValidWritingFolderPath,
  assertValidWritingFilePath,
  createWritingHunks,
  createDefaultWritingScaffold,
  getWritingHunkPreviewText,
  getWritingHunkReplacementText,
  normalizeWritingPath,
  parseWritingApplyPatch,
} from './index'

describe('writing paths', () => {
  it('normalizes workspace-relative paths into rooted project paths', () => {
    expect(normalizeWritingPath('outline/../drafts/draft-01.md')).toBe('/drafts/draft-01.md')
    expect(assertValidWritingFilePath(WRITING_PROJECT_INSTRUCTION_PATH)).toBe(
      WRITING_PROJECT_INSTRUCTION_PATH,
    )
    expect(assertValidWritingFolderPath('/research')).toBe('/research')
  })
})

describe('writing scaffold', () => {
  it('creates the simplified root-only project scaffold', () => {
    const scaffold = createDefaultWritingScaffold('Business Plan')

    expect(scaffold.map((entry) => entry.path)).toEqual(
      ['/', WRITING_PROJECT_INSTRUCTION_PATH],
    )
  })
})

describe('writing apply_patch parser', () => {
  it('parses and applies Codex-style update hunks', () => {
    const operations = parseWritingApplyPatch(`*** Begin Patch
*** Update File: /README.md
@@
-Old line
+New line
*** End Patch`)

    expect(operations).toHaveLength(1)
    expect(operations[0]?.kind).toBe('update')

    const result = applyWritingPatchToContent({
      path: '/README.md',
      currentContent: 'Old line\nSecond line\n',
      patch: operations[0]!.kind === 'update' ? operations[0]!.patch : '',
    })

    expect(result).toContain('New line')
    expect(result).toContain('Second line')
  })
})

describe('writing diff hunks', () => {
  it('derives preview and replacement text from canonical patch text', () => {
    const [hunk] = createWritingHunks({
      path: '/draft.md',
      oldContent: 'Alpha\nBeta\nGamma\n',
      newContent: 'Alpha\nBetter beta\nGamma\n',
    })

    expect(hunk).toBeDefined()
    expect(getWritingHunkPreviewText(hunk!.patchText)).toContain('-Beta')
    expect(getWritingHunkPreviewText(hunk!.patchText)).toContain('+Better beta')
    expect(getWritingHunkReplacementText(hunk!.patchText)).toContain('Better beta')
    expect(getWritingHunkReplacementText(hunk!.patchText)).not.toContain('-Beta')
  })

  it('rebuilds accepted content directly from patch text', () => {
    const [hunk] = createWritingHunks({
      path: '/draft.md',
      oldContent: 'One\nTwo\nThree\n',
      newContent: 'One\nTwo updated\nThree\n',
    })

    const result = applyAcceptedHunks({
      baseContent: 'One\nTwo\nThree\n',
      acceptedHunks: [{
        oldStart: hunk!.oldStart,
        oldLines: hunk!.oldLines,
        patchText: hunk!.patchText,
      }],
    })

    expect(result).toBe('One\nTwo updated\nThree\n')
  })
})
