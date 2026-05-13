import { isOrgProductKey } from './org-products'
import type { OrgProductKey } from './org-products'

type ProductAddonDefinition = {
  readonly label: string
  readonly description: string
  readonly orgConfigurableSettingKeys: readonly string[]
}

type ProductAddonDefinitions = {
  readonly addons: Readonly<Record<string, ProductAddonDefinition>>
}

export const ORG_PRODUCT_ADDON_CATALOG = {
  chat: {
    addons: {},
  },
  writing: {
    addons: {
      core: {
        label: 'Writing Core',
        description:
          'Long-form document collaboration surfaces. Granted manually; no plan includes it by default.',
        orgConfigurableSettingKeys: [] as const,
      },
    },
  },
  hr: {
    addons: {
      core: {
        label: 'HR Core',
        description:
          'Baseline HR workspace surfaces: directory, shared settings, and onboarding entry points.',
        orgConfigurableSettingKeys: [] as const,
      },
      recruitment: {
        label: 'Recruitment',
        description:
          'Candidate pipeline, job postings, and interview scheduling workflows.',
        orgConfigurableSettingKeys: [] as const,
      },
      payroll: {
        label: 'Payroll',
        description:
          'Compensation cycles, payroll runs, and integrations with external payroll providers.',
        orgConfigurableSettingKeys: [] as const,
      },
    },
  },
} as const satisfies Record<OrgProductKey, ProductAddonDefinitions>

export type OrgProductAddonKey<TProduct extends OrgProductKey> =
  keyof (typeof ORG_PRODUCT_ADDON_CATALOG)[TProduct]['addons'] & string

export function isOrgProductAddonKey<TProduct extends OrgProductKey>(
  productKey: TProduct,
  addonKey: string,
): addonKey is OrgProductAddonKey<TProduct> {
  return addonKey in ORG_PRODUCT_ADDON_CATALOG[productKey].addons
}

export function isKnownProductAddon(input: {
  readonly productKey: string
  readonly addonKey: string
}): boolean {
  if (!isOrgProductKey(input.productKey)) {
    return false
  }

  return input.addonKey in ORG_PRODUCT_ADDON_CATALOG[input.productKey].addons
}

export function toProductAddonEntitlementId<TProduct extends OrgProductKey>(
  productKey: TProduct,
  addonKey?: OrgProductAddonKey<TProduct>,
): string {
  return addonKey ? `${productKey}.${addonKey}` : productKey
}

export function getProductAddonEntitlementIdsForProduct<
  TProduct extends OrgProductKey,
>(productKey: TProduct): readonly string[] {
  const addons = ORG_PRODUCT_ADDON_CATALOG[productKey].addons
  return [
    productKey,
    ...Object.keys(addons).map((addonKey) => `${productKey}.${addonKey}`),
  ]
}
