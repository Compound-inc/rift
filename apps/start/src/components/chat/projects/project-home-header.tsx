import { Link } from '@tanstack/react-router'
import { useQuery } from '@rocicorp/zero/react'
import { Button } from '@rift/ui/button'
import { Settings } from 'lucide-react'
import { useProjectManagementAccess } from '@/lib/frontend/projects/use-project-management-access'
import { queries } from '@/integrations/zero'
import { m } from '@/paraglide/messages.js'
import { getProjectOwnerName } from '@/lib/frontend/projects/project-owner.functions'
import { useProjectHomeResource } from './use-project-home-resource'
import { ProjectVisibilityControl } from './project-visibility-control'

export function ProjectHomeHeader({
  projectId,
}: {
  readonly projectId: string
}) {
  const { isOrphan } = useProjectManagementAccess()
  const owner = useProjectHomeResource(projectId, getProjectOwnerName)
  const [project] = useQuery(queries.projects.byId({ projectId }))
  if (!project)
    return (
      <p className="py-6 text-sm text-foreground-tertiary" role="status">
        {m.project_home_loading()}
      </p>
    )
  return (
    <header className="space-y-3 pb-5 pt-6 md:pt-10">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <h1 className="wrap-break-word text-balance text-2xl font-semibold tracking-tight text-foreground-strong">
            {project.name}
          </h1>
          {project.description ? (
            <p className="text-pretty text-sm text-foreground-tertiary">
              {project.description}
            </p>
          ) : null}
        </div>
        <Button variant="ghost" size="icon" asChild>
          <Link
            to="/chat/projects/$projectId/settings"
            params={{ projectId }}
            aria-label={m.project_home_settings()}
            title={m.project_home_settings()}
          >
            <Settings className="size-4" aria-hidden />
          </Link>
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <ProjectVisibilityControl project={project} compact />
        {project.visibility === 'org' ? (
          <p className="text-xs text-foreground-tertiary">
            {m.project_home_owner({
              name: owner.data?.name ?? m.project_home_owner_unknown(),
            })}
          </p>
        ) : null}
      </div>
      {project.visibility === 'org' ? (
        <p className="max-w-prose text-pretty text-xs leading-relaxed text-foreground-tertiary">
          {isOrphan(project) ? m.project_orphan_read_only() : m.project_visibility_workspace_hint()}
        </p>
      ) : null}
    </header>
  )
}
