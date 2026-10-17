// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { ChatProjectScopedSidebarContent } from './chat-sidebar-project-scope'

const { useQueryMock } = vi.hoisted(() => ({ useQueryMock: vi.fn() }))
vi.mock('@rocicorp/zero/react', () => ({ useQuery: useQueryMock }))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}))
vi.mock('./thread-status-store', () => ({
  syncThreadGenerationStatuses: vi.fn(),
}))
vi.mock('./thread-row-shared', () => ({}))
vi.mock('@/components/layout/sidebar/sidebar-nav-item', () => ({
  SidebarNavItem: ({ item }: { item: { href: string; name: string } }) => (
    <a href={item.href}>{item.name}</a>
  ),
}))
afterEach(cleanup)

describe('missing project sidebar', () => {
  it('keeps a way back without stale project links or a permanent loading label', () => {
    useQueryMock
      .mockReturnValueOnce([undefined, { type: 'complete' }])
      .mockReturnValueOnce([[]])
    render(
      <ChatProjectScopedSidebarContent
        projectId="missing"
        pathname="/chat/projects/missing/settings"
      />,
    )
    expect(screen.getByText("This project isn't available")).toBeTruthy()
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(1)
    expect(links[0].getAttribute('href')).toBe('/chat')
  })

  it('does not label a hydrating project as unavailable', () => {
    useQueryMock
      .mockReturnValueOnce([undefined, { type: 'unknown' }])
      .mockReturnValueOnce([[]])
    render(
      <ChatProjectScopedSidebarContent
        projectId="p"
        pathname="/chat/projects/p"
      />,
    )
    expect(screen.queryByText("This project isn't available")).toBeNull()
    expect(screen.getAllByRole('link')).toHaveLength(5)
  })
})
