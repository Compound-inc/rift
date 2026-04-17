'use client'

import { ContentPage } from '@/components/layout'
import { m } from '@/paraglide/messages.js'
import { useChatPolicySettings } from '@/components/organization/settings/chat-policy/use-chat-policy-settings'
import { useOrgFeatureAccess } from '@/lib/frontend/billing/use-org-billing'
import { ToolAccessSection } from './tool-access-section'
import { ProviderToolsSection } from './provider-tools-section'

/**
 * Tools settings page: organization-level controls for built-in, external,
 * and per-provider tools. Uses the same provider policy hook as the Models
 * page since tool policy is stored in the org policy row.
 */
export function ToolsPage() {
  const { payload, loading, error, updating, update } = useChatPolicySettings()
  const featureAccess = useOrgFeatureAccess('toolPolicy')
  const busy = loading || updating

  return (
    <ContentPage
      title={m.org_tools_page_title()}
      description={m.org_tools_page_description()}
    >
      {error && (
        <div
          className="rounded-md border border-border-base bg-surface-overlay px-3 py-2 text-sm text-foreground-error"
          role="alert"
        >
          {error}
        </div>
      )}

      <ToolAccessSection
        payload={payload}
        updating={busy}
        update={update}
        featureAccess={featureAccess}
      />
      <ProviderToolsSection
        payload={payload}
        updating={busy}
        update={update}
        featureAccess={featureAccess}
      />
    </ContentPage>
  )
}
