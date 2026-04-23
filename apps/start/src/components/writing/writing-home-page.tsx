'use client'

import { useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { useQuery } from '@rocicorp/zero/react'
import { Feather, FolderPlus, Sparkles } from 'lucide-react'
import { Button } from '@rift/ui/button'
import { Input } from '@rift/ui/input'
import { Textarea } from '@rift/ui/textarea'
import { toast } from 'sonner'
import { ContentPage } from '@/components/layout'
import { queries } from '@/integrations/zero'
import { createWritingProject } from '@/lib/frontend/writing'

/**
 * Minimal home view for the writing product area.
 *
 * This intentionally favors fast testing coverage over polish: create a
 * project, inspect the live list, and jump directly into the workspace shell.
 */
export function WritingHomePage() {
  const createProject = useServerFn(createWritingProject)
  const [projects] = useQuery(queries.writing.projects({}))
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleCreateProject() {
    if (!title.trim()) {
      toast.error('Project title is required')
      return
    }

    setSubmitting(true)
    try {
      const result = (await createProject({
        data: {
          title,
          description: description || undefined,
        },
      })) as { projectId: string }
      setTitle('')
      setDescription('')
      toast.success('Writing project created')
      window.location.assign(`/writing/projects/${result.projectId}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create writing project')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ContentPage className="lg:pt-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-border-base bg-surface-base/95 p-5 shadow-sm">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-foreground-secondary">
                Writing Workspace
              </p>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground-strong">
                Vibe-code a business plan.
              </h1>
              <p className="text-sm leading-6 text-foreground-secondary">
                Create a markdown project, organize drafts into section folders, and collaborate
                with an AI agent that stages diffs for review instead of touching the real
                filesystem.
              </p>
            </div>
            <div className="rounded-2xl border border-border-base bg-surface-muted/60 p-3 text-foreground-secondary">
              <Sparkles className="size-5" />
            </div>
          </div>

          <div className="space-y-3">
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Business Plan"
            />
            <Textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What is this project for?"
              className="min-h-28"
            />
            <Button onClick={handleCreateProject} disabled={submitting} className="w-full">
              <FolderPlus className="mr-2 size-4" />
              {submitting ? 'Creating project...' : 'Create project'}
            </Button>
          </div>
        </section>

        <section className="rounded-2xl border border-border-base bg-surface-base/95 p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground-strong">Projects</h2>
              <p className="text-sm text-foreground-secondary">
                Each project keeps its own sectioned manuscript tree, chats, pending diffs, and
                checkpoints.
              </p>
            </div>
            <Feather className="size-4 text-foreground-secondary" />
          </div>

          <div className="space-y-3">
            {projects.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border-base px-4 py-8 text-center text-sm text-foreground-secondary">
                No writing projects yet. Create one to scaffold a markdown workspace.
              </div>
            ) : null}

            {projects.map((project: any) => (
              <a
                key={project.id}
                href={`/writing/projects/${project.id}`}
                className="block rounded-2xl border border-border-base bg-surface-muted/50 p-4 transition hover:border-border-strong hover:bg-surface-muted"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-medium text-foreground-strong">
                      {project.title}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-sm text-foreground-secondary">
                      {project.description || 'Open the workspace to start drafting and revising.'}
                    </p>
                  </div>
                  <div className="text-right text-xs text-foreground-secondary">
                    <div>{project.autoAcceptMode ? 'Auto-accept on' : 'Manual review'}</div>
                    <div className="mt-1">/{project.slug}</div>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </section>
      </div>
    </ContentPage>
  )
}
