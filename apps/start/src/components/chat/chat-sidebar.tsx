// Chat navigation sidebar with static actions + virtualized thread history.
'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, RefObject } from 'react'
import type { QueryResultType } from '@rocicorp/zero'
import {
  useHistoryScrollState,
  useZeroVirtualizer,
} from '@rocicorp/zero-virtual/react'
import { useZero } from '@rocicorp/zero/react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Button, buttonVariants } from '@rift/ui/button'
import { copyToClipboard } from '@rift/utils'
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle'
import Copy from 'lucide-react/dist/esm/icons/copy'
import Link2 from 'lucide-react/dist/esm/icons/link-2'
import MessageCircle from 'lucide-react/dist/esm/icons/message-circle'
import Pencil from 'lucide-react/dist/esm/icons/pencil'
import Pin from 'lucide-react/dist/esm/icons/pin'
import PinOff from 'lucide-react/dist/esm/icons/pin-off'
import Search from 'lucide-react/dist/esm/icons/search'
import Trash2 from 'lucide-react/dist/esm/icons/trash-2'
import { SidebarGroupTooltip } from '@rift/ui/tooltip'
import { ContextMenuItem, ContextMenuSeparator } from '@rift/ui/context-menu'
import { Spinner } from '@rift/ui/spinner'
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
import { useOrgBillingSummary } from '@/lib/frontend/billing/use-org-billing'
import { m } from '@/paraglide/messages.js'
import { openChatSearchCommand } from './chat-search-command'
import { resolveChatSidebarDateGroup } from './chat-sidebar-date-groups'
import type { ChatSidebarDateGroupKey } from './chat-sidebar-date-groups'
import {
  buildRenderableHistoryItems,
  resolveRenderableHistoryGroups,
} from './chat-sidebar-history-items'
import { ChatSidebarUpgradeCta } from './chat-sidebar-upgrade-cta'
import { resolveChatSidebarBottomPanelVisibility } from './chat-sidebar.logic'
import { syncThreadGenerationStatuses } from './thread-status-store'

export const CHAT_HREF = '/chat'
export const CHAT_AREA_KEY = 'default' as const
export const CHAT_SIDEBAR_PAGE_SIZE = 100

const THREAD_ROW_HEIGHT = 36
const GROUP_HEADER_HEIGHT = 24
const THREAD_ROW_OVERSCAN = 8
const HISTORY_SCROLL_STATE_KEY = 'chatSidebarHistory'
const THREAD_ROW_SHELL_CLASS =
  'min-h-[2.25rem] pr-3 [contain-intrinsic-size:0_2.25rem]'
const GROUP_HEADER_CLASS =
  'pointer-events-none flex h-6 items-center pl-3 pr-3 text-sm text-foreground-secondary'

export const isChatPath = (pathname: string) =>
  isAreaPath(pathname, ['/', CHAT_HREF])

const CHAT_SIDEBAR_TITLE = () => m.chat_sidebar_title()

type ThreadHistoryCursor = {
  readonly pinned: boolean
  readonly updatedAt: number
  readonly threadId: string
}

type ThreadHistoryRow = QueryResultType<
  ReturnType<(typeof queries.threads)['historyPage']>
>[number]

type ThreadItemRow = {
  readonly threadId: string
  readonly title: string
  readonly pinned: boolean
  readonly updatedAt: number
  readonly generationStatus?: ThreadHistoryRow['generationStatus']
}

type ThreadHistoryListContext = {
  readonly organizationId?: string
  readonly ownerId: string
}

type ThreadHistoryGroupKey = ChatSidebarDateGroupKey | 'pinned'

const THREAD_HISTORY_GROUP_ORDER: readonly ThreadHistoryGroupKey[] = [
  'pinned',
  'today',
  'yesterday',
  'last_7_days',
  'last_30_days',
  'older',
]

function getHistoryGroupLabel(groupKey: ThreadHistoryGroupKey) {
  switch (groupKey) {
    case 'pinned':
      return m.chat_sidebar_group_pinned()
    case 'today':
      return m.chat_sidebar_group_today()
    case 'yesterday':
      return m.chat_sidebar_group_yesterday()
    case 'last_7_days':
      return m.chat_sidebar_group_last_7_days()
    case 'last_30_days':
      return m.chat_sidebar_group_last_30_days()
    case 'older':
      return m.chat_sidebar_group_older()
  }
}

