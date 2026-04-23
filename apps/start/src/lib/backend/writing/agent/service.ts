import { PgClient } from '@effect/sql-pg'
import { Effect, Layer, ServiceMap } from 'effect'
import type { AgentSessionEvent } from '@mariozechner/pi-coding-agent'
import {
  AuthStorage,
  SettingsManager,
  createAgentSession,
} from '@mariozechner/pi-coding-agent'
import {
  getEnvApiKey,
  getModel,
} from '@mariozechner/pi-ai'
import type {
  ToolResultMessage,
  UserMessage,
} from '@mariozechner/pi-ai'
import {
  AgentSseBridge,
  AgentTurnEnvelopeBuilder,
  AgentTurnStore,
  convertAgentMessageToEnvelope,
} from '@/lib/backend/agent'
import type {
  AgentLiveEvent,
  AgentMessageEnvelope,
  AgentMessagePart,
  AgentTurnEnvelope,
} from '@/lib/shared/agent'
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
import { WritingAgentSessionService } from '../services/agent-session.service'
import { WritingChangeSetService } from '../services/change-set.service'
import {
  countWritingChangesByChangeSetSql,
  getProjectConversationSql,
  now,
} from '../services/persistence'
import { WritingProjectService } from '../services/project.service'
import { UserSkillRegistryService } from '../services/skill-registry.service'
import { WritingWorkspaceService } from '../services/workspace.service'
import { serializePiSession, withPiSessionManager } from './pi-session'
import {
  createResourceLoader,
  extractAssistantText,
} from './resource-loader'
import { buildWritingAgentTools } from './tools/custom-tools'

export { normalizeWritingAgentToolPath } from './tools/tool-paths'

type WritingAgentStreamResult = {
  readonly stream: ReadableStream<Uint8Array>
  readonly turnId: string
  readonly conversationId: string
}

function toAgentError(requestId: string, message: string, cause?: unknown) {
  return new WritingAgentError({
    message,
    requestId,
    cause: cause instanceof Error ? cause.message : String(cause ?? ''),
  })
}

function createUserMessageEnvelope(input: {
  readonly turnId: string
  readonly prompt: string
  readonly timestamp: number
}): AgentMessageEnvelope {
  return {
    id: `${input.turnId}:user:0`,
    role: 'user',
    parts: [
      {
        type: 'text',
        text: input.prompt,
      },
    ],
    createdAt: input.timestamp,
  }
}

function createInitialTurnEnvelope(input: {
  readonly turnId: string
  readonly conversation: {
    readonly id: string
    readonly product: string
    readonly scopeType: string
    readonly scopeId: string
  }
  readonly startedAt: number
  readonly userMessage: AgentMessageEnvelope
}): AgentTurnEnvelope {
  return {
    version: 'pi_turn_v1',
    runtime: 'pi',
    conversation: input.conversation,
    turnId: input.turnId,
    turnIndex: 0,
    messages: [input.userMessage],
    toolCalls: [],
    toolResults: [],
    liveEventLog: [],
    stateTransitions: [
      {
        status: 'pending',
        timestamp: input.startedAt,
      },
    ],
    startedAt: input.startedAt,
    finalStatus: 'pending',
  }
}

function toolResultPartsFromPiResult(
  result: ToolResultMessage['content'],
): readonly AgentMessagePart[] {
  return result.map((part) =>
    part.type === 'image'
      ? {
          type: 'image',
          data: part.data,
          mimeType: part.mimeType,
        }
      : ({
          type: 'text',
          text: part.text,
        } satisfies Extract<AgentMessagePart, { type: 'text' }>),
  )
}

function normalizeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }

  return 'Writing agent failed unexpectedly'
}

