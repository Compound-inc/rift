// Chat navigation sidebar with static links + dynamic thread history.
'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { useQuery, useZero } from '@rocicorp/zero/react'
import { useNavigate } from '@tanstack/react-router'
import {
  AlertTriangle,
  Copy,
  Globe,
  Link2,
  MessageCircle,
  Pencil,
  Trash2,
} from 'lucide-react'
import { SidebarGroupTooltip } from '@rift/ui/tooltip'
import { ContextMenuItem, ContextMenuSeparator } from '@rift/ui/context-menu'
import { Spinner } from '@rift/ui/spinner'
import { copyToClipboard } from '@rift/utils'
import { toast } from 'sonner'
import { isAreaPath } from '@/utils/nav-utils'
import { SidebarAreaLayout } from '@/components/layout/sidebar/sidebar-area-layout'
import type {
  NavItemType,
  NavSection,
} from '@/components/layout/sidebar/app-sidebar-nav.config'
import { mutators, queries } from '@/integrations/zero'
import { CACHE_CHAT_NAV } from '@/integrations/zero/query-cache-policy'
import { m } from '@/paraglide/messages.js'
import { syncThreadGenerationStatuses } from './thread-status-store'

// --- Single source of truth: constants and static content ---

export const CHAT_HREF = '/chat'
export const CHAT_AREA_KEY = 'default' as const

export const isChatPath = (pathname: string) =>
  isAreaPath(pathname, ['/', CHAT_HREF])

const CHAT_SIDEBAR_TITLE = () => m.chat_sidebar_title()
const CHAT_HISTORY_SECTION_NAME = () => m.chat_sidebar_history_section()
const OPTIMISTIC_THREAD_CREATED_EVENT = 'chat:thread-created'
const MAX_PRELOADED_THREADS = 100

type OptimisticThread = {
  readonly threadId: string
  readonly title: string
  readonly createdAt: number
}

/** Static sections only. Dynamic "Chat History" is appended by ChatSidebarContent. */
function getStaticSections(): NavSection[] {
  return [
    {
      items: [
        { name: m.chat_sidebar_new_chat(), href: CHAT_HREF, icon: Link2, exact: true },
        { name: m.chat_sidebar_projects(), href: `${CHAT_HREF}/projects`, icon: Globe },
      ],
    },
  ]
}

/** Static nav config for the chat area (title, href, icon, description, static sections). */
export function chatNavStaticConfig() {
  return {
    title: CHAT_SIDEBAR_TITLE(),
    href: CHAT_HREF,
    description: m.chat_sidebar_description(),
    icon: MessageCircle,
    content: getStaticSections(),
  }
}

// Inline rename input

const RENAME_INPUT_CLASS =
  'min-w-0 flex-1 truncate border-none bg-transparent p-0 text-inherit outline-none focus:ring-0'

type ThreadRenameInputProps = {
  threadId: string
  currentTitle: string
  value: string
  onChange: (value: string) => void
  onSubmit: (threadId: string, currentTitle: string) => void
  onCancel: () => void
  inputRef: React.RefObject<HTMLInputElement | null>
}

function ThreadRenameInput({
  threadId,
  currentTitle,
  value,
  onChange,
  onSubmit,
  onCancel,
  inputRef,
}: ThreadRenameInputProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        void onSubmit(threadId, currentTitle)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      } else if (e.key === ' ') {
        e.stopPropagation()
      }
    },
    [threadId, currentTitle, onSubmit, onCancel],
  )

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={onCancel}
      onClick={(e) => e.stopPropagation()}
      className={RENAME_INPUT_CLASS}
      aria-label={m.chat_sidebar_rename_thread_aria_label()}
    />
  )
}

// --- Dynamic content component (uses static config + Zero threads) ---

