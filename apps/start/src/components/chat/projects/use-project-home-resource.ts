import { useEffect, useState } from 'react'
import { useAppAuth } from '@/lib/frontend/auth/use-auth'

/**
 * Server-only summaries never subscribe to message or document bodies. Key the
 * result by identity as well as project, so an org switch cannot flash totals
 * fetched with the previous identity's permissions. Ignore unmounted requests.
 */
export function useProjectHomeResource<T>(
  projectId: string,
  load: (input: { data: { projectId: string } }) => Promise<T>,
) {
  const { user, activeOrganizationId } = useAppAuth()
  const key = `${user?.id}:${activeOrganizationId}:${projectId}`
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<{
    key: string
    data?: T
    failed?: boolean
  }>()
  useEffect(() => {
    let active = true
    void load({ data: { projectId } }).then(
      (data) => {
        if (active) setState({ key, data })
      },
      () => {
        if (active) setState({ key, failed: true })
      },
    )
    return () => {
      active = false
    }
  }, [key, load, projectId, attempt])
  return {
    data: state?.key === key ? state.data : undefined,
    failed: state?.key === key && state.failed,
    retry: () => setAttempt((value) => value + 1),
  }
}
