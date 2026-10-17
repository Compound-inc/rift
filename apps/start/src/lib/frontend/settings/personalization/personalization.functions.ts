import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

const actionSchema = z
  .discriminatedUnion('action', [
    z.object({ action: z.literal('status') }),
    z.object({
      action: z.literal('list'),
      page: z.number().int().min(1).default(1),
    }),
    z.object({ action: z.literal('delete'), id: z.string().min(1).max(256) }),
    z.object({ action: z.literal('delete-all') }),
  ])
  .and(z.object({ organizationId: z.string().min(1).optional() }))

/** All identities and namespace arguments are resolved on the server. */
export const managePersonalizationMemory = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => actionSchema.parse(input))
  .handler(async ({ data }) => {
    const { runMemoryAction } = await import('./personalization.server')
    return runMemoryAction(data)
  })
