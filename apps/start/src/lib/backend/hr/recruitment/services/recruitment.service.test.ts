import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import {
  HrApplicationService,
  HrCandidateService,
  HrCvAiExtractorService,
  HrPositionService,
} from '..'

describe('HR Recruitment service layers (memory)', () => {
  it('creates a position scoped to the calling org', async () => {
    const program = Effect.gen(function* () {
      const service = yield* HrPositionService
      return yield* service.create({
        organizationId: 'org-1',
        userId: 'user-1',
        requestId: 'req-1',
        title: 'Senior Banking Analyst',
        department: 'Finance',
        tags: ['banking', 'finance'],
      })
    })

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(HrPositionService.layerMemory)),
    )

    expect(result.organizationId).toBe('org-1')
    expect(result.title).toBe('Senior Banking Analyst')
    // Banking + finance tags auto-recommend honesty + background tests.
    expect(result.recommendedEvaluationKinds).toContain('honesty')
    expect(result.recommendedEvaluationKinds).toContain('background')
  })

  it('refuses to read a position from a different org', async () => {
    const program = Effect.gen(function* () {
      const service = yield* HrPositionService
      const created = yield* service.create({
        organizationId: 'org-A',
        userId: 'user-1',
        requestId: 'req-1',
        title: 'Engineer',
      })
      return yield* service.findById({
        organizationId: 'org-B',
        positionId: created.id,
        requestId: 'req-2',
      })
    })

    await expect(
      Effect.runPromise(
        program.pipe(Effect.provide(HrPositionService.layerMemory)),
      ),
    ).rejects.toMatchObject({ _tag: 'HrCrossOrgAccessError' })
  })

  it('dedups candidates by normalized email per org', async () => {
    const program = Effect.gen(function* () {
      const service = yield* HrCandidateService
      const first = yield* service.upsertByEmail({
        organizationId: 'org-1',
        requestId: 'r1',
        email: 'Lina@Example.com',
        displayName: 'Lina Sanchez',
      })
      const second = yield* service.upsertByEmail({
        organizationId: 'org-1',
        requestId: 'r1',
        email: 'lina@example.com',
        displayName: 'Lina S.',
      })
      const otherOrg = yield* service.upsertByEmail({
        organizationId: 'org-2',
        requestId: 'r1',
        email: 'lina@example.com',
        displayName: 'Lina Sanchez',
      })
      return { first, second, otherOrg }
    })

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(HrCandidateService.layerMemory)),
    )
    expect(result.first.id).toBe(result.second.id)
    // Cross-org input must produce a different candidate row.
    expect(result.otherOrg.id).not.toBe(result.first.id)
  })

  it('records the AI affinity score on the application', async () => {
    const program = Effect.gen(function* () {
      const positionService = yield* HrPositionService
      const candidateService = yield* HrCandidateService
      const applicationService = yield* HrApplicationService
      const aiExtractor = yield* HrCvAiExtractorService

      const position = yield* positionService.create({
        organizationId: 'org-1',
        userId: 'user-1',
        requestId: 'r1',
        title: 'Backend Engineer',
        description: 'TypeScript, Postgres, Effect.',
      })
      const candidate = yield* candidateService.upsertByEmail({
        organizationId: 'org-1',
        requestId: 'r1',
        email: 'eng@example.com',
        displayName: 'Eng Candidate',
      })
      const application = yield* applicationService.create({
        organizationId: 'org-1',
        requestId: 'r1',
        candidateId: candidate.id,
        positionId: position.id,
        cvAttachmentId: null,
        cvText: 'TypeScript engineer with Postgres experience.',
      })
      const analysis = yield* aiExtractor.analyze({
        organizationId: 'org-1',
        requestId: 'r1',
        applicationId: application.id,
        fileName: 'eng.pdf',
        cvText: application.cvText ?? '',
        position: {
          title: position.title,
          description: position.description,
          tags: [],
          recommendedEvaluationKinds: [],
        },
      })
      const updated = yield* applicationService.setAffinity({
        organizationId: 'org-1',
        requestId: 'r1',
        applicationId: application.id,
        score: analysis.score,
        rationale: analysis.rationale,
        signals: analysis.signals,
        model: analysis.model,
      })
      return { analysis, updated }
    })

    const result = await Effect.runPromise(
      program.pipe(
        Effect.provide(HrPositionService.layerMemory),
        Effect.provide(HrCandidateService.layerMemory),
        Effect.provide(HrApplicationService.layerMemory),
        Effect.provide(HrCvAiExtractorService.layerMemory),
      ),
    )

    expect(result.analysis.score).toBeGreaterThan(0)
    expect(result.analysis.score).toBeLessThanOrEqual(100)
    expect(result.updated.affinityScore).toBe(result.analysis.score)
    expect(result.updated.affinityModel).toContain('memory')
  })

  it('rejects illegal stage transitions when the expected stage drifts', async () => {
    const program = Effect.gen(function* () {
      const positionService = yield* HrPositionService
      const candidateService = yield* HrCandidateService
      const applicationService = yield* HrApplicationService
      const position = yield* positionService.create({
        organizationId: 'org-1',
        userId: 'user-1',
        requestId: 'r1',
        title: 'Recruiter',
      })
      const candidate = yield* candidateService.upsertByEmail({
        organizationId: 'org-1',
        requestId: 'r1',
        email: 'a@example.com',
        displayName: 'A Candidate',
      })
      const application = yield* applicationService.create({
        organizationId: 'org-1',
        requestId: 'r1',
        candidateId: candidate.id,
        positionId: position.id,
        cvAttachmentId: null,
        cvText: 'Some CV body',
      })
      yield* applicationService.setStage({
        organizationId: 'org-1',
        requestId: 'r1',
        applicationId: application.id,
        nextStage: 'scoring',
      })
      return yield* applicationService.setStage({
        organizationId: 'org-1',
        requestId: 'r1',
        applicationId: application.id,
        expectedStage: 'uploaded',
        nextStage: 'awaiting_test',
      })
    })

    await expect(
      Effect.runPromise(
        program.pipe(
          Effect.provide(HrPositionService.layerMemory),
          Effect.provide(HrCandidateService.layerMemory),
          Effect.provide(HrApplicationService.layerMemory),
        ),
      ),
    ).rejects.toMatchObject({ _tag: 'HrApplicationStageConflictError' })
  })
})
