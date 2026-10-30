import { useCallback, useSyncExternalStore } from 'react'
import { authClient } from './auth-client'

type WorkspaceIdentity = {
  userId: string
  organizationId: string
  sessionId: string
}

type RoleState = { role: string | null; loading: boolean }
const noMembership: RoleState = { role: null, loading: false }
const pendingMembership: RoleState = { role: null, loading: true }

type RoleRequest = {
  state: RoleState
  controller: AbortController
  listeners: Set<() => void>
}

/**
 * Membership reads belong to a resolved workspace session. Share requests
 * between useAppAuth consumers without mounting Better Auth's role atom,
 * whose organization listeners outlive React subscriptions. The last
 * unsubscribe cancels the request and discards its permissions.
 */
const requests = new Map<string, RoleRequest>()

export function useWorkspaceRole(identity: WorkspaceIdentity | null) {
  const organizationId = identity?.organizationId ?? null
  const key = identity
    ? JSON.stringify([
        identity.userId,
        identity.organizationId,
        identity.sessionId,
      ])
    : null
  const snapshot = useCallback(
    () =>
      key ? (requests.get(key)?.state ?? pendingMembership) : noMembership,
    [key],
  )
  // SSR must never reuse another request's cached membership, and a known
  // workspace stays pending until its client-side membership read completes.
  const serverSnapshot = useCallback(
    () => (key ? pendingMembership : noMembership),
    [key],
  )
  const subscribe = useCallback(
    (listener: () => void) => {
      if (!key || !organizationId) return () => {}
      let request = requests.get(key)
      if (!request) {
        request = {
          state: pendingMembership,
          controller: new AbortController(),
          listeners: new Set(),
        }
        requests.set(key, request)
        const current = request
        const signal = current.controller.signal
        void authClient.organization
          .getActiveMemberRole({
            query: { organizationId },
            fetchOptions: { signal },
          })
          .then(({ data, error }) => {
            if (signal.aborted) return
            current.state = {
              role: error ? null : (data?.role ?? null),
              loading: false,
            }
            for (const notify of current.listeners) notify()
          })
          .catch(() => {
            if (signal.aborted) return
            current.state = noMembership
            for (const notify of current.listeners) notify()
            // A failed membership read grants no permissions. Cancellation and
            // transport failures must not create unhandled promise rejections.
          })
      }
      request.listeners.add(listener)
      const current = request
      return () => {
        current.listeners.delete(listener)
        if (current.listeners.size === 0) {
          current.controller.abort()
          requests.delete(key)
        }
      }
    },
    [key, organizationId],
  )
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot)
}
