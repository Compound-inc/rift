import { defineQuery } from '@rocicorp/zero'
import {
  missingOrganizationQuery,
  readScopedOrgViewerContext,
  whereViewerIsAdminOrOwner,
} from '../org-access'
import { zql } from '../zql'

export const orgSettingsQueryDefinitions = {
  orgSettings: {
    membersDirectory: defineQuery(({ ctx }) => {
      const scoped = readScopedOrgViewerContext(ctx)

      if (!scoped) {
        return missingOrganizationQuery()
      }

      return zql.organization
        .where('id', scoped.organizationId)
        .whereExists('members', whereViewerIsAdminOrOwner(scoped.userID))
        .related('members', (members) => members.related('user'))
        .one()
    }),
  },
}
