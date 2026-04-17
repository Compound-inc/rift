/**
 * UI payload for the chat policy settings screens.
 * Derived from the org policy row in Zero plus static catalog metadata.
 */
export type ChatPolicySettingsPayload = {
  policy: {
    disabledProviderIds: string[]
    disabledModelIds: string[]
    complianceFlags: Record<string, boolean>
    toolPolicy: {
      providerNativeToolsEnabled: boolean
      externalToolsEnabled: boolean
      disabledToolKeys: string[]
    }
    enforcedModeId?: string
    updatedAt?: number
  }
  providers: Array<{ id: string; disabled: boolean }>
  models: Array<{
    id: string
    name: string
    providerId: string
    description: string
    zeroDataRetention: boolean
    disabled: boolean
    deniedBy: Array<'provider' | 'model' | 'compliance'>
  }>
  tools: Array<{
    key: string
    providerId: string
    advanced: boolean
    source: 'provider-native' | 'external'
    disabled: boolean
  }>
}

export type ChatPolicySettingsUpdateAction =
  | {
      action: 'toggle_provider'
      providerId: string
      disabled: boolean
    }
  | {
      action: 'toggle_model'
      modelId: string
      disabled: boolean
    }
  | {
      action: 'toggle_compliance_flag'
      flag: string
      enabled: boolean
    }
  | {
      action: 'set_enforced_mode'
      modeId: string | null
    }
  | {
      action: 'toggle_provider_native_tools'
      enabled: boolean
    }
  | {
      action: 'toggle_external_tools'
      enabled: boolean
    }
  | {
      action: 'toggle_tool'
      toolKey: string
      disabled: boolean
    }
