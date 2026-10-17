// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { PersonalizationPage } from './personalization-page'

const { mutate, saveInstructions, manageMemory } = vi.hoisted(() => ({
  mutate: vi.fn(),
  saveInstructions: vi.fn((input: unknown) => input),
  manageMemory: vi.fn(),
}))
vi.mock('@rocicorp/zero/react', () => ({
  useZero: () => ({ mutate }),
  useQuery: () => [undefined, { type: 'complete' }],
}))
vi.mock('@/integrations/zero', () => ({
  queries: {
    personalization: { current: vi.fn(), memory: vi.fn() },
    orgPolicy: { current: vi.fn() },
  },
  mutators: { personalization: { saveInstructions } },
}))
vi.mock('@/lib/frontend/auth/use-auth', () => ({
  useAppAuth: () => ({
    user: { id: 'user-1' },
    activeOrganizationId: 'org-1',
    isAnonymous: false,
  }),
}))
vi.mock(
  '@/lib/frontend/settings/personalization/personalization.functions',
  () => ({
    managePersonalizationMemory: manageMemory,
  }),
)
vi.mock('@/components/layout', () => ({
  ContentPage: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))
beforeEach(() => {
  vi.clearAllMocks()
  manageMemory.mockResolvedValue({ configured: false })
  mutate.mockReturnValue({ server: Promise.resolve({ type: 'success' }) })
})
afterEach(cleanup)

it('shows Save before feedback exists and submits both custom instruction fields', async () => {
  render(<PersonalizationPage />)
  const save = screen.getByRole<HTMLButtonElement>('button', {
    name: 'Save instructions',
  })
  expect(save.disabled).toBe(true)
  const [aboutYou, responsePreferences] = screen.getAllByRole('textbox')
  fireEvent.change(aboutYou, { target: { value: 'I screen candidates' } })
  fireEvent.change(responsePreferences, {
    target: { value: 'Keep it concise' },
  })
  expect(save.disabled).toBe(false)
  fireEvent.click(save)
  await waitFor(() => {
    expect(saveInstructions).toHaveBeenCalledWith({
      instructionsEnabled: true,
      aboutYou: 'I screen candidates',
      responsePreferences: 'Keep it concise',
    })
    expect(save.disabled).toBe(true)
  })
  expect(mutate).toHaveBeenCalledTimes(1)
})
