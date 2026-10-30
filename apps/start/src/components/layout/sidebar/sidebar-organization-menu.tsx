import { authClient } from '@/lib/frontend/auth/auth-client'
import { useActiveOrganization } from '@/lib/frontend/auth/active-organization'
import { useAppAuth } from '@/lib/frontend/auth/use-auth'
import { waitForPageSettled } from '@/lib/frontend/performance/page-settled'
import { isAdminRole } from '@/lib/shared/auth/roles'
import { ORG_SETTINGS_HREF } from '@/routes/(app)/_layout/organization/settings/-organization-settings-nav'
import { Avatar, AvatarFallback, AvatarImage } from '@rift/ui/avatar'
import { Button } from '@rift/ui/button'
import { FormDialog } from '@rift/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@rift/ui/dropdown-menu'
import { Input } from '@rift/ui/input'
import { Label } from '@rift/ui/label'
import { SidebarGroupTooltip } from '@rift/ui/tooltip'
import { useDirection } from '@rift/ui/direction'
import { Check, Plus, Settings } from 'lucide-react'
import { useNavigate, Link, useLocation } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import type { ComponentType } from 'react'
import { m } from '@/paraglide/messages.js'

type SidebarOrganization = {
  id: string
  name: string
  logo?: string | null
}

type SidebarOrganizationMenuProps = {
  isOrgAreaActive: boolean
}

const MAX_ORGANIZATIONS_PER_USER = 10
let sidebarOrganizationBillingSummaryModulePromise:
  | Promise<ComponentType>
  | undefined

function loadSidebarOrganizationBillingSummary() {
  sidebarOrganizationBillingSummaryModulePromise ??=
    import('./sidebar-organization-billing-summary').then(
      ({ SidebarOrganizationBillingSummary }) =>
        SidebarOrganizationBillingSummary,
    )

  return sidebarOrganizationBillingSummaryModulePromise
}

/**
 * Organization avatar trigger + management menu for the icon rail.
 * The menu centralizes org switching, org creation, and admin settings access.
 */
