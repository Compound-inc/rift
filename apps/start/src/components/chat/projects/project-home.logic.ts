import { canonicalSkillName } from '@/lib/shared/skills/skill-grammar'
import type { SkillRow } from '@/lib/shared/skills/skill-row'

/** Mirrors the send-time Project > Org-Shared > Personal skill resolution. */
export function activeProjectSkills(input: {
  readonly project: readonly SkillRow[]
  readonly org: readonly SkillRow[]
  readonly personal: readonly SkillRow[]
  readonly hiddenIds: ReadonlySet<string>
}): readonly SkillRow[] {
  const byName = new Map<string, SkillRow>()
  for (const skill of [...input.project, ...input.org, ...input.personal]) {
    if (skill.deletedAt || (!skill.projectId && input.hiddenIds.has(skill.id)))
      continue
    const name = canonicalSkillName(skill.name)
    if (!byName.has(name)) byName.set(name, skill)
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/** Sort independently of sidebar pins and exclude archived rows defensively. */
export function projectHomeThreads<
  T extends {
    readonly threadId: string
    readonly title?: string | null
    readonly updatedAt: number
    readonly visibility: string
  },
>(threads: readonly T[], search = ''): readonly T[] {
  const term = search.trim().toLocaleLowerCase()
  return threads
    .filter(
      (thread) =>
        thread.visibility === 'visible' &&
        (!term || thread.title?.toLocaleLowerCase().includes(term)),
    )
    .sort(
      (a, b) =>
        b.updatedAt - a.updatedAt || b.threadId.localeCompare(a.threadId),
    )
}
