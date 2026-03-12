import { useEffect, useRef, useState } from 'react'
import type { UIMessage } from 'ai'
import { normalizeSearchQuery } from '@/lib/shared/chat-search-highlight'
import {
  clearSearchHighlights,
  highlightSearchQueryInMessage,
} from './chat-search-highlight'
import {
  clearPendingChatSearchReveal,
  getPendingChatSearchReveal,
  subscribeToChatSearchReveal,
  type ChatSearchRevealRequest,
} from './chat-search-reveal-store'

type UseChatSearchRevealInput = {
  readonly activeThreadId?: string
  readonly messages: readonly UIMessage[]
  readonly revealMessageBranch: (input: { messageId: string }) => Promise<boolean>
}

type UseChatSearchRevealResult = {
  readonly disableInitialAlignment: boolean
}

const REVEAL_VIEWPORT_PADDING_PX = 72

function findScrollableAncestor(node: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = node.parentElement
  while (current) {
    const style = window.getComputedStyle(current)
    const overflowY = style.overflowY
    const isScrollableOverflow =
      overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay'
    if (isScrollableOverflow && current.scrollHeight > current.clientHeight) {
      return current
    }
    current = current.parentElement
  }
  return null
}

/**
 * Reveals the target message in the nearest scroll container while preserving
 * top breathing room so highlights do not stick to the viewport edge.
 */
function revealMessageElement(messageElement: HTMLElement) {
  const scrollContainer = findScrollableAncestor(messageElement)
  if (!scrollContainer) {
    messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
    return
  }

  const containerRect = scrollContainer.getBoundingClientRect()
  const messageRect = messageElement.getBoundingClientRect()
  const viewportTopBoundary = containerRect.top + REVEAL_VIEWPORT_PADDING_PX
  const viewportBottomBoundary = containerRect.bottom - REVEAL_VIEWPORT_PADDING_PX
  const isComfortablyVisible =
    messageRect.top >= viewportTopBoundary &&
    messageRect.bottom <= viewportBottomBoundary

  if (isComfortablyVisible) {
    return
  }

  const currentScrollTop = scrollContainer.scrollTop
  const messageTopInScrollSpace =
    currentScrollTop + (messageRect.top - containerRect.top)
  const desiredScrollTop = Math.max(
    0,
    messageTopInScrollSpace - REVEAL_VIEWPORT_PADDING_PX,
  )
  const maxScrollTop = Math.max(
    0,
    scrollContainer.scrollHeight - scrollContainer.clientHeight,
  )
  const nextScrollTop = Math.min(desiredScrollTop, maxScrollTop)

  if (Math.abs(nextScrollTop - currentScrollTop) <= 1) {
    return
  }

  scrollContainer.scrollTo({
    top: nextScrollTop,
    behavior: 'smooth',
  })
}

/**
 * Coordinates the transient command-search reveal flow for a hydrated thread:
 * - waits for the requested thread to be active
 * - activates hidden branch paths when the target message is not canonical
 * - scrolls to the message and highlights the literal query text
 */
export function useChatSearchReveal(
  input: UseChatSearchRevealInput,
): UseChatSearchRevealResult {
  const [pendingReveal, setPendingReveal] = useState<ChatSearchRevealRequest | null>(
    () => getPendingChatSearchReveal(),
  )
  const handledRevealKeyRef = useRef<string | null>(null)
  const attemptedRevealSwitchKeyRef = useRef<string | null>(null)

  useEffect(() => {
    return subscribeToChatSearchReveal(() => {
      setPendingReveal(getPendingChatSearchReveal())
    })
  }, [])

  useEffect(() => {
    if (!pendingReveal || pendingReveal.threadId !== input.activeThreadId) {
      return
    }

    const revealKey = `${pendingReveal.threadId}:${pendingReveal.messageId}:${pendingReveal.nonce}`
    if (handledRevealKeyRef.current === revealKey) {
      return
    }

    const targetExists = input.messages.some(
      (message) => message.id === pendingReveal.messageId,
    )
    if (!targetExists) {
      // Hidden-branch hits need a branch switch before the canonical message
      // list can contain the searched message. Retry only when resolution
      // failed so we do not spam the branch mutator during query propagation.
      if (attemptedRevealSwitchKeyRef.current === revealKey) {
        return
      }

      attemptedRevealSwitchKeyRef.current = revealKey
      void input
        .revealMessageBranch({
          messageId: pendingReveal.messageId,
        })
        .then((didResolveTarget) => {
          if (
            !didResolveTarget &&
            attemptedRevealSwitchKeyRef.current === revealKey
          ) {
            attemptedRevealSwitchKeyRef.current = null
            clearPendingChatSearchReveal()
          }
        })
      return
    }

    handledRevealKeyRef.current = revealKey
    attemptedRevealSwitchKeyRef.current = null

    const messageElement = document.getElementById(
      `chat-message-${pendingReveal.messageId}`,
    )
    if (messageElement instanceof HTMLElement) {
      revealMessageElement(messageElement)
    }

    const normalizedRevealQuery = normalizeSearchQuery(pendingReveal.query)
    if (messageElement && normalizedRevealQuery.length > 0) {
      requestAnimationFrame(() => {
        highlightSearchQueryInMessage({
          container: messageElement,
          query: normalizedRevealQuery,
        })
      })
    }

    const clearHighlight = window.setTimeout(() => {
      clearSearchHighlights(messageElement)
      clearPendingChatSearchReveal()
    }, 3200)

    return () => {
      window.clearTimeout(clearHighlight)
    }
  }, [input.activeThreadId, input.messages, input.revealMessageBranch, pendingReveal])

  return {
    disableInitialAlignment: pendingReveal?.threadId === input.activeThreadId,
  }
}
