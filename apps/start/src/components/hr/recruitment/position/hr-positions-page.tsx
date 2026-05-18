'use client'

import { useMemo, useState } from 'react'
import { Input } from '@rift/ui/input'
import { cn } from '@rift/utils'
import Search from 'lucide-react/dist/esm/icons/search'
import { ContentPage } from '@/components/layout'
import { HrStatCard } from '@/components/hr/home/hr-stat-card'
import { HrCreatePositionDialog } from './hr-create-position-dialog'
import { HrPositionRow } from './hr-position-row'
import {
  POSITION_STATUS_FILTERS,
  useHrPositionsViewModel,
} from './hr-positions.logic'
import type { HrPosition, HrPositionFilterValue } from './hr-positions.logic'

export function HrPositionsPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<HrPositionFilterValue>('all')
  const { stats, positions } = useHrPositionsViewModel({
    archiveFilter: statusFilter === 'archived' ? 'archived' : 'active',
  })

  const filteredPositions = useMemo<readonly HrPosition[]>(() => {
    const query = search.trim().toLowerCase()
    return positions.filter((position) => {
      // Archive is an orthogonal visibility flag, so the Archived tab is based
      // on `archivedAt` while the other tabs filter by lifecycle status.
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'archived'
          ? position.archivedAt !== null
          : position.status === statusFilter)
      if (!matchesStatus) return false
      if (query.length === 0) return true
      return (
        position.title.toLowerCase().includes(query) ||
        position.department.toLowerCase().includes(query) ||
        position.location.toLowerCase().includes(query) ||
        position.hiringManager.toLowerCase().includes(query)
      )
    })
  }, [positions, search, statusFilter])

  return (
    <ContentPage
      title="Open positions"
      description="Track every role your team is hiring for, from draft to filled."
    >
      <div className="rounded-2xl border border-border-base bg-surface-strong/60 p-1.5">
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <HrStatCard
              key={stat.id}
              label={stat.label}
              value={stat.value}
              suffix={stat.suffix}
              icon={stat.icon}
            />
          ))}
        </div>
      </div>

      <section
        className="flex flex-col overflow-hidden rounded-xl border border-border-base bg-surface-raised shadow-[0_1px_0_0_rgb(0_0_0_/_0.02)]"
        aria-label="Open positions"
      >
        <header className="flex flex-col gap-3 border-b border-border-light px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-medium text-foreground-strong">
              Positions
            </h2>
            <p className="text-xs text-foreground-tertiary">
              {filteredPositions.length} of {positions.length} shown
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-foreground-tertiary"
              />
              <Input
                type="search"
                placeholder="Search positions"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-9 w-full pl-8 sm:w-64"
                aria-label="Search positions"
              />
            </div>
            <HrCreatePositionDialog />
          </div>
        </header>

        <div
          role="tablist"
          aria-label="Filter positions by status"
          className="flex flex-wrap items-center gap-1 border-b border-border-light bg-surface-overlay px-2 py-1.5"
        >
          {POSITION_STATUS_FILTERS.map((filter) => {
            const isActive = statusFilter === filter.value
            return (
              <button
                key={filter.value}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setStatusFilter(filter.value)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  isActive
                    ? 'bg-surface-base text-foreground-strong shadow-[0_1px_0_0_rgb(0_0_0_/_0.04)]'
                    : 'text-foreground-tertiary hover:bg-surface-inverse/5 hover:text-foreground-primary',
                )}
              >
                {filter.label}
              </button>
            )
          })}
        </div>

        {filteredPositions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1 px-4 py-12 text-center">
            <p className="text-sm font-medium text-foreground-strong">
              No positions match those filters.
            </p>
            <p className="text-xs text-foreground-tertiary">
              Try clearing the search or switching to “All”.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border-light">
            {filteredPositions.map((position) => (
              <li key={position.id}>
                <HrPositionRow position={position} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </ContentPage>
  )
}
