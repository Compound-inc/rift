import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery, useZero } from '@rocicorp/zero/react'
import { Button } from '@rift/ui/button'
import { toast } from 'sonner'
import { mutators, queries } from '@/integrations/zero'
import { useAppAuth } from '@/lib/frontend/auth/use-auth'
import { ContentPage } from '@/components/layout'
import { m } from '@/paraglide/messages.js'

export function ArchivedChatsPage() {
  const { activeOrganizationId } = useAppAuth()
  const [threads, result] = useQuery(
    queries.threads.archived({
      organizationId: activeOrganizationId ?? undefined,
    }),
  )
  const z = useZero()
  const [pending, setPending] = useState<string | null>(null)
  const update = async (threadId: string, action: 'restore' | 'delete') => {
    if (action === 'delete' && !window.confirm(m.archive_delete_confirm()))
      return
    setPending(threadId)
    try {
      const result = await z.mutate(
        action === 'restore'
          ? mutators.threads.archive({ threadId, archived: false })
          : mutators.threads.delete({ threadId }),
      ).server
      if (result.type === 'error') throw new Error('archive_failed')
    } catch {
      toast.error(m.archive_failed())
    } finally {
      setPending(null)
    }
  }
  return (
    <ContentPage
      title={m.archive_title()}
      description={m.archive_description()}
    >
      <div className="mt-8 divide-y divide-border-base">
        {threads.length === 0 && (
          <p role="status" className="py-8 text-sm text-foreground-tertiary">
            {result.type === 'complete'
              ? m.archive_empty()
              : m.archive_loading()}
          </p>
        )}
        {threads.map((thread) => (
          <div
            key={thread.threadId}
            className="flex flex-wrap items-center justify-between gap-3 py-3"
          >
            <Link
              to="/chat/$threadId"
              params={{ threadId: thread.threadId }}
              className="min-w-0 flex-1 truncate rounded-md text-sm font-medium hover:underline focus-visible:outline-ring"
            >
              {thread.title}
            </Link>
            <div className="flex gap-2">
              <Button
                size="default"
                variant="ghost"
                disabled={pending !== null}
                onClick={() => void update(thread.threadId, 'restore')}
              >
                {m.archive_restore()}
              </Button>
              <Button
                size="default"
                variant="ghost"
                disabled={pending !== null}
                onClick={() => void update(thread.threadId, 'delete')}
              >
                {m.chat_sidebar_delete()}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </ContentPage>
  )
}
