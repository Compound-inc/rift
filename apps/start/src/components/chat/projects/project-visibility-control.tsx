import { useState } from 'react'
import { useZero } from '@rocicorp/zero/react'
import { LockKeyhole, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@rift/ui/select'
import { mutators } from '@/integrations/zero'
import { useAppAuth } from '@/lib/frontend/auth/use-auth'
import { useProjectManagementAccess } from '@/lib/frontend/projects/use-project-management-access'
import { m } from '@/paraglide/messages.js'

/** Shared home/settings control. The mutator verifies ownership and membership. */
export function ProjectVisibilityControl({
  project,
  compact = false,
}: {
  readonly project: {
    readonly id: string
    readonly userId: string
    readonly organizationId?: string | null
    readonly visibility: 'private' | 'org'
  }
  readonly compact?: boolean
}) {
  const zero = useZero()
  const { activeOrganizationId } = useAppAuth()
  const { canManage, isOrphan } = useProjectManagementAccess()
  const [pending, setPending] = useState(false)
  const canEdit = canManage(project)
  const canShare =
    !!project.organizationId && project.organizationId === activeOrganizationId
  const shared = project.visibility === 'org'
  const Icon = shared ? Users : LockKeyhole
  const hint = isOrphan(project)
    ? m.project_orphan_read_only()
    : shared
      ? m.project_visibility_workspace_hint()
      : m.project_visibility_private_hint()

  async function update(visibility: 'private' | 'org') {
    setPending(true)
    try {
      const result = await zero.mutate(
        mutators.projects.update({
          projectId: project.id,
          patch: { visibility },
        }),
      ).server
      if (result.type === 'error')
        throw new Error(m.project_visibility_save_error())
      toast.success(m.project_visibility_saved())
    } catch {
      toast.error(m.project_visibility_save_error())
    } finally {
      setPending(false)
    }
  }

  if (compact) {
    // Home header: a soft pill. The full explanation lives in settings, so
    // here it's only the tooltip.
    const pill =
      'h-7 gap-1.5 rounded-full border-transparent bg-surface-inverse/5 px-2.5 text-xs font-medium text-foreground-primary'
    return canEdit ? (
      <Select
        value={project.visibility}
        disabled={pending}
        onValueChange={(value) => {
          if (value) void update(value)
        }}
      >
        <SelectTrigger
          size="sm"
          aria-label={m.project_visibility_label()}
          title={hint}
          className={`${pill} hover:bg-surface-inverse/10 md:text-xs`}
        >
          <Icon className="size-3.5 text-foreground-tertiary" aria-hidden />
          <SelectValue>
            {shared
              ? m.project_visibility_workspace()
              : m.project_visibility_private()}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="private">{m.project_visibility_private()}</SelectItem>
          <SelectItem value="org" disabled={!canShare}>
            {m.project_visibility_workspace()}
          </SelectItem>
        </SelectContent>
      </Select>
    ) : (
      <span title={hint} className={`inline-flex items-center ${pill}`}>
        <Icon className="size-3.5 text-foreground-tertiary" aria-hidden />
        {shared ? m.project_visibility_shared() : m.project_visibility_private()}
      </span>
    )
  }

  return (
    <div className="space-y-3 rounded-xl border border-border-base bg-surface-raised p-4">
      <h2 className="text-base font-medium text-foreground-strong">
        {m.project_visibility_title()}
      </h2>
      <div className="flex flex-wrap items-center gap-2 text-sm text-foreground-tertiary">
        <Icon className="size-4 shrink-0" aria-hidden />
        {canEdit ? (
          <Select
            value={project.visibility}
            disabled={pending}
            onValueChange={(value) => {
              if (value) void update(value)
            }}
          >
            <SelectTrigger aria-label={m.project_visibility_label()} title={hint}>
              <SelectValue>
                {shared
                  ? m.project_visibility_workspace()
                  : m.project_visibility_private()}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="private">{m.project_visibility_private()}</SelectItem>
              <SelectItem value="org" disabled={!canShare}>
                {m.project_visibility_workspace()}
              </SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <span title={hint}>
            {shared
              ? m.project_visibility_shared()
              : m.project_visibility_private()}
          </span>
        )}
      </div>
      <p className="max-w-prose text-pretty text-sm text-foreground-tertiary">
        {hint}{' '}
        {canEdit && !project.organizationId
          ? m.project_visibility_no_org()
          : ''}
      </p>
    </div>
  )
}
