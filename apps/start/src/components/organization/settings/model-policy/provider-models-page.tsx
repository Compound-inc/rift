'use client'

import * as React from 'react'
import { Link } from '@tanstack/react-router'
import { Form } from '@rift/ui/form'
import { ChevronLeft } from 'lucide-react'
import { getProviderIcon } from '@/lib/ai-catalog'
import type { CatalogProviderId } from '@/lib/ai-catalog/provider-tools'
import { ContentPage } from '@/components/layout'
import {
  DESCRIPTION_PLACEHOLDER,
  PROVIDER_NAMES,
} from './provider-constants'
import type { PolicyPayload } from './types'
import type { useProviderPolicy } from './use-provider-policy'

/** Matches ContentPage title so header block height stays identical when navigating. */
const PAGE_TITLE_CLASS =
  'text-2xl font-semibold leading-7 text-content-emphasis'

type ProviderModelsPageProps = {
  providerId: string
  payload: PolicyPayload
  updating: boolean
  update: ReturnType<typeof useProviderPolicy>['update']
}

/**
 * In-depth page for a single provider: same Form card layout as the main Providers
 * section, but only models for this provider. Header uses the same title/description
 * block as the Models page so the form does not shift when navigating.
 */
export function ProviderModelsPage({
  providerId,
  payload,
  updating,
  update,
}: ProviderModelsPageProps) {
  const providerName = PROVIDER_NAMES[providerId] ?? providerId
  const modelsForProvider = React.useMemo(
    () => payload.models.filter((m) => m.providerId === providerId),
    [payload.models, providerId],
  )

  const ProviderIcon = getProviderIcon(providerId as CatalogProviderId)
  const providerIcon = ProviderIcon ? (
    <ProviderIcon className="size-5 text-content-default" aria-hidden />
  ) : (
    <div className="size-5 rounded-full bg-bg-inverted" aria-hidden />
  )

  const formContent =
    modelsForProvider.length === 0 ? (
      <p className="rounded-xl border border-border-subtle bg-bg-default p-6 text-sm text-content-subtle">
        No models available for this provider.
      </p>
    ) : (
      <Form
        title={providerName}
        description="Enable or disable models for this provider in your organization."
        helpText="Changes apply immediately. Disabled models are unavailable to the organization."
        toggleSection={{
          rowHover: true,
          items: modelsForProvider.map((model) => ({
            id: model.id,
            title: model.name,
            icon: providerIcon,
            checked: !payload.policy.disabledModelIds.includes(model.id),
            onCheckedChange: (enabled) =>
              void update({
                action: 'toggle_model',
                modelId: model.id,
                disabled: !enabled,
              }),
            disabled: updating,
          })),
        }}
      />
    )

  return (
    <ContentPage
      title={
        <Link
          to="/organization/settings/models"
          className={`inline-flex items-center gap-1 ${PAGE_TITLE_CLASS} hover:text-content-default`}
          aria-label="Go back to models"
        >
          <ChevronLeft className="size-4 shrink-0" aria-hidden />
          Go back
        </Link>
      }
      description={
        <span className="invisible" aria-hidden="true">
          {DESCRIPTION_PLACEHOLDER}
        </span>
      }
    >
      {formContent}
    </ContentPage>
  )
}