export type WritingAgentServiceShape = {
  readonly streamPrompt: (input: {
    readonly projectId: string
    readonly conversationId: string
    readonly prompt: string
    readonly userId: string
    readonly organizationId?: string
    readonly modelId?: string
    readonly requestId: string
  }) => Effect.Effect<
    WritingAgentStreamResult,
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
      const sql = yield* PgClient.PgClient
      const projects = yield* WritingProjectService
      const workspace = yield* WritingWorkspaceService
      const changeSets = yield* WritingChangeSetService
      const agentSessions = yield* WritingAgentSessionService
      const skillRegistry = yield* UserSkillRegistryService
      const turnStore = yield* AgentTurnStore
      const sseBridge = yield* AgentSseBridge

      const streamPrompt: WritingAgentServiceShape['streamPrompt'] = Effect.fn(
        'WritingAgentService.streamPrompt',
      )(
        ({
          projectId,
          conversationId,
          prompt,
          userId,
          organizationId,
          modelId,
          requestId,
        }) =>
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

              const conversation = await Effect.runPromise(
                getProjectConversationSql({
                  conversationId,
                  projectId,
                }).pipe(Effect.provideService(PgClient.PgClient, sql)),
              )
              if (!conversation) {
                throw new WritingChatNotFoundError({
                  message: 'Writing conversation not found',
                  requestId,
                  chatId: conversationId,
                })
              }

              const persistedSession = await Effect.runPromise(
                agentSessions.loadConversationSession({
                  projectId,
                  conversationId,
                  userId,
                  organizationId,
                  requestId,
                }),
              )

              const instructionFile = await Effect.runPromise(
                workspace.readFile({
                  projectId,
                  userId,
                  organizationId,
                  path: WRITING_PROJECT_INSTRUCTION_PATH,
                  requestId,
                }),
              ).catch(() => ({ content: '' }))

              const userSkills = await Effect.runPromise(
                skillRegistry.listUserSkills({
                  userId,
                  requestId,
                }),
              )

              const { changeSetId } = await Effect.runPromise(
                changeSets.createChangeSet({
                  projectId,
                  conversationId,
                  userId,
                  organizationId,
                  summary: 'Pending AI writing changes',
                  autoAccept: project.autoAcceptMode,
                  requestId,
                }),
              )

              const startedAt = now()
              const turnId = crypto.randomUUID()
              const userMessage = createUserMessageEnvelope({
                turnId,
                prompt,
                timestamp: startedAt,
              })

              const initialTurn = await Effect.runPromise(
                turnStore.createPendingTurn({
                  conversation,
                  requestId,
                  modelId: modelId?.trim() || conversation.defaultModelId,
                  providerId: undefined,
                  changeSetId,
                  turnJson: createInitialTurnEnvelope({
                    turnId,
                    conversation: {
                      id: conversation.id,
                      product: conversation.product,
                      scopeType: conversation.scopeType,
                      scopeId: conversation.scopeId,
                    },
                    startedAt,
                    userMessage,
                  }),
                }),
              )

                  const builder = new AgentTurnEnvelopeBuilder({
                    conversation,
                    turnId,
                    turnIndex: initialTurn.turnIndex,
                    startedAt,
                  })
                  const initialUserMessage: UserMessage = {
                    role: 'user',
                    content: prompt,
                    timestamp: startedAt,
                  }
                  builder.syncMessages([initialUserMessage])
                  builder.transition('streaming', startedAt)

                  await Effect.runPromise(
                    turnStore.checkpointTurn({
                      conversation,
                      turnId,
                      status: 'streaming',
                      turnJson: builder.snapshot,
                      userMessageId: userMessage.id,
                    }),
                  )

                  const systemPrompt = [
                    'You are Rift Writing Agent, a markdown-first collaborator for long-form documents.',
                    'You work inside a virtual project workspace backed by Rift storage.',
                    'Use the provided tools to inspect and edit markdown files across the project.',
                    'Prefer small, intentional edits that preserve structure and voice.',
                    'When you change files, use the writing tools so the user can review diffs.',
                    'The workspace only supports folders and markdown files.',
                    'Treat /agents.md as workspace instructions, not manuscript content.',
                    'Prefer storing manuscript drafts inside top-level section folders instead of the project root.',
                    'Use numeric prefixes in folder, subfolder, and file names as the source of truth for manuscript order.',
                    'Prefer names such as /01.-mechanics/01-intro.md and /01.-mechanics/02.-advanced/01-details.md.',
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
                      persistedModelId: conversation.defaultModelId,
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

                  const bridge = sseBridge.createStream()

                  queueMicrotask(() => {
                    let sequence = 0
                    let activeAssistantIndex = 0
                    let currentAssistantIndex = 0
                    const toolResultCounts = new Map<string, number>()
                    const emit = (event: Omit<AgentLiveEvent, 'sequence'>) => {
                      const nextEvent: AgentLiveEvent = {
                        ...event,
                        sequence,
                      }
                      sequence += 1
                      builder.pushEvent(nextEvent)
                      bridge.emit(nextEvent)
                    }

                    const checkpoint = async (
                      status: 'streaming' | 'completed' | 'failed' | 'aborted',
                      input?: {
                        readonly assistantMessageId?: string
                        readonly errorJson?: Record<string, unknown>
                      },
                    ) => {
                      if (status === 'completed' || status === 'failed' || status === 'aborted') {
                        await Effect.runPromise(
                          turnStore.completeTurn({
                            conversation,
                            turnId,
                            status,
                            turnJson: builder.snapshot,
                            errorJson: input?.errorJson,
                            userMessageId: userMessage.id,
                            assistantMessageId: input?.assistantMessageId,
                          }),
                        )
                        return
                      }

                      await Effect.runPromise(
                        turnStore.checkpointTurn({
                          conversation,
                          turnId,
                          status,
                          turnJson: builder.snapshot,
                          userMessageId: userMessage.id,
                          assistantMessageId: input?.assistantMessageId,
                        }),
                      )
                    }

                    const handleFailure = async (error: unknown) => {
                      const timestamp = now()
                      const message = normalizeErrorMessage(error)
                      builder.transition('failed', timestamp)
                      emit({
                        type: 'turn_failed',
                        conversationId,
                        turnId,
                        timestamp,
                        payload: {
                          message,
                        },
                      })

                      await checkpoint('failed', {
                        errorJson: {
                          message,
                        },
                      }).catch(() => undefined)

                      await Effect.runPromise(
                        changeSets.discardChangeSet({
                          changeSetId,
                          userId,
                          organizationId,
                          requestId,
                        }),
                      ).catch(() => undefined)

                      bridge.close()
                    }

                    void (async () => {
                      emit({
                        type: 'turn_started',
                        conversationId,
                        turnId,
                        timestamp: startedAt,
                        payload: {
                          userMessage,
                          requestId,
                        },
                      })

                      try {
                        await withPiSessionManager({
                          chatId: conversationId,
                          sessionJsonl: persistedSession?.sessionJson,
                          run: async (sessionManager) => {
                            const { session } = await createAgentSession({
                              cwd: `/writing/${projectId}`,
                              agentDir: `/writing-agent/${projectId}`,
                              authStorage,
                              model,
                              thinkingLevel: 'low',
                              sessionManager,
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
                            const initialMessageCount = session.messages.length

                            const unsubscribe = session.subscribe((event: AgentSessionEvent) => {
                              const timestamp = now()

                              if (
                                event.type === 'message_start' &&
                                event.message.role === 'assistant'
                              ) {
                                activeAssistantIndex = currentAssistantIndex
                                currentAssistantIndex += 1
                                const message = convertAgentMessageToEnvelope({
                                  turnId,
                                  roleIndex: activeAssistantIndex,
                                  message: event.message,
                                })

                                if (message) {
                                  emit({
                                    type: 'message_started',
                                    conversationId,
                                    turnId,
                                    timestamp,
                                    payload: {
                                      messageId: message.id,
                                      message,
                                      status: 'streaming',
                                    },
                                  })
                                }
                                return
                              }

                              if (
                                event.type === 'message_update' &&
                                event.message.role === 'assistant'
                              ) {
                                const message = convertAgentMessageToEnvelope({
                                  turnId,
                                  roleIndex: activeAssistantIndex,
                                  message: event.message,
                                })

                                emit({
                                  type: 'message_updated',
                                  conversationId,
                                  turnId,
                                  timestamp,
                                  payload: {
                                    messageId: message?.id,
                                    message,
                                    status: 'streaming',
                                    deltaType:
                                      event.assistantMessageEvent.type === 'thinking_delta'
                                        ? 'thinking'
                                        : event.assistantMessageEvent.type ===
                                              'toolcall_delta'
                                          ? 'tool_call'
                                          : 'text',
                                    delta:
                                      'delta' in event.assistantMessageEvent
                                        ? event.assistantMessageEvent.delta
                                        : '',
                                  },
                                })
                                return
                              }

                              if (
                                event.type === 'message_end' &&
                                event.message.role === 'assistant'
                              ) {
                                const message = convertAgentMessageToEnvelope({
                                  turnId,
                                  roleIndex: activeAssistantIndex,
                                  message: event.message,
                                })

                                emit({
                                  type: 'message_completed',
                                  conversationId,
                                  turnId,
                                  timestamp,
                                  payload: {
                                    messageId: message?.id,
                                    message,
                                    status: 'streaming',
                                  },
                                })
                                return
                              }

                              if (event.type === 'tool_execution_start') {
                                emit({
                                  type: 'tool_execution_started',
                                  conversationId,
                                  turnId,
                                  timestamp,
                                  payload: {
                                    toolCallId: event.toolCallId,
                                    toolName: event.toolName,
                                    args: event.args,
                                  },
                                })
                                return
                              }

                              if (event.type === 'tool_execution_update') {
                                emit({
                                  type: 'tool_execution_updated',
                                  conversationId,
                                  turnId,
                                  timestamp,
                                  payload: {
                                    toolCallId: event.toolCallId,
                                    toolName: event.toolName,
                                    args: event.args,
                                    partialResult: event.partialResult,
                                  },
                                })
                                return
                              }

                              if (event.type === 'tool_execution_end') {
                                emit({
                                  type: 'tool_execution_completed',
                                  conversationId,
                                  turnId,
                                  timestamp,
                                  payload: {
                                    toolCallId: event.toolCallId,
                                    toolName: event.toolName,
                                    result: event.result,
                                    isError: event.isError,
                                  },
                                })

                                const roleIndex =
                                  toolResultCounts.get(event.toolCallId) ?? 0
                                toolResultCounts.set(event.toolCallId, roleIndex + 1)

                                const toolResultMessage: AgentMessageEnvelope = {
                                  id: `${turnId}:tool_result:${event.toolCallId}:${roleIndex}`,
                                  role: 'tool_result',
                                  parts: toolResultPartsFromPiResult(
                                    (event.result?.content ??
                                      []) as ToolResultMessage['content'],
                                  ),
                                  createdAt: timestamp,
                                  toolCallId: event.toolCallId,
                                  toolName: event.toolName,
                                  isError: Boolean(event.isError),
                                }

                                emit({
                                  type: 'tool_result_completed',
                                  conversationId,
                                  turnId,
                                  timestamp,
                                  payload: {
                                    toolCallId: event.toolCallId,
                                    toolName: event.toolName,
                                    isError: event.isError,
                                    message: toolResultMessage,
                                    status: 'streaming',
                                  },
                                })
                              }
                            })

                            try {
                              await session.prompt(prompt)
                            } finally {
                              unsubscribe()
                              await Effect.runPromise(
                                agentSessions.saveConversationSession({
                                  projectId,
                                  conversationId,
                                  userId,
                                  organizationId,
                                  sessionJson: serializePiSession(
                                    session.sessionManager,
                                  ),
                                  requestId,
                                }),
                              )
                            }

                            const promptMessages = session.messages.slice(initialMessageCount)
                            builder.syncMessages(promptMessages)

                            const assistantMessage = extractAssistantText(promptMessages)
                            const hasPendingChanges =
                              (await Effect.runPromise(
                                countWritingChangesByChangeSetSql(changeSetId).pipe(
                                  Effect.provideService(PgClient.PgClient, sql),
                                ),
                              )) > 0

                            const finalAssistantMessage = [...builder.snapshot.messages]
                              .reverse()
                              .find((message) => message.role === 'assistant')

                            if (!hasPendingChanges) {
                              await Effect.runPromise(
                                changeSets.discardChangeSet({
                                  changeSetId,
                                  userId,
                                  organizationId,
                                  requestId,
                                }),
                              )
                            } else if (finalAssistantMessage) {
                              await Effect.runPromise(
                                changeSets.attachAssistantMessage({
                                  changeSetId,
                                  assistantMessageId: finalAssistantMessage.id,
                                  userId,
                                  organizationId,
                                  requestId,
                                }),
                              )
                            }

                            let autoAppliedHeadSnapshotId: string | undefined
                            if (hasPendingChanges && project.autoAcceptMode) {
                              const autoApplied = await Effect.runPromise(
                                changeSets.applyChangeSet({
                                  changeSetId,
                                  userId,
                                  organizationId,
                                  requestId,
                                }),
                              )
                              autoAppliedHeadSnapshotId = autoApplied.headSnapshotId
                            }

                            const completedAt = now()
                            builder.transition('completed', completedAt)

                            emit({
                              type: 'turn_checkpoint',
                              conversationId,
                              turnId,
                              timestamp: completedAt,
                              payload: {
                                assistantMessage:
                                  assistantMessage ||
                                  (hasPendingChanges
                                    ? 'I prepared changes for review in the writing workspace.'
                                    : 'I reviewed the workspace and did not stage any file edits.'),
                                changeSetId: hasPendingChanges
                                  ? changeSetId
                                  : undefined,
                              },
                            })

                            await checkpoint('completed', {
                              assistantMessageId: finalAssistantMessage?.id,
                            })

                            emit({
                              type: 'turn_completed',
                              conversationId,
                              turnId,
                              timestamp: completedAt,
                              payload: {
                                envelope: builder.snapshot,
                                assistantMessageId: finalAssistantMessage?.id,
                                changeSetId: hasPendingChanges
                                  ? changeSetId
                                  : undefined,
                                headSnapshotId: autoAppliedHeadSnapshotId,
                              },
                            })
                          },
                        })

                        bridge.close()
                      } catch (error) {
                        await handleFailure(error)
                      }
                    })()
                  })

              return {
                stream: bridge.stream,
                turnId,
                conversationId,
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
                'Failed to start the writing agent stream',
                error,
              )
            },
          }),
      )

      return {
        streamPrompt,
      }
    }),
  )
}
