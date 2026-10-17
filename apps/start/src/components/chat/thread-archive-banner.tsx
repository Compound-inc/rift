import { useState } from 'react'
import { useQuery, useZero } from '@rocicorp/zero/react'
import { Button } from '@rift/ui/button'
import { toast } from 'sonner'
import { mutators, queries } from '@/integrations/zero'
import { useAppAuth } from '@/lib/frontend/auth/use-auth'
import { m } from '@/paraglide/messages.js'

export function ThreadArchiveBanner({ threadId }: { threadId: string }) {
  const { activeOrganizationId } = useAppAuth()
  const [thread] = useQuery(
    queries.threads.byId({
      threadId,
      organizationId: activeOrganizationId ?? undefined,
    }),
  )
  const z = useZero()
  const [busy, setBusy] = useState(false)
  if (thread?.visibility !== 'archived') return null
  return (
    <div
      role="status"
      className="mx-auto mt-12 flex w-full max-w-2xl items-center justify-between gap-3 rounded-xl border border-border-base bg-surface-overlay px-4 py-2 text-sm text-foreground-secondary"
    >
      <span>{m.archive_banner()}</span>
      <Button
        size="default"
        variant="ghost"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          try {
            const result = await z.mutate(
              mutators.threads.archive({ threadId, archived: false }),
            ).server
            if (result.type === 'error') throw new Error('archive_failed')
          } catch {
            toast.error(m.archive_failed())
          } finally {
            setBusy(false)
          }
        }}
      >
        {m.archive_restore()}
      </Button>
    </div>
  )
}
