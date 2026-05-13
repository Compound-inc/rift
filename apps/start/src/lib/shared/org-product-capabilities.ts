import type { OrgProductPolicy } from './org-product-policy'
import type { OrgProductAddonKey } from './org-product-addons'
import type { OrgProductKey } from './org-products'

export function productCapabilityKey(input: {
  readonly addonKey?: string
}): string {
  return input.addonKey ? `${input.addonKey}.enabled` : 'enabled'
}

export function readOrgProductCapability<
  TProduct extends OrgProductKey,
>(input: {
  readonly policy: OrgProductPolicy | null | undefined
  readonly productKey: TProduct
  readonly addonKey?: OrgProductAddonKey<TProduct>
}): boolean {
  if (!input.policy) {
    return true
  }

  const key = productCapabilityKey({ addonKey: input.addonKey })
  const raw = input.policy.capabilities[key]
  if (typeof raw === 'boolean') {
    return raw
  }
  return true
}
