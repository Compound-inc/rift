import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import { locales } from '@/paraglide/runtime.js'
import {
  getUserPreferredLocale,
  requestUserEmailChange,
  updateUserPreferredLocale,
  updateUserProfileName,
} from './account-profile.server'

const UpdateProfileNameInputSchema = z.object({
  name: z.string().trim().min(1).max(32),
})

const RequestEmailChangeInputSchema = z.object({
  newEmail: z.string().trim().email().max(320),
})
const UpdatePreferredLocaleInputSchema = z.object({
  locale: z.enum(locales),
})

export type UpdateProfileNameInput = z.infer<typeof UpdateProfileNameInputSchema>
export type RequestEmailChangeInput = z.infer<typeof RequestEmailChangeInputSchema>
export type UpdatePreferredLocaleInput = z.infer<typeof UpdatePreferredLocaleInputSchema>

/**
 * Input validator for profile name updates.
 */
function updateProfileNameInputValidator(input: unknown): UpdateProfileNameInput {
  return UpdateProfileNameInputSchema.parse(input)
}

/**
 * Input validator for email change requests.
 */
function requestEmailChangeInputValidator(input: unknown): RequestEmailChangeInput {
  return RequestEmailChangeInputSchema.parse(input)
}

/**
 * Input validator for preferred locale persistence.
 */
function updatePreferredLocaleInputValidator(input: unknown): UpdatePreferredLocaleInput {
  return UpdatePreferredLocaleInputSchema.parse(input)
}

/**
 * Server mutation for updating the authenticated user's display name.
 */
export const updateProfileName = createServerFn({ method: 'POST' })
  .inputValidator(updateProfileNameInputValidator)
  .handler(async ({ data }) => {
    return updateUserProfileName(data)
  })

/**
 * Server mutation for initiating the authenticated user's email change flow.
 */
export const requestEmailChange = createServerFn({ method: 'POST' })
  .inputValidator(requestEmailChangeInputValidator)
  .handler(async ({ data }) => {
    return requestUserEmailChange(data)
  })

/**
 * Server mutation for saving account locale preference.
 */
export const updatePreferredLocale = createServerFn({ method: 'POST' })
  .inputValidator(updatePreferredLocaleInputValidator)
  .handler(async ({ data }) => {
    return updateUserPreferredLocale(data)
  })

/**
 * Server query for the authenticated user's locale preference.
 */
export const getPreferredLocale = createServerFn({ method: 'GET' })
  .handler(async () => {
    return getUserPreferredLocale()
  })
