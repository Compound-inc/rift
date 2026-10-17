import { useQuery } from '@rocicorp/zero/react'
import { queries } from '@/integrations/zero'
import { useEffect, useMemo, useRef } from 'react'
import type { UIMessage } from 'ai'
import { FileCode2, FileText, ArrowUpRight } from 'lucide-react'
import { useRightSidebar } from '@/components/layout/right-sidebar-context'
import { useDesktopRightSidebar } from '@/components/layout/right-sidebar-media'
import { useChatMessages } from '../chat-context'
import { m } from '@/paraglide/messages.js'
import { documentPreview } from './document-view-model'
import { publishDocumentPreview } from './document-preview-store'
import { DocumentPanel } from './document-panel'

/** Card owns auto-open once; subsequent deltas update the already-open panel. */
export function DocumentCard({
  part,
  isMessageStreaming,
}: {
  part: UIMessage['parts'][number]
  isMessageStreaming: boolean
}) {
  const { activeThreadId } = useChatMessages()
  const { open } = useRightSidebar()
  const [documents] = useQuery(
    queries.documents.byThread({ threadId: activeThreadId ?? '' }),
  )
  const desktop = useDesktopRightSidebar()
  const opened = useRef(false)
  const preview = useMemo(() => {
    const raw = documentPreview(part, activeThreadId ?? '')
    const document = documents.find((row) => row.id === raw?.documentId)
    const value =
      raw && document
        ? {
            ...raw,
            kind: document.kind,
            language: document.language ?? raw.language,
            title: document.title,
          }
        : raw
    return value && value.writing && !isMessageStreaming
      ? { ...value, writing: false, failed: true }
      : value
  }, [part, activeThreadId, isMessageStreaming, documents])
  useEffect(() => {
    if (!preview) return
    publishDocumentPreview(preview)
    if (
      !opened.current &&
      preview.creating &&
      !preview.failed &&
      isMessageStreaming &&
      desktop &&
      activeThreadId
    ) {
      opened.current = true
      open(
        <DocumentPanel
          key={preview.callId}
          callId={preview.callId}
          threadId={activeThreadId}
        />,
      )
    }
  }, [preview, isMessageStreaming, desktop, activeThreadId, open])
  if (!preview) return null
  const Icon = preview.kind === 'code' ? FileCode2 : FileText
  return (
    <button
      type="button"
      disabled={preview.failed && !preview.documentId}
      className="flex min-h-16 w-full max-w-md items-center gap-3 rounded-lg border border-border-base bg-surface-raised px-3 py-2 text-left text-sm text-foreground-primary transition-colors hover:bg-surface-overlay focus-visible:outline-2 focus-visible:outline-accent-primary motion-reduce:transition-none"
      onClick={() => {
        publishDocumentPreview(preview)
        open(
          <DocumentPanel
            key={preview.callId}
            callId={preview.callId}
            threadId={preview.threadId}
            focusOnOpen
          />,
        )
      }}
    >
      <Icon className="size-5 shrink-0 text-foreground-tertiary" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">
          {preview.title || m.document_untitled()}
        </span>
        <span className="block text-xs text-foreground-tertiary">
          {preview.failed
            ? preview.reading
              ? m.document_load_failed()
              : m.document_write_failed()
            : preview.writing
              ? preview.reading
                ? m.document_loading()
                : m.document_writing()
              : preview.version
                ? `${preview.kind === 'code' ? m.document_kind_code() : m.document_kind_markdown()} · ${m.document_version({ version: preview.version })}`
                : m.document_kind_markdown()}
        </span>
      </span>
      <span className="flex items-center gap-1 text-xs">
        {m.document_open()}
        <ArrowUpRight className="size-3" aria-hidden />
      </span>
    </button>
  )
}
