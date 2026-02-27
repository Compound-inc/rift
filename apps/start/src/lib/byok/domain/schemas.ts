import { Schema } from 'effect'

const ByokProviderId = Schema.Literals(['openai', 'anthropic'])

const SetProviderApiKeyPayload = Schema.Struct({
  action: Schema.Literal('set_provider_api_key'),
  providerId: ByokProviderId,
  apiKey: Schema.String.pipe(
    Schema.refine((s: string): s is string => s.length > 0),
  ),
})

const RemoveProviderApiKeyPayload = Schema.Struct({
  action: Schema.Literal('remove_provider_api_key'),
  providerId: ByokProviderId,
})

export const UpdateByokPayload = Schema.Union([
  SetProviderApiKeyPayload,
  RemoveProviderApiKeyPayload,
])

export type UpdateByokPayload = Schema.Schema.Type<typeof UpdateByokPayload>
