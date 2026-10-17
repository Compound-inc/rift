import { DefaultChatTransport } from 'ai'
import type { ChatRequestOptions, UIMessage } from 'ai'

type ResumeMetadata = { onReconnect?: (active: boolean) => void }

/** The SDK's resumeStream returns void even when the reconnect endpoint is 204. */
export class ResumeAwareChatTransport<
  TMessage extends UIMessage,
> extends DefaultChatTransport<TMessage> {
  override async reconnectToStream(
    options: Parameters<DefaultChatTransport<TMessage>['reconnectToStream']>[0],
  ) {
    const stream = await super.reconnectToStream(options)
    const metadata = options.metadata as ResumeMetadata | undefined
    metadata?.onReconnect?.(stream !== null)
    return stream
  }
}

/**
 * Scope the result to this reconnect, including overlapping automatic resumes.
 * Only a reconnect that actually found a stream counts as active: a failed
 * reconnect must let Retry fall back to regenerating instead of dead-ending.
 */
export async function resumeActiveStream(
  resume: (options: ChatRequestOptions) => Promise<void>,
): Promise<boolean> {
  let active = false
  try {
    await resume({
      metadata: {
        onReconnect: (found: boolean) => {
          active = found
        },
      },
    })
  } catch {
    return false
  }
  return active
}
