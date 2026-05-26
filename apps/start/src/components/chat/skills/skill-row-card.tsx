/**
 * Single-skill card in the management grid. Two interactive entry
 * points: the share icon (creator-only, opens share-settings dialog)
 * and the Edit button (any caller with edit access; the editor dialog
 * itself owns Delete). Body preview opens `SkillPreviewDialog` for
 * the full text.
 */
'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { Button } from '@rift/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@rift/ui/tooltip'
import Folder from 'lucide-react/dist/esm/icons/folder'
import Share2 from 'lucide-react/dist/esm/icons/share-2'
import User from 'lucide-react/dist/esm/icons/user'
import Users from 'lucide-react/dist/esm/icons/users'

import { getSkillScope } from '@/lib/shared/skills/skill-scope'
import type { SkillScope } from '@/lib/shared/skills/skill-scope'
import { m } from '@/paraglide/messages.js'

import { SkillPreviewDialog } from './skill-preview-dialog'
import { formatSkillTitle } from './skill-title'
import type { SkillRow } from './skills-page.logic'

export function SkillRowCard({
  skill,
  canEdit,
  canManageSharing,
  onEdit,
  onOpenShareDialog,
  footerAction,
}: {
  skill: SkillRow
  /** See `canEditSkill` in `skills-page.logic.ts`. Ignored when `footerAction` is provided. */
  canEdit: boolean
  /** Creator + non-project skill. Project Skills are not shareable per ADR-0005. */
  canManageSharing: boolean
  onEdit: (skill: SkillRow) => void
  /** Required when `canManageSharing` is true; ignored otherwise. */
  onOpenShareDialog?: (skill: SkillRow) => void
  /**
   * Optional footer-right slot replacing the default Edit button —
   * used by the Visible-globals override toggle on the project page.
   */
  footerAction?: ReactNode
}) {
  const scope = getSkillScope(skill)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

  return (
    // Two-layer surface mirroring the shared `Form` component: outer
    // wrapper transparent, inner content on `bg-surface-raised`,
    // footer's `bg-surface-strong/50` peeks through behind it.
    <li className="group/skill-card flex h-full flex-col overflow-hidden rounded-xl border border-surface-strong bg-transparent">
      <div className="relative flex h-full flex-col bg-surface-strong/50">
        <div className="relative z-10 flex flex-1 flex-col gap-3 rounded-b-2xl bg-surface-raised p-5 shadow-[0_2px_12px_rgb(0,0,0,0.05)]">
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-w-0 flex-1 truncate text-base font-semibold tracking-tight text-foreground-strong">
              {formatSkillTitle(skill.name)}
            </h3>
            {canManageSharing && onOpenShareDialog ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="iconSmall"
                      // Negative margins pull the icon flush with the
                      // card's padding without shifting the title baseline.
                      className="-mr-1.5 -mt-1.5 shrink-0"
                      aria-label={m.chat_skill_card_share_aria({
                        name: skill.name,
                      })}
                      onClick={() => onOpenShareDialog(skill)}
                    >
                      <Share2 className="size-4" />
                    </Button>
                  }
                />
                <TooltipContent side="top" sideOffset={4}>
                  {m.chat_skill_card_share_aria({ name: skill.name })}
                </TooltipContent>
              </Tooltip>
            ) : null}
          </div>
          {skill.description ? (
            <p className="line-clamp-2 text-sm text-foreground-secondary">
              {skill.description}
            </p>
          ) : null}

          {/*
           * Fixed `h-24` body preview so the blur band always lands on
           * predictable real estate: short bodies leave empty space
           * below, long bodies fill the box and the blur softens the
           * truncation edge. Without the fixed height a one-liner body
           * would sit immediately under the description and the blur
           * would land on the only line of content.
           */}
          <button
            type="button"
            onClick={() => setIsPreviewOpen(true)}
            aria-label={m.chat_skill_card_open_preview_aria({
              name: skill.name,
            })}
            className="group/skill-body relative flex h-24 w-full flex-col items-stretch overflow-hidden rounded-md text-left transition-colors hover:bg-surface-strong/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-strong/40"
          >
            <pre className="line-clamp-4 whitespace-pre-wrap break-words px-3 py-2 font-mono text-xs leading-relaxed text-foreground-secondary">
              {skill.body}
            </pre>
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-12 backdrop-blur-[1.5px]"
              style={{
                maskImage:
                  'linear-gradient(to top, rgb(0 0 0) 30%, rgb(0 0 0 / 0) 100%)',
                WebkitMaskImage:
                  'linear-gradient(to top, rgb(0 0 0) 30%, rgb(0 0 0 / 0) 100%)',
              }}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-surface-raised via-surface-raised/60 to-transparent"
            />
          </button>
        </div>

        <div className="relative z-0 -mt-3 flex items-center justify-between gap-3 rounded-b-xl border-t border-border-faint bg-surface-strong/50 px-4 pb-3 pt-5">
          <SkillScopeIndicator scope={scope} />
          {/* `h-8` lock so the override Switch (intrinsically `h-6`) occupies
              the same cell as the Edit button (`size="default"`). */}
          <div className="flex h-8 items-center">
            {footerAction !== undefined
              ? footerAction
              : canEdit
                ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="default"
                      onClick={() => onEdit(skill)}
                    >
                      {m.chat_skill_action_edit()}
                    </Button>
                  )
                : null}
          </div>
        </div>
      </div>

      <SkillPreviewDialog
        skill={isPreviewOpen ? skill : null}
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
      />
    </li>
  )
}

/**
 * Scope chip rendered in the card footer and reused by the empty-state
 * previews and the read-only preview dialog. Re-exports the shared
 * `getSkillScope` / `SkillScope` so leaf components only import from
 * this module.
 */
export function SkillScopeIndicator({ scope }: { scope: SkillScope }) {
  const visual = scopeVisual(scope)
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            tabIndex={0}
            className="inline-flex cursor-help items-center gap-1.5 text-xs font-medium text-foreground-tertiary"
          >
            <visual.Icon className="size-3.5" aria-hidden />
            {visual.label}
          </span>
        }
      />
      <TooltipContent side="top" sideOffset={4}>
        {visual.tooltip}
      </TooltipContent>
    </Tooltip>
  )
}

export { getSkillScope }
export type { SkillScope }

function scopeVisual(scope: SkillScope) {
  switch (scope) {
    case 'project':
      return {
        Icon: Folder,
        label: m.chat_skill_indicator_project(),
        tooltip: m.chat_skill_indicator_project_tooltip(),
      }
    case 'shared':
      return {
        Icon: Users,
        label: m.chat_skill_indicator_shared(),
        tooltip: m.chat_skill_indicator_shared_tooltip(),
      }
    case 'personal':
      return {
        Icon: User,
        label: m.chat_skill_indicator_personal(),
        tooltip: m.chat_skill_indicator_personal_tooltip(),
      }
  }
}
