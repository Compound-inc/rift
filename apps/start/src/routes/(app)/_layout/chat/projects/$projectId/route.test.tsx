// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import type { FunctionComponent } from 'react'
import { Route } from './route'

const { auth, navigate, useQueryMock, childMounted } = vi.hoisted(() => ({
  auth: {
    user: { id: 'member' } as { id: string } | null,
    loading: false,
    isAnonymous: false,
  },
  navigate: vi.fn(),
  useQueryMock: vi.fn(),
  childMounted: vi.fn(),
}))
vi.mock('@/lib/frontend/auth/use-auth', () => ({ useAppAuth: () => auth }))
vi.mock('@rocicorp/zero/react', () => ({ useQuery: useQueryMock }))
vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  createFileRoute: () => (options: unknown) => ({
    options,
    useParams: () => ({ projectId: 'p' }),
  }),
  useNavigate: () => navigate,
}))
const Layout = Route.options.component as FunctionComponent
const childRoutes = ['home', 'settings', 'sources', 'skills'] as const

/** Real nested outlets ensure the guard prevents child pages from mounting. */
function renderProjectRoute(child: (typeof childRoutes)[number]) {
  const root = createRootRoute({ component: Outlet })
  const layout = createRoute({
    getParentRoute: () => root,
    path: '/chat/projects/$projectId',
    component: Layout,
  })
  const children = childRoutes.map((name) =>
    createRoute({
      getParentRoute: () => layout,
      path: name === 'home' ? '/' : name,
      component: () => {
        childMounted(name)
        return <div>{name} outlet</div>
      },
    }),
  )
  const router = createRouter({
    routeTree: root.addChildren([layout.addChildren(children)]),
    history: createMemoryHistory({
      initialEntries: [
        `/chat/projects/p${child === 'home' ? '' : `/${child}`}`,
      ],
    }),
  })
  return render(<RouterProvider router={router} />)
}

beforeEach(() => {
  vi.clearAllMocks()
  auth.user = { id: 'member' }
  auth.loading = false
  auth.isAnonymous = false
  useQueryMock.mockReturnValue([{ id: 'p' }, { type: 'complete' }])
})
afterEach(cleanup)

describe.each(childRoutes)('project %s route availability', (child) => {
  it.each([undefined, null])(
    'blocks the child when the completed query returns %s',
    async (project) => {
      useQueryMock.mockReturnValue([project, { type: 'complete' }])
      renderProjectRoute(child)
      expect((await screen.findByRole('status')).textContent).toContain(
        "This project isn't available",
      )
      expect(
        screen.getByText(
          'It may have been deleted, or you may no longer have access.',
        ),
      ).toBeTruthy()
      expect(screen.getByRole('link').getAttribute('href')).toBe('/chat')
      expect(childMounted).not.toHaveBeenCalled()
      expect(navigate).not.toHaveBeenCalled()
    },
  )

  it('preserves the normal child loading behavior without an unavailable flash', async () => {
    useQueryMock.mockReturnValue([undefined, { type: 'unknown' }])
    renderProjectRoute(child)
    expect(await screen.findByText(`${child} outlet`)).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByText("This project isn't available")).toBeNull()
  })

  it('renders the child when the project exists', async () => {
    renderProjectRoute(child)
    expect(await screen.findByText(`${child} outlet`)).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
    expect(navigate).not.toHaveBeenCalled()
  })
})

describe('project layout authentication', () => {
  it.each(['anonymous', 'signed out'])(
    'redirects %s users to chat',
    async (kind) => {
      auth.isAnonymous = kind === 'anonymous'
      if (kind === 'signed out') auth.user = null
      renderProjectRoute('home')
      await screen.findByText('home outlet')
      expect(navigate).toHaveBeenCalledWith({ to: '/chat' })
    },
  )

  it('waits for authentication to resolve before redirecting', async () => {
    auth.loading = true
    auth.user = null
    renderProjectRoute('home')
    await screen.findByText('home outlet')
    expect(navigate).not.toHaveBeenCalled()
  })
})
