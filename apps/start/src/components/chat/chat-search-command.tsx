'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Plus,
  MessageCircle,
  MessageSquareText,
  Moon,
  Search,
  SearchX,
  Sun,
  User,
} from 'lucide-react'
import { useTheme } from '@rift/ui/hooks/useTheme'
import { useNavigate } from '@tanstack/react-router'
import { AppCommandDialog, type AppCommandGroup } from '@/components/layout/command/app-command-dialog'
import { searchChatThreads } from '@/lib/frontend/chat/chat-search.functions'
import type { ChatSearchResult } from '@/lib/shared/chat-search'
import { normalizeSearchQuery } from '@/lib/shared/chat-search-highlight'
import { m } from '@/paraglide/messages.js'
import {
  clearPendingChatSearchReveal,
  setPendingChatSearchReveal,
} from './chat-search-reveal-store'

const DEFAULT_RESULT_LIMIT = 20
const SEARCH_DEBOUNCE_MS = 120
const OPEN_CHAT_SEARCH_COMMAND_EVENT = 'chat:open-search-command'

type OpenChatSearchCommandOptions = {
  /**
   * When true, the command dialog opens in "search-only" mode and hides
   * action shortcuts so users can focus exclusively on thread/message results.
   */
  hideActions?: boolean
}

/**
 * Opens the chat search command palette.
 */
export function openChatSearchCommand(options: OpenChatSearchCommandOptions = {}) {
  window.dispatchEvent(
    new CustomEvent<OpenChatSearchCommandOptions>(OPEN_CHAT_SEARCH_COMMAND_EVENT, {
      detail: options,
    }),
  )
}

function useDebouncedValue(value: string, delayMs: number): string {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedValue(value)
    }, delayMs)

    return () => {
      window.clearTimeout(handle)
    }
  }, [value, delayMs])

  return debouncedValue
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tagName = target.tagName.toLowerCase()
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select'
}

function formatResultDate(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return ''
  }

  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const now = new Date()
  const includeYear = date.getFullYear() !== now.getFullYear()

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    ...(includeYear ? { year: 'numeric' as const } : {}),
  }).format(date)
}

/**
 * Command dialog provider for chat history search/actions.
 *
 * The dialog is intentionally provider-driven: the generic shell receives
 * grouped items, which lets future command providers inject settings/actions
 * without reshaping the core dialog component.
 */
