/**
 * New accounts get one default workspace unless they are temporary anonymous
 * users. Anonymous sessions should stay lightweight until the account is
 * upgraded to a persisted identity.
 */
export function shouldProvisionDefaultOrganization(user: {
  isAnonymous?: boolean | null
}): boolean {
  return user.isAnonymous !== true
}

/**
 * Default organization name derived from the user's name or email.
 */
export function buildDefaultOrganizationName(input: {
  name: string
  email: string
}): string {
  const trimmedName = input.name.trim()
  if (trimmedName.length > 0 && trimmedName.toLowerCase() !== 'human') {
    return `${trimmedName}'s Workspace`
  }

  const localPart = input.email.split('@')[0]?.trim() || 'Workspace'
  const normalizedLocal = localPart.replace(/[._-]+/g, ' ').trim()
  const fallbackName =
    normalizedLocal.length > 0
      ? normalizedLocal.replace(/\b\w/g, (char) => char.toUpperCase())
      : 'Workspace'

  return `${fallbackName}'s Workspace`
}
