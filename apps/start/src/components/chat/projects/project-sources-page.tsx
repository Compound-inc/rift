// Project Sources page for `/chat/projects/$projectId/sources`.
//
// Visual layout mirrors the organization knowledge admin page so both
// surfaces feel like one product (DataTable with file/status/last-indexed
// columns, identical pill semantics).
//
// The empty state intentionally diverges into a marketing-grade onboarding
// composition: three sample row previews stacked in a faux carousel
// (center sharp, sides faded and blurred) above a heading, supporting
// copy, and a primary CTA. The blur on the side previews is purposeful,
// not decorative glass: it communicates "these are illustrative, not
// real items" without leaning on text labels.
//
'use client'

import { useMemo, useRef } from 'react'
import { useQuery } from '@rocicorp/zero/react'
import { Button } from '@rift/ui/button'
import { Badge } from '@rift/ui/badge'
import { DataTable } from '@rift/ui/data-table'
import type { DataTableColumnDef } from '@rift/ui/data-table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@rift/ui/dropdown-menu'
import { cn } from '@rift/utils'
import FileText from 'lucide-react/dist/esm/icons/file-text'
import FileSpreadsheet from 'lucide-react/dist/esm/icons/file-spreadsheet'
import FileType from 'lucide-react/dist/esm/icons/file-type'
import MoreVertical from 'lucide-react/dist/esm/icons/more-vertical'
import Plus from 'lucide-react/dist/esm/icons/plus'
import { toast } from 'sonner'

import { ContentPage } from '@/components/layout'
import { queries } from '@/integrations/zero'
import { useProjectSources } from '@/lib/frontend/project-sources/use-project-sources'
import {
  PROJECT_SOURCES_UPLOAD_ACCEPT,
  summarizeProjectSourceIndexError,
} from '@/lib/shared/project-sources'
import {
  PROJECT_SOURCES_UPLOAD_POLICY,
  getUploadValidationError,
} from '@/lib/shared/upload/upload-validation'
import { m } from '@/paraglide/messages.js'

/** Row shape consumed by the DataTable. Keeps the page agnostic of the
 *  full attachment schema and easy to evolve once project upload lands. */