export function ChatSearchCommand() {
  const navigate = useNavigate()
  const { resolvedTheme, setTheme, mounted } = useTheme()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<readonly ChatSearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [lastSettledQuery, setLastSettledQuery] = useState('')
  const [hideActionGroups, setHideActionGroups] = useState(false)
  const requestSequenceRef = useRef(0)
  const debouncedQuery = useDebouncedValue(query, SEARCH_DEBOUNCE_MS)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') {
        return
      }
      if (isEditableTarget(event.target)) {
        return
      }

      event.preventDefault()
      setHideActionGroups(false)
      setOpen((current) => !current)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  useEffect(() => {
    const onOpenRequest = (event: Event) => {
      const customEvent = event as CustomEvent<OpenChatSearchCommandOptions>
      setHideActionGroups(Boolean(customEvent.detail?.hideActions))
      setOpen(true)
    }

    window.addEventListener(OPEN_CHAT_SEARCH_COMMAND_EVENT, onOpenRequest)
    return () => {
      window.removeEventListener(OPEN_CHAT_SEARCH_COMMAND_EVENT, onOpenRequest)
    }
  }, [])

  useEffect(() => {
    if (!open) {
      requestSequenceRef.current += 1
      setQuery('')
      setResults([])
      setErrorMessage(null)
      setIsLoading(false)
      setLastSettledQuery('')
      setHideActionGroups(false)
      return
    }

    const nextQuery = normalizeSearchQuery(debouncedQuery)
    if (nextQuery.length === 0) {
      setResults([])
      setErrorMessage(null)
      setIsLoading(false)
      setLastSettledQuery('')
      return
    }

    const requestSequence = requestSequenceRef.current + 1
    requestSequenceRef.current = requestSequence
    setIsLoading(true)
    setErrorMessage(null)

    void searchChatThreads({
      data: {
        query: nextQuery,
        limit: DEFAULT_RESULT_LIMIT,
      },
    })
      .then((response) => {
        if (requestSequenceRef.current !== requestSequence) {
          return
        }
        setResults(response)
        setLastSettledQuery(nextQuery)
      })
      .catch((error) => {
        if (requestSequenceRef.current !== requestSequence) {
          return
        }
        setResults([])
        setLastSettledQuery(nextQuery)
        setErrorMessage(
          error instanceof Error
            ? error.message
            : m.chat_search_results_error(),
        )
      })
      .finally(() => {
        if (requestSequenceRef.current === requestSequence) {
          setIsLoading(false)
        }
      })
  }, [debouncedQuery, open])

  const normalizedQuery = normalizeSearchQuery(query)
  const normalizedDebouncedQuery = normalizeSearchQuery(debouncedQuery)
  const isDebouncePending = normalizedQuery.length > 0 && normalizedQuery !== normalizedDebouncedQuery

  const hasAnySettledSearch = lastSettledQuery.length > 0
  const hasNoResults = results.length === 0
  const isSettledForCurrentQuery =
    !isLoading && !isDebouncePending && lastSettledQuery === normalizedQuery
  const isSearchOnlySidebarMode = hideActionGroups
  const isEmptyQuery = normalizedQuery.length === 0
  const shouldShowIdleSearchPrompt =
    isSearchOnlySidebarMode &&
    (isEmptyQuery || (!hasAnySettledSearch && hasNoResults))

  const shouldShowEmptyState =
    shouldShowIdleSearchPrompt ||
    (!isEmptyQuery &&
      hasNoResults &&
      (isSettledForCurrentQuery || hasAnySettledSearch))

  const emptyStateText = shouldShowIdleSearchPrompt
    ? m.chat_search_empty_idle()
    : errorMessage ?? m.chat_search_empty_results()
  const emptyStateIcon = shouldShowIdleSearchPrompt
    ? <Search aria-hidden="true" />
    : <SearchX aria-hidden="true" />

  const openSearchResult = useCallback(
    (result: ChatSearchResult) => {
      if (result.messageId) {
        setPendingChatSearchReveal({
          threadId: result.threadId,
          messageId: result.messageId,
          query: normalizeSearchQuery(query),
          nonce: String(Date.now()),
        })
      } else {
        clearPendingChatSearchReveal()
      }

      setOpen(false)
      void navigate({
        to: '/chat/$threadId',
        params: { threadId: result.threadId },
      })
    },
    [navigate, query],
  )

  const groups = useMemo<readonly AppCommandGroup[]>(() => {
    const items = results.map((result) => ({
      id: `${result.threadId}:${result.messageId ?? 'title'}`,
      title: result.threadTitle,
      subtitle:
        result.matchType === 'message'
          ? result.snippet ?? m.chat_search_match_message()
          : undefined,
      subtitleHighlightQuery:
        result.matchType === 'message' ? normalizeSearchQuery(query) : undefined,
      meta: formatResultDate(result.matchedAt),
      icon:
        result.matchType === 'message' ? (
          <MessageSquareText className="size-4" />
        ) : (
          <MessageCircle className="size-4" />
        ),
      onSelect: () => {
        openSearchResult(result)
      },
    }))

    return [
      {
        id: 'chat-results',
        heading: m.chat_search_group_threads(),
        items,
      },
    ]
  }, [openSearchResult, query, results])

  /**
   * Command actions are injected into the shared dialog so users get useful
   * shortcuts before typing, while still allowing the same query field to
   * search both actions and threads once input starts.
   */
  const actionGroups = useMemo<readonly AppCommandGroup[]>(() => {
    const canResolveTheme = mounted
    const nextTheme = canResolveTheme && resolvedTheme === 'dark' ? 'light' : 'dark'
    const themeActionTitle = nextTheme === 'dark' ? 'Switch to dark mode' : 'Switch to light mode'

    return [
      {
        id: 'chat-actions',
        heading: 'Actions',
        items: [
          {
            id: 'new-chat',
            title: 'New chat',
            value: 'new chat create conversation thread',
            icon: <Plus className="size-4" />,
            onSelect: () => {
              clearPendingChatSearchReveal()
              setOpen(false)
              void navigate({ to: '/chat' })
            },
          },
          {
            id: 'open-account',
            title: 'Account',
            value: 'account settings profile preferences',
            icon: <User className="size-4" />,
            onSelect: () => {
              setOpen(false)
              void navigate({ to: '/settings' })
            },
          },
          {
            id: 'toggle-theme',
            title: themeActionTitle,
            value: `${themeActionTitle} theme appearance color scheme`,
            icon: nextTheme === 'dark' ? (
              <Moon className="size-4" />
            ) : (
              <Sun className="size-4" />
            ),
            onSelect: () => {
              setTheme(nextTheme)
              setOpen(false)
            },
          },
        ],
      },
    ]
  }, [mounted, resolvedTheme, setTheme])

  const visibleActionGroups = hideActionGroups ? [] : actionGroups

  return (
    <AppCommandDialog
      open={open}
      onOpenChange={setOpen}
      title={m.chat_search_dialog_title()}
      description={m.chat_search_dialog_description()}
      query={query}
      onQueryChange={setQuery}
      placeholder={m.chat_search_placeholder()}
      emptyText={emptyStateText}
      emptyIcon={emptyStateIcon}
      showEmptyState={shouldShowEmptyState}
      isLoading={false}
      actionGroups={visibleActionGroups}
      groups={groups}
    />
  )
}
