import type { HrEvaluationKind } from './types'

/**
 * Hardcoded evaluation catalog.
 *
 * Each entry is a self-contained evaluation: questions + correct
 * answers. The id is a stable string (e.g. `screening-engineering-v1`)
 * the dispatch row stores in `evaluation_catalog_id` so retrievals
 * know which catalog entry to load.
 *
 * Custom org-defined evaluations are not yet implemented; when they
 * land they will likely live in a future `hr_evaluation_template`
 * table whose UUIDs share the same column. For now the column is
 * authoritative and FK-less.
 */

export type HrEvaluationCatalogId =
  | 'screening-technical-v1'
  | 'screening-honesty-v1'
  | 'screening-behavioral-v1'
  | 'screening-language-en-v1'

export type HrEvaluationChoice = {
  readonly id: string
  readonly label: string
}

export type HrEvaluationQuestion = {
  readonly id: string
  readonly prompt: string
  readonly choices: readonly HrEvaluationChoice[]
  /** id of the choice that counts as a correct answer. */
  readonly correctChoiceId: string
}

export type HrEvaluationCatalogEntry = {
  readonly id: HrEvaluationCatalogId
  readonly kind: HrEvaluationKind
  readonly title: string
  readonly description: string
  readonly passingScore: number
  readonly questions: readonly HrEvaluationQuestion[]
}

export const HR_EVALUATION_CATALOG: Readonly<
  Record<HrEvaluationCatalogId, HrEvaluationCatalogEntry>
