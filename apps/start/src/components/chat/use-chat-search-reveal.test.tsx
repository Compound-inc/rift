import { act, render } from '@testing-library/react'
import type { UIMessage } from 'ai'
// @ts-expect-error jsdom types are not installed in this workspace test setup.
import { JSDOM } from 'jsdom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getPendingChatSearchReveal,
  setPendingChatSearchReveal,
} from './chat-search-reveal-store'
import { useChatSearchReveal } from './use-chat-search-reveal'

const highlightSearchQueryInMessageMock = vi.fn((_input?: unknown) => true)
const clearSearchHighlightsMock = vi.fn()

vi.mock('./chat-search-highlight', () => ({
  highlightSearchQueryInMessage: (input: unknown) =>
    highlightSearchQueryInMessageMock(input),
  clearSearchHighlights: (input: unknown) => clearSearchHighlightsMock(input),
}))

function TestHarness(input: {
  readonly activeThreadId?: string
  readonly messages: readonly UIMessage[]
  readonly revealMessageBranch: (input: { messageId: string }) => Promise<boolean>
}) {
  const { disableInitialAlignment } = useChatSearchReveal(input)
  return (
    <div>
      <output data-testid="disable-initial-alignment">
        {String(disableInitialAlignment)}
      </output>
      <div data-testid="scroll-container" style={{ overflowY: 'auto' }}>
        {input.messages.map((message) => (
          <div key={message.id} id={`chat-message-${message.id}`}>
            {message.parts
              .filter(
                (
                  part,
                ): part is Extract<typeof part, { type: 'text'; text: string }> =>
                  part.type === 'text',
              )
              .map((part) => part.text)
              .join(' ')}
          </div>
        ))}
      </div>
    </div>
  )
}

