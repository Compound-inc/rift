import { useQuery } from '@rocicorp/zero/react'
import { useEffect } from 'react'
import { Outlet, createFileRoute, useNavigate } from '@tanstack/react-router'

import { ProjectUnavailable } from '@/components/chat/projects/project-unavailable'
import { queries } from '@/integrations/zero'
import { useAppAuth } from '@/lib/frontend/auth/use-auth'

/**
 * Guard all project pages once access resolves. While Zero hydrates, leave the
 * outlet mounted so each page keeps its normal loading behavior. Project chrome
 * lives in the chat sidebar, outside this layout.
 */
export const Route = createFileRoute('/(app)/_layout/chat/projects/$projectId')(
  {
    component: ProjectDetailLayout,
  },
)

function ProjectDetailLayout() {
  const { projectId } = Route.useParams()
  const [project, result] = useQuery(queries.projects.byId({ projectId }))
  const navigate = useNavigate()
  const { isAnonymous, loading, user } = useAppAuth()
  useEffect(() => {
    if (!loading && (!user || isAnonymous)) {
      void navigate({ to: '/chat' })
    }
  }, [isAnonymous, loading, navigate, user])

  if (result.type === 'complete' && !project) return <ProjectUnavailable />

  return <Outlet />
}
