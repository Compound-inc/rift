import { Effect, Layer, ServiceMap } from 'effect'
import { AgentConversationService } from '@/lib/backend/agent'
import {
  WRITING_DEFAULT_MODEL_ID,
} from '@/lib/shared/writing/constants'
import {
  WritingPersistenceError,
  WritingProjectNotFoundError,
} from '../domain/errors'
import { WritingProjectService } from './project.service'

function toPersistenceError(requestId: string, message: string, cause?: unknown) {
  return new WritingPersistenceError({
    message,
    requestId,
    cause: cause instanceof Error ? cause.message : String(cause ?? ''),
  })
}

export type WritingConversationServiceShape = {
  readonly createProjectConversation: (input: {
    readonly projectId: string
    readonly userId: string
    readonly organizationId?: string
    readonly title?: string
    readonly modelId?: string
    readonly requestId: string
  }) => Effect.Effect<
    { readonly conversationId: string },
    WritingProjectNotFoundError | WritingPersistenceError
  >
}

export class WritingConversationService extends ServiceMap.Service<
  WritingConversationService,
  WritingConversationServiceShape
>()('writing-backend/WritingConversationService') {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const projects = yield* WritingProjectService
      const conversations = yield* AgentConversationService

      return {
        createProjectConversation: Effect.fn(
          'WritingConversationService.createProjectConversation',
        )(({ projectId, userId, organizationId, title, modelId, requestId }) =>
          Effect.gen(function* () {
            yield* projects.getProject({
              projectId,
              userId,
              organizationId,
              requestId,
            })

            const conversation = yield* conversations.createConversation({
              product: 'writing',
              scopeType: 'writing_project',
              scopeId: projectId,
              ownerUserId: userId,
              ownerOrgId: organizationId,
              title: title?.trim() || 'New chat',
              defaultModelId: modelId?.trim() || WRITING_DEFAULT_MODEL_ID,
              metadataJson: {},
            }).pipe(
              Effect.mapError((error) =>
                toPersistenceError(
                  requestId,
                  'Failed to create writing conversation',
                  error,
                ),
              ),
            )

            return {
              conversationId: conversation.id,
            }
          }),
        ),
      }
    }),
  )
}
