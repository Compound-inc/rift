import { Effect, Layer, ServiceMap } from 'effect'
import {
  AuthStorage,
  SessionManager,
  SettingsManager,
  createAgentSession,
} from '@mariozechner/pi-coding-agent'
import { getEnvApiKey, getModel } from '@mariozechner/pi-ai'
import {
  ZeroDatabaseNotConfiguredError,
  ZeroDatabaseService,
} from '@/lib/backend/server-effect/services/zero-database.service'
import { zql } from '@/lib/backend/chat/infra/zero/db'
import { WRITING_PROJECT_INSTRUCTION_PATH } from '@/lib/shared/writing/constants'
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
import { UserSkillRegistryService } from '../services/skill-registry.service'
import { WritingChangeSetService } from '../services/change-set.service'
import { WritingChatService } from '../services/chat.service'
import { WritingProjectService } from '../services/project.service'
import { WritingWorkspaceService } from '../services/workspace.service'
import { getProjectChat } from '../services/persistence'
import {
  createResourceLoader,
  extractAssistantText,
} from './resource-loader'
import { buildWritingAgentTools } from './tools/custom-tools'

export { normalizeWritingAgentToolPath } from './tools/tool-paths'

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

                  const tools = buildWritingAgentTools({
                    projectId,
                    changeSetId,
                    userId,
                    organizationId,
                    requestId,
                    workspace,
                    changeSets,
                  })

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
