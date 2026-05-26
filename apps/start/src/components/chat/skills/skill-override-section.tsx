/**
 * Per-project override grid: each visible Global Skill rendered as a
 * `SkillRowCard` whose footer slot hosts a visibility Switch instead
 * of the Edit button (on = visible in this project, off = hidden via
 * a `skill_project_overrides` row).
 */
'use client'

import { useMemo } from 'react'
import { Switch } from '@rift/ui/switch'

import { m } from '@/paraglide/messages.js'

import { SkillRowCard } from './skill-row-card'
import type { SkillRow } from './skills-page.logic'

export type OverrideToggle = (params: {
  readonly skillId: string
  readonly hidden: boolean
}) => void | Promise<void>

export function SkillOverrideSection({
  personalGlobals,
  orgGlobals,
  overrideSkillIds,
  onToggleOverride,
}: {
  personalGlobals: readonly SkillRow[]
  orgGlobals: readonly SkillRow[]
  overrideSkillIds: ReadonlySet<string>
  onToggleOverride: OverrideToggle
}) {
  // Org-shared first — typically more numerous and more likely to need
  // curation in a project context.
  const allGlobals = useMemo(
    () => [...orgGlobals, ...personalGlobals],
    [orgGlobals, personalGlobals],
  )

  if (allGlobals.length === 0) return null

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground-strong">
          {m.chat_skill_section_overrides_heading()}
        </h2>
        <p className="text-sm text-foreground-tertiary">
          {m.chat_skill_section_overrides_description()}
        </p>
      </div>

      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {allGlobals.map((skill) => {
          const overridden = overrideSkillIds.has(skill.id)
          const visibleHere = !overridden
          return (
            <SkillRowCard
              key={skill.id}
              skill={skill}
              canEdit={false}
              canManageSharing={false}
              onEdit={NOOP_EDIT}
              footerAction={
                <Switch
                  id={`override-${skill.id}`}
                  checked={visibleHere}
                  onCheckedChange={(checked) =>
                    void onToggleOverride({
                      skillId: skill.id,
                      hidden: !checked,
                    })
                  }
                  aria-label={
                    visibleHere
                      ? m.chat_skill_override_hide_aria({ name: skill.name })
                      : m.chat_skill_override_show_aria({ name: skill.name })
                  }
                />
              }
            />
          )
        })}
      </ul>
    </section>
  )
}

// Hoisted so React sees a stable reference; `SkillRowCard` types `onEdit`
// as required even though `canEdit={false}` makes it unreachable here.
const NOOP_EDIT = () => {}
