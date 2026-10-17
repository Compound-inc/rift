import { PgClient } from '@effect/sql-pg'
import { Effect, Layer, ServiceMap } from 'effect'
import { asNumber } from '@/lib/backend/billing/services/workspace-usage/core'
import { projectUsageMonth } from '@/lib/shared/projects/usage'
import type { ProjectUsageSummary } from '@/lib/shared/projects/usage'
import { ProjectUsageError } from '../domain/errors'

type UsageRow = {
  readonly allMembers: boolean
  readonly inputTokens: number | string | null
  readonly outputTokens: number | string | null
  readonly totalTokens: number | string | null
  readonly publicCost: number | string | null
  readonly unpricedMessages: number | string | null
}

type ReadInput = {
  readonly projectId: string
  readonly userId: string
  readonly organizationId?: string
  readonly now?: number
}

export type ProjectUsageServiceShape = {
  readonly read: (
    input: ReadInput,
  ) => Effect.Effect<ProjectUsageSummary, ProjectUsageError>
}

/**
 * Read-only reporting over persisted provider usage, not billing quota buckets.
 * Archive status and branch visibility do not erase costs already incurred.
 * Authorization and aggregation share one SQL statement so a separate auth read
 * cannot race a visibility change. Only the aggregate leaves the server.
 */
export class ProjectUsageService extends ServiceMap.Service<
  ProjectUsageService,
  ProjectUsageServiceShape
>()('project-usage/ProjectUsageService') {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      return {
        read: Effect.fn('ProjectUsageService.read')(function* (
          input: ReadInput,
        ) {
          const period = projectUsageMonth(input.now ?? Date.now())
          const rows = yield* sql<UsageRow>`
          with accessible_project as (
            select p.id,
              (p.visibility = 'org' and owner_member.id is not null and (
                p.user_id = ${input.userId}
                or (',' || replace(lower(coalesce(m.role, '')), ' ', '') || ',') like '%,owner,%'
                or (',' || replace(lower(coalesce(m.role, '')), ' ', '') || ',') like '%,admin,%'
              )) as all_members
            from projects p
            left join member owner_member on owner_member."organizationId" = p.organization_id
              and owner_member."userId" = p.user_id
            left join member m on m."organizationId" = p.organization_id
              and m."userId" = ${input.userId}
              and m."organizationId" = ${input.organizationId ?? null}
            where p.id = ${input.projectId} and p.deleted_at is null
              and (p.user_id = ${input.userId} or (
                p.visibility = 'org' and m.id is not null and owner_member.id is not null
              ))
          )
          select p.all_members as "allMembers",
            sum(coalesce(msg.input_tokens, 0)) as "inputTokens",
            sum(coalesce(msg.output_tokens, 0)) as "outputTokens",
            sum(coalesce(msg.total_tokens, coalesce(msg.input_tokens, 0) + coalesce(msg.output_tokens, 0))) as "totalTokens",
            sum(msg.public_cost) as "publicCost",
            count(msg.id) filter (where msg.public_cost is null) as "unpricedMessages"
          from accessible_project p
          left join threads t on t.project_id = p.id
            and (p.all_members or t.user_id = ${input.userId})
          left join messages msg on msg.thread_id = t.thread_id
            and msg.user_id = t.user_id and msg.role = 'assistant'
            and msg.created_at >= ${period.startAt} and msg.created_at < ${period.endAt}
          group by p.id, p.all_members
        `.pipe(
            Effect.mapError(
              (cause) =>
                new ProjectUsageError({
                  message: 'Failed to load project usage',
                  cause: String(cause),
                }),
            ),
          )
          const row = rows[0]
          if (!row)
            return yield* Effect.fail(
              new ProjectUsageError({ message: 'Project is not available' }),
            )
          return {
            ...period,
            scope: row.allMembers ? ('project' as const) : ('own' as const),
            inputTokens: asNumber(row.inputTokens),
            outputTokens: asNumber(row.outputTokens),
            totalTokens: asNumber(row.totalTokens),
            publicCost:
              row.publicCost == null ? null : asNumber(row.publicCost),
            unpricedMessages: asNumber(row.unpricedMessages),
          }
        }),
      }
    }),
  )
}
