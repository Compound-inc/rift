import { Button } from '@rift/ui/button'
import { getProjectUsage } from '@/lib/frontend/projects/project-usage.functions'
import { getLocale } from '@/paraglide/runtime.js'
import { m } from '@/paraglide/messages.js'
import { ProjectHomeContext } from './project-home-context'
import { ProjectHomeConversations } from './project-home-conversations'
import { useProjectHomeResource } from './use-project-home-resource'

/** Independent sections leave room for project memory and produced documents. */
export function ProjectHomeSections({
  projectId,
}: {
  readonly projectId: string
}) {
  return (
    <div className="space-y-12 pb-16 pt-12">
      <ProjectHomeConversations key={projectId} projectId={projectId} />
      <ProjectHomeContext projectId={projectId} />
      <ProjectHomeUsage projectId={projectId} />
    </div>
  )
}

function ProjectHomeUsage({ projectId }: { readonly projectId: string }) {
  const { data, failed, retry } = useProjectHomeResource(
    projectId,
    getProjectUsage,
  )
  if (failed)
    return (
      <div className="flex items-center gap-2 text-xs text-foreground-tertiary">
        <p>{m.project_home_data_error()}</p>
        <Button variant="ghost" className="h-8 px-2.5 text-xs" onClick={retry}>
          {m.project_home_retry()}
        </Button>
      </div>
    )
  if (!data) return null
  const count = new Intl.NumberFormat(getLocale()).format(data.totalTokens)
  const cost =
    data.publicCost == null
      ? null
      : new Intl.NumberFormat(getLocale(), {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 2,
          maximumFractionDigits: 4,
        }).format(data.publicCost)
  // One quiet line; the tooltip explains what the numbers include.
  return (
    <p
      className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs tabular-nums text-foreground-tertiary"
      title={m.project_usage_hint()}
    >
      <span>
        {data.scope === 'project'
          ? m.project_usage_total()
          : m.project_usage_own()}
      </span>
      <span aria-hidden>·</span>
      <span>{m.project_usage_tokens({ count })}</span>
      <span aria-hidden>·</span>
      <span>
        {cost === null
          ? m.project_usage_no_cost()
          : data.unpricedMessages
            ? m.project_usage_partial_cost({ cost })
            : m.project_usage_cost({ cost })}
      </span>
    </p>
  )
}
