import type { UpdateByokPayload } from './schemas'

export type ByokProviderKeyStatus = {
  readonly openai: boolean
  readonly anthropic: boolean
}

export type ByokUpdateResult = {
  readonly providerKeyStatus: ByokProviderKeyStatus
}

export type ByokUpdateAction = UpdateByokPayload
