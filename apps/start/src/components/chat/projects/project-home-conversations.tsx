import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@rocicorp/zero/react'
import { Button } from '@rift/ui/button'
import { ArrowUpRight, Search } from 'lucide-react'
import { queries } from '@/integrations/zero'
import { m } from '@/paraglide/messages.js'
import { getLocale } from '@/paraglide/runtime.js'
import { projectHomeThreads } from './project-home.logic'

/** Recent activity is independent of sidebar pinning; only the caller's rows sync. */
export function ProjectHomeConversations({
  projectId,
}: {
  readonly projectId: string
}) {
  const [limit, setLimit] = useState(30)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim())
      setLimit(30)
    }, 250)
    return () => window.clearTimeout(timer)
  }, [search])
  const [project] = useQuery(queries.projects.byId({ projectId }))
  const [threads, result] = useQuery(
    queries.projects.recentThreads({
      projectId,
      limit,
      search: debouncedSearch,
    }),
  )
  const visible = projectHomeThreads(threads)
  const date = new Intl.DateTimeFormat(getLocale(), {
    month: 'short',
    day: 'numeric',
  })
  return (
    <section aria-labelledby="project-conversations-heading">
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-3">
        <h2
          id="project-conversations-heading"
          className="text-sm font-medium text-foreground-strong"
        >
          {m.project_home_conversations()}
        </h2>
        {/* Searching a handful of rows is noise; offer it once the list grows. */}
        {threads.length > 5 || search ? (
          <label className="relative block w-full sm:w-56">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-foreground-tertiary"
              aria-hidden
            />
            <input
              type="search"
              value={search}
              maxLength={200}
              onChange={(event) => setSearch(event.target.value)}
              aria-label={m.project_home_search()}
              placeholder={m.project_home_search_placeholder()}
              className="h-8 w-full rounded-full bg-surface-inverse/5 pl-8 pr-3 text-sm text-foreground-primary outline-none transition-[background-color,box-shadow] placeholder:text-foreground-tertiary hover:bg-surface-inverse/8 focus-visible:bg-surface-base focus-visible:ring-2 focus-visible:ring-border-strong/50 motion-reduce:transition-none"
            />
          </label>
        ) : null}
      </div>
      {project?.visibility === 'org' ? (
        // Only matters when other members can open the project.
        <p className="mt-1 text-xs text-foreground-tertiary">
          {m.project_home_conversations_hint()}
        </p>
      ) : null}
      <div className="mt-3">
        {search.trim() !== debouncedSearch ||
        (result.type !== 'complete' && threads.length === 0) ? (
          <p role="status" className="py-3 text-sm text-foreground-tertiary">
            {m.project_home_loading()}
          </p>
        ) : visible.length === 0 ? (
          <p className="py-3 text-pretty text-sm text-foreground-tertiary">
            {search
              ? m.project_home_no_matches()
              : m.project_home_conversations_empty()}
          </p>
        ) : (
          // Rows bleed 12px left/right so the hover surface frames the text
          // while titles stay aligned with the section heading.
          <ul className="-mx-3">
            {visible.map((thread) => (
              <li key={thread.threadId}>
                <Link
                  to="/chat/$threadId"
                  params={{ threadId: thread.threadId }}
                  className="group flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm outline-none transition-colors hover:bg-surface-inverse/5 focus-visible:ring-2 focus-visible:ring-border-strong motion-reduce:transition-none"
                >
                  <span className="min-w-0 flex-1 truncate text-foreground-primary">
                    {thread.title || m.chat_sidebar_thread_untitled()}
                  </span>
                  <time
                    dateTime={new Date(thread.updatedAt).toISOString()}
                    title={new Date(thread.updatedAt).toLocaleString(getLocale())}
                    className="shrink-0 text-xs tabular-nums text-foreground-tertiary"
                  >
                    {date.format(thread.updatedAt)}
                  </time>
                  <ArrowUpRight
                    className="-mr-1 size-3.5 shrink-0 text-foreground-tertiary opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      {threads.length >= limit ? (
        <Button
          variant="ghost"
          className="-ml-2.5 mt-1 text-foreground-tertiary hover:text-foreground-primary"
          onClick={() => setLimit((current) => current + 30)}
        >
          {m.project_home_load_more()}
        </Button>
      ) : null}
    </section>
  )
}
