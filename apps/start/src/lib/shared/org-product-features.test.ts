import { describe, expect, it } from 'vitest'
import {
  normalizeOrgProductFeatureOverrides,
  resolveOrgProductFeatureStates,
  serializeOrgProductFeatureOverrides,
  setOrgProductFeatureOverride,
} from './org-product-features'

describe('org-product-features', () => {
  it('defaults writing to enabled when no override exists', () => {
    expect(resolveOrgProductFeatureStates()).toEqual({
      writing: true,
    })
  })

  it('ignores unknown override keys from persisted rows', () => {
    expect(
      normalizeOrgProductFeatureOverrides({
        writing: false,
        unknown_future_feature: true,
      }),
    ).toEqual({
      writing: false,
    })
  })

  it('stores only deviations from catalog defaults', () => {
    expect(
      serializeOrgProductFeatureOverrides({
        writing: true,
      }),
    ).toEqual({})

    expect(
      serializeOrgProductFeatureOverrides({
        writing: false,
      }),
    ).toEqual({
      writing: false,
    })
  })

  it('updates one feature while preserving compact override storage', () => {
    expect(
      setOrgProductFeatureOverride({
        featureKey: 'writing',
        enabled: false,
      }),
    ).toEqual({
      writing: false,
    })

    expect(
      setOrgProductFeatureOverride({
        overrides: { writing: false },
        featureKey: 'writing',
        enabled: true,
      }),
    ).toEqual({})
  })
})
