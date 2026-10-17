import { useEffect, useRef } from 'react'
import { useQuery } from '@rocicorp/zero/react'
import { queries } from '@/integrations/zero'
import { m } from '@/paraglide/messages.js'
import type { ReactNode } from 'react'
import { ProjectUnavailable } from './project-unavailable'
import { ProjectHomeHeader } from './project-home-header'
import { ProjectHomeSections } from './project-home-sections'

/** The existing composer stays the first action and receives desktop focus. */
export function ProjectHome({
  projectId,
  composer,
}: {
  readonly projectId: string
  readonly composer: ReactNode
}) {
  const [project, result] = useQuery(queries.projects.byId({ projectId }))
  const composerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // Do not open a software keyboard on touch devices when entering a project.
    if (window.matchMedia('(min-width: 768px) and (pointer: fine)').matches) {
      composerRef.current
        ?.querySelector<HTMLTextAreaElement>('textarea[name="message"]')
        ?.focus({ preventScroll: true })
    }
  }, [projectId, !!project])
  // Keep standalone renders safe; the route layout handles all project pages.
  if (!project && result.type === 'complete') return <ProjectUnavailable />
  if (!project)
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-16 md:px-8">
        <p role="status" className="text-sm text-foreground-tertiary">
          {m.project_home_loading()}
        </p>
      </div>
    )
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-10 md:px-8">
      <ProjectHomeHeader projectId={projectId} />
      <div ref={composerRef}>{composer}</div>
      <ProjectHomeSections projectId={projectId} />
    </div>
  )
}
