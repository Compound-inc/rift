'use client'

import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { BookOpenText, FileText, FolderTree, ScrollText } from 'lucide-react'
import type { QueryResultType } from '@rocicorp/zero'
import { Streamdown } from 'streamdown'
import { useQuery } from '@rocicorp/zero/react'
import { Button } from '@rift/ui/button'
import { queries } from '@/integrations/zero'
import { cn } from '@rift/utils'
import { inlineCitationRemarkPlugin } from '@/components/chat/message-parts/renderers/inline-citation-remark-plugin'
import {
  streamdownStaticComponents,
} from '@/components/chat/message-parts/renderers/streamdown-components'
import { useStreamdownPlugins } from '@/components/chat/message-parts/renderers/use-streamdown-plugins'
import {
  buildWritingManuscript,
} from '@/lib/frontend/writing/manuscript'
import type { WritingPendingReviewInput } from '@/lib/frontend/writing/manuscript'
import { WritingChangeReviewCard } from './writing-change-review-card'

type WritingDocumentViewerProps = {
  readonly projectId: string
}

type WritingDocumentEntry = QueryResultType<
  ReturnType<(typeof queries.writing)['manuscriptEntriesByProject']>
>[number]
type WritingPendingChangeSet = QueryResultType<
  ReturnType<(typeof queries.writing)['pendingChangeSetsByProject']>
>[number]

type WritingDocumentViewMode = 'manuscript' | 'focused'

function formatMetric(value: number, singular: string, plural = `${singular}s`) {
  return `${value.toLocaleString()} ${value === 1 ? singular : plural}`
}

function createSectionAnchorId(sectionId: string) {
  return `writing-section-${sectionId.replace(/[^a-zA-Z0-9_-]/g, '-')}`
}

function createFileAnchorId(path: string) {
  return `writing-file-${path.replace(/[^a-zA-Z0-9_-]/g, '-')}`
}

/**
 * The viewer presents a manuscript-first experience over the markdown
 * workspace.
 */
