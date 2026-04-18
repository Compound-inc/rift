import { Effect } from 'effect'
import {
  handleWritingServerActionFailure,
  WritingAgentService,
  WritingChangeSetService,
  WritingChatService,
  WritingProjectService,
  WritingRuntime,
  WritingSnapshotService,
  WritingUnauthorizedError,
  WritingWorkspaceService,
} from '@/lib/backend/writing'
import {
  runAuthenticatedServerAction,
  type AuthenticatedServerActionContext,
} from '@/lib/backend/server-effect'

type WritingActionAuth = AuthenticatedServerActionContext

async function runWritingAction<T>(input: {
  readonly operation: string
  readonly defaultMessage: string
  readonly program: (auth: WritingActionAuth) => Effect.Effect<T, unknown, any>
}) {
  return runAuthenticatedServerAction({
    runtime: WritingRuntime,
    onUnauthorized: (requestId) =>
      new WritingUnauthorizedError({
        message: 'Unauthorized',
        requestId,
      }),
    onFailure: ({ error, requestId, userId, organizationId }) =>
      handleWritingServerActionFailure({
        error,
        operation: input.operation,
        defaultMessage: input.defaultMessage,
        requestId,
        userId,
        organizationId,
      }),
    program: input.program,
  })
}

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

export async function readWritingFileAction(input: {
  readonly projectId: string
  readonly path: string
  readonly changeSetId?: string
}) {
  return runWritingAction({
    operation: 'readWritingFile',
    defaultMessage: 'Failed to read writing file',
    program: (auth) =>
      Effect.gen(function* () {
        const service = yield* WritingWorkspaceService
        return yield* service.readFile({
          projectId: input.projectId,
          userId: auth.userId,
          organizationId: auth.organizationId,
          path: input.path,
          changeSetId: input.changeSetId,
          requestId: auth.requestId,
        })
      }),
  })
}

export async function manualSaveWritingFileAction(input: {
  readonly projectId: string
  readonly path: string
  readonly content: string
  readonly expectedHeadSnapshotId?: string
  readonly summary?: string
}) {
  return runWritingAction({
    operation: 'manualSaveWritingFile',
    defaultMessage: 'Failed to save writing file',
    program: (auth) =>
      Effect.gen(function* () {
        const service = yield* WritingSnapshotService
        return yield* service.manualSaveFile({
          projectId: input.projectId,
          userId: auth.userId,
          organizationId: auth.organizationId,
          path: input.path,
          content: input.content,
          expectedHeadSnapshotId: input.expectedHeadSnapshotId,
          summary: input.summary,
          requestId: auth.requestId,
        })
      }),
  })
}

export async function createWritingFolderAction(input: {
  readonly projectId: string
  readonly path: string
  readonly expectedHeadSnapshotId?: string
}) {
  return runWritingAction({
    operation: 'createWritingFolder',
    defaultMessage: 'Failed to create writing folder',
    program: (auth) =>
      Effect.gen(function* () {
        const service = yield* WritingSnapshotService
        return yield* service.createFolder({
          projectId: input.projectId,
          userId: auth.userId,
          organizationId: auth.organizationId,
          path: input.path,
          expectedHeadSnapshotId: input.expectedHeadSnapshotId,
          requestId: auth.requestId,
        })
      }),
  })
}

export async function createWritingCheckpointAction(input: {
  readonly projectId: string
  readonly summary: string
}) {
  return runWritingAction({
    operation: 'createWritingCheckpoint',
    defaultMessage: 'Failed to create writing checkpoint',
    program: (auth) =>
      Effect.gen(function* () {
        const service = yield* WritingSnapshotService
        return yield* service.createCheckpoint({
          projectId: input.projectId,
          userId: auth.userId,
          organizationId: auth.organizationId,
          summary: input.summary,
          requestId: auth.requestId,
        })
      }),
  })
}

export async function restoreWritingCheckpointAction(input: {
  readonly projectId: string
  readonly snapshotId: string
  readonly expectedHeadSnapshotId?: string
}) {
  return runWritingAction({
    operation: 'restoreWritingCheckpoint',
    defaultMessage: 'Failed to restore writing checkpoint',
    program: (auth) =>
      Effect.gen(function* () {
        const service = yield* WritingSnapshotService
        return yield* service.restoreSnapshot({
          projectId: input.projectId,
          snapshotId: input.snapshotId,
          userId: auth.userId,
          organizationId: auth.organizationId,
          expectedHeadSnapshotId: input.expectedHeadSnapshotId,
          requestId: auth.requestId,
        })
      }),
  })
}

export async function acceptWritingHunksAction(input: {
  readonly changeSetId: string
  readonly hunkIds: readonly string[]
}) {
  return runWritingAction({
    operation: 'acceptWritingHunks',
    defaultMessage: 'Failed to accept writing hunks',
    program: (auth) =>
      Effect.gen(function* () {
        const service = yield* WritingChangeSetService
        return yield* service.acceptHunks({
          changeSetId: input.changeSetId,
          hunkIds: input.hunkIds,
          userId: auth.userId,
          organizationId: auth.organizationId,
          requestId: auth.requestId,
        })
      }),
  })
}

export async function rejectWritingHunksAction(input: {
  readonly changeSetId: string
  readonly hunkIds: readonly string[]
}) {
  return runWritingAction({
    operation: 'rejectWritingHunks',
    defaultMessage: 'Failed to reject writing hunks',
    program: (auth) =>
      Effect.gen(function* () {
        const service = yield* WritingChangeSetService
        return yield* service.rejectHunks({
          changeSetId: input.changeSetId,
          hunkIds: input.hunkIds,
          userId: auth.userId,
          organizationId: auth.organizationId,
          requestId: auth.requestId,
        })
      }),
  })
}

export async function discardWritingChangeSetAction(input: {
  readonly changeSetId: string
}) {
  return runWritingAction({
    operation: 'discardWritingChangeSet',
    defaultMessage: 'Failed to discard writing change set',
    program: (auth) =>
      Effect.gen(function* () {
        const service = yield* WritingChangeSetService
        return yield* service.discardChangeSet({
          changeSetId: input.changeSetId,
          userId: auth.userId,
          organizationId: auth.organizationId,
          requestId: auth.requestId,
        })
      }),
  })
}

export async function submitWritingPromptAction(input: {
  readonly projectId: string
  readonly chatId: string
  readonly prompt: string
  readonly modelId?: string
}) {
  return runWritingAction({
    operation: 'submitWritingPrompt',
    defaultMessage: 'Failed to run writing agent',
    program: (auth) =>
      Effect.gen(function* () {
        const service = yield* WritingAgentService
        return yield* service.submitPrompt({
          projectId: input.projectId,
          chatId: input.chatId,
          prompt: input.prompt,
          modelId: input.modelId,
          userId: auth.userId,
          organizationId: auth.organizationId,
          requestId: auth.requestId,
        })
      }),
  })
}
