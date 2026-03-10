import { Streamdown, type PluginConfig } from 'streamdown'
import { code } from '@streamdown/code'
import { math } from '@streamdown/math'
import { mermaid } from '@streamdown/mermaid'
import {
  streamdownStaticComponents,
  streamdownStreamingComponents,
} from './streamdown-components'
import type {
  AssistantPartRenderContext,
  AssistantPartRenderer,
} from '../types'

const streamdownPlugins = { code, mermaid, math } as PluginConfig

function renderTextPart({
  part,
  isMessageStreaming,
}: AssistantPartRenderContext) {
  if (part.type !== 'text') return null

  return (
    <Streamdown
      plugins={streamdownPlugins}
      controls={false}
      isAnimating={isMessageStreaming}
      mode={isMessageStreaming ? 'streaming' : 'static'}
      components={
        isMessageStreaming
          ? streamdownStreamingComponents
          : streamdownStaticComponents
      }
      className="chat-streamdown min-w-0 max-w-full break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
    >
      {part.text || '\u00a0'}
    </Streamdown>
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
