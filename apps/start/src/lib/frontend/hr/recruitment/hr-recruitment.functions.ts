import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

/**
 * HR Recruitment server functions.
 */

const createPositionInput = z.object({
  title: z.string().trim().min(1).max(200),
  department: z.string().trim().max(200).optional(),
  location: z.string().trim().max(200).optional(),
  arrangement: z.string().trim().max(40).optional(),
  employmentType: z.string().trim().max(40).optional(),
  status: z.string().trim().max(40).optional(),
  hiringManager: z.string().trim().max(200).optional(),
  compensation: z.string().trim().max(200).optional(),
  description: z.string().trim().max(8000).optional(),
  tags: z.array(z.string().trim().max(64)).max(32).optional(),
})

const archivePositionInput = z.object({
  positionId: z.string().trim().min(1),
  archive: z.boolean(),
})

const resolveApplicationCvUrlInput = z.object({
  applicationId: z.string().trim().min(1),
})

export const createPosition = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => createPositionInput.parse(input))
  .handler(async ({ data }) => {
    const { createPositionAction } = await import('./hr-recruitment.server')
    return createPositionAction(data)
  })

export const archivePosition = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => archivePositionInput.parse(input))
  .handler(async ({ data }) => {
    const { archivePositionAction } = await import('./hr-recruitment.server')
    return archivePositionAction(data)
  })

/**
 * Returns a browser-accessible URL for the CV attached to the given
 * Application, or `null` when no CV is on file. Used by the Application
 * detail CV viewer so the iframe can src= a signed URL.
 */
export const resolveApplicationCvUrl = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => resolveApplicationCvUrlInput.parse(input))
  .handler(async ({ data }) => {
    const { resolveApplicationCvUrlAction } = await import(
      './hr-recruitment.server'
    )
    return resolveApplicationCvUrlAction(data)
  })
