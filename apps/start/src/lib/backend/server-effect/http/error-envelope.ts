export type StandardApiErrorEnvelope<
  TCode extends string,
  TI18nKey extends string,
  TParams extends Readonly<Record<string, string | number | boolean>> | undefined,
  TDetails extends Record<string, unknown>,
> = {
  readonly ok: false
  readonly error: {
    readonly code: TCode
    readonly i18nKey: TI18nKey
    readonly i18nParams?: TParams
    readonly requestId: string
    readonly retryable: boolean
  }
  readonly requestId: string
  readonly telemetry: {
    readonly owner: 'server'
  }
  readonly details: TDetails
}

/**
 * Builds the standard backend error envelope shared by app products. Domains
 * still choose their own stable code/i18n namespaces and details payloads.
 */
export function buildStandardApiErrorEnvelope<
  TCode extends string,
  TI18nKey extends string,
  TParams extends Readonly<Record<string, string | number | boolean>> | undefined,
  TDetails extends Record<string, unknown>,
>(input: {
  readonly requestId: string
  readonly code: TCode
  readonly i18nKey: TI18nKey
  readonly i18nParams?: TParams
  readonly retryable: boolean
  readonly details: TDetails
}): StandardApiErrorEnvelope<TCode, TI18nKey, TParams, TDetails> {
  return {
    ok: false,
    error: {
      code: input.code,
      i18nKey: input.i18nKey,
      i18nParams: input.i18nParams,
      requestId: input.requestId,
      retryable: input.retryable,
    },
    requestId: input.requestId,
    telemetry: {
      owner: 'server',
    },
    details: input.details,
  }
}
