// Chat navigation sidebar with static actions + virtualized thread history.
'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
  
  
  
} from 'react'
import type {CSSProperties, KeyboardEvent, RefObject} from 'react';
import type { QueryResultType } from '@rocicorp/zero'
import {
  useHistoryScrollState,
  useZeroVirtualizer,
} from '@rocicorp/zero-virtual/react'
import { useZero } from '@rocicorp/zero/react'
import { useNavigate } from '@tanstack/react-router'
import { buttonVariants } from '@rift/ui/button'
import {
  AlertTriangle,
  Copy,
  Globe,
  Link2,
  MessageCircle,
  Pencil,
  Search,
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
import { SidebarNavItem } from '@/components/layout/sidebar/sidebar-nav-item'
import { mutators, queries } from '@/integrations/zero'
import { CACHE_CHAT_NAV } from '@/integrations/zero/query-cache-policy'
import { useAppAuth } from '@/lib/frontend/auth/use-auth'
import { m } from '@/paraglide/messages.js'
import { openChatSearchCommand } from './chat-search-command'
import { syncThreadGenerationStatuses } from './thread-status-store'

export const CHAT_HREF = '/chat'
export const CHAT_AREA_KEY = 'default' as const
export const CHAT_SIDEBAR_PAGE_SIZE = 100

const THREAD_ROW_HEIGHT = 36
const THREAD_ROW_OVERSCAN = 8
const HISTORY_SCROLL_STATE_KEY = 'chatSidebarHistory'
const OPTIMISTIC_THREAD_CREATED_EVENT = 'chat:thread-created'
const THREAD_ROW_SHELL_CLASS =
  'min-h-[2.25rem] pr-3 [contain-intrinsic-size:0_2.25rem]'

export const isChatPath = (pathname: string) =>
  isAreaPath(pathname, ['/', CHAT_HREF])

const CHAT_SIDEBAR_TITLE = () => m.chat_sidebar_title()
const CHAT_HISTORY_SECTION_NAME = () => m.chat_sidebar_history_section()

type OptimisticThread = {
  readonly threadId: string
  readonly title: string
  readonly createdAt: number
}

type ThreadHistoryCursor = {
  readonly updatedAt: number
  readonly threadId: string
}

type ThreadHistoryRow = QueryResultType<
  ReturnType<(typeof queries.threads)['historyPage']>
>[number]

type ThreadItemRow = {
  readonly threadId: string
  readonly title: string
  readonly generationStatus?: ThreadHistoryRow['generationStatus']
}

type ThreadHistoryListContext = {
  readonly organizationId: string
}

/** Static sections only. Dynamic history is rendered as a dedicated virtualized pane. */
function getStaticSections(): NavSection[] {
  return [
    {
      items: [
        {
          name: m.chat_sidebar_new_chat(),
          href: CHAT_HREF,
          icon: Link2,
          exact: true,
        },
        {
          name: m.chat_sidebar_projects(),
          href: `${CHAT_HREF}/projects`,
          icon: Globe,
        },
        {
          name: m.chat_search_trigger_label(),
          onSelect: () => openChatSearchCommand({ hideActions: true }),
          icon: Search,
        },
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

const RENAME_INPUT_CLASS =
  'min-w-0 flex-1 truncate border-none bg-transparent p-0 text-inherit outline-none focus:ring-0'

function getActiveThreadId(pathname: string) {
  if (!pathname.startsWith(`${CHAT_HREF}/`)) {
    return null
  }

  const segment = pathname.slice(`${CHAT_HREF}/`.length).split('/')[0] ?? null
  if (!segment || segment === 'projects') {
    return null
  }

  return segment
}

function buildThreadItem({
  thread,
  editingThreadId,
  editingTitle,
  editingInputRef,
  setEditingTitle,
  startEditingThread,
  submitRenameThread,
  cancelEditingThread,
  handleCopyThreadLink,
  handleDeleteThread,
  isPersisted,
}: {
  thread: ThreadItemRow
  editingThreadId: string | null
  editingTitle: string
  editingInputRef: RefObject<HTMLInputElement | null>
  setEditingTitle: (value: string) => void
  startEditingThread: (threadId: string, currentTitle: string) => void
  submitRenameThread: (threadId: string, currentTitle: string) => Promise<void>
  cancelEditingThread: () => void
  handleCopyThreadLink: (threadId: string) => Promise<void>
  handleDeleteThread: (threadId: string) => Promise<void>
  isPersisted: boolean
}): NavItemType {
  const status = thread.generationStatus
  const currentTitle = thread.title || m.chat_sidebar_thread_untitled()
  const showSpinner =
    status === 'pending' || status === 'generation' || status === undefined
  const showError = status === 'failed'
  const isEditing = editingThreadId === thread.threadId

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
        <Spinner
          className="size-4 animate-spin text-foreground-secondary"
          aria-hidden
        />
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
      isPersisted && !isEditing ? (
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
}

function ThreadHistorySkeletonRow({ style }: { style: CSSProperties }) {
  return (
    <div style={style} className="absolute left-0 top-0 w-full pr-3">
      <div className={THREAD_ROW_SHELL_CLASS}>
        <div
          aria-hidden
          className={`${buttonVariants({
            variant: 'sidebarNavItem',
            size: 'sidebarNavItem',
          })} justify-start`}
        >
          <div className="h-3 w-[72%] rounded bg-surface-inverse/10" />
        </div>
      </div>
    </div>
  )
}

type ThreadRenameInputProps = {
  threadId: string
  currentTitle: string
  value: string
  onChange: (value: string) => void
  onSubmit: (threadId: string, currentTitle: string) => void
  onCancel: () => void
  inputRef: RefObject<HTMLInputElement | null>
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

/**
 * Dedicated history list that keeps Zero subscriptions scoped to the visible pages.
 */
function ChatSidebarHistory({
  pathname,
  activeOrganizationId,
}: {
  pathname: string
  activeOrganizationId: string
}) {
  const navigate = useNavigate()
  const z = useZero()
  const listRef = useRef<HTMLDivElement>(null)
  const editingInputRef = useRef<HTMLInputElement>(null)
  const [scrollState, setScrollState] =
    useHistoryScrollState<ThreadHistoryCursor>(HISTORY_SCROLL_STATE_KEY)
  const [optimisticThreads, setOptimisticThreads] = useState<
    readonly OptimisticThread[]
  >([])
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [contextMenuResetToken, setContextMenuResetToken] = useState(0)
  const activeThreadId = useMemo(() => getActiveThreadId(pathname), [pathname])
  const listContextParams = useMemo<ThreadHistoryListContext>(
    () => ({ organizationId: activeOrganizationId }),
    [activeOrganizationId],
  )

  const getPageQuery = useCallback(
    ({
      limit,
      start,
      dir,
      settled,
    }: {
      limit: number
      start: ThreadHistoryCursor | null
      dir: 'forward' | 'backward'
      settled: boolean
    }) => ({
      query: queries.threads.historyPage({
        organizationId: activeOrganizationId,
        limit,
        start,
        dir,
        inclusive: start === null,
      }),
      options: settled ? CACHE_CHAT_NAV : undefined,
    }),
    [activeOrganizationId],
  )

  const getSingleQuery = useCallback(
    ({ id, settled }: { id: string; settled: boolean }) => ({
      query: queries.threads.byId({
        threadId: id,
        organizationId: activeOrganizationId,
      }),
      options: settled ? CACHE_CHAT_NAV : undefined,
    }),
    [activeOrganizationId],
  )

  const { virtualizer, rowAt, complete, rowsEmpty } = useZeroVirtualizer<
    HTMLDivElement,
    HTMLDivElement,
    ThreadHistoryListContext,
    ThreadHistoryRow,
    ThreadHistoryCursor
  >({
    listContextParams,
    scrollState,
    onScrollStateChange: setScrollState,
    permalinkID: activeThreadId,
    estimateSize: useCallback(() => THREAD_ROW_HEIGHT, []),
    overscan: THREAD_ROW_OVERSCAN,
    getScrollElement: useCallback(() => listRef.current, []),
    getRowKey: useCallback((thread: ThreadHistoryRow) => thread.threadId, []),
    toStartRow: useCallback(
      (thread) => ({
        updatedAt: thread.updatedAt,
        threadId: thread.threadId,
      }),
      [],
    ),
    getPageQuery,
    getSingleQuery,
  })

  const virtualItems = virtualizer.getVirtualItems()
  const visibleThreads = useMemo(
    () =>
      virtualItems
        .map((item) => rowAt(item.index))
        .filter((thread): thread is ThreadHistoryRow => thread !== undefined),
    [rowAt, virtualItems],
  )
  const persistedVisibleThreadIds = useMemo(
    () => new Set(visibleThreads.map((thread) => thread.threadId)),
    [visibleThreads],
  )
  const pinnedOptimisticThreads = useMemo(
    () =>
      optimisticThreads.filter(
        (thread) => !persistedVisibleThreadIds.has(thread.threadId),
      ),
    [optimisticThreads, persistedVisibleThreadIds],
  )

  useEffect(() => {
    if (editingThreadId) {
      editingInputRef.current?.focus()
      editingInputRef.current?.select()
    }
  }, [editingThreadId])

  useEffect(() => {
    const resetContextMenus = () => {
      setContextMenuResetToken((previous) => previous + 1)
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        resetContextMenus()
      }
    }
    window.addEventListener('focus', resetContextMenus)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      window.removeEventListener('focus', resetContextMenus)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  useEffect(() => {
    syncThreadGenerationStatuses(
      visibleThreads.map((thread) => ({
        threadId: thread.threadId,
        generationStatus: thread.generationStatus,
      })),
    )
  }, [visibleThreads])

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
        return [payload, ...previous].sort(
          (left, right) => right.createdAt - left.createdAt,
        )
      })
    }

    window.addEventListener(OPTIMISTIC_THREAD_CREATED_EVENT, onOptimisticThread)
    return () => {
      window.removeEventListener(
        OPTIMISTIC_THREAD_CREATED_EVENT,
        onOptimisticThread,
      )
    }
  }, [])

  const preloadThreadMessages = useCallback(
    (threadId: string) => {
      z.preload(queries.messages.byThread({ threadId }), CACHE_CHAT_NAV)
    },
    [z],
  )

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
          navigate({ to: CHAT_HREF })
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

  const renderRow = useCallback(
    (thread: ThreadItemRow, style: CSSProperties, isPersisted: boolean) => {
      const item = buildThreadItem({
        thread,
        editingThreadId,
        editingTitle,
        editingInputRef,
        setEditingTitle,
        startEditingThread,
        submitRenameThread,
        cancelEditingThread,
        handleCopyThreadLink,
        handleDeleteThread,
        isPersisted,
      })

      return (
        <div
          key={thread.threadId}
          style={style}
          className="absolute left-0 top-0 w-full"
          onPointerEnter={() => preloadThreadMessages(thread.threadId)}
          onFocus={() => preloadThreadMessages(thread.threadId)}
        >
          <div className={THREAD_ROW_SHELL_CLASS}>
            <SidebarNavItem
              item={item}
              pathname={pathname}
              contextMenuResetToken={contextMenuResetToken}
            />
          </div>
        </div>
      )
    },
    [
      cancelEditingThread,
      editingThreadId,
      editingTitle,
      handleCopyThreadLink,
      handleDeleteThread,
      pathname,
      preloadThreadMessages,
      startEditingThread,
      submitRenameThread,
    ],
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-2 shrink-0 pl-3 pr-3 text-sm text-foreground-secondary">
        {CHAT_HISTORY_SECTION_NAME()}
      </div>
      {pinnedOptimisticThreads.length > 0 ? (
        <div className="shrink-0 pr-3">
          {pinnedOptimisticThreads.map((thread) =>
            renderRow(
              {
                threadId: thread.threadId,
                title: thread.title,
                generationStatus: undefined,
              },
              { position: 'relative' },
              false,
            ),
          )}
        </div>
      ) : null}
      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto">
        {rowsEmpty &&
        pinnedOptimisticThreads.length === 0 &&
        complete ? null : (
          <div
            className="relative"
            style={{ height: virtualizer.getTotalSize() }}
          >
            {virtualItems.map((virtualRow) => {
              const thread = rowAt(virtualRow.index)
              if (!thread) {
                return (
                  <ThreadHistorySkeletonRow
                    key={virtualRow.key}
                    style={{ transform: `translateY(${virtualRow.start}px)` }}
                  />
                )
              }

              return renderRow(
                thread,
                { transform: `translateY(${virtualRow.start}px)` },
                true,
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export function ChatSidebarContent({ pathname }: { pathname: string }) {
  const { activeOrganizationId } = useAppAuth()
  const normalizedOrganizationId =
    activeOrganizationId?.trim() ?? '__missing_org__'
  const staticSections = useMemo(() => getStaticSections(), [])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SidebarAreaLayout
        title={CHAT_SIDEBAR_TITLE()}
        sections={staticSections}
        pathname={pathname}
      />
      <div className="mt-8 flex min-h-0 flex-1 flex-col">
        <ChatSidebarHistory
          pathname={pathname}
          activeOrganizationId={normalizedOrganizationId}
        />
      </div>
    </div>
  )
}

export function chatNavArea() {
  return {
    ...chatNavStaticConfig(),
    ContentComponent: ChatSidebarContent,
  }
}
