import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

export * from './tool/functions'

const projectIdSchema = z.object({
  projectId: z.string().trim().min(1),
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
