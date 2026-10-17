import { useEffect, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery } from '@rocicorp/zero/react'
import { Button } from '@rift/ui/button'
import { Input } from '@rift/ui/input'
import { ArrowUpRight } from 'lucide-react'
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
    <section
      aria-labelledby="project-conversations-heading"
      className="space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2
          id="project-conversations-heading"
          className="text-base font-medium text-foreground-strong"
        >
          {m.project_home_conversations()}
        </h2>
        {threads.length > 0 || search ? (
          <Input
            value={search}
            maxLength={200}
            onChange={(event) => setSearch(event.target.value)}
            aria-label={m.project_home_search()}
            placeholder={m.project_home_search()}
            className="h-10 w-full sm:w-60"
          />
        ) : null}
      </div>
      <p className="text-xs text-foreground-tertiary">
        {m.project_home_conversations_hint()}
      </p>
      {search.trim() !== debouncedSearch ||
      (result.type !== 'complete' && threads.length === 0) ? (
        <p role="status" className="py-4 text-sm text-foreground-tertiary">
          {m.project_home_loading()}
        </p>
      ) : visible.length === 0 ? (
        <p className="py-4 text-sm text-foreground-tertiary">
          {search
            ? m.project_home_no_matches()
            : m.project_home_conversations_empty()}
        </p>
      ) : (
        <ul className="divide-y divide-border-base">
          {visible.map((thread) => (
            <li key={thread.threadId}>
              <Link
                to="/chat/$threadId"
                params={{ threadId: thread.threadId }}
                className="group flex min-h-12 items-center gap-3 rounded-lg px-2 py-3 text-sm outline-none transition-colors hover:bg-surface-inverse/5 focus-visible:ring-2 focus-visible:ring-border-strong motion-reduce:transition-none"
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
                  className="size-4 shrink-0 text-foreground-tertiary opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {threads.length >= limit ? (
        <Button
          variant="ghost"
          className="min-h-10"
          onClick={() => setLimit((current) => current + 30)}
        >
          {m.project_home_load_more()}
        </Button>
      ) : null}
    </section>
  )
}
