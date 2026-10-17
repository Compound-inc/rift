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
    <div className="space-y-8 pb-10 pt-8">
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
      <div className="text-xs text-foreground-tertiary">
        <p>{m.project_home_data_error()}</p>
        <Button variant="ghost" className="min-h-10" onClick={retry}>
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
  return (
    <aside
      className="space-y-1 border-t border-border-base pt-4 text-xs text-foreground-tertiary"
      title={m.project_usage_hint()}
    >
      <p>
        {data.scope === 'project'
          ? m.project_usage_total()
          : m.project_usage_own()}
      </p>
      <p className="flex flex-wrap gap-x-3 gap-y-1 tabular-nums">
        <span>{m.project_usage_tokens({ count })}</span>
        <span>
          {cost === null
            ? m.project_usage_no_cost()
            : data.unpricedMessages
              ? m.project_usage_partial_cost({ cost })
              : m.project_usage_cost({ cost })}
        </span>
      </p>
    </aside>
  )
}
