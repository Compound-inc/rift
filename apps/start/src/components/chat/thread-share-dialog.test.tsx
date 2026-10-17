// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { RadioGroup, RadioGroupItem } from '@rift/ui/radio-group'

afterEach(cleanup)

describe('share audience radio group', () => {
  it('supports keyboard selection and a labeled group', async () => {
    render(
      <RadioGroup aria-label="Audience" defaultValue="workspace">
        <label>
          <RadioGroupItem aria-label="Public" value="public" />
          Public
        </label>
        <label>
          <RadioGroupItem aria-label="Workspace" value="workspace" />
          Workspace
        </label>
      </RadioGroup>,
    )
    expect(screen.getByRole('radiogroup', { name: 'Audience' })).toBeTruthy()
    const workspace = screen.getByRole('radio', { name: 'Workspace' })
    act(() => workspace.focus())
    fireEvent.keyDown(workspace, { key: 'ArrowUp' })
    await waitFor(() =>
      expect(
        screen
          .getByRole('radio', { name: 'Public' })
          .getAttribute('aria-checked'),
      ).toBe('true'),
    )
  })
  it('marks unavailable public sharing as disabled', () => {
    render(
      <RadioGroup aria-label="Audience">
        <label>
          <RadioGroupItem aria-label="Public" value="public" disabled />
          Public
        </label>
      </RadioGroup>,
    )
    expect(
      screen
        .getByRole('radio', { name: 'Public' })
        .getAttribute('aria-disabled'),
    ).toBe('true')
  })
})
