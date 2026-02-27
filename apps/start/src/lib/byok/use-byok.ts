'use client'

import { useCallback, useMemo, useState } from 'react'
import { useQuery } from '@rocicorp/zero/react'
import { useServerFn } from '@tanstack/react-start'
import { canUseOrganizationProviderKeys } from '@/utils/app-feature-flags'
import { queries } from '@/integrations/zero'
import { updateByok } from './byok.functions'
import type { ByokPayload, ByokUpdateAction, ByokProvider } from './types'

const DEFAULT_ERROR_MESSAGE = 'Failed to update provider key'

/** Extracts user-facing message from thrown value (tagged errors have .message). Client-only; no Effect. */
function messageFromThrowable(e: unknown): string {
  if (
    typeof e === 'object' &&
    e !== null &&
    'message' in e &&
    typeof (e as { message: unknown }).message === 'string'
  ) {
    return (e as { message: string }).message
  }
  return DEFAULT_ERROR_MESSAGE
}

const DEFAULT_KEY_STATUS = {
  openai: false,
  anthropic: false,
}

function buildByokPayload(input: {
  policyRow?: {
    providerKeyStatus?: {
      providers: {
        openai: boolean
        anthropic: boolean
      }
    }
  } | null
}): ByokPayload {
  const providerKeyStatus =
    input.policyRow?.providerKeyStatus?.providers ?? DEFAULT_KEY_STATUS

  return {
    featureFlags: {
      enableOrganizationProviderKeys: canUseOrganizationProviderKeys(),
    },
    providerKeyStatus,
  }
}

/**
 * Hook for BYOK settings: reads org policy from Zero, exposes payload and
 * type-safe mutations via the updateByok server function.
 */
export function useByok() {
  const [policyRow, policyResult] = useQuery(queries.orgPolicy.current())
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)

  const updateByokFn = useServerFn(updateByok)

  const payload = useMemo(() => buildByokPayload({ policyRow }), [policyRow])

  const update = useCallback(
    async (action: ByokUpdateAction) => {
      setUpdating(true)
      setError(null)
      try {
        await updateByokFn({ data: action })
      } catch (e: unknown) {
        setError(messageFromThrowable(e))
      } finally {
        setUpdating(false)
      }
    },
    [updateByokFn],
  )

  const setProviderKey = useCallback(
    async (providerId: ByokProvider, apiKey: string) => {
      await update({
        action: 'set_provider_api_key',
        providerId,
        apiKey,
      })
    },
    [update],
  )

  const removeProviderKey = useCallback(
    async (providerId: ByokProvider) => {
      await update({
        action: 'remove_provider_api_key',
        providerId,
      })
    },
    [update],
  )

  return {
    payload,
    loading: policyResult.type !== 'complete',
    error,
    updating,
    setProviderKey,
    removeProviderKey,
  }
}
