// Sidebar section listing the user's Projects. Sits between the static
// "New chat / Search" actions and the date-grouped thread history.
'use client'

import { useCallback, useRef, useState } from 'react'
import type { KeyboardEvent, RefObject } from 'react'
import type { QueryResultType } from '@rocicorp/zero'
import { useNavigate } from '@tanstack/react-router'
import { useQuery, useZero } from '@rocicorp/zero/react'
import { FormDialog } from '@rift/ui/dialog'
import { ContextMenuItem, ContextMenuSeparator } from '@rift/ui/context-menu'
import { Input } from '@rift/ui/input'
import { Label } from '@rift/ui/label'
import Pencil from 'lucide-react/dist/esm/icons/pencil'
import Pin from 'lucide-react/dist/esm/icons/pin'
import PinOff from 'lucide-react/dist/esm/icons/pin-off'
import Plus from 'lucide-react/dist/esm/icons/plus'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import { toast } from 'sonner'
import { mutators, queries } from '@/integrations/zero'
import { SidebarNavItem } from '@/components/layout/sidebar/sidebar-nav-item'
import type { NavItemType } from '@/components/layout/sidebar/app-sidebar-nav.config'
import { useAppAuth } from '@/lib/frontend/auth/use-auth'
import { m } from '@/paraglide/messages.js'

export const PROJECTS_HREF_BASE = '/chat/projects'

const PROJECT_NAME_MAX = 80
const PROJECT_RENAME_INPUT_CLASS =
  'min-w-0 flex-1 truncate border-none bg-transparent p-0 text-inherit outline-none focus:ring-0'

type ProjectRow = QueryResultType<
  ReturnType<(typeof queries.projects)['list']>
>[number]

function ProjectPinTrailing({ pinned }: { pinned: boolean }) {
  if (!pinned) return null

  return (
    <Pin
      className="size-3.5 shrink-0 text-foreground-tertiary"
      aria-label={m.chat_sidebar_group_pinned()}
    />
  )
}

function ProjectRenameInput({
  projectId,
  currentName,
  value,
  onChange,
  onSubmit,
  onCancel,
  inputRef,
}: {
  projectId: string
  currentName: string
  value: string
  onChange: (value: string) => void
  onSubmit: (projectId: string, currentName: string) => void
  onCancel: () => void
  inputRef: RefObject<HTMLInputElement | null>
}) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        onSubmit(projectId, currentName)
      } else if (event.key === 'Escape') {
        event.preventDefault()
        onCancel()
      } else if (event.key === ' ') {
        event.stopPropagation()
      }
    },
    [currentName, onCancel, onSubmit, projectId],
  )

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={onCancel}
      onClick={(event) => event.stopPropagation()}
      className={PROJECT_RENAME_INPUT_CLASS}
      aria-label={m.chat_sidebar_rename_project_aria_label()}
    />
  )
}

