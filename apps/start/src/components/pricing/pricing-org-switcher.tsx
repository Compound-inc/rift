'use client'

import { useCallback, useEffect, useState } from 'react'
import { authClient } from '@/lib/frontend/auth/auth-client'
import { useAppAuth } from '@/lib/frontend/auth/use-auth'
import { Avatar, AvatarFallback, AvatarImage } from '@rift/ui/avatar'
import { Button } from '@rift/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@rift/ui/dropdown-menu'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@rift/utils'

type Organization = {
  id: string
  name: string
  logo?: string | null
}

type PricingOrgSwitcherProps = {
  className?: string
}

function PricingOrgSwitcherSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex h-10 min-h-10 w-full items-center justify-between gap-3 rounded-md border border-border-base bg-surface-base px-3 py-2',
        className,
      )}
    >
      <div className="flex items-center gap-2.5">
        <div className="size-7 shrink-0 animate-pulse rounded-full bg-surface-raised" />
        <div className="h-4 w-24 animate-pulse rounded bg-surface-raised" />
      </div>
      <div className="size-4 animate-pulse rounded bg-surface-raised" />
    </div>
  )
}

export function PricingOrgSwitcher({ className }: PricingOrgSwitcherProps) {
  const { user, activeOrganizationId, refetchSession, loading: authLoading } =
    useAppAuth()
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [switchingId, setSwitchingId] = useState<string | null>(null)
  const shouldShowSelector =
    !authLoading && !!user && !loading && organizations.length > 0

  const loadOrganizations = useCallback(async () => {
    if (!user?.id) {
      setOrganizations([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const { data, error } = await authClient.organization.list()
      if (error || !data) {
        setOrganizations([])
        return
      }
      setOrganizations(
        data.map((org) => ({
          id: org.id,
          name: org.name,
          logo: org.logo ?? null,
        })),
      )
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    void loadOrganizations()
  }, [loadOrganizations])

  const activeOrg = organizations.find((org) => org.id === activeOrganizationId)

  const handleSwitch = async (organizationId: string) => {
    if (organizationId === activeOrganizationId || switchingId) return

    setSwitchingId(organizationId)
    try {
      const { error } = await authClient.organization.setActive({
        organizationId,
      })
      if (!error) {
        await refetchSession()
        await loadOrganizations()
        setIsOpen(false)
      }
    } finally {
      setSwitchingId(null)
    }
  }

  if (!shouldShowSelector) {
    return (
      <div className={cn('h-10 min-h-10 w-full', className)} aria-hidden="true">
        <PricingOrgSwitcherSkeleton className="invisible" />
      </div>
    )
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className={cn(
              'h-10 min-h-10 justify-between gap-3 px-3 py-2',
              className,
            )}
            disabled={!!switchingId || loading}
          >
            <div className="flex items-center gap-2.5">
              {loading ? (
                <div className="flex items-center gap-2.5">
                  <div className="size-7 shrink-0 animate-pulse rounded-full bg-surface-raised" />
                  <div className="h-4 w-24 animate-pulse rounded bg-surface-raised" />
                </div>
              ) : (
                <>
                  <Avatar size="sm">
                    {activeOrg?.logo ? (
                      <AvatarImage src={activeOrg.logo} alt={activeOrg.name} />
                    ) : null}
                    <AvatarFallback name={activeOrg?.name ?? 'Organization'} />
                  </Avatar>
                  <span className="text-sm font-medium text-foreground-primary">
                    {activeOrg?.name ?? 'Select organization'}
                  </span>
                </>
              )}
            </div>
            <ChevronDown
              className={cn(
                'size-4 shrink-0 text-foreground-secondary transition-transform',
                isOpen && 'rotate-180',
              )}
              aria-hidden
            />
          </Button>
        }
      />
      <DropdownMenuContent
        align="start"
        sideOffset={8}
        className="w-64 min-w-64 rounded-xl border border-border-light bg-surface-base p-1 text-foreground-primary shadow-lg ring-border-strong/10"
      >
        {loading ? (
          <DropdownMenuItem
            disabled
            className="h-9 rounded-lg px-2 text-sm font-medium text-foreground-secondary focus:bg-surface-inverse/8"
          >
            Loading organizations...
          </DropdownMenuItem>
        ) : organizations.length === 0 ? (
          <DropdownMenuItem
            disabled
            className="h-9 rounded-lg px-2 text-sm font-medium text-foreground-secondary focus:bg-surface-inverse/8"
          >
            No organizations found
          </DropdownMenuItem>
        ) : (
          organizations.map((org) => {
            const isCurrent = org.id === activeOrganizationId
            const isSwitching = org.id === switchingId
            return (
              <DropdownMenuItem
                key={org.id}
                className={cn(
                  'min-h-9 rounded-lg px-2 py-2 text-sm font-medium text-foreground-primary focus:bg-surface-inverse/8 data-[highlighted]:bg-surface-inverse/8',
                  isCurrent && 'bg-surface-inverse/5',
                )}
                disabled={!!switchingId}
                onClick={() => handleSwitch(org.id)}
              >
                <Avatar size="sm">
                  {org.logo ? (
                    <AvatarImage src={org.logo} alt={org.name} />
                  ) : null}
                  <AvatarFallback name={org.name} />
                </Avatar>
                <span className="flex-1 truncate text-sm text-foreground-primary">
                  {org.name}
                </span>
                {isSwitching ? (
                  <span className="text-xs text-foreground-secondary">
                    Switching...
                  </span>
                ) : isCurrent ? (
                  <Check
                    className="size-4 shrink-0 text-foreground-primary"
                    aria-hidden
                  />
                ) : null}
              </DropdownMenuItem>
            )
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
