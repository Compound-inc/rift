import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

const shareInput = z.object({ shareId: z.string().regex(/^[a-f0-9]{64}$/) })
export const readSharedThread = createServerFn({ method: 'GET' })
  .inputValidator((input: unknown) => shareInput.parse(input))
  .handler(async ({ data }) => {
    const { readShare } = await import('./thread-sharing.server')
    return readShare(data.shareId)
  })
export const manageThreadShare = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) =>
    z
      .object({
        threadId: z.string().min(1),
        action: z.enum(['settings', 'activate', 'revoke']),
        orgOnly: z.boolean().optional(),
        shareName: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { manageShare } = await import('./thread-sharing.server')
    return manageShare(data)
  })
export const forkSharedThread = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => shareInput.parse(input))
  .handler(async ({ data }) => {
    const { forkShare } = await import('./thread-sharing.server')
    return forkShare(data.shareId)
  })
