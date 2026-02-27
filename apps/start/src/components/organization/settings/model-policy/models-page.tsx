'use client'

import { ContentPage } from '@/components/layout'
import { ProviderControlsSection } from './provider-controls-section'
import { useProviderPolicy } from './use-provider-policy'

/**
 * Models settings page: provider list with toggles and links to per-provider model pages.
 * Renders provider controls only when data is loaded to avoid flashing stale state.
 */
export function ModelsPage() {
  const { payload, loading, error, updating, update } = useProviderPolicy()
  const busy = loading || updating

  return (
    <ContentPage
      title="Models"
      description="Manage providers and models for your organization."
    >
      {loading && (
        <p className="text-sm text-content-muted" role="status">
          Loading models…
        </p>
      )}

      {error && (
        <div
          className="rounded-md border border-border-default bg-bg-subtle px-3 py-2 text-sm text-content-error"
          role="alert"
        >
          {error}
        </div>
      )}

      {!loading && (
        <ProviderControlsSection
          payload={payload}
          updating={busy}
          update={update}
        />
      )}
    </ContentPage>
  )
}
