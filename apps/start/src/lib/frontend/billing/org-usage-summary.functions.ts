import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

const GetOrgUsageSummaryInputSchema = z.object({}).optional()

export const getOrgUsageSummary = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => GetOrgUsageSummaryInputSchema.parse(input))
  .handler(async () => {
    const { getOrgUsageSummaryAction } = await import('./org-usage-summary.server')
    return getOrgUsageSummaryAction()
  })
