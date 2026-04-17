'use client'

import { ContentPage } from '@/components/layout'
import { useOrgFeatureAccess } from '@/lib/frontend/billing/use-org-billing'
import { m } from '@/paraglide/messages.js'
import { ComplianceFlagsSection } from '../chat-policy/compliance-flags-section'
import { useChatPolicySettings } from '../chat-policy/use-chat-policy-settings'

/**
 * Compliance & Policy settings page.
 * Contains compliance flags and policy configuration.
 */
export function CompliancePolicyPage() {
  const { payload, loading, error, updating, update } = useChatPolicySettings()
  const featureAccess = useOrgFeatureAccess('compliancePolicy')
  const busy = loading || updating

  return (
    <ContentPage
      title={m.org_compliance_page_title()}
      description={m.org_compliance_page_description()}
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
        featureAccess={featureAccess}
      />
    </ContentPage>
  )
}
