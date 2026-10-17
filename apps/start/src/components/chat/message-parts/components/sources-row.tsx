import { FileText, Globe } from 'lucide-react'
import type { PersistedSource } from '@/lib/shared/chat-contracts/generation-parts'
import { formatCitationHostname } from './inline-citation'
import { m } from '@/paraglide/messages.js'

/** URL citations open externally; document sources without a URL stay descriptive. */
export function SourcesRow({
  sources,
}: {
  sources: readonly PersistedSource[]
}) {
  if (!sources.length) return null
  return (
    <div className="text-xs text-foreground-tertiary">
      <p className="flex items-center gap-2 px-2 pt-2">
        <Globe className="size-3.5" aria-hidden />
        {m.chat_sources_count({ count: sources.length })}
      </p>
      <ol className="flex max-h-28 flex-wrap gap-x-3 gap-y-1 overflow-auto">
        {sources.map((source) => (
          <li key={source.sourceId} className="min-w-0 max-w-full">
            {source.type === 'source-url' ? (
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-10 max-w-full items-center gap-2 rounded-md px-2 hover:bg-surface-raised focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
              >
                <Globe className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate text-foreground-primary">
                  {source.title || formatCitationHostname(source.url)}
                </span>{' '}
                {source.title ? (
                  <span className="max-w-40 shrink-0 truncate">
                    {formatCitationHostname(source.url)}
                  </span>
                ) : null}
              </a>
            ) : (
              <span className="flex min-h-10 items-center gap-2 px-2">
                <FileText className="size-3.5" aria-hidden />
                {source.title}
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}
