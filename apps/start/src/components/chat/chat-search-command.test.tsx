// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ChatSearchCommand, openChatSearchCommand } from './chat-search-command'

const navigateMock = vi.fn()
const searchChatThreadsMock = vi.fn()
const setThemeMock = vi.fn()
const useHotkeyMock = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}))

vi.mock('@tanstack/react-hotkeys', () => ({
  useHotkey: (...args: unknown[]) => useHotkeyMock(...args),
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
      items: Array<{ id: string; title: string; value?: string }>
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
              group.items.map((item) => (
                <div key={item.id}>
                  <span>{item.title}</span>
                  <span data-testid={`item-value-${item.id}`}>{item.value ?? ''}</span>
                </div>
              )),
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
    useHotkeyMock.mockReset()
    Object.defineProperty(window.navigator, 'platform', {
      configurable: true,
      value: 'MacIntel',
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('ignores a stale search response that resolves after the dialog closes', async () => {
    const staleResult = [
      {
        threadId: 'thread-1',
        messageId: 'message-1',
        threadTitle: 'Stale result',
        snippet: 'match',
        matchType: 'message' as const,
        matchedAt: 1,
      },
    ] as const
    const deferred = createDeferredPromise<typeof staleResult>()
    searchChatThreadsMock.mockReturnValueOnce(deferred.promise)

    render(<ChatSearchCommand />)
    expect(useHotkeyMock).toHaveBeenCalledWith(
      'Mod+K',
      expect.any(Function),
      expect.objectContaining({
        ignoreInputs: true,
        preventDefault: true,
      }),
    )

    act(() => {
      openChatSearchCommand()
    })
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

  it('builds unique command values when multiple results share the same title', async () => {
    searchChatThreadsMock.mockResolvedValueOnce([
      {
        threadId: 'thread-1',
        messageId: undefined,
        threadTitle: 'Duplicate title',
        snippet: undefined,
        matchType: 'thread',
        matchedAt: 1,
      },
      {
        threadId: 'thread-2',
        messageId: undefined,
        threadTitle: 'Duplicate title',
        snippet: undefined,
        matchType: 'thread',
        matchedAt: 2,
      },
    ])

    render(<ChatSearchCommand />)

    act(() => {
      openChatSearchCommand()
    })
    fireEvent.change(screen.getByLabelText('query'), {
      target: { value: 'duplicate' },
    })

    await act(async () => {
      vi.advanceTimersByTime(130)
      await Promise.resolve()
    })

    const firstValue = screen.getByTestId('item-value-thread-1:title').textContent
    const secondValue = screen.getByTestId('item-value-thread-2:title').textContent

    expect(firstValue).toContain('thread-1:title')
    expect(secondValue).toContain('thread-2:title')
    expect(firstValue).not.toEqual(secondValue)
  })
})