export function ChatSidebarProjects({
  pathname,
  disabled = false,
}: {
  pathname: string
  disabled?: boolean
}) {
  const z = useZero()
  const navigate = useNavigate()
  const { isAnonymous, user } = useAppAuth()
  const [projects] = useQuery(queries.projects.list({}))
  const [creating, setCreating] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const editingInputRef = useRef<HTMLInputElement>(null)

  const resetCreateDialog = useCallback(() => {
    setCreateName('')
    setCreateError(null)
  }, [])

  const handleCreateDialogOpenChange = useCallback(
    (open: boolean) => {
      if (creating && !open) return
      setCreateDialogOpen(open)
      if (!open) resetCreateDialog()
    },
    [creating, resetCreateDialog],
  )

  const handleCreateProject = useCallback(async () => {
    if (creating || disabled || isAnonymous) {
      setCreateError(m.chat_sidebar_projects_sign_in_required())
      return
    }
    const name = createName.trim()
    if (!name) {
      setCreateError(m.chat_sidebar_project_name_empty_error())
      return
    }

    setCreating(true)
    setCreateError(null)
    const projectId = crypto.randomUUID()
    const createdAt = Date.now()
    try {
      await z.mutate(
        mutators.projects.create({
          projectId,
          name,
          createdAt,
        }),
      ).client
      setCreateDialogOpen(false)
      resetCreateDialog()
      navigate({
        to: '/chat/projects/$projectId/settings',
        params: { projectId },
      })
    } catch (error) {
      console.error('Failed to create project:', error)
      setCreateError(m.chat_sidebar_project_create_failed())
    } finally {
      setCreating(false)
    }
  }, [
    createName,
    creating,
    disabled,
    isAnonymous,
    navigate,
    resetCreateDialog,
    z,
  ])

  const startEditingProject = useCallback((project: ProjectRow) => {
    setEditingProjectId(project.id)
    setEditingName(project.name)
    window.setTimeout(() => {
      editingInputRef.current?.focus()
      editingInputRef.current?.select()
    }, 0)
  }, [])

  const cancelEditingProject = useCallback(() => {
    setEditingProjectId(null)
    setEditingName('')
  }, [])

  const submitRenameProject = useCallback(
    async (projectId: string, currentName: string) => {
      const name = editingName.trim()
      if (!name) {
        toast.error(m.chat_sidebar_project_name_empty_error())
        return
      }
      if (name === currentName) {
        cancelEditingProject()
        return
      }

      try {
        await z.mutate(
          mutators.projects.update({
            projectId,
            patch: { name },
          }),
        ).client
        toast.success(m.chat_sidebar_project_renamed())
        cancelEditingProject()
      } catch (error) {
        console.error('Failed to rename project:', error)
        toast.error(m.chat_sidebar_project_rename_failed())
      }
    },
    [cancelEditingProject, editingName, z],
  )

  const setProjectPinned = useCallback(
    async (project: ProjectRow, pinned: boolean) => {
      try {
        await z.mutate(
          mutators.projects.update({
            projectId: project.id,
            patch: { pinned },
          }),
        ).client
      } catch (error) {
        console.error('Failed to update project pin state:', error)
        toast.error(m.chat_sidebar_project_pin_failed())
      }
    },
    [z],
  )

  const deleteProject = useCallback(
    async (project: ProjectRow) => {
      try {
        await z.mutate(mutators.projects.delete({ projectId: project.id }))
          .client
        toast.success(m.chat_project_deleted())
      } catch (error) {
        console.error('Failed to delete project:', error)
        toast.error(m.chat_project_delete_failed())
      }
    },
    [z],
  )

  const newProjectItem: NavItemType = {
    name: m.chat_sidebar_project_create(),
    icon: Plus,
    disabled,
    onSelect: disabled
      ? undefined
      : () => {
          resetCreateDialog()
          setCreateDialogOpen(true)
        },
  }

  return (
    <>
      <div className="flex flex-col gap-0.5 pr-3">
        <div className="mb-2 pl-3 pr-3 text-sm text-foreground-secondary">
          {m.chat_sidebar_projects()}
        </div>
        {projects.map((project) => {
          const isEditing = editingProjectId === project.id
          // Org-shared projects can appear in this list for non-owners, but
          // project mutations are intentionally owner-only at the Zero layer.
          const canMutate = project.userId === user?.id
          const item: NavItemType = {
            name: project.name,
            href: `${PROJECTS_HREF_BASE}/${project.id}`,
            trailing: isEditing ? undefined : (
              <ProjectPinTrailing pinned={project.pinned} />
            ),
            disableLink: isEditing,
            ...(isEditing && {
              label: (
                <ProjectRenameInput
                  projectId={project.id}
                  currentName={project.name}
                  value={editingName}
                  onChange={setEditingName}
                  onSubmit={submitRenameProject}
                  onCancel={cancelEditingProject}
                  inputRef={editingInputRef}
                />
              ),
            }),
            contextMenuContent:
              canMutate && !isEditing ? (
                <>
                  <ContextMenuItem onClick={() => startEditingProject(project)}>
                    <Pencil />
                    {m.chat_sidebar_rename()}
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={() => {
                      void setProjectPinned(project, !project.pinned)
                    }}
                  >
                    {project.pinned ? <PinOff /> : <Pin />}
                    {project.pinned
                      ? m.chat_sidebar_unpin()
                      : m.chat_sidebar_pin()}
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    variant="destructive"
                    onClick={() => {
                      void deleteProject(project)
                    }}
                  >
                    <Trash2 />
                    {m.chat_sidebar_delete()}
                  </ContextMenuItem>
                </>
              ) : undefined,
          }
          return (
            <SidebarNavItem key={project.id} item={item} pathname={pathname} />
          )
        })}
        <SidebarNavItem item={newProjectItem} pathname={pathname} />
        {disabled ? (
          <div className="px-3 py-1 text-xs text-foreground-tertiary">
            {m.chat_sidebar_projects_sign_in_required()}
          </div>
        ) : null}
      </div>

      <FormDialog
        open={createDialogOpen}
        onOpenChange={handleCreateDialogOpenChange}
        title={m.chat_sidebar_project_create_title()}
        description={m.chat_sidebar_project_create_description()}
        buttonText={m.chat_sidebar_project_create()}
        secondaryButtonText={m.common_cancel()}
        onSecondaryClick={() => handleCreateDialogOpenChange(false)}
        submitButtonDisabled={!createName.trim()}
        secondaryButtonDisabled={creating}
        error={createError ?? undefined}
        handleSubmit={handleCreateProject}
      >
        <div className="space-y-2">
          <Label htmlFor="create-project-name">
            {m.chat_sidebar_project_name_label()}
          </Label>
          <Input
            id="create-project-name"
            value={createName}
            onChange={(event) => {
              setCreateName(event.target.value)
              setCreateError(null)
            }}
            placeholder={m.chat_sidebar_project_name_placeholder()}
            maxLength={PROJECT_NAME_MAX}
            disabled={creating}
          />
        </div>
      </FormDialog>
    </>
  )
}
