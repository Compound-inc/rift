import { defineQuery } from '@rocicorp/zero'
import { z } from 'zod'
import { getOrgContext } from '../org-access'
import { zql } from '../zql'

const MISSING_ORG = '__missing_org__'

const positionsListArgs = z.object({
  archiveFilter: z.enum(['active', 'archived', 'all']).optional(),
})

const positionByIdArgs = z.object({
  positionId: z.string().min(1),
})

const positionsByIdsArgs = z.object({
  positionIds: z.array(z.string().min(1)).max(500),
})

const applicationsByPositionArgs = z.object({
  positionId: z.string().min(1),
  includeArchived: z.boolean().optional(),
})

const applicationsByCandidateArgs = z.object({
  candidateId: z.string().min(1),
  includeArchived: z.boolean().optional(),
})

const applicationByIdArgs = z.object({
  applicationId: z.string().min(1),
})

const candidatesListArgs = z.object({
  includeArchived: z.boolean().optional(),
})

const candidateByIdArgs = z.object({
  candidateId: z.string().min(1),
})

const evaluationDispatchesByApplicationArgs = z.object({
  applicationId: z.string().min(1),
})

const evaluationResponsesByApplicationArgs = z.object({
  applicationId: z.string().min(1),
})

const backgroundChecksByApplicationArgs = z.object({
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
      if (args.archiveFilter === 'archived') {
        q = q.where('archivedAt', 'IS NOT', null)
      } else if (args.archiveFilter !== 'all') {
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
    byIds: defineQuery(positionsByIdsArgs, ({ args, ctx }) => {
      const scoped = getOrgContext(ctx)
      // Empty input returns nothing without hitting the wider org table.
      if (!scoped || args.positionIds.length === 0) {
        return zql.hrPosition.where('organizationId', MISSING_ORG)
      }
      return zql.hrPosition
        .where('organizationId', scoped.organizationId)
        .where('id', 'IN', args.positionIds)
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
    byCandidate: defineQuery(applicationsByCandidateArgs, ({ args, ctx }) => {
      const scoped = getOrgContext(ctx)
      if (!scoped) {
        return zql.hrApplication.where('organizationId', MISSING_ORG)
      }
      let q = zql.hrApplication
        .where('organizationId', scoped.organizationId)
        .where('candidateId', args.candidateId)
      if (!args.includeArchived) {
        q = q.where('archivedAt', 'IS', null)
      }
      return q.orderBy('updatedAt', 'desc')
    }),
    byId: defineQuery(applicationByIdArgs, ({ args, ctx }) => {
      const scoped = getOrgContext(ctx)
      const orgFilter = scoped?.organizationId ?? MISSING_ORG
      return zql.hrApplication
        .where('organizationId', orgFilter)
        .where('id', args.applicationId)
        .one()
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
    byId: defineQuery(candidateByIdArgs, ({ args, ctx }) => {
      const scoped = getOrgContext(ctx)
      const orgFilter = scoped?.organizationId ?? MISSING_ORG
      return zql.hrCandidate
        .where('organizationId', orgFilter)
        .where('id', args.candidateId)
        .where('mergedIntoCandidateId', 'IS', null)
        .one()
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
  hrEvaluationResponses: {
    byApplication: defineQuery(
      evaluationResponsesByApplicationArgs,
      ({ args, ctx }) => {
        const scoped = getOrgContext(ctx)
        const orgFilter = scoped?.organizationId ?? MISSING_ORG
        return zql.hrEvaluationResponse
          .where('organizationId', orgFilter)
          .where('applicationId', args.applicationId)
          .orderBy('submittedAt', 'desc')
      },
    ),
  },
  hrBackgroundChecks: {
    byApplication: defineQuery(
      backgroundChecksByApplicationArgs,
      ({ args, ctx }) => {
        const scoped = getOrgContext(ctx)
        const orgFilter = scoped?.organizationId ?? MISSING_ORG
        return zql.hrBackgroundCheck
          .where('organizationId', orgFilter)
          .where('applicationId', args.applicationId)
          .orderBy('requestedAt', 'desc')
      },
    ),
  },
}
