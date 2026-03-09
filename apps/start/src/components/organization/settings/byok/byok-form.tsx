'use client'

import { useEffect, useMemo, useState } from 'react'
import { Form } from '@rift/ui/form'
import type { WorkspaceFeatureAccessState } from '@/lib/billing/plan-catalog'
import { getFeatureAccessFormProps } from '@/components/organization/settings/feature-access-form-helpers'
import type { ByokProvider } from '@/lib/byok/types'
import { m } from '@/paraglide/messages.js'

function getProviderApiKeyHref(providerId: ByokProvider): string {
  return providerId === 'openai'
    ? 'https://platform.openai.com/api-keys'
    : 'https://console.anthropic.com/settings/keys'
}

function getProviderName(providerId: ByokProvider): string {
  return providerId === 'openai' ? 'OpenAI' : 'Anthropic'
}

interface ProviderCard {
  providerId: ByokProvider
  title: string
  configured: boolean
  placeholder: string
}

interface ByokFormProps {
  featureAccess: WorkspaceFeatureAccessState & { loading: boolean }
  providerKeyStatus: {
    openai: boolean
    anthropic: boolean
  }
  updating: boolean
  onSave: (providerId: ByokProvider, apiKey: string) => Promise<void>
  onRemove: (providerId: ByokProvider) => Promise<void>
}

/**
 * Form for configuring BYOK (Bring Your Own Key) per provider.
 * Renders a card per provider (OpenAI, Anthropic) with save/update/remove actions.
 */
// Masked value to show in input when a key is already configured
const MASKED_KEY_VALUE = '••••••••••••••••••••••••••••••'

export function ByokForm({
  featureAccess,
  providerKeyStatus,
  updating,
  onSave,
  onRemove,
}: ByokFormProps) {
  const featureEnabled = featureAccess.allowed
  const [openaiInput, setOpenaiInput] = useState(() =>
    providerKeyStatus.openai ? MASKED_KEY_VALUE : '',
  )
  const [anthropicInput, setAnthropicInput] = useState(() =>
    providerKeyStatus.anthropic ? MASKED_KEY_VALUE : '',
  )

  // Sync state when providerKeyStatus changes (e.g., after remove)
  useEffect(() => {
    setOpenaiInput((current) =>
      providerKeyStatus.openai
        ? current === ''
          ? MASKED_KEY_VALUE
          : current
        : '',
    )
    setAnthropicInput((current) =>
      providerKeyStatus.anthropic
        ? current === ''
          ? MASKED_KEY_VALUE
          : current
        : '',
    )
  }, [providerKeyStatus.openai, providerKeyStatus.anthropic])

  const cards = useMemo<ProviderCard[]>(
    () => [
      {
        providerId: 'openai' as const,
        title: 'OpenAI API Key',
        configured: providerKeyStatus.openai,
        placeholder: 'sk-...',
      },
      {
        providerId: 'anthropic' as const,
        title: 'Anthropic API Key',
        configured: providerKeyStatus.anthropic,
        placeholder: 'sk-ant-...',
      },
    ],
    [providerKeyStatus],
  )

  return (
    <section className="space-y-6">
      {cards.map((card) => (
        <div key={card.providerId} className="space-y-3">
          <Form
            title={card.title}
            description={
              !featureEnabled
                ? featureAccess.upgradeCallout
                : card.configured
                ? m.org_byok_provider_configured_description()
                : m.org_byok_provider_not_configured_description()
            }
            {...getFeatureAccessFormProps({
              enabled: featureEnabled,
              featureAccess,
              defaultHelpText: m.org_byok_api_key_help_prefix({
                providerName: getProviderName(card.providerId),
              }),
            })}
            inputAttrs={{
              name: `${card.providerId}ApiKey`,
              type: 'password',
              placeholder: card.placeholder,
              autoComplete: 'off',
              disabled: updating || !featureEnabled || card.configured,
              className:
                '[&::-webkit-credentials-auto-fill-button]:hidden [&::-webkit-credentials-auto-fill-button]:w-0 [&::-ms-reveal]:hidden',
            }}
            value={card.providerId === 'openai' ? openaiInput : anthropicInput}
            onValueChange={
              featureEnabled
                ? (value) => {
                    const setter =
                      card.providerId === 'openai'
                        ? setOpenaiInput
                        : setAnthropicInput
                    // Clear masked value when user starts typing
                    const currentValue =
                      card.providerId === 'openai'
                        ? openaiInput
                        : anthropicInput
                    if (currentValue === MASKED_KEY_VALUE) {
                      setter(value.replace(MASKED_KEY_VALUE, ''))
                    } else {
                      setter(value)
                    }
                  }
                : undefined
            }
            buttonText={
              card.configured
                ? m.org_byok_remove_key_button()
                : m.org_byok_save_key_button()
            }
            buttonVariant={card.configured ? 'dangerLight' : 'default'}
            buttonDisabled={!featureEnabled || updating}
            handleSubmit={
              featureEnabled
                ? async () => {
                    if (card.configured) {
                      // Remove the configured key
                      if (card.providerId === 'openai') {
                        setOpenaiInput('')
                      } else {
                        setAnthropicInput('')
                      }
                      await onRemove(card.providerId)
                    } else {
                      // Save new key
                      const rawKey =
                        card.providerId === 'openai'
                          ? openaiInput
                          : anthropicInput
                      // Don't send the masked placeholder value to the server
                      const key = rawKey === MASKED_KEY_VALUE ? '' : rawKey
                      await onSave(card.providerId, key)
                      // After successful save, show masked value again if key was saved
                      if (card.providerId === 'openai') {
                        setOpenaiInput(key ? MASKED_KEY_VALUE : '')
                      } else {
                        setAnthropicInput(key ? MASKED_KEY_VALUE : '')
                      }
                    }
                  }
                : undefined
            }
            helpLearnMoreHref={
              featureEnabled
                ? getProviderApiKeyHref(card.providerId)
                : featureAccess.action.href
            }
            helpLearnMoreLabel={
              featureEnabled
                ? m.org_byok_api_key_help_link_text()
                : featureAccess.action.label
            }
          />
        </div>
      ))}
    </section>
  )
}
