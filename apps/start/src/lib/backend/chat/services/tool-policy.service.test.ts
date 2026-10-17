import { describe, expect, it } from 'vitest'
import { Effect } from 'effect'
import { DEFAULT_ORG_TOOL_POLICY } from '@/lib/shared/model-policy/types'
import { ToolPolicyService } from './tool-policy.service'

describe('ToolPolicyService', () => {
  it('returns model tool keys by default', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* ToolPolicyService
        return yield* service.resolveForThread({
          threadId: 'thread-default',
          userId: 'user-default',
          requestId: 'req-default',
          modelId: 'openai/gpt-5-mini',
        })
      }).pipe(Effect.provide(ToolPolicyService.layer)),
    )

    expect(result.activeToolKeys).toContain('openai.web_search')
    expect(result.activeToolKeys).toContain('openai.code_interpreter')
  })

  it('removes an exact org-disabled tool without affecting siblings', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* ToolPolicyService
        return yield* service.resolveForThread({
          threadId: 'thread-org-disable',
          userId: 'user-org-disable',
          requestId: 'req-org-disable',
          modelId: 'xai/grok-4-fast-reasoning',
          orgPolicy: {
            organizationId: 'org-1',
            disabledProviderIds: [],
            disabledModelIds: [],
            complianceFlags: {},
            toolPolicy: {
              ...DEFAULT_ORG_TOOL_POLICY,
              disabledToolKeys: ['xai.code_execution'],
            },
            orgKnowledgeEnabled: false,
            updatedAt: Date.now(),
          },
        })
      }).pipe(Effect.provide(ToolPolicyService.layer)),
    )

    expect(result.activeToolKeys).not.toContain('xai.code_execution')
    expect(result.activeToolKeys).toContain('xai.web_search')
  })

  it('blocks all provider-native tools when the org master switch is off', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* ToolPolicyService
        return yield* service.resolveForThread({
          threadId: 'thread-org-master-off',
          userId: 'user-org-master-off',
          requestId: 'req-org-master-off',
          modelId: 'openai/gpt-5-mini',
          orgPolicy: {
            organizationId: 'org-2',
            disabledProviderIds: [],
            disabledModelIds: [],
            complianceFlags: {},
            toolPolicy: {
              ...DEFAULT_ORG_TOOL_POLICY,
              providerNativeToolsEnabled: false,
            },
            orgKnowledgeEnabled: false,
            updatedAt: Date.now(),
          },
        })
      }).pipe(Effect.provide(ToolPolicyService.layer)),
    )

    expect(result.activeToolKeys).toEqual(['rift.documents'])
    expect(
      result.toolEntries.filter((entry) => entry.entry.source === 'provider-native').every((entry) =>
        entry.reasons.includes('blocked_by_org_master_switch'),
      ),
    ).toBe(true)
  })

  it('keeps Anthropic web search enabled when org policy disables code execution', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* ToolPolicyService
        return yield* service.resolveForThread({
          threadId: 'thread-anthropic-org-fallback',
          userId: 'user-anthropic-org-fallback',
          requestId: 'req-anthropic-org-fallback',
          modelId: 'anthropic/claude-sonnet-4.6',
          orgPolicy: {
            organizationId: 'org-3',
            disabledProviderIds: [],
            disabledModelIds: [],
            complianceFlags: {},
            toolPolicy: {
              ...DEFAULT_ORG_TOOL_POLICY,
              disabledToolKeys: ['anthropic.code_execution_20260120'],
            },
            orgKnowledgeEnabled: false,
            updatedAt: Date.now(),
          },
        })
      }).pipe(Effect.provide(ToolPolicyService.layer)),
    )

    expect(result.activeToolKeys).toContain('anthropic.web_search_20260209')
    expect(result.activeToolKeys).not.toContain('anthropic.code_execution_20260120')
  })

  it('blocks Anthropic code execution under ZDR', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* ToolPolicyService
        return yield* service.resolveForThread({
          threadId: 'thread-anthropic-zdr',
          userId: 'user-anthropic-zdr',
          requestId: 'req-anthropic-zdr',
          modelId: 'anthropic/claude-opus-4.6',
          orgPolicy: {
            organizationId: 'org-4',
            disabledProviderIds: [],
            disabledModelIds: [],
            complianceFlags: { require_zdr: true },
            toolPolicy: DEFAULT_ORG_TOOL_POLICY,
            orgKnowledgeEnabled: false,
            updatedAt: Date.now(),
          },
        })
      }).pipe(Effect.provide(ToolPolicyService.layer)),
    )

    expect(result.activeToolKeys).toContain('anthropic.web_search_20260209')
    expect(result.activeToolKeys).not.toContain('anthropic.code_execution_20260120')
    expect(
      result.toolEntries.find(
        (entry) => entry.key === 'anthropic.code_execution_20260120',
      )?.reasons,
    ).toContain('blocked_by_compliance')
  })

  it('keeps Anthropic code execution enabled under ZDR when an org Anthropic key is configured', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const service = yield* ToolPolicyService
        return yield* service.resolveForThread({
          threadId: 'thread-anthropic-zdr-byok',
          userId: 'user-anthropic-zdr-byok',
          requestId: 'req-anthropic-zdr-byok',
          modelId: 'anthropic/claude-opus-4.6',
          orgPolicy: {
            organizationId: 'org-5',
            disabledProviderIds: [],
            disabledModelIds: [],
            complianceFlags: { require_zdr: true },
            toolPolicy: DEFAULT_ORG_TOOL_POLICY,
            orgKnowledgeEnabled: false,
            providerKeyStatus: {
              syncedAt: Date.now(),
              hasAnyProviderKey: true,
              providers: {
                openai: false,
                anthropic: true,
              },
            },
            updatedAt: Date.now(),
          },
        })
      }).pipe(Effect.provide(ToolPolicyService.layer)),
    )

    expect(result.activeToolKeys).toContain('anthropic.web_search_20260209')
    expect(result.activeToolKeys).toContain('anthropic.code_execution_20260120')
    expect(
      result.toolEntries.find(
        (entry) => entry.key === 'anthropic.code_execution_20260120',
      )?.reasons,
    ).not.toContain('blocked_by_compliance')
  })
})
