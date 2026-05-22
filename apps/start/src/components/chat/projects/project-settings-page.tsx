// Project Parameters page (`/chat/projects/$projectId/settings`).
//
// Mirrors the user account and org-general settings pattern: each
// editable field gets its own `Form` section with built-in input and an
// explicit Save button. Per-section error and success messages render
// inline via the Form footer instead of toasts. The custom-instruction
// textarea uses `contentSlot` + `forceActions` because the shared Form
// component does not expose a built-in textarea.
//
// All write paths go through Zero mutators so changes surface to other
// tabs and routes immediately. The destructive Delete action keeps its
// confirmation dialog; the Save button on the danger card simply opens
// it instead of deleting on click.
'use client'

import { FormDialog } from '@rift/ui/dialog'
import { Form } from '@rift/ui/form'
import { Textarea } from '@rift/ui/textarea'

import { ContentPage } from '@/components/layout'
import { m } from '@/paraglide/messages.js'

import { useProjectSettingsPageLogic } from './project-settings-page.logic'

export function ProjectSettingsPage({ projectId }: { projectId: string }) {
  const {
    project,
    canEdit,
    name,
    description,
    instruction,
    nameMessage,
    descriptionMessage,
    instructionMessage,
    deleteDialogOpen,
    deleteSubmitting,
    deleteMessage,
    setNameInput,
    setDescriptionInput,
    setInstructionInput,
    setDeleteDialogOpen,
    submitName,
    submitDescription,
    submitInstruction,
    submitDelete,
    limits,
  } = useProjectSettingsPageLogic({ projectId })

  if (!project) return null

  // The Form component renders `success` styling when the message string
  // is the success constant for that section, otherwise treats it as an
  // error. This mirrors the account page convention exactly.
  const nameSuccess =
    nameMessage === m.chat_project_name_saved() ? nameMessage : undefined
  const descriptionSuccess =
    descriptionMessage === m.chat_project_description_saved()
      ? descriptionMessage
      : undefined
  const instructionSuccess =
    instructionMessage === m.chat_project_instruction_saved()
      ? instructionMessage
      : undefined

  const trimmedName = name.trim()
  const nameUnchanged = trimmedName === project.name
  const descriptionUnchanged =
    (description.trim() || null) === (project.description ?? null)
  const instructionUnchanged =
    (instruction.length > 0 ? instruction : null) ===
    (project.customInstruction ?? null)

  return (
    <ContentPage
      title={m.chat_project_parameters_title()}
      description={m.chat_project_parameters_description()}
    >
      <Form
        title={m.chat_project_section_name_title()}
        description={m.chat_project_section_name_description()}
        inputAttrs={{
          name: 'projectName',
          type: 'text',
          placeholder: m.chat_project_field_name(),
          maxLength: limits.name,
          disabled: !canEdit,
        }}
        value={name}
        onValueChange={setNameInput}
        error={
          nameMessage != null && nameMessage !== m.chat_project_name_saved()
            ? nameMessage
            : undefined
        }
        success={nameSuccess}
        helpText={
          <p className="text-sm text-foreground-tertiary">
            {m.chat_project_name_help()}
          </p>
        }
        buttonText={m.common_save()}
        buttonDisabled={!canEdit || trimmedName.length === 0 || nameUnchanged}
        handleSubmit={submitName}
      />

      <Form
        title={m.chat_project_section_description_title()}
        description={m.chat_project_section_description_description()}
        inputAttrs={{
          name: 'projectDescription',
          type: 'text',
          placeholder: m.chat_project_field_description_placeholder(),
          maxLength: limits.description,
          disabled: !canEdit,
        }}
        value={description}
        onValueChange={setDescriptionInput}
        error={
          descriptionMessage != null &&
          descriptionMessage !== m.chat_project_description_saved()
            ? descriptionMessage
            : undefined
        }
        success={descriptionSuccess}
        helpText={
          <p className="text-sm text-foreground-tertiary">
            {m.chat_project_description_help()}
          </p>
        }
        buttonText={m.common_save()}
        buttonDisabled={!canEdit || descriptionUnchanged}
        handleSubmit={submitDescription}
      />

      {/*
       * The instruction textarea cannot use Form's built-in input, so it
       * lives in `contentSlot` and turns on `forceActions` to surface the
       * Save button row that the other sections get for free.
       */}
      <Form
        title={m.chat_project_section_instruction()}
        description={m.chat_project_section_instruction_description()}
        forceActions
        contentSlot={
          <div className="flex flex-col gap-1.5">
            <Textarea
              id="project-instruction"
              value={instruction}
              onChange={(event) => setInstructionInput(event.target.value)}
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
              {instruction.length} / {limits.instruction}
            </p>
          </div>
        }
        error={
          instructionMessage != null &&
          instructionMessage !== m.chat_project_instruction_saved()
            ? instructionMessage
            : undefined
        }
        success={instructionSuccess}
        helpText={
          <p className="text-sm text-foreground-tertiary">
            {m.chat_project_instruction_help()}
          </p>
        }
        buttonText={m.common_save()}
        buttonDisabled={!canEdit || instructionUnchanged}
        handleSubmit={submitInstruction}
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