function getThreadHistoryGroupKey(
  thread: ThreadItemRow,
): ThreadHistoryGroupKey {
  return thread.pinned
    ? 'pinned'
    : resolveChatSidebarDateGroup(thread.updatedAt)
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
  handleSetThreadPinned,
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
  handleSetThreadPinned: (threadId: string, pinned: boolean) => Promise<void>
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
          <ContextMenuItem
            onClick={() => {
              void handleSetThreadPinned(thread.threadId, !thread.pinned)
            }}
          >
            {thread.pinned ? <PinOff /> : <Pin />}
            {thread.pinned ? m.chat_sidebar_unpin() : m.chat_sidebar_pin()}
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

function ThreadHistoryGroupHeaderRow({
  label,
  style,
}: {
  label: string
  style: CSSProperties
}) {
  return (
    <div style={style} className="absolute left-0 top-0 w-full">
      <div className={GROUP_HEADER_CLASS}>{label}</div>
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
  historyOwnerId,
}: {
  pathname: string
  activeOrganizationId?: string
  historyOwnerId: string
}) {
  const navigate = useNavigate()
  const z = useZero()
  const listRef = useRef<HTMLDivElement>(null)
  const editingInputRef = useRef<HTMLInputElement>(null)
  const [scrollState, setScrollState] =
    useHistoryScrollState<ThreadHistoryCursor>(HISTORY_SCROLL_STATE_KEY)
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [contextMenuResetToken, setContextMenuResetToken] = useState(0)
  const [discoveredHistoryGroups, setDiscoveredHistoryGroups] = useState<
    readonly ThreadHistoryGroupKey[]
  >([])
  const activeThreadId = getActiveThreadId(pathname)
  const listContextParams = useMemo<ThreadHistoryListContext>(
    () => ({
      organizationId: activeOrganizationId,
      ownerId: historyOwnerId,
    }),
    [activeOrganizationId, historyOwnerId],
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
    /**
     * The sidebar is a recent-history nav, not a permalink-scoped detail list.
     * Passing the active route thread into Zero Virtual switches `/chat/:id`
     * onto a different bootstrap path than `/chat`, which is where the reload
     * flicker/placeholder/gap bugs come from.
     */
    estimateSize: useCallback(() => THREAD_ROW_HEIGHT, []),
    overscan: THREAD_ROW_OVERSCAN,
    getScrollElement: useCallback(() => listRef.current, []),
    getRowKey: useCallback((thread: ThreadHistoryRow) => thread.threadId, []),
    toStartRow: useCallback(
      (thread) => ({
        pinned: thread.pinned,
        updatedAt: thread.updatedAt,
        threadId: thread.threadId,
      }),
      [],
    ),
    getPageQuery,
    getSingleQuery,
  })

  const virtualItems = virtualizer.getVirtualItems()
  const renderableHistoryItems = useMemo(
    () =>
      buildRenderableHistoryItems({
        virtualItems,
        rowAt,
        getGroupKey: getThreadHistoryGroupKey,
      }),
    [rowAt, virtualItems],
  )
  const {
    visibleThreads,
    visibleGroupHeaders,
    effectiveDiscoveredGroups,
    groupOffsetBeforeByKey,
    groupOffsetThroughByKey,
  } = useMemo(() => {
    const visibleThreads: ThreadItemRow[] = []
    const visibleGroupHeaders: Extract<
      (typeof renderableHistoryItems)[number],
      { kind: 'header' }
    >[] = []

    for (const item of renderableHistoryItems) {
      if (item.kind === 'thread') {
        visibleThreads.push(item.thread)
      } else if (item.kind === 'header') {
        visibleGroupHeaders.push(item)
      }
    }

    const visibleGroupKeys = visibleGroupHeaders.map(
      (header) => header.groupKey as ThreadHistoryGroupKey,
    )
    const effectiveDiscoveredGroups = resolveRenderableHistoryGroups({
      orderedGroupKeys: THREAD_HISTORY_GROUP_ORDER,
      discoveredGroupKeys: discoveredHistoryGroups,
      visibleGroupKeys,
    })
    const groupOffsetBeforeByKey = new Map<ThreadHistoryGroupKey, number>()
    const groupOffsetThroughByKey = new Map<ThreadHistoryGroupKey, number>()

    /**
     * Headers live outside the virtual row model, so each visible thread needs
     * a deterministic offset based on the groups already discovered above it.
     * Precomputing those offsets keeps render math readable and avoids
     * repeatedly filtering the same group list for every row.
     */
    let headerOffset = 0
    for (const groupKey of effectiveDiscoveredGroups) {
      groupOffsetBeforeByKey.set(groupKey, headerOffset)
      headerOffset += GROUP_HEADER_HEIGHT
      groupOffsetThroughByKey.set(groupKey, headerOffset)
    }

    return {
      visibleThreads,
      visibleGroupHeaders,
      effectiveDiscoveredGroups,
      groupOffsetBeforeByKey,
      groupOffsetThroughByKey,
    }
  }, [discoveredHistoryGroups, renderableHistoryItems])

  useEffect(() => {
    if (editingThreadId) {
      const focusTimer = window.setTimeout(() => {
        editingInputRef.current?.focus()
        editingInputRef.current?.select()
      }, 0)

      return () => {
        window.clearTimeout(focusTimer)
      }
    }
  }, [editingThreadId])

  useEffect(() => {
    setDiscoveredHistoryGroups([])
  }, [activeOrganizationId, historyOwnerId])

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
    if (visibleGroupHeaders.length === 0) {
      return
    }

    /**
     * Preserve the set of groups the user has already scrolled through so the
     * header spacing remains stable after a label leaves the viewport.
     */
    setDiscoveredHistoryGroups((current) => {
      const next = new Set<ThreadHistoryGroupKey>(current)
      for (const header of visibleGroupHeaders) {
        next.add(header.groupKey as ThreadHistoryGroupKey)
      }

      if (next.size === current.length) {
        return current
      }

      return THREAD_HISTORY_GROUP_ORDER.filter((groupKey) => next.has(groupKey))
    })
  }, [visibleGroupHeaders])

  useEffect(() => {
    syncThreadGenerationStatuses(
      visibleThreads.map((thread) => ({
        threadId: thread.threadId,
        generationStatus: thread.generationStatus,
      })),
    )
  }, [visibleThreads])

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
        z.preload(
          queries.threads.historyPage({
            organizationId: activeOrganizationId,
            limit: CHAT_SIDEBAR_PAGE_SIZE,
            start: null,
            dir: 'forward',
            inclusive: true,
          }),
          CACHE_CHAT_NAV,
        )
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
    [activeOrganizationId, activeThreadId, navigate, z],
  )

  const handleSetThreadPinned = useCallback(
    async (threadId: string, pinned: boolean) => {
      try {
        await z.mutate(mutators.threads.setPinned({ threadId, pinned })).client
        setDiscoveredHistoryGroups([])
      } catch (error) {
        console.error('Failed to update thread pin state:', error)
        toast.error(m.chat_sidebar_thread_pin_failed())
      }
    },
    [z],
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
        handleSetThreadPinned,
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
      handleSetThreadPinned,
      pathname,
      preloadThreadMessages,
      startEditingThread,
      submitRenameThread,
    ],
  )
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto">
        {rowsEmpty && complete ? null : (
          <div
            className="relative"
            style={{
              height:
                virtualizer.getTotalSize() +
                effectiveDiscoveredGroups.length * GROUP_HEADER_HEIGHT,
            }}
          >
            {renderableHistoryItems.map((item) => {
              if (item.kind === 'header') {
                const groupKey = item.groupKey as ThreadHistoryGroupKey
                const start =
                  item.start + (groupOffsetBeforeByKey.get(groupKey) ?? 0)

                return (
                  <ThreadHistoryGroupHeaderRow
                    key={item.key}
                    label={getHistoryGroupLabel(groupKey)}
                    style={{ transform: `translateY(${start}px)` }}
                  />
                )
              }

              if (item.kind === 'skeleton') {
                return (
                  <ThreadHistorySkeletonRow
                    key={item.key}
                    style={{ transform: `translateY(${item.start}px)` }}
                  />
                )
              }

              const start =
                item.start +
                (groupOffsetThroughByKey.get(
                  getThreadHistoryGroupKey(item.thread),
                ) ?? 0)

              return renderRow(
                item.thread,
                { transform: `translateY(${start}px)` },
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
  const { activeOrganizationId, isAnonymous, loading, user } = useAppAuth()
  const { entitlement, loading: billingLoading } = useOrgBillingSummary()
  const normalizedOrganizationId = activeOrganizationId?.trim() || undefined
  // Avoid mounting the virtualized history list until auth resolves
  const shouldRenderHistory = !loading && user != null
  const staticSections = useMemo(() => getStaticSections(), [])
  const { shouldShowLoginButton, shouldShowUpgradeCta, shouldShowBottomPanel } =
    resolveChatSidebarBottomPanelVisibility({
      loading,
      user,
      isAnonymous,
      billingLoading,
      planId: entitlement?.planId,
    })

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <SidebarAreaLayout
          title={CHAT_SIDEBAR_TITLE()}
          sections={staticSections}
          pathname={pathname}
        />
        <div className="mt-8 flex min-h-0 flex-1 flex-col">
          {shouldRenderHistory ? (
            <ChatSidebarHistory
              pathname={pathname}
              activeOrganizationId={normalizedOrganizationId}
              historyOwnerId={user.id}
            />
          ) : null}
        </div>
      </div>
      {shouldShowBottomPanel ? (
        <div className="flex-shrink-0 bg-surface-overlay px-3 py-3">
          {shouldShowLoginButton ? (
            <Button asChild size="default" className="w-full">
              <Link to="/auth/sign-in" preload="intent">
                {m.auth_login_sign_in()}
              </Link>
            </Button>
          ) : null}
          {shouldShowUpgradeCta ? <ChatSidebarUpgradeCta /> : null}
        </div>
      ) : null}
    </div>
  )
}

export function chatNavArea() {
  return {
    ...chatNavStaticConfig(),
    ContentComponent: ChatSidebarContent,
  }
}
