import { applyPatch as applyUnifiedPatch } from 'diff'

export type WritingPatchOperation =
  | {
      readonly kind: 'add'
      readonly path: string
      readonly content: string
    }
  | {
      readonly kind: 'delete'
      readonly path: string
    }
  | {
      readonly kind: 'update'
      readonly path: string
      readonly patch: string
    }

function assertPatchLine(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

/**
 * Parses the `*** Begin Patch` format into file-scoped operations.
 *
 * v1 intentionally supports the subset we need for markdown workspaces:
 * add, delete, and unified-hunk updates. Move operations stay out of scope
 * until the writing workspace needs explicit path renames.
 */
export function parseWritingApplyPatch(
  input: string,
): readonly WritingPatchOperation[] {
  const lines = input.replace(/\r\n/g, '\n').split('\n')
  assertPatchLine(
    lines[0] === '*** Begin Patch',
    'Patch must start with "*** Begin Patch"',
  )

  const operations: WritingPatchOperation[] = []
  let index = 1

  while (index < lines.length) {
    const line = lines[index]
    if (line === '*** End Patch') {
      return operations
    }
    if (line.length === 0) {
      index += 1
      continue
    }

    if (line.startsWith('*** Add File: ')) {
      const path = line.slice('*** Add File: '.length).trim()
      index += 1
      const contentLines: string[] = []
      while (index < lines.length) {
        const candidate = lines[index]
        if (candidate.startsWith('*** ')) {
          break
        }
        assertPatchLine(
          candidate.startsWith('+') || candidate === '',
          `Invalid add-file patch line for ${path}`,
        )
        contentLines.push(
          candidate.startsWith('+') ? candidate.slice(1) : candidate,
        )
        index += 1
      }
      operations.push({
        kind: 'add',
        path,
        content: contentLines.join('\n'),
      })
      continue
    }

    if (line.startsWith('*** Delete File: ')) {
      operations.push({
        kind: 'delete',
        path: line.slice('*** Delete File: '.length).trim(),
      })
      index += 1
      continue
    }

    if (line.startsWith('*** Update File: ')) {
      const path = line.slice('*** Update File: '.length).trim()
      index += 1

      if (lines[index]?.startsWith('*** Move to: ')) {
        throw new Error(
          'Move operations are not supported in the writing workspace yet',
        )
      }

      const patchLines: string[] = []
      while (index < lines.length) {
        const candidate = lines[index]
        if (candidate === '*** End of File') {
          index += 1
          break
        }
        if (candidate.startsWith('*** ')) {
          break
        }
        patchLines.push(candidate)
        index += 1
      }

      assertPatchLine(
        patchLines.length > 0,
        `Update patch for ${path} is empty`,
      )
      operations.push({
        kind: 'update',
        path,
        patch: [`--- a${path}`, `+++ b${path}`, ...patchLines].join('\n'),
      })
      continue
    }

    throw new Error(`Unsupported patch line: ${line}`)
  }

  throw new Error('Patch must end with "*** End Patch"')
}

/**
 * Applies a parsed unified patch against an in-memory file body.
 */
export function applyWritingPatchToContent(input: {
  readonly path: string
  readonly currentContent: string
  readonly patch: string
}): string {
  const applied = applyUnifiedPatch(input.currentContent, input.patch)
  const shouldUseFallback =
    typeof applied !== 'string' ||
    (applied === input.currentContent &&
      input.patch.includes('\n-') &&
      input.patch.includes('\n+'))

  if (shouldUseFallback) {
    const patchLines = input.patch.split('\n').slice(2)
    const chunkTexts = patchLines
      .join('\n')
      .split(/^@@.*$/m)
      .filter(Boolean)
    let nextContent = input.currentContent

    for (const chunk of chunkTexts) {
      const chunkLines = chunk.split('\n').filter((line) => line.length > 0)

      const oldText = chunkLines
        .filter((line) => line.startsWith(' ') || line.startsWith('-'))
        .map((line) => line.slice(1))
        .join('\n')
      const newText = chunkLines
        .filter((line) => line.startsWith(' ') || line.startsWith('+'))
        .map((line) => line.slice(1))
        .join('\n')

      if (!oldText || !nextContent.includes(oldText)) {
        throw new Error(`Patch for ${input.path} could not be applied cleanly`)
      }

      nextContent = nextContent.replace(oldText, newText)
    }

    return nextContent
  }
  return applied
}
