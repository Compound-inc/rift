import { describe, expect, it } from 'vitest'
import {
  isOrgProductPolicyEmpty,
  mergeOrgProductPolicy,
  normalizeOrgProductPolicy,
  serializeOrgProductPolicy,
} from './org-product-policy'

describe('normalizeOrgProductPolicy', () => {
  it('filters unsupported values and de-duplicates deny lists', () => {
    expect(
      normalizeOrgProductPolicy({
        capabilities: {
          editor: true,
          broken: 'yes',
        },
        settings: {
          mode: 'strict',
          retries: 2,
          invalid: { nested: true },
        },
        disabledProviderIds: ['openai', 'openai', 1],
        disabledModelIds: ['gpt-5', '', 'gpt-5'],
        disabledToolKeys: ['tool.a', false, 'tool.a'],
        complianceFlags: {
          zdr: true,
          nope: 'true',
        },
      }),
    ).toEqual({
      capabilities: {
        editor: true,
      },
      settings: {
        mode: 'strict',
        retries: 2,
      },
      disabledProviderIds: ['openai'],
      disabledModelIds: ['gpt-5'],
      disabledToolKeys: ['tool.a'],
      complianceFlags: {
        zdr: true,
      },
    })
  })
})

describe('serializeOrgProductPolicy', () => {
  it('drops empty sections to keep rows compact', () => {
    expect(
      serializeOrgProductPolicy({
        capabilities: {},
        settings: {},
        disabledProviderIds: [],
        disabledModelIds: [],
        disabledToolKeys: [],
        complianceFlags: {},
      }),
    ).toEqual({})
  })
})

describe('mergeOrgProductPolicy', () => {
  it('overlays maps and unions deny lists', () => {
    expect(
      mergeOrgProductPolicy({
        base: {
          capabilities: { editor: true },
          settings: { mode: 'default' },
          disabledProviderIds: ['openai'],
          disabledModelIds: [],
          disabledToolKeys: ['tool.a'],
          complianceFlags: { zdr: false },
        },
        override: {
          capabilities: { editor: false, exports: true },
          settings: { mode: 'strict' },
          disabledProviderIds: ['anthropic'],
          disabledModelIds: ['gpt-5'],
          disabledToolKeys: ['tool.b'],
          complianceFlags: { zdr: true },
        },
      }),
    ).toEqual({
      capabilities: { editor: false, exports: true },
      settings: { mode: 'strict' },
      disabledProviderIds: ['openai', 'anthropic'],
      disabledModelIds: ['gpt-5'],
      disabledToolKeys: ['tool.a', 'tool.b'],
      complianceFlags: { zdr: true },
    })
  })
})

describe('isOrgProductPolicyEmpty', () => {
  it('recognizes empty normalized policies', () => {
    expect(
      isOrgProductPolicyEmpty({
        capabilities: {},
        settings: {},
        disabledProviderIds: [],
        disabledModelIds: [],
        disabledToolKeys: [],
        complianceFlags: {},
      }),
    ).toBe(true)
  })
})
