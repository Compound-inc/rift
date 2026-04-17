import { Effect, Layer, ServiceMap } from 'effect'
import type { ResolvedChatMode } from '@/lib/shared/chat-modes'
import type { OrgPolicy } from '@/lib/shared/model-policy/types'
import type { ChatDomainError } from '../domain/errors'
import type {
  ResolvedToolPolicy,
} from '@/lib/shared/chat/tool-policy'
import {
  resolveToolPolicy,
  sanitizeThreadDisabledToolKeys,
} from '@/lib/shared/chat/tool-policy'

/**
 * Resolves tool availability from static catalog entries and persisted policy
 * snapshots. The service intentionally does not construct AI SDK tools; that
 * remains the registry's job so policy and runtime adapters stay separate.
 */
export type ToolPolicyServiceShape = {
  readonly resolveForThread: (input: {
    readonly threadId: string
    readonly userId: string
    readonly requestId: string
    readonly modelId: string
    readonly mode?: ResolvedChatMode
    readonly orgPolicy?: OrgPolicy
    readonly threadDisabledToolKeys?: readonly string[]
  }) => Effect.Effect<ResolvedToolPolicy, ChatDomainError>
  readonly sanitizeThreadDisabledToolKeys: (input: {
    readonly modelId: string
    readonly mode?: ResolvedChatMode
    readonly orgPolicy?: OrgPolicy
    readonly disabledToolKeys?: readonly string[]
  }) => Effect.Effect<readonly string[]>
}

export class ToolPolicyService extends ServiceMap.Service<
  ToolPolicyService,
  ToolPolicyServiceShape
>()('chat-backend/ToolPolicyService') {
  private static readonly implementation: ToolPolicyServiceShape = {
    resolveForThread: Effect.fn('ToolPolicyService.resolveForThread')(
      ({
        modelId,
        mode,
        orgPolicy,
        threadDisabledToolKeys,
      }) =>
        Effect.sync(() =>
          resolveToolPolicy({
            modelId,
            mode,
            orgPolicy,
            threadDisabledToolKeys,
          }),
        ),
    ),
    sanitizeThreadDisabledToolKeys: Effect.fn(
      'ToolPolicyService.sanitizeThreadDisabledToolKeys',
    )(({ modelId, mode, orgPolicy, disabledToolKeys }) =>
      Effect.sync(() =>
        sanitizeThreadDisabledToolKeys({
          modelId,
          mode,
          orgPolicy,
          disabledToolKeys,
        }),
      ),
    ),
  }

  static readonly layer = Layer.succeed(this, this.implementation)

  static readonly layerMemory = Layer.succeed(this, this.implementation)

  static readonly layerNoop = Layer.succeed(this, {
    resolveForThread: Effect.fn('ToolPolicyService.resolveForThreadNoop')(
      ({
        modelId,
      }) =>
        Effect.sync(() =>
          resolveToolPolicy({
            modelId,
          }),
        ),
    ),
    sanitizeThreadDisabledToolKeys: Effect.fn(
      'ToolPolicyService.sanitizeThreadDisabledToolKeysNoop',
    )(({ modelId, disabledToolKeys }) =>
      Effect.sync(() =>
        sanitizeThreadDisabledToolKeys({
          modelId,
          disabledToolKeys,
        }),
      ),
    ),
  })
}
