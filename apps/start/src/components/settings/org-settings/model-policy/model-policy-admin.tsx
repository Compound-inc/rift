'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@rift/ui/button'

type PolicyPayload = {
  orgWorkosId: string
  policy: {
    disabledProviderIds: string[]
    disabledModelIds: string[]
    complianceFlags: Record<string, boolean>
    version: number
    updatedAt?: number
  }
  providers: Array<{ id: string; disabled: boolean }>
  models: Array<{
    id: string
    name: string
    providerId: string
    description: string
    tags: string[]
    disabled: boolean
    deniedBy: Array<'provider' | 'model' | 'tag'>
  }>
}

type ModelPolicyAdminProps = {
  initialPayload?: PolicyPayload
}

async function requestPolicyUpdate(body: unknown): Promise<PolicyPayload> {
  const response = await fetch('/api/org/model-policy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok || !payload) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? String(payload.error)
        : 'Failed to update model policy'
    throw new Error(message)
  }

  return payload as PolicyPayload
}

async function loadPolicy(): Promise<PolicyPayload> {
  const response = await fetch('/api/org/model-policy', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok || !payload) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload
        ? String(payload.error)
        : 'Failed to load model policy'
    throw new Error(message)
  }

  return payload as PolicyPayload
}

export function ModelPolicyAdmin({ initialPayload }: ModelPolicyAdminProps) {
  const [payload, setPayload] = useState<PolicyPayload | null>(
    initialPayload ?? null,
  )
  const [loading, setLoading] = useState<boolean>(!initialPayload)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const next = await loadPolicy()
      setPayload(next)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!initialPayload) {
      void refresh()
    }
  }, [initialPayload, refresh])

  const update = useCallback(async (body: unknown) => {
    setUpdating(true)
    setError(null)
    try {
      const next = await requestPolicyUpdate(body)
      setPayload(next)
    } catch (updateError) {
      setError(
        updateError instanceof Error ? updateError.message : 'Failed to update',
      )
    } finally {
      setUpdating(false)
    }
  }, [])

  if (loading) {
    return <p className="text-sm text-content-muted">Loading model policy…</p>
  }

  if (!payload) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-content-muted">No policy data available.</p>
        <Button type="button" onClick={() => void refresh()}>
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-xs text-content-muted">Organization: {payload.orgWorkosId}</p>
        <p className="text-xs text-content-muted">Policy version: {payload.policy.version}</p>
      </div>

      {error ? (
        <div className="rounded-md border border-border-default bg-bg-subtle px-3 py-2 text-sm text-content-error">
          {error}
        </div>
      ) : null}

      <section className="space-y-3">
        <h3 className="text-base font-semibold text-content-emphasis">Compliance Flags</h3>
        <div className="rounded-lg border border-border-default">
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium text-content-emphasis">Block data-collection models</p>
              <p className="text-xs text-content-muted">
                Denies catalog models tagged with <code>collects_data</code>.
              </p>
            </div>
            <input
              type="checkbox"
              checked={Boolean(payload.policy.complianceFlags.block_data_collection)}
              disabled={updating}
              onChange={(event) =>
                void update({
                  action: 'toggle_compliance_flag',
                  flag: 'block_data_collection',
                  enabled: event.target.checked,
                })
              }
            />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-base font-semibold text-content-emphasis">Provider Controls</h3>
        <div className="rounded-lg border border-border-default">
          {payload.providers.map((provider) => (
            <div
              key={provider.id}
              className="flex items-center justify-between border-b border-border-default px-4 py-3 last:border-b-0"
            >
              <p className="text-sm text-content-emphasis">{provider.id}</p>
              <input
                type="checkbox"
                checked={provider.disabled}
                disabled={updating}
                onChange={(event) =>
                  void update({
                    action: 'toggle_provider',
                    providerId: provider.id,
                    disabled: event.target.checked,
                  })
                }
              />
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-base font-semibold text-content-emphasis">Model Controls</h3>
        <div className="rounded-lg border border-border-default">
          {payload.models.map((model) => (
            <div
              key={model.id}
              className="flex items-center justify-between gap-4 border-b border-border-default px-4 py-3 last:border-b-0"
            >
              <div>
                <p className="text-sm font-medium text-content-emphasis">{model.name}</p>
                <p className="text-xs text-content-muted">{model.id}</p>
                {model.deniedBy.length > 0 ? (
                  <p className="text-xs text-content-muted">
                    Disabled by: {model.deniedBy.join(', ')}
                  </p>
                ) : null}
              </div>
              <input
                type="checkbox"
                checked={payload.policy.disabledModelIds.includes(model.id)}
                disabled={updating}
                onChange={(event) =>
                  void update({
                    action: 'toggle_model',
                    modelId: model.id,
                    disabled: event.target.checked,
                  })
                }
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