> = {
  'screening-technical-v1': {
    id: 'screening-technical-v1',
    kind: 'technical',
    title: 'Technical screening',
    description:
      'Five short multiple-choice questions covering software fundamentals.',
    passingScore: 70,
    questions: [
      {
        id: 'q1',
        prompt:
          'In a relational database, which clause is used to combine rows from two tables based on a related column?',
        choices: [
          { id: 'a', label: 'GROUP BY' },
          { id: 'b', label: 'JOIN' },
          { id: 'c', label: 'WHERE' },
          { id: 'd', label: 'ORDER BY' },
        ],
        correctChoiceId: 'b',
      },
      {
        id: 'q2',
        prompt: 'Which HTTP status code indicates a resource was not found?',
        choices: [
          { id: 'a', label: '200' },
          { id: 'b', label: '301' },
          { id: 'c', label: '404' },
          { id: 'd', label: '500' },
        ],
        correctChoiceId: 'c',
      },
      {
        id: 'q3',
        prompt:
          'In TypeScript, which keyword declares a value that cannot be reassigned?',
        choices: [
          { id: 'a', label: 'let' },
          { id: 'b', label: 'var' },
          { id: 'c', label: 'const' },
          { id: 'd', label: 'static' },
        ],
        correctChoiceId: 'c',
      },
      {
        id: 'q4',
        prompt:
          'What is the time complexity of a binary search over a sorted array of n elements?',
        choices: [
          { id: 'a', label: 'O(1)' },
          { id: 'b', label: 'O(log n)' },
          { id: 'c', label: 'O(n)' },
          { id: 'd', label: 'O(n log n)' },
        ],
        correctChoiceId: 'b',
      },
      {
        id: 'q5',
        prompt:
          'Which protocol is most commonly used to securely transfer files between machines today?',
        choices: [
          { id: 'a', label: 'FTP' },
          { id: 'b', label: 'TELNET' },
          { id: 'c', label: 'SSH/SFTP' },
          { id: 'd', label: 'SMTP' },
        ],
        correctChoiceId: 'c',
      },
    ],
  },
  'screening-honesty-v1': {
    id: 'screening-honesty-v1',
    kind: 'honesty',
    title: 'Honesty & integrity screening',
    description:
      'Four scenario-based questions for trust-sensitive roles (banking, finance, regulated data).',
    passingScore: 75,
    questions: [
      {
        id: 'q1',
        prompt:
          'You discover a colleague has accidentally been processing transactions under the wrong account. What do you do first?',
        choices: [
          { id: 'a', label: 'Quietly fix the records yourself.' },
          {
            id: 'b',
            label: 'Report it to your manager and document the issue.',
          },
          { id: 'c', label: 'Wait until someone else notices.' },
          { id: 'd', label: 'Ask the colleague to keep it between you two.' },
        ],
        correctChoiceId: 'b',
      },
      {
        id: 'q2',
        prompt:
          'A customer offers you a personal gift for prioritizing their request. The proper response is to:',
        choices: [
          { id: 'a', label: 'Accept it; you have to make customers happy.' },
          {
            id: 'b',
            label:
              'Decline politely and disclose the offer to your supervisor.',
          },
          { id: 'c', label: 'Accept it but not tell anyone.' },
          { id: 'd', label: 'Trade it for something the team can share.' },
        ],
        correctChoiceId: 'b',
      },
      {
        id: 'q3',
        prompt:
          'You are asked to enter expenses you did not actually incur to "balance the books". What do you do?',
        choices: [
          { id: 'a', label: 'Comply; it is a small amount.' },
          {
            id: 'b',
            label:
              'Refuse and escalate to compliance / a higher-level manager.',
          },
          { id: 'c', label: 'Comply but keep notes "in case".' },
          { id: 'd', label: 'Ask the requester to do it themselves.' },
        ],
        correctChoiceId: 'b',
      },
      {
        id: 'q4',
        prompt:
          'You realize a report you submitted last week contains a number that is wrong. The deadline has passed.',
        choices: [
          { id: 'a', label: 'Hope nobody notices.' },
          {
            id: 'b',
            label:
              'Issue a corrected report and inform stakeholders proactively.',
          },
          { id: 'c', label: 'Delete the original.' },
          { id: 'd', label: 'Blame an unclear data source.' },
        ],
        correctChoiceId: 'b',
      },
    ],
  },
  'screening-behavioral-v1': {
    id: 'screening-behavioral-v1',
    kind: 'behavioral',
    title: 'Behavioral & ownership screening',
    description:
      'Four situational questions about decision-making, ownership, and collaboration.',
    passingScore: 60,
    questions: [
      {
        id: 'q1',
        prompt:
          'You inherit a project with no documentation and a tight deadline. Your first move is:',
        choices: [
          { id: 'a', label: 'Start coding immediately to make progress.' },
          {
            id: 'b',
            label:
              'Map the system, talk to stakeholders, and write down assumptions before changes.',
          },
          { id: 'c', label: 'Wait for someone to write docs.' },
          { id: 'd', label: 'Rebuild from scratch.' },
        ],
        correctChoiceId: 'b',
      },
      {
        id: 'q2',
        prompt:
          'A teammate disagrees with your design decision. The healthy response is:',
        choices: [
          { id: 'a', label: 'Insist you are right and move on.' },
          {
            id: 'b',
            label:
              'Hear out the concern, share trade-offs, and align on the call together.',
          },
          { id: 'c', label: 'Avoid the conversation.' },
          { id: 'd', label: 'Escalate immediately.' },
        ],
        correctChoiceId: 'b',
      },
      {
        id: 'q3',
        prompt:
          'You shipped a feature that introduced a regression in production. You should:',
        choices: [
          { id: 'a', label: 'Wait for someone else to fix it.' },
          {
            id: 'b',
            label:
              'Take ownership: roll back, communicate, and post-mortem after.',
          },
          { id: 'c', label: 'Blame upstream code.' },
          { id: 'd', label: 'Quietly patch and move on.' },
        ],
        correctChoiceId: 'b',
      },
      {
        id: 'q4',
        prompt: 'A request feels under-specified. The right thing to do is:',
        choices: [
          {
            id: 'a',
            label: 'Make assumptions and ship; you can iterate later.',
          },
          {
            id: 'b',
            label:
              'Clarify the goal and constraints before committing to a solution.',
          },
          { id: 'c', label: 'Reject the request.' },
          { id: 'd', label: 'Wait until someone clarifies.' },
        ],
        correctChoiceId: 'b',
      },
    ],
  },
  'screening-language-en-v1': {
    id: 'screening-language-en-v1',
    kind: 'language',
    title: 'English proficiency screening',
    description:
      'Four short questions checking practical written-English comprehension.',
    passingScore: 65,
    questions: [
      {
        id: 'q1',
        prompt:
          '"The team meets every other Tuesday." How often does the team meet?',
        choices: [
          { id: 'a', label: 'Every Tuesday.' },
          { id: 'b', label: 'Twice a week.' },
          { id: 'c', label: 'Once every two weeks, on Tuesday.' },
          { id: 'd', label: 'Once a month.' },
        ],
        correctChoiceId: 'c',
      },
      {
        id: 'q2',
        prompt: 'Choose the grammatically correct sentence:',
        choices: [
          { id: 'a', label: "She don't have any questions." },
          { id: 'b', label: "She doesn't have any questions." },
          { id: 'c', label: 'She not have any questions.' },
          { id: 'd', label: "She haven't no questions." },
        ],
        correctChoiceId: 'b',
      },
      {
        id: 'q3',
        prompt:
          '"Please follow up with the client by end of day Friday." This means:',
        choices: [
          { id: 'a', label: 'Contact the client before Friday ends.' },
          { id: 'b', label: 'Wait for the client to contact you on Friday.' },
          { id: 'c', label: 'Contact the client next Monday.' },
          { id: 'd', label: 'Send the client a meeting invite for Friday.' },
        ],
        correctChoiceId: 'a',
      },
      {
        id: 'q4',
        prompt: 'Which option is the most professional written reply?',
        choices: [
          { id: 'a', label: 'k thx' },
          { id: 'b', label: 'sure thing!!' },
          {
            id: 'c',
            label:
              "Thanks for the update — I'll review it today and get back to you.",
          },
          { id: 'd', label: 'whatever works' },
        ],
        correctChoiceId: 'c',
      },
    ],
  },
}

