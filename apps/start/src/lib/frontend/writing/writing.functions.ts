import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

const projectIdSchema = z.object({
  projectId: z.string().trim().min(1),
})

const changeSetIdSchema = z.object({
  changeSetId: z.string().trim().min(1),
})

export const createWritingProject = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) =>
    z
      .object({
        title: z.string().trim().min(1).max(120),
        description: z.string().trim().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { createWritingProjectAction } = await import('./writing.server')
    return createWritingProjectAction(data)
  })

export const renameWritingProject = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) =>
    projectIdSchema.extend({
      title: z.string().trim().min(1).max(120),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { renameWritingProjectAction } = await import('./writing.server')
    return renameWritingProjectAction(data)
  })

export const setWritingAutoAcceptMode = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) =>
    projectIdSchema.extend({
      enabled: z.boolean(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { setWritingAutoAcceptModeAction } = await import('./writing.server')
    return setWritingAutoAcceptModeAction(data)
  })

export const createWritingChat = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) =>
    projectIdSchema.extend({
      title: z.string().trim().max(120).optional(),
      modelId: z.string().trim().min(1).max(120).optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { createWritingChatAction } = await import('./writing.server')
    return createWritingChatAction(data)
  })

export const readWritingFile = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) =>
    projectIdSchema.extend({
      path: z.string().trim().min(1),
      changeSetId: z.string().trim().min(1).optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { readWritingFileAction } = await import('./writing.server')
    return readWritingFileAction(data)
  })

export const manualSaveWritingFile = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) =>
    projectIdSchema.extend({
      path: z.string().trim().min(1),
      content: z.string(),
      expectedHeadSnapshotId: z.string().trim().min(1).optional(),
      summary: z.string().trim().max(240).optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { manualSaveWritingFileAction } = await import('./writing.server')
    return manualSaveWritingFileAction(data)
  })

export const createWritingFolder = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) =>
    projectIdSchema.extend({
      path: z.string().trim().min(1),
      expectedHeadSnapshotId: z.string().trim().min(1).optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { createWritingFolderAction } = await import('./writing.server')
    return createWritingFolderAction(data)
  })

export const createWritingCheckpoint = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) =>
    projectIdSchema.extend({
      summary: z.string().trim().min(1).max(240),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { createWritingCheckpointAction } = await import('./writing.server')
    return createWritingCheckpointAction(data)
  })

export const restoreWritingCheckpoint = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) =>
    projectIdSchema.extend({
      snapshotId: z.string().trim().min(1),
      expectedHeadSnapshotId: z.string().trim().min(1).optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { restoreWritingCheckpointAction } = await import('./writing.server')
    return restoreWritingCheckpointAction(data)
  })

export const acceptWritingHunks = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) =>
    changeSetIdSchema.extend({
      hunkIds: z.array(z.string().trim().min(1)).min(1),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { acceptWritingHunksAction } = await import('./writing.server')
    return acceptWritingHunksAction(data)
  })

export const rejectWritingHunks = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) =>
    changeSetIdSchema.extend({
      hunkIds: z.array(z.string().trim().min(1)).min(1),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { rejectWritingHunksAction } = await import('./writing.server')
    return rejectWritingHunksAction(data)
  })

export const discardWritingChangeSet = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => changeSetIdSchema.parse(input))
  .handler(async ({ data }) => {
    const { discardWritingChangeSetAction } = await import('./writing.server')
    return discardWritingChangeSetAction(data)
  })
