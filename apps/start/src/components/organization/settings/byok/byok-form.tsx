'use client'

import { useMemo, useState } from 'react'
import { Form } from '@rift/ui/form'
import type { ByokProvider } from '@/lib/byok/types'

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
export function ByokForm({
  featureEnabled,
  providerKeyStatus,
  updating,
  onSave,
  onRemove,
}: ByokFormProps) {
  const [openaiInput, setOpenaiInput] = useState('')
  const [anthropicInput, setAnthropicInput] = useState('')

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
                ? 'Configured for this organization. New requests for this provider will use your org key.'
                : 'Not configured. Requests will continue using the system provider key unless policy blocks it.'
            }
            inputAttrs={{
              name: `${card.providerId}ApiKey`,
              type: 'password',
              placeholder: card.placeholder,
              autoComplete: 'off',
              disabled: updating || !featureEnabled,
            }}
            value={card.providerId === 'openai' ? openaiInput : anthropicInput}
            onValueChange={
              featureEnabled
                ? card.providerId === 'openai'
                  ? setOpenaiInput
                  : setAnthropicInput
                : undefined
            }
            buttonText={card.configured ? 'Update key' : 'Save key'}
            secondaryButtonText={card.configured ? 'Remove key' : undefined}
            buttonDisabled={!featureEnabled || updating}
            onSecondaryClick={
              featureEnabled
                ? () => {
                    if (card.providerId === 'openai') {
                      setOpenaiInput('')
                    } else {
                      setAnthropicInput('')
                    }
                    void onRemove(card.providerId)
                  }
                : undefined
            }
            handleSubmit={
              featureEnabled
                ? async () => {
                    const key =
                      card.providerId === 'openai'
                        ? openaiInput
                        : anthropicInput
                    await onSave(card.providerId, key)
                    if (card.providerId === 'openai') {
                      setOpenaiInput('')
                    } else {
                      setAnthropicInput('')
                    }
                  }
                : undefined
            }
            helpText={
              !featureEnabled
                ? 'This feature is currently disabled. Contact your administrator to enable it.'
                : undefined
            }
          />
        </div>
      ))}
    </section>
  )
}
