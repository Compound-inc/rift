import { WRITING_PROJECT_INSTRUCTION_PATH } from '@/lib/shared/writing/constants'

export type WritingManuscriptEntry = {
  readonly id: string
  readonly path: string
  readonly name: string
  readonly kind: 'file' | 'folder'
  readonly blob?: {
    readonly content?: string
  } | null
}

export type WritingManuscriptFile = {
  readonly id: string
  readonly path: string
  readonly name: string
  readonly title: string
  readonly orderLabel: string | null
  readonly content: string
  readonly wordCount: number
  readonly sectionPath: string | null
  readonly sectionTitle: string
  readonly nestedPathLabel: string | null
  readonly review: WritingManuscriptReview | null
}

export type WritingManuscriptSection = {
  readonly id: string
  readonly path: string | null
  readonly title: string
  readonly description: string
  readonly files: readonly WritingManuscriptFile[]
  readonly wordCount: number
}

export type WritingManuscript = {
  readonly sections: readonly WritingManuscriptSection[]
  readonly files: readonly WritingManuscriptFile[]
  readonly totalWordCount: number
  readonly totalFileCount: number
  readonly workspaceInstructionsPath: string | null
  readonly hasUngroupedFiles: boolean
}

export type WritingManuscriptReview = {
  readonly changeSetId: string
  readonly changeId: string
  readonly changeSetSummary: string
  readonly operation: 'create' | 'update' | 'delete' | 'move'
  readonly status: 'pending' | 'partially_applied'
  readonly hunkIds: readonly string[]
  readonly pendingHunkCount: number
  readonly baseContent: string
  readonly proposedContent: string
  readonly createdAt: number
}

export type WritingPendingReviewInput = {
  readonly changeSetId: string
  readonly changeId: string
  readonly changeSetSummary: string
  readonly changeSetStatus: 'pending' | 'partially_applied'
  readonly path: string
  readonly operation: 'create' | 'update' | 'delete' | 'move'
  readonly createdAt: number
  readonly baseContent: string
  readonly proposedContent: string
  readonly hunkIds: readonly string[]
}

function getPathSegments(path: string) {
  return path.split('/').filter(Boolean)
}

function getBaseName(path: string) {
  return getPathSegments(path).at(-1) ?? ''
}

function stripMarkdownExtension(name: string) {
  return name.replace(/\.md$/i, '')
}

function getOrderingPrefix(name: string) {
  const match = stripMarkdownExtension(name).match(/^(\d+)/)
  return match ? Number.parseInt(match[1] ?? '', 10) : null
}

function extractOrderLabel(name: string) {
  return stripMarkdownExtension(name).match(/^(\d+)/)?.[1] ?? null
}

function stripOrderingPrefix(name: string) {
  const withoutExtension = stripMarkdownExtension(name)
  const stripped = withoutExtension.replace(/^\d+[-_.\s]*/, '').trim()
  return stripped.length > 0 ? stripped : withoutExtension
}

function humanizeLabel(raw: string) {
  const cleaned = stripOrderingPrefix(raw)
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (cleaned.length === 0) {
    return 'Untitled'
  }

  return cleaned.replace(/\b\w/g, (character) => character.toUpperCase())
}

function countWords(content: string) {
  const normalized = content.trim()
  if (normalized.length === 0) {
    return 0
  }

  return normalized.split(/\s+/).length
}

function describeSection(fileCount: number, wordCount: number) {
  const fileLabel = `${fileCount} file${fileCount === 1 ? '' : 's'}`
  const wordLabel = `${wordCount.toLocaleString()} word${wordCount === 1 ? '' : 's'}`
  return `${fileLabel} • ${wordLabel}`
}

function compareOrderedSegment(left: string, right: string) {
  const leftOrder = getOrderingPrefix(left)
  const rightOrder = getOrderingPrefix(right)

  if (leftOrder != null && rightOrder != null && leftOrder !== rightOrder) {
    return leftOrder - rightOrder
  }

  if (leftOrder != null && rightOrder == null) {
    return -1
  }

  if (leftOrder == null && rightOrder != null) {
    return 1
  }

  return humanizeLabel(left).localeCompare(humanizeLabel(right), undefined, {
    numeric: true,
    sensitivity: 'base',
  })
}

/**
 * Manuscript order is encoded in folder and file names rather than a separate
 * manifest. Comparing each path segment independently lets nested structures
 * like `/01-act/02-scene/01-draft.md` render in the same order the AI sees.
 */
function compareManuscriptPath(leftPath: string, rightPath: string) {
  const leftSegments = getPathSegments(leftPath)
  const rightSegments = getPathSegments(rightPath)
  const maxLength = Math.max(leftSegments.length, rightSegments.length)

  for (let index = 0; index < maxLength; index += 1) {
    const left = leftSegments[index]
    const right = rightSegments[index]

    if (left === undefined) {
      return -1
    }

    if (right === undefined) {
      return 1
    }

    const result = compareOrderedSegment(left, right)
    if (result !== 0) {
      return result
    }
  }

  return leftPath.localeCompare(rightPath)
}

/**
 * Builds a manuscript-first projection over the workspace tree while keeping
 * file boundaries intact for review, navigation, and large-document rendering.
 */
