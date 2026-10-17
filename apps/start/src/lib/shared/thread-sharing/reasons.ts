/** Stable transport codes; user-facing copy is resolved in the client's locale. */
export const shareActionReasonCodes = [
  'instance_locked',
  'workspace_policy',
  'anonymous_owner',
  'rate_limited',
  'wrong_workspace',
  'too_large',
] as const

export type ShareActionReason = (typeof shareActionReasonCodes)[number]
export type PublicSharingBlockedReason = Extract<
  ShareActionReason,
  'instance_locked' | 'workspace_policy'
>
export type ActivationBlockedReason = Extract<ShareActionReason, 'anonymous_owner'>
