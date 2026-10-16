import { Link, useMatch, useRouterState } from '@tanstack/react-router'
import { buttonVariants } from '@rift/ui/button'
import { cn } from '@rift/utils'
import {
  Building2,
  CircleAlert,
  CreditCard,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  UserRoundCog,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { SingularityDirectorySearch } from '../shared/singularity-search'
import {
  getSingularityQueueCounts,
  getSingularitySidebarSelection,
} from './singularity-sidebar.logic'

function SidebarLink({
  to,
  search,
  label,
  icon: Icon,
  active,
  count,
}: {
  to: '/singularity' | '/singularity/users'
  search?: SingularityDirectorySearch
  label: string
  icon: LucideIcon
  active: boolean
  count?: number
}) {
  return (
    <Link
      to={to}
      search={search ?? { health: undefined }}
      activeOptions={{ exact: true, explicitUndefined: true }}
      preload="intent"
      aria-current={active ? 'page' : undefined}
      data-active={active}
      className={cn(
        buttonVariants({ variant: 'sidebarNavItem', size: 'sidebarNavItem' }),
        'min-h-10 gap-2',
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <Icon className="size-4 shrink-0" aria-hidden />
        <span className="truncate">{label}</span>
      </span>
      {count != null && (
        <span
          title={`${count} workspace${count === 1 ? '' : 's'}`}
          className="min-w-5 rounded-md bg-surface-inverse/5 px-1.5 py-0.5 text-center text-[11px] tabular-nums text-foreground-tertiary"
        >
          {count}
        </span>
      )}
    </Link>
  )
}

/** Counts reuse the parent route snapshot, so sidebar navigation adds no requests. */
export function SingularitySidebar({ pathname }: { pathname: string }) {
  const organizations =
    useMatch({
      from: '/(ee)/singularity/_layout',
      shouldThrow: false,
      select: (match) => match.loaderData?.organizations,
    }) ?? []
  const search = useRouterState({ select: (state) => state.location.search })
  const selected = getSingularitySidebarSelection(pathname, search)
  const counts = getSingularityQueueCounts(organizations)
  return (
    <div className="flex min-h-0 flex-1 flex-col pr-3">
      <header className="shrink-0 px-3 py-2">
        <h2 className="text-lg font-semibold text-foreground-strong">
          Singularity
        </h2>
        <p className="mt-1 text-xs text-foreground-tertiary">
          Workspace administration
        </p>
      </header>
      <nav
        aria-label="Singularity navigation"
        className="mt-5 min-h-0 flex-1 space-y-7 overflow-y-auto"
      >
        <div className="space-y-1">
          <p className="px-3 pb-1 text-xs font-medium text-foreground-tertiary">
            Directory
          </p>
          <SidebarLink
            to="/singularity"
            label="Organizations"
            icon={Building2}
            active={selected === 'organizations'}
            count={organizations.length}
          />
          <SidebarLink
            to="/singularity/users"
            label="Users"
            icon={Users}
            active={selected === 'users'}
          />
        </div>
        <div className="space-y-1">
          <p className="px-3 pb-1 text-xs font-medium text-foreground-tertiary">
            Attention queues
          </p>
          <SidebarLink
            to="/singularity"
            search={{ health: 'attention', sort: 'attention' }}
            label="All issues"
            icon={CircleAlert}
            active={selected === 'attention'}
            count={counts.attention}
          />
          <SidebarLink
            to="/singularity"
            search={{ health: 'seats' }}
            label="Seat capacity"
            icon={Users}
            active={selected === 'seats'}
            count={counts.seats}
          />
          <SidebarLink
            to="/singularity"
            search={{ health: 'access' }}
            label="Restricted access"
            icon={KeyRound}
            active={selected === 'access'}
            count={counts.access}
          />
          <SidebarLink
            to="/singularity"
            search={{ health: 'billing' }}
            label="Billing issues"
            icon={CreditCard}
            active={selected === 'billing'}
            count={counts.billing}
          />
          <SidebarLink
            to="/singularity"
            search={{ health: 'sync' }}
            label="Quota sync"
            icon={RefreshCw}
            active={selected === 'sync'}
            count={counts.sync}
          />
        </div>
      </nav>
      <footer className="mt-5 shrink-0 space-y-3 border-t border-border-base pt-3">
        <Link
          to="/settings"
          className={cn(
            buttonVariants({
              variant: 'sidebarNavItem',
              size: 'sidebarNavItem',
            }),
            'min-h-10 justify-start gap-2',
          )}
        >
          <UserRoundCog className="size-4" aria-hidden />
          Your account
        </Link>
        <p className="flex items-center gap-2 px-3 text-[11px] text-foreground-tertiary">
          <ShieldCheck className="size-3.5 shrink-0" aria-hidden />
          Global workspace administration
        </p>
      </footer>
    </div>
  )
}