export function ChatSidebarContent({ pathname }: { pathname: string }) {
  const navigate = useNavigate()
  const z = useZero()
  const [threads] = useQuery(queries.threads.byUser(), CACHE_CHAT_NAV)
  const [optimisticThreads, setOptimisticThreads] = useState<
    readonly OptimisticThread[]
  >([])
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const editingInputRef = useRef<HTMLInputElement>(null)
  const preloadedThreadIdsRef = useRef(new Set<string>())

  useEffect(() => {
    if (editingThreadId) {
      editingInputRef.current?.focus()
      editingInputRef.current?.select()
    }
  }, [editingThreadId])

  useEffect(() => {
    syncThreadGenerationStatuses(
      threads.map((thread) => ({
        threadId: thread.threadId,
        generationStatus: thread.generationStatus as
          | 'pending'
          | 'generation'
          | 'completed'
          | 'failed'
          | undefined,
      })),
    )
  }, [threads])

  useEffect(() => {
    for (const thread of threads.slice(0, MAX_PRELOADED_THREADS)) {
      if (preloadedThreadIdsRef.current.has(thread.threadId)) continue
      z.preload(
        queries.messages.byThread({ threadId: thread.threadId }),
        CACHE_CHAT_NAV,
      )
      preloadedThreadIdsRef.current.add(thread.threadId)
    }
  }, [threads, z])

  useEffect(() => {
    const onOptimisticThread = (event: Event) => {
      const custom = event as CustomEvent<OptimisticThread>
      const payload = custom.detail
      if (
        typeof payload.threadId !== 'string' ||
        typeof payload.title !== 'string' ||
        typeof payload.createdAt !== 'number'
      ) {
        return
      }

      setOptimisticThreads((previous) => {
        if (previous.some((thread) => thread.threadId === payload.threadId)) {
          return previous
        }
        return [payload, ...previous].toSorted(
          (a, b) => b.createdAt - a.createdAt,
        )
      })
    }

    window.addEventListener(OPTIMISTIC_THREAD_CREATED_EVENT, onOptimisticThread)
    return () =>
      window.removeEventListener(
        OPTIMISTIC_THREAD_CREATED_EVENT,
        onOptimisticThread,
      )
  }, [])

  type GenerationStatus =
    | 'pending'
    | 'generation'
    | 'completed'
    | 'failed'
    | undefined

  const mergedThreads = useMemo(() => {
    const persisted = new Set(threads.map((thread) => thread.threadId))
    const pending = optimisticThreads
      .filter((thread) => !persisted.has(thread.threadId))
      .map((thread) => ({
        threadId: thread.threadId,
        title: thread.title,
        generationStatus: undefined as GenerationStatus,
        isPersisted: false,
      }))

    return [
      ...pending,
      ...threads.map((thread) => ({
        threadId: thread.threadId,
        title: thread.title || m.chat_sidebar_thread_untitled(),
        generationStatus: thread.generationStatus as GenerationStatus,
        isPersisted: true,
      })),
    ]
  }, [threads, optimisticThreads])

  const activeThreadId = useMemo(() => {
    if (!pathname.startsWith(`${CHAT_HREF}/`)) {
      return null
    }
    return pathname.slice(`${CHAT_HREF}/`.length).split('/')[0] ?? null
  }, [pathname])

  const startEditingThread = useCallback(
    (threadId: string, currentTitle: string) => {
      setEditingThreadId(threadId)
      setEditingTitle(currentTitle || m.chat_sidebar_thread_untitled())
    },
    [],
  )

  const cancelEditingThread = useCallback(() => {
    setEditingThreadId(null)
    setEditingTitle('')
  }, [])

  const submitRenameThread = useCallback(
    async (threadId: string, currentTitle: string) => {
      const trimmed = editingTitle.trim()
      if (!trimmed) {
        toast.error(m.chat_sidebar_thread_title_empty_error())
        return
      }

      if (trimmed === currentTitle) {
        cancelEditingThread()
        return
      }

      try {
        await z.mutate(mutators.threads.rename({ threadId, title: trimmed }))
          .client
        toast.success(m.chat_sidebar_thread_renamed())
        cancelEditingThread()
      } catch (error) {
        console.error('Failed to rename thread:', error)
        toast.error(m.chat_sidebar_thread_rename_failed())
      }
    },
    [editingTitle, cancelEditingThread, z],
  )

  const handleDeleteThread = useCallback(
    async (threadId: string) => {
      try {
        const write = z.mutate(mutators.threads.delete({ threadId }))
        await write.client
        toast.success(m.chat_sidebar_thread_deleted())
        if (activeThreadId === threadId) {
          navigate({ to: '/chat' })
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
    [activeThreadId, navigate, z],
  )

  const handleCopyThreadLink = useCallback(async (threadId: string) => {
    const origin = window.location.origin
    await copyToClipboard(`${origin}${CHAT_HREF}/${threadId}`)
  }, [])

  const threadItems: NavItemType[] = mergedThreads.map(
    (thread) => {
      const status = thread.generationStatus
      const showSpinner =
        status === 'pending' || status === 'generation' || status === undefined
      const showError = status === 'failed'
      const trailing = showSpinner ? (
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
            <Spinner className="size-4 animate-spin text-foreground-secondary" aria-hidden />
          </span>
        </SidebarGroupTooltip>
      ) : showError ? (
        <SidebarGroupTooltip
          name={m.chat_sidebar_status_error()}
          description={m.chat_sidebar_status_error_description()}
        >
          <span className="inline-flex shrink-0">
            <AlertTriangle className="size-4 text-foreground-error" aria-hidden />
          </span>
        </SidebarGroupTooltip>
      ) : undefined

      const isEditing = editingThreadId === thread.threadId
      const currentTitle = thread.title || m.chat_sidebar_thread_untitled()

      return {
        name: currentTitle,
        href: `${CHAT_HREF}/${thread.threadId}`,
        trailing: isEditing ? undefined : trailing,
        disableLink: isEditing,
        ...(isEditing && {
          label: (
            <ThreadRenameInput
              threadId={thread.threadId}
              currentTitle={currentTitle}
              value={editingTitle}
              onChange={setEditingTitle}
              onSubmit={submitRenameThread}
              onCancel={cancelEditingThread}
              inputRef={editingInputRef}
            />
          ),
        }),
        contextMenuContent:
          thread.isPersisted && !isEditing ? (
            <>
              <ContextMenuItem
                onClick={() => {
                  startEditingThread(thread.threadId, currentTitle)
                }}
              >
                <Pencil />
                {m.chat_sidebar_rename()}
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => {
                  void handleCopyThreadLink(thread.threadId)
                }}
              >
                <Copy />
                {m.chat_sidebar_copy_link()}
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem
                variant="destructive"
                onClick={() => {
                  void handleDeleteThread(thread.threadId)
                }}
              >
                <Trash2 />
                {m.chat_sidebar_delete()}
              </ContextMenuItem>
            </>
          ) : undefined,
      }
    },
    [
      editingThreadId,
      editingTitle,
      handleCopyThreadLink,
      handleDeleteThread,
      startEditingThread,
      submitRenameThread,
      cancelEditingThread,
    ],
  )

  const historySection: NavSection = {
    name: CHAT_HISTORY_SECTION_NAME(),
    items: threadItems,
  }

  const sections = [...getStaticSections(), historySection]

  return (
    <SidebarAreaLayout
      title={CHAT_SIDEBAR_TITLE()}
      sections={sections}
      pathname={pathname}
      scrollableSectionName={CHAT_HISTORY_SECTION_NAME()}
    />
  )
}

export function chatNavArea() {
  return {
    ...chatNavStaticConfig(),
    ContentComponent: ChatSidebarContent,
  }
}
