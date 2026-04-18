import { Effect, Layer, ServiceMap } from 'effect'
import {
  AuthStorage,
  SessionManager,
  SettingsManager,
  createAgentSession,
  createExtensionRuntime,
  defineTool,
  type ToolDefinition,
} from '@mariozechner/pi-coding-agent'
import { getEnvApiKey, getModel } from '@mariozechner/pi-ai'
import { Type } from '@sinclair/typebox'
import {
  ZeroDatabaseNotConfiguredError,
  ZeroDatabaseService,
} from '@/lib/backend/server-effect/services/zero-database.service'
import { zql } from '@/lib/backend/chat/infra/zero/db'
import {
  WRITING_PROJECT_INSTRUCTION_PATH,
  applyWritingPatchToContent,
  assertValidWritingFilePath,
  getWritingParentPath,
  normalizeWritingPath,
  parseWritingApplyPatch,
  WritingPathError,
} from '@/lib/shared/writing'
import {
  resolveWritingRuntimeModelTarget,
  WritingAgentError,
  WritingChatNotFoundError,
  WritingConflictError,
  WritingInvalidRequestError,
  WritingPersistenceError,
  WritingProjectNotFoundError,
  WritingToolExecutionError,
} from '../domain'
import { UserSkillRegistryService } from './user-skill-registry.service'
import { WritingChangeSetService } from './writing-change-set.service'
import { WritingChatService } from './writing-chat.service'
import { WritingProjectService } from './writing-project.service'
import { WritingWorkspaceService } from './writing-workspace.service'
import { getProjectChat } from './writing-persistence'

type WritingAgentResponse = {
  readonly chatId: string
  readonly assistantMessageId: string
  readonly assistantMessage: string
  readonly changeSetId?: string
  readonly headSnapshotId?: string
}

function toPersistenceError(
  requestId: string,
  message: string,
  cause?: unknown,
) {
  return new WritingPersistenceError({
    message,
    requestId,
    cause: cause instanceof Error ? cause.message : String(cause ?? ''),
  })
}

function toAgentError(requestId: string, message: string, cause?: unknown) {
  return new WritingAgentError({
    message,
    requestId,
    cause: cause instanceof Error ? cause.message : String(cause ?? ''),
  })
}

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

