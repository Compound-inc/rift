import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import {
  requestUserEmailChange,
  updateUserProfileName,
} from './account-profile.server'

const UpdateProfileNameInputSchema = z.object({
  name: z.string().trim().min(1).max(32),
})

const RequestEmailChangeInputSchema = z.object({
  newEmail: z.string().trim().email().max(320),
})

export type UpdateProfileNameInput = z.infer<typeof UpdateProfileNameInputSchema>
export type RequestEmailChangeInput = z.infer<typeof RequestEmailChangeInputSchema>

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
