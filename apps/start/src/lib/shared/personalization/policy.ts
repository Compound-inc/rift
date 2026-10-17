export const CUSTOM_INSTRUCTION_LIMIT = 1500

export type MemoryPolicyReason =
  | 'available'
  | 'unconfigured'
  | 'no-organization'
  | 'zdr'
  | 'organization'
  | 'user'

/** ZDR always wins, including BYOK requests that bypass model routing restrictions. */
export function resolveMemoryPolicy(input: {
  configured: boolean
  organizationId?: string
  orgMemoryEnabled?: boolean | null
  requireZdr?: boolean
  userEnabled?: boolean
  temporary?: boolean
}): { enabled: boolean; reason: MemoryPolicyReason } {
  if (!input.configured) return { enabled: false, reason: 'unconfigured' }
  if (!input.organizationId || input.temporary)
    return { enabled: false, reason: 'no-organization' }
  if (input.requireZdr) return { enabled: false, reason: 'zdr' }
  if (input.orgMemoryEnabled === false)
    return { enabled: false, reason: 'organization' }
  if (input.userEnabled === false) return { enabled: false, reason: 'user' }
  return { enabled: true, reason: 'available' }
}

/** The displayed workspace is a constraint; identity still comes from the session. */
export function validateMemoryOrganization(
  displayed?: string,
  active?: string,
): boolean {
  return displayed === active
}