export function SidebarOrganizationMenu({
  isOrgAreaActive,
}: SidebarOrganizationMenuProps) {
  const {
    user,
    isAnonymous,
    activeOrganizationId,
    activeOrganizationRole,
    refetchSession,
  } = useAppAuth()
  const { activeOrganization, loading: activeOrganizationLoading } =
    useActiveOrganization()
  const navigate = useNavigate()
  const location = useLocation()
  const direction = useDirection()
  const [OrganizationBillingSummary, setOrganizationBillingSummary] =
    useState<ComponentType | null>(null)
  const [organizations, setOrganizations] = useState<SidebarOrganization[]>([])
  const [organizationsLoading, setOrganizationsLoading] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [switchingOrganizationId, setSwitchingOrganizationId] = useState<
    string | null
  >(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [createOrganizationName, setCreateOrganizationName] = useState('')
  const [createOrganizationError, setCreateOrganizationError] = useState<
    string | null
  >(null)
  const [creatingOrganization, setCreatingOrganization] = useState(false)
  const canManageOrganizationSettings = isAdminRole(
    activeOrganizationRole ?? '',
  )

  const organizationFallbackName = isAnonymous
    ? '?'
    : (activeOrganization?.name ?? undefined)
  const organizationFallbackSeed = isAnonymous
    ? 'sidebar-anonymous-organization'
    : undefined
  const showOrganizationFallback =
    !activeOrganizationLoading &&
    (isAnonymous || (!activeOrganization?.logo && !!activeOrganization))

  const loadOrganizations = useCallback(async () => {
    if (!user?.id || isAnonymous) {
      setOrganizations([])
      setOrganizationsLoading(false)
      return
    }

    setOrganizationsLoading(true)
    try {
      const { data, error } = await authClient.organization.list()
      if (error || !data) {
        setOrganizations([])
        return
      }

      setOrganizations(
        data.map((organization) => ({
          id: organization.id,
          name: organization.name,
          logo: organization.logo ?? null,
        })),
      )
    } finally {
      setOrganizationsLoading(false)
    }
  }, [user?.id, isAnonymous])

  useEffect(() => {
    void loadOrganizations()
  }, [loadOrganizations])

  useEffect(() => {
    if (OrganizationBillingSummary) {
      return
    }

    let cancelled = false

    const loadSummary = async () => {
      const SummaryComponent = await loadSidebarOrganizationBillingSummary()
      if (cancelled) {
        return
      }

      setOrganizationBillingSummary(() => SummaryComponent)
    }

    if (isMenuOpen) {
      void loadSummary()
      return () => {
        cancelled = true
      }
    }

    void waitForPageSettled().then(() => {
      if (cancelled) {
        return
      }

      void loadSummary()
    })

    return () => {
      cancelled = true
    }
  }, [OrganizationBillingSummary, isMenuOpen])

  /**
   * Applies org switch in auth session first, then refreshes the shell session
   * cache so all org-scoped data and routes react to the new organization.
   */
  const handleSwitchOrganization = async (organizationId: string) => {
    if (organizationId === activeOrganizationId || switchingOrganizationId) {
      return
    }

    setSwitchingOrganizationId(organizationId)
    try {
      const { error } = await authClient.organization.setActive({
        organizationId,
      })
      if (!error) {
        await refetchSession()
        await loadOrganizations()
        setIsMenuOpen(false)
        if (location.pathname.startsWith('/chat/')) {
          await navigate({ to: '/chat' })
        }
      }
    } finally {
      setSwitchingOrganizationId(null)
    }
  }

  const resetCreateOrganizationDialog = useCallback(() => {
    setCreateOrganizationName('')
    setCreateOrganizationError(null)
  }, [])

  /**
   * Creates a new organization from the dialog and activates it immediately so
   * the user can continue in the newly created organization context.
   */
  const handleCreateOrganizationSubmit = async () => {
    if (creatingOrganization) {
      return
    }

    /**
     * Frontend guard mirrors backend auth enforcement so stale UI state cannot
     * enqueue another create request once the user already reached the cap.
     */
    if (organizations.length >= MAX_ORGANIZATIONS_PER_USER) {
      setCreateOrganizationError(
        m.layout_organization_create_error_limit({
          max: MAX_ORGANIZATIONS_PER_USER,
        }),
      )
      return
    }

    const trimmedName = createOrganizationName.trim()
    if (!trimmedName) {
      setCreateOrganizationError(
        m.layout_organization_create_error_name_required(),
      )
      return
    }

    setCreateOrganizationError(null)
    setCreatingOrganization(true)
    try {
      const uniqueSlug = `organization-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 8)}`
      const { data, error } = await authClient.organization.create({
        name: trimmedName,
        slug: uniqueSlug,
      })

      if (error) {
        setCreateOrganizationError(
          error.message ?? m.layout_organization_create_error_failed(),
        )
        return
      }

      const createdOrganizationId =
        (data as { id?: string } | undefined)?.id ?? null

      if (createdOrganizationId) {
        const setActiveResult = await authClient.organization.setActive({
          organizationId: createdOrganizationId,
        })
        if (!setActiveResult.error) {
          await refetchSession()
          setIsMenuOpen(false)
          setIsCreateDialogOpen(false)
          resetCreateOrganizationDialog()
        } else {
          setCreateOrganizationError(
            setActiveResult.error.message ??
              m.layout_organization_create_error_activate_failed(),
          )
        }
      } else {
        setCreateOrganizationError(
          m.layout_organization_create_error_missing_id(),
        )
      }

      await loadOrganizations()
    } finally {
      setCreatingOrganization(false)
    }
  }

  const handleCreateDialogOpenChange = useCallback(
    (open: boolean) => {
      setIsCreateDialogOpen(open)
      if (!open && !creatingOrganization) {
        resetCreateOrganizationDialog()
      }
    },
    [creatingOrganization, resetCreateOrganizationDialog],
  )

  const createOrganizationNameTrimmed = createOrganizationName.trim()
  const hasReachedOrganizationLimit =
    organizations.length >= MAX_ORGANIZATIONS_PER_USER
  const createOrganizationSubmitDisabled =
    creatingOrganization ||
    createOrganizationNameTrimmed.length === 0 ||
    hasReachedOrganizationLimit

  return (
    <>
      <SidebarGroupTooltip
        name={activeOrganization?.name ?? m.layout_organization_tooltip_name()}
        description={m.layout_organization_tooltip_description()}
      >
        {isAnonymous ? (
          <Button
            asChild
            variant="sidebarIcon"
            size="iconSidebar"
            data-active={isOrgAreaActive}
          >
            <Link
              to="/auth/sign-up"
              preload="intent"
              aria-label={m.layout_organization_settings_aria_label()}
            >
              <Avatar size="xs">
                {activeOrganization?.logo ? (
                  <AvatarImage
                    src={activeOrganization.logo}
                    alt={
                      activeOrganization.name ??
                      m.layout_organization_tooltip_name()
                    }
                  />
                ) : null}
                {showOrganizationFallback ? (
                  <AvatarFallback
                    name={organizationFallbackName}
                    seed={organizationFallbackSeed}
                  />
                ) : null}
              </Avatar>
            </Link>
          </Button>
        ) : (
          <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="sidebarIcon"
                  size="iconSidebar"
                  data-active={isOrgAreaActive}
                  aria-label={m.layout_organization_settings_aria_label()}
                >
                  <Avatar size="xs">
                    {activeOrganization?.logo ? (
                      <AvatarImage
                        src={activeOrganization.logo}
                        alt={
                          activeOrganization.name ??
                          m.layout_organization_tooltip_name()
                        }
                      />
                    ) : null}
                    {showOrganizationFallback ? (
                      <AvatarFallback
                        name={organizationFallbackName}
                        seed={organizationFallbackSeed}
                      />
                    ) : null}
                  </Avatar>
                </Button>
              }
            />
            <DropdownMenuContent
              align="start"
              side={direction === 'rtl' ? 'left' : 'right'}
              sideOffset={10}
              className="w-72 min-w-72 rounded-xl border border-border-base bg-surface-base p-0"
            >
              <div className="flex items-start gap-3 px-4 py-3">
                <Avatar size="xs">
                  {activeOrganization?.logo ? (
                    <AvatarImage
                      src={activeOrganization.logo}
                      alt={
                        activeOrganization.name ??
                        m.layout_organization_tooltip_name()
                      }
                    />
                  ) : null}
                  <AvatarFallback
                    name={organizationFallbackName}
                    seed={organizationFallbackSeed}
                  />
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-base font-medium text-foreground-primary">
                    {activeOrganization?.name ??
                      m.layout_organization_tooltip_name()}
                  </p>
                  <p className="text-sm text-foreground-secondary">
                    {OrganizationBillingSummary ? (
                      <OrganizationBillingSummary />
                    ) : null}
                  </p>
                </div>
              </div>

              {canManageOrganizationSettings ? (
                <div className="px-4 pb-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="default"
                    className="h-8 w-full justify-center rounded-md border border-border-base px-2 text-sm"
                    onClick={() => {
                      void navigate({ to: ORG_SETTINGS_HREF })
                      setIsMenuOpen(false)
                    }}
                  >
                    <Settings className="size-4" aria-hidden />
                    {m.layout_organization_settings_aria_label()}
                  </Button>
                </div>
              ) : null}

              <DropdownMenuSeparator className="mx-0 my-0" />
              <div className="px-4 pt-3 pb-1 text-sm font-medium text-foreground-secondary">
                {m.layout_organization_menu_list_title()}
              </div>

              <div className="px-2 pb-2">
                {organizationsLoading ? (
                  <DropdownMenuItem disabled>
                    {m.layout_organization_menu_loading()}
                  </DropdownMenuItem>
                ) : organizations.length === 0 ? (
                  <DropdownMenuItem disabled>
                    {m.layout_organization_menu_empty()}
                  </DropdownMenuItem>
                ) : (
                  organizations.map((organization) => {
                    const isCurrent = organization.id === activeOrganizationId
                    const isSwitching =
                      organization.id === switchingOrganizationId
                    return (
                      <DropdownMenuItem
                        key={organization.id}
                        className="mb-0.5 flex min-h-8 items-center justify-between rounded-md px-2 py-1.5 data-[highlighted]:bg-surface-overlay"
                        disabled={!!switchingOrganizationId}
                        onClick={() => {
                          void handleSwitchOrganization(organization.id)
                        }}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <Avatar size="xs" className="size-5">
                            {organization.logo ? (
                              <AvatarImage
                                src={organization.logo}
                                alt={organization.name}
                              />
                            ) : null}
                            <AvatarFallback name={organization.name} />
                          </Avatar>
                          <span className="truncate text-sm text-foreground-primary">
                            {organization.name}
                          </span>
                        </div>
                        {isSwitching ? (
                          <span className="text-xs text-foreground-secondary">
                            {m.layout_organization_menu_switching()}
                          </span>
                        ) : isCurrent ? (
                          <Check
                            className="size-4 text-foreground-primary"
                            aria-hidden
                          />
                        ) : null}
                      </DropdownMenuItem>
                    )
                  })
                )}

                <DropdownMenuItem
                  className="mt-1 flex min-h-8 items-center rounded-md px-2 py-1.5 data-[highlighted]:bg-surface-overlay"
                  disabled={creatingOrganization || hasReachedOrganizationLimit}
                  onClick={() => {
                    if (hasReachedOrganizationLimit) {
                      return
                    }
                    resetCreateOrganizationDialog()
                    setIsMenuOpen(false)
                    setIsCreateDialogOpen(true)
                  }}
                >
                  <div className="flex min-w-0 items-center gap-2 rtl:flex-row-reverse">
                    <span className="flex size-7 shrink-0 items-center justify-center">
                      <Plus className="size-3.5" aria-hidden />
                    </span>
                    <span className="truncate text-sm text-foreground-primary">
                      {m.layout_organization_create_action()}
                    </span>
                  </div>
                </DropdownMenuItem>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </SidebarGroupTooltip>
      <FormDialog
        open={isCreateDialogOpen}
        onOpenChange={handleCreateDialogOpenChange}
        title={m.layout_organization_create_title()}
        description={m.layout_organization_create_description()}
        buttonText={m.layout_organization_create_action()}
        secondaryButtonText={m.common_cancel()}
        onSecondaryClick={() => {
          handleCreateDialogOpenChange(false)
        }}
        submitButtonDisabled={createOrganizationSubmitDisabled}
        secondaryButtonDisabled={creatingOrganization}
        error={createOrganizationError ?? undefined}
        handleSubmit={handleCreateOrganizationSubmit}
      >
        <div className="space-y-2">
          <Label htmlFor="create-organization-name">
            {m.layout_organization_create_name_label()}
          </Label>
          <Input
            id="create-organization-name"
            value={createOrganizationName}
            onChange={(event) => {
              setCreateOrganizationName(event.target.value)
              setCreateOrganizationError(null)
            }}
            placeholder={m.layout_organization_create_name_placeholder()}
            maxLength={50}
            disabled={creatingOrganization}
          />
        </div>
      </FormDialog>
    </>
  )
}
