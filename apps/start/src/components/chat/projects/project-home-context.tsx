import { Link } from '@tanstack/react-router'
import { useQuery } from '@rocicorp/zero/react'
import { Button } from '@rift/ui/button'
import { FileText, ScrollText, SquareSlash } from 'lucide-react'
import type { ReactNode } from 'react'
import { queries } from '@/integrations/zero'
import { useProjectManagementAccess } from '@/lib/frontend/projects/use-project-management-access'
import { getProjectSourceSummary } from '@/lib/frontend/projects/project-sources-summary.functions'
import { m } from '@/paraglide/messages.js'
import { activeProjectSkills } from './project-home.logic'
import { useProjectHomeResource } from './use-project-home-resource'

/**
 * Soft, borderless surface for one piece of project context. The action sits
 * in the header so every card has the same rhythm: title, then content.
 */
function ContextCard({
  id,
  icon,
  title,
  meta,
  action,
  className = '',
  children,
}: {
  readonly id: string
  readonly icon: ReactNode
  readonly title: string
  readonly meta?: ReactNode
  readonly action?: ReactNode
  readonly className?: string
  readonly children: ReactNode
}) {
  return (
    <section
      aria-labelledby={id}
      className={`min-w-0 rounded-2xl bg-surface-inverse/[0.035] p-5 ${className}`}
    >
      <div className="flex min-h-8 items-center gap-2">
        <span className="text-foreground-tertiary" aria-hidden>
          {icon}
        </span>
        <h2 id={id} className="text-sm font-medium text-foreground-strong">
          {title}
        </h2>
        {meta ? (
          <span className="text-xs tabular-nums text-foreground-tertiary">
            {meta}
          </span>
        ) : null}
        {action ? <div className="-mr-2 ml-auto">{action}</div> : null}
      </div>
      <div className="mt-2">{children}</div>
    </section>
  )
}

/** Compact header action; the long label stays the accessible name. */
function CardAction({
  to,
  projectId,
  hash,
  label,
  accessibleLabel,
}: {
  readonly to:
    | '/chat/projects/$projectId/settings'
    | '/chat/projects/$projectId/sources'
    | '/chat/projects/$projectId/skills'
  readonly projectId: string
  readonly hash?: string
  readonly label: string
  readonly accessibleLabel: string
}) {
  return (
    <Button
      variant="ghost"
      className="h-8 rounded-full px-3 text-xs text-foreground-tertiary hover:text-foreground-primary"
      asChild
    >
      <Link to={to} params={{ projectId }} hash={hash} aria-label={accessibleLabel}>
        {label}
      </Link>
    </Button>
  )
}

