// Project settings page (info, instruction, files, delete) \u2014 single sectioned
// page per Q9 (Option B). Files section is a placeholder until Phase 6 wires
// up the project-scoped file upload + RAG pipeline.
'use client'

import {
  useCallback,
  useEffect,
  useState,
} from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useQuery, useZero } from '@rocicorp/zero/react'
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import { Button } from '@rift/ui/button'
import { Input } from '@rift/ui/input'
import { Textarea } from '@rift/ui/textarea'
import { toast } from 'sonner'
import { mutators, queries } from '@/integrations/zero'
import { m } from '@/paraglide/messages.js'

const NAME_DEBOUNCE_MS = 400
const TEXT_DEBOUNCE_MS = 600

export function ProjectSettingsPage({ projectId }: { projectId: string }) {
  const z = useZero()
  const navigate = useNavigate()
  const [project, projectResult] = useQuery(
    queries.projects.byId({ projectId }),
  )
  const [files] = useQuery(queries.projects.attachments({ projectId }))

  const [nameDraft, setNameDraft] = useState('')
  const [descriptionDraft, setDescriptionDraft] = useState('')
  const [instructionDraft, setInstructionDraft] = useState('')

  /**
   * Sync drafts from the live row whenever it changes. The drafts are local
   * state so typing feels instant; the debounced effects below push changes
   * back through Zero mutators.
   */
  useEffect(() => {
    if (!project) return
    setNameDraft(project.name)
    setDescriptionDraft(project.description ?? '')
    setInstructionDraft(project.customInstruction ?? '')
  }, [project])

  /**
   * Redirect home if the Project no longer exists (e.g. owner deleted it).
   */
  useEffect(() => {
    if (projectResult.type === 'complete' && !project) {
      void navigate({ to: '/chat' })
    }
  }, [navigate, project, projectResult.type])

  /**
   * Debounced name save. We avoid calling the mutator on every keystroke to
   * keep the live updatedAt timestamp from churning the sidebar order.
   */
  useEffect(() => {
    if (!project) return
    const trimmed = nameDraft.trim()
    if (!trimmed || trimmed === project.name) return
    const handle = window.setTimeout(() => {
      void z
        .mutate(mutators.projects.rename({ projectId, name: trimmed }))
        .client.catch((error) => {
          console.error('Failed to rename project:', error)
        })
    }, NAME_DEBOUNCE_MS)
    return () => window.clearTimeout(handle)
  }, [nameDraft, project, projectId, z])

  useEffect(() => {
    if (!project) return
    const next = descriptionDraft.trim() || null
    if ((project.description ?? null) === next) return
    const handle = window.setTimeout(() => {
      void z
        .mutate(
          mutators.projects.setDescription({
            projectId,
            description: next,
          }),
        )
        .client.catch((error) => {
          console.error('Failed to update project description:', error)
        })
    }, TEXT_DEBOUNCE_MS)
    return () => window.clearTimeout(handle)
  }, [descriptionDraft, project, projectId, z])

  useEffect(() => {
    if (!project) return
    const next = instructionDraft || null
    if ((project.customInstruction ?? null) === next) return
    const handle = window.setTimeout(() => {
      void z
        .mutate(
          mutators.projects.setCustomInstruction({
            projectId,
            customInstruction: next,
          }),
        )
        .client.catch((error) => {
          console.error('Failed to update project instruction:', error)
        })
    }, TEXT_DEBOUNCE_MS)
    return () => window.clearTimeout(handle)
  }, [instructionDraft, project, projectId, z])

  const handleDelete = useCallback(async () => {
    /**
     * Soft-delete (ADR-0001). Confirmation is intentionally simple in v1; the
     * threads attached to this Project keep their `project_id` and start
     * rendering as loose threads in the chat sidebar.
     */
    const confirmed = window.confirm(
      m.chat_project_delete_confirm({ name: project?.name ?? '' }),
    )
    if (!confirmed) return
    try {
      await z.mutate(mutators.projects.delete({ projectId })).client
      toast.success(m.chat_project_deleted())
      navigate({ to: '/chat' })
    } catch (error) {
      console.error('Failed to delete project:', error)
      toast.error(m.chat_project_delete_failed())
    }
  }, [navigate, project?.name, projectId, z])

  if (!project) {
    return (
      <div className="flex min-h-full items-center justify-center text-foreground-secondary">
        {m.chat_project_loading()}
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-6">
      <header className="flex items-center gap-3">
        <Button asChild variant="ghost" size="iconSmall">
          <Link
            to="/chat/projects/$projectId"
            params={{ projectId }}
            preload="intent"
            aria-label={m.chat_project_back_to_project_aria()}
          >
            <ArrowLeft className="size-4" aria-hidden />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold text-foreground-strong">
          {m.chat_project_settings_title()}
        </h1>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-foreground-secondary">
          {m.chat_project_section_info()}
        </h2>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-foreground-secondary">
            {m.chat_project_field_name()}
          </span>
          <Input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            maxLength={80}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-foreground-secondary">
            {m.chat_project_field_description()}
          </span>
          <Input
            value={descriptionDraft}
            onChange={(e) => setDescriptionDraft(e.target.value)}
            maxLength={500}
            placeholder={m.chat_project_field_description_placeholder()}
          />
        </label>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-foreground-secondary">
          {m.chat_project_section_instruction()}
        </h2>
        <p className="text-xs text-foreground-secondary">
          {m.chat_project_section_instruction_description()}
        </p>
        <Textarea
          value={instructionDraft}
          onChange={(e) => setInstructionDraft(e.target.value)}
          rows={8}
          maxLength={8000}
          placeholder={m.chat_project_field_instruction_placeholder()}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-foreground-secondary">
          {m.chat_project_section_files()}
        </h2>
        <p className="text-xs text-foreground-secondary">
          {m.chat_project_section_files_description()}
        </p>
        {files.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-foreground-secondary">
            {m.chat_project_files_empty_phase4()}
          </div>
        ) : (
          <ul className="flex flex-col gap-1">
            {files.map((file) => (
              <li
                key={file.id}
                className="flex items-center justify-between rounded-md border border-border p-3"
              >
                <span className="min-w-0 flex-1 truncate text-sm">
                  {file.fileName}
                </span>
                <span className="text-xs text-foreground-secondary">
                  {file.embeddingStatus ?? '\u2014'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3 border-t border-border pt-6">
        <h2 className="text-sm font-medium text-foreground-secondary">
          {m.chat_project_section_danger()}
        </h2>
        <div className="flex items-center justify-between">
          <p className="text-xs text-foreground-secondary">
            {m.chat_project_delete_helper()}
          </p>
          <Button variant="danger" onClick={() => void handleDelete()}>
            <Trash2 className="size-4" aria-hidden />
            {m.chat_project_delete_button()}
          </Button>
        </div>
      </section>
    </div>
  )
}
