import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import {
  HrApplicationService,
  HrCandidateService,
  HrCvAiExtractorService,
  HrPositionService,
  extractFirstCvEmail,
} from '..'

describe('HR Recruitment service layers (memory)', () => {
  it('extracts the first syntactically valid email from CV text', () => {
    const email = extractFirstCvEmail({
      cvText:
        'Contact me @ LinkedIn, backup jane.alt@example.com, primary jane@example.com',
    })

    expect(email).toBe('jane.alt@example.com')
  })

  it('does not treat arbitrary @ text as an email placeholder', () => {
    const email = extractFirstCvEmail({
      cvText: 'Worked at @company and shipped TypeScript systems.',
    })

    expect(email).toBeNull()
  })

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
    // Position creation preserves role metadata while test dispatch
    // stays fixed to the shared catalog evaluation.
    expect(result.tags).toEqual(['banking', 'finance'])
  })

  it('archives a position without replacing its lifecycle status', async () => {
    const program = Effect.gen(function* () {
      const service = yield* HrPositionService
      const created = yield* service.create({
        organizationId: 'org-1',
        userId: 'user-1',
        requestId: 'req-1',
        title: 'Completed Search',
        status: 'filled',
      })
      const archived = yield* service.archive({
        organizationId: 'org-1',
        userId: 'user-1',
        requestId: 'req-2',
        positionId: created.id,
        archive: true,
      })
      const unarchived = yield* service.archive({
        organizationId: 'org-1',
        userId: 'user-1',
        requestId: 'req-3',
        positionId: created.id,
        archive: false,
      })
      return { archived, unarchived }
    })

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(HrPositionService.layerMemory)),
    )

    expect(result.archived.status).toBe('filled')
    expect(result.archived.archivedAt).not.toBeNull()
    expect(result.unarchived.status).toBe('filled')
    expect(result.unarchived.archivedAt).toBeNull()
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

  it('keeps placeholder candidates separate until AI extracts contact data', async () => {
    const program = Effect.gen(function* () {
      const service = yield* HrCandidateService
      const first = yield* service.upsertByEmail({
        organizationId: 'org-1',
        requestId: 'r1',
        email: null,
        displayName: 'Unknown candidate',
      })
      const second = yield* service.upsertByEmail({
        organizationId: 'org-1',
        requestId: 'r2',
        email: null,
        displayName: 'Unknown candidate',
      })
      return { first, second }
    })

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(HrCandidateService.layerMemory)),
    )
    expect(result.first.id).not.toBe(result.second.id)
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

  it('does not fail AI profile application when another candidate owns the same email', async () => {
    const program = Effect.gen(function* () {
      const service = yield* HrCandidateService
      const existing = yield* service.upsertByEmail({
        organizationId: 'org-1',
        requestId: 'r1',
        email: 'same@example.com',
        displayName: 'Existing Candidate',
      })
      const placeholder = yield* service.upsertByEmail({
        organizationId: 'org-1',
        requestId: 'r2',
        email: null,
        displayName: 'Unknown candidate',
      })
      const updated = yield* service.applyAiProfile({
        organizationId: 'org-1',
        requestId: 'r3',
        candidateId: placeholder.id,
        displayName: 'Same Candidate',
        email: 'same@example.com',
        phone: null,
        location: null,
        headline: 'Backend Engineer',
        summary: null,
        yearsOfExperience: null,
        skills: ['typescript'],
        languages: [],
        highestDegree: null,
        profileSource: 'ai-extractor:test',
      })
      return { existing, updated }
    })

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(HrCandidateService.layerMemory)),
    )
    expect(result.existing.email).toBe('same@example.com')
    expect(result.updated.email).toBeNull()
    expect(result.updated.headline).toBe('Backend Engineer')
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
