/**
 * Heading + responsive grid of skill cards. Pure layout — every
 * callback flows straight through to `SkillRowCard`.
 */
'use client'

import { SkillRowCard } from './skill-row-card'
import type { SkillRow } from './skills-page.logic'

export function SkillsSection({
  heading,
  description,
  skills,
  canEditSkill,
  canManageSharingFor,
  onEdit,
  onOpenShareDialog,
  emptyHint,
}: {
  /** Omit on surfaces that already label the list. */
  heading?: string
  description?: string
  skills: readonly SkillRow[]
  canEditSkill: (skill: SkillRow) => boolean
  canManageSharingFor: (skill: SkillRow) => boolean
  onEdit: (skill: SkillRow) => void
  onOpenShareDialog: (skill: SkillRow) => void
  emptyHint: string
}) {
  return (
    <section className="space-y-3">
      {heading || description ? (
        <div className="space-y-1">
          {heading ? (
            <h2 className="text-base font-semibold text-foreground-strong">
              {heading}
            </h2>
          ) : null}
          {description ? (
            <p className="text-sm text-foreground-tertiary">{description}</p>
          ) : null}
        </div>
      ) : null}

      {skills.length === 0 ? (
        <div className="rounded-xl border border-dashed border-surface-strong bg-surface-raised/40 px-4 py-6 text-sm text-foreground-tertiary">
          {emptyHint}
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {skills.map((skill) => (
            <SkillRowCard
              key={skill.id}
              skill={skill}
              canEdit={canEditSkill(skill)}
              canManageSharing={canManageSharingFor(skill)}
              onEdit={onEdit}
              onOpenShareDialog={onOpenShareDialog}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
