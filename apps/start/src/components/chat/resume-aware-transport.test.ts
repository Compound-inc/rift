import { Chat } from '@ai-sdk/react'
import { createUIMessageStreamResponse } from 'ai'
import type { UIMessageChunk } from 'ai'
import { describe, expect, it } from 'vitest'
import {
  ResumeAwareChatTransport,
  resumeActiveStream,
} from './resume-aware-transport'

describe('resume result', () => {
  it('reports no active stream for a 204 from the real SDK transport', async () => {
    const chat = new Chat({
      id: 'thread',
      transport: new ResumeAwareChatTransport({
        fetch: async () => new Response(null, { status: 204 }),
      }),
    })
    expect(await resumeActiveStream(chat.resumeStream)).toBe(false)
    expect(chat.status).toBe('ready')
  })

  it('reports no active stream when the reconnect request itself fails', async () => {
    const chat = new Chat({
      id: 'thread',
      transport: new ResumeAwareChatTransport({
        fetch: async () => new Response('boom', { status: 500 }),
      }),
    })
    expect(await resumeActiveStream(chat.resumeStream)).toBe(false)
  })

  it('attaches the remote generation ID from replayed start metadata', async () => {
    const chat = new Chat({
      id: 'thread',
      transport: new ResumeAwareChatTransport({
        fetch: async () =>
          createUIMessageStreamResponse({
            stream: new ReadableStream<UIMessageChunk>({
              start(controller) {
                controller.enqueue({
                  type: 'start',
                  messageId: 'remote-answer',
                  messageMetadata: { requestId: 'remote-R2' },
                })
                controller.enqueue({ type: 'finish' })
                controller.close()
              },
            }),
          }),
      }),
    })
    expect(await resumeActiveStream(chat.resumeStream)).toBe(true)
    expect(chat.messages[0]).toMatchObject({
      id: 'remote-answer',
      metadata: { requestId: 'remote-R2' },
    })
  })
})
