'use client'

import { cn } from '@rift/utils'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@rift/ui/table'
import type { HrCandidateRow } from './hr-home-page.logic'
import { resolveCandidateStatusPresentation } from './hr-home-page.logic'

export function HrCandidatesTable({
  rows,
  title = 'Recent candidate activity',
  className,
}: {
  rows: readonly HrCandidateRow[]
  title?: string
  className?: string
}) {
  return (
    <section
      className={cn(
        'flex flex-col overflow-hidden rounded-xl border border-border-base bg-surface-raised shadow-[0_1px_0_0_rgb(0_0_0_/_0.02)]',
        className,
      )}
      aria-label={title}
    >
      <header className="border-b border-border-light px-4 py-3">
        <h2 className="text-sm font-medium text-foreground-strong">{title}</h2>
      </header>

      <Table className="text-sm">
        <TableHeader>
          <TableRow className="border-border-light bg-surface-overlay hover:bg-surface-overlay">
            <TableHead className="bg-transparent px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-foreground-tertiary">
              Candidate
            </TableHead>
            <TableHead className="bg-transparent px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-foreground-tertiary">
              Applied
            </TableHead>
            <TableHead className="bg-transparent px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-foreground-tertiary">
              Status
            </TableHead>
            <TableHead className="bg-transparent px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wide text-foreground-tertiary">
              Offer value
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const status = resolveCandidateStatusPresentation(row.status)
            const StatusIcon = status.icon

            return (
              <TableRow key={row.id} className="border-border-light">
                <TableCell className="px-4 py-3">
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground-strong">
                      {row.name}
                    </span>
                    <span className="text-xs text-foreground-tertiary">
                      {row.role}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="px-4 py-3 text-foreground-primary">
                  {row.appliedAt}
                </TableCell>
                <TableCell className="px-4 py-3">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 font-medium',
                      status.className,
                    )}
                  >
                    <StatusIcon aria-hidden className="size-4" />
                    {status.label}
                  </span>
                </TableCell>
                <TableCell className="px-4 py-3 text-right font-medium tabular-nums text-foreground-strong">
                  {row.value ?? (
                    <span
                      aria-label="Not applicable"
                      className="text-foreground-tertiary"
                    >
                      —
                    </span>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </section>
  )
}
