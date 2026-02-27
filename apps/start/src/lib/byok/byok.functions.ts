import { createServerFn } from '@tanstack/react-start'
import type { ByokUpdateAction } from './types'
import { runUpdateByok } from './byok.server'

/** Input shape for the server function; server performs full validation in byok.server.ts. */
function updateByokInput(input: unknown): { data: ByokUpdateAction } {
  return input as { data: ByokUpdateAction }
}

/**
 * BYOK server function.
 */
export const updateByok = createServerFn({ method: 'POST' })
  .inputValidator(updateByokInput)
  .handler(async ({ data }: { data: unknown }) => {
    return runUpdateByok(data)
  })
