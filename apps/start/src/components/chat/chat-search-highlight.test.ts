// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  clearSearchHighlights,
  highlightSearchQueryInMessage,
} from './chat-search-highlight'

describe('chat-search-highlight', () => {
  it('highlights each query token independently so reveal matches command preview', () => {
    const container = document.createElement('div')
    container.textContent = 'the dragons tend to fly'

    const highlighted = highlightSearchQueryInMessage({
      container,
      query: 'dragon fly',
    })

    expect(highlighted).toBe(true)
    expect(
      [...container.querySelectorAll('mark[data-chat-search-highlight="true"]')].map(
        (element) => element.textContent,
      ),
    ).toEqual(['dragon', 'fly'])
  })

  it('removes transient highlights and restores plain text content', () => {
    const container = document.createElement('div')
    container.textContent = 'the dragons tend to fly'

    highlightSearchQueryInMessage({
      container,
      query: 'dragon fly',
    })
    clearSearchHighlights(container)

    expect(container.textContent).toBe('the dragons tend to fly')
    expect(
      container.querySelectorAll('mark[data-chat-search-highlight="true"]'),
    ).toHaveLength(0)
  })
})
