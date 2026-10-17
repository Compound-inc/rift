import { useState } from 'react'
import { createFileRoute, notFound, useNavigate } from '@tanstack/react-router'
import { Button } from '@rift/ui/button'
import { toast } from 'sonner'
import { ChatMessage } from '@/components/chat/chat-message'
import {
  readSharedThread,
  forkSharedThread,
} from '@/lib/frontend/thread-sharing/thread-sharing.functions'
import { useAppAuth } from '@/lib/frontend/auth/use-auth'
import { shareReasonMessage } from '@/lib/frontend/thread-sharing/share-reason-message'
import { m } from '@/paraglide/messages.js'
import { getLocale } from '@/paraglide/runtime.js'

export const Route = createFileRoute('/share/$shareId')({
  staleTime: 0,
  preloadStaleTime: 0,
  gcTime: 0,
  loader: async ({ params }) => {
    if (!/^[a-f0-9]{64}$/.test(params.shareId)) throw notFound()
    const shared = await readSharedThread({ data: { shareId: params.shareId } })
    if (!shared) throw notFound()
    return shared
  },
  // Shared conversations should never be indexed, even when their link is public.
  headers: () => ({
    'Cache-Control': 'private, no-store',
    'Referrer-Policy': 'no-referrer',
  }),
  head: ({ loaderData }) => ({
    meta: [
      {
        title:
          loaderData && 'title' in loaderData
            ? `${loaderData.title} | Rift`
            : 'Rift',
      },
      { name: 'robots', content: 'noindex, nofollow' },
      { name: 'referrer', content: 'no-referrer' },
      {
        property: 'og:title',
        content:
          loaderData && 'title' in loaderData ? loaderData.title : 'Rift',
      },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: 'Rift' },
      { property: 'og:description', content: m.share_title() },
    ],
  }),
  notFoundComponent: () => (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <h1 className="text-xl font-medium">{m.share_not_found()}</h1>
      <p className="mt-3 text-foreground-secondary">
        {m.share_not_found_detail()}
      </p>
    </main>
  ),
  component: SharedThreadPage,
})

const ignoreRegenerate = () => {}
const ignoreEdit = async () => {}
function SharedThreadPage() {
  const shared = Route.useLoaderData()
  const { shareId } = Route.useParams()
  const { user, isAnonymous } = useAppAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  if ('error' in shared)
    return (
      <main className="mx-auto max-w-2xl px-6 py-20">
        <h1 className="text-xl font-medium">{m.share_title()}</h1>
        <p role="alert" className="mt-3 text-foreground-secondary">
          {shareReasonMessage(shared.error)}
        </p>
      </main>
    )
  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-4 py-12 md:px-6">
      <header className="mb-8 space-y-3 border-b border-border-base pb-6">
        <p className="text-sm text-foreground-tertiary">Rift</p>
        <h1 className="text-balance text-2xl font-semibold text-foreground-strong">
          {shared.title}
        </h1>
        <p className="text-sm text-foreground-secondary">
          {m.share_shared_on({
            date: new Intl.DateTimeFormat(getLocale(), {
              dateStyle: 'medium',
            }).format(shared.sharedAt),
          })}
        </p>
        {shared.sharerName && (
          <p className="text-sm text-foreground-secondary">
            {m.share_shared_by({ name: shared.sharerName })}
          </p>
        )}
        {user && !isAnonymous && (
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                const fork = await forkSharedThread({ data: { shareId } })
                if ('error' in fork) {
                  toast.error(shareReasonMessage(fork.error))
                  return
                }
                await navigate({
                  to: '/chat/$threadId',
                  params: { threadId: fork.threadId },
                })
              } catch {
                toast.error(m.share_fork_failed())
              } finally {
                setBusy(false)
              }
            }}
          >
            {m.share_continue()}
          </Button>
        )}
      </header>
      {shared.messages.map((message) => (
        <section key={message.id}>
          <ChatMessage
            message={{
              id: message.id,
              role: message.role,
              parts: [{ type: 'text', text: message.text }],
            }}
            readOnly
            canRegenerate={false}
            canEdit={false}
            onRegenerate={ignoreRegenerate}
            onEdit={ignoreEdit}
          />
          {message.attachmentNames.map((name, index) => (
            <p key={index} className="py-1 text-sm text-foreground-tertiary">
              {m.share_attachment({ name })}
            </p>
          ))}
        </section>
      ))}
    </main>
  )
}
