import { Effect } from 'effect'
import {
  WritingAgentService,
  WritingChangeSetService,
  WritingSnapshotService,
  WritingWorkspaceService,
} from '@/lib/backend/writing'
import { runWritingAction } from '../server-action.server'

/**
 * Tool-oriented server actions wrap the virtual workspace operations that the
 * writing agent and UI use to inspect, edit, checkpoint, and review files.
 */
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
  readonly conversationId: string
  readonly prompt: string
  readonly modelId?: string
}) {
  return runWritingAction({
    operation: 'submitWritingPrompt',
    defaultMessage: 'Failed to run writing agent',
    program: (auth) =>
      Effect.gen(function* () {
        const service = yield* WritingAgentService
        return yield* service.streamPrompt({
          projectId: input.projectId,
          conversationId: input.conversationId,
          prompt: input.prompt,
          modelId: input.modelId,
          userId: auth.userId,
          organizationId: auth.organizationId,
          requestId: auth.requestId,
        })
      }),
  })
}
