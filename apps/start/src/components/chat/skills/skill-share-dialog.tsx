/**
 * Share-settings dialog with two toggles (creator-only): share with
 * organization, and allow org admins to co-edit. Each toggle commits
 * its mutation on change — there is no Save button. Live row state is
 * the authoritative `checked` value so server commits don't flicker.
 */
'use client'

import { useState } from 'react'
import { FormDialog } from '@rift/ui/dialog'
import { Label } from '@rift/ui/label'
import { Switch } from '@rift/ui/switch'

import { m } from '@/paraglide/messages.js'

import type { SkillRow } from './skills-page.logic'

export function SkillShareDialog({
  skill,
  onClose,
  onShare,
  onUnshare,
  onToggleAdminEdit,
}: {
  /** Non-null while the dialog is open. */
  skill: SkillRow | null
  onClose: () => void
  onShare: (skill: SkillRow) => Promise<boolean>
  onUnshare: (skill: SkillRow) => Promise<boolean>
  onToggleAdminEdit: (skill: SkillRow, allow: boolean) => Promise<boolean>
}) {
  // Per-toggle pending flags so each Switch can disable itself while
  // its own mutation is in flight without locking the other one.
  const [sharePending, setSharePending] = useState(false)
  const [adminEditPending, setAdminEditPending] = useState(false)

  if (!skill) {
    // Render a closed dialog so FormDialog's mount/unmount animations
    // play out cleanly when the parent transitions to `null`.
    return (
      <FormDialog
        open={false}
        onOpenChange={(open) => (open ? null : onClose())}
        title=""
        description=""
        buttonText={m.chat_skill_share_dialog_close()}
      />
    )
  }

  const isShared = !!skill.organizationId

  return (
    <FormDialog
      open={true}
      onOpenChange={(open) => (open ? null : onClose())}
      title={m.chat_skill_share_dialog_title({ name: skill.name })}
      description={m.chat_skill_share_dialog_description()}
      buttonText={m.chat_skill_share_dialog_close()}
      buttonVariant="ghost"
      // Done is just a close — the toggles already committed.
      handleSubmit={async () => {
        onClose()
      }}
    >
      <div className="flex flex-col gap-4">
        <ShareToggleRow
          id={`skill-${skill.id}-share`}
          label={m.chat_skill_share_toggle_share_label()}
          helpText={m.chat_skill_share_toggle_share_description()}
          checked={isShared}
          disabled={sharePending}
          onCheckedChange={async (checked) => {
            setSharePending(true)
            try {
              if (checked) {
                await onShare(skill)
              } else {
                await onUnshare(skill)
              }
            } finally {
              setSharePending(false)
            }
          }}
        />
        <ShareToggleRow
          id={`skill-${skill.id}-admin-edit`}
          label={m.chat_skill_toggle_admin_edit()}
          helpText={
            isShared
              ? m.chat_skill_share_toggle_admin_edit_description()
              : m.chat_skill_share_toggle_admin_edit_disabled_hint()
          }
          // Disabled while unshared — the column is only honored when
          // `organization_id` is set, and disabling here also avoids
          // silently re-granting admin edit on a future re-share.
          disabled={!isShared || adminEditPending}
          checked={isShared && skill.allowAdminEdit}
          onCheckedChange={async (checked) => {
            setAdminEditPending(true)
            try {
              await onToggleAdminEdit(skill, checked)
            } finally {
              setAdminEditPending(false)
            }
          }}
        />
      </div>
    </FormDialog>
  )
}

function ShareToggleRow({
  id,
  label,
  helpText,
  checked,
  disabled,
  onCheckedChange,
}: {
  id: string
  label: string
  helpText: string
  checked: boolean
  disabled?: boolean
  onCheckedChange: (checked: boolean) => void | Promise<void>
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1 space-y-1">
        <Label htmlFor={id} className="text-sm font-medium text-foreground-strong">
          {label}
        </Label>
        <p className="text-xs text-foreground-tertiary">{helpText}</p>
      </div>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(value) => void onCheckedChange(value)}
      />
    </div>
  )
}
