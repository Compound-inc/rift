'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Search, MessageCircle, MessageSquareText, Moon, SearchX, Sun, User } from 'lucide-react'
import { Button } from '@rift/ui/button'
import { useTheme } from '@rift/ui/hooks/useTheme'
import { cn } from '@rift/utils'
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
 * Search trigger + command dialog provider for chat history.
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
      setOpen((current) => !current)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
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

  /**
   * Empty-state visibility rules:
   * - First query: wait for debounce + request completion before showing empty.
   * - Subsequent queries after any settled search: keep empty visible while
   *   debounce/network is pending if there are still no rows, avoiding panel
   *   collapse/re-expand flicker on each keystroke.
   */
  const hasAnySettledSearch = lastSettledQuery.length > 0
  const hasNoResults = results.length === 0
  const isSettledForCurrentQuery =
    !isLoading && !isDebouncePending && lastSettledQuery === normalizedQuery

  const shouldShowEmptyState =
    normalizedQuery.length > 0 &&
    hasNoResults &&
    (isSettledForCurrentQuery || hasAnySettledSearch)

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

  return (
    <>
      <Button
        variant="sidebarNavItem"
        size="sidebarNavItem"
        onClick={() => setOpen(true)}
        className={cn(
          'mb-3 h-9 justify-between rounded-xl border border-border-faint bg-surface-inverse/5 px-3 text-foreground-secondary hover:bg-surface-inverse/7',
          'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-strong',
        )}
        aria-label={m.chat_search_trigger_aria_label()}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <Search className="size-4" />
          <span className="truncate">{m.chat_search_trigger_label()}</span>
        </span>
        <span className="shrink-0 rounded-md border border-border-faint bg-surface-base px-1.5 py-0.5 text-[11px] text-foreground-tertiary">
          {typeof navigator !== 'undefined' && navigator.platform.includes('Mac')
            ? '⌘K'
            : 'Ctrl K'}
        </span>
      </Button>

      <AppCommandDialog
        open={open}
        onOpenChange={setOpen}
        title={m.chat_search_dialog_title()}
        description={m.chat_search_dialog_description()}
        query={query}
        onQueryChange={setQuery}
        placeholder={m.chat_search_placeholder()}
        emptyText={errorMessage ?? m.chat_search_empty_results()}
        emptyIcon={<SearchX aria-hidden="true" />}
        showEmptyState={shouldShowEmptyState}
        isLoading={false}
        actionGroups={actionGroups}
        groups={groups}
      />
    </>
  )
}
