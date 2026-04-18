import { Effect } from 'effect'
import { WritingChatService, WritingProjectService } from '@/lib/backend/writing'
import { runWritingAction } from './server-action.server'

export * from './tool/writing-tool.server'

export async function createWritingProjectAction(input: {
  readonly title: string
  readonly description?: string
}) {
  return runWritingAction({
    operation: 'createWritingProject',
    defaultMessage: 'Failed to create writing project',
    program: (auth) =>
      Effect.gen(function* () {
        const service = yield* WritingProjectService
        return yield* service.createProject({
          userId: auth.userId,
          organizationId: auth.organizationId,
          title: input.title,
          description: input.description,
          requestId: auth.requestId,
        })
      }),
  })
}

export async function renameWritingProjectAction(input: {
  readonly projectId: string
  readonly title: string
}) {
  return runWritingAction({
    operation: 'renameWritingProject',
    defaultMessage: 'Failed to rename writing project',
    program: (auth) =>
      Effect.gen(function* () {
        const service = yield* WritingProjectService
        return yield* service.renameProject({
          projectId: input.projectId,
          userId: auth.userId,
          organizationId: auth.organizationId,
          title: input.title,
          requestId: auth.requestId,
        })
      }),
  })
}

export async function setWritingAutoAcceptModeAction(input: {
  readonly projectId: string
  readonly enabled: boolean
}) {
  return runWritingAction({
    operation: 'setWritingAutoAcceptMode',
    defaultMessage: 'Failed to update writing auto-accept mode',
    program: (auth) =>
      Effect.gen(function* () {
        const service = yield* WritingProjectService
        return yield* service.setAutoAcceptMode({
          projectId: input.projectId,
          userId: auth.userId,
          organizationId: auth.organizationId,
          enabled: input.enabled,
          requestId: auth.requestId,
        })
      }),
  })
}

export async function createWritingChatAction(input: {
  readonly projectId: string
  readonly title?: string
  readonly modelId?: string
}) {
  return runWritingAction({
    operation: 'createWritingChat',
    defaultMessage: 'Failed to create writing chat',
    program: (auth) =>
      Effect.gen(function* () {
        const service = yield* WritingChatService
        return yield* service.createProjectChat({
          projectId: input.projectId,
          userId: auth.userId,
          organizationId: auth.organizationId,
          title: input.title,
          modelId: input.modelId,
          requestId: auth.requestId,
        })
      }),
  })
}
