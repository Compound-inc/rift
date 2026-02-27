'use client'

import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { Form } from '@rift/ui/form'
import { getProviderIcon } from '@/lib/ai-catalog'
import type { CatalogProviderId } from '@/lib/ai-catalog/provider-tools'
import { PROVIDER_META, PROVIDER_NAMES } from './provider-constants'
import type { PolicyPayload } from './types'
import type { useProviderPolicy } from './use-provider-policy'

type ProviderControlsSectionProps = {
  payload: PolicyPayload
  updating: boolean
  update: ReturnType<typeof useProviderPolicy>['update']
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
}: ProviderControlsSectionProps) {
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
      title="Providers"
      description="Enable or disable AI providers for your organization."
      helpText="Changes apply immediately. Disabled providers and their models are unavailable to the organization."
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
              <ProviderIcon className="size-5 text-content-default" />
            ) : (
              <div className="size-5 rounded-full bg-bg-inverted" />
            ),
            description: meta?.description ?? '',
            actionSlot: (
              <Link
                to="/organization/settings/models/$providerId"
                params={{ providerId: provider.id }}
                className="inline-flex items-center gap-1 text-sm font-medium text-accent-default underline underline-offset-2 hover:text-accent-default/80"
                aria-label={`View all models for ${name}`}
              >
                View all models
              </Link>
            ),
            checked: !provider.disabled,
            onCheckedChange: (enabled) =>
              handleToggle(provider.id, !enabled),
            disabled: updating,
          }
        }),
      }}
    />
  )
}
