import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

export const getProjectUsage = createServerFn({ method: 'GET' })
  .inputValidator((input: unknown) =>
    z.object({ projectId: z.string().trim().min(1) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { readProjectUsage } = await import('./project-usage.server')
    return readProjectUsage(data)
  })
