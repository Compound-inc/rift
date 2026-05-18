import { PgClient } from '@effect/sql-pg'
import { Effect, Layer, ServiceMap } from 'effect'
import {
  normalizeCvText,
  normalizeEmail,
  normalizeTags,
  normalizeTextField,
} from '@/lib/shared/hr/recruitment'
import {
  HrCandidateNotFoundError,
  HrCrossOrgAccessError,
  HrPersistenceError,
  HrRecruitmentInvalidInputError,
} from '../domain/errors'
import type { HrCandidateRow } from '../domain/types'
import { jsonValue, toHrCandidateRow } from './persistence'

/**
 * Candidate service.
 *
 * Candidates are persistent org-scoped profiles dedup'd by normalized
 * email; re-uploading a CV for the same email returns the same row.
 */

export type UpsertCandidateInput = {
  readonly organizationId: string
  readonly requestId: string
  readonly email: string | null
  readonly displayName: string | null
  readonly phone?: string | null
  readonly cvAttachmentId?: string | null
  readonly cvText?: string | null
  readonly tags?: readonly string[]
}

export type ArchiveCandidateInput = {
  readonly organizationId: string
  readonly candidateId: string
  readonly userId: string
  readonly requestId: string
  readonly archive: boolean
}

export type ApplyCandidateAiProfileInput = {
  readonly organizationId: string
  readonly candidateId: string
  readonly requestId: string
  readonly displayName: string | null
  readonly email: string | null
  readonly phone: string | null
  readonly location: string | null
  readonly headline: string | null
  readonly summary: string | null
  readonly yearsOfExperience: number | null
  readonly skills: readonly string[]
  readonly languages: readonly string[]
  readonly highestDegree: string | null
  readonly profileSource: string
}

export type HrCandidateServiceShape = {
  readonly upsertByEmail: (
    input: UpsertCandidateInput,
  ) => Effect.Effect<
    HrCandidateRow,
    HrRecruitmentInvalidInputError | HrPersistenceError
  >
  readonly findById: (input: {
    readonly organizationId: string
    readonly candidateId: string
    readonly requestId: string
  }) => Effect.Effect<
    HrCandidateRow,
    HrCandidateNotFoundError | HrPersistenceError | HrCrossOrgAccessError
  >
  readonly archive: (
    input: ArchiveCandidateInput,
  ) => Effect.Effect<
    HrCandidateRow,
    HrCandidateNotFoundError | HrPersistenceError | HrCrossOrgAccessError
  >
  readonly applyAiProfile: (
    input: ApplyCandidateAiProfileInput,
  ) => Effect.Effect<
    HrCandidateRow,
    HrCandidateNotFoundError | HrPersistenceError | HrCrossOrgAccessError
  >
  readonly list: (input: {
    readonly organizationId: string
    readonly requestId: string
    readonly includeArchived?: boolean
  }) => Effect.Effect<readonly HrCandidateRow[], HrPersistenceError>
}

function toPersistenceError(input: {
  readonly organizationId: string
  readonly requestId: string
  readonly operation: string
  readonly message: string
  readonly cause?: unknown
}) {
  return new HrPersistenceError({
    message: input.message,
    operation: input.operation,
    organizationId: input.organizationId,
    requestId: input.requestId,
    cause: input.cause ? String(input.cause) : undefined,
  })
}

function toCrossOrg(input: {
  readonly organizationId: string
  readonly requestId: string
  readonly resourceId: string
  readonly actualOrganizationId?: string
}) {
  return new HrCrossOrgAccessError({
    message: `Candidate ${input.resourceId} does not belong to organization ${input.organizationId}.`,
    organizationId: input.organizationId,
    requestId: input.requestId,
    resource: 'hr_candidate',
    resourceId: input.resourceId,
    actualOrganizationId: input.actualOrganizationId,
  })
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const cause = (error as { cause?: unknown }).cause
  if (!cause || typeof cause !== 'object') return false
  return (cause as { code?: unknown }).code === '23505'
}

type CandidateRawRow = Record<string, unknown>

export class HrCandidateService extends ServiceMap.Service<
  HrCandidateService,
  HrCandidateServiceShape
