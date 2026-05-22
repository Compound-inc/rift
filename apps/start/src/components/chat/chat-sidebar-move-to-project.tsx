// Submenu used in thread context menus to move a thread between Projects.
'use client'

import { useCallback } from 'react'
import { useQuery, useZero } from '@rocicorp/zero/react'
import Folder from 'lucide-react/dist/esm/icons/folder'
import FolderOpen from 'lucide-react/dist/esm/icons/folder-open'
import FolderX from 'lucide-react/dist/esm/icons/folder-x'
import {
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from '@rift/ui/context-menu'
import { toast } from 'sonner'
import { mutators, queries } from '@/integrations/zero'
import { m } from '@/paraglide/messages.js'

export type ThreadMoveToProjectSubmenuProps = {
  readonly threadId: string
  /**
   * The thread's current `projectId`, or `null` when the thread is loose.
   * Used to render the "Remove from project" affordance and to skip the
   * already-current project in the menu.
   */
  readonly currentProjectId: string | null
}

export function ThreadMoveToProjectSubmenu({
  threadId,
  currentProjectId,
}: ThreadMoveToProjectSubmenuProps) {
  const z = useZero()
  const [projects] = useQuery(queries.projects.list({}))

  const handleMove = useCallback(
    async (nextProjectId: string | null) => {
      if (nextProjectId === currentProjectId) return
      try {
        await z.mutate(
          mutators.threads.setProject({ threadId, projectId: nextProjectId }),
        ).client
        toast.success(
          nextProjectId === null
            ? m.chat_sidebar_thread_removed_from_project()
            : m.chat_sidebar_thread_moved_to_project(),
        )
      } catch (error) {
        console.error('Failed to move thread to project:', error)
        toast.error(m.chat_sidebar_thread_move_failed())
      }
    },
    [currentProjectId, threadId, z],
  )

  return (
    <ContextMenuSub>
      <ContextMenuSubTrigger>
        <Folder />
        {m.chat_sidebar_move_to_project()}
      </ContextMenuSubTrigger>
      <ContextMenuSubContent>
        {currentProjectId ? (
          <>
            <ContextMenuItem onClick={() => void handleMove(null)}>
              <FolderX />
              {m.chat_sidebar_remove_from_project()}
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        ) : null}
        {projects.length === 0 ? (
          <ContextMenuItem disabled>
            {m.chat_sidebar_move_to_project_empty()}
          </ContextMenuItem>
        ) : (
          projects.map((project) => {
            const isCurrent = project.id === currentProjectId
            return (
              <ContextMenuItem
                key={project.id}
                disabled={isCurrent}
                onClick={() => void handleMove(project.id)}
              >
                {isCurrent ? <FolderOpen /> : <Folder />}
                <span className="min-w-0 flex-1 truncate">{project.name}</span>
              </ContextMenuItem>
            )
          })
        )}
      </ContextMenuSubContent>
    </ContextMenuSub>
  )
}
