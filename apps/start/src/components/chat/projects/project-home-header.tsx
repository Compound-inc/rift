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

/**
 * Project name, description and one quiet meta row (visibility + owner).
 * Visibility rules are explained in the pill's tooltip and in settings; only
 * the orphaned state, which changes what the viewer can do, gets a line here.
 */
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
    <header className="pb-8">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="wrap-break-word text-balance text-[28px] font-semibold leading-tight tracking-tight text-foreground-strong">
            {project.name}
          </h1>
          {project.description ? (
            <p className="mt-2 max-w-prose text-pretty text-[15px] leading-relaxed text-foreground-tertiary">
              {project.description}
            </p>
          ) : null}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="-mr-2 -mt-1 shrink-0 text-foreground-tertiary hover:text-foreground-primary"
          asChild
        >
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
      <div className="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-foreground-tertiary">
        <ProjectVisibilityControl project={project} compact />
        {project.visibility === 'org' ? (
          <span>
            {m.project_home_owner({
              name: owner.data?.name ?? m.project_home_owner_unknown(),
            })}
          </span>
        ) : null}
      </div>
      {project.visibility === 'org' && isOrphan(project) ? (
        <p className="mt-3 max-w-prose text-pretty text-xs leading-relaxed text-foreground-tertiary">
          {m.project_orphan_read_only()}
        </p>
      ) : null}
    </header>
  )
}