type ProjectSourceRow = {
  readonly id: string
  readonly fileName: string
  readonly mimeType: string
  readonly fileSize: number
  readonly embeddingStatus?: string
  readonly vectorIndexedAt?: number
  readonly vectorError?: string
  readonly updatedAt: number
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} ${m.chat_project_sources_unit_mb()}`
  if (bytes >= 1024)
    return `${Math.round(bytes / 1024)} ${m.chat_project_sources_unit_kb()}`
  return `${bytes} ${m.chat_project_sources_unit_b()}`
}

function formatTimestamp(timestamp?: number): string {
  if (!timestamp || timestamp <= 0)
    return m.chat_project_sources_last_indexed_pending()
  return new Date(timestamp).toLocaleString()
}

/** Mirrors the index pill colors from the org-knowledge page so the two
 *  surfaces share one visual language for retrieval state. */
function getIndexBadgeClassName(row: ProjectSourceRow): string {
  if (row.vectorError) {
    return 'border-rose-500/50 bg-rose-500/15 text-rose-700 dark:text-rose-400'
  }
  if (row.vectorIndexedAt) {
    return 'border-sky-500/50 bg-sky-500/15 text-sky-700 dark:text-sky-400'
  }
  return 'border-amber-500/50 bg-amber-500/15 text-amber-700 dark:text-amber-400'
}

function ProjectSourceRowActions({
  item,
  pending,
  onRetryIndex,
  onRemove,
}: {
  item: ProjectSourceRow
  pending: boolean
  onRetryIndex: (attachmentId: string) => Promise<void>
  onRemove: (attachmentId: string) => Promise<void>
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="iconSmall"
            className="size-8 rounded-md"
            aria-label={m.org_knowledge_actions_aria({ name: item.fileName })}
            disabled={pending}
          >
            <MoreVertical className="size-4" aria-hidden />
          </Button>
        }
      />
      <DropdownMenuContent align="end" sideOffset={6} className="min-w-40">
        <DropdownMenuItem onClick={() => void onRetryIndex(item.id)}>
          {m.org_knowledge_action_retry_index()}
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onClick={() => void onRemove(item.id)}
        >
          {m.org_knowledge_action_delete()}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function ProjectSourcesPage({ projectId }: { projectId: string }) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [files, fileResult] = useQuery(
    queries.projects.attachments({ projectId }),
  )
  const { pending, uploading, upload, remove, retryIndex } =
    useProjectSources(projectId)

  const rows = useMemo<readonly ProjectSourceRow[]>(
    () =>
      files.map((file) => ({
        id: file.id,
        fileName: file.fileName,
        mimeType: file.mimeType,
        fileSize: file.fileSize,
        embeddingStatus: file.embeddingStatus ?? undefined,
        vectorIndexedAt: file.vectorIndexedAt ?? undefined,
        vectorError:
          typeof file.vectorError === 'string'
            ? summarizeProjectSourceIndexError(file.vectorError)
            : undefined,
        updatedAt: file.updatedAt,
      })),
    [files],
  )

  const loading = fileResult.type !== 'complete'
  const handleFileSelection = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const selected = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (selected.length === 0) return

    for (const file of selected) {
      const validationError = getUploadValidationError(
        file,
        PROJECT_SOURCES_UPLOAD_POLICY,
      )
      if (validationError) {
        toast.error(validationError)
        return
      }
    }

    await upload(selected)
  }

  const columns = useMemo<Array<DataTableColumnDef<ProjectSourceRow>>>(
    () => [
      {
        accessorKey: 'fileName',
        header: m.chat_project_sources_column_file(),
        cell: ({ row }) => {
          const item = row.original
          return (
            <div className="min-w-0 space-y-1">
              <p className="truncate font-medium text-foreground-primary">
                {item.fileName}
              </p>
              <p className="text-xs text-foreground-tertiary">
                {item.mimeType} · {formatFileSize(item.fileSize)}
              </p>
            </div>
          )
        },
      },
      {
        id: 'status',
        header: m.chat_project_sources_column_status(),
        cell: ({ row }) => {
          const item = row.original
          return (
            <Badge
              variant="outline"
              className={cn(
                'rounded-full px-2 py-0.5',
                getIndexBadgeClassName(item),
              )}
            >
              {item.vectorError
                ? m.chat_project_sources_index_status_error()
                : item.vectorIndexedAt
                  ? m.common_indexed()
                  : m.chat_project_sources_index_status_pending()}
            </Badge>
          )
        },
      },
      {
        id: 'lastIndexed',
        header: m.chat_project_sources_column_last_indexed(),
        cell: ({ row }) => {
          const item = row.original
          return (
            <div className="space-y-1">
              <p className="text-sm text-foreground-primary">
                {formatTimestamp(item.vectorIndexedAt)}
              </p>
              {item.vectorError ? (
                <p className="max-w-72 text-xs text-foreground-error">
                  {item.vectorError}
                </p>
              ) : null}
            </div>
          )
        },
      },
      {
        id: 'actions',
        header: () => null,
        meta: {
          headerClassName: 'w-10 whitespace-nowrap pr-2 text-right',
          cellClassName: 'w-10 whitespace-nowrap pr-2 text-right',
        },
        cell: ({ row }) => (
          <div className="flex justify-end">
            <ProjectSourceRowActions
              item={row.original}
              pending={pending}
              onRetryIndex={retryIndex}
              onRemove={remove}
            />
          </div>
        ),
      },
    ],
    [pending, remove, retryIndex],
  )

  // Loading and populated states reuse the DataTable. Empty + not-loading
  // routes through the onboarding composition below.
  const showEmptyState = !loading && rows.length === 0

  return (
    <ContentPage
      title={m.chat_project_sources_title()}
      description={m.chat_project_sources_description()}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={PROJECT_SOURCES_UPLOAD_ACCEPT}
        className="hidden"
        onChange={(event) => {
          void handleFileSelection(event)
        }}
      />
      {showEmptyState ? (
        <ProjectSourcesEmptyState
          uploading={uploading}
          onAddSource={() => fileInputRef.current?.click()}
        />
      ) : (
        <DataTable
          data={[...rows]}
          isLoading={loading}
          columns={columns}
          filterColumn="fileName"
          filterPlaceholder={m.chat_project_sources_filter_placeholder()}
          showColumnToggle={false}
          messages={{
            noResults: m.chat_project_sources_empty(),
            loading: m.chat_project_sources_loading(),
          }}
          tableWrapperClassName="border-border-base bg-surface-base/95"
          toolbarActionsRight={
            <Button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Plus className="size-4" aria-hidden />
              {uploading
                ? m.chat_project_sources_uploading()
                : m.chat_project_sources_add_button()}
            </Button>
          }
        />
      )}
    </ContentPage>
  )
}

/**
 * Empty state composition. Three sample row previews are stacked in a
 * faux carousel: the center card is sharp and elevated, the flanking
 * cards are scaled down, dimmed, and blurred so they read as preview
 * material, not data. Below the stack live the heading, supporting
 * copy, and the primary CTA.
 */
function ProjectSourcesEmptyState({
  uploading,
  onAddSource,
}: {
  uploading: boolean
  onAddSource: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-10 py-12 text-center sm:py-20">
      <SourcePreviewStack />

      <div className="flex max-w-md flex-col items-center gap-3">
        <h2 className="text-xl font-semibold tracking-tight text-foreground-primary sm:text-2xl">
          {m.chat_project_sources_empty_heading()}
        </h2>
        <p className="text-pretty text-sm leading-relaxed text-foreground-secondary">
          {m.chat_project_sources_empty_description()}
        </p>
      </div>

      <Button type="button" onClick={onAddSource} disabled={uploading}>
        <Plus className="size-4" aria-hidden />
        {uploading
          ? m.chat_project_sources_uploading()
          : m.chat_project_sources_add_button()}
      </Button>
    </div>
  )
}

/**
 * Visual-only preview row used in the empty state cards. Mirrors the
 * shape of a populated DataTable row (icon, name, mime + size, status
 * pill) so users intuit what real entries will look like.
 */
type SamplePreview = {
  readonly Icon: typeof FileText
  readonly iconClassName: string
  readonly fileName: string
  readonly metadata: string
  readonly statusLabel: string
  readonly statusClassName: string
}

const SAMPLE_PREVIEWS: readonly SamplePreview[] = [
  {
    Icon: FileType,
    iconClassName: 'text-sky-600 dark:text-sky-400',
    fileName: 'Brand guidelines.md',
    metadata: `Markdown · 48 ${m.chat_project_sources_unit_kb()}`,
    statusLabel: m.chat_project_sources_status_indexed(),
    statusClassName:
      'border-sky-500/50 bg-sky-500/15 text-sky-700 dark:text-sky-400',
  },
  {
    Icon: FileText,
    iconClassName: 'text-rose-600 dark:text-rose-400',
    fileName: 'Product roadmap.pdf',
    metadata: `PDF · 2.4 ${m.chat_project_sources_unit_mb()}`,
    statusLabel: m.chat_project_sources_status_indexed(),
    statusClassName:
      'border-sky-500/50 bg-sky-500/15 text-sky-700 dark:text-sky-400',
  },
  {
    Icon: FileSpreadsheet,
    iconClassName: 'text-emerald-600 dark:text-emerald-400',
    fileName: 'Customer research.csv',
    metadata: `Spreadsheet · 312 ${m.chat_project_sources_unit_kb()}`,
    statusLabel: m.chat_project_sources_status_pending(),
    statusClassName:
      'border-amber-500/50 bg-amber-500/15 text-amber-700 dark:text-amber-400',
  },
]

function SourcePreviewStack() {
  const [left, center, right] = SAMPLE_PREVIEWS

  return (
    // The flanking previews tuck behind the center card via negative
    // margins; the wrapper is `aria-hidden` because the cards repeat the
    // empty-state intent already conveyed by the heading and description.
    <div
      aria-hidden
      className="relative flex w-full max-w-2xl items-stretch justify-center"
    >
      <SourcePreviewCard preview={left} variant="left" />
      <SourcePreviewCard preview={center} variant="center" />
      <SourcePreviewCard preview={right} variant="right" />
    </div>
  )
}

const VARIANT_CLASSES = {
  left: '-mr-10 -translate-y-1 rotate-[-3deg] scale-95 opacity-40 blur-[1.5px]',
  center: 'z-10 shadow-lg shadow-black/5 dark:shadow-black/30',
  right: '-ml-10 -translate-y-1 rotate-[3deg] scale-95 opacity-40 blur-[1.5px]',
} as const

function SourcePreviewCard({
  preview,
  variant,
}: {
  preview: SamplePreview
  variant: keyof typeof VARIANT_CLASSES
}) {
  const { Icon, iconClassName, fileName, metadata, statusLabel, statusClassName } =
    preview
  return (
    <div
      className={cn(
        'flex w-64 flex-col gap-3 rounded-xl border border-border-base bg-surface-base p-4 text-left',
        VARIANT_CLASSES[variant],
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-strong/60',
            iconClassName,
          )}
        >
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="truncate text-sm font-medium text-foreground-primary">
            {fileName}
          </p>
          <p className="truncate text-xs text-foreground-tertiary">
            {metadata}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs">
        <Badge
          variant="outline"
          className={cn('rounded-full px-2 py-0.5', statusClassName)}
        >
          {statusLabel}
        </Badge>
        <span className="text-foreground-tertiary">
          {m.chat_project_sources_preview_just_now()}
        </span>
      </div>
    </div>
  )
}
