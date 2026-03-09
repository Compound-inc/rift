'use client'

import { ContentPage } from '@/components/layout'
import { m } from '@/paraglide/messages.js'
import { useProviderPolicy } from '@/components/organization/settings/model-policy/use-provider-policy'
import { useOrgFeatureAccess } from '@/lib/billing/use-org-billing'
import { ToolAccessSection } from './tool-access-section'
import { ProviderToolsSection } from './provider-tools-section'

/**
 * Tools settings page: organization-level controls for built-in, external,
 * and per-provider tools. Uses the same provider policy hook as the Models
 * page since tool policy is stored in the org policy row.
 */
export function ToolsPage() {
  const { payload, loading, error, updating, update } = useProviderPolicy()
  const featureAccess = useOrgFeatureAccess('toolPolicy')
  const busy = loading || updating

  return (
    <ContentPage
      title={m.org_tools_page_title()}
      description={m.org_tools_page_description()}
    >
      {loading && (
        <p className="text-sm text-content-muted" role="status">
          {m.org_tools_loading()}
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
        <>
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
        </>
      )}
    </ContentPage>
  )
}