export function buildWritingManuscript(
  entries: readonly WritingManuscriptEntry[],
  pendingReviews: readonly WritingPendingReviewInput[] = [],
): WritingManuscript {
  const fileEntries = entries
    .filter(
      (entry): entry is WritingManuscriptEntry & {
        readonly kind: 'file'
      } => entry.kind === 'file',
    )
    .sort((left, right) => compareManuscriptPath(left.path, right.path))

  const workspaceInstructions = fileEntries.find(
    (entry) => entry.path === WRITING_PROJECT_INSTRUCTION_PATH,
  )

  const files = fileEntries
    .filter((entry) => entry.path !== WRITING_PROJECT_INSTRUCTION_PATH)
    .map<WritingManuscriptFile>((entry) => {
      const segments = getPathSegments(entry.path)
      const topLevelSection = segments.length > 1 ? segments[0] ?? null : null
      const fileName = getBaseName(entry.path)
      const nestedSegments = segments.slice(topLevelSection ? 1 : 0, -1)
      const content = entry.blob?.content ?? ''

      return {
        id: entry.id,
        path: entry.path,
        name: fileName,
        title: humanizeLabel(fileName),
        orderLabel: extractOrderLabel(fileName),
        content,
        wordCount: countWords(content),
        sectionPath: topLevelSection ? `/${topLevelSection}` : null,
        sectionTitle: topLevelSection ? humanizeLabel(topLevelSection) : 'Ungrouped Drafts',
        nestedPathLabel:
          nestedSegments.length > 0
            ? nestedSegments.map((segment) => humanizeLabel(segment)).join(' / ')
            : null,
        review: null,
      }
    })

  const latestReviewByPath = new Map<string, WritingPendingReviewInput>()
  for (const review of [...pendingReviews].sort((left, right) => right.createdAt - left.createdAt)) {
    if (review.hunkIds.length === 0) {
      continue
    }
    if (!latestReviewByPath.has(review.path)) {
      latestReviewByPath.set(review.path, review)
    }
  }

  const fileMap = new Map<string, WritingManuscriptFile>(files.map((file) => [file.path, file]))

  for (const review of latestReviewByPath.values()) {
    const existing = fileMap.get(review.path)
    const contentForPreview =
      review.operation === 'delete' ? review.baseContent : review.proposedContent
    const segments = getPathSegments(review.path)
    const topLevelSection = segments.length > 1 ? segments[0] ?? null : null
    const fileName = getBaseName(review.path)
    const nestedSegments = segments.slice(topLevelSection ? 1 : 0, -1)
    const reviewPayload: WritingManuscriptReview = {
      changeSetId: review.changeSetId,
      changeId: review.changeId,
      changeSetSummary: review.changeSetSummary,
      operation: review.operation,
      status: review.changeSetStatus,
      hunkIds: review.hunkIds,
      pendingHunkCount: review.hunkIds.length,
      baseContent: review.baseContent,
      proposedContent: review.proposedContent,
      createdAt: review.createdAt,
    }

    fileMap.set(review.path, {
      id: existing?.id ?? `pending:${review.changeId}`,
      path: review.path,
      name: fileName,
      title: humanizeLabel(fileName),
      orderLabel: extractOrderLabel(fileName),
      content: contentForPreview,
      wordCount: countWords(contentForPreview),
      sectionPath: topLevelSection ? `/${topLevelSection}` : null,
      sectionTitle: topLevelSection ? humanizeLabel(topLevelSection) : 'Ungrouped Drafts',
      nestedPathLabel:
        nestedSegments.length > 0
          ? nestedSegments.map((segment) => humanizeLabel(segment)).join(' / ')
          : null,
      review: reviewPayload,
    })
  }

  const mergedFiles = [...fileMap.values()].sort((left, right) =>
    compareManuscriptPath(left.path, right.path),
  )

  const sectionMap = new Map<string, WritingManuscriptFile[]>()
  for (const file of mergedFiles) {
    const key = file.sectionPath ?? '__ungrouped__'
    const current = sectionMap.get(key)
    if (current) {
      current.push(file)
      continue
    }

    sectionMap.set(key, [file])
  }

  const sections = [...sectionMap.entries()]
    .map<WritingManuscriptSection>(([sectionKey, sectionFiles]) => {
      const wordCount = sectionFiles.reduce((total, file) => total + file.wordCount, 0)
      const sectionTitle = sectionFiles[0]?.sectionTitle ?? 'Untitled Section'

      return {
        id: sectionKey,
        path: sectionKey === '__ungrouped__' ? null : sectionKey,
        title: sectionTitle,
        description: describeSection(sectionFiles.length, wordCount),
        files: sectionFiles,
        wordCount,
      }
    })
    .sort((left, right) => {
      if (left.path == null) {
        return 1
      }
      if (right.path == null) {
        return -1
      }
      return compareManuscriptPath(left.path, right.path)
    })

  const totalWordCount = mergedFiles.reduce((total, file) => total + file.wordCount, 0)

  return {
    sections,
    files: mergedFiles,
    totalWordCount,
    totalFileCount: mergedFiles.length,
    workspaceInstructionsPath: workspaceInstructions?.path ?? null,
    hasUngroupedFiles: sections.some((section) => section.path == null),
  }
}
