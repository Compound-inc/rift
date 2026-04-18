import { Effect, Layer, ServiceMap } from 'effect'

export type UserSkillRegistryServiceShape = {
  readonly listUserSkills: (input: {
    readonly userId: string
    readonly requestId: string
  }) => Effect.Effect<
    readonly {
      readonly id: string
      readonly name: string
      readonly summary: string
      readonly instructions: string
    }[]
  >
}

/**
 * Skills are a deliberate placeholder for now.
 */
export class UserSkillRegistryService extends ServiceMap.Service<
  UserSkillRegistryService,
  UserSkillRegistryServiceShape
>()('writing-backend/UserSkillRegistryService') {
  static readonly layer = Layer.succeed(this, {
    listUserSkills: Effect.fn('UserSkillRegistryService.listUserSkills')(() =>
      Effect.succeed([] as const),
    ),
  })
}
