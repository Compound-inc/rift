import { defineMutator } from '@rocicorp/zero'
import { z } from 'zod'
import { CUSTOM_INSTRUCTION_LIMIT } from '@/lib/shared/personalization/policy'
import { requireOrgContext } from '../org-access'
import { zql } from '../zql'

export const personalizationMutatorDefinitions = {
  personalization: {
    saveInstructions: defineMutator(
      z.object({
        instructionsEnabled: z.boolean(),
        aboutYou: z.string().max(CUSTOM_INSTRUCTION_LIMIT),
        responsePreferences: z.string().max(CUSTOM_INSTRUCTION_LIMIT),
      }),
      async ({ tx, args, ctx }) => {
        if (ctx.isAnonymous || !ctx.userID) throw new Error('Unauthorized')
        const existing = await tx.run(
          zql.userPersonalization.where('userId', ctx.userID).one(),
        )
        await tx.mutate.userPersonalization.upsert({
          ...args,
          userId: ctx.userID,
          memoryDefaultEnabled: existing?.memoryDefaultEnabled ?? true,
          updatedAt: Date.now(),
        })
      },
    ),
    setMemoryEnabled: defineMutator(
      z.object({ enabled: z.boolean() }),
      async ({ tx, args, ctx }) => {
        const scoped = requireOrgContext(ctx)
        const member = await tx.run(
          zql.member
            .where('userId', scoped.userID)
            .where('organizationId', scoped.organizationId)
            .one(),
        )
        if (!member && tx.location === 'server') throw new Error('Unauthorized')
        const existing = await tx.run(
          zql.userMemoryPreference
            .where('userId', scoped.userID)
            .where('organizationId', scoped.organizationId)
            .one(),
        )
        // Preserve the namespace generation when toggling consent.
        await tx.mutate.userMemoryPreference.upsert({
          userId: scoped.userID,
          organizationId: scoped.organizationId,
          enabled: args.enabled,
          generation: existing?.generation ?? 'initial',
          retiredGenerations: existing?.retiredGenerations ?? [],
          updatedAt: Date.now(),
        })
      },
    ),
  },
}
