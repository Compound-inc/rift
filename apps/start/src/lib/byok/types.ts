/** Provider identifier for BYOK; must match server schema. */
export type ByokProvider = 'openai' | 'anthropic'

export type ByokProviderKeyStatus = {
  readonly openai: boolean
  readonly anthropic: boolean
}

export type ByokPayload = {
  readonly providerKeyStatus: ByokProviderKeyStatus
}

/** Client-safe shape for BYOK update actions; server validates with Effect Schema. */
export type ByokUpdateAction =
  | {
      readonly action: 'set_provider_api_key'
      readonly providerId: ByokProvider
      readonly apiKey: string
    }
  | {
      readonly action: 'remove_provider_api_key'
      readonly providerId: ByokProvider
    }