function normalizeToolPath(input: {
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

function assertToolFilePath(input: {
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

function createResourceLoader(input: {
  readonly systemPrompt: string
  readonly appendedPrompts: readonly string[]
}) {
  return {
    getExtensions: () => ({
      extensions: [],
      errors: [],
      runtime: createExtensionRuntime(),
    }),
    getSkills: () => ({ skills: [], diagnostics: [] }),
    getPrompts: () => ({ prompts: [], diagnostics: [] }),
    getThemes: () => ({ themes: [], diagnostics: [] }),
    getAgentsFiles: () => ({ agentsFiles: [] }),
    getSystemPrompt: () => input.systemPrompt,
    getAppendSystemPrompt: () => [...input.appendedPrompts],
    extendResources: () => {},
    reload: async () => {},
  }
}

function extractAssistantText(messages: readonly any[]): string {
  const assistant = [...messages]
    .reverse()
    .find((message) => message?.role === 'assistant')
  if (!assistant?.content || !Array.isArray(assistant.content)) {
    return ''
  }

  return assistant.content
    .filter(
      (part: any) => part?.type === 'text' && typeof part.text === 'string',
    )
    .map((part: any) => part.text)
    .join('')
    .trim()
}

function formatEntryList(
  entries: readonly { path: string; kind: string }[],
  directoryPath: string,
) {
  const normalizedDirectory = normalizeWritingPath(directoryPath)
  const lines = entries
    .filter((entry) => getWritingParentPath(entry.path) === normalizedDirectory)
    .map((entry) => `${entry.kind === 'folder' ? 'dir' : 'file'} ${entry.path}`)

  return lines.length > 0 ? lines.join('\n') : '(empty directory)'
}

function createToolResult(text: string, details?: Record<string, unknown>) {
  return {
    content: [{ type: 'text' as const, text }],
    details: details ?? {},
  }
}

async function countChangeSetChanges(
  db: any,
  changeSetId: string,
): Promise<number> {
  const rows = await db.run(zql.writingChange.where('changeSetId', changeSetId))
  return Array.isArray(rows) ? rows.length : 0
}

export type WritingAgentServiceShape = {
  readonly submitPrompt: (input: {
    readonly projectId: string
    readonly chatId: string
    readonly prompt: string
    readonly userId: string
    readonly organizationId?: string
    readonly modelId?: string
    readonly requestId: string
  }) => Effect.Effect<
    WritingAgentResponse,
    | WritingProjectNotFoundError
    | WritingChatNotFoundError
    | WritingConflictError
    | WritingInvalidRequestError
    | WritingPersistenceError
    | WritingToolExecutionError
    | WritingAgentError
  >
}

export class WritingAgentService extends ServiceMap.Service<
  WritingAgentService,
  WritingAgentServiceShape
>()('writing-backend/WritingAgentService') {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const zeroDatabase = yield* ZeroDatabaseService
      const projects = yield* WritingProjectService
      const workspace = yield* WritingWorkspaceService
      const changeSets = yield* WritingChangeSetService
      const chats = yield* WritingChatService
      const skillRegistry = yield* UserSkillRegistryService

      const submitPrompt: WritingAgentServiceShape['submitPrompt'] = Effect.fn(
        'WritingAgentService.submitPrompt',
      )(
        ({
          projectId,
          chatId,
          prompt,
          userId,
          organizationId,
          modelId,
          requestId,
        }) =>
          zeroDatabase
            .withDatabase((db) =>
              Effect.tryPromise({
                try: async () => {
                  const project = await Effect.runPromise(
                    projects.getProject({
                      projectId,
                      userId,
                      organizationId,
                      requestId,
                    }),
                  )
                  const chat = await getProjectChat({
                    db,
                    chatId,
                    projectId,
                  })
                  if (!chat) {
                    throw new WritingChatNotFoundError({
                      message: 'Writing chat not found',
                      requestId,
                      chatId,
                    })
                  }

                  const { changeSetId } = await Effect.runPromise(
                    changeSets.createChangeSet({
                      projectId,
                      chatId,
                      userId,
                      organizationId,
                      summary:
                        prompt.trim().slice(0, 120) || 'AI writing changes',
                      autoAccept: project.autoAcceptMode,
                      requestId,
                    }),
                  )

                  await Effect.runPromise(
                    chats.appendMessage({
                      projectId,
                      chatId,
                      userId,
                      organizationId,
                      role: 'user',
                      content: prompt,
                      requestId,
                    }),
                  )

                  const instructionFile = await Effect.runPromise(
                    workspace.readFile({
                      projectId,
                      userId,
                      organizationId,
                      path: WRITING_PROJECT_INSTRUCTION_PATH,
                      changeSetId,
                      requestId,
                    }),
                  ).catch(() => ({ content: '' }))

                  const userSkills = await Effect.runPromise(
                    skillRegistry.listUserSkills({
                      userId,
                      requestId,
                    }),
                  )

                  const systemPrompt = [
                    'You are Rift Writing Agent, a markdown-first collaborator for long-form documents.',
                    'You are not in a coding sandbox. You cannot run shell commands or code.',
                    'You work inside a virtual project workspace backed by Rift storage.',
                    'Use the familiar tools to inspect and edit markdown files across the project.',
                    'Prefer small, intentional edits that preserve structure and voice.',
                    'When you change files, use write, edit, or apply_patch so the user can review diffs.',
                    'The workspace only supports folders and markdown files.',
                    instructionFile.content
                      ? `Project instructions:\n${instructionFile.content}`
                      : '',
                  ]
                    .filter(Boolean)
                    .join('\n\n')

                  const appendedPrompts =
                    userSkills.length > 0
                      ? [
                          `Available user-global skills:\n${userSkills
                            .map((skill) => `- ${skill.name}: ${skill.summary}`)
                            .join('\n')}`,
                        ]
                      : []

                  const tools = [
                    defineTool({
                      name: 'ls',
                      label: 'ls',
                      description:
                        'List the immediate files and folders inside a project path.',
                      promptSnippet:
                        'ls(path?) lists the immediate entries in a workspace directory.',
                      parameters: Type.Object({
                        path: Type.Optional(Type.String()),
                      }),
                      async execute(_toolCallId, params) {
                        const targetPath = normalizeToolPath({
                          toolName: 'ls',
                          requestId,
                          path: params.path ?? '/',
                          workspaceRoots: [
                            `/writing/${projectId}`,
                            `/writing-agent/${projectId}`,
                          ],
                        })
                        const entries = await Effect.runPromise(
                          workspace.listEntries({
                            projectId,
                            userId,
                            organizationId,
                            changeSetId,
                            requestId,
                          }),
                        )
                        return createToolResult(
                          formatEntryList(entries, targetPath),
                          {
                            path: targetPath,
                          },
                        )
                      },
                    }),
                    defineTool({
                      name: 'find',
                      label: 'find',
                      description:
                        'Find files or folders by path/name pattern.',
                      promptSnippet:
                        'find(query, path?) searches entry paths inside the project.',
                      parameters: Type.Object({
                        query: Type.String(),
                        path: Type.Optional(Type.String()),
                      }),
                      async execute(_toolCallId, params) {
                        const prefix = params.path
                          ? normalizeToolPath({
                              toolName: 'find',
                              requestId,
                              path: params.path,
                              workspaceRoots: [
                                `/writing/${projectId}`,
                                `/writing-agent/${projectId}`,
                              ],
                            })
                          : undefined
                        const matches = await Effect.runPromise(
                          workspace.findPaths({
                            projectId,
                            userId,
                            organizationId,
                            pattern: params.query,
                            changeSetId,
                            requestId,
                          }),
                        )
                        const filtered = prefix
                          ? matches.filter(
                              (path) =>
                                path === prefix ||
                                path.startsWith(`${prefix}/`),
                            )
                          : matches
                        return createToolResult(
                          filtered.join('\n') || '(no matches)',
                          {
                            count: filtered.length,
                          },
                        )
                      },
                    }),
                    defineTool({
                      name: 'grep',
                      label: 'grep',
                      description:
                        'Search markdown file contents across the project.',
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
                              requestId,
                              path: params.path,
                              workspaceRoots: [
                                `/writing/${projectId}`,
                                `/writing-agent/${projectId}`,
                              ],
                            })
                          : undefined
                        const matches = await Effect.runPromise(
                          workspace.grepProject({
                            projectId,
                            userId,
                            organizationId,
                            pattern: params.pattern,
                            changeSetId,
                            requestId,
                          }),
                        )
                        const filtered = prefix
                          ? matches.filter(
                              (match) =>
                                match.path === prefix ||
                                match.path.startsWith(`${prefix}/`),
                            )
                          : matches
                        return createToolResult(
                          filtered
                            .map(
                              (match) =>
                                `${match.path}:${match.lineNumber} ${match.line}`,
                            )
                            .join('\n') || '(no matches)',
                          { count: filtered.length },
                        )
                      },
                    }),
                    defineTool({
                      name: 'read',
                      label: 'read',
                      description:
                        'Read a markdown file, optionally limited to a line range.',
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
                          requestId,
                          path: params.path,
                          workspaceRoots: [
                            `/writing/${projectId}`,
                            `/writing-agent/${projectId}`,
                          ],
                        })
                        const file = await Effect.runPromise(
                          workspace.readFile({
                            projectId,
                            userId,
                            organizationId,
                            path: normalizedPath,
                            changeSetId,
                            requestId,
                          }),
                        )
                        const lines = file.content.split('\n')
                        const startIndex = Math.max(
                          0,
                          (params.startLine ?? 1) - 1,
                        )
                        const requestedEndLine = params.endLine ?? lines.length
                        const endIndex =
                          requestedEndLine >= (params.startLine ?? 1)
                            ? requestedEndLine
                            : lines.length
                        const text = lines
                          .slice(startIndex, endIndex)
                          .map(
                            (line, offset) =>
                              `${startIndex + offset + 1}: ${line}`,
                          )
                          .join('\n')

                        return createToolResult(text, {
                          path: file.path,
                          lineCount: lines.length,
                        })
                      },
                    }),
                    defineTool({
                      name: 'write',
                      label: 'write',
                      description:
                        'Create or fully replace a markdown file inside the project.',
                      promptSnippet:
                        'write(path, content) stages a full file replacement.',
                      parameters: Type.Object({
                        path: Type.String(),
                        content: Type.String(),
                        createParents: Type.Optional(Type.Boolean()),
                      }),
                      async execute(_toolCallId, params) {
                        const normalizedPath = assertToolFilePath({
                          toolName: 'write',
                          requestId,
                          path: params.path,
                          workspaceRoots: [
                            `/writing/${projectId}`,
                            `/writing-agent/${projectId}`,
                          ],
                        })
                        let current: { readonly entry?: unknown } | null = null
                        try {
                          current = await Effect.runPromise(
                            workspace.readFile({
                              projectId,
                              userId,
                              organizationId,
                              path: normalizedPath,
                              changeSetId,
                              requestId,
                            }),
                          )
                        } catch (error) {
                          if (!(error instanceof WritingInvalidRequestError)) {
                            throw error
                          }
                        }

                        const operation = current?.entry ? 'update' : 'create'
                        const result = await Effect.runPromise(
                          changeSets.upsertFileChange({
                            changeSetId,
                            userId,
                            organizationId,
                            path: normalizedPath,
                            operation,
                            proposedContent: params.content,
                            requestId,
                          }),
                        )

                        return createToolResult(
                          `Staged ${operation} for ${normalizedPath} (${result.hunkCount} hunks).`,
                          result,
                        )
                      },
                    }),
                    defineTool({
                      name: 'edit',
                      label: 'edit',
                      description:
                        'Apply exact text replacements to a markdown file.',
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
                          requestId,
                          path: params.path,
                          workspaceRoots: [
                            `/writing/${projectId}`,
                            `/writing-agent/${projectId}`,
                          ],
                        })
                        const current = await Effect.runPromise(
                          workspace.readFile({
                            projectId,
                            userId,
                            organizationId,
                            path: normalizedPath,
                            changeSetId,
                            requestId,
                          }),
                        )

                        let nextContent = current.content
                        for (const edit of params.edits) {
                          if (!nextContent.includes(edit.oldText)) {
                            throw new WritingToolExecutionError({
                              message: `edit could not find the expected text in ${normalizedPath}`,
                              requestId,
                              toolName: 'edit',
                            })
                          }
                          nextContent = nextContent.replace(
                            edit.oldText,
                            edit.newText,
                          )
                        }

                        const result = await Effect.runPromise(
                          changeSets.upsertFileChange({
                            changeSetId,
                            userId,
                            organizationId,
                            path: normalizedPath,
                            operation: 'update',
                            proposedContent: nextContent,
                            requestId,
                          }),
                        )

                        return createToolResult(
                          `Staged update for ${normalizedPath} (${result.hunkCount} hunks).`,
                          result,
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
                          throw toToolExecutionError(
                            requestId,
                            'apply_patch',
                            'apply_patch could not parse the provided patch',
                            error,
                          )
                        }
                        let appliedCount = 0

                        for (const operation of operations) {
                          const normalizedPath = assertToolFilePath({
                            toolName: 'apply_patch',
                            requestId,
                            path: operation.path,
                            workspaceRoots: [
                              `/writing/${projectId}`,
                              `/writing-agent/${projectId}`,
                            ],
                          })
                          if (operation.kind === 'delete') {
                            await Effect.runPromise(
                              changeSets.upsertFileChange({
                                changeSetId,
                                userId,
                                organizationId,
                                path: normalizedPath,
                                operation: 'delete',
                                requestId,
                              }),
                            )
                            appliedCount += 1
                            continue
                          }

                          if (operation.kind === 'add') {
                            await Effect.runPromise(
                              changeSets.upsertFileChange({
                                changeSetId,
                                userId,
                                organizationId,
                                path: normalizedPath,
                                operation: 'create',
                                proposedContent: operation.content,
                                requestId,
                              }),
                            )
                            appliedCount += 1
                            continue
                          }

                          const current = await Effect.runPromise(
                            workspace.readFile({
                              projectId,
                              userId,
                              organizationId,
                              path: normalizedPath,
                              changeSetId,
                              requestId,
                            }),
                          )
                          const nextContent = applyWritingPatchToContent({
                            path: normalizedPath,
                            currentContent: current.content,
                            patch: operation.patch,
                          })
                          await Effect.runPromise(
                            changeSets.upsertFileChange({
                              changeSetId,
                              userId,
                              organizationId,
                              path: normalizedPath,
                              operation: current.entry ? 'update' : 'create',
                              proposedContent: nextContent,
                              requestId,
                            }),
                          )
                          appliedCount += 1
                        }

                        return createToolResult(
                          `Staged ${appliedCount} patch operation(s).`,
                          {
                            count: appliedCount,
                          },
                        )
                      },
                    }),
                  ] satisfies ToolDefinition[]

                  const { provider, modelName, raw } =
                    resolveWritingRuntimeModelTarget({
                      requestedModelId: modelId,
                      persistedModelId: chat.modelId,
                      gatewayApiKey: process.env.AI_GATEWAY_API_KEY,
                    })
                  const model = getModel(provider as any, modelName)
                  if (!model) {
                    throw toAgentError(
                      requestId,
                      `Unsupported writing model "${raw}"`,
                    )
                  }

                  const authStorage = AuthStorage.inMemory()
                  const runtimeKey = getEnvApiKey(provider as any)
                  if (runtimeKey) {
                    authStorage.setRuntimeApiKey(provider, runtimeKey)
                  }

                  const { session } = await createAgentSession({
                    cwd: `/writing/${projectId}`,
                    agentDir: `/writing-agent/${projectId}`,
                    authStorage,
                    model,
                    thinkingLevel: 'low',
                    sessionManager: SessionManager.inMemory(),
                    settingsManager: SettingsManager.inMemory({
                      compaction: { enabled: false },
                      retry: { enabled: true, maxRetries: 1 },
                    }),
                    tools: [],
                    customTools: tools,
                    resourceLoader: createResourceLoader({
                      systemPrompt,
                      appendedPrompts,
                    }),
                  })
                  session.setActiveToolsByName(tools.map((tool) => tool.name))

                  await session.prompt(prompt)

                  const assistantMessage = extractAssistantText(
                    session.messages,
                  )
                  const changeCount = await countChangeSetChanges(
                    db,
                    changeSetId,
                  )
                  const hasPendingChanges = changeCount > 0

                  const { messageId: assistantMessageId } =
                    await Effect.runPromise(
                      chats.appendMessage({
                        projectId,
                        chatId,
                        userId,
                        organizationId,
                        role: 'assistant',
                        content:
                          assistantMessage ||
                          (hasPendingChanges
                            ? 'I prepared changes for review in the writing workspace.'
                            : 'I reviewed the workspace and did not stage any file edits.'),
                        changeSetId: hasPendingChanges
                          ? changeSetId
                          : undefined,
                        requestId,
                      }),
                    )

                  if (!hasPendingChanges) {
                    await Effect.runPromise(
                      changeSets.discardChangeSet({
                        changeSetId,
                        userId,
                        organizationId,
                        requestId,
                      }),
                    )
                    return {
                      chatId,
                      assistantMessageId,
                      assistantMessage:
                        assistantMessage ||
                        'I reviewed the workspace and did not stage any file edits.',
                    }
                  }

                  await Effect.runPromise(
                    changeSets.attachAssistantMessage({
                      changeSetId,
                      assistantMessageId,
                      userId,
                      organizationId,
                      requestId,
                    }),
                  )

                  const autoApplied = project.autoAcceptMode
                    ? await Effect.runPromise(
                        changeSets.applyChangeSet({
                          changeSetId,
                          userId,
                          organizationId,
                          requestId,
                        }),
                      )
                    : undefined

                  return {
                    chatId,
                    assistantMessageId,
                    assistantMessage:
                      assistantMessage ||
                      'I prepared changes for review in the writing workspace.',
                    changeSetId,
                    headSnapshotId: autoApplied?.headSnapshotId,
                  }
                },
                catch: (error) => {
                  if (
                    error instanceof WritingProjectNotFoundError ||
                    error instanceof WritingChatNotFoundError ||
                    error instanceof WritingConflictError ||
                    error instanceof WritingInvalidRequestError ||
                    error instanceof WritingPersistenceError ||
                    error instanceof WritingToolExecutionError ||
                    error instanceof WritingAgentError
                  ) {
                    return error
                  }
                  return toAgentError(
                    requestId,
                    'Failed to run the writing agent',
                    error,
                  )
                },
              }),
            )
            .pipe(
              Effect.mapError((error) =>
                error instanceof ZeroDatabaseNotConfiguredError
                  ? toPersistenceError(
                      requestId,
                      'Writing storage is unavailable',
                      error,
                    )
                  : error,
              ),
            ),
      )

      return {
        submitPrompt,
      }
    }),
  )
}
