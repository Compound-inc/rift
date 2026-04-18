import {
  WRITING_ALLOWED_FILE_EXTENSION,
  WRITING_PROJECT_INSTRUCTION_PATH,
  WRITING_ROOT_PATH,
} from './constants'

export class WritingPathError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WritingPathError'
  }
}

function ensureLeadingSlash(path: string): string {
  return path.startsWith('/') ? path : `/${path}`
}

function normalizeWritingPosixPath(path: string): string {
  const segments = ensureLeadingSlash(path).split('/')
  const normalizedSegments: string[] = []

  for (const segment of segments) {
    if (segment.length === 0 || segment === '.') {
      continue
    }

    if (segment === '..') {
      if (normalizedSegments.length === 0) {
        throw new WritingPathError('Path must stay inside the project root')
      }

      normalizedSegments.pop()
      continue
    }

    normalizedSegments.push(segment)
  }

  return normalizedSegments.length === 0
    ? WRITING_ROOT_PATH
    : `/${normalizedSegments.join('/')}`
}

function getWritingPathSegments(path: string): string[] {
  return normalizeWritingPath(path).split('/').filter(Boolean)
}

/**
 * Writing projects are intentionally markdown-first. This validator keeps the
 * workspace inside a predictable virtual path space and blocks traversal.
 */
export function normalizeWritingPath(input: string): string {
  const trimmed = input.trim()
  if (trimmed.length === 0) {
    throw new WritingPathError('Path cannot be empty')
  }

  return normalizeWritingPosixPath(trimmed)
}

export function getWritingParentPath(path: string): string | null {
  const normalized = normalizeWritingPath(path)
  if (normalized === WRITING_ROOT_PATH) {
    return null
  }

  const segments = getWritingPathSegments(normalized)
  segments.pop()

  return segments.length === 0 ? WRITING_ROOT_PATH : `/${segments.join('/')}`
}

export function getWritingBaseName(path: string): string {
  const normalized = normalizeWritingPath(path)
  if (normalized === WRITING_ROOT_PATH) {
    return ''
  }

  const segments = getWritingPathSegments(normalized)
  return segments.at(-1) ?? ''
}

/**
 * A writing file is any markdown document inside the virtual workspace.
 *
 * Hidden control files such as `/.rift/project.md` still participate in the
 * same markdown-only rule, so folder validation should only reject paths that
 * actually resolve to markdown files rather than any path that happens to
 * contain a dot in one of its segments.
 */
export function isWritingMarkdownFilePath(path: string): boolean {
  const normalized = normalizeWritingPath(path)
  if (normalized === WRITING_ROOT_PATH) {
    return false
  }

  if (normalized === WRITING_PROJECT_INSTRUCTION_PATH) {
    return true
  }

  return getWritingBaseName(normalized).endsWith(WRITING_ALLOWED_FILE_EXTENSION)
}

export function isWritingDirectoryPath(path: string): boolean {
  const normalized = normalizeWritingPath(path)
  if (normalized === WRITING_ROOT_PATH) {
    return true
  }

  return !isWritingMarkdownFilePath(normalized)
}

export function assertValidWritingFilePath(path: string): string {
  const normalized = normalizeWritingPath(path)
  if (normalized === WRITING_ROOT_PATH) {
    throw new WritingPathError('The root path cannot be a file')
  }
  if (
    normalized !== WRITING_PROJECT_INSTRUCTION_PATH &&
    !normalized.endsWith(WRITING_ALLOWED_FILE_EXTENSION)
  ) {
    throw new WritingPathError('Only markdown files are supported in writing projects')
  }
  return normalized
}

export function assertValidWritingFolderPath(path: string): string {
  const normalized = normalizeWritingPath(path)
  if (normalized === WRITING_ROOT_PATH) {
    return normalized
  }
  if (!isWritingDirectoryPath(normalized)) {
    throw new WritingPathError('Folder paths cannot include file extensions')
  }
  return normalized
}

export function createProjectSlug(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug.length > 0 ? slug : `project-${Date.now()}`
}
