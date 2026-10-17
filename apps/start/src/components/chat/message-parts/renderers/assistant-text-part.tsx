import { Streamdown } from 'streamdown'
import {
  streamdownRemarkPlugins,
  streamdownStaticComponents,
  streamdownStreamingComponents,
} from './streamdown-components'
import { useStreamdownPlugins } from './use-streamdown-plugins'

// Shared content must not trigger requests to author-controlled image hosts.
const sharedMarkdownComponents = {
  ...streamdownStaticComponents,
  img: ({ alt }: { alt?: string }) => (
    <span>{alt ? `[${alt}]` : '[Image blocked]'}</span>
  ),
}

export function AssistantTextPart({
  isMessageStreaming,
  text,
  readOnly = false,
}: {
  isMessageStreaming: boolean
  text: string
  /** Shared (read-only) pages: images render as their alt text, never fetched. */
  readOnly?: boolean
}) {
  const streamdownPlugins = useStreamdownPlugins()

  return (
    <Streamdown
      plugins={streamdownPlugins}
      controls={false}
      isAnimating={isMessageStreaming}
      mode={isMessageStreaming ? 'streaming' : 'static'}
      remarkPlugins={streamdownRemarkPlugins}
      components={
        readOnly
          ? sharedMarkdownComponents
          : isMessageStreaming
            ? streamdownStreamingComponents
            : streamdownStaticComponents
      }
      className="chat-streamdown min-w-0 max-w-full break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
    >
      {text || ' '}
    </Streamdown>
  )
}
