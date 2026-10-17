import { isReasoningUIPart } from 'ai'
import type { UIMessage } from 'ai'
import { Fragment, useMemo } from 'react'
import type { ReactNode } from 'react'
import { normalizeSources } from '@/lib/shared/chat-contracts/generation-parts'
import type { PersistedSource } from '@/lib/shared/chat-contracts/generation-parts'
import { SourcesRow } from './components/sources-row'
import { assistantDecorators } from './decorators/assistant-decorators'
import { assistantPartRenderers } from './renderers/assistant-part-renderers'
import type { AssistantPart } from './types'

type AssistantMessagePartsProps = {
  parts: UIMessage['parts']
  isMessageStreaming: boolean
}

function renderPart(
  part: AssistantPart,
  index: number,
  isMessageStreaming: boolean,
  sources: readonly PersistedSource[],
): ReactNode {
  for (const renderer of assistantPartRenderers) {
    if (!renderer.match(part)) continue
    return renderer.render({ part, index, isMessageStreaming, sources })
  }
  return null
}

/**
 * Assistant parts compositor with two extension points:
 * 1) message decorators that inspect full part list (reasoning, sources, etc.)
 * 2) per-part renderers (text/tool/data/etc.)
 */
export function AssistantMessageParts({
  parts,
  isMessageStreaming,
}: AssistantMessagePartsProps) {
  const sources = useMemo(
    () => normalizeSources(parts.filter(
      (part) => part.type === 'source-url' || part.type === 'source-document',
    )),
    [parts],
  )
  // Reasoning is rendered as one collapsible decorator, so we skip inline reasoning
  // parts to avoid duplicate content.
  const partsForInlineRender = parts.filter((part) => !isReasoningUIPart(part))

  return (
    <div className="space-y-2">
      {assistantDecorators.map((decorator) => (
        <Fragment key={decorator.id}>
          {decorator.render({ parts, isMessageStreaming })}
        </Fragment>
      ))}

      {partsForInlineRender.map((part, index) => (
        <Fragment
          key={`assistant-part:${index}:${'id' in part && typeof part.id === 'string' ? part.id : part.type}`}
        >
          {renderPart(part, index, isMessageStreaming, sources)}
        </Fragment>
      ))}
      <SourcesRow sources={sources} />
    </div>
  )
}
