'use client'

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery, useZero } from '@rocicorp/zero/react'
import type { QueryResultType } from '@rocicorp/zero'

import { mutators, queries } from '@/integrations/zero'
import { useProjectManagementAccess } from '@/lib/frontend/projects/use-project-management-access'
import { m } from '@/paraglide/messages.js'

/**
 * Centralized state and submit handlers for the project parameters page.
 *
 * The component renders one section per editable field (name, description,
 * custom instruction). Each section gets its own `useProjectFieldEditor`
 * — a tiny state machine: hydrate from the persisted row when it loads,
 * track a local draft, surface a per-section success/error message, and
 * push the change through the unified `projects.update` mutator on submit.
 */

const NAME_MAX = 80
const DESCRIPTION_MAX = 500
const INSTRUCTION_MAX = 8000

export type ProjectFieldKey = 'name' | 'description' | 'customInstruction'

type FieldDefinition = {
  /** Read the persisted value for this field from the project row. */
  readonly readPersisted: (project: ProjectRow) => string
  /** Maps the local draft string to the patch value sent to the mutator. */
  readonly draftToPatch: (
    draft: string,
  ) =>
    | { readonly skip: true }
    | { readonly skip: false; readonly value: string | null }
  /** Optional client-side validation; returns an error message or null. */
  readonly validate?: (draft: string) => string | null
  /** Message shown after a successful save. */
  readonly successMessage: () => string
}

type ProjectRow = NonNullable<QueryResultType<typeof queries.projects.byId>>

/**
 * Per-field policy. Centralizing this means adding a new editable column
 * is one entry here plus a new patch field on the mutator side, instead
 * of three near-duplicate hooks + forms.
 */
const FIELD_DEFINITIONS: Record<ProjectFieldKey, FieldDefinition> = {
  name: {
    readPersisted: (project) => project.name,
    draftToPatch: (draft) => {
      const trimmed = draft.trim()
      return trimmed.length === 0
        ? { skip: true }
        : { skip: false, value: trimmed }
    },
    validate: (draft) =>
      draft.trim().length === 0 ? m.chat_project_error_name_empty() : null,
    successMessage: () => m.chat_project_name_saved(),
  },
  description: {
    readPersisted: (project) => project.description ?? '',
    draftToPatch: (draft) => ({
      skip: false,
      value: draft.trim().length > 0 ? draft.trim() : null,
    }),
    successMessage: () => m.chat_project_description_saved(),
  },
  customInstruction: {
    readPersisted: (project) => project.customInstruction ?? '',
    draftToPatch: (draft) => ({
      skip: false,
      value: draft.length > 0 ? draft : null,
    }),
    successMessage: () => m.chat_project_instruction_saved(),
  },
}

type SubmitMessageKind = 'success' | 'error'
type SubmitMessage = {
  readonly kind: SubmitMessageKind
  readonly text: string
} | null

function getErrorMessage(cause: unknown, fallback: string): string {
  if (cause instanceof Error && cause.message.trim().length > 0) {
    return cause.message
  }
  return fallback
}

export type ProjectFieldEditor = {
  readonly value: string
  readonly setInput: (next: string) => void
  readonly message: SubmitMessage
  readonly canSave: boolean
  readonly submit: () => Promise<void>
}

/**
 * Small per-field state machine: hydrate from the project row once, keep a
 * draft string, and submit through `projects.update` with consistent
 * success / error semantics. The hydrate-once policy preserves in-flight
 * typing if the row updates concurrently from another tab.
 */
function useProjectFieldEditor(input: {
  readonly projectId: string
  readonly project: ProjectRow | undefined
  readonly fieldKey: ProjectFieldKey
}): ProjectFieldEditor {
  const z = useZero()
  const definition = FIELD_DEFINITIONS[input.fieldKey]
  const [value, setValue] = useState('')
  const [hydrated, setHydrated] = useState(false)
  const [message, setMessage] = useState<SubmitMessage>(null)

  useEffect(() => {
    if (!input.project || hydrated) return
    setValue(definition.readPersisted(input.project))
    setHydrated(true)
  }, [definition, hydrated, input.project])

  const setInput = (next: string) => {
    setMessage(null)
    setValue(next)
  }

  const persistedValue = input.project
    ? definition.readPersisted(input.project)
    : ''

  // Save is only enabled when the draft would actually change something.
  const canSave = useMemo(() => {
    if (!input.project) return false
    if (definition.validate?.(value)) return false
    const patch = definition.draftToPatch(value)
    if (patch.skip) return false
    const desired = patch.value ?? ''
    return desired !== persistedValue
  }, [definition, input.project, persistedValue, value])

  const submit = async () => {
    if (!input.project) return
    const validationError = definition.validate?.(value) ?? null
    if (validationError) {
      setMessage({ kind: 'error', text: validationError })
      return
    }
    const patch = definition.draftToPatch(value)
    if (patch.skip) return

    const desired = patch.value ?? ''
    if (desired === persistedValue) {
      setMessage({ kind: 'success', text: definition.successMessage() })
      return
    }

    try {
      const result = await z.mutate(
        mutators.projects.update({
          projectId: input.projectId,
          patch: { [input.fieldKey]: patch.value } as never,
        }),
      ).server
      if (result.type === 'error') throw new Error(m.chat_project_error_save_failed())
      setMessage({ kind: 'success', text: definition.successMessage() })
    } catch (cause) {
      setMessage({
        kind: 'error',
        text: getErrorMessage(cause, m.chat_project_error_save_failed()),
      })
    }
  }

  return { value, setInput, message, canSave, submit }
}

export function useProjectSettingsPageLogic({
  projectId,
}: {
  projectId: string
}) {
  const z = useZero()
  const navigate = useNavigate()
  const { canManage, isOrphan } = useProjectManagementAccess()
  const [project] = useQuery(queries.projects.byId({ projectId }))

  const nameEditor = useProjectFieldEditor({
    projectId,
    project,
    fieldKey: 'name',
  })
  const descriptionEditor = useProjectFieldEditor({
    projectId,
    project,
    fieldKey: 'description',
  })
  const instructionEditor = useProjectFieldEditor({
    projectId,
    project,
    fieldKey: 'customInstruction',
  })

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null)

  const submitDelete = async () => {
    if (!project) return
    setDeleteSubmitting(true)
    setDeleteMessage(null)
    try {
      const result = await z.mutate(mutators.projects.delete({ projectId })).server
      if (result.type === 'error') throw new Error(m.chat_project_delete_failed())
      setDeleteDialogOpen(false)
      navigate({ to: '/chat' })
    } catch (cause) {
      setDeleteMessage(getErrorMessage(cause, m.chat_project_delete_failed()))
    } finally {
      setDeleteSubmitting(false)
    }
  }

  return {
    project,
    canEdit: canManage(project),
    isOrphan: isOrphan(project),
    nameEditor,
    descriptionEditor,
    instructionEditor,
    deleteDialogOpen,
    deleteSubmitting,
    deleteMessage,
    setDeleteDialogOpen,
    submitDelete,
    limits: {
      name: NAME_MAX,
      description: DESCRIPTION_MAX,
      instruction: INSTRUCTION_MAX,
    },
  }
}
