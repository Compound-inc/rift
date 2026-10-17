// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { AssistantMessageParts } from '../assistant-message-parts'
import type { UIMessage } from 'ai'

// Keep the real Streamdown parser/processor cache. Only optional code/math
// plugins are irrelevant to this citation regression.
vi.mock('./use-streamdown-plugins', () => ({
  useStreamdownPlugins: () => undefined,
}))
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function parts(url: string, includeSources = true): UIMessage['parts'] {
  return [
    { type: 'text', text: `Evidence [[2]](${url}). Follow step [2].` },
    ...(includeSources
      ? [
          {
            type: 'source-url' as const,
            sourceId: 'random-first',
            url: 'https://other.example/unrelated',
          },
          { type: 'source-url' as const, sourceId: 'random-second', url },
        ]
      : []),
  ]
}

it('renders independent destinations through real Streamdown, including sources arriving after text', () => {
  const open = vi.spyOn(window, 'open').mockReturnValue(null)
  const view = (includeSources: boolean) => (
    <>
      <div data-testid="first">
        <AssistantMessageParts
          parts={parts('https://alpha.example/a')}
          isMessageStreaming={false}
        />
      </div>
      <div data-testid="second">
        <AssistantMessageParts
          parts={parts('https://beta.example/b', includeSources)}
          isMessageStreaming
        />
      </div>
    </>
  )
  const { rerender } = render(view(false))
  fireEvent.click(
    within(screen.getByTestId('first')).getByRole('button', {
      name: /Open citation/,
    }),
  )
  fireEvent.click(
    within(screen.getByTestId('second')).getByRole('button', {
      name: /Open citation/,
    }),
  )
  expect(open.mock.calls.map(([url]) => url)).toEqual([
    'https://alpha.example/a',
    'https://beta.example/b',
  ])
  rerender(view(true))
  fireEvent.click(
    within(screen.getByTestId('second')).getByRole('button', {
      name: /Open citation/,
    }),
  )
  expect(open).toHaveBeenLastCalledWith(
    'https://beta.example/b',
    '_blank',
    'noopener,noreferrer',
  )
  expect(screen.getAllByText(/Follow step \[2\]/)).toHaveLength(2)
  expect(screen.queryAllByRole('img')).toHaveLength(0)
})