export function ProjectHomeContext({
  projectId,
}: {
  readonly projectId: string
}) {
  const { canManage } = useProjectManagementAccess()
  const [project] = useQuery(queries.projects.byId({ projectId }))
  const [projectSkills] = useQuery(queries.skills.listForProject({ projectId }))
  const [personal] = useQuery(queries.skills.listPersonal({}))
  const [org] = useQuery(queries.skills.listOrgShared({}))
  const [overrides] = useQuery(
    queries.skills.overridesForProject({ projectId }),
  )
  const sources = useProjectHomeResource(projectId, getProjectSourceSummary)
  const skills = activeProjectSkills({
    project: projectSkills,
    org,
    personal,
    hiddenIds: new Set(overrides.map((row) => row.skillId)),
  })
  const canEdit = canManage(project)
  if (!project) return null
  const instruction = project.customInstruction?.trim()
  return (
    <div className="grid min-w-0 gap-3 md:grid-cols-2">
      <ContextCard
        id="project-instructions-heading"
        icon={<ScrollText className="size-4" />}
        title={m.project_home_instructions()}
        className="md:col-span-2"
        action={
          canEdit ? (
            <CardAction
              to="/chat/projects/$projectId/settings"
              projectId={projectId}
              hash="project-instruction"
              label={m.project_home_action_edit()}
              accessibleLabel={m.project_home_edit_instructions()}
            />
          ) : null
        }
      >
        <p
          tabIndex={instruction ? 0 : undefined}
          className={`max-h-48 overflow-y-auto whitespace-pre-wrap wrap-break-word text-pretty text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-border-strong ${instruction ? 'text-foreground-primary' : 'text-foreground-tertiary'}`}
        >
          {instruction || m.project_home_instruction_empty()}
        </p>
        {!canEdit ? (
          <p className="mt-2 text-xs text-foreground-tertiary">
            {m.project_home_read_only()}
          </p>
        ) : null}
      </ContextCard>

      <ContextCard
        id="project-files-heading"
        icon={<FileText className="size-4" />}
        title={m.project_home_files()}
        meta={
          sources.data && sources.data.count > 0
            ? m.project_home_files_count({ count: sources.data.count })
            : undefined
        }
        action={
          <CardAction
            to="/chat/projects/$projectId/sources"
            projectId={projectId}
            label={canEdit ? m.project_home_action_manage() : m.project_home_action_view()}
            accessibleLabel={
              canEdit ? m.project_home_manage_files() : m.project_home_view_files()
            }
          />
        }
      >
        {sources.failed ? (
          <div className="text-sm text-foreground-tertiary">
            <p>{m.project_home_data_error()}</p>
            <Button
              variant="ghost"
              className="-ml-2.5 mt-1"
              onClick={sources.retry}
            >
              {m.project_home_retry()}
            </Button>
          </div>
        ) : !sources.data ? (
          <p role="status" className="text-sm text-foreground-tertiary">
            {m.project_home_loading()}
          </p>
        ) : sources.data.count === 0 ? (
          <p className="text-pretty text-sm leading-relaxed text-foreground-tertiary">
            {m.project_home_files_empty()}
          </p>
        ) : (
          <ul className="space-y-2">
            {sources.data.files.map((file) => (
              <li key={file.id} className="flex min-w-0 items-baseline gap-2 text-sm">
                <p
                  className="min-w-0 flex-1 truncate text-foreground-primary"
                  title={file.fileName}
                >
                  {file.fileName}
                </p>
                {file.embeddingStatus === 'indexed' ? null : (
                  <span
                    className={
                      file.embeddingStatus === 'failed'
                        ? 'shrink-0 text-xs text-foreground-error'
                        : 'shrink-0 text-xs text-foreground-tertiary'
                    }
                  >
                    {file.embeddingStatus === 'failed'
                      ? m.chat_project_sources_index_status_error()
                      : file.embeddingStatus === 'disabled'
                        ? m.project_source_disabled()
                        : m.chat_project_sources_index_status_pending()}
                  </span>
                )}
              </li>
            ))}
            {sources.data.count > sources.data.files.length ? (
              <li className="text-xs text-foreground-tertiary">
                {m.project_home_more_files({
                  count: sources.data.count - sources.data.files.length,
                })}
              </li>
            ) : null}
          </ul>
        )}
      </ContextCard>

      <ContextCard
        id="project-skills-heading"
        icon={<SquareSlash className="size-4" />}
        title={m.project_home_skills()}
        action={
          <CardAction
            to="/chat/projects/$projectId/skills"
            projectId={projectId}
            label={canEdit ? m.project_home_action_manage() : m.project_home_action_view()}
            accessibleLabel={
              canEdit ? m.project_home_manage_skills() : m.project_home_view_skills()
            }
          />
        }
      >
        {skills.length ? (
          <>
            <ul className="flex flex-wrap gap-1.5">
              {skills.map((skill) => (
                <li
                  key={skill.id}
                  title={skill.description ?? undefined}
                  className="max-w-full truncate rounded-full bg-surface-base px-2.5 py-1 font-geist-mono text-xs text-foreground-primary shadow-[0_0_0_1px_var(--border-base)]"
                >
                  /{skill.name}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-foreground-tertiary">
              {m.project_home_skills_hint()}
            </p>
          </>
        ) : (
          <p className="text-pretty text-sm leading-relaxed text-foreground-tertiary">
            {m.project_home_skills_empty()}
          </p>
        )}
      </ContextCard>
    </div>
  )
}
