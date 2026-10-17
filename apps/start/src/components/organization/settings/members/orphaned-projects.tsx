import { useEffect, useState } from 'react'
import { useZero } from '@rocicorp/zero/react'
import { Button } from '@rift/ui/button'
import { FormDialog } from '@rift/ui/dialog'
import { toast } from 'sonner'
import { mutators } from '@/integrations/zero'
import { useAppAuth } from '@/lib/frontend/auth/use-auth'
import { awaitProjectMutation } from '@/lib/frontend/projects/await-project-mutation'
import { getOrphanedProjects } from '@/lib/frontend/projects/project-owner.functions'
import { isAdminRole } from '@/lib/shared/auth/roles'
import { m } from '@/paraglide/messages.js'
import { getLocale } from '@/paraglide/runtime.js'

type OrphanedProjectMetadata = Awaited<
  ReturnType<typeof getOrphanedProjects>
>[number]

/** Reset metadata and confirmations whenever the authenticated workspace changes. */
export function OrphanedProjects({
  refreshKey,
}: {
  refreshKey: string | null
}) {
  const { user, activeOrganizationId, activeOrganizationRole, isAnonymous } =
    useAppAuth()
  if (
    isAnonymous ||
    !activeOrganizationId ||
    !isAdminRole(activeOrganizationRole ?? '')
  )
    return null
  return (
    <OrphanedProjectsList
      key={`${user?.id}:${activeOrganizationId}`}
      refreshKey={refreshKey}
    />
  )
}

function OrphanedProjectsList({ refreshKey }: { refreshKey: string | null }) {
  const zero = useZero()
  const [projects, setProjects] =
    useState<ReadonlyArray<OrphanedProjectMetadata>>()
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [confirmation, setConfirmation] = useState<{
    project: OrphanedProjectMetadata
    action: 'private' | 'delete'
  }>()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()

  // Member removals can create orphans. Reload after the members action settles.
  useEffect(() => {
    let active = true
    setFailed(false)
    void getOrphanedProjects().then(
      (rows) => {
        if (active) setProjects(rows)
      },
      () => {
        if (active) {
          setFailed(true)
          setProjects(undefined)
        }
      },
    )
    return () => {
      active = false
    }
  }, [attempt, refreshKey])

  async function resolve() {
    if (!confirmation || pending) return
    setPending(true)
    setError(undefined)
    try {
      await awaitProjectMutation(
        zero.mutate(
          mutators.projects.resolveOrphan({
            projectId: confirmation.project.id,
            action: confirmation.action,
          }),
        ),
      )
      setProjects((rows) =>
        rows?.filter((row) => row.id !== confirmation.project.id),
      )
      setConfirmation(undefined)
      setAttempt((value) => value + 1)
      toast.success(m.project_orphans_resolved())
    } catch {
      setError(m.project_orphans_resolve_error())
    } finally {
      setPending(false)
    }
  }

  const deleting = confirmation?.action === 'delete'
  return (
    <section
      className="space-y-3 rounded-xl border border-border-base bg-surface-raised p-4"
      aria-labelledby="orphaned-projects-heading"
    >
      <h2
        id="orphaned-projects-heading"
        className="text-base font-medium text-foreground-strong"
      >
        {m.project_orphans_title()}
      </h2>
      <p className="max-w-prose text-pretty text-sm text-foreground-tertiary">
        {m.project_orphans_description()}
      </p>
      {failed ? (
        <div className="flex items-center gap-3" role="alert">
          <p className="text-sm text-foreground-error">
            {m.project_orphans_load_error()}
          </p>
          <Button
            variant="ghost"
            onClick={() => setAttempt((value) => value + 1)}
          >
            {m.project_home_retry()}
          </Button>
        </div>
      ) : !projects ? (
        <p role="status" className="text-sm text-foreground-tertiary">
          {m.project_home_loading()}
        </p>
      ) : projects.length === 0 ? (
        <p className="text-sm text-foreground-tertiary">
          {m.project_orphans_empty()}
        </p>
      ) : (
        <ul className="divide-y divide-border-base">
          {projects.map((project) => (
            <li
              key={project.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div className="min-w-0 space-y-1">
                <p className="wrap-break-word text-sm font-medium text-foreground-primary">
                  {project.name}
                </p>
                <p className="text-xs text-foreground-tertiary">
                  {m.project_orphans_former_owner({
                    name:
                      project.formerOwnerName ?? m.project_home_owner_unknown(),
                  })}
                </p>
                <p className="text-xs tabular-nums text-foreground-tertiary">
                  {m.project_orphans_created({
                    date: new Date(project.createdAt).toLocaleDateString(
                      getLocale(),
                    ),
                  })}
                </p>
              </div>
              <div className="flex gap-2">
                {(['private', 'delete'] as const).map((action) => (
                  <Button
                    key={action}
                    className="min-h-10"
                    variant={action === 'delete' ? 'dangerLight' : 'outline'}
                    disabled={pending}
                    onClick={() => {
                      setError(undefined)
                      setConfirmation({ project, action })
                    }}
                  >
                    {action === 'delete'
                      ? m.chat_project_delete_button()
                      : m.project_orphans_make_private()}
                  </Button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
      <FormDialog
        open={!!confirmation}
        onOpenChange={(open) => {
          if (!open && !pending) setConfirmation(undefined)
        }}
        title={
          deleting
            ? m.chat_project_delete_dialog_title()
            : m.project_orphans_make_private()
        }
        description={
          confirmation
            ? deleting
              ? m.chat_project_delete_confirm({
                  name: confirmation.project.name,
                })
              : m.project_orphans_private_confirm({
                  name: confirmation.project.name,
                })
            : ''
        }
        buttonText={
          deleting
            ? m.chat_project_delete_button()
            : m.project_orphans_make_private()
        }
        buttonVariant={deleting ? 'danger' : 'default'}
        buttonDisabled={pending}
        secondaryButtonDisabled={pending}
        secondaryButtonText={m.common_cancel()}
        onSecondaryClick={() => setConfirmation(undefined)}
        error={error}
        handleSubmit={resolve}
      />
    </section>
  )
}
