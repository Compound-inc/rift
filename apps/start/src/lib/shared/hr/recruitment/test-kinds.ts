import type { HrTestKind } from './types'

/**
 * Built-in HR test catalog.
 *
 * The catalog is the closed list of test "kinds" the platform ships
 * with. Orgs always start with one `hr_test_template` row per kind
 * (seeded on first recruitment use) and can clone, edit, or extend
 * them. Custom test templates outside this catalog use kind `custom`.
 *
 * The catalog also encodes domain hints so the create-position dialog
 * can pre-select sensible defaults.
 * Hints are always editable; they never gate access.
 */

export type HrTestKindDefinition = {
  readonly kind: HrTestKind
  readonly label: string
  readonly description: string
  readonly defaultPassingScore: number
  /**
   * Tags whose presence on a position should auto-recommend this kind.
   * Match is case-insensitive and substring-based. Lower-frequency tags
   * earn higher recommendation weight in
   * `getRecommendedTestKinds`.
   */
  readonly recommendedForTags: readonly string[]
}

export const HR_TEST_KIND_CATALOG: Readonly<
  Record<HrTestKind, HrTestKindDefinition>
> = {
  technical: {
    kind: 'technical',
    label: 'Technical assessment',
    description:
      'Skill-specific take-home or interview problems used to gauge depth in the role’s primary stack.',
    defaultPassingScore: 70,
    recommendedForTags: [
      'engineer',
      'engineering',
      'developer',
      'data',
      'design',
      'security',
      'devops',
      'platform',
    ],
  },
  honesty: {
    kind: 'honesty',
    label: 'Honesty / integrity test',
    description:
      'Behavioral inventory used for roles that handle money, regulated data, or vulnerable populations.',
    defaultPassingScore: 75,
    recommendedForTags: [
      'finance',
      'banking',
      'bank',
      'money',
      'cashier',
      'compliance',
      'legal',
      'healthcare',
    ],
  },
  background: {
    kind: 'background',
    label: 'Background screening',
    description:
      'Mandatory baseline check for trust-sensitive roles. Real verification runs through the background-check addon.',
    defaultPassingScore: 100,
    recommendedForTags: [
      'finance',
      'banking',
      'bank',
      'money',
      'security',
      'healthcare',
      'legal',
      'driver',
      'fleet',
    ],
  },
  language: {
    kind: 'language',
    label: 'Language proficiency',
    description:
      'Written and / or spoken language proficiency for customer-facing roles or multilingual offices.',
    defaultPassingScore: 65,
    recommendedForTags: [
      'support',
      'success',
      'sales',
      'partnerships',
      'community',
      'hospitality',
    ],
  },
  behavioral: {
    kind: 'behavioral',
    label: 'Behavioral / situational',
    description:
      'Scenario-based questions that surface decision-making, ownership, and collaboration signal.',
    defaultPassingScore: 60,
    recommendedForTags: ['manager', 'lead', 'director', 'people', 'operations'],
  },
  custom: {
    kind: 'custom',
    label: 'Custom assessment',
    description:
      'Org-defined assessment. Use when none of the built-in kinds capture what the role demands.',
    defaultPassingScore: 70,
    recommendedForTags: [],
  },
}

/**
 * Returns the recommended built-in test kinds for a position, sorted by
 * relevance. Recommendations are heuristics: the create-position dialog
 * pre-selects them, the org admin can always edit.
 */
export function getRecommendedTestKinds(input: {
  readonly tags: readonly string[]
  readonly title?: string
  readonly department?: string
}): readonly HrTestKind[] {
  const haystack = [
    ...input.tags.map((tag) => tag.trim().toLowerCase()),
    input.title?.toLowerCase() ?? '',
    input.department?.toLowerCase() ?? '',
  ]
  const matches: { kind: HrTestKind; weight: number }[] = []

  for (const definition of Object.values(HR_TEST_KIND_CATALOG)) {
    if (definition.kind === 'custom') continue
    let weight = 0
    for (const tag of definition.recommendedForTags) {
      const needle = tag.toLowerCase()
      for (const candidate of haystack) {
        if (candidate.length > 0 && candidate.includes(needle)) {
          weight += 1
        }
      }
    }
    if (weight > 0) {
      matches.push({ kind: definition.kind, weight })
    }
  }

  matches.sort((a, b) => b.weight - a.weight)
  return matches.map((entry) => entry.kind)
}
