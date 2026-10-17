import { isToolUIPart } from 'ai'
import { ToolCallPart } from '../components/tool-call-part'
import { DocumentCard } from '../../documents/document-card'
import { isDocumentToolPart } from '@/lib/shared/documents/message-references'
import type {
  AssistantPartRenderContext,
  AssistantPartRenderer,
} from '../types'
import { AssistantTextPart } from './assistant-text-part'

// Shared pages render a read-only AssistantTextPart from this module.
export { AssistantTextPart }

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
    id: 'document',
    match: isDocumentToolPart,
    render: ({ part, isMessageStreaming }) => (
      <DocumentCard part={part} isMessageStreaming={isMessageStreaming} />
    ),
  },
  {
    id: 'tool',
    match: isToolUIPart,
    render: ({ part, isMessageStreaming }) => (
      <ToolCallPart part={part} isMessageStreaming={isMessageStreaming} />
    ),
  },
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
