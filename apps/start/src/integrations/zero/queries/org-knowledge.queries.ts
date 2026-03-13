import { defineQuery } from '@rocicorp/zero'
import { z } from 'zod'
import { ORG_KNOWLEDGE_KIND } from '@/lib/shared/org-knowledge'
import { getOrgContext } from '../org-access'
import { zql } from '../zql'

const orgKnowledgeListArgs = z.object({
  includeInactive: z.boolean().optional(),
})

/**
 * Admin-only org knowledge queries.
 */
export const orgKnowledgeQueryDefinitions = {
  orgKnowledge: {
    list: defineQuery(orgKnowledgeListArgs, ({ args, ctx }) => {
      const scoped = getOrgContext(ctx)
      if (!scoped) {
        return zql.attachment
          .where('id', '__missing_org_knowledge__')
          .limit(1)
      }

      let query = zql.attachment
        .where('ownerOrgId', scoped.organizationId)
        .where('orgKnowledgeKind', ORG_KNOWLEDGE_KIND)
        .where('status', 'uploaded')
        .whereExists('organization', (organization) =>
          organization.whereExists('members', (members) =>
            members
              .where('userId', scoped.userID)
              .where('role', 'IN', ['owner', 'admin']),
          ),
        )
        .orderBy('updatedAt', 'desc')
        .orderBy('id', 'desc')

      if (!args.includeInactive) {
        query = query.where('orgKnowledgeActive', true)
      }

      return query
    }),
  },
}
