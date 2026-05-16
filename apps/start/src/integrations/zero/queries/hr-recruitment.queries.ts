import { defineQuery } from '@rocicorp/zero'
import { z } from 'zod'
import { getOrgContext } from '../org-access'
import { zql } from '../zql'

const MISSING_ORG = '__missing_org__'

const positionsListArgs = z.object({
  includeArchived: z.boolean().optional(),
})

const positionByIdArgs = z.object({
  positionId: z.string().min(1),
})

const applicationsByPositionArgs = z.object({
  positionId: z.string().min(1),
  includeArchived: z.boolean().optional(),
})

const candidatesListArgs = z.object({
  includeArchived: z.boolean().optional(),
})

const evaluationDispatchesByApplicationArgs = z.object({
  applicationId: z.string().min(1),
})

export const hrRecruitmentQueryDefinitions = {
  hrPositions: {
    list: defineQuery(positionsListArgs, ({ args, ctx }) => {
      const scoped = getOrgContext(ctx)
      if (!scoped) {
        return zql.hrPosition.where('organizationId', MISSING_ORG)
      }
      let q = zql.hrPosition.where('organizationId', scoped.organizationId)
      if (!args.includeArchived) {
        q = q.where('archivedAt', 'IS', null)
      }
      return q.orderBy('updatedAt', 'desc')
    }),
    byId: defineQuery(positionByIdArgs, ({ args, ctx }) => {
      const scoped = getOrgContext(ctx)
      const orgFilter = scoped?.organizationId ?? MISSING_ORG
      return zql.hrPosition
        .where('organizationId', orgFilter)
        .where('id', args.positionId)
        .one()
    }),
  },
  hrApplications: {
    byPosition: defineQuery(applicationsByPositionArgs, ({ args, ctx }) => {
      const scoped = getOrgContext(ctx)
      if (!scoped) {
        return zql.hrApplication.where('organizationId', MISSING_ORG)
      }
      let q = zql.hrApplication
        .where('organizationId', scoped.organizationId)
        .where('positionId', args.positionId)
      if (!args.includeArchived) {
        q = q.where('archivedAt', 'IS', null)
      }
      return q.orderBy('affinityScore', 'desc').orderBy('updatedAt', 'desc')
    }),
  },
  hrCandidates: {
    list: defineQuery(candidatesListArgs, ({ args, ctx }) => {
      const scoped = getOrgContext(ctx)
      if (!scoped) {
        return zql.hrCandidate.where('organizationId', MISSING_ORG)
      }
      let q = zql.hrCandidate
        .where('organizationId', scoped.organizationId)
        .where('mergedIntoCandidateId', 'IS', null)
      if (!args.includeArchived) {
        q = q.where('archivedAt', 'IS', null)
      }
      return q.orderBy('updatedAt', 'desc')
    }),
  },
  hrEvaluationDispatches: {
    byApplication: defineQuery(
      evaluationDispatchesByApplicationArgs,
      ({ args, ctx }) => {
        const scoped = getOrgContext(ctx)
        const orgFilter = scoped?.organizationId ?? MISSING_ORG
        return zql.hrEvaluationDispatch
          .where('organizationId', orgFilter)
          .where('applicationId', args.applicationId)
          .orderBy('dispatchedAt', 'desc')
      },
    ),
  },
}
