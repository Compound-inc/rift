import { defineQuery } from '@rocicorp/zero'
import { z } from 'zod'
import {
  missingOrganizationQuery,
  requireOrgAdmin,
  getOrgContext,
} from '../org-access'
import { zql } from '../zql'

/** Maximum members returned per page for the org members directory. */
export const MEMBERS_DIRECTORY_PAGE_SIZE = 50

const membersDirectoryArgs = z.object({
  cursor: z.object({ id: z.string() }).optional(),
})

export const orgSettingsQueryDefinitions = {
  orgSettings: {
    membersDirectory: defineQuery(membersDirectoryArgs, ({ args, ctx }) => {
      const scoped = getOrgContext(ctx)
      if (!scoped) {
        return missingOrganizationQuery()
      }
      try {
        requireOrgAdmin({ ctx })
      } catch {
        return missingOrganizationQuery()
      }

      return zql.organization
        .where('id', scoped.organizationId)
        .related('members', (members) => {
          let q = members
            .orderBy('id', 'asc')
            .limit(MEMBERS_DIRECTORY_PAGE_SIZE)
          if (args.cursor?.id) {
            q = q.start({ id: args.cursor.id })
          }
          return q.related('user').related('access')
        })
        .related('invitations', (invitations) =>
          invitations
            .where('status', 'pending')
            .orderBy('email', 'asc')
            .limit(MEMBERS_DIRECTORY_PAGE_SIZE),
        )
        .one()
    }),
  },
}
