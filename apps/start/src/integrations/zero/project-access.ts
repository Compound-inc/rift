import type { ExpressionBuilder } from '@rocicorp/zero'
import type { ProjectAccessSubject } from '@/lib/shared/projects/access'
import type { Schema } from './schema'
import { zql } from './zql'

/** Shared project read predicate, including anonymous and soft-delete guards. */
export function projectVisibleToCaller(input: {
  readonly userID: string
  readonly organizationId?: string
  readonly isAnonymous?: boolean
}) {
  return (eb: ExpressionBuilder<'project', Schema>) => {
    const { or, and, cmp, exists } = eb
    if (input.isAnonymous || !input.userID.trim()) return cmp('id', 'IN', [])
    return and(
      cmp('deletedAt', 'IS', null),
      or(
        cmp('userId', input.userID),
        input.organizationId
          ? and(
              cmp('visibility', 'org'),
              cmp('organizationId', input.organizationId),
              exists('ownerMembership'),
              exists('organization', (organization) =>
                organization.whereExists('members', (members) =>
                  members.where('userId', input.userID),
                ),
              ),
            )
          : undefined,
      ),
    )
  }
}

/** Membership reads are authoritative on the server; optimistic writes skip them. */
export function projectMembershipQuery(organizationId: string, userId: string) {
  return zql.member
    .where('organizationId', organizationId)
    .where('userId', userId)
    .one()
}

/** Private projects keep owner access even after organization membership changes. */
export async function projectOwnerIsMember(
  db: {
    readonly run: (
      query: ReturnType<typeof projectMembershipQuery>,
    ) => Promise<unknown>
  },
  project: ProjectAccessSubject | null | undefined,
): Promise<boolean> {
  if (project?.visibility !== 'org') return true
  return (
    !!project.organizationId &&
    !!(await db.run(
      projectMembershipQuery(project.organizationId, project.userId),
    ))
  )
}
