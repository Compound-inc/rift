'use client'

import { ContentPage } from '@/components/layout'
import { useOrgFeatureAccess } from '@/lib/billing/use-org-billing'
import { m } from '@/paraglide/messages.js'
import { ComplianceFlagsSection } from '../model-policy/compliance-flags-section'
import { useProviderPolicy } from '../model-policy/use-provider-policy'

/**
 * Compliance & Policy settings page.
 * Contains compliance flags and policy configuration.
 */
export function CompliancePolicyPage() {
  const { payload, loading, error, updating, update } = useProviderPolicy()
  const featureAccess = useOrgFeatureAccess('compliancePolicy')
  const busy = loading || updating

  return (
    <ContentPage
      title={m.org_compliance_page_title()}
      description={m.org_compliance_page_description()}
    >
      {loading && (
        <p className="text-sm text-content-muted">{m.org_compliance_loading()}</p>
      )}

      {error && (
        <div
          className="rounded-md border border-border-default bg-bg-subtle px-3 py-2 text-sm text-content-error"
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
