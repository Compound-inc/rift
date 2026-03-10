'use client'

import { ContentPage } from '@/components/layout'
import { m } from '@/paraglide/messages.js'
import { ProviderControlsSection } from './provider-controls-section'
import { useProviderPolicy } from './use-provider-policy'

/**
 * Models settings page: provider list with per-provider toggles and links to
 * model controls.
 */
export function ModelsPage() {
  const { payload, loading, error, updating, update } = useProviderPolicy()
  const busy = loading || updating

  return (
    <ContentPage
      title={m.org_models_page_title()}
      description={m.org_models_page_description()}
    >
      {loading && (
        <p className="text-sm text-foreground-secondary" role="status">
          {m.org_models_loading()}
        </p>
      )}

      {error && (
        <div
          className="rounded-md border border-border-base bg-surface-overlay px-3 py-2 text-sm text-foreground-error"
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