>()('hr/recruitment/HrCandidateService') {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const client = yield* PgClient.PgClient

      const findByIdInternal = Effect.fn(
        'HrCandidateService.findById.internal',
      )(
        (input: {
          readonly organizationId: string
          readonly candidateId: string
          readonly requestId: string
        }): Effect.Effect<
          HrCandidateRow,
          HrCandidateNotFoundError | HrPersistenceError | HrCrossOrgAccessError
        > =>
          Effect.gen(function* () {
            const rows = yield* client<CandidateRawRow>`
              select * from hr_candidate
              where id = ${input.candidateId}
              limit 1
            `.pipe(
              Effect.mapError((cause) =>
                toPersistenceError({
                  organizationId: input.organizationId,
                  requestId: input.requestId,
                  operation: 'findCandidateById',
                  message: 'Failed to load candidate.',
                  cause,
                }),
              ),
            )
            const [row] = rows
            if (!row) {
              return yield* Effect.fail(
                new HrCandidateNotFoundError({
                  message: `Candidate ${input.candidateId} not found.`,
                  organizationId: input.organizationId,
                  requestId: input.requestId,
                  candidateId: input.candidateId,
                }),
              )
            }
            const candidate = toHrCandidateRow(row)
            if (candidate.organizationId !== input.organizationId) {
              return yield* Effect.fail(
                toCrossOrg({
                  organizationId: input.organizationId,
                  requestId: input.requestId,
                  resourceId: input.candidateId,
                  actualOrganizationId: candidate.organizationId,
                }),
              )
            }
            return candidate
          }),
      )

      const upsertByEmail: HrCandidateServiceShape['upsertByEmail'] = Effect.fn(
        'HrCandidateService.upsertByEmail',
      )((input) =>
        Effect.gen(function* () {
          const displayName = normalizeTextField(input.displayName)
          const normalizedEmail = normalizeEmail(input.email)
          const phone = input.phone ? normalizeTextField(input.phone) : ''
          const tags = normalizeTags(input.tags)
          const cvText = normalizeCvText(input.cvText)

          if (!displayName && !normalizedEmail) {
            return yield* Effect.fail(
              new HrRecruitmentInvalidInputError({
                message:
                  'Candidate display name or email is required to create a profile.',
                organizationId: input.organizationId,
                requestId: input.requestId,
                field: 'displayName',
              }),
            )
          }

          const existingRows = normalizedEmail
            ? yield* client<CandidateRawRow>`
                select * from hr_candidate
                where organization_id = ${input.organizationId}
                  and normalized_email = ${normalizedEmail.normalized}
                  and merged_into_candidate_id is null
                limit 1
              `.pipe(
                Effect.mapError((cause) =>
                  toPersistenceError({
                    organizationId: input.organizationId,
                    requestId: input.requestId,
                    operation: 'lookupCandidateByEmail',
                    message: 'Failed to look up candidate by email.',
                    cause,
                  }),
                ),
              )
            : []

          const now = Date.now()

          if (existingRows.length > 0) {
            const existing = toHrCandidateRow(existingRows[0])
            const merged = yield* client<CandidateRawRow>`
              update hr_candidate
              set
                display_name = case when ${displayName} = '' then display_name else ${displayName} end,
                phone = case when ${phone} = '' then phone else ${phone} end,
                latest_cv_attachment_id = ${input.cvAttachmentId ?? existing.latestCvAttachmentId},
                latest_cv_text = ${cvText ?? existing.latestCvText},
                tags = ${jsonValue(client, [...new Set([...existing.tags, ...tags])])},
                needs_contact_review = ${normalizedEmail === null && existing.needsContactReview},
                updated_at = ${now}
              where id = ${existing.id}
                and organization_id = ${input.organizationId}
              returning *
            `.pipe(
              Effect.mapError((cause) =>
                toPersistenceError({
                  organizationId: input.organizationId,
                  requestId: input.requestId,
                  operation: 'upsertCandidateExisting',
                  message: 'Failed to update candidate profile.',
                  cause,
                }),
              ),
            )
            const [row] = merged
            return toHrCandidateRow(row ?? existingRows[0])
          }

          const id = crypto.randomUUID()
          const inserted = yield* client<CandidateRawRow>`
            insert into hr_candidate (
              id, organization_id, normalized_email, email, display_name, phone,
              latest_cv_attachment_id, latest_cv_text,
              aliases, tags,
              merged_into_candidate_id, needs_contact_review,
              archived_at, archived_by, notes,
              created_at, updated_at
            )
            values (
              ${id}, ${input.organizationId},
              ${normalizedEmail?.normalized ?? null},
              ${normalizedEmail?.display ?? null},
              ${displayName}, ${phone || null},
              ${input.cvAttachmentId ?? null}, ${cvText ?? null},
              ${jsonValue(client, [])},
              ${jsonValue(client, tags)},
              null, ${normalizedEmail === null},
              null, null, null,
              ${now}, ${now}
            )
            returning *
          `.pipe(
            Effect.mapError((cause) =>
              toPersistenceError({
                organizationId: input.organizationId,
                requestId: input.requestId,
                operation: 'insertCandidate',
                message: 'Failed to create candidate profile.',
                cause,
              }),
            ),
          )
          const [row] = inserted
          if (!row) {
            return yield* Effect.fail(
              toPersistenceError({
                organizationId: input.organizationId,
                requestId: input.requestId,
                operation: 'insertCandidate',
                message: 'Insert returned no row.',
              }),
            )
          }
          return toHrCandidateRow(row)
        }),
      )

      const archive: HrCandidateServiceShape['archive'] = Effect.fn(
        'HrCandidateService.archive',
      )((input) =>
        Effect.gen(function* () {
          yield* findByIdInternal({
            organizationId: input.organizationId,
            requestId: input.requestId,
            candidateId: input.candidateId,
          })
          const now = Date.now()
          const rows = yield* client<CandidateRawRow>`
            update hr_candidate
            set
              archived_at = ${input.archive ? now : null},
              archived_by = ${input.archive ? input.userId : null},
              updated_at = ${now}
            where id = ${input.candidateId}
              and organization_id = ${input.organizationId}
            returning *
          `.pipe(
            Effect.mapError((cause) =>
              toPersistenceError({
                organizationId: input.organizationId,
                requestId: input.requestId,
                operation: 'archiveCandidate',
                message: 'Failed to archive candidate.',
                cause,
              }),
            ),
          )
          const [row] = rows
          if (!row) {
            return yield* Effect.fail(
              new HrCandidateNotFoundError({
                message: `Candidate ${input.candidateId} not found.`,
                organizationId: input.organizationId,
                requestId: input.requestId,
                candidateId: input.candidateId,
              }),
            )
          }
          return toHrCandidateRow(row)
        }),
      )

      const list: HrCandidateServiceShape['list'] = Effect.fn(
        'HrCandidateService.list',
      )((input) =>
        Effect.gen(function* () {
          const archivedClause = client.literal(
            input.includeArchived ? 'TRUE' : 'archived_at is null',
          )
          const rows = yield* client<CandidateRawRow>`
            select * from hr_candidate
            where organization_id = ${input.organizationId}
              and merged_into_candidate_id is null
              and ${archivedClause}
            order by updated_at desc
          `.pipe(
            Effect.mapError((cause) =>
              toPersistenceError({
                organizationId: input.organizationId,
                requestId: input.requestId,
                operation: 'listCandidates',
                message: 'Failed to list candidates.',
                cause,
              }),
            ),
          )
          return rows.map(toHrCandidateRow)
        }),
      )

      const applyAiProfile: HrCandidateServiceShape['applyAiProfile'] =
        Effect.fn('HrCandidateService.applyAiProfile')((input) =>
          Effect.gen(function* () {
            const existing = yield* findByIdInternal({
              organizationId: input.organizationId,
              candidateId: input.candidateId,
              requestId: input.requestId,
            })
            const incomingEmail = normalizeEmail(input.email)
            const displayName = input.displayName?.trim().length
              ? normalizeTextField(input.displayName)
              : existing.displayName

            // Try to adopt the AI-recovered email so future uploads can dedup.
            // Two concurrent applyAiProfile calls for different placeholder
            // Candidates can resolve to the same email; the SELECT below is
            // an optimistic check, but a third workflow can still INSERT or
            // UPDATE between our lookup and our UPDATE. The partial unique
            // index `(organization_id, normalized_email) WHERE
            // normalized_email IS NOT NULL` is the real source of truth —
            // when it rejects the write we catch the unique violation and
            // retry without adopting the email, leaving the original email
            // in place. The previous run's row keeps the email and this row
            // stays a placeholder until the next AI extraction.
            const emailOwnerRows = incomingEmail
              ? yield* client<{ id: string }>`
                  select id from hr_candidate
                  where organization_id = ${input.organizationId}
                    and normalized_email = ${incomingEmail.normalized}
                    and merged_into_candidate_id is null
                    and id <> ${existing.id}
                  limit 1
                `.pipe(
                  Effect.mapError((cause) =>
                    toPersistenceError({
                      organizationId: input.organizationId,
                      requestId: input.requestId,
                      operation: 'lookupCandidateAiEmailOwner',
                      message: 'Failed to check candidate AI email owner.',
                      cause,
                    }),
                  ),
                )
              : []

            const runUpdate = (params: { readonly adoptEmail: boolean }) => {
              const nextNormalizedEmail =
                params.adoptEmail && incomingEmail
                  ? incomingEmail.normalized
                  : existing.normalizedEmail
              const nextDisplayEmail =
                params.adoptEmail && incomingEmail
                  ? incomingEmail.display
                  : existing.email
              return client<CandidateRawRow>`
                update hr_candidate
                set
                  display_name = ${displayName},
                  normalized_email = ${nextNormalizedEmail},
                  email = ${nextDisplayEmail},
                  phone = ${input.phone ?? existing.phone},
                  location = ${input.location ?? existing.location},
                  headline = ${input.headline ?? existing.headline},
                  summary = ${input.summary ?? existing.summary},
                  years_of_experience = ${
                    input.yearsOfExperience ?? existing.yearsOfExperience
                  },
                  skills = ${jsonValue(client, input.skills)},
                  languages = ${jsonValue(client, input.languages)},
                  highest_degree = ${input.highestDegree ?? existing.highestDegree},
                  profile_source = ${input.profileSource},
                  needs_contact_review = ${
                    nextNormalizedEmail === null && existing.needsContactReview
                  },
                  updated_at = ${Date.now()}
                where id = ${input.candidateId}
                  and organization_id = ${input.organizationId}
                returning *
              `
            }

            // First try: adopt incoming email when our optimistic lookup
            // shows no other owner. If a concurrent transaction races us and
            // takes the email between our SELECT and our UPDATE, the partial
            // unique index will reject the write with SQLSTATE 23505; we
            // catch that and rerun the UPDATE without adopting the email.
            const optimisticallyCanAdopt =
              incomingEmail !== null && emailOwnerRows.length === 0
            const rows = yield* runUpdate({
              adoptEmail: optimisticallyCanAdopt,
            }).pipe(
              Effect.catchIf(isUniqueViolation, () =>
                runUpdate({ adoptEmail: false }),
              ),
              Effect.mapError((cause) =>
                toPersistenceError({
                  organizationId: input.organizationId,
                  requestId: input.requestId,
                  operation: 'applyCandidateAiProfile',
                  message: 'Failed to apply AI profile.',
                  cause,
                }),
              ),
            )
            const [row] = rows
            if (!row) {
              return yield* Effect.fail(
                new HrCandidateNotFoundError({
                  message: `Candidate ${input.candidateId} not found.`,
                  organizationId: input.organizationId,
                  requestId: input.requestId,
                  candidateId: input.candidateId,
                }),
              )
            }
            return toHrCandidateRow(row)
          }),
        )

      return {
        upsertByEmail,
        findById: findByIdInternal,
        archive,
        applyAiProfile,
        list,
      } satisfies HrCandidateServiceShape
    }),
  )

  /** In-memory implementation for tests. */
  static readonly layerMemory = Layer.sync(this, () => {
    const rows = new Map<string, HrCandidateRow>()

    const ensureSameOrg = (
      organizationId: string,
      requestId: string,
      candidateId: string,
    ): Effect.Effect<
      HrCandidateRow,
      HrCandidateNotFoundError | HrCrossOrgAccessError
    > => {
      const row = rows.get(candidateId)
      if (!row) {
        return Effect.fail(
          new HrCandidateNotFoundError({
            message: `Candidate ${candidateId} not found.`,
            organizationId,
            requestId,
            candidateId,
          }),
        )
      }
      if (row.organizationId !== organizationId) {
        return Effect.fail(
          toCrossOrg({
            organizationId,
            requestId,
            resourceId: candidateId,
            actualOrganizationId: row.organizationId,
          }),
        )
      }
      return Effect.succeed(row)
    }

    return {
      upsertByEmail: Effect.fn('HrCandidateService.upsertByEmail.memory')(
        (input) =>
          Effect.gen(function* () {
            const displayName = normalizeTextField(input.displayName)
            const normalizedEmail = normalizeEmail(input.email)
            const tags = normalizeTags(input.tags)
            const cvText = normalizeCvText(input.cvText)
            if (!displayName && !normalizedEmail) {
              return yield* Effect.fail(
                new HrRecruitmentInvalidInputError({
                  message:
                    'Candidate display name or email is required to create a profile.',
                  organizationId: input.organizationId,
                  requestId: input.requestId,
                  field: 'displayName',
                }),
              )
            }
            const existing = normalizedEmail
              ? Array.from(rows.values()).find(
                  (row) =>
                    row.organizationId === input.organizationId &&
                    row.normalizedEmail === normalizedEmail.normalized &&
                    row.mergedIntoCandidateId === null,
                )
              : undefined
            const now = Date.now()
            if (existing) {
              const updated: HrCandidateRow = {
                ...existing,
                displayName: displayName || existing.displayName,
                phone: input.phone
                  ? normalizeTextField(input.phone)
                  : existing.phone,
                latestCvAttachmentId:
                  input.cvAttachmentId ?? existing.latestCvAttachmentId,
                latestCvText: cvText ?? existing.latestCvText,
                tags: Array.from(new Set([...existing.tags, ...tags])),
                updatedAt: now,
              }
              rows.set(existing.id, updated)
              return updated
            }
            const id = crypto.randomUUID()
            const next: HrCandidateRow = {
              id,
              organizationId: input.organizationId,
              normalizedEmail: normalizedEmail?.normalized ?? null,
              email: normalizedEmail?.display ?? null,
              displayName,
              phone: input.phone ? normalizeTextField(input.phone) : null,
              latestCvAttachmentId: input.cvAttachmentId ?? null,
              latestCvText: cvText ?? null,
              latestCvEmbedding: null,
              latestCvEmbeddingModel: null,
              latestCvEmbeddingDimensions: null,
              latestCvIndexedAt: null,
              aliases: [],
              tags,
              mergedIntoCandidateId: null,
              needsContactReview: normalizedEmail === null,
              archivedAt: null,
              archivedBy: null,
              notes: null,
              location: null,
              headline: null,
              summary: null,
              yearsOfExperience: null,
              skills: [],
              languages: [],
              highestDegree: null,
              profileSource: null,
              createdAt: now,
              updatedAt: now,
            }
            rows.set(id, next)
            return next
          }),
      ),
      findById: Effect.fn('HrCandidateService.findById.memory')((input) =>
        ensureSameOrg(input.organizationId, input.requestId, input.candidateId),
      ),
      archive: Effect.fn('HrCandidateService.archive.memory')((input) =>
        Effect.gen(function* () {
          const existing = yield* ensureSameOrg(
            input.organizationId,
            input.requestId,
            input.candidateId,
          )
          const now = Date.now()
          const next: HrCandidateRow = {
            ...existing,
            archivedAt: input.archive ? now : null,
            archivedBy: input.archive ? input.userId : null,
            updatedAt: now,
          }
          rows.set(existing.id, next)
          return next
        }),
      ),
      list: Effect.fn('HrCandidateService.list.memory')((input) =>
        Effect.succeed(
          Array.from(rows.values())
            .filter((row) => row.organizationId === input.organizationId)
            .filter((row) => row.mergedIntoCandidateId === null)
            .filter((row) =>
              input.includeArchived ? true : row.archivedAt === null,
            )
            .sort((a, b) => b.updatedAt - a.updatedAt),
        ),
      ),
      applyAiProfile: Effect.fn('HrCandidateService.applyAiProfile.memory')(
        (input) =>
          Effect.gen(function* () {
            const existing = yield* ensureSameOrg(
              input.organizationId,
              input.requestId,
              input.candidateId,
            )
            const incomingEmail = normalizeEmail(input.email)
            const emailOwner = incomingEmail
              ? Array.from(rows.values()).find(
                  (row) =>
                    row.organizationId === input.organizationId &&
                    row.normalizedEmail === incomingEmail.normalized &&
                    row.mergedIntoCandidateId === null &&
                    row.id !== existing.id,
                )
              : undefined
            const canAdoptIncomingEmail = incomingEmail !== null && !emailOwner
            const next: HrCandidateRow = {
              ...existing,
              displayName: input.displayName?.trim()?.length
                ? normalizeTextField(input.displayName)
                : existing.displayName,
              normalizedEmail: canAdoptIncomingEmail
                ? incomingEmail.normalized
                : existing.normalizedEmail,
              email: canAdoptIncomingEmail
                ? incomingEmail.display
                : existing.email,
              phone: input.phone ?? existing.phone,
              location: input.location ?? existing.location,
              headline: input.headline ?? existing.headline,
              summary: input.summary ?? existing.summary,
              yearsOfExperience:
                input.yearsOfExperience ?? existing.yearsOfExperience,
              skills: [...input.skills],
              languages: [...input.languages],
              highestDegree: input.highestDegree ?? existing.highestDegree,
              profileSource: input.profileSource,
              needsContactReview:
                (canAdoptIncomingEmail
                  ? incomingEmail.normalized
                  : existing.normalizedEmail) === null &&
                existing.needsContactReview,
              updatedAt: Date.now(),
            }
            rows.set(existing.id, next)
            return next
          }),
      ),
    } satisfies HrCandidateServiceShape
  })
}