describe('useChatSearchReveal', () => {
  let dom: JSDOM

  beforeEach(() => {
    dom = new JSDOM('<!doctype html><html><body></body></html>')
    const immediateTimeout = ((callback: TimerHandler) => {
      if (typeof callback === 'function') {
        callback()
      }
      return 1
    }) as typeof globalThis.setTimeout
    Object.assign(globalThis, {
      window: dom.window,
      document: dom.window.document,
      HTMLElement: dom.window.HTMLElement,
      NodeFilter: dom.window.NodeFilter,
      requestAnimationFrame: (callback: FrameRequestCallback) => {
        callback(0)
        return 1
      },
      setTimeout: immediateTimeout,
      clearTimeout: (() => undefined) as typeof globalThis.clearTimeout,
    })
    dom.window.setTimeout = immediateTimeout
    dom.window.clearTimeout = (() => undefined) as typeof dom.window.clearTimeout
    document.body.innerHTML = ''
    highlightSearchQueryInMessageMock.mockClear()
    clearSearchHighlightsMock.mockClear()
  })

  it('activates a hidden branch first, then highlights once the message becomes visible', async () => {
    const revealMessageBranch = vi.fn(async () => true)
    const scrollIntoViewMock = vi.fn()
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView
    HTMLElement.prototype.scrollIntoView = scrollIntoViewMock

    setPendingChatSearchReveal({
      threadId: 'thread-1',
      messageId: 'hidden-message',
      query: 'target',
      nonce: '1',
    })

    const { rerender } = render(
      <TestHarness
        activeThreadId="thread-1"
        messages={[
          {
            id: 'visible-message',
            role: 'assistant',
            parts: [{ type: 'text', text: 'visible' }],
          },
        ]}
        revealMessageBranch={revealMessageBranch}
      />,
    )

    await act(async () => {
      await Promise.resolve()
    })

    expect(revealMessageBranch).toHaveBeenCalledWith({
      messageId: 'hidden-message',
    })
    expect(scrollIntoViewMock).not.toHaveBeenCalled()

    rerender(
      <TestHarness
        activeThreadId="thread-1"
        messages={[
          {
            id: 'hidden-message',
            role: 'assistant',
            parts: [{ type: 'text', text: 'search target' }],
          },
        ]}
        revealMessageBranch={revealMessageBranch}
      />,
    )

    await act(async () => {
      await Promise.resolve()
    })

    expect(scrollIntoViewMock).toHaveBeenCalled()
    expect(highlightSearchQueryInMessageMock).toHaveBeenCalled()

    expect(clearSearchHighlightsMock).toHaveBeenCalled()

    HTMLElement.prototype.scrollIntoView = originalScrollIntoView
  })

  it('clears the pending reveal after a hidden-branch activation fails', async () => {
    const revealMessageBranch = vi.fn(async () => false)

    setPendingChatSearchReveal({
      threadId: 'thread-2',
      messageId: 'missing-message',
      query: 'target',
      nonce: '2',
    })

    const view = render(
      <TestHarness
        activeThreadId="thread-2"
        messages={[
          {
            id: 'visible-message',
            role: 'assistant',
            parts: [{ type: 'text', text: 'visible' }],
          },
        ]}
        revealMessageBranch={revealMessageBranch}
      />,
    )

    expect(
      view.getByTestId('disable-initial-alignment').textContent,
    ).toBe('true')

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(revealMessageBranch).toHaveBeenCalledWith({
      messageId: 'missing-message',
    })
    expect(getPendingChatSearchReveal()).toBeNull()

    view.rerender(
      <TestHarness
        activeThreadId="thread-2"
        messages={[
          {
            id: 'visible-message',
            role: 'assistant',
            parts: [{ type: 'text', text: 'visible' }],
          },
        ]}
        revealMessageBranch={revealMessageBranch}
      />,
    )

    expect(
      view.getByTestId('disable-initial-alignment').textContent,
    ).toBe('false')
  })

  it('scrolls with top padding when target is near the top edge of a scroll container', async () => {
    const revealMessageBranch = vi.fn(async () => true)
    const scrollIntoViewMock = vi.fn()
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView
    HTMLElement.prototype.scrollIntoView = scrollIntoViewMock

    const view = render(
      <TestHarness
        activeThreadId="thread-3"
        messages={[
          {
            id: 'edge-message',
            role: 'assistant',
            parts: [{ type: 'text', text: 'near top edge' }],
          },
        ]}
        revealMessageBranch={revealMessageBranch}
      />,
    )

    const scrollContainer = view.getByTestId('scroll-container') as HTMLElement
    const target = document.getElementById('chat-message-edge-message')
    expect(target).not.toBeNull()
    if (!(target instanceof HTMLElement)) {
      throw new Error('Expected target message element to exist')
    }

    Object.defineProperty(scrollContainer, 'clientHeight', {
      configurable: true,
      value: 400,
    })
    Object.defineProperty(scrollContainer, 'scrollHeight', {
      configurable: true,
      value: 1600,
    })
    Object.defineProperty(scrollContainer, 'scrollTop', {
      configurable: true,
      value: 500,
      writable: true,
    })
    scrollContainer.getBoundingClientRect = () =>
      ({
        top: 100,
        bottom: 500,
        left: 0,
        right: 800,
        width: 800,
        height: 400,
        x: 0,
        y: 100,
        toJSON: () => ({}),
      }) as DOMRect
    target.getBoundingClientRect = () =>
      ({
        top: 110,
        bottom: 170,
        left: 0,
        right: 800,
        width: 800,
        height: 60,
        x: 0,
        y: 110,
        toJSON: () => ({}),
      }) as DOMRect

    const scrollToMock = vi.fn(
      (options: number | ScrollToOptions | undefined, _y?: number) => {
        if (typeof options === 'object' && options?.top != null) {
          scrollContainer.scrollTop = options.top
        }
      },
    )
    scrollContainer.scrollTo = scrollToMock

    await act(async () => {
      setPendingChatSearchReveal({
        threadId: 'thread-3',
        messageId: 'edge-message',
        query: 'edge',
        nonce: '3',
      })
      await Promise.resolve()
    })

    expect(scrollToMock).toHaveBeenCalledWith({
      top: 438,
      behavior: 'smooth',
    })
    expect(scrollIntoViewMock).not.toHaveBeenCalled()

    HTMLElement.prototype.scrollIntoView = originalScrollIntoView
  })

  it('does not scroll when target is already comfortably inside padded viewport bounds', async () => {
    const revealMessageBranch = vi.fn(async () => true)
    const scrollIntoViewMock = vi.fn()
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView
    HTMLElement.prototype.scrollIntoView = scrollIntoViewMock

    const view = render(
      <TestHarness
        activeThreadId="thread-4"
        messages={[
          {
            id: 'visible-message',
            role: 'assistant',
            parts: [{ type: 'text', text: 'already visible' }],
          },
        ]}
        revealMessageBranch={revealMessageBranch}
      />,
    )

    const scrollContainer = view.getByTestId('scroll-container') as HTMLElement
    const target = document.getElementById('chat-message-visible-message')
    expect(target).not.toBeNull()
    if (!(target instanceof HTMLElement)) {
      throw new Error('Expected target message element to exist')
    }

    Object.defineProperty(scrollContainer, 'clientHeight', {
      configurable: true,
      value: 400,
    })
    Object.defineProperty(scrollContainer, 'scrollHeight', {
      configurable: true,
      value: 1600,
    })
    Object.defineProperty(scrollContainer, 'scrollTop', {
      configurable: true,
      value: 500,
      writable: true,
    })
    scrollContainer.getBoundingClientRect = () =>
      ({
        top: 100,
        bottom: 500,
        left: 0,
        right: 800,
        width: 800,
        height: 400,
        x: 0,
        y: 100,
        toJSON: () => ({}),
      }) as DOMRect
    target.getBoundingClientRect = () =>
      ({
        top: 220,
        bottom: 280,
        left: 0,
        right: 800,
        width: 800,
        height: 60,
        x: 0,
        y: 220,
        toJSON: () => ({}),
      }) as DOMRect

    const scrollToMock = vi.fn()
    scrollContainer.scrollTo = scrollToMock

    await act(async () => {
      setPendingChatSearchReveal({
        threadId: 'thread-4',
        messageId: 'visible-message',
        query: 'visible',
        nonce: '4',
      })
      await Promise.resolve()
    })

    expect(scrollToMock).not.toHaveBeenCalled()
    expect(scrollIntoViewMock).not.toHaveBeenCalled()

    HTMLElement.prototype.scrollIntoView = originalScrollIntoView
  })
})
