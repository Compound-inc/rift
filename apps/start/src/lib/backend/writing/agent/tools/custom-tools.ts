import { defineTool } from '@mariozechner/pi-coding-agent'
import type { ToolDefinition } from '@mariozechner/pi-coding-agent'
import { Type } from '@sinclair/typebox'
import { Effect } from 'effect'
import {
  applyWritingPatchToContent,
  parseWritingApplyPatch,
} from '@/lib/shared/writing/patch'
import { WritingInvalidRequestError } from '../../domain'
import { WritingToolExecutionError } from '../../domain/errors'
import type { WritingChangeSetService } from '../../services/change-set.service'
import type { WritingWorkspaceService } from '../../services/workspace.service'
import { createToolResult, formatEntryList } from '../resource-loader'
import { assertToolFilePath, normalizeToolPath } from './tool-paths'

type WorkspaceServiceShape = InstanceType<typeof WritingWorkspaceService>
type ChangeSetServiceShape = InstanceType<typeof WritingChangeSetService>
type WorkspaceEntry = {
  readonly path: string
  readonly kind: string
}
type GrepMatch = {
  readonly path: string
  readonly lineNumber: number
  readonly line: string
}
type ReadFileResult = {
  readonly path: string
  readonly content: string
  readonly entry?: WorkspaceEntry
}
type UpsertFileChangeResult = {
  readonly changeId: string
  readonly hunkCount: number
}

