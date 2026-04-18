import {
  assertValidWritingFilePath,
  normalizeWritingPath,
  WritingPathError,
} from '@/lib/shared/writing/path-utils'
import { WritingToolExecutionError } from '../../domain'

function toToolExecutionError(
  requestId: string,
  toolName: string,
  message: string,
  cause?: unknown,
) {
  return new WritingToolExecutionError({
    message,
    requestId,
    toolName,
    cause: cause instanceof Error ? cause.message : String(cause ?? ''),
  })
}

/**
 * PI agents may sometimes echo paths relative to their virtual cwd, such as
 * `/writing/<projectId>/draft.md`. The writing workspace stores project paths
 * relative to the project root, so we strip known virtual prefixes before
 * validating or staging a tool path.
 */
export function normalizeWritingAgentToolPath(input: {
  readonly path: string
  readonly workspaceRoots?: readonly string[]
}): string {
  return stripWorkspacePrefix(input.path, input.workspaceRoots)
}

export function normalizeToolPath(input: {
  readonly toolName: string
  readonly requestId: string
  readonly path: string
  readonly workspaceRoots?: readonly string[]
}): string {
  try {
    return normalizeWritingPath(
      normalizeWritingAgentToolPath({
        path: input.path,
        workspaceRoots: input.workspaceRoots,
      }),
    )
  } catch (error) {
    if (error instanceof WritingPathError) {
      throw toToolExecutionError(
        input.requestId,
        input.toolName,
        `Invalid path supplied to ${input.toolName}`,
        error,
      )
    }
    throw error
  }
}

export function assertToolFilePath(input: {
  readonly toolName: string
  readonly requestId: string
  readonly path: string
  readonly workspaceRoots?: readonly string[]
}): string {
  try {
    return assertValidWritingFilePath(
      normalizeWritingAgentToolPath({
        path: input.path,
        workspaceRoots: input.workspaceRoots,
      }),
    )
  } catch (error) {
    if (error instanceof WritingPathError) {
      throw toToolExecutionError(
        input.requestId,
        input.toolName,
        `Invalid markdown file path supplied to ${input.toolName}`,
        error,
      )
    }
    throw error
  }
}

function stripWorkspacePrefix(
  path: string,
  workspaceRoots: readonly string[] | undefined,
): string {
  const trimmed = path.trim()
  if (!workspaceRoots || workspaceRoots.length === 0) {
    return trimmed
  }

  for (const root of workspaceRoots) {
    if (trimmed === root) {
      return '/'
    }
    if (trimmed.startsWith(`${root}/`)) {
      const remainder = trimmed.slice(root.length)
      return remainder.startsWith('/') ? remainder : `/${remainder}`
    }
  }

  return trimmed
}
