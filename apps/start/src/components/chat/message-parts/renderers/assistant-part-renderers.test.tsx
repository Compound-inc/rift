// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { AssistantTextPart } from './assistant-part-renderers'

vi.mock('./use-streamdown-plugins', () => ({
  useStreamdownPlugins: () => undefined,
}))
afterEach(cleanup)

describe('shared markdown images', () => {
  it.each([
    '![Tracking pixel](https://tracker.example/pixel.gif)',
    '<img src="https://tracker.example/pixel.gif" alt="Tracking pixel">',
    '![Tracking pixel](data:image/png;base64,aGVsbG8=)',
  ])('blocks image loading in read-only content: %s', (text) => {
    const { container } = render(
      <AssistantTextPart text={text} isMessageStreaming={false} readOnly />,
    )
    expect(container.querySelectorAll('img')).toHaveLength(0)
    expect(screen.getByText(/Tracking pixel/)).toBeTruthy()
  })
  it('keeps ordinary chat images enabled', () => {
    render(
      <AssistantTextPart
        text="![Example](https://example.com/image.png)"
        isMessageStreaming={false}
      />,
    )
    expect(
      screen.getByRole('img', { name: 'Example' }).getAttribute('src'),
    ).toBe('https://example.com/image.png')
  })
})