export function buildWritingAgentTools(input: {
  readonly projectId: string
  readonly changeSetId: string
  readonly userId: string
  readonly organizationId?: string
  readonly requestId: string
  readonly workspace: WorkspaceServiceShape
  readonly changeSets: ChangeSetServiceShape
}) {
  const workspaceRoots = [
    `/writing/${input.projectId}`,
    `/writing-agent/${input.projectId}`,
  ] as const

  const tools = [
    defineTool({
      name: 'ls',
      label: 'ls',
      description: 'List the immediate files and folders inside a project path.',
      promptSnippet:
        'ls(path?) lists the immediate entries in a workspace directory.',
      parameters: Type.Object({
        path: Type.Optional(Type.String()),
      }),
      async execute(_toolCallId, params) {
        const targetPath = normalizeToolPath({
          toolName: 'ls',
          requestId: input.requestId,
          path: params.path ?? '/',
          workspaceRoots,
        })
        const entries = (await Effect.runPromise(
          input.workspace.listEntries({
            projectId: input.projectId,
            userId: input.userId,
            organizationId: input.organizationId,
            changeSetId: input.changeSetId,
            requestId: input.requestId,
          }),
        )) as readonly WorkspaceEntry[]
        return createToolResult(formatEntryList(entries, targetPath), {
          path: targetPath,
          toolName: 'ls',
        })
      },
    }),
    defineTool({
      name: 'find',
      label: 'find',
      description: 'Find files or folders by path/name pattern.',
      promptSnippet: 'find(query, path?) searches entry paths inside the project.',
      parameters: Type.Object({
        query: Type.String(),
        path: Type.Optional(Type.String()),
      }),
      async execute(_toolCallId, params) {
        const prefix = params.path
          ? normalizeToolPath({
              toolName: 'find',
              requestId: input.requestId,
              path: params.path,
              workspaceRoots,
            })
          : undefined
        const matches = (await Effect.runPromise(
          input.workspace.findPaths({
            projectId: input.projectId,
            userId: input.userId,
            organizationId: input.organizationId,
            pattern: params.query,
            changeSetId: input.changeSetId,
            requestId: input.requestId,
          }),
        )) as readonly string[]
        const filtered = prefix
          ? matches.filter((path) => path === prefix || path.startsWith(`${prefix}/`))
          : matches
        return createToolResult(filtered.join('\n') || '(no matches)', {
          count: filtered.length,
          query: params.query,
          path: prefix,
        })
      },
    }),
    defineTool({
      name: 'grep',
      label: 'grep',
      description: 'Search markdown file contents across the project.',
      promptSnippet:
        'grep(pattern, path?) searches markdown contents across the workspace.',
      parameters: Type.Object({
        pattern: Type.String(),
        path: Type.Optional(Type.String()),
      }),
      async execute(_toolCallId, params) {
        const prefix = params.path
          ? normalizeToolPath({
              toolName: 'grep',
              requestId: input.requestId,
              path: params.path,
              workspaceRoots,
            })
          : undefined
        const matches = (await Effect.runPromise(
          input.workspace.grepProject({
            projectId: input.projectId,
            userId: input.userId,
            organizationId: input.organizationId,
            pattern: params.pattern,
            changeSetId: input.changeSetId,
            requestId: input.requestId,
          }),
        )) as readonly GrepMatch[]
        const filtered = prefix
          ? matches.filter(
              (match) => match.path === prefix || match.path.startsWith(`${prefix}/`),
            )
          : matches
        return createToolResult(
          filtered
            .map((match) => `${match.path}:${match.lineNumber} ${match.line}`)
            .join('\n') || '(no matches)',
          {
            count: filtered.length,
            pattern: params.pattern,
            path: prefix,
          },
        )
      },
    }),
    defineTool({
      name: 'read',
      label: 'read',
      description: 'Read a markdown file, optionally limited to a line range.',
      promptSnippet:
        'read(path, startLine?, endLine?) reads file contents from the virtual workspace.',
      parameters: Type.Object({
        path: Type.String(),
        startLine: Type.Optional(Type.Number()),
        endLine: Type.Optional(Type.Number()),
      }),
      async execute(_toolCallId, params) {
        const normalizedPath = assertToolFilePath({
          toolName: 'read',
          requestId: input.requestId,
          path: params.path,
          workspaceRoots,
        })
        const file = (await Effect.runPromise(
          input.workspace.readFile({
            projectId: input.projectId,
            userId: input.userId,
            organizationId: input.organizationId,
            path: normalizedPath,
            changeSetId: input.changeSetId,
            requestId: input.requestId,
          }),
        )) as ReadFileResult
        const lines = file.content.split('\n')
        const startIndex = Math.max(0, (params.startLine ?? 1) - 1)
        const requestedEndLine = params.endLine ?? lines.length
        const endIndex =
          requestedEndLine >= (params.startLine ?? 1)
            ? requestedEndLine
            : lines.length
        const text = lines
          .slice(startIndex, endIndex)
          .map((line, offset) => `${startIndex + offset + 1}: ${line}`)
          .join('\n')

        return createToolResult(text, {
          path: file.path,
          lineCount: lines.length,
          startLine: params.startLine ?? 1,
          endLine: requestedEndLine,
        })
      },
    }),
    defineTool({
      name: 'write',
      label: 'write',
      description: 'Create or fully replace a markdown file inside the project.',
      promptSnippet: 'write(path, content) stages a full file replacement.',
      parameters: Type.Object({
        path: Type.String(),
        content: Type.String(),
        createParents: Type.Optional(Type.Boolean()),
      }),
      async execute(_toolCallId, params) {
        const normalizedPath = assertToolFilePath({
          toolName: 'write',
          requestId: input.requestId,
          path: params.path,
          workspaceRoots,
        })
        let current: ReadFileResult | null = null
        try {
          current = (await Effect.runPromise(
            input.workspace.readFile({
              projectId: input.projectId,
              userId: input.userId,
              organizationId: input.organizationId,
              path: normalizedPath,
              changeSetId: input.changeSetId,
              requestId: input.requestId,
            }),
          )) as ReadFileResult
        } catch (error) {
          if (!(error instanceof WritingInvalidRequestError)) {
            throw error
          }
        }

        const operation = current?.entry ? 'update' : 'create'
        const result = (await Effect.runPromise(
          input.changeSets.upsertFileChange({
            changeSetId: input.changeSetId,
            userId: input.userId,
            organizationId: input.organizationId,
            path: normalizedPath,
            operation,
            proposedContent: params.content,
            requestId: input.requestId,
          }),
        )) as UpsertFileChangeResult

        return createToolResult(
          `Staged ${operation} for ${normalizedPath} (${result.hunkCount} hunks).`,
          {
            ...result,
            path: normalizedPath,
            operation,
          },
        )
      },
    }),
    defineTool({
      name: 'edit',
      label: 'edit',
      description: 'Apply exact text replacements to a markdown file.',
      promptSnippet:
        'edit(path, edits) performs precise oldText/newText replacements.',
      parameters: Type.Object({
        path: Type.String(),
        edits: Type.Array(
          Type.Object({
            oldText: Type.String(),
            newText: Type.String(),
          }),
        ),
      }),
      async execute(_toolCallId, params) {
        const normalizedPath = assertToolFilePath({
          toolName: 'edit',
          requestId: input.requestId,
          path: params.path,
          workspaceRoots,
        })
        const current = (await Effect.runPromise(
          input.workspace.readFile({
            projectId: input.projectId,
            userId: input.userId,
            organizationId: input.organizationId,
            path: normalizedPath,
            changeSetId: input.changeSetId,
            requestId: input.requestId,
          }),
        )) as ReadFileResult

        let nextContent = current.content
        for (const edit of params.edits) {
          if (!nextContent.includes(edit.oldText)) {
            throw new WritingToolExecutionError({
              message: `edit could not find the expected text in ${normalizedPath}`,
              requestId: input.requestId,
              toolName: 'edit',
            })
          }
          nextContent = nextContent.replace(edit.oldText, edit.newText)
        }

        const result = (await Effect.runPromise(
          input.changeSets.upsertFileChange({
            changeSetId: input.changeSetId,
            userId: input.userId,
            organizationId: input.organizationId,
            path: normalizedPath,
            operation: 'update',
            proposedContent: nextContent,
            requestId: input.requestId,
          }),
        )) as UpsertFileChangeResult

        return createToolResult(
          `Staged update for ${normalizedPath} (${result.hunkCount} hunks).`,
          {
            ...result,
            path: normalizedPath,
            operation: 'update',
          },
        )
      },
    }),
    defineTool({
      name: 'apply_patch',
      label: 'apply_patch',
      description: 'Apply a multi-file patch to the workspace.',
      promptSnippet:
        'apply_patch(patch) applies explicit diff hunks across one or more markdown files.',
      parameters: Type.Object({
        patch: Type.String(),
      }),
      async execute(_toolCallId, params) {
        let operations
        try {
          operations = parseWritingApplyPatch(params.patch)
        } catch (error) {
          throw new WritingToolExecutionError({
            message: 'apply_patch could not parse the provided patch',
            requestId: input.requestId,
            toolName: 'apply_patch',
            cause: error instanceof Error ? error.message : String(error ?? ''),
          })
        }
        let appliedCount = 0

        for (const operation of operations) {
          const normalizedPath = assertToolFilePath({
            toolName: 'apply_patch',
            requestId: input.requestId,
            path: operation.path,
            workspaceRoots,
          })
          if (operation.kind === 'delete') {
            await Effect.runPromise(
              input.changeSets.upsertFileChange({
                changeSetId: input.changeSetId,
                userId: input.userId,
                organizationId: input.organizationId,
                path: normalizedPath,
                operation: 'delete',
                requestId: input.requestId,
              }),
            )
            appliedCount += 1
            continue
          }

          if (operation.kind === 'add') {
            await Effect.runPromise(
              input.changeSets.upsertFileChange({
                changeSetId: input.changeSetId,
                userId: input.userId,
                organizationId: input.organizationId,
                path: normalizedPath,
                operation: 'create',
                proposedContent: operation.content,
                requestId: input.requestId,
              }),
            )
            appliedCount += 1
            continue
          }

          const current = (await Effect.runPromise(
            input.workspace.readFile({
              projectId: input.projectId,
              userId: input.userId,
              organizationId: input.organizationId,
              path: normalizedPath,
              changeSetId: input.changeSetId,
              requestId: input.requestId,
            }),
          )) as ReadFileResult
          const nextContent = applyWritingPatchToContent({
            path: normalizedPath,
            currentContent: current.content,
            patch: operation.patch,
          })
          await Effect.runPromise(
            input.changeSets.upsertFileChange({
              changeSetId: input.changeSetId,
              userId: input.userId,
              organizationId: input.organizationId,
              path: normalizedPath,
              operation: current.entry ? 'update' : 'create',
              proposedContent: nextContent,
              requestId: input.requestId,
            }),
          )
          appliedCount += 1
        }

        return createToolResult(`Staged ${appliedCount} patch operation(s).`, {
          count: appliedCount,
          paths: [...new Set(operations.map((operation) => operation.path))],
        })
      },
    }),
  ] satisfies ToolDefinition[]

  return tools
}
