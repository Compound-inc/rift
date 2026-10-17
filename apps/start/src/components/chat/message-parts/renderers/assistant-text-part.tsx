import { Streamdown } from 'streamdown'
import {
  streamdownRemarkPlugins,
  streamdownStaticComponents,
  streamdownStreamingComponents,
} from './streamdown-components'
import { useStreamdownPlugins } from './use-streamdown-plugins'

export function AssistantTextPart({
  isMessageStreaming,
  text,
}: {
  isMessageStreaming: boolean
  text: string
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
        isMessageStreaming
          ? streamdownStreamingComponents
          : streamdownStaticComponents
      }
      className="chat-streamdown min-w-0 max-w-full break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
    >
      {text || '\u00a0'}
    </Streamdown>
  )
}

