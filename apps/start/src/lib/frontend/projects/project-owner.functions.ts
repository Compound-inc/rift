import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

export const getProjectOwnerName = createServerFn({ method: 'GET' })
  .inputValidator((input: unknown) =>
    z.object({ projectId: z.string().trim().min(1) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { readProjectOwnerName } = await import('./project-owner.server')
    return readProjectOwnerName(data)
  })

/** Projections use the authenticated identity and active org from the session. */
export const getProjectOwnerMemberships = createServerFn({ method: 'GET' })
  .handler(async () => {
    const { readProjectOwnerMemberships } = await import('./project-owner.server')
    return readProjectOwnerMemberships()
  })

export const getOrphanedProjects = createServerFn({ method: 'GET' })
  .handler(async () => {
    const { readOrphanedProjects } = await import('./project-owner.server')
    return readOrphanedProjects()
  })
