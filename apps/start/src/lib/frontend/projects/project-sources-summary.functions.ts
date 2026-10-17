import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

export const getProjectSourceSummary = createServerFn({ method: 'GET' })
  .inputValidator((input: unknown) =>
    z.object({ projectId: z.string().trim().min(1) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { readProjectSourceSummary } =
      await import('./project-sources-summary.server')
    return readProjectSourceSummary(data)
  })

/** Non-owner lists use a server projection instead of full Zero attachment rows. */
export const getProjectSourceList = createServerFn({ method: 'GET' })
  .inputValidator((input: unknown) =>
    z.object({ projectId: z.string().trim().min(1) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { readProjectSourceList } =
      await import('./project-sources-summary.server')
    return readProjectSourceList(data)
  })
