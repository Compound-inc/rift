import { useEffect } from 'react'
import { Outlet, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@rocicorp/zero/react'

import { queries } from '@/integrations/zero'
import { useAppAuth } from '@/lib/frontend/auth/use-auth'

/**
 * Layout route for `/chat/projects/$projectId/*`. The project chrome lives
 * in the chat sidebar (which switches into project-scoped mode for these
 * paths), so this layout is intentionally minimal: it just renders the
 * outlet and bails to `/chat` if the project disappears (deleted in another
 * tab, lost org access, etc.).
 */
export const Route = createFileRoute('/(app)/_layout/chat/projects/$projectId')(
  {
    component: ProjectDetailLayout,
  },
)

function ProjectDetailLayout() {
  const { projectId } = Route.useParams()
  const navigate = useNavigate()
  const { isAnonymous, loading, user } = useAppAuth()
  const [project, projectResult] = useQuery(
    queries.projects.byId({ projectId }),
  )

  useEffect(() => {
    if (!loading && (!user || isAnonymous)) {
      void navigate({ to: '/chat' })
      return
    }

    if (projectResult.type === 'complete' && !project) {
      void navigate({ to: '/chat' })
    }
  }, [isAnonymous, loading, navigate, project, projectResult.type, user])

  return <Outlet />
}
