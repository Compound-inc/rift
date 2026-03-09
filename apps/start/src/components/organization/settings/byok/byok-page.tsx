'use client'

import { ContentPage } from '@/components/layout'
import { ByokForm } from '@/components/organization/settings/byok'
import { useOrgFeatureAccess } from '@/lib/billing/use-org-billing'
import { useByok } from '@/lib/byok/use-byok'
import { m } from '@/paraglide/messages.js'

/**
 * Organization settings page for BYOK (Bring Your Own Key): manage
 * provider API keys stored in WorkOS Vault for the current org.
 */
export function ByokPage() {
  const {
    payload,
    loading,
    error,
    updating,
    setProviderKey,
    removeProviderKey,
  } = useByok()
  const featureAccess = useOrgFeatureAccess('byok')
  const busy = loading || updating

  return (
    <ContentPage
      title={m.org_byok_page_title()}
      description={m.org_byok_page_description()}
    >
      {loading && (
        <p className="text-sm text-content-muted">
          {m.org_byok_loading()}
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

      <ByokForm
        featureAccess={featureAccess}
        providerKeyStatus={payload.providerKeyStatus}
        updating={busy}
        onSave={setProviderKey}
        onRemove={removeProviderKey}
      />
    </ContentPage>
  )
}
