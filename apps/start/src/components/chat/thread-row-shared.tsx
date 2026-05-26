/**
 * Shared building blocks for thread rows in the chat sidebars.
 *
 * The chat sidebar (`chat-sidebar.tsx`) and the project-scoped sidebar
 * (`chat-sidebar-project-scope.tsx`) historically forked a row's
 * action handlers, trailing-status element, and context-menu items in
 * ~80 lines of near-duplicate code. This module hosts the pieces both
 * sidebars actually share: the three Zero-mutator action callbacks
 * (`copy link`, `set pinned`, `delete`), the trailing status element
 * (spinner / error / pin badge), and a context-menu item subtree
 * containing the actions every variant supports.
 *
 * Sidebars opt-in to extra affordances around these pieces:
 *   - the global sidebar wraps them with an inline rename editor
 *   - the project-scoped sidebar omits rename and points the
 *     post-delete redirect at the project landing page.
 */
'use client'

import type { ReactNode } from 'react'
import { useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useZero } from '@rocicorp/zero/react'
import { copyToClipboard } from '@rift/utils'
import { ContextMenuItem, ContextMenuSeparator } from '@rift/ui/context-menu'
import { Spinner } from '@rift/ui/spinner'
import { SidebarGroupTooltip } from '@rift/ui/tooltip'
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle'
import Copy from 'lucide-react/dist/esm/icons/copy'
import Pin from 'lucide-react/dist/esm/icons/pin'
import PinOff from 'lucide-react/dist/esm/icons/pin-off'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import { toast } from 'sonner'

import { mutators } from '@/integrations/zero'
import { m } from '@/paraglide/messages.js'

import { ThreadMoveToProjectSubmenu } from './chat-sidebar-move-to-project'

/**
 * Minimal thread shape required by the shared row utilities. Both
 * sidebars already carry these fields on their respective row types.
 */
export type ThreadRowSubject = {
  readonly threadId: string
  readonly pinned: boolean
  readonly generationStatus?:
    | 'pending'
    | 'generation'
    | 'completed'
    | 'failed'
}

export type ThreadRowActionHandlers = {
  readonly copyLink: (threadId: string) => Promise<void>
  readonly setPinned: (threadId: string, pinned: boolean) => Promise<void>
  readonly deleteThread: (threadId: string) => Promise<void>
}

/**
 * Centralized thread-row actions. Each sidebar passes its own
 * post-delete redirect target (`/chat` for the global sidebar,
 * `/chat/projects/<id>` for the project-scoped sidebar) and calls the
 * returned handlers from its UI.
 *
 * Optional callbacks let the global sidebar refresh its history page
 * cache after deletes / pins without those Zero-specific concerns
 * leaking into this hook.
 */
export function useThreadRowActions(input: {
  readonly redirectTargetOnDelete: string
  readonly activeThreadId: string | null
  readonly onAfterDelete?: () => void
  readonly onAfterPinChange?: () => void
}): ThreadRowActionHandlers {
  const z = useZero()
  const navigate = useNavigate()

  const copyLink = useCallback(async (threadId: string) => {
    const origin = window.location.origin
    await copyToClipboard(`${origin}/chat/${threadId}`)
  }, [])

  const setPinned = useCallback(
    async (threadId: string, pinned: boolean) => {
      try {
        await z.mutate(mutators.threads.setPinned({ threadId, pinned })).client
        input.onAfterPinChange?.()
      } catch (error) {
        console.error('Failed to update thread pin state:', error)
        toast.error(m.chat_sidebar_thread_pin_failed())
      }
    },
    [input, z],
  )

  const deleteThread = useCallback(
    async (threadId: string) => {
      try {
        const write = z.mutate(mutators.threads.delete({ threadId }))
        await write.client
        input.onAfterDelete?.()
        toast.success(m.chat_sidebar_thread_deleted())
        if (input.activeThreadId === threadId) {
          navigate({ to: input.redirectTargetOnDelete })
        }
        const serverRes = await write.server
        if (serverRes.type === 'error') {
          toast.error(m.chat_sidebar_thread_delete_failed())
        }
      } catch (error) {
        console.error('Failed to delete thread:', error)
        toast.error(m.chat_sidebar_thread_delete_failed())
      }
    },
    [input, navigate, z],
  )

  return { copyLink, setPinned, deleteThread }
}

/**
 * Status indicator rendered to the right of a thread title:
 * spinner while generating / pending, alert triangle on failure,
 * pin icon when pinned, otherwise nothing. Returning `undefined`
 * lets `SidebarNavItem`'s trailing slot stay empty.
 */
export function getThreadRowTrailingElement(
  thread: ThreadRowSubject,
): ReactNode | undefined {
  const status = thread.generationStatus
  const showSpinner =
    status === 'pending' || status === 'generation' || status === undefined
  const showError = status === 'failed'

  if (showSpinner) {
    return (
      <SidebarGroupTooltip
        name={
          status === 'pending'
            ? m.chat_sidebar_status_pending()
            : m.chat_sidebar_status_generating()
        }
        description={
          status === 'pending'
            ? m.chat_sidebar_status_pending_description()
            : m.chat_sidebar_status_generating_description()
        }
      >
        <span className="inline-flex shrink-0">
          <Spinner
            className="size-4 animate-spin text-foreground-secondary"
            aria-hidden
          />
        </span>
      </SidebarGroupTooltip>
    )
  }

  if (showError) {
    return (
      <SidebarGroupTooltip
        name={m.chat_sidebar_status_error()}
        description={m.chat_sidebar_status_error_description()}
      >
        <span className="inline-flex shrink-0">
          <AlertTriangle className="size-4 text-foreground-error" aria-hidden />
        </span>
      </SidebarGroupTooltip>
    )
  }

  if (thread.pinned) {
    return (
      <Pin
        className="size-3.5 shrink-0 text-foreground-tertiary"
        aria-label={m.chat_sidebar_group_pinned()}
      />
    )
  }

  return undefined
}

/**
 * Shared context-menu items that both sidebars render: copy link,
 * pin / unpin, move to project, divider, delete. The global sidebar
 * prepends a Rename item before this fragment.
 */
export function ThreadRowContextMenuItems({
  thread,
  currentProjectId,
  actions,
}: {
  thread: ThreadRowSubject
  /**
   * The project this thread currently belongs to, if any. Surfaces a
   * "remove from project" option in the move-to-project submenu when
   * non-null.
   */
  currentProjectId: string | null
  actions: ThreadRowActionHandlers
}) {
  return (
    <>
      <ContextMenuItem
        onClick={() => {
          void actions.copyLink(thread.threadId)
        }}
      >
        <Copy />
        {m.chat_sidebar_copy_link()}
      </ContextMenuItem>
      <ContextMenuItem
        onClick={() => {
          void actions.setPinned(thread.threadId, !thread.pinned)
        }}
      >
        {thread.pinned ? <PinOff /> : <Pin />}
        {thread.pinned ? m.chat_sidebar_unpin() : m.chat_sidebar_pin()}
      </ContextMenuItem>
      <ThreadMoveToProjectSubmenu
        threadId={thread.threadId}
        currentProjectId={currentProjectId}
      />
      <ContextMenuSeparator />
      <ContextMenuItem
        variant="destructive"
        onClick={() => {
          void actions.deleteThread(thread.threadId)
        }}
      >
        <Trash2 />
        {m.chat_sidebar_delete()}
      </ContextMenuItem>
    </>
  )
}
