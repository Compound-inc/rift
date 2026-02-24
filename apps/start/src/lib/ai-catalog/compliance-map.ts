import type { AiModelCatalogEntry } from './types'

export type OrgComplianceFlags = {
  /** When true, only models with ZDR (Zero Data Retention) are allowed. */
  readonly require_zdr?: boolean
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
