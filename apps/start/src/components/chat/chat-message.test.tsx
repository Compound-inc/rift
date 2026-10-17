// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { TooltipProvider } from '@rift/ui/tooltip'
import { ChatMessage } from './chat-message'
import { m } from '@/paraglide/messages.js'

vi.mock('./message-parts', () => ({
  AssistantMessageParts: () => <p>Shared text</p>,
  AssistantMessageActions: () => <button>Private assistant action</button>,
  UserMessageActions: () => <button>Private user action</button>,
}))
vi.mock('./attachment-preview-pill', () => ({
  AttachmentPreviewPill: () => <a href="/private-file">Private file</a>,
}))

afterEach(cleanup)
describe('shared message rendering', () => {
  it.each(['user', 'assistant'] as const)(
    'shows copy only for read-only %s messages',
    (role) => {
      render(
        <TooltipProvider>
          <ChatMessage
            message={{
              id: 'message',
              role,
              parts: [{ type: 'text', text: 'Shared text' }],
              metadata: {
                attachments: [
                  {
                    key: 'file',
                    name: 'private.pdf',
                    contentType: 'application/pdf',
                  },
                ],
              },
            }}
            readOnly
            canEdit
            canRegenerate
            onEdit={vi.fn()}
            onRegenerate={vi.fn()}
          />
        </TooltipProvider>,
      )
      expect(screen.getAllByRole('button')).toHaveLength(1)
      expect(
        screen.getByRole('button', { name: m.chat_message_action_copy_text() }),
      ).toBeTruthy()
      expect(screen.queryByRole('link')).toBeNull()
    },
  )
})
