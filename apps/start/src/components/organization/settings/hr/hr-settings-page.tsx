'use client'

/**
 * HR product settings page.
 *
 * Renders one on/off switch per entitled HR addon. The switch is an
 * **org-admin capability** stored at
 * `OrgProductPolicy.capabilities['<addonKey>.enabled']`. Saving toggles
 * that flag; `can('product.hr.<addon>')` picks it up across the sidebar,
 * routes, and any other permission-gated surface.
 *
 * IMPORTANT: this page resolves entitlement state with `canRaw(...)`,
 * NOT `can(...)`. `canRaw` checks the raw entitlement without the org
 * admin capability layer — otherwise the admin would lock themselves
 * out of the kill switch the moment they turned an addon off.
 *
 * See `apps/start/PERMISSIONS.md` for the full model.
 */

import * as React from 'react'
import { Form } from '@rift/ui/form'
import { ContentPage } from '@/components/layout'
import { useOrgProductPolicy } from '@/lib/frontend/organizations/use-org-product-policy'
import { usePermissions } from '@/lib/frontend/permissions/use-permissions'
import { ORG_PRODUCT_ADDON_CATALOG } from '@/lib/shared/org-product-addons'
import {
  productCapabilityKey,
  readOrgProductCapability,
} from '@/lib/shared/org-product-capabilities'
import { EMPTY_ORG_PRODUCT_POLICY } from '@/lib/shared/org-product-policy'
import type { OrgProductAddonKey } from '@/lib/shared/org-product-addons'
import type { OrgProductPolicy } from '@/lib/shared/org-product-policy'

type HrAddonKey = OrgProductAddonKey<'hr'>

function withUpdatedCapabilities(
  policy: OrgProductPolicy,
  updates: Readonly<Record<string, boolean>>,
): OrgProductPolicy {
  return {
    ...policy,
    capabilities: {
      ...policy.capabilities,
      ...updates,
    },
  }
}

export function HrSettingsPage() {
  const { policy, loading, saving, setPolicy } = useOrgProductPolicy('hr')
  const { canRaw } = usePermissions()
  const coreEntitled = canRaw('product.hr.core')
  const recruitmentEntitled = canRaw('product.hr.recruitment')
  const payrollEntitled = canRaw('product.hr.payroll')

  const entitledAddons = React.useMemo<HrAddonKey[]>(() => {
    const result: HrAddonKey[] = []
    if (coreEntitled) result.push('core')
    if (recruitmentEntitled) result.push('recruitment')
    if (payrollEntitled) result.push('payroll')
    return result
  }, [coreEntitled, payrollEntitled, recruitmentEntitled])

  const policyRef = React.useRef(policy ?? EMPTY_ORG_PRODUCT_POLICY)
  React.useEffect(() => {
    policyRef.current = policy ?? EMPTY_ORG_PRODUCT_POLICY
  }, [policy])

  const persistCapability = React.useCallback(
    async (addonKey: HrAddonKey, enabled: boolean) => {
      const key = productCapabilityKey({ addonKey })
      const base = policyRef.current
      const next = withUpdatedCapabilities(base, { [key]: enabled })
      policyRef.current = next
      await setPolicy(next)
    },
    [setPolicy],
  )

  const content = (() => {
    if (loading) {
      return (
        <p className="text-sm text-foreground-secondary">
          Loading HR configuration…
        </p>
      )
    }

    if (entitledAddons.length === 0) {
      return (
        <p className="text-sm text-foreground-secondary">
          No HR addons are currently active for this organization. Contact your
          administrator if you expected addons to be enabled.
        </p>
      )
    }

    return (
      <Form
        title="HR addons"
        description="Turn individual HR addons on or off for this organization. Platform-granted entitlements still apply; this toggle is an additional kill switch."
        toggleSection={{
          items: entitledAddons.map((addonKey) => {
            const definition = ORG_PRODUCT_ADDON_CATALOG.hr.addons[addonKey]
            const capability = readOrgProductCapability({
              policy,
              productKey: 'hr',
              addonKey,
            })
            return {
              id: `hr-${addonKey}-enabled`,
              title: definition.label,
              description: definition.description,
              checked: capability,
              onCheckedChange: (checked: boolean) => {
                void persistCapability(addonKey, checked)
              },
              disabled: saving,
            }
          }),
        }}
      />
    )
  })()

  return (
    <ContentPage
      title="HR"
      description="Enable or disable HR addons for your organization. Platform access is granted separately by the Rift team."
    >
      {content}
    </ContentPage>
  )
}