export const HR_EVALUATION_CATALOG_BY_KIND: Readonly<
  Partial<Record<HrEvaluationKind, HrEvaluationCatalogId>>
> = {
  technical: 'screening-technical-v1',
  honesty: 'screening-honesty-v1',
  behavioral: 'screening-behavioral-v1',
  language: 'screening-language-en-v1',
}

export function getEvaluationCatalogEntry(
  id: string,
): HrEvaluationCatalogEntry | undefined {
  return (HR_EVALUATION_CATALOG as Record<string, HrEvaluationCatalogEntry>)[id]
}

/**
 * Picks the catalog id for a position. Used by the workflow's
 * `resolveDefaultEvaluationStep`. When the per-position selection UI
 * lands the workflow will read the chosen id from a position-scoped
 * mapping instead of relying on this fallback.
 */
export function pickDefaultEvaluationForPosition(input: {
  readonly recommendedKinds: readonly HrEvaluationKind[]
}): HrEvaluationCatalogId {
  for (const kind of input.recommendedKinds) {
    const id = HR_EVALUATION_CATALOG_BY_KIND[kind]
    if (id) return id
  }
  return 'screening-behavioral-v1'
}

/**
 * Heuristic that maps position metadata to suggested evaluation
 * kinds. Drives the position row's `recommended_evaluation_kinds`
 * JSON column so the create-position dialog can pre-select sensible
 * defaults without an AI call.
 */
const KIND_TAG_HINTS: Readonly<Record<HrEvaluationKind, readonly string[]>> = {
  technical: ['engineer', 'engineering', 'developer', 'data', 'platform'],
  honesty: ['finance', 'banking', 'bank', 'money', 'compliance'],
  background: ['finance', 'banking', 'security', 'driver', 'legal'],
  language: ['support', 'sales', 'success', 'partnerships', 'community'],
  behavioral: ['manager', 'lead', 'director', 'people', 'operations'],
}

export function getRecommendedEvaluationKinds(input: {
  readonly tags: readonly string[]
  readonly title?: string
  readonly department?: string
}): readonly HrEvaluationKind[] {
  const haystack = [
    ...input.tags.map((tag) => tag.trim().toLowerCase()),
    input.title?.toLowerCase() ?? '',
    input.department?.toLowerCase() ?? '',
  ]
  const matches: { kind: HrEvaluationKind; weight: number }[] = []
  for (const [kind, hints] of Object.entries(KIND_TAG_HINTS) as readonly [
    HrEvaluationKind,
    readonly string[],
  ][]) {
    let weight = 0
    for (const tag of hints) {
      const needle = tag.toLowerCase()
      for (const candidate of haystack) {
        if (candidate.length > 0 && candidate.includes(needle)) {
          weight += 1
        }
      }
    }
    if (weight > 0) matches.push({ kind, weight })
  }
  matches.sort((a, b) => b.weight - a.weight)
  return matches.map((entry) => entry.kind)
}

/**
 * Computes a 0..100 score and pass/fail for a submission against a
 * catalog entry. Unrecognized question ids are ignored so a future
 * catalog version cannot crash old submissions.
 */
export function scoreEvaluationSubmission(input: {
  readonly entry: HrEvaluationCatalogEntry
  readonly answers: readonly { questionId: string; choiceId: string }[]
}): {
  readonly score: number
  readonly passed: boolean
  readonly correct: number
  readonly total: number
} {
  const total = input.entry.questions.length
  if (total === 0) {
    return { score: 0, passed: false, correct: 0, total: 0 }
  }
  const answersByQuestion = new Map(
    input.answers.map((entry) => [entry.questionId, entry.choiceId] as const),
  )
  let correct = 0
  for (const question of input.entry.questions) {
    if (answersByQuestion.get(question.id) === question.correctChoiceId) {
      correct += 1
    }
  }
  const score = Math.round((correct / total) * 100)
  return {
    score,
    passed: score >= input.entry.passingScore,
    correct,
    total,
  }
}
