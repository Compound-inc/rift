/**
 * Read-only preview dialog for a skill. Built on `FormDialog` so the
 * chrome matches the editor and share dialogs; the submit button
 * doubles as Close.
 */
'use client'

import { FormDialog } from '@rift/ui/dialog'

import { m } from '@/paraglide/messages.js'

import {
  SkillScopeIndicator,
  getSkillScope,
} from './skill-row-card'
import { formatSkillTitle } from './skill-title'
import type { SkillRow } from './skills-page.logic'

export function SkillPreviewDialog({
  skill,
  open,
  onOpenChange,
}: {
  /** Pair with `open` so the dialog handles exit animations cleanly. */
  skill: SkillRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={skill ? formatSkillTitle(skill.name) : ''}
      // `undefined` when empty so FormDialog skips the paragraph
      // rather than rendering a phantom blank line.
      description={skill?.description ?? undefined}
      buttonText={m.chat_skill_preview_dialog_close()}
      buttonVariant="ghost"
      handleSubmit={async () => {
        onOpenChange(false)
      }}
    >
      {skill ? (
        <div className="flex flex-col gap-4">
          {/* Metadata: slug + scope chip. The dialog title hides the slash. */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-foreground-tertiary">
            <span className="font-mono">/{skill.name}</span>
            <span aria-hidden>·</span>
            <SkillScopeIndicator scope={getSkillScope(skill)} />
          </div>

          <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-border-faint bg-surface-strong/40 p-4">
            <pre className="whitespace-pre-wrap break-words font-mono text-sm leading-relaxed text-foreground-primary">
              {skill.body}
            </pre>
          </div>
        </div>
      ) : null}
    </FormDialog>
  )
}
