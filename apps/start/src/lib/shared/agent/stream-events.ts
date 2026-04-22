import type { AgentLiveEvent } from './types'

const textEncoder = new TextEncoder()

/**
 * The browser consumes a standard SSE stream
 */
export function serializeAgentLiveEvent(event: AgentLiveEvent): Uint8Array {
  const payload = JSON.stringify(event)
  return textEncoder.encode(`event: ${event.type}\ndata: ${payload}\n\n`)
}

type ParsedSseEvent = {
  readonly event?: string
  readonly data?: string
}

function parseSseChunk(chunk: string): ParsedSseEvent[] {
  const blocks = chunk.split('\n\n')
  const events: ParsedSseEvent[] = []

  for (const block of blocks) {
    const trimmed = block.trim()
    if (!trimmed) continue

    let event: string | undefined
    const dataLines: string[] = []
    for (const line of trimmed.split('\n')) {
      if (line.startsWith('event:')) {
        event = line.slice('event:'.length).trim()
        continue
      }
      if (line.startsWith('data:')) {
        dataLines.push(line.slice('data:'.length).trim())
      }
    }

    events.push({
      event,
      data: dataLines.length > 0 ? dataLines.join('\n') : undefined,
    })
  }

  return events
}

/**
 * Lightweight SSE parser for the agent live-turn transport.
 */
export async function readAgentLiveEvents(input: {
  readonly stream: ReadableStream<Uint8Array>
  readonly onEvent: (event: AgentLiveEvent) => void
}): Promise<void> {
  const reader = input.stream.getReader()
  const textDecoder = new TextDecoder()
  let buffer = ''

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += textDecoder.decode(value, { stream: true })

      const boundary = buffer.lastIndexOf('\n\n')
      if (boundary < 0) continue

      const complete = buffer.slice(0, boundary)
      buffer = buffer.slice(boundary + 2)

      for (const chunk of parseSseChunk(complete)) {
        if (!chunk.data) continue
        const event = JSON.parse(chunk.data) as AgentLiveEvent
        input.onEvent(event)
      }
    }

    const remainder = buffer.trim()
    if (!remainder) return
    for (const chunk of parseSseChunk(remainder)) {
      if (!chunk.data) continue
      input.onEvent(JSON.parse(chunk.data) as AgentLiveEvent)
    }
  } finally {
    reader.releaseLock()
  }
}
