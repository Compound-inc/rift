'use client'

import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery, useZero } from '@rocicorp/zero/react'

import { mutators, queries } from '@/integrations/zero'
import { m } from '@/paraglide/messages.js'

/**
 * Centralized state and submit handlers for the project parameters page.
 *
 * The component uses one `Form` section per editable field with explicit
 * Save buttons. Each submit pushes through Zero mutators and surfaces a
 * per-section success / error message. Sessions hydrate fields from the
 * Zero project query as soon as it resolves, but only when the local
 * draft is still empty so users do not lose in-flight typing.
 */

const NAME_MAX = 80
const DESCRIPTION_MAX = 500
const INSTRUCTION_MAX = 8000

type SubmitMessage = string | null

function getErrorMessage(cause: unknown, fallback: string): string {
  if (cause instanceof Error && cause.message.trim().length > 0) {
    return cause.message
  }
  return fallback
}

export function useProjectSettingsPageLogic({
  projectId,
}: {
  projectId: string
}) {
  const z = useZero()
  const navigate = useNavigate()
  const [project] = useQuery(queries.projects.byId({ projectId }))

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [instruction, setInstruction] = useState('')
  const [hydrated, setHydrated] = useState(false)

  const [nameMessage, setNameMessage] = useState<SubmitMessage>(null)
  const [descriptionMessage, setDescriptionMessage] =
    useState<SubmitMessage>(null)
  const [instructionMessage, setInstructionMessage] =
    useState<SubmitMessage>(null)

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)
  const [deleteMessage, setDeleteMessage] = useState<SubmitMessage>(null)

  /**
   * Hydrate local drafts the first time the project resolves. Subsequent
   * project updates (e.g. concurrent edits from another tab) intentionally
   * do not overwrite drafts so users are never surprised mid-typing.
   */
  useEffect(() => {
    if (!project || hydrated) return
    setName(project.name)
    setDescription(project.description ?? '')
    setInstruction(project.customInstruction ?? '')
    setHydrated(true)
  }, [project, hydrated])

  const canEdit = !!project

  const setNameInput = (next: string) => {
    setNameMessage(null)
    setName(next)
  }
  const setDescriptionInput = (next: string) => {
    setDescriptionMessage(null)
    setDescription(next)
  }
  const setInstructionInput = (next: string) => {
    setInstructionMessage(null)
    setInstruction(next)
  }

  const submitName = async () => {
    if (!project) return
    const trimmed = name.trim()
    if (!trimmed) {
      setNameMessage(m.chat_project_error_name_empty())
      return
    }
    if (trimmed === project.name) {
      setNameMessage(m.chat_project_name_saved())
      return
    }
    try {
      await z.mutate(mutators.projects.rename({ projectId, name: trimmed }))
        .client
      setName(trimmed)
      setNameMessage(m.chat_project_name_saved())
    } catch (cause) {
      setNameMessage(
        getErrorMessage(cause, m.chat_project_error_save_failed()),
      )
    }
  }

  const submitDescription = async () => {
    if (!project) return
    const next = description.trim() || null
    if ((project.description ?? null) === next) {
      setDescriptionMessage(m.chat_project_description_saved())
      return
    }
    try {
      await z.mutate(
        mutators.projects.setDescription({
          projectId,
          description: next,
        }),
      ).client
      setDescription(next ?? '')
      setDescriptionMessage(m.chat_project_description_saved())
    } catch (cause) {
      setDescriptionMessage(
        getErrorMessage(cause, m.chat_project_error_save_failed()),
      )
    }
  }

  const submitInstruction = async () => {
    if (!project) return
    const next = instruction.length > 0 ? instruction : null
    if ((project.customInstruction ?? null) === next) {
      setInstructionMessage(m.chat_project_instruction_saved())
      return
    }
    try {
      await z.mutate(
        mutators.projects.setCustomInstruction({
          projectId,
          customInstruction: next,
        }),
      ).client
      setInstructionMessage(m.chat_project_instruction_saved())
    } catch (cause) {
      setInstructionMessage(
        getErrorMessage(cause, m.chat_project_error_save_failed()),
      )
    }
  }

  const submitDelete = async () => {
    if (!project) return
    setDeleteSubmitting(true)
    setDeleteMessage(null)
    try {
      await z.mutate(mutators.projects.delete({ projectId })).client
      setDeleteDialogOpen(false)
      navigate({ to: '/chat' })
    } catch (cause) {
      setDeleteMessage(
        getErrorMessage(cause, m.chat_project_delete_failed()),
      )
    } finally {
      setDeleteSubmitting(false)
    }
  }

  return {
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
    limits: {
      name: NAME_MAX,
      description: DESCRIPTION_MAX,
      instruction: INSTRUCTION_MAX,
    },
  }
}
