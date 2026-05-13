'use client'

import { ContentPage } from '@/components/layout'
import { usePermissions } from '@/lib/frontend/permissions/use-permissions'
import { m } from '@/paraglide/messages.js'
import { ComplianceFlagsSection } from './compliance-flags-section'
import { ModelControlsSection } from './model-controls-section'
import { ProviderControlsSection } from './provider-controls-section'
import { useChatPolicySettings } from './use-chat-policy-settings'

/**
 * Chat policy settings page: ContentPage layout with chat-specific compliance,
 * provider, and model/tool controls.
 */
export function ChatPolicySettingsPage() {
  const { payload, loading, error, updating, update } = useChatPolicySettings()
  const { workspaceFeatureState } = usePermissions()
  const providerPolicyAccess = workspaceFeatureState('providerPolicy')
  const compliancePolicyAccess = workspaceFeatureState('compliancePolicy')
  const busy = loading || updating

  return (
    <ContentPage
      title={m.org_provider_policy_page_title()}
      description={m.org_provider_policy_page_description()}
    >
      {error && (
        <div
          className="rounded-md border border-border-base bg-surface-overlay px-3 py-2 text-sm text-foreground-error"
          role="alert"
        >
          {error}
        </div>
      )}

      <ComplianceFlagsSection
        payload={payload}
        updating={busy}
        update={update}
        featureAccess={compliancePolicyAccess}
      />
      <ProviderControlsSection
        payload={payload}
        updating={busy}
        update={update}
        featureAccess={providerPolicyAccess}
      />
      <ModelControlsSection
        payload={payload}
        updating={busy}
        update={update}
        featureAccess={providerPolicyAccess}
      />
    </ContentPage>
  )
}
