import {
  structuredPatch,
} from 'diff'

export type WritingStructuredHunk = {
  readonly index: number
  readonly oldStart: number
  readonly oldLines: number
  readonly newStart: number
  readonly newLines: number
  readonly patchText: string
}

export function countLines(content: string): number {
  if (content.length === 0) {
    return 0
  }
  return content.split('\n').length
}

/**
 * Converts unified diff hunks into a compact persisted shape that can be
 * approved one hunk at a time and re-applied against the original base file.
 *
 * The persisted source of truth is the unified patch text plus its line ranges.
 * UI previews and replacement slices are derived from that patch so we do not
 * store multiple redundant string representations for the same hunk.
 */
export function createWritingHunks(input: {
  readonly path: string
  readonly oldContent: string
  readonly newContent: string
}): readonly WritingStructuredHunk[] {
  const patch = structuredPatch(
    input.path,
    input.path,
    input.oldContent,
    input.newContent,
    'base',
    'next',
    { context: 3 },
  )

  return (patch.hunks ?? []).map((hunk, index) => ({
      index,
      oldStart: hunk.oldStart,
      oldLines: hunk.oldLines,
      newStart: hunk.newStart,
      newLines: hunk.newLines,
      patchText: [
        `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`,
        ...hunk.lines,
      ].join('\n'),
    }))
}

/**
 * Removes the diff header so the UI can render a compact hunk body without
 * carrying a second preview-only field in persistence.
 */
export function getWritingHunkPreviewText(patchText: string): string {
  const [_, ...bodyLines] = patchText.split('\n')
  return bodyLines.join('\n')
}

/**
 * Reconstructs the replacement block represented by a unified hunk. Context
 * lines and additions are preserved; removals are omitted.
 */
export function getWritingHunkReplacementText(patchText: string): string {
  return patchText
    .split('\n')
    .slice(1)
    .filter((line) => line.startsWith('+') || line.startsWith(' '))
    .map((line) => line.slice(1))
    .join('\n')
}

export function applyAcceptedHunks(input: {
  readonly baseContent: string
  readonly acceptedHunks: readonly Pick<
    WritingStructuredHunk,
    'oldStart' | 'oldLines' | 'patchText'
  >[]
}): string {
  if (input.acceptedHunks.length === 0) {
    return input.baseContent
  }

  const baseLines = input.baseContent.length === 0
    ? []
    : input.baseContent.split('\n')
  const segments: string[] = []
  let cursor = 1

  for (const hunk of [...input.acceptedHunks].sort((left, right) => left.oldStart - right.oldStart)) {
    const startIndex = Math.max(hunk.oldStart - 1, 0)
    if (cursor - 1 < startIndex) {
      segments.push(...baseLines.slice(cursor - 1, startIndex))
    }

    const replacementText = getWritingHunkReplacementText(hunk.patchText)
    if (replacementText.length > 0) {
      segments.push(...replacementText.split('\n'))
    }

    cursor = startIndex + hunk.oldLines + 1
  }

  if (cursor - 1 < baseLines.length) {
    segments.push(...baseLines.slice(cursor - 1))
  }

  return segments.join('\n')
}
