'use client'

import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { Form } from '@rift/ui/form'
import { getProviderIcon } from '@/lib/ai-catalog'
import type { CatalogProviderId } from '@/lib/ai-catalog/provider-tools'
import type { WorkspaceFeatureAccessState } from '@/lib/billing/plan-catalog'
import { getFeatureAccessFormProps } from '@/components/organization/settings/feature-access-form-helpers'
import { PROVIDER_META, PROVIDER_NAMES } from './provider-constants'
import type { PolicyPayload } from './types'
import type { useProviderPolicy } from './use-provider-policy'
import { m } from '@/paraglide/messages.js'

type ProviderControlsSectionProps = {
  payload: PolicyPayload
  updating: boolean
  update: ReturnType<typeof useProviderPolicy>['update']
  featureAccess?: WorkspaceFeatureAccessState & { loading: boolean }
}

/**
 * Provider controls section: Form card with toggle section (same layout as the
 * debug-auth "Demo form with toggle section"). Each row shows provider icon and
 * name on the left, toggle on the right; no description or enable/disable label.
 */
export function ProviderControlsSection({
  payload,
  updating,
  update,
  featureAccess,
}: ProviderControlsSectionProps) {
  const featureEnabled = featureAccess?.allowed ?? true
  const handleToggle = React.useCallback(
    (providerId: string, disabled: boolean) => {
      void update({
        action: 'toggle_provider',
        providerId,
        disabled,
      })
    },
    [update],
  )

  return (
    <Form
      title={m.org_provider_controls_title()}
      description={m.org_provider_controls_description()}
      {...getFeatureAccessFormProps({
        enabled: featureEnabled,
        featureAccess,
        defaultHelpText: m.org_provider_controls_help(),
      })}
      toggleSection={{
        rowHover: true,
        items: payload.providers.map((provider) => {
          const ProviderIcon = getProviderIcon(
            provider.id as CatalogProviderId,
          )
          const name = PROVIDER_NAMES[provider.id] ?? provider.id
          const meta = PROVIDER_META[provider.id]
          return {
            id: provider.id,
            title: name,
            icon: ProviderIcon ? (
              <ProviderIcon className="size-5 text-foreground-primary" />
            ) : (
              <div className="size-5 rounded-full bg-surface-inverse" />
            ),
            description: meta?.description ?? '',
            actionSlot: (
              <Link
                to="/organization/settings/models/$providerId"
                params={{ providerId: provider.id }}
                className="inline-flex items-center gap-1 text-sm font-medium text-accent-primary underline underline-offset-2 hover:text-accent-primary/80"
                aria-label={m.org_provider_controls_view_all_models_for_provider_aria_label({ providerName: name })}
              >
                {m.org_provider_controls_view_all_models()}
              </Link>
            ),
            checked: !provider.disabled,
            onCheckedChange: (enabled) =>
              handleToggle(provider.id, !enabled),
            disabled: updating || !featureEnabled,
          }
        }),
      }}
    />
  )
}
