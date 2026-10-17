import { PgClient } from '@effect/sql-pg'
import { Effect, Layer, ServiceMap } from 'effect'
import { isAdminRole } from '@/lib/shared/auth/roles'
import { ProjectMetadataError } from '../domain/errors'

export type OrphanedProjectMetadata = {
  readonly id: string
  readonly name: string
  readonly formerOwnerName: string | null
  readonly createdAt: number
}

export class ProjectMetadataService extends ServiceMap.Service<
  ProjectMetadataService,
  {
    readonly ownerMemberships: (input: {
      readonly userId: string
    }) => Effect.Effect<ReadonlyArray<string>, ProjectMetadataError>
    readonly orphanedProjects: (input: {
      readonly userId: string
      readonly organizationId?: string
    }) => Effect.Effect<
      ReadonlyArray<OrphanedProjectMetadata>,
      ProjectMetadataError
    >
    readonly ownerName: (input: {
      readonly projectId: string
      readonly userId: string
      readonly organizationId?: string
    }) => Effect.Effect<{ readonly name: string | null }, ProjectMetadataError>
  }
>()('projects/ProjectMetadataService') {
  /** Keep profile fields and project content out of these metadata projections. */
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      return {
        /** Only the caller's org IDs leave the server, never other member rows. */
        ownerMemberships: Effect.fn('ProjectMetadataService.ownerMemberships')(
          function* ({ userId }) {
            const rows = yield* sql<{ organizationId: string }>`
              select "organizationId" from member where "userId" = ${userId}
            `.pipe(
              Effect.mapError(
                (cause) =>
                  new ProjectMetadataError({
                    message: 'Failed to load project owner membership',
                    cause: String(cause),
                  }),
              ),
            )
            return rows.map((row) => row.organizationId)
          },
        ),
        /** Admin remediation exposes identity metadata only, without project context. */
        orphanedProjects: Effect.fn('ProjectMetadataService.orphanedProjects')(
          function* ({ userId, organizationId }) {
            const members = yield* sql<{ role: string }>`
              select role from member
              where "organizationId" = ${organizationId ?? null} and "userId" = ${userId}
            `.pipe(
              Effect.mapError(
                (cause) =>
                  new ProjectMetadataError({
                    message: 'Failed to verify project admin',
                    cause: String(cause),
                  }),
              ),
            )
            const admin = members.find((member) => isAdminRole(member.role))
            if (!admin) {
              return yield* Effect.fail(
                new ProjectMetadataError({ message: 'Project admin required' }),
              )
            }
            const rows = yield* sql<OrphanedProjectMetadata>`
              select p.id, p.name, u.name as "formerOwnerName", p.created_at as "createdAt"
              from projects p left join "user" u on u.id = p.user_id
              where p.organization_id = ${organizationId ?? null}
                and p.visibility = 'org' and p.deleted_at is null
                and not exists (
                  select 1 from member m
                  where m."organizationId" = p.organization_id and m."userId" = p.user_id
                )
                and exists (
                  select 1 from member m
                  where m."organizationId" = p.organization_id and m."userId" = ${userId}
                    and m.role = ${admin.role}
                )
              order by p.created_at desc, p.id desc
            `.pipe(
              Effect.mapError(
                (cause) =>
                  new ProjectMetadataError({
                    message: 'Failed to load orphaned projects',
                    cause: String(cause),
                  }),
              ),
            )
            return rows.map((row) => ({
              ...row,
              createdAt: Number(row.createdAt),
            }))
          },
        ),
        ownerName: Effect.fn('ProjectMetadataService.ownerName')(
          function* (input) {
            const rows = yield* sql<{ name: string | null }>`
          select u.name from projects p join "user" u on u.id = p.user_id
          where p.id = ${input.projectId} and p.deleted_at is null
            and (p.user_id = ${input.userId} or (
              p.visibility = 'org' and p.organization_id = ${input.organizationId ?? null}
              and exists (select 1 from member m where m."organizationId" = p.organization_id and m."userId" = ${input.userId})
              and exists (select 1 from member m where m."organizationId" = p.organization_id and m."userId" = p.user_id)
            ))
        `.pipe(
              Effect.mapError(
                (cause) =>
                  new ProjectMetadataError({
                    message: 'Failed to load project owner',
                    cause: String(cause),
                  }),
              ),
            )
            if (!rows[0])
              return yield* Effect.fail(
                new ProjectMetadataError({
                  message: 'Project is not available',
                }),
              )
            return { name: rows[0].name }
          },
        ),
      }
    }),
  )
}
