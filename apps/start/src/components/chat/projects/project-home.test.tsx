// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProjectHome } from './project-home'

const { useQueryMock } = vi.hoisted(() => ({ useQueryMock: vi.fn() }))
vi.mock('@rocicorp/zero/react', () => ({ useQuery: useQueryMock }))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => (
    <a href="/chat">{children}</a>
  ),
}))
vi.mock('./project-home-header', () => ({
  ProjectHomeHeader: () => <h1>Project</h1>,
}))
vi.mock('./project-home-sections', () => ({
  ProjectHomeSections: () => <div>Sections</div>,
}))

beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: false }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('project landing availability', () => {
  it('shows unavailable and a way back when the completed query is empty', () => {
    useQueryMock.mockReturnValue([undefined, { type: 'complete' }])
    render(<ProjectHome projectId="p" composer={<textarea name="message" />} />)
    expect(screen.getByRole('status').textContent).toBe(
      "This project isn't available",
    )
    expect(screen.getByRole('link').getAttribute('href')).toBe('/chat')
    expect(screen.queryByRole('textbox')).toBeNull()
  })
  it('keeps the composer unavailable until access resolves, and removes it on revocation', () => {
    useQueryMock.mockReturnValue([undefined, { type: 'unknown' }])
    const view = render(
      <ProjectHome projectId="p" composer={<textarea name="message" />} />,
    )
    expect(screen.queryByRole('textbox')).toBeNull()
    useQueryMock.mockReturnValue([{ id: 'p' }, { type: 'complete' }])
    view.rerender(
      <ProjectHome projectId="p" composer={<textarea name="message" />} />,
    )
    expect(screen.getByRole('textbox')).toBeTruthy()
    useQueryMock.mockReturnValue([undefined, { type: 'complete' }])
    view.rerender(
      <ProjectHome projectId="p" composer={<textarea name="message" />} />,
    )
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.getByRole('status').textContent).toBe(
      "This project isn't available",
    )
  })
})
