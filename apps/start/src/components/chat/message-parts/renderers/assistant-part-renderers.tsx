import { Streamdown } from 'streamdown'
import {
  streamdownRemarkPlugins,
  streamdownStaticComponents,
  streamdownStreamingComponents,
} from './streamdown-components'
import type {
  AssistantPartRenderContext,
  AssistantPartRenderer,
} from '../types'
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
      {text || '\u00a0'}
    </Streamdown>
  )
}

function renderTextPart({
  part,
  isMessageStreaming,
}: AssistantPartRenderContext) {
  if (part.type !== 'text') return null

  return (
    <AssistantTextPart
      isMessageStreaming={isMessageStreaming}
      text={part.text}
    />
  )
}

function renderStepBoundary({ part, index }: AssistantPartRenderContext) {
  if (part.type !== 'step-start') return null
  if (index === 0) return null

  return (
    <div className="my-2">
      <hr className="border-border-faint/70 border-t" />
    </div>
  )
}

/**
 * Ordered assistant part registry.
 * First matching renderer wins, so specific renderers should come before generic
 * fallbacks as this registry grows.
 */
export const assistantPartRenderers: readonly AssistantPartRenderer[] = [
  {
    id: 'step-boundary',
    match: (part) => part.type === 'step-start',
    render: renderStepBoundary,
  },
  {
    id: 'text',
    match: (part) => part.type === 'text',
    render: renderTextPart,
  },
]
