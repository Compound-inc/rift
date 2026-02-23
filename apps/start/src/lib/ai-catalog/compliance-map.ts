import type { AiModelTag } from './types'

export type OrgComplianceFlags = {
  readonly block_data_collection?: boolean
}

export function deniedTagsFromComplianceFlags(
  flags?: OrgComplianceFlags,
): Set<AiModelTag> {
  const denied = new Set<AiModelTag>()

  if (flags?.block_data_collection) {
    denied.add('collects_data')
  }

  return denied
}
