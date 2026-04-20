'use client'

import { useEffect, useMemo, useState } from 'react'
import { FileText } from 'lucide-react'
import { Streamdown } from 'streamdown'
import { useQuery } from '@rocicorp/zero/react'
import { Button } from '@rift/ui/button'
import { queries } from '@/integrations/zero'
import { cn } from '@rift/utils'
import { inlineCitationRemarkPlugin } from '@/components/chat/message-parts/renderers/inline-citation-remark-plugin'
import {
  streamdownStaticComponents,
} from '@/components/chat/message-parts/renderers/streamdown-components'
import { useStreamdownPlugins } from '@/components/chat/message-parts/renderers/use-streamdown-plugins'

type WritingDocumentViewerProps = {
  readonly projectId: string
}

/**
 * The writing workspace is intentionally markdown-first, so the viewer keeps the
 * chrome minimal: a compact document strip for switching files and a clean
 * rendered canvas underneath. Reusing the shared Streamdown stack ensures the
 * preview matches the rest of the product's markdown rendering behavior.
 */
export function WritingDocumentViewer({
  projectId,
}: WritingDocumentViewerProps) {
  const [entries] = useQuery(queries.writing.entriesByProject({ projectId }))
  const streamdownPlugins = useStreamdownPlugins()
  const markdownFiles = useMemo(
    () => entries.filter((entry: any) => entry.kind === 'file'),
    [entries],
  )
  const [selectedPath, setSelectedPath] = useState<string | null>(null)

  useEffect(() => {
    if (markdownFiles.length === 0) {
      setSelectedPath(null)
      return
    }

    setSelectedPath((current) => {
      if (current && markdownFiles.some((file: any) => file.path === current)) {
        return current
      }

      return markdownFiles[0]?.path ?? null
    })
  }, [markdownFiles])

  const [selectedEntry] = useQuery(
    queries.writing.fileByPath({
      projectId,
      path: selectedPath ?? '__none__',
    }),
  )

  const selectedContent =
    selectedEntry && typeof selectedEntry === 'object' && 'blob' in selectedEntry
      ? ((selectedEntry.blob as { content?: string } | null | undefined)?.content ??
        '')
      : ''

  return (
    <section className="flex h-full min-h-0 flex-col bg-surface-base/80">
      <div className="border-b border-border-base px-2 py-2 md:px-3">
        {markdownFiles.length > 0 ? (
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {markdownFiles.map((file: any) => {
              const isActive = file.path === selectedPath

              return (
                <Button
                  key={file.id}
                  type="button"
                  variant="ghost"
                  size="default"
                  className={cn(
                    'h-8 shrink-0 rounded-md border px-2.5 text-xs font-medium tabular-nums transition-colors',
                    isActive
                      ? 'border-border-base bg-surface-overlay text-foreground-strong shadow-sm'
                      : 'border-transparent text-foreground-secondary hover:border-border-base/70 hover:bg-surface-overlay/70 hover:text-foreground-primary',
                  )}
                  onClick={() => setSelectedPath(file.path)}
                >
                  <FileText className="size-3.5" aria-hidden />
                  <span className="max-w-40 truncate">{file.name}</span>
                </Button>
              )
            })}
          </div>
        ) : (
          <div className="flex h-8 items-center px-1 text-xs text-foreground-secondary">
            No markdown files yet.
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5">
        {selectedPath ? (
          <div className="mx-auto w-full max-w-3xl">
            <Streamdown
              plugins={streamdownPlugins}
              controls={false}
              isAnimating={false}
              mode="static"
              remarkPlugins={[inlineCitationRemarkPlugin]}
              components={streamdownStaticComponents}
              className="chat-streamdown min-w-0 max-w-none break-words antialiased [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
            >
              {selectedContent || '\u00a0'}
            </Streamdown>
          </div>
        ) : (
          <div className="flex h-full min-h-[240px] items-center justify-center">
            <div className="max-w-sm text-center text-sm leading-6 text-foreground-secondary">
              Create or accept a markdown file in this project to preview it here.
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
