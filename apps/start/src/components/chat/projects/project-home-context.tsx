import { Link } from '@tanstack/react-router'
import { useQuery } from '@rocicorp/zero/react'
import { Button } from '@rift/ui/button'
import { FileText } from 'lucide-react'
import { queries } from '@/integrations/zero'
import { useProjectManagementAccess } from '@/lib/frontend/projects/use-project-management-access'
import { getProjectSourceSummary } from '@/lib/frontend/projects/project-sources-summary.functions'
import { m } from '@/paraglide/messages.js'
import { activeProjectSkills } from './project-home.logic'
import { useProjectHomeResource } from './use-project-home-resource'

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
  return (
    <div className="grid min-w-0 gap-4 md:grid-cols-2">
      <section
        className="min-w-0 space-y-3 rounded-xl border border-border-base bg-surface-raised p-4 md:col-span-2"
        aria-labelledby="project-instructions-heading"
      >
        <div className="flex items-center justify-between gap-3">
          <h2
            id="project-instructions-heading"
            className="text-base font-medium text-foreground-strong"
          >
            {m.project_home_instructions()}
          </h2>
          {canEdit ? (
            <Button variant="ghost" className="min-h-10" asChild>
              <Link
                to="/chat/projects/$projectId/settings"
                params={{ projectId }}
                hash="project-instruction"
              >
                {m.project_home_edit_instructions()}
              </Link>
            </Button>
          ) : null}
        </div>
        <p
          tabIndex={project.customInstruction ? 0 : undefined}
          className="outline-none focus-visible:ring-2 focus-visible:ring-border-strong max-h-48 overflow-y-auto whitespace-pre-wrap wrap-break-word text-pretty text-sm leading-relaxed text-foreground-tertiary"
        >
          {project.customInstruction?.trim() ||
            m.project_home_instruction_empty()}
        </p>
        {!canEdit ? (
          <p className="text-xs text-foreground-tertiary">
            {m.project_home_read_only()}
          </p>
        ) : null}
      </section>
      <section
        className="min-w-0 space-y-3 rounded-xl border border-border-base bg-surface-raised p-4"
        aria-labelledby="project-files-heading"
      >
        <div className="flex items-center justify-between gap-3">
          <h2
            id="project-files-heading"
            className="text-base font-medium text-foreground-strong"
          >
            {m.project_home_files()}
          </h2>
          {sources.data ? (
            <span className="text-xs tabular-nums text-foreground-tertiary">
              {m.project_home_files_count({ count: sources.data.count })}
            </span>
          ) : null}
        </div>
        {sources.failed ? (
          <div className="text-sm text-foreground-tertiary">
            <p>{m.project_home_data_error()}</p>
            <Button
              variant="ghost"
              className="min-h-10"
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
          <p className="text-pretty text-sm text-foreground-tertiary">
            {m.project_home_files_empty()}
          </p>
        ) : (
          <ul className="space-y-3">
            {sources.data.files.map((file) => (
              <li key={file.id} className="flex min-w-0 gap-2 text-sm">
                <FileText
                  className="mt-0.5 size-4 shrink-0 text-foreground-tertiary"
                  aria-hidden
                />
                <div className="min-w-0">
                  <p
                    className="truncate text-foreground-primary"
                    title={file.fileName}
                  >
                    {file.fileName}
                  </p>
                  <p
                    className={
                      file.embeddingStatus === 'failed'
                        ? 'text-xs text-foreground-error'
                        : 'text-xs text-foreground-tertiary'
                    }
                  >
                    {file.embeddingStatus === 'indexed'
                      ? m.common_indexed()
                      : file.embeddingStatus === 'failed'
                        ? m.chat_project_sources_index_status_error()
                        : file.embeddingStatus === 'disabled'
                          ? m.project_source_disabled()
                          : m.chat_project_sources_index_status_pending()}
                  </p>
                </div>
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
        <Button variant="ghost" className="min-h-10" asChild>
          <Link to="/chat/projects/$projectId/sources" params={{ projectId }}>
            {canEdit
              ? m.project_home_manage_files()
              : m.project_home_view_files()}
          </Link>
        </Button>
      </section>
      <section
        className="min-w-0 space-y-3 rounded-xl border border-border-base bg-surface-raised p-4"
        aria-labelledby="project-skills-heading"
      >
        <h2
          id="project-skills-heading"
          className="text-base font-medium text-foreground-strong"
        >
          {m.project_home_skills()}
        </h2>
        {skills.length ? (
          <ul className="flex flex-wrap gap-2">
            {skills.map((skill) => (
              <li
                key={skill.id}
                title={skill.description ?? undefined}
                className="max-w-full truncate rounded-md bg-surface-overlay px-2 py-1 text-sm text-foreground-primary"
              >
                /{skill.name}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-pretty text-sm text-foreground-tertiary">
            {m.project_home_skills_empty()}
          </p>
        )}
        <p className="text-xs text-foreground-tertiary">
          {m.project_home_skills_hint()}
        </p>
        <Button variant="ghost" className="min-h-10" asChild>
          <Link to="/chat/projects/$projectId/skills" params={{ projectId }}>
            {canEdit
              ? m.project_home_manage_skills()
              : m.project_home_view_skills()}
          </Link>
        </Button>
      </section>
    </div>
  )
}
