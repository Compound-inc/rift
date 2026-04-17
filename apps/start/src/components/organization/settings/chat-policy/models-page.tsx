'use client'

import { ContentPage } from '@/components/layout'
import { m } from '@/paraglide/messages.js'
import { ProviderControlsSection } from './provider-controls-section'
import { useChatPolicySettings } from './use-chat-policy-settings'

/**
 * Models settings page: provider list with per-provider toggles and links to
 * model controls.
 */
export function ModelsPage() {
  const { payload, loading, error, updating, update } = useChatPolicySettings()
  const busy = loading || updating

  return (
    <ContentPage
      title={m.org_models_page_title()}
      description={m.org_models_page_description()}
    >
      {error && (
        <div
          className="rounded-md border border-border-base bg-surface-overlay px-3 py-2 text-sm text-foreground-error"
          role="alert"
        >
          {error}
        </div>
      )}

      <ProviderControlsSection
        payload={payload}
        updating={busy}
        update={update}
      />
    </ContentPage>
  )
}
