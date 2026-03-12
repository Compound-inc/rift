// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ChatSearchCommand } from './chat-search-command'

const navigateMock = vi.fn()
const searchChatThreadsMock = vi.fn()
const setThemeMock = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}))

vi.mock('@/lib/frontend/chat/chat-search.functions', () => ({
  searchChatThreads: (input: unknown) => searchChatThreadsMock(input),
}))

vi.mock('@rift/ui/hooks/useTheme', () => ({
  useTheme: () => ({
    resolvedTheme: 'light',
    setTheme: setThemeMock,
    mounted: true,
  }),
}))

vi.mock('@/components/layout/command/app-command-dialog', () => ({
  AppCommandDialog: ({
    open,
    onOpenChange,
    query,
    onQueryChange,
    groups,
  }: {
    open: boolean
    onOpenChange: (open: boolean) => void
    query: string
    onQueryChange: (query: string) => void
    groups: Array<{
      id: string
      items: Array<{ id: string; title: string }>
    }>
  }) => {
    const itemCount = groups.reduce((total, group) => total + group.items.length, 0)

    return (
      <div>
        <div data-testid="dialog-open">{String(open)}</div>
        <div data-testid="item-count">{String(itemCount)}</div>
        {open ? (
          <>
            <input
              aria-label="query"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
            />
            <button type="button" onClick={() => onOpenChange(false)}>
              close
            </button>
            {groups.flatMap((group) =>
              group.items.map((item) => <div key={item.id}>{item.title}</div>),
            )}
          </>
        ) : null}
      </div>
    )
  },
}))

function createDeferredPromise<T>() {
  let resolve!: (value: T) => void
  let reject!: (error?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })

  return { promise, resolve, reject }
}

describe('ChatSearchCommand', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    navigateMock.mockReset()
    searchChatThreadsMock.mockReset()
    Object.defineProperty(window.navigator, 'platform', {
      configurable: true,
      value: 'MacIntel',
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('ignores a stale search response that resolves after the dialog closes', async () => {
    const deferred = createDeferredPromise([
      {
        threadId: 'thread-1',
        messageId: 'message-1',
        threadTitle: 'Stale result',
        snippet: 'match',
        matchType: 'message' as const,
        matchedAt: 1,
      },
    ] as const)
    searchChatThreadsMock.mockReturnValueOnce(deferred.promise)

    render(<ChatSearchCommand />)

    fireEvent.click(screen.getByRole('button'))
    fireEvent.change(screen.getByLabelText('query'), {
      target: { value: 'stale query' },
    })

    await act(async () => {
      vi.advanceTimersByTime(130)
      await Promise.resolve()
    })

    expect(searchChatThreadsMock).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('item-count').textContent).toBe('0')

    fireEvent.click(screen.getByRole('button', { name: 'close' }))
    expect(screen.getByTestId('dialog-open').textContent).toBe('false')

    await act(async () => {
      deferred.resolve([
        {
          threadId: 'thread-1',
          messageId: 'message-1',
          threadTitle: 'Stale result',
          snippet: 'match',
          matchType: 'message',
          matchedAt: 1,
        },
      ])
      await Promise.resolve()
    })

    expect(screen.getByTestId('item-count').textContent).toBe('0')
  })
})
