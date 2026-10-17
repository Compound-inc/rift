// @vitest-environment jsdom
import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PromptInputToolbar } from './prompt-input-toolbar'
import { PromptInputTextarea } from './prompt-input-textarea'

vi.mock('./prompt-input-actions-menu', () => ({
  PromptInputActionsMenu: () => null,
}))

describe('composer stream controls', () => {
  it.each(['submitted', 'streaming'] as const)(
    'offers an enabled Stop while %s, including an empty busy composer',
    (status) => {
      const onStop = vi.fn()
      const view = render(
        <PromptInputToolbar
          status={status}
          isEmpty
          isBusy
          onStop={onStop}
          canAddMore
          canUploadFiles
          onFileSelect={vi.fn()}
          isStudyModeEnabled={false}
          isModeEnforced={false}
          onToggleStudyMode={vi.fn()}
          visibleTools={[]}
          disabledToolKeys={[]}
          onToolDisabledKeysChange={vi.fn()}
          contextWindowSupportsMaxMode={false}
          isMaxContextEnabled={false}
          onMaxContextChange={vi.fn()}
        />,
      )
      const button = view.getByRole('button', {
        name: 'Stop generation',
      }) as HTMLButtonElement
      expect(button.disabled).toBe(false)
      expect(button.type).toBe('button')
      fireEvent.click(button)
      expect(onStop).toHaveBeenCalledOnce()
    },
  )
  it('handles Escape only when another composer control has not consumed it', () => {
    const onEscape = vi.fn()
    const view = render(<PromptInputTextarea onEscape={onEscape} />)
    const textarea = view.getByRole('textbox')
    fireEvent.keyDown(textarea, { key: 'Escape' })
    expect(onEscape).toHaveBeenCalledOnce()
    textarea.addEventListener('keydown', (event) => event.preventDefault(), {
      capture: true,
      once: true,
    })
    fireEvent.keyDown(textarea, { key: 'Escape' })
    expect(onEscape).toHaveBeenCalledOnce()
  })
})
