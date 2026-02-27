'use client'

import { ContentPage } from '@/components/layout'
import { ByokForm } from '@/components/organization/settings/byok'
import { useByok } from '@/lib/byok/use-byok'

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
  const busy = loading || updating

  return (
    <ContentPage
      title="BYOK"
      description="Manage your organization's API keys for AI providers (Bring Your Own Key). Keys are stored securely in WorkOS Vault."
    >
      {loading && (
        <p className="text-sm text-content-muted">
          Loading provider key status…
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
        featureEnabled={payload.featureFlags.enableOrganizationProviderKeys}
        providerKeyStatus={payload.providerKeyStatus}
        updating={busy}
        onSave={setProviderKey}
        onRemove={removeProviderKey}
      />
    </ContentPage>
  )
}
