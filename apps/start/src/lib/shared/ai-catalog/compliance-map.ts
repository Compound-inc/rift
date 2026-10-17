import type { AiModelCatalogEntry } from './types'

export type OrgComplianceFlags = {
  /** Prevents public chat publication; member-only links remain available. */
  readonly disable_public_sharing?: boolean
  /** When true, only models with ZDR (Zero Data Retention) are allowed. */
  readonly require_zdr?: boolean
  /**
   * When true, model usage is restricted to providers that have an active
   * organization API key configured in WorkOS Vault.
   */
  readonly require_org_provider_key?: boolean
}

export function isDeniedByComplianceFlags(
  model: AiModelCatalogEntry,
  flags?: OrgComplianceFlags,
): boolean {
  if (flags?.require_zdr && !model.zeroDataRetention) {
    return true
  }
  return false
}
