// Project Parameters page (`/chat/projects/$projectId/settings`).
//
// Mirrors the user account and org-general settings pattern: one Form
// section per editable field, each driven by a `useProjectFieldEditor`
// returned from `useProjectSettingsPageLogic`. The shared editor exposes
// `value`, `setInput`, `message`, `canSave`, and `submit` so each section
// reads as one configuration block instead of a hand-rolled state
// machine.
//
// The destructive Delete action keeps its confirmation dialog; the Save
// button on the danger card opens it instead of deleting on click.
'use client'

import type { ReactNode } from 'react'
import { FormDialog } from '@rift/ui/dialog'
import { Form } from '@rift/ui/form'
import { Textarea } from '@rift/ui/textarea'

import { ContentPage } from '@/components/layout'
import { m } from '@/paraglide/messages.js'

import { useProjectSettingsPageLogic } from './project-settings-page.logic'
import type { ProjectFieldEditor } from './project-settings-page.logic'

/**
 * Field section bound to a `ProjectFieldEditor` from the logic hook.
 * `Form`'s footer renders error/success styling based on which message slot
 * is populated, so we route the editor's discriminated message there
 * directly.
 */
function ProjectFieldFormSection({
  editor,
  canEdit,
  title,
  description,
  inputAttrs,
  helpText,
  forceActions,
  contentSlot,
}: {
  editor: ProjectFieldEditor
  canEdit: boolean
  title: string
  description: string
  inputAttrs?: Parameters<typeof Form>[0]['inputAttrs']
  helpText: ReactNode
  forceActions?: boolean
  contentSlot?: ReactNode
}) {
  const messageError =
    editor.message?.kind === 'error' ? editor.message.text : undefined
  const messageSuccess =
    editor.message?.kind === 'success' ? editor.message.text : undefined

  return (
    <Form
      title={title}
      description={description}
      inputAttrs={
        inputAttrs ? { ...inputAttrs, disabled: !canEdit } : undefined
      }
      value={inputAttrs ? editor.value : undefined}
      onValueChange={inputAttrs ? editor.setInput : undefined}
      contentSlot={contentSlot}
      forceActions={forceActions}
      helpText={helpText}
      error={messageError}
      success={messageSuccess}
      buttonText={m.common_save()}
      buttonDisabled={!canEdit || !editor.canSave}
      handleSubmit={editor.submit}
    />
  )
}

export function ProjectSettingsPage({ projectId }: { projectId: string }) {
  const {
    project,
    canEdit,
    nameEditor,
    descriptionEditor,
    instructionEditor,
    deleteDialogOpen,
    deleteSubmitting,
    deleteMessage,
    setDeleteDialogOpen,
    submitDelete,
    limits,
  } = useProjectSettingsPageLogic({ projectId })

  if (!project) return null

  return (
    <ContentPage
      title={m.chat_project_parameters_title()}
      description={m.chat_project_parameters_description()}
    >
      <ProjectFieldFormSection
        editor={nameEditor}
        canEdit={canEdit}
        title={m.chat_project_section_name_title()}
        description={m.chat_project_section_name_description()}
        inputAttrs={{
          name: 'projectName',
          type: 'text',
          placeholder: m.chat_project_field_name(),
          maxLength: limits.name,
        }}
        helpText={
          <p className="text-sm text-foreground-tertiary">
            {m.chat_project_name_help()}
          </p>
        }
      />

      <ProjectFieldFormSection
        editor={descriptionEditor}
        canEdit={canEdit}
        title={m.chat_project_section_description_title()}
        description={m.chat_project_section_description_description()}
        inputAttrs={{
          name: 'projectDescription',
          type: 'text',
          placeholder: m.chat_project_field_description_placeholder(),
          maxLength: limits.description,
        }}
        helpText={
          <p className="text-sm text-foreground-tertiary">
            {m.chat_project_description_help()}
          </p>
        }
      />

      {/*
       * The instruction textarea cannot use Form's built-in input, so it
       * lives in `contentSlot` and turns on `forceActions` to surface the
       * Save button row that the other sections get for free.
       */}
      <ProjectFieldFormSection
        editor={instructionEditor}
        canEdit={canEdit}
        title={m.chat_project_section_instruction()}
        description={m.chat_project_section_instruction_description()}
        forceActions
        contentSlot={
          <div className="flex flex-col gap-1.5">
            <Textarea
              id="project-instruction"
              value={instructionEditor.value}
              onChange={(event) =>
                instructionEditor.setInput(event.target.value)
              }
              rows={8}
              maxLength={limits.instruction}
              placeholder={m.chat_project_field_instruction_placeholder()}
              className="min-h-32"
              disabled={!canEdit}
            />
            <p
              className="self-end text-xs tabular-nums text-foreground-tertiary"
              aria-live="polite"
            >
              {instructionEditor.value.length} / {limits.instruction}
            </p>
          </div>
        }
        helpText={
          <p className="text-sm text-foreground-tertiary">
            {m.chat_project_instruction_help()}
          </p>
        }
      />

      {/*
       * Danger zone. `forceActions` surfaces the destructive button in the
       * same footer layout the rest of the page uses. The submit handler
       * only opens the confirmation dialog; the actual mutation runs from
       * the dialog's onSubmit so a stray Enter cannot delete a project.
       */}
      <Form
        title={m.chat_project_section_danger()}
        description={m.chat_project_delete_helper()}
        error={deleteMessage ?? undefined}
        helpText=""
        forceActions
        buttonText={m.chat_project_delete_button()}
        buttonVariant="danger"
        buttonDisabled={!canEdit}
        handleSubmit={async () => setDeleteDialogOpen(true)}
      />

      <FormDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={m.chat_project_delete_dialog_title()}
        description={m.chat_project_delete_confirm({ name: project.name })}
        buttonText={m.chat_project_delete_button()}
        buttonVariant="danger"
        secondaryButtonText={m.common_cancel()}
        onSecondaryClick={() => setDeleteDialogOpen(false)}
        buttonDisabled={deleteSubmitting}
        handleSubmit={submitDelete}
      />
    </ContentPage>
  )
}