export function WritingDocumentViewer({
  projectId,
}: WritingDocumentViewerProps) {
  const reducedMotion = useReducedMotion()
  const [entries] = useQuery(queries.writing.manuscriptEntriesByProject({ projectId }))
  const [pendingChangeSets] = useQuery(queries.writing.pendingChangeSetsByProject({ projectId }))
  const deferredEntries = useDeferredValue(entries)
  const streamdownPlugins = useStreamdownPlugins()
  const pendingReviews = useMemo<readonly WritingPendingReviewInput[]>(
    () =>
      (pendingChangeSets as readonly WritingPendingChangeSet[]).flatMap((changeSet) => {
        const changes = Array.isArray(changeSet.changes) ? changeSet.changes : []
        return changes.flatMap((change) => {
          const hunks = Array.isArray(change.hunks) ? change.hunks : []
          const hunkIds = hunks.map((hunk: { readonly id: string }) => hunk.id)
          if (hunkIds.length === 0) {
            return []
          }

          const reviewStatus: WritingPendingReviewInput['changeSetStatus'] =
            changeSet.status === 'partially_applied' ? 'partially_applied' : 'pending'

          return [
            {
              changeSetId: changeSet.id,
              changeId: change.id,
              changeSetSummary: changeSet.summary,
              changeSetStatus: reviewStatus,
              path: change.path,
              operation: change.operation,
              createdAt: change.createdAt,
              baseContent: change.baseBlob?.content ?? '',
              proposedContent: change.proposedBlob?.content ?? '',
              hunkIds,
            },
          ]
        })
      }),
    [pendingChangeSets],
  )
  const manuscript = useMemo(
    () =>
      buildWritingManuscript(
        deferredEntries as readonly WritingDocumentEntry[],
        pendingReviews,
      ),
    [deferredEntries, pendingReviews],
  )
  const [viewMode, setViewMode] = useState<WritingDocumentViewMode>('manuscript')
  const [selectedPath, setSelectedPath] = useState<string | null>(null)

  useEffect(() => {
    if (manuscript.files.length === 0) {
      setSelectedPath(null)
      return
    }

    setSelectedPath((current) => {
      if (current && manuscript.files.some((file) => file.path === current)) {
        return current
      }

      return manuscript.files[0]?.path ?? null
    })
  }, [manuscript.files])

  const selectedFile =
    manuscript.files.find((file) => file.path === selectedPath) ?? manuscript.files[0] ?? null

  const scrollToAnchor = (anchorId: string) => {
    const node = document.getElementById(anchorId)
    if (!node) {
      return
    }

    node.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'start',
    })
  }

  return (
    <section className="flex h-full min-h-0 flex-col bg-surface-base/80">
      <div className="border-b border-border-base bg-linear-to-b from-surface-base to-surface-base/85 px-3 py-3 md:px-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-foreground-secondary">
                <BookOpenText className="size-3.5" aria-hidden />
                Manuscript View
              </div>
              <div className="text-sm leading-6 text-foreground-secondary [text-wrap:pretty]">
                The document reads as one continuous draft while the workspace stays organized as
                section folders behind the scenes.
              </div>
            </div>

            <div className="inline-flex rounded-xl border border-border-base bg-surface-muted/70 p-1 shadow-sm">
              <Button
                type="button"
                variant="ghost"
                size="default"
                className={cn(
                  'h-8 rounded-lg px-3 text-xs font-medium',
                  viewMode === 'manuscript'
                    ? 'bg-surface-base text-foreground-strong shadow-sm'
                    : 'text-foreground-secondary',
                )}
                onClick={() => setViewMode('manuscript')}
              >
                <ScrollText className="size-3.5" aria-hidden />
                Unified
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="default"
                className={cn(
                  'h-8 rounded-lg px-3 text-xs font-medium',
                  viewMode === 'focused'
                    ? 'bg-surface-base text-foreground-strong shadow-sm'
                    : 'text-foreground-secondary',
                )}
                onClick={() => setViewMode('focused')}
              >
                <FileText className="size-3.5" aria-hidden />
                Focused File
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-xs text-foreground-secondary">
            <div className="rounded-full border border-border-base bg-surface-muted/70 px-2.5 py-1 font-medium tabular-nums">
              {formatMetric(manuscript.sections.length, 'section')}
            </div>
            <div className="rounded-full border border-border-base bg-surface-muted/70 px-2.5 py-1 font-medium tabular-nums">
              {formatMetric(manuscript.totalFileCount, 'file')}
            </div>
            <div className="rounded-full border border-border-base bg-surface-muted/70 px-2.5 py-1 font-medium tabular-nums">
              {formatMetric(manuscript.totalWordCount, 'word')}
            </div>
            {manuscript.workspaceInstructionsPath ? (
              <div className="rounded-full border border-border-base bg-surface-muted/70 px-2.5 py-1 font-medium">
                Root keeps {manuscript.workspaceInstructionsPath}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="border-b border-border-base bg-surface-muted/35 xl:border-r xl:border-b-0">
          <div className="flex h-full min-h-0 flex-col">
            <div className="border-b border-border-base px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground-strong">
                <FolderTree className="size-4 text-foreground-secondary" aria-hidden />
                Structure
              </div>
              <p className="mt-1 text-xs leading-5 text-foreground-secondary [text-wrap:pretty]">
                Top-level folders behave like sections. Numeric prefixes in folders, subfolders,
                and files define the unified manuscript order.
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
              <div className="space-y-3">
                {manuscript.sections.map((section, sectionIndex) => (
                  <div
                    key={section.id}
                    className="rounded-2xl border border-border-base/80 bg-surface-base/80 p-2.5 shadow-[0_1px_0_rgba(15,23,42,0.04)]"
                  >
                    <button
                      type="button"
                      className="flex w-full items-start justify-between gap-3 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-surface-muted/70"
                      onClick={() => scrollToAnchor(createSectionAnchorId(section.id))}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums text-foreground-secondary">
                            {String(sectionIndex + 1).padStart(2, '0')}
                          </span>
                          <span className="truncate text-sm font-medium text-foreground-strong">
                            {section.title}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-foreground-secondary">
                          {section.description}
                        </div>
                      </div>
                    </button>

                    <div className="mt-2 space-y-1">
                      {section.files.map((file) => {
                        const isSelected = file.path === selectedFile?.path

                        return (
                          <button
                            key={file.id}
                            type="button"
                            className={cn(
                              'flex min-h-10 w-full items-center gap-2 rounded-xl px-2 py-2 text-left transition-colors',
                              isSelected
                                ? 'bg-surface-overlay text-foreground-strong shadow-sm'
                                : 'text-foreground-secondary hover:bg-surface-muted/70 hover:text-foreground-primary',
                            )}
                            onClick={() => {
                              setSelectedPath(file.path)
                              if (viewMode === 'focused') {
                                return
                              }
                              scrollToAnchor(createFileAnchorId(file.path))
                            }}
                          >
                            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-muted text-[11px] font-semibold tabular-nums text-foreground-secondary">
                              {file.orderLabel ?? '•'}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">{file.title}</span>
                              <span className="block truncate text-[11px] text-foreground-secondary">
                                {file.nestedPathLabel
                                  ? `${file.nestedPathLabel} • ${file.path}`
                                  : file.path}
                              </span>
                            </span>
                            {file.review ? (
                              <span className="rounded-full border border-amber-300/70 bg-amber-100/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-950 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-50">
                                Review
                              </span>
                            ) : null}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}

                {manuscript.sections.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border-base px-4 py-8 text-center text-sm leading-6 text-foreground-secondary">
                    Create section folders and markdown files to build the manuscript preview.
                  </div>
                ) : null}

                {manuscript.hasUngroupedFiles ? (
                  <div className="rounded-2xl border border-amber-200/70 bg-amber-50/60 px-4 py-3 text-xs leading-5 text-amber-900 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-100">
                    Root markdown files still appear here for compatibility, but new projects work
                    best when draft files live inside top-level section folders.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </aside>

        <div className="min-h-0 overflow-y-auto px-4 py-4 md:px-6 md:py-5">
          {viewMode === 'manuscript' ? (
            manuscript.sections.length > 0 ? (
              <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
                {manuscript.sections.map((section, sectionIndex) => (
                  <motion.section
                    key={section.id}
                    id={createSectionAnchorId(section.id)}
                    initial={reducedMotion ? false : { opacity: 0, y: 12 }}
                    animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
                    transition={
                      reducedMotion
                        ? undefined
                        : {
                            duration: 0.24,
                            ease: [0.2, 0, 0, 1],
                            delay: Math.min(sectionIndex * 0.06, 0.18),
                          }
                    }
                    className="rounded-[1.75rem] border border-border-base/70 bg-surface-base/90 p-4 shadow-[0_1px_0_rgba(15,23,42,0.04),0_16px_40px_rgba(15,23,42,0.06)] md:p-6"
                  >
                    <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-border-base/70 pb-4">
                      <div className="space-y-1">
                        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-foreground-secondary">
                          Section {String(sectionIndex + 1).padStart(2, '0')}
                        </div>
                        <h2 className="text-2xl font-semibold tracking-tight text-foreground-strong [text-wrap:balance]">
                          {section.title}
                        </h2>
                        <p className="text-sm leading-6 text-foreground-secondary">
                          {section.description}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-border-base bg-surface-muted/50 px-3 py-2 text-right text-xs text-foreground-secondary">
                        <div className="font-medium text-foreground-primary">
                          {section.path ?? '/'}
                        </div>
                        <div className="mt-1 tabular-nums">
                          {formatMetric(section.wordCount, 'word')}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-5">
                      {section.files.map((file) => {
                        const isSelected = file.path === selectedFile?.path

                        return (
                          <article
                            key={file.id}
                            id={createFileAnchorId(file.path)}
                            className={cn(
                              'rounded-[1.4rem] border bg-linear-to-b from-surface-base to-surface-muted/35 p-4 transition-colors md:p-5',
                              isSelected
                                ? 'border-border-strong shadow-[0_0_0_1px_rgba(15,23,42,0.04),0_10px_24px_rgba(15,23,42,0.08)]'
                                : 'border-border-base/70 shadow-[0_1px_0_rgba(15,23,42,0.04)]',
                            )}
                          >
                            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2 text-xs text-foreground-secondary">
                                  <span className="rounded-full bg-surface-muted px-2 py-0.5 font-semibold tabular-nums">
                                    {file.orderLabel ?? '•'}
                                  </span>
                                  <span className="font-medium">{file.path}</span>
                                  {file.nestedPathLabel ? (
                                    <span>{file.nestedPathLabel}</span>
                                  ) : null}
                                  {file.review ? (
                                    <span className="rounded-full border border-amber-300/70 bg-amber-100/70 px-2 py-0.5 font-semibold uppercase tracking-[0.16em] text-amber-950 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-50">
                                      Pending review
                                    </span>
                                  ) : null}
                                </div>
                                <h3 className="text-xl font-semibold tracking-tight text-foreground-strong [text-wrap:balance]">
                                  {file.title}
                                </h3>
                              </div>

                              <button
                                type="button"
                                className="rounded-full border border-border-base bg-surface-base px-2.5 py-1 text-xs font-medium text-foreground-secondary transition-colors hover:border-border-strong hover:text-foreground-primary"
                                onClick={() => {
                                  setSelectedPath(file.path)
                                  setViewMode('focused')
                                }}
                              >
                                Focus file
                              </button>
                            </div>

                            {file.review ? (
                              <WritingChangeReviewCard
                                filePath={file.path}
                                fileTitle={file.title}
                                review={file.review}
                              />
                            ) : (
                              <Streamdown
                                plugins={streamdownPlugins}
                                controls={false}
                                isAnimating={false}
                                mode="static"
                                remarkPlugins={[inlineCitationRemarkPlugin]}
                                components={streamdownStaticComponents}
                                className="chat-streamdown min-w-0 max-w-none break-words antialiased [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                              >
                                {file.content || '\u00a0'}
                              </Streamdown>
                            )}
                          </article>
                        )
                      })}
                    </div>
                  </motion.section>
                ))}
              </div>
            ) : (
              <div className="flex h-full min-h-[280px] items-center justify-center">
                <div className="max-w-md text-center text-sm leading-6 text-foreground-secondary">
                  Start by creating section folders and markdown files. The viewer will stitch them
                  into one manuscript while keeping file boundaries available for AI review and
                  navigation.
                </div>
              </div>
            )
          ) : selectedFile ? (
            <div className="mx-auto w-full max-w-4xl">
              <article className="rounded-[1.75rem] border border-border-base/70 bg-surface-base/90 p-5 shadow-[0_1px_0_rgba(15,23,42,0.04),0_16px_40px_rgba(15,23,42,0.06)] md:p-6">
                <div className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-border-base/70 pb-4">
                  <div className="space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-[0.22em] text-foreground-secondary">
                      Focused File
                    </div>
                    <h2 className="text-2xl font-semibold tracking-tight text-foreground-strong [text-wrap:balance]">
                      {selectedFile.title}
                    </h2>
                    <div className="text-sm leading-6 text-foreground-secondary">
                      {selectedFile.sectionTitle}
                      {selectedFile.nestedPathLabel
                        ? ` • ${selectedFile.nestedPathLabel}`
                        : ''}
                    </div>
                  </div>

                  <div className="text-right text-xs text-foreground-secondary">
                    <div className="font-medium text-foreground-primary">{selectedFile.path}</div>
                    <div className="mt-1 tabular-nums">
                      {formatMetric(selectedFile.wordCount, 'word')}
                    </div>
                  </div>
                </div>

                {selectedFile.review ? (
                  <WritingChangeReviewCard
                    filePath={selectedFile.path}
                    fileTitle={selectedFile.title}
                    review={selectedFile.review}
                  />
                ) : (
                  <Streamdown
                    plugins={streamdownPlugins}
                    controls={false}
                    isAnimating={false}
                    mode="static"
                    remarkPlugins={[inlineCitationRemarkPlugin]}
                    components={streamdownStaticComponents}
                    className="chat-streamdown min-w-0 max-w-none break-words antialiased [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                  >
                    {selectedFile.content || '\u00a0'}
                  </Streamdown>
                )}
              </article>
            </div>
          ) : (
            <div className="flex h-full min-h-[240px] items-center justify-center">
              <div className="max-w-sm text-center text-sm leading-6 text-foreground-secondary">
                Create or accept markdown files to preview the manuscript.
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
