import { describe, expect, it } from 'vitest'
import {
  buildMemoryAnalysis,
  CvAiAnalysisOutputSchema,
  CvAiRawAnalysisSchema,
  normalizeCvAiAnalysis,
} from './analysis'
import type { CvAiRawAnalysis } from './analysis'

const baseRawAnalysis: CvAiRawAnalysis = {
  displayName: 'Jane Candidate',
  email: 'jane@example.com',
  phone: null,
  location: null,
  headline: null,
  summary: null,
  yearsOfExperience: null,
  skills: [],
  languages: [],
  highestDegree: null,
  score: 80,
  rationale: 'Strong relevant experience.',
  strengths: [],
  redFlags: [],
}

function hasJsonSchemaKeyword(value: unknown, keyword: string): boolean {
  if (Array.isArray(value)) {
    return value.some((item) => hasJsonSchemaKeyword(item, keyword))
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).some(
      ([key, item]) => key === keyword || hasJsonSchemaKeyword(item, keyword),
    )
  }

  return false
}

describe('CV AI analysis helpers', () => {
  it('uses a gateway-compatible response schema for the Affinity score', async () => {
    const jsonSchema = await CvAiAnalysisOutputSchema.jsonSchema

    expect(jsonSchema.properties?.score).toMatchObject({
      type: 'integer',
      minimum: 0,
      maximum: 100,
    })
    expect(hasJsonSchemaKeyword(jsonSchema, 'allOf')).toBe(false)
  })

  it('rejects invalid Affinity scores instead of clamping or rounding them', async () => {
    expect(() =>
      CvAiRawAnalysisSchema.parse({
        ...baseRawAnalysis,
        score: 101,
      }),
    ).toThrow()

    const outputValidation = await CvAiAnalysisOutputSchema.validate?.({
      ...baseRawAnalysis,
      score: 101,
    })

    expect(outputValidation).toMatchObject({ success: false })

    expect(() =>
      CvAiRawAnalysisSchema.parse({
        ...baseRawAnalysis,
        score: -1,
      }),
    ).toThrow()

    expect(() =>
      CvAiRawAnalysisSchema.parse({
        ...baseRawAnalysis,
        score: 72.5,
      }),
    ).toThrow()
  })

  it('normalizes low-risk Candidate profile noise without changing the score', () => {
    const analysis = normalizeCvAiAnalysis(
      {
        ...baseRawAnalysis,
        displayName: '  Jane Candidate  ',
        email: 'not-an-email',
        phone: '  ',
        location: '  Paris, France  ',
        yearsOfExperience: 120,
        skills: [' TypeScript ', 'typescript', '', ' Effect '],
        languages: [' English ', '', 'French'],
        score: 72,
        rationale: '  Good TypeScript and Effect evidence.  ',
        strengths: [' TypeScript ', '', 'Effect'],
        redFlags: ['  Limited leadership evidence  '],
      },
      'test-model',
    )

    expect(analysis.profile.displayName).toBe('Jane Candidate')
    expect(analysis.profile.email).toBeNull()
    expect(analysis.profile.phone).toBeNull()
    expect(analysis.profile.location).toBe('Paris, France')
    expect(analysis.profile.yearsOfExperience).toBeNull()
    expect(analysis.profile.skills).toEqual(['typescript', 'effect'])
    expect(analysis.profile.languages).toEqual(['English', 'French'])
    expect(analysis.score).toBe(72)
    expect(analysis.rationale).toBe('Good TypeScript and Effect evidence.')
    expect(analysis.signals).toMatchObject({
      strengths: 'TypeScript | Effect',
      redFlags: 'Limited leadership evidence',
    })
  })

  it('keeps the memory adapter score naturally within the Affinity range', () => {
    const analysis = buildMemoryAnalysis({
      organizationId: 'org-1',
      requestId: 'req-1',
      applicationId: 'app-1',
      fileName: 'candidate.pdf',
      cvText: 'TypeScript TypeScript Postgres delivery',
      position: {
        title: 'Backend Engineer',
        description: 'TypeScript and Postgres',
        tags: ['effect'],
      },
    })

    expect(analysis.score).toBeGreaterThanOrEqual(0)
    expect(analysis.score).toBeLessThanOrEqual(100)
    expect(analysis.model).toBe('memory-ai-extractor')
  })
})
