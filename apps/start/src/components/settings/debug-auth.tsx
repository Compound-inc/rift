import { useCallback, useEffect, useState } from 'react'
import { authClient } from '@/lib/auth/auth-client'
import { useAppAuth } from '@/lib/auth/use-auth'

type DebugAuthProps = {
  signInUrl: string
  signUpUrl: string
}

type OrgItem = { id: string; name: string; slug: string }

function randomSlug(): string {
  return `debug-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

export function DebugAuth({ signInUrl, signUpUrl }: DebugAuthProps) {
  const { user, loading, signOut, activeOrganizationId, refetchSession } = useAppAuth()
  const [orgs, setOrgs] = useState<OrgItem[]>([])
  const [orgsLoading, setOrgsLoading] = useState(false)
  const [createPending, setCreatePending] = useState(false)

  const loadOrgs = useCallback(async () => {
    setOrgsLoading(true)
    const { data, error } = await authClient.organization.list()
    setOrgsLoading(false)
    if (!error && data) {
      setOrgs(data.map((o: { id: string; name: string; slug: string }) => ({ id: o.id, name: o.name, slug: o.slug })))
    } else {
      setOrgs([])
    }
  }, [])

  useEffect(() => {
    if (user) loadOrgs()
  }, [user, loadOrgs])

  const createOrg = useCallback(async () => {
    setCreatePending(true)
    const name = `Debug org ${randomSlug().slice(0, 12)}`
    const slug = randomSlug()
    const { error } = await authClient.organization.create({ name, slug })
    setCreatePending(false)
    if (!error) {
      await refetchSession()
      await loadOrgs()
    }
  }, [refetchSession, loadOrgs])

  const setActiveOrg = useCallback(
    async (organizationId: string | null) => {
      const { error } = await authClient.organization.setActive({ organizationId })
      if (!error) await refetchSession()
    },
    [refetchSession],
  )

  if (loading) {
    return <p className="text-sm text-content-muted">Loading…</p>
  }

  if (user) {
    const activeOrg = activeOrganizationId ? orgs.find((o) => o.id === activeOrganizationId) : null
    return (
      <div className="space-y-4 rounded-lg border border-border-default bg-bg-subtle p-4">
        <p className="text-sm">
          <span className="text-content-muted">Email</span>{' '}
          <span className="font-medium text-content-emphasis">{user.email}</span>
        </p>
        <p className="text-sm">
          <span className="text-content-muted">User ID</span>{' '}
          <code className="rounded bg-bg-muted px-1.5 py-0.5 font-mono text-xs">{user.id}</code>
        </p>
        <div className="space-y-2">
          <p className="text-sm text-content-muted">Active org</p>
          <p className="text-sm font-medium text-content-emphasis">
            {activeOrg ? `${activeOrg.name} (${activeOrg.slug})` : activeOrganizationId ?? 'None'}
          </p>
          {!orgsLoading && orgs.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="debug-org-select" className="sr-only">
                Switch organization
              </label>
              <select
                id="debug-org-select"
                value={activeOrganizationId ?? ''}
                onChange={(e) => setActiveOrg(e.target.value || null)}
                className="rounded-md border border-border-default bg-bg-default px-3 py-1.5 text-sm text-content-emphasis"
              >
                <option value="">None</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={createOrg}
                disabled={createPending}
                className="rounded-md border border-border-default px-3 py-1.5 text-sm text-content-emphasis hover:bg-bg-muted disabled:opacity-50"
              >
                {createPending ? 'Creating…' : 'Create random org'}
              </button>
            </div>
          )}
          {!orgsLoading && orgs.length === 0 && (
            <button
              type="button"
              onClick={createOrg}
              disabled={createPending}
              className="rounded-md border border-border-default px-3 py-1.5 text-sm text-content-emphasis hover:bg-bg-muted disabled:opacity-50"
            >
              {createPending ? 'Creating…' : 'Create random org'}
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => signOut()}
          className="rounded-md bg-bg-error px-4 py-2 text-sm text-content-error hover:opacity-90"
        >
          Sign out
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-lg border border-border-default bg-bg-subtle p-4">
      <p className="text-sm text-content-muted">Not signed in.</p>
      <div className="flex gap-3">
        <a
          href={signInUrl}
          className="rounded-md bg-bg-inverted px-4 py-2 text-sm text-content-inverted hover:opacity-90"
        >
          Sign in
        </a>
        <a
          href={signUpUrl}
          className="rounded-md border border-border-default px-4 py-2 text-sm text-content-emphasis hover:bg-bg-subtle"
        >
          Sign up
        </a>
      </div>
    </div>
  )
}
