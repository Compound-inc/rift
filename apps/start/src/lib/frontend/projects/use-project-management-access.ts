import { useEffect, useState } from 'react'
import { useAppAuth } from '@/lib/frontend/auth/use-auth'
import type { ProjectAccessSubject } from '@/lib/shared/projects/access'
import { getProjectOwnerMemberships } from './project-owner.functions'

/**
 * The hook is mounted by several controls on one page (sidebar, settings,
 * sources, skills…). They share one answer per session key, and mounts or
 * focus events in the same tick share a single in-flight request instead of
 * each control fetching on its own. Answers are stored per key so a late
 * response for a previous workspace can never overwrite the current one.
 */
const snapshots = new Map<string, ReadonlyArray<string>>()
const inflight = new Map<string, Promise<void>>()
const listeners = new Set<() => void>()

function refreshMemberships(key: string): void {
  if (inflight.has(key)) return
  const promise = getProjectOwnerMemberships()
    .then(
      (organizationIds) => {
        snapshots.set(key, organizationIds)
        for (const listener of listeners) listener()
      },
      () => {
        // Keep the last known membership; a failed read cannot prove removal.
      },
    )
    .finally(() => {
      inflight.delete(key)
    })
  inflight.set(key, promise)
}

/** Clears the shared membership answers (tests, and safe to call on sign-out). */
export function resetProjectMembershipCache(): void {
  snapshots.clear()
  inflight.clear()
}

/**
 * Owners can read departed-workspace projects, but cannot manage them until an
 * admin retires the sharing. Read only the caller's memberships. Key by session
 * identity and refresh on focus; server mutators still authorize every write.
 */
export function useProjectManagementAccess() {
  const { user, isAnonymous, activeOrganizationId } = useAppAuth()
  const key = `${user?.id}:${activeOrganizationId}`
  const [organizationIds, setOrganizationIds] = useState(() =>
    snapshots.get(key),
  )

  useEffect(() => {
    if (!user?.id || isAnonymous) return
    const sync = () => setOrganizationIds(snapshots.get(key))
    listeners.add(sync)
    sync()
    refreshMemberships(key)
    const onFocus = () => refreshMemberships(key)
    window.addEventListener('focus', onFocus)
    return () => {
      listeners.delete(sync)
      window.removeEventListener('focus', onFocus)
    }
  }, [key, user?.id, isAnonymous])

  const isOrphan = (project: ProjectAccessSubject | null | undefined) =>
    !!project &&
    project.userId === user?.id &&
    project.visibility === 'org' &&
    organizationIds !== undefined &&
    (!project.organizationId ||
      !organizationIds.includes(project.organizationId))

  return {
    isOrphan,
    canManage: (project: ProjectAccessSubject | null | undefined) =>
      !!project &&
      !isAnonymous &&
      project.deletedAt == null &&
      project.userId === user?.id &&
      !isOrphan(project),
  }
}
