// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { ModelSelectorPanel } from './model-selector-panel'

vi.mock('@/lib/frontend/access-control', () => ({
  getLocalizedFeatureAccessGateMessage: () => 'Upgrade to use this model',
}))

afterEach(cleanup)

const options = [
  { id: 'openai/gpt-6.1-sol', name: 'GPT-6.1 Sol' },
  { id: 'openai/gpt-5.5', name: 'GPT-5.5' },
  { id: 'anthropic/claude-opus-5.5', name: 'Claude Opus 5.5' },
  { id: 'anthropic/claude-opus-4.7', name: 'Claude Opus 4.7' },
]

async function openPicker(value = options[0].id) {
  const onValueChange = vi.fn()
  render(
    <ModelSelectorPanel
      value={value}
      options={options}
      onValueChange={onValueChange}
    />,
  )
  fireEvent.click(screen.getByRole('button'))
  await screen.findByRole('textbox')
  return onValueChange
}

describe('model selector legacy disclosure', () => {
  it('collapses older models and reveals search matches for selection', async () => {
    const onValueChange = await openPicker()
    const disclosure = screen.getByText('Legacy models').closest('details')!
    expect(disclosure.open).toBe(false)
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'GPT-5.5' },
    })
    await waitFor(() => expect(disclosure.open).toBe(true))
    fireEvent.click(screen.getByRole('button', { name: /GPT-5.5/ }))
    expect(onValueChange).toHaveBeenCalledWith('openai/gpt-5.5')
  })

  it('opens the selected legacy model and gives each provider its own disclosure', async () => {
    await openPicker('openai/gpt-5.5')
    expect(screen.getByText('Legacy models').closest('details')!.open).toBe(
      true,
    )
    fireEvent.click(screen.getByRole('button', { name: 'All providers' }))
    const disclosures = screen
      .getAllByText('Legacy models')
      .map((label) => label.closest('details')!)
    expect(disclosures).toHaveLength(2)
    expect(disclosures.map((details) => details.open)).toEqual([true, false])
  })
})
