/**
 * Create / edit dialog for a skill. Presentational — the page owns
 * the actual mutation. Edit mode also exposes a Delete affordance
 * via `FormDialog`'s `tertiaryAction` slot, gated on `canEdit` to
 * mirror `assertSkillEditable`. Sharing controls live in
 * `SkillShareDialog`.
 */
'use client'

import { useState } from 'react'
import { Button } from '@rift/ui/button'
import { FormDialog } from '@rift/ui/dialog'
import { Input } from '@rift/ui/input'
import { Label } from '@rift/ui/label'
import { Textarea } from '@rift/ui/textarea'
import { toast } from 'sonner'

import { m } from '@/paraglide/messages.js'
import {
  SKILL_ERROR_CODE,
  SKILL_LIMITS,
  isValidSkillName,
  stripInvalidSkillNameChars,
} from '@/lib/shared/skills/skill-grammar'

import type { SkillRow } from './skills-page.logic'
import { describeSkillError } from './skills-page.logic'

export type SkillEditorState = {
  readonly mode: 'create' | 'edit'
  readonly skillId?: string
  readonly name: string
  readonly body: string
  readonly description: string
}

export function editorStateFromSkill(skill: SkillRow): SkillEditorState {
  return {
    mode: 'edit',
    skillId: skill.id,
    name: skill.name,
    body: skill.body,
    description: skill.description ?? '',
  }
}

export const EMPTY_EDITOR_STATE: SkillEditorState = {
  mode: 'create',
  name: '',
  body: '',
  description: '',
}

export function SkillEditorDialog({
  state,
  skill,
  canEdit,
  onChange,
  onClose,
  onSubmit,
  onDelete,
}: {
  /** Non-null while open. */
  state: SkillEditorState | null
  /**
   * Live row being edited. `undefined` in create mode or when the row
   * was deleted out from under us. Drives the destructive action's
   * visibility.
   */
  skill?: SkillRow
  canEdit: boolean
  onChange: (next: SkillEditorState) => void
  onClose: () => void
  /** Returns true on success so the dialog can close itself. */
  onSubmit: (state: SkillEditorState) => Promise<boolean>
  /** Pass `undefined` to suppress the Delete affordance. */
  onDelete?: (skill: SkillRow) => Promise<boolean>
}) {
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleSubmit = async () => {
    if (!state) return
    if (!isValidSkillName(state.name.trim())) {
      toast.error(describeSkillError(new Error(SKILL_ERROR_CODE.nameInvalid)))
      return
    }
    if (state.body.trim().length === 0) {
      toast.error(describeSkillError(new Error(SKILL_ERROR_CODE.bodyEmpty)))
      return
    }
    setSubmitting(true)
    try {
      const ok = await onSubmit(state)
      if (ok) onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const deleteVisible =
    state?.mode === 'edit' && !!skill && !!onDelete && canEdit

  return (
    <FormDialog
      open={state !== null}
      onOpenChange={(open) => (open ? null : onClose())}
      title={
        state?.mode === 'edit'
          ? m.chat_skill_dialog_title_edit()
          : m.chat_skill_dialog_title_create()
      }
      description={m.chat_skill_dialog_description()}
      buttonText={
        state?.mode === 'edit'
          ? m.chat_skill_dialog_save()
          : m.chat_skill_dialog_create()
      }
      secondaryButtonText={m.chat_skill_dialog_cancel()}
      onSecondaryClick={onClose}
      buttonDisabled={submitting || deleting}
      tertiaryAction={
        deleteVisible ? (
          <Button
            type="button"
            variant="dangerLight"
            size="large"
            disabled={deleting || submitting}
            onClick={async () => {
              if (!skill || !onDelete) return
              setDeleting(true)
              try {
                const ok = await onDelete(skill)
                if (ok) onClose()
              } finally {
                setDeleting(false)
              }
            }}
          >
            {m.chat_skill_action_delete()}
          </Button>
        ) : null
      }
      handleSubmit={handleSubmit}
    >
      {state !== null ? (
        <SkillEditorBody state={state} onChange={onChange} />
      ) : null}
    </FormDialog>
  )
}

function SkillEditorBody({
  state,
  onChange,
}: {
  state: SkillEditorState
  onChange: (next: SkillEditorState) => void
}) {
  const update = (patch: Partial<SkillEditorState>) =>
    onChange({ ...state, ...patch })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="skill-name">{m.chat_skill_field_name_label()}</Label>
        <Input
          id="skill-name"
          value={state.name}
          // Strip disallowed characters live (paste also fires `change`)
          // so the input is grammar-valid by construction rather than
          // showing a deferred validation toast on submit.
          onChange={(e) =>
            update({ name: stripInvalidSkillNameChars(e.target.value) })
          }
          placeholder={m.chat_skill_field_name_placeholder()}
          maxLength={SKILL_LIMITS.nameMax}
        />
        <p className="text-xs text-foreground-tertiary">
          {m.chat_skill_field_name_help({ max: SKILL_LIMITS.nameMax })}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="skill-description">
          {m.chat_skill_field_description_label()}{' '}
          <span className="text-foreground-tertiary">
            {m.chat_skill_field_description_optional()}
          </span>
        </Label>
        <Input
          id="skill-description"
          value={state.description}
          onChange={(e) => update({ description: e.target.value })}
          placeholder={m.chat_skill_field_description_placeholder()}
          maxLength={SKILL_LIMITS.descriptionMax}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="skill-body">{m.chat_skill_field_body_label()}</Label>
        <Textarea
          id="skill-body"
          value={state.body}
          onChange={(e) => update({ body: e.target.value })}
          rows={10}
          maxLength={SKILL_LIMITS.bodyMax}
          placeholder={m.chat_skill_field_body_placeholder()}
          // Editor uses sans-serif (cards keep `font-mono`) so the
          // textarea reads as long-form input rather than code.
          className="min-h-40 text-sm"
        />
        <p
          className="self-end text-xs tabular-nums text-foreground-tertiary"
          aria-live="polite"
        >
          {state.body.length} / {SKILL_LIMITS.bodyMax}
        </p>
      </div>
    </div>
  )
}
