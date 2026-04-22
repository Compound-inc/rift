'use client'

import type { LucideIcon } from 'lucide-react'
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  FilePenLine,
  Folder,
  Search,
  Wrench,
} from 'lucide-react'
import { cn } from '@rift/utils'

export type WritingToolCallLineModel = {
  readonly toolCallId: string
  readonly toolName: string
  readonly args: Record<string, unknown>
  readonly status: 'running' | 'completed'
  readonly isError: boolean
}

function resolveTarget(args: Record<string, unknown>): string | undefined {
  const value =
    (typeof args.path === 'string' && args.path) ||
    (typeof args.pattern === 'string' && args.pattern) ||
    (typeof args.query === 'string' && args.query) ||
    (typeof args.file === 'string' && args.file) ||
    (typeof args.dir === 'string' && args.dir) ||
    (typeof args.directory === 'string' && args.directory)

  return value || undefined
}

function resolveTitle(toolName: string): string {
  const normalized = toolName.toLowerCase()
  if (normalized.includes('read') || normalized.includes('view')) {
    return 'Viewed file'
  }
  if (normalized.includes('edit') || normalized.includes('write') || normalized.includes('patch')) {
    return 'Edited file'
  }
  if (normalized.includes('search') || normalized.includes('find') || normalized.includes('grep')) {
    return 'Searched workspace'
  }
  if (normalized.includes('dir') || normalized.includes('folder') || normalized.includes('ls')) {
    return 'Viewed folder'
  }
  return toolName
    .split(/[_-]/g)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}

function getToolIcon(toolCall: WritingToolCallLineModel): LucideIcon {
  const normalized = toolCall.toolName.toLowerCase()

  if (toolCall.isError) return AlertCircle
  if (toolCall.status === 'completed') return CheckCircle2
  if (normalized.includes('read') || normalized.includes('view')) return Eye
  if (normalized.includes('edit') || normalized.includes('write') || normalized.includes('patch')) {
    return FilePenLine
  }
  if (normalized.includes('dir') || normalized.includes('folder') || normalized.includes('ls')) {
    return Folder
  }
  if (normalized.includes('search') || normalized.includes('find') || normalized.includes('grep')) {
    return Search
  }
  return Wrench
}

export function WritingToolCallLine({
  toolCall,
}: {
  readonly toolCall: WritingToolCallLineModel
}) {
  const Icon = getToolIcon(toolCall)
  const title = resolveTitle(toolCall.toolName)
  const target = resolveTarget(toolCall.args)

  return (
    <div
      className={cn(
        'flex min-w-0 items-center gap-2 rounded-xl px-2 py-1.5 text-sm',
        toolCall.isError ? 'text-danger-foreground' : 'text-foreground-secondary',
      )}
    >
      <Icon
        className={cn(
          'size-4 shrink-0',
          toolCall.isError ? 'text-danger-foreground' : 'text-foreground-tertiary',
        )}
        aria-hidden
      />
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 leading-6">
        <span className="font-medium text-foreground-primary">{title}</span>
        {target ? (
          <code className="truncate rounded-md bg-surface-base/65 px-1.5 py-0.5 text-[12px] text-foreground-secondary">
            {target}
          </code>
        ) : null}
        <span className="text-[12px] text-foreground-tertiary">
          {toolCall.status === 'running'
            ? 'Running'
            : toolCall.isError
              ? 'Failed'
              : 'Done'}
        </span>
      </div>
    </div>
  )
}
