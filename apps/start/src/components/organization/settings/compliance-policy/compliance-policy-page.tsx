'use client'

import { ContentPage } from '@/components/layout'
import { ComplianceFlagsSection } from '../model-policy/compliance-flags-section'
import { useProviderPolicy } from '../model-policy/use-provider-policy'

/**
 * Compliance & Policy settings page.
 * Contains compliance flags and policy configuration.
 */
export function CompliancePolicyPage() {
  const { payload, loading, error, updating, update } = useProviderPolicy()
  const busy = loading || updating

  return (
    <ContentPage
      title="Compliance & Policy"
      description="Configure organization-level compliance flags and policies."
    >
      {loading && (
        <p className="text-sm text-content-muted">Loading compliance policy…</p>
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
      />
    </ContentPage>
  )
}
