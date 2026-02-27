'use client'

import { useEffect, useMemo, useState } from 'react'
import { Form } from '@rift/ui/form'
import type { ByokProvider } from '@/lib/byok/types'

/**
 * Help text component with a link to obtain API keys
 */
function ApiKeyHelpText({ providerId }: { providerId: ByokProvider }) {
  const isOpenAI = providerId === 'openai'
  const href = isOpenAI
    ? 'https://platform.openai.com/api-keys'
    : 'https://console.anthropic.com/settings/keys'
  const providerName = isOpenAI ? 'OpenAI' : 'Anthropic'

  return (
    <span className="text-sm text-content-subtle">
      You can get your {providerName} API key{' '}
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-accent-default underline underline-offset-2 hover:text-accent-default/80"
      >
        here
      </a>
    </span>
  )
}

interface ProviderCard {
  providerId: ByokProvider
  title: string
  configured: boolean
  placeholder: string
}

interface ByokFormProps {
  featureEnabled: boolean
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
  featureEnabled,
  providerKeyStatus,
  updating,
  onSave,
  onRemove,
}: ByokFormProps) {
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
              card.configured
                ? 'Configured, new requests for this provider will use your org key.'
                : "Not configured, requests will continue using RIFT's provider key."
            }
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
            buttonText={card.configured ? 'Remove key' : 'Save key'}
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
            helpText={
              !featureEnabled ? (
                'This feature is currently disabled. Contact your administrator to enable it.'
              ) : (
                <ApiKeyHelpText providerId={card.providerId} />
              )
            }
          />
        </div>
      ))}
    </section>
  )
}
