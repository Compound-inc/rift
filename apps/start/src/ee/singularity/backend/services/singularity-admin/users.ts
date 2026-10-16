import { PgClient } from '@effect/sql-pg'
import { Effect } from 'effect'
import type { SingularityUserListItem } from '../../../shared/singularity-admin'

/**
 * Return each registered account once, including accounts without a workspace.
 * Memberships remain nested so searches and counts do not duplicate people who
 * belong to several organizations. Guest sessions are intentionally excluded.
 */
export const listUsersEffect = Effect.fn('SingularityAdminQueries.listUsers')(
  (): Effect.Effect<
    Array<SingularityUserListItem>,
    unknown,
    PgClient.PgClient
  > =>
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      const users = yield* sql<SingularityUserListItem>`
        select u.id as "userId",
          coalesce(nullif(trim(u.name), ''), u.email) as name,
          u.email, u.image, u."emailVerified",
          (extract(epoch from u."createdAt") * 1000)::float8 as "createdAt",
          coalesce(
            jsonb_agg(jsonb_build_object(
              'memberId', m.id,
              'organizationId', o.id,
              'organizationName', o.name,
              'organizationSlug', o.slug,
              'role', m.role,
              'accessStatus', coalesce(ma.status, 'active'),
              'accessReason', ma.reason_code
            ) order by lower(o.name), o.id) filter (where m.id is not null),
            '[]'::jsonb
          ) as memberships
        from "user" u
        left join member m on m."userId" = u.id
        left join organization o on o.id = m."organizationId"
        left join org_member_access ma
          on ma.organization_id = m."organizationId" and ma.user_id = u.id
        where coalesce(u."isAnonymous", false) = false
        group by u.id
        order by lower(coalesce(nullif(trim(u.name), ''), u.email)), u.id
      `
      return Array.from(users)
    }),
)
